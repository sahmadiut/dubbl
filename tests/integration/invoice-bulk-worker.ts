import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, customRole, apiKey, contact, chartAccount, taxRate, invoice, invoiceLine,
  periodLock, emailConfig, journalLine, exchangeRate } from "../../lib/db/schema";
import { POST as IMPORT } from "../../app/api/v1/bulk/invoices/import/route";
import { POST as PREVIEW } from "../../app/api/v1/bulk/invoices/preview/route";
import { POST as SEND } from "../../app/api/v1/bulk/invoices/send/route";
import { POST as PAID } from "../../app/api/v1/bulk/invoices/mark-paid/route";
import { POST as ACTION } from "../../app/api/v1/invoices/bulk/route";
import { registerInvoiceBulkTools } from "../../lib/mcp/tools/invoice-bulk";
import { registerAllTools } from "../../lib/mcp/tools";
import type { AuthContext } from "../../lib/api/auth-context";

async function mcp(ctx: AuthContext, all = false) {
  const server = new McpServer({ name: "Bulk fixture", version: "1" });
  if (all) registerAllTools(server, ctx); else registerInvoiceBulkTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1" });
  const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
  const tools = (await client.listTools()).tools;
  assert.equal(tools.filter(tool => ["import_invoices", "preview_invoice_import", "bulk_mark_invoices_sent", "bulk_mark_invoices_paid", "bulk_send_invoice_reminders"].includes(tool.name)).length, 5);
  return { async call(name: string, args: Record<string, unknown>) {
    const result = await client.callTool({ name, arguments: args }), text = (result.content as { text: string }[])[0].text;
    return { isError: result.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
  }, async close() { await client.close(); await server.close(); } };
}
async function run() {
  const [a, b] = await db.insert(organization).values([{ name: "Bulk A", slug: "bia" }, { name: "Bulk B", slug: "bib" }]).returning();
  const [owner, viewer] = await db.insert(users).values([{ email: "bi-owner@example.test" }, { email: "bi-viewer@example.test" }]).returning();
  const [role] = await db.insert(customRole).values({ organizationId: a.id, name: "Read", permissions: [] }).returning();
  await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner" }, { organizationId: b.id, userId: owner.id, role: "owner" },
    { organizationId: a.id, userId: viewer.id, role: "member", customRoleId: role.id }]);
  const keys = { a: "dk_bi_a", b: "dk_bi_b", viewer: "dk_bi_viewer" };
  for (const [label, key] of Object.entries(keys)) await db.insert(apiKey).values({ organizationId: label === "b" ? b.id : a.id,
    createdBy: label === "viewer" ? viewer.id : owner.id, name: label, keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_bi" });
  const [customer, foreignCustomer] = await db.insert(contact).values([{ organizationId: a.id, name: "Customer" }, { organizationId: b.id, name: "Foreign" }]).returning();
  const [revenue, , , foreignAccount] = await db.insert(chartAccount).values([{ organizationId: a.id, code: "4000", name: "Revenue", type: "revenue" },
    { organizationId: a.id, code: "1200", name: "AR", type: "asset" }, { organizationId: a.id, code: "2200", name: "Tax", type: "liability" },
    { organizationId: b.id, code: "4000", name: "Foreign", type: "revenue" }]).returning();
  const [tax, foreignTax] = await db.insert(taxRate).values([{ organizationId: a.id, name: "10%", rate: 1000 }, { organizationId: b.id, name: "Foreign", rate: 1000 }]).returning();
  const ctx: AuthContext = { organizationId: a.id, userId: owner.id, role: "owner" };
  const ma = await mcp(ctx, true), mb = await mcp({ ...ctx, organizationId: b.id }), ro = await mcp({ ...ctx, role: "member", permissions: [], userId: viewer.id });
  const req = (body: unknown, key = keys.a) => new Request("http://fixture.test/api/v1/bulk/invoices", {
    method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-organization-id": b.id }, body: JSON.stringify(body),
  });
  const basic = { contactId: customer.id, issueDate: "2026-06-01", dueDate: "2026-07-01", reference: "basic",
    lines: [{ description: "Service", unitPriceMinor: "1250", accountId: revenue.id }] };
  const payload = (rows: unknown[] = [basic]) => ({ fileName: "fixture.csv", rows });
  const tables = ["invoice", "invoice_line", "journal_entry", "journal_line", "number_sequence", "bulk_import_job", "payment", "payment_allocation", "reminder_log"];
  const snapshot = async (excludeJobs = false) => {
    const result = []; for (const table of tables) if (!excludeJobs || table !== "bulk_import_job") result.push((await db.execute(sql.raw(`select coalesce(jsonb_agg(to_jsonb(t)::text order by t.id),'[]'::jsonb) as rows from ${table} t`))).rows);
    result.push((await db.execute(sql`select count(*)::text from audit_log`)).rows); return result;
  };
  const unchanged = async (op: () => Promise<unknown>) => { const before = await snapshot(); await op(); assert.deepEqual(await snapshot(), before); };
  const read = async (id: string) => (await db.select().from(invoice).where(eq(invoice.id, id)))[0];
  const make = async (values: Record<string, unknown> = {}) => {
    const ref = `fixture-${Math.random()}`;
    const response = await IMPORT(req(payload([{ ...basic, ...values, reference: ref }])));
    assert.equal(response.status, 201, JSON.stringify(await response.clone().json()));
    assert.equal((await response.json()).job.processedRows, 1);
    return (await db.select().from(invoice).where(eq(invoice.reference, ref)))[0];
  };
  const fault = async (table: string, op: () => Promise<unknown>) => {
    assert.ok(tables.includes(table));
    await db.execute(sql.raw("create function bi_fault() returns trigger language plpgsql as $$ begin raise exception 'bulk fixture fault'; end $$"));
    await db.execute(sql.raw(`create trigger bi_fault before insert on ${table} for each row execute function bi_fault()`));
    try { await op(); } finally { await db.execute(sql.raw(`drop trigger bi_fault on ${table}`)); await db.execute(sql.raw("drop function bi_fault()")); }
  };
  try {
    for (const price of [{ unitPrice: 12.5 }, { unitPriceExact: "12.50" }, { unitPriceMinor: "1250" }, { unitPrice: 12.5, unitPriceExact: "12.50", unitPriceMinor: "1250" }]) {
      const data = { ...basic, lines: [{ ...basic.lines[0], unitPriceMinor: undefined, ...price, quantity: 1.5, taxRateId: tax.id }] };
      const preview = await PREVIEW(req({ rows: [data] })); assert.equal(preview.status, 200);
      const dto = (await preview.json()).preview[0]; assert.equal(dto.valid, true); assert.equal(dto.total, 2063); assert.equal(dto.totalMinor, "2063");
      const mp = await ma.call("preview_invoice_import", { rows: [data] }); assert.equal(mp.body.preview[0].totalMinor, "2063");
      const mi = await ma.call("import_invoices", payload([data])); assert.equal(mi.isError, false); assert.equal(mi.body.job.processedRows, 1);
      const created = await make({ lines: data.lines }); assert.equal(created.total, 2063); assert.equal(created.currencyCode, "USD");
    }
    for (const [currencyCode, expected] of [["JPY", 13], ["IRR", 13], ["KWD", 12500]] as const) {
      assert.equal((await make({ currencyCode, lines: [{ description: "Currency", unitPriceExact: "12.50" }] })).total, expected);
    }
    const max = await make({ lines: [{ description: "Max", unitPriceMinor: "9007199254740991" }] }); assert.equal(max.total, Number.MAX_SAFE_INTEGER);
    const flat = { contactId: customer.id, issueDate: "6/1/2026", dueDate: "7/1/2026", invoiceNumber: "External", lineDescription: "CSV", lineQuantity: "1.50", lineUnitPrice: "12.50", lineAccountId: revenue.id };
    const grouped = { ...payload([flat, flat]), source: "quickbooks" };
    const groupedPreview = await ma.call("preview_invoice_import", grouped); assert.equal(groupedPreview.body.totalCount, 1); assert.equal(groupedPreview.body.preview[0].totalMinor, "3750");
    assert.equal((await (await IMPORT(req(grouped))).json()).job.processedRows, 1);
    assert.equal((await ma.call("import_invoices", grouped)).body.job.totalRows, 1);
    const rounded = await make({ lines: [{ description: "Extended", unitPriceExact: "0.005", quantity: 3 }] }); assert.equal(rounded.total, 2);
    const signed = await make({ lines: [{ description: "Signed", unitPriceExact: "-0.015" }] }); assert.equal(signed.total, -1);
    for (const line of [{ unitPriceMinor: "9007199254740992" }, { unitPriceMinor: "01" }, { unitPriceExact: "1e3" }, { unitPrice: 12.5, unitPriceExact: "12.51" },
      { unitPriceMinor: "9007199254740991", quantity: 2, discountPercent: 10000 }, { quantity: 21474836.48 }, { unitPriceMinor: "9007199254740991", taxRateId: tax.id }]) {
      const data = payload([basic, { ...basic, lines: [{ description: "Invalid", ...line }] }]);
      await unchanged(async () => { assert.ok([400, 422].includes((await IMPORT(req(data))).status)); assert.equal((await ma.call("import_invoices", data)).isError, true); });
    }
    for (const rows of [[{ ...basic, currencyCode: "BTC" }], [{ ...basic, rateExact: "1.2" }], [{ ...basic, issueDate: "2026-02-30" }], [{ ...basic, lines: [] }],
      [flat, { ...flat, currencyCode: "JPY" }], [{ ...flat, lineUnitPrice: "12junk" }]]) {
      await unchanged(async () => { assert.equal((await IMPORT(req(payload(rows)))).status, 400); assert.equal((await ma.call("import_invoices", payload(rows))).isError, true); });
    }
    await unchanged(async () => {
      assert.equal((await IMPORT(new Request("http://fixture.test", { method: "POST", headers: { authorization: `Bearer ${keys.a}` }, body: "{" }))).status, 400);
      assert.equal((await IMPORT(req(payload(), keys.viewer))).status, 403);
      assert.equal((await ma.call("preview_invoice_import", { rows: [basic] })).isError, false);
      assert.equal((await ro.call("import_invoices", payload())).body.status, 403);
      assert.equal((await IMPORT(req(payload(), "dk_invalid"))).status, 401);
    });
    for (const input of [{ contactId: foreignCustomer.id }, { lines: [{ ...basic.lines[0], accountId: foreignAccount.id }] }, { lines: [{ ...basic.lines[0], taxRateId: foreignTax.id }] }]) {
      const data = { ...basic, ...input };
      const job = (await (await IMPORT(req(payload([data])))).json()).job; assert.equal(job.processedRows, 0); assert.equal(job.errorRows, 1);
      assert.equal((await ma.call("preview_invoice_import", { rows: [data] })).body.validCount, 0);
      assert.equal((await mb.call("import_invoices", payload())).body.job.processedRows, 0);
    }
    const deletedCustomer = await db.insert(contact).values({ organizationId: a.id, name: "Deleted", deletedAt: new Date() }).returning();
    assert.equal((await ma.call("import_invoices", payload([{ ...basic, contactId: deletedCustomer[0].id }]))).body.job.processedRows, 0);
    // Failed document line insertion rolls back its header and its number, retaining the job report.
    const beforeFault = (await db.execute(sql`select count(*)::text as count from invoice`)).rows;
    const numberBefore = (await db.execute(sql`select last_number from number_sequence where organization_id = ${a.id} and entity_type = 'invoice'`)).rows;
    await fault("invoice_line", async () => {
      const job = (await (await IMPORT(req(payload()))).json()).job; assert.equal(job.processedRows, 0); assert.equal(job.errorRows, 1);
    });
    assert.deepEqual((await db.execute(sql`select count(*)::text as count from invoice`)).rows, beforeFault);
    assert.deepEqual((await db.execute(sql`select last_number from number_sequence where organization_id = ${a.id} and entity_type = 'invoice'`)).rows, numberBefore);
    const partial = (await (await IMPORT(req(payload([basic, { ...basic, contactId: foreignCustomer.id }])))).json()).job;
    assert.equal(partial.processedRows, 1); assert.equal(partial.errorRows, 1); assert.equal(partial.status, "completed");
    const [foreign] = await db.insert(invoice).values({ organizationId: b.id, contactId: foreignCustomer.id, invoiceNumber: "INV-00001", issueDate: basic.issueDate, dueDate: basic.dueDate }).returning();
    const deleted = await make(); await db.update(invoice).set({ deletedAt: new Date() }).where(eq(invoice.id, deleted.id));
    const first = await make(), second = await make();
    const sent = await SEND(req({ ids: [first.id, second.id, first.id, foreign.id, deleted.id] })); assert.equal(sent.status, 200);
    assert.deepEqual((await sent.json()).ids, [first.id, second.id]);
    assert.equal((await read(first.id)).status, "sent"); assert.ok((await read(first.id)).journalEntryId);
    assert.equal((await read(foreign.id)).status, "draft"); assert.equal((await read(deleted.id)).status, "draft");
    const legs = await db.select().from(journalLine).where(eq(journalLine.journalEntryId, (await read(first.id)).journalEntryId!));
    assert.equal(legs.reduce((sum, line) => sum + line.debitAmount, 0), 1250); assert.equal(legs.reduce((sum, line) => sum + line.creditAmount, 0), 1250);
    assert.ok(legs.every(line => line.rateExact === "1"));
    assert.equal((await ma.call("bulk_mark_invoices_sent", { ids: [first.id, foreign.id, deleted.id] })).body.updated, 0);
    const actionRow = await make(); const action = await ACTION(req({ action: "mark-as-sent", invoiceIds: [actionRow.id, foreign.id] }));
    assert.equal(action.status, 200); assert.deepEqual((await action.json()).summary, { total: 2, sent: 1, skipped: 1, failed: 0 });
    const concurrent = await make();
    const race = await Promise.all([SEND(req({ ids: [concurrent.id] })), ma.call("bulk_mark_invoices_sent", { ids: [concurrent.id] })]);
    assert.equal((await (race[0] as Response).json()).updated + (race[1] as { body: { updated: number } }).body.updated, 1);
    const good = await make(), bad = await make({ lines: [{ description: "Missing account", unitPriceMinor: "1" }] });
    await unchanged(async () => assert.equal((await SEND(req({ ids: [good.id, bad.id] }))).status, 400));
    assert.equal((await read(good.id)).status, "draft");
    await fault("journal_line", async () => unchanged(async () => assert.equal((await SEND(req({ ids: [good.id] }))).status, 500)));
    // Unsafe saved history fails before any selected invoice mutation or reminder delivery.
    const unsafe = await make(); await db.execute(sql`update invoice set total = 9007199254740992 where id = ${unsafe.id}`);
    await unchanged(async () => {
      assert.equal((await SEND(req({ ids: [good.id, unsafe.id] }))).status, 422);
      assert.equal((await PAID(req({ ids: [first.id, unsafe.id] }))).status, 422);
      assert.equal((await ACTION(req({ action: "send-reminder", invoiceIds: [unsafe.id] }))).status, 422);
      assert.equal((await ma.call("bulk_mark_invoices_sent", { ids: [unsafe.id] })).body.status, 422);
      assert.equal((await ma.call("bulk_send_invoice_reminders", { invoiceIds: [unsafe.id] })).body.status, 422);
    });
    await db.execute(sql`update invoice set total = 1250 where id = ${unsafe.id}`);
    await db.execute(sql`update invoice_line set unit_price = 9007199254740992 where invoice_id = ${unsafe.id}`);
    await unchanged(async () => {
      assert.equal((await SEND(req({ ids: [good.id, unsafe.id] }))).status, 422);
      assert.equal((await ma.call("bulk_mark_invoices_paid", { ids: [unsafe.id] })).body.status, 422);
    });
    await db.update(invoiceLine).set({ unitPrice: 1250 }).where(eq(invoiceLine.invoiceId, unsafe.id));
    const validPaid = await PAID(req({ ids: [first.id, first.id, foreign.id, deleted.id, good.id] })); assert.equal(validPaid.status, 200); assert.equal((await validPaid.json()).updated, 1);
    assert.equal((await read(first.id)).amountPaid, 1250); assert.equal((await read(first.id)).amountDue, 0);
    assert.equal((await ma.call("bulk_mark_invoices_paid", { ids: [first.id] })).body.updated, 0);
    assert.equal((await ma.call("bulk_mark_invoices_paid", { ids: [second.id] })).body.updated, 1);
    assert.equal((await db.execute(sql`select count(*)::text as count from payment`)).rows[0].count, "0");
    assert.equal((await db.execute(sql`select count(*)::text as count from payment_allocation`)).rows[0].count, "0");
    const inconsistent = await make(); await SEND(req({ ids: [inconsistent.id] })); await db.update(invoice).set({ amountDue: 1249 }).where(eq(invoice.id, inconsistent.id));
    await unchanged(async () => assert.equal((await PAID(req({ ids: [actionRow.id, inconsistent.id] }))).status, 422));
    await db.update(invoice).set({ amountDue: 1250 }).where(eq(invoice.id, inconsistent.id));
    await db.insert(periodLock).values({ organizationId: a.id, lockDate: basic.issueDate, advisorLockDate: basic.issueDate });
    await unchanged(async () => {
      assert.equal((await SEND(req({ ids: [good.id] }))).status, 422);
      assert.equal((await PAID(req({ ids: [actionRow.id] }))).status, 422);
      assert.equal((await ma.call("bulk_mark_invoices_paid", { ids: [actionRow.id] })).body.status, 422);
    });
    const lockedJob = (await (await IMPORT(req(payload()))).json()).job; assert.equal(lockedJob.processedRows, 0);
    await db.delete(periodLock).where(eq(periodLock.organizationId, a.id));
    const eur = await make({ currencyCode: "EUR" });
    await unchanged(async () => assert.equal((await SEND(req({ ids: [good.id, eur.id] }))).status, 422));
    await db.insert(exchangeRate).values({ organizationId: a.id, baseCurrency: "EUR", targetCurrency: "USD", rate: 1234567, date: basic.issueDate, source: "manual" });
    assert.equal((await ma.call("bulk_mark_invoices_sent", { ids: [eur.id] })).isError, false);
    const eurLegs = await db.select().from(journalLine).where(eq(journalLine.journalEntryId, (await read(eur.id)).journalEntryId!));
    assert.ok(eurLegs.every(line => line.rateExact === "1.234567"));
    await unchanged(async () => {
      assert.equal((await SEND(req({ ids: [good.id] }, keys.viewer))).status, 403);
      assert.equal((await PAID(req({ ids: [eur.id] }, keys.viewer))).status, 403);
      assert.equal((await ACTION(req({ action: "send-reminder", invoiceIds: [eur.id] }, keys.viewer))).status, 403);
      assert.equal((await ro.call("bulk_mark_invoices_sent", { ids: [good.id] })).body.status, 403);
      assert.equal((await ro.call("bulk_mark_invoices_paid", { ids: [eur.id] })).body.status, 403);
      assert.equal((await ro.call("bulk_send_invoice_reminders", { invoiceIds: [eur.id] })).body.status, 403);
      assert.equal((await SEND(req({ ids: [good.id] }, keys.b))).status, 200);
      assert.equal((await mb.call("bulk_mark_invoices_paid", { ids: [eur.id] })).body.updated, 0);
      assert.equal((await ACTION(req({ action: "send-reminder", invoiceIds: [eur.id] }))).status, 400);
    });
    // Verified config without SMTP causes no network: no-email/non-owed/missing items are skipped.
    await db.insert(emailConfig).values({ organizationId: a.id, smtpHost: "fixture.invalid", smtpPort: 587, smtpUsername: "fixture", smtpPassword: "fixture", fromEmail: "fixture@example.test", fromName: "Fixture", isVerified: true });
    const reminders = await ma.call("bulk_send_invoice_reminders", { invoiceIds: [eur.id, first.id, good.id, foreign.id, deleted.id, eur.id] });
    assert.equal(reminders.isError, false); assert.deepEqual(reminders.body.summary, { total: 5, sent: 0, skipped: 5, failed: 0 });
    const restReminders = await ACTION(req({ action: "send-reminder", invoiceIds: [eur.id, first.id, foreign.id] })); assert.equal(restReminders.status, 200); assert.equal((await restReminders.json()).summary.skipped, 3);
    await db.update(contact).set({ email: "customer@example.test" }).where(eq(contact.id, customer.id));
    const beforeDunning = (await read(eur.id)).dunningLevel;
    const failure = await ma.call("bulk_send_invoice_reminders", { invoiceIds: [eur.id] });
    assert.equal(failure.isError, false); assert.equal(failure.body.summary.failed, 1);
    assert.equal((await read(eur.id)).dunningLevel, beforeDunning);
    assert.equal((await db.execute(sql`select count(*)::text as count from reminder_log where document_id = ${eur.id} and status = 'failed'`)).rows[0].count, "1");
    await db.update(invoice).set({ contactId: foreignCustomer.id }).where(eq(invoice.id, unsafe.id));
    await unchanged(async () => {
      assert.equal((await ACTION(req({ action: "send-reminder", invoiceIds: [eur.id, unsafe.id] }))).status, 422);
      assert.equal((await ma.call("bulk_mark_invoices_sent", { ids: [unsafe.id] })).body.status, 422);
    });
    await db.update(invoice).set({ contactId: customer.id }).where(eq(invoice.id, unsafe.id));
    await db.update(taxRate).set({ rate: -1 }).where(eq(taxRate.id, tax.id));
    await unchanged(async () => assert.equal((await IMPORT(req(payload([{ ...basic, lines: [{ ...basic.lines[0], taxRateId: tax.id }] }])))).status, 422));
    console.log("REST and MCP bulk invoices verified: units, grouped imports, auth/org isolation, safe range, atomic posting/annotation, retries, locks, rollback and reminder preflight.");
  } finally { await ma.close(); await mb.close(); await ro.close(); }
}
try { await run(); } finally { await (db as unknown as { $client: { end(): Promise<void> } }).$client.end(); }
