import { and, count, desc, eq, isNull, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { organization, scheduledPayment, bill, contact, journalEntry, auditLog } from "@/lib/db/schema";
import { WireCompatibilityError, stringifyWire } from "@/lib/money/wire";
import { currencyCodeSchema } from "@/lib/currency/zod";
import { rateDateSchema } from "@/lib/currency/rate-policy";
import { AuthError, type AuthContext } from "./auth-context";
import { requireRole } from "./require-role";
import { assertNotLocked } from "./period-lock";
import { publicMoneyDto } from "./public-money-wire";
import { contactDto } from "./contact-wire";
import { billReadDto } from "./bill-read-wire";
import { creditAmount } from "./credit-wire";
import { paginatedResponse } from "./pagination";
import { softDelete } from "@/lib/db/soft-delete";
import { createSettlementPaymentInTransaction } from "./payment-settlements";
import { handleError } from "./response";
import { scheduledPaymentIdField, scheduledPaymentCreateSchema, scheduledPaymentUpdateSchema, scheduledPaymentListSchema } from "./scheduled-payment-wire";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Schedule = typeof scheduledPayment.$inferSelect;
type Candidate = Pick<Schedule, "billId" | "contactId" | "amount" | "currencyCode" | "scheduledDate">;
function unsupported(message: string): never { throw new WireCompatibilityError(message); }
async function lockOrganization(tx: Tx, ctx: AuthContext) {
  const [org] = await tx.select({ id: organization.id }).from(organization).where(eq(organization.id, ctx.organizationId)).for("update");
  if (!org) throw new AuthError("Organization not found", 404);
}
async function load(tx: Tx, ctx: AuthContext, id: string, lock = false) {
  const query = tx.select().from(scheduledPayment).where(and(eq(scheduledPayment.id, id),
    eq(scheduledPayment.organizationId, ctx.organizationId), isNull(scheduledPayment.deletedAt)));
  const [row] = await (lock ? query.for("update") : query);
  if (!row) throw new AuthError("Scheduled payment not found", 404);
  return row;
}
async function relations(tx: Tx, ctx: AuthContext, row: Candidate, writable = false) {
  publicMoneyDto(row, ["amount"]);
  currencyCodeSchema.parse(row.currencyCode); rateDateSchema.parse(row.scheduledDate);
  if (!row.billId || !row.contactId || row.amount <= 0) unsupported("Schedule requires positive money and bill/contact references");
  const [doc] = await tx.select().from(bill).where(and(eq(bill.id, row.billId), eq(bill.organizationId, ctx.organizationId)));
  const [party] = await tx.select().from(contact).where(and(eq(contact.id, row.contactId), eq(contact.organizationId, ctx.organizationId)));
  if (!doc || !party) unsupported("Schedule references a missing or foreign bill/contact");
  if (doc.contactId !== party.id || doc.currencyCode !== row.currencyCode) unsupported("Schedule bill/contact/currency disagree");
  if (doc.journalEntryId) {
    const [entry] = await tx.select({ id: journalEntry.id }).from(journalEntry).where(and(eq(journalEntry.id, doc.journalEntryId), eq(journalEntry.organizationId, ctx.organizationId)));
    if (!entry) unsupported("Schedule bill references a missing or foreign journal");
  }
  const dto = billReadDto({ ...doc, contact: party }, ctx.organizationId);
  if (writable && (doc.deletedAt || party.deletedAt || party.type === "customer" || !doc.journalEntryId ||
    !["received", "partial", "overdue"].includes(doc.status) || row.amount > doc.amountDue || row.scheduledDate < doc.issueDate))
    throw new AuthError("Schedule requires an available recognized outstanding supplier bill, without overpayment or pre-recognition date", 400);
  return { bill: dto, contact: contactDto(party) };
}
async function dto(tx: Tx, ctx: AuthContext, row: Schedule) {
  const result = { ...publicMoneyDto(row, ["amount"]), ...await relations(tx, ctx, row) };
  stringifyWire(result); return result;
}
async function audit(tx: Tx, ctx: AuthContext, id: string, action: string, changes: unknown, request?: Request) {
  await tx.insert(auditLog).values({ organizationId: ctx.organizationId, userId: ctx.userId, entityType: "scheduled_payment",
    entityId: id, action, changes: JSON.parse(stringifyWire(changes)),
    ipAddress: request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null, userAgent: request?.headers.get("user-agent") || null });
}

export async function listScheduledPayments(ctx: AuthContext, input: unknown) {
  const parsed = scheduledPaymentListSchema.parse(input);
  return db.transaction(async tx => {
    const where = and(eq(scheduledPayment.organizationId, ctx.organizationId), isNull(scheduledPayment.deletedAt),
      parsed.status ? eq(scheduledPayment.status, parsed.status) : undefined);
    const rows = await tx.select().from(scheduledPayment).where(where).orderBy(desc(scheduledPayment.scheduledDate), desc(scheduledPayment.id))
      .limit(parsed.limit).offset((parsed.page - 1) * parsed.limit);
    const data = []; for (const row of rows) data.push(await dto(tx, ctx, row));
    const [total] = await tx.select({ count: count() }).from(scheduledPayment).where(where);
    if (!Number.isSafeInteger(total.count)) unsupported("Schedule count exceeds safe numeric range");
    return paginatedResponse(data, total.count, parsed.page, parsed.limit);
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
export async function getScheduledPayment(ctx: AuthContext, id: string) {
  scheduledPaymentIdField.parse(id);
  return db.transaction(async tx => ({ scheduledPayment: await dto(tx, ctx, await load(tx, ctx, id)) }),
    { isolationLevel: "repeatable read", accessMode: "read only" });
}
export async function createScheduledPayment(ctx: AuthContext, input: unknown, request?: Request) {
  requireRole(ctx, "manage:payments"); const parsed = scheduledPaymentCreateSchema.parse(input), amount = creditAmount(parsed);
  return db.transaction(async tx => {
    await lockOrganization(tx, ctx);
    const { amountMinor: _alias, ...fields } = parsed; void _alias;
    await relations(tx, ctx, { ...fields, amount }, true);
    await assertNotLocked(ctx.organizationId, parsed.scheduledDate, ctx);
    const [row] = await tx.insert(scheduledPayment).values({ ...fields, amount, organizationId: ctx.organizationId }).returning();
    const result = { scheduledPayment: await dto(tx, ctx, row) };
    await audit(tx, ctx, row.id, "create", result, request); return result;
  });
}
export async function updateScheduledPayment(ctx: AuthContext, id: string, input: unknown, request?: Request) {
  requireRole(ctx, "manage:payments"); scheduledPaymentIdField.parse(id);
  const parsed = scheduledPaymentUpdateSchema.parse(input);
  const amount = parsed.amount === undefined && parsed.amountMinor === undefined ? undefined : creditAmount(parsed);
  return db.transaction(async tx => {
    await lockOrganization(tx, ctx); const existing = await load(tx, ctx, id, true);
    if (existing.status !== "pending") throw new AuthError("Only pending scheduled payments can be updated", 400);
    const before = await dto(tx, ctx, existing);
    const { amountMinor: _alias, ...fields } = parsed; void _alias;
    const next = { ...existing, ...fields, amount: amount ?? existing.amount };
    // Cancellation releases intent even after another valid payment settles the bill.
    await relations(tx, ctx, next, parsed.status !== "cancelled");
    await assertNotLocked(ctx.organizationId, existing.scheduledDate, ctx);
    await assertNotLocked(ctx.organizationId, next.scheduledDate, ctx);
    const [row] = await tx.update(scheduledPayment).set({ ...fields, amount: next.amount, updatedAt: new Date() })
      .where(and(eq(scheduledPayment.id, id), eq(scheduledPayment.organizationId, ctx.organizationId))).returning();
    const result = { scheduledPayment: await dto(tx, ctx, row) };
    await audit(tx, ctx, id, "update", { before, after: result.scheduledPayment }, request); return result;
  });
}
export async function deleteScheduledPayment(ctx: AuthContext, id: string, request?: Request) {
  requireRole(ctx, "manage:payments"); scheduledPaymentIdField.parse(id);
  return db.transaction(async tx => {
    await lockOrganization(tx, ctx); const existing = await load(tx, ctx, id, true);
    if (!["pending", "cancelled", "failed"].includes(existing.status)) throw new AuthError("Processing or completed schedules cannot be deleted; reverse their payment separately", 400);
    const before = await dto(tx, ctx, existing);
    await assertNotLocked(ctx.organizationId, existing.scheduledDate, ctx);
    await tx.update(scheduledPayment).set({ ...softDelete(), updatedAt: new Date() })
      .where(and(eq(scheduledPayment.id, id), eq(scheduledPayment.organizationId, ctx.organizationId)));
    await audit(tx, ctx, id, "delete", before, request); return { success: true };
  });
}

/** Each schedule is independently atomic; retries reread status under the same org lock as settlement. */
export async function processScheduledPayments(ctx: AuthContext, request?: Request) {
  requireRole(ctx, "manage:payments");
  const today = new Date().toISOString().slice(0, 10);
  // Select only IDs here: an unsupported saved amount must not prevent other valid schedules from running.
  const due = await db.select({ id: scheduledPayment.id }).from(scheduledPayment).where(and(
    eq(scheduledPayment.organizationId, ctx.organizationId), eq(scheduledPayment.status, "pending"),
    isNull(scheduledPayment.deletedAt), lte(scheduledPayment.scheduledDate, today)))
    .orderBy(scheduledPayment.scheduledDate, scheduledPayment.id);
  let processed = 0, skipped = 0;
  const failures: { scheduledPaymentId: string; status: number; error: string; code?: string }[] = [];
  for (const { id } of due) {
    try {
      const completed = await db.transaction(async tx => {
        await lockOrganization(tx, ctx);
        const [row] = await tx.select().from(scheduledPayment).where(and(eq(scheduledPayment.id, id),
          eq(scheduledPayment.organizationId, ctx.organizationId))).for("update");
        if (!row || row.deletedAt || row.status !== "pending" || row.scheduledDate > today) return false;
        await relations(tx, ctx, row, true);
        const result = await createSettlementPaymentInTransaction(ctx, { type: "made", contactId: row.contactId,
          currencyCode: row.currencyCode, date: row.scheduledDate, amount: row.amount, notes: row.notes,
          allocations: [{ documentId: row.billId, documentType: "bill", amount: row.amount }] }, tx, request);
        const now = new Date();
        await tx.update(scheduledPayment).set({ status: "completed", processedAt: now, updatedAt: now })
          .where(and(eq(scheduledPayment.id, id), eq(scheduledPayment.organizationId, ctx.organizationId)));
        await audit(tx, ctx, id, "process", { paymentId: (result.payment as { id: string }).id,
          amountMinor: String(row.amount), currencyCode: row.currencyCode, scheduledDate: row.scheduledDate }, request);
        return true;
      });
      if (completed) processed++; else skipped++;
    } catch (error) {
      // The whole item (including status, numbering and audits) rolled back. Do not
      // strand it as processing/failed; keep pending and report a classified failure.
      const response = handleError(error);
      const body = await response.json() as { error: string; code?: string };
      failures.push({ scheduledPaymentId: id, status: response.status, ...body });
    }
  }
  return { processed, total: due.length, skipped, failed: failures.length, failures };
}
