// Runs only in financial-report-integration.test.ts's migrated disposable database.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, customRole, apiKey, chartAccount } from "../../lib/db/schema";
import { POST as createEntry } from "../../app/api/v1/entries/route";
import { POST as postEntry } from "../../app/api/v1/entries/[id]/post/route";
import { GET as trial } from "../../app/api/v1/reports/trial-balance/route";
import { GET as balance } from "../../app/api/v1/reports/balance-sheet/route";
import { GET as pnl } from "../../app/api/v1/reports/profit-and-loss/route";
import { GET as income } from "../../app/api/v1/reports/income-statement/route";
import { GET as comparison } from "../../app/api/v1/reports/pnl-comparison/route";
import { GET as ledger } from "../../app/api/v1/reports/general-ledger/route";
import { GET as transactions } from "../../app/api/v1/reports/account-transactions/route";
import { GET as cashFlow } from "../../app/api/v1/reports/cash-flow/route";
import { GET as tracking } from "../../app/api/v1/reports/tracking-category/route";
import { GET as pack } from "../../app/api/v1/reports/pack/route";
import { GET as ratios } from "../../app/api/v1/reports/financial-ratios/route";
import { registerReportTools } from "../../lib/mcp/tools/reports";
import { registerEntryTools } from "../../lib/mcp/tools/entries";
import type { AuthContext } from "../../lib/api/auth-context";

