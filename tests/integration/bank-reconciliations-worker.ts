import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, customRole, bankAccount, bankTransaction, bankReconciliation, chartAccount, journalEntry, journalLine,
  payment, paymentAllocation, invoice, bill, contact, periodLock, fiscalYear, exchangeRate, expenseClaim } from "../../lib/db/schema";
import { GET as list, POST as create } from "../../app/api/v1/bank-accounts/[id]/reconciliations/route";
import { GET as report, POST as sessionPost } from "../../app/api/v1/bank-accounts/[id]/reconciliation/route";
import { POST as reconcile } from "../../app/api/v1/bank-transactions/[id]/reconcile/route";
import { POST as undo } from "../../app/api/v1/bank-transactions/[id]/unreconcile/route";
import { POST as exclude } from "../../app/api/v1/bank-transactions/[id]/exclude/route";
import { categorizeBankTransaction, splitBankAccounts, createBankExpense } from "../../lib/api/bank-categorization";
import { matchBankDocument, splitBankDocuments } from "../../lib/api/bank-document-matches";
import { recordBankTransfer, matchBankTransfer } from "../../lib/api/bank-transfers";
import { createInvoice } from "../../lib/api/invoice-writes";
import { sendInvoice } from "../../lib/api/invoice-lifecycle";
import { createBill } from "../../lib/api/bill-writes";
import { receiveBill } from "../../lib/api/bill-lifecycle";
import { createSettlementPayment } from "../../lib/api/payment-settlements";
import { registerBankReconciliationTools } from "../../lib/mcp/tools/bank-reconciliations";
import { updateBankAccount } from "../../lib/api/bank-accounts";
import type { AuthContext } from "../../lib/api/auth-context";

