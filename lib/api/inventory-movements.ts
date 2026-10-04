import { and, asc, desc, eq, isNull, sql, gte } from "drizzle-orm";
import { db } from "@/lib/db";
import { inventoryItem, inventoryMovement, warehouse, warehouseStock, inventoryTransfer, inventoryTransferLine, stockTake, stockTakeLine, serialNumber, lotBatch, auditLog, journalEntry, journalLine } from "@/lib/db/schema";
import { AuthError, type AuthContext } from "./auth-context";
import { requireRole } from "./require-role";
import { assertNotLocked } from "./period-lock";
import { orgLock, lockedItem, postingAccount, preflightAdjustment } from "./inventory-master";
import { itemDto } from "./inventory-master-wire";
import { catalogId } from "./inventory-catalog-wire";
import { adjustmentSchema, mcpAdjustmentSchema, validateAdjustment, bulkAdjustmentSchema, physicalQuantity, warehouseCreateSchema, warehouseUpdateSchema, transferCreateSchema, transferUpdateSchema, stockTakeCreateSchema, stockTakeUpdateSchema, stockTakeCountSchema, serialCreateSchema, lotCreateSchema, movementListSchema, allocationListSchema, chartSchema, movementDto, stockTakeLineDto, postingDate } from "./inventory-movement-wire";
import { legacyMinor, stringifyWire } from "@/lib/money/wire";
import { roundInventoryRatio } from "@/lib/money/inventory-cost";
import { recordInventoryReceipt, recordInventoryIssue } from "./inventory-valuation";
import { ensureControlAccount, ensureAccountByCode, resolveBaseRate, getNextEntryNumber } from "./journal-automation";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Item = typeof inventoryItem.$inferSelect;
const today = () => new Date().toISOString().slice(0, 10);
const whScope = (ctx: AuthContext, id?: string) => and(eq(warehouse.organizationId, ctx.organizationId), isNull(warehouse.deletedAt), id ? eq(warehouse.id, id) : undefined);
async function audit(tx: Tx, ctx: AuthContext, type: string, id: string, action: string, changes: unknown, request?: Request) {
  await tx.insert(auditLog).values({ organizationId: ctx.organizationId, userId: ctx.userId, entityType: type, entityId: id, action,
    changes: JSON.parse(stringifyWire(changes)), ipAddress: request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null, userAgent: request?.headers.get("user-agent") || null });
}
async function ownedWarehouse(tx: Tx | typeof db, ctx: AuthContext, id: string, active = false) {
  catalogId.parse(id); const row = await tx.query.warehouse.findFirst({ where: whScope(ctx, id) });
  if (!row || (active && !row.isActive)) throw new AuthError("Warehouse not found or inactive", 404); return row;
}
async function historicalWarehouse(tx: Tx | typeof db, ctx: AuthContext, id: string) {
  const row = await tx.query.warehouse.findFirst({ where: and(eq(warehouse.id, id), eq(warehouse.organizationId, ctx.organizationId)) });
  if (!row) throw new AuthError("Warehouse history not found", 404); return row;
}
async function readItem(ctx: AuthContext, id: string) {
  catalogId.parse(id); const row = await db.query.inventoryItem.findFirst({ where: and(eq(inventoryItem.id, id), eq(inventoryItem.organizationId, ctx.organizationId), isNull(inventoryItem.deletedAt)) });
  if (!row) throw new AuthError("Inventory item not found", 404); itemDto(row); return row;
}
async function stock(tx: Tx | typeof db, ctx: AuthContext, itemId: string, warehouseId: string) {
  const row = await tx.query.warehouseStock.findFirst({ where: and(eq(warehouseStock.organizationId, ctx.organizationId), eq(warehouseStock.inventoryItemId, itemId), eq(warehouseStock.warehouseId, warehouseId)) });
  physicalQuantity.parse(row?.quantity ?? 0); return row?.quantity ?? 0;
}
async function setStock(tx: Tx, ctx: AuthContext, itemId: string, warehouseId: string, quantity: number) {
  physicalQuantity.parse(quantity);
  if (quantity < 0) throw new AuthError("Insufficient warehouse stock", 400);
  await tx.insert(warehouseStock).values({ organizationId: ctx.organizationId, inventoryItemId: itemId, warehouseId, quantity })
    .onConflictDoUpdate({ target: [warehouseStock.organizationId, warehouseStock.inventoryItemId, warehouseStock.warehouseId], set: { quantity, updatedAt: new Date() } });
}
async function accounts(tx: Tx, ctx: AuthContext, item: Item, date: string, offset: "quantity" | "write_down" | "rest_revaluation" | "mcp_up" | "mcp_down") {
  const { base } = await resolveBaseRate(ctx.organizationId, undefined, date);
  const inv = item.inventoryAccountId ? { id: item.inventoryAccountId } : await ensureControlAccount(ctx.organizationId, "inventory", base, tx);
  const counter = offset === "mcp_up" ? await ensureAccountByCode(ctx.organizationId, { code: "3400", name: "Revaluation Surplus", type: "equity", subType: "equity" }, base, tx)
    : offset === "mcp_down" ? await ensureAccountByCode(ctx.organizationId, { code: "5510", name: "Impairment Loss", type: "expense", subType: "operating" }, base, tx)
    : await ensureControlAccount(ctx.organizationId, offset === "quantity" ? "inventoryShrinkage" : "inventoryWriteDown", base, tx);
  if (!inv || !counter) throw new AuthError("Inventory posting accounts unavailable", 422);
  await postingAccount(tx, ctx, inv.id, "asset", base); await postingAccount(tx, ctx, counter.id, offset === "mcp_up" ? "equity" : "expense", base);
  return { inv, counter, base };
}
async function post(tx: Tx, ctx: AuthContext, item: Item, date: string, value: number, reason: string, offset: Parameters<typeof accounts>[4], sourceType: string) {
  if (value === 0) return null;
  const { inv, counter, base } = await accounts(tx, ctx, item, date, offset);
  const amount = Math.abs(value), decrease = value < 0;
  const [entry] = await tx.insert(journalEntry).values({ organizationId: ctx.organizationId, entryNumber: await getNextEntryNumber(ctx.organizationId, tx), date,
    description: `Inventory adjustment: ${reason}`, reference: "INV-ADJ", status: "posted", sourceType, postedAt: new Date(), createdBy: ctx.userId }).returning();
  await tx.insert(journalLine).values([
    { journalEntryId: entry.id, accountId: inv.id, description: reason, debitAmount: decrease ? 0 : amount, creditAmount: decrease ? amount : 0, currencyCode: base },
    { journalEntryId: entry.id, accountId: counter.id, description: reason, debitAmount: decrease ? amount : 0, creditAmount: decrease ? 0 : amount, currencyCode: base },
  ]); return entry.id;
}
async function quantityAdjustment(tx: Tx, ctx: AuthContext, item: Item, delta: number, reason: string, date: string, warehouseId?: string | null, takeId?: string) {
  await preflightAdjustment(tx, ctx, item, delta);
  if (warehouseId) { await ownedWarehouse(tx, ctx, warehouseId, true); const q = await stock(tx, ctx, item.id, warehouseId); physicalQuantity.parse(q + delta); if (q + delta < 0) throw new AuthError("Insufficient warehouse stock", 400); }
  await accounts(tx, ctx, item, date, "quantity");
  const args = { item, warehouseId, type: "adjustment" as const, referenceType: takeId ? "stock_take" : "adjustment", referenceId: takeId ?? null, createdBy: ctx.userId };
  const r = delta < 0 ? await recordInventoryIssue(tx, { ...args, quantity: -delta }) : await recordInventoryReceipt(tx, { ...args, quantity: delta, unitCost: item.averageCost });
  const value = delta < 0 ? -(r as { cost: number }).cost : legacyMinor(BigInt(item.averageCost) * BigInt(delta));
  const entryId = await post(tx, ctx, item, date, value, reason, "quantity", takeId ? "stock_take" : "inventory_adjustment");
  const [movement] = await tx.update(inventoryMovement).set({ journalEntryId: entryId, reason, ...(takeId ? { type: "stock_take" as const } : {}) }).where(eq(inventoryMovement.id, r.movementId)).returning();
  return { movement: movementDto(movement), journalEntryId: entryId, value };
}
export async function adjustInventory(ctx: AuthContext, id: string, input: unknown, mcp = false, request?: Request) {
  requireRole(ctx, "manage:inventory"); catalogId.parse(id);
  const p = mcp ? mcpAdjustmentSchema.parse(input) : adjustmentSchema.parse(input);
  const fields = p as Record<string, unknown>, kind = String(mcp ? fields.kind : fields.adjustmentType);
  const value = validateAdjustment(fields, kind, mcp ? "quantityDelta" : "adjustment", mcp ? "amount" : kind === "write_down" ? "valueDelta" : "newTotalValue");
  const date = mcp ? String(fields.date ?? today()) : today();
  return db.transaction(async tx => {
    await orgLock(tx, ctx); await assertNotLocked(ctx.organizationId, date, ctx); const item = await lockedItem(tx, ctx, id), reason = String(fields.reason);
    let movement: ReturnType<typeof movementDto> | null = null, journalEntryId: string | null = null, delta = 0;
    if (kind === "quantity") {
      const r = await quantityAdjustment(tx, ctx, item, value, reason, date); movement = r.movement; journalEntryId = r.journalEntryId;
    } else {
      delta = kind === "write_down" ? -value : mcp ? value : legacyMinor(BigInt(value) - BigInt(item.totalValue));
      const totalValue = legacyMinor(BigInt(item.totalValue) + BigInt(delta));
      if (totalValue < 0) throw new AuthError("Write-down exceeds current inventory value", 400);
      // FIFO layers are a separate valuation source. Reject rather than leave layers
      // at their old costs and silently undo this revaluation on the next issue.
      if (item.costMethod !== "average") throw new AuthError("Value-only adjustment requires average costing; FIFO/standard valuation is unsupported", 422);
      if (totalValue > 0 && item.quantityOnHand <= 0) throw new AuthError("Positive carrying value requires positive stock", 400);
      const averageCost = item.quantityOnHand > 0 ? roundInventoryRatio(BigInt(totalValue), BigInt(item.quantityOnHand)) : 0;
      itemDto({ ...item, totalValue, averageCost });
      if (delta !== 0) {
        journalEntryId = await post(tx, ctx, item, date, delta, reason, kind === "write_down" ? "write_down" : mcp ? delta > 0 ? "mcp_up" : "mcp_down" : "rest_revaluation", kind === "write_down" ? "inventory_write_down" : "inventory_revaluation");
        await tx.update(inventoryItem).set({ totalValue, averageCost, updatedAt: new Date() }).where(eq(inventoryItem.id, id));
        const [row] = await tx.insert(inventoryMovement).values({ organizationId: ctx.organizationId, inventoryItemId: id, type: "adjustment", quantity: 0, previousQuantity: item.quantityOnHand, newQuantity: item.quantityOnHand,
          unitCost: 0, value: delta, journalEntryId, reason, referenceType: kind, createdBy: ctx.userId }).returning(); movement = movementDto(row);
      }
    }
    const updated = itemDto((await tx.query.inventoryItem.findFirst({ where: eq(inventoryItem.id, id) }))!);
    const result = { inventoryItem: updated, movement, journalEntryId, adjustmentType: kind, kind, reason,
      ...(kind === "quantity" ? { adjustment: value, previousQuantity: item.quantityOnHand, newQuantity: updated.quantityOnHand } : { previousValue: item.totalValue, previousValueMinor: String(item.totalValue), newValue: updated.totalValue, newValueMinor: updated.totalValueMinor,
        valueDelta: delta, valueDeltaMinor: String(delta), newTotalValue: updated.totalValue, newTotalValueMinor: updated.totalValueMinor }) };
    await audit(tx, ctx, "inventory_item", id, "inventory.adjust", result, request); return result;
  });
}
export async function bulkAdjustInventory(ctx: AuthContext, input: unknown, request?: Request) {
  requireRole(ctx, "manage:inventory"); const p = bulkAdjustmentSchema.parse(input);
  return db.transaction(async tx => {
    await orgLock(tx, ctx); const date = today(); await assertNotLocked(ctx.organizationId, date, ctx);
    const rows = [];
    for (const a of [...p.adjustments].sort((a, b) => a.itemId.localeCompare(b.itemId))) { const item = await lockedItem(tx, ctx, a.itemId); await preflightAdjustment(tx, ctx, item, a.quantity); rows.push({ a, item }); }
    for (const { a, item } of rows) { const result = await quantityAdjustment(tx, ctx, item, a.quantity, a.reason || "Bulk adjustment", date); await audit(tx, ctx, "inventory_item", item.id, "inventory.adjust", result, request); }
    return { adjusted: rows.length };
  });
}
export async function listWarehouses(ctx: AuthContext) { return db.select().from(warehouse).where(whScope(ctx)).orderBy(asc(warehouse.name), warehouse.id); }
export async function getWarehouse(ctx: AuthContext, id: string) { return ownedWarehouse(db, ctx, id); }
export async function writeWarehouse(ctx: AuthContext, input: unknown, id?: string, request?: Request) {
  requireRole(ctx, "manage:inventory"); if (id) catalogId.parse(id); const p = id ? warehouseUpdateSchema.parse(input) : warehouseCreateSchema.parse(input);
  return db.transaction(async tx => {
    await orgLock(tx, ctx); if (id) await ownedWarehouse(tx, ctx, id);
    if (p.code) { const found = await tx.query.warehouse.findFirst({ where: and(eq(warehouse.organizationId, ctx.organizationId), eq(warehouse.code, p.code)) }); if (found && found.id !== id) throw new AuthError("Warehouse code already exists", 409); }
    if (p.isDefault) await tx.update(warehouse).set({ isDefault: false, updatedAt: new Date() }).where(whScope(ctx));
    const [row] = id ? await tx.update(warehouse).set({ ...p, updatedAt: new Date() }).where(whScope(ctx, id)).returning()
      : await tx.insert(warehouse).values({ ...p, name: p.name!, code: p.code!, organizationId: ctx.organizationId }).returning();
    await audit(tx, ctx, "warehouse", row.id, id ? "update" : "create", row, request); return row;
  });
}
export async function deleteWarehouse(ctx: AuthContext, id: string, request?: Request) {
  requireRole(ctx, "manage:inventory"); catalogId.parse(id);
  return db.transaction(async tx => { await orgLock(tx, ctx); const row = await ownedWarehouse(tx, ctx, id);
    const nonzero = await tx.query.warehouseStock.findFirst({ where: and(eq(warehouseStock.organizationId, ctx.organizationId), eq(warehouseStock.warehouseId, id), sql`${warehouseStock.quantity} <> 0`) });
    if (nonzero) throw new AuthError("Cannot delete warehouse with stock", 409);
    const openTransfer = await tx.query.inventoryTransfer.findFirst({ where: and(eq(inventoryTransfer.organizationId, ctx.organizationId), sql`${inventoryTransfer.status} in ('draft','in_transit')`, sql`(${inventoryTransfer.fromWarehouseId} = ${id} or ${inventoryTransfer.toWarehouseId} = ${id})`) });
    const openTake = await tx.query.stockTake.findFirst({ where: and(eq(stockTake.organizationId, ctx.organizationId), eq(stockTake.warehouseId, id), sql`${stockTake.status} in ('draft','in_progress')`) });
    if (openTransfer || openTake) throw new AuthError("Warehouse has an open transfer or stock take", 409);
    await tx.update(warehouse).set({ deletedAt: new Date(), isDefault: false, updatedAt: new Date() }).where(whScope(ctx, id));
    await audit(tx, ctx, "warehouse", id, "delete", row, request); return { success: true };
  });
}
export async function warehouseStocks(ctx: AuthContext, id: string, byItem = false) {
  if (byItem) await readItem(ctx, id); else await ownedWarehouse(db, ctx, id);
  const rows = byItem ? await db.select({ id: warehouseStock.id, warehouseId: warehouse.id, warehouseName: warehouse.name, warehouseCode: warehouse.code, quantity: warehouseStock.quantity, updatedAt: warehouseStock.updatedAt }).from(warehouseStock)
    .innerJoin(warehouse, and(eq(warehouse.id, warehouseStock.warehouseId), eq(warehouse.organizationId, ctx.organizationId), isNull(warehouse.deletedAt)))
    .where(and(eq(warehouseStock.organizationId, ctx.organizationId), eq(warehouseStock.inventoryItemId, id)))
    : await db.select({ id: warehouseStock.id, inventoryItemId: inventoryItem.id, itemName: inventoryItem.name, itemCode: inventoryItem.code, itemSku: inventoryItem.sku, quantity: warehouseStock.quantity, updatedAt: warehouseStock.updatedAt }).from(warehouseStock)
      .innerJoin(inventoryItem, and(eq(inventoryItem.id, warehouseStock.inventoryItemId), eq(inventoryItem.organizationId, ctx.organizationId), isNull(inventoryItem.deletedAt)))
      .where(and(eq(warehouseStock.organizationId, ctx.organizationId), eq(warehouseStock.warehouseId, id)));
  rows.forEach(r => physicalQuantity.parse(r.quantity)); return rows;
}

