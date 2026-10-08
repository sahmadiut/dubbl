import { and, eq, isNull, desc, getTableColumns, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { savedReport, invoice, contact, inventoryItem, bankTransaction, bankAccount, bankStatementImport, expenseClaim, payrollItem, payrollRun, payrollEmployee, organization } from "@/lib/db/schema";
import { AuthError, type AuthContext } from "@/lib/api/auth-context";
import { requireRole } from "@/lib/api/require-role";
import { logAudit } from "@/lib/api/audit";
import { stringifyWire, WireCompatibilityError } from "@/lib/money/wire";
import { reportDateSchema, reportStoredMinor } from "./statement-wire";
import { currencyMetadata } from "@/lib/money/exact";
import { createSavedReportSchema, updateSavedReportSchema, savedReportIdSchema, customConfigSchema, sources, customCsv } from "./custom-wire";

const scope = (ctx: AuthContext, id?: string) => and(eq(savedReport.organizationId, ctx.organizationId), isNull(savedReport.deletedAt),
  id === undefined ? undefined : eq(savedReport.id, savedReportIdSchema.parse(id)));
const savedFields = { ...getTableColumns(savedReport), timestampsFinite: sql<boolean>`isfinite(${savedReport.createdAt}) and isfinite(${savedReport.updatedAt})` };
function savedOutput(stored: typeof savedReport.$inferSelect & { timestampsFinite: boolean }) {
  const { timestampsFinite, ...report } = stored;
  try {
    createSavedReportSchema.parse({ name: report.name, description: report.description, config: report.config });
  } catch {
    throw new AuthError("Stored report configuration is unsupported", 422);
  }
  if (!timestampsFinite || ![report.createdAt, report.updatedAt].every(date => date instanceof Date && Number.isFinite(date.getTime())))
    throw new AuthError("Stored report timestamps are unsupported", 422);
  stringifyWire(report);
  return report;
}

export async function listSavedReports(ctx: AuthContext) {
  requireRole(ctx, "view:data");
  return { reports: (await db.select(savedFields).from(savedReport).where(scope(ctx)).orderBy(savedReport.updatedAt, savedReport.id)).map(savedOutput) };
}
export async function getSavedReport(ctx: AuthContext, id: string) {
  requireRole(ctx, "view:data");
  const [row] = await db.select(savedFields).from(savedReport).where(scope(ctx, id));
  if (!row) throw new AuthError("Report not found", 404);
  return { report: savedOutput(row) };
}
export async function createSavedReport(ctx: AuthContext, input: unknown) {
  requireRole(ctx, "view:data");
  const parsed = createSavedReportSchema.parse(input);
  return db.transaction(async tx => {
    const [row] = await tx.insert(savedReport).values({ ...parsed, description: parsed.description ?? null, organizationId: ctx.organizationId }).returning(savedFields);
    return { report: savedOutput(row) };
  });
}
export async function updateSavedReport(ctx: AuthContext, id: string, input: unknown) {
  requireRole(ctx, "view:data");
  const where = scope(ctx, id), parsed = updateSavedReportSchema.parse(input);
  return db.transaction(async tx => {
    const [existing] = await tx.select(savedFields).from(savedReport).where(where).for("update");
    if (!existing) throw new AuthError("Report not found", 404);
    savedOutput(existing);
    const [row] = await tx.update(savedReport).set({ ...parsed, updatedAt: new Date() }).where(where).returning(savedFields);
    return { report: savedOutput(row) };
  });
}
export async function deleteSavedReport(ctx: AuthContext, id: string, request?: Request) {
  requireRole(ctx, "view:data");
  const where = scope(ctx, id);
  const deleted = await db.transaction(async tx => {
    const [existing] = await tx.select(savedFields).from(savedReport).where(where).for("update");
    if (!existing) throw new AuthError("Report not found", 404);
    savedOutput(existing);
    const [row] = await tx.update(savedReport).set({ deletedAt: new Date(), updatedAt: new Date() }).where(where).returning(savedFields);
    return savedOutput(row);
  });
  await logAudit({ ctx, action: "delete", entityType: "saved_report", entityId: id, changes: deleted, request });
  return { success: true };
}

export async function runCustomReport(ctx: AuthContext, input: unknown) {
  requireRole(ctx, "view:data");
  const config = customConfigSchema.parse(input), source = sources[config.dataSource];
  if (config.dataSource === "payroll") requireRole(ctx, "view:payroll-reports");
  // Select only documented columns; related labels must independently belong to this org.
  let rows: Record<string, unknown>[];
  switch (config.dataSource) {
    case "invoices":
      rows = await db.select({ id: invoice.id, invoiceNumber: invoice.invoiceNumber, contactName: sql<string>`coalesce(${contact.name}, '-')`, status: invoice.status,
        issueDate: invoice.issueDate, dueDate: invoice.dueDate, subtotal: invoice.subtotal, taxTotal: invoice.taxTotal, total: invoice.total,
        amountPaid: invoice.amountPaid, amountDue: invoice.amountDue, currencyCode: invoice.currencyCode }).from(invoice)
        .leftJoin(contact, and(eq(contact.id, invoice.contactId), eq(contact.organizationId, ctx.organizationId), isNull(contact.deletedAt)))
        .where(and(eq(invoice.organizationId, ctx.organizationId), isNull(invoice.deletedAt))).orderBy(desc(invoice.createdAt), invoice.id);
      break;
    case "contacts":
      rows = await db.select({ id: contact.id, name: contact.name, email: contact.email, type: contact.type, phone: contact.phone,
        paymentTermsDays: contact.paymentTermsDays, creditLimit: contact.creditLimit, currencyCode: contact.currencyCode }).from(contact)
        .where(and(eq(contact.organizationId, ctx.organizationId), isNull(contact.deletedAt))).orderBy(contact.id);
      break;
    case "inventory":
      rows = await db.select({ id: inventoryItem.id, code: inventoryItem.code, name: inventoryItem.name, category: inventoryItem.category,
        purchasePrice: inventoryItem.purchasePrice, salePrice: inventoryItem.salePrice, quantityOnHand: inventoryItem.quantityOnHand,
        reorderPoint: inventoryItem.reorderPoint, isActive: inventoryItem.isActive }).from(inventoryItem)
        .where(and(eq(inventoryItem.organizationId, ctx.organizationId), isNull(inventoryItem.deletedAt))).orderBy(inventoryItem.id);
      break;
    case "transactions":
      rows = await db.select({ id: bankTransaction.id, date: bankTransaction.date, description: bankTransaction.description, amount: bankTransaction.amount,
        status: bankTransaction.status, payee: bankTransaction.payee, currencyCode: bankAccount.currencyCode, transactionCurrency: bankTransaction.currencyCode }).from(bankTransaction)
        .innerJoin(bankAccount, and(eq(bankAccount.id, bankTransaction.bankAccountId), eq(bankAccount.organizationId, ctx.organizationId), isNull(bankAccount.deletedAt)))
        .leftJoin(bankStatementImport, eq(bankStatementImport.id, bankTransaction.importId))
        .where(sql`${bankTransaction.importId} is null or (${bankStatementImport.organizationId} = ${ctx.organizationId} and ${bankStatementImport.bankAccountId} = ${bankAccount.id})`)
        .orderBy(desc(bankTransaction.date), bankTransaction.id);
      break;
    case "expenses":
      rows = await db.select({ id: expenseClaim.id, title: expenseClaim.title, status: expenseClaim.status, totalAmount: expenseClaim.totalAmount,
        currencyCode: expenseClaim.currencyCode, submittedAt: expenseClaim.submittedAt, approvedAt: expenseClaim.approvedAt,
        timestampsFinite: sql<boolean>`(${expenseClaim.submittedAt} is null or isfinite(${expenseClaim.submittedAt})) and (${expenseClaim.approvedAt} is null or isfinite(${expenseClaim.approvedAt}))` }).from(expenseClaim)
        .where(and(eq(expenseClaim.organizationId, ctx.organizationId), isNull(expenseClaim.deletedAt))).orderBy(desc(expenseClaim.createdAt), expenseClaim.id);
      break;
    case "payroll":
      rows = await db.select({ id: payrollItem.id, employeeName: payrollEmployee.name, payPeriodStart: payrollRun.payPeriodStart, payPeriodEnd: payrollRun.payPeriodEnd,
        type: payrollItem.type, grossAmount: payrollItem.grossAmount, taxAmount: payrollItem.taxAmount, deductions: payrollItem.deductions,
        netAmount: payrollItem.netAmount, currencyCode: payrollItem.currency }).from(payrollItem)
        .innerJoin(payrollRun, and(eq(payrollRun.id, payrollItem.payrollRunId), eq(payrollRun.organizationId, ctx.organizationId), isNull(payrollRun.deletedAt)))
        .innerJoin(payrollEmployee, and(eq(payrollEmployee.id, payrollItem.employeeId), eq(payrollEmployee.organizationId, ctx.organizationId), isNull(payrollEmployee.deletedAt)))
        .orderBy(payrollRun.payPeriodStart, payrollItem.id);
      break;
  }
  if (config.dataSource === "inventory") {
    const [org] = await db.select({ currencyCode: organization.defaultCurrency }).from(organization).where(eq(organization.id, ctx.organizationId));
    if (!org) throw new AuthError("Organization not found", 404);
    for (const row of rows) row.currencyCode = org.currencyCode;
  }
  for (const row of rows) {
    if (row.transactionCurrency !== undefined && row.transactionCurrency !== null && row.transactionCurrency !== row.currencyCode)
      throw new WireCompatibilityError("Transaction currency differs from bank currency");
    delete row.transactionCurrency;
    if (row.timestampsFinite === false) throw new WireCompatibilityError("Unsupported source timestamp");
    delete row.timestampsFinite;
    try { currencyMetadata(row.currencyCode as string); }
    catch { throw new AuthError("Unsupported source currency", 422); }
    for (const name of ["issueDate", "dueDate", "date", "payPeriodStart", "payPeriodEnd"]) {
      if (row[name] !== undefined && row[name] !== null && !reportDateSchema.safeParse(row[name]).success)
        throw new AuthError("Unsupported source date", 422);
    }
    for (const name of source.money) row[`${name}Minor`] = row[name] === null ? null : reportStoredMinor(row[name] as number).toString();
    for (const [key, value] of Object.entries(row)) {
      if (value instanceof Date) {
        if (!Number.isFinite(value.getTime())) throw new WireCompatibilityError("Unsupported source timestamp");
        row[key] = value.toISOString();
      }
    }
    stringifyWire(row);
  }
  if (config.dateRange && source.date) {
    const { from, to } = config.dateRange;
    rows = rows.filter(row => typeof row[source.date!] === "string" && (row[source.date!] as string).slice(0, 10) >= from && (row[source.date!] as string).slice(0, 10) <= to);
  }
  for (const filter of config.filters) {
    const base = filter.field.endsWith("Minor") ? filter.field.slice(0, -5) : filter.field;
    const monetary = (source.money as readonly string[]).includes(base);
    rows = rows.filter(row => {
      const value = row[filter.field];
      if (value === null || value === undefined) return false;
      if (filter.operator === "contains") return String(value).toLowerCase().includes(filter.value.toLowerCase());
      if (filter.operator === "equals") return String(value) === filter.value;
      const left = monetary ? BigInt(String(value)) : Number(value), right = monetary ? BigInt(filter.value) : Number(filter.value);
      switch (filter.operator) { case "gt": return left > right; case "gte": return left >= right; case "lt": return left < right; case "lte": return left <= right; }
    });
  }
  const columns = [...config.columns];
  for (const name of source.money) if (columns.includes(name) && !columns.includes(`${name}Minor`)) columns.push(`${name}Minor`);
  const data = rows.map(row => Object.fromEntries(columns.map(name => [name, row[name]])));
  return { data, total: data.length };
}

export async function exportSavedReport(ctx: AuthContext, id: string) {
  const { report } = await getSavedReport(ctx, id);
  const result = await runCustomReport(ctx, report.config);
  const source = sources[customConfigSchema.parse(report.config).dataSource];
  const columns = [...report.config.columns];
  for (const name of source.money) if (columns.includes(name) && !columns.includes(`${name}Minor`)) columns.push(`${name}Minor`);
  return { filename: `${report.name.replace(/[^a-zA-Z0-9]/g, "_")}.csv`, mimeType: "text/csv; charset=utf-8", csv: customCsv(columns, result.data) };
}
