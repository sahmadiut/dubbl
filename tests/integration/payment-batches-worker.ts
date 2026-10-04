// Runs only against the harness-created disposable PostgreSQL database.
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, customRole, contact, chartAccount, bankAccount, invoice, bill,
  payment, paymentAllocation, paymentBatch, paymentBatchItem, journalEntry, journalLine, auditLog, exchangeRate, periodLock, documentEmailLog } from "../../lib/db/schema";
import { fiscalYear } from "../../lib/db/schema";
import { POST as create } from "../../app/api/v1/payments/batch/route";
import { GET as list, POST as draft } from "../../app/api/v1/payment-batches/route";
import { GET as get, PATCH as update } from "../../app/api/v1/payment-batches/[id]/route";
import { POST as submit } from "../../app/api/v1/payment-batches/[id]/submit/route";
import { GET as remittance, POST as send } from "../../app/api/v1/payment-batches/[id]/remittance/route";
import { DELETE as remove } from "../../app/api/v1/payments/[id]/route";
import { POST as invoicePay } from "../../app/api/v1/invoices/[id]/pay/route";
import { POST as billPay } from "../../app/api/v1/bills/[id]/pay/route";
import { registerPaymentTools } from "../../lib/mcp/tools/payments";
import { registerPaymentBatchTools } from "../../lib/mcp/tools/payment-batches";
import { registerPurchasingTools } from "../../lib/mcp/tools/purchasing";
import { createInvoice } from "../../lib/api/invoice-writes";
import { sendInvoice } from "../../lib/api/invoice-lifecycle";
import { createBill } from "../../lib/api/bill-writes";
import { receiveBill } from "../../lib/api/bill-lifecycle";
import type { AuthContext } from "../../lib/api/auth-context";
import { renderRemittanceHtml } from "../../lib/api/remittance";