const transferScope = (ctx: AuthContext, id?: string) => and(eq(inventoryTransfer.organizationId, ctx.organizationId), id ? eq(inventoryTransfer.id, id) : undefined);
async function transferDto(tx: Tx | typeof db, ctx: AuthContext, id: string) {
  const t = await tx.query.inventoryTransfer.findFirst({ where: transferScope(ctx, id), with: { lines: true } }); if (!t) throw new AuthError("Transfer not found", 404);
  const fromWarehouse = await historicalWarehouse(tx, ctx, t.fromWarehouseId), toWarehouse = await historicalWarehouse(tx, ctx, t.toWarehouseId);
  for (const line of t.lines) { physicalQuantity.parse(line.quantity); if (line.receivedQuantity !== null) physicalQuantity.parse(line.receivedQuantity);
    const item = await tx.query.inventoryItem.findFirst({ where: and(eq(inventoryItem.id, line.inventoryItemId), eq(inventoryItem.organizationId, ctx.organizationId)) }); if (!item) throw new AuthError("Transfer item not found", 404); }
  return { ...t, fromWarehouse, toWarehouse };
}
export async function listTransfers(ctx: AuthContext) { const rows = await db.select({ id: inventoryTransfer.id }).from(inventoryTransfer).where(transferScope(ctx)).orderBy(desc(inventoryTransfer.createdAt), inventoryTransfer.id); return Promise.all(rows.map(r => transferDto(db, ctx, r.id))); }
export async function getTransfer(ctx: AuthContext, id: string) { catalogId.parse(id); return transferDto(db, ctx, id); }
async function createTransfer(tx: Tx, ctx: AuthContext, p: ReturnType<typeof transferCreateSchema.parse>, request?: Request) {
  await ownedWarehouse(tx, ctx, p.fromWarehouseId, true); await ownedWarehouse(tx, ctx, p.toWarehouseId, true);
  for (const line of [...p.lines].sort((a, b) => a.inventoryItemId.localeCompare(b.inventoryItemId))) await lockedItem(tx, ctx, line.inventoryItemId);
  const [row] = await tx.insert(inventoryTransfer).values({ organizationId: ctx.organizationId, fromWarehouseId: p.fromWarehouseId, toWarehouseId: p.toWarehouseId, notes: p.notes, transferredBy: ctx.userId }).returning();
  await tx.insert(inventoryTransferLine).values(p.lines.map(l => ({ ...l, transferId: row.id })));
  const result = await transferDto(tx, ctx, row.id); await audit(tx, ctx, "inventory_transfer", row.id, "create", result, request); return result;
}
export async function createInventoryTransfer(ctx: AuthContext, input: unknown, request?: Request) { requireRole(ctx, "manage:inventory"); const p = transferCreateSchema.parse(input); return db.transaction(async tx => { await orgLock(tx, ctx); return createTransfer(tx, ctx, p, request); }); }
export async function updateInventoryTransfer(ctx: AuthContext, id: string, input: unknown, request?: Request) {
  requireRole(ctx, "manage:inventory"); catalogId.parse(id); const p = transferUpdateSchema.parse(input);
  return db.transaction(async tx => { await orgLock(tx, ctx); const t = await transferDto(tx, ctx, id); if (["completed", "cancelled"].includes(t.status)) throw new AuthError("Terminal transfer cannot be modified", 409);
    await tx.update(inventoryTransfer).set(p).where(transferScope(ctx, id)); const result = await transferDto(tx, ctx, id); await audit(tx, ctx, "inventory_transfer", id, "update", result, request); return result; });
}
async function completeTransfer(tx: Tx, ctx: AuthContext, id: string, request?: Request) {
  const [header] = await tx.select().from(inventoryTransfer).where(transferScope(ctx, id)).for("update"); if (!header) throw new AuthError("Transfer not found", 404);
  const t = await transferDto(tx, ctx, id);
  if (!["draft", "in_transit"].includes(t.status)) throw new AuthError("Transfer already completed or cancelled", 409);
  await ownedWarehouse(tx, ctx, t.fromWarehouseId, true); await ownedWarehouse(tx, ctx, t.toWarehouseId, true);
  if (t.fromWarehouseId === t.toWarehouseId || !t.lines.length || new Set(t.lines.map(l => l.inventoryItemId)).size !== t.lines.length) throw new AuthError("Invalid saved transfer lines", 422);
  const prepared = [];
  for (const line of [...t.lines].sort((a, b) => a.inventoryItemId.localeCompare(b.inventoryItemId))) {
    physicalQuantity.parse(line.quantity); if (line.quantity <= 0) throw new AuthError("Positive transfer quantity required", 422);
    const item = await lockedItem(tx, ctx, line.inventoryItemId), source = await stock(tx, ctx, item.id, t.fromWarehouseId), destination = await stock(tx, ctx, item.id, t.toWarehouseId);
    if (source < line.quantity) throw new AuthError("Insufficient source warehouse stock", 400); physicalQuantity.parse(destination + line.quantity);
    prepared.push({ line, item, source, destination });
  }
  for (const { line, item, source, destination } of prepared) {
    await setStock(tx, ctx, item.id, t.fromWarehouseId, source - line.quantity); await setStock(tx, ctx, item.id, t.toWarehouseId, destination + line.quantity);
    await tx.insert(inventoryMovement).values([
      { organizationId: ctx.organizationId, inventoryItemId: item.id, warehouseId: t.fromWarehouseId, type: "transfer_out", quantity: -line.quantity, previousQuantity: item.quantityOnHand, newQuantity: item.quantityOnHand, reason: "Transfer to warehouse", referenceType: "transfer", referenceId: id, createdBy: ctx.userId },
      { organizationId: ctx.organizationId, inventoryItemId: item.id, warehouseId: t.toWarehouseId, type: "transfer_in", quantity: line.quantity, previousQuantity: item.quantityOnHand, newQuantity: item.quantityOnHand, reason: "Transfer from warehouse", referenceType: "transfer", referenceId: id, createdBy: ctx.userId },
    ]);
    await tx.update(inventoryTransferLine).set({ receivedQuantity: line.quantity }).where(eq(inventoryTransferLine.id, line.id));
  }
  await tx.update(inventoryTransfer).set({ status: "completed", completedAt: new Date() }).where(transferScope(ctx, id)); const result = await transferDto(tx, ctx, id);
  await audit(tx, ctx, "inventory_transfer", id, "complete", result, request); return result;
}
export async function completeInventoryTransfer(ctx: AuthContext, id: string, request?: Request) { requireRole(ctx, "manage:inventory"); catalogId.parse(id); return db.transaction(async tx => { await orgLock(tx, ctx); return completeTransfer(tx, ctx, id, request); }); }
export async function transferInventoryStock(ctx: AuthContext, input: unknown) {
  requireRole(ctx, "manage:inventory"); const p = transferCreateSchema.parse(input);
  return db.transaction(async tx => { await orgLock(tx, ctx); const t = await createTransfer(tx, ctx, p); return completeTransfer(tx, ctx, t.id); });
}

