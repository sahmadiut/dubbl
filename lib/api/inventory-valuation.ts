import { exactBlendAverageCost, roundInventoryRatio } from "@/lib/money/inventory-cost";
import { db } from "@/lib/db";
import {
  inventoryItem,
  inventoryMovement,
  inventoryCostLayer,
  inventoryLayerConsumption,
  warehouseStock,
} from "@/lib/db/schema";
import { and, eq, asc, sql } from "drizzle-orm";
import { legacyMinor, legacyMinorSchema, WireCompatibilityError } from "@/lib/money/wire";
import { catalogQuantity } from "./inventory-catalog-wire";
import { z } from "zod";

const zPositiveQuantity = z.number().positive();

/**
 * Perpetual inventory valuation engine (average cost + FIFO cost layers).
 *
 * SCOPE: this module owns the cost-flow MATH and the physical movement/quantity
 * bookkeeping (inventoryMovement rows, quantityOnHand, averageCost, totalValue,
 * warehouseStock, FIFO layers). It deliberately does NOT post the GL journal —
 * the offsetting account differs by context (AP/GRNI on receipt, COGS on sale,
 * shrinkage on adjustment) and is posted by the caller in journal-automation.ts.
 * This keeps the inventory debit/credit from being double-counted.
 *
 * Quantities are whole units (matching inventoryItem.quantityOnHand); costs are
 * integer cents per unit. value = unitCost * quantity (always in base currency).
 */

type Tx = Parameters<Parameters<(typeof db)["transaction"]>[0]>[0];

export interface ValuedItem {
  id: string;
  organizationId: string;
  costMethod: string;
  averageCost: number;
  quantityOnHand: number;
  totalValue: number;
}

// Row locking also protects callers in adjacent invoice/bill/assembly workflows.
// A stale pre-read must fail instead of overwriting a concurrent movement.
async function lockValuedItem(tx: Tx, item: ValuedItem) {
  const [current] = await tx.select().from(inventoryItem).where(and(eq(inventoryItem.id, item.id), eq(inventoryItem.organizationId, item.organizationId))).for("update");
  if (!current || current.deletedAt) throw new WireCompatibilityError("Live owned inventory item required");
  for (const key of ["quantityOnHand", "averageCost", "totalValue", "costMethod"] as const)
    if (current[key] !== item[key]) throw new WireCompatibilityError("Inventory changed concurrently; reload and retry");
  catalogQuantity.parse(item.quantityOnHand);
  legacyMinorSchema.min(0).parse(item.averageCost); legacyMinorSchema.min(0).parse(item.totalValue);
}

/** New moving-average unit cost after receiving `qty` units at `unitCost`. */
export function blendAverageCost(
  prevQty: number,
  prevAvg: number,
  qty: number,
  unitCost: number
): number {
  return exactBlendAverageCost(prevQty, prevAvg, qty, unitCost);
}

/**
 * Record a stock RECEIPT (purchase, positive adjustment, return-in): bumps
 * quantityOnHand + totalValue, blends average cost (or opens a FIFO layer),
 * updates warehouseStock, and writes the inventoryMovement row. No GL posting.
 * Returns the movement id and the per-unit cost used.
 */
