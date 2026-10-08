import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, customRole, chartAccount, fiscalYear, budget, budgetLine,
  budgetPeriod, journalEntry, journalLine } from "../../lib/db/schema";
import { GET } from "../../app/api/v1/reports/budget-vs-actual/route";
import { registerBudgetTools } from "../../lib/mcp/tools/budgets";
import { createBudget } from "../../lib/api/budget-write";
import { getBudgetReport } from "../../lib/api/budget-report";
import type { AuthContext } from "../../lib/api/auth-context";

async function mcp(ctx: AuthContext) {
  const server = new McpServer({ name: "Budget report fixture", version: "1" }); registerBudgetTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1" });
  const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
  const tools = (await client.listTools()).tools; assert.equal(tools.length, 7);
  assert.match(tools.find(tool => tool.name === "budget_vs_actual")!.description!, /Minor strings/);
  return { async call(args: Record<string, unknown> = {}) {
    const result = await client.callTool({ name: "budget_vs_actual", arguments: args });
    const text = (result.content as { text: string }[])[0].text;
    return { isError: result.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
  }, async close() { await client.close(); await server.close(); } };
}

async function run() {
  const [a, b] = await db.insert(organization).values([{ name: "Report A", slug: "bra" }, { name: "Report B", slug: "brb" }]).returning();
  const [owner, denied] = await db.insert(users).values([{ email: "br-owner@example.test" }, { email: "br-denied@example.test" }]).returning();
  const [role] = await db.insert(customRole).values({ organizationId: a.id, name: "No read", permissions: [] }).returning();
  await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner" }, { organizationId: b.id, userId: owner.id, role: "owner" },
    { organizationId: a.id, userId: denied.id, role: "member", customRoleId: role.id }]);
  const keys = { a: "dk_br_a", b: "dk_br_b", denied: "dk_br_denied" };
  for (const [label, key] of Object.entries(keys)) await db.insert(apiKey).values({ organizationId: label === "b" ? b.id : a.id,
    createdBy: label === "denied" ? denied.id : owner.id, name: label, keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_br" });
  const ctx = { userId: owner.id, organizationId: a.id, role: "owner" as const };
  const ma = await mcp(ctx), mb = await mcp({ ...ctx, organizationId: b.id }), noRead = await mcp({ ...ctx, role: "member", permissions: [] });
  const request = (query = "", key = keys.a) => new Request(`http://fixture.test/api/v1/reports/budget-vs-actual${query}`, {
    headers: { authorization: `Bearer ${key}`, "x-organization-id": b.id },
  });
  const accounts = await db.insert(chartAccount).values((["expense", "asset", "liability", "equity", "revenue"] as const).map((type, i) => ({
    organizationId: a.id, code: String(5000 + i), name: type, type, currencyCode: "JPY",
  }))).returning();
  const [foreign] = await db.insert(chartAccount).values({ organizationId: b.id, code: "5000", name: "Foreign secret", type: "expense" }).returning();
  const header = { name: "Comparison", startDate: "2024-01-01", endDate: "2024-01-31", periodType: "custom" };
  const period = { label: "Early", startDate: "2024-01-01", endDate: "2024-01-07", amountMinor: "1000", sortOrder: 0 };
  const snapshot = async () => {
    const result: Record<string, unknown> = {};
    for (const table of ["budget", "budget_line", "budget_period", "journal_entry", "journal_line", "audit_log"]) {
      result[table] = (await db.execute(sql.raw(`select row_to_json(t) as row from ${table} t order by id`))).rows;
    }
    return result;
  };
  let sequence = 0;
  const entry = async (accountId: string, debit: number, credit: number, date = "2024-01-01",
    status: "posted" | "draft" | "void" = "posted", org = a.id, deleted = false) => {
    const [saved] = await db.insert(journalEntry).values({ organizationId: org, entryNumber: ++sequence, date, description: "Synthetic activity",
      status, deletedAt: deleted ? new Date() : null }).returning();
    await db.insert(journalLine).values({ journalEntryId: saved.id, accountId, debitAmount: debit, creditAmount: credit, currencyCode: "IRR" });
    return saved;
  };
  try {
    // Empty/foreign/missing reports retain their envelope and exact zero aliases.
    const empty = await GET(request()); assert.equal(empty.status, 200);
    const emptyBody = await empty.json(); assert.equal(emptyBody.budget, null); assert.equal(emptyBody.totalActualMinor, "0");
    assert.deepEqual((await ma.call()).body, emptyBody);
    const saved = await createBudget(ctx, { ...header, lines: accounts.map((account, i) => ({ accountId: account.id,
      ...(i % 2 ? { total: 1250 } : { totalMinor: "1250" }), periods: [period,
        { ...period, label: "Full", endDate: header.endDate, amount: 250, amountMinor: "250", sortOrder: 1 }] })) });
    const foreignBudget = await createBudget({ ...ctx, organizationId: b.id }, { ...header, lines: [{ accountId: foreign.id, totalMinor: "777" }] });
    for (const id of [randomUUID(), foreignBudget.id]) {
      assert.equal((await (await GET(request(`?budgetId=${id}`))).json()).budget, null);
      assert.equal((await ma.call({ budgetId: id })).body.budget, null);
    }
    assert.equal((await mb.call({ budgetId: saved.id })).body.budget, null);
    // Natural sign for all types, inclusive boundaries, multiple periods and already-base GL.
    for (const [i, account] of accounts.entries()) {
      const debitSide = ["expense", "asset"].includes(account.type);
      await entry(account.id, debitSide ? (i + 1) * 10 : 0, debitSide ? 0 : (i + 1) * 10);
      await entry(account.id, debitSide ? 2 : 0, debitSide ? 0 : 2, header.endDate);
      await entry(account.id, 888, 0, "2023-12-31"); await entry(account.id, 888, 0, "2024-02-01");
      await entry(account.id, 888, 0, undefined, "draft"); await entry(account.id, 888, 0, undefined, "void");
      await entry(account.id, 888, 0, undefined, "posted", a.id, true);
      await entry(account.id, 888, 0, undefined, "posted", b.id); // malformed cross-org line must be excluded.
    }
    const before = await snapshot();
    const response = await GET(request(`?budgetId=${saved.id}`)); assert.equal(response.status, 200);
    const body = await response.json(); assert.deepEqual((await ma.call({ budgetId: saved.id })).body, body);
    assert.equal(body.totalBudgeted, 6250); assert.equal(body.totalBudgetedMinor, "6250");
    assert.equal(body.totalActual, 160); assert.equal(body.totalActualMinor, "160");
    assert.equal(body.totalVarianceMinor, "6090"); assert.equal(body.totalBurnRateMinor, "160");
    for (const [i, account] of accounts.entries()) {
      const row = body.comparisons.find((row: { accountId: string }) => row.accountId === account.id);
      assert.equal(row.actualMinor, String((i + 1) * 10 + 2)); assert.equal(row.periods[0].actualMinor, String((i + 1) * 10));
      assert.equal(row.periods[1].actualMinor, row.actualMinor); assert.equal(row.projectedMinor, row.burnRateMinor);
      for (const key of ["budgeted", "actual", "variance", "burnRate", "projected"]) assert.equal(BigInt(row[key]), BigInt(row[`${key}Minor`]));
    }
    assert.deepEqual(await snapshot(), before); // no ledger, budget or audit mutation.
    for (const currency of ["USD", "IRR", "JPY", "KWD"]) {
      await db.update(organization).set({ defaultCurrency: currency }).where(eq(organization.id, a.id));
      const result = await (await GET(request(`?budgetId=${saved.id}`))).json();
      assert.equal(result.currencyCode, currency); assert.equal(result.totalBudgetedMinor, "6250");
      assert.equal((await ma.call({ budgetId: saved.id })).body.totalActualMinor, "160");
    }
    // Newest ordering includes inactive and excludes deleted budgets.
    const newest = await createBudget(ctx, { ...header, name: "Newest", isActive: false, lines: [{ accountId: accounts[0].id, total: 1250 }] });
    await db.update(budget).set({ createdAt: new Date("2099-01-01T00:00:00Z") }).where(eq(budget.id, newest.id));
    assert.equal((await (await GET(request())).json()).budget.id, newest.id);
    assert.equal((await ma.call()).body.budget.id, newest.id);
    await db.update(budget).set({ deletedAt: new Date() }).where(eq(budget.id, newest.id));
    assert.equal((await ma.call()).body.budget.id, saved.id);
    // Actual API-key and SDK validation/permission failures.
    assert.equal((await GET(request("", "dk_invalid"))).status, 401);
    assert.equal((await GET(request(`?budgetId=${saved.id}`, keys.denied))).status, 403);
    assert.equal((await noRead.call({ budgetId: saved.id })).body.status, 403);
    for (const query of ["?budgetId=", "?budgetId=invalid", `?budgetId=${saved.id}&budgetId=${saved.id}`, "?amountMinor=1"])
      assert.equal((await GET(request(query))).status, 400);
    assert.equal((await ma.call({ budgetId: "invalid" })).isError, true);
    // Foreign nested account/fiscal references must not expose names or monetary data.
    const [bad] = await db.insert(budget).values({ ...header, organizationId: a.id }).returning();
    await db.insert(budgetLine).values({ budgetId: bad.id, accountId: foreign.id, total: 1 });
    assert.equal((await GET(request(`?budgetId=${bad.id}`))).status, 404);
    assert.equal((await ma.call({ budgetId: bad.id })).body.status, 404);
    const [year] = await db.insert(fiscalYear).values({ organizationId: b.id, name: "Secret year", startDate: header.startDate, endDate: header.endDate }).returning();
    await db.update(budgetLine).set({ accountId: accounts[0].id }).where(eq(budgetLine.budgetId, bad.id));
    await db.update(budget).set({ fiscalYearId: year.id }).where(eq(budget.id, bad.id));
    assert.equal((await GET(request(`?budgetId=${bad.id}`))).status, 404);
    assert.equal((await ma.call({ budgetId: bad.id })).body.status, 404);
    // Unsupported historical values and malformed dates fail visibly without writes.
    const expectRange = async (id: string) => {
      const before = await snapshot();
      const result = await GET(request(`?budgetId=${id}`)); assert.equal(result.status, 422);
      assert.equal((await result.json()).code, "LEGACY_NUMERIC_RANGE");
      const mcpResult = await ma.call({ budgetId: id }); assert.equal(mcpResult.body.status, 422);
      assert.equal(mcpResult.body.code, "LEGACY_NUMERIC_RANGE"); assert.deepEqual(await snapshot(), before);
    };
    await db.execute(sql`update ${budgetLine} set total=9007199254740992 where budget_id=${saved.id}`); await expectRange(saved.id);
    await db.update(budgetLine).set({ total: 1250 }).where(eq(budgetLine.budgetId, saved.id));
    const [first] = await db.select().from(budgetLine).where(eq(budgetLine.budgetId, saved.id));
    await db.execute(sql`update ${budgetPeriod} set amount=9007199254740992 where budget_line_id=${first.id}`); await expectRange(saved.id);
    await db.update(budgetPeriod).set({ amount: 250 }).where(eq(budgetPeriod.budgetLineId, first.id));
    await db.update(budget).set({ startDate: "2024-02-30" }).where(eq(budget.id, saved.id)); await expectRange(saved.id);
    await db.update(budget).set({ startDate: header.startDate }).where(eq(budget.id, saved.id));
    await db.update(budgetPeriod).set({ startDate: "2024-02-30" }).where(eq(budgetPeriod.budgetLineId, first.id)); await expectRange(saved.id);
    // Raw SQL sums beyond JS precision can cancel exactly; output aggregates cannot overflow.
    const [largeAccount] = await db.insert(chartAccount).values({ organizationId: a.id, code: "9999", name: "Large", type: "expense" }).returning();
    const large = await createBudget(ctx, { ...header, lines: [{ accountId: largeAccount.id, total: 2 }] });
    await entry(largeAccount.id, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
    await entry(largeAccount.id, 2, 0);
    assert.equal((await (await GET(request(`?budgetId=${large.id}`))).json()).totalActualMinor, "2");
    assert.equal((await ma.call({ budgetId: large.id })).body.totalActualMinor, "2");
    await entry(largeAccount.id, Number.MAX_SAFE_INTEGER, 0); await expectRange(large.id);
    const hugeBudget = await createBudget(ctx, { ...header, lines: accounts.slice(0, 2).map(account => ({ accountId: account.id, totalMinor: "9007199254740991" })) });
    await expectRange(hugeBudget.id);
    // Projection overflow is preflighted even when a base amount remains safe.
    const projection = await createBudget(ctx, { ...header, lines: [{ accountId: accounts[0].id, totalMinor: "9007199254740991" }] });
    await entry(accounts[0].id, Number.MAX_SAFE_INTEGER - 12, 0);
    const complete = await getBudgetReport(ctx, { budgetId: projection.id }, new Date("2024-02-01T00:00:00Z"));
    assert.equal(complete.totalActualMinor, "9007199254740991");
    const maximum = await GET(request(`?budgetId=${projection.id}`)); assert.equal(maximum.status, 200);
    assert.equal((await maximum.json()).totalActualMinor, "9007199254740991");
    assert.equal((await ma.call({ budgetId: projection.id })).body.totalActual, Number.MAX_SAFE_INTEGER);
    await assert.rejects(getBudgetReport(ctx, { budgetId: projection.id }, new Date("2024-01-02T00:00:00Z")), /legacy numeric contract/);
    const future = await getBudgetReport(ctx, { budgetId: projection.id }, new Date("2023-12-31T00:00:00Z"));
    assert.equal(future.totalBurnRateMinor, "0");
    // A percent can be unsupported even when every monetary field is representable.
    const percent = await createBudget(ctx, { ...header, lines: [{ accountId: accounts[0].id, total: 1 }] });
    await expectRange(percent.id);
    const [negativeAccount] = await db.insert(chartAccount).values({ organizationId: a.id, code: "9998", name: "Refund", type: "expense" }).returning();
    await entry(negativeAccount.id, 0, 1250);
    const negative = await createBudget(ctx, { ...header, lines: [{ accountId: negativeAccount.id, totalMinor: "-1250" }] });
    const negativeBody = await (await GET(request(`?budgetId=${negative.id}`))).json();
    assert.equal(negativeBody.totalActualMinor, "-1250"); assert.equal(negativeBody.totalBurnRateMinor, "-1250");
    assert.deepEqual((await ma.call({ budgetId: negative.id })).body, negativeBody);
    const variance = await createBudget(ctx, { ...header, lines: [{ accountId: negativeAccount.id, totalMinor: "9007199254740991" }] });
    await expectRange(variance.id);
    console.log("REST and MCP budget report verified");
  } finally { await ma.close(); await mb.close(); await noRead.close(); }
}
run().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
