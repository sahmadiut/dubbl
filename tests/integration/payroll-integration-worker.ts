import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, customRole, exchangeRate, journalLine, payrollItem } from "../../lib/db/schema";
import type { AuthContext } from "../../lib/api/auth-context";
import { registerAllTools } from "../../lib/mcp/tools";

type Args = Record<string, unknown>;
type Handler = (request: Request, context: { params: Promise<Args> }) => Promise<Response>;
// Invoke real handlers, including their authentication, decoding and error envelopes.
const routes = {
  employees: await import("../../app/api/v1/payroll/employees/route"),
  employee: await import("../../app/api/v1/payroll/employees/[id]/route"),
  contractors: await import("../../app/api/v1/payroll/contractors/route"),
  contractor: await import("../../app/api/v1/payroll/contractors/[id]/route"),
  payments: await import("../../app/api/v1/payroll/contractors/[id]/payments/route"),
  payment: await import("../../app/api/v1/payroll/contractors/[id]/payments/[paymentId]/route"),
  processPayment: await import("../../app/api/v1/payroll/contractors/[id]/payments/[paymentId]/process/route"),
  settings: await import("../../app/api/v1/payroll/settings/route"),
  deductionTypes: await import("../../app/api/v1/payroll/deductions/types/route"),
  deductions: await import("../../app/api/v1/payroll/employees/[id]/deductions/route"),
  timesheets: await import("../../app/api/v1/payroll/timesheets/route"),
  entries: await import("../../app/api/v1/payroll/timesheets/[id]/entries/route"),
  submit: await import("../../app/api/v1/payroll/timesheets/[id]/submit/route"),
  approve: await import("../../app/api/v1/payroll/timesheets/[id]/approve/route"),
  runs: await import("../../app/api/v1/payroll/runs/route"),
  run: await import("../../app/api/v1/payroll/runs/[id]/route"),
  process: await import("../../app/api/v1/payroll/runs/[id]/process/route"),
  generate: await import("../../app/api/v1/payroll/runs/[id]/generate-payslips/route"),
  slips: await import("../../app/api/v1/payroll/runs/[id]/payslips/route"),
  summary: await import("../../app/api/v1/payroll/reports/summary/route"),
  labor: await import("../../app/api/v1/payroll/reports/labor-cost/route"),
  liability: await import("../../app/api/v1/payroll/reports/tax-liability/route"),
  reviews: await import("../../app/api/v1/payroll/compensation/reviews/route"),
  reviewEntries: await import("../../app/api/v1/payroll/compensation/reviews/[id]/entries/route"),
  projection: await import("../../app/api/v1/payroll/forecasting/projection/route"),
  whatIf: await import("../../app/api/v1/payroll/forecasting/what-if/route"),
  budget: await import("../../app/api/v1/payroll/forecasting/budget-vs-actual/route"),
  selfProfile: await import("../../app/api/v1/payroll/self-service/profile/route"),
  selfSlips: await import("../../app/api/v1/payroll/self-service/payslips/route"),
} as const;

