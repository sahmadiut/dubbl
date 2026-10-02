import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { recurringTemplate, recurringTemplateLine } from "@/lib/db/schema";
import { notDeleted, softDelete } from "@/lib/db/soft-delete";
import { AuthError, type AuthContext } from "./auth-context";
import { requireRole } from "./require-role";
import { assertJournalReferences } from "./journal-references";
import { logAudit, diffChanges } from "./audit";
import { assertRecurringJournalDates, assertRecurringJournalRate, recurringJournalCreateSchema,
  recurringJournalUpdateSchema, recurringJournalLegs, recurringJournalDto, recurringJournalCreateHeader, recurringJournalUpdateHeader } from "./recurring-journal-wire";

export function recurringJournalScope(id: string, organizationId: string) {
  return and(eq(recurringTemplate.id, id), eq(recurringTemplate.organizationId, organizationId),
    eq(recurringTemplate.type, "journal"), notDeleted(recurringTemplate.deletedAt));
}
export async function getRecurringJournal(ctx: AuthContext, id: string) {
  const found = await db.query.recurringTemplate.findFirst({ where: recurringJournalScope(id, ctx.organizationId), with: { lines: true } });
  if (!found) throw new AuthError("Recurring journal not found", 404);
  await assertJournalReferences(ctx.organizationId, found.lines.map(line => ({ accountId: line.accountId ?? undefined, costCenterId: line.costCenterId })), undefined, true);
  return recurringJournalDto(found);
}

export async function createRecurringJournal(ctx: AuthContext, input: unknown, request?: Request) {
  requireRole(ctx, "manage:recurring");
  const parsed = recurringJournalCreateSchema.parse(input);
  assertRecurringJournalDates(parsed.startDate, parsed.endDate);
  assertRecurringJournalRate(parsed);
  const legs = recurringJournalLegs(parsed.lines, parsed.currencyCode);
  await assertJournalReferences(ctx.organizationId, legs);
  const created = await db.transaction(async tx => {
    const header = recurringJournalCreateHeader.parse(parsed);
    const [row] = await tx.insert(recurringTemplate).values({ ...header, organizationId: ctx.organizationId, type: "journal",
      contactId: null, nextRunDate: parsed.startDate, createdBy: ctx.userId }).returning();
    await tx.insert(recurringTemplateLine).values(legs.map((leg, sortOrder) => ({ templateId: row.id, description: leg.description!,
      accountId: leg.accountId, debitAmount: leg.debitAmount, creditAmount: leg.creditAmount, costCenterId: leg.costCenterId ?? null, sortOrder })));
    return recurringJournalDto(row);
  });
  await logAudit({ ctx, action: "create", entityType: "recurring_journal", entityId: created.id, request });
  return { template: created };
}

export async function updateRecurringJournal(ctx: AuthContext, id: string, input: unknown, request?: Request) {
  requireRole(ctx, "manage:recurring");
  const parsed = recurringJournalUpdateSchema.parse(input);
  assertRecurringJournalRate(parsed);
  const result = await db.transaction(async tx => {
    const [existing] = await tx.select().from(recurringTemplate).where(recurringJournalScope(id, ctx.organizationId)).for("update");
    if (!existing) throw new AuthError("Recurring journal not found", 404);
    assertRecurringJournalDates(existing.startDate, parsed.endDate === undefined ? existing.endDate : parsed.endDate);
    const savedLines = await tx.select().from(recurringTemplateLine).where(eq(recurringTemplateLine.templateId, id));
    const currencyCode = parsed.currencyCode ?? existing.currencyCode;
    // Validate retained legs too: metadata edits cannot activate malformed/unsafe history.
    const legs = recurringJournalLegs(parsed.lines ?? savedLines.map(line => ({ description: line.description, accountId: line.accountId,
      debitAmount: line.debitAmount, creditAmount: line.creditAmount, costCenterId: line.costCenterId })), currencyCode);
    await assertJournalReferences(ctx.organizationId, legs);
    const header = recurringJournalUpdateHeader.parse(parsed);
    const [updated] = await tx.update(recurringTemplate).set({ ...header, updatedAt: new Date() }).where(recurringJournalScope(id, ctx.organizationId)).returning();
    if (parsed.lines) {
      await tx.delete(recurringTemplateLine).where(eq(recurringTemplateLine.templateId, id));
      await tx.insert(recurringTemplateLine).values(legs.map((leg, sortOrder) => ({ templateId: id, description: leg.description!,
        accountId: leg.accountId, debitAmount: leg.debitAmount, creditAmount: leg.creditAmount, costCenterId: leg.costCenterId ?? null, sortOrder })));
    }
    return { existing, template: recurringJournalDto(updated) };
  });
  await logAudit({ ctx, action: "update", entityType: "recurring_journal", entityId: id,
    changes: diffChanges(result.existing, result.template), request });
  return { template: result.template };
}

export async function pauseRecurringJournal(ctx: AuthContext, id: string, request?: Request) {
  requireRole(ctx, "manage:recurring");
  const updated = await db.transaction(async tx => {
    const [existing] = await tx.select().from(recurringTemplate).where(recurringJournalScope(id, ctx.organizationId)).for("update");
    if (!existing) throw new AuthError("Recurring journal not found", 404);
    if (existing.status === "completed") throw new AuthError("Cannot toggle a completed template", 400);
    const dto = recurringJournalDto(existing); // Before mutation.
    const status = existing.status === "active" ? "paused" : "active";
    if (status === "active") {
      const lines = await tx.select().from(recurringTemplateLine).where(eq(recurringTemplateLine.templateId, id));
      const legs = recurringJournalLegs(lines.map(line => ({ description: line.description, accountId: line.accountId,
        debitAmount: line.debitAmount, creditAmount: line.creditAmount, costCenterId: line.costCenterId })), dto.currencyCode);
      await assertJournalReferences(ctx.organizationId, legs);
    }
    const [row] = await tx.update(recurringTemplate).set({ status, updatedAt: new Date() }).where(recurringJournalScope(id, ctx.organizationId)).returning();
    return recurringJournalDto(row);
  });
  await logAudit({ ctx, action: "update", entityType: "recurring_journal", entityId: id, changes: { status: updated.status }, request });
  return { template: updated };
}

export async function deleteRecurringJournal(ctx: AuthContext, id: string, request?: Request) {
  requireRole(ctx, "manage:recurring");
  const [deleted] = await db.update(recurringTemplate).set(softDelete()).where(recurringJournalScope(id, ctx.organizationId)).returning({ id: recurringTemplate.id });
  if (!deleted) throw new AuthError("Recurring journal not found", 404);
  await logAudit({ ctx, action: "delete", entityType: "recurring_journal", entityId: id, request });
  return { success: true };
}
