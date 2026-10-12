import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, chartAccount, inventoryItem, journalEntry, journalLine } from "../../lib/db/schema";
import { registerAllTools } from "../../lib/mcp/tools";
import { budgetUiPayload, budgetInput, budgetLinesInput, budgetDistribute, budgetMoney, accrualUiInput } from "../../lib/money/budget-ui";
import { projectCrmUiPayload } from "../../lib/money/project-crm-ui";
import { projectCentsInput, projectHoursInput, projectTimeCents } from "../../lib/money/project-display";
import { generatePeriods } from "../../lib/budget-periods";

const endpoints: Record<string, [string, string]> = {
  create_budget: ["/budgets", "POST"], get_budget: ["/budgets/[id]", "GET"], update_budget: ["/budgets/[id]", "PATCH"], budget_vs_actual: ["/reports/budget-vs-actual", "GET"],
  create_project: ["/projects", "POST"], get_project: ["/projects/[id]", "GET"], create_project_time_entry: ["/projects/[id]/time-entries", "POST"], get_project_billing_preview: ["/projects/[id]/progress-invoice", "GET"],
  create_pipeline: ["/crm/pipelines", "POST"], create_deal: ["/crm/deals", "POST"], get_deal: ["/crm/deals/[id]", "GET"], list_deals: ["/crm/deals", "GET"], get_crm_analytics: ["/crm/analytics", "GET"],
  create_price_list: ["/price-lists", "POST"], add_price_list_item: ["/price-lists/[id]/items", "POST"], resolve_price: ["/price-lists/[id]/resolve", "GET"], create_accrual_schedule: ["/accrual-schedules", "POST"],
};
async function run() {
  const [owner] = await db.insert(users).values({ email: "mon157@example.test" }).returning();
  for (const currency of ["USD", "JPY", "KWD"]) for (const mode of ["rest", "mcp"] as const) {
    const [org] = await db.insert(organization).values({ name: `UI ${currency} ${mode}`, slug: `ui-${currency}-${mode}`, defaultCurrency: currency }).returning();
    await db.insert(member).values({ organizationId: org.id, userId: owner.id, role: "owner" });
    const key = `dk_mon157_${currency}_${mode}`;
    await db.insert(apiKey).values({ organizationId: org.id, createdBy: owner.id, name: "Synthetic", keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_mon157" });
    const [expense, contra] = await db.insert(chartAccount).values([
      { organizationId: org.id, code: "5000", name: "Expense", type: "expense" as const, currencyCode: currency },
      { organizationId: org.id, code: "2000", name: "Accrued", type: "liability" as const, currencyCode: currency },
    ]).returning();
    const server = new McpServer({ name: "UI adapters", version: "1" });
    registerAllTools(server, { organizationId: org.id, userId: owner.id, role: "owner" });
    const client = new Client({ name: "Fixture", version: "1" }), [ct, st] = InMemoryTransport.createLinkedPair();
    await server.connect(st); await client.connect(ct);
    async function raw(transport: "rest" | "mcp", name: string, args: Record<string, unknown>) {
      if (transport === "mcp") {
        const result = await client.callTool({ name, arguments: args });
        const text = (result.content as { text: string }[])[0].text;
        const parsed = text.startsWith("{") ? JSON.parse(text) : { error: text };
        return { failed: result.isError === true, body: name === "create_accrual_schedule" && parsed.accrualSchedule ? { schedule: parsed.accrualSchedule } : parsed };
      }
      const [route, method] = endpoints[name], body = { ...args }, params: Record<string, string> = {}, query = new URLSearchParams();
      if (route.includes("[id]")) {
        const field = route.startsWith("/budgets") ? "budgetId" : route.startsWith("/projects") ? "projectId" : route.startsWith("/price-lists") ? "priceListId" : "dealId";
        params.id = String(body[field]); delete body[field];
      }
      if (method === "GET") for (const [key, value] of Object.entries(body)) query.set(key, String(value));
      const routeModule = await import(pathToFileURL(path.resolve(`app/api/v1${route}/route.ts`)).href);
      const response: Response = await routeModule[method](new Request(`http://fixture.test/api/v1${route}?${query}`, {
        method, headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
        ...(method === "GET" ? {} : { body: JSON.stringify(body) }),
      }), { params: Promise.resolve(params) });
      return { failed: !response.ok, body: await response.json() };
    }
    async function call(transport: "rest" | "mcp", name: string, args: Record<string, unknown> = {}) {
      const result = await raw(transport, name, args); assert.equal(result.failed, false, `${name}: ${JSON.stringify(result.body)}`); return result.body;
    }
    const other = mode === "rest" ? "mcp" : "rest";
    const snapshot = async () => (await db.execute(sql.raw(`select jsonb_build_object(${["budget", "budget_line", "budget_period", "project", "time_entry", "deal", "accrual_schedule", "audit_log"].map(table => `'${table}',(select jsonb_agg(to_jsonb(t)::text order by id) from ${table} t)`).join(",")}) as rows`))).rows;
    try {
      const periods = generatePeriods("monthly", "2024-01-01", "2024-03-31");
      const line = (accountId: string, total: bigint) => ({ accountId, total, periods: periods.map((p, i) => ({ ...p, amount: budgetDistribute(total, periods.length)[i] })) });
      const lines = budgetLinesInput([line(expense.id, budgetInput("30000000.01")), line(contra.id, -1n)]);
      const saved = (await call(mode, "create_budget", { name: "Signed UI", startDate: "2024-01-01", endDate: "2024-03-31", periodType: "monthly", lines })).budget;
      const root = { budgetId: saved.id };
      const restBudget = budgetUiPayload(await call("rest", "get_budget", root)), mcpBudget = budgetUiPayload(await call("mcp", "get_budget", root));
      assert.deepEqual(restBudget, mcpBudget);
      assert.equal(restBudget.budget.lines.find((l: { accountId: string }) => l.accountId === expense.id).total, 3000000001n);
      const persisted = (await db.execute(sql`select total::text as total from budget_line where budget_id=${saved.id} order by total desc`)).rows;
      assert.deepEqual(persisted, [{ total: "3000000001" }, { total: "-1" }]);
      const [posted] = await db.insert(journalEntry).values({ organizationId: org.id, entryNumber: 1, date: "2024-01-01", status: "posted", description: "Negative spend fixture" }).returning();
      await db.insert(journalLine).values([{ journalEntryId: posted.id, accountId: expense.id, debitAmount: 0, creditAmount: 1 }, { journalEntryId: posted.id, accountId: contra.id, debitAmount: 1, creditAmount: 0 }]);
      const restReport = budgetUiPayload(await call("rest", "budget_vs_actual", root)), mcpReport = budgetUiPayload(await call("mcp", "budget_vs_actual", root));
      assert.deepEqual(restReport, mcpReport); assert.equal(restReport.currencyCode, currency);
      assert.equal(restReport.totalBudgeted, 3000000000n); assert.equal(restReport.totalActual, -2n); assert.equal(restReport.totalVariance, 3000000002n);
      assert.match(budgetMoney(restReport.totalVariance, currency), /30,000,000\.02/);
      const expected = (await db.execute(sql`select sum(debit_amount-credit_amount)::text as actual from journal_line where journal_entry_id=${posted.id} and account_id=${expense.id}`)).rows[0].actual;
      assert.equal(restReport.comparisons.find((c: { accountId: string }) => c.accountId === expense.id).actual.toString(), expected);
      await call(other, "update_budget", { ...root, lines: budgetLinesInput([line(expense.id, 1n), line(contra.id, -1n)]) });
      const replaced = budgetUiPayload(await call(mode, "get_budget", root)); assert.equal(replaced.budget.lines.reduce((sum: bigint, l: { total: bigint }) => sum + l.total, 0n), 0n);

      const project = projectCrmUiPayload(await call(mode, "create_project", { name: "Low digits", currency, budgetMinor: projectCentsInput("30000000.01"), hourlyRateMinor: "1251" })).project;
      await call(other, "create_project_time_entry", { projectId: project.id, date: "2024-01-01", minutes: projectHoursInput("0.5"), hourlyRateMinor: "1251", isBillable: true });
      const preview = projectCrmUiPayload(await call(mode, "get_project_billing_preview", { projectId: project.id }));
      assert.equal(preview.totalAmountMinor, "626"); assert.equal(projectTimeCents(30, 1251), 626n);
      const detail = projectCrmUiPayload(await call(other, "get_project", { projectId: project.id })); assert.equal(detail.project.budgetMinor, "3000000001"); assert.equal(detail.project.totalHours, 30);
      assert.deepEqual((await db.execute(sql`select budget::text as budget, hourly_rate::text as rate from project where id=${project.id}`)).rows, [{ budget: "3000000001", rate: "1251" }]);

      const pipeline = (await call(mode, "create_pipeline", { name: "Sales", stages: [{ id: "open", name: "Open", color: "#112233" }] })).pipeline;
      const deal = projectCrmUiPayload(await call(other, "create_deal", { pipelineId: pipeline.id, stageId: "open", title: "Low digits", currency, valueCentsMinor: projectCentsInput("30000000.01"), probability: 50 })).deal;
      projectCrmUiPayload(await call(mode, "get_deal", { dealId: deal.id }));
      const list = projectCrmUiPayload(await call(mode, "list_deals", { currency }));
      assert.equal(list.summary.activeValueMinor, "3000000001");
      const analytics = projectCrmUiPayload(await call(other, "get_crm_analytics", { currency })); assert.equal(analytics.totalPipelineValueMinor, "3000000001");
      assert.deepEqual((await db.execute(sql`select value_cents::text as value from deal where id=${deal.id}`)).rows, [{ value: "3000000001" }]);
      const [stock] = await db.insert(inventoryItem).values({ organizationId: org.id, code: "UI", name: "Stock" }).returning();
      const priceList = (await call(mode, "create_price_list", { name: "Price", currencyCode: currency })).priceList;
      projectCrmUiPayload(await call(other, "add_price_list_item", { priceListId: priceList.id, inventoryItemId: stock.id, unitPriceMinor: "3000000001" }));
      const resolved = projectCrmUiPayload(await call(mode, "resolve_price", { priceListId: priceList.id, inventoryItemId: stock.id, quantity: 1 })); assert.equal(resolved.resolved.unitPriceMinor, "3000000001");

      const accrual = accrualUiInput("1.005"), retry = randomUUID();
      const header = { description: "Rounded", startDate: "2024-01-01", endDate: "2024-03-31", periods: 3, accountId: contra.id, reverseAccountId: expense.id, idempotencyKey: retry };
      const schedule = projectCrmUiPayload(await call(mode, "create_accrual_schedule", { ...header, ...(mode === "rest" ? { totalAmountExact: accrual.exact } : { totalAmountMinor: accrual.minor }) })).schedule;
      assert.equal(schedule.totalAmountMinor, "101");
      const beforeReplay = await snapshot();
      assert.equal((await call(other, "create_accrual_schedule", { ...header, ...(other === "rest" ? { totalAmountExact: accrual.exact } : { totalAmountMinor: accrual.minor }) })).schedule.id, schedule.id);
      assert.deepEqual(await snapshot(), beforeReplay);
      assert.deepEqual((await db.execute(sql`select total_amount::text as amount from accrual_schedule where id=${schedule.id}`)).rows, [{ amount: "101" }]);
      for (const transport of [mode, other] as const) {
        const before = await snapshot();
        assert.equal((await raw(transport, "update_budget", { ...root, lines: [{ accountId: expense.id, total: 1, totalMinor: "2" }] })).failed, true);
        assert.equal((await raw(transport, "create_deal", { pipelineId: pipeline.id, stageId: "open", title: "Invalid", valueCents: 1, valueCentsMinor: "2" })).failed, true);
        assert.deepEqual(await snapshot(), before);
      }
      const beforeRead = await snapshot();
      assert.throws(() => projectCrmUiPayload({ ...deal, valueCentsMinor: "3000000002" }));
      assert.throws(() => budgetUiPayload({ amount: 1, amountMinor: "2" }));
      assert.deepEqual(await snapshot(), beforeRead);
    } finally { await client.close(); await server.close(); }
  }
  console.log("Budget project CRM UI contracts verified: 6 workflows");
}
run().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
