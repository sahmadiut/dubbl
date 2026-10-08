// Runs only against the wrapper's randomly named disposable migrated database.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, customRole, apiKey, contact, chartAccount, taxRate, costCenter, invoice, invoiceLine,
  creditNote, creditNoteLine, customerCredit, periodLock, journalEntry, journalLine, exchangeRate, inventoryItem, bankAccount, payment, paymentAllocation } from "../../lib/db/schema";
import { GET as LIST, POST } from "../../app/api/v1/credit-notes/route";
import { GET, PATCH, DELETE } from "../../app/api/v1/credit-notes/[id]/route";
import { POST as SEND } from "../../app/api/v1/credit-notes/[id]/send/route";
import { POST as VOID } from "../../app/api/v1/credit-notes/[id]/void/route";
import { POST as APPLY } from "../../app/api/v1/credit-notes/[id]/apply/route";
import { GET as SUMMARY } from "../../app/api/v1/credit-notes/summary/route";
import { GET as CUSTOMER_LIST, POST as CUSTOMER_POST } from "../../app/api/v1/customer-credits/route";
import { GET as CUSTOMER_GET } from "../../app/api/v1/customer-credits/[id]/route";
import { POST as CUSTOMER_APPLY } from "../../app/api/v1/customer-credits/[id]/apply/route";
import { GET as AVAILABLE } from "../../app/api/v1/invoices/[id]/available-credits/route";
import { registerCreditNoteTools } from "../../lib/mcp/tools/credit-notes";
import { registerCustomerCreditTools } from "../../lib/mcp/tools/customer-credits";
import type { AuthContext } from "../../lib/api/auth-context";

