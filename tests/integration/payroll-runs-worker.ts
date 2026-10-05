import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, customRole, payrollEmployee, payrollItem, payrollSettings,
  payrollItemTaxBreakdown, payrollItemDeduction, deductionType, employeeDeduction,
  exchangeRate, timesheet, timesheetEntry, approvalChain, approvalChainStep, approvalRecord, periodLock, fiscalYear, chartAccount, journalEntry, journalLine,
  taxBracket, taxAllowanceConfig, employeeTaxConfig } from "../../lib/db/schema";
import type { AuthContext } from "../../lib/api/auth-context";
import { registerPayrollRunTools } from "../../lib/mcp/tools/payroll-runs";
import { registerAllTools } from "../../lib/mcp/tools";
import { runOperations as definitions } from "./payroll-run-operations";
import { updateOrganizationSettings } from "../../lib/api/organization-settings";
import { updatePayrollEmployee } from "../../lib/api/payroll-master";
import { payrollSum, payrollRatio } from "../../lib/payroll/exact";

type Args = Record<string, unknown>;
async function mcp(ctx: AuthContext, full = false) {
  const server = new McpServer({ name: "Payroll runs", version: "1" });
  if (full) registerAllTools(server, ctx); else registerPayrollRunTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1" }), [ct, st] = InMemoryTransport.createLinkedPair();
  await server.connect(st); await client.connect(ct);
  const tools = (await client.listTools()).tools;
  assert.equal(new Set(tools.map(t => t.name)).size, tools.length);
  if (!full) assert.equal(tools.length, 16);
  for (const d of definitions) {
    const t = tools.find(t => t.name === d.name); assert.ok(t, d.name); assert.equal(t.inputSchema.additionalProperties, false);
    for (const f of Object.values(t.inputSchema.properties ?? {})) assert.ok((f as { description?: string }).description, d.name);
  }
  return { async call(name: string, args: Args = {}) {
    const result = await client.callTool({ name, arguments: args }), text = (result.content as { text: string }[])[0].text;
    return { isError: result.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
  }, async close() { await client.close(); await server.close(); } };
}
async function run() {
  const [a, b] = await db.insert(organization).values([{ name: "Run A", slug: "run-a" }, { name: "Run B", slug: "run-b" }]).returning();
  const [owner, viewer, manager, approver, otherApprover] = await db.insert(users).values(["owner", "viewer", "manager", "approver", "other"].map(n => ({ email: `runs-${n}@example.test` }))).returning();
  const [viewRole, manageRole, approveRole] = await db.insert(customRole).values([{ organizationId: a.id, name: "No access", permissions: [] },
    { organizationId: a.id, name: "Manager", permissions: ["manage:payroll"] }, { organizationId: a.id, name: "Approver", permissions: ["approve:payroll"] }]).returning();
  const members = await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner" }, { organizationId: b.id, userId: owner.id, role: "owner" },
    { organizationId: a.id, userId: viewer.id, customRoleId: viewRole.id }, { organizationId: a.id, userId: manager.id, customRoleId: manageRole.id },
    { organizationId: a.id, userId: approver.id, customRoleId: approveRole.id }, { organizationId: a.id, userId: otherApprover.id, customRoleId: approveRole.id }]).returning();
  const keys = { a: "dk_runs_a", b: "dk_runs_b", viewer: "dk_runs_viewer", manager: "dk_runs_manager", approver: "dk_runs_approver", other: "dk_runs_other", expired: "dk_runs_expired" };
  for (const [label, key] of Object.entries(keys)) await db.insert(apiKey).values({ organizationId: label === "b" ? b.id : a.id,
    createdBy: label === "viewer" ? viewer.id : label === "manager" ? manager.id : label === "approver" ? approver.id : label === "other" ? otherApprover.id : owner.id,
    name: label, keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_runs", expiresAt: label === "expired" ? new Date("2020-01-01") : null });
  const [usd, eur, hourly, term, foreign] = await db.insert(payrollEmployee).values([
    { organizationId: a.id, name: "USD", employeeNumber: "USD", salary: 120000, taxRate: 1000, startDate: "2024-01-01" },
    { organizationId: a.id, name: "EUR", employeeNumber: "EUR", salary: 240000, currency: "EUR", taxRate: 500, startDate: "2024-01-01" },
    { organizationId: a.id, name: "Hourly", employeeNumber: "Hourly", salary: 0, hourlyRate: 29, compensationType: "hourly", payFrequency: "weekly", taxRate: 0, startDate: "2024-01-01" },
    { organizationId: a.id, name: "Leaving", employeeNumber: "Leaving", salary: 36500, taxRate: 0, ptoBalanceHours: 7.5, hourlyRate: 29, isActive: false, startDate: "2024-01-01" },
    { organizationId: b.id, name: "Foreign", employeeNumber: "Foreign", salary: 1250, taxRate: 0, startDate: "2024-01-01" },
  ]).returning();
  const [fx] = await db.insert(exchangeRate).values({ organizationId: a.id, baseCurrency: "EUR", targetCurrency: "USD", date: "2024-01-01", rate: 1500000,
    rateExact: "1.5", rateDirection: "quote_per_base", rateFormatVersion: 1, rateMigrationStatus: "exact", source: "manual" }).returning();
  const [pre, post] = await db.insert(deductionType).values([{ organizationId: a.id, name: "Pension", category: "pre_tax", defaultAmount: 29 },
    { organizationId: a.id, name: "Union dues", category: "post_tax", defaultPercent: 2.5 }]).returning();
  await db.insert(employeeDeduction).values([{ employeeId: usd.id, deductionTypeId: pre.id }, { employeeId: usd.id, deductionTypeId: post.id }]);
  const [sheet] = await db.insert(timesheet).values({ organizationId: a.id, employeeId: hourly.id, periodStart: "2024-01-01", periodEnd: "2024-01-15", status: "approved", totalHours: 140.5 }).returning();
  await db.insert(timesheetEntry).values([{ timesheetId: sheet.id, date: "2024-01-01", hours: 8 }, { timesheetId: sheet.id, date: "2024-01-02", hours: 32.5 }, { timesheetId: sheet.id, date: "2024-01-15", hours: 100 }]);
  const ctx: AuthContext = { organizationId: a.id, userId: owner.id, role: "owner" };
  const ma = await mcp(ctx, true), mb = await mcp({ ...ctx, organizationId: b.id }), ro = await mcp({ ...ctx, userId: viewer.id, permissions: [] }),
    managed = await mcp({ ...ctx, userId: manager.id, permissions: ["manage:payroll"] }), approval = await mcp({ ...ctx, userId: approver.id, permissions: ["approve:payroll"] });
  const restSeen = new Set<string>(), mcpSeen = new Set<string>();
  let highClient: Awaited<ReturnType<typeof mcp>> | undefined;
  const definition = (name: string) => { const d = definitions.find(d => d.name === name); assert.ok(d, name); return d; };
  const rest = async (name: string, args: Args = {}, key = keys.a, raw?: string) => {
    restSeen.add(name); const d = definition(name), body = { ...args }, params: Record<string, unknown> = {};
    for (const k of d.args) { params[k] = args[k]; delete body[k]; }
    const url = new URL("http://fixture.test/api/v1/payroll/" + d.path.replace("[id]", String(args.id)).replace("[bonusId]", String(args.bonusId)));
    if (d.query) for (const [k, v] of Object.entries(body)) url.searchParams.set(k, String(v));
    const req = new Request(url, { method: d.verb, headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-organization-id": b.id },
      body: d.verb === "GET" || d.verb === "DELETE" ? undefined : raw ?? JSON.stringify(body) });
    const route = d.route as unknown as Record<string, (r: Request, p: { params: Promise<Record<string, unknown>> }) => Promise<Response>>;
    return route[d.verb](req, { params: Promise.resolve(params) });
  };
  const data = async (response: Response, status = 200) => { const body = await response.json(); assert.equal(response.status, status, JSON.stringify(body)); return body; };
  const read = async (name: string, args: Args = {}, key = keys.a) => data(await rest(name, args, key), definition(name).verb === "POST" && name.startsWith("create_") ? 201 : 200);
  const margs = (args: Args) => { const { id, ...body } = args; return id === undefined ? body : { payRunId: id, ...body }; };
  const call = async (name: string, args: Args = {}, client = ma) => { mcpSeen.add(name); const r = await client.call(name, margs(args)); assert.equal(r.isError, false, JSON.stringify(r.body)); return r.body; };
  const tables = ["organization", "payroll_employee", "payroll_run", "payroll_item", "payroll_bonus", "payroll_item_tax_breakdown", "payroll_item_employer_tax", "payroll_item_deduction", "employee_deduction", "approval_record", "chart_account", "journal_entry", "journal_line", "number_sequence", "audit_log"];
  const snapshot = () => Promise.all(tables.map(t => db.execute(sql.raw(`select coalesce(jsonb_agg(to_jsonb(t)::text order by t.id),'[]'::jsonb) as rows from ${t} t`)).then(r => r.rows)));
  const denied = async (name: string, args: Args, status: number, key = keys.a, raw?: string) => { const before = await snapshot(); await data(await rest(name, args, key, raw), status); assert.deepEqual(await snapshot(), before, name + " REST rollback"); };
  const mdenied = async (name: string, args: Args, status?: number, client = ma) => { mcpSeen.add(name); const before = await snapshot(), r = await client.call(name, margs(args));
    assert.equal(r.isError, true, name);
    if (status === 400 && r.body.status === undefined) assert.match(r.body.error, /validation|invalid|-32602/i);
    else if (status) assert.equal(r.body.status, status);
    assert.deepEqual(await snapshot(), before, name + " MCP rollback"); };
  const bothDenied = async (name: string, args: Args, status: number) => { await denied(name, args, status); await mdenied(name, args, status); };
  const period = { payPeriodStart: "2024-01-01", payPeriodEnd: "2024-01-07" };
  const count = async (table: string) => Number((await db.execute(sql.raw(`select count(*)::text as n from ${table}`))).rows[0].n);
  const balanced = async (id: string, orgId = a.id, key = keys.a) => {
    const run = (await read("get_payroll_run", { id }, key)).run;
    if (!run.journalEntryId) { assert.equal(run.totalGross, 0); return; }
    const lines = await db.select().from(journalLine).where(eq(journalLine.journalEntryId, run.journalEntryId));
    assert.equal(payrollSum(lines.map(l => l.debitAmount)), payrollSum(lines.map(l => l.creditAmount)));
    assert.ok(lines.every(l => l.rateExact === "1" && l.currencyCode === "USD" && l.debitAmount >= 0 && l.creditAmount >= 0));
    const [entry] = await db.select().from(journalEntry).where(eq(journalEntry.id, run.journalEntryId)); assert.equal(entry.sourceId, id);
    const wages = lines.filter(l => l.description === "Payroll - Gross wages");
    assert.equal(payrollSum(wages.map(l => l.debitAmount - l.creditAmount)), run.totalGross);
    const bank = lines.filter(l => l.description === "Payroll - Net wages paid" || l.description === "Payroll - Net wages accrued");
    assert.equal(payrollSum(bank.map(l => l.creditAmount - l.debitAmount)), run.totalNet);
    const accounts = await db.select().from(chartAccount).where(eq(chartAccount.organizationId, orgId));
    assert.ok(lines.every(l => accounts.some(a => a.id === l.accountId && a.code !== "2200")));
  };
  try {
    const r = (await read("create_payroll_run", period)).run;
    assert.equal(r.status, "draft"); assert.equal(r.totalGross, 41182); assert.equal(r.totalDeductions, 2776); assert.equal(r.totalNet, 38406);
    assert.equal(r.baseCurrency, "USD"); assert.equal(r.totalGrossMinor, "41182");
    const hi = r.items.find((i: Args) => i.employeeId === hourly.id); assert.equal(hi.overtimeHours, 0.5); assert.equal(hi.overtimeAmountMinor, "22");
    const ei = r.items.find((i: Args) => i.employeeId === eur.id); assert.equal(ei.rateExact, "1.5"); assert.equal(ei.currency, "EUR");
    const u = r.items.find((i: Args) => i.employeeId === usd.id); assert.equal(u.deductionBreakdowns.length, 2); assert.equal(u.deductionBreakdowns.find((d: Args) => d.category === "pre_tax").liabilityAccountCode, "2245");
    assert.equal(await count("journal_entry"), 0);
    const rm = (await call("create_payroll_run", { ...period, runType: "off_cycle" }, managed)).run; assert.equal(rm.totalGross, r.totalGross);
    assert.deepEqual(await read("get_payroll_run", { id: r.id }), await call("get_payroll_run", { id: r.id }));
    assert.deepEqual(await read("list_payroll_run_items", { id: r.id }), await call("list_payroll_run_items", { id: r.id }));
    const list = await read("list_payroll_runs"), mlist = await call("list_payroll_runs"); assert.deepEqual(list.data, mlist.runs); assert.deepEqual(list.pagination, mlist.pagination);
    assert.equal(mlist.total, list.pagination.total); assert.equal((await call("list_payroll_runs", { limit: 200 })).limit, 200);
    assert.equal((await read("update_payroll_run", { id: r.id, notes: "Legacy note" })).run.notes, "Legacy note");
    assert.equal((await call("update_payroll_run", { id: rm.id, notes: null })).run.notes, null);
    const lb = (await read("create_payroll_run_bonus", { id: r.id, employeeId: usd.id, bonusType: "performance", amount: 1250 })).bonus;
    assert.equal(lb.amountMinor, "1250"); assert.equal((await read("get_payroll_run", { id: r.id })).run.totalGross, r.totalGross + 1250);
    const eb = (await call("create_payroll_run_bonus", { id: rm.id, employeeId: eur.id, bonusType: "other", amountMinor: "29" })).bonus;
    assert.equal(eb.amount, 29); assert.equal((await read("get_payroll_run", { id: rm.id })).run.totalGross, rm.totalGross + 44);
    assert.deepEqual(await read("list_payroll_run_bonuses", { id: r.id }), await call("list_payroll_run_bonuses", { id: r.id }));
    await read("delete_payroll_run_bonus", { id: r.id, bonusId: lb.id }); await call("delete_payroll_run_bonus", { id: rm.id, bonusId: eb.id });
    assert.equal((await read("get_payroll_run", { id: r.id })).run.totalNet, r.totalNet);
    const fb = (await call("create_payroll_run", period, mb)).run;
    for (const [name, args] of [
      ["get_payroll_run", { id: fb.id }], ["update_payroll_run", { id: fb.id, notes: "intruder" }], ["delete_payroll_run", { id: fb.id }],
      ["process_payroll_run", { id: fb.id }], ["submit_payroll_run_for_approval", { id: fb.id }], ["approve_payroll_run", { id: fb.id }], ["reject_payroll_run", { id: fb.id }],
      ["list_payroll_run_items", { id: fb.id }], ["list_payroll_run_bonuses", { id: fb.id }], ["create_payroll_run_bonus", { id: fb.id, employeeId: usd.id, bonusType: "other", amountMinor: "29" }],
      ["create_payroll_run_bonus", { id: r.id, employeeId: foreign.id, bonusType: "other", amountMinor: "29" }],
      ["create_bonus_payroll_run", { ...period, bonuses: [{ employeeId: foreign.id, bonusType: "other", amountMinor: "29" }] }],
      ["create_termination_payroll_run", { ...period, employeeId: foreign.id }],
      ["create_correction_payroll_run", { parentRunId: fb.id, adjustments: [{ employeeId: foreign.id, grossAdjustmentMinor: "29" }] }],
    ] as [string, Args][]) await bothDenied(name, args, 404);
    await bothDenied("delete_payroll_run_bonus", { id: rm.id, bonusId: lb.id }, 404);
    // Every operation denies invalid/expired keys and missing permissions before financial mutation.
    for (const def of definitions) {
      await denied(def.name, {}, 401, "dk_invalid"); await denied(def.name, {}, 401, keys.expired); await denied(def.name, {}, 403, keys.viewer);
      await mdenied(def.name, def.args.length ? { id: r.id, ...(def.args.includes("bonusId") ? { bonusId: lb.id } : {}) } : def.name === "create_payroll_run" ? period :
        def.name === "create_bonus_payroll_run" ? { ...period, bonuses: [{ employeeId: usd.id, bonusType: "other", amount: 29 }] } :
        def.name === "create_termination_payroll_run" ? { ...period, employeeId: usd.id } : def.name === "create_correction_payroll_run" ? { parentRunId: r.id, adjustments: [{ employeeId: usd.id, grossAdjustment: 29 }] } : {}, undefined, ro);
    }
    await bothDenied("create_payroll_run", { ...period, runType: "termination" }, 400);
    await bothDenied("create_payroll_run", { ...period, payPeriodEnd: "2023-12-31" }, 400);
    await bothDenied("create_payroll_run", { ...period, payPeriodStart: "2023-12-31" }, 400);
    await denied("create_payroll_run", {}, 400, keys.a, "{");
    await bothDenied("create_payroll_run_bonus", { id: r.id, employeeId: usd.id, bonusType: "other", amount: 29, amountMinor: "30" }, 400);
    await bothDenied("create_payroll_run_bonus", { id: r.id, employeeId: usd.id, bonusType: "other", amountMinor: "9007199254740992" }, 422);
    await bothDenied("create_payroll_run_bonus", { id: r.id, employeeId: usd.id, bonusType: "other", amountMinor: "1.0" }, 400);
    await denied("list_payroll_runs", { page: "1x" }, 400); await mdenied("list_payroll_runs", { page: "1x" });
    await denied("process_payroll_run", { id: r.id, amount: 29 }, 400); await mdenied("process_payroll_run", { id: r.id, amount: 29 });
    // Missing FX never inserts runs, items, audits or accounts; exact snapshots survive later rate edits.
    await db.execute(sql.raw("alter table exchange_rate disable trigger exchange_rate_exact_sync"));
    await db.update(exchangeRate).set({ rateMigrationStatus: "quarantined" }).where(eq(exchangeRate.id, fx.id));
    await db.execute(sql.raw("alter table exchange_rate enable trigger exchange_rate_exact_sync"));
    await bothDenied("create_payroll_run", period, 422);
    await db.update(exchangeRate).set({ rateMigrationStatus: "exact", rateExact: "2", rate: 2000000 }).where(eq(exchangeRate.id, fx.id));
    const entriesBefore = await count("journal_entry"), auditsBefore = await count("audit_log");
    const processed = await Promise.all([read("process_payroll_run", { id: r.id }), call("process_payroll_run", { id: r.id })]);
    assert.equal(processed[0].run.journalEntryId, processed[1].run.journalEntryId); assert.equal(await count("journal_entry"), entriesBefore + 1); assert.equal(await count("audit_log"), auditsBefore + 1);
    assert.equal(processed[0].run.items.find((i: Args) => i.employeeId === eur.id).rateExact, "1.5"); await balanced(r.id);
    await bothDenied("delete_payroll_run", { id: r.id }, 409); await bothDenied("update_payroll_run", { id: r.id, notes: "rewrite" }, 409);
    await bothDenied("create_payroll_run_bonus", { id: r.id, employeeId: usd.id, bonusType: "other", amountMinor: "29" }, 409);
    const postedHistory = await db.select().from(payrollItem).where(eq(payrollItem.payrollRunId, r.id));
    const correction = (await read("create_correction_payroll_run", { parentRunId: r.id, adjustments: [{ employeeId: eur.id, grossAdjustmentMinor: "-1000" }] })).run;
    assert.equal(correction.status, "completed"); assert.equal(correction.totalGrossMinor, "-1500"); assert.equal(correction.totalDeductionsMinor, "-75"); assert.equal(correction.totalNetMinor, "-1425"); await balanced(correction.id);
    const c2 = (await call("create_correction_payroll_run", { parentRunId: r.id, adjustments: [{ employeeId: usd.id, grossAdjustment: 1000 }] })).run;
    assert.equal(c2.items[0].preTaxDeductionsMinor, "3"); assert.equal(c2.items[0].postTaxDeductionsMinor, "25"); await balanced(c2.id);
    assert.deepEqual(await db.select().from(payrollItem).where(eq(payrollItem.payrollRunId, r.id)), postedHistory);
    await bothDenied("create_correction_payroll_run", { parentRunId: r.id, adjustments: [{ employeeId: foreign.id, grossAdjustmentMinor: "29" }] }, 404);
    await bothDenied("create_correction_payroll_run", { parentRunId: r.id, adjustments: [{ employeeId: usd.id, grossAdjustmentMinor: "0" }] }, 400);
    await bothDenied("create_correction_payroll_run", { parentRunId: r.id, adjustments: [{ employeeId: usd.id, grossAdjustment: 29 }, { employeeId: usd.id, grossAdjustment: 30 }] }, 400);
    const bonus = (await read("create_bonus_payroll_run", { ...period, bonuses: [{ employeeId: eur.id, bonusType: "other", amount: 1250 }, { employeeId: eur.id, bonusType: "holiday", amountMinor: "29" }] })).run;
    assert.equal(bonus.totalGross, 2558); assert.equal(bonus.status, "completed"); await balanced(bonus.id);
    const bonusM = (await call("create_bonus_payroll_run", { ...period, bonuses: [{ employeeId: usd.id, bonusType: "other", amountMinor: "29" }] })).run; await balanced(bonusM.id);
    // Termination snapshots pay exact daily wages once, pays/clears PTO only upon completion, retries cannot reactivate or pay twice.
    await db.update(payrollEmployee).set({ isActive: true }).where(eq(payrollEmployee.id, term.id));
    const termination = (await read("create_termination_payroll_run", { ...period, employeeId: term.id, includeUnusedPto: true })).run;
    assert.equal(termination.totalGross, 918); assert.equal(termination.terminationPtoHours, 7.5); await balanced(termination.id);
    const [left] = await db.select().from(payrollEmployee).where(eq(payrollEmployee.id, term.id)); assert.equal(left.isActive, false); assert.equal(left.ptoBalanceHours, 0);
    await bothDenied("create_termination_payroll_run", { ...period, employeeId: term.id, includeUnusedPto: true }, 409);
    const [secondTerm] = await db.insert(payrollEmployee).values({ organizationId: a.id, name: "Second leaving", employeeNumber: "Second", salary: 36500, taxRate: 0, startDate: "2024-01-01" }).returning();
    const termM = (await call("create_termination_payroll_run", { ...period, employeeId: secondTerm.id })).run; await balanced(termM.id);
    // Approval chain: manager cannot decide; a permitted but unassigned approver cannot reject.
    const [chain] = await db.insert(approvalChain).values({ organizationId: a.id, name: "Payroll approval" }).returning();
    await db.insert(approvalChainStep).values({ chainId: chain.id, stepOrder: 1, approverId: members[4].id });
    const approvalRun = (await call("create_payroll_run", period, managed)).run;
    await bothDenied("process_payroll_run", { id: approvalRun.id }, 409);
    await read("submit_payroll_run_for_approval", { id: approvalRun.id }, keys.manager);
    await call("submit_payroll_run_for_approval", { id: approvalRun.id }, managed);
    assert.equal((await db.select().from(approvalRecord).where(eq(approvalRecord.payrollRunId, approvalRun.id))).length, 1);
    await denied("approve_payroll_run", { id: approvalRun.id }, 403, keys.manager); await mdenied("approve_payroll_run", { id: approvalRun.id }, 403, managed);
    await denied("reject_payroll_run", { id: approvalRun.id, reason: "Unassigned" }, 409, keys.other);
    await read("reject_payroll_run", { id: approvalRun.id, reason: "Review" }, keys.approver);
    await call("submit_payroll_run_for_approval", { id: approvalRun.id }, managed);
    await call("reject_payroll_run", { id: approvalRun.id, reason: null }, approval);
    await read("submit_payroll_run_for_approval", { id: approvalRun.id }, keys.manager);
    await read("approve_payroll_run", { id: approvalRun.id }, keys.approver);
    await bothDenied("create_payroll_run_bonus", { id: approvalRun.id, employeeId: usd.id, bonusType: "other", amountMinor: "29" }, 409);
    await call("process_payroll_run", { id: approvalRun.id }, managed); await balanced(approvalRun.id);
    const approvalM = (await read("create_payroll_run", period)).run; await read("submit_payroll_run_for_approval", { id: approvalM.id });
    await call("approve_payroll_run", { id: approvalM.id }, approval); await read("process_payroll_run", { id: approvalM.id }); await balanced(approvalM.id);
    const queuedBonus = (await call("create_bonus_payroll_run", { ...period, bonuses: [{ employeeId: usd.id, bonusType: "other", amountMinor: "1250" }] })).run;
    assert.equal(queuedBonus.status, "draft"); assert.equal(queuedBonus.journalEntryId, null);
    const [pendingTermEmp] = await db.insert(payrollEmployee).values({ organizationId: a.id, name: "Approval termination", employeeNumber: "Approval term", salary: 36500, taxRate: 0, ptoBalanceHours: 8, startDate: "2024-01-01" }).returning();
    const pendingTerm = (await call("create_termination_payroll_run", { ...period, employeeId: pendingTermEmp.id, includeUnusedPto: true })).run;
    assert.equal(pendingTerm.status, "draft"); assert.equal((await db.select().from(payrollEmployee).where(eq(payrollEmployee.id, pendingTermEmp.id)))[0].isActive, true);
    await read("submit_payroll_run_for_approval", { id: pendingTerm.id }); await read("approve_payroll_run", { id: pendingTerm.id }, keys.approver);
    await call("process_payroll_run", { id: pendingTerm.id }); assert.equal((await db.select().from(payrollEmployee).where(eq(payrollEmployee.id, pendingTermEmp.id)))[0].ptoBalanceHours, 0);
    await db.update(approvalChain).set({ isActive: false }).where(eq(approvalChain.id, chain.id));
    // Period and fiscal locks guard every posting path; clearing only the synthetic test rows.
    const [lock] = await db.insert(periodLock).values({ organizationId: a.id, lockDate: "2024-01-07" }).returning();
    await bothDenied("process_payroll_run", { id: rm.id }, 422);
    await bothDenied("create_bonus_payroll_run", { ...period, bonuses: [{ employeeId: usd.id, bonusType: "other", amountMinor: "29" }] }, 422);
    await db.delete(periodLock).where(eq(periodLock.id, lock.id));
    const [fy] = await db.insert(fiscalYear).values({ organizationId: a.id, name: "Closed", startDate: "2024-01-01", endDate: "2024-12-31", isClosed: true }).returning();
    await bothDenied("create_correction_payroll_run", { parentRunId: r.id, adjustments: [{ employeeId: usd.id, grossAdjustmentMinor: "29" }] }, 422);
    await db.delete(fiscalYear).where(eq(fiscalYear.id, fy.id));
    // Saved unsafe history and mismatched tax/FX never allow commit.
    await db.execute(sql`update payroll_employee set salary = 9007199254740992 where id = ${usd.id}`); await bothDenied("create_payroll_run", period, 422);
    await db.update(payrollEmployee).set({ salary: 120000 }).where(eq(payrollEmployee.id, usd.id));
    await db.execute(sql.raw("alter table payroll_item disable trigger payroll_item_exact_sync"));
    await db.update(payrollItem).set({ rateMigrationStatus: "quarantined" }).where(and(eq(payrollItem.payrollRunId, rm.id), eq(payrollItem.employeeId, eur.id)));
    await db.execute(sql.raw("alter table payroll_item enable trigger payroll_item_exact_sync"));
    await bothDenied("process_payroll_run", { id: rm.id }, 422);
    await db.execute(sql.raw("alter table payroll_item disable trigger payroll_item_exact_sync"));
    await db.update(payrollItem).set({ rateMigrationStatus: "exact" }).where(and(eq(payrollItem.payrollRunId, rm.id), eq(payrollItem.employeeId, eur.id)));
    await db.execute(sql.raw("alter table payroll_item enable trigger payroll_item_exact_sync"));
    // Both transports and every mutation roll back when atomic audit fails, including posting/termination/deductions.
    const pendingAudit = (await read("create_payroll_run", period)).run;
    const auditBonus = (await read("create_payroll_run_bonus", { id: pendingAudit.id, employeeId: usd.id, bonusType: "other", amountMinor: "29" })).bonus;
    const [auditTermEmp] = await db.insert(payrollEmployee).values({ organizationId: a.id, name: "Rollback termination", employeeNumber: "Rollback term", salary: 36500, taxRate: 0, ptoBalanceHours: 8, startDate: "2024-01-01" }).returning();
    await db.update(approvalChain).set({ isActive: true }).where(eq(approvalChain.id, chain.id));
    const decisionRun = (await read("create_payroll_run", period)).run; await read("submit_payroll_run_for_approval", { id: decisionRun.id });
    const mutations: [string, Args][] = [
      ["create_payroll_run", period], ["update_payroll_run", { id: pendingAudit.id, notes: "Fault" }], ["delete_payroll_run", { id: pendingAudit.id }],
      ["create_payroll_run_bonus", { id: pendingAudit.id, employeeId: usd.id, bonusType: "other", amountMinor: "29" }], ["delete_payroll_run_bonus", { id: pendingAudit.id, bonusId: auditBonus.id }],
      ["submit_payroll_run_for_approval", { id: pendingAudit.id }], ["approve_payroll_run", { id: decisionRun.id }], ["reject_payroll_run", { id: decisionRun.id, reason: "Fault" }],
      ["create_bonus_payroll_run", { ...period, bonuses: [{ employeeId: usd.id, bonusType: "other", amountMinor: "29" }] }],
      ["create_termination_payroll_run", { ...period, employeeId: auditTermEmp.id, includeUnusedPto: true }],
      ["create_correction_payroll_run", { parentRunId: r.id, adjustments: [{ employeeId: usd.id, grossAdjustmentMinor: "29" }] }],
    ];
    await db.execute(sql.raw("create function fail_payroll_audit() returns trigger language plpgsql as $$ begin raise exception 'synthetic audit failure'; end $$"));
    await db.execute(sql.raw("create trigger fail_payroll_audit before insert on audit_log for each row execute function fail_payroll_audit()"));
    const originalError = console.error; console.error = () => {};
    try {
    for (const [name, args] of mutations) {
      await denied(name, args, 500, name === "approve_payroll_run" || name === "reject_payroll_run" ? keys.approver : keys.a);
      await mdenied(name, args, undefined, name === "approve_payroll_run" || name === "reject_payroll_run" ? approval : ma);
    }
    await db.update(approvalChain).set({ isActive: false }).where(eq(approvalChain.id, chain.id));
    await denied("process_payroll_run", { id: pendingAudit.id }, 500); await mdenied("process_payroll_run", { id: pendingAudit.id });
    for (const [name, args] of mutations.filter(([n]) => ["create_bonus_payroll_run", "create_termination_payroll_run", "create_correction_payroll_run"].includes(n))) { await denied(name, args, 500); await mdenied(name, args); }
    } finally { console.error = originalError; }
    await db.execute(sql.raw("drop trigger fail_payroll_audit on audit_log")); await db.execute(sql.raw("drop function fail_payroll_audit()"));
    // One-time assignment reserves one draft, is consumed atomically at processing, deletion releases reservation.
    const [once] = await db.insert(employeeDeduction).values({ employeeId: usd.id, deductionTypeId: pre.id, timing: "one_time", amount: 29 }).returning();
    const [oneA, oneB] = await Promise.all([read("create_payroll_run", period), call("create_payroll_run", period)]);
    const reserved = await db.select().from(payrollItemDeduction).where(eq(payrollItemDeduction.employeeDeductionId, once.id)); assert.equal(reserved.length, 1);
    const [reservedItem] = await db.select().from(payrollItem).where(eq(payrollItem.id, reserved[0].payrollItemId));
    await call("process_payroll_run", { id: reservedItem.payrollRunId }); assert.equal((await db.select().from(employeeDeduction).where(eq(employeeDeduction.id, once.id)))[0].isActive, false);
    await read("delete_payroll_run", { id: reservedItem.payrollRunId === oneA.run.id ? oneB.run.id : oneA.run.id });
    const disposable = (await read("create_payroll_run", period)).run; await call("delete_payroll_run", { id: disposable.id }); await bothDenied("get_payroll_run", { id: disposable.id }, 404);
    // Configuration and master locks serialize currency changes with run creation.
    await assert.rejects(() => updateOrganizationSettings(ctx, { defaultCurrency: "EUR" }), /payroll-run history|transactions exist/);
    await assert.rejects(() => updatePayrollEmployee(ctx, usd.id, { currency: "EUR" }), /pay-item history/);
    // Corrupt nested cross-tenant employee history rejects reads without disclosure.
    const corrupt = (await read("create_payroll_run", period)).run, corruptItem = corrupt.items[0];
    await db.update(payrollItem).set({ employeeId: foreign.id }).where(eq(payrollItem.id, corruptItem.id)); await bothDenied("get_payroll_run", { id: corrupt.id }, 404);
    await db.update(payrollItem).set({ employeeId: corruptItem.employeeId }).where(eq(payrollItem.id, corruptItem.id));
    const corruptTax = corrupt.items.find((i: Args) => i.employeeId === usd.id).taxBreakdowns[0];
    await db.update(payrollItemTaxBreakdown).set({ amount: corruptTax.amount + 1 }).where(eq(payrollItemTaxBreakdown.id, corruptTax.id));
    await bothDenied("get_payroll_run", { id: corrupt.id }, 422); await bothDenied("process_payroll_run", { id: corrupt.id }, 422);
    await db.update(payrollItemTaxBreakdown).set({ amount: corruptTax.amount }).where(eq(payrollItemTaxBreakdown.id, corruptTax.id));
    // Default federal jurisdiction, requested year and specific status are selected as whole schedules.
    await db.insert(payrollSettings).values({ organizationId: a.id, defaultTaxYear: 2024, ssWageBaseCents: 10000, ssRateBp: 500, medicareRateBp: 100,
      addlMedicareRateBp: 0, employerFicaEnabled: true, futaWageBaseCents: 100000, futaRateBp: 60, sutaWageBaseCents: 100000, sutaRateBp: 25 });
    await db.insert(employeeTaxConfig).values({ employeeId: usd.id, federalAllowances: 1, additionalWithholding: 29, filingStatus: "single" });
    await db.insert(taxBracket).values([
      { organizationId: a.id, name: "Default", jurisdictionLevel: "federal", taxYear: 2024, minIncome: 0, rate: 9000 },
      { organizationId: a.id, name: "Single", jurisdictionLevel: "federal", taxYear: 2024, filingStatus: "single", minIncome: 0, rate: 1000 },
      { organizationId: a.id, name: "Other jurisdiction", jurisdictionLevel: "federal", jurisdiction: "OTHER", taxYear: 2024, filingStatus: "single", minIncome: 0, rate: 9000 },
      { organizationId: a.id, name: "Old year", jurisdictionLevel: "federal", taxYear: 2023, filingStatus: "single", minIncome: 0, rate: 9000 },
      { organizationId: b.id, name: "Foreign bracket", jurisdictionLevel: "federal", taxYear: 2024, filingStatus: "single", minIncome: 0, rate: 9000 },
    ]);
    await db.insert(taxAllowanceConfig).values([{ organizationId: a.id, jurisdictionLevel: "federal", taxYear: 2024, allowanceValueCents: 1200, standardDeductionCents: 1200 },
      { organizationId: a.id, jurisdictionLevel: "federal", taxYear: 2023, allowanceValueCents: 9000000, standardDeductionCents: 9000000 },
      { organizationId: a.id, jurisdictionLevel: "federal", jurisdiction: "OTHER", taxYear: 2024, allowanceValueCents: 9000000, standardDeductionCents: 9000000 }]);
    await db.update(exchangeRate).set({ rate: 1200000, rateExact: "1.2" }).where(eq(exchangeRate.id, fx.id));
    const configured = (await read("create_payroll_run", period)).run, configuredUsd = configured.items.find((i: Args) => i.employeeId === usd.id), configuredEur = configured.items.find((i: Args) => i.employeeId === eur.id);
    assert.equal(configuredUsd.taxBreakdowns.find((t: Args) => t.taxKind === "income_tax").amount, 1006);
    assert.equal(configuredUsd.taxBreakdowns.find((t: Args) => t.taxKind === "social_security").amount, 499);
    assert.equal(configuredUsd.taxBreakdowns.find((t: Args) => t.taxKind === "medicare").amount, 100);
    assert.equal(configuredEur.rateExact, "1.2"); assert.equal(configuredEur.fxRate, Math.fround(1.2)); assert.equal(JSON.parse(configuredEur.rateProvenance).format, "payroll_exact_v1");
    const beforeFxFault = await snapshot();
    await assert.rejects(() => db.update(payrollItem).set({ rateExact: "1.3", fxRate: Math.fround(1.3) }).where(eq(payrollItem.id, configuredEur.id)));
    assert.deepEqual(await snapshot(), beforeFxFault);
    await assert.rejects(() => db.update(payrollItem).set({ rateProvenance: null }).where(eq(payrollItem.id, configuredEur.id)));
    await assert.rejects(() => db.update(payrollItem).set({ currency: "USD" }).where(eq(payrollItem.id, configuredEur.id)));
    await call("process_payroll_run", { id: configured.id }); await balanced(configured.id);
    const fractionalBonus = (await call("create_bonus_payroll_run", { ...period, bonuses: [{ employeeId: eur.id, bonusType: "other", amountMinor: "29" }] })).run;
    assert.equal(fractionalBonus.totalGross, 35); await balanced(fractionalBonus.id);
    const fractionalCorrection = (await call("create_correction_payroll_run", { parentRunId: configured.id, adjustments: [{ employeeId: eur.id, grossAdjustmentMinor: "-29" }] })).run;
    assert.equal(fractionalCorrection.totalGross, -35); await balanced(fractionalCorrection.id);
    // The full supported safe boundary succeeds unchanged; sums and outputs beyond it fail atomically.
    const [highOrg] = await db.insert(organization).values({ name: "High cents", slug: "run-high" }).returning();
    await db.insert(member).values({ organizationId: highOrg.id, userId: owner.id, role: "owner" });
    const highKey = "dk_runs_high";
    await db.insert(apiKey).values({ organizationId: highOrg.id, createdBy: owner.id, name: "High", keyHash: createHash("sha256").update(highKey).digest("hex"), keyPrefix: "dk_runs" });
    const [highEmployee] = await db.insert(payrollEmployee).values({ organizationId: highOrg.id, name: "High", employeeNumber: "High", salary: Number.MAX_SAFE_INTEGER, taxRate: 0, startDate: "2024-01-01" }).returning();
    highClient = await mcp({ ...ctx, organizationId: highOrg.id });
    const highSalary = (await call("create_payroll_run", period, highClient)).run; assert.equal(highSalary.totalGross, payrollRatio(Number.MAX_SAFE_INTEGER, 1n, 12n));
    const highBonus = (await read("create_bonus_payroll_run", { ...period, bonuses: [{ employeeId: highEmployee.id, bonusType: "other", amountMinor: "9007199254740991" }] }, highKey)).run;
    assert.equal(highBonus.totalGrossMinor, "9007199254740991"); await balanced(highBonus.id, highOrg.id, highKey);
    for (const transport of [read, (name: string, args: Args) => call(name, args, highClient!)]) {
      const accruedRun: { id: string; totalNet: number } = transport === read ? (await read("create_payroll_run", period, highKey)).run : (await call("create_payroll_run", period, highClient)).run;
      const paid: { run: { journalEntryId: string }; journalEntryId?: string } = transport === read ? await read("process_payroll_run", { id: accruedRun.id, accrued: true }, highKey) : await transport("process_payroll_run", { id: accruedRun.id, accrued: true });
      if (transport !== read) assert.equal(paid.journalEntryId, paid.run.journalEntryId);
      const legs = await db.select({ code: chartAccount.code, amount: journalLine.creditAmount }).from(journalLine).innerJoin(chartAccount, eq(chartAccount.id, journalLine.accountId)).where(eq(journalLine.journalEntryId, paid.run.journalEntryId));
      assert.ok(legs.some(l => l.code === "2310" && l.amount === accruedRun.totalNet)); await balanced(accruedRun.id, highOrg.id, highKey);
      assert.equal((await call("process_payroll_run", { id: accruedRun.id, accrued: false }, highClient)).journalEntryId, paid.run.journalEntryId);
    }
    const overflow = { ...period, bonuses: [{ employeeId: highEmployee.id, bonusType: "other", amountMinor: "9007199254740991" }, { employeeId: highEmployee.id, bonusType: "other", amount: 1 }] };
    await denied("create_bonus_payroll_run", overflow, 422, highKey); await mdenied("create_bonus_payroll_run", overflow, 422, highClient);
    await db.execute(sql.raw("create function corrupt_run_output() returns trigger language plpgsql as $$ begin NEW.total_gross := 9007199254740992; return NEW; end $$"));
    await db.execute(sql.raw("create trigger corrupt_run_output before insert on payroll_run for each row execute function corrupt_run_output()"));
    await bothDenied("create_payroll_run", period, 422);
    await db.execute(sql.raw("drop trigger corrupt_run_output on payroll_run")); await db.execute(sql.raw("drop function corrupt_run_output()"));
    for (const d of definitions) { assert.ok(restSeen.has(d.name), "REST " + d.name); assert.ok(mcpSeen.has(d.name), "MCP " + d.name); }
    console.log("Payroll run contracts verified: 16 operations, REST/MCP, exact math, snapshots, balanced posting, approvals, concurrency and rollback");
  } finally { await Promise.all([ma.close(), mb.close(), ro.close(), managed.close(), approval.close(), highClient?.close()]); }
}
run().then(() => process.exit(0), error => { console.error(error); process.exit(1); });