async function mcp(ctx: AuthContext) {
  const server = new McpServer({ name: "Reconciliation fixture", version: "1" }); registerBankReconciliationTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1" }), [ct, st] = InMemoryTransport.createLinkedPair();
  await server.connect(st); await client.connect(ct);
  const tools = (await client.listTools()).tools; assert.equal(tools.length, 8);
  for (const tool of tools) { assert.equal(tool.inputSchema.additionalProperties, false); for (const field of Object.values(tool.inputSchema.properties ?? {})) assert.ok((field as { description?: string }).description); }
  return { async call(name: string, args: Record<string, unknown>) {
    const result = await client.callTool({ name, arguments: args }), text = (result.content as { text: string }[])[0].text;
    return { isError: result.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
  }, async close() { await client.close(); await server.close(); } };
}
async function run() {
  const [a, b] = await db.insert(organization).values([{ name: "Reconciliation A", slug: "recon-a" }, { name: "Reconciliation B", slug: "recon-b" }]).returning();
  const [owner, viewer, banker] = await db.insert(users).values([{ email: "recon-owner@example.test" }, { email: "recon-view@example.test" }, { email: "recon-bank@example.test" }]).returning();
  const [viewRole, bankRole] = await db.insert(customRole).values([{ organizationId: a.id, name: "View", permissions: [] }, { organizationId: a.id, name: "Bank", permissions: ["manage:banking"] }]).returning();
  await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner" }, { organizationId: b.id, userId: owner.id, role: "owner" },
    { organizationId: a.id, userId: viewer.id, customRoleId: viewRole.id }, { organizationId: a.id, userId: banker.id, customRoleId: bankRole.id }]);
  const keys = { a: "dk_recon_a", b: "dk_recon_b", viewer: "dk_recon_view", banker: "dk_recon_bank", expired: "dk_recon_expired" };
  for (const [label, key] of Object.entries(keys)) await db.insert(apiKey).values({ organizationId: label === "b" ? b.id : a.id, createdBy: label === "viewer" ? viewer.id : label === "banker" ? banker.id : owner.id,
    name: label, keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_recon", expiresAt: label === "expired" ? new Date("2020-01-01") : null });
  const ctx: AuthContext = { organizationId: a.id, userId: owner.id, role: "owner" }, ma = await mcp(ctx), mb = await mcp({ ...ctx, organizationId: b.id }), ro = await mcp({ ...ctx, userId: viewer.id, role: "member", permissions: [] });
  const mk = await mcp({ ...ctx, userId: banker.id, role: "member", permissions: ["manage:banking"] });
  const req = (body: unknown = {}, key = keys.a, query = "") => new Request(`http://fixture.test/api/v1/bank-accounts${query}`, { method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-organization-id": b.id }, body: JSON.stringify(body) });
  const params = (id: string) => ({ params: Promise.resolve({ id }) });
  const data = async (response: Response, status = 200) => { const body = await response.json(); assert.equal(response.status, status, JSON.stringify(body)); return body; };
  const tables = ["bank_account", "bank_transaction", "bank_reconciliation", "chart_account", "journal_entry", "journal_line", "payment", "payment_allocation", "invoice", "bill", "expense_claim", "expense_item"];
  const snapshot = async () => [...await Promise.all(tables.map(t => db.execute(sql.raw(`select coalesce(jsonb_agg(to_jsonb(t)::text order by t.id),'[]'::jsonb) as rows from ${t} t`)).then(r => r.rows))),
    (await db.execute(sql`select coalesce(jsonb_agg(to_jsonb(t)::text order by t.id),'[]'::jsonb) as rows from audit_log t where entity_type <> 'api_key'`)).rows];
  const denied = async (fn: () => Promise<Response>, status: number) => { const before = await snapshot(); await data(await fn(), status); assert.deepEqual(await snapshot(), before); };
  const mcpDenied = async (name: string, args: Record<string, unknown>, client = ma) => { const before = await snapshot(); assert.equal((await client.call(name, args)).isError, true); assert.deepEqual(await snapshot(), before); };
  let code = 1110;
  const bank = async (currencyCode = "USD", org = a.id) => {
    const [gl] = await db.insert(chartAccount).values({ organizationId: org, code: String(code++), name: "Synthetic bank GL", type: "asset", currencyCode }).returning();
    return (await db.insert(bankAccount).values({ organizationId: org, accountName: "Synthetic bank", currencyCode, balance: 2500, chartAccountId: gl.id }).returning())[0];
  };
  const movement = async (parent: string, amount = 1250, extra = {}) => (await db.insert(bankTransaction).values({ bankAccountId: parent, amount, date: "2026-10-04", description: "Synthetic movement", balance: 2500, ...extra }).returning())[0];
  const [revenue, expense, foreignGl] = await db.insert(chartAccount).values([{ organizationId: a.id, code: "4000", name: "Revenue", type: "revenue" },
    { organizationId: a.id, code: "5000", name: "Expense", type: "expense" }, { organizationId: b.id, code: "4000", name: "Foreign", type: "revenue" }]).returning();
  const [party] = await db.insert(contact).values({ organizationId: a.id, name: "Synthetic party", type: "both" }).returning();
  await db.insert(chartAccount).values([{ organizationId: a.id, code: "1200", name: "AR", type: "asset" }, { organizationId: a.id, code: "2100", name: "AP", type: "liability" }]);
  const newSession = (endBalance: number | string, startBalance: number | string = 0) => ({ startDate: "2026-10-01", endDate: "2026-10-31",
    ...(typeof startBalance === "string" ? { startBalanceMinor: startBalance } : { startBalance }), ...(typeof endBalance === "string" ? { endBalanceMinor: endBalance } : { endBalance }) });
  const rowById = async (id: string) => (await db.select().from(bankTransaction).where(eq(bankTransaction.id, id)))[0];
  const entryById = async (id: string) => (await db.select().from(journalEntry).where(eq(journalEntry.id, id)))[0];
  const journal = async (parent: typeof bankAccount.$inferSelect, amount = 1250, extra = {}) => {
    const [max] = await db.select({ n: sql<number>`coalesce(max(entry_number),0)::int` }).from(journalEntry).where(eq(journalEntry.organizationId, parent.organizationId));
    const [entry] = await db.insert(journalEntry).values({ organizationId: parent.organizationId, entryNumber: max.n + 1, date: "2026-10-04", description: "Synthetic manual", status: "posted", sourceType: "manual", ...extra }).returning();
    await db.insert(journalLine).values([{ accountId: parent.chartAccountId!, debitAmount: amount, creditAmount: 0 }, { accountId: parent.organizationId === b.id ? foreignGl.id : revenue.id, debitAmount: 0, creditAmount: amount }]
      .map(l => ({ ...l, journalEntryId: entry.id, currencyCode: parent.currencyCode, exchangeRate: 1000000, rateExact: "1", rateDirection: "quote_per_base", rateFormatVersion: 1, rateMigrationStatus: "exact" })));
    return entry;
  };
  async function recognition(kind: "invoice" | "bill", amount = 1250, currencyCode = "USD") {
    const input = { contactId: party.id, issueDate: "2026-10-01", dueDate: "2026-10-31", currencyCode, lines: [{ description: "Fixture", unitPriceMinor: String(amount), accountId: kind === "invoice" ? revenue.id : expense.id }] };
    if (kind === "invoice") { const row = await createInvoice(ctx, input, "rest"); return (await sendInvoice(ctx, row.invoice.id)).invoice; }
    const row = await createBill(ctx, input, "rest"); return (await receiveBill(ctx, row.bill.id)).bill;
  }
  const checkReversal = async (id: string) => {
    const original = await entryById(id); assert.equal(original.status, "posted"); assert.equal(original.deletedAt, null); assert.ok(original.reversedByEntryId);
    const reverse = await entryById(original.reversedByEntryId); assert.equal(reverse.reversesEntryId, id); assert.equal(reverse.date, original.date);
    const lines = await db.select().from(journalLine).where(eq(journalLine.journalEntryId, id));
    const reversed = await db.select().from(journalLine).where(eq(journalLine.journalEntryId, reverse.id));
    const normalized = (ls: typeof lines, swap = false) => ls.map(l => ({ accountId: l.accountId, debit: swap ? l.creditAmount : l.debitAmount, credit: swap ? l.debitAmount : l.creditAmount,
      currency: l.currencyCode, rate: l.rateExact, exchangeRate: l.exchangeRate, direction: l.rateDirection, version: l.rateFormatVersion, status: l.rateMigrationStatus,
      provenance: l.rateProvenance, costCenter: l.costCenterId, project: l.projectId })).sort((x,y) => JSON.stringify(x).localeCompare(JSON.stringify(y)));
    assert.deepEqual(normalized(reversed), normalized(lines, true)); return reverse;
  };
  try {
    const main = await bank(), foreign = await bank("USD", b.id), fresh = await movement(main.id), ownJournal = await journal(main), foreignJournal = await journal(foreign);
    for (const key of [keys.b, keys.viewer, keys.expired, "dk_invalid"]) {
      const status = key === keys.b ? 404 : key === keys.viewer ? 403 : 401;
      await denied(() => create(req(newSession(1250), key), params(main.id)), status);
      await denied(() => report(req({}, key), params(main.id)), status);
      for (const route of [reconcile, undo, exclude]) await denied(() => route(req({ journalEntryId: ownJournal.id }, key), params(fresh.id)), status);
    }
    await denied(() => list(req({}, keys.b), params(main.id)), 404);
    await denied(() => report(req({}, keys.a, "?reconciliationId=bad"), params(main.id)), 400);
    await denied(() => list(req({}, keys.a, "?page=0"), params(main.id)), 400);
    for (const extra of [{ startDate: "2026-02-30" }, { startDate: "2026-11-01" }, { startBalanceMinor: "1" }, { endBalance: 1.1 }, { endBalanceMinor: "01" }, { unknown: 1 }])
      await denied(() => create(req({ ...newSession(1250), ...extra }), params(main.id)), 400);
    await denied(() => create(req(newSession("9007199254740992")), params(main.id)), 422);
    await denied(() => reconcile(req({}), params(fresh.id)), 400);
    await denied(() => reconcile(req({ journalEntryId: foreignJournal.id }), params(fresh.id)), 404);
    const foreignMovement = await movement(foreign.id); await denied(() => exclude(req(), params(foreignMovement.id)), 404);
    for (const [name, args] of [
      ["list_bank_reconciliations", { bankAccountId: main.id }], ["create_bank_reconciliation", { bankAccountId: main.id, ...newSession(1250) }],
      ["reconciliation_report", { bankAccountId: main.id }], ["complete_bank_reconciliation", { bankAccountId: main.id, reconciliationId: randomUUID() }],
      ["post_bank_reconciliation_adjustment", { bankAccountId: main.id, amountMinor: "1250", date: "2026-10-04" }],
      ["reconcile_bank_transaction", { transactionId: fresh.id, journalEntryId: ownJournal.id }], ["unreconcile_bank_transaction", { transactionId: fresh.id }], ["exclude_bank_transaction", { transactionId: fresh.id }],
    ] as const) { await mcpDenied(name, args, mb); if (name !== "list_bank_reconciliations") await mcpDenied(name, args, ro); await mcpDenied(name, { ...args, unexpected: 1 }); }
    const rec = (await data(await create(req({ ...newSession(1250), endBalanceMinor: "1250" }, keys.banker), params(main.id)), 201)).reconciliation;
    assert.equal(rec.endBalanceMinor, "1250"); assert.equal(rec.currencyCode, "USD");
    const listed = await data(await list(req(), params(main.id))); assert.equal(listed.data[0].startBalanceMinor, "0"); assert.equal(listed.pagination.total, 1);
    const ml = await ma.call("list_bank_reconciliations", { bankAccountId: main.id }); assert.equal(ml.isError, false); assert.equal(ml.body.reconciliations[0].endBalanceMinor, "1250");
    await denied(() => create(req(newSession(1250)), params(main.id)), 400);
    const incompleteBank = await bank(), incompleteRow = await movement(incompleteBank.id), incompleteRec = (await data(await create(req(newSession(1250)), params(incompleteBank.id)), 201)).reconciliation;
    const completeInput = { action: "complete", reconciliationId: incompleteRec.id };
    await denied(() => sessionPost(req(completeInput), params(incompleteBank.id)), 400);
    await categorizeBankTransaction(ctx, incompleteRow.id, { accountId: revenue.id });
    await denied(() => sessionPost(req({ ...completeInput, transactionIds: [] }), params(incompleteBank.id)), 400);
    await denied(() => sessionPost(req({ ...completeInput, transactionIds: [incompleteRow.id, incompleteRow.id] }), params(incompleteBank.id)), 400);
    await db.update(bankReconciliation).set({ startBalance: 1 }).where(eq(bankReconciliation.id, incompleteRec.id));
    await denied(() => sessionPost(req(completeInput), params(incompleteBank.id)), 400);
    await db.update(bankReconciliation).set({ startBalance: 0 }).where(eq(bankReconciliation.id, incompleteRec.id));
    await db.execute(sql`update bank_reconciliation set end_balance=9007199254740992 where id=${incompleteRec.id}`);
    await denied(() => report(req(), params(incompleteBank.id)), 422); await denied(() => sessionPost(req(completeInput), params(incompleteBank.id)), 422);
    await db.execute(sql`update bank_reconciliation set end_balance=1250 where id=${incompleteRec.id}`);
    const reconciled = await data(await reconcile(req({ journalEntryId: ownJournal.id, reconciliationId: rec.id }), params(fresh.id)));
    assert.equal(reconciled.transaction.amountMinor, "1250"); assert.equal(reconciled.transaction.balanceMinor, "2500");
    const proof = await data(await report(req(), params(main.id))); assert.equal(proof.glBalanceMinor, "1250"); assert.equal(proof.differenceMinor, "0"); assert.equal(proof.isBalanced, true);
    await denied(() => sessionPost(req({ action: "complete", reconciliationId: rec.id, transactionIds: [foreignMovement.id] }), params(main.id)), 400);
    const completed = await ma.call("complete_bank_reconciliation", { bankAccountId: main.id, reconciliationId: rec.id, transactionIds: [] }); assert.equal(completed.isError, false);
    await denied(() => sessionPost(req({ action: "complete", reconciliationId: rec.id }), params(main.id)), 400);
    const preserved = await data(await undo(req(), params(fresh.id))); assert.equal(preserved.transaction.journalEntryId, null);
    assert.equal((await entryById(ownJournal.id)).reversedByEntryId, null); assert.equal((await entryById(ownJournal.id)).status, "posted");
    assert.equal((await db.select().from(bankReconciliation).where(eq(bankReconciliation.id, rec.id)))[0].status, "in_progress");
    await denied(() => undo(req(), params(fresh.id)), 400);
    assert.equal((await data(await exclude(req(), params(fresh.id)))).transaction.status, "excluded");
    assert.equal((await mk.call("exclude_bank_transaction", { transactionId: fresh.id })).body.status, "unreconciled");
    const markBank = await bank(), markRow = await movement(markBank.id), markJournal = await journal(markBank);
    const markedMcp = await mk.call("reconcile_bank_transaction", { transactionId: markRow.id, journalEntryId: markJournal.id }); assert.equal(markedMcp.isError, false);
    const undoMcp = await ma.call("unreconcile_bank_transaction", { transactionId: markRow.id }); assert.equal(undoMcp.isError, false); assert.equal(undoMcp.body.reversalEntryId, null);
    // Nonzero and zero signed balances, safe maximum, and every currency scale.
    for (const currency of ["USD", "JPY", "KWD", "IRR"]) {
      const parent = await bank(currency); const created = await ma.call("create_bank_reconciliation", { bankAccountId: parent.id, ...newSession("1250", "-1250") });
      assert.equal(created.isError, false); assert.equal(created.body.reconciliation.endBalance, 1250); assert.equal(created.body.reconciliation.currencyCode, currency);
      const before = await snapshot(); await assert.rejects(() => updateBankAccount(ctx, parent.id, { currencyCode: currency === "USD" ? "JPY" : "USD" })); assert.deepEqual(await snapshot(), before);
      const result = await data(await report(req(), params(parent.id))); assert.equal(result.statementEndBalanceMinor, "1250"); assert.equal(result.glCurrencyCode, "USD");
      if (currency !== "USD") { assert.equal(result.difference, null); assert.equal(result.isBalanced, false); assert.equal(result.comparisonUnavailableReason, "different_currency_units");
        await denied(() => sessionPost(req({ action: "complete", reconciliationId: created.body.reconciliation.id }), params(parent.id)), 422);
        await denied(() => sessionPost(req({ action: "adjustment", amountMinor: "1", date: "2026-10-04" }), params(parent.id)), 422); }
    }
    const maxBank = await bank(), maxCreated = await data(await create(req(newSession(String(Number.MAX_SAFE_INTEGER), String(-Number.MAX_SAFE_INTEGER))), params(maxBank.id)), 201);
    assert.equal(maxCreated.reconciliation.startBalanceMinor, String(-Number.MAX_SAFE_INTEGER));
    const large = await bank(); await journal(large, 3000000000); const largeProof = await data(await report(req(), params(large.id))); assert.equal(largeProof.glBalanceMinor, "3000000000");
    const sumBank = await bank(); await movement(sumBank.id, Number.MAX_SAFE_INTEGER); await movement(sumBank.id, 1); await denied(() => report(req(), params(sumBank.id)), 422);
    const differenceBank = await bank(); await db.update(bankAccount).set({ balance: -Number.MAX_SAFE_INTEGER }).where(eq(bankAccount.id, differenceBank.id)); await journal(differenceBank, Number.MAX_SAFE_INTEGER);
    await denied(() => report(req(), params(differenceBank.id)), 422);
    for (const parent of [main, foreign]) {
      const unsafe = await movement(parent.id); await db.execute(sql`update bank_transaction set amount=9007199254740992 where id=${unsafe.id}`);
      await denied(() => exclude(req(), params(unsafe.id)), parent.id === main.id ? 422 : 404);
      await db.delete(bankTransaction).where(eq(bankTransaction.id, unsafe.id));
    }
    const adjustedBank = await bank(); const adjusted = await data(await sessionPost(req({ action: "adjustment", amountMinor: "-3000000000", date: "2026-10-04" }), params(adjustedBank.id)), 201);
    assert.equal(adjusted.amountMinor, "-3000000000"); assert.equal((await data(await report(req(), params(adjustedBank.id)))).glBalanceMinor, "-3000000000");
    for (const extra of [{ amountMinor: "0" }, { amountMinor: "1", amount: 2 }, { amountMinor: "9007199254740992" }, { amountMinor: "1", adjustmentAccountId: foreignGl.id }, { amountMinor: "1", date: "2026-02-30" }, { amountMinor: "1", reconciliationId: rec.id }])
      await denied(() => sessionPost(req({ action: "adjustment", date: "2026-10-04", ...extra }), params(adjustedBank.id)), extra.amountMinor === "9007199254740992" ? 422 : extra.adjustmentAccountId || extra.reconciliationId ? 404 : 400);
    const adjParent = await bank(), adjRec = (await data(await create(req(newSession("1250")), params(adjParent.id)), 201)).reconciliation;
    const adjMcp = await ma.call("post_bank_reconciliation_adjustment", { bankAccountId: adjParent.id, amount: 1250, amountMinor: "1250", date: "2026-10-04", reconciliationId: adjRec.id }); assert.equal(adjMcp.isError, false);
    const [adjustmentMovement] = await db.select().from(bankTransaction).where(eq(bankTransaction.journalEntryId, adjMcp.body.journalEntryId));
    assert.equal((await data(await sessionPost(req({ action: "complete", reconciliationId: adjRec.id }), params(adjParent.id)))).status, "completed");
    const removed = await ma.call("unreconcile_bank_transaction", { transactionId: adjustmentMovement.id }); assert.equal(removed.isError, false); assert.equal(removed.body.deletedTransaction, true); await checkReversal(adjMcp.body.journalEntryId);
    // Plain/split bank coding uses exact saved history for undo and can be coded again.
    const codedBank = await bank();
    for (const sign of [-1, 1]) {
      const row = await movement(codedBank.id, sign * 1250), coded = await categorizeBankTransaction(ctx, row.id, { accountId: sign < 0 ? expense.id : revenue.id });
      await denied(() => exclude(req(), params(row.id)), 400); await data(await undo(req(), params(row.id))); await checkReversal(coded.journalEntryId);
      assert.equal((await rowById(row.id)).amount, sign * 1250); assert.equal((await rowById(row.id)).balance, 2500);
      await categorizeBankTransaction(ctx, row.id, { accountId: sign < 0 ? expense.id : revenue.id });
    }
    const splitRow = await movement(codedBank.id, -1250), split = await splitBankAccounts(ctx, splitRow.id, { allocations: [{ accountId: expense.id, amountMinor: "1000" }, { accountId: expense.id, amount: 250 }] });
    assert.equal((await ma.call("unreconcile_bank_transaction", { transactionId: splitRow.id })).isError, false); await checkReversal(split.journalEntryId);
    // Bank-created expense is reversed and soft-deleted; custom banking-only role cannot delete expenses.
    const expBank = await bank(), expRow = await movement(expBank.id, -1250), createdExpense = await createBankExpense(ctx, expRow.id, { title: "Fixture", items: [{ description: "Fixture", date: "2026-10-04", amountMinor: "1250", accountId: expense.id }] });
    await denied(() => undo(req({}, keys.banker), params(expRow.id)), 403);
    await data(await undo(req(), params(expRow.id))); await checkReversal(createdExpense.journalEntryId);
    assert.ok((await db.select().from(expenseClaim).where(eq(expenseClaim.id, createdExpense.expenseClaim.id)))[0].deletedAt);
    // New cash settlements reverse exact allocations; matching pre-existing cash only detaches.
    for (const kind of ["invoice", "bill"] as const) {
      const payBank = await bank(), doc = await recognition(kind), row = await movement(payBank.id, kind === "invoice" ? 1250 : -1250);
      const matched = await splitBankDocuments(ctx, row.id, { allocations: [{ documentType: kind, documentId: doc.id, amountMinor: "1250" }] });
      await data(await undo(req(), params(row.id))); await checkReversal(matched.payment.journalEntryId!);
      const table = kind === "invoice" ? invoice : bill, restored = (await db.select().from(table).where(eq(table.id, doc.id)))[0];
      assert.equal(restored.amountPaid, 0); assert.equal(restored.amountDue, 1250);
      assert.ok((await db.select().from(payment).where(eq(payment.id, matched.payment.id)))[0].deletedAt);
      assert.equal((await db.select().from(paymentAllocation).where(eq(paymentAllocation.paymentId, matched.payment.id))).length, 1);
      const existingDoc = await recognition(kind), pay = await createSettlementPayment(ctx, { contactId: party.id, type: kind === "invoice" ? "received" : "made", date: "2026-10-04", bankAccountId: payBank.id,
        amountMinor: "1250", allocations: [{ documentType: kind, documentId: existingDoc.id, amountMinor: "1250" }] });
      const existingPayment = pay.payment as { id: string };
      const beforeDoc = (await db.select().from(table).where(eq(table.id, existingDoc.id)))[0], existingRow = await movement(payBank.id, kind === "invoice" ? 1250 : -1250);
      await matchBankDocument(ctx, existingRow.id, { paymentId: existingPayment.id });
      assert.equal((await ma.call("unreconcile_bank_transaction", { transactionId: existingRow.id })).isError, false);
      assert.deepEqual((await db.select().from(table).where(eq(table.id, existingDoc.id)))[0], beforeDoc);
      const kept = (await db.select().from(payment).where(eq(payment.id, existingPayment.id)))[0]; assert.equal(kept.deletedAt, null); assert.equal(kept.bankTransactionId, null); assert.equal((await entryById(kept.journalEntryId!)).reversedByEntryId, null);
      await matchBankDocument(ctx, existingRow.id, { paymentId: existingPayment.id });
    }
    // Transfer undo works from either real or synthetic leg; both sessions reopen and balances remain snapshots.
    for (const counterExists of [false, true]) {
      const from = await bank(), to = await bank(), source = await movement(from.id, -1250), counter = counterExists ? await movement(to.id, 1250, { date: "2026-10-05" }) : null;
      const transfer = await matchBankTransfer(ctx, source.id, { targetBankAccountId: to.id, counterTransactionId: counter?.id });
      const sourceRec = (await data(await create(req(newSession(-1250)), params(from.id)), 201)).reconciliation;
      const counterRec = (await data(await create(req(newSession(1250)), params(to.id)), 201)).reconciliation;
      await data(await sessionPost(req({ action: "complete", reconciliationId: sourceRec.id }), params(from.id)));
      await data(await sessionPost(req({ action: "complete", reconciliationId: counterRec.id }), params(to.id)));
      const selected = counterExists ? source.id : transfer.counterTransactionId;
      const unmatch = await ma.call("unreconcile_bank_transaction", { transactionId: selected }); assert.equal(unmatch.isError, false); await checkReversal(transfer.journalEntryId);
      assert.equal((await rowById(source.id)).status, "unreconciled"); assert.equal((await rowById(source.id)).reconciliationId, null);
      assert.equal((await rowById(source.id)).balance, 2500);
      if (counter) { assert.equal((await rowById(counter.id)).status, "unreconciled"); assert.equal((await rowById(counter.id)).reconciliationId, null); assert.equal((await rowById(counter.id)).date, "2026-10-05"); }
      else { assert.equal(await rowById(transfer.counterTransactionId), undefined); assert.equal(unmatch.body.deletedTransaction, true); }
      const sessions = await db.select().from(bankReconciliation).where(sql`${bankReconciliation.id} in (${sourceRec.id}, ${counterRec.id})`); assert.ok(sessions.every(s => s.status === "in_progress"));
    }
    const standaloneFrom = await bank(), standaloneTo = await bank(), standalone = await recordBankTransfer(ctx, { fromBankAccountId: standaloneFrom.id, toBankAccountId: standaloneTo.id, amountMinor: "1250", date: "2026-10-04" });
    const standaloneRows = await db.select().from(bankTransaction).where(eq(bankTransaction.journalEntryId, standalone.journalEntryId));
    await data(await undo(req(), params(standaloneRows[0].id))); assert.equal((await db.select().from(bankTransaction).where(eq(bankTransaction.journalEntryId, standalone.journalEntryId))).length, 0); await checkReversal(standalone.journalEntryId);
    // Locked statement/journal/counter dates, closed years, corrupt saved state and foreign pair fail without effects.
    const lockBank = await bank(), lockRow = await movement(lockBank.id), lockCode = await categorizeBankTransaction(ctx, lockRow.id, { accountId: revenue.id });
    await db.insert(periodLock).values({ organizationId: a.id, lockDate: "2026-10-04" });
    for (const route of [undo, exclude]) await denied(() => route(req(), params(lockRow.id)), 422);
    await denied(() => create(req(newSession(1250)), params(lockBank.id)), 422);
    await denied(() => sessionPost(req({ action: "adjustment", amountMinor: "1", date: "2026-10-04" }), params(lockBank.id)), 422);
    await db.delete(periodLock).where(eq(periodLock.organizationId, a.id));
    const [fy] = await db.insert(fiscalYear).values({ organizationId: a.id, name: "Closed", startDate: "2026-01-01", endDate: "2026-12-31", isClosed: true }).returning();
    await denied(() => undo(req(), params(lockRow.id)), 422); await db.delete(fiscalYear).where(eq(fiscalYear.id, fy.id));
    await db.update(journalEntry).set({ sourceId: foreignMovement.id }).where(eq(journalEntry.id, lockCode.journalEntryId)); await denied(() => undo(req(), params(lockRow.id)), 422);
    await db.update(journalEntry).set({ sourceId: lockRow.id }).where(eq(journalEntry.id, lockCode.journalEntryId));
    const [line] = await db.select().from(journalLine).where(eq(journalLine.journalEntryId, lockCode.journalEntryId));
    await db.execute(sql`update journal_line set debit_amount=9007199254740992 where id=${line.id}`); await denied(() => undo(req(), params(lockRow.id)), 422);
    await db.execute(sql`update journal_line set debit_amount=${line.debitAmount} where id=${line.id}`);
    const invalidPairFrom = await bank(), invalidPairTo = await bank(), invalidPairSource = await movement(invalidPairFrom.id, -1250), invalidPair = await matchBankTransfer(ctx, invalidPairSource.id, { targetBankAccountId: invalidPairTo.id });
    await db.update(bankTransaction).set({ transferTransactionId: foreignMovement.id }).where(eq(bankTransaction.id, invalidPairSource.id)); await denied(() => undo(req(), params(invalidPairSource.id)), 422);
    await db.update(bankTransaction).set({ transferTransactionId: invalidPair.counterTransactionId }).where(eq(bankTransaction.id, invalidPairSource.id));
    await db.update(bankTransaction).set({ transferTransactionId: randomUUID() }).where(eq(bankTransaction.id, invalidPair.counterTransactionId)); await denied(() => undo(req(), params(invalidPairSource.id)), 422);
    // Concurrent undo/completion/categorization/exclusion and forced final-audit failures.
    const raceBank = await bank(), raceRow = await movement(raceBank.id), racePosting = await categorizeBankTransaction(ctx, raceRow.id, { accountId: revenue.id });
    const races = await Promise.all([undo(req(), params(raceRow.id)), undo(req(), params(raceRow.id))]); assert.deepEqual(races.map(r => r.status).sort(), [200, 400]); await checkReversal(racePosting.journalEntryId);
    const raceRecBank = await bank(), raceRecRow = await movement(raceRecBank.id), raceRecPosting = await categorizeBankTransaction(ctx, raceRecRow.id, { accountId: revenue.id });
    const raceRec = (await data(await create(req(newSession(1250)), params(raceRecBank.id)), 201)).reconciliation;
    const completionRace = await Promise.all([sessionPost(req({ action: "complete", reconciliationId: raceRec.id }), params(raceRecBank.id)), sessionPost(req({ action: "complete", reconciliationId: raceRec.id }), params(raceRecBank.id))]);
    assert.deepEqual(completionRace.map(r => r.status).sort(), [200, 400]);
    const faultPayBank = await bank(), faultPayDoc = await recognition("invoice"), faultPayRow = await movement(faultPayBank.id);
    await splitBankDocuments(ctx, faultPayRow.id, { allocations: [{ documentType: "invoice", documentId: faultPayDoc.id, amount: 1250 }] });
    const faultExpenseBank = await bank(), faultExpenseRow = await movement(faultExpenseBank.id, -1250);
    await createBankExpense(ctx, faultExpenseRow.id, { title: "Fault fixture", items: [{ description: "Fixture", date: "2026-10-04", amount: 12.50, accountId: expense.id }] });
    const faultFrom = await bank(), faultTo = await bank(), faultTransferRow = await movement(faultFrom.id, -1250);
    await matchBankTransfer(ctx, faultTransferRow.id, { targetBankAccountId: faultTo.id });
    const faultCompleteBank = await bank(), faultCompleteRow = await movement(faultCompleteBank.id);
    await categorizeBankTransaction(ctx, faultCompleteRow.id, { accountId: revenue.id });
    const faultCompleteRec = (await data(await create(req(newSession(1250)), params(faultCompleteBank.id)), 201)).reconciliation;
    const faultAdjustmentBank = await bank(), faultAdjustmentRec = (await data(await create(req(newSession(1250)), params(faultAdjustmentBank.id)), 201)).reconciliation;
    await db.execute(sql.raw("CREATE FUNCTION fail_recon_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action IN ('created_reconciliation','completed_reconciliation','posted_reconciliation_adjustment','unreconciled','exclude','reconciled') THEN RAISE EXCEPTION 'Synthetic audit fault'; END IF; RETURN NEW; END $$"));
    await db.execute(sql.raw("CREATE TRIGGER fail_recon_audit BEFORE INSERT ON audit_log FOR EACH ROW EXECUTE FUNCTION fail_recon_audit()"));
    const auditBank = await bank(), auditRow = await movement(auditBank.id), auditJournal = await journal(auditBank);
    const [auditNoGlBank] = await db.insert(bankAccount).values({ organizationId: a.id, accountName: "Fault GL creation", currencyCode: "USD" }).returning();
    await denied(() => create(req(newSession(1250)), params(auditBank.id)), 500);
    await denied(() => sessionPost(req({ action: "adjustment", amountMinor: "1250", date: "2026-10-04" }), params(auditBank.id)), 500);
    await denied(() => sessionPost(req({ action: "adjustment", amountMinor: "1250", date: "2026-10-04" }), params(auditNoGlBank.id)), 500);
    await denied(() => reconcile(req({ journalEntryId: auditJournal.id }), params(auditRow.id)), 500);
    await denied(() => exclude(req(), params(auditRow.id)), 500);
    await denied(() => undo(req(), params(raceRecRow.id)), 500);
    await denied(() => undo(req(), params(faultPayRow.id)), 500);
    await denied(() => undo(req(), params(faultExpenseRow.id)), 500);
    await denied(() => undo(req(), params(faultTransferRow.id)), 500);
    await denied(() => sessionPost(req({ action: "complete", reconciliationId: faultCompleteRec.id }), params(faultCompleteBank.id)), 500);
    await denied(() => sessionPost(req({ action: "adjustment", amountMinor: "1250", date: "2026-10-04", reconciliationId: faultAdjustmentRec.id }), params(faultAdjustmentBank.id)), 500);
    assert.equal((await entryById(raceRecPosting.journalEntryId)).reversedByEntryId, null);
    await mcpDenied("unreconcile_bank_transaction", { transactionId: lockRow.id });
    await db.execute(sql.raw("DROP TRIGGER fail_recon_audit ON audit_log")); await db.execute(sql.raw("DROP FUNCTION fail_recon_audit()"));
    // Malformed noncash/foreign allocations never follow the old generic cash undo.
    const [faultPayment] = await db.select().from(payment).where(eq(payment.bankTransactionId, faultPayRow.id));
    const [faultAllocation] = await db.select().from(paymentAllocation).where(eq(paymentAllocation.paymentId, faultPayment.id));
    await db.update(paymentAllocation).set({ documentType: "credit_note" }).where(eq(paymentAllocation.id, faultAllocation.id));
    await denied(() => undo(req(), params(faultPayRow.id)), 422);
    await db.update(paymentAllocation).set({ documentType: "invoice", documentId: randomUUID() }).where(eq(paymentAllocation.id, faultAllocation.id));
    await denied(() => undo(req(), params(faultPayRow.id)), 422);
    await db.update(paymentAllocation).set({ documentId: faultPayDoc.id }).where(eq(paymentAllocation.id, faultAllocation.id));
    // Concurrent opposite transfer undos create exactly one reversal.
    const oppositeFrom = await bank(), oppositeTo = await bank(), oppositeRow = await movement(oppositeFrom.id, -1250), opposite = await matchBankTransfer(ctx, oppositeRow.id, { targetBankAccountId: oppositeTo.id });
    const oppositeRace = await Promise.all([undo(req(), params(oppositeRow.id)), undo(req(), params(opposite.counterTransactionId))]);
    assert.equal(oppositeRace.filter(r => r.status === 200).length, 1); assert.ok(oppositeRace.every(r => [200,400,404].includes(r.status))); await checkReversal(opposite.journalEntryId);
    // Foreign cash undo uses saved scales/rates; changing current rates cannot change reversal.
    const eurBank = await bank("EUR");
    await db.insert(exchangeRate).values({ organizationId: a.id, baseCurrency: "EUR", targetCurrency: "USD", date: "2026-10-01", rate: 1250000, source: "manual" });
    const eurDoc = await recognition("invoice", 1250, "EUR"), eurRow = await movement(eurBank.id), eurMatch = await splitBankDocuments(ctx, eurRow.id, { allocations: [{ documentType: "invoice", documentId: eurDoc.id, amount: 1250 }] });
    await db.update(exchangeRate).set({ rate: 2000000 }).where(and(eq(exchangeRate.organizationId, a.id), eq(exchangeRate.baseCurrency, "EUR")));
    await data(await undo(req(), params(eurRow.id))); await checkReversal(eurMatch.payment.journalEntryId!);
    console.log("REST and MCP bank reconciliation verified");
  } finally { await Promise.all([ma.close(), mb.close(), ro.close(), mk.close()]); }
}
run().then(() => process.exit(0), error => { console.error(error); process.exit(1); });
