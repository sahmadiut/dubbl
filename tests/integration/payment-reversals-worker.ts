// Uses only the harness-created disposable database; no real provider calls.
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, customRole, contact, chartAccount, bankAccount, bankTransaction, invoice, bill,
  payment, paymentAllocation, journalEntry, journalLine, auditLog, exchangeRate, periodLock, fiscalYear, creditNote, debitNote, customerCredit, costCenter } from "../../lib/db/schema";
import { POST as create } from "../../app/api/v1/payments/route";
import { DELETE as remove } from "../../app/api/v1/payments/[id]/route";
import { POST as invoicePay } from "../../app/api/v1/invoices/[id]/pay/route";
import { POST as billPay } from "../../app/api/v1/bills/[id]/pay/route";
import { registerPaymentTools } from "../../lib/mcp/tools/payments";
import { createInvoice } from "../../lib/api/invoice-writes";
import { sendInvoice } from "../../lib/api/invoice-lifecycle";
import { createBill } from "../../lib/api/bill-writes";
import { receiveBill } from "../../lib/api/bill-lifecycle";
import { createCreditNote, sendCreditNote, applyCredit, createCustomerCredit, voidCreditNote } from "../../lib/api/credits";
import { createDebitNote, sendDebitNote, applyDebitNote, voidDebitNote } from "../../lib/api/debit-notes";
import type { AuthContext } from "../../lib/api/auth-context";

