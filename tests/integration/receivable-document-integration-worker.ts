// Invoked only in a randomly named disposable migrated fixture database.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, customRole, apiKey, contact, chartAccount, invoice } from "../../lib/db/schema";
import type { AuthContext } from "../../lib/api/auth-context";
import { registerAllTools } from "../../lib/mcp/tools";
import { GET as INVOICE_GET } from "../../app/api/v1/invoices/[id]/route";
import { GET as SUMMARY } from "../../app/api/v1/invoices/summary/route";
import { POST as INVOICE_CREATE } from "../../app/api/v1/invoices/route";
import { POST as QUOTE_CREATE } from "../../app/api/v1/quotes/route";
import { POST as QUOTE_SEND } from "../../app/api/v1/quotes/[id]/send/route";
import { POST as QUOTE_CONVERT } from "../../app/api/v1/quotes/[id]/convert/route";
import { POST as CREDIT_CREATE } from "../../app/api/v1/credit-notes/route";
import { POST as CREDIT_APPLY } from "../../app/api/v1/credit-notes/[id]/apply/route";
import { POST as RECEIPT_CREATE } from "../../app/api/v1/sales-receipts/route";
import { POST as RECEIPT_VOID } from "../../app/api/v1/sales-receipts/[id]/void/route";
import { POST as TEMPLATE_CREATE } from "../../app/api/v1/recurring-invoices/route";
import { POST as BULK_SEND } from "../../app/api/v1/bulk/invoices/send/route";
import { processRecurringInvoiceTemplate } from "../../lib/api/recurring-invoice-generate";

