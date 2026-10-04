import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, customRole, contact, chartAccount, bankAccount, bankTransaction, invoice, bill,
  payment, paymentAllocation, journalEntry, journalLine, exchangeRate, periodLock, fiscalYear, taxRate } from "../../lib/db/schema";
import { POST as match } from "../../app/api/v1/bank-transactions/[id]/match/route";
import { POST as matchInvoice, GET as invoiceMatches } from "../../app/api/v1/bank-transactions/[id]/match-invoice/route";
import { POST as split } from "../../app/api/v1/bank-transactions/[id]/split/route";
import { registerBankDocumentMatchTools } from "../../lib/mcp/tools/bank-document-matches";
import { registerBankTransactionTools } from "../../lib/mcp/tools/bank-transactions";
import { createInvoice } from "../../lib/api/invoice-writes";
import { sendInvoice } from "../../lib/api/invoice-lifecycle";
import { createBill } from "../../lib/api/bill-writes";
import { receiveBill } from "../../lib/api/bill-lifecycle";
import { createSettlementPayment, payDocument } from "../../lib/api/payment-settlements";
import { createCreditNote, sendCreditNote, applyCredit, createCustomerCredit } from "../../lib/api/credits";
import { createDebitNote, sendDebitNote, applyDebitNote } from "../../lib/api/debit-notes";
import type { AuthContext } from "../../lib/api/auth-context";

