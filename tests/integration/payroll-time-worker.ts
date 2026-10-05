import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, customRole, payrollEmployee, employeeLeaveBalance, leavePolicy, shiftDefinition, timesheet, timesheetEntry, leaveRequest, employeeSchedule, project } from "../../lib/db/schema";
import type { AuthContext } from "../../lib/api/auth-context";
import { registerPayrollTimeTools } from "../../lib/mcp/tools/payroll-time";
import { registerAllTools } from "../../lib/mcp/tools";
import { timeOperations } from "./payroll-time-operations";
type Args = Record<string, unknown>;
const definitions = timeOperations;
async function mcp(ctx: AuthContext, full = false) {
  const server = new McpServer({ name: "Payroll time fixture", version: "1" });
  if (full) registerAllTools(server, ctx); else registerPayrollTimeTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1" }), [ct, st] = InMemoryTransport.createLinkedPair();
  await server.connect(st); await client.connect(ct);
  const tools = (await client.listTools()).tools;
  assert.equal(new Set(tools.map(t => t.name)).size, tools.length);
  if (!full) assert.equal(tools.length, 32);
  for (const def of definitions) {
    const tool = tools.find(t => t.name === def.name); assert.ok(tool, def.name); assert.equal(tool.inputSchema.additionalProperties, false);
    for (const field of Object.values(tool.inputSchema.properties ?? {})) assert.ok((field as { description?: string }).description, def.name);
  }
  return { async call(name: string, args: Args = {}) {
    const result = await client.callTool({ name, arguments: args }), text = (result.content as { text: string }[])[0].text;
    return { isError: result.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
  }, async close() { await client.close(); await server.close(); } };
}
async function run() {
  const [a, b] = await db.insert(organization).values([{ name: "Time A", slug: "payroll-time-a" }, { name: "Time B", slug: "payroll-time-b" }]).returning();
  const [owner, viewer, selfUser, manager, unmapped] = await db.insert(users).values(["owner", "viewer", "self", "manager", "unmapped"].map(label => ({ email: `time-${label}@example.test` }))).returning();
  const permissions = ["manage:timesheets", "manage:shifts", "manage:payroll", "manage:leave", "approve:payroll", "self-service:payroll"];
  const [viewRole, selfRole, manageRole] = await db.insert(customRole).values([{ organizationId: a.id, name: "No access", permissions: [] },
    { organizationId: a.id, name: "Self", permissions: ["self-service:payroll"] }, { organizationId: a.id, name: "Manager", permissions }]).returning();
  const members = await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner" }, { organizationId: b.id, userId: owner.id, role: "owner" },
    { organizationId: a.id, userId: viewer.id, customRoleId: viewRole.id }, { organizationId: a.id, userId: selfUser.id, customRoleId: selfRole.id },
    { organizationId: a.id, userId: manager.id, customRoleId: manageRole.id }, { organizationId: a.id, userId: unmapped.id, customRoleId: selfRole.id }]).returning();
  const keys = { a: "dk_payroll_time_a", b: "dk_payroll_time_b", viewer: "dk_payroll_time_viewer", self: "dk_payroll_time_self", manager: "dk_payroll_time_manager", unmapped: "dk_payroll_time_unmapped", expired: "dk_payroll_time_expired" };
  for (const [label, key] of Object.entries(keys)) await db.insert(apiKey).values({ organizationId: label === "b" ? b.id : a.id,
    createdBy: label === "viewer" ? viewer.id : label === "self" ? selfUser.id : label === "manager" ? manager.id : label === "unmapped" ? unmapped.id : owner.id,
    name: label, keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_time", expiresAt: label === "expired" ? new Date("2020-01-01") : null });
  const [ea, ea2, eb, eself] = await db.insert(payrollEmployee).values([
    { organizationId: a.id, name: "A", employeeNumber: "A", salary: 1250, hourlyRate: 29, startDate: "2024-01-01", memberId: members[0].id },
    { organizationId: a.id, name: "A2", employeeNumber: "A2", salary: 0, startDate: "2024-01-01" },
    { organizationId: b.id, name: "B", employeeNumber: "B", salary: 0, startDate: "2024-01-01", memberId: members[1].id },
    { organizationId: a.id, name: "Self", employeeNumber: "Self", salary: 0, startDate: "2024-01-01", memberId: members[3].id },
  ]).returning();
  const [pa, pb] = await db.insert(project).values([{ organizationId: a.id, name: "A project", budget: 1250, hourlyRate: 29 }, { organizationId: b.id, name: "B project" }]).returning();
  const [foreignPolicy] = await db.insert(leavePolicy).values({ organizationId: b.id, name: "Foreign", leaveType: "vacation" }).returning();
  const [foreignShift] = await db.insert(shiftDefinition).values({ organizationId: b.id, name: "Foreign", startTime: "09:00", endTime: "17:00" }).returning();
  const ctx: AuthContext = { organizationId: a.id, userId: owner.id, role: "owner" };
  const ma = await mcp(ctx, true), mb = await mcp({ ...ctx, organizationId: b.id }), ro = await mcp({ ...ctx, userId: viewer.id, permissions: [] }),
    self = await mcp({ ...ctx, userId: selfUser.id, permissions: ["self-service:payroll"] }), managed = await mcp({ ...ctx, userId: manager.id, permissions }),
    noProfile = await mcp({ ...ctx, userId: unmapped.id, permissions: ["self-service:payroll"] });
  const definition = (name: string) => { const d = definitions.find(d => d.name === name); assert.ok(d, name); return d; };
  const restSeen = new Set<string>(), mcpSeen = new Set<string>();
  const rest = async (name: string, args: Args = {}, key = keys.a, malformed = false) => {
    restSeen.add(name); const d = definition(name), body = { ...args };
    for (const key of d.args) delete body[key];
    const params = { id: args.employeeId ?? args.id };
    const url = new URL("http://fixture.test/api/v1/payroll/" + d.path.replace("[id]", String(params.id)));
    if (d.query) for (const [k, v] of Object.entries(body)) url.searchParams.set(k, String(v));
    if (d.args.some(k => k === "entryId")) url.searchParams.set("entryId", String(args.entryId));
    const request = new Request(url, { method: d.verb, headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-organization-id": b.id },
      ...(d.verb === "GET" ? {} : { body: malformed ? "{" : JSON.stringify(body) }) });
    const route = await import("../../app/api/v1/payroll/" + d.path + "/route.ts") as Record<string, (r: Request, p: { params: Promise<typeof params> }) => Promise<Response>>;
    return route[d.verb](request, { params: Promise.resolve(params) });
  };
  const data = async (response: Response, status = 200) => { const body = await response.json(); assert.equal(response.status, status, JSON.stringify(body)); return body; };
  const read = async (name: string, args: Args = {}, key = keys.a) => data(await rest(name, args, key), name.startsWith("create") ? 201 : 200);
  const call = async (name: string, args: Args = {}, client = ma) => { mcpSeen.add(name); const r = await client.call(name, args); assert.equal(r.isError, false, JSON.stringify(r.body)); return r.body; };
  const snapshot = async () => Promise.all(["timesheet", "timesheet_entry", "shift_definition", "employee_schedule", "leave_policy", "leave_request", "employee_leave_balance", "payroll_employee", "project", "journal_entry", "journal_line", "audit_log"].map(t =>
    db.execute(sql.raw(`select coalesce(jsonb_agg(to_jsonb(t)::text order by t.id),'[]'::jsonb) as rows from ${t} t`)).then(r => r.rows)));
  const denied = async (name: string, args: Args, status: number, key = keys.a, malformed = false) => { const before = await snapshot(); await data(await rest(name, args, key, malformed), status); assert.deepEqual(await snapshot(), before); };
  const mdenied = async (name: string, args: Args, client = ma, status?: number) => { const before = await snapshot(), r = await client.call(name, args);
    assert.equal(r.isError, true, name); if (status) assert.equal(r.body.status, status); assert.deepEqual(await snapshot(), before); };
  const bothDenied = async (name: string, args: Args, status: number) => { await denied(name, args, status); await mdenied(name, args, ma, status); };
  const period = { periodStart: "2024-02-01", periodEnd: "2024-02-29" };
  const dates = { startDate: "2024-02-29", endDate: "2024-02-29" };
  try {
    const shift = (await read("create_payroll_shift", { name: "Legacy", shiftType: "night", startTime: "22:00", endTime: "06:00", premiumPercent: 25 })).shift;
    const shiftM = (await call("create_payroll_shift", { name: "MCP", shiftType: "regular", startTime: "09:00", endTime: "17:00", premiumPercent: 2.5 })).shift;
    assert.equal(shift.premiumPercent, 25);
    const policy = (await read("create_payroll_leave_policy", { name: "PTO", leaveType: "vacation", accrualRate: 2.5, maxBalance: 80, carryOverMax: 40 })).policy;
    const policyM = (await call("create_payroll_leave_policy", { name: "Sick", leaveType: "sick", accrualRate: 0.25 })).policy;
    const ts = (await read("create_payroll_timesheet", { employeeId: ea.id, ...period })).timesheet;
    const tsm = (await call("create_payroll_timesheet", { employeeId: ea2.id, ...period })).timesheet;
    const entry = (await read("create_payroll_timesheet_entry", { id: ts.id, date: "2024-02-29", hours: 7.5, projectId: pa.id })).entry;
    const entryM = (await call("create_payroll_timesheet_entry", { id: tsm.id, date: "2024-02-28", hours: 0.25 })).entry;
    assert.equal((await read("get_payroll_timesheet", { id: ts.id })).timesheet.totalHours, 7.5);
    const nested = (await call("get_payroll_timesheet", { id: ts.id })).timesheet;
    assert.equal(nested.employee.salaryMinor, "1250"); assert.equal(nested.employee.hourlyRateMinor, "29"); assert.equal(nested.entries[0].project.budgetMinor, "1250");
    assert.equal(nested.entries[0].project.totalHours, 0); // existing project minutes stay minutes
    await read("update_payroll_timesheet", { id: ts.id, periodStart: "2024-02-02" }); await call("update_payroll_timesheet", { id: tsm.id, periodStart: "2024-02-02" });
    for (const name of ["list_payroll_timesheets", "list_payroll_leave_requests"]) {
      const r = await read(name, { page: 1, limit: 1 }); assert.equal(r.pagination.limit, 1); await call(name, { page: 1, limit: 1 });
    }
    await read("list_payroll_timesheet_entries", { id: ts.id }); await call("list_payroll_timesheet_entries", { id: tsm.id });
    await read("create_payroll_employee_schedule", { employeeId: ea.id, shiftId: shift.id, dayOfWeek: 0, effectiveFrom: "2024-02-29" });
    await call("create_payroll_employee_schedule", { employeeId: ea2.id, shiftId: shiftM.id, dayOfWeek: 6, effectiveFrom: "2024-02-29", effectiveTo: null });
    await read("list_payroll_employee_schedules", { employeeId: ea.id }); await call("list_payroll_employee_schedules", { employeeId: ea2.id });
    for (const [plural, singular, id, mid, env] of [["shifts", "shift", shift.id, shiftM.id, "shift"], ["leave_policies", "leave_policy", policy.id, policyM.id, "policy"]]) {
      await read("list_payroll_" + plural); await call("list_payroll_" + plural);
      await read("get_payroll_" + singular, { id }); await call("get_payroll_" + singular, { id: mid });
      const args = singular === "shift" ? { premiumPercent: null } : { maxBalance: null, carryOverMax: null };
      const r = await read("update_payroll_" + singular, { id, ...args }); await call("update_payroll_" + singular, { id: mid, ...args });
      assert.equal(r[env][singular === "shift" ? "premiumPercent" : "maxBalance"], null);
    }
    const leave = (await read("create_payroll_leave_request", { employeeId: ea.id, policyId: policy.id, ...dates, hours: 7.5 })).request;
    const leaveM = (await call("create_payroll_leave_request", { employeeId: ea2.id, policyId: policyM.id, ...dates, hours: 0.25 })).request;
    await read("get_payroll_leave_request", { id: leave.id }); await call("get_payroll_leave_request", { id: leaveM.id });
    await read("update_payroll_leave_request", { id: leave.id, reason: "Reason", status: "pending" }); await call("update_payroll_leave_request", { id: leaveM.id, reason: null });
    const balances = await db.insert(employeeLeaveBalance).values([{ employeeId: ea.id, policyId: policy.id, year: 2024, balance: 8 },
      { employeeId: ea2.id, policyId: policyM.id, year: 2024, balance: 8 }, { employeeId: ea.id, policyId: policy.id, year: 2026, balance: 80 },
      { employeeId: eself.id, policyId: policy.id, year: 2024, balance: 8 }]).returning();
    await read("get_employee_leave_balances", { employeeId: ea.id }); const bm = await call("get_employee_leave_balances", { employeeId: ea2.id }); assert.equal(bm.balances[0].balance, 8);
    const st = (await read("create_self_payroll_timesheet", period, keys.self)).timesheet; assert.equal(st.employeeId, eself.id);
    await read("create_payroll_timesheet_entry", { id: st.id, date: "2024-02-29", hours: 0.25, projectId: pa.id });
    await call("create_self_payroll_timesheet", period, self);
    const ownSheets = (await read("list_self_payroll_timesheets", {}, keys.self)).data;
    assert.equal(ownSheets.find((t: { id: string }) => t.id === st.id).entries[0].project, undefined);
    assert.equal(ownSheets.every((t: { employeeId: string }) => t.employeeId === eself.id), true);
    const ownMcpSheets = (await call("list_self_payroll_timesheets", {}, self)).data;
    assert.equal(ownMcpSheets.find((t: { id: string }) => t.id === st.id).entries[0].project, undefined);
    await read("create_self_payroll_leave_request", { policyId: policy.id, ...dates, hours: 0.25 }, keys.self);
    await call("create_self_payroll_leave_request", { policyId: policy.id, ...dates, hours: 0.25 }, self);
    await read("get_self_payroll_leave_balances", {}, keys.self); await call("get_self_payroll_leave_balances", {}, self);
    // Permissions, credentials and tenant isolation on every operation.
    const valid: Record<string, Args> = Object.fromEntries(definitions.map(d => [d.name, {}]));
    Object.assign(valid, {
      create_payroll_timesheet: { employeeId: ea.id, ...period }, get_payroll_timesheet: { id: ts.id }, update_payroll_timesheet: { id: ts.id },
      list_payroll_timesheet_entries: { id: ts.id }, create_payroll_timesheet_entry: { id: ts.id, date: "2024-02-29", hours: 0.25 }, delete_payroll_timesheet_entry: { id: ts.id, entryId: entry.id },
      submit_payroll_timesheet: { id: ts.id }, approve_payroll_timesheet: { id: ts.id }, reject_payroll_timesheet: { id: ts.id },
      create_payroll_shift: { name: "Fault", shiftType: "regular", startTime: "09:00", endTime: "17:00" }, get_payroll_shift: { id: shift.id }, update_payroll_shift: { id: shift.id }, delete_payroll_shift: { id: shift.id },
      create_payroll_leave_policy: { name: "Fault", leaveType: "vacation" }, get_payroll_leave_policy: { id: policy.id }, update_payroll_leave_policy: { id: policy.id },
      create_payroll_employee_schedule: { employeeId: ea.id, shiftId: shift.id, dayOfWeek: 1, effectiveFrom: "2024-02-29" }, list_payroll_employee_schedules: { employeeId: ea.id },
      create_payroll_leave_request: { employeeId: ea.id, policyId: policy.id, ...dates, hours: 0.25 }, get_payroll_leave_request: { id: leave.id }, update_payroll_leave_request: { id: leave.id },
      approve_payroll_leave_request: { id: leave.id }, reject_payroll_leave_request: { id: leave.id }, get_employee_leave_balances: { employeeId: ea.id },
      create_self_payroll_timesheet: period, create_self_payroll_leave_request: { policyId: policy.id, ...dates, hours: 0.25 },
    });
    for (const d of definitions) {
      await denied(d.name, valid[d.name], 403, keys.viewer); await mdenied(d.name, valid[d.name], ro, 403);
      await denied(d.name, valid[d.name], 401, keys.expired); await denied(d.name, valid[d.name], 401, "dk_invalid");
      if (d.args.some(k => k === "id" || k === "employeeId")) { await denied(d.name, valid[d.name], 404, keys.b); await mdenied(d.name, valid[d.name], mb, 404); }
    }
    await read("create_payroll_timesheet", { employeeId: ea.id, ...period }, keys.manager); await call("create_payroll_shift", valid.create_payroll_shift, managed);
    for (const d of definitions.filter(d => d.name.includes("self"))) { await denied(d.name, valid[d.name], 404, keys.unmapped); await mdenied(d.name, valid[d.name], noProfile, 404); }
    await denied("create_self_payroll_leave_request", { employeeId: ea.id, policyId: policy.id, ...dates, hours: 1 }, 400, keys.self);
    await mdenied("create_self_payroll_leave_request", { employeeId: ea.id, policyId: policy.id, ...dates, hours: 1 }, self);
    // Strict types/units/dates/ranges, relational ownership and wrong entry path.
    for (const [name, args, status] of [
      ["create_payroll_timesheet", { ...valid.create_payroll_timesheet, employeeId: eb.id }, 404],
      ["create_payroll_timesheet", { ...valid.create_payroll_timesheet, periodStart: "2024-02-30" }, 400],
      ["update_payroll_timesheet", { id: ts.id, periodEnd: "2024-02-28" }, 400],
      ["create_payroll_timesheet_entry", { ...valid.create_payroll_timesheet_entry, hours: 0.1 }, 400],
      ["create_payroll_timesheet_entry", { ...valid.create_payroll_timesheet_entry, hoursMinor: "25" }, 400],
      ["create_payroll_timesheet_entry", { ...valid.create_payroll_timesheet_entry, projectId: pb.id }, 404],
      ["create_payroll_timesheet_entry", { ...valid.create_payroll_timesheet_entry, date: "2024-03-01" }, 400],
      ["delete_payroll_timesheet_entry", { id: ts.id, entryId: entryM.id }, 404],
      ["create_payroll_employee_schedule", { ...valid.create_payroll_employee_schedule, shiftId: foreignShift.id }, 404],
      ["create_payroll_employee_schedule", { ...valid.create_payroll_employee_schedule, employeeId: eb.id }, 404],
      ["create_payroll_employee_schedule", { ...valid.create_payroll_employee_schedule, effectiveTo: "2024-02-28" }, 400],
      ["create_payroll_shift", { ...valid.create_payroll_shift, premiumPercent: 2.9 }, 400],
      ["create_payroll_shift", { ...valid.create_payroll_shift, startTime: "24:00" }, 400],
      ["create_payroll_leave_policy", { ...valid.create_payroll_leave_policy, maxBalance: -1 }, 400],
      ["create_payroll_leave_request", { ...valid.create_payroll_leave_request, policyId: foreignPolicy.id }, 404],
      ["create_payroll_leave_request", { ...valid.create_payroll_leave_request, employeeId: eb.id }, 404],
      ["create_payroll_leave_request", { ...valid.create_payroll_leave_request, hours: "0.25" }, 400],
      ["create_payroll_leave_request", { ...valid.create_payroll_leave_request, endDate: "2025-01-01" }, 400],
      ["update_payroll_leave_request", { id: leave.id, status: "approved" }, 409],
      ["update_payroll_leave_request", { id: leave.id, status: "rejected" }, 409],
      ["list_payroll_timesheets", { page: "1x" }, 400], ["list_payroll_leave_requests", { status: "bad" }, 400],
    ] as [string, Args, number][]) { await denied(name, args, status); await mdenied(name, args); }
    for (const d of definitions.filter(d => d.body)) {
      await denied(d.name, valid[d.name], 400, keys.a, true);
      await denied(d.name, { ...valid[d.name], unknown: true }, 400); await mdenied(d.name, { ...valid[d.name], unknown: true });
    }
    for (const d of definitions.filter(d => d.verb !== "GET" && !d.body)) {
      await denied(d.name, { ...valid[d.name], unknown: true }, 400); await denied(d.name, valid[d.name], 400, keys.a, true);
      await mdenied(d.name, { ...valid[d.name], unknown: true });
    }
    // Both adapters reject existing unsupported history without unrelated edits or disclosures.
    for (const [table, column, id, bad, restore, name, args] of [
      ["timesheet", "total_hours", ts.id, "-1", "7.5", "update_payroll_timesheet", { id: ts.id }],
      ["timesheet_entry", "hours", entry.id, "'NaN'::real", "7.5", "get_payroll_timesheet", { id: ts.id }],
      ["shift_definition", "premium_percent", shift.id, "-1", "null", "update_payroll_shift", { id: shift.id }],
      ["leave_policy", "accrual_rate", policy.id, "-1", "2.5", "update_payroll_leave_policy", { id: policy.id }],
      ["leave_request", "hours", leave.id, "-1", "7.5", "update_payroll_leave_request", { id: leave.id }],
      ["employee_leave_balance", "balance", balances[0].id, "-1", "8", "get_employee_leave_balances", { employeeId: ea.id }],
      ["employee_schedule", "day_of_week", (await db.select().from(employeeSchedule).where(eq(employeeSchedule.employeeId, ea.id)))[0].id, "9", "0", "list_payroll_employee_schedules", { employeeId: ea.id }],
      ["payroll_employee", "salary", ea.id, "9007199254740992", "1250", "get_payroll_timesheet", { id: ts.id }],
    ] as [string, string, string, string, string, string, Args][]) {
      await db.execute(sql.raw(`update ${table} set ${column}=${bad} where id='${id}'`)); await bothDenied(name, args, 422);
      await db.execute(sql.raw(`update ${table} set ${column}=${restore} where id='${id}'`));
    }
    // Malformed historical nested links must never expose another organization.
    await db.update(timesheetEntry).set({ projectId: pb.id }).where(eq(timesheetEntry.id, entry.id)); await bothDenied("get_payroll_timesheet", { id: ts.id }, 404);
    await db.update(timesheetEntry).set({ projectId: pa.id }).where(eq(timesheetEntry.id, entry.id));
    await db.execute(sql`update project set budget=9007199254740992 where id=${pa.id}`); await bothDenied("get_payroll_timesheet", { id: ts.id }, 422);
    await db.update(project).set({ budget: 1250, deletedAt: new Date() }).where(eq(project.id, pa.id));
    assert.equal((await read("get_payroll_timesheet", { id: ts.id })).timesheet.entries[0].project.id, pa.id);
    await bothDenied("create_payroll_timesheet_entry", { ...valid.create_payroll_timesheet_entry, projectId: pa.id }, 404);
    await db.update(project).set({ deletedAt: null }).where(eq(project.id, pa.id));
    await db.update(leaveRequest).set({ policyId: foreignPolicy.id }).where(eq(leaveRequest.id, leave.id)); await bothDenied("get_payroll_leave_request", { id: leave.id }, 404);
    await db.update(leaveRequest).set({ policyId: policy.id }).where(eq(leaveRequest.id, leave.id));
    await db.update(employeeSchedule).set({ shiftId: foreignShift.id }).where(eq(employeeSchedule.employeeId, ea.id)); await bothDenied("list_payroll_employee_schedules", { employeeId: ea.id }, 404);
    await db.update(employeeSchedule).set({ shiftId: shift.id }).where(eq(employeeSchedule.employeeId, ea.id));
    // Precision overflow is guarded before writes, not repaired by fround or greatest(...,0).
    const big = (await read("create_payroll_timesheet", { employeeId: ea.id, ...period })).timesheet;
    await call("create_payroll_timesheet_entry", { id: big.id, date: "2024-02-29", hours: 2 ** 24 });
    await bothDenied("create_payroll_timesheet_entry", { id: big.id, date: "2024-02-29", hours: 0.25 }, 422);
    await db.update(employeeLeaveBalance).set({ usedHours: 2 ** 24 }).where(eq(employeeLeaveBalance.id, balances[0].id)); await bothDenied("approve_payroll_leave_request", { id: leave.id }, 422);
    await db.update(employeeLeaveBalance).set({ usedHours: 0 }).where(eq(employeeLeaveBalance.id, balances[0].id));
    // Every writer has atomic audit rollback, including two-table entry and leave changes.
    const submitted = (await read("create_payroll_timesheet", { employeeId: ea.id, ...period })).timesheet;
    await read("submit_payroll_timesheet", { id: submitted.id });
    const mutations = definitions.filter(d => d.verb !== "GET").map(d => [d.name, { ...valid[d.name] }] as [string, Args]);
    for (const item of mutations) if (item[0] === "approve_payroll_timesheet" || item[0] === "reject_payroll_timesheet") item[1] = { id: submitted.id };
    await db.execute(sql`create function fail_payroll_time_audit() returns trigger language plpgsql as $$ begin raise exception 'Synthetic time audit failure'; end $$`);
    await db.execute(sql`create trigger fail_payroll_time_audit before insert on audit_log for each row execute function fail_payroll_time_audit()`);
    const oldError = console.error; console.error = () => {};
    try { for (const [name, args] of mutations) { await denied(name, args, 500); await mdenied(name, args); } }
    finally { console.error = oldError; await db.execute(sql`drop trigger fail_payroll_time_audit on audit_log`); await db.execute(sql`drop function fail_payroll_time_audit()`); }
    await db.execute(sql`create function corrupt_payroll_time() returns trigger language plpgsql as $$ begin new.hours := -1; return new; end $$`);
    await db.execute(sql`create trigger corrupt_payroll_time before insert on timesheet_entry for each row execute function corrupt_payroll_time()`);
    await bothDenied("create_payroll_timesheet_entry", valid.create_payroll_timesheet_entry, 422);
    await db.execute(sql`drop trigger corrupt_payroll_time on timesheet_entry`); await db.execute(sql`drop function corrupt_payroll_time()`);
    // Concurrent adapters preserve sum and settle leave exactly once using request year, not today.
    await Promise.all([read("create_payroll_timesheet_entry", { id: ts.id, date: "2024-02-29", hours: 0.25 }), call("create_payroll_timesheet_entry", { id: ts.id, date: "2024-02-29", hours: 0.25 })]);
    assert.equal((await read("get_payroll_timesheet", { id: ts.id })).timesheet.totalHours, 8);
    await read("delete_payroll_timesheet_entry", { id: ts.id, entryId: entry.id }); await call("delete_payroll_timesheet_entry", { id: tsm.id, entryId: entryM.id });
    assert.equal((await call("get_payroll_timesheet", { id: ts.id })).timesheet.totalHours, 0.5);
    await read("submit_payroll_timesheet", { id: ts.id }); await call("submit_payroll_timesheet", { id: tsm.id });
    await read("approve_payroll_timesheet", { id: ts.id }); await call("approve_payroll_timesheet", { id: tsm.id });
    for (const name of ["update_payroll_timesheet", "create_payroll_timesheet_entry", "delete_payroll_timesheet_entry", "submit_payroll_timesheet", "approve_payroll_timesheet", "reject_payroll_timesheet"])
      await bothDenied(name, { ...valid[name], id: ts.id }, 409);
    const rejectTs = (await read("create_payroll_timesheet", { employeeId: ea.id, ...period })).timesheet;
    const rejectTsM = (await call("create_payroll_timesheet", { employeeId: ea.id, ...period })).timesheet;
    await read("submit_payroll_timesheet", { id: rejectTs.id }); await call("submit_payroll_timesheet", { id: rejectTsM.id });
    await read("reject_payroll_timesheet", { id: rejectTs.id, reason: "No" }); await call("reject_payroll_timesheet", { id: rejectTsM.id, reason: null });
    const race = await Promise.all([rest("approve_payroll_leave_request", { id: leave.id }), ma.call("approve_payroll_leave_request", { id: leave.id })]);
    assert.equal((race[0].status === 200 ? 1 : 0) + (!race[1].isError ? 1 : 0), 1); assert.ok(race[0].status === 409 || race[1].body.status === 409); mcpSeen.add("approve_payroll_leave_request");
    const balance2024 = (await db.select().from(employeeLeaveBalance).where(eq(employeeLeaveBalance.id, balances[0].id)))[0]; assert.equal(balance2024.balance, 0.5); assert.equal(balance2024.usedHours, 7.5);
    assert.equal((await db.select().from(employeeLeaveBalance).where(eq(employeeLeaveBalance.id, balances[2].id)))[0].balance, 80);
    await call("approve_payroll_leave_request", { id: leaveM.id });
    await bothDenied("update_payroll_leave_request", { id: leave.id, status: "pending" }, 409);
    const rejected = (await read("create_payroll_leave_request", { employeeId: ea.id, policyId: policy.id, ...dates, hours: 0.25 })).request;
    const rejectedM = (await call("create_payroll_leave_request", { employeeId: ea.id, policyId: policy.id, ...dates, hours: 0.25 })).request;
    await read("reject_payroll_leave_request", { id: rejected.id, reason: "No" }); await call("reject_payroll_leave_request", { id: rejectedM.id });
    const excess = (await call("create_payroll_leave_request", { employeeId: ea.id, policyId: policy.id, ...dates, hours: 1 })).request;
    await bothDenied("approve_payroll_leave_request", { id: excess.id }, 409);
    const missing = (await call("create_payroll_leave_request", { employeeId: ea2.id, policyId: policy.id, ...dates, hours: 1 })).request;
    await bothDenied("approve_payroll_leave_request", { id: missing.id }, 409);
    const approvedRest = (await read("create_payroll_leave_request", { employeeId: ea2.id, policyId: policyM.id, ...dates, hours: 0.25 })).request;
    await read("approve_payroll_leave_request", { id: approvedRest.id });
    const cancelled = (await read("create_payroll_leave_request", { employeeId: ea.id, policyId: policy.id, ...dates, hours: 0.25 })).request;
    await call("update_payroll_leave_request", { id: cancelled.id, status: "cancelled" }); await bothDenied("approve_payroll_leave_request", { id: cancelled.id }, 409);
    await db.insert(employeeLeaveBalance).values({ employeeId: ea.id, policyId: policy.id, year: 2024, balance: 8 });
    await bothDenied("approve_payroll_leave_request", { id: excess.id }, 409); await bothDenied("get_employee_leave_balances", { employeeId: ea.id }, 422);
    const deleteRace = await Promise.all([rest("delete_payroll_shift", { id: shift.id }), ma.call("delete_payroll_shift", { id: shift.id })]);
    assert.equal((deleteRace[0].status === 200 ? 1 : 0) + (!deleteRace[1].isError ? 1 : 0), 1); mcpSeen.add("delete_payroll_shift");
    await read("delete_payroll_shift", { id: shiftM.id }); await bothDenied("update_payroll_shift", { id: shift.id }, 404);
    assert.equal((await read("list_payroll_employee_schedules", { employeeId: ea.id })).data[0].shift.id, shift.id); // retained shift history
    await bothDenied("create_payroll_employee_schedule", { ...valid.create_payroll_employee_schedule, shiftId: shift.id }, 404);
    await db.update(leavePolicy).set({ isActive: false }).where(eq(leavePolicy.id, policyM.id));
    await bothDenied("create_payroll_leave_request", { ...valid.create_payroll_leave_request, policyId: policyM.id }, 409);
    await db.update(payrollEmployee).set({ deletedAt: new Date() }).where(eq(payrollEmployee.id, ea2.id));
    await bothDenied("create_payroll_timesheet", { employeeId: ea2.id, ...period }, 404);
    // Duplicate or deleted self profiles cannot be guessed, or selected by caller input.
    const [duplicateProfile] = await db.insert(payrollEmployee).values({ organizationId: a.id, name: "Duplicate self", employeeNumber: "Duplicate", salary: 0, startDate: "2024-01-01", memberId: members[3].id }).returning();
    await denied("list_self_payroll_timesheets", {}, 409, keys.self); await mdenied("list_self_payroll_timesheets", {}, self, 409);
    await db.update(payrollEmployee).set({ deletedAt: new Date() }).where(eq(payrollEmployee.id, duplicateProfile.id));
    await db.update(payrollEmployee).set({ deletedAt: new Date() }).where(eq(payrollEmployee.id, eself.id));
    await denied("create_self_payroll_timesheet", period, 404, keys.self); await mdenied("create_self_payroll_timesheet", period, self, 404);
    await db.update(timesheet).set({ deletedAt: new Date() }).where(eq(timesheet.id, st.id)); await bothDenied("get_payroll_timesheet", { id: st.id }, 404);
    for (const d of definitions) { assert.ok(restSeen.has(d.name), "REST " + d.name); assert.ok(mcpSeen.has(d.name), "MCP " + d.name); }
    for (const table of ["journal_entry", "journal_line"]) assert.equal((await db.execute(sql.raw(`select count(*)::int as n from ${table}`))).rows[0].n, 0);
    console.log("Payroll time contracts verified: 32 operations, REST/MCP, two tenants, physical units, rollback, history and concurrency");
  } finally { await Promise.all([ma.close(), mb.close(), ro.close(), self.close(), managed.close(), noProfile.close()]); }
}
run().then(() => process.exit(0), error => { console.error(error); process.exit(1); });
