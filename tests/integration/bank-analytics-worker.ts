import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, customRole, subscription, bankAccount, bankTransaction, bankStatementImport, bankReconciliation } from "../../lib/db/schema";
import { GET as cashFlow } from "../../app/api/v1/reports/bank-cash-flow/route";
import { GET as status } from "../../app/api/v1/reports/bank-reconciliation-status/route";
import { registerBankAnalyticsTools } from "../../lib/mcp/tools/bank-analytics";
import { createBankAccount } from "../../lib/api/bank-accounts";
import { forecastAddDays } from "../../lib/reports/forecast-fx-wire";
import type { AuthContext } from "../../lib/api/auth-context";

async function mcp(ctx: AuthContext) {
  const server = new McpServer({ name: "Bank analytics fixture", version: "1" }); registerBankAnalyticsTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1" });
  const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
  for (const tool of (await client.listTools()).tools) {
    assert.ok(tool.description);
    for (const field of Object.values(tool.inputSchema.properties ?? {})) assert.ok((field as { description?: string }).description);
  }
  return { async call(name: string, args: Record<string, unknown> = {}) {
    const result = await client.callTool({ name, arguments: args });
    const text = (result.content as { text: string }[])[0].text;
    return { isError: result.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
  }, async close() { await client.close(); await server.close(); } };
}

async function run() {
  const [a, b] = await db.insert(organization).values([{ name: "Bank A", slug: "bank-a" }, { name: "Bank B", slug: "bank-b" }]).returning();
  const [owner, denied] = await db.insert(users).values([{ email: "bank-owner@example.test" }, { email: "bank-denied@example.test" }]).returning();
  const [role] = await db.insert(customRole).values({ organizationId: a.id, name: "No read", permissions: [] }).returning();
  await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner" }, { organizationId: b.id, userId: owner.id, role: "owner" },
    { organizationId: a.id, userId: denied.id, role: "member", customRoleId: role.id }]);
  await db.insert(subscription).values({ organizationId: a.id, plan: "pro", overrideBankAccounts: 100 });
  const keys = { a: "dk_bank_analytics_a", b: "dk_bank_analytics_b", denied: "dk_bank_analytics_denied" };
  for (const [label, key] of Object.entries(keys)) await db.insert(apiKey).values({ organizationId: label === "b" ? b.id : a.id,
    createdBy: label === "denied" ? denied.id : owner.id, name: label, keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_bank" });
  const ctx: AuthContext = { userId: owner.id, organizationId: a.id, role: "owner" };
  const ma = await mcp(ctx), mb = await mcp({ ...ctx, organizationId: b.id }), noRead = await mcp({ ...ctx, permissions: [] });
  const args = { startDate: "2024-02-01", endDate: "2024-03-31" }, query = "?startDate=2024-02-01&endDate=2024-03-31";
  const request = (suffix = "", key = keys.a) => new Request(`http://fixture.test/report${suffix}`, { headers: { authorization: `Bearer ${key}`, "x-organization-id": b.id } });
  const body = async (handler: typeof status, suffix = "") => { const r = await handler(request(suffix)); assert.equal(r.status, 200); return r.json(); };
  const seed = async (org: string, name: string, options: { deleted?: boolean; inactive?: boolean; currency?: string } = {}) =>
    (await db.insert(bankAccount).values({ organizationId: org, accountName: name, currencyCode: options.currency ?? "USD",
      isActive: !options.inactive, deletedAt: options.deleted ? new Date() : null }).returning())[0];
  const txn = async (id: string, amount: number, date = "2024-03-01", state: "unreconciled" | "reconciled" | "excluded" = "unreconciled") =>
    (await db.insert(bankTransaction).values({ bankAccountId: id, amount, date, description: "Synthetic", status: state }).returning())[0];
  const clear = () => db.delete(bankTransaction);
  const snapshot = async () => {
    const result: Record<string, unknown> = {};
    for (const table of ["bank_account", "bank_transaction", "bank_statement_import", "bank_reconciliation", "journal_entry", "journal_line", "audit_log"])
      result[table] = (await db.execute(sql.raw(`select row_to_json(t) as row from ${table} t order by id`))).rows;
    return result;
  };
  try {
    for (const [handler, tool, input, suffix] of [[cashFlow, "bank_cash_flow", args, query], [status, "bank_reconciliation_status", {}, ""]] as const) {
      assert.deepEqual((await ma.call(tool, input)).body, await body(handler, suffix));
      assert.deepEqual((await ma.call(tool)).body, await body(handler));
      assert.equal((await handler(request(suffix, "dk_invalid"))).status, 401);
      assert.equal((await handler(request(suffix, keys.denied))).status, 403); assert.equal((await noRead.call(tool, input)).body.status, 403);
      for (const invalid of ["?unknown=1", "?bankAccountId=", "?bankAccountId=x", `?bankAccountId=${randomUUID()}&bankAccountId=${randomUUID()}`])
        assert.equal((await handler(request(invalid))).status, 400);
    }
    for (const suffix of ["?startDate=2023-02-29", "?startDate=", "?startDate=2024-04-01&endDate=2024-03-01", "?groupBy=year", "?currencyCode=usd", "?groupBy=day&groupBy=week"])
      assert.equal((await cashFlow(request(suffix))).status, 400);
    for (const invalid of [{ groupBy: "year" }, { startDate: "2024-02-30" }, { currencyCode: "XXX" }, { bankAccountId: "bad" }])
      assert.equal((await ma.call("bank_cash_flow", invalid)).isError, true);
    const local = await seed(a.id, "Local"), foreign = await seed(b.id, "Foreign secret"), deleted = await seed(a.id, "Deleted secret", { deleted: true }), inactive = await seed(a.id, "Inactive", { inactive: true });
    for (const id of [foreign.id, deleted.id, randomUUID()]) {
      assert.equal((await cashFlow(request(query + `&bankAccountId=${id}`))).status, 404);
      assert.equal((await ma.call("bank_cash_flow", { ...args, bankAccountId: id })).body.status, 404);
      assert.equal((await status(request(`?bankAccountId=${id}`))).status, 404);
      assert.equal((await ma.call("bank_reconciliation_status", { bankAccountId: id })).body.status, 404);
    }
    assert.equal((await status(request(`?bankAccountId=${inactive.id}`))).status, 404);
    await txn(local.id, 1250, "2024-02-29"); await txn(local.id, -250, "2024-03-01", "reconciled"); await txn(local.id, 500, "2024-03-31");
    await txn(local.id, 999, "2024-01-31"); await txn(local.id, 999, "2024-04-01"); await txn(local.id, 999, "2024-03-01", "excluded");
    await txn(foreign.id, 777); await txn(deleted.id, 999); await txn(inactive.id, -100);
    const cash = await body(cashFlow, query); assert.equal(cash.totals.inflowsMinor, "1750"); assert.equal(cash.totals.outflowsMinor, "-350"); assert.equal(cash.totals.netMinor, "1400");
    assert.equal(cash.periods[0].endDate, "2024-02-29"); assert.equal(cash.periods[1].balanceMinor, "1400");
    assert.deepEqual((await ma.call("bank_cash_flow", args)).body, cash);
    for (const groupBy of ["day", "week"])
      assert.deepEqual((await ma.call("bank_cash_flow", { ...args, groupBy })).body, await body(cashFlow, query + `&groupBy=${groupBy}`));
    const foreignCash = await (await cashFlow(request(query, keys.b))).json(); assert.equal(foreignCash.totals.netMinor, "777");
    assert.deepEqual((await mb.call("bank_cash_flow", args)).body, foreignCash);
    const foreignRecon = await (await status(request("", keys.b))).json();
    assert.equal(foreignRecon.accounts[0].unreconciled.totalMinor, "777");
    assert.deepEqual((await mb.call("bank_reconciliation_status")).body, foreignRecon);
    await clear();
    const today = new Date().toISOString().slice(0, 10);
    for (const days of [0, 7, 8, 30, 31, 60, 61, -1]) await txn(local.id, days % 2 ? -100 : 100, forecastAddDays(today, -days));
    await txn(local.id, 300, today, "reconciled"); await txn(local.id, 999, forecastAddDays(today, 90), "excluded");
    await db.update(bankAccount).set({ balance: 1000 }).where(eq(bankAccount.id, local.id));
    await db.insert(bankStatementImport).values([{ organizationId: a.id, bankAccountId: local.id, format: "csv", fileName: "Local import", contentHash: "one", statementEndDate: forecastAddDays(today, -3) },
      { organizationId: b.id, bankAccountId: local.id, format: "csv", fileName: "Foreign secret", contentHash: "two", createdAt: new Date(Date.now() + 86400000) }]);
    await db.insert(bankReconciliation).values({ bankAccountId: local.id, startDate: "2024-01-01", endDate: "2024-03-31", status: "completed" });
    const recon = await body(status); assert.equal(recon.accounts.length, 1); const r = recon.accounts[0];
    assert.equal(r.balanceMinor, "1000"); assert.equal(r.unreconciled.totalMinor, "800"); assert.equal(r.unreconciled.count, 8);
    assert.equal(r.balanceDiscrepancyMinor, "700"); assert.equal(r.lastImport.fileName, "Local import"); assert.equal(r.gaps.gapDays, 4);
    for (const bucket of ["week", "month", "twoMonths", "older"]) { assert.equal(r.unreconciled.aging[bucket].count, 2); assert.equal(r.unreconciled.aging[bucket].totalMinor, "200"); }
    assert.deepEqual((await ma.call("bank_reconciliation_status")).body, recon); assert.ok(!JSON.stringify(recon).includes("secret"));
    assert.deepEqual((await ma.call("bank_reconciliation_status", { bankAccountId: local.id })).body, await body(status, `?bankAccountId=${local.id}`));
    const saved = await snapshot(); await body(cashFlow, query); await ma.call("bank_cash_flow", args); await body(status); await ma.call("bank_reconciliation_status");
    assert.deepEqual(await snapshot(), saved);
    await clear();
    for (const balance of [{ balance: 1250 }, { balanceMinor: "1250" }]) {
      const created = await createBankAccount(ctx, { accountName: "Client", ...balance });
      const output = await body(status, `?bankAccountId=${created.bankAccount.id}`); assert.equal(output.accounts[0].balanceMinor, "1250");
      assert.deepEqual((await ma.call("bank_reconciliation_status", { bankAccountId: created.bankAccount.id })).body, output);
    }
    for (const currencyCode of ["USD", "IRR", "JPY", "KWD"]) {
      await db.update(bankAccount).set({ currencyCode }).where(eq(bankAccount.id, local.id));
      await txn(local.id, 1250); await txn(local.id, -250);
      const output = await body(cashFlow, query + `&bankAccountId=${local.id}`); assert.equal(output.totals.netMinor, "1000"); assert.equal(output.currencyCode, currencyCode);
      assert.deepEqual((await ma.call("bank_cash_flow", { ...args, bankAccountId: local.id })).body, output);
      const rec = await body(status, `?bankAccountId=${local.id}`); assert.equal(rec.accounts[0].balanceMinor, "1000"); assert.equal(rec.accounts[0].currencyCode, currencyCode);
      if (currencyCode !== "USD") {
        assert.equal((await cashFlow(request(query))).status, 422); assert.equal((await ma.call("bank_cash_flow", args)).body.code, "LEGACY_NUMERIC_RANGE");
        assert.deepEqual((await ma.call("bank_cash_flow", { ...args, currencyCode })).body, await body(cashFlow, query + `&currencyCode=${currencyCode}`));
        assert.equal((await cashFlow(request(query + `&bankAccountId=${local.id}&currencyCode=USD`))).status, 422);
      }
      await clear();
    }
    await db.update(bankAccount).set({ currencyCode: "USD", balance: 0 }).where(eq(bankAccount.id, local.id));
    const cashSuffix = query + `&bankAccountId=${local.id}`, statusSuffix = `?bankAccountId=${local.id}`;
    const limit = Number.MAX_SAFE_INTEGER;
    for (const sign of [1, -1]) {
      await txn(local.id, sign * limit); assert.equal((await cashFlow(request(cashSuffix))).status, 200); assert.equal((await status(request(statusSuffix))).status, 200);
      await txn(local.id, sign); const before = await snapshot();
      for (const [handler, tool, suffix, input] of [[cashFlow, "bank_cash_flow", cashSuffix, { ...args, bankAccountId: local.id }], [status, "bank_reconciliation_status", statusSuffix, { bankAccountId: local.id }]] as const) {
        assert.equal((await handler(request(suffix))).status, 422); assert.equal((await ma.call(tool, input)).body.code, "LEGACY_NUMERIC_RANGE");
      }
      assert.deepEqual(await snapshot(), before); await clear();
    }
    await txn(local.id, limit, "2024-02-01"); await txn(local.id, 1, "2024-03-01"); assert.equal((await cashFlow(request(cashSuffix))).status, 422); await clear();
    await db.update(bankAccount).set({ balance: limit }).where(eq(bankAccount.id, local.id)); await txn(local.id, -1);
    assert.equal((await status(request(statusSuffix))).status, 422); await clear();
    await db.execute(sql`update bank_account set balance = 9007199254740992 where id = ${local.id}`);
    assert.equal((await status(request(statusSuffix))).status, 422);
    await db.update(bankAccount).set({ balance: 0 }).where(eq(bankAccount.id, local.id));
    await db.execute(sql`insert into bank_transaction (bank_account_id,date,description,amount,status) values
      (${local.id},'2024-03-01','Positive int64',9223372036854775807,'reconciled'),
      (${local.id},'2024-03-01','Negative int64',-9223372036854775807,'reconciled')`);
    const cancelled = await body(status, statusSuffix); assert.equal(cancelled.accounts[0].balanceDiscrepancyMinor, "0");
    assert.deepEqual((await ma.call("bank_reconciliation_status", { bankAccountId: local.id })).body, cancelled);
    await clear();
    await db.execute(sql`insert into bank_transaction (bank_account_id,date,description,amount,status) values (${local.id},'2024-03-01','Int64 minimum',-9223372036854775808,'unreconciled')`);
    assert.equal((await status(request(statusSuffix))).status, 422); assert.equal((await cashFlow(request(cashSuffix))).status, 422); await clear();
    const mismatch = await txn(local.id, 1); await db.update(bankTransaction).set({ currencyCode: "KWD" }).where(eq(bankTransaction.id, mismatch.id));
    for (const [handler, tool, suffix, input] of [[cashFlow, "bank_cash_flow", cashSuffix, { ...args, bankAccountId: local.id }], [status, "bank_reconciliation_status", statusSuffix, { bankAccountId: local.id }]] as const) {
      assert.equal((await handler(request(suffix))).status, 422); assert.equal((await ma.call(tool, input)).body.code, "LEGACY_NUMERIC_RANGE");
    }
    await db.update(bankAccount).set({ currencyCode: "XXX" }).where(eq(bankAccount.id, local.id));
    assert.equal((await cashFlow(request(cashSuffix))).status, 422); assert.equal((await status(request(statusSuffix))).status, 422);
    console.log("REST and MCP bank analytics verified");
  } finally { await ma.close(); await mb.close(); await noRead.close(); }
}
run().then(() => process.exit(0), error => { console.error(error); process.exit(1); });
