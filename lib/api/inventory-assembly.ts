import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { billOfMaterials, bomComponent, assemblyOrder, inventoryItem, inventoryCostLayer, inventoryMovement, chartAccount, journalEntry, journalLine, auditLog } from "@/lib/db/schema";
import { AuthError, type AuthContext } from "./auth-context";
import { requireRole } from "./require-role";
import { orgLock, postingAccount } from "./inventory-master";
import { itemDto } from "./inventory-master-wire";
import { catalogId, catalogQuantity } from "./inventory-catalog-wire";
import { bomCreateSchema, bomUpdateSchema, bomCosts, bomDto, bomEstimate, componentCreateSchema, componentUpdateSchema, componentValues, recipeComponentDto, requiredComponentUnits, assemblyCreateSchema, assemblyUpdateSchema, assemblyBuildSchema, assemblyQuantity } from "./inventory-assembly-wire";
import { legacyMinor, stringifyWire, WireCompatibilityError } from "@/lib/money/wire";
import { inventoryLayerValue, roundInventoryRatio } from "@/lib/money/inventory-cost";
import { publicMoneyDto } from "./public-money-wire";
import { recordInventoryIssue, recordInventoryReceipt } from "./inventory-valuation";
import { layerDto } from "./inventory-valuation-wire";
import { assertNotLocked } from "./period-lock";
import { resolveBaseRate, ensureControlAccount, ensureAccountByCode, getNextEntryNumber } from "./journal-automation";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
const bomScope = (ctx: AuthContext, id?: string) => and(eq(billOfMaterials.organizationId, ctx.organizationId), isNull(billOfMaterials.deletedAt), id ? eq(billOfMaterials.id, id) : undefined);
const orderScope = (ctx: AuthContext, id?: string) => and(eq(assemblyOrder.organizationId, ctx.organizationId), isNull(assemblyOrder.deletedAt), id ? eq(assemblyOrder.id, id) : undefined);
async function audit(tx: Tx, ctx: AuthContext, type: string, id: string, action: string, changes: unknown, request?: Request) {
  await tx.insert(auditLog).values({ organizationId: ctx.organizationId, userId: ctx.userId, entityType: type, entityId: id, action,
    changes: JSON.parse(stringifyWire(changes)), ipAddress: request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null, userAgent: request?.headers.get("user-agent") || null });
}
async function ownedItem(tx: Tx, ctx: AuthContext, id: string, active = false) {
  const [row] = await tx.select().from(inventoryItem).where(and(eq(inventoryItem.id, id), eq(inventoryItem.organizationId, ctx.organizationId), isNull(inventoryItem.deletedAt))).for("share");
  if (!row || (active && !row.isActive)) throw new AuthError("Live owned inventory item required", 404);
  itemDto(row); return row;
}
async function lockedBom(tx: Tx, ctx: AuthContext, id: string, write = false) {
  catalogId.parse(id);
  const [row] = await tx.select().from(billOfMaterials).where(bomScope(ctx, id)).for(write ? "update" : "share");
  if (!row) throw new AuthError("BOM not found", 404); bomDto(row); return row;
}
async function bomDetail(tx: Tx, ctx: AuthContext, id: string) {
  const row = await lockedBom(tx, ctx, id), assemblyItem = itemDto(await ownedItem(tx, ctx, row.assemblyItemId));
  const rows = await tx.select().from(bomComponent).where(eq(bomComponent.bomId, id)).orderBy(asc(bomComponent.id));
  const components = [];
  for (const c of rows) components.push({ ...recipeComponentDto(c), componentItem: itemDto(await ownedItem(tx, ctx, c.componentItemId)) });
  const costBreakdown = bomEstimate(components, row.laborCostCents, row.overheadCostCents);
  const { base } = await resolveBaseRate(ctx.organizationId, undefined, new Date().toISOString().slice(0, 10));
  const result = { bom: { ...bomDto(row), currencyCode: base, assemblyItem, components, costBreakdown }, costBreakdown };
  stringifyWire(result); return result;
}
export async function getBom(ctx: AuthContext, id: string) { catalogId.parse(id); return db.transaction(tx => bomDetail(tx, ctx, id)); }
export async function listBoms(ctx: AuthContext) {
  return db.transaction(async tx => {
    const rows = await tx.select({ id: billOfMaterials.id }).from(billOfMaterials).where(bomScope(ctx)).orderBy(asc(billOfMaterials.createdAt), asc(billOfMaterials.id));
    const data = []; for (const r of rows) data.push((await bomDetail(tx, ctx, r.id)).bom); return { data };
  });
}
export async function createBom(ctx: AuthContext, input: unknown, request?: Request) {
  requireRole(ctx, "manage:inventory"); const p = bomCreateSchema.parse(input), values = bomCosts(p);
  bomEstimate([], values.laborCostCents ?? 0, values.overheadCostCents ?? 0);
  return db.transaction(async tx => {
    await orgLock(tx, ctx); await ownedItem(tx, ctx, p.assemblyItemId, true);
    const [row] = await tx.insert(billOfMaterials).values({ ...values, assemblyItemId: p.assemblyItemId, name: p.name, organizationId: ctx.organizationId }).returning();
    const result = bomDto(row); stringifyWire(result); await audit(tx, ctx, "bill_of_materials", row.id, "create", result, request); return { bom: result };
  });
}
export async function updateBom(ctx: AuthContext, id: string, input: unknown, request?: Request) {
  requireRole(ctx, "manage:inventory"); catalogId.parse(id); const p = bomCosts(bomUpdateSchema.parse(input));
  return db.transaction(async tx => {
    await orgLock(tx, ctx); const before = await lockedBom(tx, ctx, id, true);
    await bomDetail(tx, ctx, id); bomDto({ ...before, ...p });
    const [row] = await tx.update(billOfMaterials).set({ ...p, updatedAt: new Date() }).where(bomScope(ctx, id)).returning();
    await bomDetail(tx, ctx, id);
    const result = bomDto(row); await audit(tx, ctx, "bill_of_materials", id, "update", result, request); return { bom: result };
  });
}
export async function deleteBom(ctx: AuthContext, id: string, request?: Request) {
  requireRole(ctx, "manage:inventory"); catalogId.parse(id);
  return db.transaction(async tx => {
    await orgLock(tx, ctx); const before = await lockedBom(tx, ctx, id, true);
    const active = await tx.query.assemblyOrder.findFirst({ where: and(orderScope(ctx), eq(assemblyOrder.bomId, id), inArray(assemblyOrder.status, ["draft", "in_progress"])) });
    if (active) throw new AuthError("Cancel or delete open assembly orders before deleting the BOM", 409);
    await tx.update(billOfMaterials).set({ deletedAt: new Date(), updatedAt: new Date() }).where(bomScope(ctx, id));
    await audit(tx, ctx, "bill_of_materials", id, "delete", bomDto(before), request); return { success: true };
  });
}
export async function listBomComponents(ctx: AuthContext, id: string) { return { components: (await getBom(ctx, id)).bom.components }; }
export async function addBomComponent(ctx: AuthContext, id: string, input: unknown, request?: Request) {
  requireRole(ctx, "manage:inventory"); catalogId.parse(id); const values = componentValues(componentCreateSchema.parse(input));
  return db.transaction(async tx => {
    await orgLock(tx, ctx); const bom = await lockedBom(tx, ctx, id, true); await ownedItem(tx, ctx, bom.assemblyItemId, true);
    await ownedItem(tx, ctx, values.componentItemId, true);
    if (values.componentItemId === bom.assemblyItemId) throw new AuthError("Finished item cannot consume itself", 422);
    const [row] = await tx.insert(bomComponent).values({ ...values, bomId: id }).returning();
    // Validate the whole recipe's output before commit, including aggregate estimates.
    await bomDetail(tx, ctx, id); const result = recipeComponentDto(row);
    await audit(tx, ctx, "bill_of_materials", id, "add_component", result, request); return { component: result };
  });
}
export async function removeBomComponent(ctx: AuthContext, id: string, componentId: string, request?: Request) {
  requireRole(ctx, "manage:inventory"); catalogId.parse(id); catalogId.parse(componentId);
  return db.transaction(async tx => {
    await orgLock(tx, ctx); await lockedBom(tx, ctx, id, true);
    const [row] = await tx.delete(bomComponent).where(and(eq(bomComponent.bomId, id), eq(bomComponent.id, componentId))).returning();
    if (!row) throw new AuthError("BOM component not found", 404);
    await audit(tx, ctx, "bill_of_materials", id, "remove_component", recipeComponentDto(row), request); return { success: true };
  });
}
export async function updateBomComponent(ctx: AuthContext, id: string, componentId: string, input: unknown, request?: Request) {
  requireRole(ctx, "manage:inventory"); catalogId.parse(id); catalogId.parse(componentId); const p = componentUpdateSchema.parse(input);
  return db.transaction(async tx => {
    await orgLock(tx, ctx); const bom = await lockedBom(tx, ctx, id, true);
    const before = await tx.query.bomComponent.findFirst({ where: and(eq(bomComponent.bomId, id), eq(bomComponent.id, componentId)) });
    if (!before) throw new AuthError("BOM component not found", 404);
    const values = componentValues({ ...p, componentItemId: p.componentItemId ?? before.componentItemId,
      quantity: p.quantity ?? (p.quantityExact === undefined ? before.quantity : undefined),
      wastagePercent: p.wastagePercent ?? (p.wastagePercentExact === undefined ? before.wastagePercent ?? "0" : undefined) });
    await ownedItem(tx, ctx, values.componentItemId, true);
    if (values.componentItemId === bom.assemblyItemId) throw new AuthError("Finished item cannot consume itself", 422);
    const [row] = await tx.update(bomComponent).set(values).where(and(eq(bomComponent.bomId, id), eq(bomComponent.id, componentId))).returning();
    await bomDetail(tx, ctx, id); const result = recipeComponentDto(row);
    await audit(tx, ctx, "bill_of_materials", id, "update_component", result, request); return { component: result };
  });
}
async function lockedOrder(tx: Tx, ctx: AuthContext, id: string, write = false) {
  catalogId.parse(id); const [row] = await tx.select().from(assemblyOrder).where(orderScope(ctx, id)).for(write ? "update" : "share");
  if (!row) throw new AuthError("Assembly order not found", 404);
  if (!assemblyQuantity.safeParse(row.quantity).success) throw new WireCompatibilityError("Unsupported saved assembly quantity");
  return row;
}
async function orderDetail(tx: Tx, ctx: AuthContext, id: string) {
  const order = await lockedOrder(tx, ctx, id);
  // Deleted owned recipes remain available for historical completed orders.
  const bom = await tx.query.billOfMaterials.findFirst({ where: and(eq(billOfMaterials.id, order.bomId), eq(billOfMaterials.organizationId, ctx.organizationId)) });
  if (!bom) throw new AuthError("Assembly recipe not found", 404);
  const assemblyItem = await ownedItem(tx, ctx, bom.assemblyItemId);
  const result = { ...order, bom: { ...bomDto(bom), assemblyItem: itemDto(assemblyItem) } }; stringifyWire(result); return result;
}
export async function getAssemblyOrder(ctx: AuthContext, id: string) { catalogId.parse(id); return db.transaction(async tx => ({ order: await orderDetail(tx, ctx, id) })); }
export async function listAssemblyOrders(ctx: AuthContext) {
  return db.transaction(async tx => {
    const rows = await tx.select({ id: assemblyOrder.id }).from(assemblyOrder).where(orderScope(ctx)).orderBy(asc(assemblyOrder.createdAt), asc(assemblyOrder.id));
    const data = []; for (const r of rows) data.push(await orderDetail(tx, ctx, r.id)); return { data };
  });
}
export async function createAssemblyOrder(ctx: AuthContext, input: unknown, request?: Request) {
  requireRole(ctx, "manage:inventory"); const p = assemblyCreateSchema.parse(input);
  return db.transaction(async tx => {
    await orgLock(tx, ctx); const bom = await lockedBom(tx, ctx, p.bomId); if (!bom.isActive) throw new AuthError("BOM is inactive", 422);
    await bomDetail(tx, ctx, bom.id); await ownedItem(tx, ctx, bom.assemblyItemId, true);
    const [row] = await tx.insert(assemblyOrder).values({ ...p, organizationId: ctx.organizationId }).returning();
    const result = await orderDetail(tx, ctx, row.id); await audit(tx, ctx, "assembly_order", row.id, "create", result, request); return { order: result };
  });
}
export async function updateAssemblyOrder(ctx: AuthContext, id: string, input: unknown, request?: Request) {
  requireRole(ctx, "manage:inventory"); catalogId.parse(id); const p = assemblyUpdateSchema.parse(input);
  return db.transaction(async tx => {
    await orgLock(tx, ctx); const before = await lockedOrder(tx, ctx, id, true);
    if (["completed", "cancelled"].includes(before.status)) throw new AuthError("Final assembly orders are immutable", 409);
    await orderDetail(tx, ctx, id);
    const [row] = await tx.update(assemblyOrder).set({ ...p, updatedAt: new Date() }).where(orderScope(ctx, id)).returning();
    stringifyWire(row); await audit(tx, ctx, "assembly_order", id, "update", row, request); return { order: row };
  });
}
export async function deleteAssemblyOrder(ctx: AuthContext, id: string, request?: Request) {
  requireRole(ctx, "manage:inventory"); catalogId.parse(id);
  return db.transaction(async tx => {
    await orgLock(tx, ctx); const row = await lockedOrder(tx, ctx, id, true);
    if (row.status === "completed") throw new AuthError("Completed assembly orders are immutable", 409);
    await tx.update(assemblyOrder).set({ deletedAt: new Date(), updatedAt: new Date() }).where(orderScope(ctx, id));
    await audit(tx, ctx, "assembly_order", id, "delete", row, request); return { success: true };
  });
}
export async function buildAssembly(ctx: AuthContext, id: string, input: unknown, request?: Request) {
  requireRole(ctx, "manage:inventory"); catalogId.parse(id); const p = assemblyBuildSchema.parse(input), date = p.date ?? new Date().toISOString().slice(0, 10);
  return db.transaction(async tx => {
    await orgLock(tx, ctx); const order = await lockedOrder(tx, ctx, id, true);
    if (["completed", "cancelled"].includes(order.status)) throw new AuthError("Order already completed or cancelled", 409);
    const bom = await lockedBom(tx, ctx, order.bomId, true);
    if (!bom.isActive) throw new AuthError("BOM is inactive", 422);
    const components = await tx.select().from(bomComponent).where(eq(bomComponent.bomId, bom.id)).orderBy(asc(bomComponent.id));
    if (!components.length) throw new AuthError("BOM has no components", 422);
    const needs = new Map<string, number>();
    for (const c of components) {
      recipeComponentDto(c);
      if (c.componentItemId === bom.assemblyItemId) throw new AuthError("Finished item cannot consume itself", 422);
      needs.set(c.componentItemId, catalogQuantity.parse((needs.get(c.componentItemId) ?? 0) + requiredComponentUnits(c.quantity, c.wastagePercent ?? "0", order.quantity)));
    }
    const items = new Map<string, typeof inventoryItem.$inferSelect>(), issueCosts = new Map<string, number>();
    for (const itemId of [...new Set([bom.assemblyItemId, ...needs.keys()])].sort()) {
      const [item] = await tx.select().from(inventoryItem).where(and(eq(inventoryItem.id, itemId), eq(inventoryItem.organizationId, ctx.organizationId), isNull(inventoryItem.deletedAt))).for("update");
      if (!item || !item.isActive) throw new AuthError("Live active owned inventory required", 404);
      itemDto(item);
      if (!["average", "fifo"].includes(item.costMethod) || item.quantityOnHand < 0 || item.totalValue < 0 || item.averageCost < 0)
        throw new WireCompatibilityError("Assembly requires nonnegative average/FIFO stock");
      let remaining = needs.get(itemId) ?? 0, cost = 0n;
      if (item.costMethod === "fifo") {
        const layers = await tx.select().from(inventoryCostLayer).where(and(eq(inventoryCostLayer.organizationId, ctx.organizationId), eq(inventoryCostLayer.inventoryItemId, item.id), sql`${inventoryCostLayer.remainingQuantity} > 0`)).orderBy(asc(inventoryCostLayer.receivedAt), asc(inventoryCostLayer.id)).for("update");
        for (const layer of layers) layerDto(layer);
        const qty = layers.reduce((s, l) => s + BigInt(catalogQuantity.parse(l.remainingQuantity)), 0n), value = layers.reduce((s, l) => s + BigInt(inventoryLayerValue(l)), 0n);
        if (qty !== BigInt(item.quantityOnHand) || value !== BigInt(item.totalValue)) throw new WireCompatibilityError("FIFO layers do not match saved assembly stock");
        for (const layer of layers) {
          const take = Math.min(remaining, layer.remainingQuantity), carrying = inventoryLayerValue(layer);
          if (take) cost += BigInt(take === layer.remainingQuantity ? carrying : Math.min(carrying, roundInventoryRatio(BigInt(carrying) * BigInt(take), BigInt(layer.remainingQuantity))));
          remaining -= take;
        }
      } else {
        const product = BigInt(item.averageCost) * BigInt(remaining);
        cost = remaining === item.quantityOnHand ? BigInt(item.totalValue) : product > BigInt(item.totalValue) ? BigInt(item.totalValue) : product;
      }
      if ((needs.get(itemId) ?? 0) > item.quantityOnHand) throw new AuthError(`Insufficient stock for ${item.name}`, 422);
      items.set(itemId, item); if (needs.has(itemId)) issueCosts.set(itemId, legacyMinor(cost));
    }
    await assertNotLocked(ctx.organizationId, date, ctx);
    const { base } = await resolveBaseRate(ctx.organizationId, undefined, date);
    for (const item of items.values()) if (item.inventoryAccountId) await postingAccount(tx, ctx, item.inventoryAccountId, "asset", base);
    const finished = items.get(bom.assemblyItemId)!;
    catalogQuantity.parse(finished.quantityOnHand + order.quantity);
    const conversionCost = legacyMinor((BigInt(bom.laborCostCents) + BigInt(bom.overheadCostCents)) * BigInt(order.quantity));
    const expectedCost = legacyMinor([...issueCosts.values()].reduce((s, c) => s + BigInt(c), BigInt(conversionCost)));
    legacyMinor(BigInt(finished.totalValue) + BigInt(expectedCost));
    const credits = new Map<string, number>(), movementIds: string[] = []; let componentCost = 0n;
    for (const [itemId, quantity] of needs) {
      const item = items.get(itemId)!;
      const account = item.inventoryAccountId ? { id: item.inventoryAccountId } : await ensureControlAccount(ctx.organizationId, "inventory", base, tx);
      if (!account) throw new AuthError("Inventory account unavailable", 422); await postingAccount(tx, ctx, account.id, "asset", base);
      const issue = await recordInventoryIssue(tx, { item, quantity, type: "adjustment", referenceType: "assembly_order", referenceId: id, createdBy: ctx.userId });
      if (issue.cost !== issueCosts.get(itemId)) throw new WireCompatibilityError("Assembly valuation changed after preflight");
      componentCost += BigInt(issue.cost); legacyMinor(componentCost);
      credits.set(account.id, legacyMinor(BigInt(credits.get(account.id) ?? 0) + BigInt(issue.cost))); movementIds.push(issue.movementId);
    }
    const totalCost = legacyMinor(componentCost + BigInt(conversionCost)), unitCost = roundInventoryRatio(BigInt(totalCost), BigInt(order.quantity));
    // Carry total cost separately: rounded unit cost must never create/destroy residual minor units.
    const receipt = await recordInventoryReceipt(tx, { item: finished, quantity: order.quantity, unitCost, totalCost, type: "adjustment", referenceType: "assembly_order", referenceId: id, createdBy: ctx.userId, receivedAt: new Date(date + "T00:00:00Z") });
    movementIds.push(receipt.movementId);
    const finishedAccount = finished.inventoryAccountId ? { id: finished.inventoryAccountId } : await ensureAccountByCode(ctx.organizationId, { code: "1320", name: "Finished Goods", type: "asset", subType: "current" }, base, tx);
    if (!finishedAccount) throw new AuthError("Finished goods account unavailable", 422); await postingAccount(tx, ctx, finishedAccount.id, "asset", base);
    const lines = [{ accountId: finishedAccount.id, description: `Assembly build: ${bom.name}`, debitAmount: totalCost, creditAmount: 0, currencyCode: base }];
    for (const [accountId, amount] of credits) if (amount) lines.push({ accountId, description: `Components consumed: ${bom.name}`, debitAmount: 0, creditAmount: amount, currencyCode: base });
    if (conversionCost) {
      const clearing = await ensureAccountByCode(ctx.organizationId, { code: "2305", name: "Manufacturing/WIP Clearing", type: "liability", subType: "current" }, base, tx);
      if (!clearing) throw new AuthError("WIP clearing unavailable", 422);
      const [account] = await tx.select().from(chartAccount).where(and(eq(chartAccount.id, clearing.id), eq(chartAccount.organizationId, ctx.organizationId), isNull(chartAccount.deletedAt), eq(chartAccount.isActive, true))).for("share");
      if (!account || account.type !== "liability" || account.currencyCode !== base) throw new AuthError("WIP clearing must be a live base-currency liability", 422);
      lines.push({ accountId: clearing.id, description: `Labor & overhead applied: ${bom.name}`, debitAmount: 0, creditAmount: conversionCost, currencyCode: base });
    }
    if (lines.reduce((s, l) => s + BigInt(l.debitAmount) - BigInt(l.creditAmount), 0n) !== 0n) throw new WireCompatibilityError("Assembly journal does not balance");
    const [entry] = await tx.insert(journalEntry).values({ organizationId: ctx.organizationId, entryNumber: await getNextEntryNumber(ctx.organizationId, tx), date,
      description: `Assembly build: ${bom.name} x${order.quantity}`, reference: "ASSEMBLY", sourceType: "assembly_build", sourceId: id, status: "posted", postedAt: new Date(), createdBy: ctx.userId }).returning();
    await tx.insert(journalLine).values(lines.map(l => ({ ...l, journalEntryId: entry.id })));
    await tx.update(inventoryMovement).set({ journalEntryId: entry.id }).where(inArray(inventoryMovement.id, movementIds));
    const [updated] = await tx.update(assemblyOrder).set({ status: "completed", completedAt: new Date(), updatedAt: new Date() }).where(orderScope(ctx, id)).returning();
    const result = { order: updated, journalEntryId: entry.id, ...publicMoneyDto({ totalCost, unitCost, componentCost: legacyMinor(componentCost), conversionCost }, ["totalCost", "unitCost", "componentCost", "conversionCost"]) };
    stringifyWire(result); await audit(tx, ctx, "assembly_order", id, "build_assembly", result, request); return result;
  });
}
