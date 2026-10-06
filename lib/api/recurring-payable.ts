import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { recurringTemplate, recurringTemplateLine, member, auditLog, bill, billLine, expenseClaim, expenseItem } from "@/lib/db/schema";
import { notDeleted, softDelete } from "@/lib/db/soft-delete";
import { AuthError, type AuthContext } from "./auth-context";
import { requireRole } from "./require-role";
import { lockTaxOrganization, auditTax, type TaxTx } from "./tax-config-transaction";
import { references, taxRates } from "./invoice-writes";
import { recurringInvoiceReferences } from "./recurring-invoice";
import { advanceRecurringInvoiceDate } from "./recurring-invoice-wire";
import { recurringPayableCreateSchema, recurringPayableUpdateSchema, recurringPayableStoredLines,
  recurringPayableDates, recurringPayableTotals, recurringPayableDto } from "./recurring-payable-wire";
import { WireCompatibilityError, stringifyWire } from "@/lib/money/wire";
import { publicMoneyDto } from "./public-money-wire";
import { billWriteDto } from "./bill-write-wire";
import { nextBillNumber } from "./bill-writes";
import { assertNotLocked } from "./period-lock";

export const recurringPayableScope = (id: string, orgId: string) => and(eq(recurringTemplate.id, id), eq(recurringTemplate.organizationId, orgId),
  inArray(recurringTemplate.type, ["bill", "expense"]), notDeleted(recurringTemplate.deletedAt));
