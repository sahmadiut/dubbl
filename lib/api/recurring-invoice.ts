import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { recurringTemplate, recurringTemplateLine, organization } from "@/lib/db/schema";
import { notDeleted, softDelete } from "@/lib/db/soft-delete";
import { AuthError, type AuthContext } from "./auth-context";
import { requireRole } from "./require-role";
import { logAudit, diffChanges } from "./audit";
import { references, taxRates } from "./invoice-writes";
import { invoiceWriteLineSchema } from "./invoice-write-wire";
import { publicMoneyDto } from "./public-money-wire";
import { currencyMetadata } from "@/lib/money/exact";
import { WireCompatibilityError } from "@/lib/money/wire";
import { recurringInvoiceCreateSchema, recurringInvoiceUpdateSchema, recurringInvoiceDates, recurringInvoiceDto,
  recurringInvoiceStoredLines, recurringInvoiceTotals, advanceRecurringInvoiceDate } from "./recurring-invoice-wire";

export type RecurringInvoiceTx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export function recurringInvoiceScope(id: string, orgId: string) {
  return and(eq(recurringTemplate.id, id), eq(recurringTemplate.organizationId, orgId), eq(recurringTemplate.type, "invoice"), notDeleted(recurringTemplate.deletedAt));
}
export async function lockRecurringInvoiceOrg(tx: RecurringInvoiceTx, orgId: string) {
  const [org] = await tx.select().from(organization).where(eq(organization.id, orgId)).for("update");
  if (!org) throw new AuthError("Organization not found", 404); return org;
}
export function recurringInvoiceReferences(lines: { description: string; accountId: string | null; taxRateId: string | null }[]) {
  return lines.map(line => invoiceWriteLineSchema.parse({ description: line.description, accountId: line.accountId, taxRateId: line.taxRateId }));
}
export async function loadRecurringInvoice(tx: RecurringInvoiceTx, orgId: string, id: string, lock = false) {
  z.string().uuid().parse(id);
  const query = tx.select().from(recurringTemplate).where(recurringInvoiceScope(id, orgId));
  const [header] = await (lock ? query.for("update") : query);
  if (!header) throw new AuthError("Recurring invoice not found", 404);
  recurringInvoiceCreateSchema.omit({ lines: true }).strip().parse(header);
  z.iso.date().parse(header.nextRunDate);
  z.number().int().min(0).max(2147483647).parse(header.occurrencesGenerated);
  if (header.nextRunDate < header.startDate) throw new WireCompatibilityError("Recurring next run precedes its start date");
  const lines = await tx.select().from(recurringTemplateLine).where(eq(recurringTemplateLine.templateId, id)).orderBy(recurringTemplateLine.sortOrder, recurringTemplateLine.id);
  if (!header.contactId) throw new WireCompatibilityError("Recurring invoice requires a contact");
  const refs = recurringInvoiceReferences(lines);
  const customer = await references(tx, orgId, header.contactId, refs, true);
  const result = recurringInvoiceDto({ ...header, lines, contact: customer });
  recurringInvoiceDates(header.startDate, header.endDate);
  recurringInvoiceTotals(lines, await taxRates(tx, refs));
  return result;
}
export async function getRecurringInvoice(ctx: AuthContext, id: string) {
  return db.transaction(tx => loadRecurringInvoice(tx, ctx.organizationId, id));
}
export async function createRecurringInvoice(ctx: AuthContext, input: unknown, request?: Request, entityType = "recurring_invoice") {
  requireRole(ctx, "manage:recurring"); const data = recurringInvoiceCreateSchema.parse(input);
  recurringInvoiceDates(data.startDate, data.endDate);
  const lines = recurringInvoiceStoredLines(data.lines, data.currencyCode);
  const created = await db.transaction(async tx => {
    await lockRecurringInvoiceOrg(tx, ctx.organizationId);
    const refs = recurringInvoiceReferences(lines);
    const customer = await references(tx, ctx.organizationId, data.contactId, refs);
    recurringInvoiceDto({ currencyCode: data.currencyCode, organizationId: ctx.organizationId, contact: customer, lines });
    recurringInvoiceTotals(lines, await taxRates(tx, refs));
    const header = recurringInvoiceCreateSchema.omit({ lines: true }).strip().parse(data);
    const [row] = await tx.insert(recurringTemplate).values({ ...header, organizationId: ctx.organizationId, type: "invoice",
      nextRunDate: data.startDate, endDate: data.endDate ?? null, maxOccurrences: data.maxOccurrences ?? null,
      reference: data.reference || null, notes: data.notes || null, createdBy: ctx.userId }).returning();
    await tx.insert(recurringTemplateLine).values(lines.map(line => ({ ...line, templateId: row.id })));
    return recurringInvoiceDto(row);
  });
  await logAudit({ ctx, action: "create", entityType, entityId: created.id, request }); return { template: created };
}
export async function changeRecurringInvoice(ctx: AuthContext, id: string, input: unknown, request?: Request,
  operation: "update" | "pause" | "delete" = "update", entityType = "recurring_invoice") {
  requireRole(ctx, "manage:recurring"); const data = recurringInvoiceUpdateSchema.parse(input);
  const result = await db.transaction(async tx => {
    await lockRecurringInvoiceOrg(tx, ctx.organizationId);
    const existing = await loadRecurringInvoice(tx, ctx.organizationId, id, true);
    if (operation === "pause" && existing.status === "completed") throw new AuthError("Cannot toggle a completed template", 400);
    recurringInvoiceDates(existing.startDate, data.endDate === undefined ? existing.endDate : data.endDate);
    if (data.currencyCode && currencyMetadata(data.currencyCode).minorUnits !== currencyMetadata(existing.currencyCode).minorUnits)
      throw new WireCompatibilityError("Changing recurring currency across minor-unit scales requires recreating the template with explicit prices");
    const updates = operation === "delete" ? softDelete() : operation === "pause" ? { status: existing.status === "active" ? "paused" as const : "active" as const } : data;
    const [row] = await tx.update(recurringTemplate).set({ ...updates, updatedAt: new Date() }).where(recurringInvoiceScope(id, ctx.organizationId)).returning();
    return { existing, updated: recurringInvoiceDto(row) };
  });
  await logAudit({ ctx, action: operation === "delete" ? "delete" : "update", entityType, entityId: id,
    changes: diffChanges(result.existing, result.updated), request });
  return operation === "delete" ? { success: true } : { template: result.updated };
}
export async function previewRecurringInvoice(ctx: AuthContext, id: string, count = 5) {
  z.number().int().min(1).max(12).parse(count);
  const found = await getRecurringInvoice(ctx, id);
  if (found.status !== "active") return { upcoming: [], template: found };
  const upcoming: { date: string; occurrence: number }[] = [];
  let nextDate = found.nextRunDate, occ = found.occurrencesGenerated;
  z.number().int().min(0).max(2147483647).parse(occ);
  for (let i = 0; i < count; i++) {
    if ((found.endDate && nextDate > found.endDate) || (found.maxOccurrences !== null && occ >= found.maxOccurrences)) break;
    if (occ === 2147483647) throw new WireCompatibilityError("Recurring occurrence count exceeds int32 range");
    upcoming.push({ date: nextDate, occurrence: ++occ }); nextDate = advanceRecurringInvoiceDate(nextDate, found.frequency);
  }
  // Legacy preview is the gross extended price, before discount and tax.
  const lineTotal = recurringInvoiceTotals(found.lines, new Map(found.lines.flatMap(line => line.taxRateId ? [[line.taxRateId, 0] as const] : [])), false).subtotal;
  return { template: publicMoneyDto({ id: found.id, name: found.name, type: found.type, frequency: found.frequency,
    currencyCode: found.currencyCode, contactName: found.contact.name, lineTotal }, ["lineTotal"]), upcoming };
}
