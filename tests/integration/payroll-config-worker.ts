import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, customRole, payrollEmployee, employeeDeduction, payrollSettings, taxBracket, taxAllowanceConfig, chartAccount, payrollRun } from "../../lib/db/schema";
import { computeEmployeeWithholding } from "../../lib/api/payroll-withholding";
import type { AuthContext } from "../../lib/api/auth-context";
import { registerPayrollConfigTools } from "../../lib/mcp/tools/payroll-config";
import { registerAllTools } from "../../lib/mcp/tools";
import * as route0 from "../../app/api/v1/payroll/settings/route";
import * as route1 from "../../app/api/v1/payroll/deductions/types/route";
import * as route2 from "../../app/api/v1/payroll/deductions/types/[id]/route";
import * as route3 from "../../app/api/v1/payroll/employees/[id]/deductions/route";
import * as route4 from "../../app/api/v1/payroll/employees/[id]/deductions/[deductionId]/route";
import * as route5 from "../../app/api/v1/payroll/employees/[id]/tax-config/route";
import * as route6 from "../../app/api/v1/payroll/tax/brackets/route";
import * as route7 from "../../app/api/v1/payroll/tax/brackets/[id]/route";
import * as route8 from "../../app/api/v1/payroll/tax/allowances/route";
import * as route9 from "../../app/api/v1/payroll/tax/allowances/[id]/route";
const routes = [route0, route1, route2, route3, route4, route5, route6, route7, route8, route9];
const definitions = [{"name":"get_payroll_settings","env":"settings","args":[],"verb":"GET","routeIndex":0,"body":false},{"name":"update_payroll_settings","env":"settings","args":[],"verb":"PUT","routeIndex":0,"body":true},{"name":"list_payroll_deduction_types","env":"data","args":[],"verb":"GET","routeIndex":1,"body":false},{"name":"get_payroll_deduction_type","env":"deductionType","args":["id"],"verb":"GET","routeIndex":2,"body":false},{"name":"create_payroll_deduction_type","env":"deductionType","args":[],"verb":"POST","routeIndex":1,"body":true},{"name":"update_payroll_deduction_type","env":"deductionType","args":["id"],"verb":"PATCH","routeIndex":2,"body":true},{"name":"delete_payroll_deduction_type","env":"","args":["id"],"verb":"DELETE","routeIndex":2,"body":false},{"name":"list_payroll_employee_deductions","env":"data","args":["employeeId"],"verb":"GET","routeIndex":3,"body":false},{"name":"create_payroll_employee_deduction","env":"deduction","args":["employeeId"],"verb":"POST","routeIndex":3,"body":true},{"name":"update_payroll_employee_deduction","env":"deduction","args":["employeeId","id"],"verb":"PATCH","routeIndex":4,"body":true},{"name":"delete_payroll_employee_deduction","env":"","args":["employeeId","id"],"verb":"DELETE","routeIndex":4,"body":false},{"name":"get_payroll_employee_tax_config","env":"taxConfig","args":["employeeId"],"verb":"GET","routeIndex":5,"body":false},{"name":"update_payroll_employee_tax_config","env":"taxConfig","args":["employeeId"],"verb":"PUT","routeIndex":5,"body":true},{"name":"list_payroll_tax_brackets","env":"data","args":[],"verb":"GET","routeIndex":6,"body":false},{"name":"get_payroll_tax_bracket","env":"bracket","args":["id"],"verb":"GET","routeIndex":7,"body":false},{"name":"create_payroll_tax_bracket","env":"bracket","args":[],"verb":"POST","routeIndex":6,"body":true},{"name":"update_payroll_tax_bracket","env":"bracket","args":["id"],"verb":"PATCH","routeIndex":7,"body":true},{"name":"delete_payroll_tax_bracket","env":"","args":["id"],"verb":"DELETE","routeIndex":7,"body":false},{"name":"list_payroll_tax_allowances","env":"data","args":[],"verb":"GET","routeIndex":8,"body":false},{"name":"get_payroll_tax_allowance","env":"allowance","args":["id"],"verb":"GET","routeIndex":9,"body":false},{"name":"create_payroll_tax_allowance","env":"allowance","args":[],"verb":"POST","routeIndex":8,"body":true},{"name":"update_payroll_tax_allowance","env":"allowance","args":["id"],"verb":"PATCH","routeIndex":9,"body":true},{"name":"delete_payroll_tax_allowance","env":"","args":["id"],"verb":"DELETE","routeIndex":9,"body":false}];

