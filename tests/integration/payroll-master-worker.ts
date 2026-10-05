import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, customRole, payrollEmployee, contractor, contractorPayment, payrollRun, payrollItem } from "../../lib/db/schema";
import type { AuthContext } from "../../lib/api/auth-context";
import { GET as employees, POST as createEmployee } from "../../app/api/v1/payroll/employees/route";
import { GET as employee, PATCH as patchEmployee, DELETE as removeEmployee } from "../../app/api/v1/payroll/employees/[id]/route";
import { GET as contractors, POST as createContractor } from "../../app/api/v1/payroll/contractors/route";
import { GET as contractorDetail, PATCH as patchContractor, DELETE as removeContractor } from "../../app/api/v1/payroll/contractors/[id]/route";
import { registerPayrollMasterTools } from "../../lib/mcp/tools/payroll-master";
import { registerAllTools } from "../../lib/mcp/tools";
import { createPayrollEmployee, updatePayrollEmployee, deletePayrollEmployee, createPayrollContractor, updatePayrollContractor, deletePayrollContractor } from "../../lib/api/payroll-master";

async function mcp(ctx: AuthContext, full = false) {
  const server = new McpServer({ name: "Payroll master fixture", version: "1" });
  if (full) registerAllTools(server, ctx); else registerPayrollMasterTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1" }), [ct, st] = InMemoryTransport.createLinkedPair();
  await server.connect(st); await client.connect(ct);
  const tools = (await client.listTools()).tools, names = tools.map(t => t.name);
  assert.equal(new Set(names).size, names.length);
  const masterNames = ["list_payroll_employees", "get_payroll_employee", "create_payroll_employee", "update_payroll_employee", "delete_payroll_employee", "list_contractors", "get_contractor", "create_contractor", "update_contractor", "delete_contractor"];
  if (!full) assert.equal(tools.length, 10);
  for (const name of masterNames) {
    const tool = tools.find(t => t.name === name); assert.ok(tool, name); assert.equal(tool.inputSchema.additionalProperties, false);
    for (const field of Object.values(tool.inputSchema.properties ?? {})) assert.ok((field as { description?: string }).description, name);
  }
  return { async call(name: string, args: Record<string, unknown>) {
    const result = await client.callTool({ name, arguments: args }), text = (result.content as { text: string }[])[0].text;
    return { isError: result.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
  }, async close() { await client.close(); await server.close(); } };
}
async function run() {
  const [a, b] = await db.insert(organization).values([{ name: "Payroll A", slug: "payroll-master-a" }, { name: "Payroll B", slug: "payroll-master-b" }]).returning();
  const [owner, viewer, manager] = await db.insert(users).values([{ email: "payroll-master-owner@example.test", passwordHash: "SECRET-HASH" },
    { email: "payroll-master-viewer@example.test" }, { email: "payroll-master-manager@example.test" }]).returning();
  const [viewRole, manageRole] = await db.insert(customRole).values([{ organizationId: a.id, name: "No payroll", permissions: [] },
    { organizationId: a.id, name: "Payroll masters", permissions: ["manage:payroll", "manage:contractors"] }]).returning();
  const [ownMember, foreignMember] = await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner" },
    { organizationId: b.id, userId: owner.id, role: "owner" }, { organizationId: a.id, userId: viewer.id, customRoleId: viewRole.id },
    { organizationId: a.id, userId: manager.id, customRoleId: manageRole.id }]).returning();
  const keys = { a: "dk_payroll_master_a", b: "dk_payroll_master_b", viewer: "dk_payroll_master_viewer", manager: "dk_payroll_master_manager", expired: "dk_payroll_master_expired" };
  for (const [label, key] of Object.entries(keys)) await db.insert(apiKey).values({ organizationId: label === "b" ? b.id : a.id,
    createdBy: label === "viewer" ? viewer.id : label === "manager" ? manager.id : owner.id, name: label,
    keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_payroll", expiresAt: label === "expired" ? new Date("2020-01-01") : null });
  const ctx: AuthContext = { organizationId: a.id, userId: owner.id, role: "owner" };
  const ma = await mcp(ctx, true), mb = await mcp({ ...ctx, organizationId: b.id }), ro = await mcp({ ...ctx, userId: viewer.id, role: "member", permissions: [] });
  const managed = await mcp({ ...ctx, userId: manager.id, role: "member", permissions: ["manage:payroll", "manage:contractors"] });
  const req = (body: unknown = {}, key = keys.a, query = "") => new Request("http://fixture.test/api/v1/payroll" + query, { method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-organization-id": b.id }, body: JSON.stringify(body) });
  const p = (id: string) => ({ params: Promise.resolve({ id }) });
  const data = async (response: Response, status = 200) => { const body = await response.json(); assert.equal(response.status, status, JSON.stringify(body)); return body; };
  const snapshot = async () => Promise.all(["payroll_employee", "contractor", "contractor_payment", "payroll_run", "payroll_item", "journal_entry", "journal_line", "audit_log"].map(t =>
    db.execute(sql.raw(`select coalesce(jsonb_agg(to_jsonb(t)::text order by t.id),'[]'::jsonb) as rows from ${t} t`)).then(r => r.rows)));
  const denied = async (fn: () => Promise<Response>, status: number) => { const before = await snapshot(); await data(await fn(), status); assert.deepEqual(await snapshot(), before); };
  const mdenied = async (name: string, args: Record<string, unknown>, client = ma, status?: number) => {
    const before = await snapshot(), result = await client.call(name, args); assert.equal(result.isError, true, name);
    if (status) assert.equal(result.body.status, status); assert.deepEqual(await snapshot(), before);
  };
  const base = { name: "Legacy", employeeNumber: "E1", startDate: "2024-02-29" };
  try {
    const e = (await data(await createEmployee(req({ ...base, salary: 1250, hourlyRate: 0, memberId: ownMember.id })), 201)).employee;
    assert.equal(e.organizationId, a.id); assert.equal(e.salaryMinor, "1250"); assert.equal(e.hourlyRateMinor, "0"); assert.equal(e.taxRate, 2000);
    const em = (await ma.call("create_payroll_employee", { ...base, name: "Exact", salaryMinor: "9007199254740991", hourlyRateMinor: "3000000000", currency: "KWD" })).body.employee;
    assert.equal(em.salary, Number.MAX_SAFE_INTEGER); assert.equal(em.hourlyRate, 3000000000); assert.equal(em.currency, "KWD");
    await data(await createEmployee(req({ ...base, name: "Dual", salary: 29, salaryMinor: "29" })), 201);
    assert.equal((await ma.call("create_payroll_employee", { ...base, salary: 0, salaryMinor: "0" })).isError, false);
    const c = (await data(await createContractor(req({ name: "Legacy contractor", hourlyRate: 1250 })), 201)).contractor;
    const cm = (await ma.call("create_contractor", { name: "Exact contractor", hourlyRateMinor: "9007199254740991", currency: "JPY" })).body.contractor;
    assert.equal(cm.hourlyRate, Number.MAX_SAFE_INTEGER); assert.equal(cm.currency, "JPY");
    assert.equal((await data(await createContractor(req({ name: "Dual contractor", hourlyRate: 29, hourlyRateMinor: "29", email: null, company: null })), 201)).contractor.hourlyRateMinor, "29");
    const ep = (await data(await patchEmployee(req({ salaryMinor: "3000000000", taxRate: 2029, hourlyRateMinor: null }), p(e.id)))).employee;
    assert.equal(ep.salary, 3000000000); assert.equal(ep.taxRate, 2029); assert.equal(ep.hourlyRate, null);
    const retained = (await ma.call("update_payroll_employee", { employeeId: e.id, name: "Renamed" })).body.employee;
    assert.equal(retained.salaryMinor, "3000000000"); assert.equal(retained.hourlyRateMinor, null); assert.equal(retained.taxRate, 2029);
    assert.equal((await ma.call("update_contractor", { contractorId: c.id, hourlyRate: 0, hourlyRateMinor: "0", isActive: false })).body.contractor.hourlyRate, 0);
    const cp = (await data(await patchContractor(req({ name: "Renamed" }), p(c.id)))).contractor;
    assert.equal(cp.hourlyRateMinor, "0"); assert.equal(cp.isActive, false);
    const er = (await data(await employee(req(), p(e.id)))).employee;
    assert.equal(er.member.user.email, owner.email); assert.equal(JSON.stringify(er).includes("SECRET-HASH"), false); assert.equal("passwordHash" in er.member.user, false);
    assert.deepEqual((await ma.call("get_payroll_employee", { employeeId: e.id })).body.employee, er);
    const list = await data(await employees(req())); assert.deepEqual((await ma.call("list_payroll_employees", {})).body.employees, list.data);
    assert.equal(list.pagination.total, list.data.length); assert.equal(JSON.stringify(list).includes("passwordHash"), false);
    assert.equal((await data(await employees(req({}, keys.b)))).pagination.total, 0);
    assert.equal((await mb.call("list_payroll_employees", {})).body.total, 0);
    assert.equal((await data(await contractors(req({}, keys.b)))).pagination.total, 0);
    assert.equal((await mb.call("list_contractors", {})).body.total, 0);
    assert.deepEqual((await ma.call("list_contractors", { active: false })).body.contractors, (await data(await contractors(req({}, keys.a, "?isActive=false")))).data);
    assert.equal((await data(await employees(req({}, keys.a, "?page=2&limit=1")))).data.length, 1);
    const [history] = await db.insert(contractorPayment).values({ contractorId: c.id, amount: 3000000000, currency: "KWD", status: "paid" }).returning();
    const cd = (await data(await contractorDetail(req(), p(c.id)))).contractor;
    assert.equal(cd.payments[0].amountMinor, "3000000000"); assert.equal(cd.payments[0].currency, "KWD");
    assert.deepEqual((await ma.call("get_contractor", { contractorId: c.id })).body.contractor, cd);
    await denied(() => patchContractor(req({ currency: "EUR" }), p(c.id)), 409); await mdenied("update_contractor", { contractorId: c.id, currency: "EUR" }, ma, 409);
    assert.equal((await ma.call("update_contractor", { contractorId: cm.id, currency: "EUR" })).body.contractor.hourlyRateMinor, "9007199254740991");
    assert.equal((await data(await patchEmployee(req({ currency: "EUR" }), p(em.id)))).employee.salaryMinor, "9007199254740991");
    const [run] = await db.insert(payrollRun).values({ organizationId: a.id, payPeriodStart: "2024-02-01", payPeriodEnd: "2024-02-29" }).returning();
    const [item] = await db.insert(payrollItem).values({ payrollRunId: run.id, employeeId: e.id, grossAmount: 1250, taxAmount: 250, netAmount: 1000 }).returning();
    await denied(() => patchEmployee(req({ currency: "IRR" }), p(e.id)), 409); await mdenied("update_payroll_employee", { employeeId: e.id, currency: "IRR" }, ma, 409);
    for (const bad of [{ salary: -1 }, { salary: 0.5 }, { salaryMinor: "01" }, { salary: 1, salaryMinor: "2" }, { taxRate: 10001 },
      { taxRate: 1.5 }, { currency: "ZZZ" }, { memberId: "invalid" }, { endDate: "2024-04-31" }, { endDate: "2024-02-28" }, { unexpected: true }]) {
      await denied(() => createEmployee(req({ ...base, salary: 0, ...bad })), 400); await denied(() => patchEmployee(req(bad), p(e.id)), 400);
      await mdenied("create_payroll_employee", { ...base, salary: 0, ...bad }); await mdenied("update_payroll_employee", { employeeId: e.id, ...bad });
    }
    await denied(() => createEmployee(req(base)), 400); await mdenied("create_payroll_employee", base);
    for (const bad of [{ hourlyRate: -1 }, { hourlyRate: 0.5 }, { hourlyRateMinor: "-0" }, { hourlyRate: null, hourlyRateMinor: "0" },
      { hourlyRate: 0, hourlyRateMinor: null }, { currency: "ZZZ" }, { defaultRate: 1250 }]) {
      await denied(() => createContractor(req({ name: "Bad", ...bad })), 400); await denied(() => patchContractor(req(bad), p(c.id)), 400);
      await mdenied("create_contractor", { name: "Bad", ...bad }); await mdenied("update_contractor", { contractorId: c.id, ...bad });
    }
    for (const amount of ["9007199254740992", "9223372036854775807"]) {
      await denied(() => createEmployee(req({ ...base, salaryMinor: amount })), 422); await denied(() => patchEmployee(req({ salaryMinor: amount }), p(e.id)), 422);
      await mdenied("create_payroll_employee", { ...base, salaryMinor: amount }, ma, 422);
      await denied(() => createContractor(req({ name: "Unsafe", hourlyRateMinor: amount })), 422); await mdenied("update_contractor", { contractorId: c.id, hourlyRateMinor: amount }, ma, 422);
    }
    for (const query of ["?page=0", "?limit=201", "?page=1oops", "?active=yes"]) await denied(() => employees(req({}, keys.a, query)), 400);
    await denied(() => contractors(req({}, keys.a, "?isActive=yes")), 400);
    const malformed = () => new Request("http://fixture.test", { method: "POST", headers: { authorization: `Bearer ${keys.a}` }, body: "{" });
    await denied(() => createEmployee(malformed()), 400); await denied(() => patchContractor(malformed(), p(c.id)), 400);
    await denied(() => createEmployee(req({ ...base, salary: 0, memberId: foreignMember.id })), 404);
    await mdenied("update_payroll_employee", { employeeId: e.id, memberId: foreignMember.id }, ma, 404);
    await db.update(payrollEmployee).set({ memberId: foreignMember.id }).where(eq(payrollEmployee.id, e.id));
    assert.equal((await data(await employee(req(), p(e.id)))).employee.member, null);
    await denied(() => patchEmployee(req({ name: "Unrelated" }), p(e.id)), 404);
    await data(await patchEmployee(req({ memberId: null }), p(e.id)));
    for (const key of [keys.b, keys.viewer, keys.expired, "dk_invalid"]) {
      const status = key === keys.b ? 404 : key === keys.viewer ? 403 : 401;
      for (const fn of [() => employee(req({}, key), p(e.id)), () => patchEmployee(req({ name: "Denied" }, key), p(e.id)), () => removeEmployee(req({}, key), p(e.id)),
        () => contractorDetail(req({}, key), p(c.id)), () => patchContractor(req({ name: "Denied" }, key), p(c.id)), () => removeContractor(req({}, key), p(c.id))]) await denied(fn, status);
    }
    for (const [name, args] of [["get_payroll_employee", { employeeId: e.id }], ["update_payroll_employee", { employeeId: e.id, name: "Denied" }], ["delete_payroll_employee", { employeeId: e.id }],
      ["get_contractor", { contractorId: c.id }], ["update_contractor", { contractorId: c.id, name: "Denied" }], ["delete_contractor", { contractorId: c.id }]] as const) {
      await mdenied(name, args, mb, 404); await mdenied(name, args, ro, 403);
    }
    for (const [name, args] of [["list_payroll_employees", {}], ["create_payroll_employee", { ...base, salary: 0 }], ["list_contractors", {}], ["create_contractor", { name: "Denied" }]] as const) await mdenied(name, args, ro, 403);
    await denied(() => createEmployee(req({ ...base, salary: 0 }, keys.viewer)), 403); await denied(() => createContractor(req({ name: "Denied" }, keys.viewer)), 403);
    const managedEmployee = (await data(await createEmployee(req({ ...base, salary: 0 }, keys.manager)), 201)).employee;
    const managedContractor = (await managed.call("create_contractor", { name: "Managed" })).body.contractor;
    assert.equal((await managed.call("delete_payroll_employee", { employeeId: managedEmployee.id })).body.success, true);
    await data(await removeContractor(req({}, keys.manager), p(managedContractor.id)));
    for (const [route, id] of [[employee, "invalid"], [contractorDetail, "invalid"]] as const) await denied(() => route(req(), p(id)), 400);
    // Unsafe or malformed history cannot be masked by unrelated master edits.
    await db.execute(sql`update payroll_employee set salary=9007199254740992 where id=${e.id}`);
    await denied(() => employees(req()), 422); await denied(() => patchEmployee(req({ name: "Mask" }), p(e.id)), 422); await mdenied("get_payroll_employee", { employeeId: e.id }, ma, 422);
    await db.update(payrollEmployee).set({ salary: 3000000000 }).where(eq(payrollEmployee.id, e.id));
    await db.execute(sql`update contractor set hourly_rate=9007199254740992 where id=${c.id}`);
    await denied(() => contractors(req()), 422); await mdenied("update_contractor", { contractorId: c.id, name: "Mask" }, ma, 422);
    await db.update(contractor).set({ hourlyRate: null, currency: null }).where(eq(contractor.id, c.id));
    assert.equal((await data(await contractorDetail(req(), p(c.id)))).contractor.hourlyRateMinor, null);
    await db.execute(sql`update contractor_payment set amount=9007199254740992 where id=${history.id}`);
    await denied(() => contractorDetail(req(), p(c.id)), 422); await mdenied("get_contractor", { contractorId: c.id }, ma, 422);
    await db.update(contractorPayment).set({ amount: 3000000000 }).where(eq(contractorPayment.id, history.id));
    await db.execute(sql`update payroll_employee set tax_rate=10001 where id=${e.id}`);
    await denied(() => patchEmployee(req({ taxRate: 1000 }), p(e.id)), 422);
    await db.update(payrollEmployee).set({ taxRate: 2029 }).where(eq(payrollEmployee.id, e.id));
    // Post-insert DTO failure must roll back the insert before returning to either adapter.
    await db.execute(sql`create function corrupt_payroll_master() returns trigger language plpgsql as $$ begin new.salary := -1; return new; end $$`);
    await db.execute(sql`create trigger corrupt_payroll_master before insert on payroll_employee for each row execute function corrupt_payroll_master()`);
    await denied(() => createEmployee(req({ ...base, salary: 0 })), 422); await mdenied("create_payroll_employee", { ...base, salaryMinor: "0" }, ma, 422);
    await db.execute(sql`drop trigger corrupt_payroll_master on payroll_employee`); await db.execute(sql`drop function corrupt_payroll_master()`);
    await db.execute(sql`create function fail_payroll_master_audit() returns trigger language plpgsql as $$ begin raise exception 'Synthetic payroll master audit failure'; end $$`);
    await db.execute(sql`create trigger fail_payroll_master_audit before insert on audit_log for each row execute function fail_payroll_master_audit()`);
    for (const fn of [() => createPayrollEmployee(ctx, { ...base, salary: 0 }), () => updatePayrollEmployee(ctx, e.id, { salaryMinor: "29" }), () => deletePayrollEmployee(ctx, e.id),
      () => createPayrollContractor(ctx, { name: "Rollback" }), () => updatePayrollContractor(ctx, c.id, { hourlyRateMinor: "29" }), () => deletePayrollContractor(ctx, c.id)]) {
      const before = await snapshot(); await assert.rejects(fn, (error: unknown) => {
        assert.match(String((error as { cause?: unknown }).cause), /Synthetic payroll master audit failure/); return true;
      }); assert.deepEqual(await snapshot(), before);
    }
    await db.execute(sql`drop trigger fail_payroll_master_audit on audit_log`); await db.execute(sql`drop function fail_payroll_master_audit()`);
    // Competing REST/MCP deletes serialize to one success and one 404, preserving history.
    const race = await Promise.all([removeEmployee(req(), p(e.id)), ma.call("delete_payroll_employee", { employeeId: e.id })]);
    assert.equal((race[0].status === 200 ? 1 : 0) + (!race[1].isError ? 1 : 0), 1);
    assert.ok(race[0].status === 404 || race[1].body.status === 404);
    assert.equal((await db.execute(sql`select count(*)::int as n from audit_log where entity_id=${e.id} and action='delete'`)).rows[0].n, 1);
    await denied(() => patchEmployee(req({ name: "Deleted" }), p(e.id)), 404); await mdenied("get_payroll_employee", { employeeId: e.id }, ma, 404);
    await data(await removeContractor(req(), p(c.id))); await denied(() => patchContractor(req({ hourlyRateMinor: "0" }), p(c.id)), 404);
    await mdenied("delete_contractor", { contractorId: c.id }, ma, 404);
    assert.ok(await db.query.contractorPayment.findFirst({ where: eq(contractorPayment.id, history.id) }));
    assert.equal((await db.query.payrollItem.findFirst({ where: eq(payrollItem.id, item.id) }))!.grossAmount, 1250);
    for (const table of ["journal_entry", "journal_line"]) assert.equal((await db.execute(sql.raw(`select count(*)::int as n from ${table}`))).rows[0].n, 0);
    console.log("Payroll master contracts verified");
  } finally { await Promise.all([ma.close(), mb.close(), ro.close(), managed.close()]); }
}
run().then(() => process.exit(0), error => { console.error(error); process.exit(1); });
