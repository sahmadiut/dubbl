import { z } from "zod";
import { and, asc, count, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { organization, contact, inventoryItem, warehouse, chartAccount, purchaseOrder, purchaseOrderLine,
  goodsReceipt, goodsReceiptLine, numberSequence, auditLog, bill, billLine, billPurchaseOrder, journalEntry } from "@/lib/db/schema";
import { notDeleted } from "@/lib/db/soft-delete";
import { stringifyWire, WireCompatibilityError } from "@/lib/money/wire";
import { currencyCodeSchema } from "@/lib/currency/zod";
import { AuthError, type AuthContext } from "./auth-context";
import { requireRole } from "./require-role";
import { assertNotLocked } from "./period-lock";
import { goodsReceiptCreateSchema, goodsReceiptListSchema, goodsReceiptQuantity, goodsReceiptAmount, goodsReceiptLineDto } from "./goods-receipt-wire";
import { publicMoneyDto, publicLineDto } from "./public-money-wire";
import { contactDto } from "./contact-wire";
import { purchaseOrderDto, validatePurchaseOrder } from "./purchase-order-wire";
import { safeInvoiceMinor } from "./invoice-write-wire";
import { billWriteDto } from "./bill-write-wire";
import { nextBillNumber } from "./bill-writes";
import { ensureControlAccount } from "./journal-automation";
import { receivablePostingRate, postReceivable } from "./invoice-lifecycle";
import { convertInvoiceLegs } from "./invoice-lifecycle-wire";
import { billStockMovement } from "./bill-stock";
import { derivePurchaseOrderStatusAfterReceipt } from "./procurement";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
function fail(message: string): never { throw new AuthError(message, 400); }
const scope = (ctx: AuthContext, id: string) => and(eq(goodsReceipt.id, id), eq(goodsReceipt.organizationId, ctx.organizationId), notDeleted(goodsReceipt.deletedAt));
async function lockOrganization(tx: Tx, ctx: AuthContext) {
  const [org] = await tx.select().from(organization).where(eq(organization.id, ctx.organizationId)).for("update");
  if (!org) throw new AuthError("Organization not found", 404);
  return org;
}
async function references(tx: Tx, ctx: AuthContext, supplier: string, lines: {
  inventoryItemId: string | null; warehouseId: string | null;
}[], historical = false) {
  const supplierQuery = tx.select().from(contact).where(and(eq(contact.id, supplier), eq(contact.organizationId, ctx.organizationId),
    historical ? undefined : notDeleted(contact.deletedAt)));
  const [row] = historical ? await supplierQuery : await supplierQuery.for("share");
  if (!row) throw new WireCompatibilityError("Receipt supplier belongs to another organization or is unavailable");
  contactDto(row);
  for (const [key, table] of [["inventoryItemId", inventoryItem], ["warehouseId", warehouse]] as const) {
    const ids = [...new Set(lines.flatMap(line => line[key] ? [line[key]!] : []))];
    if (!ids.length) continue;
    const query = tx.select({ id: table.id }).from(table).where(and(inArray(table.id, ids), eq(table.organizationId, ctx.organizationId),
      historical ? undefined : notDeleted(table.deletedAt), historical ? undefined : eq(table.isActive, true)));
    const rows = historical ? await query : await query.for("share");
    if (rows.length !== ids.length) throw new WireCompatibilityError(`Receipt ${key} belongs to another organization or is unavailable`);
  }
}
async function control(tx: Tx, ctx: AuthContext, key: "inventory" | "grni", base: string, explicit?: string | null) {
  const account = explicit ? (await tx.select().from(chartAccount).where(and(eq(chartAccount.id, explicit),
    eq(chartAccount.organizationId, ctx.organizationId))))[0] : await ensureControlAccount(ctx.organizationId, key, base, tx);
  if (!account || account.organizationId !== ctx.organizationId || account.deletedAt || !account.isActive || account.currencyCode !== base)
    throw new WireCompatibilityError("Receipt control account must be active, organization-owned and in base currency");
  return account.id;
}
async function audit(tx: Tx, ctx: AuthContext, id: string, action: string, changes: Record<string, unknown>, request?: Request) {
  await tx.insert(auditLog).values({ organizationId: ctx.organizationId, userId: ctx.userId, entityType: "goods_receipt", entityId: id,
    action, changes, ipAddress: request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
    userAgent: request?.headers.get("user-agent") || null });
}
async function nextNumber(tx: Tx, org: string) {
  const [sequence] = await tx.select().from(numberSequence).where(and(eq(numberSequence.organizationId, org), eq(numberSequence.entityType, "goods_receipt"))).for("update");
  const [max] = await tx.select({ value: sql<string>`coalesce(max(substring(${goodsReceipt.receiptNumber} from '^GRN-([0-9]+)$')::numeric),0)::text` })
    .from(goodsReceipt).where(eq(goodsReceipt.organizationId, org));
  const saved = BigInt(sequence?.lastNumber ?? 0), used = BigInt(max.value), next = (saved > used ? saved : used) + 1n;
  if (next > 2147483647n || next < 1n) fail("Goods receipt numbering exceeds int32 capacity");
  if (sequence) await tx.update(numberSequence).set({ lastNumber: Number(next) }).where(eq(numberSequence.id, sequence.id));
  else await tx.insert(numberSequence).values({ organizationId: org, entityType: "goods_receipt", prefix: "GRN", lastNumber: Number(next) });
  return `GRN-${String(next).padStart(5, "0")}`;
}
async function read(tx: Tx, ctx: AuthContext, id: string, detail = false) {
  const row = await tx.query.goodsReceipt.findFirst({ where: scope(ctx, id), with: { contact: true, purchaseOrder: true,
    lines: { orderBy: [asc(goodsReceiptLine.sortOrder), asc(goodsReceiptLine.id)],
      with: { inventoryItem: true, warehouse: true, purchaseOrderLine: true } } } });
  if (!row) throw new AuthError("Goods receipt not found", 404);
  await references(tx, ctx, row.contactId, row.lines, true);
  if (row.purchaseOrder && (row.purchaseOrder.organizationId !== ctx.organizationId || row.purchaseOrder.contactId !== row.contactId))
    throw new WireCompatibilityError("Receipt purchase order is foreign or inconsistent");
  const ids = row.lines.flatMap(line => line.purchaseOrderLineId ? [line.purchaseOrderLineId] : []);
  if (ids.length) {
    const parents = await tx.select({ id: purchaseOrderLine.id, po: purchaseOrderLine.purchaseOrderId }).from(purchaseOrderLine)
      .innerJoin(purchaseOrder, eq(purchaseOrderLine.purchaseOrderId, purchaseOrder.id))
      .where(and(inArray(purchaseOrderLine.id, ids), eq(purchaseOrder.organizationId, ctx.organizationId)));
    if (parents.length !== new Set(ids).size || parents.some(parent => parent.po !== row.purchaseOrderId))
      throw new WireCompatibilityError("Receipt PO lines are foreign or inconsistent");
  }
  const journals = [...new Set(row.lines.flatMap(line => line.journalEntryId ? [line.journalEntryId] : []))];
  if (journals.length) {
    const entries = await tx.select({ id: journalEntry.id }).from(journalEntry).where(and(inArray(journalEntry.id, journals), eq(journalEntry.organizationId, ctx.organizationId)));
    if (entries.length !== journals.length) throw new WireCompatibilityError("Receipt journal belongs to another organization");
  }
  const lines = row.lines.map(line => {
    const { inventoryItem: item, warehouse: store, purchaseOrderLine: poLine, ...plain } = line;
    return { ...goodsReceiptLineDto(plain), ...(detail ? { inventoryItem: item ? publicMoneyDto(item,
      ["purchasePrice", "salePrice", "averageCost", "standardCost", "totalValue"]) : null,
      warehouse: store, purchaseOrderLine: poLine ? publicLineDto(poLine) : null } : {}) };
  });
  const dto = { ...row, currencyCode: row.purchaseOrder?.currencyCode ?? null, contact: row.contact ? contactDto(row.contact) : null,
    purchaseOrder: row.purchaseOrder ? purchaseOrderDto(row.purchaseOrder) : null, lines };
  stringifyWire(dto); return dto;
}
export async function getGoodsReceipt(ctx: AuthContext, id: string) {
  z.string().uuid().parse(id);
  return db.transaction(async tx => ({ goodsReceipt: await read(tx, ctx, id, true) }));
}
export async function listGoodsReceipts(ctx: AuthContext, input: unknown) {
  const parsed = goodsReceiptListSchema.parse(input);
  const where = and(eq(goodsReceipt.organizationId, ctx.organizationId), notDeleted(goodsReceipt.deletedAt),
    parsed.status ? eq(goodsReceipt.status, parsed.status) : undefined,
    parsed.purchaseOrderId ? eq(goodsReceipt.purchaseOrderId, parsed.purchaseOrderId) : undefined);
  return db.transaction(async tx => {
    const rows = await tx.select({ id: goodsReceipt.id }).from(goodsReceipt).where(where).orderBy(desc(goodsReceipt.createdAt), desc(goodsReceipt.id))
      .limit(parsed.limit).offset((parsed.page - 1) * parsed.limit);
    const [total] = await tx.select({ count: count() }).from(goodsReceipt).where(where);
    const receipts = [];
    for (const row of rows) receipts.push(await read(tx, ctx, row.id));
    return { goodsReceipts: receipts, total: total.count, page: parsed.page, limit: parsed.limit };
  });
}
export async function receiveGoodsReceipt(ctx: AuthContext, input: unknown, request?: Request) {
  requireRole(ctx, "manage:bills"); const parsed = goodsReceiptCreateSchema.parse(input);
  return db.transaction(async tx => {
    const org = await lockOrganization(tx, ctx);
    await assertNotLocked(ctx.organizationId, parsed.date, ctx);
    const [po] = await tx.select().from(purchaseOrder).where(and(eq(purchaseOrder.id, parsed.purchaseOrderId),
      eq(purchaseOrder.organizationId, ctx.organizationId), notDeleted(purchaseOrder.deletedAt))).for("update");
    if (!po) throw new AuthError("Purchase order not found", 404);
    if (["draft", "void"].includes(po.status)) fail("Goods cannot be received against a draft or void purchase order");
    const lines = await tx.select().from(purchaseOrderLine).where(eq(purchaseOrderLine.purchaseOrderId, po.id)).orderBy(purchaseOrderLine.id).for("update");
    validatePurchaseOrder(po, lines);
    const ids = new Set<string>();
    const selected = parsed.lines.map(input => {
      if (ids.has(input.purchaseOrderLineId)) fail("Duplicate purchase order line selection");
      ids.add(input.purchaseOrderLineId);
      const line = lines.find(line => line.id === input.purchaseOrderLineId);
      if (!line) fail("Receipt line does not belong to this purchase order");
      const quantity = goodsReceiptQuantity(input, !!line.inventoryItemId);
      if (quantity > line.quantity - line.quantityReceived) fail("Receipt quantity exceeds outstanding purchase order quantity");
      const value = goodsReceiptAmount(quantity, line.unitPrice);
      return { line, quantity, value };
    });
    await references(tx, ctx, po.contactId, selected.map(item => item.line));
    const base = currencyCodeSchema.parse(org.defaultCurrency ?? "USD"), currency = currencyCodeSchema.parse(po.currencyCode);
    const fx = await receivablePostingRate(ctx, currency, base, parsed.date);
    const legs: { accountId: string; debitAmount: number; creditAmount: number }[] = [];
    const stock: { item: typeof selected[number]; index: number }[] = [];
    for (const item of selected) {
      if (!item.line.inventoryItemId) continue;
      const [saved] = await tx.select().from(inventoryItem).where(and(eq(inventoryItem.id, item.line.inventoryItemId),
        eq(inventoryItem.organizationId, ctx.organizationId))).for("update");
      if (saved.trackingMethod !== "none") throw new WireCompatibilityError("Serial/lot receipt allocation requires separate inventory qualification (MON-024)");
      const accountId = await control(tx, ctx, "inventory", base, saved.inventoryAccountId);
      stock.push({ item, index: legs.length });
      legs.push({ accountId, debitAmount: item.value, creditAmount: 0 });
    }
    const total = safeInvoiceMinor(stock.reduce((sum, row) => sum + BigInt(row.item.value), 0n));
    if (stock.length) legs.push({ accountId: await control(tx, ctx, "grni", base), debitAmount: 0, creditAmount: total });
    const converted = convertInvoiceLegs(legs, currency, base, fx.rateExact);
    if (converted.some(leg => leg.debitAmount < 0 || leg.creditAmount < 0))
      throw new WireCompatibilityError("Receipt FX residual cannot produce negative stock or GRNI legs");
    const receiptNumber = await nextNumber(tx, ctx.organizationId);
    const [receipt] = await tx.insert(goodsReceipt).values({ organizationId: ctx.organizationId, purchaseOrderId: po.id, contactId: po.contactId,
      receiptNumber, date: parsed.date, status: "received", notes: parsed.notes ?? null, createdBy: ctx.userId }).returning();
    const entry = converted.some(leg => leg.debitAmount || leg.creditAmount) ? await postReceivable(tx, ctx,
      { date: parsed.date, description: `Goods receipt ${receiptNumber} (PO ${po.poNumber})`, reference: receiptNumber,
        sourceType: "goods_receipt", sourceId: receipt.id }, legs, currency, base, fx) : null;
    for (const row of stock) await billStockMovement(tx, ctx, { billId: receipt.id, referenceType: "goods_receipt", itemId: row.item.line.inventoryItemId!,
      warehouseId: row.item.line.warehouseId, quantity: row.item.quantity / 100, value: converted[row.index].debitAmount, journalEntryId: entry?.id ?? null });
    for (const [i, item] of selected.entries()) {
      await tx.insert(goodsReceiptLine).values({ goodsReceiptId: receipt.id, purchaseOrderLineId: item.line.id,
        inventoryItemId: item.line.inventoryItemId, warehouseId: item.line.warehouseId, description: item.line.description,
        quantityReceived: item.quantity, unitCost: item.line.unitPrice, journalEntryId: item.line.inventoryItemId ? entry?.id ?? null : null, sortOrder: i });
      await tx.update(purchaseOrderLine).set({ quantityReceived: item.line.quantityReceived + item.quantity }).where(eq(purchaseOrderLine.id, item.line.id));
    }
    const status = po.status === "closed" ? "closed" : derivePurchaseOrderStatusAfterReceipt(lines.map(line => ({ quantity: line.quantity,
      quantityReceived: line.quantityReceived + (selected.find(item => item.line.id === line.id)?.quantity ?? 0) })));
    await tx.update(purchaseOrder).set({ status, updatedAt: new Date() }).where(eq(purchaseOrder.id, po.id));
    const result = { goodsReceipt: await read(tx, ctx, receipt.id), journalEntryId: entry?.id ?? null, purchaseOrderStatus: status };
    stringifyWire(result);
    await audit(tx, ctx, receipt.id, "create", { purchaseOrderId: po.id, journalEntryId: entry?.id ?? null,
      baseCurrencyCode: base, currencyCode: currency, rateExact: fx.rateExact, rateDirection: "quote_per_base",
      grniTotalMinor: String(converted.reduce((sum, leg) => sum + BigInt(leg.creditAmount), 0n)) }, request);
    return result;
  });
}
export async function createBillFromGoodsReceipt(ctx: AuthContext, id: string, request?: Request) {
  requireRole(ctx, "manage:bills"); z.string().uuid().parse(id);
  return db.transaction(async tx => {
    await lockOrganization(tx, ctx);
    const [receipt] = await tx.select().from(goodsReceipt).where(scope(ctx, id)).for("update");
    if (!receipt) throw new AuthError("Goods receipt not found", 404);
    if (receipt.status !== "received") fail("Only a received goods receipt can be turned into a bill");
    const dto = await read(tx, ctx, id);
    if (!dto.purchaseOrder || dto.purchaseOrder.deletedAt || dto.purchaseOrder.status === "void")
      throw new WireCompatibilityError("Receipt conversion requires an available source purchase order and currency");
    const currencyCode = currencyCodeSchema.parse(dto.purchaseOrder.currencyCode);
    const today = new Date().toISOString().slice(0, 10);
    await assertNotLocked(ctx.organizationId, today, ctx);
    await references(tx, ctx, receipt.contactId, dto.lines);
    const active = await tx.select({ id: billLine.id }).from(billLine).innerJoin(bill, eq(billLine.billId, bill.id))
      .where(and(inArray(billLine.goodsReceiptLineId, dto.lines.map(line => line.id)), ne(bill.status, "void"), isNull(bill.deletedAt)));
    if (active.length) fail("This goods receipt already has an active bill; void it before converting again");
    const sourceLines = await tx.select().from(purchaseOrderLine).where(eq(purchaseOrderLine.purchaseOrderId, dto.purchaseOrder.id));
    const accounts = [...new Set(dto.lines.flatMap(line => {
      const id = sourceLines.find(source => source.id === line.purchaseOrderLineId)?.accountId;
      return id ? [id] : [];
    }))];
    if (accounts.length) {
      const owned = await tx.select({ id: chartAccount.id }).from(chartAccount).where(and(inArray(chartAccount.id, accounts),
        eq(chartAccount.organizationId, ctx.organizationId), eq(chartAccount.isActive, true), notDeleted(chartAccount.deletedAt))).for("share");
      if (owned.length !== accounts.length) throw new WireCompatibilityError("Receipt bill expense account must be active and organization-owned");
    }
    const processed = dto.lines.map((line, sortOrder) => ({ description: line.description, quantity: line.quantityReceived,
      unitPrice: line.unitCost, amount: goodsReceiptAmount(line.quantityReceived, line.unitCost), taxAmount: 0,
      accountId: sourceLines.find(source => source.id === line.purchaseOrderLineId)?.accountId ?? null,
      inventoryItemId: line.inventoryItemId, warehouseId: line.warehouseId, goodsReceiptLineId: line.id, sortOrder }));
    if (!processed.length) fail("Goods receipt has no received quantities to bill");
    const subtotal = safeInvoiceMinor(processed.reduce((sum, line) => sum + BigInt(line.amount), 0n));
    const [created] = await tx.insert(bill).values({ organizationId: ctx.organizationId, contactId: receipt.contactId,
      billNumber: await nextBillNumber(tx, ctx.organizationId), issueDate: today, dueDate: today, status: "draft", reference: receipt.receiptNumber,
      notes: `Created from goods receipt ${receipt.receiptNumber} (PO ${dto.purchaseOrder.poNumber})`, currencyCode,
      subtotal, taxTotal: 0, total: subtotal, amountPaid: 0, amountDue: subtotal, createdBy: ctx.userId }).returning();
    await tx.insert(billLine).values(processed.map(line => ({ billId: created.id, ...line })));
    await tx.insert(billPurchaseOrder).values({ billId: created.id, purchaseOrderId: dto.purchaseOrder.id });
    const result = { bill: billWriteDto(created) }; stringifyWire(result);
    await audit(tx, ctx, receipt.id, "convert", { billId: created.id, purchaseOrderId: receipt.purchaseOrderId }, request);
    await tx.insert(auditLog).values({ organizationId: ctx.organizationId, userId: ctx.userId, entityType: "bill", entityId: created.id,
      action: "create", changes: { fromGoodsReceiptId: receipt.id, purchaseOrderId: receipt.purchaseOrderId } });
    return result;
  });
}
