import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { payrollSettings, payrollEmployee, payrollRun, deductionType, employeeDeduction, employeeTaxConfig, taxBracket, taxAllowanceConfig, chartAccount } from "@/lib/db/schema";
import { AuthError, type AuthContext } from "./auth-context";
import { requireRole } from "./require-role";
import { WireCompatibilityError } from "@/lib/money/wire";
import { auditTax, lockTaxOrganization, type TaxTx } from "./tax-config-transaction";
import { payrollConfigId, payrollSettingsUpdateSchema, deductionTypeCreateSchema, deductionTypeUpdateSchema,
  employeeDeductionCreateSchema, employeeDeductionUpdateSchema, taxBracketCreateSchema, taxBracketUpdateSchema,
  taxAllowanceCreateSchema, taxAllowanceUpdateSchema, employeeTaxUpdateSchema, payrollConfigAmounts, payrollConfigDto,
  settingsMoney, bracketMoney, allowanceMoney, validateBracket, validateDeductionDates } from "./payroll-config-wire";

const typeScope = (ctx: AuthContext, id?: string) => and(eq(deductionType.organizationId, ctx.organizationId), isNull(deductionType.deletedAt), id ? eq(deductionType.id, id) : undefined);
const bracketScope = (ctx: AuthContext, id?: string) => and(eq(taxBracket.organizationId, ctx.organizationId), isNull(taxBracket.deletedAt), id ? eq(taxBracket.id, id) : undefined);
const allowanceScope = (ctx: AuthContext, id?: string) => and(eq(taxAllowanceConfig.organizationId, ctx.organizationId), isNull(taxAllowanceConfig.deletedAt), id ? eq(taxAllowanceConfig.id, id) : undefined);
const typeDto = (row: typeof deductionType.$inferSelect) => payrollConfigDto(row, deductionTypeUpdateSchema, ["defaultAmount"]);
const deductionDto = (row: typeof employeeDeduction.$inferSelect) => {
  try { validateDeductionDates(row); } catch { throw new WireCompatibilityError("Unsupported saved deduction dates"); }
  return payrollConfigDto(row, employeeDeductionCreateSchema.extend({ isActive: employeeDeductionUpdateSchema.shape.isActive }), ["amount"]);
};
const bracketDto = (row: typeof taxBracket.$inferSelect) => {
  try { validateBracket(row); } catch { throw new WireCompatibilityError("Unsupported saved tax bracket bounds"); }
  return payrollConfigDto(row, taxBracketUpdateSchema, bracketMoney);
};
const allowanceDto = (row: typeof taxAllowanceConfig.$inferSelect) => payrollConfigDto(row, taxAllowanceCreateSchema, allowanceMoney);
const settingsDto = (row: typeof payrollSettings.$inferSelect) => payrollConfigDto(row, payrollSettingsUpdateSchema, settingsMoney);
const taxDto = (row: typeof employeeTaxConfig.$inferSelect) => payrollConfigDto(row, employeeTaxUpdateSchema, ["additionalWithholding"]);

