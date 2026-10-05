import { and, asc, desc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { payrollRun, payrollItem, payrollEmployee, payrollBonus, payrollSettings, payrollItemTaxBreakdown,
  payrollItemEmployerTax, payrollItemDeduction, employeeDeduction, deductionType, timesheet,
  organization, member, approvalChain, approvalRecord, project, projectMilestone } from "@/lib/db/schema";
import { AuthError, type AuthContext } from "./auth-context";
import { requireRole } from "./require-role";
import { lockTaxOrganization, auditTax, type TaxTx } from "./tax-config-transaction";
import { payrollMasterDto } from "./payroll-master-wire";
import { payrollConfigDto, payrollSettingsUpdateSchema, employeeDeductionCreateSchema, deductionTypeCreateSchema } from "./payroll-config-wire";
import { orderedDates, timeFromUnits } from "./payroll-time-wire";
import { runId, runCreateSchema, bonusCreateSchema, bonusRunSchema, terminationRunSchema, correctionRunSchema,
  runListSchema, runUpdateSchema, runRejectSchema, runProcessSchema, runAmount, runMoneyDto, runMoneyFields, runItemDto } from "./payroll-run-wire";
import { payrollInteger, payrollSum, payrollRatio, payrollPercent, payrollReal, PAYROLL_REAL_SCALE, payrollConvert } from "@/lib/payroll/exact";
import { legacyMinor, stringifyWire, WireCompatibilityError } from "@/lib/money/wire";
import { allocateMoney, money } from "@/lib/money/exact";
import { currencyCodeSchema } from "@/lib/currency/zod";
import { assertFunctionalCurrencyEnabled } from "@/lib/currency/rollout";
import { createHistoricalRateResolver } from "@/lib/currency/historical-rate";
import { MissingExchangeRateError } from "@/lib/currency/converter";
import { computeEmployeeWithholding, getEmployeeYtdWage, type TaxBreakdownLine, type EmployerTaxLine } from "./payroll-withholding";
import { payPeriodsPerYear } from "./payroll-tax";
import { postPayrollRun, classifyPayrollDeduction } from "./payroll-posting";
import { assertNotLocked } from "./period-lock";
import { paginatedResponse } from "./pagination";

type Run = typeof payrollRun.$inferSelect;
type Item = typeof payrollItem.$inferSelect;
type Employee = typeof payrollEmployee.$inferSelect;
type Settings = typeof payrollSettings.$inferSelect | undefined;
type Deduction = Omit<typeof payrollItemDeduction.$inferInsert, "payrollItemId">;
type BuiltItem = { columns: Omit<typeof payrollItem.$inferInsert, "payrollRunId">; taxes: TaxBreakdownLine[]; employer: EmployerTaxLine[]; deductions: Deduction[] };
async function mapSeries<T, R>(rows: T[], fn: (row: T) => Promise<R>) {
  const result: R[] = []; for (const row of rows) result.push(await fn(row)); return result;
}
const scope = (ctx: AuthContext, id?: string) => and(eq(payrollRun.organizationId, ctx.organizationId), isNull(payrollRun.deletedAt), id ? eq(payrollRun.id, id) : undefined);
const employeeScope = (ctx: AuthContext, id?: string) => and(eq(payrollEmployee.organizationId, ctx.organizationId), id ? eq(payrollEmployee.id, id) : undefined);
async function mutate<T>(ctx: AuthContext, fn: (tx: TaxTx) => Promise<T>) {
  return db.transaction(async tx => { await lockTaxOrganization(tx, ctx.organizationId); return fn(tx); });
}
async function baseCurrency(tx: TaxTx, ctx: AuthContext) {
  const [org] = await tx.select({ currency: organization.defaultCurrency }).from(organization).where(and(eq(organization.id, ctx.organizationId), isNull(organization.deletedAt)));
  if (!org) throw new AuthError("Organization not found", 404);
  return currencyCodeSchema.parse(org.currency);
}
async function settings(tx: TaxTx, ctx: AuthContext) {
  const [row] = await tx.select().from(payrollSettings).where(eq(payrollSettings.organizationId, ctx.organizationId));
  if (row) payrollConfigDto(row, payrollSettingsUpdateSchema, ["ssWageBaseCents", "addlMedicareThresholdCents", "futaWageBaseCents", "sutaWageBaseCents"]);
  return row;
}
async function employee(tx: TaxTx, ctx: AuthContext, id: string, active = true) {
  runId.parse(id);
  const [row] = await tx.select().from(payrollEmployee).where(and(employeeScope(ctx, id), active ? isNull(payrollEmployee.deletedAt) : undefined)).for("update");
  if (!row) throw new AuthError("Employee not found", 404);
  payrollMasterDto(row);
  if (active && !row.isActive) throw new AuthError("Active employee required", 409);
  return row;
}
function headerDto(row: Run) {
  try {
    runCreateSchema.shape.payPeriodStart.parse(row.payPeriodStart); runCreateSchema.shape.payPeriodEnd.parse(row.payPeriodEnd);
    orderedDates(row.payPeriodStart, row.payPeriodEnd);
    runListSchema.shape.status.unwrap().parse(row.status);
    if (row.baseCurrency !== null) currencyCodeSchema.parse(row.baseCurrency);
    if (row.terminationPtoHours !== null) payrollReal(row.terminationPtoHours);
    if (payrollInteger(row.totalGross) - payrollInteger(row.totalDeductions) !== payrollInteger(row.totalNet))
      throw new Error("Run totals do not reconcile");
    return runMoneyDto(row, runMoneyFields);
  } catch (error) { if (error instanceof WireCompatibilityError) throw error; throw new WireCompatibilityError("Unsupported saved payroll run totals or dates"); }
}
async function ownedRun(tx: TaxTx, ctx: AuthContext, id: string, lock = false) {
  runId.parse(id); const query = tx.select().from(payrollRun).where(scope(ctx, id));
  const [row] = await (lock ? query.for("update") : query);
  if (!row) throw new AuthError("Payroll run not found", 404); headerDto(row); return row;
}
async function readItems(tx: TaxTx, ctx: AuthContext, id: string) {
  const rows = await tx.query.payrollItem.findMany({ where: eq(payrollItem.payrollRunId, id), orderBy: asc(payrollItem.id),
    with: { taxBreakdowns: true, employerTaxBreakdowns: true } });
  return mapSeries(rows, async row => {
    const [emp] = await tx.select().from(payrollEmployee).where(employeeScope(ctx, row.employeeId));
    if (!emp) throw new AuthError("Payroll employee not found in organization", 404);
    // These joins must never leak cross-tenant historical references.
    if (row.projectId) {
      const [p] = await tx.select({ id: project.id }).from(project).where(and(eq(project.id, row.projectId), eq(project.organizationId, ctx.organizationId)));
      if (!p) throw new AuthError("Payroll project not found in organization", 404);
    }
    if (row.milestoneId) {
      const [m] = await tx.select({ id: projectMilestone.id }).from(projectMilestone).innerJoin(project, eq(projectMilestone.projectId, project.id))
        .where(and(eq(projectMilestone.id, row.milestoneId), eq(project.organizationId, ctx.organizationId), row.projectId ? eq(project.id, row.projectId) : undefined));
      if (!m) throw new AuthError("Payroll milestone not found in organization", 404);
    }
    if (row.timesheetId) {
      const [t] = await tx.select({ id: timesheet.id }).from(timesheet).where(and(eq(timesheet.id, row.timesheetId), eq(timesheet.employeeId, row.employeeId), eq(timesheet.organizationId, ctx.organizationId)));
      if (!t) throw new AuthError("Payroll timesheet not found in organization", 404);
    }
    const deductions = await tx.select().from(payrollItemDeduction).where(eq(payrollItemDeduction.payrollItemId, row.id)).orderBy(payrollItemDeduction.id);
    for (const d of deductions) {
      const [type] = await tx.select({ id: deductionType.id }).from(deductionType).where(and(eq(deductionType.id, d.deductionTypeId), eq(deductionType.organizationId, ctx.organizationId)));
      if (!type) throw new AuthError("Payroll deduction type not found in organization", 404);
      if (d.employeeDeductionId) {
        const [assignment] = await tx.select({ id: employeeDeduction.id }).from(employeeDeduction).where(and(eq(employeeDeduction.id, d.employeeDeductionId), eq(employeeDeduction.employeeId, row.employeeId), eq(employeeDeduction.deductionTypeId, d.deductionTypeId)));
        if (!assignment) throw new AuthError("Payroll deduction assignment mismatch", 404);
      }
    }
    const result = { ...runItemDto(row), employee: payrollMasterDto(emp),
      taxBreakdowns: row.taxBreakdowns.map(t => runMoneyDto(t, ["amount"])),
      employerTaxBreakdowns: row.employerTaxBreakdowns.map(t => runMoneyDto(t, ["amount"])),
      deductionBreakdowns: deductions.map(d => runMoneyDto(d, ["amount"])) };
    if (row.taxBreakdowns.length && payrollSum(row.taxBreakdowns.map(t => t.amount)) !== row.taxAmount)
      throw new WireCompatibilityError("Payroll tax breakdown differs from item withholding");
    if (payrollInteger(row.grossAmount) - payrollInteger(row.deductions) !== payrollInteger(row.netAmount))
      throw new WireCompatibilityError("Payroll item amounts do not reconcile");
    stringifyWire(result); return result;
  });
}
async function readRun(tx: TaxTx, ctx: AuthContext, row: Run) {
  return { ...headerDto(row), items: await readItems(tx, ctx, row.id) };
}
function draft(row: Run) {
  if (row.status !== "draft" || row.journalEntryId || row.approvalStatus === "approved")
    throw new AuthError("Only unapproved draft payroll runs can be edited; posted history requires a correction", 409);
}
function period(start: string, end: string) {
  orderedDates(start, end);
  if (start.slice(0, 4) !== end.slice(0, 4)) throw new AuthError("Split payroll periods by Gregorian year", 400);
}
async function snapshot(tx: TaxTx, ctx: AuthContext, currency: string, base: string, date: string) {
  const quote = await createHistoricalRateResolver(ctx.organizationId, tx)(currency, base, date);
  if (!quote) throw new MissingExchangeRateError(currency, base, date);
  const fxRate = Math.fround(Number(quote.rateExact));
  if (!Number.isFinite(fxRate) || fxRate <= 0) throw new WireCompatibilityError("FX cannot coexist with legacy payroll real field");
  return { currency, fxRate, rateExact: quote.rateExact, rateFormatVersion: 1, rateDirection: "quote_per_base", rateMigrationStatus: "exact",
    rateProvenance: JSON.stringify({ format: "payroll_exact_v1", baseCurrency: currency, quoteCurrency: base, asOf: date, effectiveDate: quote.effectiveDate, source: quote.source, inverse: quote.inverse, provider: quote.provider }) };
}
function totals(items: { grossAmount: number; deductions: number; netAmount: number; rateExact: string }[]) {
  const totalGross = payrollSum(items.map(i => payrollConvert(i.grossAmount, i.rateExact)));
  const totalDeductions = payrollSum(items.map(i => payrollConvert(i.deductions, i.rateExact)));
  // One explicit residual policy: run net is gross minus converted deductions, not independently rounded.
  const totalNet = payrollSum([totalGross, -totalDeductions]);
  return { totalGross, totalDeductions, totalNet };
}
async function refreshTotals(tx: TaxTx, ctx: AuthContext, id: string) {
  const items = await readItems(tx, ctx, id), values = totals(items);
  const [row] = await tx.update(payrollRun).set(values).where(scope(ctx, id)).returning(); headerDto(row); return row;
}
async function insertItems(tx: TaxTx, id: string, items: BuiltItem[]) {
  for (const item of items) {
    const [row] = await tx.insert(payrollItem).values({ ...item.columns, payrollRunId: id }).returning();
    runItemDto(row);
    if (item.taxes.length) await tx.insert(payrollItemTaxBreakdown).values(item.taxes.map(t => ({ ...t, payrollItemId: row.id })));
    if (item.employer.length) await tx.insert(payrollItemEmployerTax).values(item.employer.map(t => ({ ...t, payrollItemId: row.id })));
    if (item.deductions.length) await tx.insert(payrollItemDeduction).values(item.deductions.map(d => ({ ...d, payrollItemId: row.id })));
  }
}
async function makeWageItem(tx: TaxTx, ctx: AuthContext, emp: Employee, cfg: Settings, base: string, start: string, end: string): Promise<BuiltItem | null> {
  if (emp.compensationType === "milestone" || emp.compensationType === "commission") return null;
  let gross = 0, overtimeAmount: number | null = null, overtimeHours: number | null = null, linkedTimesheet: string | null = null;
  let type: Item["type"] = "regular_salary", description: string | null = null;
  if (emp.compensationType === "salary") gross = payrollRatio(emp.salary, 1n, BigInt(payPeriodsPerYear(emp.payFrequency)));
  else {
    if (emp.hourlyRate === null || emp.hourlyRate === 0) return null;
    const sheets = await tx.query.timesheet.findMany({ where: and(eq(timesheet.organizationId, ctx.organizationId), eq(timesheet.employeeId, emp.id), eq(timesheet.status, "approved"), isNull(timesheet.deletedAt),
      lte(timesheet.periodStart, end), gte(timesheet.periodEnd, start)), with: { entries: true }, orderBy: asc(timesheet.id) });
    let hours = 0n;
    if (sheets.length) {
      for (const sheet of sheets) for (const entry of sheet.entries) {
        runCreateSchema.shape.payPeriodStart.parse(entry.date);
        if (entry.date < sheet.periodStart || entry.date > sheet.periodEnd) throw new WireCompatibilityError("Saved entry lies outside its timesheet");
        if (entry.date >= start && entry.date <= end) hours += payrollReal(entry.hours);
      }
      linkedTimesheet = sheets[0].id;
    } else hours = payrollReal(emp.payFrequency === "weekly" ? 40 : emp.payFrequency === "biweekly" ? 80 : 173);
    const threshold = payrollReal(cfg?.overtimeThresholdHours ?? 40), regular = hours < threshold ? hours : threshold;
    const overtime = hours - regular, multiplier = payrollReal(cfg?.overtimeMultiplier ?? 1.5);
    const regularAmount = payrollRatio(emp.hourlyRate, regular, PAYROLL_REAL_SCALE);
    overtimeAmount = payrollRatio(emp.hourlyRate, overtime * multiplier, PAYROLL_REAL_SCALE ** 2n);
    overtimeHours = timeFromUnits(overtime);
    gross = payrollSum([regularAmount, overtimeAmount]); type = "hourly_pay";
    description = `${timeFromUnits(hours)} hours including ${overtimeHours} overtime hours`;
  }
  const assignments = await tx.query.employeeDeduction.findMany({ where: and(eq(employeeDeduction.employeeId, emp.id), eq(employeeDeduction.isActive, true), isNull(employeeDeduction.deletedAt)), with: { deductionType: true }, orderBy: asc(employeeDeduction.id) });
  const deductions: Deduction[] = [];
  for (const a of assignments) {
    payrollConfigDto(a, employeeDeductionCreateSchema, ["amount"]);
    const t = a.deductionType;
    if (!t || t.organizationId !== ctx.organizationId) throw new AuthError("Deduction type not found in organization", 404);
    payrollConfigDto(t, deductionTypeCreateSchema, ["defaultAmount"]);
    if (!t.isActive || t.deletedAt || (a.startDate && a.startDate > end) || (a.endDate && a.endDate < start)) continue;
    // A reserved one-time deduction cannot be silently copied into multiple live drafts.
    if (a.timing === "one_time") {
      const [used] = await tx.select({ id: payrollItemDeduction.id }).from(payrollItemDeduction)
        .innerJoin(payrollItem, eq(payrollItemDeduction.payrollItemId, payrollItem.id)).innerJoin(payrollRun, eq(payrollItem.payrollRunId, payrollRun.id))
        .where(and(eq(payrollItemDeduction.employeeDeductionId, a.id), isNull(payrollRun.deletedAt), inArray(payrollRun.status, ["draft", "pending_approval", "processing", "completed"]))).limit(1);
      if (used) continue;
    }
    const amount = a.amount ?? (a.percent === null ? t.defaultAmount ?? (t.defaultPercent === null ? 0 : payrollPercent(gross, t.defaultPercent)) : payrollPercent(gross, a.percent));
    if (amount > 0) deductions.push({ deductionTypeId: t.id, employeeDeductionId: a.id, category: t.category, amount, liabilityAccountCode: classifyPayrollDeduction(t.name, t.category) });
  }
  const pre = payrollSum(deductions.filter(d => d.category === "pre_tax").map(d => d.amount!)), post = payrollSum(deductions.filter(d => d.category === "post_tax").map(d => d.amount!));
  if (payrollInteger(pre) + payrollInteger(post) > payrollInteger(gross)) throw new AuthError("Employee deductions exceed gross wages", 422);
  const withholding = await computeEmployeeWithholding(ctx.organizationId, emp, cfg, payrollSum([gross, -pre]), await getEmployeeYtdWage(ctx.organizationId, emp.id, start, tx), start, tx);
  const totalDeductions = payrollSum([withholding.totalTax, pre, post]), net = payrollSum([gross, -totalDeductions]);
  if (net < 0) throw new AuthError("Employee withholding and deductions exceed gross wages", 422);
  return { columns: { employeeId: emp.id, type, description, grossAmount: gross, taxAmount: withholding.totalTax, deductions: totalDeductions, netAmount: net,
    preTaxDeductions: pre, postTaxDeductions: post, overtimeAmount, overtimeHours, timesheetId: linkedTimesheet,
    ...await snapshot(tx, ctx, emp.currency ?? cfg?.defaultCurrency ?? base, base, end) }, taxes: withholding.breakdown, employer: withholding.employerBreakdown, deductions };
}
async function persist(tx: TaxTx, ctx: AuthContext, values: Omit<typeof payrollRun.$inferInsert, "organizationId">, items: BuiltItem[]) {
  if (!items.length) throw new AuthError("No payable employees found for this period", 400);
  const [row] = await tx.insert(payrollRun).values({ ...values, organizationId: ctx.organizationId }).returning();
  await insertItems(tx, row.id, items); return refreshTotals(tx, ctx, row.id);
}
async function finishCreate(tx: TaxTx, ctx: AuthContext, row: Run, action: string, autoPost: boolean, request?: Request) {
  if (autoPost) {
    const chains = await activeChains(tx, ctx);
    if (!chains.length) row = await complete(tx, ctx, row);
  }
  const result = await readRun(tx, ctx, row);
  await auditTax(tx, ctx.organizationId, "payroll_run", row.id, action, result, ctx, request); return result;
}
export async function listPayrollRuns(ctx: AuthContext, input: unknown) {
  requireRole(ctx, "manage:payroll"); const p = runListSchema.parse(input);
  return db.transaction(async tx => {
    const where = and(scope(ctx), p.status ? eq(payrollRun.status, p.status) : undefined);
    const rows = await tx.select().from(payrollRun).where(where).orderBy(desc(payrollRun.createdAt), asc(payrollRun.id)).limit(p.limit).offset((p.page - 1) * p.limit);
    const [count] = await tx.select({ count: sql<string>`count(*)::text` }).from(payrollRun).where(where);
    return paginatedResponse(await mapSeries(rows, row => readRun(tx, ctx, row)), legacyMinor(BigInt(count.count)), p.page, p.limit);
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
export async function getPayrollRun(ctx: AuthContext, id: string) {
  requireRole(ctx, "manage:payroll"); return db.transaction(async tx => readRun(tx, ctx, await ownedRun(tx, ctx, id)), { isolationLevel: "repeatable read", accessMode: "read only" });
}
export async function listPayrollRunItems(ctx: AuthContext, id: string) {
  const run = await getPayrollRun(ctx, id);
  return run.items.map(i => ({ ...i, employeeName: i.employee.name, employeeTaxBreakdown: i.taxBreakdowns, employerTaxBreakdown: i.employerTaxBreakdowns }));
}
export async function createPayrollRun(ctx: AuthContext, input: unknown, request?: Request) {
  requireRole(ctx, "manage:payroll"); const p = runCreateSchema.parse(input); period(p.payPeriodStart, p.payPeriodEnd);
  return mutate(ctx, async tx => {
    const base = await baseCurrency(tx, ctx); assertFunctionalCurrencyEnabled(base);
    const cfg = await settings(tx, ctx);
    const employees = await tx.select().from(payrollEmployee).where(and(employeeScope(ctx), eq(payrollEmployee.isActive, true), isNull(payrollEmployee.deletedAt))).orderBy(payrollEmployee.id).for("update");
    const items: BuiltItem[] = [];
    for (const emp of employees) { payrollMasterDto(emp); const item = await makeWageItem(tx, ctx, emp, cfg, base, p.payPeriodStart, p.payPeriodEnd); if (item) items.push(item); }
    const row = await persist(tx, ctx, { ...p, runType: p.runType ?? "regular", baseCurrency: base }, items);
    return finishCreate(tx, ctx, row, "create_payroll_run", false, request);
  });
}
export async function updatePayrollRun(ctx: AuthContext, id: string, input: unknown, request?: Request) {
  requireRole(ctx, "manage:payroll"); runId.parse(id); const p = runUpdateSchema.parse(input);
  return mutate(ctx, async tx => { const before = await ownedRun(tx, ctx, id, true); draft(before); await readRun(tx, ctx, before);
    const [row] = await tx.update(payrollRun).set({ notes: p.notes === undefined ? before.notes : p.notes }).where(scope(ctx, id)).returning();
    const result = await readRun(tx, ctx, row); await auditTax(tx, ctx.organizationId, "payroll_run", id, "update", result, ctx, request); return result; });
}
export async function deletePayrollRun(ctx: AuthContext, id: string, request?: Request) {
  requireRole(ctx, "manage:payroll"); runId.parse(id);
  return mutate(ctx, async tx => { const row = await ownedRun(tx, ctx, id, true); draft(row); const before = await readRun(tx, ctx, row);
    await tx.delete(payrollBonus).where(eq(payrollBonus.payrollRunId, id)); await tx.delete(approvalRecord).where(eq(approvalRecord.payrollRunId, id));
    await tx.delete(payrollItem).where(eq(payrollItem.payrollRunId, id)); await tx.update(payrollRun).set({ deletedAt: new Date() }).where(scope(ctx, id));
    await auditTax(tx, ctx.organizationId, "payroll_run", id, "delete", before, ctx, request); return { success: true }; });
}
async function activeChains(tx: TaxTx, ctx: AuthContext) {
  return tx.query.approvalChain.findMany({ where: and(eq(approvalChain.organizationId, ctx.organizationId), eq(approvalChain.isActive, true), isNull(approvalChain.deletedAt)), with: { steps: true }, orderBy: asc(approvalChain.id) });
}
async function complete(tx: TaxTx, ctx: AuthContext, row: Run, opts: { accrued?: boolean } = {}) {
  const items = await readItems(tx, ctx, row.id);
  const base = await baseCurrency(tx, ctx); assertFunctionalCurrencyEnabled(base);
  if (row.baseCurrency !== null && row.baseCurrency !== base) throw new AuthError("Run base currency differs from organization; recreate the draft", 422);
  await assertNotLocked(ctx.organizationId, row.payPeriodEnd, ctx);
  const employeeIds = [...new Set(items.map(i => i.employeeId))].sort();
  for (const id of employeeIds) await employee(tx, ctx, id, false);
  const expected = totals(items);
  for (const f of runMoneyFields) if (row[f] !== expected[f]) throw new WireCompatibilityError("Stored payroll totals differ from exact item totals; recreate the draft");
  for (const item of items) for (const deduction of item.deductionBreakdowns) {
    if (!deduction.employeeDeductionId) continue;
    const [assignment] = await tx.select().from(employeeDeduction).where(eq(employeeDeduction.id, deduction.employeeDeductionId)).for("update");
    if (assignment.timing === "one_time") {
      if (!assignment.isActive || assignment.deletedAt) throw new AuthError("One-time deduction is no longer available", 409);
      await tx.update(employeeDeduction).set({ isActive: false }).where(eq(employeeDeduction.id, assignment.id));
    }
  }
  if (row.runType === "termination") {
    if (!row.terminationEmployeeId) throw new WireCompatibilityError("Legacy termination intent is unavailable; use a new termination run");
    if (employeeIds.length !== 1 || employeeIds[0] !== row.terminationEmployeeId) throw new WireCompatibilityError("Termination employee does not match pay items");
    const emp = await employee(tx, ctx, row.terminationEmployeeId);
    const remaining = payrollReal(emp.ptoBalanceHours) - payrollReal(row.terminationPtoHours ?? 0);
    if (remaining < 0n) throw new AuthError("PTO balance changed; recreate termination run", 409);
    await tx.update(payrollEmployee).set({ isActive: false, terminationDate: row.payPeriodEnd, terminationReason: row.notes ?? "Termination",
      ptoBalanceHours: timeFromUnits(remaining), updatedAt: new Date() }).where(employeeScope(ctx, emp.id));
  }
  const journalEntryId = await postPayrollRun(ctx, row.id, tx, opts);
  const [completed] = await tx.update(payrollRun).set({ status: "completed", journalEntryId, processedAt: new Date() }).where(scope(ctx, row.id)).returning();
  return completed;
}
export async function processPayrollRun(ctx: AuthContext, id: string, input: unknown = {}, request?: Request) {
  requireRole(ctx, "manage:payroll"); runId.parse(id); const opts = runProcessSchema.parse(input);
  return mutate(ctx, async tx => {
    const row = await ownedRun(tx, ctx, id, true);
    if (row.status === "completed") return readRun(tx, ctx, row);
    if (row.status !== "draft" && !(row.status === "pending_approval" && row.approvalStatus === "approved")) throw new AuthError("Only draft or approved payroll runs can be processed", 409);
    if ((await activeChains(tx, ctx)).length && row.approvalStatus !== "approved") throw new AuthError("This run requires approval before processing", 409);
    const result = await readRun(tx, ctx, await complete(tx, ctx, row, opts));
    await auditTax(tx, ctx.organizationId, "payroll_run", id, "process_payroll_run", result, ctx, request); return result;
  });
}
async function ownMember(tx: TaxTx, ctx: AuthContext) {
  const [row] = await tx.select({ id: member.id }).from(member).where(and(eq(member.organizationId, ctx.organizationId), eq(member.userId, ctx.userId))).for("share");
  if (!row) throw new AuthError("Member not found", 404); return row.id;
}
export async function submitPayrollRun(ctx: AuthContext, id: string, request?: Request) {
  requireRole(ctx, "manage:payroll"); runId.parse(id);
  return mutate(ctx, async tx => {
    const row = await ownedRun(tx, ctx, id, true); const before = await readRun(tx, ctx, row);
    if (row.status === "pending_approval" && row.approvalStatus === "pending") return before;
    draft(row); const chains = await activeChains(tx, ctx);
    if (chains.length !== 1 || !chains[0].steps.length) throw new AuthError("Configure exactly one active, nonempty approval chain", 409);
    const steps = chains[0].steps.sort((a, b) => a.stepOrder - b.stepOrder);
    for (const step of steps) {
      const [m] = await tx.select({ id: member.id }).from(member).where(and(eq(member.id, step.approverId), eq(member.organizationId, ctx.organizationId))).for("share");
      if (!m) throw new AuthError("Approval chain contains a foreign or missing member", 404);
    }
    // Rejection is the only editable approval round. Replace its decisions when resubmitting.
    await tx.delete(approvalRecord).where(eq(approvalRecord.payrollRunId, id));
    await tx.insert(approvalRecord).values(steps.map(s => ({ payrollRunId: id, stepId: s.id, approverId: s.approverId, status: "pending" as const })));
    const [updated] = await tx.update(payrollRun).set({ status: "pending_approval", approvalStatus: "pending", approvedAt: null, approvedBy: null }).where(scope(ctx, id)).returning();
    const result = await readRun(tx, ctx, updated); await auditTax(tx, ctx.organizationId, "payroll_run", id, "submit_for_approval", result, ctx, request); return result;
  });
}
async function decide(ctx: AuthContext, id: string, reject: boolean, input: unknown, request?: Request) {
  requireRole(ctx, "approve:payroll"); runId.parse(id); const p = runRejectSchema.parse(input);
  return mutate(ctx, async tx => {
    const row = await ownedRun(tx, ctx, id, true); await readRun(tx, ctx, row); const actor = await ownMember(tx, ctx);
    const records = await tx.select().from(approvalRecord).where(and(eq(approvalRecord.payrollRunId, id), eq(approvalRecord.approverId, actor)));
    const pending = records.filter(r => r.status === "pending");
    if (!pending.length || row.status !== "pending_approval") throw new AuthError("No pending approval found for your account", 409);
    await tx.update(approvalRecord).set({ status: reject ? "rejected" : "approved", comment: reject ? p.reason ?? null : null, decidedAt: new Date() })
      .where(and(eq(approvalRecord.payrollRunId, id), eq(approvalRecord.approverId, actor), eq(approvalRecord.status, "pending")));
    const [left] = await tx.select({ id: approvalRecord.id }).from(approvalRecord).where(and(eq(approvalRecord.payrollRunId, id), eq(approvalRecord.status, "pending"))).limit(1);
    let updated = row;
    if (reject || !left) [updated] = await tx.update(payrollRun).set(reject ? { status: "draft", approvalStatus: "rejected" } : { status: "draft", approvalStatus: "approved", approvedBy: actor, approvedAt: new Date() }).where(scope(ctx, id)).returning();
    const result = await readRun(tx, ctx, updated); await auditTax(tx, ctx.organizationId, "payroll_run", id, reject ? "reject" : "approve", result, ctx, request); return result;
  });
}
export const approvePayrollRun = (ctx: AuthContext, id: string, request?: Request) => decide(ctx, id, false, {}, request);
export const rejectPayrollRun = (ctx: AuthContext, id: string, input: unknown, request?: Request) => decide(ctx, id, true, input, request);

/** Split total employee tax first, then its components into those exact capacities. */
function distributeTaxes(lines: TaxBreakdownLine[], capacity: number[], currency: string) {
  const total = payrollSum(lines.map(l => l.amount));
  const targets = total === 0 ? capacity.map(() => 0) : allocateMoney(money(BigInt(total), currency), capacity.map(payrollInteger)).map(v => legacyMinor(v.amountMinor));
  const remaining = targets.map(payrollInteger), result: TaxBreakdownLine[][] = capacity.map(() => []);
  for (const line of lines) {
    if (line.amount === 0) continue;
    const pieces = allocateMoney(money(payrollInteger(line.amount), currency), remaining);
    for (let i = 0; i < pieces.length; i++) {
      const amount = legacyMinor(pieces[i].amountMinor); remaining[i] -= pieces[i].amountMinor;
      if (amount) result[i].push({ ...line, amount });
    }
  }
  return { targets, result };
}
async function bonusItems(tx: TaxTx, ctx: AuthContext, emp: Employee, cfg: Settings, base: string, start: string, end: string,
  bonuses: { amount: number; description?: string | null }[]): Promise<BuiltItem[]> {
  const gross = payrollSum(bonuses.map(b => b.amount));
  const withholding = await computeEmployeeWithholding(ctx.organizationId, emp, cfg, gross, await getEmployeeYtdWage(ctx.organizationId, emp.id, start, tx), start, tx);
  if (withholding.totalTax > gross) throw new AuthError("Bonus withholding exceeds gross wages", 422);
  const split = distributeTaxes(withholding.breakdown, bonuses.map(b => b.amount), emp.currency ?? cfg?.defaultCurrency ?? base);
  const fx = await snapshot(tx, ctx, emp.currency ?? cfg?.defaultCurrency ?? base, base, end);
  return bonuses.map((b, i) => ({ columns: { employeeId: emp.id, type: "project_bonus", description: b.description ?? "Bonus",
    grossAmount: b.amount, taxAmount: split.targets[i], deductions: split.targets[i], netAmount: payrollSum([b.amount, -split.targets[i]]), bonusAmount: b.amount, ...fx },
    taxes: split.result[i], employer: i === 0 ? withholding.employerBreakdown : [], deductions: [] }));
}
export async function createBonusPayrollRun(ctx: AuthContext, input: unknown, request?: Request) {
  requireRole(ctx, "manage:payroll"); const p = bonusRunSchema.parse(input); period(p.payPeriodStart, p.payPeriodEnd);
  const bonuses = p.bonuses.map(b => ({ employeeId: b.employeeId, bonusType: b.bonusType, amount: runAmount(b), description: b.description ?? null }));
  return mutate(ctx, async tx => {
    const base = await baseCurrency(tx, ctx); assertFunctionalCurrencyEnabled(base); const cfg = await settings(tx, ctx);
    const items: BuiltItem[] = [];
    for (const id of [...new Set(bonuses.map(b => b.employeeId))].sort()) {
      const emp = await employee(tx, ctx, id); items.push(...await bonusItems(tx, ctx, emp, cfg, base, p.payPeriodStart, p.payPeriodEnd, bonuses.filter(b => b.employeeId === id)));
    }
    const row = await persist(tx, ctx, { payPeriodStart: p.payPeriodStart, payPeriodEnd: p.payPeriodEnd, runType: "bonus_only", notes: p.notes ?? "Bonus run", baseCurrency: base }, items);
    await tx.insert(payrollBonus).values(bonuses.map(b => ({ ...b, payrollRunId: row.id })));
    return finishCreate(tx, ctx, row, "create_bonus_run", true, request);
  });
}
export async function createTerminationPayrollRun(ctx: AuthContext, input: unknown, request?: Request) {
  requireRole(ctx, "manage:payroll"); const p = terminationRunSchema.parse(input); period(p.payPeriodStart, p.payPeriodEnd);
  return mutate(ctx, async tx => {
    const base = await baseCurrency(tx, ctx); assertFunctionalCurrencyEnabled(base); const emp = await employee(tx, ctx, p.employeeId);
    const days = BigInt((Date.parse(p.payPeriodEnd + "T00:00:00Z") - Date.parse(p.payPeriodStart + "T00:00:00Z")) / 86400000 + 1);
    const gross = emp.compensationType === "salary" ? payrollRatio(emp.salary, days, 365n) : emp.compensationType === "hourly" && emp.hourlyRate !== null ? payrollRatio(emp.hourlyRate, 80n, 1n) : 0;
    const hours = p.includeUnusedPto ? emp.ptoBalanceHours : 0; payrollReal(hours);
    const pto = emp.hourlyRate !== null ? payrollRatio(emp.hourlyRate, payrollReal(hours), PAYROLL_REAL_SCALE) : payrollRatio(emp.salary, payrollReal(hours), PAYROLL_REAL_SCALE * 2080n);
    const totalGross = payrollSum([gross, pto]); if (totalGross === 0) throw new AuthError("Termination run has no payable wages", 400);
    const cfg = await settings(tx, ctx), withholding = await computeEmployeeWithholding(ctx.organizationId, emp, cfg, totalGross,
      await getEmployeeYtdWage(ctx.organizationId, emp.id, p.payPeriodStart, tx), p.payPeriodStart, tx);
    if (withholding.totalTax > totalGross) throw new AuthError("Termination withholding exceeds wages", 422);
    const wages = [{ amount: gross, type: "regular_salary" as const, description: "Final pay" }, { amount: pto, type: "reimbursement" as const, description: `PTO payout (${hours}h)` }].filter(w => w.amount > 0);
    const split = distributeTaxes(withholding.breakdown, wages.map(w => w.amount), emp.currency ?? cfg?.defaultCurrency ?? base), fx = await snapshot(tx, ctx, emp.currency ?? cfg?.defaultCurrency ?? base, base, p.payPeriodEnd);
    const items = wages.map((w, i): BuiltItem => ({ columns: { employeeId: emp.id, type: w.type, description: w.description,
      grossAmount: w.amount, taxAmount: split.targets[i], deductions: split.targets[i], netAmount: payrollSum([w.amount, -split.targets[i]]), ...fx },
      taxes: split.result[i], employer: i === 0 ? withholding.employerBreakdown : [], deductions: [] }));
    const row = await persist(tx, ctx, { payPeriodStart: p.payPeriodStart, payPeriodEnd: p.payPeriodEnd, runType: "termination", notes: p.notes ?? `Termination pay for ${emp.name}`,
      baseCurrency: base, terminationEmployeeId: emp.id, terminationPtoHours: hours }, items);
    return finishCreate(tx, ctx, row, "create_termination_run", true, request);
  });
}
export async function createCorrectionPayrollRun(ctx: AuthContext, input: unknown, request?: Request) {
  requireRole(ctx, "manage:payroll"); const p = correctionRunSchema.parse(input);
  const adjustments = p.adjustments.map(a => ({ ...a, gross: runAmount(a, "grossAdjustment") }));
  if (new Set(adjustments.map(a => a.employeeId)).size !== adjustments.length) throw new AuthError("Use one correction adjustment per employee", 400);
  return mutate(ctx, async tx => {
    const parent = await ownedRun(tx, ctx, p.parentRunId, true);
    if (parent.status !== "completed") throw new AuthError("Can only correct completed runs", 409);
    const historical = await readItems(tx, ctx, parent.id), base = parent.baseCurrency ?? await baseCurrency(tx, ctx);
    assertFunctionalCurrencyEnabled(base); const items: BuiltItem[] = [];
    for (const a of adjustments.sort((a, b) => a.employeeId.localeCompare(b.employeeId))) {
      await employee(tx, ctx, a.employeeId, false);
      const rows = historical.filter(i => i.employeeId === a.employeeId);
      if (!rows.length) throw new AuthError("Correction employee not found in parent run", 404);
      if (new Set(rows.map(i => i.currency + ":" + i.rateExact)).size !== 1) throw new WireCompatibilityError("Parent employee has mixed currencies or FX; correction is ambiguous");
      const parentGross = payrollSum(rows.map(i => i.grossAmount)); if (parentGross <= 0) throw new AuthError("Parent employee must have positive gross wages", 422);
      const scale = (n: number) => payrollRatio(n, payrollInteger(a.gross), payrollInteger(parentGross));
      const taxes = rows.flatMap(i => i.taxBreakdowns).map(t => ({ jurisdictionLevel: t.jurisdictionLevel, jurisdiction: t.jurisdiction, taxKind: t.taxKind, amount: scale(t.amount) })).filter(t => t.amount !== 0);
      // If legacy history lacks a breakdown, preserve its actual tax instead of silently discarding it.
      if (rows.every(i => i.taxBreakdowns.length === 0) && rows.some(i => i.taxAmount !== 0)) taxes.push({ jurisdictionLevel: "federal", jurisdiction: null, taxKind: "income_tax", amount: scale(payrollSum(rows.map(i => i.taxAmount))) });
      const employer = rows.flatMap(i => i.employerTaxBreakdowns).map(t => ({ jurisdictionLevel: t.jurisdictionLevel, jurisdiction: t.jurisdiction, taxKind: t.taxKind, amount: scale(t.amount) })).filter(t => t.amount !== 0);
      const deductions: Deduction[] = rows.flatMap(i => i.deductionBreakdowns).map(d => ({ deductionTypeId: d.deductionTypeId, employeeDeductionId: null,
        liabilityAccountCode: d.liabilityAccountCode, category: d.category, amount: scale(d.amount) })).filter(d => d.amount !== 0);
      const taxAmount = payrollSum(taxes.map(t => t.amount));
      const pre = payrollSum(deductions.filter(d => d.category === "pre_tax").map(d => d.amount!)), post = payrollSum(deductions.filter(d => d.category === "post_tax").map(d => d.amount!));
      if (payrollSum(rows.map(i => i.preTaxDeductions ?? 0)) !== payrollSum(rows.flatMap(i => i.deductionBreakdowns).filter(d => d.category === "pre_tax").map(d => d.amount)) ||
          payrollSum(rows.map(i => i.postTaxDeductions ?? 0)) !== payrollSum(rows.flatMap(i => i.deductionBreakdowns).filter(d => d.category === "post_tax").map(d => d.amount)))
        throw new WireCompatibilityError("Parent deduction details are unavailable; cannot safely correct");
      const all = payrollSum([taxAmount, pre, post]);
      items.push({ columns: { employeeId: a.employeeId, type: a.gross > 0 ? "regular_salary" : "deduction", description: a.description ?? "Correction adjustment",
        grossAmount: a.gross, taxAmount, preTaxDeductions: pre, postTaxDeductions: post, deductions: all, netAmount: payrollSum([a.gross, -all]), currency: rows[0].currency,
        fxRate: rows[0].fxRate, rateExact: rows[0].rateExact, rateFormatVersion: 1, rateDirection: "quote_per_base", rateMigrationStatus: "exact",
        rateProvenance: JSON.stringify({ format: "payroll_exact_v1", baseCurrency: rows[0].currency, quoteCurrency: base, parentProvenance: rows[0].rateProvenance }) }, taxes, employer, deductions });
    }
    const row = await persist(tx, ctx, { payPeriodStart: parent.payPeriodStart, payPeriodEnd: parent.payPeriodEnd, runType: "correction", parentRunId: parent.id,
      baseCurrency: base, notes: p.notes ?? `Correction for run ${parent.id.slice(0, 8)}` }, items);
    return finishCreate(tx, ctx, row, "create_correction_run", true, request);
  });
}
async function bonusesRead(tx: TaxTx, ctx: AuthContext, id: string) {
  const rows = await tx.select().from(payrollBonus).where(eq(payrollBonus.payrollRunId, id)).orderBy(payrollBonus.createdAt, payrollBonus.id);
  return mapSeries(rows, async row => {
    const [emp] = await tx.select().from(payrollEmployee).where(employeeScope(ctx, row.employeeId));
    if (!emp) throw new AuthError("Bonus employee not found in organization", 404);
    return { ...runMoneyDto(row, ["amount"]), employee: payrollMasterDto(emp) };
  });
}
export async function listPayrollRunBonuses(ctx: AuthContext, id: string) {
  requireRole(ctx, "manage:payroll"); return db.transaction(async tx => { await ownedRun(tx, ctx, id); return bonusesRead(tx, ctx, id); }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
/** Bonus edits change payable amounts and invalidate previous approval; base wage/FX snapshots survive. */
async function rebuildBonuses(tx: TaxTx, ctx: AuthContext, run: Run, emp: Employee) {
  if (run.runType !== "regular" && run.runType !== "off_cycle" && run.runType !== "bonus_only") throw new AuthError("Bonuses cannot be edited on correction or termination runs", 409);
  const base = run.baseCurrency ?? await baseCurrency(tx, ctx), cfg = await settings(tx, ctx);
  if (base !== await baseCurrency(tx, ctx)) throw new AuthError("Run base currency changed; recreate draft", 422);
  const original = await readItems(tx, ctx, run.id), own = original.filter(i => i.employeeId === emp.id);
  const bonuses = (await bonusesRead(tx, ctx, run.id)).filter(b => b.employeeId === emp.id);
  const baseItems = own.filter(i => i.bonusAmount === null);
  const bonusItems = own.filter(i => i.bonusAmount !== null);
  for (const item of bonusItems) await tx.delete(payrollItem).where(eq(payrollItem.id, item.id));
  const savedFx = baseItems[0];
  const fx = savedFx ? { currency: savedFx.currency, fxRate: savedFx.fxRate, rateExact: savedFx.rateExact, rateFormatVersion: 1,
    rateDirection: "quote_per_base", rateMigrationStatus: "exact", rateProvenance: savedFx.rateProvenance } : await snapshot(tx, ctx, emp.currency ?? cfg?.defaultCurrency ?? base, base, run.payPeriodEnd);
  const gross = payrollSum([...baseItems.map(i => i.grossAmount), ...bonuses.map(b => b.amount)]);
  const pre = payrollSum(baseItems.map(i => i.preTaxDeductions ?? 0)), post = payrollSum(baseItems.map(i => i.postTaxDeductions ?? 0));
  const available = [...baseItems.map(i => payrollSum([i.grossAmount, -(i.preTaxDeductions ?? 0), -(i.postTaxDeductions ?? 0)])), ...bonuses.map(b => b.amount)];
  if (!available.length) return refreshTotals(tx, ctx, run.id);
  const withholding = await computeEmployeeWithholding(ctx.organizationId, emp, cfg, payrollSum([gross, -pre]),
    await getEmployeeYtdWage(ctx.organizationId, emp.id, run.payPeriodStart, tx), run.payPeriodStart, tx);
  if (withholding.totalTax > payrollSum([gross, -pre, -post])) throw new AuthError("Withholding exceeds available pay", 422);
  const split = distributeTaxes(withholding.breakdown, available, fx.currency!);
  for (let i = 0; i < baseItems.length; i++) {
    const item = baseItems[i], amount = payrollSum([split.targets[i], item.preTaxDeductions ?? 0, item.postTaxDeductions ?? 0]);
    await tx.update(payrollItem).set({ taxAmount: split.targets[i], deductions: amount, netAmount: payrollSum([item.grossAmount, -amount]) }).where(eq(payrollItem.id, item.id));
    await tx.delete(payrollItemTaxBreakdown).where(eq(payrollItemTaxBreakdown.payrollItemId, item.id));
    await tx.delete(payrollItemEmployerTax).where(eq(payrollItemEmployerTax.payrollItemId, item.id));
    if (split.result[i].length) await tx.insert(payrollItemTaxBreakdown).values(split.result[i].map(t => ({ ...t, payrollItemId: item.id })));
    if (i === 0 && withholding.employerBreakdown.length) await tx.insert(payrollItemEmployerTax).values(withholding.employerBreakdown.map(t => ({ ...t, payrollItemId: item.id })));
  }
  await insertItems(tx, run.id, bonuses.map((b, i) => { const index = baseItems.length + i; return { columns: { employeeId: emp.id, type: "project_bonus" as const,
    description: b.description ?? `${b.bonusType} bonus`, grossAmount: b.amount, bonusAmount: b.amount, taxAmount: split.targets[index], deductions: split.targets[index],
    netAmount: payrollSum([b.amount, -split.targets[index]]), ...fx }, taxes: split.result[index], employer: !baseItems.length && i === 0 ? withholding.employerBreakdown : [], deductions: [] }; }));
  return refreshTotals(tx, ctx, run.id);
}
export async function createPayrollRunBonus(ctx: AuthContext, id: string, input: unknown, request?: Request) {
  requireRole(ctx, "manage:payroll"); runId.parse(id); const p = bonusCreateSchema.parse(input), amount = runAmount(p);
  return mutate(ctx, async tx => {
    const row = await ownedRun(tx, ctx, id, true); draft(row); await readRun(tx, ctx, row);
    const emp = await employee(tx, ctx, p.employeeId);
    const [bonus] = await tx.insert(payrollBonus).values({ payrollRunId: id, employeeId: p.employeeId, bonusType: p.bonusType, amount, description: p.description ?? null }).returning();
    await rebuildBonuses(tx, ctx, row, emp); const result = runMoneyDto(bonus, ["amount"]);
    await auditTax(tx, ctx.organizationId, "payroll_bonus", bonus.id, "create", result, ctx, request); return result;
  });
}
export async function deletePayrollRunBonus(ctx: AuthContext, id: string, bonusId: string, request?: Request) {
  requireRole(ctx, "manage:payroll"); runId.parse(id); runId.parse(bonusId);
  return mutate(ctx, async tx => {
    const row = await ownedRun(tx, ctx, id, true); draft(row); await readRun(tx, ctx, row);
    const [bonus] = await tx.select().from(payrollBonus).where(and(eq(payrollBonus.id, bonusId), eq(payrollBonus.payrollRunId, id))).for("update");
    if (!bonus) throw new AuthError("Bonus not found in run", 404);
    const before = runMoneyDto(bonus, ["amount"]), emp = await employee(tx, ctx, bonus.employeeId);
    await tx.delete(payrollBonus).where(and(eq(payrollBonus.id, bonusId), eq(payrollBonus.payrollRunId, id)));
    await rebuildBonuses(tx, ctx, row, emp); await auditTax(tx, ctx.organizationId, "payroll_bonus", bonusId, "delete", before, ctx, request); return { success: true };
  });
}
