import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { organization, contact, chartAccount, taxRate, purchaseRequisition, purchaseRequisitionLine,
  purchaseOrder, purchaseOrderLine, numberSequence, auditLog } from "@/lib/db/schema";
import { notDeleted, softDelete } from "@/lib/db/soft-delete";
import { currencyCodeSchema } from "@/lib/currency/zod";
import { rateDateSchema } from "@/lib/currency/rate-policy";
import { stringifyWire } from "@/lib/money/wire";
import { AuthError, type AuthContext } from "./auth-context";
import { requireRole } from "./require-role";
import { assertNotLocked } from "./period-lock";
import { diffChanges } from "./audit";
import { contactDto } from "./contact-wire";
import { publicLineDto } from "./public-money-wire";
import { invoiceInputError } from "./invoice-write-wire";
import { nextPurchaseOrderNumber } from "./purchase-orders";
import { purchaseOrderDto } from "./purchase-order-wire";
import { requisitionCreateSchema, requisitionUpdateSchema, requisitionListSchema, requisitionRejectSchema,
  requisitionTotals, requisitionDto, validateRequisition } from "./purchase-requisition-wire";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
const scope = (ctx: AuthContext, id: string) => and(eq(purchaseRequisition.id, id),
  eq(purchaseRequisition.organizationId, ctx.organizationId), notDeleted(purchaseRequisition.deletedAt));