async function mcp(ctx: AuthContext) {
  const server = new McpServer({ name: "Credit fixture", version: "1.0.0" }); registerCreditNoteTools(server, ctx); registerCustomerCreditTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1.0.0" });
  const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
  const tools = (await client.listTools()).tools; assert.equal(tools.length, 14);
  assert.ok(JSON.stringify(tools.find(tool => tool.name === "create_credit_note")!.inputSchema).includes("unitPriceMinor"));
  assert.ok(JSON.stringify(tools.find(tool => tool.name === "apply_customer_credit")!.inputSchema).includes("amountMinor"));
  return { async call(name: string, args: Record<string, unknown> = {}) {
    const result = await client.callTool({ name, arguments: args }), text = (result.content as { text: string }[])[0].text;
    return { isError: result.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
  }, async close() { await client.close(); await server.close(); } };
}
async function run() {
  const [a, b] = await db.insert(organization).values([{ name: "Credit A", slug: "ca" }, { name: "Credit B", slug: "cb" }]).returning();
  const [owner, viewer] = await db.insert(users).values([{ email: "credit-owner@example.test" }, { email: "credit-viewer@example.test" }]).returning();
  const [role] = await db.insert(customRole).values({ organizationId: a.id, name: "Read", permissions: [] }).returning();
  await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner" }, { organizationId: b.id, userId: owner.id, role: "owner" },
    { organizationId: a.id, userId: viewer.id, role: "member", customRoleId: role.id }]);
  const keys = { a: "dk_credit_a", b: "dk_credit_b", viewer: "dk_credit_viewer" };
  for (const [label, key] of Object.entries(keys)) await db.insert(apiKey).values({ organizationId: label === "b" ? b.id : a.id,
    createdBy: label === "viewer" ? viewer.id : owner.id, name: label, keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_credit" });
  const [customer, other, foreignCustomer] = await db.insert(contact).values([{ organizationId: a.id, name: "Customer" }, { organizationId: a.id, name: "Other" }, { organizationId: b.id, name: "Foreign" }]).returning();
  const [revenue, ar, cash, foreignAccount] = await db.insert(chartAccount).values([{ organizationId: a.id, code: "4000", name: "Revenue", type: "revenue" },
    { organizationId: a.id, code: "1200", name: "AR", type: "asset" }, { organizationId: a.id, code: "1100", name: "Cash", type: "asset" },
    { organizationId: b.id, code: "4000", name: "Foreign", type: "revenue" }]).returning();
  const [tax, foreignTax] = await db.insert(taxRate).values([{ organizationId: a.id, name: "10%", rate: 1000 }, { organizationId: b.id, name: "Foreign", rate: 1000 }]).returning();
  const [center, foreignCenter] = await db.insert(costCenter).values([{ organizationId: a.id, name: "Center", code: "A" }, { organizationId: b.id, name: "Foreign", code: "B" }]).returning();
  const [bank, foreignBank] = await db.insert(bankAccount).values([{ organizationId: a.id, accountName: "Bank", accountType: "checking", currencyCode: "USD" },
    { organizationId: b.id, accountName: "Foreign bank", accountType: "checking", currencyCode: "USD" }]).returning();
  const ctx: AuthContext = { organizationId: a.id, userId: owner.id, role: "owner" };
  const ma = await mcp(ctx), mb = await mcp({ ...ctx, organizationId: b.id }), ro = await mcp({ ...ctx, role: "member", permissions: [], userId: viewer.id });
  const params = (id: string) => ({ params: Promise.resolve({ id }) });
  const req = (method: string, body?: unknown, key = keys.a, raw?: string, query = "") => new Request(`http://fixture.test/api/v1/credit-notes${query}`, {
    method, headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-organization-id": b.id },
    ...(raw !== undefined ? { body: raw } : body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const basic = { contactId: customer.id, issueDate: "2026-10-01", lines: [{ description: "Credit", unitPriceMinor: "1250", accountId: revenue.id }] };
  const make = async (body: unknown = basic) => { const response = await POST(req("POST", body)); assert.equal(response.status, 201, JSON.stringify(await response.clone().json())); return (await response.json()).creditNote; };
  let serial = 0;
  const makeInvoice = async (overrides: Partial<typeof invoice.$inferInsert> = {}) => {
    const [row] = await db.insert(invoice).values({ organizationId: a.id, contactId: customer.id, invoiceNumber: `INV-${++serial}`, issueDate: "2026-10-01", dueDate: "2026-11-01",
      subtotal: 5000, total: 5000, amountDue: 5000, status: "sent", ...overrides }).returning(); return row;
  };
  const customerBody = { contactId: customer.id, date: "2026-10-01", amountMinor: "1250", sourceType: "prepayment", depositAccountId: cash.id };
  const makeCustomer = async (body: unknown = customerBody) => { const response = await CUSTOMER_POST(req("POST", body)); assert.equal(response.status, 201, JSON.stringify(await response.clone().json())); return (await response.json()).customerCredit; };
  const tables = ["credit_note", "credit_note_line", "customer_credit", "invoice", "invoice_line", "payment", "payment_allocation", "journal_entry", "journal_line", "number_sequence",
    "chart_account", "bank_account", "inventory_item", "inventory_movement", "inventory_cost_layer", "warehouse_stock"];
  const snapshot = async () => {
    const values = [];
    for (const table of tables) values.push((await db.execute(sql.raw(`select coalesce(jsonb_agg(to_jsonb(t)::text order by t.id),'[]'::jsonb) as rows from ${table} t`))).rows);
    values.push((await db.execute(sql`select count(*)::text from audit_log`)).rows); return values;
  };
  const unchanged = async (operation: () => Promise<unknown>) => { const before = await snapshot(); await operation(); assert.deepEqual(await snapshot(), before); };
  const sent = async (body: unknown = basic) => { const row = await make(body), response = await SEND(req("POST"), params(row.id)); assert.equal(response.status, 200, JSON.stringify(await response.clone().json())); return (await response.json()).creditNote; };
  const balanced = async () => { const rows = await db.execute(sql`select journal_entry_id from journal_line group by journal_entry_id having sum(debit_amount) != sum(credit_amount)`); assert.equal(rows.rows.length, 0); };
  const fault = async (table: string, event: string, operation: () => Promise<unknown>) => {
    assert.ok(tables.includes(table)); assert.ok(["insert", "update"].includes(event));
    await db.execute(sql.raw("create function credit_fault() returns trigger language plpgsql as $$ begin raise exception 'credit fixture fault'; end $$"));
    await db.execute(sql.raw(`create trigger credit_fault before ${event} on ${table} for each row execute function credit_fault()`));
    try { await unchanged(operation); } finally { await db.execute(sql.raw(`drop trigger credit_fault on ${table}`)); await db.execute(sql.raw("drop function credit_fault()")); }
  };
  try {
    for (const price of [{ unitPrice: 12.5 }, { unitPriceMinor: "1250" }, { unitPriceExact: "12.50" }, { unitPrice: 12.5, unitPriceMinor: "1250", unitPriceExact: "12.50" }]) {
      const body = { ...basic, lines: [{ description: "Credit", ...price, quantity: 1.5, discountPercent: 1000, taxRateId: tax.id, accountId: revenue.id, costCenterId: center.id }] };
      const row = await make(body); assert.equal(row.totalMinor, "1856"); assert.equal(row.total, 1856);
      const made = await ma.call("create_credit_note", { ...body, lines: body.lines.map(line => ({ ...line, unitPrice: line.unitPrice === undefined ? undefined : 1250 })) });
      assert.equal(made.isError, false); assert.equal(made.body.creditNote.totalMinor, "1856");
      const read = await (await GET(req("GET"), params(row.id))).json(); assert.equal(read.creditNote.lines[0].unitPriceMinor, "1250"); assert.equal(read.creditNote.lines[0].quantity, 150);
      assert.equal((await ma.call("get_credit_note", { creditNoteId: row.id })).body.creditNote.totalMinor, "1856");
      assert.equal((await PATCH(req("PATCH", { notes: "Changed" }), params(row.id))).status, 200);
      assert.equal((await ma.call("update_credit_note", { creditNoteId: made.body.creditNote.id, lines: [{ description: "Replacement", unitPrice: 99 }] })).body.creditNote.totalMinor, "99");
      assert.equal((await DELETE(req("DELETE"), params(row.id))).status, 200); assert.equal((await ma.call("delete_credit_note", { creditNoteId: made.body.creditNote.id })).body.success, true);
    }
    const editable = await make();
    assert.equal((await (await LIST(req("GET"))).json()).data[0].totalMinor, "1250"); assert.equal((await ma.call("list_credit_notes")).body.total, 1);
    const summary = await (await SUMMARY(req("GET"))).json(); assert.equal(summary.totalAmountMinor, "1250"); assert.equal(summary.statusBreakdown.draft.amountMinor, "1250");
    assert.equal((await ma.call("get_credit_note_summary")).body.totalAmount, 1250);
    const big = await make({ ...basic, lines: [{ description: "Big", unitPriceMinor: "3000000000" }] });
    assert.equal((await (await SUMMARY(req("GET"))).json()).totalAmountMinor, "3000001250"); await DELETE(req("DELETE"), params(big.id));
    for (const currencyCode of ["USD", "IRR", "JPY", "KWD"]) {
      const row = await make({ ...basic, currencyCode }); assert.equal(row.totalMinor, "1250");
      const made = await ma.call("create_credit_note", { ...basic, currencyCode }); assert.equal(made.body.creditNote.totalMinor, "1250");
      if (currencyCode !== "USD") { assert.equal((await SUMMARY(req("GET"))).status, 422); assert.equal((await ma.call("get_credit_note_summary")).body.status, 422); }
      await DELETE(req("DELETE"), params(row.id)); await ma.call("delete_credit_note", { creditNoteId: made.body.creditNote.id });
    }
    const precision = await make({ ...basic, lines: [{ description: "Extended", unitPriceExact: "0.005", quantity: 3 }] }); assert.equal(precision.total, 2); await DELETE(req("DELETE"), params(precision.id));
    const maximum = await make({ ...basic, lines: [{ description: "Maximum", unitPriceMinor: "9007199254740991", accountId: revenue.id }] });
    assert.equal(maximum.totalMinor, "9007199254740991"); assert.equal((await GET(req("GET"), params(maximum.id))).status, 200);
    await unchanged(async () => { assert.equal((await SUMMARY(req("GET"))).status, 422); assert.equal((await ma.call("get_credit_note_summary")).body.status, 422); });
    await DELETE(req("DELETE"), params(maximum.id));
    for (const [field, foreign] of [["accountId", foreignAccount.id], ["taxRateId", foreignTax.id], ["costCenterId", foreignCenter.id]] as const) {
      const lines = [{ description: "Foreign", unitPriceMinor: "1250", [field]: foreign }];
      await unchanged(async () => { assert.equal((await POST(req("POST", { ...basic, lines }))).status, 400); assert.equal((await ma.call("create_credit_note", { ...basic, lines })).isError, true);
        assert.equal((await PATCH(req("PATCH", { lines }), params(editable.id))).status, 400); });
    }
    for (const bad of [{ ...basic, contactId: foreignCustomer.id }, { ...basic, issueDate: "2026-02-30" },
      ...[{ unitPriceMinor: "9007199254740992" }, { unitPriceMinor: "01" }, { unitPriceExact: "1e3" }, { unitPriceMinor: "9007199254740991", quantity: 2 },
        { unitPriceMinor: "1250", unitPrice: 1 }].map(line => ({ ...basic, lines: [{ description: "Bad", ...line }] }))])
      await unchanged(async () => { assert.ok([400, 422].includes((await POST(req("POST", bad))).status)); assert.equal((await ma.call("create_credit_note", bad)).isError, true); });
    for (const body of [{ organizationId: b.id }, { status: "sent" }, { total: 1 }, { contactId: foreignCustomer.id }])
      await unchanged(async () => { assert.equal((await PATCH(req("PATCH", body), params(editable.id))).status, 400); });
    await unchanged(async () => { assert.equal((await POST(req("POST", undefined, keys.a, "{bad"))).status, 400); assert.equal((await SEND(req("POST", undefined, keys.a, "{bad"), params(editable.id))).status, 400);
      assert.equal((await SEND(req("POST", { sendEmail: true }), params(editable.id))).status, 400); });
    const inv = await makeInvoice(), wrongCustomer = await makeInvoice({ contactId: other.id }), foreignInvoice = await makeInvoice({ organizationId: b.id, contactId: foreignCustomer.id }), euroInvoice = await makeInvoice({ currencyCode: "EUR" });
    for (const invoiceId of [wrongCustomer.id, foreignInvoice.id, euroInvoice.id])
      await unchanged(async () => { assert.ok([400, 404].includes((await POST(req("POST", { ...basic, invoiceId }))).status)); });
    await unchanged(async () => {
      assert.equal((await POST(req("POST", basic, "dk_invalid"))).status, 401);
      for (const handler of [PATCH, DELETE, SEND, VOID, APPLY]) {
        assert.equal((await handler(req(handler === PATCH ? "PATCH" : handler === DELETE ? "DELETE" : "POST", {}, keys.viewer), params(editable.id))).status, 403);
      }
      for (const name of ["update_credit_note", "delete_credit_note", "send_credit_note", "void_credit_note", "apply_credit_note"]) {
        const input = { creditNoteId: editable.id, ...(name === "apply_credit_note" ? { invoiceId: inv.id, amountMinor: "1" } : {}) };
        assert.equal((await ro.call(name, input)).body.status, 403);
        assert.equal((await mb.call(name, input)).body.status, 404);
      }
      for (const handler of [GET, DELETE, SEND, VOID]) assert.equal((await handler(req(handler === GET ? "GET" : handler === DELETE ? "DELETE" : "POST", undefined, keys.b), params(editable.id))).status, 404);
      assert.equal((await mb.call("get_credit_note", { creditNoteId: editable.id })).body.status, 404);
    });
    assert.equal((await mb.call("list_credit_notes")).body.total, 0); assert.equal((await (await SUMMARY(req("GET", undefined, keys.b))).json()).totalCount, 0);
    await db.insert(periodLock).values({ organizationId: a.id, lockDate: "2026-09-30" });
    await unchanged(async () => { assert.equal((await POST(req("POST", { ...basic, issueDate: "2026-09-01" }))).status, 422); assert.equal((await PATCH(req("PATCH", { issueDate: "2026-09-01" }), params(editable.id))).status, 422); });
    await db.update(creditNote).set({ issueDate: "2026-09-01" }).where(eq(creditNote.id, editable.id));
    await unchanged(async () => { for (const handler of [SEND, VOID, DELETE]) assert.equal((await handler(req(handler === DELETE ? "DELETE" : "POST"), params(editable.id))).status, 422);
      assert.equal((await PATCH(req("PATCH", { issueDate: "2026-10-02" }), params(editable.id))).status, 422); });
    await db.delete(periodLock); await db.update(creditNote).set({ issueDate: "2026-10-01" }).where(eq(creditNote.id, editable.id));
    const note = await sent({ ...basic, lines: [{ ...basic.lines[0], taxRateId: tax.id, costCenterId: center.id }] }); assert.equal(note.totalMinor, "1375");
    const postedCount = (await db.select().from(journalEntry)).length;
    const applied = await APPLY(req("POST", { invoiceId: inv.id, amount: 500, amountMinor: "500" }), params(note.id)); assert.equal(applied.status, 200);
    assert.equal((await applied.json()).invoice.amountDueMinor, "4500"); assert.equal((await db.select().from(journalEntry)).length, postedCount);
    const second = await ma.call("apply_credit_note", { creditNoteId: note.id, invoiceId: inv.id, amountMinor: "875" }); assert.equal(second.body.creditNote.status, "applied");
    assert.equal(second.body.invoice.amountPaidMinor, "1375");
    const voided = await ma.call("void_credit_note", { creditNoteId: note.id }); assert.equal(voided.isError, false); assert.equal(voided.body.creditNote.amountRemainingMinor, "1375");
    assert.equal((await db.query.invoice.findFirst({ where: eq(invoice.id, inv.id) }))!.amountPaid, 0);
    assert.equal((await db.select().from(paymentAllocation)).length, 0); assert.equal((await db.select().from(payment)).length, 0);
    const draftVoid = await make(); assert.equal((await VOID(req("POST"), params(draftVoid.id))).status, 200);
    const candidate = await sent();
    await db.update(creditNote).set({ journalEntryId: null }).where(eq(creditNote.id, candidate.id));
    await unchanged(async () => { assert.equal((await APPLY(req("POST", { invoiceId: inv.id, amountMinor: "1" }), params(candidate.id))).status, 422); });
    await db.update(creditNote).set({ journalEntryId: candidate.journalEntryId }).where(eq(creditNote.id, candidate.id));
    for (const input of [{ invoiceId: wrongCustomer.id, amountMinor: "1" }, { invoiceId: foreignInvoice.id, amountMinor: "1" }, { invoiceId: euroInvoice.id, amountMinor: "1" },
      { invoiceId: inv.id, amountMinor: "1251" }, { invoiceId: inv.id, amount: 1, amountMinor: "2" }, { invoiceId: inv.id, amountMinor: "9007199254740992" }])
      await unchanged(async () => { assert.ok([400, 404, 422].includes((await APPLY(req("POST", input), params(candidate.id))).status)); assert.equal((await ma.call("apply_credit_note", { creditNoteId: candidate.id, ...input })).isError, true); });
    await unchanged(async () => { assert.equal((await SEND(req("POST"), params(candidate.id))).status, 400); assert.equal((await PATCH(req("PATCH", { notes: "No" }), params(candidate.id))).status, 400); assert.equal((await DELETE(req("DELETE"), params(candidate.id))).status, 400); });
    for (const aliases of [{ amount: 1250, amountMinor: undefined }, { amountMinor: "1250" }, { amount: 1250, amountMinor: "1250" }]) {
      const credit = await makeCustomer({ ...customerBody, ...aliases }); assert.equal(credit.originalAmountMinor, "1250");
      assert.equal((await (await CUSTOMER_GET(req("GET"), params(credit.id))).json()).customerCredit.amountRemaining, 1250);
      assert.equal((await ma.call("get_customer_credit", { customerCreditId: credit.id })).body.customerCredit.originalAmountMinor, "1250");
      const target = await makeInvoice();
      const result = await CUSTOMER_APPLY(req("POST", { invoiceId: target.id, amountMinor: "500", date: "2026-10-01" }), params(credit.id)); assert.equal(result.status, 200);
      assert.equal((await result.json()).customerCredit.amountRemainingMinor, "750");
      assert.equal((await ma.call("apply_customer_credit", { customerCreditId: credit.id, invoiceId: target.id, amount: 750, date: "2026-10-01" })).body.customerCredit.status, "applied");
    }
    const createdMcp = await ma.call("create_customer_credit", customerBody); assert.equal(createdMcp.isError, false);
    const creditId = createdMcp.body.customerCredit.id;
    await db.update(customerCredit).set({ journalEntryId: null }).where(eq(customerCredit.id, creditId));
    await unchanged(async () => { assert.equal((await CUSTOMER_APPLY(req("POST", { invoiceId: inv.id, amountMinor: "1" }), params(creditId))).status, 422); });
    await db.update(customerCredit).set({ journalEntryId: createdMcp.body.customerCredit.journalEntryId }).where(eq(customerCredit.id, creditId));
    assert.equal((await ma.call("list_customer_credits")).body.customerCredits.some((row: { id: string }) => row.id === creditId), true);
    assert.equal((await (await CUSTOMER_LIST(req("GET"))).json()).data.some((row: { id: string }) => row.id === creditId), true);
    assert.equal((await mb.call("list_customer_credits")).body.total, 0);
    assert.equal((await ma.call("list_invoice_available_credits", { invoiceId: inv.id })).body.credits[0].amountRemainingMinor, "1250");
    const available = await (await AVAILABLE(req("GET"), params(inv.id))).json(); assert.equal(available.amountDueMinor, "5000"); assert.equal(available.credits.length, 1);
    assert.equal((await (await AVAILABLE(req("GET"), params(wrongCustomer.id))).json()).credits.length, 0);
    assert.equal((await (await AVAILABLE(req("GET"), params(euroInvoice.id))).json()).credits.length, 0);
    await unchanged(async () => {
      for (const handler of [CUSTOMER_GET, AVAILABLE]) assert.equal((await handler(req("GET", undefined, keys.b), params(handler === CUSTOMER_GET ? creditId : inv.id))).status, 404);
      assert.equal((await CUSTOMER_POST(req("POST", customerBody, keys.viewer))).status, 403);
      assert.equal((await CUSTOMER_APPLY(req("POST", { invoiceId: inv.id, amountMinor: "1" }, keys.viewer), params(creditId))).status, 403);
      assert.equal((await ro.call("create_customer_credit", customerBody)).body.status, 403);
      assert.equal((await ro.call("apply_customer_credit", { customerCreditId: creditId, invoiceId: inv.id, amountMinor: "1" })).body.status, 403);
      assert.equal((await mb.call("get_customer_credit", { customerCreditId: creditId })).body.status, 404);
      assert.equal((await mb.call("apply_customer_credit", { customerCreditId: creditId, invoiceId: inv.id, amountMinor: "1" })).body.status, 404);
    });
    for (const body of [{ ...customerBody, contactId: foreignCustomer.id }, { ...customerBody, depositAccountId: foreignAccount.id },
      { ...customerBody, depositAccountId: undefined, bankAccountId: foreignBank.id }, { ...customerBody, bankAccountId: bank.id }, { ...customerBody, depositAccountId: undefined },
      { ...customerBody, amountMinor: "9007199254740992" }, { ...customerBody, amount: 1, amountMinor: "2" }, { ...customerBody, currencyCode: "EUR" }])
      await unchanged(async () => { assert.ok([400, 404, 422].includes((await CUSTOMER_POST(req("POST", body))).status)); assert.equal((await ma.call("create_customer_credit", body)).isError, true); });
    for (const invoiceId of [wrongCustomer.id, foreignInvoice.id, euroInvoice.id])
      await unchanged(async () => { assert.ok([400, 404].includes((await CUSTOMER_APPLY(req("POST", { invoiceId, amountMinor: "1" }), params(creditId))).status));
        assert.equal((await ma.call("apply_customer_credit", { customerCreditId: creditId, invoiceId, amountMinor: "1" })).isError, true); });
    await db.insert(periodLock).values({ organizationId: a.id, lockDate: "2026-09-30" });
    await unchanged(async () => {
      assert.equal((await CUSTOMER_POST(req("POST", { ...customerBody, date: "2026-09-01" }))).status, 422);
      assert.equal((await CUSTOMER_APPLY(req("POST", { invoiceId: inv.id, amountMinor: "1", date: "2026-09-01" }), params(creditId))).status, 422);
      assert.equal((await ma.call("apply_customer_credit", { customerCreditId: creditId, invoiceId: inv.id, amountMinor: "1", date: "2026-09-01" })).body.status, 422);
    });
    await db.update(invoice).set({ issueDate: "2026-09-01" }).where(eq(invoice.id, inv.id));
    await unchanged(async () => {
      assert.equal((await APPLY(req("POST", { invoiceId: inv.id, amountMinor: "1" }), params(candidate.id))).status, 422);
      assert.equal((await CUSTOMER_APPLY(req("POST", { invoiceId: inv.id, amountMinor: "1", date: "2026-10-01" }), params(creditId))).status, 422);
    });
    await db.update(invoice).set({ issueDate: "2026-10-01" }).where(eq(invoice.id, inv.id)); await db.delete(periodLock);
    // Foreign posting and reversal preserve saved base amounts after rate refresh.
    await db.insert(exchangeRate).values({ organizationId: a.id, baseCurrency: "EUR", targetCurrency: "USD", date: "2026-10-01", rate: 1200000, source: "manual" });
    const euro = await sent({ ...basic, currencyCode: "EUR" });
    const euroLines = await db.select().from(journalLine).where(eq(journalLine.journalEntryId, euro.journalEntryId));
    assert.equal(euroLines[0].rateExact, "1.2"); assert.equal(euroLines.reduce((sum, line) => sum + line.debitAmount, 0), 1500);
    await db.update(exchangeRate).set({ rate: 2000000 }).where(eq(exchangeRate.organizationId, a.id));
    assert.equal((await VOID(req("POST"), params(euro.id))).status, 200);
    const euroCredit = await makeCustomer({ ...customerBody, currencyCode: "EUR" }); assert.equal(euroCredit.originalAmountMinor, "1250");
    assert.equal((await CUSTOMER_APPLY(req("POST", { invoiceId: euroInvoice.id, amountMinor: "1250", date: "2026-10-01" }), params(euroCredit.id))).status, 200);
    const bankCredit = await makeCustomer({ ...customerBody, bankAccountId: bank.id, depositAccountId: undefined });
    assert.ok((await db.query.bankAccount.findFirst({ where: eq(bankAccount.id, bank.id) }))!.chartAccountId); assert.equal(bankCredit.originalAmountMinor, "1250");
    // Proportional stock returns are shared by REST/MCP and void uses saved costs.
    const [stock] = await db.insert(inventoryItem).values({ organizationId: a.id, code: "STOCK", name: "Stock", averageCost: 300, totalValue: 3000, quantityOnHand: 10 }).returning();
    const stockInvoice = await makeInvoice({ total: 2000, subtotal: 2000, amountDue: 2000 });
    await db.insert(invoiceLine).values({ invoiceId: stockInvoice.id, description: "Stock", quantity: 200, unitPrice: 1000, amount: 2000, inventoryItemId: stock.id });
    const stockNote = await make({ ...basic, invoiceId: stockInvoice.id, lines: [{ ...basic.lines[0], unitPriceMinor: "1000" }] });
    assert.equal((await ma.call("send_credit_note", { creditNoteId: stockNote.id })).isError, false);
    assert.equal((await db.query.inventoryItem.findFirst({ where: eq(inventoryItem.id, stock.id) }))!.quantityOnHand, 11);
    await db.update(inventoryItem).set({ averageCost: 999 }).where(eq(inventoryItem.id, stock.id));
    await db.update(invoiceLine).set({ quantity: 999 }).where(eq(invoiceLine.invoiceId, stockInvoice.id));
    assert.equal((await VOID(req("POST"), params(stockNote.id))).status, 200);
    const restored = await db.query.inventoryItem.findFirst({ where: eq(inventoryItem.id, stock.id) }); assert.equal(restored!.quantityOnHand, 10); assert.equal(restored!.totalValue, 3000);
    const [fifo] = await db.insert(inventoryItem).values({ organizationId: a.id, code: "FIFO", name: "FIFO", costMethod: "fifo", averageCost: 400, quantityOnHand: 0 }).returning();
    const fifoInvoice = await makeInvoice({ total: 2000, subtotal: 2000, amountDue: 2000 });
    await db.insert(invoiceLine).values({ invoiceId: fifoInvoice.id, description: "FIFO", quantity: 200, unitPrice: 1000, amount: 2000, inventoryItemId: fifo.id });
    const fifoNote = await sent({ ...basic, invoiceId: fifoInvoice.id });
    assert.equal((await VOID(req("POST"), params(fifoNote.id))).status, 200);
    assert.equal((await db.query.inventoryItem.findFirst({ where: eq(inventoryItem.id, fifo.id) }))!.quantityOnHand, 0);
    // Persisted unsafe values, sums and tenant-corrupt history reject without mutations.
    await db.execute(sql`update credit_note set total=9007199254740992 where id=${editable.id}`);
    await unchanged(async () => { assert.equal((await GET(req("GET"), params(editable.id))).status, 422); assert.equal((await SEND(req("POST"), params(editable.id))).status, 422); assert.equal((await ma.call("get_credit_note", { creditNoteId: editable.id })).body.status, 422); });
    await db.update(creditNote).set({ total: 1250 }).where(eq(creditNote.id, editable.id));
    await db.execute(sql`update credit_note_line set unit_price=9007199254740992 where credit_note_id=${editable.id}`);
    await unchanged(async () => { assert.equal((await PATCH(req("PATCH", { notes: "No" }), params(editable.id))).status, 422); });
    await db.update(creditNoteLine).set({ unitPrice: 1250 }).where(eq(creditNoteLine.creditNoteId, editable.id));
    await db.update(creditNoteLine).set({ accountId: foreignAccount.id }).where(eq(creditNoteLine.creditNoteId, editable.id));
    await unchanged(async () => { assert.equal((await GET(req("GET"), params(editable.id))).status, 422); assert.equal((await SEND(req("POST"), params(editable.id))).status, 400); });
    await db.update(creditNoteLine).set({ accountId: revenue.id }).where(eq(creditNoteLine.creditNoteId, editable.id));
    await db.update(creditNoteLine).set({ costCenterId: foreignCenter.id }).where(eq(creditNoteLine.creditNoteId, editable.id));
    await unchanged(async () => { assert.equal((await GET(req("GET"), params(editable.id))).status, 422); });
    await db.update(creditNoteLine).set({ costCenterId: null }).where(eq(creditNoteLine.creditNoteId, editable.id));
    await db.execute(sql`update customer_credit set original_amount=9007199254740992 where id=${creditId}`);
    await unchanged(async () => { assert.equal((await CUSTOMER_GET(req("GET"), params(creditId))).status, 422); assert.equal((await CUSTOMER_APPLY(req("POST", { invoiceId: inv.id, amountMinor: "1" }), params(creditId))).status, 422); });
    await db.update(customerCredit).set({ originalAmount: 1250 }).where(eq(customerCredit.id, creditId));
    await db.execute(sql`update invoice set total=9007199254740992 where id=${inv.id}`);
    await unchanged(async () => { assert.equal((await AVAILABLE(req("GET"), params(inv.id))).status, 422);
      assert.equal((await CUSTOMER_APPLY(req("POST", { invoiceId: inv.id, amountMinor: "1" }), params(creditId))).status, 422); });
    await db.update(invoice).set({ total: 5000 }).where(eq(invoice.id, inv.id));
    const concurrent = await make(); const sends = await Promise.all([SEND(req("POST"), params(concurrent.id)), ma.call("send_credit_note", { creditNoteId: concurrent.id })]);
    assert.equal(sends.filter(result => "status" in result ? result.status === 200 : !result.isError).length, 1);
    const applications = await Promise.all([APPLY(req("POST", { invoiceId: inv.id, amountMinor: "1000" }), params(concurrent.id)), ma.call("apply_credit_note", { creditNoteId: concurrent.id, invoiceId: inv.id, amountMinor: "1000" })]);
    assert.equal(applications.filter(result => "status" in result ? result.status === 200 : !result.isError).length, 1);
    const carrierLink = (await db.query.paymentAllocation.findFirst({ where: eq(paymentAllocation.documentId, concurrent.id) }))!;
    await db.update(payment).set({ organizationId: b.id }).where(eq(payment.id, carrierLink.paymentId));
    await unchanged(async () => { assert.equal((await VOID(req("POST"), params(concurrent.id))).status, 422); });
    await db.update(payment).set({ organizationId: a.id }).where(eq(payment.id, carrierLink.paymentId));
    await db.execute(sql`update payment_allocation set amount=9007199254740992 where id=${carrierLink.id}`);
    await unchanged(async () => { assert.equal((await ma.call("void_credit_note", { creditNoteId: concurrent.id })).body.status, 422); });
    await db.update(paymentAllocation).set({ amount: 1000 }).where(eq(paymentAllocation.id, carrierLink.id));
    const creates = await Promise.all([make(), make()]); assert.notEqual(creates[0].creditNoteNumber, creates[1].creditNoteNumber);
    const customerRace = await makeCustomer();
    const customerRaces = await Promise.all([CUSTOMER_APPLY(req("POST", { invoiceId: inv.id, amountMinor: "1000", date: "2026-10-01" }), params(customerRace.id)),
      ma.call("apply_customer_credit", { customerCreditId: customerRace.id, invoiceId: inv.id, amountMinor: "1000", date: "2026-10-01" })]);
    assert.equal(customerRaces.filter(result => "status" in result ? result.status === 200 : !result.isError).length, 1);
    const voidRace = await sent();
    const voids = await Promise.all([VOID(req("POST"), params(voidRace.id)), ma.call("void_credit_note", { creditNoteId: voidRace.id })]);
    assert.equal(voids.filter(result => "status" in result ? result.status === 200 : !result.isError).length, 1);
    // Every failing stage rolls back numbering, header/lines, GL/stock and carriers.
    await fault("credit_note_line", "insert", async () => { assert.equal((await POST(req("POST", basic))).status, 500); assert.equal((await ma.call("update_credit_note", { creditNoteId: editable.id, lines: basic.lines })).isError, true); });
    await fault("credit_note", "update", async () => { assert.equal((await DELETE(req("DELETE"), params(editable.id))).status, 500); assert.equal((await SEND(req("POST"), params(editable.id))).status, 500); });
    await fault("customer_credit", "insert", async () => { assert.equal((await CUSTOMER_POST(req("POST", customerBody))).status, 500); });
    const [unlinked] = await db.insert(bankAccount).values({ organizationId: a.id, accountName: "Unlinked", accountType: "checking", currencyCode: "USD" }).returning();
    await fault("customer_credit", "insert", async () => { assert.equal((await CUSTOMER_POST(req("POST", { ...customerBody, bankAccountId: unlinked.id, depositAccountId: undefined }))).status, 500); });
    assert.equal((await db.query.bankAccount.findFirst({ where: eq(bankAccount.id, unlinked.id) }))!.chartAccountId, null);
    await fault("invoice", "update", async () => { assert.equal((await APPLY(req("POST", { invoiceId: inv.id, amountMinor: "1" }), params(candidate.id))).status, 500);
      assert.equal((await CUSTOMER_APPLY(req("POST", { invoiceId: inv.id, amountMinor: "1", date: "2026-10-01" }), params(creditId))).status, 500);
      assert.equal((await VOID(req("POST"), params(concurrent.id))).status, 500); });
    await fault("journal_line", "insert", async () => { assert.equal((await ma.call("create_customer_credit", customerBody)).isError, true); });
    const stockFail = await make({ ...basic, invoiceId: stockInvoice.id });
    await fault("credit_note", "update", async () => { assert.equal((await SEND(req("POST"), params(stockFail.id))).status, 500); });
    const stockVoidFail = await sent({ ...basic, invoiceId: stockInvoice.id });
    await fault("credit_note", "update", async () => { assert.equal((await VOID(req("POST"), params(stockVoidFail.id))).status, 500); });
    await balanced(); assert.ok((await db.select().from(journalLine)).every(line => line.rateMigrationStatus === "exact"));
    assert.equal((await db.query.chartAccount.findFirst({ where: eq(chartAccount.id, ar.id) }))!.organizationId, a.id);
    console.log("REST and MCP credits verified");
  } finally { await ma.close(); await mb.close(); await ro.close(); }
}
run().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