async function mcp(ctx: AuthContext) {
  const server = new McpServer({ name: "Reversal fixture", version: "1.0.0" }); registerPaymentTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1.0.0" });
  const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
  const tool = (await client.listTools()).tools.find(t => t.name === "delete_payment")!;
  assert.ok(tool.description!.includes("minor units")); assert.ok(JSON.stringify(tool.inputSchema).includes("UUID"));
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
  const tables = ["credit_note", "debit_note", "customer_credit", "invoice", "bill", "payment", "payment_allocation", "journal_entry", "journal_line", "bank_account", "bank_transaction", "chart_account", "number_sequence"];
  const snapshot = async () => {
    const rows = await Promise.all(tables.map(table => db.execute(sql.raw(`select coalesce(jsonb_agg(to_jsonb(t)::text order by t.id),'[]'::jsonb) as rows from ${table} t`)).then(r => r.rows)));
    return [...rows, (await db.execute(sql`select coalesce(jsonb_agg(to_jsonb(t)::text order by t.id),'[]'::jsonb) as rows from audit_log t where entity_type <> 'api_key'`)).rows];
  };
  async function denied(fn: () => Promise<Response>, status: number) { const before = await snapshot(); const response = await fn();
    assert.equal(response.status, status, JSON.stringify(await response.clone().json())); assert.deepEqual(await snapshot(), before); }
  async function mcpDenied(name: string, args: Record<string, unknown>, client = ma) { const before = await snapshot();
    assert.equal((await client.call(name, args)).isError, true); assert.deepEqual(await snapshot(), before); }
  const del = (id: string, key = keys.a) => remove(new Request('http://fixture.test/api/v1/payments/' + id, {
    method: 'DELETE', headers: { authorization: `Bearer ${key}`, 'x-organization-id': b.id } }), params(id));
  const latestCarrier = async (kind: string, id: string) => {
    const [p] = await db.select({ payment }).from(payment).innerJoin(paymentAllocation, eq(payment.id, paymentAllocation.paymentId))
      .where(and(eq(paymentAllocation.documentType, kind), eq(paymentAllocation.documentId, id), sql`${payment.deletedAt} is null`)).orderBy(sql`${payment.createdAt} desc`);
    return p.payment;
  };
  async function cashPayment(kind: 'invoice' | 'bill', amount = 1250, exact = false, currency = 'USD') {
    const doc = await recognized(kind, amount, currency);
    const response = await pay(kind, doc.id, { ...(exact ? { amountMinor: String(amount) } : { amount }), date: '2026-10-04', ...(currency === 'USD' ? { bankAccountId: bank.id } : {}) });
    assert.equal(response.status, 200, JSON.stringify(await response.clone().json()));
    return { doc, p: (await response.json()).payment };
  }
  async function checkReversal(p: { id: string; journalEntryId: string }, beforeLines: (typeof journalLine.$inferSelect)[]) {
    const original = await db.query.journalEntry.findFirst({ where: eq(journalEntry.id, p.journalEntryId) });
    assert.ok(original!.reversedByEntryId);
    const reversal = await db.query.journalEntry.findFirst({ where: eq(journalEntry.id, original!.reversedByEntryId!) });
    assert.equal(reversal!.reversesEntryId, p.journalEntryId); assert.equal(reversal!.sourceId, p.id); assert.equal(reversal!.sourceType, 'payment_void');
    assert.deepEqual(await db.select().from(journalLine).where(eq(journalLine.journalEntryId, p.journalEntryId)), beforeLines);
    const lines = await db.select().from(journalLine).where(eq(journalLine.journalEntryId, reversal!.id));
    const normalize = (l: typeof journalLine.$inferSelect, flip = false) => ({ accountId: l.accountId, debitAmount: flip ? l.creditAmount : l.debitAmount,
      creditAmount: flip ? l.debitAmount : l.creditAmount, currencyCode: l.currencyCode, exchangeRate: l.exchangeRate, rateExact: l.rateExact,
      rateDirection: l.rateDirection, rateFormatVersion: l.rateFormatVersion, rateMigrationStatus: l.rateMigrationStatus, rateProvenance: l.rateProvenance,
      costCenterId: l.costCenterId, projectId: l.projectId });
    assert.deepEqual(lines.map(l => normalize(l)), beforeLines.map(l => normalize(l, true)));
    const [audit] = await db.select().from(auditLog).where(and(eq(auditLog.entityId, p.id), eq(auditLog.action, 'delete')));
    const changes = audit.changes as { before: { amount: number; amountMinor: string }; reversalEntryId: string };
    assert.equal(String(changes.before.amount), changes.before.amountMinor); assert.equal(changes.reversalEntryId, reversal!.id);
    const gone = await db.query.payment.findFirst({ where: eq(payment.id, p.id) }); assert.ok(gone!.deletedAt); assert.equal(gone!.journalEntryId, p.journalEntryId);
  }
  try {
    for (const kind of ['invoice', 'bill'] as const) for (const amount of [1250, 2147483648, Number.MAX_SAFE_INTEGER]) {
      const { doc, p } = await cashPayment(kind, amount, amount !== 1250);
      const saved = await db.select().from(journalLine).where(eq(journalLine.journalEntryId, p.journalEntryId));
      if (kind === 'invoice') { const res = await del(p.id, keys.payOnly); assert.equal(res.status, 200); assert.deepEqual(await res.json(), { success: true }); }
      else { const res = await ma.call('delete_payment', { paymentId: p.id }); assert.equal(res.isError, false, JSON.stringify(res.body)); assert.deepEqual(res.body, { success: true }); }
      await checkReversal(p, saved);
      const row = kind === 'invoice' ? await db.query.invoice.findFirst({ where: eq(invoice.id, doc.id) }) : await db.query.bill.findFirst({ where: eq(bill.id, doc.id) });
      assert.equal(row!.amountPaid, 0); assert.equal(row!.amountDue, amount); assert.equal(row!.paidAt, null);
      await denied(() => del(p.id), 404); await mcpDenied('delete_payment', { paymentId: p.id });
    }
    const twoA = await recognized('invoice', 100), twoB = await recognized('invoice', 200);
    const multi = await post({ contactId: party.id, type: 'received', amount: 300, date: '2026-10-04', allocations: [
      { documentType: 'invoice', documentId: twoA.id, amountMinor: '100' }, { documentType: 'invoice', documentId: twoB.id, amount: 200 } ] });
    assert.equal(multi.status, 201); const mp = (await multi.json()).payment; assert.equal((await del(mp.id)).status, 200);
    for (const id of [twoA.id, twoB.id]) assert.equal((await db.query.invoice.findFirst({ where: eq(invoice.id, id) }))!.amountPaid, 0);
    const partial = await recognized('invoice', 1000);
    const p1 = (await (await pay('invoice', partial.id, { amount: 400, date: '2026-10-04' })).json()).payment;
    const p2 = (await (await pay('invoice', partial.id, { amountMinor: '600', date: '2026-10-04' })).json()).payment;
    assert.equal((await del(p1.id)).status, 200); const left = await db.query.invoice.findFirst({ where: eq(invoice.id, partial.id) });
    assert.equal(left!.amountPaid, 600); assert.equal(left!.amountDue, 400); assert.equal(left!.status, 'partial'); assert.equal(left!.paidAt, null);
    assert.equal((await del(p2.id)).status, 200);

    // Currency labels and saved FX survive later quote edits and inactive banks.
    await db.update(contact).set({ creditLimit: null }).where(eq(contact.id, party.id));
    await db.insert(exchangeRate).values([{ organizationId: a.id, baseCurrency: 'EUR', targetCurrency: 'USD', date: '2026-10-01', rate: 1200000 },
      { organizationId: a.id, baseCurrency: 'EUR', targetCurrency: 'USD', date: '2026-10-04', rate: 1300000 }]);
    const fx = await cashPayment('invoice', 1250, true, 'EUR');
    const [dimension] = await db.insert(costCenter).values({ organizationId: a.id, code: 'FX', name: 'FX centre' }).returning();
    await db.update(journalLine).set({ costCenterId: dimension.id }).where(eq(journalLine.journalEntryId, fx.p.journalEntryId));
    const fxSaved = await db.select().from(journalLine).where(eq(journalLine.journalEntryId, fx.p.journalEntryId));
    await db.update(exchangeRate).set({ rate: 1900000 }).where(eq(exchangeRate.organizationId, a.id));
    assert.equal((await del(fx.p.id)).status, 200); await checkReversal(fx.p, fxSaved);
    for (const [currency, rate] of [['JPY', 10000], ['IRR', 10000], ['KWD', 2000000]] as const) {
      await db.insert(exchangeRate).values({ organizationId: a.id, baseCurrency: currency, targetCurrency: 'USD', date: '2026-10-01', rate });
      const scaled = await cashPayment('bill', 1250, true, currency); assert.equal((await del(scaled.p.id)).status, 200);
      assert.equal((await db.query.bill.findFirst({ where: eq(bill.id, scaled.doc.id) }))!.amountDue, 1250);
    }
    const inactive = await cashPayment('bill'); await db.update(bankAccount).set({ isActive: false }).where(eq(bankAccount.id, bank.id));
    const bankBefore = await db.query.bankAccount.findFirst({ where: eq(bankAccount.id, bank.id) }); assert.equal((await del(inactive.p.id)).status, 200);
    assert.deepEqual(await db.query.bankAccount.findFirst({ where: eq(bankAccount.id, bank.id) }), bankBefore);
    await db.update(bankAccount).set({ isActive: true }).where(eq(bankAccount.id, bank.id));

    // Paired noncash applications restore the source credit, retain its GL, and
    // can subsequently be reapplied/voided without counting deleted carriers.
    for (const kind of ['invoice', 'bill'] as const) {
      const doc = await recognized(kind, 2000);
      const input = { contactId: party.id, issueDate: '2026-10-01', currencyCode: 'USD', lines: [{ description: 'Credit', unitPriceMinor: '800', accountId: kind === 'invoice' ? revenue.id : expense.id }] };
      const note = kind === 'invoice' ? (await createCreditNote(ctx, input, 'rest')).creditNote : (await createDebitNote(ctx, input, 'rest')).debitNote;
      if (kind === 'invoice') await sendCreditNote(ctx, note.id); else await sendDebitNote(ctx, note.id);
      const apply = () => kind === 'invoice' ? applyCredit(ctx, note.id, { invoiceId: doc.id, amountMinor: '400' }) : applyDebitNote(ctx, note.id, { billId: doc.id, amount: 400 });
      await apply(); const first = await latestCarrier(kind === 'invoice' ? 'credit_note' : 'debit_note', note.id); await apply();
      const savedNote = kind === 'invoice' ? await db.query.creditNote.findFirst({ where: eq(creditNote.id, note.id) }) : await db.query.debitNote.findFirst({ where: eq(debitNote.id, note.id) });
      const entriesBefore = (await db.select().from(journalEntry)).length;
      assert.equal((await del(first.id)).status, 200);
      const restored = kind === 'invoice' ? await db.query.creditNote.findFirst({ where: eq(creditNote.id, note.id) }) : await db.query.debitNote.findFirst({ where: eq(debitNote.id, note.id) });
      assert.equal(restored!.amountApplied, 400); assert.equal(restored!.amountRemaining, 400); assert.equal(restored!.status, 'sent');
      assert.equal(restored!.journalEntryId, savedNote!.journalEntryId); assert.equal((await db.select().from(journalEntry)).length, entriesBefore);
      await apply(); if (kind === 'invoice') await voidCreditNote(ctx, note.id); else await voidDebitNote(ctx, note.id);
      const unpaid = kind === 'invoice' ? await db.query.invoice.findFirst({ where: eq(invoice.id, doc.id) }) : await db.query.bill.findFirst({ where: eq(bill.id, doc.id) }); assert.equal(unpaid!.amountPaid, 0);
      assert.ok((await db.query.payment.findFirst({ where: eq(payment.id, first.id) }))!.deletedAt);
    }
    const prepaidDoc = await recognized('invoice', 1000);
    const credit = (await createCustomerCredit(ctx, { contactId: party.id, amountMinor: '1000', date: '2026-10-01', currencyCode: 'USD', depositAccountId: cash.id, sourceType: 'prepayment' })).customerCredit;
    await applyCredit(ctx, credit.id, { invoiceId: prepaidDoc.id, amountMinor: '1000', date: '2026-10-04' }, true);
    const prepay = await latestCarrier('prepayment', credit.id), preSaved = await db.select().from(journalLine).where(eq(journalLine.journalEntryId, prepay.journalEntryId!));
    assert.equal((await ma.call('delete_payment', { paymentId: prepay.id })).isError, false); await checkReversal({ ...prepay, journalEntryId: prepay.journalEntryId! }, preSaved);
    const reopened = await db.query.customerCredit.findFirst({ where: eq(customerCredit.id, credit.id) }); assert.equal(reopened!.amountRemaining, 1000); assert.equal(reopened!.status, 'open');
    assert.equal((await db.query.journalEntry.findFirst({ where: eq(journalEntry.id, credit.journalEntryId!) }))!.reversedByEntryId, null);

    // Qualified legacy entries without sourceId still use their saved reference.
    const legacy = await cashPayment('bill');
    await db.update(journalEntry).set({ sourceId: null }).where(eq(journalEntry.id, legacy.p.journalEntryId));
    assert.equal((await del(legacy.p.id)).status, 200);
    // The zero control leg of a rounded partial payment is reversed verbatim;
    // unwinding all cash permits clean resettlement without historical repair.
    await db.insert(exchangeRate).values({ organizationId: a.id, baseCurrency: 'GBP', targetCurrency: 'USD', date: '2026-10-01', rate: 500000 });
    const rounded = await recognized('invoice', 3, 'GBP'), roundPayments = [];
    for (let i = 0; i < 3; i++) roundPayments.push((await (await pay('invoice', rounded.id, { amountMinor: '1', date: '2026-10-04' })).json()).payment);
    for (const p of [roundPayments[1], roundPayments[0], roundPayments[2]]) {
      const saved = await db.select().from(journalLine).where(eq(journalLine.journalEntryId, p.journalEntryId));
      assert.equal((await del(p.id)).status, 200); await checkReversal(p, saved);
    }
    assert.equal((await pay('invoice', rounded.id, { amountMinor: '3', date: '2026-10-04' })).status, 200);

    const neg = await cashPayment('invoice');
    for (const [key, status] of [[keys.b, 404], [keys.viewer, 403], [keys.expired, 401], ['dk_unknown', 401]] as const) await denied(() => del(neg.p.id, key), status);
    await denied(() => del('bad-id'), 400); await denied(() => del(randomUUID()), 404);
    await mcpDenied('delete_payment', { paymentId: neg.p.id }, readOnly); await mcpDenied('delete_payment', { paymentId: neg.p.id }, mb);
    await mcpDenied('delete_payment', { paymentId: 'bad-id' });
    await db.insert(periodLock).values({ organizationId: a.id, lockDate: '2026-10-04' }); await denied(() => del(neg.p.id), 422); await mcpDenied('delete_payment', { paymentId: neg.p.id });
    await db.update(periodLock).set({ lockDate: '2026-10-01' }).where(eq(periodLock.organizationId, a.id)); await denied(() => del(neg.p.id), 422);
    await db.delete(periodLock).where(eq(periodLock.organizationId, a.id));
    await db.insert(fiscalYear).values({ organizationId: a.id, name: 'Closed', startDate: '2026-10-01', endDate: '2026-10-31', isClosed: true }); await denied(() => del(neg.p.id), 422);
    await db.delete(fiscalYear).where(eq(fiscalYear.organizationId, a.id));
    await db.update(payment).set({ stripePaymentIntentId: 'pi_fixture' }).where(eq(payment.id, neg.p.id)); await denied(() => del(neg.p.id), 409);
    await db.update(payment).set({ stripePaymentIntentId: null }).where(eq(payment.id, neg.p.id));
    const [statement] = await db.insert(bankTransaction).values({ bankAccountId: bank.id, date: '2026-10-04', amount: 1250, description: 'Matched', journalEntryId: neg.p.journalEntryId, status: 'reconciled' }).returning();
    await denied(() => del(neg.p.id), 409); await db.update(bankTransaction).set({ journalEntryId: null }).where(eq(bankTransaction.id, statement.id));
    await db.update(payment).set({ bankTransactionId: statement.id }).where(eq(payment.id, neg.p.id)); await denied(() => del(neg.p.id), 409); await db.update(payment).set({ bankTransactionId: null }).where(eq(payment.id, neg.p.id));
    await db.update(payment).set({ contactId: foreignParty.id }).where(eq(payment.id, neg.p.id)); await denied(() => del(neg.p.id), 422); await db.update(payment).set({ contactId: party.id }).where(eq(payment.id, neg.p.id));
    await db.update(payment).set({ bankAccountId: foreignBank.id }).where(eq(payment.id, neg.p.id)); await denied(() => del(neg.p.id), 422); await db.update(payment).set({ bankAccountId: bank.id }).where(eq(payment.id, neg.p.id));
    await db.update(paymentAllocation).set({ amount: 1300 }).where(eq(paymentAllocation.paymentId, neg.p.id)); await denied(() => del(neg.p.id), 422); await db.update(paymentAllocation).set({ amount: 1250 }).where(eq(paymentAllocation.paymentId, neg.p.id));
    const [foreignDoc] = await db.insert(invoice).values({ organizationId: b.id, contactId: foreignParty.id, invoiceNumber: 'FOREIGN', issueDate: '2026-10-01', dueDate: '2026-10-31' }).returning();
    await db.update(paymentAllocation).set({ documentId: foreignDoc.id }).where(eq(paymentAllocation.paymentId, neg.p.id)); await denied(() => del(neg.p.id), 422);
    await db.update(paymentAllocation).set({ documentId: neg.doc.id }).where(eq(paymentAllocation.paymentId, neg.p.id));
    await db.update(invoice).set({ amountPaid: 0 }).where(eq(invoice.id, neg.doc.id)); await denied(() => del(neg.p.id), 422); await db.update(invoice).set({ amountPaid: 1250 }).where(eq(invoice.id, neg.doc.id));
    await db.update(journalLine).set({ accountId: foreignAccount.id }).where(and(eq(journalLine.journalEntryId, neg.p.journalEntryId), eq(journalLine.accountId, cash.id))); await denied(() => del(neg.p.id), 422);
    await db.update(journalLine).set({ accountId: cash.id }).where(and(eq(journalLine.journalEntryId, neg.p.journalEntryId), eq(journalLine.accountId, foreignAccount.id)));
    await db.update(journalEntry).set({ sourceId: randomUUID() }).where(eq(journalEntry.id, neg.p.journalEntryId)); await denied(() => del(neg.p.id), 422); await db.update(journalEntry).set({ sourceId: neg.p.id }).where(eq(journalEntry.id, neg.p.journalEntryId));
    await db.update(journalEntry).set({ date: '2026-10-05' }).where(eq(journalEntry.id, neg.p.journalEntryId)); await denied(() => del(neg.p.id), 422); await db.update(journalEntry).set({ date: '2026-10-04' }).where(eq(journalEntry.id, neg.p.journalEntryId));
    const numbered = await db.query.journalEntry.findFirst({ where: eq(journalEntry.id, neg.p.journalEntryId) });
    await db.update(journalEntry).set({ entryNumber: 2147483647 }).where(eq(journalEntry.id, neg.p.journalEntryId)); await denied(() => del(neg.p.id), 422);
    await db.update(journalEntry).set({ entryNumber: numbered!.entryNumber }).where(eq(journalEntry.id, neg.p.journalEntryId));
    const [foreignDimension] = await db.insert(costCenter).values({ organizationId: b.id, code: 'FOREIGN', name: 'Foreign' }).returning();
    await db.update(journalLine).set({ costCenterId: foreignDimension.id }).where(eq(journalLine.journalEntryId, neg.p.journalEntryId)); await denied(() => del(neg.p.id), 422);
    await db.update(journalLine).set({ costCenterId: null }).where(eq(journalLine.journalEntryId, neg.p.journalEntryId));
    await db.transaction(async tx => {
      await tx.execute(sql`ALTER TABLE journal_line DISABLE TRIGGER journal_line_exact_sync`);
      await tx.update(journalLine).set({ rateMigrationStatus: 'review_required' }).where(eq(journalLine.journalEntryId, neg.p.journalEntryId));
      await tx.execute(sql`ALTER TABLE journal_line ENABLE TRIGGER journal_line_exact_sync`);
    });
    await denied(() => del(neg.p.id), 422);
    await db.update(journalLine).set({ rateMigrationStatus: 'exact' }).where(eq(journalLine.journalEntryId, neg.p.journalEntryId));
    await db.execute(sql`update payment set amount = 9007199254740992 where id = ${neg.p.id}`); await denied(() => del(neg.p.id), 422); await db.execute(sql`update payment set amount = 1250 where id = ${neg.p.id}`);

    // A failure at the last audit write rolls back journals, links, documents,
    // credit balances, timestamps and the soft delete.
    const rollbackDoc = await recognized('invoice', 1000);
    const rollbackNote = (await createCreditNote(ctx, { contactId: party.id, issueDate: '2026-10-01', lines: [{ description: 'Rollback note', unitPriceMinor: '1000', accountId: revenue.id }] }, 'rest')).creditNote;
    await sendCreditNote(ctx, rollbackNote.id); await applyCredit(ctx, rollbackNote.id, { invoiceId: rollbackDoc.id, amountMinor: '1000' });
    const rollbackCarrier = await latestCarrier('credit_note', rollbackNote.id);
    await db.update(paymentAllocation).set({ amount: 999 }).where(and(eq(paymentAllocation.paymentId, rollbackCarrier.id), eq(paymentAllocation.documentType, 'credit_note')));
    await denied(() => del(rollbackCarrier.id), 422);
    await db.update(paymentAllocation).set({ amount: 1000 }).where(eq(paymentAllocation.paymentId, rollbackCarrier.id));
    await db.update(creditNote).set({ amountApplied: 999, amountRemaining: 1 }).where(eq(creditNote.id, rollbackNote.id)); await denied(() => del(rollbackCarrier.id), 422);
    await db.update(creditNote).set({ amountApplied: 1000, amountRemaining: 0 }).where(eq(creditNote.id, rollbackNote.id));
    await db.execute(sql.raw("CREATE FUNCTION reject_reversal_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.entity_type = 'payment' AND NEW.action = 'delete' THEN RAISE EXCEPTION 'fixture audit failure'; END IF; RETURN NEW; END $$"));
    await db.execute(sql.raw('CREATE TRIGGER reject_reversal_audit BEFORE INSERT ON audit_log FOR EACH ROW EXECUTE FUNCTION reject_reversal_audit()'));
    await denied(() => del(neg.p.id), 500); await mcpDenied('delete_payment', { paymentId: neg.p.id });
    await denied(() => del(rollbackCarrier.id), 500); await mcpDenied('delete_payment', { paymentId: rollbackCarrier.id });
    await db.execute(sql.raw('DROP TRIGGER reject_reversal_audit ON audit_log')); await db.execute(sql.raw('DROP FUNCTION reject_reversal_audit()'));
    const concurrent = await Promise.all([del(neg.p.id), del(neg.p.id)]); assert.deepEqual(concurrent.map(r => r.status).sort(), [200, 404]);
    const audits = await db.select().from(auditLog).where(and(eq(auditLog.entityId, neg.p.id), eq(auditLog.action, 'delete'))); assert.equal(audits.length, 1);
    const reversalRows = await db.select().from(journalEntry).where(eq(journalEntry.reversesEntryId, neg.p.journalEntryId)); assert.equal(reversalRows.length, 1);
    console.log('REST and MCP payment reversals verified');
  } finally { await ma.close(); await readOnly.close(); await mb.close(); }
}
run().then(() => process.exit(0), error => { console.error(error); process.exit(1); });
