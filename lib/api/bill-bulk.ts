import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { organization, contact, chartAccount, bill, billLine, bulkImportJob, auditLog } from "@/lib/db/schema";
import { notDeleted } from "@/lib/db/soft-delete";
import { stringifyWire } from "@/lib/money/wire";
import { AuthError, type AuthContext } from "./auth-context";
import { requireRole } from "./require-role";
import { assertNotLocked } from "./period-lock";
import { nextBillNumber } from "./bill-writes";
import { billWriteDto } from "./bill-write-wire";
import { logAudit } from "./audit";
import { invoiceInputError } from "./invoice-write-wire";
import { billImportFields, billImportSchema, billImportRowSchema, normalizeBillImportRows, billImportGroups,
  billImportTotals, billImportPreviewDto, type BillImportRow } from "./bill-bulk-wire";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
const message = (err: unknown) => err instanceof Error ? err.message : "Bill import failed";
async function references(tx: Tx, org: string, rows: BillImportRow[]) {
  const suppliers = await tx.select({ id: contact.id }).from(contact).where(and(eq(contact.organizationId, org),
    sql`lower(${contact.name}) = lower(${rows[0].contactName})`, notDeleted(contact.deletedAt))).for("share");
  if (suppliers.length !== 1) invoiceInputError("Supplier name must match exactly one available contact in this organization");
  const accounts: (string | null)[] = [];
  for (const row of rows) {
    const code = row.lineAccountCode?.trim();
    if (!code) { accounts.push(null); continue; }
    const found = await tx.select({ id: chartAccount.id }).from(chartAccount).where(and(eq(chartAccount.organizationId, org),
      sql`lower(${chartAccount.code}) = lower(${code})`, notDeleted(chartAccount.deletedAt), eq(chartAccount.isActive, true))).for("share");
    if (found.length !== 1) invoiceInputError("Account code must match exactly one active account in this organization");
    accounts.push(found[0].id);
  }
  return { contactId: suppliers[0].id, accounts };
}
export async function previewBillImport(ctx: AuthContext, input: unknown) {
  const parsed = z.object(billImportFields).parse(input); stringifyWire(parsed.rows);
  const data = normalizeBillImportRows(parsed.rows, parsed.source);
  const preview: ({ row: number; data: Record<string, unknown>; valid: boolean; errors: string[] }
    & Partial<ReturnType<typeof billImportPreviewDto>>)[] = data.map((row, i) => ({ row: i + 1, data: row, valid: false, errors: [] }));
  const valid: { row: BillImportRow; index: number }[] = [];
  for (const [index, row] of data.entries()) {
    try { const value = billImportRowSchema.parse(row); Object.assign(preview[index], billImportPreviewDto(value)); valid.push({ row: value, index }); }
    catch (err) { preview[index].errors.push(message(err)); }
  }
  // Include invalid lines so a broken member never advertises a valid grouped bill.
  const keys = new Map<string, number[]>();
  for (const [index, row] of data.entries()) {
    const key = typeof row.billNumber === "string" && row.billNumber ? `number:${row.billNumber}` : `row:${index}`;
    keys.set(key, [...(keys.get(key) ?? []), index]);
  }
  const byIndex = new Map(valid.map(value => [value.index, value.row]));
  for (const indices of keys.values()) {
    try {
      const rows = indices.map(index => byIndex.get(index));
      if (rows.some(row => !row)) invoiceInputError("Bill group contains an invalid line");
      const group = rows as BillImportRow[];
      billImportGroups(group); billImportTotals(group);
      await db.transaction(tx => references(tx, ctx.organizationId, group));
      indices.forEach(index => { preview[index].valid = true; });
    } catch (err) { indices.forEach(index => { if (!preview[index].errors.length) preview[index].errors.push(message(err)); }); }
  }
  return { preview, validCount: preview.filter(row => row.valid).length, totalCount: data.length };
}
export async function importBills(ctx: AuthContext, input: unknown, request?: Request) {
  requireRole(ctx, "manage:bills");
  const parsed = billImportSchema.parse(input); stringifyWire(parsed.rows);
  const rows = normalizeBillImportRows(parsed.rows, parsed.source).map(row => billImportRowSchema.parse(row));
  const groups = billImportGroups(rows);
  // Preflight every price, alias, product and grouped sum before jobs or numbers.
  groups.forEach(group => billImportTotals(group.rows));
  const [job] = await db.insert(bulkImportJob).values({ organizationId: ctx.organizationId, type: "bills", fileName: parsed.fileName,
    totalRows: rows.length, status: "processing", createdBy: ctx.userId }).returning();
  let processedRows = 0;
  const errorDetails: { row: number; error: string }[] = [];
  for (const [index, group] of groups.entries()) {
    try {
      await db.transaction(async tx => {
        const [org] = await tx.select({ id: organization.id }).from(organization).where(eq(organization.id, ctx.organizationId)).for("update");
        if (!org) throw new AuthError("Organization not found", 404);
        const resolved = await references(tx, ctx.organizationId, group.rows), first = group.rows[0];
        await assertNotLocked(ctx.organizationId, first.issueDate);
        const totals = billImportTotals(group.rows);
        const [created] = await tx.insert(bill).values({ organizationId: ctx.organizationId, contactId: resolved.contactId,
          billNumber: await nextBillNumber(tx, ctx.organizationId), issueDate: first.issueDate, dueDate: first.dueDate, currencyCode: first.currencyCode,
          subtotal: totals.subtotal, taxTotal: 0, total: totals.total, amountDue: totals.amountDue, amountPaid: 0, createdBy: ctx.userId }).returning();
        await tx.insert(billLine).values(totals.lines.map((line, sortOrder) => ({ ...line, accountId: resolved.accounts[sortOrder], sortOrder, billId: created.id })));
        stringifyWire(billWriteDto(created));
        await tx.insert(auditLog).values({ organizationId: ctx.organizationId, userId: ctx.userId, action: "create", entityType: "bill", entityId: created.id,
          changes: { jobId: job.id }, ipAddress: request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request?.headers.get("x-real-ip") || null,
          userAgent: request?.headers.get("user-agent") || null });
      });
      processedRows++;
    } catch (err) { errorDetails.push({ row: index + 1, error: message(err) }); }
  }
  const [updated] = await db.update(bulkImportJob).set({ processedRows, errorRows: errorDetails.length,
    errorDetails: errorDetails.length ? errorDetails : null, status: errorDetails.length === groups.length ? "failed" : "completed", completedAt: new Date() })
    .where(and(eq(bulkImportJob.id, job.id), eq(bulkImportJob.organizationId, ctx.organizationId))).returning();
  await logAudit({ ctx, action: "import", entityType: "bill", entityId: ctx.organizationId, changes: { count: processedRows, jobId: job.id }, request });
  return { job: updated };
}