export async function recordInventoryReceipt(
  tx: Tx,
  args: {
    item: ValuedItem;
    quantity: number; // whole units, > 0
    unitCost: number; // cents per unit
    warehouseId?: string | null;
    type?: "purchase" | "adjustment" | "transfer_in" | "initial";
    referenceType?: string | null;
    referenceId?: string | null;
    createdBy?: string | null;
    receivedAt?: Date;
  }
): Promise<{ movementId: string; unitCost: number }> {
  const { item } = args;
  await lockValuedItem(tx, item);
  const qty = args.quantity;
  catalogQuantity.pipe(zPositiveQuantity).parse(qty);
  legacyMinorSchema.min(0).parse(args.unitCost);
  const value = legacyMinor(BigInt(args.unitCost) * BigInt(qty));
  const prevQty = item.quantityOnHand;
  const newQty = catalogQuantity.parse(prevQty + qty);
  const newValue = legacyMinor(BigInt(item.totalValue) + BigInt(value));
  const newAvg = newQty > 0 ? roundInventoryRatio(BigInt(newValue), BigInt(newQty)) : args.unitCost;

  const [movement] = await tx
    .insert(inventoryMovement)
    .values({
      organizationId: item.organizationId,
      inventoryItemId: item.id,
      warehouseId: args.warehouseId ?? null,
      type: args.type ?? "purchase",
      quantity: qty,
      previousQuantity: prevQty,
      newQuantity: newQty,
      unitCost: args.unitCost,
      value,
      referenceType: args.referenceType ?? null,
      referenceId: args.referenceId ?? null,
      createdBy: args.createdBy ?? null,
    })
    .returning();

  await tx
    .update(inventoryItem)
    .set({ quantityOnHand: newQty, averageCost: newAvg, totalValue: newValue, updatedAt: new Date() })
    .where(eq(inventoryItem.id, item.id));

  if (item.costMethod === "fifo") {
    await tx.insert(inventoryCostLayer).values({
      organizationId: item.organizationId,
      inventoryItemId: item.id,
      warehouseId: args.warehouseId ?? null,
      originalQuantity: qty,
      remainingQuantity: qty,
      unitCost: args.unitCost,
      sourceMovementId: movement.id,
      ...(args.receivedAt ? { receivedAt: args.receivedAt } : {}),
    });
  }

  if (args.warehouseId) {
    await upsertWarehouseStock(tx, item.organizationId, item.id, args.warehouseId, qty);
  }

  return { movementId: movement.id, unitCost: args.unitCost };
}

/**
 * Record a stock ISSUE (sale, negative adjustment, return-out): decrements
 * quantityOnHand + totalValue and returns the cost of goods issued. Average
 * method values the issue at the current average; FIFO consumes oldest layers
 * first (recording which layers were consumed). No GL posting.
 */
export async function recordInventoryIssue(
  tx: Tx,
  args: {
    item: ValuedItem;
    quantity: number; // whole units, > 0
    warehouseId?: string | null;
    type?: "sale" | "adjustment" | "transfer_out";
    referenceType?: string | null;
    referenceId?: string | null;
    createdBy?: string | null;
  }
): Promise<{ movementId: string; cost: number }> {
  const { item } = args;
  await lockValuedItem(tx, item);
  const qty = args.quantity;
  catalogQuantity.pipe(zPositiveQuantity).parse(qty);
  const prevQty = item.quantityOnHand;
  const newQty = catalogQuantity.parse(prevQty - qty);

  let cost: number;
  let consumptions: { costLayerId: string; quantity: number; unitCost: number }[] = [];

  if (item.costMethod === "fifo") {
    const consumed = await consumeFifoLayers(tx, item, qty);
    cost = consumed.totalCost;
    consumptions = consumed.consumptions;
  } else {
    // average / standard: value at current average unit cost
    let exactCost = BigInt(item.averageCost) * BigInt(qty);
    if (item.costMethod === "average" && newQty >= 0) exactCost = newQty === 0 ? BigInt(item.totalValue) : exactCost > BigInt(item.totalValue) ? BigInt(item.totalValue) : exactCost;
    cost = legacyMinor(exactCost);
  }

  const newValue = Math.max(0, legacyMinor(BigInt(item.totalValue) - BigInt(cost)));

  const [movement] = await tx
    .insert(inventoryMovement)
    .values({
      organizationId: item.organizationId,
      inventoryItemId: item.id,
      warehouseId: args.warehouseId ?? null,
      type: args.type ?? "sale",
      quantity: -qty,
      previousQuantity: prevQty,
      newQuantity: newQty,
      unitCost: qty > 0 ? roundInventoryRatio(BigInt(cost), BigInt(qty)) : 0,
      value: -cost,
      referenceType: args.referenceType ?? null,
      referenceId: args.referenceId ?? null,
      createdBy: args.createdBy ?? null,
    })
    .returning();

  // average cost per unit is unchanged by an issue; only qty + total value drop
  await tx
    .update(inventoryItem)
    .set({ quantityOnHand: newQty, totalValue: newValue, updatedAt: new Date() })
    .where(eq(inventoryItem.id, item.id));

  if (consumptions.length > 0) {
    await tx.insert(inventoryLayerConsumption).values(
      consumptions.map((c) => ({
        issueMovementId: movement.id,
        costLayerId: c.costLayerId,
        quantity: c.quantity,
        unitCost: c.unitCost,
      }))
    );
  }

  if (args.warehouseId) {
    await upsertWarehouseStock(tx, item.organizationId, item.id, args.warehouseId, -qty);
  }

  return { movementId: movement.id, cost };
}

