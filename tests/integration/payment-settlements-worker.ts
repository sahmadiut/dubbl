// Runs only on the randomly named disposable database created by the harness.
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, customRole, contact, chartAccount, bankAccount, invoice, bill,
  payment, paymentAllocation, journalEntry, journalLine, auditLog, exchangeRate, periodLock, fiscalYear, creditNote, debitNote, taxRate } from "../../lib/db/schema";
import { POST as create } from "../../app/api/v1/payments/route";
import { POST as invoicePay } from "../../app/api/v1/invoices/[id]/pay/route";
import { POST as billPay } from "../../app/api/v1/bills/[id]/pay/route";
import { registerPaymentTools } from "../../lib/mcp/tools/payments";
import { registerInvoiceTools } from "../../lib/mcp/tools/invoices";
import { registerBillTools } from "../../lib/mcp/tools/bills";
import { createInvoice } from "../../lib/api/invoice-writes";
import { sendInvoice } from "../../lib/api/invoice-lifecycle";
import { createBill } from "../../lib/api/bill-writes";
import { receiveBill } from "../../lib/api/bill-lifecycle";
import { createCreditNote, sendCreditNote, applyCredit, createCustomerCredit } from "../../lib/api/credits";
import { createDebitNote, sendDebitNote, applyDebitNote } from "../../lib/api/debit-notes";
import type { AuthContext } from "../../lib/api/auth-context";

