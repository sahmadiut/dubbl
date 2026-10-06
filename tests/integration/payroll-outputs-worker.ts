import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, customRole, payrollEmployee, payrollRun, payrollItem, payrollItemTaxBreakdown,
  payrollItemDeduction, deductionType, payslip, taxForm, contractor, contractorPayment } from "../../lib/db/schema";
import type { AuthContext } from "../../lib/api/auth-context";
import { registerAllTools } from "../../lib/mcp/tools";
import { registerPayrollOutputTools } from "../../lib/mcp/tools/payroll-outputs";
import * as summary from "../../app/api/v1/payroll/reports/summary/route";
import * as labor from "../../app/api/v1/payroll/reports/labor-cost/route";
import * as liability from "../../app/api/v1/payroll/reports/tax-liability/route";
import * as yoy from "../../app/api/v1/payroll/reports/yoy/route";
import * as csv from "../../app/api/v1/payroll/reports/export/route";
import * as generateSlips from "../../app/api/v1/payroll/runs/[id]/generate-payslips/route";
import * as runSlips from "../../app/api/v1/payroll/runs/[id]/payslips/route";
import * as slip from "../../app/api/v1/payroll/payslips/[id]/route";
import * as employeeSlips from "../../app/api/v1/payroll/employees/[id]/payslips/route";
import * as profile from "../../app/api/v1/payroll/self-service/profile/route";
import * as selfSlips from "../../app/api/v1/payroll/self-service/payslips/route";
import * as generateForms from "../../app/api/v1/payroll/tax-forms/generate/route";
import * as forms from "../../app/api/v1/payroll/tax-forms/route";
import * as form from "../../app/api/v1/payroll/tax-forms/[id]/route";
import * as pdf from "../../app/api/v1/payroll/tax-forms/[id]/pdf/route";