const takeScope = (ctx: AuthContext, id?: string) => and(eq(stockTake.organizationId, ctx.organizationId), id ? eq(stockTake.id, id) : undefined);
async function takeDto(tx: Tx | typeof db, ctx: AuthContext, id: string) {
  const t = await tx.query.stockTake.findFirst({ where: takeScope(ctx, id), with: { lines: true } }); if (!t) throw new AuthError("Stock take not found", 404);
  const location = t.warehouseId ? await historicalWarehouse(tx, ctx, t.warehouseId) : null;
  const lines = [];
  for (const line of t.lines) {
    const item = await tx.query.inventoryItem.findFirst({ where: and(eq(inventoryItem.id, line.inventoryItemId), eq(inventoryItem.organizationId, ctx.organizationId)), columns: { id: true, name: true, code: true } });
    if (!item) throw new AuthError("Stock take item not found", 404); lines.push({ ...stockTakeLineDto(line), inventoryItem: item });
  }
  return { ...t, warehouse: location ? { id: location.id, name: location.name, code: location.code } : null, lines };
}
export async function listStockTakes(ctx: AuthContext) {
  const rows = await db.select({ id: stockTake.id }).from(stockTake).where(takeScope(ctx)).orderBy(desc(stockTake.createdAt), stockTake.id);
  return Promise.all(rows.map(async r => { const { lines, ...t } = await takeDto(db, ctx, r.id); return { ...t, itemCount: lines.length }; }));
}
export async function getStockTake(ctx: AuthContext, id: string) { catalogId.parse(id); return takeDto(db, ctx, id); }
export async function createStockTake(ctx: AuthContext, input: unknown, request?: Request) {
  requireRole(ctx, "manage:inventory"); const p = stockTakeCreateSchema.parse(input);
  return db.transaction(async tx => { await orgLock(tx, ctx); if (p.warehouseId) await ownedWarehouse(tx, ctx, p.warehouseId, true);
    const items = await tx.select().from(inventoryItem).where(and(eq(inventoryItem.organizationId, ctx.organizationId), isNull(inventoryItem.deletedAt), eq(inventoryItem.isActive, true))).orderBy(inventoryItem.id).for("update");
    const lines = [];
    for (const item of items) { itemDto(item); const quantity = p.warehouseId ? await stock(tx, ctx, item.id, p.warehouseId) : item.quantityOnHand; physicalQuantity.parse(quantity); lines.push({ inventoryItemId: item.id, expectedQuantity: quantity }); }
    const [row] = await tx.insert(stockTake).values({ ...p, organizationId: ctx.organizationId, createdBy: ctx.userId }).returning();
    if (lines.length) await tx.insert(stockTakeLine).values(lines.map(l => ({ ...l, stockTakeId: row.id })));
    await audit(tx, ctx, "stock_take", row.id, "create", row, request); return row;
  });
}
export async function updateStockTake(ctx: AuthContext, id: string, input: unknown, request?: Request) {
  requireRole(ctx, "manage:inventory"); catalogId.parse(id); const p = stockTakeUpdateSchema.parse(input);
  return db.transaction(async tx => { await orgLock(tx, ctx); const t = await takeDto(tx, ctx, id);
    if (["completed", "cancelled"].includes(t.status)) throw new AuthError("Terminal stock take cannot be modified", 409);
    await tx.update(stockTake).set({ ...p, updatedAt: new Date(), ...(p.status === "in_progress" && t.status !== "in_progress" ? { startedAt: new Date() } : {}) }).where(takeScope(ctx, id));
    const result = await takeDto(tx, ctx, id); await audit(tx, ctx, "stock_take", id, "update", result, request); return result;
  });
}
export async function deleteStockTake(ctx: AuthContext, id: string, request?: Request) {
  requireRole(ctx, "manage:inventory"); catalogId.parse(id);
  return db.transaction(async tx => { await orgLock(tx, ctx); const t = await takeDto(tx, ctx, id); if (t.status !== "draft") throw new AuthError("Only draft stock takes can be deleted", 400);
    await tx.delete(stockTakeLine).where(eq(stockTakeLine.stockTakeId, id)); await tx.delete(stockTake).where(takeScope(ctx, id)); await audit(tx, ctx, "stock_take", id, "delete", t, request); return { success: true };
  });
}
export async function countStockTakeLine(ctx: AuthContext, id: string, lineId: string, input: unknown, request?: Request) {
  requireRole(ctx, "manage:inventory"); catalogId.parse(id); catalogId.parse(lineId); const p = stockTakeCountSchema.parse(input);
  return db.transaction(async tx => { await orgLock(tx, ctx); const t = await takeDto(tx, ctx, id); if (t.status !== "in_progress") throw new AuthError("Stock take must be in progress", 400);
    const line = t.lines.find(l => l.id === lineId); if (!line) throw new AuthError("Stock take line not found", 404);
    const discrepancy = physicalQuantity.parse(p.countedQuantity - line.expectedQuantity);
    const [row] = await tx.update(stockTakeLine).set({ ...p, discrepancy, updatedAt: new Date() }).where(and(eq(stockTakeLine.id, lineId), eq(stockTakeLine.stockTakeId, id))).returning();
    const result = stockTakeLineDto(row); await audit(tx, ctx, "stock_take_line", lineId, "count", result, request); return result;
  });
}
export async function applyStockTake(ctx: AuthContext, id: string, date = today(), request?: Request) {
  requireRole(ctx, "manage:inventory"); catalogId.parse(id); postingDate.parse(date);
  return db.transaction(async tx => { await orgLock(tx, ctx); await assertNotLocked(ctx.organizationId, date, ctx);
    const [header] = await tx.select().from(stockTake).where(takeScope(ctx, id)).for("update"); if (!header) throw new AuthError("Stock take not found", 404);
    const t = await takeDto(tx, ctx, id); if (t.status !== "in_progress") throw new AuthError("Stock take must be in progress", 400);
    if (t.warehouseId) await ownedWarehouse(tx, ctx, t.warehouseId, true);
    const prepared = [];
    if (new Set(t.lines.map(l => l.inventoryItemId)).size !== t.lines.length) throw new AuthError("Duplicate saved stock-take items", 422);
    // Recompute ALL counted lines against live stock, including saved zero discrepancies.
    // A location count compares location units, never the global quantity.
    for (const line of [...t.lines].sort((a, b) => a.inventoryItemId.localeCompare(b.inventoryItemId))) {
      if (line.countedQuantity === null) continue;
      if (line.countedQuantity < 0) throw new AuthError("Invalid saved count", 422);
      const item = await lockedItem(tx, ctx, line.inventoryItemId);
      const live = t.warehouseId ? await stock(tx, ctx, item.id, t.warehouseId) : item.quantityOnHand;
      const delta = physicalQuantity.parse(line.countedQuantity - live); if (delta) await preflightAdjustment(tx, ctx, item, delta);
      prepared.push({ line, item, delta });
    }
    let adjustedCount = 0; const journalEntryIds: string[] = [];
    for (const { line, item, delta } of prepared) {
      const r = delta ? await quantityAdjustment(tx, ctx, item, delta, `Stock take: ${t.name}`, date, t.warehouseId, id) : null;
      if (r) { adjustedCount++; if (r.journalEntryId) journalEntryIds.push(r.journalEntryId); }
      await tx.update(stockTakeLine).set({ adjusted: true, discrepancy: delta, valueAdjustment: r?.value ?? 0, journalEntryId: r?.journalEntryId ?? null, updatedAt: new Date() }).where(eq(stockTakeLine.id, line.id));
    }
    await tx.update(stockTake).set({ status: "completed", completedAt: new Date(), updatedAt: new Date() }).where(takeScope(ctx, id));
    const result = { stockTake: await takeDto(tx, ctx, id), adjustedCount, journalEntryIds };
    await audit(tx, ctx, "stock_take", id, "apply", result, request); return result;
  });
}