async function mcp(ctx: AuthContext) {
  const server = new McpServer({ name: "Combined financial reports", version: "1" });
  registerReportTools(server, ctx); registerEntryTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1" });
  const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
  return { async call(name: string, args: Record<string, unknown>) {
    const result = await client.callTool({ name, arguments: args });
    const text = (result.content as { text: string }[])[0].text;
    return { isError: result.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
  }, async close() { await client.close(); await server.close(); } };
}

async function run() {
  const [a, b] = await db.insert(organization).values([
    { name: "Combined A", slug: "combined-a" }, { name: "Combined B", slug: "combined-b" },
  ]).returning();
  const [owner, denied] = await db.insert(users).values([
    { email: "combined-owner@example.test" }, { email: "combined-denied@example.test" },
  ]).returning();
  const [role] = await db.insert(customRole).values({ organizationId: a.id, name: "No data", permissions: [] }).returning();
  await db.insert(member).values([
    { organizationId: a.id, userId: owner.id, role: "owner" }, { organizationId: b.id, userId: owner.id, role: "owner" },
    { organizationId: a.id, userId: denied.id, role: "member", customRoleId: role.id },
  ]);
  const keys = { a: "dk_combined_a", b: "dk_combined_b", denied: "dk_combined_denied" };
  for (const [label, key] of Object.entries(keys)) await db.insert(apiKey).values({
    organizationId: label === "b" ? b.id : a.id, createdBy: label === "denied" ? denied.id : owner.id,
    name: label, keyPrefix: "dk_combined", keyHash: createHash("sha256").update(key).digest("hex"),
  });
  const accounts = await db.insert(chartAccount).values([a, b].flatMap(org => [
    { organizationId: org.id, code: "1000", name: `${org.id} Bank`, type: "asset" as const, subType: "bank" },
    { organizationId: org.id, code: "4000", name: `${org.id} Revenue`, type: "revenue" as const },
    { organizationId: org.id, code: "5000", name: `${org.id} Expense`, type: "expense" as const },
  ])).returning();
  const [bank, revenue, expense, foreignBank, foreignRevenue] = accounts;
  const ctx: AuthContext = { userId: owner.id, organizationId: a.id, role: "owner" };
  const ma = await mcp(ctx), mb = await mcp({ ...ctx, organizationId: b.id });
  const noRead = await mcp({ ...ctx, userId: denied.id, role: "member", permissions: [] });
  const request = (path: string, key = keys.a, body?: unknown) => new Request(`http://fixture.test/api/v1/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-organization-id": b.id },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const lines = (debit: string, credit: string, value: number | string) => [
    { accountId: debit, ...(typeof value === "number" ? { debitAmount: value } : { debitAmountMinor: value }), rateExact: "1" },
    { accountId: credit, ...(typeof value === "number" ? { creditAmount: value } : { creditAmountMinor: value }), rateExact: "1" },
  ];
  const write = async (transport: "rest" | "mcp", date: string, entryLines: ReturnType<typeof lines>, posted = true, client = ma) => {
    const body = { date, description: "Synthetic integration journal", lines: entryLines };
    let id: string;
    if (transport === "rest") {
      const result = await createEntry(request("entries", keys.a, body)); assert.equal(result.status, 201, await result.clone().text());
      id = (await result.json()).entry.id;
      if (posted) assert.equal((await postEntry(request(`entries/${id}/post`, keys.a, {}), { params: Promise.resolve({ id }) })).status, 200);
    } else {
      const result = await client.call("create_entry", body); assert.equal(result.isError, false, JSON.stringify(result.body));
      id = result.body.entry.id;
      if (posted) assert.equal((await client.call("post_entry", { entryId: id })).isError, false);
    }
  };
  const snapshot = async () => (await db.execute(sql`select
    (select jsonb_agg(to_jsonb(e) order by e.id) from journal_entry e) as entries,
    (select jsonb_agg(to_jsonb(l) order by l.id) from journal_line l) as lines,
    (select jsonb_agg(to_jsonb(c) order by c.id) from chart_account c) as accounts,
    (select jsonb_agg(to_jsonb(a) order by a.id) from audit_log a) as audits`)).rows;
  const period = { startDate: "2024-01-01", endDate: "2024-01-31" };
  const pairs = [
    ["trial-balance", "trial_balance", trial, { asAt: "2024-01-31" }],
    ["balance-sheet", "balance_sheet", balance, { asAt: "2024-01-31" }],
    ["profit-and-loss", "profit_and_loss", pnl, period],
    ["income-statement", "income_statement", income, { from: period.startDate, to: period.endDate }],
    ["pnl-comparison", "pnl_comparison", comparison, { asAt: "2024-01-31", periods: 1 }],
    ["general-ledger", "general_ledger", ledger, { ...period, accountId: bank.id }],
    ["account-transactions", "account_transactions", transactions, { ...period, accountId: bank.id }],
    ["cash-flow", "cash_flow_statement", cashFlow, period],
    ["tracking-category", "tracking_category_report", tracking, period],
    ["pack", "report_pack", pack, period],
    ["financial-ratios", "financial_ratios", ratios, period],
  ] as const;
  const get = async (pair: typeof pairs[number], client = ma, key = keys.a) => {
    const [path, name, handler, input] = pair;
    const args = { ...input, ...("accountId" in input && key === keys.b ? { accountId: foreignBank.id } : {}) };
    const query = new URLSearchParams(Object.entries(args).map(([k, v]) => [k, String(v)]));
    if (path === "pack") query.set("format", "json");
    const response = await handler(request(`reports/${path}?${query}`, key));
    assert.equal(response.status, 200, await response.clone().text());
    const body = await response.json(), tool = await client.call(name, args);
    assert.equal(tool.isError, false, JSON.stringify(tool.body)); assert.deepEqual(tool.body, body);
    return body;
  };
  try {
    await write("mcp", "2023-12-31", lines(bank.id, revenue.id, 100));
    await write("rest", "2024-01-01", lines(bank.id, revenue.id, 1250));
    await write("mcp", "2024-01-15", lines(bank.id, revenue.id, "2147483648"));
    await write("rest", "2024-01-31", lines(expense.id, bank.id, "250"));
    await write("mcp", "2024-02-01", lines(bank.id, revenue.id, "777"));
    await write("rest", "2024-01-15", lines(bank.id, revenue.id, 888), false);
    await write("mcp", "2024-01-15", lines(foreignBank.id, foreignRevenue.id, "777"), true, mb);
    const saved = await snapshot();
    // All currencies preserve JSON cents while their exports retain currency display scaling.
    for (const currency of ["USD", "IRR", "JPY", "KWD"]) {
      await db.update(organization).set({ defaultCurrency: currency }).where(eq(organization.id, a.id));
      const reports = await Promise.all(pairs.map(pair => get(pair)));
      const [tb, bs, pl, inc, cmp, gl, at, cf, tr, rp, ra] = reports;
      for (const report of reports) assert.equal(report.currencyCode, currency);
      assert.equal(pl.totalRevenue, 2147484898); assert.equal(pl.totalRevenueMinor, "2147484898");
      assert.equal(pl.totalExpensesMinor, "250"); assert.equal(pl.netIncomeMinor, "2147484648");
      assert.equal(inc.netIncome, "21474846.48"); assert.equal(inc.netIncomeMinor, pl.netIncomeMinor);
      assert.equal(cmp.periods[0].netIncomeMinor, pl.netIncomeMinor);
      assert.equal(tr.netIncome.totalMinor, pl.netIncomeMinor); assert.equal(ra.balances.netIncomeMinor, pl.netIncomeMinor);
      assert.equal(rp.statements[1].grandTotalMinor, pl.netIncomeMinor);
      assert.equal(bs.assets.total, "21474847.48"); assert.equal(bs.assets.totalMinor, "2147484748");
      assert.equal(bs.equity.totalMinor, bs.assets.totalMinor);
      assert.equal(rp.statements[0].sections[2].subtotalMinor, bs.equity.totalMinor);
      assert.equal(tb.accounts.find((row: { accountId: string }) => row.accountId === bank.id).balanceMinor, bs.assets.totalMinor);
      assert.equal(gl.openingBalanceMinor, "100"); assert.equal(gl.balanceMinor, pl.netIncomeMinor);
      assert.equal(gl.closingLedgerBalanceMinor, bs.assets.totalMinor);
      assert.equal(at.closingBalanceMinor, gl.balanceMinor); assert.equal(at.closingLedgerBalanceMinor, gl.closingLedgerBalanceMinor);
      assert.equal(at.transactions.at(-1).ledgerBalanceMinor, bs.assets.totalMinor);
      assert.equal(cf.operatingActivities.netIncomeMinor, pl.netIncomeMinor);
      assert.equal(cf.reconciliation.cashAccountMovementMinor, pl.netIncomeMinor); assert.equal(cf.reconciliation.balanced, true);
      assert.equal(cf.closingCashBalanceMinor, bs.assets.totalMinor);
      assert.equal(rp.statements[3].grandTotalMinor, cf.closingCashBalanceMinor);
      assert.deepEqual(rp.statements[2].grandTotalsMinor, ["2147484998", "2147484998"]);
      // Standalone trial balance retains its separately tracked natural-sign defect.
      assert.equal(tb.accounts.find((row: { accountId: string }) => row.accountId === revenue.id).debitBalanceMinor, "2147484998");
      const ExcelJS = (await import("exceljs")).default;
      for (const [handler, path, sheet] of [[pnl, "profit-and-loss", 0], [pack, "pack", 1]] as const) {
        const response = await handler(request(`reports/${path}?startDate=2024-01-01&endDate=2024-01-31&format=xlsx`));
        assert.equal(response.status, 200);
        const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(Buffer.from(await response.arrayBuffer()) as never);
        const values: unknown[] = []; workbook.worksheets[sheet].eachRow(row => row.eachCell(cell => values.push(cell.value)));
        const scale = currency === "KWD" ? 1000 : ["IRR", "JPY"].includes(currency) ? 1 : 100;
        assert.ok(values.includes(2147484648 / scale), `${path} ${currency} net income export`);
      }
      assert.deepEqual(await snapshot(), saved);
    }
    for (const pair of pairs) {
      const [path, name, handler, input] = pair;
      const other = await get(pair, mb, keys.b);
      assert.ok(!JSON.stringify(other).includes(bank.id), `${name} leaked organization A`);
      const query = new URLSearchParams(Object.entries(input).map(([k, v]) => [k, String(v)]));
      if (path === "pack") query.set("format", "json");
      for (const [key, status] of [["dk_invalid", 401], [keys.denied, 403]] as const)
        assert.equal((await handler(request(`reports/${path}?${query}`, key))).status, status);
      assert.equal((await noRead.call(name, input)).isError, true);
      query.set("unsupported", "1");
      assert.equal((await handler(request(`reports/${path}?${query}`))).status, 400);
      assert.equal((await ma.call(name, { ...input, unsupported: 1 })).isError, true, `${name} accepted unknown input`);
    }
    // One unsupported currency must fail consistently across all child services.
    await db.update(organization).set({ defaultCurrency: "BAD" }).where(eq(organization.id, a.id));
    for (const [path, name, handler, input] of pairs) {
      const query = new URLSearchParams(Object.entries(input).map(([k, v]) => [k, String(v)]));
      if (path === "pack") query.set("format", "json");
      const response = await handler(request(`reports/${path}?${query}`));
      assert.equal(response.status, 422); assert.equal((await response.json()).code, "LEGACY_NUMERIC_RANGE");
      const tool = await ma.call(name, input); assert.equal(tool.isError, true); assert.equal(tool.body.code, "LEGACY_NUMERIC_RANGE");
    }
    assert.deepEqual(await snapshot(), saved);
    console.log("Combined financial report contracts verified");
  } finally { await ma.close(); await mb.close(); await noRead.close(); }
}

run().then(() => process.exit(0), error => { console.error(error); process.exit(1); });
