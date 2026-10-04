import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, customRole, subscription, chartAccount, bankTransaction, bankStatementImport, journalEntry, journalLine, notification } from "../../lib/db/schema";
import { GET as list, POST as create } from "../../app/api/v1/bank-accounts/route";
import { GET as get, PATCH as edit, DELETE as remove } from "../../app/api/v1/bank-accounts/[id]/route";
import { GET as validate } from "../../app/api/v1/bank-accounts/[id]/validate-balance/route";
import { PATCH as alert } from "../../app/api/v1/bank-accounts/[id]/balance-alert/route";
import { registerBankAccountTools } from "../../lib/mcp/tools/bank-accounts";
import { registerBankRuleTools } from "../../lib/mcp/tools/bank-rules";
import { checkLowBankBalances } from "../../lib/api/bank-balance-alerts";
import type { AuthContext } from "../../lib/api/auth-context";

async function mcp(ctx: AuthContext) {
  const server = new McpServer({ name: "Bank fixture", version: "1" }); registerBankAccountTools(server, ctx); registerBankRuleTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1" }); const [ct, st] = InMemoryTransport.createLinkedPair();
  await server.connect(st); await client.connect(ct);
  const all = (await client.listTools()).tools;
  const names = all.map(t => t.name); assert.equal(names.length, new Set(names).size);
  for (const tool of all.filter(t => ["create_bank_account", "update_bank_account", "set_bank_balance_alert"].includes(t.name)))
    for (const field of Object.values(tool.inputSchema.properties ?? {})) assert.ok((field as { description?: string }).description);
  for (const op of ["list_bank_accounts", "get_bank_account", "create_bank_account", "update_bank_account", "delete_bank_account", "validate_bank_balance", "set_bank_balance_alert"]) assert.ok(names.includes(op));
  return { async call(name: string, args: Record<string, unknown> = {}) { const result = await client.callTool({ name, arguments: args });
    const text = (result.content as { text: string }[])[0].text; return { isError: result.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } }; },
    async close() { await client.close(); await server.close(); } };
}
async function run() {
  const [a, b] = await db.insert(organization).values([{ name: "Bank A", slug: "bank-a" }, { name: "Bank B", slug: "bank-b" }]).returning();
  const [owner, viewer] = await db.insert(users).values([{ email: "bank-owner@example.test" }, { email: "bank-viewer@example.test" }]).returning();
  const [readRole] = await db.insert(customRole).values({ organizationId: a.id, name: "Read", permissions: [] }).returning();
  await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner" }, { organizationId: b.id, userId: owner.id, role: "owner" },
    { organizationId: a.id, userId: viewer.id, customRoleId: readRole.id }]);
  await db.insert(subscription).values([{ organizationId: a.id, plan: "pro", overrideBankAccounts: 1000 }, { organizationId: b.id, plan: "pro" }]);
  const keys = { a: "dk_bank_a", b: "dk_bank_b", viewer: "dk_bank_viewer", expired: "dk_bank_expired" };
  for (const [label, key] of Object.entries(keys)) await db.insert(apiKey).values({ organizationId: label === "b" ? b.id : a.id,
    createdBy: label === "viewer" ? viewer.id : owner.id, name: label, keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_bank",
    expiresAt: label === "expired" ? new Date("2020-01-01") : null });
  const ctx: AuthContext = { userId: owner.id, organizationId: a.id, role: "owner" };
  const ma = await mcp(ctx), mb = await mcp({ ...ctx, organizationId: b.id }), ro = await mcp({ ...ctx, userId: viewer.id, role: "member", permissions: [] });
  const req = (body: unknown = {}, key = keys.a) => new Request("http://fixture.test/api/v1/bank-accounts", { method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-organization-id": b.id }, body: JSON.stringify(body) });
  const params = (id: string) => ({ params: Promise.resolve({ id }) });
  const data = async (response: Response, status = 200) => { const value = await response.json(); assert.equal(response.status, status, JSON.stringify(value)); return value; };
  const tables = ["bank_account", "chart_account", "bank_transaction", "bank_statement_import", "journal_entry", "journal_line"];
  const snapshot = async () => [...await Promise.all(tables.map(t => db.execute(sql.raw(`select coalesce(jsonb_agg(to_jsonb(t)::text order by t.id),'[]'::jsonb) as rows from ${t} t`)).then(r => r.rows))),
    (await db.execute(sql`select coalesce(jsonb_agg(to_jsonb(t)::text order by t.id),'[]'::jsonb) as rows from audit_log t where entity_type <> 'api_key'`)).rows];
  const denied = async (fn: () => Promise<Response>, status: number) => { const before = await snapshot(); await data(await fn(), status); assert.deepEqual(await snapshot(), before); };
  const mcpDenied = async (name: string, args: Record<string, unknown>, client = ma) => { const before = await snapshot(); assert.equal((await client.call(name, args)).isError, true); assert.deepEqual(await snapshot(), before); };
  const newBank = async (extra = {}) => (await data(await create(req({ accountName: "Bank", ...extra })), 201)).bankAccount;
  try {
    const basic = await newBank({ balance: -1250, balanceMinor: "-1250" }); assert.equal(basic.balanceMinor, "-1250");
    assert.ok(basic.chartAccountId); assert.equal((await data(await get(req(), params(basic.id)))).bankAccount.chartAccount.type, "asset");
    assert.equal((await data(await list(req()))).bankAccounts.length, 1);
    assert.equal((await ma.call("get_bank_account", { bankAccountId: basic.id })).body.bankAccount.balance, -1250);
    assert.equal((await mb.call("list_bank_accounts")).body.bankAccounts.length, 0);
    const routes = [get, edit, remove, validate, alert];
    for (const key of [keys.b, "dk_invalid", keys.expired]) for (const route of routes)
      await denied(() => route(req(route === alert ? { threshold: 0 } : {}, key), params(basic.id)), key === keys.b ? 404 : 401);
    for (const route of [edit, remove, alert]) await denied(() => route(req({}, keys.viewer), params(basic.id)), 403);
    await denied(() => create(req({ accountName: "Denied" }, keys.viewer)), 403);
    for (const route of routes) { await denied(() => route(req(route === alert ? { threshold: 0 } : {}), params(randomUUID())), 404); await denied(() => route(req(), params("bad")), 400); }
    for (const name of ["get_bank_account", "update_bank_account", "delete_bank_account", "validate_bank_balance", "set_bank_balance_alert"]) {
      await mcpDenied(name, { bankAccountId: basic.id }, mb);
      await mcpDenied(name, { bankAccountId: basic.id, amountMinor: "1" });
    }
    for (const name of ["update_bank_account", "delete_bank_account", "set_bank_balance_alert"]) await mcpDenied(name, { bankAccountId: basic.id }, ro);
    await mcpDenied("create_bank_account", { accountName: "Denied" }, ro);
    for (const extra of [{ balanceMinor: "01" }, { balance: 1.5 }, { balance: 1, balanceMinor: "2" }, { balanceMinor: "9223372036854775808" }, { lowBalanceThreshold: 1 }]) {
      await denied(() => create(req({ accountName: "Bad", ...extra })), 400); await mcpDenied("create_bank_account", { accountName: "Bad", ...extra });
    }
    for (const amount of ["9007199254740992", "-9007199254740992"]) {
      await denied(() => create(req({ accountName: "Too large", balanceMinor: amount })), 422);
      await denied(() => edit(req({ balanceMinor: amount }), params(basic.id)), 422);
      await denied(() => alert(req({ thresholdMinor: amount }), params(basic.id)), 422);
      await mcpDenied("create_bank_account", { accountName: "Too large", balanceMinor: amount });
    }
    for (const amount of ["9007199254740991", "-9007199254740991"]) {
      const saved = await newBank({ balanceMinor: amount }); assert.equal(saved.balanceMinor, amount);
      assert.equal((await ma.call("set_bank_balance_alert", { bankAccountId: saved.id, thresholdMinor: amount })).body.lowBalanceThresholdMinor, amount);
      await data(await remove(req(), params(saved.id))); await data(await get(req(), params(saved.id)), 404);
    }
    for (const currencyCode of ["USD", "JPY", "KWD", "IRR"]) {
      const saved = await newBank({ currencyCode, balanceMinor: "1250" });
      assert.equal(saved.balance, 1250); assert.equal(saved.balanceMinor, "1250");
      const updated = (await data(await edit(req({ accountName: "Renamed" }), params(saved.id)))).bankAccount;
      assert.equal(updated.currencyCode, currencyCode); assert.equal(updated.balanceMinor, "1250");
    }
    const [foreign, wrong, inactive, mismatch] = await db.insert(chartAccount).values([
      { organizationId: b.id, code: "1100", name: "Foreign", type: "asset" }, { organizationId: a.id, code: "4000", name: "Revenue", type: "revenue" },
      { organizationId: a.id, code: "1190", name: "Inactive", type: "asset", isActive: false }, { organizationId: a.id, code: "1191", name: "EUR", type: "asset", currencyCode: "EUR" }]).returning();
    for (const [id, status] of [[foreign.id, 422], [wrong.id, 422], [inactive.id, 400], [mismatch.id, 422], [basic.chartAccountId, 400]] as const) {
      await denied(() => create(req({ accountName: "Bad GL", chartAccountId: id })), status);
      await mcpDenied("create_bank_account", { accountName: "Bad GL", chartAccountId: id });
    }
    const empty = await newBank(); const currencyChanged = (await data(await edit(req({ currencyCode: "EUR" }), params(empty.id)))).bankAccount;
    assert.notEqual(currencyChanged.chartAccountId, empty.chartAccountId);
    assert.equal((await data(await get(req(), params(empty.id)))).bankAccount.chartAccount.currencyCode, "EUR");
    await denied(() => edit(req({ currencyCode: "EUR", balance: 0 }), params(basic.id)), 400);
    const card = (await ma.call("create_bank_account", { accountName: "Card", accountType: "credit_card", balanceMinor: "-100" })).body.bankAccount;
    assert.equal((await data(await get(req(), params(card.id)))).bankAccount.chartAccount.type, "liability");
    const legacyMcp = (await ma.call("create_bank_account", { accountName: "Legacy MCP", balance: -1250 })).body.bankAccount;
    assert.equal(legacyMcp.balanceMinor, "-1250");
    assert.equal((await ma.call("set_bank_balance_alert", { bankAccountId: legacyMcp.id, threshold: -2000 })).body.lowBalanceThresholdMinor, "-2000");
    assert.equal((await ma.call("delete_bank_account", { bankAccountId: legacyMcp.id })).body.success, true);
    assert.equal((await ma.call("get_bank_account", { bankAccountId: legacyMcp.id })).isError, true);
    const alertResult = await data(await alert(req({ threshold: -1000, thresholdMinor: "-1000" }), params(basic.id)));
    assert.equal(alertResult.currentBalanceMinor, "-1250"); assert.equal(alertResult.lowBalanceThresholdMinor, "-1000");
    await denied(() => alert(req({ threshold: null, thresholdMinor: "0" }), params(basic.id)), 400);
    assert.equal((await ma.call("set_bank_balance_alert", { bankAccountId: basic.id, thresholdMinor: null })).body.lowBalanceThreshold, null);
    assert.equal((await ma.call("update_bank_account", { bankAccountId: basic.id, balanceMinor: "5000000000" })).body.bankAccount.balance, 5000000000);
    await db.insert(bankTransaction).values([{ bankAccountId: basic.id, date: "2026-10-01", description: "First", amount: 3000000000, balance: 3000000000 },
      { bankAccountId: basic.id, date: "2026-10-02", description: "Second", amount: 2000000000, balance: 5000000000 }]);
    const [imp] = await db.insert(bankStatementImport).values({ organizationId: a.id, bankAccountId: basic.id, format: "csv", fileName: "fixture.csv", contentHash: "fixture", closingBalance: 5000000000, statementEndDate: "2026-10-02" }).returning();
    const balanced = await data(await validate(req(), params(basic.id))); assert.equal(balanced.transactionSumMinor, "5000000000"); assert.equal(balanced.transactionCount, 2); assert.equal(balanced.isBalanced, true);
    assert.equal((await ma.call("validate_bank_balance", { bankAccountId: basic.id })).body.transactionSum, 5000000000);
    await data(await edit(req({ balanceMinor: "5000000001" }), params(basic.id)));
    assert.match((await data(await validate(req(), params(basic.id)))).issues[0], /1 minor units \(USD\)/);
    for (const body of [{ currencyCode: "EUR" }, { chartAccountId: null }, { accountType: "savings" }]) await denied(() => edit(req(body), params(basic.id)), 400);
    await db.update(bankStatementImport).set({ statementCurrency: "EUR" }).where(eq(bankStatementImport.id, imp.id)); await data(await validate(req(), params(basic.id)), 422);
    await db.update(bankStatementImport).set({ statementCurrency: null }).where(eq(bankStatementImport.id, imp.id));
    await db.update(bankTransaction).set({ currencyCode: "EUR" }).where(eq(bankTransaction.bankAccountId, basic.id)); await data(await validate(req(), params(basic.id)), 422);
    await db.update(bankTransaction).set({ currencyCode: null }).where(eq(bankTransaction.bankAccountId, basic.id));
    await db.update(bankStatementImport).set({ organizationId: b.id }).where(eq(bankStatementImport.id, imp.id));
    await data(await validate(req(), params(basic.id)), 422); await mcpDenied("validate_bank_balance", { bankAccountId: basic.id });
    await db.update(bankStatementImport).set({ organizationId: a.id }).where(eq(bankStatementImport.id, imp.id));
    const range = await newBank({ balanceMinor: "9007199254740991" });
    await db.insert(bankTransaction).values([{ bankAccountId: range.id, date: "2026-10-01", description: "Max", amount: Number.MAX_SAFE_INTEGER },
      { bankAccountId: range.id, date: "2026-10-02", description: "Overflow", amount: 1 }]);
    await data(await validate(req(), params(range.id)), 422); await mcpDenied("validate_bank_balance", { bankAccountId: range.id });
    await db.delete(bankTransaction).where(eq(bankTransaction.bankAccountId, range.id));
    // Cancellation cannot hide individually unsupported saved operands.
    await db.execute(sql`insert into bank_transaction (bank_account_id, date, description, amount) values
      (${range.id}, '2026-10-01', 'Unsafe positive', 9007199254740992), (${range.id}, '2026-10-02', 'Unsafe negative', -9007199254740992)`);
    await data(await validate(req(), params(range.id)), 422);
    await db.delete(bankTransaction).where(eq(bankTransaction.bankAccountId, range.id));
    await db.insert(bankTransaction).values({ bankAccountId: range.id, date: "2026-10-01", description: "Difference overflow", amount: 0, balance: -Number.MAX_SAFE_INTEGER });
    await data(await validate(req(), params(range.id)), 422);
    await db.delete(bankTransaction).where(eq(bankTransaction.bankAccountId, range.id));
    const noStatement = await data(await validate(req(), params(range.id)));
    assert.equal(noStatement.transactionSum, 0); assert.equal(noStatement.latestTransactionBalanceMinor, null);
    assert.equal(noStatement.lastImportClosingBalanceMinor, null); assert.equal(noStatement.isBalanced, true);
    const glHistory = await newBank(); const [entry] = await db.insert(journalEntry).values({ organizationId: a.id, entryNumber: 1, date: "2026-10-01", description: "Opening", sourceType: "opening_balance", status: "posted" }).returning();
    await db.insert(journalLine).values({ journalEntryId: entry.id, accountId: glHistory.chartAccountId, debitAmount: 1 });
    await denied(() => edit(req({ chartAccountId: null }), params(glHistory.id)), 400);
    const unsafe = await newBank(); await db.execute(sql`update bank_account set balance = 9007199254740992 where id = ${unsafe.id}`);
    for (const route of [get, edit, remove, validate, alert]) await denied(() => route(req(route === alert ? { threshold: 0 } : {}), params(unsafe.id)), 422);
    await data(await list(req()), 422); await mcpDenied("delete_bank_account", { bankAccountId: unsafe.id });
    await db.execute(sql`update bank_account set balance = 0 where id = ${unsafe.id}`);
    await db.execute(sql`update bank_account set low_balance_threshold = 9007199254740992 where id = ${unsafe.id}`);
    await denied(() => alert(req({ threshold: null }), params(unsafe.id)), 422);
    await db.execute(sql`update bank_account set low_balance_threshold = null, chart_account_id = ${foreign.id} where id = ${unsafe.id}`);
    await data(await get(req(), params(unsafe.id)), 422); await mcpDenied("get_bank_account", { bankAccountId: unsafe.id });
    await db.execute(sql`update bank_account set chart_account_id = null where id = ${unsafe.id}`);
    await db.execute(sql`create function reject_bank_audit() returns trigger language plpgsql as $$ begin if NEW.entity_type = 'bank_account' then raise exception 'synthetic bank audit failure'; end if; return NEW; end $$`);
    await db.execute(sql`create trigger reject_bank_audit before insert on audit_log for each row execute function reject_bank_audit()`);
    const originalError = console.error; console.error = () => {};
    try {
    await denied(() => create(req({ accountName: "Rollback" })), 500); await denied(() => edit(req({ balance: 1 }), params(basic.id)), 500);
    await denied(() => remove(req(), params(basic.id)), 500); await denied(() => alert(req({ threshold: 1 }), params(basic.id)), 500);
    await mcpDenied("create_bank_account", { accountName: "Rollback" }); await mcpDenied("delete_bank_account", { bankAccountId: basic.id });
    await mcpDenied("update_bank_account", { bankAccountId: basic.id, balanceMinor: "1" });
    await mcpDenied("set_bank_balance_alert", { bankAccountId: basic.id, thresholdMinor: "1" });
    } finally { console.error = originalError; }
    await db.execute(sql`drop trigger reject_bank_audit on audit_log`); await db.execute(sql`drop function reject_bank_audit()`);
    const concurrent = await Promise.all([newBank(), ma.call("create_bank_account", { accountName: "Parallel" })]);
    assert.notEqual(concurrent[0].chartAccountId, concurrent[1].body.bankAccount.chartAccountId);
    const deleted = await Promise.all([remove(req(), params(concurrent[0].id)), ma.call("delete_bank_account", { bankAccountId: concurrent[0].id })]);
    assert.equal((deleted[0].status === 200 ? 1 : 0) + (deleted[1].isError ? 0 : 1), 1);
    const [claimGl] = await db.insert(chartAccount).values({ organizationId: a.id, code: "1199", name: "Claim once", type: "asset" }).returning();
    const claims = await Promise.all([create(req({ accountName: "Claim", chartAccountId: claimGl.id })), ma.call("create_bank_account", { accountName: "Claim", chartAccountId: claimGl.id })]);
    assert.equal((claims[0].status === 201 ? 1 : 0) + (claims[1].isError ? 0 : 1), 1);
    for (const [currencyCode, balance, threshold, text] of [["JPY", "1250", "1251", "JPY 1250"], ["KWD", "1250", "1251", "KWD 1.250"], ["IRR", "-1250", "0", "IRR -1250"], ["USD", "9007199254740990", "9007199254740991", "USD 90071992547409.90"]]) {
      const row = await newBank({ currencyCode, balanceMinor: balance }); await data(await alert(req({ thresholdMinor: threshold }), params(row.id)));
      await checkLowBankBalances(); const [notice] = await db.select().from(notification).where(eq(notification.entityId, row.id)); assert.ok(notice.body?.includes(text));
    }
    const firstNotices = await db.select().from(notification); await checkLowBankBalances(); assert.equal((await db.select().from(notification)).length, firstNotices.length);
    assert.ok(firstNotices.every(n => n.organizationId === a.id && n.userId === owner.id));
    for (const fields of [{ isActive: false }, { deletedAt: new Date() }]) {
      const row = await newBank({ balanceMinor: "-1" }); await data(await alert(req({ threshold: 0 }), params(row.id)));
      if ("isActive" in fields) await data(await edit(req(fields), params(row.id)));
      else await data(await remove(req(), params(row.id)));
      await checkLowBankBalances(); assert.equal((await db.select().from(notification).where(eq(notification.entityId, row.id))).length, 0);
    }
    const equal = await newBank({ balance: 100 }); await data(await alert(req({ threshold: 100 }), params(equal.id)));
    await checkLowBankBalances(); assert.equal((await db.select().from(notification).where(eq(notification.entityId, equal.id))).length, 0);
    // Job's text-only formatting covers full stored int64 even when CRUD's numeric contract rejects it.
    const historical = await newBank(); await db.execute(sql`update bank_account set balance = -9223372036854775808, low_balance_threshold = 9223372036854775807 where id = ${historical.id}`);
    const malformed = await newBank(); await db.execute(sql`update bank_account set balance = -1, low_balance_threshold = 0, currency_code = 'UNKNOWN' where id = ${malformed.id}`);
    await checkLowBankBalances();
    const [historicalNotice] = await db.select().from(notification).where(eq(notification.entityId, historical.id));
    assert.match(historicalNotice.body!, /USD -92233720368547758\.08/); assert.match(historicalNotice.body!, /USD 92233720368547758\.07/);
    assert.equal((await db.select().from(notification).where(eq(notification.entityId, malformed.id))).length, 0);
    await db.update(subscription).set({ overrideBankAccounts: 0 }).where(eq(subscription.organizationId, a.id));
    // Enable only local plan checks; these operations never contact Stripe.
    process.env.STRIPE_SECRET_KEY = "sk_test_synthetic_bank_fixture";
    await denied(() => create(req({ accountName: "Plan limited" })), 403); await mcpDenied("create_bank_account", { accountName: "Plan limited" });
    await db.update(subscription).set({ overrideBankAccounts: 1000, overrideMultiCurrency: false }).where(eq(subscription.organizationId, a.id));
    await denied(() => create(req({ accountName: "Currency limited", currencyCode: "EUR" })), 403);
    console.log("REST and MCP bank accounts verified");
  } finally { await ma.close(); await mb.close(); await ro.close(); }
}
run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
