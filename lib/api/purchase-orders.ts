import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { organization, contact, chartAccount, taxRate, inventoryItem, warehouse, costCenter, purchaseOrder,
  purchaseOrderLine, bill, billLine, billPurchaseOrder, numberSequence, auditLog, goodsReceipt, goodsReceiptLine } from "@/lib/db/schema";
import { notDeleted, softDelete } from "@/lib/db/soft-delete";
import { currencyCodeSchema } from "@/lib/currency/zod";
import { rateDateSchema } from "@/lib/currency/rate-policy";
import { stringifyWire, WireCompatibilityError } from "@/lib/money/wire";
import { sendDocumentEmail } from "@/lib/email/document-sender";
import { renderDocumentEmailHtml } from "@/lib/email/render-document-email";
import { AuthError, type AuthContext } from "./auth-context";
import { requireRole } from "./require-role";
import { assertNotLocked } from "./period-lock";
import { diffChanges } from "./audit";
import { publicLineDto } from "./public-money-wire";
import { invoiceInputError, invoiceRound, safeInvoiceMinor } from "./invoice-write-wire";
import { nextBillNumber } from "./bill-writes";
import { billWriteDto } from "./bill-write-wire";
import { billCountsDto } from "./bill-read-wire";
import { derivePurchaseOrderStatusAfterBilling } from "./procurement";
import { purchaseOrderCreateSchema, purchaseOrderUpdateSchema, purchaseOrderListSchema, purchaseOrderConvertSchema,
  purchaseOrderSendSchema, purchaseOrderTotals, purchaseOrderDto, purchaseOrderReadDto, validatePurchaseOrder,
  purchaseOrderBillItems, type PurchaseOrderInputLine } from "./purchase-order-wire";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