type Args = Record<string, unknown>;
const operations = [
  ["get_payroll_summary", "GET", summary], ["get_payroll_labor_cost", "GET", labor], ["get_payroll_tax_liability", "GET", liability],
  ["get_payroll_yoy", "GET", yoy], ["export_payroll_csv", "GET", csv], ["generate_payslips", "POST", generateSlips],
  ["list_payslips", "GET", runSlips], ["get_payslip", "GET", slip], ["list_employee_payslips", "GET", employeeSlips],
  ["get_payroll_self_profile", "GET", profile], ["update_payroll_self_profile", "PATCH", profile], ["list_payroll_self_payslips", "GET", selfSlips],
  ["generate_tax_forms", "POST", generateForms], ["list_tax_forms", "GET", forms], ["get_tax_form", "GET", form], ["get_tax_form_pdf_data", "GET", pdf],
] as const;
async function connect(ctx: AuthContext, all = false) {
  const server = new McpServer({ name: "Payroll outputs fixture", version: "1" });
  if (all) registerAllTools(server, ctx); else registerPayrollOutputTools(server, ctx);
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
  const [a, b] = await db.insert(organization).values([{ name: "Output A", slug: "output-a" }, { name: "Output B", slug: "output-b" }]).returning();
  const [owner, viewer, staff] = await db.insert(users).values([{ email: "output-owner@example.test" }, { email: "output-viewer@example.test" }, { email: "output-staff@example.test" }]).returning();
  const [role] = await db.insert(customRole).values({ organizationId: a.id, name: "Denied", permissions: [] }).returning();
  const [ownMem, , , staffMem] = await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner" }, { organizationId: b.id, userId: owner.id, role: "owner" },
    { organizationId: a.id, userId: viewer.id, customRoleId: role.id }, { organizationId: a.id, userId: staff.id, role: "member" }]).returning();
  const keys = { a: "dk_output_a", b: "dk_output_b", viewer: "dk_output_viewer", expired: "dk_output_expired", staff: "dk_output_staff" };
  for (const [label, key] of Object.entries(keys)) await db.insert(apiKey).values({ organizationId: label === "b" ? b.id : a.id,
    createdBy: label === "viewer" ? viewer.id : label === "staff" ? staff.id : owner.id, name: label, keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_output", expiresAt: label === "expired" ? new Date("2020-01-01") : null });
  const [emp, foreign, staffEmp] = await db.insert(payrollEmployee).values([
    { organizationId: a.id, name: 'Doe, "Sam"', employeeNumber: "=formula", startDate: "2023-01-01", salary: 3000000000, memberId: ownMem.id, department: "Team" },
    { organizationId: b.id, name: "Foreign secret", employeeNumber: "F1", startDate: "2023-01-01", salary: 999999 },
    { organizationId: a.id, name: "Staff", employeeNumber: "S1", startDate: "2023-01-01", salary: 29, memberId: staffMem.id },
  ]).returning();
  const ctx: AuthContext = { organizationId: a.id, userId: owner.id, role: "owner" };
  const ma = await connect(ctx, true), mb = await connect({ ...ctx, organizationId: b.id }), ro = await connect({ ...ctx, userId: viewer.id, permissions: [] }), ms = await connect({ ...ctx, userId: staff.id, role: "member" });
  const seen = new Set<string>(), mseen = new Set<string>();
  const rest = async (name: string, args: Args = {}, key: string = keys.a, raw?: string) => {
    seen.add(name); const op = operations.find(o => o[0] === name); assert.ok(op); const [, verb, route] = op;
    const { id, payRunId, employeeId, ...body } = args; const url = new URL("http://fixture.test/api/v1/payroll");
    if (verb === "GET") for (const [k, v] of Object.entries(body)) url.searchParams.set(k, String(v));
    const request = new Request(url, { method: verb, headers: { authorization: `Bearer ${key}`, "x-organization-id": b.id, "content-type": "application/json" }, body: verb === "GET" ? undefined : raw ?? JSON.stringify(body) });
    return (route as unknown as Record<string, (r: Request, p: unknown) => Promise<Response>>)[verb](request, { params: Promise.resolve({ id: id ?? payRunId ?? employeeId }) });
  };
  const data = async (r: Response, status = 200) => { const body = await r.json(); assert.equal(r.status, status, JSON.stringify(body)); return body; };
  const read = async (name: string, args: Args = {}, key: string = keys.a) => data(await rest(name, args, key), name === "generate_tax_forms" ? 201 : 200);
  const call = async (name: string, args: Args = {}, client = ma) => { mseen.add(name); const r = await client.call(name, args); assert.equal(r.isError, false, JSON.stringify(r.body)); return r.body; };
  const snapshot = () => Promise.all(["payslip", "tax_form", "tax_form_generation", "payroll_employee", "audit_log"].map(t => db.execute(sql.raw(`select coalesce(jsonb_agg(to_jsonb(t)::text order by t.id),'[]'::jsonb) as rows from ${t} t`)).then(r => r.rows)));
  const denied = async (name: string, args: Args, status: number, key: string = keys.a, raw?: string) => { const before = await snapshot(); await data(await rest(name, args, key, raw), status); assert.deepEqual(await snapshot(), before, name + " REST mutation"); };
  const mdenied = async (name: string, args: Args, status?: number, client = ma) => {
    const before = await snapshot(); mseen.add(name); const r = await client.call(name, args); assert.equal(r.isError, true, name);
    if (status && r.body.status !== undefined) assert.equal(r.body.status, status, JSON.stringify(r.body));
    assert.deepEqual(await snapshot(), before, name + " MCP mutation");
  };
  const bothDenied = async (name: string, args: Args, status: number) => { await denied(name, args, status); await mdenied(name, args, status); };
  async function seedRun(employeeId: string, org: string, date: string, gross: number, tax = 0, pre = 0, post = 0, deleted = false) {
    const ded = tax + pre + post, net = gross - ded;
    const [run] = await db.insert(payrollRun).values({ organizationId: org, payPeriodStart: date, payPeriodEnd: date, status: "completed", totalGross: gross, totalDeductions: ded, totalNet: net,
      baseCurrency: "USD", deletedAt: deleted ? new Date() : null }).returning();
    const [item] = await db.insert(payrollItem).values({ payrollRunId: run.id, employeeId, grossAmount: gross, taxAmount: tax, deductions: ded, netAmount: net, preTaxDeductions: pre, postTaxDeductions: post }).returning();
    return { run, item };
  }
  await seedRun(emp.id, a.id, "2023-12-31", 999);
  const main = await seedRun(emp.id, a.id, "2024-01-31", 1250, 125, 29, 17), small = await seedRun(emp.id, a.id, "2024-02-29", 29), correction = await seedRun(emp.id, a.id, "2024-03-01", -29);
  await seedRun(emp.id, a.id, "2024-01-01", 5000, 0, 0, 0, true);
  const fs = await seedRun(foreign.id, b.id, "2024-01-31", 1250);
  await db.insert(payrollItemTaxBreakdown).values([
    { payrollItemId: main.item.id, jurisdictionLevel: "federal", taxKind: "income_tax", amount: 100 },
    { payrollItemId: main.item.id, jurisdictionLevel: "federal", taxKind: "social_security", amount: 15 },
    { payrollItemId: main.item.id, jurisdictionLevel: "federal", taxKind: "medicare", amount: 10 },
  ]);
  const [preType, postType] = await db.insert(deductionType).values([{ organizationId: a.id, name: "Benefit", category: "pre_tax" }, { organizationId: a.id, name: "Other", category: "post_tax" }]).returning();
  await db.insert(payrollItemDeduction).values([{ payrollItemId: main.item.id, deductionTypeId: preType.id, category: "pre_tax", amount: 29 }, { payrollItemId: main.item.id, deductionTypeId: postType.id, category: "post_tax", amount: 17 }]);
  const reportArgs = { startDate: "2024-01-01", endDate: "2024-12-31" };
  const sm = await read("get_payroll_summary", reportArgs); assert.equal(sm.summary.totalGrossMinor, "1250"); assert.equal(sm.summary.avgCostPerRun, 417); assert.equal(sm.summary.currency, "USD");
  assert.deepEqual(await call("get_payroll_summary", reportArgs), sm);
  const lc = await read("get_payroll_labor_cost", reportArgs); assert.equal(lc.data[0].totalNetMinor, "1079"); assert.equal(lc.data[0].employeeCount, 1); assert.deepEqual(await call("get_payroll_labor_cost", reportArgs), lc);
  const tl = await read("get_payroll_tax_liability", reportArgs); assert.equal(tl.totalTaxMinor, "125"); assert.deepEqual(await call("get_payroll_tax_liability", reportArgs), tl);
  assert.deepEqual(await call("get_payroll_yoy"), await read("get_payroll_yoy"));
  const csvRes = await rest("export_payroll_csv", reportArgs); assert.equal(csvRes.status, 200); const csvText = await csvRes.text();
  assert.ok(csvText.includes('"Doe, ""Sam""","\'=formula",2024-01-31,2024-01-31,12.50,1.25,1.71,10.79,USD'));
  assert.equal((await call("export_payroll_csv", reportArgs)).csv, csvText);
  assert.equal((await read("generate_payslips", { payRunId: main.run.id })).count, 1);
  assert.equal((await call("generate_payslips", { payRunId: main.run.id })).count, 0);
  const generated = (await read("list_payslips", { payRunId: main.run.id })).payslips[0];
  assert.equal(generated.ytdGrossMinor, "1250"); assert.equal(generated.ytdNetMinor, "1079"); assert.equal(generated.deductionsBreakdown.find((d: Args) => d.category === "pre_tax").amountMinor, "29");
  assert.equal((await call("list_payslips", { payRunId: main.run.id })).payslips[0].employeeName, emp.name);
  assert.equal((await read("get_payslip", { id: generated.id })).payslip.status, "viewed");
  assert.equal((await call("get_payslip", { id: generated.id })).payslip.payrollItem.grossAmountMinor, "1250");
  assert.deepEqual(await call("list_employee_payslips", { employeeId: emp.id }), await read("list_employee_payslips", { employeeId: emp.id }));
  assert.equal((await read("get_payroll_self_profile")).employee.salaryMinor, "3000000000"); await call("get_payroll_self_profile");
  assert.deepEqual(await call("list_payroll_self_payslips"), await read("list_payroll_self_payslips"));
  assert.equal((await read("update_payroll_self_profile", { email: "new@example.test" })).employee.email, "new@example.test");
  assert.equal((await call("update_payroll_self_profile", { bankAccountNumber: "123" })).employee.bankAccountNumber, "123");
  await bothDenied("update_payroll_self_profile", { salaryMinor: "1" }, 400);
  assert.equal((await read("get_payroll_self_profile", {}, keys.staff)).employee.id, staffEmp.id);
  assert.equal((await call("get_payroll_self_profile", {}, ms)).employee.id, staffEmp.id);
  assert.deepEqual((await read("list_payroll_self_payslips", {}, keys.staff)).data, []);
  assert.deepEqual((await call("list_payroll_self_payslips", {}, ms)).data, []);
  // Two concurrent transports generate the single missing snapshot once.
  const race = await Promise.all([read("generate_payslips", { payRunId: small.run.id }), call("generate_payslips", { payRunId: small.run.id })]);
  assert.deepEqual(race.map(r => r.count).sort(), [0, 1]);
  assert.equal((await call("list_payslips", { payRunId: small.run.id })).payslips[0].ytdGrossMinor, "1279");
  const w2 = await read("generate_tax_forms", { taxYear: 2024, formType: "w2" }); assert.equal(w2.formsGenerated, 1);
  await call("generate_tax_forms", { taxYear: 2024, formType: "w2" });
  const batches = await read("list_tax_forms", { taxYear: 2024, formType: "w2" });
  assert.equal(batches.pagination.total, 2); assert.equal(batches.data[0].forms[0].formData.box1_wagesMinor, "1221");
  const formId = batches.data[0].forms[0].id, fd = await read("get_tax_form", { id: formId });
  assert.equal(fd.formData.box2_federal_tax, 100); assert.equal(fd.formData.box4_ss_tax, 15); assert.equal(fd.formData.box6_medicare_tax, 10);
  assert.equal(fd.formData.box12_retirement_deferralsMinor, "29"); assert.equal(fd.formData.box14_otherMinor, "17");
  assert.deepEqual(await call("get_tax_form", { id: formId }), fd);
  assert.deepEqual(await call("list_tax_forms", { taxYear: 2024, formType: "w2" }), batches);
  const pd = await read("get_tax_form_pdf_data", { id: formId }); assert.ok(pd.note.includes("JSON")); assert.deepEqual(await call("get_tax_form_pdf_data", { id: formId }), pd);
  const [c, low, fc] = await db.insert(contractor).values([{ organizationId: a.id, name: "Contractor" }, { organizationId: a.id, name: "Below" }, { organizationId: b.id, name: "Foreign" }]).returning();
  await db.insert(contractorPayment).values([{ contractorId: c.id, amount: 60000, status: "paid", paidAt: new Date("2024-12-31T23:59:59.999Z") },
    { contractorId: low.id, amount: 59999, status: "paid", paidAt: new Date("2024-06-01Z") }, { contractorId: fc.id, amount: 100000, status: "paid", paidAt: new Date("2024-06-01Z") }]);
  // Exact payment date controls adopted backdated payments; legacy timestamps retain UTC year.
  await db.insert(contractorPayment).values({ contractorId: c.id, amount: 29, status: "paid", paymentDate: "2024-06-01", paidAt: new Date("2026-06-01Z") });
  const nec = await call("generate_tax_forms", { taxYear: 2024, formType: "1099_nec" }); assert.equal(nec.formsGenerated, 1);
  const nf = (await read("list_tax_forms", { formType: "1099_nec" })).data[0].forms[0]; assert.equal(nf.formData.box1_nonemployee_compensationMinor, "60029");
  const foreignSlip = (await call("generate_payslips", { payRunId: fs.run.id }, mb), (await call("list_payslips", { payRunId: fs.run.id }, mb)).payslips[0]);
  const foreignGen = await call("generate_tax_forms", { taxYear: 2024, formType: "w2" }, mb);
  const foreignForm = (await call("list_tax_forms", {}, mb)).data.find((g: Args) => g.id === foreignGen.generation.id).forms[0];
  for (const [name] of operations) {
    const args = name === "generate_tax_forms" ? { taxYear: 2024, formType: "w2" } : name === "generate_payslips" || name === "list_payslips" ? { payRunId: main.run.id } : name === "get_payslip" ? { id: generated.id } : name === "list_employee_payslips" ? { employeeId: emp.id } : name === "get_tax_form" || name === "get_tax_form_pdf_data" ? { id: formId } : {};
    await denied(name, args, 403, keys.viewer); await denied(name, args, 401, keys.expired); await denied(name, args, 401, "dk_output_invalid"); await mdenied(name, args, 403, ro);
  }
  for (const name of ["get_tax_form", "get_tax_form_pdf_data"]) await bothDenied(name, { id: foreignForm.id }, 404);
  await bothDenied("get_payslip", { id: foreignSlip.id }, 404); await bothDenied("list_employee_payslips", { employeeId: foreign.id }, 404);
  for (const name of ["generate_payslips", "list_payslips"]) await bothDenied(name, { payRunId: fs.run.id }, 404);
  await bothDenied("generate_tax_forms", { taxYear: 2024, formType: "1099_misc" }, 422);
  await denied("generate_tax_forms", {}, 400, keys.a, "{"); await bothDenied("get_payroll_summary", { startDate: "2024-02-30" }, 400);
  await bothDenied("generate_payslips", { payRunId: main.run.id, amountMinor: "1" }, 400);
  await bothDenied("get_payroll_labor_cost", { startDate: "2025-01-01", endDate: "2024-01-01" }, 400);
  await denied("list_tax_forms", { taxYear: "2024x" }, 400); await mdenied("list_tax_forms", { taxYear: 2100 }, 400);
  // Safe-max individual amounts round-trip; unsupported aggregates fail before writes.
  const huge = await seedRun(emp.id, a.id, "2024-01-31", Number.MAX_SAFE_INTEGER);
  assert.ok((await (await rest("export_payroll_csv")).text()).includes("90071992547409.91"));
  assert.ok((await call("export_payroll_csv")).csv.includes("90071992547409.91"));
  for (const name of ["get_payroll_summary", "get_payroll_labor_cost", "get_payroll_tax_liability", "get_payroll_yoy"]) await bothDenied(name, {}, 422);
  await bothDenied("generate_payslips", { payRunId: huge.run.id }, 422); await bothDenied("generate_tax_forms", { taxYear: 2024, formType: "w2" }, 422);
  await db.delete(payrollRun).where(eq(payrollRun.id, huge.run.id));
  // Numeric JSONB/DB corruption is rejected before a status update or new batch.
  await db.execute(sql`update payslip set ytd_gross=9007199254740992, status='generated' where id=${generated.id}`);
  await bothDenied("get_payslip", { id: generated.id }, 422);
  await db.execute(sql`update payslip set ytd_gross=1250 where id=${generated.id}`);
  const [unsupportedPayment] = await db.insert(contractorPayment).values({ contractorId: c.id, amount: 1, currency: "EUR", status: "paid", paymentDate: "2024-06-01", paidAt: new Date() }).returning();
  await bothDenied("generate_tax_forms", { taxYear: 2024, formType: "1099_nec" }, 422);
  await db.delete(contractorPayment).where(eq(contractorPayment.id, unsupportedPayment.id));
  const saved = await db.select().from(taxForm).where(eq(taxForm.id, formId));
  await db.update(taxForm).set({ formData: { box1_wages: 9007199254740992 } }).where(eq(taxForm.id, formId));
  for (const name of ["get_tax_form", "get_tax_form_pdf_data"]) await bothDenied(name, { id: formId }, 422);
  await db.update(taxForm).set({ formData: saved[0].formData, recipientId: foreign.id }).where(eq(taxForm.id, formId));
  await bothDenied("get_tax_form", { id: formId }, 404); await db.update(taxForm).set({ recipientId: emp.id }).where(eq(taxForm.id, formId));
  await db.update(payslip).set({ employeeId: foreign.id, status: "generated" }).where(eq(payslip.id, generated.id));
  await bothDenied("get_payslip", { id: generated.id }, 404); await db.update(payslip).set({ employeeId: emp.id }).where(eq(payslip.id, generated.id));
  await db.update(payslip).set({ deductionsBreakdown: [{ name: "Bad", category: "pre_tax", amount: 9007199254740992 }] }).where(eq(payslip.id, generated.id));
  await bothDenied("get_payslip", { id: generated.id }, 422); await db.update(payslip).set({ deductionsBreakdown: generated.deductionsBreakdown }).where(eq(payslip.id, generated.id));
  await db.update(payrollEmployee).set({ memberId: staffMem.id }).where(eq(payrollEmployee.id, emp.id));
  await denied("get_payroll_self_profile", {}, 422, keys.staff); await mdenied("get_payroll_self_profile", {}, 422, ms);
  await db.update(payrollEmployee).set({ memberId: ownMem.id }).where(eq(payrollEmployee.id, emp.id));
  // Same amount in another currency may export separately, but cannot be added to a single total.
  await db.execute(sql`update payroll_item set currency='EUR' where id=${small.item.id}`);
  await bothDenied("get_payroll_tax_liability", reportArgs, 422); await bothDenied("generate_tax_forms", { taxYear: 2024, formType: "w2" }, 422);
  await db.execute(sql`update payroll_item set currency='USD' where id=${small.item.id}`);
  await db.update(payrollRun).set({ baseCurrency: "EUR" }).where(eq(payrollRun.id, small.run.id));
  await bothDenied("get_payroll_summary", reportArgs, 422); await bothDenied("get_payroll_yoy", {}, 422);
  await db.update(payrollRun).set({ baseCurrency: "USD" }).where(eq(payrollRun.id, small.run.id));
  // Invalid linked memberships cannot create an unreadable new payslip.
  const [foreignMember] = await db.select().from(member).where(eq(member.organizationId, b.id));
  await db.update(payrollEmployee).set({ memberId: foreignMember.id }).where(eq(payrollEmployee.id, emp.id));
  await bothDenied("generate_payslips", { payRunId: correction.run.id }, 422);
  await db.update(payrollEmployee).set({ memberId: ownMem.id }).where(eq(payrollEmployee.id, emp.id));
  // A database audit failure rolls back generation, viewing and profile updates.
  await db.execute(sql.raw("create function reject_output_audit() returns trigger language plpgsql as $$ begin if NEW.entity_type in ('payrollRun','payslip','taxFormGeneration','payrollEmployee') then raise exception 'fixture audit fault'; end if; return NEW; end $$"));
  await db.execute(sql.raw("create trigger reject_output_audit before insert on audit_log for each row execute function reject_output_audit()"));
  await bothDenied("generate_tax_forms", { taxYear: 2024, formType: "w2" }, 500);
  await bothDenied("generate_payslips", { payRunId: correction.run.id }, 500);
  await bothDenied("get_payslip", { id: generated.id }, 500);
  await bothDenied("update_payroll_self_profile", { email: "rollback@example.test" }, 500);
  await db.execute(sql.raw("drop trigger reject_output_audit on audit_log"));
  // Saved snapshots survive current base/employee currency changes without rescaling.
  await db.update(organization).set({ defaultCurrency: "EUR" }).where(eq(organization.id, a.id));
  await db.update(payrollEmployee).set({ currency: "EUR" }).where(eq(payrollEmployee.id, emp.id));
  assert.equal((await read("get_payslip", { id: generated.id })).payslip.currency, "USD"); assert.equal((await read("get_tax_form", { id: formId })).currency, "USD");
  assert.deepEqual([...seen].sort(), operations.map(o => o[0]).sort()); assert.deepEqual([...mseen].sort(), operations.map(o => o[0]).sort());
  await ma.close(); await mb.close(); await ro.close(); await ms.close();
  console.log("Payroll output contracts verified: all 16 REST/MCP pairs, saved cents/currency/YTD/tax detail, scopes, safe ranges, rollback and concurrent retry");
}
run().then(() => process.exit(0), e => { console.error(e); process.exit(1); });