async function mcp(ctx: AuthContext) {
  const server = new McpServer({ name: "Bank document fixture", version: "1" });
  registerBankDocumentMatchTools(server, ctx); registerBankTransactionTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1" }), [ct, st] = InMemoryTransport.createLinkedPair();
  await server.connect(st); await client.connect(ct);
  const tools = (await client.listTools()).tools, names = tools.map(t => t.name); assert.equal(names.length, new Set(names).size);
  for (const name of ["match_to_invoice", "match_to_bill", "match_to_existing_payment", "match_to_existing_journal", "split_to_documents", "get_bank_invoice_matches"]) {
    const tool = tools.find(t => t.name === name)!; assert.ok(tool); assert.equal(tool.inputSchema.additionalProperties, false);
    for (const field of Object.values(tool.inputSchema.properties ?? {})) assert.ok((field as { description?: string }).description);
  }
  return { async call(name: string, args: Record<string, unknown>) {
    const result = await client.callTool({ name, arguments: args }), text = (result.content as { text: string }[])[0].text;
    return { isError: result.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
  }, async close() { await client.close(); await server.close(); } };
}
async function run() {
  const [a, b] = await db.insert(organization).values([{ name: "Match A", slug: "match-a" }, { name: "Match B", slug: "match-b" }]).returning();
  const [owner, banker, viewer] = await db.insert(users).values([{ email: "match-owner@example.test" }, { email: "match-banker@example.test" }, { email: "match-viewer@example.test" }]).returning();
  const [bankRole, viewRole] = await db.insert(customRole).values([{ organizationId: a.id, name: "Bank only", permissions: ["manage:banking"] }, { organizationId: a.id, name: "View", permissions: [] }]).returning();
  await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner" }, { organizationId: b.id, userId: owner.id, role: "owner" },
    { organizationId: a.id, userId: banker.id, customRoleId: bankRole.id }, { organizationId: a.id, userId: viewer.id, customRoleId: viewRole.id }]);
  const keys = { a: "dk_match_a", b: "dk_match_b", banker: "dk_match_banker", viewer: "dk_match_viewer", expired: "dk_match_expired" };
  for (const [label, key] of Object.entries(keys)) await db.insert(apiKey).values({ organizationId: label === "b" ? b.id : a.id,
    createdBy: label === "banker" ? banker.id : label === "viewer" ? viewer.id : owner.id, name: label, keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_match",
    expiresAt: label === "expired" ? new Date("2020-01-01") : null });
  const ctx: AuthContext = { userId: owner.id, organizationId: a.id, role: "owner" };
  const ma = await mcp(ctx), mb = await mcp({ ...ctx, organizationId: b.id }), ro = await mcp({ ...ctx, role: "member", permissions: [] });
  const mk = await mcp({ ...ctx, userId: banker.id, role: "member", permissions: ["manage:banking"] });
  const req = (body: unknown = {}, key = keys.a) => new Request("http://fixture.test/api/v1/bank-transactions", { method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-organization-id": b.id }, body: JSON.stringify(body) });
  const params = (id: string) => ({ params: Promise.resolve({ id }) });
  const data = async (response: Response, status = 200) => { const body = await response.json(); assert.equal(response.status, status, JSON.stringify(body)); return body; };
  const tables = ["bank_account", "bank_transaction", "chart_account", "invoice", "bill", "payment", "payment_allocation", "journal_entry", "journal_line", "number_sequence"];
  const snapshot = async () => [...await Promise.all(tables.map(t => db.execute(sql.raw(`select coalesce(jsonb_agg(to_jsonb(t)::text order by t.id),'[]'::jsonb) as rows from ${t} t`)).then(r => r.rows))),
    (await db.execute(sql`select coalesce(jsonb_agg(to_jsonb(t)::text order by t.id),'[]'::jsonb) as rows from audit_log t where entity_type <> 'api_key'`)).rows];
  const denied = async (fn: () => Promise<Response>, status: number) => { const before = await snapshot(); await data(await fn(), status); assert.deepEqual(await snapshot(), before); };
  const mcpDenied = async (name: string, args: Record<string, unknown>, client = ma) => { const before = await snapshot(); assert.equal((await client.call(name, args)).isError, true); assert.deepEqual(await snapshot(), before); };
  const [party, party2, foreignParty] = await db.insert(contact).values([{ organizationId: a.id, name: "Party", type: "both" }, { organizationId: a.id, name: "Other", type: "both" }, { organizationId: b.id, name: "Foreign", type: "both" }]).returning();
  const [ar, ap, cash, revenue, expense, foreignGl] = await db.insert(chartAccount).values([
    { organizationId: a.id, code: "1200", name: "AR", type: "asset" }, { organizationId: a.id, code: "2100", name: "AP", type: "liability" },
    { organizationId: a.id, code: "1100", name: "Cash", type: "asset" }, { organizationId: a.id, code: "4000", name: "Revenue", type: "revenue" },
    { organizationId: a.id, code: "5000", name: "Expense", type: "expense" }, { organizationId: b.id, code: "1100", name: "Foreign", type: "asset" }]).returning();
  const [bank, foreignBank, otherBank] = await db.insert(bankAccount).values([{ organizationId: a.id, accountName: "USD", chartAccountId: cash.id },
    { organizationId: b.id, accountName: "Foreign", chartAccountId: foreignGl.id }, { organizationId: a.id, accountName: "Other" }]).returning();
  const movement = async (amount = 1250, parent = bank.id, extra = {}) => (await db.insert(bankTransaction).values({ bankAccountId: parent, amount, date: "2026-10-04", description: "Fixture", ...extra }).returning())[0];
  async function recognized(kind: "invoice" | "bill", amount = 1250, currencyCode = "USD", contactId = party.id, extra = {}) {
    const input = { contactId, issueDate: "2026-10-01", dueDate: "2026-10-31", currencyCode, lines: [{ description: "Fixture", unitPriceMinor: String(amount), accountId: kind === "invoice" ? revenue.id : expense.id, ...extra }] };
    if (kind === "invoice") { const row = await createInvoice(ctx, input, "rest"); return (await sendInvoice(ctx, row.invoice.id)).invoice; }
    const row = await createBill(ctx, input, "rest"); return (await receiveBill(ctx, row.bill.id)).bill;
  }
  const cashJournal = async (id: string, expected: number, gl = cash.id) => {
    const lines = await db.select().from(journalLine).where(eq(journalLine.journalEntryId, id));
    assert.equal(lines.reduce((s, l) => s + BigInt(l.debitAmount), 0n), lines.reduce((s, l) => s + BigInt(l.creditAmount), 0n));
    assert.equal(lines.filter(l => l.accountId === gl).reduce((s, l) => s + BigInt(l.debitAmount) - BigInt(l.creditAmount), 0n), BigInt(expected));
    assert.ok(lines.every(l => l.rateExact && l.rateMigrationStatus === "exact")); return lines;
  };
  try {
    const fresh = await movement(), doc = await recognized("invoice"), outgoing = await movement(-1250), bl = await recognized("bill");
    const routeInputs = [[match, { invoiceId: doc.id, amount: 1250 }], [matchInvoice, { invoiceId: doc.id, amountMinor: "1250" }],
      [split, { allocations: [{ documentType: "invoice", documentId: doc.id, amount: 1250 }] }]] as const;
    for (const [route, body] of routeInputs) {
      for (const key of [keys.b, keys.expired, keys.viewer, "dk_invalid"]) await denied(() => route(req(body, key), params(fresh.id)), key === keys.b ? 404 : key === keys.viewer ? 403 : 401);
      const foreign = await movement(1250, foreignBank.id); await denied(() => route(req(body), params(foreign.id)), 404);
      await denied(() => route(req(body), params(randomUUID())), 404); await denied(() => route(req(body), params("bad")), 400);
    }
    for (const [name, args] of [["match_to_invoice", { transactionId: fresh.id, invoiceId: doc.id, amount: 1250 }], ["match_to_bill", { transactionId: outgoing.id, billId: bl.id, amountMinor: "1250" }],
      ["split_to_documents", { transactionId: fresh.id, allocations: [{ documentType: "invoice", documentId: doc.id, amountMinor: "1250" }] }],
      ["get_bank_invoice_matches", { transactionId: fresh.id }], ["match_to_existing_payment", { transactionId: fresh.id, paymentId: randomUUID() }],
      ["match_to_existing_journal", { transactionId: fresh.id, journalEntryId: randomUUID() }]] as const) {
      await mcpDenied(name, args, ro); await mcpDenied(name, args, mb); await mcpDenied(name, { ...args, extra: 1 });
    }
    const suggestions = await data(await invoiceMatches(req(), params(fresh.id))); assert.equal(suggestions.transaction.amountMinor, "1250");
    assert.ok(suggestions.openInvoices.some((r: { id: string; amountDueMinor: string }) => r.id === doc.id && r.amountDueMinor === "1250"));
    assert.ok(suggestions.suggestedMatches.some((r: { candidate: { id: string; amountMinor: string } }) => r.candidate.id === doc.id && r.candidate.amountMinor === "1250"));
    assert.equal((await ma.call("get_bank_invoice_matches", { transactionId: fresh.id })).isError, false);
    for (const key of [keys.b, keys.viewer, keys.expired, "dk_invalid"]) await denied(() => invoiceMatches(req({}, key), params(fresh.id)), key === keys.b ? 404 : key === keys.viewer ? 403 : 401);
    assert.equal((await data(await invoiceMatches(req(), params(outgoing.id)))).openInvoices.length, 0);
    const first = await data(await matchInvoice(req({ invoiceId: doc.id, amount: 1250, amountMinor: "1250" }, keys.banker), params(fresh.id)));
    assert.equal(first.invoiceStatus, "paid"); assert.equal(first.payment.amountMinor, "1250"); await cashJournal(first.payment.journalEntryId, 1250);
    assert.equal((await db.select().from(payment).where(eq(payment.id, first.payment.id)))[0].bankTransactionId, fresh.id);
    await denied(() => match(req({ invoiceId: doc.id, amountMinor: "1250" }), params(fresh.id)), 400);
    const paidBill = await mk.call("match_to_bill", { transactionId: outgoing.id, billId: bl.id, amountMinor: "1250" }); assert.equal(paidBill.isError, false, JSON.stringify(paidBill.body));
    assert.equal(paidBill.body.billStatus, "paid"); await cashJournal(paidBill.body.payment.journalEntryId, -1250);
    // This role still cannot use ordinary payment endpoints/services.
    assert.throws(() => payDocument({ ...ctx, role: "member", permissions: ["manage:banking"] }, "invoice", doc.id, { amount: 1, date: "2026-10-04" }));
    const d1 = await recognized("invoice", 1000), d2 = await recognized("invoice", 1000), splitLine = await movement(1500);
    const divided = await data(await split(req({ allocations: [{ documentType: "invoice", documentId: d1.id, amount: 1000 }, { documentType: "invoice", documentId: d2.id, amountMinor: "500" }] }), params(splitLine.id)));
    assert.deepEqual(divided.allocations.map((r: { newStatus: string }) => r.newStatus), ["paid", "partial"]); await cashJournal(divided.payment.journalEntryId, 1500);
    const d3 = await recognized("bill", 500), d4 = await recognized("bill", 750), multiOut = await movement(-1250);
    assert.equal((await ma.call("split_to_documents", { transactionId: multiOut.id, allocations: [d3, d4].map((r, i) => ({ documentType: "bill", documentId: r.id, amountMinor: i ? "750" : "500" })) })).isError, false);
    const pending = await recognized("invoice"), pendingLine = await movement();
    for (const patch of [{ amountMinor: "1251" }, { amountMinor: "1249" }, { amount: 1.5 }, { amountMinor: "01" }, { amount: 1250, amountMinor: "1251" }, { date: "2026-02-30" }, { date: "2026-09-30" }, { billId: bl.id }, { matchType: "bill" }])
      await denied(() => match(req({ invoiceId: pending.id, amountMinor: "1250", ...patch }), params(pendingLine.id)), 400);
    await denied(() => match(req({ invoiceId: pending.id, amountMinor: "9007199254740992" }), params(pendingLine.id)), 422);
    for (const extra of [{ status: "excluded" }, { status: "reconciled" }, { transferGroupId: randomUUID() }, { amount: 0 }, { currencyCode: "EUR" }]) {
      const row = await movement(1250, bank.id, extra); await denied(() => match(req({ invoiceId: pending.id, amountMinor: "1250" }), params(row.id)), "currencyCode" in extra ? 422 : 400);
    }
    const small = await recognized("invoice", 1000); await denied(() => match(req({ invoiceId: small.id, amount: 1250 }), params(pendingLine.id)), 400);
    const differentContact = await recognized("invoice", 500, "USD", party2.id);
    await denied(() => split(req({ allocations: [{ documentType: "invoice", documentId: pending.id, amount: 750 }, { documentType: "invoice", documentId: differentContact.id, amount: 500 }] }), params(pendingLine.id)), 400);
    await denied(() => split(req({ allocations: [{ documentType: "invoice", documentId: pending.id, amount: 625 }, { documentType: "invoice", documentId: pending.id, amount: 625 }] }), params(pendingLine.id)), 400);
    const [foreignInvoice] = await db.insert(invoice).values({ organizationId: b.id, contactId: foreignParty.id, invoiceNumber: "INV-F", issueDate: "2026-10-01", dueDate: "2026-10-31", total: 1250, amountDue: 1250, status: "sent" }).returning();
    await denied(() => match(req({ invoiceId: foreignInvoice.id, amount: 1250 }), params(pendingLine.id)), 404);
    const [reverse] = await db.insert(taxRate).values({ organizationId: a.id, name: "Reverse", rate: 2000, kind: "reverse_charge" }).returning();
    const reverseBill = await recognized("bill", 1000, "USD", party.id, { taxRateId: reverse.id }), reverseLine = await movement(-1000);
    const reverseResult = await data(await match(req({ billId: reverseBill.id, amountMinor: "1000" }), params(reverseLine.id))); assert.equal(reverseResult.billStatus, "paid");
    assert.equal((await cashJournal(reverseResult.payment.journalEntryId, -1000)).find(l => l.accountId === ap.id)!.debitAmount, 1000);
    assert.equal((await db.select().from(bill).where(eq(bill.id, reverseBill.id)))[0].amountDue, 0);
    // Existing cash matches do not create postings or allocations.
    const oldDoc = await recognized("invoice"), oldCash = await createSettlementPayment(ctx, { contactId: party.id, type: "received", amount: 1250, date: "2026-10-04", bankAccountId: bank.id,
      allocations: [{ documentType: "invoice", documentId: oldDoc.id, amount: 1250 }] });
    const p = oldCash.payment as { id: string; journalEntryId: string }, existingLine = await movement();
    const wrongDirection = await movement(-1250), wrongAmount = await movement(1251);
    for (const row of [wrongDirection, wrongAmount]) await denied(() => match(req({ paymentId: p.id }), params(row.id)), 400);
    await denied(() => match(req({ paymentId: p.id, amountMinor: "1250" }), params(existingLine.id)), 400);
    const [storedAllocation] = await db.select().from(paymentAllocation).where(eq(paymentAllocation.paymentId, p.id));
    const alteredDoc = await recognized("invoice");
    await db.update(paymentAllocation).set({ documentId: alteredDoc.id }).where(eq(paymentAllocation.id, storedAllocation.id));
    await denied(() => match(req({ paymentId: p.id }), params(existingLine.id)), 422);
    await db.update(paymentAllocation).set({ documentId: oldDoc.id }).where(eq(paymentAllocation.id, storedAllocation.id));
    const cashLeg = (await db.select().from(journalLine).where(eq(journalLine.journalEntryId, p.journalEntryId))).find(l => l.accountId === cash.id)!;
    await db.update(journalLine).set({ rateExact: "2", exchangeRate: 2000000 }).where(eq(journalLine.id, cashLeg.id));
    await denied(() => match(req({ paymentId: p.id }), params(existingLine.id)), 422);
    await db.update(journalLine).set({ rateExact: "1", exchangeRate: 1000000 }).where(eq(journalLine.id, cashLeg.id));
    const counts = (await db.execute(sql`select (select count(*) from journal_entry) as journals, (select count(*) from payment) as payments`)).rows;
    const existing = await data(await match(req({ paymentId: p.id }), params(existingLine.id))); assert.equal(existing.journalEntryId, p.journalEntryId);
    assert.deepEqual((await db.execute(sql`select (select count(*) from journal_entry) as journals, (select count(*) from payment) as payments`)).rows, counts);
    const duplicateLine = await movement(); await mcpDenied("match_to_existing_payment", { transactionId: duplicateLine.id, paymentId: p.id });
    const newOldDoc = await recognized("bill"), newOld = await payDocument(ctx, "bill", newOldDoc.id, { amount: 1250, date: "2026-10-04", bankAccountId: bank.id });
    const newP = newOld.payment as { id: string }, newOldLine = await movement(-1250);
    assert.equal((await ma.call("match_to_existing_payment", { transactionId: newOldLine.id, paymentId: newP.id })).isError, false);
    const wrongBankDoc = await recognized("invoice"), wrongBankPay = await payDocument(ctx, "invoice", wrongBankDoc.id, { amount: 1250, date: "2026-10-04", bankAccountId: otherBank.id });
    await denied(() => match(req({ paymentId: (wrongBankPay.payment as { id: string }).id }), params(duplicateLine.id)), 400);
    // A legitimate manual base-currency bank journal can be linked only once.
    const manual = async () => {
      const [max] = await db.select({ n: sql<string>`max(${journalEntry.entryNumber})::text` }).from(journalEntry);
      const [entry] = await db.insert(journalEntry).values({ organizationId: a.id, entryNumber: Number(max.n) + 1, date: "2026-10-04", status: "posted", sourceType: "manual", description: "Manual cash" }).returning();
      await db.insert(journalLine).values([{ accountId: cash.id, debitAmount: 1250, creditAmount: 0 }, { accountId: revenue.id, debitAmount: 0, creditAmount: 1250 }].map(l => ({ ...l, journalEntryId: entry.id, exchangeRate: 1000000, rateExact: "1", rateFormatVersion: 1, rateMigrationStatus: "exact", rateDirection: "quote_per_base" })));
      return entry;
    };
    const journal = await manual(), manualLine = await movement();
    assert.equal((await ma.call("match_to_existing_journal", { transactionId: manualLine.id, journalEntryId: journal.id })).isError, false);
    await denied(() => match(req({ journalEntryId: journal.id }), params(duplicateLine.id)), 400);
    const corrupt = await manual(); await db.update(journalLine).set({ accountId: foreignGl.id }).where(eq(journalLine.journalEntryId, corrupt.id));
    await denied(() => match(req({ journalEntryId: corrupt.id }), params(duplicateLine.id)), 422);
    const inactiveLine = await movement(); await db.update(bankAccount).set({ isActive: false }).where(eq(bankAccount.id, bank.id));
    await denied(() => match(req({ invoiceId: pending.id, amount: 1250 }), params(inactiveLine.id)), 400);
    await db.update(bankAccount).set({ isActive: true }).where(eq(bankAccount.id, bank.id));
    await db.update(bankAccount).set({ chartAccountId: cash.id }).where(eq(bankAccount.id, otherBank.id));
    await denied(() => match(req({ invoiceId: pending.id, amount: 1250 }), params(inactiveLine.id)), 422);
    await db.update(bankAccount).set({ chartAccountId: null }).where(eq(bankAccount.id, otherBank.id));
    // Missing historical cash or unsafe persisted values cannot commit.
    await db.execute(sql`update bank_transaction set amount=9007199254740992 where id=${pendingLine.id}`);
    await denied(() => match(req({ invoiceId: pending.id, amount: 1250 }), params(pendingLine.id)), 422);
    await denied(() => match(req({ invoiceId: pending.id, amount: 1250 }, keys.b), params(pendingLine.id)), 404);
    await db.execute(sql`update bank_transaction set amount=1250 where id=${pendingLine.id}`);
    await db.insert(periodLock).values({ organizationId: a.id, lockDate: "2026-10-04" });
    await denied(() => match(req({ invoiceId: pending.id, amount: 1250 }), params(pendingLine.id)), 422);
    await db.delete(periodLock).where(eq(periodLock.organizationId, a.id));
    const [closed] = await db.insert(fiscalYear).values({ organizationId: a.id, name: "Closed", startDate: "2026-10-01", endDate: "2026-10-31", isClosed: true }).returning();
    await denied(() => split(req({ allocations: [{ documentType: "invoice", documentId: pending.id, amount: 1250 }] }), params(pendingLine.id)), 422);
    await db.delete(fiscalYear).where(eq(fiscalYear.id, closed.id));
    // Credit/debit carriers stay noncash; cash matching only settles the residual payable.
    const creditDoc = await recognized("invoice", 1250);
    const note = await createCreditNote(ctx, { contactId: party.id, invoiceId: creditDoc.id, issueDate: "2026-10-02", lines: [{ description: "Credit", unitPriceMinor: "250", accountId: revenue.id }] }, "rest");
    await sendCreditNote(ctx, note.creditNote.id); await applyCredit(ctx, note.creditNote.id, { invoiceId: creditDoc.id, amountMinor: "250" });
    const carrierAllocation = (await db.select().from(paymentAllocation).where(eq(paymentAllocation.documentId, note.creditNote.id)))[0];
    const carrier = (await db.select().from(payment).where(eq(payment.id, carrierAllocation.paymentId)))[0];
    assert.ok(carrier); await denied(() => match(req({ paymentId: carrier.id }), params(duplicateLine.id)), 400);
    const creditLine = await movement(1000); assert.equal((await ma.call("match_to_invoice", { transactionId: creditLine.id, invoiceId: creditDoc.id, amountMinor: "1000" })).isError, false);
    const debitDoc = await recognized("bill", 1250);
    const debit = await createDebitNote(ctx, { contactId: party.id, billId: debitDoc.id, issueDate: "2026-10-02", lines: [{ description: "Debit", unitPriceMinor: "250", accountId: expense.id }] }, "rest");
    await sendDebitNote(ctx, debit.debitNote.id); await applyDebitNote(ctx, debit.debitNote.id, { billId: debitDoc.id, amountMinor: "250" });
    const debitLine = await movement(-1000); assert.equal((await ma.call("match_to_bill", { transactionId: debitLine.id, billId: debitDoc.id, amount: 1000 })).isError, false);
    const prepayment = await createCustomerCredit(ctx, { contactId: party.id, sourceType: "prepayment", date: "2026-10-04", amountMinor: "1250", bankAccountId: bank.id });
    assert.ok(prepayment.customerCredit.id);
    // A deposit's real cash receipt can match its journal without applying credit.
    const depositMatch = await data(await match(req({ journalEntryId: prepayment.customerCredit.journalEntryId }), params(duplicateLine.id)));
    assert.equal(depositMatch.matchType, "existing_journal");
    const prepaidDoc = await recognized("invoice", 1250);
    await applyCredit(ctx, prepayment.customerCredit.id, { invoiceId: prepaidDoc.id, amountMinor: "1250", date: "2026-10-04" }, true);
    const prepaidAllocation = (await db.select().from(paymentAllocation).where(eq(paymentAllocation.documentId, prepayment.customerCredit.id)))[0];
    const prepaidLine = await movement(); await denied(() => match(req({ paymentId: prepaidAllocation.paymentId }), params(prepaidLine.id)), 400);
    // Exact FX uses recognition carrying amounts while saving the later cash rate.
    const [eurBank] = await db.insert(bankAccount).values({ organizationId: a.id, accountName: "EUR", currencyCode: "EUR" }).returning();
    const [rate] = await db.insert(exchangeRate).values({ organizationId: a.id, baseCurrency: "EUR", targetCurrency: "USD", date: "2026-10-01", rate: 1500000, rateExact: "1.5", rateFormatVersion: 1, rateMigrationStatus: "exact", rateDirection: "quote_per_base" }).returning();
    const euroDoc = await recognized("invoice", 1000, "EUR");
    await db.update(exchangeRate).set({ rate: 2000000, rateExact: "2" }).where(eq(exchangeRate.id, rate.id));
    const eurLine = await movement(1000, eurBank.id), euro = await data(await match(req({ invoiceId: euroDoc.id, amountMinor: "1000" }), params(eurLine.id)));
    const eurGl = (await db.select().from(bankAccount).where(eq(bankAccount.id, eurBank.id)))[0].chartAccountId!;
    const euroLegs = await cashJournal(euro.payment.journalEntryId, 2000, eurGl);
    assert.equal(euroLegs.find(l => l.accountId === ar.id)!.creditAmount, 1500); assert.ok(euroLegs.every(l => l.rateExact === "2"));
    const anotherEuro = await recognized("invoice", 1000, "EUR"), oldEuro = await payDocument(ctx, "invoice", anotherEuro.id, { amount: 1000, date: "2026-10-04", bankAccountId: eurBank.id });
    await db.delete(exchangeRate).where(eq(exchangeRate.id, rate.id));
    const oldEuroLine = await movement(1000, eurBank.id); assert.equal((await ma.call("match_to_existing_payment", { transactionId: oldEuroLine.id, paymentId: (oldEuro.payment as { id: string }).id })).isError, false);
    const mismatchedLine = await movement(1250, eurBank.id);
    await denied(() => match(req({ invoiceId: pending.id, amount: 1250 }), params(mismatchedLine.id)), 400);
    for (const currency of ["JPY", "KWD", "IRR"]) {
      await db.insert(exchangeRate).values({ organizationId: a.id, baseCurrency: currency, targetCurrency: "USD", date: "2026-10-01", rate: 1000000, rateExact: "1", rateFormatVersion: 1, rateMigrationStatus: "exact", rateDirection: "quote_per_base" });
      const [parent] = await db.insert(bankAccount).values({ organizationId: a.id, accountName: currency, currencyCode: currency }).returning();
      const scaled = await recognized("invoice", 1250, currency), line = await movement(1250, parent.id);
      const result = await ma.call("match_to_invoice", { transactionId: line.id, invoiceId: scaled.id, amount: 1250, amountMinor: "1250" });
      assert.equal(result.isError, false, JSON.stringify(result.body)); assert.equal(result.body.payment.amountMinor, "1250");
      const gl = (await db.select().from(bankAccount).where(eq(bankAccount.id, parent.id)))[0].chartAccountId!;
      await cashJournal(result.body.payment.journalEntryId, currency === "KWD" ? 125 : 125000, gl);
    }
    const large = await recognized("invoice", Number.MAX_SAFE_INTEGER), largeLine = await movement(Number.MAX_SAFE_INTEGER);
    const largeResult = await data(await match(req({ invoiceId: large.id, amountMinor: String(Number.MAX_SAFE_INTEGER) }), params(largeLine.id)));
    await cashJournal(largeResult.payment.journalEntryId, Number.MAX_SAFE_INTEGER);
    const unsafeDoc = await recognized("invoice"), unsafeLine = await movement();
    await db.execute(sql`update invoice set amount_due=9007199254740992 where id=${unsafeDoc.id}`);
    await denied(() => match(req({ invoiceId: unsafeDoc.id, amount: 1250 }), params(unsafeLine.id)), 422);
    await db.execute(sql`update invoice set amount_due=1250 where id=${unsafeDoc.id}`);
    const missingCurrency = "CAD", [missingBank] = await db.insert(bankAccount).values({ organizationId: a.id, accountName: missingCurrency, currencyCode: missingCurrency }).returning();
    await db.insert(exchangeRate).values({ organizationId: a.id, baseCurrency: missingCurrency, targetCurrency: "USD", date: "2026-10-01", rate: 1000000, rateExact: "1", rateFormatVersion: 1, rateMigrationStatus: "exact", rateDirection: "quote_per_base" });
    const missingDoc = await recognized("invoice", 1250, missingCurrency), missingLine = await movement(1250, missingBank.id);
    await db.delete(exchangeRate).where(eq(exchangeRate.baseCurrency, missingCurrency));
    await denied(() => match(req({ invoiceId: missingDoc.id, amountMinor: "1250" }), params(missingLine.id)), 422);
    // Audit failure after financial writes rolls back payment, numbering and links.
    await db.execute(sql.raw("CREATE FUNCTION fail_match_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.entity_type='bank_transaction' THEN RAISE EXCEPTION 'forced audit failure'; END IF; RETURN NEW; END $$"));
    await db.execute(sql.raw("CREATE TRIGGER fail_match_audit BEFORE INSERT ON audit_log FOR EACH ROW EXECUTE FUNCTION fail_match_audit()"));
    await denied(() => matchInvoice(req({ invoiceId: pending.id, amountMinor: "1250" }), params(pendingLine.id)), 500);
    const auditManual = await manual(); await denied(() => match(req({ journalEntryId: auditManual.id }), params(prepaidLine.id)), 500);
    const auditPayDoc = await recognized("invoice"), auditPayment = await payDocument(ctx, "invoice", auditPayDoc.id, { amount: 1250, date: "2026-10-04", bankAccountId: bank.id });
    await denied(() => match(req({ paymentId: (auditPayment.payment as { id: string }).id }), params(prepaidLine.id)), 500);
    await db.execute(sql.raw("DROP TRIGGER fail_match_audit ON audit_log")); await db.execute(sql.raw("DROP FUNCTION fail_match_audit()"));
    const races = await Promise.all([match(req({ invoiceId: pending.id, amount: 1250 }), params(pendingLine.id)), matchInvoice(req({ invoiceId: pending.id, amountMinor: "1250" }), params(pendingLine.id))]);
    assert.deepEqual(races.map(r => r.status).sort(), [200, 400]);
    assert.equal((await db.select().from(payment).where(eq(payment.bankTransactionId, pendingLine.id))).length, 1);
    const raceManual = await manual(), race1 = await movement(), race2 = await movement();
    const links = await Promise.all([match(req({ journalEntryId: raceManual.id }), params(race1.id)), match(req({ journalEntryId: raceManual.id }), params(race2.id))]);
    assert.deepEqual(links.map(r => r.status).sort(), [200, 400]);
    assert.equal((await db.select().from(bankTransaction).where(eq(bankTransaction.journalEntryId, raceManual.id))).length, 1);
    const sameDoc = await recognized("invoice"), docLine1 = await movement(), docLine2 = await movement();
    const documentRace = await Promise.all([match(req({ invoiceId: sameDoc.id, amount: 1250 }), params(docLine1.id)), match(req({ invoiceId: sameDoc.id, amount: 1250 }), params(docLine2.id))]);
    assert.deepEqual(documentRace.map(r => r.status).sort(), [200, 400]);
    const payLine1 = await movement(), payLine2 = await movement();
    const payRace = await Promise.all([match(req({ paymentId: (auditPayment.payment as { id: string }).id }), params(payLine1.id)), match(req({ paymentId: (auditPayment.payment as { id: string }).id }), params(payLine2.id))]);
    assert.deepEqual(payRace.map(r => r.status).sort(), [200, 400]);
    assert.equal((await db.select().from(bankAccount).where(eq(bankAccount.id, bank.id)))[0].balance, 0);
    console.log("REST and MCP bank document matching verified");
  } finally { await ma.close(); await mb.close(); await ro.close(); await mk.close(); }
}
run().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
