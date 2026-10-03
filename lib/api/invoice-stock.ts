import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { inventoryItem, inventoryMovement, inventoryCostLayer, inventoryLayerConsumption, warehouseStock, chartAccount } from "@/lib/db/schema";
import { AuthError, type AuthContext } from "./auth-context";
import { safeInvoiceMinor, invoiceRound } from "./invoice-write-wire";
import { ensureControlAccount } from "./journal-automation";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export function stockQuantity(value: bigint) {
  if (value < -2147483648n || value > 2147483647n) throw new AuthError("Invoice stock quantity exceeds int32 capacity", 422);
  return Number(value);
}

/** Bounded exact version of the existing invoice whole-unit average/FIFO cost flow.
 * All effects use the caller's transaction; other inventory operations remain MON-024.
 */
export async function invoiceStock(tx: Tx, ctx: AuthContext, base: string, invoiceId: string,
  lines: { inventoryItemId: string | null; quantity: number; warehouseId: string | null }[], reverse = false) {
  const legs: { accountId: string; debitAmount: number; creditAmount: number }[] = [];
  const movements: string[] = [];
  // Consistent item lock order across invoices sharing stock.
  const ids = [...new Set(lines.flatMap(line => line.inventoryItemId ? [line.inventoryItemId] : []))].sort();
  if (ids.length) await tx.select({ id: inventoryItem.id }).from(inventoryItem)
    .where(and(eq(inventoryItem.organizationId, ctx.organizationId), inArray(inventoryItem.id, ids))).orderBy(asc(inventoryItem.id)).for("update");
  for (const line of lines) {
    if (!line.inventoryItemId) continue;
    const units = stockQuantity(invoiceRound(BigInt(line.quantity), 100n));
    if (units <= 0) continue; // Preserve existing positive whole-unit stock policy.
    const [item] = await tx.select().from(inventoryItem).where(and(eq(inventoryItem.id, line.inventoryItemId), eq(inventoryItem.organizationId, ctx.organizationId)));
    if (!item) throw new AuthError("Invoice stock item belongs to another organization", 422);
    const cogs = item.costAccountId ? await account(tx, ctx, item.costAccountId) : await ensureControlAccount(ctx.organizationId, "cogs", base, tx);
    const asset = item.inventoryAccountId ? await account(tx, ctx, item.inventoryAccountId) : await ensureControlAccount(ctx.organizationId, "inventory", base, tx);
    if (!cogs || !asset) throw new AuthError("Invoice inventory accounts unavailable", 422);
    if (!cogs.isActive || cogs.deletedAt || !asset.isActive || asset.deletedAt) throw new AuthError("Invoice inventory accounts must be active", 422);
    const quantity = stockQuantity(BigInt(item.quantityOnHand) + BigInt(reverse ? units : -units));
    let cost = BigInt(item.averageCost) * BigInt(units);
    const consumptions: { costLayerId: string; quantity: number; unitCost: number }[] = [];
    if (reverse) {
      // New invoice issues carry the invoice ID. Restore their original values even
      // when average cost changed since the sale. Historical unlinked issues keep
      // the existing current-average policy and remain a qualification limitation.
      const sales = await tx.select().from(inventoryMovement).where(and(eq(inventoryMovement.organizationId, ctx.organizationId),
        eq(inventoryMovement.inventoryItemId, item.id), eq(inventoryMovement.referenceId, invoiceId), eq(inventoryMovement.referenceType, "sale"),
        eq(inventoryMovement.quantity, -units),
        line.warehouseId ? eq(inventoryMovement.warehouseId, line.warehouseId) : sql`${inventoryMovement.warehouseId} is null`)).orderBy(asc(inventoryMovement.id));
      const restored = await tx.select().from(inventoryMovement).where(and(eq(inventoryMovement.organizationId, ctx.organizationId),
        eq(inventoryMovement.inventoryItemId, item.id), eq(inventoryMovement.referenceId, invoiceId), eq(inventoryMovement.referenceType, "sale_reversal"),
        eq(inventoryMovement.quantity, units),
        line.warehouseId ? eq(inventoryMovement.warehouseId, line.warehouseId) : sql`${inventoryMovement.warehouseId} is null`));
      const sale = sales[restored.length];
      if (sale) {
        if (sale.quantity !== -units || sale.value > 0) throw new AuthError("Invoice saved stock issue does not match its lines", 422);
        cost = -BigInt(sale.value);
        const used = await tx.select().from(inventoryLayerConsumption).where(eq(inventoryLayerConsumption.issueMovementId, sale.id));
        for (const use of used) {
          const [layer] = await tx.select().from(inventoryCostLayer).where(and(eq(inventoryCostLayer.id, use.costLayerId),
            eq(inventoryCostLayer.organizationId, ctx.organizationId), eq(inventoryCostLayer.inventoryItemId, item.id))).for("update");
          if (!layer) throw new AuthError("Invoice FIFO layer belongs to another organization", 422);
          await tx.update(inventoryCostLayer).set({ remainingQuantity: stockQuantity(BigInt(layer.remainingQuantity) + BigInt(use.quantity)) }).where(eq(inventoryCostLayer.id, layer.id));
        }
        // A FIFO shortfall valued at average cost needs its own return layer.
        const consumed = used.reduce((sum, use) => sum + use.quantity, 0);
        if (item.costMethod === "fifo" && consumed < units) {
          const remainder = BigInt(units - consumed);
          const layerCost = used.reduce((sum, use) => sum + BigInt(use.quantity) * BigInt(use.unitCost), 0n);
          if ((cost - layerCost) % remainder !== 0n) throw new AuthError("Invoice FIFO shortfall cannot be restored exactly", 422);
          consumptions.push({ costLayerId: "", quantity: Number(remainder), unitCost: safeInvoiceMinor((cost - layerCost) / remainder) });
        }
      } else if (item.costMethod === "fifo") {
        consumptions.push({ costLayerId: "", quantity: units, unitCost: item.averageCost });
      }
    }
    if (!reverse && item.costMethod === "fifo") {
      const layers = await tx.select().from(inventoryCostLayer).where(and(eq(inventoryCostLayer.organizationId, ctx.organizationId),
        eq(inventoryCostLayer.inventoryItemId, item.id), sql`${inventoryCostLayer.remainingQuantity} > 0`))
        .orderBy(asc(inventoryCostLayer.receivedAt), asc(inventoryCostLayer.id)).for("update");
      let remaining = units; cost = 0n;
      for (const layer of layers) {
        if (remaining <= 0) break;
        const take = Math.min(remaining, layer.remainingQuantity);
        cost += BigInt(take) * BigInt(layer.unitCost); safeInvoiceMinor(cost);
        consumptions.push({ costLayerId: layer.id, quantity: take, unitCost: layer.unitCost });
        await tx.update(inventoryCostLayer).set({ remainingQuantity: layer.remainingQuantity - take }).where(eq(inventoryCostLayer.id, layer.id));
        remaining -= take;
      }
      cost += BigInt(remaining) * BigInt(item.averageCost);
    }
    const value = safeInvoiceMinor(cost);
    if (value < 0 || item.averageCost < 0 || item.totalValue < 0) throw new AuthError("Invoice stock costs cannot be negative", 422);
    const rawValue = BigInt(item.totalValue) + (reverse ? cost : -cost);
    const totalValue = safeInvoiceMinor(rawValue < 0n ? 0n : rawValue);
    const averageCost = reverse && quantity > 0 ? safeInvoiceMinor(invoiceRound(BigInt(item.quantityOnHand) * BigInt(item.averageCost) + cost, BigInt(quantity))) : item.averageCost;
    const [movement] = await tx.insert(inventoryMovement).values({ organizationId: ctx.organizationId, inventoryItemId: item.id,
      warehouseId: line.warehouseId, type: reverse ? "adjustment" : "sale", quantity: reverse ? units : -units,
      previousQuantity: item.quantityOnHand, newQuantity: quantity,
      unitCost: safeInvoiceMinor(invoiceRound(cost, BigInt(units))), value: reverse ? value : -value,
      referenceType: reverse ? "sale_reversal" : "sale", referenceId: invoiceId, createdBy: ctx.userId }).returning();
    movements.push(movement.id);
    await tx.update(inventoryItem).set({ quantityOnHand: quantity, totalValue, averageCost, updatedAt: new Date() }).where(eq(inventoryItem.id, item.id));
    if (!reverse && consumptions.length) await tx.insert(inventoryLayerConsumption).values(consumptions.map(row => ({ ...row, issueMovementId: movement.id })));
    if (reverse && item.costMethod === "fifo") {
      for (const remainder of consumptions) await tx.insert(inventoryCostLayer).values({ organizationId: ctx.organizationId,
        inventoryItemId: item.id, warehouseId: line.warehouseId, originalQuantity: remainder.quantity, remainingQuantity: remainder.quantity,
        unitCost: remainder.unitCost, sourceMovementId: movement.id });
    }
    if (line.warehouseId) {
      const [stock] = await tx.select().from(warehouseStock).where(and(eq(warehouseStock.organizationId, ctx.organizationId),
        eq(warehouseStock.inventoryItemId, item.id), eq(warehouseStock.warehouseId, line.warehouseId))).for("update");
      const next = stockQuantity(BigInt(stock?.quantity ?? 0) + BigInt(reverse ? units : -units));
      if (stock) await tx.update(warehouseStock).set({ quantity: next, updatedAt: new Date() }).where(eq(warehouseStock.id, stock.id));
      else await tx.insert(warehouseStock).values({ organizationId: ctx.organizationId, inventoryItemId: item.id, warehouseId: line.warehouseId, quantity: next });
    }
    legs.push({ accountId: reverse ? asset.id : cogs.id, debitAmount: value, creditAmount: 0 },
      { accountId: reverse ? cogs.id : asset.id, debitAmount: 0, creditAmount: value });
  }
  return { legs, movements };
}
async function account(tx: Tx, ctx: AuthContext, id: string) {
  const [found] = await tx.select().from(chartAccount).where(and(eq(chartAccount.id, id), eq(chartAccount.organizationId, ctx.organizationId))).for("share");
  if (!found) throw new AuthError("Invoice inventory account belongs to another organization", 422);
  return found;
}
