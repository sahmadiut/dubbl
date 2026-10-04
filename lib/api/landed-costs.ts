import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { landedCostAllocation, landedCostComponent, landedCostLineAllocation, purchaseOrder, purchaseOrderLine, bill, inventoryItem, inventoryCostLayer, chartAccount, journalEntry, journalLine, auditLog, warehouse } from "@/lib/db/schema";
import { AuthError, type AuthContext } from "./auth-context";
import { requireRole } from "./require-role";
import { assertNotLocked } from "./period-lock";
import { orgLock, lockedItem, postingAccount } from "./inventory-master";
import { landedCreateSchema, landedUpdateSchema, landedListSchema, landedDto, componentDto, lineAllocationDto, landedAmount, landedTotal, savedNonnegative } from "./landed-cost-wire";
import { catalogId } from "./inventory-catalog-wire";
import { publicMoneyDto, publicLineDto } from "./public-money-wire";
import { purchaseOrderDto } from "./purchase-order-wire";
import { legacyMinor, stringifyWire, WireCompatibilityError } from "@/lib/money/wire";
import { allocateInventoryCost, inventoryLayerValue, roundInventoryRatio } from "@/lib/money/inventory-cost";
import { ensureControlAccount, ensureAccountByCode, resolveBaseRate, getNextEntryNumber } from "./journal-automation";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
const scope = (ctx: AuthContext, id?: string) => and(eq(landedCostAllocation.organizationId, ctx.organizationId), isNull(landedCostAllocation.deletedAt), id ? eq(landedCostAllocation.id, id) : undefined);
async function audit(tx: Tx, ctx: AuthContext, id: string, action: string, changes: unknown, request?: Request) {
  await tx.insert(auditLog).values({ organizationId: ctx.organizationId, userId: ctx.userId, entityType: "landed_cost", entityId: id, action,
    changes: JSON.parse(stringifyWire(changes)), ipAddress: request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null, userAgent: request?.headers.get("user-agent") || null });
}
async function references(tx: Tx, ctx: AuthContext, row: { purchaseOrderId: string | null; billId: string | null }) {
  const po = row.purchaseOrderId ? (await tx.select().from(purchaseOrder).where(and(eq(purchaseOrder.id, row.purchaseOrderId), eq(purchaseOrder.organizationId, ctx.organizationId), isNull(purchaseOrder.deletedAt))).for("share"))[0] : null;
  const linkedBill = row.billId ? (await tx.select().from(bill).where(and(eq(bill.id, row.billId), eq(bill.organizationId, ctx.organizationId), isNull(bill.deletedAt))).for("share"))[0] : null;
  if ((row.purchaseOrderId && !po) || (row.billId && !linkedBill)) throw new AuthError("Landed cost source not found", 404);
  return { po, linkedBill };
}
async function detail(tx: Tx, ctx: AuthContext, id: string, lines: boolean) {
  const row = await tx.query.landedCostAllocation.findFirst({ where: scope(ctx, id) });
  if (!row) throw new AuthError("Landed cost allocation not found", 404);
  const { po, linkedBill } = await references(tx, ctx, row);
  const components = await tx.select().from(landedCostComponent).where(eq(landedCostComponent.allocationId, id)).orderBy(asc(landedCostComponent.id));
  for (const c of components) if (c.accountId) {
    const account = await tx.query.chartAccount.findFirst({ where: and(eq(chartAccount.id, c.accountId), eq(chartAccount.organizationId, ctx.organizationId)) });
    if (!account) throw new AuthError("Landed cost source account not found", 404);
  }
  const allocations = lines ? await tx.select().from(landedCostLineAllocation).where(eq(landedCostLineAllocation.allocationId, id)).orderBy(asc(landedCostLineAllocation.id)) : [];
  const poLines = lines && po ? await tx.select().from(purchaseOrderLine).where(eq(purchaseOrderLine.purchaseOrderId, po.id)).orderBy(asc(purchaseOrderLine.sortOrder), asc(purchaseOrderLine.id)) : [];
  for (const line of poLines) {
    if (line.inventoryItemId && !await tx.query.inventoryItem.findFirst({ where: and(eq(inventoryItem.id, line.inventoryItemId), eq(inventoryItem.organizationId, ctx.organizationId)) }))
      throw new AuthError("Purchase order stock reference outside organization", 404);
    if (line.accountId && !await tx.query.chartAccount.findFirst({ where: and(eq(chartAccount.id, line.accountId), eq(chartAccount.organizationId, ctx.organizationId)) }))
      throw new AuthError("Purchase order account outside organization", 404);
    if (line.warehouseId && !await tx.query.warehouse.findFirst({ where: and(eq(warehouse.id, line.warehouseId), eq(warehouse.organizationId, ctx.organizationId)) }))
      throw new AuthError("Purchase order warehouse outside organization", 404);
  }
  if (row.journalEntryId && !await tx.query.journalEntry.findFirst({ where: and(eq(journalEntry.id, row.journalEntryId), eq(journalEntry.organizationId, ctx.organizationId)) }))
    throw new AuthError("Landed cost journal outside organization", 404);
  for (const a of allocations) if (a.purchaseOrderLineId && !poLines.some(l => l.id === a.purchaseOrderLineId)) throw new AuthError("Landed cost line outside source purchase order", 404);
  const result = { ...landedDto(row), components: components.map(componentDto),
    bill: linkedBill ? publicMoneyDto(linkedBill, ["subtotal", "taxTotal", "total", "amountPaid", "amountDue"]) : null,
    purchaseOrder: po ? { ...purchaseOrderDto(po), ...(lines ? { lines: poLines.map(publicLineDto) } : {}) } : null,
    ...(lines ? { lineAllocations: allocations.map(lineAllocationDto) } : {}) };
  stringifyWire(result); return result;
}
export async function getLandedCost(ctx: AuthContext, id: string) {
  catalogId.parse(id); return db.transaction(tx => detail(tx, ctx, id, true));
}
export async function listLandedCosts(ctx: AuthContext, input: unknown) {
  const p = landedListSchema.parse(input);
  return db.transaction(async tx => {
    const rows = await tx.select({ id: landedCostAllocation.id }).from(landedCostAllocation).where(scope(ctx)).orderBy(desc(landedCostAllocation.createdAt), asc(landedCostAllocation.id)).limit(p.limit).offset((p.page - 1) * p.limit);
    const [count] = await tx.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(landedCostAllocation).where(scope(ctx));
    const allocations = []; for (const r of rows) allocations.push(await detail(tx, ctx, r.id, false));
    return { allocations, total: count.count, page: p.page, limit: p.limit };
  });
}
export async function createLandedCost(ctx: AuthContext, input: unknown, request?: Request) {
  requireRole(ctx, "manage:purchases"); const p = landedCreateSchema.parse(input), totalCostAmount = landedTotal(p.components);
  return db.transaction(async tx => {
    await orgLock(tx, ctx); await references(tx, ctx, { purchaseOrderId: p.purchaseOrderId ?? null, billId: p.billId ?? null });
    for (const c of p.components) if (c.accountId) {
      const account = await tx.query.chartAccount.findFirst({ where: and(eq(chartAccount.id, c.accountId), eq(chartAccount.organizationId, ctx.organizationId), eq(chartAccount.isActive, true), isNull(chartAccount.deletedAt)) });
      if (!account) throw new AuthError("Live owned source account required", 404);
    }
    const [row] = await tx.insert(landedCostAllocation).values({ organizationId: ctx.organizationId, name: p.name, purchaseOrderId: p.purchaseOrderId ?? null, billId: p.billId ?? null,
      allocationMethod: p.allocationMethod, currencyCode: p.currencyCode, totalCostAmount, createdBy: ctx.userId }).returning();
    await tx.insert(landedCostComponent).values(p.components.map(c => ({ allocationId: row.id, description: c.description, amount: landedAmount(c), accountId: c.accountId ?? null })));
    const dto = landedDto(row); await audit(tx, ctx, row.id, "create", dto, request); return dto;
  });
}
async function draft(tx: Tx, ctx: AuthContext, id: string) {
  const [row] = await tx.select().from(landedCostAllocation).where(scope(ctx, id)).for("update");
  if (!row) throw new AuthError("Landed cost allocation not found", 404);
  if (row.status !== "draft") throw new AuthError("Allocated landed costs are immutable", 409);
  return row;
}
export async function updateLandedCost(ctx: AuthContext, id: string, input: unknown, request?: Request) {
  requireRole(ctx, "manage:purchases"); catalogId.parse(id); const p = landedUpdateSchema.parse(input);
  return db.transaction(async tx => { await orgLock(tx, ctx); const before = await draft(tx, ctx, id); await detail(tx, ctx, id, true);
    const [row] = await tx.update(landedCostAllocation).set({ ...p, updatedAt: new Date() }).where(scope(ctx, id)).returning();
    const dto = landedDto(row); await audit(tx, ctx, id, "update", { before: landedDto(before), after: dto }, request); return dto;
  });
}
export async function deleteLandedCost(ctx: AuthContext, id: string, request?: Request) {
  requireRole(ctx, "manage:purchases"); catalogId.parse(id);
  return db.transaction(async tx => { await orgLock(tx, ctx); const row = await draft(tx, ctx, id); await detail(tx, ctx, id, true);
    await tx.update(landedCostAllocation).set({ deletedAt: new Date(), updatedAt: new Date() }).where(scope(ctx, id));
    await audit(tx, ctx, id, "delete", landedDto(row), request); return { success: true };
  });
}
export async function allocateLandedCost(ctx: AuthContext, id: string, request?: Request) {
  requireRole(ctx, "manage:purchases"); catalogId.parse(id);
  return db.transaction(async tx => {
    await orgLock(tx, ctx); const row = await draft(tx, ctx, id); await detail(tx, ctx, id, true);
    if (!["by_value", "by_quantity"].includes(row.allocationMethod)) throw new AuthError("Weight/manual allocation is unsupported", 422);
    const { po } = await references(tx, ctx, row);
    if (!po) throw new AuthError("Purchase order required for allocation", 400);
    const today = new Date().toISOString().slice(0, 10); await assertNotLocked(ctx.organizationId, today, ctx);
    const { base } = await resolveBaseRate(ctx.organizationId, undefined, today);
    if (row.currencyCode !== base || po.currencyCode !== base) throw new AuthError("Landed cost allocation requires batch and purchase order in base currency", 422);
    const poLines = await tx.select().from(purchaseOrderLine).where(eq(purchaseOrderLine.purchaseOrderId, po.id)).orderBy(asc(purchaseOrderLine.sortOrder), asc(purchaseOrderLine.id)).for("share");
    if (!poLines.length) throw new AuthError("No purchase order lines found", 400);
    const components = await tx.select().from(landedCostComponent).where(eq(landedCostComponent.allocationId, id)).orderBy(asc(landedCostComponent.id));
    savedNonnegative(row.totalCostAmount);
    if (!components.length || legacyMinor(components.reduce((s, c) => s + BigInt(savedNonnegative(c.amount)), 0n)) !== row.totalCostAmount)
      throw new WireCompatibilityError("Saved landed cost components disagree with total");
    const weights = poLines.map(l => savedNonnegative(row.allocationMethod === "by_quantity" ? l.quantity : l.amount));
    const allocations = components.flatMap(c => allocateInventoryCost(c.amount, weights).map((amount, i) => ({ allocationId: id, componentId: c.id, purchaseOrderLineId: poLines[i].id, allocatedAmount: amount, allocationBasis: weights[i] })));
    const itemCosts = new Map<string, bigint>();
    for (const line of poLines) {
      if (!line.inventoryItemId) throw new AuthError("Capitalization requires stock-backed purchase order lines", 422);
      const added = allocations.filter(a => a.purchaseOrderLineId === line.id).reduce((s, a) => s + BigInt(a.allocatedAmount), 0n);
      itemCosts.set(line.inventoryItemId, (itemCosts.get(line.inventoryItemId) ?? 0n) + added);
    }
    const debits = new Map<string, bigint>();
    for (const [itemId, exactAdded] of [...itemCosts].sort(([a], [b]) => a.localeCompare(b))) {
      const added = legacyMinor(exactAdded), item = await lockedItem(tx, ctx, itemId);
      if (!item.isActive || item.quantityOnHand <= 0 || !["average", "fifo"].includes(item.costMethod)) throw new AuthError("Capitalization requires positive on-hand average/FIFO stock", 422);
      const newValue = legacyMinor(BigInt(item.totalValue) + exactAdded), newAvg = roundInventoryRatio(BigInt(newValue), BigInt(item.quantityOnHand));
      if (item.costMethod === "fifo") {
        const layers = await tx.select().from(inventoryCostLayer).where(and(eq(inventoryCostLayer.organizationId, ctx.organizationId), eq(inventoryCostLayer.inventoryItemId, itemId), sql`${inventoryCostLayer.remainingQuantity} > 0`)).orderBy(asc(inventoryCostLayer.receivedAt), asc(inventoryCostLayer.id)).for("update");
        const qty = layers.reduce((s, l) => s + BigInt(l.remainingQuantity), 0n), value = layers.reduce((s, l) => s + BigInt(inventoryLayerValue(l)), 0n);
        if (qty !== BigInt(item.quantityOnHand) || value !== BigInt(item.totalValue)) throw new WireCompatibilityError("FIFO layers disagree with current carrying quantities/value; remediate history first");
        const shares = allocateInventoryCost(added, layers.map(l => l.remainingQuantity));
        for (let i = 0; i < layers.length; i++) {
          const remainingValue = legacyMinor(BigInt(inventoryLayerValue(layers[i])) + BigInt(shares[i]));
          await tx.update(inventoryCostLayer).set({ remainingValue }).where(eq(inventoryCostLayer.id, layers[i].id));
        }
      }
      const inv = item.inventoryAccountId ? { id: item.inventoryAccountId } : await ensureControlAccount(ctx.organizationId, "inventory", base, tx);
      if (!inv) throw new AuthError("Inventory account unavailable", 422); await postingAccount(tx, ctx, inv.id, "asset", base);
      debits.set(inv.id, (debits.get(inv.id) ?? 0n) + exactAdded);
      await tx.update(inventoryItem).set({ totalValue: newValue, averageCost: newAvg, updatedAt: new Date() }).where(eq(inventoryItem.id, item.id));
    }
    let entryId: string | null = null;
    if (row.totalCostAmount > 0) {
      const clearing = await ensureAccountByCode(ctx.organizationId, { code: "2160", name: "Landed Costs Clearing", type: "liability", subType: "current" }, base, tx);
      if (!clearing) throw new AuthError("Landed cost clearing unavailable", 422);
      const account = await tx.query.chartAccount.findFirst({ where: and(eq(chartAccount.id, clearing.id), eq(chartAccount.organizationId, ctx.organizationId), isNull(chartAccount.deletedAt), eq(chartAccount.isActive, true)) });
      if (!account || account.type !== "liability" || account.currencyCode !== base) throw new AuthError("Live base-currency liability clearing account required", 422);
      const [entry] = await tx.insert(journalEntry).values({ organizationId: ctx.organizationId, entryNumber: await getNextEntryNumber(ctx.organizationId, tx), date: today, description: `Landed cost allocation: ${row.name}`,
        reference: "LANDED-COST", status: "posted", sourceType: "landed_cost", sourceId: id, postedAt: new Date(), createdBy: ctx.userId }).returning(); entryId = entry.id;
      await tx.insert(journalLine).values([...debits].filter(([, amount]) => amount > 0n).map(([accountId, amount]) => ({ journalEntryId: entry.id, accountId, description: row.name, debitAmount: legacyMinor(amount), creditAmount: 0, currencyCode: base }))
        .concat([{ journalEntryId: entry.id, accountId: clearing.id, description: row.name, debitAmount: 0, creditAmount: row.totalCostAmount, currencyCode: base }]));
    }
    await tx.insert(landedCostLineAllocation).values(allocations);
    const [updated] = await tx.update(landedCostAllocation).set({ status: "allocated", allocatedAt: new Date(), updatedAt: new Date(), journalEntryId: entryId }).where(scope(ctx, id)).returning();
    const result = { allocation: landedDto(updated), lineAllocations: allocations.map(lineAllocationDto), journalEntryId: entryId };
    stringifyWire(result); await audit(tx, ctx, id, "allocate", result, request); return result;
  });
}