async function connect(ctx: AuthContext) {
  const server = new McpServer({ name: "Integrated payroll", version: "1" });
  registerAllTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1" });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  await server.connect(st); await client.connect(ct);
  const tools = (await client.listTools()).tools;
  assert.equal(new Set(tools.map(t => t.name)).size, tools.length);
  return { tools, async raw(name: string, args: Args = {}) {
    const result = await client.callTool({ name, arguments: args });
    const text = (result.content as { text: string }[])[0].text;
    return { error: result.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
  }, async close() { await client.close(); await server.close(); } };
}

async function run() {
  const [a, b] = await db.insert(organization).values([
    { name: "Integrated A", slug: "payroll-integrated-a" }, { name: "Integrated B", slug: "payroll-integrated-b" },
  ]).returning();
  const [owner, viewer] = await db.insert(users).values([
    { email: "payroll-integrated-owner@example.test" }, { email: "payroll-integrated-viewer@example.test" },
  ]).returning();
  const [role] = await db.insert(customRole).values({ organizationId: a.id, name: "No permissions", permissions: [] }).returning();
  const members = await db.insert(member).values([
    { organizationId: a.id, userId: owner.id, role: "owner" }, { organizationId: b.id, userId: owner.id, role: "owner" },
    { organizationId: a.id, userId: viewer.id, customRoleId: role.id },
  ]).returning();
  const keys = { a: "dk_integrated_payroll_a", b: "dk_integrated_payroll_b", viewer: "dk_integrated_payroll_viewer" };
  for (const [label, key] of Object.entries(keys)) await db.insert(apiKey).values({
    organizationId: label === "b" ? b.id : a.id, createdBy: label === "viewer" ? viewer.id : owner.id,
    name: label, keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_integrated",
  });
  const ctx: AuthContext = { organizationId: a.id, userId: owner.id, role: "owner" };
  const ma = await connect(ctx), mb = await connect({ ...ctx, organizationId: b.id });
  const ro = await connect({ ...ctx, userId: viewer.id, permissions: [] });
  const restSeen = new Set<string>(), mcpSeen = new Set<string>();
  const rest = async (route: keyof typeof routes, verb: string, body: Args = {}, params: Args = {}, key: string = keys.a) => {
    restSeen.add(route);
    const url = new URL("http://fixture.test/api/v1/payroll");
    if (verb === "GET") for (const [k, v] of Object.entries(body)) url.searchParams.set(k, String(v));
    const request = new Request(url, { method: verb,
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-organization-id": b.id },
      body: ["GET", "DELETE"].includes(verb) ? undefined : JSON.stringify(body) });
    const response = await (routes[route] as unknown as Record<string, Handler>)[verb](request, { params: Promise.resolve(params) });
    return { status: response.status, body: await response.json() };
  };
  const read = async (route: keyof typeof routes, verb: string, body: Args = {}, params: Args = {}, status = 200) => {
    const result = await rest(route, verb, body, params); assert.equal(result.status, status, JSON.stringify(result.body)); return result.body;
  };
  const call = async (name: string, args: Args = {}, client = ma) => {
    mcpSeen.add(name); const result = await client.raw(name, args); assert.equal(result.error, false, JSON.stringify(result.body)); return result.body;
  };
  const tables = ["payroll_employee", "contractor", "contractor_payment", "payroll_settings", "deduction_type", "employee_deduction",
    "timesheet", "timesheet_entry", "payroll_run", "payroll_item", "payroll_item_tax_breakdown", "payroll_item_employer_tax",
    "payroll_item_deduction", "compensation_review", "compensation_review_entry", "payslip", "chart_account", "journal_entry", "journal_line", "number_sequence", "audit_log"];
  const snapshot = () => Promise.all(tables.map(t => db.execute(sql.raw(`select coalesce(jsonb_agg(to_jsonb(t)::text order by t.id),'[]'::jsonb) as rows from ${t} t`)).then(r => r.rows)));
  const denied = async (route: keyof typeof routes, verb: string, body: Args, params: Args, tool: string, args: Args, status: number, foreign = false) => {
    const before = await snapshot();
    const r = await rest(route, verb, body, params, foreign ? keys.b : keys.a); assert.equal(r.status, status, JSON.stringify(r.body));
    const m = await (foreign ? mb : ma).raw(tool, args); assert.equal(m.error, true, tool);
    if (status !== 400) assert.equal(m.body.status, status, JSON.stringify(m.body));
    assert.deepEqual(await snapshot(), before, tool + " must leave all tracked tables unchanged");
  };
  const history = async () => (await db.execute(sql`select to_jsonb(t) as row from payroll_item t order by id`)).rows;
  const savedFinancials = () => Promise.all(["journal_entry", "journal_line", "payslip", "payroll_item_tax_breakdown", "payroll_item_employer_tax", "payroll_item_deduction"]
    .map(t => db.execute(sql.raw(`select to_jsonb(t) as row from ${t} t order by id`)).then(r => r.rows)));
  try {
    // REST legacy master + MCP exact master feed configuration and approved time.
    const salary = (await read("employees", "POST", { name: "Salary", employeeNumber: "S", salary: 120000, taxRate: 1000, startDate: "2024-01-01", memberId: members[0].id }, {}, 201)).employee;
    const hourly = (await call("create_payroll_employee", { name: "Hourly", employeeNumber: "H", salaryMinor: "0", hourlyRateMinor: "29", compensationType: "hourly", taxRate: 0, startDate: "2024-01-01" })).employee;
    assert.equal(salary.salaryMinor, "120000"); assert.equal(hourly.hourlyRate, 29);
    await read("settings", "PUT", { defaultTaxRate: 0, ssRateBp: 0, medicareRateBp: 0, addlMedicareRateBp: 0, employerFicaEnabled: false, futaRateBp: 0, sutaRateBp: 0 });
    assert.deepEqual((await call("get_payroll_settings")).settings, (await read("settings", "GET")).settings);
    const type = (await call("create_payroll_deduction_type", { name: "Pension", category: "pre_tax", defaultAmountMinor: "29" })).deductionType;
    const deduction = (await read("deductions", "POST", { deductionTypeId: type.id }, { id: salary.id }, 201)).deduction;
    assert.equal(deduction.deductionTypeId, type.id);
    const sheet = (await call("create_payroll_timesheet", { employeeId: hourly.id, periodStart: "2024-01-01", periodEnd: "2024-01-31" })).timesheet;
    await read("entries", "POST", { date: "2024-01-02", hours: 7.5 }, { id: sheet.id }, 201);
    await call("submit_payroll_timesheet", { id: sheet.id }); await read("approve", "POST", {}, { id: sheet.id });
    const period = { payPeriodStart: "2024-01-01", payPeriodEnd: "2024-01-31" };
    const draft = (await read("runs", "POST", period, {}, 201)).run;
    assert.deepEqual((await call("get_payroll_run", { payRunId: draft.id })).run, (await read("run", "GET", {}, { id: draft.id })).run);
    const s = draft.items.find((i: Args) => i.employeeId === salary.id), h = draft.items.find((i: Args) => i.employeeId === hourly.id);
    assert.equal(s.grossAmountMinor, "10000"); assert.equal(s.preTaxDeductionsMinor, "29"); assert.equal(s.taxAmountMinor, "997"); assert.equal(s.netAmountMinor, "8974");
    assert.equal(h.grossAmountMinor, "218"); assert.equal(h.timesheetId, sheet.id);
    assert.equal(draft.totalGrossMinor, "10218"); assert.equal(draft.totalNetMinor, "9192");
    const [processed, retried] = await Promise.all([
      read("process", "POST", {}, { id: draft.id }), call("process_payroll_run", { payRunId: draft.id }),
    ]);
    assert.equal(processed.run.journalEntryId, retried.run.journalEntryId);
    const lines = await db.select().from(journalLine).where(eq(journalLine.journalEntryId, processed.run.journalEntryId));
    assert.equal(lines.reduce((sum, l) => sum + BigInt(l.debitAmount), 0n), 10218n);
    assert.equal(lines.reduce((sum, l) => sum + BigInt(l.creditAmount), 0n), 10218n);
    const postedHistory = await history();
    await call("generate_payslips", { payRunId: draft.id });
    assert.equal((await read("generate", "POST", {}, { id: draft.id })).count, 0);
    const slips = (await read("slips", "GET", {}, { id: draft.id })).payslips;
    assert.deepEqual((await call("list_payslips", { payRunId: draft.id })).payslips, slips);
    assert.equal(slips.length, 2);
    assert.deepEqual((await call("get_payroll_summary")).summary, (await read("summary", "GET")).summary);
    assert.equal((await call("get_payroll_summary")).summary.totalGrossMinor, "10218");
    assert.deepEqual(await call("get_payroll_self_profile"), await read("selfProfile", "GET"));
    assert.deepEqual(await call("list_payroll_self_payslips"), await read("selfSlips", "GET"));
    assert.equal((await call("list_payroll_self_payslips")).data.length, 1);
    assert.deepEqual(await call("project_payroll_costs", { months: 2 }), await read("projection", "GET", { months: 2 }));
    assert.deepEqual(await call("forecast_payroll_what_if", { months: 2, salaryAdjustmentPercent: 2.5 }), await read("whatIf", "POST", { months: 2, salaryAdjustmentPercent: 2.5 }));
    assert.deepEqual(await call("get_payroll_budget_vs_actual", { year: 2024 }), await read("budget", "GET", { year: 2024 }));
    for (const [route, tool] of [["labor", "get_payroll_labor_cost"], ["liability", "get_payroll_tax_liability"]] as const)
      assert.deepEqual(await call(tool), await read(route, "GET"));
    assert.match((await call("export_payroll_csv")).csv, /102\.18|100\.00/);

    // Future master/config edits and compensation proposals retain financial snapshots.
    const postedFinancials = await savedFinancials();
    await call("update_payroll_employee", { employeeId: salary.id, salaryMinor: "240000" });
    await read("employee", "PATCH", { hourlyRateMinor: "58" }, { id: hourly.id });
    await call("update_payroll_deduction_type", { id: type.id, defaultAmountMinor: "58" });
    const review = (await read("reviews", "POST", { name: "Future", effectiveDate: "2024-02-01", totalBudgetMinor: "10000" }, {}, 201)).review;
    await call("create_compensation_entry", { id: review.id, employeeId: salary.id, currentSalaryMinor: "240000", proposedSalaryMinor: "252000", adjustmentPercent: 5 });
    assert.deepEqual((await call("list_compensation_entries", { id: review.id })).data, (await read("reviewEntries", "GET", {}, { id: review.id })).data);
    assert.deepEqual(await history(), postedHistory);
    assert.deepEqual(await savedFinancials(), postedFinancials);
    assert.deepEqual((await call("list_payslips", { payRunId: draft.id })).payslips.map((p: Args) => p.grossAmountMinor), slips.map((p: Args) => p.grossAmountMinor));
    assert.equal((await call("get_payroll_summary")).summary.totalGrossMinor, "10218");

    // Classified failures across domains preserve the whole integration snapshot.
    await denied("employee", "PATCH", { currency: "EUR" }, { id: salary.id }, "update_payroll_employee", { employeeId: salary.id, currency: "EUR" }, 409);
    await denied("settings", "PUT", { defaultCurrency: "EUR" }, {}, "update_payroll_settings", { defaultCurrency: "EUR" }, 409);
    await denied("employees", "POST", { name: "Unsafe", employeeNumber: "U", salaryMinor: "9007199254740992", startDate: "2024-01-01" }, {}, "create_payroll_employee", { name: "Unsafe", employeeNumber: "U", salaryMinor: "9007199254740992", startDate: "2024-01-01" }, 422);
    await denied("employee", "PATCH", { salary: 1250, salaryMinor: "1251" }, { id: salary.id }, "update_payroll_employee", { employeeId: salary.id, salary: 1250, salaryMinor: "1251" }, 400);
    await denied("employee", "PATCH", { salaryMinor: "1", organizationId: b.id }, { id: salary.id }, "update_payroll_employee", { employeeId: salary.id, salaryMinor: "1", organizationId: b.id }, 400);
    await denied("run", "GET", {}, { id: draft.id }, "get_payroll_run", { payRunId: draft.id }, 404, true);
    await denied("slips", "GET", {}, { id: draft.id }, "list_payslips", { payRunId: draft.id }, 404, true);
    await denied("deductions", "POST", { deductionTypeId: type.id }, { id: salary.id }, "create_payroll_employee_deduction", { employeeId: salary.id, deductionTypeId: type.id }, 404, true);
    const beforePermission = await snapshot();
    assert.equal((await rest("process", "POST", {}, { id: draft.id }, keys.viewer)).status, 403);
    assert.equal((await ro.raw("process_payroll_run", { payRunId: draft.id })).body.status, 403);
    assert.deepEqual(await snapshot(), beforePermission);

    // Contractor master feeds real FX payment posting, never a rescaled master rate.
    const [fx] = await db.insert(exchangeRate).values({ organizationId: a.id, baseCurrency: "EUR", targetCurrency: "USD", date: "2024-01-01", rate: 1200000,
      rateExact: "1.2", rateFormatVersion: 1, rateDirection: "quote_per_base", rateMigrationStatus: "exact", source: "manual" }).returning();
    const contractor = (await call("create_contractor", { name: "Foreign contractor", currency: "EUR", hourlyRateMinor: "1250" })).contractor;
    const payment = (await read("payments", "POST", { amount: 1250 }, { id: contractor.id }, 201)).payment;
    const paid = (await call("process_contractor_payment", { contractorId: contractor.id, paymentId: payment.id, paymentDate: "2024-01-31" })).payment;
    assert.equal(paid.amountMinor, "1250"); assert.equal(paid.baseAmountMinor, "1500"); assert.equal(paid.rateExact, "1.2");
    await db.update(exchangeRate).set({ rate: 1500000, rateExact: "1.5" }).where(eq(exchangeRate.id, fx.id));
    assert.deepEqual((await read("processPayment", "POST", {}, { id: contractor.id, paymentId: payment.id })).payment, paid);
    await read("contractor", "PATCH", { hourlyRateMinor: "2500" }, { id: contractor.id });
    assert.equal((await call("get_contractor", { contractorId: contractor.id })).contractor.payments[0].amountMinor, "1250");
    await denied("contractor", "PATCH", { currency: "USD" }, { id: contractor.id }, "update_contractor", { contractorId: contractor.id, currency: "USD" }, 409);
    await denied("payment", "PATCH", { amount: 1 }, { id: contractor.id, paymentId: payment.id }, "update_contractor_payment", { contractorId: contractor.id, paymentId: payment.id, amount: 1 }, 409);

    // Start concurrent cross-writer calls in a fresh tenant with no item/payment history.
    await db.insert(exchangeRate).values({ organizationId: b.id, baseCurrency: "EUR", targetCurrency: "USD", date: "2024-01-01", rate: 1200000,
      rateExact: "1.2", rateFormatVersion: 1, rateDirection: "quote_per_base", rateMigrationStatus: "exact", source: "manual" });
    const raceEmp = (await call("create_payroll_employee", { name: "Race", employeeNumber: "R", salaryMinor: "120000", taxRate: 0, startDate: "2024-01-01" }, mb)).employee;
    // Prove the lock order without relying on which concurrent request wins.
    // While the organization is locked, master writers must not acquire an
    // employee lock and then block on their audit's organization foreign key.
    for (const verb of ["PATCH", "DELETE"]) {
      const target = verb === "PATCH" ? raceEmp : (await call("create_payroll_employee", {
        name: "Delete race", employeeNumber: "D", salaryMinor: "0", startDate: "2024-01-01",
      }, mb)).employee;
      let pending: ReturnType<typeof rest> | undefined;
      try {
        await db.transaction(async tx => {
          await tx.execute(sql`select id from organization where id=${b.id} for update`);
          pending = rest("employee", verb, verb === "PATCH" ? { name: "Race updated" } : {}, { id: target.id }, keys.b);
          const deadline = Date.now() + 10000;
          while (true) {
            const blocked = await tx.execute(sql`select 1 from pg_stat_activity a where pg_backend_pid() = any(pg_blocking_pids(a.pid))`);
            if (blocked.rows.length) break;
            assert.ok(Date.now() < deadline, "Master writer must reach the held organization lock");
            await new Promise(resolve => setTimeout(resolve, 10));
          }
          await tx.execute(sql`select id from payroll_employee where id=${target.id} for update nowait`);
        });
      } finally {
        if (pending) { const result = await pending; assert.equal(result.status, 200, JSON.stringify(result.body)); }
      }
    }
    const [changed, created] = await Promise.all([
      mb.raw("update_payroll_employee", { employeeId: raceEmp.id, currency: "EUR" }),
      rest("runs", "POST", period, {}, keys.b),
    ]);
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const savedEmp = (await call("get_payroll_employee", { employeeId: raceEmp.id }, mb)).employee;
    const raceItem = created.body.run.items[0];
    assert.equal(raceItem.currency, savedEmp.currency); assert.equal(raceItem.grossAmountMinor, "10000");
    if (changed.error) assert.equal(changed.body.status, 409); else assert.equal(savedEmp.currency, "EUR");
    const raceContractor = (await call("create_contractor", { name: "Race contractor", currency: "USD" }, mb)).contractor;
    const [cchanged, ccreated] = await Promise.all([
      mb.raw("update_contractor", { contractorId: raceContractor.id, currency: "EUR" }),
      rest("payments", "POST", { amountMinor: "1250" }, { id: raceContractor.id }, keys.b),
    ]);
    assert.equal(ccreated.status, 201, JSON.stringify(ccreated.body));
    const savedContractor = (await call("get_contractor", { contractorId: raceContractor.id }, mb)).contractor;
    assert.equal(ccreated.body.payment.currency, savedContractor.currency); assert.equal(ccreated.body.payment.amountMinor, "1250");
    if (cchanged.error) assert.equal(cchanged.body.status, 409); else assert.equal(savedContractor.currency, "EUR");
    assert.equal((await db.select().from(payrollItem).where(eq(payrollItem.payrollRunId, draft.id))).length, 2);
    for (const name of mcpSeen) {
      const tool = ma.tools.find(t => t.name === name); assert.ok(tool); assert.equal(tool.inputSchema.additionalProperties, false, name);
      for (const field of Object.values(tool.inputSchema.properties ?? {})) assert.ok((field as { description?: string }).description, name);
    }
    assert.ok(restSeen.size >= 20); assert.ok(mcpSeen.size >= 25);
    console.log("Integrated payroll contracts verified");
  } finally { await Promise.all([ma.close(), mb.close(), ro.close()]); }
}
run().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