export async function loadRecurringPayable(tx: TaxTx, orgId: string, id: string, lock = false) {
  z.string().uuid().parse(id);
  const q = tx.select().from(recurringTemplate).where(recurringPayableScope(id, orgId));
  const [header] = await (lock ? q.for("update") : q);
  if (!header) throw new AuthError("Recurring payable template not found", 404);
  recurringPayableCreateSchema.omit({ lines: true }).strip().parse(header);
  recurringPayableDates(header.startDate, header.endDate);
  z.iso.date().parse(header.nextRunDate);
  z.enum(["active", "paused", "completed"]).parse(header.status);
  z.number().int().min(0).max(2147483647).parse(header.occurrencesGenerated);
  if (header.nextRunDate < header.startDate) throw new WireCompatibilityError("Recurring next run precedes start date");
  const lines = await tx.select().from(recurringTemplateLine).where(eq(recurringTemplateLine.templateId, id)).orderBy(recurringTemplateLine.sortOrder, recurringTemplateLine.id);
  const refs = recurringInvoiceReferences(lines);
  const supplier = await references(tx, orgId, header.contactId!, refs);
  recurringPayableTotals(lines, await taxRates(tx, refs), header.type);
  return recurringPayableDto({ ...header, lines, contact: supplier });
}
export const getRecurringPayable = (ctx: AuthContext, id: string) => db.transaction(tx => loadRecurringPayable(tx, ctx.organizationId, id));
export async function createRecurringPayable(ctx: AuthContext, input: unknown, request?: Request) {
  requireRole(ctx, "manage:recurring"); const data = recurringPayableCreateSchema.parse(input);
  recurringPayableDates(data.startDate, data.endDate);
  const lines = recurringPayableStoredLines(data.lines);
  return db.transaction(async tx => {
    await lockTaxOrganization(tx, ctx.organizationId);
    const refs = recurringInvoiceReferences(lines);
    const supplier = await references(tx, ctx.organizationId, data.contactId, refs);
    recurringPayableTotals(lines, await taxRates(tx, refs), data.type);
    recurringPayableDto({ currencyCode: data.currencyCode, organizationId: ctx.organizationId, contact: supplier });
    const { lines: _lines, ...header } = data; void _lines;
    const [row] = await tx.insert(recurringTemplate).values({ ...header, organizationId: ctx.organizationId,
      nextRunDate: data.startDate, createdBy: ctx.userId }).returning();
    await tx.insert(recurringTemplateLine).values(lines.map(l => ({ ...l, templateId: row.id })));
    await loadRecurringPayable(tx, ctx.organizationId, row.id); // Validate persisted lines and output before commit.
    const result = { template: recurringPayableDto(row) }; stringifyWire(result);
    await auditTax(tx, ctx.organizationId, "recurring_template", row.id, "create", result, ctx, request);
    return result;
  });
}
export async function changeRecurringPayable(ctx: AuthContext, id: string, input: unknown, request?: Request, operation: "update" | "pause" | "delete" = "update") {
  requireRole(ctx, "manage:recurring"); const data = recurringPayableUpdateSchema.parse(input);
  return db.transaction(async tx => {
    await lockTaxOrganization(tx, ctx.organizationId);
    const existing = await loadRecurringPayable(tx, ctx.organizationId, id, true);
    recurringPayableDates(existing.startDate, data.endDate === undefined ? existing.endDate : data.endDate);
    if (operation === "pause" && existing.status === "completed") throw new AuthError("Cannot toggle a completed template", 400);
    const updates = operation === "delete" ? softDelete() : operation === "pause" ? { status: existing.status === "active" ? "paused" as const : "active" as const } : data;
    const [row] = await tx.update(recurringTemplate).set({ ...updates, updatedAt: new Date() }).where(recurringPayableScope(id, ctx.organizationId)).returning();
    const result = operation === "delete" ? { success: true } : { template: recurringPayableDto(row) }; stringifyWire(result);
    await auditTax(tx, ctx.organizationId, "recurring_template", id, operation === "delete" ? "delete" : "update", result, ctx, request);
    return result;
  });
}
export async function previewRecurringPayable(ctx: AuthContext, id: string, count = 5) {
  z.number().int().min(1).max(12).parse(count);
  const tmpl = await getRecurringPayable(ctx, id);
  if (tmpl.status !== "active") return { template: tmpl, upcoming: [] };
  const upcoming: { date: string; occurrence: number }[] = [];
  let date = tmpl.nextRunDate, occurrence = tmpl.occurrencesGenerated;
  while (upcoming.length < count && (!tmpl.endDate || date <= tmpl.endDate) && (tmpl.maxOccurrences === null || occurrence < tmpl.maxOccurrences)) {
    if (occurrence === 2147483647) throw new WireCompatibilityError("Recurring count exceeds int32 range");
    upcoming.push({ date, occurrence: ++occurrence }); date = advanceRecurringInvoiceDate(date, tmpl.frequency);
  }
  const lineTotal = recurringPayableTotals(tmpl.lines, new Map(), tmpl.type, true).subtotal;
  return { template: publicMoneyDto({ id: tmpl.id, name: tmpl.name, type: tmpl.type, frequency: tmpl.frequency,
    currencyCode: tmpl.currencyCode, contactName: tmpl.contact.name, lineTotal }, ["lineTotal"]), upcoming };
}
/** Entire catch-up, numbering, documents, audit and schedule commit together. */
export async function processRecurringPayableTemplate(orgId: string, id: string, today: string) {
  z.iso.date().parse(today);
  return db.transaction(async tx => {
    await lockTaxOrganization(tx, orgId);
    const [candidate] = await tx.select().from(recurringTemplate).where(recurringPayableScope(id, orgId)).for("update");
    if (!candidate || candidate.status !== "active" || candidate.nextRunDate > today) return 0;
    const tmpl = await loadRecurringPayable(tx, orgId, id, true);
    const [creator] = tmpl.createdBy ? await tx.select({ userId: member.userId }).from(member)
      .where(and(eq(member.organizationId, orgId), eq(member.userId, tmpl.createdBy))).for("share") : [];
    if (!creator) throw new WireCompatibilityError("Recurring payable creator must remain an organization member");
    const calculated = recurringPayableTotals(tmpl.lines, await taxRates(tx, recurringInvoiceReferences(tmpl.lines)), tmpl.type);
    const terms = tmpl.type === "bill" ? z.number().int().min(0).max(2147483647).parse(tmpl.contact.paymentTermsDays ?? 30) : 0;
    let date = tmpl.nextRunDate, occurrences = tmpl.occurrencesGenerated;
    const dates: { issueDate: string; dueDate: string }[] = [];
    await tx.execute(sql`lock table period_lock, fiscal_year in share mode`);
    while (date <= today && (!tmpl.endDate || date <= tmpl.endDate) && (tmpl.maxOccurrences === null || occurrences < tmpl.maxOccurrences)) {
      if (dates.length >= 1000) throw new WireCompatibilityError("Recurring catch-up supports at most 1000 occurrences per template");
      if (occurrences === 2147483647) throw new WireCompatibilityError("Recurring count exceeds int32 range");
      await assertNotLocked(orgId, date, undefined, tx);
      const due = new Date(`${date}T00:00:00Z`); due.setUTCDate(due.getUTCDate() + terms);
      const dueDate = due.toISOString().split("T")[0]; z.iso.date().parse(dueDate);
      dates.push({ issueDate: date, dueDate }); date = advanceRecurringInvoiceDate(date, tmpl.frequency); occurrences++;
    }
    for (const run of dates) {
      let output;
      if (tmpl.type === "bill") {
        const [row] = await tx.insert(bill).values({ organizationId: orgId, contactId: tmpl.contactId!, billNumber: await nextBillNumber(tx, orgId),
          ...run, reference: tmpl.reference, notes: tmpl.notes, currencyCode: tmpl.currencyCode, createdBy: creator.userId,
          subtotal: calculated.subtotal, taxTotal: calculated.taxTotal, total: calculated.total, amountPaid: 0, amountDue: calculated.total }).returning();
        const lines = await tx.insert(billLine).values(calculated.processedLines.map(l => ({ ...l, billId: row.id }))).returning();
        output = { ...billWriteDto(row), lines: lines.map(l => publicMoneyDto(l, ["unitPrice", "amount", "taxAmount"])) };
      } else {
        const [row] = await tx.insert(expenseClaim).values({ organizationId: orgId, title: tmpl.name, description: tmpl.notes,
          submittedBy: creator.userId, totalAmount: calculated.total, currencyCode: tmpl.currencyCode }).returning();
        const items = await tx.insert(expenseItem).values(calculated.processedLines.map(l => ({ expenseClaimId: row.id,
          date: run.issueDate, description: l.description, amount: l.amount, accountId: l.accountId, sortOrder: l.sortOrder }))).returning();
        output = { ...publicMoneyDto(row, ["totalAmount"]), items: items.map(l => publicMoneyDto(l, ["amount"])) };
      }
      stringifyWire(output);
      await tx.insert(auditLog).values({ organizationId: orgId, userId: creator.userId, entityType: "recurring_template",
        entityId: id, action: "generate", changes: JSON.parse(stringifyWire({ occurrenceDate: run.issueDate, document: output })) });
    }
    const completed = (tmpl.maxOccurrences !== null && occurrences >= tmpl.maxOccurrences) || (tmpl.endDate !== null && date > tmpl.endDate);
    const [saved] = await tx.update(recurringTemplate).set({ nextRunDate: date, occurrencesGenerated: occurrences,
      lastRunDate: today, status: completed ? "completed" : "active", updatedAt: new Date() }).where(recurringPayableScope(id, orgId)).returning();
    recurringPayableDto(saved); return dates.length;
  });
}

/** Existing org-wide counters include all recurring types, including journals. */
export async function recurringTemplateSummary(ctx: AuthContext) {
  const [row] = await db.select({
    totalCount: sql<string>`count(*)::text`,
    activeCount: sql<string>`count(*) filter (where ${recurringTemplate.status} = 'active')::text`,
    pausedCount: sql<string>`count(*) filter (where ${recurringTemplate.status} = 'paused')::text`,
    completedCount: sql<string>`count(*) filter (where ${recurringTemplate.status} = 'completed')::text`,
    totalGenerated: sql<string>`coalesce(sum(${recurringTemplate.occurrencesGenerated}), 0)::text`,
  }).from(recurringTemplate).where(and(eq(recurringTemplate.organizationId, ctx.organizationId), notDeleted(recurringTemplate.deletedAt)));
  const result = Object.fromEntries(Object.entries(row).map(([key, value]) => {
    const count = BigInt(value); if (count < 0n || count > BigInt(Number.MAX_SAFE_INTEGER)) throw new WireCompatibilityError("Recurring counter exceeds safe numeric range");
    return [key, Number(count)];
  })); stringifyWire(result); return result;
}
