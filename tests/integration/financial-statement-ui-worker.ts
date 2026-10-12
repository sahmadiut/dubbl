import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, chartAccount, journalEntry, journalLine } from "../../lib/db/schema";
import { GET as trialBalance } from "../../app/api/v1/reports/trial-balance/route";
import { GET as balanceSheet } from "../../app/api/v1/reports/balance-sheet/route";
import { GET as profitLoss } from "../../app/api/v1/reports/profit-and-loss/route";
import { GET as incomeStatement } from "../../app/api/v1/reports/income-statement/route";
import { GET as pnlComparison } from "../../app/api/v1/reports/pnl-comparison/route";
import { registerReportTools } from "../../lib/mcp/tools/reports";
import { balanceSheetUi, trialBalanceUi, profitLossUi, incomeStatementUi, pnlComparisonUi, financialStatementJson,
  trialBalanceTotals, statementUiMoney, statementChartPoint, statementComparisonPeriods } from "../../lib/money/financial-statement-ui";
import { generateCSV } from "../../lib/import-export/csv-utils";

async function run() {
  const [org, other] = await db.insert(organization).values([{ name: "Statement UI", slug: "statement-ui" }, { name: "Foreign UI", slug: "foreign-ui" }]).returning();
  const [owner] = await db.insert(users).values({ email: "statement-ui@example.test" }).returning();
  await db.insert(member).values({ organizationId: org.id, userId: owner.id, role: "owner" });
  const key = "dk_statement_ui";
  await db.insert(apiKey).values({ organizationId: org.id, createdBy: owner.id, name: "Fixture",
    keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_statement" });
  const [cash, revenue, expense] = await db.insert(chartAccount).values([
    { organizationId: org.id, code: "1000", name: "Cash", type: "asset" as const },
    { organizationId: org.id, code: "4000", name: "Revenue", type: "revenue" as const },
    { organizationId: org.id, code: "5000", name: "Expense", type: "expense" as const },
  ]).returning();
  const [foreign] = await db.insert(chartAccount).values({ organizationId: other.id, code: "4000", name: "Foreign secret", type: "revenue" }).returning();
  let sequence = 0;
  async function post(date: string, debitId: string, creditId: string, amount: number, organizationId = org.id) {
    const [entry] = await db.insert(journalEntry).values({ organizationId, entryNumber: ++sequence, date, description: "Synthetic statement UI entry", status: "posted", sourceType: "manual" }).returning();
    await db.insert(journalLine).values([
      { journalEntryId: entry.id, accountId: debitId, debitAmount: amount, creditAmount: 0, currencyCode: "USD" },
      { journalEntryId: entry.id, accountId: creditId, debitAmount: 0, creditAmount: amount, currencyCode: "USD" },
    ]);
    return entry;
  }
  await post("2023-12-10", cash.id, revenue.id, 1000001);
  await post("2024-01-10", cash.id, revenue.id, 9007199253000001);
  await post("2024-01-20", expense.id, cash.id, 901);
  await post("2024-01-10", cash.id, foreign.id, 777, other.id);
  const snapshot = async () => {
    const result: Record<string, unknown> = {};
    for (const table of ["journal_entry", "journal_line", "chart_account", "audit_log"]) {
      result[table] = (await db.execute(sql.raw(`select row_to_json(t)::text as row from ${table} t order by id`))).rows;
    }
    return result;
  };
  const before = await snapshot();
  const server = new McpServer({ name: "Statement UI fixture", version: "1" });
  registerReportTools(server, { userId: owner.id, organizationId: org.id, role: "owner" });
  const client = new Client({ name: "Fixture", version: "1" });
  const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
  const request = (path: string, query: string, authorization = key) => new Request(`http://fixture.test/api/v1/reports/${path}${query}`, {
    headers: { authorization: `Bearer ${authorization}`, "x-organization-id": other.id },
  });
  const noReadServer = new McpServer({ name: "Denied statement fixture", version: "1" });
  registerReportTools(noReadServer, { userId: owner.id, organizationId: org.id, role: "member", permissions: [] });
  const noRead = new Client({ name: "Denied fixture", version: "1" });
  const [dct, dst] = InMemoryTransport.createLinkedPair(); await noReadServer.connect(dst); await noRead.connect(dct);
  const cumulativeQuery = "?asAt=2024-01-31&compareDate=2023-12-31";
  const periodQuery = "?startDate=2024-01-01&endDate=2024-01-31";
  const pairs = [
    ["trial-balance", "trial_balance", trialBalance, cumulativeQuery, { asAt: "2024-01-31", compareDates: ["2023-12-31"] }, trialBalanceUi],
    ["balance-sheet", "balance_sheet", balanceSheet, cumulativeQuery, { asAt: "2024-01-31", compareDates: ["2023-12-31"] }, balanceSheetUi],
    ["profit-and-loss", "profit_and_loss", profitLoss, periodQuery, { startDate: "2024-01-01", endDate: "2024-01-31" }, profitLossUi],
    ["income-statement", "income_statement", incomeStatement, "?from=2024-01-01&to=2024-01-31", { from: "2024-01-01", to: "2024-01-31" }, incomeStatementUi],
    ["pnl-comparison", "pnl_comparison", pnlComparison, "?compare=monthly&periods=2&asAt=2024-01-31", { compare: "monthly", periods: 2, asAt: "2024-01-31" }, pnlComparisonUi],
  ] as const;
  try {
    const sqlRevenue = (await db.execute(sql`select sum(l.credit_amount - l.debit_amount)::text as amount from journal_line l
      join journal_entry e on e.id=l.journal_entry_id where e.organization_id=${org.id} and l.account_id=${revenue.id}
      and e.status='posted' and e.date >= '2024-01-01' and e.date <= '2024-01-31'`)).rows[0].amount;
    assert.equal(sqlRevenue, "9007199253000001");
    const expected: Record<string, RegExp> = { USD: /90,071,992,530,000\.01/, KWD: /9,007,199,253,000\.001/,
      JPY: /9,007,199,253,000,001/, IRR: /9,007,199,253,000,001/ };
    for (const currencyCode of ["USD", "JPY", "KWD", "IRR"]) {
      await db.update(organization).set({ defaultCurrency: currencyCode }).where(eq(organization.id, org.id));
      for (const [path, name, handler, query, args, parse] of pairs) {
        const response = await handler(request(path, query)); assert.equal(response.status, 200);
        const body = await response.json();
        const result = await client.callTool({ name, arguments: args }); assert.ok(!result.isError);
        const mcpBody = JSON.parse((result.content as { text: string }[])[0].text);
        assert.deepEqual(mcpBody, body);
        assert.ok(!JSON.stringify(body).includes("Foreign secret")); assert.equal(body.currencyCode, currencyCode);
        // Both transports enter the same browser adapter, not an imitation of the service.
        const parsed = parse(body); assert.deepEqual(parse(mcpBody), parsed);
        await financialStatementJson(new Response(JSON.stringify(body)), parse as (value: unknown) => unknown);
        const malformed = structuredClone(body);
        if (name === "trial_balance") {
          const data = trialBalanceUi(body);
          assert.equal(data.accounts.find(row => row.accountId === cash.id)!.balance, 9007199253999101n);
          assert.deepEqual(trialBalanceTotals(data), [{ debit: 18014398508000004n, credit: 0n }, { debit: 2000002n, credit: 0n }]);
          malformed.accounts[0].balanceMinor = "1";
        } else if (name === "balance_sheet") {
          const data = balanceSheetUi(body), columns = statementComparisonPeriods(data);
          assert.equal(data.assets.total, 9007199253999101n); assert.equal(data.equity.total, 9007199253999101n);
          assert.equal(columns[0].assets.total, 1000001n);
          assert.equal(columns[1].assets.total - columns[0].assets.total, 9007199252999100n);
          assert.match(statementUiMoney(columns[1].assets.total, currencyCode), currencyCode === "KWD" ? /\.101/ : currencyCode === "USD" ? /\.01/ : /101/);
          malformed.assets.totalsMinor[1] = "1002";
        } else if (name === "income_statement") {
          const data = incomeStatementUi(body);
          assert.equal(data.revenue.total.toString(), sqlRevenue); assert.equal(data.netIncome, 9007199252999100n);
          assert.match(statementUiMoney(data.revenue.total, currencyCode), expected[currencyCode]);
          malformed.revenue.accounts[0].balanceMinor = "1";
        } else if (name === "profit_and_loss") {
          const data = profitLossUi(body);
          assert.equal(data.totalRevenue.toString(), sqlRevenue); assert.equal(data.totalExpenses, 901n); assert.equal(data.netIncome, 9007199252999100n);
          assert.match(statementUiMoney(data.totalRevenue, currencyCode), expected[currencyCode]);
          const csv = generateCSV(data.revenue.map(row => ({ currencyCode, balanceMinor: row.balance.toString() })), ["currencyCode", "balanceMinor"]);
          assert.match(csv, new RegExp(`${currencyCode},9007199253000001`));
          delete malformed.totalRevenueMinor;
        } else {
          const data = pnlComparisonUi(body), point = statementChartPoint(data.periods[1], currencyCode);
          assert.equal(point.revenueExact.toString(), sqlRevenue); assert.equal(data.periods[1].revenueChange, 9007199252000000n);
          assert.match(statementUiMoney(point.revenueExact, currencyCode), expected[currencyCode]);
          malformed.periods[1].revenueChangeMinor = "0";
        }
        assert.throws(() => parse(malformed));
        await assert.rejects(financialStatementJson(new Response(JSON.stringify(malformed)), parse as (value: unknown) => unknown), /Saved report amounts are invalid/);
        assert.equal((await handler(request(path, query, "dk_invalid"))).status, 401);
        assert.equal((await noRead.callTool({ name, arguments: args })).isError, true);
      }
      assert.deepEqual(await snapshot(), before);
    }
    // Persisted overflow must reject before any browser report receives a rounded value.
    const huge = await post("2024-01-25", cash.id, revenue.id, 2000000);
    const beforeOverflow = await snapshot();
    for (const [path, name, handler, query, args, parse] of pairs) {
      const response = await handler(request(path, query)); assert.equal(response.status, 422);
      assert.equal((await response.clone().json()).code, "LEGACY_NUMERIC_RANGE");
      await assert.rejects(financialStatementJson(response, parse as (value: unknown) => unknown), /Unable to load/);
      const result = await client.callTool({ name, arguments: args }); assert.equal(result.isError, true);
    }
    assert.deepEqual(await snapshot(), beforeOverflow);
    await db.delete(journalEntry).where(eq(journalEntry.id, huge.id));
    assert.deepEqual(await snapshot(), before);
    console.log("Financial statement UI REST MCP SQL verified: four currencies, five transports, exact sums/changes/CSV/tooltips and unchanged failures");
  } finally { await client.close(); await server.close(); await noRead.close(); await noReadServer.close(); }
}
await run();
process.exit(0);
