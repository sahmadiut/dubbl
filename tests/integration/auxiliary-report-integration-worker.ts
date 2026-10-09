// Only invoked by the migrated disposable-database harness.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, customRole, apiKey, chartAccount } from "../../lib/db/schema";
import type { AuthContext } from "../../lib/api/auth-context";
import { registerAllTools } from "../../lib/mcp/tools";
import * as budgets from "../../app/api/v1/budgets/route";
import * as budgetDetail from "../../app/api/v1/budgets/[id]/route";
import * as items from "../../app/api/v1/inventory/route";
import * as itemDetail from "../../app/api/v1/inventory/[id]/route";
import * as employees from "../../app/api/v1/payroll/employees/route";
import * as employeeDetail from "../../app/api/v1/payroll/employees/[id]/route";
import * as assets from "../../app/api/v1/fixed-assets/route";
import * as assetDetail from "../../app/api/v1/fixed-assets/[id]/route";
import * as loans from "../../app/api/v1/loans/route";
import * as loanDetail from "../../app/api/v1/loans/[id]/route";
import * as projects from "../../app/api/v1/projects/route";
import * as projectDetail from "../../app/api/v1/projects/[id]/route";
import * as accruals from "../../app/api/v1/accrual-schedules/route";
import * as accrualDetail from "../../app/api/v1/accrual-schedules/[id]/route";
import { POST as postAccrual } from "../../app/api/v1/accrual-schedules/[id]/post/route";
import { GET as profitAndLoss } from "../../app/api/v1/reports/profit-and-loss/route";
import { GET as budgetActual } from "../../app/api/v1/reports/budget-vs-actual/route";
import { GET as consolidation } from "../../app/api/v1/consolidation/groups/[id]/report/route";

async function connect(ctx: AuthContext) {
  const server = new McpServer({ name: "Auxiliary report parent", version: "1" });
  registerAllTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1" });
  const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
  const tools = (await client.listTools()).tools;
  return { tools, async call(name: string, args: object = {}) {
    const result = await client.callTool({ name, arguments: { ...args } });
    const text = (result.content as { text: string }[])[0].text;
    return { isError: result.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
  }, async close() { await client.close(); await server.close(); } };
}

function aliases(value: unknown) {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (key.endsWith("Minor") && typeof child === "string") {
      assert.match(child, /^(0|-?[1-9]\d*)$/);
      const legacy: unknown = (value as Record<string, unknown>)[key.slice(0, -5)];
      if (typeof legacy === "number") { assert.ok(Number.isSafeInteger(legacy)); assert.equal(child, String(legacy)); }
      else if (typeof legacy === "string" && /^-?\d+\.\d{2}$/.test(legacy)) assert.equal(BigInt(child), BigInt(legacy.replace(".", "")));
    }
    aliases(child);
  }
}

