import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, customRole, apiKey, chartAccount, journalEntry, journalLine, costCenter, project } from "../../lib/db/schema";
import { GET as profitLoss } from "../../app/api/v1/reports/profit-and-loss/route";
import { GET as incomeStatement } from "../../app/api/v1/reports/income-statement/route";
import { GET as pnlComparison } from "../../app/api/v1/reports/pnl-comparison/route";
import { registerReportTools } from "../../lib/mcp/tools/reports";
import type { AuthContext } from "../../lib/api/auth-context";

async function mcp(ctx: AuthContext) {
  const server = new McpServer({ name: "Period statement fixture", version: "1" }); registerReportTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1" });
  const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
  const tools = (await client.listTools()).tools;
  for (const name of ["profit_and_loss", "income_statement", "pnl_comparison"]) assert.match(tools.find(tool => tool.name === name)!.description!, /Minor strings/);
  return { async call(name: string, args: Record<string, unknown> = {}) {
    const result = await client.callTool({ name, arguments: args });
    const text = (result.content as { text: string }[])[0].text;
    return { isError: result.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
  }, async close() { await client.close(); await server.close(); } };
}

async function run() {
  const [a, b] = await db.insert(organization).values([{ name: "Period A", slug: "ps-a" }, { name: "Period B", slug: "ps-b" }]).returning();
  const [owner, denied] = await db.insert(users).values([{ email: "ps-owner@example.test" }, { email: "ps-denied@example.test" }]).returning();
  const [role] = await db.insert(customRole).values({ organizationId: a.id, name: "No read", permissions: [] }).returning();
  await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner" }, { organizationId: b.id, userId: owner.id, role: "owner" },
    { organizationId: a.id, userId: denied.id, role: "member", customRoleId: role.id }]);
  const keys = { a: "dk_ps_a", b: "dk_ps_b", denied: "dk_ps_denied" };
  for (const [label, key] of Object.entries(keys)) await db.insert(apiKey).values({ organizationId: label === "b" ? b.id : a.id,
    createdBy: label === "denied" ? denied.id : owner.id, name: label, keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_ps" });
  const ctx: AuthContext = { userId: owner.id, organizationId: a.id, role: "owner" };
  const ma = await mcp(ctx), mb = await mcp({ ...ctx, organizationId: b.id }), noRead = await mcp({ ...ctx, role: "member", permissions: [] });
  const request = (kind: string, query = "", key = keys.a) => new Request(`http://fixture.test/api/v1/reports/${kind}${query}`, {
    headers: { authorization: `Bearer ${key}`, "x-organization-id": b.id },
  });
  const [cash, revenue, expense, empty] = await db.insert(chartAccount).values([
    { organizationId: a.id, code: "1000", name: "Cash", type: "asset" as const, subType: "bank" },
    { organizationId: a.id, code: "4000", name: "Revenue", type: "revenue" as const },
    { organizationId: a.id, code: "5000", name: "Expense", type: "expense" as const },
    { organizationId: a.id, code: "6000", name: "Empty", type: "revenue" as const },
  ]).returning();
  const [foreign] = await db.insert(chartAccount).values({ organizationId: b.id, code: "1000", name: "Foreign secret", type: "revenue" }).returning();
  const [dimension] = await db.insert(costCenter).values({ organizationId: a.id, code: "one", name: "One" }).returning();
  let sequence = 0;
  const entry = async (lines: { accountId: string; debit?: number; credit?: number; dimension?: boolean }[], date = "2024-01-01",
    status: "posted" | "draft" | "void" = "posted", org = a.id, deleted = false, sourceType = "manual") => {
    const [saved] = await db.insert(journalEntry).values({ organizationId: org, entryNumber: ++sequence, date, status, description: "Synthetic entry",
      deletedAt: deleted ? new Date() : null, sourceType }).returning();
    await db.insert(journalLine).values(lines.map(line => ({ journalEntryId: saved.id, accountId: line.accountId,
      debitAmount: line.debit ?? 0, creditAmount: line.credit ?? 0, currencyCode: "IRR", costCenterId: line.dimension ? dimension.id : null })));
    return saved;
  };
  const snapshot = async () => {
    const result: Record<string, unknown> = {};
    for (const table of ["journal_entry", "journal_line", "chart_account", "audit_log"]) {
      result[table] = (await db.execute(sql.raw(`select row_to_json(t) as row from ${table} t order by id`))).rows;
    }
    return result;
  };
  const pairs = [
    ["profit-and-loss", "profit_and_loss", profitLoss, "?startDate=2024-01-01&endDate=2024-01-31", { startDate: "2024-01-01", endDate: "2024-01-31" }],
    ["income-statement", "income_statement", incomeStatement, "?from=2024-01-01&to=2024-01-31", { from: "2024-01-01", to: "2024-01-31" }],
    ["pnl-comparison", "pnl_comparison", pnlComparison, "?asAt=2024-01-15&periods=2", { asAt: "2024-01-15", periods: 2 }],
  ] as const;
  const get = async (handler: typeof profitLoss, kind: string, query: string) => {
    const response = await handler(request(kind, query)); assert.equal(response.status, 200); return response.json();
  };
  const parity = async () => {
    for (const [kind, name, handler, query, args] of pairs) {
      const body = await get(handler, kind, query);
      const tool = await ma.call(name, args); assert.equal(tool.isError, false); assert.deepEqual(tool.body, body);
    }
  };
  try {
    await parity();
    await entry([{ accountId: revenue.id, credit: 1000 }], "2023-12-31");
    await entry([{ accountId: revenue.id, credit: 1250 }, { accountId: cash.id, debit: 1250 }], "2024-01-01");
    await entry([{ accountId: expense.id, debit: 250, dimension: true }], "2024-01-31");
    await entry([{ accountId: revenue.id, credit: 999 }], "2024-02-01");
    for (const status of ["draft", "void"] as const) await entry([{ accountId: revenue.id, credit: 888 }], undefined, status);
    await entry([{ accountId: revenue.id, credit: 888 }], undefined, "posted", a.id, true);
    await entry([{ accountId: revenue.id, credit: 888 }], undefined, "posted", b.id);
    await entry([{ accountId: foreign.id, credit: 777 }]);
    await entry([{ accountId: foreign.id, credit: 222 }], undefined, "posted", b.id);
    const before = await snapshot();
    await parity();
    const pl = await get(profitLoss, "profit-and-loss", pairs[0][3]);
    assert.equal(pl.totalRevenue, 1250); assert.equal(pl.totalRevenueMinor, "1250"); assert.equal(pl.netIncome, 1000);
    assert.equal(pl.revenue.length, 1); assert.equal(pl.revenue[0].balanceMinor, "1250");
    const income = await get(incomeStatement, "income-statement", pairs[1][3]);
    assert.equal(income.revenue.total, "12.50"); assert.equal(income.revenue.totalMinor, "1250");
    assert.equal(income.revenue.accounts.length, 2); assert.equal(income.revenue.accounts.find((r: { name: string }) => r.name === "Empty").balance, "0.00");
    assert.equal(income.netIncome, "10.00");
    const comparison = await get(pnlComparison, "pnl-comparison", pairs[2][3]);
    assert.equal(comparison.periods[0].totalRevenueMinor, "1000");
    assert.equal(comparison.periods[1].revenueChange, 250); assert.equal(comparison.periods[1].revenueChangeMinor, "250");
    assert.equal(comparison.periods[1].revenueChangePct, 25); assert.equal(comparison.periods[1].netIncomeChangePct, 0);
    const priorQuery = pairs[0][3] + "&compareFrom=2023-12-01&compareTo=2023-12-31";
    const prior = await get(profitLoss, "profit-and-loss", priorQuery);
    assert.equal(prior.comparison.totalRevenue, 1000);
    assert.deepEqual((await ma.call("profit_and_loss", { ...pairs[0][4], compareFrom: "2023-12-01", compareTo: "2023-12-31" })).body, prior);
    const cashResult = await get(profitLoss, "profit-and-loss", pairs[0][3] + "&basis=cash");
    assert.equal(cashResult.totalExpensesMinor, "0"); assert.equal(cashResult.totalRevenueMinor, "1250");
    assert.deepEqual(await snapshot(), before);
    await entry([{ accountId: expense.id, debit: 10 }], "2024-01-15", "posted", a.id, false, "payment");
    assert.equal((await get(profitLoss, "profit-and-loss", pairs[0][3] + "&basis=cash")).totalExpensesMinor, "10");
    const filtered = await get(profitLoss, "profit-and-loss", pairs[0][3] + `&costCenterId=${dimension.id}`);
    assert.equal(filtered.totalExpensesMinor, "250"); assert.equal(filtered.totalRevenueMinor, "0");
    assert.deepEqual((await ma.call("profit_and_loss", { ...pairs[0][4], costCenterId: dimension.id })).body, filtered);
    const untagged = await get(profitLoss, "profit-and-loss", pairs[0][3] + "&costCenterId=none");
    assert.equal(untagged.totalExpensesMinor, "10");
    assert.deepEqual((await ma.call("profit_and_loss", { ...pairs[0][4], costCenterId: "none" })).body, untagged);
    const [foreignDimension] = await db.insert(costCenter).values({ organizationId: b.id, code: "two", name: "Secret" }).returning();
    assert.equal((await profitLoss(request("profit-and-loss", pairs[0][3] + `&costCenterId=${foreignDimension.id}`))).status, 404);
    assert.equal((await ma.call("profit_and_loss", { ...pairs[0][4], costCenterId: foreignDimension.id })).isError, true);
    const [ownedProject, foreignProject] = await db.insert(project).values([
      { organizationId: a.id, name: "Owned project" }, { organizationId: b.id, name: "Secret project" },
    ]).returning();
    await db.execute(sql`update ${journalLine} set project_id=${ownedProject.id} where account_id=${expense.id} and cost_center_id=${dimension.id}`);
    const projectResult = await get(profitLoss, "profit-and-loss", pairs[0][3] + `&projectId=${ownedProject.id}`);
    assert.equal(projectResult.totalExpensesMinor, "250");
    assert.deepEqual((await ma.call("profit_and_loss", { ...pairs[0][4], projectId: ownedProject.id })).body, projectResult);
    assert.equal((await profitLoss(request("profit-and-loss", pairs[0][3] + `&projectId=${foreignProject.id}`))).status, 404);
    assert.equal((await ma.call("profit_and_loss", { ...pairs[0][4], projectId: foreignProject.id })).isError, true);
    assert.deepEqual((await ma.call("profit_and_loss", { ...pairs[0][4], costCenterId: dimension.id, projectId: foreignProject.id })).body, filtered);
    assert.equal((await get(incomeStatement, "income-statement", "")).revenue.totalMinor, "3249");
    assert.equal((await get(incomeStatement, "income-statement", "?to=2023-12-31")).revenue.totalMinor, "1000");
    await entry([{ accountId: empty.id, credit: 50 }], "2023-12-31");
    const priorOnly = await get(profitLoss, "profit-and-loss", priorQuery);
    assert.ok(!priorOnly.revenue.some((row: { accountId: string }) => row.accountId === empty.id));
    assert.equal(priorOnly.comparison.revenue.find((row: { accountId: string }) => row.accountId === empty.id).balanceMinor, "50");
    for (const [kind, name, handler, query, args] of pairs) {
      assert.equal((await handler(request(kind, query, "dk_bad_key"))).status, 401);
      assert.equal((await handler(request(kind, query, keys.denied))).status, 403);
      assert.equal((await noRead.call(name, args)).isError, true);
      const foreignBody = await (await handler(request(kind, query, keys.b))).json();
      assert.deepEqual((await mb.call(name, args)).body, foreignBody);
      assert.ok(!JSON.stringify(foreignBody).includes('"Revenue"'));
      for (const invalid of ["&unknown=1", "&format=csv", "&endDate=2024-02-30"]) {
        assert.equal((await handler(request(kind, query + invalid))).status, 400);
      }
    }
    for (const query of ["?startDate=2024-02-01&endDate=2024-01-01", "?compareFrom=2023-01-01", "?basis=bad", "?projectId=bad"]) {
      assert.equal((await profitLoss(request("profit-and-loss", query))).status, 400);
    }
    for (const args of [{ compareFrom: "2023-01-01" }, { startDate: "2024-02-01", endDate: "2024-01-01" }, { basis: "bad" }]) {
      assert.equal((await ma.call("profit_and_loss", args)).isError, true);
    }
    assert.equal((await incomeStatement(request("income-statement", "?from=2024-02-01&to=2024-01-01"))).status, 400);
    for (const args of [{ periods: 0 }, { periods: 13 }, { periods: 1.5 }, { compare: "bad" }, { asAt: "2024-02-30" }]) {
      assert.equal((await ma.call("pnl_comparison", args)).isError, true);
    }
    for (const currency of ["USD", "IRR", "JPY", "KWD"]) {
      await db.update(organization).set({ defaultCurrency: currency }).where(eq(organization.id, a.id));
      await parity();
      assert.equal((await get(incomeStatement, "income-statement", pairs[1][3])).revenue.total, "12.50");
      const exportQuery = priorQuery + "&format=xlsx";
      const response = await profitLoss(request("profit-and-loss", exportQuery)); assert.equal(response.status, 200);
      const ExcelJS = (await import("exceljs")).default; const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(Buffer.from(await response.arrayBuffer()) as never);
      const values: unknown[] = []; workbook.worksheets[0].eachRow(row => row.eachCell(cell => values.push(cell.value)));
      assert.ok(values.includes(currency === "KWD" ? 1.25 : currency === "USD" ? 12.5 : 1250));
      const emptyRow = workbook.worksheets[0].getRows(1, workbook.worksheets[0].rowCount)!.find(row => String(row.getCell(2).value).trim() === "Empty")!;
      assert.equal(emptyRow.getCell(3).value, 0);
      assert.equal(emptyRow.getCell(4).value, currency === "KWD" ? 0.05 : currency === "USD" ? 0.5 : 50);
      const toolExport = await ma.call("export_financial_statement", { statement: "profit_and_loss", format: "xlsx", from: "2024-01-01", to: "2024-01-31" });
      assert.equal(toolExport.isError, false, JSON.stringify(toolExport.body)); assert.equal(toolExport.body.encoding, "base64");
    }
    await db.update(organization).set({ defaultCurrency: "USD" }).where(eq(organization.id, a.id));
    const pdf = await profitLoss(request("profit-and-loss", priorQuery + "&format=pdf")); assert.equal(pdf.status, 200);
    assert.ok(Buffer.from(await pdf.arrayBuffer()).subarray(0, 5).equals(Buffer.from("%PDF-")));
    assert.equal((await noRead.call("export_financial_statement", { statement: "profit_and_loss", format: "pdf" })).isError, true);
    // No report changed any ledger/audit rows. The extra payment fixture is explicitly excluded here.
    const after = await snapshot();
    assert.deepEqual(after.chart_account, before.chart_account); assert.deepEqual(after.audit_log, before.audit_log);
    // Gross SUM exceeds int64 twice, then cancels exactly before exposed balances are narrowed.
    const huge = await entry([{ accountId: empty.id }, { accountId: empty.id }]);
    await db.execute(sql`update ${journalLine} set debit_amount=9223372036854775807, credit_amount=9223372036854775807 where journal_entry_id=${huge.id}`);
    await parity();
    const lines = await db.select({ id: journalLine.id }).from(journalLine).where(eq(journalLine.journalEntryId, huge.id));
    await db.execute(sql`update ${journalLine} set debit_amount=debit_amount-1 where id=${lines[0].id}`);
    assert.equal((await get(profitLoss, "profit-and-loss", pairs[0][3])).revenue.find((row: { accountId: string }) => row.accountId === empty.id).balanceMinor, "1");
    await db.delete(journalEntry).where(eq(journalEntry.id, huge.id));
    const edgePrior = await entry([{ accountId: empty.id, credit: 99000 }], "2023-12-31");
    const edge = await entry([{ accountId: empty.id, credit: Number.MAX_SAFE_INTEGER - 1250 }]);
    await parity(); // section total is exactly the safe maximum
    assert.equal((await get(incomeStatement, "income-statement", pairs[1][3])).revenue.total, "90071992547409.91");
    assert.equal((await profitLoss(request("profit-and-loss", pairs[0][3] + "&format=xlsx"))).status, 422);
    assert.equal((await ma.call("export_financial_statement", { statement: "profit_and_loss", format: "xlsx", from: "2024-01-01", to: "2024-01-31" })).body.code, "LEGACY_NUMERIC_RANGE");
    const one = await entry([{ accountId: empty.id, credit: 1 }]);
    const expectRange = async () => {
      const saved = await snapshot();
      for (const [kind, name, handler, query, args] of pairs) {
        const response = await handler(request(kind, query)); assert.equal(response.status, 422);
        assert.equal((await response.json()).code, "LEGACY_NUMERIC_RANGE");
        const tool = await ma.call(name, args); assert.equal(tool.isError, true); assert.equal(tool.body.code, "LEGACY_NUMERIC_RANGE");
      }
      assert.deepEqual(await snapshot(), saved);
    };
    await expectRange();
    await db.delete(journalEntry).where(eq(journalEntry.id, one.id));
    await db.delete(journalEntry).where(eq(journalEntry.id, edge.id));
    await db.delete(journalEntry).where(eq(journalEntry.id, edgePrior.id));
    // Consecutive changes and net income are separately bounded even when each period/section is safe.
    const currentChange = await entry([{ accountId: empty.id, credit: Number.MAX_SAFE_INTEGER - 1250 }]);
    const priorChange = await entry([{ accountId: empty.id, debit: Number.MAX_SAFE_INTEGER }], "2023-12-31");
    const deltaResponse = await pnlComparison(request("pnl-comparison", pairs[2][3]));
    assert.equal(deltaResponse.status, 422); assert.equal((await deltaResponse.json()).code, "LEGACY_NUMERIC_RANGE");
    assert.equal((await ma.call("pnl_comparison", pairs[2][4])).body.code, "LEGACY_NUMERIC_RANGE");
    await db.delete(journalEntry).where(eq(journalEntry.id, currentChange.id));
    await db.delete(journalEntry).where(eq(journalEntry.id, priorChange.id));
    const negativeExpense = await entry([{ accountId: expense.id, credit: Number.MAX_SAFE_INTEGER }]);
    await expectRange(); // revenue - a safe negative expense overflows net income
    await db.delete(journalEntry).where(eq(journalEntry.id, negativeExpense.id));
    const negative = await entry([{ accountId: empty.id, debit: 1 }]);
    await parity();
    assert.equal((await get(incomeStatement, "income-statement", pairs[1][3])).revenue.accounts.find((row: { name: string }) => row.name === "Empty").balance, "-0.01");
    await db.delete(journalEntry).where(eq(journalEntry.id, negative.id));
    await db.update(organization).set({ defaultCurrency: "BAD" }).where(eq(organization.id, a.id));
    await expectRange();
    console.log("REST and MCP period statements verified");
  } finally { await ma.close(); await mb.close(); await noRead.close(); }
}
run().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
