import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, customRole, apiKey, contact, chartAccount, taxRate, recurringTemplate,
  invoice, invoiceLine, journalLine, periodLock, exchangeRate, documentEmailLog } from "../../lib/db/schema";
import { GET as LIST, POST } from "../../app/api/v1/recurring-invoices/route";
import { GET, PATCH, DELETE } from "../../app/api/v1/recurring-invoices/[id]/route";
import { GET as GENERAL_LIST, POST as GENERAL_CREATE } from "../../app/api/v1/recurring/route";
import { GET as GENERAL_GET, PATCH as GENERAL_PATCH, DELETE as GENERAL_DELETE } from "../../app/api/v1/recurring/[id]/route";
import { GET as PREVIEW } from "../../app/api/v1/recurring/[id]/preview/route";
import { POST as PAUSE } from "../../app/api/v1/recurring/[id]/pause/route";
import { registerRecurringTemplateTools } from "../../lib/mcp/tools/recurring-templates";
import { processRecurringInvoiceTemplate } from "../../lib/api/recurring-invoice-generate";
import { processRecurringTemplates } from "../../lib/api/recurring-generate";
import type { AuthContext } from "../../lib/api/auth-context";

async function mcp(ctx: AuthContext) {
  const server = new McpServer({ name: "Recurring fixture", version: "1" }); registerRecurringTemplateTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1" });
  const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
  const tools = (await client.listTools()).tools; assert.equal(tools.length, 11);
  assert.ok(JSON.stringify(tools.find(tool => tool.name === "create_recurring_template")!.inputSchema).includes("unitPriceMinor"));
  return { async call(name: string, args: Record<string, unknown> = {}) {
    const result = await client.callTool({ name, arguments: args }), text = (result.content as { text: string }[])[0].text;
    return { isError: result.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
  }, async close() { await client.close(); await server.close(); } };
}
async function run() {
  const [a, b] = await db.insert(organization).values([{ name: "Recurring A", slug: "ria" }, { name: "Recurring B", slug: "rib" }]).returning();
  const [owner, viewer] = await db.insert(users).values([{ email: "ri-owner@example.test" }, { email: "ri-viewer@example.test" }]).returning();
  const [role] = await db.insert(customRole).values({ organizationId: a.id, name: "Read", permissions: [] }).returning();
  await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner" }, { organizationId: b.id, userId: owner.id, role: "owner" },
    { organizationId: a.id, userId: viewer.id, role: "member", customRoleId: role.id }]);
  const keys = { a: "dk_ri_a", b: "dk_ri_b", viewer: "dk_ri_viewer" };
  for (const [label, key] of Object.entries(keys)) await db.insert(apiKey).values({ organizationId: label === "b" ? b.id : a.id,
    createdBy: label === "viewer" ? viewer.id : owner.id, name: label, keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_ri" });
  const [customer, foreignCustomer] = await db.insert(contact).values([{ organizationId: a.id, name: "Customer", paymentTermsDays: 0 }, { organizationId: b.id, name: "Foreign" }]).returning();
  const [revenue, ar, taxAccount, foreignAccount] = await db.insert(chartAccount).values([{ organizationId: a.id, code: "4000", name: "Revenue", type: "revenue" },
    { organizationId: a.id, code: "1200", name: "AR", type: "asset" }, { organizationId: a.id, code: "2200", name: "Tax", type: "liability" },
    { organizationId: b.id, code: "4000", name: "Foreign", type: "revenue" }]).returning();
  assert.ok(ar.id && taxAccount.id);
  const [tax, foreignTax] = await db.insert(taxRate).values([{ organizationId: a.id, name: "10%", rate: 1000 }, { organizationId: b.id, name: "Foreign", rate: 1000 }]).returning();
  const ctx: AuthContext = { organizationId: a.id, userId: owner.id, role: "owner" };
  const ma = await mcp(ctx), mb = await mcp({ ...ctx, organizationId: b.id }), ro = await mcp({ ...ctx, role: "member", permissions: [], userId: viewer.id });
  const today = new Date().toISOString().split("T")[0];
  const params = (id: string) => ({ params: Promise.resolve({ id }) });
  const req = (method: string, body?: unknown, key = keys.a, query = "") => new Request(`http://fixture.test/api/v1/recurring-invoices${query}`, {
    method, headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-organization-id": b.id },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const basic = { name: "Subscription", contactId: customer.id, frequency: "monthly", startDate: today, maxOccurrences: 1,
    lines: [{ description: "Service", unitPriceMinor: "1250", accountId: revenue.id }] };
  const make = async (body: unknown = basic) => { const response = await POST(req("POST", body)); assert.equal(response.status, 201, JSON.stringify(await response.clone().json())); return (await response.json()).template; };
  const tables = ["recurring_template", "recurring_template_line", "invoice", "invoice_line", "journal_entry", "journal_line", "number_sequence"];
  const snapshot = async () => {
    const rows = []; for (const table of tables) rows.push((await db.execute(sql.raw(`select coalesce(jsonb_agg(to_jsonb(t)::text order by t.id),'[]'::jsonb) as rows from ${table} t`))).rows);
    rows.push((await db.execute(sql`select count(*)::text from audit_log`)).rows); return rows;
  };
  const unchanged = async (op: () => Promise<unknown>) => { const before = await snapshot(); await op(); assert.deepEqual(await snapshot(), before); };
  const fault = async (table: string, event: string, op: () => Promise<unknown>) => {
    assert.ok(tables.includes(table)); assert.ok(["insert", "update"].includes(event));
    await db.execute(sql.raw("create function ri_fault() returns trigger language plpgsql as $$ begin raise exception 'recurring fixture fault'; end $$"));
    await db.execute(sql.raw(`create trigger ri_fault before ${event} on ${table} for each row execute function ri_fault()`));
    try { await unchanged(op); } finally { await db.execute(sql.raw(`drop trigger ri_fault on ${table}`)); await db.execute(sql.raw("drop function ri_fault()")); }
  };
  const invoices = async (reference: string) => db.select().from(invoice).where(eq(invoice.reference, reference));
  try {
    for (const price of [{ unitPrice: 12.5 }, { unitPriceExact: "12.50" }, { unitPriceMinor: "1250" }, { unitPrice: 12.5, unitPriceExact: "12.50", unitPriceMinor: "1250" }]) {
      const body = { ...basic, lines: [{ description: "Service", ...price, quantity: 1.5, discountPercent: 1000, taxRateId: tax.id, accountId: revenue.id }] };
      const row = await make(body);
      assert.equal((await (await GET(req("GET"), params(row.id))).json()).template.lines[0].unitPriceMinor, "1250");
      const result = await ma.call("create_recurring_template", { ...body, type: "invoice" }); assert.equal(result.isError, false);
      const get = await ma.call("get_recurring_template", { templateId: result.body.template.id }); assert.equal(get.body.template.lines[0].unitPrice, 1250);
    }
    for (const [currency, expected] of [["JPY", "13"], ["IRR", "13"], ["KWD", "12500"]]) {
      const row = await make({ ...basic, currencyCode: currency, lines: [{ ...basic.lines[0], unitPriceMinor: undefined, unitPriceExact: "12.50" }] });
      assert.equal((await (await GET(req("GET"), params(row.id))).json()).template.lines[0].unitPriceMinor, expected);
    }
    for (const line of [{ unitPriceMinor: "9007199254740992" }, { unitPriceMinor: "01" }, { unitPrice: 12.5, unitPriceExact: "12.51" },
      { unitPriceMinor: "9007199254740991", quantity: 2, discountPercent: 10000 }, { quantity: 21474836.48 }, { unitPriceExact: "1e3" }]) {
      await unchanged(async () => { const body = { ...basic, lines: [{ description: "Invalid", ...line }] }; assert.ok([400, 422].includes((await POST(req("POST", body))).status)); assert.equal((await ma.call("create_recurring_template", { ...body, type: "invoice" })).isError, true); });
    }
    for (const input of [{ contactId: foreignCustomer.id }, { endDate: "2000-01-01" }, { startDate: "2026-02-30" }, { rateExact: "1.2" }, { maxOccurrences: 2147483648 },
      { lines: [{ ...basic.lines[0], accountId: foreignAccount.id }] }, { lines: [{ ...basic.lines[0], taxRateId: foreignTax.id }] }]) {
      await unchanged(async () => assert.equal((await POST(req("POST", { ...basic, ...input }))).status, 400));
    }
    await unchanged(async () => {
      const malformed = new Request("http://fixture.test/api/v1/recurring-invoices", { method: "POST", headers: { authorization: `Bearer ${keys.a}`, "content-type": "application/json" }, body: "{" });
      assert.equal((await POST(malformed)).status, 400);
    });
    const row = await make();
    assert.equal((await (await LIST(req("GET"))).json()).data.some((t: { id: string }) => t.id === row.id), true);
    assert.equal((await (await GENERAL_LIST(req("GET", undefined, keys.a, "?type=invoice"))).json()).data.some((t: { id: string }) => t.id === row.id), true);
    assert.equal((await (await GENERAL_GET(req("GET"), params(row.id))).json()).template.lines[0].unitPriceMinor, "1250");
    const generic = await GENERAL_CREATE(req("POST", { ...basic, type: "invoice" })); assert.equal(generic.status, 201);
    assert.equal((await GENERAL_PATCH(req("PATCH", { notes: "Generic" }), params(row.id))).status, 200);
    assert.equal((await GENERAL_DELETE(req("DELETE"), params((await generic.json()).template.id))).status, 200);
    const preview = await (await PREVIEW(req("GET", undefined, keys.a, "?count=3"), params(row.id))).json(); assert.equal(preview.template.lineTotalMinor, "1250"); assert.equal(preview.upcoming.length, 1);
    assert.equal((await ma.call("preview_recurring_invoice", { templateId: row.id })).body.template.lineTotalMinor, "1250");
    assert.equal((await PAUSE(req("POST"), params(row.id))).status, 200);
    assert.equal((await ma.call("list_recurring_templates", { type: "invoice", status: "paused" })).body.templates.every((t: { status: string }) => t.status === "paused"), true);
    assert.equal((await ma.call("pause_recurring_template", { templateId: row.id })).body.template.status, "active");
    assert.equal((await PATCH(req("PATCH", { currencyCode: "EUR", notes: "Changed" }), params(row.id))).status, 200);
    await unchanged(async () => {
      assert.equal((await PATCH(req("PATCH", { currencyCode: "JPY" }), params(row.id))).status, 422);
      assert.equal((await GET(req("GET", undefined, keys.b), params(row.id))).status, 404);
      assert.equal((await PATCH(req("PATCH", { notes: "Foreign" }, keys.b), params(row.id))).status, 404);
      assert.equal((await DELETE(req("DELETE", undefined, keys.b), params(row.id))).status, 404);
      assert.equal((await mb.call("get_recurring_template", { templateId: row.id })).isError, true);
      assert.equal((await mb.call("delete_recurring_invoice", { templateId: row.id })).isError, true);
      assert.equal((await POST(req("POST", basic, keys.viewer))).status, 403);
      assert.equal((await PATCH(req("PATCH", { notes: "Denied" }, keys.viewer), params(row.id))).status, 403);
      assert.equal((await ro.call("create_recurring_template", { ...basic, type: "invoice" })).body.status, 403);
      assert.equal((await ro.call("run_recurring_template", { templateId: row.id })).body.status, 403);
      assert.equal((await ma.call("create_recurring_template", { ...basic, type: "invoice", rateExact: "1.2" })).isError, true);
      assert.equal((await ma.call("update_recurring_template", { templateId: row.id, rateExact: "1.2" })).isError, true);
      assert.equal((await mb.call("update_recurring_template", { templateId: row.id, notes: "Foreign" })).isError, true);
      assert.equal((await mb.call("pause_recurring_template", { templateId: row.id })).isError, true);
      assert.equal((await mb.call("run_recurring_template", { templateId: row.id })).isError, true);
      assert.equal((await ro.call("delete_recurring_invoice", { templateId: row.id })).body.status, 403);
      assert.equal((await DELETE(req("DELETE", undefined, keys.viewer), params(row.id))).status, 403);
    });
    const edited = await ma.call("update_recurring_template", { templateId: row.id, notes: "MCP edit" });
    assert.equal(edited.isError, false); assert.equal(edited.body.template.notes, "MCP edit");
    const [bill] = await db.insert(recurringTemplate).values({ organizationId: a.id, contactId: customer.id, name: "Bill", type: "bill", frequency: "monthly", startDate: today, nextRunDate: today }).returning();
    assert.equal((await GET(req("GET"), params(bill.id))).status, 404);
    assert.equal((await ma.call("delete_recurring_invoice", { templateId: bill.id })).isError, true);
    assert.equal((await DELETE(req("DELETE"), params(row.id))).status, 200); assert.equal((await GET(req("GET"), params(row.id))).status, 404);
    await fault("recurring_template_line", "insert", async () => assert.equal((await POST(req("POST", basic))).status, 500));
    const saved = await make(); await db.execute(sql`update recurring_template_line set unit_price = 9007199254740992 where template_id = ${saved.id}`);
    await unchanged(async () => { assert.equal((await GET(req("GET"), params(saved.id))).status, 422); assert.equal((await PATCH(req("PATCH", { notes: "Unsafe" }), params(saved.id))).status, 422); });
    await db.execute(sql`update recurring_template_line set unit_price = 1250 where template_id = ${saved.id}`);
    await db.update(recurringTemplate).set({ status: "paused" }).where(eq(recurringTemplate.organizationId, a.id));
    const fullRollback = await make({ ...basic, startDate: "2026-01-01", frequency: "weekly", maxOccurrences: 3, reference: "fullRollback" });
    await db.execute(sql.raw("create function ri_second_fault() returns trigger language plpgsql as $$ begin if exists (select 1 from invoice where id = new.invoice_id and issue_date = '2026-01-08') then raise exception 'second occurrence fault'; end if; return new; end $$"));
    await db.execute(sql.raw("create trigger ri_second_fault before insert on invoice_line for each row execute function ri_second_fault()"));
    try { await unchanged(async () => assert.rejects(processRecurringInvoiceTemplate(a.id, fullRollback.id, today))); }
    finally { await db.execute(sql.raw("drop trigger ri_second_fault on invoice_line")); await db.execute(sql.raw("drop function ri_second_fault()")); }
    assert.equal((await invoices("fullRollback")).length, 0);
    await db.update(recurringTemplate).set({ status: "paused" }).where(eq(recurringTemplate.id, fullRollback.id));
    // Catch-up, concurrency, numbering and saved exact posting FX.
    const catchup = await make({ ...basic, startDate: "2026-01-01", frequency: "weekly", maxOccurrences: 3, reference: "catchup", createAsApproved: true,
      lines: [{ ...basic.lines[0], taxRateId: tax.id, quantity: 1.5, discountPercent: 1000 }] });
    const concurrent = await Promise.all([processRecurringInvoiceTemplate(a.id, catchup.id, today), processRecurringInvoiceTemplate(a.id, catchup.id, today)]);
    assert.equal(concurrent.reduce((sum, n) => sum + n, 0), 3);
    const generated = await invoices("catchup"); assert.equal(generated.length, 3); assert.equal(new Set(generated.map(inv => inv.invoiceNumber)).size, 3);
    for (const inv of generated) { assert.equal(inv.total, 1856); assert.equal(inv.status, "sent"); assert.equal(inv.dueDate, inv.issueDate);
      const legs = await db.select().from(journalLine).where(eq(journalLine.journalEntryId, inv.journalEntryId!));
      assert.equal(legs.reduce((sum, l) => sum + l.debitAmount, 0), 1856); assert.equal(legs[0].rateExact, "1"); }
    const draft = await make({ ...basic, reference: "draft", lines: [{ ...basic.lines[0], unitPriceMinor: "9007199254740991" }] });
    assert.equal(await processRecurringInvoiceTemplate(a.id, draft.id, today), 1); assert.equal((await invoices("draft"))[0].total, Number.MAX_SAFE_INTEGER);
    const locked = await make({ ...basic, reference: "locked" });
    await db.insert(periodLock).values({ organizationId: a.id, lockDate: today });
    await unchanged(async () => assert.rejects(processRecurringInvoiceTemplate(a.id, locked.id, today)));
    await db.delete(periodLock).where(eq(periodLock.organizationId, a.id));
    const missingFx = await make({ ...basic, currencyCode: "EUR", createAsApproved: true, reference: "fx" });
    await unchanged(async () => assert.rejects(processRecurringInvoiceTemplate(a.id, missingFx.id, today)));
    await db.insert(exchangeRate).values({ organizationId: a.id, baseCurrency: "EUR", targetCurrency: "USD", date: today, rate: 1200000, source: "manual" });
    assert.equal(await processRecurringInvoiceTemplate(a.id, missingFx.id, today), 1);
    const fxInv = (await invoices("fx"))[0]; assert.equal((await db.select().from(journalLine).where(eq(journalLine.journalEntryId, fxInv.journalEntryId!)))[0].rateExact, "1.2");
    const rollback = await make({ ...basic, reference: "rollback", createAsApproved: true });
    for (const [table, event] of [["invoice_line", "insert"], ["journal_line", "insert"], ["recurring_template", "update"]]) {
      await fault(table, event, async () => assert.rejects(processRecurringInvoiceTemplate(a.id, rollback.id, today)));
    }
    assert.equal((await invoices("rollback")).length, 0);
    const corrupted = await make({ ...basic, reference: "corrupted" });
    await db.execute(sql`update recurring_template_line set account_id = ${foreignAccount.id} where template_id = ${corrupted.id}`);
    await unchanged(async () => { assert.equal((await GET(req("GET"), params(corrupted.id))).status, 400); await assert.rejects(processRecurringInvoiceTemplate(a.id, corrupted.id, today)); });
    await db.execute(sql`update recurring_template_line set account_id = ${revenue.id} where template_id = ${corrupted.id}`);
    await db.update(contact).set({ deletedAt: new Date() }).where(eq(contact.id, customer.id));
    await unchanged(async () => assert.rejects(processRecurringInvoiceTemplate(a.id, corrupted.id, today)));
    await db.update(contact).set({ deletedAt: null }).where(eq(contact.id, customer.id));
    // Paused/deleted/type/foreign targets never generate.
    assert.equal(await processRecurringInvoiceTemplate(a.id, bill.id, today), 0); assert.equal(await processRecurringInvoiceTemplate(b.id, rollback.id, today), 0);
    await db.update(recurringTemplate).set({ status: "paused" }).where(eq(recurringTemplate.organizationId, a.id));
    await db.update(contact).set({ email: "recurring@example.test" }).where(eq(contact.id, customer.id));
    const auto = await make({ ...basic, reference: "auto", autoSend: true });
    const result = await ma.call("run_recurring_template", { templateId: auto.id }); assert.equal(result.isError, false); assert.equal(result.body.generated, 1);
    assert.equal((await invoices("auto"))[0].status, "sent");
    const emails = await db.select().from(documentEmailLog).where(eq(documentEmailLog.documentId, (await invoices("auto"))[0].id));
    assert.equal(emails.length, 1); assert.equal(emails[0].status, "failed"); assert.equal(await processRecurringTemplates(a.id, { types: ["invoice"] }), 0);
    assert.equal((await ma.call("pause_recurring_template", { templateId: auto.id })).isError, true);
    const remove = await make(); assert.equal((await ma.call("delete_recurring_invoice", { templateId: remove.id })).body.success, true);
    assert.equal(await processRecurringInvoiceTemplate(a.id, remove.id, today), 0);
    assert.ok((await db.select().from(invoiceLine)).length > 0);
    console.log("REST and MCP recurring invoices verified");
  } finally { await ma.close(); await mb.close(); await ro.close(); }
}
run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