/**
 * Consume FIFO layers oldest-first for `qty` units, locking the rows so two
 * concurrent issues can't double-spend a layer. Returns the blended cost and
 * the per-layer consumption breakdown. Falls back to the item average for any
 * shortfall when layers don't cover the quantity (negative-on-hand guard).
 */
export async function consumeFifoLayers(
  tx: Tx,
  item: ValuedItem,
  qty: number
): Promise<{ totalCost: number; consumptions: { costLayerId: string; quantity: number; unitCost: number }[] }> {
  const layers = await tx
    .select()
    .from(inventoryCostLayer)
    .where(
      and(
        eq(inventoryCostLayer.organizationId, item.organizationId),
        eq(inventoryCostLayer.inventoryItemId, item.id),
        sql`${inventoryCostLayer.remainingQuantity} > 0`
      )
    )
    .orderBy(asc(inventoryCostLayer.receivedAt), asc(inventoryCostLayer.id))
    .for("update");

  let remaining = qty;
  let totalCost = 0;
  const consumptions: { costLayerId: string; quantity: number; unitCost: number }[] = [];

  for (const layer of layers) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, layer.remainingQuantity);
    catalogQuantity.parse(layer.remainingQuantity); legacyMinorSchema.min(0).parse(layer.unitCost);
    totalCost = legacyMinor(BigInt(totalCost) + BigInt(take) * BigInt(layer.unitCost));
    consumptions.push({ costLayerId: layer.id, quantity: take, unitCost: layer.unitCost });
    await tx
      .update(inventoryCostLayer)
      .set({ remainingQuantity: layer.remainingQuantity - take })
      .where(eq(inventoryCostLayer.id, layer.id));
    remaining -= take;
  }

  // Shortfall (issuing more than recorded layers): value the remainder at the
  // item's average cost so the issue still posts a sensible cost.
  if (remaining > 0) {
    totalCost = legacyMinor(BigInt(totalCost) + BigInt(remaining) * BigInt(item.averageCost));
  }

  return { totalCost, consumptions };
}

/** Add (or subtract) a quantity to the per-warehouse stock row, creating it if needed. */
async function upsertWarehouseStock(
  tx: Tx,
  organizationId: string,
  inventoryItemId: string,
  warehouseId: string,
  qtyDelta: number
): Promise<void> {
  const existing = await tx.query.warehouseStock.findFirst({
    where: and(
      eq(warehouseStock.organizationId, organizationId),
      eq(warehouseStock.inventoryItemId, inventoryItemId),
      eq(warehouseStock.warehouseId, warehouseId)
    ),
  });
  if (existing) {
    await tx
      .update(warehouseStock)
      .set({ quantity: catalogQuantity.parse(existing.quantity + qtyDelta), updatedAt: new Date() })
      .where(eq(warehouseStock.id, existing.id));
  } else {
    await tx.insert(warehouseStock).values({
      organizationId,
      inventoryItemId,
      warehouseId,
      quantity: qtyDelta,
    });
  }
}