const adopted = [
  "list_invoices", "get_invoice", "get_invoice_summary", "create_invoice", "update_invoice", "delete_invoice",
  "send_invoice", "void_invoice", "write_off_invoice", "recover_written_off_invoice", "calculate_invoice_interest",
  "charge_invoice_interest", "submit_invoice_for_approval", "approve_invoice", "reject_invoice",
  "list_quotes", "get_quote", "create_quote", "update_quote", "delete_quote", "send_quote", "accept_quote", "decline_quote", "convert_quote_to_invoice",
  "list_credit_notes", "get_credit_note", "create_credit_note", "update_credit_note", "delete_credit_note", "send_credit_note", "apply_credit_note", "void_credit_note", "get_credit_note_summary",
  "list_customer_credits", "get_customer_credit", "create_customer_credit", "apply_customer_credit", "list_invoice_available_credits",
  "list_sales_receipts", "get_sales_receipt", "create_sales_receipt", "update_sales_receipt", "delete_sales_receipt", "post_sales_receipt", "void_sales_receipt",
  "list_recurring_templates", "get_recurring_template", "create_recurring_template", "update_recurring_template", "pause_recurring_template", "run_recurring_template", "get_recurring_template_summary", "delete_recurring_invoice", "preview_recurring_invoice",
  "import_invoices", "preview_invoice_import", "bulk_mark_invoices_sent", "bulk_mark_invoices_paid", "bulk_send_invoice_reminders",
];
async function mcp(ctx: AuthContext) {
  const server = new McpServer({ name: "Receivable integration", version: "1" }); registerAllTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1" });
  const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
  const tools = (await client.listTools()).tools;
  for (const name of adopted) assert.equal(tools.filter(tool => tool.name === name).length, 1, name);
  return { tools, async call(name: string, args: Record<string, unknown> = {}) {
    const result = await client.callTool({ name, arguments: args });
    const text = (result.content as { text: string }[])[0].text;
    return { isError: result.isError === true, text, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
  }, async close() { await client.close(); await server.close(); } };
}
async function run() {
  const [a, b] = await db.insert(organization).values([{ name: "Receivable A", slug: "rd-a" }, { name: "Receivable B", slug: "rd-b" }]).returning();
  const [owner, viewer] = await db.insert(users).values([{ email: "rd-owner@example.test" }, { email: "rd-viewer@example.test" }]).returning();
  const [role] = await db.insert(customRole).values({ organizationId: a.id, name: "Read only", permissions: [] }).returning();
  await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner" }, { organizationId: b.id, userId: owner.id, role: "owner" },
    { organizationId: a.id, userId: viewer.id, role: "member", customRoleId: role.id }]);
  const keys = { a: "dk_rd_a", b: "dk_rd_b", viewer: "dk_rd_viewer" };
  for (const [name, key] of Object.entries(keys)) await db.insert(apiKey).values({ organizationId: name === "b" ? b.id : a.id,
    createdBy: name === "viewer" ? viewer.id : owner.id, name, keyPrefix: "dk_rd", keyHash: createHash("sha256").update(key).digest("hex") });
  const [customer, foreignCustomer] = await db.insert(contact).values([{ organizationId: a.id, name: "Local", paymentTermsDays: 30 }, { organizationId: b.id, name: "Foreign" }]).returning();
  const accounts = await db.insert(chartAccount).values([
    { code: "4000", name: "Revenue", type: "revenue" as const }, { code: "1200", name: "AR", type: "asset" as const },
    { code: "1100", name: "Cash", type: "asset" as const }, { code: "2410", name: "Deposits", type: "liability" as const },
  ].map(row => ({ ...row, organizationId: a.id }))).returning();
    const [revenue, ar, cash, deposits] = accounts;
  const ctx: AuthContext = { organizationId: a.id, userId: owner.id, role: "owner" };
  const ma = await mcp(ctx), mb = await mcp({ ...ctx, organizationId: b.id }), ro = await mcp({ ...ctx, userId: viewer.id, role: "member", permissions: [] });
  const req = (method: string, body?: unknown, key = keys.a) => new Request("http://fixture.test/api/v1/invoices", {
    method, headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-organization-id": b.id },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const params = (id: string) => ({ params: Promise.resolve({ id }) });
  const read = async (id: string) => {
    const response = await INVOICE_GET(req("GET"), params(id)); assert.equal(response.status, 200);
    const rest = (await response.json()).invoice, tool = await ma.call("get_invoice", { invoiceId: id }); assert.equal(tool.isError, false);
    for (const field of ["subtotal", "taxTotal", "total", "amountPaid", "amountDue"]) {
      assert.equal(rest[`${field}Minor`], String(rest[field])); assert.equal(tool.body.invoice[`${field}Minor`], rest[`${field}Minor`]);
    }
    return rest;
  };
  const tables = ["invoice", "invoice_line", "quote", "quote_line", "credit_note", "credit_note_line", "customer_credit", "sales_receipt", "sales_receipt_line",
    "recurring_template", "recurring_template_line", "journal_entry", "journal_line", "payment", "payment_allocation", "number_sequence", "bulk_import_job", "audit_log"];
  const snapshot = async () => {
    const rows = []; for (const table of tables) rows.push((await db.execute(sql.raw(`select coalesce(jsonb_agg(to_jsonb(t)::text order by t.id),'[]'::jsonb) as rows from ${table} t`))).rows);
    return rows;
  };
  const unchanged = async (action: () => Promise<void>) => { const before = await snapshot(); await action(); assert.deepEqual(await snapshot(), before); };
  const basic = { contactId: customer.id, issueDate: "2026-06-01", dueDate: "2026-07-01", currencyCode: "USD",
    lines: [{ description: "Service", unitPriceMinor: "1250", accountId: revenue.id }] };
  try {
    // Registered SDK schemas must reject unsupported fields even on zero-input tools.
    await unchanged(async () => {
      for (const name of adopted) {
        const result = await ma.call(name, { unsupportedMoneyMode: "exact" });
        assert.equal(result.isError, true, name); assert.match(result.text, /unrecognized/i, name);
        assert.equal(ma.tools.find(tool => tool.name === name)!.inputSchema.additionalProperties, false, name);
      }
    });
    // Legacy REST major-unit quote prices and MCP minor-unit prices converge through conversion.
    const quoteBody = { ...basic, dueDate: undefined, expiryDate: "2099-01-01", lines: [{ ...basic.lines[0], unitPriceMinor: undefined, unitPrice: 12.5 }] };
    const qr = await QUOTE_CREATE(req("POST", quoteBody)); assert.equal(qr.status, 201); const q = (await qr.json()).quote;
    assert.equal((await QUOTE_SEND(req("POST"), params(q.id))).status, 200);
    assert.equal((await ma.call("accept_quote", { quoteId: q.id })).isError, false);
    const half = await QUOTE_CONVERT(req("POST", { percentage: 50 }), params(q.id)); assert.equal(half.status, 200);
    const first = (await half.json()).invoice; assert.equal(first.totalMinor, "625");
    const remaining = await ma.call("convert_quote_to_invoice", { quoteId: q.id }); assert.equal(remaining.isError, false);
    assert.equal(remaining.body.invoice.totalMinor, "625"); assert.equal(remaining.body.billing.fullyBilled, true);
    assert.equal((await ma.call("send_invoice", { invoiceId: first.id })).isError, false); await read(first.id);
    // Create a credit by REST, recognize by MCP, apply by REST, then reverse by MCP.
    const credit = await CREDIT_CREATE(req("POST", { ...basic, dueDate: undefined, lines: [{ ...basic.lines[0], unitPriceMinor: "125" }] }));
    assert.equal(credit.status, 201); const note = (await credit.json()).creditNote;
    assert.equal((await ma.call("send_credit_note", { creditNoteId: note.id })).isError, false);
    const applied = await CREDIT_APPLY(req("POST", { invoiceId: first.id, amount: 125, amountMinor: "125" }), params(note.id)); assert.equal(applied.status, 200);
    assert.equal((await read(first.id)).amountDueMinor, "500");
    assert.equal((await ma.call("void_credit_note", { creditNoteId: note.id })).isError, false);
    assert.equal((await read(first.id)).amountDueMinor, "625");
    // New customer cash/deposit settlement uses the real recognized invoice from conversion.
    const cc = await ma.call("create_customer_credit", { contactId: customer.id, date: "2026-06-01", amountMinor: "625", sourceType: "prepayment", depositAccountId: cash.id });
    assert.equal(cc.isError, false);
    const available = await ma.call("list_invoice_available_credits", { invoiceId: first.id }); assert.equal(available.body.credits[0].originalAmountMinor, "625");
    const settled = await ma.call("apply_customer_credit", { customerCreditId: cc.body.customerCredit.id, invoiceId: first.id, amountMinor: "625", date: "2026-06-01" });
    assert.equal(settled.isError, false); assert.equal((await read(first.id)).amountDueMinor, "0");
    await unchanged(async () => { assert.equal((await ma.call("void_invoice", { invoiceId: first.id })).isError, true); });
    // Sales-receipt legacy major input travels through MCP cash posting and REST saved reversal.
    const receipt = await RECEIPT_CREATE(req("POST", { ...basic, issueDate: undefined, dueDate: undefined, date: basic.issueDate, depositAccountId: cash.id,
      lines: [{ description: "Cash sale", unitPrice: 12.5, accountId: revenue.id }] })); assert.equal(receipt.status, 201);
    const receiptId = (await receipt.json()).salesReceipt.id;
    const posted = await ma.call("post_sales_receipt", { salesReceiptId: receiptId }); assert.equal(posted.isError, false); assert.equal(posted.body.salesReceipt.totalMinor, "1250");
    assert.equal((await RECEIPT_VOID(req("POST"), params(receiptId))).status, 200);
    // Recurring generation feeds bulk recognition and both invoice read/summary boundaries.
    const tr = await TEMPLATE_CREATE(req("POST", { name: "Monthly", contactId: customer.id, startDate: "2026-06-01", frequency: "monthly", maxOccurrences: 1, lines: basic.lines }));
    assert.equal(tr.status, 201); const tmpl = (await tr.json()).template;
    assert.equal(await processRecurringInvoiceTemplate(a.id, tmpl.id, "2026-06-01"), 1);
    assert.equal(await processRecurringInvoiceTemplate(a.id, tmpl.id, "2026-06-01"), 0);
    await unchanged(async () => { assert.equal((await ma.call("run_recurring_template", { templateId: tmpl.id })).isError, true); });
    const generated = (await db.select().from(invoice).where(eq(invoice.organizationId, a.id))).find(row => row.id !== first.id && row.id !== remaining.body.invoice.id)!;
    assert.equal(generated.total, 1250);
    assert.equal((await BULK_SEND(req("POST", { ids: [generated.id, remaining.body.invoice.id] }))).status, 200);
    assert.equal((await ma.call("bulk_mark_invoices_sent", { ids: [generated.id] })).body.updated, 0);
    assert.equal((await read(generated.id)).amountDueMinor, "1250");
    const summary = await SUMMARY(req("GET")); assert.equal(summary.status, 200);
    const summaryBody = await summary.json(); assert.deepEqual((await ma.call("get_invoice_summary")).body, summaryBody);
    assert.equal(summaryBody.outstandingMinor, "1875");
    // Cross-slice mutation failures do not change data, numbering, jobs, allocations or audits.
    await unchanged(async () => {
      assert.equal((await INVOICE_GET(req("GET", undefined, keys.b), params(first.id))).status, 404);
      assert.equal((await mb.call("get_invoice", { invoiceId: first.id })).body.status, 404);
      assert.equal((await INVOICE_CREATE(req("POST", basic, keys.viewer))).status, 403);
      assert.equal((await ro.call("create_invoice", basic)).body.status, 403);
      assert.equal((await ma.call("create_invoice", { ...basic, contactId: foreignCustomer.id })).isError, true);
      for (const price of [{ unitPrice: 1, unitPriceMinor: "101" }, { unitPriceMinor: "9007199254740992" }, { unitPriceMinor: "01" }]) {
        const input = { ...basic, lines: [{ description: "Invalid", ...price }] };
        assert.ok([400, 422].includes((await INVOICE_CREATE(req("POST", input))).status)); assert.equal((await ma.call("create_invoice", input)).isError, true);
      }
      assert.equal((await ma.call("import_invoices", { fileName: "invalid.csv", rows: [{ ...basic, lines: [{ description: "Overflow", unitPriceMinor: "9007199254740992" }] }] })).isError, true);
    });
    // Explicit minor aliases remain identical across currency scales on draft paths.
    for (const currencyCode of ["USD", "IRR", "JPY", "KWD"]) {
      const result = await ma.call("create_invoice", { ...basic, currencyCode }); assert.equal(result.isError, false);
      assert.equal((await read(result.body.invoice.id)).totalMinor, "1250");
    }
    const max = await ma.call("create_invoice", { ...basic, lines: [{ description: "Safe maximum", unitPriceMinor: "9007199254740991" }] });
    assert.equal(max.isError, false); assert.equal((await read(max.body.invoice.id)).total, Number.MAX_SAFE_INTEGER);
    await db.execute(sql`update invoice set total = 9007199254740992 where id = ${max.body.invoice.id}`);
    await unchanged(async () => {
      assert.equal((await INVOICE_GET(req("GET"), params(max.body.invoice.id))).status, 422);
      assert.equal((await ma.call("get_invoice", { invoiceId: max.body.invoice.id })).body.code, "LEGACY_NUMERIC_RANGE");
    });
    await db.update(invoice).set({ total: Number.MAX_SAFE_INTEGER }).where(eq(invoice.id, max.body.invoice.id));
    // Every posted journal across recognition, credit, customer cash and receipt reversal balances exactly.
    assert.deepEqual((await db.execute(sql`select journal_entry_id from journal_line group by journal_entry_id having sum(debit_amount::numeric) <> sum(credit_amount::numeric)`)).rows, []);
    for (const [account, expected] of [[ar, "1875"], [cash, "625"], [deposits, "0"], [revenue, "-2500"]] as const) {
      const result = await db.execute(sql`select sum(debit_amount::numeric - credit_amount::numeric)::text as net from journal_line where account_id = ${account.id}`);
      assert.equal(result.rows[0].net, expected, account.name);
    }
    console.log("Combined receivable document contracts verified");
  } finally { await ma.close(); await mb.close(); await ro.close(); }
}
run().then(() => process.exit(0), error => { console.error(error); process.exit(1); });
