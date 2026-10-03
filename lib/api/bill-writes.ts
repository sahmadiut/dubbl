import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { bill, billLine, organization, contact, chartAccount, taxRate, inventoryItem, warehouse, project,
  goodsReceipt, goodsReceiptLine, purchaseOrder, billPurchaseOrder, numberSequence, auditLog } from "@/lib/db/schema";
import { notDeleted, softDelete } from "@/lib/db/soft-delete";
import { currencyCodeSchema } from "@/lib/currency/zod";
import { stringifyWire } from "@/lib/money/wire";
import { AuthError, type AuthContext } from "./auth-context";
import { requireRole } from "./require-role";
import { assertNotLocked } from "./period-lock";
import { diffChanges } from "./audit";
import { publicLineDto } from "./public-money-wire";
import { invoiceInputError, safeInvoiceMinor } from "./invoice-write-wire";
import { billCreateSchema, billUpdateSchema, billWriteDto, billWriteTotals, type BillWriteLine } from "./bill-write-wire";
import { purchaseOrderReservations } from "./purchase-order-reservations";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
const scope = (id: string, org: string) => and(eq(bill.id, id), eq(bill.organizationId, org), notDeleted(bill.deletedAt));

async function references(tx: Tx, org: string, supplierId: string, lines: BillWriteLine[], historical = false) {
  const [supplier] = await tx.select().from(contact).where(and(eq(contact.id, supplierId), eq(contact.organizationId, org),
    historical ? undefined : notDeleted(contact.deletedAt))).for("share");
  if (!supplier) invoiceInputError("Bill supplier must belong to this organization and be available");
  for (const [key, table] of [["accountId", chartAccount], ["taxRateId", taxRate], ["inventoryItemId", inventoryItem],
    ["warehouseId", warehouse], ["projectId", project]] as const) {
    const ids = [...new Set(lines.flatMap(line => line[key] ? [line[key]!] : []))];
    if (!ids.length) continue;
    const rows = await tx.select({ id: table.id }).from(table).where(and(eq(table.organizationId, org), inArray(table.id, ids),
      historical ? undefined : notDeleted(table.deletedAt),
      historical || !("isActive" in table) ? undefined : eq(table.isActive, true))).for("share");
    if (rows.length !== ids.length) invoiceInputError(`Bill ${key} must belong to this organization and be available`);
  }
  const ids = [...new Set(lines.flatMap(line => line.goodsReceiptLineId ? [line.goodsReceiptLineId] : []))];
  if (ids.length) {
    const rows = await tx.select({ id: goodsReceiptLine.id }).from(goodsReceiptLine)
      .innerJoin(goodsReceipt, eq(goodsReceiptLine.goodsReceiptId, goodsReceipt.id))
      .where(and(inArray(goodsReceiptLine.id, ids), eq(goodsReceipt.organizationId, org), historical ? undefined : notDeleted(goodsReceipt.deletedAt))).for("share");
    if (rows.length !== ids.length) invoiceInputError("Bill goods receipt lines must belong to this organization and be available");
  }
  return supplier;
}
async function totals(tx: Tx, lines: BillWriteLine[], currency: string) {
  const ids = [...new Set(lines.flatMap(line => line.taxRateId ? [line.taxRateId] : []))];
  const rows = ids.length ? await tx.select({ id: taxRate.id, rate: taxRate.rate, kind: taxRate.kind }).from(taxRate).where(inArray(taxRate.id, ids)) : [];
  return billWriteTotals(lines, currency, new Map(rows.map(row => [row.id, row.rate])), new Map(rows.map(row => [row.id, row.kind])));
}
async function lockOrganization(tx: Tx, ctx: AuthContext) {
  const [org] = await tx.select().from(organization).where(eq(organization.id, ctx.organizationId)).for("update");
  if (!org) throw new AuthError("Organization not found", 404);
  return org;
}
export async function nextBillNumber(tx: Tx, org: string) {
  const [sequence] = await tx.select().from(numberSequence).where(and(eq(numberSequence.organizationId, org), eq(numberSequence.entityType, "bill"))).for("update");
  // Supplier invoice identifiers can contain arbitrary text. Seed from numeric auto-number forms only.
  const [maximum] = await tx.select({ value: sql<string>`coalesce(max(substring(${bill.billNumber} from '^(?:BILL-)?([0-9]+)$')::numeric), 0)::text` })
    .from(bill).where(eq(bill.organizationId, org));
  const saved = BigInt(sequence?.lastNumber ?? 0), used = BigInt(maximum.value);
  const next = (saved > used ? saved : used) + 1n;
  if (next < 1n || next > 2147483647n) invoiceInputError("Bill numbering exceeds signed int32 capacity");
  if (sequence) await tx.update(numberSequence).set({ lastNumber: Number(next) }).where(eq(numberSequence.id, sequence.id));
  else await tx.insert(numberSequence).values({ organizationId: org, entityType: "bill", prefix: "BILL", lastNumber: Number(next) });
  return `BILL-${String(next).padStart(5, "0")}`;
}
export class BillDuplicateError extends AuthError {
  constructor(readonly details: { duplicate: { id: string; billNumber: string }; warning?: string; hint?: string }) {
    super(`A bill with number "${details.duplicate.billNumber}" already exists for this supplier${details.hint ? `. ${details.hint}` : ""}`, 409);
  }
}
async function audit(tx: Tx, ctx: AuthContext, action: string, id: string, changes?: Record<string, unknown>, request?: Request) {
  await tx.insert(auditLog).values({ organizationId: ctx.organizationId, userId: ctx.userId, action, entityType: "bill", entityId: id,
    changes: changes ?? null, ipAddress: request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request?.headers.get("x-real-ip") || null,
    userAgent: request?.headers.get("user-agent") || null });
}

