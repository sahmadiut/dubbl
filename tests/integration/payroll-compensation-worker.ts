import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, customRole, payrollEmployee, compensationReview, compensationReviewEntry, payrollRun } from "../../lib/db/schema";
import type { AuthContext } from "../../lib/api/auth-context";
import { registerAllTools } from "../../lib/mcp/tools";
import { registerPayrollCompensationTools } from "../../lib/mcp/tools/payroll-compensation";
import * as bands from "../../app/api/v1/payroll/compensation/bands/route";
import * as band from "../../app/api/v1/payroll/compensation/bands/[id]/route";
import * as reviews from "../../app/api/v1/payroll/compensation/reviews/route";
import * as review from "../../app/api/v1/payroll/compensation/reviews/[id]/route";
import * as entries from "../../app/api/v1/payroll/compensation/reviews/[id]/entries/route";
import * as equity from "../../app/api/v1/payroll/compensation/equity-analysis/route";
import * as projection from "../../app/api/v1/payroll/forecasting/projection/route";
import * as scenario from "../../app/api/v1/payroll/forecasting/what-if/route";
import * as budget from "../../app/api/v1/payroll/forecasting/budget-vs-actual/route";

type Args = Record<string, unknown>;
const operations = [
  ["list_compensation_bands", "GET", bands], ["create_compensation_band", "POST", bands],
  ["get_compensation_band", "GET", band], ["update_compensation_band", "PATCH", band], ["delete_compensation_band", "DELETE", band],
  ["list_compensation_reviews", "GET", reviews], ["create_compensation_review", "POST", reviews],
  ["get_compensation_review", "GET", review], ["update_compensation_review", "PATCH", review],
  ["list_compensation_entries", "GET", entries], ["create_compensation_entry", "POST", entries],
  ["analyze_compensation_equity", "GET", equity], ["project_payroll_costs", "GET", projection],
  ["forecast_payroll_what_if", "POST", scenario], ["get_payroll_budget_vs_actual", "GET", budget],
] as const;
async function connect(ctx: AuthContext, all = false) {
  const server = new McpServer({ name: "Compensation fixture", version: "1" });
  if (all) registerAllTools(server, ctx); else registerPayrollCompensationTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1" }), [ct, st] = InMemoryTransport.createLinkedPair();
  await server.connect(st); await client.connect(ct);
  const tools = (await client.listTools()).tools;
  assert.equal(new Set(tools.map(t => t.name)).size, tools.length);
  if (!all) assert.equal(tools.length, operations.length);
  for (const [name] of operations) {
    const tool = tools.find(t => t.name === name); assert.ok(tool); assert.equal(tool.inputSchema.additionalProperties, false);
    for (const field of Object.values(tool.inputSchema.properties ?? {})) assert.ok((field as { description?: string }).description, name);
  }
  return { async call(name: string, args: Args = {}) {
    const result = await client.callTool({ name, arguments: args }), text = (result.content as { text: string }[])[0].text;
    return { isError: result.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
  }, async close() { await client.close(); await server.close(); } };
}
async function run() {
  const [a, b] = await db.insert(organization).values([{ name: "Comp A", slug: "comp-a" }, { name: "Comp B", slug: "comp-b" }]).returning();
  const [owner, viewer] = await db.insert(users).values([{ email: "comp-owner@example.test" }, { email: "comp-viewer@example.test" }]).returning();
  const [role] = await db.insert(customRole).values({ organizationId: a.id, name: "Denied", permissions: [] }).returning();
  await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner" }, { organizationId: b.id, userId: owner.id, role: "owner" }, { organizationId: a.id, userId: viewer.id, customRoleId: role.id }]);
  const keys = { a: "dk_comp_a", b: "dk_comp_b", viewer: "dk_comp_viewer", expired: "dk_comp_expired" };
  for (const [label, key] of Object.entries(keys)) await db.insert(apiKey).values({ organizationId: label === "b" ? b.id : a.id,
    createdBy: label === "viewer" ? viewer.id : owner.id, name: label, keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_comp", expiresAt: label === "expired" ? new Date("2020-01-01") : null });
  const [salary, hourly, foreign] = await db.insert(payrollEmployee).values([
    { organizationId: a.id, name: "Salary", employeeNumber: "S1", startDate: "2024-01-01", salary: 12000, taxRate: 1000 },
    { organizationId: a.id, name: "Hourly", employeeNumber: "H1", startDate: "2024-01-01", salary: 0, compensationType: "hourly", hourlyRate: 29, taxRate: 2000 },
    { organizationId: b.id, name: "Foreign", employeeNumber: "F1", startDate: "2024-01-01", salary: 999999 },
  ]).returning();
  const ctx: AuthContext = { organizationId: a.id, userId: owner.id, role: "owner" };
  const ma = await connect(ctx, true), mb = await connect({ ...ctx, organizationId: b.id }), ro = await connect({ ...ctx, userId: viewer.id, permissions: [] });
  const seen = new Set<string>(), mseen = new Set<string>();
  const rest = async (name: string, args: Args = {}, key: string = keys.a, raw?: string) => {
    seen.add(name); const op = operations.find(o => o[0] === name); assert.ok(op); const [, verb, route] = op;
    const { id, ...body } = args; const url = new URL("http://fixture.test/api/v1/payroll/compensation");
    if (verb === "GET") for (const [k, v] of Object.entries(body)) url.searchParams.set(k, String(v));
    const request = new Request(url, { method: verb, headers: { authorization: `Bearer ${key}`, "x-organization-id": b.id, "content-type": "application/json" }, body: ["GET", "DELETE"].includes(verb) ? undefined : raw ?? JSON.stringify(body) });
    return (route as unknown as Record<string, (r: Request, p: unknown) => Promise<Response>>)[verb](request, { params: Promise.resolve({ id }) });
  };
  const data = async (r: Response, status = 200) => { const body = await r.json(); assert.equal(r.status, status, JSON.stringify(body)); return body; };
  const read = async (name: string, args: Args = {}) => data(await rest(name, args), name.startsWith("create_") ? 201 : 200);
  const call = async (name: string, args: Args = {}, client = ma) => { mseen.add(name); const r = await client.call(name, args); assert.equal(r.isError, false, JSON.stringify(r.body)); return r.body; };
  const snapshot = () => Promise.all(["compensation_band", "compensation_review", "compensation_review_entry", "payroll_employee", "audit_log"].map(t => db.execute(sql.raw(`select coalesce(jsonb_agg(to_jsonb(t)::text order by t.id),'[]'::jsonb) as rows from ${t} t`)).then(r => r.rows)));
  const denied = async (name: string, args: Args, status: number, key: string = keys.a, raw?: string) => {
    const before = await snapshot(); await data(await rest(name, args, key, raw), status); assert.deepEqual(await snapshot(), before, name + " REST mutation");
  };
  const mdenied = async (name: string, args: Args, status?: number, client = ma) => {
    const before = await snapshot(); mseen.add(name); const r = await client.call(name, args); assert.equal(r.isError, true, name);
    if (status && r.body.status !== undefined) assert.equal(r.body.status, status, JSON.stringify(r.body));
    assert.deepEqual(await snapshot(), before, name + " MCP mutation");
  };
  const bothDenied = async (name: string, args: Args, status: number) => { await denied(name, args, status); await mdenied(name, args, status); };
  const bandInput = { name: "Legacy", minSalary: 0, midSalary: 12000, maxSalary: 24000 };
  const bd = (await read("create_compensation_band", bandInput)).band;
  assert.equal(bd.midSalaryMinor, "12000");
  const exactBand = (await call("create_compensation_band", { name: "Exact", minSalaryMinor: "29", midSalaryMinor: "3000000000", maxSalaryMinor: "9007199254740991", currency: "IRR" })).band;
  assert.equal(exactBand.maxSalary, Number.MAX_SAFE_INTEGER); assert.equal(exactBand.currency, "IRR");
  assert.equal((await read("get_compensation_band", { id: bd.id })).band.minSalaryMinor, "0");
  await call("get_compensation_band", { id: bd.id }); await read("list_compensation_bands"); await call("list_compensation_bands");
  await read("update_compensation_band", { id: bd.id, minSalaryMinor: "29" }); await call("update_compensation_band", { id: bd.id, minSalary: 0 });
  await bothDenied("update_compensation_band", { id: bd.id, minSalaryMinor: "12001" }, 400);
  await bothDenied("create_compensation_band", { ...bandInput, minSalaryMinor: "1" }, 400);
  await bothDenied("create_compensation_band", { ...bandInput, maxSalaryMinor: "9007199254740992", maxSalary: undefined }, 422);
  await bothDenied("create_compensation_band", { ...bandInput, currency: "XXX" }, 400);
  await db.update(payrollEmployee).set({ compensationBandId: bd.id }).where(eq(payrollEmployee.id, salary.id));
  const eqData = (await read("analyze_compensation_equity")).data;
  assert.equal(eqData.find((e: Args) => e.employeeId === salary.id).rangePenetration, 50);
  assert.deepEqual((await call("analyze_compensation_equity")).data, eqData);
  await bothDenied("delete_compensation_band", { id: bd.id }, 422);
  await read("delete_compensation_band", { id: exactBand.id });
  const extra = (await call("create_compensation_band", bandInput)).band; await call("delete_compensation_band", { id: extra.id });
  await bothDenied("update_compensation_band", { id: extra.id, name: "Revive" }, 404);
  const rv = (await read("create_compensation_review", { name: "Review", effectiveDate: "2024-01-31", totalBudgetMinor: "3000000000" })).review;
  assert.equal(rv.currency, "USD"); assert.equal(rv.totalBudgetMinor, "3000000000");
  const r2 = (await call("create_compensation_review", { name: "Review2", effectiveDate: "2024-01-31", totalBudget: 1250 })).review;
  await read("list_compensation_reviews"); await call("list_compensation_reviews");
  await read("update_compensation_review", { id: rv.id, totalBudgetMinor: null, status: "in_progress" });
  await call("update_compensation_review", { id: rv.id, totalBudget: 1250 });
  const en = (await read("create_compensation_entry", { id: rv.id, employeeId: salary.id, currentSalaryMinor: "12000", proposedSalaryMinor: "13200", adjustmentPercent: 10 })).entry;
  assert.equal(en.proposedSalaryMinor, "13200");
  await call("create_compensation_entry", { id: r2.id, employeeId: salary.id, currentSalary: 12000, proposedSalary: 13200 });
  await read("list_compensation_entries", { id: rv.id }); await call("list_compensation_entries", { id: rv.id });
  const detail = (await read("get_compensation_review", { id: rv.id })).review;
  assert.equal(detail.totals.differenceMinor, "1200"); assert.equal(detail.entries[0].employee.salaryMinor, "12000");
  await call("get_compensation_review", { id: rv.id });
  await bothDenied("create_compensation_entry", { id: rv.id, employeeId: salary.id, currentSalary: 12000, proposedSalary: 14000 }, 422);
  await bothDenied("create_compensation_entry", { id: rv.id, employeeId: foreign.id, currentSalary: 999999, proposedSalary: 1 }, 404);
  await bothDenied("create_compensation_entry", { id: rv.id, employeeId: hourly.id, currentSalary: 0, proposedSalary: 1 }, 422);
  await bothDenied("create_compensation_review", { name: "Bad date", effectiveDate: "2024-02-30" }, 400);
  await bothDenied("update_compensation_review", { id: rv.id, totalBudget: 1, totalBudgetMinor: null }, 400);
  await read("update_compensation_review", { id: rv.id, status: "completed" });
  await bothDenied("update_compensation_review", { id: rv.id, status: "draft" }, 422);
  const proj = await read("project_payroll_costs", { months: 12 });
  assert.equal(proj.data[0].gross, 6017); assert.equal(proj.data[0].tax, 1103); assert.equal(proj.data[0].net, 4914);
  assert.equal(proj.totals.grossMinor, "72204"); assert.equal(proj.data[0].headcount, 2);
  assert.deepEqual(await call("project_payroll_costs", { months: 12 }), proj);
  const result = await read("forecast_payroll_what_if", { salaryAdjustmentPercent: 0.29, newHires: 1, avgNewHireSalaryMinor: "12000", terminations: 1, months: 12 });
  assert.equal(result.projected.monthlyGross, 4018); assert.equal(result.projected.headcount, 2); assert.equal(result.difference.monthlyGrossMinor, "-1999");
  assert.deepEqual(await call("forecast_payroll_what_if", { salaryAdjustmentPercent: 0.29, newHires: 1, avgNewHireSalary: 12000, terminations: 1, months: 12 }), result);
  await bothDenied("forecast_payroll_what_if", { terminations: 3 }, 400);
  await bothDenied("forecast_payroll_what_if", { newHires: 1 }, 400);
  await bothDenied("forecast_payroll_what_if", { salaryAdjustmentPercent: 0.001 }, 400);
  await bothDenied("forecast_payroll_what_if", { avgNewHireSalaryMinor: "9007199254740992" }, 422);
  await denied("project_payroll_costs", { months: "12x" }, 400); await mdenied("project_payroll_costs", { months: 61 }, 400);
  await db.insert(payrollRun).values({ organizationId: a.id, payPeriodStart: "2024-01-01", payPeriodEnd: "2024-01-31", status: "completed", totalGross: 1250, totalNet: 1000, baseCurrency: "USD" });
  const ba = await read("get_payroll_budget_vs_actual", { year: 2024 });
  assert.equal(ba.budgetMinor, "72204"); assert.equal(ba.actualMinor, "1250"); assert.equal(ba.variance, 70954);
  assert.deepEqual(await call("get_payroll_budget_vs_actual", { year: 2024 }), ba);
  await denied("get_payroll_budget_vs_actual", { year: "2024x" }, 400); await mdenied("get_payroll_budget_vs_actual", { year: 10000 }, 400);
  const foreignReview = (await call("create_compensation_review", { name: "Foreign", effectiveDate: "2024-01-31" }, mb)).review;
  const foreignBand = (await call("create_compensation_band", bandInput, mb)).band;
  for (const [name] of operations) {
    const args = name.includes("band") && !name.startsWith("list_") && !name.startsWith("create_") ? { id: foreignBand.id } : name.includes("review") || name.includes("entries") || name.includes("entry") ? { id: foreignReview.id } : {};
    // Exercise authentication on every real REST route before input parsing.
    await denied(name, args, 403, keys.viewer); await denied(name, args, 401, keys.expired); await denied(name, args, 401, "dk_comp_invalid");
  }
  const validInputs: Record<string, Args> = {
    create_compensation_band: bandInput, get_compensation_band: { id: bd.id }, update_compensation_band: { id: bd.id, name: "Denied" }, delete_compensation_band: { id: bd.id },
    create_compensation_review: { name: "Denied", effectiveDate: "2024-01-31" }, get_compensation_review: { id: rv.id }, update_compensation_review: { id: rv.id, name: "Denied" },
    list_compensation_entries: { id: rv.id }, create_compensation_entry: { id: rv.id, employeeId: salary.id, currentSalary: 12000, proposedSalary: 12000 },
  };
  for (const [name] of operations) await mdenied(name, validInputs[name] ?? {}, 403, ro);
  for (const name of ["get_compensation_review", "list_compensation_entries"]) await bothDenied(name, { id: foreignReview.id }, 404);
  await bothDenied("create_compensation_entry", { id: foreignReview.id, employeeId: salary.id, currentSalary: 12000, proposedSalary: 12000 }, 404);
  await bothDenied("get_compensation_band", { id: foreignBand.id }, 404);
  await denied("create_compensation_band", {}, 400, keys.a, "{");
  // Stored cross-tenant employee links fail without returning foreign employee data.
  await db.insert(compensationReviewEntry).values({ reviewId: r2.id, employeeId: foreign.id, currentSalary: 1, proposedSalary: 1 });
  await bothDenied("get_compensation_review", { id: r2.id }, 422);
  await db.delete(compensationReviewEntry).where(eq(compensationReviewEntry.employeeId, foreign.id));
  const [hugeRun] = await db.insert(payrollRun).values({ organizationId: a.id, payPeriodStart: "2024-02-01", payPeriodEnd: "2024-02-28", status: "completed", totalGross: Number.MAX_SAFE_INTEGER, baseCurrency: "USD" }).returning();
  await bothDenied("get_payroll_budget_vs_actual", { year: 2024 }, 422);
  await db.delete(payrollRun).where(eq(payrollRun.id, hugeRun.id));
  await db.update(payrollEmployee).set({ currency: "EUR" }).where(eq(payrollEmployee.id, hourly.id));
  for (const name of ["project_payroll_costs", "forecast_payroll_what_if", "get_payroll_budget_vs_actual"]) await bothDenied(name, {}, 422);
  await db.update(payrollEmployee).set({ currency: "USD", salary: Number.MAX_SAFE_INTEGER, compensationType: "salary" }).where(eq(payrollEmployee.id, hourly.id));
  await bothDenied("get_payroll_budget_vs_actual", {}, 422);
  await bothDenied("project_payroll_costs", { months: 60 }, 422);
  await db.update(payrollEmployee).set({ salary: 0, compensationType: "hourly" }).where(eq(payrollEmployee.id, hourly.id));
  await db.execute(sql`update compensation_band set min_salary=9007199254740992 where id=${foreignBand.id}`);
  await denied("get_compensation_band", { id: foreignBand.id }, 422, keys.b); await mdenied("get_compensation_band", { id: foreignBand.id }, 422, mb);
  // Fault injection proves new row and audit share one PostgreSQL transaction.
  await db.execute(sql.raw("create function reject_comp_audit() returns trigger language plpgsql as $$ begin if NEW.entity_type like 'compensation%' then raise exception 'fixture audit failure'; end if; return NEW; end $$"));
  await db.execute(sql.raw("create trigger reject_comp_audit before insert on audit_log for each row execute function reject_comp_audit()"));
  await bothDenied("create_compensation_band", bandInput, 500);
  await db.execute(sql.raw("drop trigger reject_comp_audit on audit_log"));
  // Concurrent writes serialize ordering and duplicate employee decisions.
  const concurrentReview = (await call("create_compensation_review", { name: "Race", effectiveDate: "2024-01-31" })).review;
  const args = { id: concurrentReview.id, employeeId: salary.id, currentSalary: 12000, proposedSalary: 14000 };
  const race = await Promise.all([rest("create_compensation_entry", args), rest("create_compensation_entry", args)]);
  assert.deepEqual(race.map(r => r.status).sort(), [201, 422]);
  assert.equal((await db.select().from(compensationReviewEntry).where(eq(compensationReviewEntry.reviewId, concurrentReview.id))).length, 1);
  // Review currency snapshot remains stable if organization settings change.
  await db.update(organization).set({ defaultCurrency: "EUR" }).where(eq(organization.id, a.id));
  assert.equal((await read("get_compensation_review", { id: concurrentReview.id })).review.currency, "USD");
  assert.equal((await db.select().from(compensationReview).where(eq(compensationReview.id, concurrentReview.id)))[0].currency, "USD");
  assert.deepEqual([...seen].sort(), operations.map(o => o[0]).sort()); assert.deepEqual([...mseen].sort(), operations.map(o => o[0]).sort());
  await ma.close(); await mb.close(); await ro.close();
  console.log("Compensation and forecasting contracts verified: all 15 REST/MCP operations, exact arithmetic, tenant/role/range guards, rollback, race and currency snapshots");
}
run().then(() => process.exit(0), e => { console.error(e); process.exit(1); });