async function run() {
  // Avoid JIT compilation of the large all-table assertion query; product
  // queries and transactional semantics are unchanged.
  await db.execute(sql`set jit=off`);
  const [a, b] = await db.insert(organization).values([{ name: "Auxiliary parent A", slug: "aux-parent-a" },
    { name: "Auxiliary parent B", slug: "aux-parent-b" }]).returning();
  const [owner, denied] = await db.insert(users).values([{ email: "aux-parent@example.test" }, { email: "aux-denied@example.test" }]).returning();
  const [role] = await db.insert(customRole).values({ organizationId: a.id, name: "No grants", permissions: [] }).returning();
  await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner" }, { organizationId: b.id, userId: owner.id, role: "owner" },
    { organizationId: a.id, userId: denied.id, role: "member", customRoleId: role.id }]);
  const keys = { a: "dk_aux_parent_a", b: "dk_aux_parent_b", denied: "dk_aux_parent_denied" };
  for (const [label, key] of Object.entries(keys)) await db.insert(apiKey).values({ organizationId: label === "b" ? b.id : a.id,
    createdBy: label === "denied" ? denied.id : owner.id, name: label, keyPrefix: "dk_aux_parent", keyHash: createHash("sha256").update(key).digest("hex") });
  const ctx: AuthContext = { organizationId: a.id, userId: owner.id, role: "owner" };
  const ma = await connect(ctx), mb = await connect({ ...ctx, organizationId: b.id });
  const noAccess = await connect({ ...ctx, userId: denied.id, role: "member", permissions: [] });
  const req = (path: string, key = keys.a, body?: object) => new Request(`http://fixture.test/api/v1/${path}`, {
    method: body === undefined ? "GET" : "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-organization-id": b.id },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const params = (id: string) => ({ params: Promise.resolve({ id }) });
  const data = async (r: Response, status = 200) => { const body = await r.json(); assert.equal(r.status, status, JSON.stringify(body)); aliases(body); return body; };
  const good = async (tool: string, input: object = {}) => {
    const r = await ma.call(tool, input); assert.equal(r.isError, false, JSON.stringify(r)); aliases(r.body); return r.body;
  };
  // Capture every domain, reference, financial, configuration and audit table in
  // one snapshot. Only API-key last-used authentication bookkeeping is excluded.
  const tableRows = await db.execute(sql`select tablename from pg_tables where schemaname='public' and tablename <> 'api_key' order by tablename`);
  const names = tableRows.rows.map(r => String(r.tablename));
  assert.ok(names.every(n => /^[a-z_]+$/.test(n)));
  const snapshot = async () => (await db.execute(sql.raw(names.map(n =>
    `select '${n}' as name, coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text), '[]'::jsonb)::text as rows from "${n}" t`).join(" union all ")))).rows;
  const unchanged = async (fn: () => Promise<unknown>) => { const before = await snapshot(); await fn(); assert.deepEqual(await snapshot(), before); };
  const [prepaid, expense, liability] = await db.insert(chartAccount).values([
    { organizationId: a.id, code: "1500", name: "Prepaid", type: "asset" as const },
    { organizationId: a.id, code: "5900", name: "Cost", type: "expense" as const },
    { organizationId: a.id, code: "2300", name: "Loan", type: "liability" as const },
  ]).returning();
  const window = { startDate: "2024-01-01", endDate: "2024-01-31" };
  const specs = [
    { path: "budgets", create: budgets.POST, get: budgetDetail.GET, tool: "create_budget", reader: "get_budget", idField: "budgetId", restRoot: "budget", mcpRoot: "budget",
      base: { name: "Plan", ...window, periodType: "custom" }, money: "total", nested: true },
    { path: "inventory", create: items.POST, get: itemDetail.GET, tool: "create_inventory_item", reader: "get_inventory_item", idField: "inventoryItemId", restRoot: "inventoryItem", mcpRoot: "inventoryItem",
      base: { code: "AUX", name: "Item" }, money: "purchasePrice" },
    { path: "payroll/employees", create: employees.POST, get: employeeDetail.GET, tool: "create_payroll_employee", reader: "get_payroll_employee", idField: "employeeId", restRoot: "employee", mcpRoot: "employee",
      base: { name: "Employee", employeeNumber: "AUX", startDate: window.startDate, taxRate: 0 }, money: "salary" },
    { path: "fixed-assets", create: assets.POST, get: assetDetail.GET, tool: "create_fixed_asset", reader: "get_fixed_asset", idField: "assetId", restRoot: "asset", mcpRoot: "asset",
      base: { name: "Asset", assetNumber: "AUX", purchaseDate: window.startDate, usefulLifeMonths: 12 }, money: "purchasePrice" },
    { path: "loans", create: loans.POST, get: loanDetail.GET, tool: "create_loan", reader: "get_loan", idField: "loanId", restRoot: "loan", mcpRoot: "loan",
      base: { name: "Loan", interestRate: 0, termMonths: 2, startDate: window.startDate, principalAccountId: liability.id, interestAccountId: expense.id }, money: "principalAmount", major: true },
    { path: "projects", create: projects.POST, get: projectDetail.GET, tool: "create_project", reader: "get_project", idField: "projectId", restRoot: "project", mcpRoot: "project",
      base: { name: "Project", currency: "USD" }, money: "budget" },
    { path: "accrual-schedules", create: accruals.POST, get: accrualDetail.GET, tool: "create_accrual_schedule", reader: "get_accrual_schedule", idField: "scheduleId", restRoot: "schedule", mcpRoot: "accrualSchedule",
      base: { description: "Prepaid", ...window, periods: 1, accountId: prepaid.id, reverseAccountId: expense.id }, money: "totalAmount", major: true },
  ];
  const input = (spec: typeof specs[number], mode: "legacy" | "exact" | "unsafe" | "conflict", suffix: string) => {
    const amounts = mode === "legacy" ? { [spec.money]: spec.major ? 12.5 : 1250 }
      : mode === "exact" ? { [`${spec.money}Minor`]: "2147483750" }
      : mode === "unsafe" ? { [`${spec.money}Minor`]: "9007199254740992" }
      : { [spec.money]: 1250, [`${spec.money}Minor`]: "1251" };
    return { ...spec.base, ...("code" in spec.base ? { code: `AUX-${suffix}` } : {}),
      ...("assetNumber" in spec.base ? { assetNumber: `AUX-${suffix}` } : {}),
      ...(spec.nested ? { lines: [{ accountId: expense.id, ...amounts }] } : amounts) };
  };
  const records = new Map<string, { legacy: string; exact: string }>();
  try {
    for (const spec of specs) {
      // Execute unknown controls before any valid creation; schema stripping must
      // never turn a rejected organization override into an authorized write.
      await unchanged(async () => {
        const r = await ma.call(spec.tool, { ...input(spec, "exact", "unknown"), organizationId: b.id });
        assert.equal(r.isError, true, `${spec.tool} silently stripped unknown controls`);
      });
      const tool = ma.tools.find(t => t.name === spec.tool)!; assert.ok(tool.description);
      assert.equal(tool.inputSchema.additionalProperties, false, spec.tool);
      for (const field of Object.values(tool.inputSchema.properties ?? {})) assert.ok((field as { description?: string }).description, spec.tool);
      const ids = { legacy: "", exact: "" };
      for (const mode of ["legacy", "exact"] as const) {
        const body = input(spec, mode, mode);
        const saved = mode === "legacy" ? (await data(await spec.create(req(spec.path, keys.a, body)), 201))[spec.restRoot]
          : (await good(spec.tool, body))[spec.mcpRoot];
        ids[mode] = saved.id;
        const read = await good(spec.reader, { [spec.idField]: saved.id });
        const rest = await data(await spec.get(req(`${spec.path}/${saved.id}`), params(saved.id)));
        assert.deepEqual(rest[spec.restRoot], read[spec.mcpRoot], spec.reader);
        const row = spec.nested ? read[spec.mcpRoot].lines[0] : read[spec.mcpRoot];
        assert.equal(row[`${spec.money}Minor`], mode === "legacy" ? "1250" : "2147483750", spec.reader);
      }
      records.set(spec.path, ids);
      for (const mode of ["unsafe", "conflict"] as const) await unchanged(async () => {
        const body = input(spec, mode, mode);
        const rest = await spec.create(req(spec.path, keys.a, body));
        assert.equal(rest.status, mode === "unsafe" ? 422 : 400, spec.tool);
        const m = await ma.call(spec.tool, body); assert.equal(m.isError, true, spec.tool);
        if (mode === "unsafe") assert.equal(m.body.code, "LEGACY_NUMERIC_RANGE", spec.tool);
      });
      await unchanged(async () => {
        const body = input(spec, "exact", "denied");
        assert.equal((await spec.create(req(spec.path, "dk_invalid", body))).status, 401);
        assert.equal((await spec.create(req(spec.path, keys.denied, body))).status, 403);
        assert.equal((await noAccess.call(spec.tool, body)).body.status, 403);
        assert.equal((await spec.get(req(`${spec.path}/${ids.exact}`, "dk_invalid"), params(ids.exact))).status, 401, spec.reader);
        const restrictedRead = ["get_payroll_employee", "get_fixed_asset", "get_accrual_schedule"].includes(spec.reader);
        assert.equal((await spec.get(req(`${spec.path}/${ids.exact}`, keys.denied), params(ids.exact))).status, restrictedRead ? 403 : 200, spec.reader);
        const deniedRead = await noAccess.call(spec.reader, { [spec.idField]: ids.exact });
        assert.equal(deniedRead.isError, restrictedRead, spec.reader);
        if (restrictedRead) assert.equal(deniedRead.body.status, 403, spec.reader);
        assert.equal((await spec.get(req(`${spec.path}/${ids.exact}`, keys.b), params(ids.exact))).status, 404);
        assert.equal((await mb.call(spec.reader, { [spec.idField]: ids.exact })).body.status, 404);
      });
    }
    const budgetId = records.get("budgets")!.exact;
    const budgetSpec = specs[0];
    // Cover every changed registration through the actual SDK, plus nested
    // REST/MCP controls that previously disappeared during Zod parsing.
    await unchanged(async () => {
      for (const [tool, args] of [["list_budgets", {}], ["get_budget", { budgetId }],
        ["update_budget", { budgetId, name: "Rejected rename" }], ["delete_budget", { budgetId }]] as const) {
        assert.equal(ma.tools.find(t => t.name === tool)!.inputSchema.additionalProperties, false, tool);
        assert.equal((await ma.call(tool, { ...args, organizationId: b.id })).isError, true, tool);
      }
      for (const line of [
        { accountId: expense.id, totalMinor: "1250", organizationId: b.id },
        { accountId: expense.id, totalMinor: "1250", periods: [{ label: "January", ...window, amountMinor: "1250", organizationId: b.id }] },
      ]) {
        const body = { ...budgetSpec.base, lines: [line] };
        assert.equal((await budgets.POST(req("budgets", keys.a, body))).status, 400);
        assert.equal((await ma.call("create_budget", body)).isError, true);
        assert.equal((await budgetDetail.PATCH(new Request(`http://fixture.test/api/v1/budgets/${budgetId}`, {
          method: "PATCH", headers: { authorization: `Bearer ${keys.a}`, "content-type": "application/json" }, body: JSON.stringify({ lines: [line] }),
        }), params(budgetId))).status, 400);
        assert.equal((await ma.call("update_budget", { budgetId, lines: [line] })).isError, true);
      }
      assert.equal((await budgets.POST(req("budgets", keys.a, { ...input(budgetSpec, "exact", "unknown-rest"), organizationId: b.id }))).status, 400);
      assert.equal((await budgetDetail.PATCH(new Request(`http://fixture.test/api/v1/budgets/${budgetId}`, {
        method: "PATCH", headers: { authorization: `Bearer ${keys.a}`, "content-type": "application/json" }, body: JSON.stringify({ name: "Rejected", organizationId: b.id }),
      }), params(budgetId))).status, 400);
    });
    await good("update_budget", { budgetId, name: "Valid rename" });
    assert.equal((await good("get_budget", { budgetId })).budget.name, "Valid rename");
    assert.ok((await good("list_budgets")).budgets.some((r: { id: string }) => r.id === budgetId));
    const removable = (await good("create_budget", input(budgetSpec, "exact", "removable"))).budget;
    await good("delete_budget", { budgetId: removable.id });
    assert.equal((await ma.call("get_budget", { budgetId: removable.id })).body.status, 404);
    const schedules = records.get("accrual-schedules")!;
    const legacy = (await good("get_accrual_schedule", { scheduleId: schedules.legacy })).accrualSchedule;
    const exact = (await good("get_accrual_schedule", { scheduleId: schedules.exact })).accrualSchedule;
    await data(await postAccrual(req("accrual-schedules", keys.a, { entryId: legacy.entries[0].id }), params(legacy.id)));
    await good("post_accrual_entry", { scheduleId: exact.id, entryId: exact.entries[0].id });
    const total = "2147485000";
    const plan = (await good("create_budget", { name: "Posted allocation", ...window, periodType: "custom",
      lines: [{ accountId: expense.id, totalMinor: total, periods: [{ label: "January", ...window, amountMinor: total }] }] })).budget;
    const group = (await good("create_consolidation_group", { name: "Parent worksheet", presentationCurrency: "USD" })).group;
    await good("add_consolidation_member", { groupId: group.id, orgId: a.id });
    await unchanged(async () => {
      const query = new URLSearchParams(window);
      const pnl = await data(await profitAndLoss(req(`reports/profit-and-loss?${query}`)));
      assert.deepEqual(pnl, await good("profit_and_loss", window));
      assert.equal(pnl.totalExpensesMinor, total); assert.equal(pnl.netIncomeMinor, "-2147485000");
      const br = await data(await budgetActual(req(`reports/budget-vs-actual?budgetId=${plan.id}`)));
      assert.deepEqual(br, await good("budget_vs_actual", { budgetId: plan.id }));
      assert.equal(br.totalActualMinor, total); assert.equal(br.totalVarianceMinor, "0");
      const cr = await data(await consolidation(req(`consolidation/groups/${group.id}/report?${query}`), params(group.id)));
      assert.deepEqual(cr, await good("get_consolidation_report", { groupId: group.id, ...window }));
      assert.equal(cr.consolidatedPnL.netIncomeMinor, pnl.netIncomeMinor);
      // Masters and unposted plans do not independently invent ledger costs.
      const journals = await db.execute(sql`select e.id, sum(l.debit_amount::numeric)::text as debit, sum(l.credit_amount::numeric)::text as credit
        from journal_entry e join journal_line l on l.journal_entry_id=e.id group by e.id`);
      assert.equal(journals.rows.length, 2);
      for (const j of journals.rows) assert.equal(j.debit, j.credit);
    });
    await unchanged(async () => {
      assert.equal((await noAccess.call("profit_and_loss", window)).body.status, 403);
      assert.equal((await mb.call("get_consolidation_report", { groupId: group.id, ...window })).body.status, 404);
      assert.equal((await ma.call("set_organization_currency", { currencyCode: "EUR" })).body.status, 409);
      // A targeted replay cannot post another period or create another audit.
      await good("post_accrual_entry", { scheduleId: legacy.id, entryId: legacy.entries[0].id });
      await data(await postAccrual(req("accrual-schedules", keys.a, { entryId: exact.entries[0].id }), params(exact.id)));
    });
    await db.execute(sql`update journal_line set debit_amount=9007199254740992 where id=(select id from journal_line where debit_amount>0 limit 1)`);
    await unchanged(async () => {
      assert.equal((await profitAndLoss(req(`reports/profit-and-loss?${new URLSearchParams(window)}`))).status, 422);
      assert.equal((await ma.call("profit_and_loss", window)).body.code, "LEGACY_NUMERIC_RANGE");
      assert.equal((await ma.call("budget_vs_actual", { budgetId: plan.id })).body.code, "LEGACY_NUMERIC_RANGE");
      assert.equal((await ma.call("get_consolidation_report", { groupId: group.id, ...window })).body.code, "LEGACY_NUMERIC_RANGE");
    });
    console.log("Combined auxiliary report contracts verified");
  } finally { await ma.close(); await mb.close(); await noAccess.close(); }
}
run().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