async function mcp(ctx: AuthContext) {
  const server = new McpServer({ name: "Settlement fixture", version: "1.0.0" });
  registerPaymentTools(server, ctx); registerInvoiceTools(server, ctx); registerBillTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1.0.0" });
  const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
  for (const name of ["create_payment", "pay_invoice", "pay_bill"]) {
    const tool = (await client.listTools()).tools.find(t => t.name === name)!;
    assert.ok(tool.description!.includes("amountMinor")); assert.ok(JSON.stringify(tool.inputSchema).includes("idempotencyKey"));
  }
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
  const [party, party2, foreignParty] = await db.insert(contact).values([{ organizationId: a.id, name: "Own both", type: "both", creditLimit: 100000 },
    { organizationId: a.id, name: "Other contact", type: "both" }, { organizationId: b.id, name: "Foreign", type: "both" }]).returning();
  const [ar, ap, cash, revenue, expense, foreignAccount] = await db.insert(chartAccount).values([
    { organizationId: a.id, code: "1200", name: "AR", type: "asset" }, { organizationId: a.id, code: "2100", name: "AP", type: "liability" },
    { organizationId: a.id, code: "1100", name: "Cash", type: "asset" }, { organizationId: a.id, code: "4000", name: "Sales", type: "revenue" },
    { organizationId: a.id, code: "5000", name: "Expense", type: "expense" }, { organizationId: b.id, code: "1100", name: "Foreign cash", type: "asset" },
  ]).returning();
  const [bank, otherBank, foreignBank] = await db.insert(bankAccount).values([{ organizationId: a.id, accountName: "Cash USD", chartAccountId: cash.id },
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
  const tables = ["invoice", "bill", "payment", "payment_allocation", "journal_entry", "journal_line", "bank_account", "chart_account", "number_sequence"];
  const snapshot = async () => {
    const rows = await Promise.all(tables.map(table => db.execute(sql.raw(`select coalesce(jsonb_agg(to_jsonb(t)::text order by t.id),'[]'::jsonb) as rows from ${table} t`)).then(r => r.rows)));
    return [...rows, (await db.execute(sql`select coalesce(jsonb_agg(to_jsonb(t)::text order by t.id),'[]'::jsonb) as rows from audit_log t where entity_type <> 'api_key'`)).rows];
  };
  async function denied(fn: () => Promise<Response>, status: number) { const before = await snapshot(); const response = await fn();
    assert.equal(response.status, status, JSON.stringify(await response.clone().json())); assert.deepEqual(await snapshot(), before); }
  async function mcpDenied(name: string, args: Record<string, unknown>, client = ma) { const before = await snapshot();
    assert.equal((await client.call(name, args)).isError, true); assert.deepEqual(await snapshot(), before); }
  const assertJournal = async (id: string, controlId: string, carrying: number, bankId: string, cashAmount: number, received: boolean) => {
    const lines = await db.select().from(journalLine).where(eq(journalLine.journalEntryId, id));
    const debit = lines.reduce((s, l) => s + BigInt(l.debitAmount), 0n), credit = lines.reduce((s, l) => s + BigInt(l.creditAmount), 0n);
    assert.equal(debit, credit); const cashLine = lines.find(l => l.accountId === bankId)!;
    assert.equal(received ? cashLine.debitAmount : cashLine.creditAmount, cashAmount);
    assert.equal(lines.filter(l => l.accountId === controlId).reduce((s, l) => s + (received ? l.creditAmount : l.debitAmount), 0), carrying);
  };
  try {
    const initialA = await recognized("bill", 10), initialB = await recognized("bill", 10);
    const initialReplies = await Promise.all([pay("bill", initialA.id, { amount: 10, date: "2026-10-04" }), pay("bill", initialB.id, { amount: 10, date: "2026-10-04" })]);
    assert.deepEqual(initialReplies.map(r => r.status), [200, 200]);
    const initialResults = await Promise.all(initialReplies.map(r => r.json())); assert.notEqual(initialResults[0].payment.paymentNumber, initialResults[1].payment.paymentNumber);
    const first = await recognized("invoice");
    const result = await pay("invoice", first.id, { amountMinor: "500", date: "2026-10-04", bankAccountId: bank.id }, keys.a, "first");
    assert.equal(result.status, 200); const dto = await result.json(); assert.equal(dto.invoice.amountPaidMinor, "500"); assert.equal(dto.invoice.amountDue, 750);
    assert.equal(dto.payment.amount, 500); assert.equal(dto.payment.amountMinor, "500");
    await assertJournal(dto.payment.journalEntryId, ar.id, 500, cash.id, 500, true);
    const snap = await snapshot();
    assert.deepEqual(await (await pay("invoice", first.id, { amount: 500, amountMinor: "500", date: "2026-10-04", bankAccountId: bank.id }, keys.a, "first")).json(), dto);
    assert.deepEqual(await snapshot(), snap);
    const retryMcp = await ma.call("pay_invoice", { invoiceId: first.id, amount: 500, date: "2026-10-04", bankAccountId: bank.id, idempotencyKey: "first" });
    assert.equal(retryMcp.isError, false); assert.deepEqual(retryMcp.body, dto); assert.deepEqual(await snapshot(), snap);
    await mcpDenied("pay_invoice", { invoiceId: first.id, amount: 500, date: "2026-10-04", bankAccountId: bank.id, idempotencyKey: "first" }, mb);
    await mcpDenied("pay_invoice", { invoiceId: first.id, amount: 500, date: "2026-10-04", bankAccountId: bank.id, idempotencyKey: "first" }, readOnly);
    await denied(() => pay("invoice", first.id, { amount: 501, date: "2026-10-04", bankAccountId: bank.id }, keys.a, "first"), 409);
    const final = await ma.call("pay_invoice", { invoiceId: first.id, amountMinor: "750", date: "2026-10-04" }); assert.equal(final.isError, false, JSON.stringify(final.body));
    assert.equal(final.body.invoice.status, "paid"); assert.equal(final.body.invoice.amountDueMinor, "0"); assert.ok(final.body.invoice.paidAt);
    const bl = await recognized("bill"); const billResult = await ma.call("pay_bill", { billId: bl.id, amount: 1250, date: "2026-10-04", bankAccountId: bank.id });
    assert.equal(billResult.isError, false, JSON.stringify(billResult.body)); assert.equal(billResult.body.bill.amountDueMinor, "0");
    await assertJournal(billResult.body.payment.journalEntryId, ap.id, 1250, cash.id, 1250, false);
    // A custom payment-only role may settle; invoice/bill management alone is not payment authorization.
    const payOnlyDoc = await recognized("invoice"); assert.equal((await pay("invoice", payOnlyDoc.id, { amount: 1250, date: "2026-10-04" }, keys.payOnly)).status, 200);
    const own = await recognized("invoice"), second = await recognized("invoice"), foreignContactDoc = await recognized("invoice", 1250, "USD", party2.id);
    const body = { contactId: party.id, type: "received", date: "2026-10-04", amountMinor: "2500", allocations: [
      { documentType: "invoice", documentId: own.id, amountMinor: "1250" }, { documentType: "invoice", documentId: second.id, amount: 1250 }] };
    const standalone = await post(body, keys.a, "multi"); assert.equal(standalone.status, 201, JSON.stringify(await standalone.clone().json())); const multi = await standalone.json();
    assert.equal(multi.payment.currencyCode, "USD"); assert.equal(multi.payment.amountMinor, "2500"); assert.equal(multi.payment.allocations.length, 2);
    assert.ok(multi.payment.allocations.every((alloc: { amountMinor: string }) => alloc.amountMinor === "1250"));
    await assertJournal(multi.payment.journalEntryId, ar.id, 2500, cash.id, 2500, true);
    const multiBefore = await snapshot(); const multiReplay = await ma.call("create_payment", { ...body, allocations: [...body.allocations].reverse(), amount: 2500, idempotencyKey: "multi" });
    assert.equal(multiReplay.isError, false); assert.deepEqual(multiReplay.body, multi); assert.deepEqual(await snapshot(), multiBefore);
    const made1 = await recognized("bill"), made2 = await recognized("bill");
    const made = await ma.call("create_payment", { ...body, type: "made", amount: 2500, amountMinor: undefined,
      allocations: [made1, made2].map(doc => ({ documentType: "bill", documentId: doc.id, amount: 1250 })) });
    assert.equal(made.isError, false, JSON.stringify(made.body)); await assertJournal(made.body.payment.journalEntryId, ap.id, 2500, cash.id, 2500, false);
    const outstanding = await recognized("invoice");
    const basePay = { amount: 500, date: "2026-10-04" };
    for (const patch of [{ amountMinor: "501" }, { amount: 1.5 }, { amount: 0 }, { amountMinor: "01", amount: undefined }, { date: "2026-02-30" },
      { date: "2026-09-30" }, { bankAccountId: foreignBank.id }, { bankAccountId: otherBank.id }, { unexpected: 1 }]) {
      await denied(() => pay("invoice", outstanding.id, { ...basePay, ...patch }), 400);
      if (!("unexpected" in patch)) await mcpDenied("pay_invoice", { invoiceId: outstanding.id, ...basePay, ...patch });
    }
    for (const amountMinor of ["9007199254740992", "9223372036854775807"]) {
      await denied(() => pay("invoice", outstanding.id, { amountMinor, date: "2026-10-04" }), 422);
      await mcpDenied("pay_invoice", { invoiceId: outstanding.id, amountMinor, date: "2026-10-04" });
    }
    await denied(() => pay("invoice", outstanding.id, basePay, "dk_invalid"), 401);
    await denied(() => pay("invoice", outstanding.id, basePay, keys.expired), 401);
    await denied(() => pay("invoice", outstanding.id, basePay, keys.viewer), 403);
    await denied(() => pay("invoice", outstanding.id, basePay, keys.b), 404);
    await denied(() => pay("invoice", randomUUID(), basePay), 404);
    await mcpDenied("pay_invoice", { invoiceId: outstanding.id, ...basePay }, readOnly);
    await mcpDenied("pay_invoice", { invoiceId: outstanding.id, ...basePay }, mb);
    for (const patch of [{ amount: 2501, amountMinor: undefined }, { contactId: foreignParty.id }, { currencyCode: "EUR" },
      { allocations: [{ documentType: "invoice", documentId: foreignContactDoc.id, amount: 2500 }] },
      { allocations: [{ documentType: "bill", documentId: outstanding.id, amount: 2500 }] },
      { allocations: [{ documentType: "invoice", documentId: outstanding.id, amount: 1250 }, { documentType: "invoice", documentId: outstanding.id, amount: 1250 }] }]) {
      await denied(() => post({ ...body, ...patch }), 400); await mcpDenied("create_payment", { ...body, ...patch });
    }
    await denied(() => pay("invoice", outstanding.id, { ...basePay, idempotencyKey: "body" }, keys.a, "header"), 400);
    await denied(() => create(new Request("http://fixture.test", { method: "POST", headers: { authorization: `Bearer ${keys.a}` }, body: "{" })), 400);
    // Deletion/status/recognition guards on both transports.
    for (const status of ["draft", "void", "pending_approval", "paid"] as const) {
      await db.update(invoice).set({ status }).where(eq(invoice.id, outstanding.id));
      await denied(() => pay("invoice", outstanding.id, basePay), 400); await mcpDenied("pay_invoice", { invoiceId: outstanding.id, ...basePay });
    }
    await db.update(invoice).set({ status: "sent", deletedAt: new Date() }).where(eq(invoice.id, outstanding.id)); await denied(() => pay("invoice", outstanding.id, basePay), 404);
    await db.update(invoice).set({ deletedAt: null, journalEntryId: null }).where(eq(invoice.id, outstanding.id)); await denied(() => pay("invoice", outstanding.id, basePay), 400);
    await db.update(invoice).set({ journalEntryId: outstanding.journalEntryId }).where(eq(invoice.id, outstanding.id));
    // Locked dates and closed years reject without money, sequence, link or audit changes.
    const [lock] = await db.insert(periodLock).values({ organizationId: a.id, lockDate: "2026-10-04" }).returning();
    await denied(() => pay("invoice", outstanding.id, basePay), 422); await mcpDenied("pay_invoice", { invoiceId: outstanding.id, ...basePay });
    await db.delete(periodLock).where(eq(periodLock.id, lock.id));
    const [year] = await db.insert(fiscalYear).values({ organizationId: a.id, name: "Closed", startDate: "2026-10-04", endDate: "2026-10-05", isClosed: true }).returning();
    await denied(() => pay("invoice", outstanding.id, basePay), 422); await db.delete(fiscalYear).where(eq(fiscalYear.id, year.id));
    // Foreign scalar and unsafe saved amounts fail before mutation.
    const [foreignJournal] = await db.insert(journalEntry).values({ organizationId: b.id, entryNumber: 1, date: "2026-10-01", description: "Foreign", status: "posted" }).returning();
    await db.update(invoice).set({ journalEntryId: foreignJournal.id }).where(eq(invoice.id, outstanding.id)); await denied(() => pay("invoice", outstanding.id, basePay), 422);
    await db.update(invoice).set({ journalEntryId: outstanding.journalEntryId }).where(eq(invoice.id, outstanding.id));
    await db.execute(sql`update invoice set amount_due=9007199254740992 where id=${outstanding.id}`); await denied(() => pay("invoice", outstanding.id, basePay), 422);
    await mcpDenied("pay_invoice", { invoiceId: outstanding.id, ...basePay }); await db.update(invoice).set({ amountDue: 1250 }).where(eq(invoice.id, outstanding.id));
    await db.execute(sql`update contact set credit_limit=9007199254740992 where id=${party.id}`); await denied(() => pay("invoice", outstanding.id, basePay), 422);
    await db.update(contact).set({ creditLimit: 100000 }).where(eq(contact.id, party.id));
    // Actual audit failures roll back every settlement write and sequence.
    await db.execute(sql.raw("create function fail_settlement_audit() returns trigger language plpgsql as $$ begin if NEW.entity_type='payment' and NEW.action='settle' then raise exception 'fixture audit failure'; end if; return NEW; end $$"));
    await db.execute(sql.raw("create trigger fixture_settlement_audit before insert on audit_log for each row execute function fail_settlement_audit()"));
    await denied(() => pay("invoice", outstanding.id, basePay), 500); await mcpDenied("pay_invoice", { invoiceId: outstanding.id, ...basePay });
    await db.execute(sql.raw("drop trigger fixture_settlement_audit on audit_log; drop function fail_settlement_audit()"));
    await db.update(contact).set({ creditLimit: null }).where(eq(contact.id, party.id));
    // FX uses saved recognition, ignoring later edits to recognition-date rates.
    await db.insert(exchangeRate).values([{ organizationId: a.id, baseCurrency: "EUR", targetCurrency: "USD", date: "2026-10-01", rate: 2000000, source: "manual" },
      { organizationId: a.id, baseCurrency: "EUR", targetCurrency: "USD", date: "2026-10-04", rate: 3000000, source: "manual" }]);
    const fxDoc = await recognized("invoice", 1250, "EUR");
    await db.update(exchangeRate).set({ rate: 4000000 }).where(and(eq(exchangeRate.baseCurrency, "EUR"), eq(exchangeRate.date, "2026-10-01")));
    const fxPaid = await pay("invoice", fxDoc.id, { amount: 1250, date: "2026-10-04", bankAccountId: otherBank.id }); assert.equal(fxPaid.status, 200, JSON.stringify(await fxPaid.clone().json()));
    const fxDto = await fxPaid.json(); assert.equal(fxDto.payment.currencyCode, "EUR");
    const linkedBank = (await db.query.bankAccount.findFirst({ where: eq(bankAccount.id, otherBank.id) }))!; assert.ok(linkedBank.chartAccountId);
    await assertJournal(fxDto.payment.journalEntryId, ar.id, 2500, linkedBank.chartAccountId!, 3750, true);
    const fxAudit = (await db.query.auditLog.findFirst({ where: and(eq(auditLog.entityId, fxDto.payment.id), eq(auditLog.action, "settle")) }))!;
    assert.equal((fxAudit.changes as { rateExact: string }).rateExact, "3");
    const fxBill = await recognized("bill", 1250, "EUR"); const fxBillPaid = await pay("bill", fxBill.id, { amountMinor: "1250", date: "2026-10-04", bankAccountId: otherBank.id });
    assert.equal(fxBillPaid.status, 200); const fxBillDto = await fxBillPaid.json(); await assertJournal(fxBillDto.payment.journalEntryId, ap.id, 5000, linkedBank.chartAccountId!, 3750, false);
    for (const [kind, currencyCode, recognitionRate, cashRate] of [["invoice", "CAD", 2000000, 1000000], ["bill", "AUD", 1000000, 2000000]] as const) {
      await db.insert(exchangeRate).values([{ organizationId: a.id, baseCurrency: currencyCode, targetCurrency: "USD", date: "2026-10-01", rate: recognitionRate, source: "manual" },
        { organizationId: a.id, baseCurrency: currencyCode, targetCurrency: "USD", date: "2026-10-04", rate: cashRate, source: "manual" }]);
      const foreign = await recognized(kind, 1250, currencyCode);
      const paid = await pay(kind, foreign.id, { amount: 1250, date: "2026-10-04" }); assert.equal(paid.status, 200);
      const data = await paid.json(); await assertJournal(data.payment.journalEntryId, kind === "invoice" ? ar.id : ap.id,
        1250 * recognitionRate / 1000000, cash.id, 1250 * cashRate / 1000000, kind === "invoice");
      const legs = await db.select({ debit: journalLine.debitAmount }).from(journalLine).innerJoin(chartAccount, eq(chartAccount.id, journalLine.accountId))
        .where(and(eq(journalLine.journalEntryId, data.payment.journalEntryId), eq(chartAccount.code, "5930")));
      assert.equal(legs[0].debit, 1250);
    }
    await db.insert(exchangeRate).values({ organizationId: a.id, baseCurrency: "GBP", targetCurrency: "USD", date: "2026-10-01", rate: 500000, source: "manual" });
    const rounded = await recognized("invoice", 3, "GBP");
    for (const carrying of [1, 0, 1]) {
      const paid = await pay("invoice", rounded.id, { amount: 1, date: "2026-10-04" }); assert.equal(paid.status, 200, JSON.stringify(await paid.clone().json()));
      await assertJournal((await paid.json()).payment.journalEntryId, ar.id, carrying, cash.id, 1, true);
    }
    // Missing/incompatible settlement rates reject rather than fabricate 1:1 or recognition-date rates.
    const missing = await recognized("invoice", 1250, "EUR"); await db.delete(exchangeRate).where(eq(exchangeRate.baseCurrency, "EUR"));
    await denied(() => pay("invoice", missing.id, basePay), 422); await mcpDenied("pay_invoice", { invoiceId: missing.id, ...basePay });
    // Currency scales remain independent, using synthetic fixture quotes only.
    for (const [currencyCode, rate, expected] of [["IRR", 10000, 1250], ["JPY", 10000, 1250], ["KWD", 2000000, 250]] as const) {
      await db.insert(exchangeRate).values({ organizationId: a.id, baseCurrency: currencyCode, targetCurrency: "USD", date: "2026-10-01", rate, source: "manual" });
      const doc = await recognized("invoice", 1250, currencyCode); const paid = await pay("invoice", doc.id, { amountMinor: "1250", date: "2026-10-04" });
      assert.equal(paid.status, 200, JSON.stringify(await paid.clone().json())); const data = await paid.json(); assert.equal(data.payment.amount, 1250);
      await assertJournal(data.payment.journalEntryId, ar.id, expected, cash.id, expected, true);
    }
    // Bill reverse-charge payable excludes output VAT while document total remains tax-inclusive.
    const [reverseTax] = await db.insert(taxRate).values({ organizationId: a.id, name: "Reverse", rate: 2000, kind: "reverse_charge", recoverablePercent: 10000 }).returning();
    const reverse = await recognized("bill", 1000, "USD", party.id, { lines: [{ description: "Reverse", unitPriceMinor: "1000", accountId: expense.id, taxRateId: reverseTax.id }] });
    assert.equal(reverse.total, 1200); assert.equal(reverse.amountDue, 1000);
    const reversePaid = await pay("bill", reverse.id, { amount: 1000, date: "2026-10-04" }); assert.equal(reversePaid.status, 200);
    assert.equal((await reversePaid.json()).bill.amountDue, 0);
    // Split/clearing-only AP recognition fixtures mirror the existing bill GRNI
    // writer; settlement must release the combined payable, never just its tax.
    for (const mainValue of [250, 0]) {
      const grniBill = await recognized("bill");
      assert.ok("billNumber" in grniBill);
      const originalLines = await db.select().from(journalLine).where(eq(journalLine.journalEntryId, grniBill.journalEntryId!));
      await db.update(journalLine).set({ creditAmount: mainValue }).where(and(eq(journalLine.journalEntryId, grniBill.journalEntryId!), eq(journalLine.accountId, ap.id)));
      await db.update(journalLine).set({ debitAmount: mainValue }).where(and(eq(journalLine.journalEntryId, grniBill.journalEntryId!), eq(journalLine.accountId, expense.id)));
      const [max] = await db.select({ value: sql<number>`max(${journalEntry.entryNumber})` }).from(journalEntry).where(eq(journalEntry.organizationId, a.id));
      const [clearing] = await db.insert(journalEntry).values({ organizationId: a.id, entryNumber: max.value + 1, date: "2026-10-01",
        description: "Fixture GRNI", sourceType: "bill_grni", sourceId: grniBill.id, reference: grniBill.billNumber, status: "posted" }).returning();
      await db.insert(journalLine).values(originalLines.map(({ id: discardedId, journalEntryId: discardedEntry, ...line }) => {
        void discardedId; void discardedEntry;
        return { ...line, journalEntryId: clearing.id, debitAmount: line.debitAmount ? 1250 - mainValue : 0, creditAmount: line.creditAmount ? 1250 - mainValue : 0 };
      }));
      if (!mainValue) {
        await db.update(bill).set({ journalEntryId: clearing.id }).where(eq(bill.id, grniBill.id));
        await db.delete(journalEntry).where(eq(journalEntry.id, grniBill.journalEntryId!));
      }
      const paid = await pay("bill", grniBill.id, { amount: 1250, date: "2026-10-04" }); assert.equal(paid.status, 200, JSON.stringify(await paid.clone().json()));
      await assertJournal((await paid.json()).payment.journalEntryId, ap.id, 1250, cash.id, 1250, false);
    }
    // Existing noncash note carriers remain separate from new cash.
    const creditDoc = await recognized("invoice");
    const cn = await createCreditNote(ctx, { contactId: party.id, issueDate: "2026-10-01", currencyCode: "USD",
      lines: [{ description: "Credit", unitPriceMinor: "250", accountId: revenue.id }] }, "rest");
    await sendCreditNote(ctx, cn.creditNote.id); await applyCredit(ctx, cn.creditNote.id, { invoiceId: creditDoc.id, amount: 250 });
    const credited = await pay("invoice", creditDoc.id, { amountMinor: "1000", date: "2026-10-04" }); assert.equal(credited.status, 200, JSON.stringify(await credited.clone().json()));
    await assertJournal((await credited.json()).payment.journalEntryId, ar.id, 1000, cash.id, 1000, true);
    const debitDoc = await recognized("bill"); const dn = await createDebitNote(ctx, { contactId: party.id, issueDate: "2026-10-01", currencyCode: "USD",
      lines: [{ description: "Debit", unitPriceMinor: "250", accountId: expense.id }] }, "rest");
    await sendDebitNote(ctx, dn.debitNote.id); await applyDebitNote(ctx, dn.debitNote.id, { billId: debitDoc.id, amount: 250 });
    const debited = await pay("bill", debitDoc.id, { amount: 1000, date: "2026-10-04" }); assert.equal(debited.status, 200, JSON.stringify(await debited.clone().json()));
    await assertJournal((await debited.json()).payment.journalEntryId, ap.id, 1000, cash.id, 1000, false);
    const prepaidDoc = await recognized("invoice");
    const prepayment = await createCustomerCredit(ctx, { contactId: party.id, date: "2026-10-01", amount: 250,
      sourceType: "prepayment", currencyCode: "USD", depositAccountId: cash.id });
    await applyCredit(ctx, prepayment.customerCredit.id, { invoiceId: prepaidDoc.id, amount: 250, date: "2026-10-01" }, true);
    const prepaid = await pay("invoice", prepaidDoc.id, { amount: 1000, date: "2026-10-04" }); assert.equal(prepaid.status, 200, JSON.stringify(await prepaid.clone().json()));
    await assertJournal((await prepaid.json()).payment.journalEntryId, ar.id, 1000, cash.id, 1000, true);
    // Safe-max inputs retain digits; preflight rejects overflowing converted output.
    for (const amount of [2147483648, Number.MAX_SAFE_INTEGER]) {
      const doc = await recognized("invoice", amount); const paid = await pay("invoice", doc.id, { amountMinor: String(amount), date: "2026-10-04" });
      assert.equal(paid.status, 200, JSON.stringify(await paid.clone().json())); assert.equal((await paid.json()).payment.amountMinor, String(amount));
    }
    await db.insert(exchangeRate).values([{ organizationId: a.id, baseCurrency: "CHF", targetCurrency: "USD", date: "2026-10-01", rate: 1000000, source: "manual" },
      { organizationId: a.id, baseCurrency: "CHF", targetCurrency: "USD", date: "2026-10-04", rate: 2000000, source: "manual" }]);
    const overflow = await recognized("invoice", Number.MAX_SAFE_INTEGER, "CHF");
    await denied(() => pay("invoice", overflow.id, { amountMinor: String(Number.MAX_SAFE_INTEGER), date: "2026-10-04" }), 422);
    await mcpDenied("pay_invoice", { invoiceId: overflow.id, amountMinor: String(Number.MAX_SAFE_INTEGER), date: "2026-10-04" });
    // Old balance-only annotations cannot be treated as qualified settlement history.
    const annotated = await recognized("invoice"); await db.update(invoice).set({ amountPaid: 250, amountDue: 1000, status: "partial" }).where(eq(invoice.id, annotated.id));
    await denied(() => pay("invoice", annotated.id, { amount: 1000, date: "2026-10-04" }), 422);
    const altered = await recognized("invoice"); await db.update(invoice).set({ total: 1500, amountDue: 1500 }).where(eq(invoice.id, altered.id));
    await denied(() => pay("invoice", altered.id, { amount: 1500, date: "2026-10-04" }), 422);
    await db.update(bankAccount).set({ isActive: false }).where(eq(bankAccount.id, bank.id));
    await denied(() => pay("invoice", outstanding.id, { ...basePay, bankAccountId: bank.id }), 400);
    await db.update(bankAccount).set({ isActive: true }).where(eq(bankAccount.id, bank.id));
    // Two different requests cannot over-settle; a repeated key produces one result/payment/audit.
    const concurrent = await recognized("invoice", 1000);
    const replies = await Promise.all([pay("invoice", concurrent.id, { amount: 700, date: "2026-10-04" }), pay("invoice", concurrent.id, { amountMinor: "700", date: "2026-10-04" })]);
    assert.deepEqual(replies.map(r => r.status).sort(), [200, 400]);
    assert.equal((await db.query.invoice.findFirst({ where: eq(invoice.id, concurrent.id) }))!.amountPaid, 700);
    const repeated = await recognized("bill", 1000), repeatBody = { amountMinor: "1000", date: "2026-10-04" };
    const repeats = await Promise.all([pay("bill", repeated.id, repeatBody, keys.a, "parallel"), pay("bill", repeated.id, repeatBody, keys.a, "parallel")]);
    assert.deepEqual(repeats.map(r => r.status), [200, 200]); assert.deepEqual(await repeats[0].json(), await repeats[1].json());
    const allocs = await db.select().from(paymentAllocation).where(and(eq(paymentAllocation.documentId, repeated.id), eq(paymentAllocation.documentType, "bill"))); assert.equal(allocs.length, 1);
    assert.equal((await db.select().from(auditLog).where(and(eq(auditLog.entityId, allocs[0].paymentId), eq(auditLog.action, "settle")))).length, 1);
    // Foreign retained account links and changed recognition reject rather than cross-post.
    const badBankDoc = await recognized("invoice"); await db.update(bankAccount).set({ chartAccountId: foreignAccount.id }).where(eq(bankAccount.id, bank.id));
    await denied(() => pay("invoice", badBankDoc.id, { ...basePay, bankAccountId: bank.id }), 422); await db.update(bankAccount).set({ chartAccountId: cash.id }).where(eq(bankAccount.id, bank.id));
    await db.update(journalEntry).set({ reversedByEntryId: randomUUID() }).where(eq(journalEntry.id, badBankDoc.journalEntryId!)); await denied(() => pay("invoice", badBankDoc.id, basePay), 422);
    // Sanity: all generated monetary aliases correspond to stored currency, no noncash double-count.
    assert.equal((await db.query.creditNote.findFirst({ where: eq(creditNote.id, cn.creditNote.id) }))!.amountApplied, 250);
    assert.equal((await db.query.debitNote.findFirst({ where: eq(debitNote.id, dn.debitNote.id) }))!.amountApplied, 250);
    assert.ok((await db.select().from(payment)).length > 20);
    console.log("REST and MCP payment settlements verified: aliases, auth/scope, saved carrying/FX, banks, locks, rollback, retries and concurrency");
  } finally { await ma.close(); await readOnly.close(); await mb.close(); }
}
run().catch(err => { console.error(err); process.exitCode = 1; }).finally(async () => {
  await (db.$client as { end(): Promise<void> }).end();
});