async function mcp(ctx: AuthContext) {
  const server = new McpServer({ name: "Batch fixture", version: "1.0.0" });
  registerPaymentTools(server, ctx); registerPaymentBatchTools(server, ctx); registerPurchasingTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1.0.0" });
  const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
  const tools = (await client.listTools()).tools;
  for (const name of ['record_payment_batch','list_payment_batches','get_payment_batch','create_payment_batch','update_payment_batch','submit_payment_batch','generate_remittance','send_payment_batch_remittance'])
    assert.ok(tools.find(t => t.name === name), name);
  return { async call(name: string, args: Record<string, unknown>) {
    const result = await client.callTool({ name, arguments: args });
    const text = (result.content as { type: string; text: string }[])[0].text;
    return { isError: result.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
  }, async close() { await client.close(); await server.close(); } };
}

async function run() {
  const [a, b] = await db.insert(organization).values([{ name: "Settlement A", slug: "settle-a" }, { name: "Settlement B", slug: "settle-b" }]).returning();
  const [owner, viewer, accountant] = await db.insert(users).values([{ email: "settle-owner@example.test" }, { email: "settle-viewer@example.test" }, { email: "settle-accountant@example.test" }]).returning();
  const [role] = await db.insert(customRole).values({ organizationId: a.id, name: "Read only", permissions: [] }).returning();
  const [payRole] = await db.insert(customRole).values({ organizationId: a.id, name: "Pay only", permissions: ["manage:payments"] }).returning();
  await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner" }, { organizationId: b.id, userId: owner.id, role: "owner" },
    { organizationId: a.id, userId: viewer.id, role: "member", customRoleId: role.id }, { organizationId: a.id, userId: accountant.id, role: "member", customRoleId: payRole.id }]);
  const keys = { a: "dk_settle_a", b: "dk_settle_b", viewer: "dk_settle_viewer", payOnly: "dk_settle_payonly", expired: "dk_settle_expired" };
  for (const [label, key] of Object.entries(keys)) await db.insert(apiKey).values({ organizationId: label === "b" ? b.id : a.id,
    createdBy: label === "viewer" ? viewer.id : label === "payOnly" ? accountant.id : owner.id, name: label, keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_settle",
    expiresAt: label === "expired" ? new Date("2020-01-01") : null });
  const [party, , foreignParty] = await db.insert(contact).values([{ organizationId: a.id, name: "Own both", type: "both" },
    { organizationId: a.id, name: "Other contact", type: "both" }, { organizationId: b.id, name: "Foreign", type: "both" }]).returning();
  const [, , cash, revenue, expense, foreignAccount] = await db.insert(chartAccount).values([
    { organizationId: a.id, code: "1200", name: "AR", type: "asset" }, { organizationId: a.id, code: "2100", name: "AP", type: "liability" },
    { organizationId: a.id, code: "1100", name: "Cash", type: "asset" }, { organizationId: a.id, code: "4000", name: "Sales", type: "revenue" },
    { organizationId: a.id, code: "5000", name: "Expense", type: "expense" }, { organizationId: b.id, code: "1100", name: "Foreign cash", type: "asset" },
  ]).returning();
  const [bank, , foreignBank] = await db.insert(bankAccount).values([{ organizationId: a.id, accountName: "Cash USD", chartAccountId: cash.id },
    { organizationId: a.id, accountName: "EUR", currencyCode: "EUR" }, { organizationId: b.id, accountName: "Foreign", chartAccountId: foreignAccount.id }]).returning();
  const ctx: AuthContext = { userId: owner.id, organizationId: a.id, role: "owner" };
  const ma = await mcp(ctx), readOnly = await mcp({ ...ctx, userId: viewer.id, role: "member", permissions: [] }), mb = await mcp({ ...ctx, organizationId: b.id });
  const request = (body: unknown, key = keys.a, retry?: string) => new Request("http://fixture.test/api/v1/payments", { method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-organization-id": b.id, ...(retry ? { "idempotency-key": retry } : {}) }, body: JSON.stringify(body) });
  const params = (id: string) => ({ params: Promise.resolve({ id }) });
  const pay = (kind: "invoice" | "bill", id: string, body: unknown, key = keys.a, retry?: string) => (kind === "invoice" ? invoicePay : billPay)(request(body, key, retry), params(id));
  const post = (body: unknown, key = keys.a, retry?: string) => create(request(body, key, retry));
  async function recognized(kind: "invoice" | "bill", amount = 1250, currencyCode = "USD", contactId = party.id, extra: Record<string, unknown> = {}) {
    const input = { contactId, issueDate: "2026-10-01", dueDate: "2026-10-31", currencyCode,
      lines: [{ description: "Fixture", unitPriceMinor: String(amount), accountId: kind === "invoice" ? revenue.id : expense.id }], ...extra };
    if (kind === "invoice") { const created = await createInvoice(ctx, input, "rest"); return (await sendInvoice(ctx, created.invoice.id)).invoice; }
    const created = await createBill(ctx, input, "rest"); return (await receiveBill(ctx, created.bill.id)).bill;
  }
  const tables = ["payment_batch", "payment_batch_item", "document_email_log","credit_note", "debit_note", "customer_credit", "invoice", "bill", "payment", "payment_allocation", "journal_entry", "journal_line", "bank_account", "bank_transaction", "chart_account", "number_sequence"];
  const snapshot = async () => {
    const rows = await Promise.all(tables.map(table => db.execute(sql.raw(`select coalesce(jsonb_agg(to_jsonb(t)::text order by t.id),'[]'::jsonb) as rows from ${table} t`)).then(r => r.rows)));
    return [...rows, (await db.execute(sql`select coalesce(jsonb_agg(to_jsonb(t)::text order by t.id),'[]'::jsonb) as rows from audit_log t where entity_type <> 'api_key'`)).rows];
  };
  async function denied(fn: () => Promise<Response>, status: number) { const before = await snapshot(); const response = await fn();
    assert.equal(response.status, status, JSON.stringify(await response.clone().json())); assert.deepEqual(await snapshot(), before); }
  async function mcpDenied(name: string, args: Record<string, unknown>, client = ma) { const before = await snapshot();
    assert.equal((await client.call(name, args)).isError, true); assert.deepEqual(await snapshot(), before); }
  const today = new Date().toISOString().slice(0, 10);
  const item = (doc: { id: string }, amount = 1250, currencyCode = "USD") => ({ billId: doc.id, contactId: party.id, amount, currencyCode });
  const draftBatch = (items: unknown[], currencyCode = "USD", key = keys.a) => draft(request({ name: "Batch", items, currencyCode }, key));
  const getBatch = (id: string, key = keys.a) => get(request({}, key), params(id));
  const submitBatch = (id: string, key = keys.a) => submit(request({}, key), params(id));
  const updateBatch = (id: string, body: unknown, key = keys.a) => update(request(body, key), params(id));
  const remit = (id: string, key = keys.a) => remittance(request({}, key), params(id));
  const sendBatch = (id: string, body: unknown = {}, key = keys.a) => send(request(body, key), params(id));
  const data = async (response: Response, status = 200) => { const body = await response.json(); assert.equal(response.status, status, JSON.stringify(body)); return body; };
  const journal = async (id: string) => {
    const lines = await db.select().from(journalLine).where(eq(journalLine.journalEntryId, id));
    assert.equal(lines.reduce((sum, line) => sum + BigInt(line.debitAmount), 0n), lines.reduce((sum, line) => sum + BigInt(line.creditAmount), 0n));
    return lines;
  };
  try {
    const d1 = await recognized("invoice"), d2 = await recognized("invoice");
    const body = { type: "received", contactId: party.id, date: today, bankAccountId: bank.id,
      allocations: [d1, d2].map(doc => ({ documentType: "invoice", documentId: doc.id, amount: 12.5 })) };
    const paid = (await data(await post(body, keys.payOnly, "batch-retry"), 201)).payment;
    assert.equal(paid.amount, 2500); assert.equal(paid.amountMinor, "2500"); await journal(paid.journalEntryId);
    assert.equal((await db.select().from(paymentAllocation).where(eq(paymentAllocation.paymentId, paid.id))).length, 2);
    const retry = { ...body, allocations: [d2, d1].map(doc => ({ documentType: "invoice", documentId: doc.id, amountMinor: "1250" })) };
    assert.deepEqual((await data(await post(retry, keys.a, "batch-retry"), 201)).payment, paid);
    assert.deepEqual((await ma.call("record_payment_batch", { ...retry, idempotencyKey: "batch-retry" })).body.payment, paid);
    await denied(() => post({ ...retry, reference: "different" }, keys.a, "batch-retry"), 409);
    const outstanding = await recognized("invoice");
    const outstandingBody = { ...body, allocations: [{ documentType: "invoice", documentId: outstanding.id, amount: 12.5 }] };
    for (const patch of [{ amount: 12.5, amountMinor: "12" }, { amount: 12.5, amountExact: "12.501" }, { amount: 0.001 },
      { amountMinor: "01" }, { amount: 13 }, { amountMinor: "0" }]) {
      const input = { ...outstandingBody, allocations: [{ documentType: "invoice", documentId: outstanding.id, ...patch }] };
      await denied(() => post(input), 400); await mcpDenied("record_payment_batch", input);
    }
    for (const [key, status] of [["dk_invalid", 401], [keys.expired, 401], [keys.viewer, 403], [keys.b, 404]] as const)
      await denied(() => post(outstandingBody, key), status);
    await mcpDenied("record_payment_batch", outstandingBody, readOnly); await mcpDenied("record_payment_batch", outstandingBody, mb);
    await denied(() => post({ ...outstandingBody, allocations: [...outstandingBody.allocations, ...outstandingBody.allocations] }), 400);
    await denied(() => post({ ...outstandingBody, contactId: foreignParty.id }), 400);
    await denied(() => post({ ...outstandingBody, bankAccountId: foreignBank.id }), 400);
    await denied(() => post({ ...outstandingBody, date: "2026-02-30" }), 400);
    await denied(() => post({ ...outstandingBody, amount: 1250 }), 400);
    await denied(() => post({ ...outstandingBody, allocations: [{ documentType: "invoice", documentId: outstanding.id, amountMinor: "9007199254740992" }] }), 422);
    // First allocations and additional documents use the same exact settlement protocol.
    await data(await pay("invoice", outstanding.id, { date: today, amount: 250 }));
    await data(await post({ ...outstandingBody, allocations: [{ documentType: "invoice", documentId: outstanding.id, amountExact: "10.00" }] }), 201);
    const madeDoc = await recognized("bill");
    const made = await ma.call("record_payment_batch", { type: "made", contactId: party.id, date: today,
      allocations: [{ documentType: "bill", documentId: madeDoc.id, amountExact: "12.50", amountMinor: "1250" }] });
    assert.equal(made.isError, false, JSON.stringify(made.body)); assert.equal(made.body.payment.amount, 1250); await journal(made.body.payment.journalEntryId);
    const [bill1, bill2, bill3] = [await recognized("bill"), await recognized("bill"), await recognized("bill")];
    const startPayments = (await db.select().from(payment)).length;
    const created = (await data(await draftBatch([{ billId: bill1.id, contactId: party.id, amountMinor: "1250" }, item(bill2)], "USD", keys.payOnly), 201)).batch;
    assert.equal(created.totalAmountMinor, "2500"); assert.equal((await db.select().from(payment)).length, startPayments);
    assert.equal((await data(await getBatch(created.id))).batch.items[0].bill.totalMinor, "1250");
    const listing = await data(await list(new Request("http://fixture.test/api/v1/payment-batches?limit=1", { headers: { authorization: `Bearer ${keys.a}` } })));
    assert.equal(listing.data[0].totalAmountMinor, "2500"); assert.equal(listing.pagination.total, 1);
    assert.equal((await ma.call("list_payment_batches", {})).body.data.length, 1);
    assert.equal((await ma.call("get_payment_batch", { batchId: created.id })).body.batch.id, created.id);
    await denied(() => remit(created.id), 400); await denied(() => sendBatch(created.id), 400);
    const edited = (await data(await updateBatch(created.id, { removeItemIds: [created.items[1].id], addItems: [item(bill3, 500)], name: "Edited" }))).batch;
    assert.equal(edited.totalAmount, 1750); assert.equal(edited.items.length, 2);
    assert.equal((await ma.call("update_payment_batch", { batchId: created.id, name: "MCP name" })).isError, false);
    await denied(() => updateBatch(created.id, { name: "rollback", addItems: [{ ...item(bill2), contactId: foreignParty.id }] }), 422);
    await denied(() => updateBatch(created.id, { removeItemIds: [randomUUID()] }), 400);
    await denied(() => updateBatch(created.id, { addItems: [item(bill1)] }), 422);
    await denied(() => updateBatch(created.id, { removeItemIds: edited.items.map((row: { id: string }) => row.id) }), 400);
    await denied(() => getBatch(created.id, keys.b), 404); await denied(() => getBatch("bad"), 400);
    await denied(() => updateBatch(created.id, { name: "denied" }, keys.viewer), 403);
    await denied(() => submitBatch(created.id, keys.viewer), 403); await denied(() => submitBatch(created.id, keys.b), 404);
    await mcpDenied("get_payment_batch", { batchId: created.id }, mb); await mcpDenied("submit_payment_batch", { batchId: created.id }, readOnly);
    await mcpDenied("update_payment_batch", { batchId: created.id, name: "Denied" }, readOnly);
    for (const invalid of [item(bill2, 12.5), { ...item(bill2), amountMinor: "1251" }, item(bill2, 1300)]) {
      await denied(() => draftBatch([invalid]), 400); await mcpDenied("create_payment_batch", { name: "Invalid", items: [invalid] });
    }
    await denied(() => draftBatch([item(bill2), item(bill2)]), 422);
    await denied(() => draftBatch([{ ...item(bill2), currencyCode: "EUR" }]), 422);
    await denied(() => draftBatch([{ ...item(bill2), billId: randomUUID() }]), 422);
    await denied(() => draftBatch([item(bill2)], "USD", keys.viewer), 403);
    const [lock] = await db.insert(periodLock).values({ organizationId: a.id, lockDate: today }).returning();
    await denied(() => submitBatch(created.id), 422); await mcpDenied("submit_payment_batch", { batchId: created.id });
    await db.delete(periodLock).where(eq(periodLock.id, lock.id));
    const [year] = await db.insert(fiscalYear).values({ organizationId: a.id, name: "Closed", startDate: today, endDate: today, isClosed: true }).returning();
    await denied(() => submitBatch(created.id), 422); await mcpDenied("submit_payment_batch", { batchId: created.id });
    await db.delete(fiscalYear).where(eq(fiscalYear.id, year.id));
    // Failure after both payments post rolls back the complete batch, including numbering and audit.
    await db.execute(sql.raw("create function fail_batch_audit() returns trigger language plpgsql as $$ begin if NEW.entity_type='payment_batch' then raise exception 'fixture batch audit failure'; end if; return NEW; end $$"));
    await db.execute(sql.raw("create trigger fixture_batch_audit before insert on audit_log for each row execute function fail_batch_audit()"));
    await denied(() => submitBatch(created.id), 500); await mcpDenied("submit_payment_batch", { batchId: created.id });
    await denied(() => draftBatch([item(bill2)]), 500); await denied(() => updateBatch(created.id, { name: "audit rollback" }), 500);
    await db.execute(sql.raw("drop trigger fixture_batch_audit on audit_log; drop function fail_batch_audit()"));
    // Existing standalone cash makes stale batch balances reject with zero effects.
    await data(await pay("bill", bill3.id, { date: today, amount: 1000 })); await denied(() => submitBatch(created.id), 400);
    await updateBatch(created.id, { removeItemIds: [edited.items.find((row: { billId: string }) => row.billId === bill3.id).id], addItems: [item(bill3, 250)] });
    const competing = await Promise.all([submitBatch(created.id), submitBatch(created.id)]);
    assert.deepEqual(competing.map(response => response.status).sort(), [200, 400]);
    const completed = await data(competing.find(response => response.status === 200)!);
    assert.equal(completed.processed, 2); assert.equal(completed.batch.status, "completed"); assert.equal(completed.batch.totalAmountMinor, "1500");
    await denied(() => submitBatch(created.id), 400); await denied(() => updateBatch(created.id, { name: "after complete" }), 400);
    const result = await data(await remit(created.id)); const group = result.remittances[0];
    assert.equal(group.totalPaidMinor, "1500"); assert.equal(group.lines[0].billTotalMinor, "1250");
    const html = renderRemittanceHtml("<script>org</script>", { ...group, contactName: "<b>supplier</b>",
      lines: group.lines.map((line: object) => ({ ...line, billReference: "<svg>" })) }, "<batch>", today, "<script>message</script>");
    assert.ok(html.includes("$15.00")); assert.ok(html.includes("&lt;script&gt;message&lt;/script&gt;")); assert.ok(!html.includes("<script>")); assert.ok(!html.includes("<svg>"));
    assert.equal((await ma.call("generate_remittance", { paymentBatchId: created.id })).body.remittances[0].totalPaidMinor, "1500");
    assert.equal((await data(await sendBatch(created.id))).skipped.length, 1);
    assert.equal((await ma.call("send_payment_batch_remittance", { batchId: created.id })).body.skipped.length, 1);
    assert.equal((await db.select().from(documentEmailLog)).length, 0);
    await denied(() => sendBatch(created.id, { contactId: foreignParty.id }), 404);
    await denied(() => sendBatch(created.id, { contactId: "bad" }), 400);
    await denied(() => remit(created.id, keys.viewer), 403); await denied(() => remit(created.id, keys.b), 404);
    await mcpDenied("generate_remittance", { paymentBatchId: created.id }, readOnly); await mcpDenied("send_payment_batch_remittance", { batchId: created.id }, mb);
    const submission = (await db.query.auditLog.findFirst({ where: and(eq(auditLog.entityId, created.id), eq(auditLog.action, "submit")) }))!;
    const linked = (submission.changes as { settlements: { paymentId: string }[] }).settlements[0].paymentId;
    await db.update(auditLog).set({ changes: { settlements: "malformed" } }).where(eq(auditLog.id, submission.id));
    await denied(() => remit(created.id), 422); await denied(() => sendBatch(created.id), 422);
    await db.update(auditLog).set({ changes: submission.changes }).where(eq(auditLog.id, submission.id));
    const linkedPayment = (await db.query.payment.findFirst({ where: eq(payment.id, linked) }))!;
    await db.update(journalEntry).set({ status: "draft" }).where(eq(journalEntry.id, linkedPayment.journalEntryId!));
    await denied(() => remit(created.id), 422); await mcpDenied("generate_remittance", { paymentBatchId: created.id });
    await db.update(journalEntry).set({ status: "posted" }).where(eq(journalEntry.id, linkedPayment.journalEntryId!));
    await data(await remove(request({}), params(linked))); await denied(() => remit(created.id), 409); await denied(() => sendBatch(created.id), 409);

    // Unsupported history is rejected before writes/disclosure, even on list and exports.
    const historic = (await data(await draftBatch([item(bill2)]), 201)).batch;
    await db.execute(sql`update payment_batch_item set amount=9007199254740992 where batch_id=${historic.id}`);
    await denied(() => getBatch(historic.id), 422); await denied(() => submitBatch(historic.id), 422); await mcpDenied("get_payment_batch", { batchId: historic.id });
    await db.execute(sql`update payment_batch_item set amount=1250 where batch_id=${historic.id}`);
    await db.update(paymentBatchItem).set({ contactId: foreignParty.id }).where(eq(paymentBatchItem.batchId, historic.id));
    await denied(() => getBatch(historic.id), 422); await denied(() => submitBatch(historic.id), 422);
    await db.update(paymentBatchItem).set({ contactId: party.id }).where(eq(paymentBatchItem.batchId, historic.id));
    const [foreignJournal] = await db.insert(journalEntry).values({ organizationId: b.id, entryNumber: 1, date: today, description: "Foreign", status: "posted" }).returning();
    await db.update(bill).set({ journalEntryId: foreignJournal.id }).where(eq(bill.id, bill2.id)); await denied(() => getBatch(historic.id), 422);
    await db.update(bill).set({ journalEntryId: bill2.journalEntryId }).where(eq(bill.id, bill2.id));
    await db.update(paymentBatch).set({ totalAmount: 1 }).where(eq(paymentBatch.id, historic.id)); await denied(() => getBatch(historic.id), 422);
    await db.update(paymentBatch).set({ totalAmount: 1250, status: "completed" }).where(eq(paymentBatch.id, historic.id)); await denied(() => remit(historic.id), 422);
    await db.update(paymentBatch).set({ status: "draft", deletedAt: new Date() }).where(eq(paymentBatch.id, historic.id)); await denied(() => getBatch(historic.id), 404);
    const large = await recognized("bill", Number.MAX_SAFE_INTEGER);
    const big = await ma.call("create_payment_batch", { name: "Big", items: [{ billId: large.id, contactId: party.id, amountMinor: "9007199254740991" }] });
    assert.equal(big.isError, false, JSON.stringify(big.body)); assert.equal(big.body.batch.totalAmountMinor, "9007199254740991");
    assert.equal((await ma.call("submit_payment_batch", { batchId: big.body.batch.id })).isError, false);
    assert.equal((await data(await remit(big.body.batch.id))).remittances[0].totalPaidMinor, "9007199254740991");
    const over1 = await recognized("bill", Number.MAX_SAFE_INTEGER), over2 = await recognized("bill", 1);
    await denied(() => draftBatch([item(over1, Number.MAX_SAFE_INTEGER), item(over2, 1)]), 422);
    await denied(() => post({ type: "made", date: today, contactId: party.id, allocations: [over1, over2].map((doc, i) => ({ documentId: doc.id,
      documentType: "bill", amountMinor: i ? "1" : "9007199254740991" })) }), 422);
    for (const [currencyCode, rate, major] of [["IRR", 10000, "1250"], ["JPY", 10000, "1250"], ["KWD", 2000000, "1.250"], ["EUR", 2000000, "12.50"]] as const) {
      await db.insert(exchangeRate).values({ organizationId: a.id, baseCurrency: currencyCode, targetCurrency: "USD", date: "2026-10-01", rate, source: "manual" });
      const fxBill = await recognized("bill", 1250, currencyCode);
      const fxPaid = await data(await post({ type: "made", contactId: party.id, date: today,
        allocations: [{ documentId: fxBill.id, documentType: "bill", amountExact: major, amountMinor: "1250" }] }), 201);
      assert.equal(fxPaid.payment.amount, 1250); assert.equal(fxPaid.payment.currencyCode, currencyCode); await journal(fxPaid.payment.journalEntryId);
      const stored = await recognized("bill", 1250, currencyCode);
      const fxDraft = (await data(await draftBatch([item(stored, 1250, currencyCode)], currencyCode), 201)).batch;
      await data(await submitBatch(fxDraft.id)); assert.equal((await data(await remit(fxDraft.id))).remittances[0].totalPaid, 1250);
    }
    const missingDoc = await recognized("bill", 1250, "EUR"), missingBatch = (await data(await draftBatch([item(missingDoc, 1250, "EUR")], "EUR"), 201)).batch;
    await db.delete(exchangeRate).where(eq(exchangeRate.baseCurrency, "EUR")); await denied(() => submitBatch(missingBatch.id), 422);
    assert.equal((await db.query.invoice.findFirst({ where: eq(invoice.id, d1.id) }))!.amountPaid, 1250);
    console.log("REST and MCP payment batches verified");
  } finally { await ma.close(); await readOnly.close(); await mb.close(); }
}
run().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