async function writer<T>(ctx: AuthContext, fn: (tx: TaxTx) => Promise<T>) {
  return db.transaction(async tx => { await lockTaxOrganization(tx, ctx.organizationId); return fn(tx); });
}
async function ownedEmployee(tx: TaxTx, ctx: AuthContext, id: string) {
  const [row] = await tx.select().from(payrollEmployee).where(and(eq(payrollEmployee.id, id), eq(payrollEmployee.organizationId, ctx.organizationId), isNull(payrollEmployee.deletedAt))).for("update");
  if (!row) throw new AuthError("Employee not found", 404);
  return row;
}
async function ownedType(tx: TaxTx, ctx: AuthContext, id: string, live = false) {
  const [row] = await tx.select().from(deductionType).where(and(eq(deductionType.id, id), eq(deductionType.organizationId, ctx.organizationId), live ? isNull(deductionType.deletedAt) : undefined));
  if (!row) throw new AuthError("Deduction type not found", 404);
  return typeDto(row);
}
export async function getPayrollSettings(ctx: AuthContext, request?: Request) {
  requireRole(ctx, "manage:payroll");
  return writer(ctx, async tx => {
    const [existing] = await tx.select().from(payrollSettings).where(eq(payrollSettings.organizationId, ctx.organizationId));
    if (existing) return settingsDto(existing);
    const [row] = await tx.insert(payrollSettings).values({ organizationId: ctx.organizationId }).returning();
    const result = settingsDto(row); await auditTax(tx, ctx.organizationId, "payrollSettings", row.id, "create", result, ctx, request); return result;
  });
}
export async function updatePayrollSettings(ctx: AuthContext, input: unknown, request?: Request) {
  requireRole(ctx, "manage:payroll"); const values = payrollConfigAmounts(payrollSettingsUpdateSchema.parse(input), settingsMoney);
  return writer(ctx, async tx => {
    const [old] = await tx.select().from(payrollSettings).where(eq(payrollSettings.organizationId, ctx.organizationId));
    if (old) settingsDto(old);
    for (const [field, type] of [["salaryExpenseAccountCode", "expense"], ["taxPayableAccountCode", "liability"], ["bankAccountCode", "asset"]] as const) {
      if (values[field] == null) continue;
      const [account] = await tx.select({ id: chartAccount.id }).from(chartAccount).where(and(eq(chartAccount.organizationId, ctx.organizationId), eq(chartAccount.code, values[field]!), eq(chartAccount.type, type), eq(chartAccount.isActive, true), isNull(chartAccount.deletedAt))).for("share");
      if (!account) throw new AuthError(`Owned active ${type} account required for ${field}`, 404);
    }
    if (values.defaultCurrency !== undefined && values.defaultCurrency !== (old?.defaultCurrency ?? "USD")) {
      const [run] = await tx.select({ id: payrollRun.id }).from(payrollRun).where(eq(payrollRun.organizationId, ctx.organizationId)).limit(1);
      if (run) throw new AuthError("Payroll currency cannot change with run history", 409);
    }
    const [row] = old ? await tx.update(payrollSettings).set({ ...values, updatedAt: new Date() }).where(eq(payrollSettings.organizationId, ctx.organizationId)).returning()
      : await tx.insert(payrollSettings).values({ organizationId: ctx.organizationId, ...values }).returning();
    const result = settingsDto(row); await auditTax(tx, ctx.organizationId, "payrollSettings", row.id, "update", result, ctx, request); return result;
  });
}
export async function listPayrollDeductionTypes(ctx: AuthContext) {
  requireRole(ctx, "manage:payroll"); return (await db.select().from(deductionType).where(typeScope(ctx)).orderBy(asc(deductionType.createdAt), asc(deductionType.id))).map(typeDto);
}
export async function getPayrollDeductionType(ctx: AuthContext, id: string) {
  requireRole(ctx, "manage:payroll"); payrollConfigId.parse(id);
  const [row] = await db.select().from(deductionType).where(typeScope(ctx, id));
  if (!row) throw new AuthError("Deduction type not found", 404); return typeDto(row);
}
export async function createPayrollDeductionType(ctx: AuthContext, input: unknown, request?: Request) {
  requireRole(ctx, "manage:payroll"); const values = payrollConfigAmounts(deductionTypeCreateSchema.parse(input), ["defaultAmount"]);
  return writer(ctx, async tx => {
    const [row] = await tx.insert(deductionType).values({ organizationId: ctx.organizationId, ...values }).returning();
    const result = typeDto(row); await auditTax(tx, ctx.organizationId, "deductionType", row.id, "create", result, ctx, request); return result;
  });
}
export async function updatePayrollDeductionType(ctx: AuthContext, id: string, input: unknown, request?: Request) {
  requireRole(ctx, "manage:payroll"); payrollConfigId.parse(id); const values = payrollConfigAmounts(deductionTypeUpdateSchema.parse(input), ["defaultAmount"]);
  return writer(ctx, async tx => {
    const [old] = await tx.select().from(deductionType).where(typeScope(ctx, id)); if (!old) throw new AuthError("Deduction type not found", 404); typeDto(old);
    const [row] = await tx.update(deductionType).set(values).where(typeScope(ctx, id)).returning();
    const result = typeDto(row); await auditTax(tx, ctx.organizationId, "deductionType", id, "update", result, ctx, request); return result;
  });
}
export async function deletePayrollDeductionType(ctx: AuthContext, id: string, request?: Request) {
  requireRole(ctx, "manage:payroll"); payrollConfigId.parse(id);
  return writer(ctx, async tx => {
    const [old] = await tx.select().from(deductionType).where(typeScope(ctx, id)); if (!old) throw new AuthError("Deduction type not found", 404); const before = typeDto(old);
    await tx.update(deductionType).set({ deletedAt: new Date() }).where(typeScope(ctx, id));
    await auditTax(tx, ctx.organizationId, "deductionType", id, "delete", before, ctx, request); return { success: true };
  });
}
export async function listPayrollEmployeeDeductions(ctx: AuthContext, employeeId: string) {
  requireRole(ctx, "manage:payroll"); payrollConfigId.parse(employeeId);
  return writer(ctx, async tx => {
    await ownedEmployee(tx, ctx, employeeId);
    const rows = await tx.select().from(employeeDeduction).where(and(eq(employeeDeduction.employeeId, employeeId), isNull(employeeDeduction.deletedAt))).orderBy(asc(employeeDeduction.createdAt), asc(employeeDeduction.id));
    return Promise.all(rows.map(async row => ({ ...deductionDto(row), deductionType: await ownedType(tx, ctx, row.deductionTypeId) })));
  });
}
export async function createPayrollEmployeeDeduction(ctx: AuthContext, employeeId: string, input: unknown, request?: Request) {
  requireRole(ctx, "manage:payroll"); payrollConfigId.parse(employeeId); const values = payrollConfigAmounts(employeeDeductionCreateSchema.parse(input), ["amount"]); validateDeductionDates(values);
  return writer(ctx, async tx => {
    await ownedEmployee(tx, ctx, employeeId); await ownedType(tx, ctx, values.deductionTypeId, true);
    const [row] = await tx.insert(employeeDeduction).values({ employeeId, ...values }).returning();
    const result = deductionDto(row); await auditTax(tx, ctx.organizationId, "employeeDeduction", row.id, "create", result, ctx, request); return result;
  });
}
export async function updatePayrollEmployeeDeduction(ctx: AuthContext, employeeId: string, id: string, input: unknown, request?: Request) {
  requireRole(ctx, "manage:payroll"); payrollConfigId.parse(employeeId); payrollConfigId.parse(id); const values = payrollConfigAmounts(employeeDeductionUpdateSchema.parse(input), ["amount"]);
  return writer(ctx, async tx => {
    await ownedEmployee(tx, ctx, employeeId);
    const scope = and(eq(employeeDeduction.id, id), eq(employeeDeduction.employeeId, employeeId), isNull(employeeDeduction.deletedAt));
    const [old] = await tx.select().from(employeeDeduction).where(scope); if (!old) throw new AuthError("Deduction not found", 404);
    deductionDto(old); await ownedType(tx, ctx, old.deductionTypeId); validateDeductionDates({ ...old, ...values });
    const [row] = await tx.update(employeeDeduction).set(values).where(scope).returning();
    const result = deductionDto(row); await auditTax(tx, ctx.organizationId, "employeeDeduction", id, "update", result, ctx, request); return result;
  });
}
export async function deletePayrollEmployeeDeduction(ctx: AuthContext, employeeId: string, id: string, request?: Request) {
  requireRole(ctx, "manage:payroll"); payrollConfigId.parse(employeeId); payrollConfigId.parse(id);
  return writer(ctx, async tx => {
    await ownedEmployee(tx, ctx, employeeId);
    const scope = and(eq(employeeDeduction.id, id), eq(employeeDeduction.employeeId, employeeId), isNull(employeeDeduction.deletedAt));
    const [old] = await tx.select().from(employeeDeduction).where(scope); if (!old) throw new AuthError("Deduction not found", 404);
    const before = deductionDto(old); await ownedType(tx, ctx, old.deductionTypeId);
    await tx.update(employeeDeduction).set({ deletedAt: new Date() }).where(scope);
    await auditTax(tx, ctx.organizationId, "employeeDeduction", id, "delete", before, ctx, request); return { success: true };
  });
}
export async function getPayrollEmployeeTaxConfig(ctx: AuthContext, employeeId: string, request?: Request) {
  requireRole(ctx, "manage:payroll"); payrollConfigId.parse(employeeId);
  return writer(ctx, async tx => {
    await ownedEmployee(tx, ctx, employeeId);
    const [old] = await tx.select().from(employeeTaxConfig).where(eq(employeeTaxConfig.employeeId, employeeId)); if (old) return taxDto(old);
    const [row] = await tx.insert(employeeTaxConfig).values({ employeeId }).returning();
    const result = taxDto(row); await auditTax(tx, ctx.organizationId, "employeeTaxConfig", row.id, "create", result, ctx, request); return result;
  });
}
export async function updatePayrollEmployeeTaxConfig(ctx: AuthContext, employeeId: string, input: unknown, request?: Request) {
  requireRole(ctx, "manage:payroll"); payrollConfigId.parse(employeeId); const values = payrollConfigAmounts(employeeTaxUpdateSchema.parse(input), ["additionalWithholding"]);
  return writer(ctx, async tx => {
    await ownedEmployee(tx, ctx, employeeId);
    const [old] = await tx.select().from(employeeTaxConfig).where(eq(employeeTaxConfig.employeeId, employeeId)); if (old) taxDto(old);
    const [row] = old ? await tx.update(employeeTaxConfig).set({ ...values, updatedAt: new Date() }).where(eq(employeeTaxConfig.employeeId, employeeId)).returning()
      : await tx.insert(employeeTaxConfig).values({ employeeId, ...values }).returning();
    const result = taxDto(row); await auditTax(tx, ctx.organizationId, "employeeTaxConfig", row.id, "update", result, ctx, request); return result;
  });
}
export async function listPayrollTaxBrackets(ctx: AuthContext) {
  requireRole(ctx, "manage:tax-config"); return (await db.select().from(taxBracket).where(bracketScope(ctx)).orderBy(asc(taxBracket.minIncome), asc(taxBracket.id))).map(bracketDto);
}
export async function getPayrollTaxBracket(ctx: AuthContext, id: string) {
  requireRole(ctx, "manage:tax-config"); payrollConfigId.parse(id);
  const [row] = await db.select().from(taxBracket).where(bracketScope(ctx, id)); if (!row) throw new AuthError("Tax bracket not found", 404); return bracketDto(row);
}
export async function createPayrollTaxBracket(ctx: AuthContext, input: unknown, request?: Request) {
  requireRole(ctx, "manage:tax-config"); const values = payrollConfigAmounts(taxBracketCreateSchema.parse(input), bracketMoney, ["minIncome"]); validateBracket({ ...values, minIncome: values.minIncome! });
  return writer(ctx, async tx => {
    const [row] = await tx.insert(taxBracket).values({ organizationId: ctx.organizationId, ...values, minIncome: values.minIncome! }).returning();
    const result = bracketDto(row); await auditTax(tx, ctx.organizationId, "taxBracket", row.id, "create", result, ctx, request); return result;
  });
}
export async function updatePayrollTaxBracket(ctx: AuthContext, id: string, input: unknown, request?: Request) {
  requireRole(ctx, "manage:tax-config"); payrollConfigId.parse(id); const values = payrollConfigAmounts(taxBracketUpdateSchema.parse(input), bracketMoney);
  return writer(ctx, async tx => {
    const [old] = await tx.select().from(taxBracket).where(bracketScope(ctx, id)); if (!old) throw new AuthError("Tax bracket not found", 404); bracketDto(old);
    validateBracket({ ...old, ...values, minIncome: values.minIncome ?? old.minIncome });
    const [row] = await tx.update(taxBracket).set(values).where(bracketScope(ctx, id)).returning();
    const result = bracketDto(row); await auditTax(tx, ctx.organizationId, "taxBracket", id, "update", result, ctx, request); return result;
  });
}
export async function deletePayrollTaxBracket(ctx: AuthContext, id: string, request?: Request) {
  requireRole(ctx, "manage:tax-config"); payrollConfigId.parse(id);
  return writer(ctx, async tx => {
    const [old] = await tx.select().from(taxBracket).where(bracketScope(ctx, id)); if (!old) throw new AuthError("Tax bracket not found", 404); const before = bracketDto(old);
    await tx.update(taxBracket).set({ deletedAt: new Date(), isActive: false }).where(bracketScope(ctx, id));
    await auditTax(tx, ctx.organizationId, "taxBracket", id, "delete", before, ctx, request); return { success: true };
  });
}
async function uniqueAllowance(tx: TaxTx, ctx: AuthContext, row: Pick<typeof taxAllowanceConfig.$inferSelect, "jurisdictionLevel" | "jurisdiction" | "taxYear">, id?: string) {
  const rows = await tx.select({ id: taxAllowanceConfig.id }).from(taxAllowanceConfig).where(and(allowanceScope(ctx), eq(taxAllowanceConfig.jurisdictionLevel, row.jurisdictionLevel),
    row.jurisdiction === null ? isNull(taxAllowanceConfig.jurisdiction) : eq(taxAllowanceConfig.jurisdiction, row.jurisdiction), eq(taxAllowanceConfig.taxYear, row.taxYear)));
  if (rows.some(r => r.id !== id)) throw new AuthError("Allowance configuration already exists for this jurisdiction and year", 409);
}
export async function listPayrollTaxAllowances(ctx: AuthContext) {
  requireRole(ctx, "manage:tax-config"); return (await db.select().from(taxAllowanceConfig).where(allowanceScope(ctx)).orderBy(asc(taxAllowanceConfig.taxYear), asc(taxAllowanceConfig.id))).map(allowanceDto);
}
export async function getPayrollTaxAllowance(ctx: AuthContext, id: string) {
  requireRole(ctx, "manage:tax-config"); payrollConfigId.parse(id);
  const [row] = await db.select().from(taxAllowanceConfig).where(allowanceScope(ctx, id)); if (!row) throw new AuthError("Tax allowance not found", 404); return allowanceDto(row);
}
export async function createPayrollTaxAllowance(ctx: AuthContext, input: unknown, request?: Request) {
  requireRole(ctx, "manage:tax-config"); const values = payrollConfigAmounts(taxAllowanceCreateSchema.parse(input), allowanceMoney);
  return writer(ctx, async tx => {
    await uniqueAllowance(tx, ctx, { ...values, jurisdiction: values.jurisdiction ?? null });
    const [row] = await tx.insert(taxAllowanceConfig).values({ organizationId: ctx.organizationId, ...values }).returning();
    const result = allowanceDto(row); await auditTax(tx, ctx.organizationId, "taxAllowanceConfig", row.id, "create", result, ctx, request); return result;
  });
}
export async function updatePayrollTaxAllowance(ctx: AuthContext, id: string, input: unknown, request?: Request) {
  requireRole(ctx, "manage:tax-config"); payrollConfigId.parse(id); const values = payrollConfigAmounts(taxAllowanceUpdateSchema.parse(input), allowanceMoney);
  return writer(ctx, async tx => {
    const [old] = await tx.select().from(taxAllowanceConfig).where(allowanceScope(ctx, id)); if (!old) throw new AuthError("Tax allowance not found", 404); allowanceDto(old);
    await uniqueAllowance(tx, ctx, { ...old, ...values }, id);
    const [row] = await tx.update(taxAllowanceConfig).set(values).where(allowanceScope(ctx, id)).returning();
    const result = allowanceDto(row); await auditTax(tx, ctx.organizationId, "taxAllowanceConfig", id, "update", result, ctx, request); return result;
  });
}
export async function deletePayrollTaxAllowance(ctx: AuthContext, id: string, request?: Request) {
  requireRole(ctx, "manage:tax-config"); payrollConfigId.parse(id);
  return writer(ctx, async tx => {
    const [old] = await tx.select().from(taxAllowanceConfig).where(allowanceScope(ctx, id)); if (!old) throw new AuthError("Tax allowance not found", 404); const before = allowanceDto(old);
    await tx.update(taxAllowanceConfig).set({ deletedAt: new Date() }).where(allowanceScope(ctx, id));
    await auditTax(tx, ctx.organizationId, "taxAllowanceConfig", id, "delete", before, ctx, request); return { success: true };
  });
}
