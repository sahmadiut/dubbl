import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { inventoryItem, inventoryMovement, inventoryCostLayer, warehouseStock, journalEntry, journalLine, warehouse } from "@/lib/db/schema";
import { AuthError, type AuthContext } from "./auth-context";
import { stringifyWire, WireCompatibilityError } from "@/lib/money/wire";
import { invoiceStock, stockQuantity } from "./invoice-stock";
import { safeInvoiceMinor, invoiceRound } from "./invoice-write-wire";
import { journalLineDto } from "./journal-wire";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type StockLine = { inventoryItemId: string | null; quantity: number; warehouseId: string | null };
/** Credit returns retain the existing whole-unit average/FIFO policy, with exact guarded values. */
export async function restockCredit(tx: Tx, ctx: AuthContext, base: string, id: string, lines: StockLine[]) {
  const ids = [...new Set(lines.flatMap(line => line.inventoryItemId ? [line.inventoryItemId] : []))].sort();
  if (ids.length) {
    const items = await tx.select().from(inventoryItem).where(and(eq(inventoryItem.organizationId, ctx.organizationId), inArray(inventoryItem.id, ids))).orderBy(asc(inventoryItem.id)).for("update");
    const layers = await tx.select().from(inventoryCostLayer).where(and(eq(inventoryCostLayer.organizationId, ctx.organizationId), inArray(inventoryCostLayer.inventoryItemId, ids)));
    stringifyWire(items); stringifyWire(layers);
    if (items.length !== ids.length || items.some(item => item.costMethod === "standard" || item.trackingMethod !== "none"))
      throw new WireCompatibilityError("Credit restock currently supports untracked average/FIFO stock only");
  }
  return invoiceStock(tx, ctx, base, id, lines, true);
}

/** Undo the actual saved return quantities and costs, even after the invoice or item price changes. */
export async function undoCreditStock(tx: Tx, ctx: AuthContext, id: string) {
  const movements = await tx.select().from(inventoryMovement).where(and(eq(inventoryMovement.organizationId, ctx.organizationId),
    eq(inventoryMovement.referenceId, id), eq(inventoryMovement.referenceType, "sale_reversal"))).orderBy(asc(inventoryMovement.inventoryItemId), asc(inventoryMovement.id));
  if (!movements.length) return null; // Historical unlinked returns use the explicit fallback in the caller.
  const entries = await tx.select().from(journalEntry).where(and(eq(journalEntry.organizationId, ctx.organizationId), eq(journalEntry.sourceId, id), eq(journalEntry.sourceType, "credit_note_cogs")));
  if (entries.length > 1 || (entries.length === 0 && movements.some(movement => movement.value !== 0)) ||
    (entries.length === 1 && (entries[0].status !== "posted" || entries[0].deletedAt))) throw new WireCompatibilityError("Saved credit restock journal is unavailable");
  const saved = entries.length ? await tx.select().from(journalLine).where(eq(journalLine.journalEntryId, entries[0].id)) : [];
  saved.forEach(line => journalLineDto(line)); stringifyWire(movements);
  if (!saved.length && movements.some(movement => movement.value !== 0)) throw new WireCompatibilityError("Saved restock costs have no journal");
  const value = safeInvoiceMinor(movements.reduce((sum, movement) => sum + BigInt(movement.value), 0n));
  if (safeInvoiceMinor(saved.reduce((sum, line) => sum + BigInt(line.debitAmount), 0n)) !== value ||
    safeInvoiceMinor(saved.reduce((sum, line) => sum + BigInt(line.creditAmount), 0n)) !== value)
    throw new WireCompatibilityError("Saved restock costs and journal must agree");
  for (const movement of movements) {
    if (movement.quantity <= 0 || movement.value < 0) throw new WireCompatibilityError("Invalid saved restock movement");
    const [item] = await tx.select().from(inventoryItem).where(and(eq(inventoryItem.id, movement.inventoryItemId), eq(inventoryItem.organizationId, ctx.organizationId))).for("update");
    if (!item) throw new WireCompatibilityError("Saved credit restock item belongs to another organization"); stringifyWire(item);
    const quantity = stockQuantity(BigInt(item.quantityOnHand) - BigInt(movement.quantity)), value = safeInvoiceMinor(BigInt(item.totalValue) - BigInt(movement.value));
    if (quantity < 0 || value < 0) throw new AuthError("Returned stock has been consumed and cannot be voided", 400);
    const layers = await tx.select().from(inventoryCostLayer).where(and(eq(inventoryCostLayer.sourceMovementId, movement.id), eq(inventoryCostLayer.organizationId, ctx.organizationId))).for("update");
    stringifyWire(layers);
    if (layers.some(layer => layer.inventoryItemId !== item.id || layer.warehouseId !== movement.warehouseId)) throw new WireCompatibilityError("Saved FIFO return layers belong to another stock dimension");
    if (item.costMethod === "fifo" && (layers.reduce((sum, layer) => sum + BigInt(layer.originalQuantity), 0n) !== BigInt(movement.quantity) ||
      layers.some(layer => layer.remainingQuantity !== layer.originalQuantity))) throw new AuthError("Returned FIFO stock has been consumed and cannot be voided", 400);
    if (layers.length) await tx.delete(inventoryCostLayer).where(inArray(inventoryCostLayer.id, layers.map(layer => layer.id)));
    await tx.insert(inventoryMovement).values({ organizationId: ctx.organizationId, inventoryItemId: item.id, warehouseId: movement.warehouseId,
      type: "sale", quantity: -movement.quantity, previousQuantity: item.quantityOnHand, newQuantity: quantity,
      unitCost: movement.unitCost, value: -movement.value, referenceType: "credit_note_void", referenceId: id, createdBy: ctx.userId });
    await tx.update(inventoryItem).set({ quantityOnHand: quantity, totalValue: value,
      averageCost: quantity > 0 ? safeInvoiceMinor(invoiceRound(BigInt(value), BigInt(quantity))) : 0, updatedAt: new Date() }).where(eq(inventoryItem.id, item.id));
    if (movement.warehouseId) {
      const [owned] = await tx.select({ id: warehouse.id }).from(warehouse).where(and(eq(warehouse.id, movement.warehouseId), eq(warehouse.organizationId, ctx.organizationId)));
      const [stock] = await tx.select().from(warehouseStock).where(and(eq(warehouseStock.organizationId, ctx.organizationId), eq(warehouseStock.inventoryItemId, item.id), eq(warehouseStock.warehouseId, movement.warehouseId))).for("update");
      if (!owned || !stock || stock.quantity < movement.quantity) throw new WireCompatibilityError("Saved credit warehouse stock cannot be unwound");
      await tx.update(warehouseStock).set({ quantity: stockQuantity(BigInt(stock.quantity) - BigInt(movement.quantity)), updatedAt: new Date() }).where(eq(warehouseStock.id, stock.id));
    }
  }
  return { saved, original: entries[0] ?? null };
}