const scope = (ctx: AuthContext, id: string) => and(eq(purchaseOrder.id, id), eq(purchaseOrder.organizationId, ctx.organizationId), notDeleted(purchaseOrder.deletedAt));
const fail = (message: string): never => { throw new AuthError(message, 400); };
async function lockOrganization(tx: Tx, ctx: AuthContext) {
  const [org] = await tx.select().from(organization).where(eq(organization.id, ctx.organizationId)).for("update");
  if (!org) throw new AuthError("Organization not found", 404);
  return org;
}
async function references(tx: Tx, org: string, supplierId: string,
  lines: { accountId?: string | null; taxRateId?: string | null; inventoryItemId?: string | null;
    warehouseId?: string | null; costCenterId?: string | null }[], historical = false, lock = true) {
  const supplierQuery = tx.select().from(contact).where(and(eq(contact.id, supplierId), eq(contact.organizationId, org),
    historical ? undefined : notDeleted(contact.deletedAt)));
  const [supplier] = await (lock ? supplierQuery.for("share") : supplierQuery);
  if (!supplier) invoiceInputError("Purchase order supplier must belong to this organization and be available");
  for (const [key, table] of [["accountId", chartAccount], ["taxRateId", taxRate], ["inventoryItemId", inventoryItem],
    ["warehouseId", warehouse], ["costCenterId", costCenter]] as const) {
    const ids = [...new Set(lines.flatMap(line => line[key] ? [line[key]!] : []))];
    if (!ids.length) continue;
    const query = tx.select({ id: table.id }).from(table).where(and(eq(table.organizationId, org), inArray(table.id, ids),
      historical ? undefined : notDeleted(table.deletedAt), historical || !("isActive" in table) ? undefined : eq(table.isActive, true)));
    const rows = await (lock ? query.for("share") : query);
    if (rows.length !== ids.length) invoiceInputError(`Purchase order ${key} must belong to this organization and be available`);
  }
  return supplier;
}
export async function nextPurchaseOrderNumber(tx: Tx, org: string) {
  const [sequence] = await tx.select().from(numberSequence).where(and(eq(numberSequence.organizationId, org), eq(numberSequence.entityType, "purchase_order"))).for("update");
  const [maximum] = await tx.select({ value: sql<string>`coalesce(max(substring(${purchaseOrder.poNumber} from '^(?:PO-)?([0-9]+)$')::numeric), 0)::text` })
    .from(purchaseOrder).where(eq(purchaseOrder.organizationId, org));
  const saved = BigInt(sequence?.lastNumber ?? 0), used = BigInt(maximum.value), next = (saved > used ? saved : used) + 1n;
  if (next < 1n || next > 2147483647n) invoiceInputError("Purchase order numbering exceeds signed int32 capacity");
  if (sequence) await tx.update(numberSequence).set({ lastNumber: Number(next) }).where(eq(numberSequence.id, sequence.id));
  else await tx.insert(numberSequence).values({ organizationId: org, entityType: "purchase_order", prefix: "PO", lastNumber: Number(next) });
  return `PO-${String(next).padStart(5, "0")}`;
}
async function audit(tx: Tx, ctx: AuthContext, id: string, action: string, changes?: Record<string, unknown>, request?: Request) {
  await tx.insert(auditLog).values({ organizationId: ctx.organizationId, userId: ctx.userId, entityType: "purchase_order", entityId: id,
    action, changes: changes ?? null, ipAddress: request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request?.headers.get("x-real-ip") || null,
    userAgent: request?.headers.get("user-agent") || null });
}
async function load(tx: Tx, ctx: AuthContext, id: string) {
  const org = await lockOrganization(tx, ctx);
  const [found] = await tx.select().from(purchaseOrder).where(scope(ctx, id)).for("update");
  if (!found) throw new AuthError("Purchase order not found", 404);
  currencyCodeSchema.parse(found.currencyCode); rateDateSchema.parse(found.issueDate);
  if (found.deliveryDate) rateDateSchema.parse(found.deliveryDate);
  const lines = await tx.select().from(purchaseOrderLine).where(eq(purchaseOrderLine.purchaseOrderId, id))
    .orderBy(asc(purchaseOrderLine.sortOrder), asc(purchaseOrderLine.id)).for("update");
  validatePurchaseOrder(found, lines);
  await references(tx, ctx.organizationId, found.contactId, lines, true);
  if (found.convertedBillId) {
    const [linked] = await tx.select({ id: bill.id }).from(bill).where(and(eq(bill.id, found.convertedBillId), eq(bill.organizationId, ctx.organizationId))).for("share");
    if (!linked) invoiceInputError("Converted bill must belong to this organization");
  }
  await assertNotLocked(ctx.organizationId, found.issueDate);
  return { org, found, lines };
}
async function draft(tx: Tx, ctx: AuthContext, id: string) {
  const result = await load(tx, ctx, id);
  if (result.found.status !== "draft") fail("Only draft purchase orders can be edited, deleted or sent");
  const [link] = await tx.select({ id: billPurchaseOrder.id }).from(billPurchaseOrder).where(eq(billPurchaseOrder.purchaseOrderId, id));
  const [receipt] = await tx.select({ id: goodsReceipt.id }).from(goodsReceipt).where(eq(goodsReceipt.purchaseOrderId, id));
  if (result.found.convertedBillId || link || receipt || result.lines.some(line => line.quantityReceived !== 0 || line.quantityBilled !== 0))
    fail("A draft purchase order with procurement activity cannot be edited, deleted or sent");
  return result;
}
async function totals(tx: Tx, ctx: AuthContext, lines: PurchaseOrderInputLine[], currency: string, update = false) {
  const ids = [...new Set(lines.flatMap(line => line.taxRateId ? [line.taxRateId] : []))];
  const rates = ids.length ? await tx.select({ id: taxRate.id, rate: taxRate.rate }).from(taxRate)
    .where(and(eq(taxRate.organizationId, ctx.organizationId), inArray(taxRate.id, ids))) : [];
  return purchaseOrderTotals(lines, currency, new Map(rates.map(row => [row.id, row.rate])), update);
}
export async function createPurchaseOrder(ctx: AuthContext, input: unknown, request?: Request) {
  requireRole(ctx, "manage:bills"); const parsed = purchaseOrderCreateSchema.parse(input);
  return db.transaction(async tx => {
    await lockOrganization(tx, ctx);
    await references(tx, ctx.organizationId, parsed.contactId, parsed.lines);
    await assertNotLocked(ctx.organizationId, parsed.issueDate);
    const calculated = await totals(tx, ctx, parsed.lines, parsed.currencyCode);
    const [created] = await tx.insert(purchaseOrder).values({ organizationId: ctx.organizationId, contactId: parsed.contactId,
      poNumber: await nextPurchaseOrderNumber(tx, ctx.organizationId), issueDate: parsed.issueDate, deliveryDate: parsed.deliveryDate ?? null,
      reference: parsed.reference ?? null, notes: parsed.notes ?? null, currencyCode: parsed.currencyCode,
      subtotal: calculated.subtotal, taxTotal: calculated.taxTotal, total: calculated.total, createdBy: ctx.userId }).returning();
    await tx.insert(purchaseOrderLine).values(calculated.processedLines.map(line => ({ ...line, purchaseOrderId: created.id })));
    const result = { purchaseOrder: purchaseOrderDto(created) }; stringifyWire(result);
    await audit(tx, ctx, created.id, "create", undefined, request); return result;
  });
}
export async function updatePurchaseOrder(ctx: AuthContext, id: string, input: unknown, request?: Request) {
  requireRole(ctx, "manage:bills"); z.string().uuid().parse(id); const parsed = purchaseOrderUpdateSchema.parse(input);
  return db.transaction(async tx => {
    const { found } = await draft(tx, ctx, id);
    await assertNotLocked(ctx.organizationId, parsed.issueDate ?? found.issueDate);
    if (parsed.contactId || parsed.lines) await references(tx, ctx.organizationId, parsed.contactId ?? found.contactId, parsed.lines ?? []);
    const patch: Partial<typeof purchaseOrder.$inferInsert> = { updatedAt: new Date() };
    for (const key of ["contactId", "issueDate", "deliveryDate", "reference", "notes"] as const) {
      if (parsed[key] !== undefined) Object.assign(patch, { [key]: parsed[key] });
    }
    if (parsed.lines) {
      const calculated = await totals(tx, ctx, parsed.lines.map(line => ({ ...line, discountPercent: 0 })), found.currencyCode, true);
      Object.assign(patch, { subtotal: calculated.subtotal, taxTotal: calculated.taxTotal, total: calculated.total });
      await tx.delete(purchaseOrderLine).where(eq(purchaseOrderLine.purchaseOrderId, id));
      await tx.insert(purchaseOrderLine).values(calculated.processedLines.map(line => ({ ...line, purchaseOrderId: id })));
    }
    const [updated] = await tx.update(purchaseOrder).set(patch).where(scope(ctx, id)).returning();
    const result = { purchaseOrder: purchaseOrderDto(updated) }; stringifyWire(result);
    await audit(tx, ctx, id, "update", diffChanges(found, updated), request); return result;
  });
}
export async function deletePurchaseOrder(ctx: AuthContext, id: string, request?: Request) {
  requireRole(ctx, "manage:bills"); z.string().uuid().parse(id);
  return db.transaction(async tx => {
    const { found } = await draft(tx, ctx, id);
    await tx.delete(purchaseOrderLine).where(eq(purchaseOrderLine.purchaseOrderId, id));
    await tx.update(purchaseOrder).set(softDelete()).where(scope(ctx, id));
    await audit(tx, ctx, id, "delete", found, request); return { success: true };
  });
}
export async function listPurchaseOrders(ctx: AuthContext, input: unknown, transport: "rest" | "mcp") {
  const parsed = purchaseOrderListSchema.parse(input);
  const conditions = [eq(purchaseOrder.organizationId, ctx.organizationId), notDeleted(purchaseOrder.deletedAt)];
  if (parsed.status) conditions.push(eq(purchaseOrder.status, parsed.status));
  if (parsed.contactId) conditions.push(eq(purchaseOrder.contactId, parsed.contactId));
  return db.transaction(async tx => {
    const rows = await tx.query.purchaseOrder.findMany({ where: and(...conditions), orderBy: [desc(purchaseOrder.createdAt), desc(purchaseOrder.id)],
      limit: parsed.limit, offset: (parsed.page - 1) * parsed.limit, with: { contact: true, ...(transport === "mcp" ? { lines: true } : {}) } });
    if (transport === "mcp") for (const row of rows) if (row.lines) await references(tx, ctx.organizationId, row.contactId, row.lines, true, false);
    const [total] = await tx.select({ count: count() }).from(purchaseOrder).where(and(...conditions));
    return { purchaseOrders: rows.map(row => purchaseOrderReadDto(row, ctx.organizationId)), total: total.count, page: parsed.page, limit: parsed.limit };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
export async function getPurchaseOrder(ctx: AuthContext, id: string) {
  z.string().uuid().parse(id);
  return db.transaction(async tx => {
    const found = await tx.query.purchaseOrder.findFirst({ where: scope(ctx, id), with: { contact: true, lines: { with: { account: true, taxRate: true } } } });
    if (!found) throw new AuthError("Purchase order not found", 404);
    await references(tx, ctx.organizationId, found.contactId, found.lines, true, false);
    return { purchaseOrder: purchaseOrderReadDto(found, ctx.organizationId) };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
export async function getPurchaseOrderCounts(ctx: AuthContext) {
  const rows = await db.select({ status: purchaseOrder.status, count: count(), amount: sql<string>`sum(${purchaseOrder.total})::text`,
    minAmount: sql<string>`min(${purchaseOrder.total})::text`, maxAmount: sql<string>`max(${purchaseOrder.total})::text`,
    currencyCount: sql<number>`count(distinct ${purchaseOrder.currencyCode})`.mapWith(Number), currencyCode: sql<string>`min(${purchaseOrder.currencyCode})` })
    .from(purchaseOrder).where(and(eq(purchaseOrder.organizationId, ctx.organizationId), notDeleted(purchaseOrder.deletedAt))).groupBy(purchaseOrder.status);
  return billCountsDto(rows, "Purchase order");
}
export async function sendPurchaseOrder(ctx: AuthContext, id: string, input: unknown = {}, request?: Request) {
  requireRole(ctx, "approve:bills"); z.string().uuid().parse(id); const parsed = purchaseOrderSendSchema.parse(input);
  const html = parsed.sendEmail ? await renderDocumentEmailHtml(parsed.templateProps!) : undefined;
  const result = await db.transaction(async tx => {
    const { org, found } = await draft(tx, ctx, id);
    const [updated] = await tx.update(purchaseOrder).set({ status: "sent", sentAt: new Date(), updatedAt: new Date() }).where(scope(ctx, id)).returning();
    const result = { purchaseOrder: purchaseOrderDto(updated) }; stringifyWire(result);
    await audit(tx, ctx, id, "send", { previousStatus: found.status }, request); return { result, replyTo: org.contactEmail };
  });
  if (parsed.sendEmail) {
    try { await sendDocumentEmail({ orgId: ctx.organizationId, userId: ctx.userId, documentType: "purchase_order", documentId: id,
      recipientEmail: parsed.recipientEmail!, subject: parsed.subject!, body: html!, attachPdf: false, replyTo: result.replyTo ?? undefined }); }
    catch { throw new AuthError("Purchase order was marked sent, but email delivery failed; retry using document email tools", 502); }
  }
  return result.result;
}

/** Allocate each received slice only once across active bills, inside the PO transaction. */
async function receiptSlices(tx: Tx, ctx: AuthContext, po: typeof purchaseOrder.$inferSelect, line: typeof purchaseOrderLine.$inferSelect, quantity: number) {
  const receipts = await tx.select({ line: goodsReceiptLine, receipt: goodsReceipt }).from(goodsReceiptLine)
    .innerJoin(goodsReceipt, eq(goodsReceiptLine.goodsReceiptId, goodsReceipt.id)).where(eq(goodsReceiptLine.purchaseOrderLineId, line.id))
    .orderBy(asc(goodsReceipt.date), asc(goodsReceipt.createdAt), asc(goodsReceiptLine.sortOrder), asc(goodsReceiptLine.id)).for("share");
  let matchable = Math.max(0, Math.min(line.quantityReceived, line.quantity) - line.quantityBilled), remaining = quantity;
  const slices: { goodsReceiptLineId: string | null; quantity: number }[] = [];
  for (const row of receipts) {
    if (row.receipt.organizationId !== ctx.organizationId || row.receipt.contactId !== po.contactId || row.receipt.purchaseOrderId !== po.id)
      invoiceInputError("Purchase order receipt must belong to the same organization, supplier and order");
    if (row.receipt.deletedAt || row.receipt.status === "void" || row.receipt.status === "draft") continue;
    if (!Number.isSafeInteger(row.line.unitCost)) throw new WireCompatibilityError("Receipt unit cost exceeds supported safe range");
    if (!Number.isInteger(row.line.quantityReceived) || row.line.quantityReceived <= 0) invoiceInputError("Receipt quantity must be positive int32 hundredths");
    const [foreign] = await tx.select({ id: bill.id }).from(billLine).innerJoin(bill, eq(billLine.billId, bill.id))
      .where(and(eq(billLine.goodsReceiptLineId, row.line.id), sql`${bill.organizationId} <> ${ctx.organizationId}`));
    if (foreign) invoiceInputError("Receipt has a bill reference outside this organization");
    const [used] = await tx.select({ quantity: sql<string>`coalesce(sum(${billLine.quantity}), 0)::text` }).from(billLine)
      .innerJoin(bill, eq(billLine.billId, bill.id)).where(and(eq(billLine.goodsReceiptLineId, row.line.id), notDeleted(bill.deletedAt), sql`${bill.status} <> 'void'`));
    const usedQuantity = BigInt(used.quantity);
    if (usedQuantity < 0n || usedQuantity > BigInt(row.line.quantityReceived)) invoiceInputError("Receipt billed quantity is inconsistent");
    const take = Math.min(row.line.quantityReceived - Number(usedQuantity), matchable, remaining);
    if (take > 0) { slices.push({ goodsReceiptLineId: row.line.id, quantity: take }); remaining -= take; matchable -= take; }
  }
  if (remaining > 0) slices.push({ goodsReceiptLineId: null, quantity: remaining });
  return slices;
}
export async function convertPurchaseOrder(ctx: AuthContext, id: string, input: unknown = {}, request?: Request) {
  requireRole(ctx, "manage:bills"); z.string().uuid().parse(id); const parsed = purchaseOrderConvertSchema.parse(input);
  return db.transaction(async tx => {
    const { found, lines } = await load(tx, ctx, id);
    if (["draft", "void", "closed"].includes(found.status)) fail("Purchase order cannot be converted in its current status");
    const events = await tx.select({ changes: auditLog.changes, billId: bill.id }).from(auditLog)
      .innerJoin(bill, sql`${auditLog.changes}->>'billId' = ${bill.id}::text`)
      .where(and(eq(auditLog.organizationId, ctx.organizationId), eq(auditLog.entityType, "purchase_order"), eq(auditLog.entityId, id),
        eq(auditLog.action, "convert"), eq(bill.organizationId, ctx.organizationId), notDeleted(bill.deletedAt), sql`${bill.status} <> 'void'`));
    const previous = new Map<string, { quantity: number; amount: bigint; taxAmount: bigint }>();
    for (const event of events) {
      const history = z.object({ reservations: z.array(z.object({ lineId: z.string().uuid(), quantity: z.number().int().positive().max(2147483647),
        amountMinor: z.string().regex(/^-?(?:0|[1-9]\d*)$/).max(20), taxAmountMinor: z.string().regex(/^-?(?:0|[1-9]\d*)$/).max(20) })).min(1).max(1000) }).safeParse(event.changes);
      if (!history.success) throw new WireCompatibilityError("Billed purchase order history lacks qualified exact conversion allocations");
      for (const reserved of history.data.reservations) {
        const prior = previous.get(reserved.lineId) ?? { quantity: 0, amount: 0n, taxAmount: 0n };
        prior.quantity += reserved.quantity; prior.amount += BigInt(reserved.amountMinor); prior.taxAmount += BigInt(reserved.taxAmountMinor);
        safeInvoiceMinor(prior.amount); safeInvoiceMinor(prior.taxAmount); previous.set(reserved.lineId, prior);
      }
    }
    const items = purchaseOrderBillItems(lines, parsed, previous);
    // GRN conversion creates unreserved drafts. They must not be bypassed by
    // creating an unmatched PO bill for the same quantities. Only this PO's
    // qualified conversion events can participate in cumulative allocation.
    const receiptBills = await tx.select({ billId: bill.id, organizationId: bill.organizationId }).from(billLine)
      .innerJoin(bill, eq(billLine.billId, bill.id))
      .innerJoin(goodsReceiptLine, eq(billLine.goodsReceiptLineId, goodsReceiptLine.id))
      .where(and(inArray(goodsReceiptLine.purchaseOrderLineId, items.map(item => item.line.id)),
        notDeleted(bill.deletedAt), sql`${bill.status} <> 'void'`));
    const qualifiedBills = new Set(events.map(event => event.billId));
    if (receiptBills.some(row => row.organizationId !== ctx.organizationId || !qualifiedBills.has(row.billId)))
      throw new WireCompatibilityError("Active receipt bills lack qualified PO conversion allocations; void them before PO conversion");
    const converted: (Omit<typeof billLine.$inferInsert, "billId">)[] = [];
    for (const item of items) {
      const slices = await receiptSlices(tx, ctx, found, item.line, item.quantity);
      let cumulative = 0, amountAllocated = 0n, taxAllocated = 0n;
      for (const slice of slices) {
        cumulative += slice.quantity;
        const amountTarget = invoiceRound(BigInt(item.amount) * BigInt(cumulative), BigInt(item.quantity));
        const taxTarget = invoiceRound(BigInt(item.taxAmount) * BigInt(cumulative), BigInt(item.quantity));
        converted.push({ description: item.line.description, quantity: slice.quantity, unitPrice: item.line.unitPrice,
          amount: safeInvoiceMinor(amountTarget - amountAllocated), taxAmount: safeInvoiceMinor(taxTarget - taxAllocated),
          accountId: item.line.accountId, taxRateId: item.line.taxRateId, costCenterId: item.line.costCenterId,
          inventoryItemId: item.line.inventoryItemId, warehouseId: item.line.warehouseId,
          goodsReceiptLineId: slice.goodsReceiptLineId, sortOrder: converted.length });
        amountAllocated = amountTarget; taxAllocated = taxTarget;
      }
    }
    const subtotal = safeInvoiceMinor(converted.reduce((sum, line) => sum + BigInt(line.amount ?? 0), 0n));
    const taxTotal = safeInvoiceMinor(converted.reduce((sum, line) => sum + BigInt(line.taxAmount ?? 0), 0n));
    const total = safeInvoiceMinor(BigInt(subtotal) + BigInt(taxTotal));
    const ids = [...new Set(converted.flatMap(line => line.taxRateId ? [line.taxRateId] : []))];
    const rates = ids.length ? await tx.select({ id: taxRate.id, kind: taxRate.kind, rate: taxRate.rate }).from(taxRate).where(and(eq(taxRate.organizationId, ctx.organizationId), inArray(taxRate.id, ids))) : [];
    for (const line of converted) {
      const rate = rates.find(rate => rate.id === line.taxRateId);
      if (rate?.kind === "reverse_charge" && invoiceRound(BigInt(line.amount ?? 0) * BigInt(rate.rate), 10000n) !== BigInt(line.taxAmount ?? 0))
        throw new WireCompatibilityError("Reverse-charge partial allocation cannot satisfy saved tax and recognition rounding together");
    }
    const reverse = new Set(rates.filter(rate => rate.kind === "reverse_charge").map(rate => rate.id));
    const reverseTax = safeInvoiceMinor(converted.reduce((sum, line) => sum + (line.taxRateId && reverse.has(line.taxRateId) ? BigInt(line.taxAmount ?? 0) : 0n), 0n));
    const amountDue = safeInvoiceMinor(BigInt(total) - BigInt(reverseTax));
    const [created] = await tx.insert(bill).values({ organizationId: ctx.organizationId, contactId: found.contactId,
      billNumber: await nextBillNumber(tx, ctx.organizationId), issueDate: found.issueDate, dueDate: found.deliveryDate ?? found.issueDate,
      reference: found.reference, notes: found.notes, currencyCode: found.currencyCode, subtotal, taxTotal, total,
      amountPaid: 0, amountDue, createdBy: ctx.userId }).returning();
    await tx.insert(billLine).values(converted.map(line => ({ ...line, billId: created.id })));
    await tx.insert(billPurchaseOrder).values({ billId: created.id, purchaseOrderId: id });
    for (const item of items) await tx.update(purchaseOrderLine).set({ quantityBilled: item.line.quantityBilled + item.quantity }).where(eq(purchaseOrderLine.id, item.line.id));
    const status = derivePurchaseOrderStatusAfterBilling(lines.map(line => ({ quantity: line.quantity,
      quantityBilled: line.quantityBilled + (items.find(item => item.line.id === line.id)?.quantity ?? 0) })));
    const [updated] = await tx.update(purchaseOrder).set({ status, convertedBillId: found.convertedBillId ?? created.id, updatedAt: new Date() }).where(scope(ctx, id)).returning();
    const result = { purchaseOrder: purchaseOrderDto(updated), bill: billWriteDto(created), purchaseOrderStatus: status };
    converted.forEach(line => publicLineDto({ unitPrice: line.unitPrice!, amount: line.amount!, taxAmount: line.taxAmount! }));
    stringifyWire(result);
    await audit(tx, ctx, id, "convert", { previousStatus: found.status, newStatus: status, billId: created.id, partial: !!parsed.lines,
      reservations: items.map(item => ({ lineId: item.line.id, quantity: item.quantity,
        amountMinor: String(item.amount), taxAmountMinor: String(item.taxAmount) })) }, request);
    return result;
  });
}