async function lockOrganization(tx: Tx, ctx: AuthContext) {
  const [org] = await tx.select({ id: organization.id }).from(organization).where(eq(organization.id, ctx.organizationId)).for("update");
  if (!org) throw new AuthError("Organization not found", 404);
}
async function references(tx: Tx, org: string, supplierId: string | null | undefined,
  lines: { accountId?: string | null; taxRateId?: string | null }[], historical = false, lock = true) {
  if (supplierId) {
    const query = tx.select().from(contact).where(and(eq(contact.id, supplierId), eq(contact.organizationId, org),
      historical ? undefined : notDeleted(contact.deletedAt)));
    const [supplier] = await (lock ? query.for("share") : query);
    if (!supplier) invoiceInputError("Requisition supplier must belong to this organization and be available");
    if (historical) contactDto(supplier); // Guard all disclosed supplier monetary fields before writes.
  }
  for (const [key, table] of [["accountId", chartAccount], ["taxRateId", taxRate]] as const) {
    const ids = [...new Set(lines.flatMap(line => line[key] ? [line[key]!] : []))];
    if (!ids.length) continue;
    const query = tx.select({ id: table.id }).from(table).where(and(eq(table.organizationId, org), inArray(table.id, ids),
      historical ? undefined : notDeleted(table.deletedAt), historical ? undefined : eq(table.isActive, true)));
    const rows = await (lock ? query.for("share") : query);
    if (rows.length !== ids.length) invoiceInputError(`Requisition ${key} must belong to this organization and be available`);
  }
}
async function linkedOrder(tx: Tx, ctx: AuthContext, row: typeof purchaseRequisition.$inferSelect, lock = true) {
  if (!row.convertedPoId) return;
  const query = tx.select({ id: purchaseOrder.id }).from(purchaseOrder)
    .where(and(eq(purchaseOrder.id, row.convertedPoId), eq(purchaseOrder.organizationId, ctx.organizationId)));
  const [linked] = await (lock ? query.for("share") : query);
  if (!linked) invoiceInputError("Converted purchase order must belong to this organization");
}
async function nextNumber(tx: Tx, org: string) {
  const [sequence] = await tx.select().from(numberSequence).where(and(eq(numberSequence.organizationId, org),
    eq(numberSequence.entityType, "purchase_requisition"))).for("update");
  const [maximum] = await tx.select({ value: sql<string>`coalesce(max(substring(${purchaseRequisition.requisitionNumber} from '^(?:REQ-)?([0-9]+)$')::numeric), 0)::text` })
    .from(purchaseRequisition).where(eq(purchaseRequisition.organizationId, org));
  const saved = BigInt(sequence?.lastNumber ?? 0), used = BigInt(maximum.value), next = (saved > used ? saved : used) + 1n;
  if (next < 1n || next > 2147483647n) invoiceInputError("Requisition numbering exceeds signed int32 capacity");
  if (sequence) await tx.update(numberSequence).set({ lastNumber: Number(next) }).where(eq(numberSequence.id, sequence.id));
  else await tx.insert(numberSequence).values({ organizationId: org, entityType: "purchase_requisition", prefix: "REQ", lastNumber: Number(next) });
  return `REQ-${String(next).padStart(5, "0")}`;
}
async function audit(tx: Tx, ctx: AuthContext, id: string, action: string, changes?: Record<string, unknown>, request?: Request) {
  await tx.insert(auditLog).values({ organizationId: ctx.organizationId, userId: ctx.userId, entityType: "purchase_requisition", entityId: id,
    action, changes: changes ?? null, ipAddress: request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request?.headers.get("x-real-ip") || null,
    userAgent: request?.headers.get("user-agent") || null });
}
async function load(tx: Tx, ctx: AuthContext, id: string) {
  await lockOrganization(tx, ctx);
  const [found] = await tx.select().from(purchaseRequisition).where(scope(ctx, id)).for("update");
  if (!found) throw new AuthError("Purchase requisition not found", 404);
  currencyCodeSchema.parse(found.currencyCode); rateDateSchema.parse(found.requestDate);
  if (found.requiredDate) rateDateSchema.parse(found.requiredDate);
  const lines = await tx.select().from(purchaseRequisitionLine).where(eq(purchaseRequisitionLine.requisitionId, id))
    .orderBy(asc(purchaseRequisitionLine.sortOrder), asc(purchaseRequisitionLine.id)).for("update");
  validateRequisition(found, lines);
  await references(tx, ctx.organizationId, found.contactId, lines, true);
  await linkedOrder(tx, ctx, found);
  if ((found.status === "converted") !== !!found.convertedPoId) invoiceInputError("Requisition conversion status and link must agree");
  await assertNotLocked(ctx.organizationId, found.requestDate);
  return { found, lines };
}
export async function createPurchaseRequisition(ctx: AuthContext, input: unknown, request?: Request) {
  requireRole(ctx, "manage:purchases"); const parsed = requisitionCreateSchema.parse(input);
  return db.transaction(async tx => {
    await lockOrganization(tx, ctx);
    await references(tx, ctx.organizationId, parsed.contactId, parsed.lines);
    await assertNotLocked(ctx.organizationId, parsed.requestDate);
    const calculated = requisitionTotals(parsed.lines, parsed.currencyCode);
    const [created] = await tx.insert(purchaseRequisition).values({ organizationId: ctx.organizationId, contactId: parsed.contactId ?? null,
      requisitionNumber: await nextNumber(tx, ctx.organizationId), requestDate: parsed.requestDate, requiredDate: parsed.requiredDate ?? null,
      reference: parsed.reference ?? null, notes: parsed.notes ?? null, currencyCode: parsed.currencyCode,
      subtotal: calculated.subtotal, taxTotal: 0, total: calculated.total, requestedBy: ctx.userId }).returning();
    await tx.insert(purchaseRequisitionLine).values(calculated.processedLines.map(line => ({ ...line, requisitionId: created.id })));
    const result = { requisition: requisitionDto(created) }; stringifyWire(result);
    await audit(tx, ctx, created.id, "create", { requisitionNumber: created.requisitionNumber, total: created.total }, request);
    return result;
  });
}
export async function updatePurchaseRequisition(ctx: AuthContext, id: string, input: unknown, request?: Request) {
  requireRole(ctx, "manage:purchases"); z.string().uuid().parse(id); const parsed = requisitionUpdateSchema.parse(input);
  return db.transaction(async tx => {
    const { found, lines } = await load(tx, ctx, id);
    if (found.status !== "draft") throw new AuthError("Only draft requisitions can be edited or submitted", 400);
    if (parsed.contactId !== undefined || parsed.status) await references(tx, ctx.organizationId,
      parsed.contactId === undefined ? found.contactId : parsed.contactId, lines);
    const [updated] = await tx.update(purchaseRequisition).set({ ...parsed, updatedAt: new Date() }).where(scope(ctx, id)).returning();
    const result = { requisition: requisitionDto(updated) }; stringifyWire(result);
    await audit(tx, ctx, id, parsed.status ? "submit" : "update", diffChanges(found, updated), request); return result;
  });
}
export async function submitPurchaseRequisition(ctx: AuthContext, id: string, request?: Request) {
  return updatePurchaseRequisition(ctx, id, { status: "submitted" }, request);
}
export async function deletePurchaseRequisition(ctx: AuthContext, id: string, request?: Request) {
  requireRole(ctx, "manage:purchases"); z.string().uuid().parse(id);
  return db.transaction(async tx => {
    const { found } = await load(tx, ctx, id);
    if (found.status !== "draft") throw new AuthError("Only draft requisitions can be deleted", 400);
    // Keep the saved lines for historical/trash recovery, as the existing REST DELETE does.
    await tx.update(purchaseRequisition).set(softDelete()).where(scope(ctx, id));
    await audit(tx, ctx, id, "delete", found, request); return { success: true };
  });
}
export async function decidePurchaseRequisition(ctx: AuthContext, id: string, decision: "approve" | "reject", input: unknown = {}, request?: Request) {
  requireRole(ctx, "approve:purchases"); z.string().uuid().parse(id); const parsed = requisitionRejectSchema.parse(input);
  return db.transaction(async tx => {
    const { found, lines } = await load(tx, ctx, id);
    if (found.status !== "submitted") throw new AuthError("Purchase requisition is not awaiting approval", 400);
    await references(tx, ctx.organizationId, found.contactId, lines);
    const now = new Date();
    const [updated] = await tx.update(purchaseRequisition).set({ updatedAt: now, ...(decision === "approve" ?
      { status: "approved" as const, approvedBy: ctx.userId, approvedAt: now } :
      { status: "rejected" as const, rejectedAt: now, rejectionReason: parsed.reason ?? null }) }).where(scope(ctx, id)).returning();
    const result = { requisition: requisitionDto(updated) }; stringifyWire(result);
    await audit(tx, ctx, id, decision, { previousStatus: found.status, ...(decision === "reject" ? { reason: parsed.reason ?? null } : {}) }, request);
    return result;
  });
}
export async function convertPurchaseRequisition(ctx: AuthContext, id: string, request?: Request) {
  requireRole(ctx, "manage:purchases"); z.string().uuid().parse(id);
  return db.transaction(async tx => {
    const { found, lines } = await load(tx, ctx, id);
    if (found.status !== "approved") throw new AuthError("Only approved requisitions can be converted", 400);
    if (!found.contactId) throw new AuthError("Requisition must have a contact to convert", 400);
    await references(tx, ctx.organizationId, found.contactId, lines);
    const today = new Date().toISOString().slice(0, 10);
    await assertNotLocked(ctx.organizationId, today);
    const [po] = await tx.insert(purchaseOrder).values({ organizationId: ctx.organizationId, contactId: found.contactId,
      poNumber: await nextPurchaseOrderNumber(tx, ctx.organizationId), issueDate: today, deliveryDate: found.requiredDate,
      reference: found.reference, notes: found.notes, subtotal: found.subtotal, taxTotal: found.taxTotal,
      total: found.total, currencyCode: found.currencyCode, createdBy: ctx.userId }).returning();
    await tx.insert(purchaseOrderLine).values(lines.map(line => ({ purchaseOrderId: po.id, description: line.description,
      quantity: line.quantity, unitPrice: line.unitPrice, accountId: line.accountId, taxRateId: line.taxRateId,
      taxAmount: line.taxAmount, amount: line.amount, sortOrder: line.sortOrder })));
    await tx.update(purchaseRequisition).set({ status: "converted", convertedPoId: po.id, updatedAt: new Date() }).where(scope(ctx, id));
    const result = { purchaseOrder: purchaseOrderDto(po) }; stringifyWire(result);
    await audit(tx, ctx, id, "convert", { previousStatus: found.status, purchaseOrderId: po.id }, request); return result;
  });
}
async function readDto(tx: Tx, ctx: AuthContext, row: typeof purchaseRequisition.$inferSelect & {
  contact: typeof contact.$inferSelect | null; lines: (typeof purchaseRequisitionLine.$inferSelect)[] }) {
  currencyCodeSchema.parse(row.currencyCode); rateDateSchema.parse(row.requestDate);
  if (row.requiredDate) rateDateSchema.parse(row.requiredDate);
  validateRequisition(row, row.lines);
  await references(tx, ctx.organizationId, row.contactId, row.lines, true, false);
  await linkedOrder(tx, ctx, row, false);
  if ((row.status === "converted") !== !!row.convertedPoId) invoiceInputError("Requisition conversion status and link must agree");
  const result = { ...requisitionDto(row), contact: row.contact ? contactDto(row.contact) : null, lines: row.lines.map(publicLineDto) };
  stringifyWire(result); return result;
}
export async function getPurchaseRequisition(ctx: AuthContext, id: string) {
  z.string().uuid().parse(id);
  return db.transaction(async tx => {
    const found = await tx.query.purchaseRequisition.findFirst({ where: scope(ctx, id),
      with: { contact: true, lines: { orderBy: [asc(purchaseRequisitionLine.sortOrder), asc(purchaseRequisitionLine.id)] } } });
    if (!found) throw new AuthError("Purchase requisition not found", 404);
    return { requisition: await readDto(tx, ctx, found) };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
export async function listPurchaseRequisitions(ctx: AuthContext, input: unknown) {
  const parsed = requisitionListSchema.parse(input);
  const conditions = [eq(purchaseRequisition.organizationId, ctx.organizationId), notDeleted(purchaseRequisition.deletedAt)];
  if (parsed.status) conditions.push(eq(purchaseRequisition.status, parsed.status));
  return db.transaction(async tx => {
    const rows = await tx.query.purchaseRequisition.findMany({ where: and(...conditions), orderBy: [desc(purchaseRequisition.createdAt), desc(purchaseRequisition.id)],
      limit: parsed.limit, offset: (parsed.page - 1) * parsed.limit, with: { contact: true,
        lines: { orderBy: [asc(purchaseRequisitionLine.sortOrder), asc(purchaseRequisitionLine.id)] } } });
    const requisitions = []; for (const row of rows) requisitions.push(await readDto(tx, ctx, row));
    const [total] = await tx.select({ count: count() }).from(purchaseRequisition).where(and(...conditions));
    return { requisitions, total: total.count, page: parsed.page, limit: parsed.limit };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
