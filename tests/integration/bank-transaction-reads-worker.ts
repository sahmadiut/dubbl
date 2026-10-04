import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, customRole, subscription, bankAccount, bankTransaction, bankStatementImport, chartAccount, contact, invoice, bill, payment, journalEntry, journalLine, auditLog } from "../../lib/db/schema";
import { GET as list } from "../../app/api/v1/bank-accounts/[id]/transactions/route";
import { GET as activity } from "../../app/api/v1/bank-transactions/[id]/activity/route";
import { GET as accounts } from "../../app/api/v1/bank-transactions/[id]/suggestions/route";
import { GET as matches } from "../../app/api/v1/bank-transactions/[id]/match/route";
import { GET as imports } from "../../app/api/v1/bank-accounts/[id]/imports/route";
import { GET as duplicates } from "../../app/api/v1/bank-accounts/[id]/duplicates/route";
import { registerBankTransactionReadTools } from "../../lib/mcp/tools/bank-transaction-reads";
import { registerBankTransactionTools } from "../../lib/mcp/tools/bank-transactions";
import type { AuthContext } from "../../lib/api/auth-context";

async function mcp(ctx: AuthContext) {
  const server = new McpServer({ name: "Bank read fixture", version: "1" });
  registerBankTransactionReadTools(server, ctx); registerBankTransactionTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1" }); const [ct, st] = InMemoryTransport.createLinkedPair();
  await server.connect(st); await client.connect(ct);
  const all = (await client.listTools()).tools; const names = all.map(t => t.name);
  assert.equal(names.length, new Set(names).size);
  for (const tool of all.filter(t => ["list_bank_transactions", "get_match_suggestions", "get_bank_transaction_activity", "get_bank_account_suggestions", "list_bank_statement_imports", "list_bank_transaction_duplicates"].includes(t.name)))
    for (const field of Object.values(tool.inputSchema.properties ?? {})) assert.ok((field as { description?: string }).description);
  return { async call(name: string, args: Record<string, unknown>) { const result = await client.callTool({ name, arguments: args });
    const text = (result.content as { text: string }[])[0].text; return { isError: result.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } }; },
    async close() { await client.close(); await server.close(); } };
}
async function run() {
  const [a, b] = await db.insert(organization).values([{ name: "Read A", slug: "read-a" }, { name: "Read B", slug: "read-b" }]).returning();
  const [owner, viewer] = await db.insert(users).values([{ email: "read-owner@example.test", passwordHash: "never expose" }, { email: "read-viewer@example.test" }]).returning();
  const [role] = await db.insert(customRole).values({ organizationId: a.id, name: "Read", permissions: [] }).returning();
  await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner" }, { organizationId: b.id, userId: owner.id, role: "owner" }, { organizationId: a.id, userId: viewer.id, customRoleId: role.id }]);
  await db.insert(subscription).values([{ organizationId: a.id, plan: "pro" }, { organizationId: b.id, plan: "pro" }]);
  for (const [key, organizationId, createdBy, expired] of [["dk_read_a", a.id, owner.id, false], ["dk_read_b", b.id, owner.id, false], ["dk_read_viewer", a.id, viewer.id, false], ["dk_read_expired", a.id, owner.id, true]] as const)
    await db.insert(apiKey).values({ organizationId, createdBy, name: key, keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_read", expiresAt: expired ? new Date("2020-01-01") : null });
  const ctx: AuthContext = { organizationId: a.id, userId: owner.id, role: "owner" };
  const ma = await mcp(ctx), mb = await mcp({ ...ctx, organizationId: b.id }), ro = await mcp({ ...ctx, userId: viewer.id, role: "member", permissions: [] });
  const req = (query = "", key = "dk_read_a") => new Request(`https://fixture.test/api/v1/bank?${query}`, { headers: { authorization: `Bearer ${key}`, "x-organization-id": b.id } });
  const params = (id: string) => ({ params: Promise.resolve({ id }) });
  const data = async (response: Response, status = 200) => { const body = await response.json(); assert.equal(response.status, status, JSON.stringify(body)); return body; };
  const snapshot = async () => (await db.execute(sql`select jsonb_build_object(
    'bank', (select jsonb_agg(to_jsonb(t) order by id) from bank_account t),
    'transactions', (select jsonb_agg(to_jsonb(t) order by id) from bank_transaction t),
    'imports', (select jsonb_agg(to_jsonb(t) order by id) from bank_statement_import t),
    'audit', (select jsonb_agg(to_jsonb(t) order by id) from audit_log t),
    'payments', (select jsonb_agg(to_jsonb(t) order by id) from payment t),
    'journals', (select jsonb_agg(to_jsonb(t) order by id) from journal_entry t)) as snapshot`)).rows;
  const unchanged = async (work: () => Promise<unknown>) => { const before = await snapshot(); await work(); assert.deepEqual(await snapshot(), before); };
  const denied = async (work: () => Promise<Response>, status: number) => unchanged(async () => data(await work(), status));
  const mcpDenied = async (name: string, args: Record<string, unknown>, client = ma) => unchanged(async () => assert.equal((await client.call(name, args)).isError, true));
  try {
    const [gl, foreignGl] = await db.insert(chartAccount).values([{ organizationId: a.id, code: "1101", name: "Fixture GL", type: "asset" }, { organizationId: b.id, code: "1101", name: "Secret GL", type: "asset" }]).returning();
    const [bank, other, foreign, eur] = await db.insert(bankAccount).values([{ organizationId: a.id, accountName: "Bank", chartAccountId: gl.id }, { organizationId: a.id, accountName: "Other" }, { organizationId: b.id, accountName: "Secret bank" }, { organizationId: a.id, accountName: "EUR", currencyCode: "EUR" }]).returning();
    const [imp] = await db.insert(bankStatementImport).values({ organizationId: a.id, bankAccountId: bank.id, format: "csv", fileName: "fixture.csv", contentHash: "fixture", openingBalance: -1250, closingBalance: 5000000000, metadata: { rawAmount: "12.50", physicalQuantity: 12.5 } }).returning();
    const [t1, t2, out] = await db.insert(bankTransaction).values([{ bankAccountId: bank.id, date: "2026-10-04", description: "Fixture deposit", amount: 1250, balance: null, importId: imp.id }, { bankAccountId: bank.id, date: "2026-10-04", description: "Fixture deposit", amount: 1250, balance: 5000000000 }, { bankAccountId: bank.id, date: "2026-10-04", description: "Fixture withdrawal", amount: -1250 }]).returning();
    await db.insert(bankTransaction).values([{ bankAccountId: other.id, date: "2026-10-04", description: "Fixture deposit", amount: -1250 }, { bankAccountId: foreign.id, date: "2026-10-04", description: "Secret transfer", amount: -1250 }, { bankAccountId: eur.id, date: "2026-10-04", description: "Foreign currency", amount: -1250 }]);
    await unchanged(async () => {
      const listed = await data(await list(req(), params(bank.id))); assert.equal(listed.data.length, 3); assert.equal(listed.pagination.total, 3);
      const row = listed.data.find((r: { id: string }) => r.id === t1.id); assert.equal(row.amount, 1250); assert.equal(row.amountMinor, "1250"); assert.equal(row.balanceMinor, null); assert.equal(row.import.closingBalanceMinor, "5000000000");
      const m = await ma.call("list_bank_transactions", { bankAccountId: bank.id }); assert.equal(m.isError, false); assert.deepEqual(m.body.transactions, listed.data);
      const one = await data(await list(req("limit=1"), params(bank.id))); const two = await data(await list(req("limit=1&page=2"), params(bank.id))); assert.notEqual(one.data[0].id, two.data[0].id);
      assert.equal((await data(await list(req("page=10"), params(bank.id)))).data.length, 0);
      assert.equal((await data(await list(req("status=excluded"), params(bank.id)))).pagination.total, 0);
      const dup = await data(await duplicates(req(), params(bank.id))); assert.equal(dup.totalGroups, 1); assert.equal(dup.duplicateGroups[0].amount, 1250); assert.equal(dup.duplicateGroups[0].amountMinor, "1250"); assert.equal(dup.duplicateGroups[0].transactions.length, 2); assert.equal(typeof dup.duplicateGroups[0].date, "string");
      assert.deepEqual((await ma.call("list_bank_transaction_duplicates", { bankAccountId: bank.id })).body, dup);
      const imported = await data(await imports(req(), params(bank.id))); assert.equal(imported.imports[0].openingBalanceMinor, "-1250"); assert.equal(imported.imports[0].metadata.rawAmount, "12.50"); assert.equal(imported.imports[0].metadata.physicalQuantity, 12.5);
      assert.deepEqual((await ma.call("list_bank_statement_imports", { bankAccountId: bank.id })).body, imported);
    });
    const bankRoutes = [list, imports, duplicates], transactionRoutes = [activity, accounts, matches];
    for (const [routes, id] of [[bankRoutes, bank.id], [transactionRoutes, t1.id]] as const) for (const route of routes) {
      for (const [key, status] of [["dk_read_b", 404], ["dk_invalid", 401], ["dk_read_expired", 401]] as const) await denied(() => route(req("", key), params(id)), status);
      await denied(() => route(req(), params(randomUUID())), 404); await denied(() => route(req(), params("bad")), 400);
    }
    for (const query of ["page=x", "limit=1.5", "page=01", "page=2147483647", "limit=101", "status=oops"]) await denied(() => list(req(query), params(bank.id)), 400);
    for (const route of transactionRoutes) await denied(() => route(req("", "dk_read_viewer"), params(t1.id)), 403);
    await data(await list(req("", "dk_read_viewer"), params(bank.id))); await data(await imports(req("", "dk_read_viewer"), params(bank.id)));
    for (const name of ["get_match_suggestions", "get_bank_transaction_activity", "get_bank_account_suggestions"]) { await mcpDenied(name, { transactionId: t1.id }, mb); await mcpDenied(name, { transactionId: t1.id }, ro); await mcpDenied(name, { transactionId: "bad" }); }
    for (const name of ["list_bank_transactions", "list_bank_statement_imports", "list_bank_transaction_duplicates"]) await mcpDenied(name, { bankAccountId: bank.id }, mb);
    await mcpDenied("list_bank_transactions", { bankAccountId: bank.id, page: 2147483647 }); await mcpDenied("list_bank_transactions", { bankAccountId: bank.id, unexpected: 1 });
    await db.insert(auditLog).values([{ organizationId: a.id, userId: owner.id, entityType: "bank_transaction", entityId: t1.id, action: "categorized", changes: { amount: -1250, allocations: [{ amount: 1250, percent: 12.5 }] } }, { organizationId: b.id, userId: owner.id, entityType: "bank_transaction", entityId: t1.id, action: "secret", changes: { secret: "never expose" } }]);
    const act = await data(await activity(req(), params(t1.id))); assert.equal(act.activity.length, 1); assert.equal(act.activity[0].changes.amountMinor, "-1250"); assert.equal(act.activity[0].changes.allocations[0].amountMinor, "1250"); assert.equal("passwordHash" in act.activity[0].user, false);
    assert.deepEqual((await ma.call("get_bank_transaction_activity", { transactionId: t1.id })).body, act);
    await db.update(bankTransaction).set({ accountId: gl.id }).where(eq(bankTransaction.id, t2.id));
    const suggestions = await data(await accounts(req(), params(t1.id))); assert.equal(suggestions.suggestions[0].accountId, gl.id); assert.equal(suggestions.suggestions[0].matchCount, 1);
    assert.deepEqual((await ma.call("get_bank_account_suggestions", { transactionId: t1.id })).body, suggestions);
    await db.update(bankTransaction).set({ accountId: foreignGl.id }).where(eq(bankTransaction.id, t2.id));
    assert.equal((await data(await accounts(req(), params(t1.id)))).suggestions.length, 0); await denied(() => list(req(), params(bank.id)), 422);
    await db.update(bankTransaction).set({ accountId: gl.id }).where(eq(bankTransaction.id, t2.id));
    const [secretTransfer] = await db.select({ id: bankTransaction.id }).from(bankTransaction).where(eq(bankTransaction.bankAccountId, foreign.id));
    await db.update(bankTransaction).set({ transferTransactionId: secretTransfer.id }).where(eq(bankTransaction.id, t1.id)); await denied(() => list(req(), params(bank.id)), 422);
    await db.update(bankTransaction).set({ transferTransactionId: null, projectId: randomUUID() }).where(eq(bankTransaction.id, t1.id)); await denied(() => list(req(), params(bank.id)), 422);
    await db.update(bankTransaction).set({ projectId: null, costCenterId: randomUUID() }).where(eq(bankTransaction.id, t1.id)); await denied(() => list(req(), params(bank.id)), 422);
    await db.update(bankTransaction).set({ costCenterId: null }).where(eq(bankTransaction.id, t1.id));
    const [customer, secretCustomer] = await db.insert(contact).values([{ organizationId: a.id, name: "Customer" }, { organizationId: b.id, name: "Secret contact" }]).returning();
    const [inv] = await db.insert(invoice).values({ organizationId: a.id, contactId: customer.id, invoiceNumber: "INV-1", issueDate: "2026-10-04", dueDate: "2026-10-04", status: "sent", total: 1250, amountDue: 1250 }).returning();
    await db.insert(invoice).values([{ organizationId: a.id, contactId: customer.id, invoiceNumber: "EUR-1", issueDate: "2026-10-04", dueDate: "2026-10-04", status: "sent", total: 1250, amountDue: 1250, currencyCode: "EUR" }, { organizationId: b.id, contactId: secretCustomer.id, invoiceNumber: "Secret", issueDate: "2026-10-04", dueDate: "2026-10-04", status: "sent", total: 1250, amountDue: 1250 }]);
    const [pay] = await db.insert(payment).values({ organizationId: a.id, contactId: customer.id, bankAccountId: bank.id, paymentNumber: "PAY-1", type: "received", date: "2026-10-04", amount: 1250 }).returning();
    const [entry] = await db.insert(journalEntry).values({ organizationId: a.id, entryNumber: 1, date: "2026-10-04", description: "Fixture deposit", status: "posted" }).returning();
    await db.insert(journalLine).values([{ journalEntryId: entry.id, accountId: gl.id, debitAmount: 3000000000 }, { journalEntryId: entry.id, accountId: gl.id, debitAmount: 2000000000 }, { journalEntryId: entry.id, accountId: gl.id, creditAmount: 4999998750 }]);
    const matched = await data(await matches(req(), params(t1.id))); assert.equal(matched.openInvoices.length, 1); assert.equal(matched.openInvoices[0].totalMinor, "1250");
    assert.equal(matched.suggestedMatches[0].candidate.amountMinor, "1250");
    const existing = matched.existingMatches.map((m: { candidate: { type: string; amountMinor: string } }) => m.candidate);
    for (const type of ["existing_payment", "existing_journal", "transfer"]) assert.equal(existing.find((c: { type: string }) => c.type === type)?.amountMinor, "1250");
    assert.equal(existing.filter((c: { type: string }) => c.type === "transfer").length, 1);
    assert.deepEqual((await ma.call("get_match_suggestions", { transactionId: t1.id })).body, matched);
    const [outBill] = await db.insert(bill).values({ organizationId: a.id, contactId: customer.id, billNumber: "BILL-1", issueDate: "2026-10-04", dueDate: "2026-10-04", status: "received", total: 1250, amountDue: 1250 }).returning();
    await db.insert(bill).values({ organizationId: a.id, contactId: customer.id, billNumber: "EUR-BILL", issueDate: "2026-10-04", dueDate: "2026-10-04", status: "received", total: 1250, amountDue: 1250, currencyCode: "EUR" });
    const outgoing = await data(await matches(req(), params(out.id))); assert.equal(outgoing.openBills.length, 1); assert.equal(outgoing.openBills[0].amountDueMinor, "1250"); assert.equal(outgoing.suggestedMatches[0].candidate.amountMinor, "-1250");
    assert.deepEqual((await ma.call("get_match_suggestions", { transactionId: out.id })).body, outgoing);
    await db.execute(sql`update bill set amount_due = 9007199254740992 where id = ${outBill.id}`); await denied(() => matches(req(), params(out.id)), 422);
    await db.update(bill).set({ amountDue: 1250 }).where(eq(bill.id, outBill.id));
    const [largeEntry] = await db.insert(journalEntry).values({ organizationId: a.id, entryNumber: 2, date: "2026-10-04", description: "Fixture deposit", status: "posted" }).returning();
    await db.insert(journalLine).values([{ journalEntryId: largeEntry.id, accountId: gl.id, debitAmount: 3000000000 }, { journalEntryId: largeEntry.id, accountId: gl.id, debitAmount: 2000000000 }]);
    const large = await data(await matches(req(), params(t1.id)));
    assert.equal(large.existingMatches.find((m: { candidate: { id: string } }) => m.candidate.id === largeEntry.id).candidate.amountMinor, "5000000000");
    await db.update(journalLine).set({ debitAmount: Number.MAX_SAFE_INTEGER }).where(eq(journalLine.journalEntryId, largeEntry.id));
    await denied(() => matches(req(), params(t1.id)), 422); await mcpDenied("get_match_suggestions", { transactionId: t1.id });
    await db.update(journalLine).set({ debitAmount: 1 }).where(eq(journalLine.journalEntryId, largeEntry.id));
    await db.update(journalLine).set({ currencyCode: "EUR" }).where(eq(journalLine.journalEntryId, largeEntry.id)); await denied(() => matches(req(), params(t1.id)), 422);
    await db.update(journalLine).set({ currencyCode: "USD" }).where(eq(journalLine.journalEntryId, largeEntry.id));
    const [foreignEntry] = await db.insert(journalEntry).values({ organizationId: b.id, entryNumber: 1, date: "2026-10-04", description: "Secret journal", status: "posted" }).returning();
    await db.update(payment).set({ journalEntryId: foreignEntry.id }).where(eq(payment.id, pay.id)); await denied(() => matches(req(), params(t1.id)), 422);
    await db.update(payment).set({ journalEntryId: null }).where(eq(payment.id, pay.id));
    await db.update(bankTransaction).set({ journalEntryId: foreignEntry.id }).where(eq(bankTransaction.id, t1.id)); await denied(() => list(req(), params(bank.id)), 422);
    await db.update(bankTransaction).set({ journalEntryId: null }).where(eq(bankTransaction.id, t1.id));
    await db.update(invoice).set({ contactId: secretCustomer.id }).where(eq(invoice.id, inv.id)); await denied(() => matches(req(), params(t1.id)), 422); await mcpDenied("get_match_suggestions", { transactionId: t1.id });
    await db.update(invoice).set({ contactId: customer.id }).where(eq(invoice.id, inv.id));
    await db.execute(sql`update payment set amount = 9007199254740992 where id = ${pay.id}`); await denied(() => matches(req(), params(t1.id)), 422); await mcpDenied("get_match_suggestions", { transactionId: t1.id });
    await db.update(payment).set({ amount: 1250 }).where(eq(payment.id, pay.id));
    await db.update(bankStatementImport).set({ organizationId: b.id }).where(eq(bankStatementImport.id, imp.id));
    await denied(() => imports(req(), params(bank.id)), 422); await denied(() => list(req(), params(bank.id)), 422); await mcpDenied("list_bank_statement_imports", { bankAccountId: bank.id });
    await db.update(bankStatementImport).set({ organizationId: a.id, statementCurrency: "EUR" }).where(eq(bankStatementImport.id, imp.id)); await denied(() => imports(req(), params(bank.id)), 422);
    await db.update(bankStatementImport).set({ statementCurrency: null }).where(eq(bankStatementImport.id, imp.id));
    await db.execute(sql`update bank_statement_import set closing_balance = 9007199254740992 where id = ${imp.id}`); await denied(() => imports(req(), params(bank.id)), 422); await denied(() => list(req(), params(bank.id)), 422);
    await db.update(bankStatementImport).set({ closingBalance: 5000000000 }).where(eq(bankStatementImport.id, imp.id));
    await db.update(bankTransaction).set({ currencyCode: "EUR" }).where(eq(bankTransaction.id, t1.id)); await denied(() => list(req(), params(bank.id)), 422); await denied(() => matches(req(), params(t1.id)), 422);
    await db.update(bankTransaction).set({ currencyCode: null }).where(eq(bankTransaction.id, t1.id));
    await db.execute(sql`update bank_transaction set amount = 9007199254740992 where id in (${t1.id}, ${t2.id})`);
    await denied(() => list(req(), params(bank.id)), 422); await denied(() => duplicates(req(), params(bank.id)), 422); await mcpDenied("list_bank_transaction_duplicates", { bankAccountId: bank.id });
    await db.update(bankTransaction).set({ amount: 1250 }).where(eq(bankTransaction.id, t1.id)); await db.update(bankTransaction).set({ amount: 1250 }).where(eq(bankTransaction.id, t2.id));
    await db.execute(sql`update audit_log set changes = '{"amount":9007199254740992}'::jsonb where organization_id = ${a.id} and entity_id = ${t1.id}`);
    await denied(() => activity(req(), params(t1.id)), 422); await mcpDenied("get_bank_transaction_activity", { transactionId: t1.id });
    await db.update(auditLog).set({ changes: { amount: 1250, amountMinor: "1" } }).where(eq(auditLog.organizationId, a.id)); await denied(() => activity(req(), params(t1.id)), 422);
    await db.update(auditLog).set({ changes: { amount: 1250 } }).where(eq(auditLog.organizationId, a.id));
    await db.execute(sql`update bank_transaction set raw_payload = '{"rawNumber":9007199254740992}'::jsonb where id = ${t1.id}`); await denied(() => list(req(), params(bank.id)), 422);
    await db.update(bankTransaction).set({ rawPayload: null, amount: -Number.MAX_SAFE_INTEGER, balance: Number.MAX_SAFE_INTEGER }).where(eq(bankTransaction.id, t1.id));
    const extrema = await data(await list(req(), params(bank.id))); const edge = extrema.data.find((r: { id: string }) => r.id === t1.id);
    assert.equal(edge.amountMinor, "-9007199254740991"); assert.equal(edge.balanceMinor, "9007199254740991");
    await db.update(bankTransaction).set({ amount: 1250, balance: null }).where(eq(bankTransaction.id, t1.id));
    for (const currencyCode of ["JPY", "KWD", "IRR"]) {
      const [scaleBank] = await db.insert(bankAccount).values({ organizationId: a.id, accountName: currencyCode, currencyCode }).returning();
      await db.insert(bankTransaction).values({ bankAccountId: scaleBank.id, date: "2026-10-04", description: "Scale", amount: -1250 });
      const read = await data(await list(req(), params(scaleBank.id))); assert.equal(read.data[0].amountMinor, "-1250"); assert.equal(read.data[0].currencyCode, currencyCode);
      assert.equal((await ma.call("list_bank_transactions", { bankAccountId: scaleBank.id })).body.transactions[0].amount, -1250);
    }
    await db.update(bankAccount).set({ deletedAt: new Date() }).where(eq(bankAccount.id, bank.id));
    for (const route of bankRoutes) await denied(() => route(req(), params(bank.id)), 404);
    for (const route of transactionRoutes) await denied(() => route(req(), params(out.id)), 404);
    console.log("REST and MCP bank transaction reads verified");
  } finally { await ma.close(); await mb.close(); await ro.close(); }
}
run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