export async function listMovements(ctx: AuthContext, input: unknown) {
  const p = movementListSchema.parse(input); if (p.inventoryItemId) await readItem(ctx, p.inventoryItemId); if (p.warehouseId) await ownedWarehouse(db, ctx, p.warehouseId);
  const scope = and(eq(inventoryMovement.organizationId, ctx.organizationId), p.inventoryItemId ? eq(inventoryMovement.inventoryItemId, p.inventoryItemId) : undefined, p.warehouseId ? eq(inventoryMovement.warehouseId, p.warehouseId) : undefined, p.type ? eq(inventoryMovement.type, p.type) : undefined);
  const rows = await db.select().from(inventoryMovement).where(scope).orderBy(desc(inventoryMovement.createdAt), inventoryMovement.id).limit(p.limit).offset((p.page - 1) * p.limit);
  const [count] = await db.select({ total: sql<number>`count(*)::int` }).from(inventoryMovement).where(scope);
  return { data: rows.map(movementDto), pagination: { page: p.page, limit: p.limit, total: count.total, totalPages: Math.ceil(count.total / p.limit) } };
}
export async function movementChart(ctx: AuthContext, input: unknown) {
  const p = chartSchema.parse(input); if (p.warehouseId) await ownedWarehouse(db, ctx, p.warehouseId);
  const groupBy = p.period === "12m" ? "month" : p.period === "90d" ? "week" : "day";
  // SQL literals are selected only from this closed enum. Repeated independent
  // bind parameters in SELECT/GROUP BY are not equivalent to PostgreSQL.
  const bucket = sql`date_trunc(${sql.raw(`'${groupBy}'`)}, ${inventoryMovement.createdAt})::date`;
  const since = new Date(Date.now() - (p.period === "12m" ? 365 : p.period === "90d" ? 90 : 30) * 86400000);
  const rows = await db.select({ date: sql<string>`${bucket}::text`,
    inQty: sql<string>`coalesce(sum(greatest(${inventoryMovement.quantity}::bigint,0)),0)::text`, outQty: sql<string>`coalesce(sum(greatest(-${inventoryMovement.quantity}::bigint,0)),0)::text`, net: sql<string>`coalesce(sum(${inventoryMovement.quantity}::bigint),0)::text` }).from(inventoryMovement)
    .where(and(eq(inventoryMovement.organizationId, ctx.organizationId), gte(inventoryMovement.createdAt, since), p.warehouseId ? eq(inventoryMovement.warehouseId, p.warehouseId) : undefined)).groupBy(bucket).orderBy(bucket);
  return { data: rows.map(r => ({ date: r.date, in: legacyMinor(BigInt(r.inQty)), out: legacyMinor(BigInt(r.outQty)), net: legacyMinor(BigInt(r.net)) })), period: p.period, groupBy };
}
export async function createSerials(ctx: AuthContext, id: string, input: unknown, request?: Request) {
  requireRole(ctx, "manage:inventory"); catalogId.parse(id); const p = serialCreateSchema.parse(input);
  return db.transaction(async tx => { await orgLock(tx, ctx); await lockedItem(tx, ctx, id); if (p.warehouseId) await ownedWarehouse(tx, ctx, p.warehouseId, true);
    for (const label of p.serialNumbers) {
      const found = await tx.query.serialNumber.findFirst({ where: and(eq(serialNumber.organizationId, ctx.organizationId), eq(serialNumber.inventoryItemId, id), eq(serialNumber.serialNumber, label)) }); if (found) throw new AuthError("Serial number already exists for this item", 409);
    }
    const result = await tx.insert(serialNumber).values(p.serialNumbers.map(label => ({ organizationId: ctx.organizationId, inventoryItemId: id, serialNumber: label, warehouseId: p.warehouseId ?? null, status: "available" as const }))).returning();
    await audit(tx, ctx, "inventory_item", id, "serials.create", result, request); return result;
  });
}
export async function createLot(ctx: AuthContext, id: string, input: unknown, request?: Request) {
  requireRole(ctx, "manage:inventory"); catalogId.parse(id); const p = lotCreateSchema.parse(input);
  return db.transaction(async tx => { await orgLock(tx, ctx); await lockedItem(tx, ctx, id); if (p.warehouseId) await ownedWarehouse(tx, ctx, p.warehouseId, true);
    const [row] = await tx.insert(lotBatch).values({ ...p, organizationId: ctx.organizationId, inventoryItemId: id, availableQuantity: p.quantity }).returning();
    await audit(tx, ctx, "inventory_item", id, "lot.create", row, request); return row;
  });
}
export async function listAllocations(ctx: AuthContext, id: string, input: unknown, lots = false) {
  await readItem(ctx, id); const p = allocationListSchema.parse(input); if (lots && p.status) throw new AuthError("Status filter only applies to serials", 400);
  const table = lots ? lotBatch : serialNumber;
  const scope = and(eq(table.organizationId, ctx.organizationId), eq(table.inventoryItemId, id), isNull(table.deletedAt), !lots && p.status ? eq(serialNumber.status, p.status) : undefined);
  const rows = lots ? await db.select().from(lotBatch).where(scope).orderBy(desc(lotBatch.createdAt), lotBatch.id).limit(p.limit).offset((p.page - 1) * p.limit)
    : await db.select().from(serialNumber).where(scope).orderBy(desc(serialNumber.createdAt), serialNumber.id).limit(p.limit).offset((p.page - 1) * p.limit);
  const result = [];
  for (const row of rows) {
    if ("quantity" in row) { physicalQuantity.parse(row.quantity); physicalQuantity.parse(row.availableQuantity); }
    const location = row.warehouseId ? await historicalWarehouse(db, ctx, row.warehouseId) : null; result.push({ ...row, warehouse: location });
  }
  const [count] = await db.select({ total: sql<number>`count(*)::int` }).from(table).where(scope);
  stringifyWire(result); return { data: result, pagination: { page: p.page, limit: p.limit, total: count.total, totalPages: Math.ceil(count.total / p.limit) } };
}
