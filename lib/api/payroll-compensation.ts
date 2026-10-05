import { and, desc, eq, gte, isNull, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { compensationBand, compensationReview, compensationReviewEntry, payrollEmployee, payrollRun, organization } from "@/lib/db/schema";
import { currencyCodeSchema } from "@/lib/currency/zod";
import { WireCompatibilityError } from "@/lib/money/wire";
import { payrollInteger, payrollNumber, payrollRatio, payrollSum } from "@/lib/payroll/exact";
import { payrollMasterDto } from "./payroll-master-wire";
import { runMoneyDto } from "./payroll-run-wire";
import { AuthError, type AuthContext } from "./auth-context";
import { requireRole } from "./require-role";
import { auditTax, lockTaxOrganization, type TaxTx } from "./tax-config-transaction";
import { bandCreateSchema, bandUpdateSchema, reviewCreateSchema, reviewUpdateSchema, entryCreateSchema, compensationId,
  compensationAmounts, compensationDto, validateBand, projectionSchema, whatIfSchema, budgetActualSchema, percentBasisPoints, ratioPercent } from "./payroll-compensation-wire";

const bandMoney = ["minSalary", "midSalary", "maxSalary"];
const entryMoney = ["currentSalary", "proposedSalary"];
const bandScope = (ctx: AuthContext, id?: string) => and(eq(compensationBand.organizationId, ctx.organizationId), isNull(compensationBand.deletedAt), id ? eq(compensationBand.id, id) : undefined);
const reviewScope = (ctx: AuthContext, id?: string) => and(eq(compensationReview.organizationId, ctx.organizationId), isNull(compensationReview.deletedAt), id ? eq(compensationReview.id, id) : undefined);
async function transaction<T>(ctx: AuthContext, fn: (tx: TaxTx) => Promise<T>) {
  return db.transaction(async tx => { await lockTaxOrganization(tx, ctx.organizationId); return fn(tx); });
}
async function baseCurrency(tx: TaxTx, ctx: AuthContext) {
  const [org] = await tx.select().from(organization).where(eq(organization.id, ctx.organizationId));
  if (!org || !org.defaultCurrency || currencyCodeSchema.parse(org.defaultCurrency) !== org.defaultCurrency) throw new WireCompatibilityError("Unsupported organization currency");
  return org.defaultCurrency;
}
function bandDto(row: typeof compensationBand.$inferSelect) {
  try { validateBand(row); } catch { throw new WireCompatibilityError("Unsupported saved compensation band range or currency"); }
  return compensationDto(row, bandMoney);
}
async function ownedBand(tx: TaxTx, ctx: AuthContext, id: string) {
  compensationId.parse(id); const [row] = await tx.select().from(compensationBand).where(bandScope(ctx, id));
  if (!row) throw new AuthError("Compensation band not found", 404); bandDto(row); return row;
}
async function ownedReview(tx: TaxTx, ctx: AuthContext, id: string) {
  compensationId.parse(id); const [row] = await tx.select().from(compensationReview).where(reviewScope(ctx, id));
  if (!row) throw new AuthError("Compensation review not found", 404);
  reviewCreateSchema.shape.effectiveDate.parse(row.effectiveDate); compensationDto(row, ["totalBudget"]); return row;
}
function mutableReview(row: typeof compensationReview.$inferSelect) {
  if (["completed", "cancelled"].includes(row.status)) throw new AuthError("Completed/cancelled reviews are immutable", 422);
}
async function reviewEntries(tx: TaxTx, ctx: AuthContext, id: string, currency: string) {
  const rows = await tx.select().from(compensationReviewEntry).where(eq(compensationReviewEntry.reviewId, id));
  const result = [];
  for (const row of rows) {
    const [emp] = await tx.select().from(payrollEmployee).where(and(eq(payrollEmployee.id, row.employeeId), eq(payrollEmployee.organizationId, ctx.organizationId), isNull(payrollEmployee.deletedAt)));
    if (!emp) throw new WireCompatibilityError("Unsupported saved compensation employee reference");
    payrollMasterDto(emp);
    if (emp.currency !== currency || emp.compensationType !== "salary") throw new WireCompatibilityError("Reviews require salary employees in organization base currency");
    if (row.currentSalary < 0 || row.proposedSalary < 0 || (row.adjustmentPercent !== null && (!Number.isFinite(row.adjustmentPercent) || row.adjustmentPercent < -100 || row.adjustmentPercent > 1000))) throw new WireCompatibilityError("Unsupported saved compensation entry");
    result.push({ ...compensationDto(row, entryMoney), currency, employee: payrollMasterDto(emp) });
  }
  return result;
}
async function reviewDto(tx: TaxTx, ctx: AuthContext, row: typeof compensationReview.$inferSelect, detail = false) {
  reviewCreateSchema.shape.effectiveDate.parse(row.effectiveDate);
  if (row.totalBudget !== null && row.totalBudget < 0) throw new WireCompatibilityError("Unsupported saved review budget");
  const currency = row.currency ?? await baseCurrency(tx, ctx);
  if (currencyCodeSchema.parse(currency) !== currency) throw new WireCompatibilityError("Unsupported saved review currency");
  const entries = await reviewEntries(tx, ctx, row.id, currency);
  const currentSalary = payrollSum(entries.map(e => e.currentSalary)), proposedSalary = payrollSum(entries.map(e => e.proposedSalary));
  return { ...compensationDto(row, ["totalBudget"]), currency, _count: { entries: entries.length },
    totals: compensationDto({ currentSalary, proposedSalary, difference: payrollSum([proposedSalary, -currentSalary]) }, [...entryMoney, "difference"]),
    ...(detail ? { entries } : {}) };
}
export async function listCompensationBands(ctx: AuthContext) {
  requireRole(ctx, "manage:compensation"); return transaction(ctx, async tx => (await tx.select().from(compensationBand).where(bandScope(ctx))).map(bandDto));
}
export async function getCompensationBand(ctx: AuthContext, id: string) {
  requireRole(ctx, "manage:compensation"); return transaction(ctx, async tx => bandDto(await ownedBand(tx, ctx, id)));
}
export async function createCompensationBand(ctx: AuthContext, input: unknown, request?: Request) {
  requireRole(ctx, "manage:compensation");
  const p = compensationAmounts(bandCreateSchema.parse(input), bandMoney, true) as Pick<typeof compensationBand.$inferInsert, "name" | "level" | "minSalary" | "midSalary" | "maxSalary" | "currency">;
  validateBand({ ...p, currency: p.currency ?? "USD" });
  return transaction(ctx, async tx => {
    const [row] = await tx.insert(compensationBand).values({ ...p, organizationId: ctx.organizationId }).returning();
    const result = bandDto(row); await auditTax(tx, ctx.organizationId, "compensationBand", row.id, "create", result, ctx, request); return result;
  });
}
export async function updateCompensationBand(ctx: AuthContext, id: string, input: unknown, request?: Request) {
  requireRole(ctx, "manage:compensation");
  const p = compensationAmounts(bandUpdateSchema.parse(input), bandMoney) as Partial<Pick<typeof compensationBand.$inferInsert, "name" | "level" | "minSalary" | "midSalary" | "maxSalary" | "isActive">>;
  return transaction(ctx, async tx => {
    const before = await ownedBand(tx, ctx, id); validateBand({ ...before, ...p });
    if (!Object.keys(p).length) return bandDto(before);
    const [row] = await tx.update(compensationBand).set(p).where(bandScope(ctx, id)).returning();
    const result = bandDto(row); await auditTax(tx, ctx.organizationId, "compensationBand", id, "update", result, ctx, request); return result;
  });
}
export async function deleteCompensationBand(ctx: AuthContext, id: string, request?: Request) {
  requireRole(ctx, "manage:compensation"); return transaction(ctx, async tx => {
    await ownedBand(tx, ctx, id);
    const [ref] = await tx.select({ id: payrollEmployee.id }).from(payrollEmployee).where(and(eq(payrollEmployee.compensationBandId, id), eq(payrollEmployee.organizationId, ctx.organizationId), isNull(payrollEmployee.deletedAt)));
    if (ref) throw new AuthError("Compensation band is assigned to an employee", 422);
    await tx.update(compensationBand).set({ deletedAt: new Date() }).where(bandScope(ctx, id));
    await auditTax(tx, ctx.organizationId, "compensationBand", id, "delete", { id }, ctx, request); return { success: true };
  });
}
export async function listCompensationReviews(ctx: AuthContext) {
  requireRole(ctx, "manage:compensation"); return transaction(ctx, async tx => {
    const rows = await tx.select().from(compensationReview).where(reviewScope(ctx)).orderBy(desc(compensationReview.createdAt));
    return { data: await Promise.all(rows.map(row => reviewDto(tx, ctx, row))), currency: await baseCurrency(tx, ctx) };
  });
}
export async function getCompensationReview(ctx: AuthContext, id: string) {
  requireRole(ctx, "manage:compensation"); return transaction(ctx, async tx => reviewDto(tx, ctx, await ownedReview(tx, ctx, id), true));
}
export async function createCompensationReview(ctx: AuthContext, input: unknown, request?: Request) {
  requireRole(ctx, "manage:compensation");
  const p = compensationAmounts(reviewCreateSchema.parse(input), ["totalBudget"]) as Pick<typeof compensationReview.$inferInsert, "name" | "effectiveDate" | "totalBudget">;
  return transaction(ctx, async tx => {
    const [row] = await tx.insert(compensationReview).values({ ...p, organizationId: ctx.organizationId, currency: await baseCurrency(tx, ctx) }).returning();
    const result = await reviewDto(tx, ctx, row); await auditTax(tx, ctx.organizationId, "compensationReview", row.id, "create", result, ctx, request); return result;
  });
}
export async function updateCompensationReview(ctx: AuthContext, id: string, input: unknown, request?: Request) {
  requireRole(ctx, "manage:compensation");
  const p = compensationAmounts(reviewUpdateSchema.parse(input), ["totalBudget"]) as Partial<Pick<typeof compensationReview.$inferInsert, "name" | "effectiveDate" | "totalBudget" | "status">>;
  return transaction(ctx, async tx => {
    mutableReview(await ownedReview(tx, ctx, id));
    const [row] = await tx.update(compensationReview).set({ ...p, updatedAt: new Date() }).where(reviewScope(ctx, id)).returning();
    const result = await reviewDto(tx, ctx, row); await auditTax(tx, ctx.organizationId, "compensationReview", id, "update", result, ctx, request); return result;
  });
}
export async function listCompensationEntries(ctx: AuthContext, id: string) {
  requireRole(ctx, "manage:compensation"); return transaction(ctx, async tx => {
    const review = await ownedReview(tx, ctx, id); const entries = await reviewEntries(tx, ctx, id, review.currency ?? await baseCurrency(tx, ctx));
    payrollSum(entries.map(e => e.currentSalary)); payrollSum(entries.map(e => e.proposedSalary)); return entries;
  });
}
export async function createCompensationEntry(ctx: AuthContext, id: string, input: unknown, request?: Request) {
  requireRole(ctx, "manage:compensation");
  const p = compensationAmounts(entryCreateSchema.parse(input), entryMoney, true) as Pick<typeof compensationReviewEntry.$inferInsert, "employeeId" | "currentSalary" | "proposedSalary" | "adjustmentPercent" | "reason">;
  return transaction(ctx, async tx => {
    const review = await ownedReview(tx, ctx, id); mutableReview(review); const currency = review.currency ?? await baseCurrency(tx, ctx);
    const [emp] = await tx.select().from(payrollEmployee).where(and(eq(payrollEmployee.id, p.employeeId), eq(payrollEmployee.organizationId, ctx.organizationId), isNull(payrollEmployee.deletedAt))).for("update");
    if (!emp) throw new AuthError("Employee not found", 404); payrollMasterDto(emp);
    if (!emp.isActive || emp.currency !== currency || emp.compensationType !== "salary") throw new AuthError("Review requires active salary employee in base currency", 422);
    if (p.currentSalary !== emp.salary) throw new AuthError("Current salary must match employee salary", 422);
    const existing = await reviewEntries(tx, ctx, id, currency);
    if (existing.some(e => e.employeeId === p.employeeId)) throw new AuthError("Employee already has an entry in this review", 422);
    payrollSum([...existing.map(e => e.currentSalary), p.currentSalary]); payrollSum([...existing.map(e => e.proposedSalary), p.proposedSalary]);
    const [row] = await tx.insert(compensationReviewEntry).values({ ...p, reviewId: id }).returning();
    const result = { ...compensationDto(row, entryMoney), currency };
    await auditTax(tx, ctx.organizationId, "compensationReviewEntry", row.id, "create", result, ctx, request); return result;
  });
}
export async function compensationEquity(ctx: AuthContext) {
  requireRole(ctx, "manage:compensation"); return transaction(ctx, async tx => {
    const employees = await tx.select().from(payrollEmployee).where(and(eq(payrollEmployee.organizationId, ctx.organizationId), eq(payrollEmployee.isActive, true), isNull(payrollEmployee.deletedAt)));
    const result = [];
    for (const emp of employees) {
      payrollMasterDto(emp); const band = emp.compensationBandId ? await ownedBand(tx, ctx, emp.compensationBandId) : null;
      if (band && (emp.currency !== band.currency || emp.compensationType !== "salary")) throw new WireCompatibilityError("Equity band must match salary employee currency");
      result.push(compensationDto({ employeeId: emp.id, name: emp.name, salary: emp.salary, currency: emp.currency,
        bandId: emp.compensationBandId, bandName: band?.name ?? null,
        rangePenetration: band && band.maxSalary > band.minSalary ? ratioPercent(BigInt(emp.salary) - BigInt(band.minSalary), BigInt(band.maxSalary) - BigInt(band.minSalary)) : null,
        belowMin: band ? emp.salary < band.minSalary : null, aboveMax: band ? emp.salary > band.maxSalary : null }, ["salary"]));
    }
    return result;
  });
}
async function forecastEmployees(tx: TaxTx, ctx: AuthContext, currency: string) {
  const rows = await tx.select().from(payrollEmployee).where(and(eq(payrollEmployee.organizationId, ctx.organizationId), eq(payrollEmployee.isActive, true), isNull(payrollEmployee.deletedAt)));
  for (const emp of rows) {
    payrollMasterDto(emp);
    if (emp.currency !== currency || !["salary", "hourly"].includes(emp.compensationType) || (emp.compensationType === "hourly" && emp.hourlyRate === null)) throw new WireCompatibilityError("Forecasts require base-currency salary/hourly employees; mixed currencies and milestone/commission estimates are unsupported");
  }
  return rows;
}
function monthlyCosts(employees: (typeof payrollEmployee.$inferSelect)[]) {
  return employees.map(emp => emp.compensationType === "salary" ? payrollRatio(emp.salary, 1n, 12n) : payrollRatio(emp.hourlyRate!, 173n, 1n));
}
export async function payrollProjection(ctx: AuthContext, input: unknown) {
  requireRole(ctx, "view:payroll-reports"); const p = projectionSchema.parse(input);
  return transaction(ctx, async tx => {
    const currency = await baseCurrency(tx, ctx), employees = await forecastEmployees(tx, ctx, currency), costs = monthlyCosts(employees);
    const gross = payrollSum(costs), tax = payrollSum(costs.map((cost, i) => payrollRatio(cost, BigInt(employees[i].taxRate), 10000n))), net = payrollSum([gross, -tax]);
    const start = new Date(); start.setUTCDate(1); start.setUTCHours(0, 0, 0, 0);
    const data = Array.from({ length: p.months }, (_, i) => {
      const date = new Date(start); date.setUTCMonth(date.getUTCMonth() + i + 1);
      return compensationDto({ month: date.toISOString().slice(0, 7), gross, tax, net, currency, headcount: employees.length }, ["gross", "tax", "net"]);
    });
    return { currency, data, totals: compensationDto({ gross: payrollRatio(gross, BigInt(p.months), 1n), tax: payrollRatio(tax, BigInt(p.months), 1n), net: payrollRatio(net, BigInt(p.months), 1n) }, ["gross", "tax", "net"]) };
  });
}
export async function payrollWhatIf(ctx: AuthContext, input: unknown) {
  requireRole(ctx, "view:payroll-reports"); const p = whatIfSchema.parse(input);
  const salary = compensationAmounts(p, ["avgNewHireSalary"], p.newHires > 0).avgNewHireSalary as number | undefined;
  return transaction(ctx, async tx => {
    const currency = await baseCurrency(tx, ctx), employees = await forecastEmployees(tx, ctx, currency);
    if (p.terminations > employees.length) throw new AuthError("Terminations exceed active headcount", 400);
    const monthlyGross = payrollSum(monthlyCosts(employees));
    const retained = employees.length ? payrollRatio(monthlyGross, BigInt(employees.length - p.terminations), BigInt(employees.length)) : 0;
    const adjusted = payrollRatio(retained, 10000n + percentBasisPoints(p.salaryAdjustmentPercent ?? 0), 10000n);
    const hired = payrollRatio(salary ?? 0, BigInt(p.newHires), 12n), projectedGross = payrollSum([adjusted, hired]);
    const current = compensationDto({ monthlyGross, projectedTotal: payrollRatio(monthlyGross, BigInt(p.months), 1n), headcount: employees.length }, ["monthlyGross", "projectedTotal"]);
    const projected = compensationDto({ monthlyGross: projectedGross, projectedTotal: payrollRatio(projectedGross, BigInt(p.months), 1n), headcount: employees.length + p.newHires - p.terminations }, ["monthlyGross", "projectedTotal"]);
    return { currency, current, projected, difference: compensationDto({ monthlyGross: payrollSum([projectedGross, -monthlyGross]), projectedTotal: payrollSum([projected.projectedTotal, -current.projectedTotal]) }, ["monthlyGross", "projectedTotal"]) };
  });
}
export async function payrollBudgetActual(ctx: AuthContext, input: unknown) {
  requireRole(ctx, "view:payroll-reports"); const p = budgetActualSchema.parse(input), year = p.year ?? new Date().getUTCFullYear(), y = String(year).padStart(4, "0");
  return transaction(ctx, async tx => {
    const currency = await baseCurrency(tx, ctx), employees = await forecastEmployees(tx, ctx, currency);
    const budget = payrollSum(employees.map(emp => emp.compensationType === "salary" ? emp.salary : payrollRatio(emp.hourlyRate!, 2076n, 1n)));
    const runs = await tx.select().from(payrollRun).where(and(eq(payrollRun.organizationId, ctx.organizationId), eq(payrollRun.status, "completed"), isNull(payrollRun.deletedAt), gte(payrollRun.payPeriodStart, `${y}-01-01`), lte(payrollRun.payPeriodEnd, `${y}-12-31`)));
    for (const run of runs) { runMoneyDto(run, ["totalGross", "totalNet", "totalDeductions"]); if ((run.baseCurrency ?? currency) !== currency) throw new WireCompatibilityError("Run base currency differs from current forecast currency"); }
    const actual = payrollNumber(runs.reduce((s, run) => s + payrollInteger(run.totalGross), 0n));
    return compensationDto({ year, currency, budget, actual, variance: payrollSum([budget, -actual]), utilizationPercent: ratioPercent(BigInt(actual), BigInt(budget)) }, ["budget", "actual", "variance"]);
  });
}