async function mcp(ctx: AuthContext, full = false) {
  const server = new McpServer({ name: "Payroll configuration fixture", version: "1" });
  if (full) registerAllTools(server, ctx); else registerPayrollConfigTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1" }), [ct, st] = InMemoryTransport.createLinkedPair();
  await server.connect(st); await client.connect(ct);
  const tools = (await client.listTools()).tools;
  assert.equal(new Set(tools.map(t => t.name)).size, tools.length);
  if (!full) assert.equal(tools.length, definitions.length);
  for (const def of definitions) {
    const tool = tools.find(t => t.name === def.name); assert.ok(tool, def.name); assert.equal(tool.inputSchema.additionalProperties, false);
    for (const field of Object.values(tool.inputSchema.properties ?? {})) assert.ok((field as { description?: string }).description, def.name);
  }
  return { async call(name: string, args: Record<string, unknown> = {}) {
    const result = await client.callTool({ name, arguments: args }), text = (result.content as { text: string }[])[0].text;
    return { isError: result.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
  }, async close() { await client.close(); await server.close(); } };
}
async function run() {
  const [a, b] = await db.insert(organization).values([{ name: "Config A", slug: "payroll-config-a" }, { name: "Config B", slug: "payroll-config-b" }]).returning();
  const [owner, viewer, manager] = await db.insert(users).values([{ email: "config-owner@example.test" }, { email: "config-viewer@example.test" }, { email: "config-manager@example.test" }]).returning();
  const [viewRole, manageRole] = await db.insert(customRole).values([{ organizationId: a.id, name: "No payroll", permissions: [] },
    { organizationId: a.id, name: "Config manager", permissions: ["manage:payroll", "manage:tax-config"] }]).returning();
  await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner" }, { organizationId: b.id, userId: owner.id, role: "owner" },
    { organizationId: a.id, userId: viewer.id, customRoleId: viewRole.id }, { organizationId: a.id, userId: manager.id, customRoleId: manageRole.id }]);
  const keys = { a: "dk_payroll_config_a", b: "dk_payroll_config_b", viewer: "dk_payroll_config_viewer", manager: "dk_payroll_config_manager", expired: "dk_payroll_config_expired" };
  for (const [label, key] of Object.entries(keys)) await db.insert(apiKey).values({ organizationId: label === "b" ? b.id : a.id,
    createdBy: label === "viewer" ? viewer.id : label === "manager" ? manager.id : owner.id, name: label,
    keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_config", expiresAt: label === "expired" ? new Date("2020-01-01") : null });
  const [ea, ea2, eb] = await db.insert(payrollEmployee).values([{ organizationId: a.id, name: "A", employeeNumber: "A", salary: 0, startDate: "2024-01-01" },
    { organizationId: a.id, name: "A2", employeeNumber: "A2", salary: 0, startDate: "2024-01-01" }, { organizationId: b.id, name: "B", employeeNumber: "B", salary: 0, startDate: "2024-01-01" }]).returning();
  await db.insert(chartAccount).values([{ organizationId: a.id, code: "5100", name: "Salary", type: "expense" }, { organizationId: a.id, code: "2200", name: "Tax", type: "liability" },
    { organizationId: a.id, code: "1100", name: "Bank", type: "asset" }, { organizationId: b.id, code: "FOREIGN", name: "Foreign", type: "asset" },
    { organizationId: a.id, code: "INACTIVE", name: "Inactive", type: "expense", isActive: false }]);
  const ctx: AuthContext = { organizationId: a.id, userId: owner.id, role: "owner" };
  const ma = await mcp(ctx, true), mb = await mcp({ ...ctx, organizationId: b.id }), ro = await mcp({ ...ctx, userId: viewer.id, permissions: [] }),
    managed = await mcp({ ...ctx, userId: manager.id, permissions: ["manage:payroll", "manage:tax-config"] });
  type Args = Record<string, unknown>;
  const req = (body: unknown = {}, key = keys.a) => new Request("http://fixture.test/api/v1/payroll", { method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-organization-id": b.id }, body: JSON.stringify(body) });
  const definition = (name: string) => { const found = definitions.find(d => d.name === name); assert.ok(found, name); return found; };
  const rest = async (name: string, args: Args = {}, key = keys.a, malformed = false) => {
    const def = definition(name), { employeeId, id, ...body } = args;
    const params = def.args.includes("employeeId") ? { id: employeeId, ...(def.args.includes("id") ? { deductionId: id } : {}) } : { id };
    const route = routes[def.routeIndex] as unknown as Record<string, (r: Request, p: { params: Promise<typeof params> }) => Promise<Response>>;
    return route[def.verb](malformed ? new Request("http://fixture.test", { method: "POST", headers: { authorization: `Bearer ${key}` }, body: "{" }) : req(body, key), { params: Promise.resolve(params) });
  };
  const data = async (response: Response, status = 200) => { const body = await response.json(); assert.equal(response.status, status, JSON.stringify(body)); return body; };
  const read = async (name: string, args: Args = {}, key = keys.a) => data(await rest(name, args, key), definition(name).verb === "POST" ? 201 : 200);
  const call = async (name: string, args: Args = {}, client = ma) => { const result = await client.call(name, args); assert.equal(result.isError, false, JSON.stringify(result.body)); return result.body; };
  const snapshot = async () => Promise.all(["payroll_settings", "deduction_type", "employee_deduction", "employee_tax_config", "tax_bracket", "tax_allowance_config", "payroll_employee", "payroll_run", "journal_entry", "journal_line", "audit_log"].map(t =>
    db.execute(sql.raw(`select coalesce(jsonb_agg(to_jsonb(t)::text order by t.id),'[]'::jsonb) as rows from ${t} t`)).then(r => r.rows)));
  const denied = async (name: string, args: Args, status: number, key = keys.a) => { const before = await snapshot(); await data(await rest(name, args, key), status); assert.deepEqual(await snapshot(), before); };
  const mdenied = async (name: string, args: Args, client = ma, status?: number) => {
    const before = await snapshot(), result = await client.call(name, args); assert.equal(result.isError, true, name); if (status) assert.equal(result.body.status, status); assert.deepEqual(await snapshot(), before);
  };
  try {
    // Concurrent legacy GET initialization retains the existing envelopes, creates exactly one row and audit.
    const init = await Promise.all([read("get_payroll_settings"), call("get_payroll_settings")]);
    assert.equal(init[0].settings.id, init[1].settings.id); assert.equal(init[0].settings.ssWageBaseCentsMinor, "16810000");
    const taxInit = await Promise.all([read("get_payroll_employee_tax_config", { employeeId: ea.id }), call("get_payroll_employee_tax_config", { employeeId: ea.id })]);
    assert.equal(taxInit[0].taxConfig.id, taxInit[1].taxConfig.id);
    const setting = (await read("update_payroll_settings", { ssWageBaseCentsMinor: "9007199254740991", futaWageBaseCents: 1250, sutaWageBaseCentsMinor: "3000000000", ssRateBp: 29, overtimeMultiplier: 1.5, defaultTaxYear: 2026,
      salaryExpenseAccountCode: "5100", taxPayableAccountCode: "2200", bankAccountCode: "1100" })).settings;
    assert.equal(setting.ssWageBaseCents, Number.MAX_SAFE_INTEGER); assert.equal(setting.futaWageBaseCentsMinor, "1250");
    assert.equal((await call("update_payroll_settings", { addlMedicareThresholdCentsMinor: "29", defaultTaxRate: 2029 })).settings.defaultTaxRate, 2029);
    await Promise.all([read("update_payroll_settings", { futaRateBp: 60 }), call("update_payroll_settings", { sutaRateBp: 25 })]);
    const merged = (await call("get_payroll_settings")).settings; assert.equal(merged.futaRateBp, 60); assert.equal(merged.sutaRateBp, 25); assert.equal(merged.ssWageBaseCentsMinor, "9007199254740991");
    const dt = (await read("create_payroll_deduction_type", { name: "Legacy", category: "pre_tax", defaultAmount: 1250, defaultPercent: 2.5 })).deductionType;
    const dtm = (await call("create_payroll_deduction_type", { name: "Exact", category: "post_tax", defaultAmountMinor: "9007199254740991" })).deductionType;
    const ed = (await read("create_payroll_employee_deduction", { employeeId: ea.id, deductionTypeId: dt.id, amount: 29, percent: 2.5, startDate: "2024-02-29" })).deduction;
    const edm = (await call("create_payroll_employee_deduction", { employeeId: ea.id, deductionTypeId: dtm.id, amountMinor: "3000000000", timing: "one_time" })).deduction;
    assert.equal(ed.amountMinor, "29"); assert.equal(edm.amount, 3000000000);
    const bracket = (await read("create_payroll_tax_bracket", { name: "Legacy", jurisdictionLevel: "federal", minIncome: 0, maxIncome: 1250, rate: 29 })).bracket;
    const bm = (await call("create_payroll_tax_bracket", { name: "Exact", jurisdictionLevel: "state", jurisdiction: "CA", taxYear: 2026, filingStatus: "married_joint", minIncomeMinor: "3000000000", maxIncomeMinor: null, rate: 2029,
      baseAmountCentsMinor: "9007199254740991", standardDeductionCentsMinor: "29" })).bracket;
    assert.equal(bm.minIncome, 3000000000); assert.equal(bm.maxIncomeMinor, null);
    const allowance = (await read("create_payroll_tax_allowance", { jurisdictionLevel: "federal", taxYear: 2026, allowanceValueCents: 1250, standardDeductionCents: 0 })).allowance;
    const am = (await call("create_payroll_tax_allowance", { jurisdictionLevel: "state", jurisdiction: "CA", taxYear: 2026, allowanceValueCentsMinor: "9007199254740991", standardDeductionCentsMinor: "3000000000" })).allowance;
    assert.equal(am.allowanceValueCents, Number.MAX_SAFE_INTEGER);
    const tc = (await read("update_payroll_employee_tax_config", { employeeId: ea.id, additionalWithholding: 1250, federalAllowances: 2147483647, stateAllowances: 2, filingStatus: "married_joint" })).taxConfig;
    assert.equal(tc.additionalWithholdingMinor, "1250");
    const tcm = (await call("update_payroll_employee_tax_config", { employeeId: ea.id, additionalWithholdingMinor: "9007199254740991" })).taxConfig;
    assert.equal(tcm.federalAllowances, 2147483647);
    const mutations: [string, Args][] = [
      ["update_payroll_settings", { defaultTaxRate: 29 }],
      ["create_payroll_deduction_type", { name: "Rollback", category: "post_tax", defaultAmountMinor: "29" }],
      ["update_payroll_deduction_type", { id: dt.id, defaultAmountMinor: null }], ["delete_payroll_deduction_type", { id: dt.id }],
      ["create_payroll_employee_deduction", { employeeId: ea.id, deductionTypeId: dt.id, amountMinor: "29" }],
      ["update_payroll_employee_deduction", { employeeId: ea.id, id: ed.id, amountMinor: null }], ["delete_payroll_employee_deduction", { employeeId: ea.id, id: ed.id }],
      ["update_payroll_employee_tax_config", { employeeId: ea.id, additionalWithholdingMinor: "29" }],
      ["create_payroll_tax_bracket", { name: "Rollback", jurisdictionLevel: "federal", minIncomeMinor: "0", rate: 0 }],
      ["update_payroll_tax_bracket", { id: bracket.id, maxIncomeMinor: null }], ["delete_payroll_tax_bracket", { id: bracket.id }],
      ["create_payroll_tax_allowance", { jurisdictionLevel: "federal", taxYear: 2028, allowanceValueCentsMinor: "29" }],
      ["update_payroll_tax_allowance", { id: allowance.id, allowanceValueCentsMinor: "29" }], ["delete_payroll_tax_allowance", { id: allowance.id }],
    ];
    // Each adopted read/detail/list pair returns identical data and original REST envelopes.
    for (const [name, args] of [
      ["get_payroll_settings", {}], ["list_payroll_deduction_types", {}], ["get_payroll_deduction_type", { id: dt.id }],
      ["list_payroll_employee_deductions", { employeeId: ea.id }], ["get_payroll_employee_tax_config", { employeeId: ea.id }],
      ["list_payroll_tax_brackets", {}], ["get_payroll_tax_bracket", { id: bracket.id }], ["list_payroll_tax_allowances", {}], ["get_payroll_tax_allowance", { id: allowance.id }],
    ] as [string, Args][]) assert.deepEqual(await read(name, args), await call(name, args));
    // Every operation denies no-permission and invalid/expired API keys without mutation.
    const sampleArgs: Record<string, Args> = Object.fromEntries(mutations);
    Object.assign(sampleArgs, { get_payroll_deduction_type: { id: dt.id }, get_payroll_tax_bracket: { id: bracket.id }, get_payroll_tax_allowance: { id: allowance.id },
      list_payroll_employee_deductions: { employeeId: ea.id }, get_payroll_employee_tax_config: { employeeId: ea.id } });
    for (const def of definitions) {
      const args = sampleArgs[def.name] ?? {};
      await denied(def.name, args, 403, keys.viewer); await mdenied(def.name, args, ro, 403);
      for (const key of [keys.expired, "dk_invalid"]) await denied(def.name, args, 401, key);
      if (def.args.length) { await denied(def.name, args, 404, keys.b); await mdenied(def.name, args, mb, 404); }
    }
    for (const name of ["list_payroll_deduction_types", "list_payroll_tax_brackets", "list_payroll_tax_allowances"]) {
      assert.deepEqual((await read(name, {}, keys.b)).data, []); assert.deepEqual((await call(name, {}, mb)).data, []);
    }
    await denied("create_payroll_employee_deduction", { employeeId: eb.id, deductionTypeId: dt.id }, 404);
    const foreignType = (await call("create_payroll_deduction_type", { name: "B", category: "post_tax" }, mb)).deductionType;
    await denied("create_payroll_employee_deduction", { employeeId: ea.id, deductionTypeId: foreignType.id }, 404);
    await mdenied("create_payroll_employee_deduction", { employeeId: ea.id, deductionTypeId: foreignType.id }, ma, 404);
    for (const name of ["update_payroll_employee_deduction", "delete_payroll_employee_deduction"]) {
      await denied(name, { employeeId: ea2.id, id: ed.id }, 404); await mdenied(name, { employeeId: ea2.id, id: ed.id }, ma, 404);
    }
    await db.update(employeeDeduction).set({ deductionTypeId: foreignType.id }).where(eq(employeeDeduction.id, ed.id));
    await denied("list_payroll_employee_deductions", { employeeId: ea.id }, 404);
    await mdenied("update_payroll_employee_deduction", { employeeId: ea.id, id: ed.id, amountMinor: "0" }, ma, 404);
    await db.update(employeeDeduction).set({ deductionTypeId: dt.id }).where(eq(employeeDeduction.id, ed.id));
    for (const bad of [{ defaultAmount: -1 }, { defaultAmount: 0.1 }, { defaultAmountMinor: "01" }, { defaultAmount: 1, defaultAmountMinor: "2" }, { defaultAmount: null, defaultAmountMinor: "0" }, { defaultPercent: 2.9 }, { defaultPercent: 101 }, { defaultPercentMinor: "1" }]) {
      await denied("create_payroll_deduction_type", { name: "Bad", category: "pre_tax", ...bad }, 400);
      await mdenied("update_payroll_deduction_type", { id: dt.id, ...bad });
    }
    for (const bad of [{ amountMinor: "-0" }, { amount: -1 }, { percent: 2.9 }, { startDate: "2024-02-30" }, { endDate: "2024-02-28" }, { amount: 1, amountMinor: "2" }]) {
      await denied("update_payroll_employee_deduction", { employeeId: ea.id, id: ed.id, ...bad }, 400);
      await mdenied("update_payroll_employee_deduction", { employeeId: ea.id, id: ed.id, ...bad });
    }
    for (const [name, args] of [
      ["update_payroll_settings", { defaultTaxRate: 10001 }], ["update_payroll_settings", { ssRateBp: 1.5 }], ["update_payroll_settings", { overtimeMultiplier: 1.1 }],
      ["update_payroll_settings", { defaultCurrency: "ZZZ" }], ["update_payroll_employee_tax_config", { employeeId: ea.id, stateAllowances: 2147483648 }],
      ["update_payroll_employee_tax_config", { employeeId: ea.id, additionalFederalWithholding: 29 }], ["create_payroll_tax_bracket", { name: "Bad", jurisdictionLevel: "federal", rate: 0 }],
      ["update_payroll_tax_bracket", { id: bracket.id, minIncome: 1250 }], ["update_payroll_tax_allowance", { id: allowance.id, taxYear: 0 }],
    ] as [string, Args][]) { await denied(name, args, 400); await mdenied(name, args); }
    for (const [name, args, field] of [
      ["update_payroll_settings", {}, "ssWageBaseCents"], ["update_payroll_deduction_type", { id: dt.id }, "defaultAmount"],
      ["update_payroll_employee_deduction", { employeeId: ea.id, id: ed.id }, "amount"], ["update_payroll_employee_tax_config", { employeeId: ea.id }, "additionalWithholding"],
      ["update_payroll_tax_bracket", { id: bm.id }, "minIncome"], ["update_payroll_tax_allowance", { id: am.id }, "allowanceValueCents"],
    ] as [string, Args, string][]) {
      await denied(name, { ...args, [field + "Minor"]: "9007199254740992" }, 422);
      await mdenied(name, { ...args, [field + "Minor"]: "9223372036854775807" }, ma, 422);
    }
    for (const args of [{ bankAccountCode: "FOREIGN" }, { salaryExpenseAccountCode: "1100" }, { salaryExpenseAccountCode: "INACTIVE" }]) {
      await denied("update_payroll_settings", args, 404); await mdenied("update_payroll_settings", args, ma, 404);
    }
    // Actual API key with custom role and explicit MCP permissions can perform only its allowed slice.
    assert.equal((await read("update_payroll_employee_tax_config", { employeeId: ea2.id, additionalWithholdingMinor: "29" }, keys.manager)).taxConfig.additionalWithholding, 29);
    assert.equal((await call("update_payroll_tax_allowance", { id: allowance.id, standardDeductionCentsMinor: "29" }, managed)).allowance.standardDeductionCents, 29);
    for (const def of definitions.filter(d => d.body)) {
      const before = await snapshot(); await data(await rest(def.name, sampleArgs[def.name] ?? {}, keys.a, true), 400); assert.deepEqual(await snapshot(), before);
    }
    // Invalid stored amounts cannot be masked by unrelated edits; ORM rejects unsafe bigint.
    for (const [table, column, id, name, args, restore] of [
      ["payroll_settings", "ss_wage_base_cents", setting.id, "update_payroll_settings", { defaultTaxRate: 100 }, "9007199254740991"],
      ["deduction_type", "default_amount", dt.id, "update_payroll_deduction_type", { id: dt.id, name: "Mask" }, "1250"],
      ["employee_deduction", "amount", ed.id, "update_payroll_employee_deduction", { employeeId: ea.id, id: ed.id, isActive: false }, "29"],
      ["employee_tax_config", "additional_withholding", tc.id, "update_payroll_employee_tax_config", { employeeId: ea.id, exempt: true }, "9007199254740991"],
      ["tax_bracket", "min_income", bm.id, "update_payroll_tax_bracket", { id: bm.id, name: "Mask" }, "3000000000"],
      ["tax_allowance_config", "allowance_value_cents", am.id, "update_payroll_tax_allowance", { id: am.id, taxYear: 2027 }, "9007199254740991"],
    ] as [string, string, string, string, Args, string][]) {
      for (const bad of ["-1", "9007199254740992"]) {
        await db.execute(sql.raw(`update ${table} set ${column}=${bad} where id='${id}'`)); await denied(name, args, 422); await mdenied(name, args, ma, 422);
      }
      await db.execute(sql.raw(`update ${table} set ${column}=${restore} where id='${id}'`));
    }
    // All fourteen adopted writer/audit transactions roll back through both real adapters.
    await db.execute(sql`create function fail_payroll_config_audit() returns trigger language plpgsql as $$ begin raise exception 'Synthetic config audit failure'; end $$`);
    await db.execute(sql`create trigger fail_payroll_config_audit before insert on audit_log for each row execute function fail_payroll_config_audit()`);
    const oldError = console.error; console.error = () => {};
    try {
      for (const [name, args] of mutations) { await denied(name, args, 500); await mdenied(name, args); }
      await denied("get_payroll_settings", {}, 500, keys.b); await mdenied("get_payroll_settings", {}, mb);
      await denied("get_payroll_employee_tax_config", { employeeId: eb.id }, 500, keys.b); await mdenied("get_payroll_employee_tax_config", { employeeId: eb.id }, mb);
    }
    finally { console.error = oldError; await db.execute(sql`drop trigger fail_payroll_config_audit on audit_log`); await db.execute(sql`drop function fail_payroll_config_audit()`); }
    await db.execute(sql`create function corrupt_payroll_config() returns trigger language plpgsql as $$ begin new.default_amount := -1; return new; end $$`);
    await db.execute(sql`create trigger corrupt_payroll_config before insert on deduction_type for each row execute function corrupt_payroll_config()`);
    await denied("create_payroll_deduction_type", { name: "Corrupt", category: "post_tax", defaultAmountMinor: "0" }, 422); await mdenied("create_payroll_deduction_type", { name: "Corrupt", category: "post_tax", defaultAmount: 0 }, ma, 422);
    await db.execute(sql`drop trigger corrupt_payroll_config on deduction_type`); await db.execute(sql`drop function corrupt_payroll_config()`);
    const duplicate = await Promise.all([rest("create_payroll_tax_allowance", { jurisdictionLevel: "federal", taxYear: 2027 }), ma.call("create_payroll_tax_allowance", { jurisdictionLevel: "federal", taxYear: 2027 })]);
    assert.equal((duplicate[0].status === 201 ? 1 : 0) + (!duplicate[1].isError ? 1 : 0), 1); assert.ok(duplicate[0].status === 409 || duplicate[1].body.status === 409);
    await db.insert(payrollRun).values({ organizationId: a.id, payPeriodStart: "2024-01-01", payPeriodEnd: "2024-01-31" });
    await denied("update_payroll_settings", { defaultCurrency: "EUR" }, 409); await mdenied("update_payroll_settings", { defaultCurrency: "EUR" }, ma, 409);
    // Null clears and omission retains the actual persisted monetary aliases.
    for (const [name, args, env, field] of [
      ["update_payroll_deduction_type", { id: dt.id, defaultAmountMinor: null }, "deductionType", "defaultAmount"],
      ["update_payroll_employee_deduction", { employeeId: ea.id, id: ed.id, amountMinor: null }, "deduction", "amount"],
      ["update_payroll_tax_bracket", { id: bracket.id, maxIncomeMinor: null }, "bracket", "maxIncome"],
      ["update_payroll_employee_tax_config", { employeeId: ea.id, additionalWithholdingMinor: null }, "taxConfig", "additionalWithholding"],
    ] as [string, Args, string, string][]) {
      assert.equal((await read(name, args))[env][field + "Minor"], null); assert.equal((await call(name, args))[env][field], null);
    }
    // Competing deletes have one winner, preserve rows, and cannot patch/resurrect deleted records.
    for (const [name, args, update] of [
      ["delete_payroll_employee_deduction", { employeeId: ea.id, id: ed.id }, "update_payroll_employee_deduction"],
      ["delete_payroll_deduction_type", { id: dt.id }, "update_payroll_deduction_type"],
      ["delete_payroll_tax_bracket", { id: bracket.id }, "update_payroll_tax_bracket"],
      ["delete_payroll_tax_allowance", { id: allowance.id }, "update_payroll_tax_allowance"],
    ] as [string, Args, string][]) {
      const race = await Promise.all([rest(name, args), ma.call(name, args)]);
      assert.equal((race[0].status === 200 ? 1 : 0) + (!race[1].isError ? 1 : 0), 1); assert.ok(race[0].status === 404 || race[1].body.status === 404);
      await denied(update, args, 404); await mdenied(name, args, ma, 404);
    }
    assert.equal((await db.select().from(employeeDeduction).where(eq(employeeDeduction.id, ed.id))).length, 1);
    assert.equal((await db.select().from(taxBracket).where(eq(taxBracket.id, bracket.id)))[0].isActive, false);
    assert.equal((await read("list_payroll_employee_deductions", { employeeId: ea.id })).data.length, 1);
    // The configuration deletion contract excludes retained rows from the existing withholding loader.
    await call("update_payroll_employee_tax_config", { employeeId: ea2.id, additionalWithholdingMinor: "0" });
    await db.insert(taxBracket).values([{ organizationId: a.id, name: "Current", jurisdictionLevel: "federal", minIncome: 0, rate: 1000 },
      { organizationId: a.id, name: "Deleted historical", jurisdictionLevel: "federal", minIncome: 0, rate: 10000, isActive: true, deletedAt: new Date() }]);
    await db.insert(taxAllowanceConfig).values({ organizationId: a.id, jurisdictionLevel: "federal", taxYear: 2026, standardDeductionCents: 1000000, deletedAt: new Date() });
    const [savedSettings] = await db.select().from(payrollSettings).where(eq(payrollSettings.organizationId, a.id));
    const withholding = await computeEmployeeWithholding(a.id, ea2, { ...savedSettings, ssRateBp: 0, medicareRateBp: 0, addlMedicareRateBp: 0, employerFicaEnabled: false, futaRateBp: 0, sutaRateBp: 0 }, 100, 0, "2026-01-01");
    assert.equal(withholding.totalTax, 10);
    await db.update(payrollEmployee).set({ deletedAt: new Date() }).where(eq(payrollEmployee.id, ea2.id));
    for (const name of ["get_payroll_employee_tax_config", "update_payroll_employee_tax_config", "list_payroll_employee_deductions"])
      { await denied(name, { employeeId: ea2.id }, 404); await mdenied(name, { employeeId: ea2.id }, ma, 404); }
    for (const table of ["journal_entry", "journal_line"]) assert.equal((await db.execute(sql.raw(`select count(*)::int as n from ${table}`))).rows[0].n, 0);
    console.log("Payroll configuration contracts verified");
  } finally { await Promise.all([ma.close(), mb.close(), ro.close(), managed.close()]); }
}
run().then(() => process.exit(0), error => { console.error(error); process.exit(1); });