export async function createBill(ctx: AuthContext, input: unknown, transport: "rest" | "mcp", request?: Request) {
  requireRole(ctx, "manage:bills");
  const parsed = billCreateSchema.parse(input);
  return db.transaction(async tx => {
    const org = await lockOrganization(tx, ctx);
    const supplier = await references(tx, ctx.organizationId, parsed.contactId, parsed.lines);
    const currency = currencyCodeSchema.parse(parsed.currencyCode ?? (transport === "mcp" ? "USD" : supplier.currencyCode ?? org.defaultCurrency ?? "USD"));
    await assertNotLocked(ctx.organizationId, parsed.issueDate);
    const calculated = await totals(tx, parsed.lines, currency);
    const poIds = [...new Set(parsed.purchaseOrderIds ?? [])];
    if (poIds.length) {
      const rows = await tx.select({ id: purchaseOrder.id }).from(purchaseOrder).where(and(eq(purchaseOrder.organizationId, ctx.organizationId),
        inArray(purchaseOrder.id, poIds), notDeleted(purchaseOrder.deletedAt))).for("share");
      if (rows.length !== poIds.length) invoiceInputError("Bill purchase orders must belong to this organization and be available");
    }
    const supplied = parsed.billNumber?.trim();
    let held = false;
    if (supplied && org.duplicateBillStrategy !== "off") {
      const [duplicate] = await tx.select({ id: bill.id, billNumber: bill.billNumber }).from(bill).where(and(eq(bill.organizationId, ctx.organizationId),
        eq(bill.contactId, parsed.contactId), eq(bill.billNumber, supplied), ne(bill.status, "void"), notDeleted(bill.deletedAt)));
      if (duplicate) {
        const strategy = org.duplicateBillStrategy ?? "warn";
        if (strategy === "block" || (strategy === "warn" && !parsed.confirmDuplicate)) throw new BillDuplicateError({ duplicate,
          ...(strategy === "warn" ? { warning: "duplicate_bill", hint: "Resubmit with confirmDuplicate=true to create it anyway" } : {}) });
        held = strategy === "hold";
      }
    }
    const [created] = await tx.insert(bill).values({ organizationId: ctx.organizationId, contactId: parsed.contactId,
      billNumber: supplied || await nextBillNumber(tx, ctx.organizationId), issueDate: parsed.issueDate, dueDate: parsed.dueDate,
      status: parsed.submitForApproval || held ? "pending_approval" : "draft", reference: parsed.reference || null, notes: parsed.notes || null,
      currencyCode: currency, subtotal: calculated.subtotal, taxTotal: calculated.taxTotal, total: calculated.total,
      amountPaid: 0, amountDue: calculated.amountDue, createdBy: ctx.userId }).returning();
    await tx.insert(billLine).values(calculated.processedLines.map(line => ({ ...line, billId: created.id })));
    if (poIds.length) await tx.insert(billPurchaseOrder).values(poIds.map(purchaseOrderId => ({ billId: created.id, purchaseOrderId })));
    const result = { bill: billWriteDto(created), held: held || undefined };
    stringifyWire(result);
    await audit(tx, ctx, "create", created.id, undefined, request);
    return result;
  });
}
async function draft(tx: Tx, ctx: AuthContext, id: string) {
  await lockOrganization(tx, ctx);
  const [row] = await tx.select().from(bill).where(scope(id, ctx.organizationId)).for("update");
  if (!row) throw new AuthError("Bill not found", 404);
  if (row.status !== "draft") throw new AuthError("Only draft bills can be edited or deleted", 400);
  if ((await purchaseOrderReservations(tx, ctx.organizationId, id)).length)
    throw new AuthError("A converted purchase-order bill cannot be edited or deleted; void it to release its reserved quantities", 400);
  if (row.journalEntryId || row.amountPaid !== 0) throw new AuthError("A draft bill with posted bookkeeping or recorded payments cannot be edited or deleted", 400);
  stringifyWire(billWriteDto(row));
  await assertNotLocked(ctx.organizationId, row.issueDate);
  const lines = await tx.select().from(billLine).where(eq(billLine.billId, id));
  lines.forEach(publicLineDto);
  await references(tx, ctx.organizationId, row.contactId, lines.map(line => ({ ...line, quantity: line.quantity / 100 })), true);
  return row;
}
export async function updateBill(ctx: AuthContext, id: string, input: unknown, request?: Request) {
  requireRole(ctx, "manage:bills"); z.string().uuid().parse(id);
  const parsed = billUpdateSchema.parse(input);
  return db.transaction(async tx => {
    const existing = await draft(tx, ctx, id);
    await assertNotLocked(ctx.organizationId, parsed.issueDate ?? existing.issueDate);
    const patch: Partial<typeof bill.$inferInsert> = { updatedAt: new Date() };
    for (const key of ["contactId", "issueDate", "dueDate", "reference", "notes"] as const) {
      if (parsed[key] !== undefined) Object.assign(patch, { [key]: parsed[key] });
    }
    if (parsed.contactId || parsed.lines) await references(tx, ctx.organizationId, parsed.contactId ?? existing.contactId, parsed.lines ?? []);
    if (parsed.lines) {
      const calculated = await totals(tx, parsed.lines, existing.currencyCode);
      Object.assign(patch, { subtotal: calculated.subtotal, taxTotal: calculated.taxTotal, total: calculated.total,
        amountDue: safeInvoiceMinor(BigInt(calculated.amountDue) - BigInt(existing.amountPaid)) });
      await tx.delete(billLine).where(eq(billLine.billId, id));
      await tx.insert(billLine).values(calculated.processedLines.map(line => ({ ...line, billId: id })));
    }
    const [updated] = await tx.update(bill).set(patch).where(scope(id, ctx.organizationId)).returning();
    const result = { bill: billWriteDto(updated) }; stringifyWire(result);
    await audit(tx, ctx, "update", id, diffChanges(existing, updated), request);
    return result;
  });
}
export async function deleteBill(ctx: AuthContext, id: string, request?: Request) {
  requireRole(ctx, "manage:bills"); z.string().uuid().parse(id);
  return db.transaction(async tx => {
    const existing = await draft(tx, ctx, id);
    await tx.delete(billLine).where(eq(billLine.billId, id));
    await tx.update(bill).set(softDelete()).where(scope(id, ctx.organizationId));
    await audit(tx, ctx, "delete", id, existing, request);
    return { success: true };
  });
}
