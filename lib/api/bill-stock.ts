import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { inventoryItem, inventoryMovement, inventoryCostLayer, warehouseStock } from "@/lib/db/schema";
import { AuthContext } from "./auth-context";
import { WireCompatibilityError } from "@/lib/money/wire";
import { invoiceRound, safeInvoiceMinor } from "./invoice-write-wire";
import { billInt32 } from "./bill-lifecycle-wire";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export async function billStockMovement(tx: Tx, ctx: AuthContext, data: {
  billId: string; itemId: string; warehouseId: string | null; quantity: number; value: number;
  journalEntryId: string | null; reverseMovementId?: string; referenceType?: "goods_receipt";
}) {
  const [item] = await tx.select().from(inventoryItem).where(and(eq(inventoryItem.id, data.itemId), eq(inventoryItem.organizationId, ctx.organizationId))).for("update");
  if (!item) throw new WireCompatibilityError("Bill stock item belongs to another organization");
  if ((!data.referenceType && !data.journalEntryId) || (data.referenceType === "goods_receipt" &&
    (!Number.isInteger(data.quantity) || data.quantity <= 0 || data.value < 0 || item.trackingMethod !== "none")))
    throw new WireCompatibilityError("Receipt stock requires positive whole units and nonnegative value; bill stock requires a journal link");
  for (const value of [item.averageCost, item.totalValue, data.value]) if (!Number.isSafeInteger(value)) throw new WireCompatibilityError();
  if (item.totalValue < 0 || item.averageCost < 0 || !["average", "fifo", "standard"].includes(item.costMethod)) throw new WireCompatibilityError("Unsupported bill inventory history");
  const quantity = billInt32(BigInt(item.quantityOnHand) + BigInt(data.quantity));
  const value = safeInvoiceMinor(BigInt(item.totalValue) + BigInt(data.value));
  if (value < 0 || (quantity === 0 && value !== 0)) throw new WireCompatibilityError("Bill stock reversal would strand or overdraw inventory value");
  const averageCost = quantity ? safeInvoiceMinor(invoiceRound(BigInt(value), BigInt(quantity))) : 0;
  const unitCost = data.quantity ? safeInvoiceMinor(invoiceRound(BigInt(data.value), BigInt(data.quantity))) : 0;
  let layer: typeof inventoryCostLayer.$inferSelect | undefined;
  if (item.costMethod === "fifo") {
    if (data.quantity === 0 && data.value !== 0) throw new WireCompatibilityError("FIFO purchase variance requires separate layer qualification");
    if (data.reverseMovementId) {
      const layers = await tx.select().from(inventoryCostLayer).where(eq(inventoryCostLayer.sourceMovementId, data.reverseMovementId)).for("update");
      layer = layers[0];
      if (layers.length !== 1 || layer.organizationId !== ctx.organizationId || layer.inventoryItemId !== item.id ||
        layer.warehouseId !== data.warehouseId || layer.originalQuantity !== -data.quantity || layer.remainingQuantity !== layer.originalQuantity ||
        safeInvoiceMinor(BigInt(layer.unitCost) * BigInt(layer.originalQuantity)) !== -data.value)
        throw new WireCompatibilityError("Cannot void consumed or unqualified bill FIFO receipts");
    } else if (safeInvoiceMinor(BigInt(unitCost) * BigInt(data.quantity)) !== data.value) {
      throw new WireCompatibilityError("FIFO bill receipt value must divide exactly into whole-unit costs");
    }
  }
  if (data.warehouseId && data.quantity) {
    const [stock] = await tx.select().from(warehouseStock).where(and(eq(warehouseStock.organizationId, ctx.organizationId),
      eq(warehouseStock.inventoryItemId, item.id), eq(warehouseStock.warehouseId, data.warehouseId))).for("update");
    const next = billInt32(BigInt(stock?.quantity ?? 0) + BigInt(data.quantity));
    if (stock) await tx.update(warehouseStock).set({ quantity: next, updatedAt: new Date() }).where(eq(warehouseStock.id, stock.id));
    else await tx.insert(warehouseStock).values({ organizationId: ctx.organizationId, inventoryItemId: item.id, warehouseId: data.warehouseId, quantity: next });
  }
  const [movement] = await tx.insert(inventoryMovement).values({ organizationId: ctx.organizationId, inventoryItemId: item.id,
    warehouseId: data.warehouseId, quantity: data.quantity, previousQuantity: item.quantityOnHand, newQuantity: quantity, unitCost,
    value: data.value, type: data.reverseMovementId ? "adjustment" : data.quantity ? "purchase" : "adjustment",
    referenceType: data.reverseMovementId ? "bill_void" : data.referenceType ?? "bill", referenceId: data.billId,
    journalEntryId: data.journalEntryId, createdBy: ctx.userId }).returning();
  await tx.update(inventoryItem).set({ quantityOnHand: quantity, totalValue: value, averageCost, updatedAt: new Date() }).where(eq(inventoryItem.id, item.id));
  if (layer) await tx.update(inventoryCostLayer).set({ remainingQuantity: 0 }).where(eq(inventoryCostLayer.id, layer.id));
  else if (item.costMethod === "fifo" && data.quantity > 0) await tx.insert(inventoryCostLayer).values({ organizationId: ctx.organizationId,
    inventoryItemId: item.id, warehouseId: data.warehouseId, originalQuantity: data.quantity, remainingQuantity: data.quantity, unitCost, sourceMovementId: movement.id });
  return movement;
}
