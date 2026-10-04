import { and, asc, desc, eq, inArray, isNull, or, ilike, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { inventoryItem, inventoryCategory, inventoryMovement, inventoryCostLayer, chartAccount, journalEntry, journalLine, auditLog, organization } from "@/lib/db/schema";
import { AuthError, type AuthContext } from "./auth-context";
import { requireRole } from "./require-role";
import { assertNotLocked } from "./period-lock";
import { catalogDto, catalogPrices, catalogId, catalogQuantity } from "./inventory-catalog-wire";
import { itemCreateSchema, itemUpdateSchema, itemListSchema, itemDto, openingValue, bulkItemSchema, categoryCreateSchema, categoryUpdateSchema, parseInventoryCsv } from "./inventory-master-wire";
import { legacyMinor, stringifyWire, WireCompatibilityError } from "@/lib/money/wire";
import { recordInventoryReceipt } from "./inventory-valuation";
import { getNextEntryNumber, ensureControlAccount, ensureAccountByCode, resolveBaseRate, createInventoryAdjustmentJournalEntry } from "./journal-automation";
import { listInventorySuppliers } from "./inventory-catalog";
import { z } from "zod";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
const itemScope = (ctx: AuthContext, id?: string) => and(eq(inventoryItem.organizationId, ctx.organizationId), isNull(inventoryItem.deletedAt), id ? eq(inventoryItem.id, id) : undefined);
const catScope = (ctx: AuthContext, id?: string) => and(eq(inventoryCategory.organizationId, ctx.organizationId), isNull(inventoryCategory.deletedAt), id ? eq(inventoryCategory.id, id) : undefined);
async function audit(tx: Tx, ctx: AuthContext, type: string, id: string, action: string, changes: unknown, request?: Request) {
  await tx.insert(auditLog).values({ organizationId: ctx.organizationId, userId: ctx.userId, entityType: type, entityId: id, action,
    changes: JSON.parse(stringifyWire(changes)), ipAddress: request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null, userAgent: request?.headers.get("user-agent") || null });
}
// Serializes code uniqueness, category graph edits and journal numbering for this slice.
export async function orgLock(tx: Tx, ctx: AuthContext) {
  // Compatible with FK key-share locks held by adjacent catalog/stock writers.
  const [row] = await tx.select({ id: organization.id }).from(organization).where(eq(organization.id, ctx.organizationId)).for("no key update");
  if (!row) throw new AuthError("Organization not found", 404);
}
async function ownedCategory(tx: Tx, ctx: AuthContext, id: string) {
  const [row] = await tx.select().from(inventoryCategory).where(catScope(ctx, id)).for("share");
  if (!row) throw new AuthError("Category not found", 404); return row;
}
async function references(tx: Tx, ctx: AuthContext, values: z.infer<typeof itemUpdateSchema>) {
  if (values.categoryId) await ownedCategory(tx, ctx, values.categoryId);
  for (const [key, type] of [["costAccountId", "expense"], ["revenueAccountId", "revenue"], ["inventoryAccountId", "asset"]] as const) {
    const id = values[key]; if (!id) continue;
    const [row] = await tx.select().from(chartAccount).where(and(eq(chartAccount.id, id), eq(chartAccount.organizationId, ctx.organizationId), isNull(chartAccount.deletedAt), eq(chartAccount.isActive, true))).for("share");
    if (!row || row.type !== type) throw new AuthError(`Account must be a live owned ${type} account`, 404);
  }
}
export async function postingAccount(tx: Tx, ctx: AuthContext, id: string, type: "asset" | "equity" | "expense", currency: string) {
  const [row] = await tx.select().from(chartAccount).where(and(eq(chartAccount.id, id), eq(chartAccount.organizationId, ctx.organizationId), isNull(chartAccount.deletedAt), eq(chartAccount.isActive, true))).for("share");
  if (!row || row.type !== type || row.currencyCode !== currency) throw new AuthError(`Inventory posting requires a live owned ${type} account in base currency ${currency}`, 422);
}
async function codeAvailable(tx: Tx, ctx: AuthContext, code: string, except?: string) {
  const found = await tx.query.inventoryItem.findFirst({ where: and(eq(inventoryItem.organizationId, ctx.organizationId), eq(inventoryItem.code, code)) });
  if (found && found.id !== except) throw new AuthError("Item code already exists (including deleted history)", 409);
}
export async function lockedItem(tx: Tx, ctx: AuthContext, id: string) {
  catalogId.parse(id);
  const [row] = await tx.select().from(inventoryItem).where(itemScope(ctx, id)).for("update");
  if (!row) throw new AuthError("Inventory item not found", 404); itemDto(row); return row;
}

async function createItem(tx: Tx, ctx: AuthContext, input: z.infer<typeof itemCreateSchema>, request?: Request) {
  const values = catalogPrices(input), value = openingValue(input), today = new Date().toISOString().slice(0, 10);
  await references(tx, ctx, values); await codeAvailable(tx, ctx, values.code);
  if (value > 0) await assertNotLocked(ctx.organizationId, today, ctx);
  const [item] = await tx.insert(inventoryItem).values({ ...values, organizationId: ctx.organizationId,
    purchasePrice: values.purchasePrice ?? 0, salePrice: values.salePrice ?? 0, reorderPoint: values.reorderPoint ?? 0,
    quantityOnHand: 0, averageCost: 0, totalValue: 0 }).returning();
  if (value > 0) {
    const receipt = await recordInventoryReceipt(tx, { item, quantity: values.quantityOnHand!, unitCost: values.purchasePrice!, type: "initial",
      referenceType: "opening_balance", referenceId: item.id, createdBy: ctx.userId });
    const { base } = await resolveBaseRate(ctx.organizationId, undefined, today);
    const invAcct = item.inventoryAccountId ? { id: item.inventoryAccountId } : await ensureControlAccount(ctx.organizationId, "inventory", base, tx);
    const equity = await ensureAccountByCode(ctx.organizationId, { code: "3000", name: "Opening Balance Equity", type: "equity", subType: "other_equity" }, base, tx);
    if (!invAcct || !equity) throw new AuthError("Opening stock accounts unavailable", 422);
    await postingAccount(tx, ctx, invAcct.id, "asset", base);
    await postingAccount(tx, ctx, equity.id, "equity", base);
    const [entry] = await tx.insert(journalEntry).values({ organizationId: ctx.organizationId, entryNumber: await getNextEntryNumber(ctx.organizationId, tx), date: today,
      description: `Opening stock: ${item.name}`, reference: item.sku, status: "posted", sourceType: "inventory_opening", sourceId: item.id, postedAt: new Date(), createdBy: ctx.userId }).returning();
    await tx.insert(journalLine).values([
      { journalEntryId: entry.id, accountId: invAcct.id, description: `Opening stock: ${item.name}`, debitAmount: value, creditAmount: 0, currencyCode: base },
      { journalEntryId: entry.id, accountId: equity.id, description: `Opening stock: ${item.name}`, debitAmount: 0, creditAmount: value, currencyCode: base },
    ]);
    await tx.update(inventoryMovement).set({ journalEntryId: entry.id }).where(eq(inventoryMovement.id, receipt.movementId));
  }
  const result = itemDto((await tx.query.inventoryItem.findFirst({ where: itemScope(ctx, item.id) }))!);
  await audit(tx, ctx, "inventory_item", item.id, "create", result, request); return result;
}
export async function createInventoryItem(ctx: AuthContext, input: unknown, request?: Request) {
  requireRole(ctx, "manage:inventory"); const parsed = itemCreateSchema.parse(input); catalogPrices(parsed); openingValue(parsed);
  return db.transaction(async tx => { await orgLock(tx, ctx); return createItem(tx, ctx, parsed, request); });
}
export async function getInventoryItem(ctx: AuthContext, id: string) {
  catalogId.parse(id); const row = await db.query.inventoryItem.findFirst({ where: itemScope(ctx, id) });
  if (!row) throw new AuthError("Inventory item not found", 404); return itemDto(row);
}
export async function updateInventoryItem(ctx: AuthContext, id: string, input: unknown, request?: Request) {
  requireRole(ctx, "manage:inventory"); catalogId.parse(id); const values = catalogPrices(itemUpdateSchema.parse(input));
  return db.transaction(async tx => {
    await orgLock(tx, ctx); const before = await lockedItem(tx, ctx, id);
    itemDto({ ...before, ...values });
    await references(tx, ctx, { ...before, ...values });
    if (values.code !== undefined) await codeAvailable(tx, ctx, values.code, id);
    const [row] = await tx.update(inventoryItem).set({ ...values, updatedAt: new Date() }).where(itemScope(ctx, id)).returning();
    const result = itemDto(row); await audit(tx, ctx, "inventory_item", id, "update", { before: itemDto(before), after: result }, request); return result;
  });
}
export async function deleteInventoryItem(ctx: AuthContext, id: string, request?: Request) {
  requireRole(ctx, "manage:inventory"); catalogId.parse(id);
  return db.transaction(async tx => {
    const before = await lockedItem(tx, ctx, id);
    await tx.update(inventoryItem).set({ deletedAt: new Date(), updatedAt: new Date() }).where(itemScope(ctx, id));
    await audit(tx, ctx, "inventory_item", id, "delete", itemDto(before), request); return { success: true };
  });
}
export async function listInventoryItems(ctx: AuthContext, input: unknown) {
  const p = itemListSchema.parse(input);
  return db.transaction(async tx => {
    const conditions = [itemScope(ctx)];
    if (p.search) conditions.push(or(ilike(inventoryItem.code, `%${p.search}%`), ilike(inventoryItem.name, `%${p.search}%`), ilike(inventoryItem.sku, `%${p.search}%`)));
    if (p.categoryId) conditions.push(eq(inventoryItem.categoryId, p.categoryId)); else if (p.category) conditions.push(eq(inventoryItem.category, p.category));
    if (p.status === "active" || p.status === "inactive") conditions.push(eq(inventoryItem.isActive, p.status === "active"));
    if (p.status === "low_stock") conditions.push(eq(inventoryItem.isActive, true), sql`${inventoryItem.quantityOnHand} <= ${inventoryItem.reorderPoint}`);
    const sort = { name: inventoryItem.name, code: inventoryItem.code, quantity: inventoryItem.quantityOnHand, purchasePrice: inventoryItem.purchasePrice,
      salePrice: inventoryItem.salePrice, createdAt: inventoryItem.createdAt, category: inventoryItem.category }[p.sortBy];
    const items = (await tx.select().from(inventoryItem).where(and(...conditions)).orderBy((p.sortOrder === "asc" ? asc : desc)(sort), inventoryItem.id).limit(p.limit).offset((p.page - 1) * p.limit)).map(itemDto);
    const [count] = await tx.select({ count: sql<number>`count(*)::int` }).from(inventoryItem).where(and(...conditions));
    const categories = await tx.selectDistinct({ category: inventoryItem.category }).from(inventoryItem).where(itemScope(ctx));
    const [s] = await tx.select({ totalItems: sql<number>`count(*)::int`,
      totalValue: sql<string>`coalesce(sum(${inventoryItem.quantityOnHand}::numeric * ${inventoryItem.purchasePrice}::numeric), 0)::text`,
      lowStockCount: sql<number>`count(*) filter (where ${inventoryItem.quantityOnHand} <= ${inventoryItem.reorderPoint} and ${inventoryItem.isActive})::int`,
      avgMargin: sql<string>`coalesce(avg(case when ${inventoryItem.purchasePrice} > 0 then (${inventoryItem.salePrice}::numeric - ${inventoryItem.purchasePrice}::numeric) / ${inventoryItem.purchasePrice}::numeric * 100 end), 0)::text`,
    }).from(inventoryItem).where(itemScope(ctx));
    const totalValue = legacyMinor(BigInt(s.totalValue));
    const result = { data: items, pagination: { page: p.page, limit: p.limit, total: count.count, totalPages: Math.ceil(count.count / p.limit) },
      categories: categories.map(c => c.category).filter(Boolean), summary: { totalItems: s.totalItems, totalValue, totalValueMinor: String(totalValue), lowStockCount: s.lowStockCount, avgMargin: Number(s.avgMargin) } };
    stringifyWire(result); return result;
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}

export async function listInventoryCategories(ctx: AuthContext) {
  const flat = await db.select().from(inventoryCategory).where(catScope(ctx)).orderBy(asc(inventoryCategory.name), inventoryCategory.id);
  return { flat, data: flat.filter(c => !c.parentId).map(c => ({ ...c, children: flat.filter(child => child.parentId === c.id) })) };
}
export async function writeInventoryCategory(ctx: AuthContext, input: unknown, id?: string, request?: Request) {
  requireRole(ctx, "manage:inventory"); if (id) catalogId.parse(id);
  const values = id ? categoryUpdateSchema.parse(input) : categoryCreateSchema.parse(input);
  return db.transaction(async tx => {
    await orgLock(tx, ctx); if (id) await ownedCategory(tx, ctx, id);
    if (values.name !== undefined) {
      const found = await tx.query.inventoryCategory.findFirst({ where: and(eq(inventoryCategory.organizationId, ctx.organizationId), eq(inventoryCategory.name, values.name)) });
      if (found && found.id !== id) throw new AuthError("Category name already exists (including deleted history)", 409);
    }
    if (values.parentId) {
      let parentId: string | null = values.parentId; const seen = new Set<string>();
      while (parentId) {
        if (parentId === id || seen.has(parentId)) throw new AuthError("Category cycle prohibited", 400);
        seen.add(parentId); parentId = (await ownedCategory(tx, ctx, parentId)).parentId;
      }
    }
    const [row] = id ? await tx.update(inventoryCategory).set({ ...values, updatedAt: new Date() }).where(catScope(ctx, id)).returning()
      : await tx.insert(inventoryCategory).values({ ...values, name: values.name!, organizationId: ctx.organizationId }).returning();
    stringifyWire(row); await audit(tx, ctx, "inventory_category", row.id, id ? "update" : "create", row, request); return row;
  });
}
export async function deleteInventoryCategory(ctx: AuthContext, id: string, request?: Request) {
  requireRole(ctx, "manage:inventory"); catalogId.parse(id);
  return db.transaction(async tx => {
    await orgLock(tx, ctx); const row = await ownedCategory(tx, ctx, id);
    // Detach live children/items rather than leave invisible roots and dangling selectors.
    const detachedCategories = await tx.update(inventoryCategory).set({ parentId: null, updatedAt: new Date() }).where(and(catScope(ctx), eq(inventoryCategory.parentId, id))).returning({ id: inventoryCategory.id });
    const detachedItems = await tx.update(inventoryItem).set({ categoryId: null, updatedAt: new Date() }).where(and(itemScope(ctx), eq(inventoryItem.categoryId, id))).returning({ id: inventoryItem.id });
    await tx.update(inventoryCategory).set({ deletedAt: new Date(), updatedAt: new Date() }).where(catScope(ctx, id));
    await audit(tx, ctx, "inventory_category", id, "delete", { category: row, detachedCategories, detachedItems }, request); return { success: true };
  });
}
export async function reorderInventorySuggestions(ctx: AuthContext) {
  const items = await db.select().from(inventoryItem).where(and(itemScope(ctx), eq(inventoryItem.isActive, true), sql`${inventoryItem.quantityOnHand} <= ${inventoryItem.reorderPoint}`)).orderBy(desc(inventoryItem.name), inventoryItem.id);
  return Promise.all(items.map(async item => ({ ...itemDto(item), suggestedReorderQuantity: item.reorderPoint * 2 - item.quantityOnHand,
    suppliers: (await listInventorySuppliers(ctx, item.id)).map(catalogDto).sort((a, b) => Number(b.isPreferred) - Number(a.isPreferred)) })));
}

export async function preflightAdjustment(tx: Tx, ctx: AuthContext, item: typeof inventoryItem.$inferSelect, delta: number) {
  itemDto(item); await references(tx, ctx, item);
  if (item.costMethod === "standard") throw new AuthError("Standard costing stock adjustments are unsupported", 422);
  if (item.quantityOnHand < 0) throw new AuthError("Negative saved on-hand stock requires inventory remediation", 422);
  const newQty = item.quantityOnHand + delta;
  if (newQty < 0) throw new AuthError(`Adjustment would make "${item.name}" quantity negative`, 400);
  catalogQuantity.parse(newQty);
  itemDto({ ...item, quantityOnHand: newQty });
  let cost = BigInt(item.averageCost) * BigInt(Math.abs(delta));
  if (delta < 0 && item.costMethod === "fifo") {
    const layers = await tx.select().from(inventoryCostLayer).where(and(eq(inventoryCostLayer.organizationId, ctx.organizationId), eq(inventoryCostLayer.inventoryItemId, item.id), sql`${inventoryCostLayer.remainingQuantity} > 0`)).orderBy(asc(inventoryCostLayer.receivedAt), inventoryCostLayer.id).for("update");
    let remaining = -delta; cost = 0n;
    for (const layer of layers) {
      if (remaining <= 0) break;
      if (!Number.isSafeInteger(layer.unitCost) || layer.unitCost < 0) throw new WireCompatibilityError();
      const take = Math.min(remaining, layer.remainingQuantity); cost += BigInt(take) * BigInt(layer.unitCost); legacyMinor(cost); remaining -= take;
    }
    cost += BigInt(remaining) * BigInt(item.averageCost);
  }
  if (delta < 0 && item.costMethod === "average") cost = -delta === item.quantityOnHand ? BigInt(item.totalValue) : cost > BigInt(item.totalValue) ? BigInt(item.totalValue) : cost;
  if (delta < 0 && cost > BigInt(item.totalValue)) throw new AuthError("Cost of issue exceeds inventory carrying value", 422);
  if (delta < 0 && newQty === 0 && cost !== BigInt(item.totalValue)) throw new AuthError("Issue would strand carrying value without stock", 422);
  legacyMinor(cost); legacyMinor(delta > 0 ? BigInt(item.totalValue) + cost : BigInt(item.totalValue) - cost);
}
export async function bulkInventoryItems(ctx: AuthContext, input: unknown, request?: Request) {
  requireRole(ctx, "manage:inventory"); const p = bulkItemSchema.parse(input);
  return db.transaction(async tx => {
    await orgLock(tx, ctx);
    const items = await tx.select().from(inventoryItem).where(and(itemScope(ctx), inArray(inventoryItem.id, p.ids))).orderBy(inventoryItem.id).for("update");
    if (items.length !== p.ids.length) throw new AuthError("Some items not found", 404);
    items.forEach(itemDto);
    const today = new Date().toISOString().slice(0, 10);
    if (p.action === "adjust_stock") {
      await assertNotLocked(ctx.organizationId, today, ctx);
      for (const item of items) await preflightAdjustment(tx, ctx, item, p.adjustment!);
      const { base } = await resolveBaseRate(ctx.organizationId, undefined, today);
      const shrink = await ensureControlAccount(ctx.organizationId, "inventoryShrinkage", base, tx);
      if (!shrink) throw new AuthError("Stock adjustment accounts unavailable", 422);
      await postingAccount(tx, ctx, shrink.id, "expense", base);
      for (const item of items) {
        const inv = item.inventoryAccountId ? { id: item.inventoryAccountId } : await ensureControlAccount(ctx.organizationId, "inventory", base, tx);
        if (!inv) throw new AuthError("Stock adjustment accounts unavailable", 422);
        await postingAccount(tx, ctx, inv.id, "asset", base);
      }
    }
    for (const item of items) {
      if (p.action === "adjust_stock") {
        const result = await createInventoryAdjustmentJournalEntry(ctx, { item, qtyDelta: p.adjustment!, reason: p.reason || "Bulk stock adjustment", date: today }, tx);
        if (!result) throw new AuthError("Stock adjustment accounts unavailable", 422);
        itemDto((await tx.query.inventoryItem.findFirst({ where: itemScope(ctx, item.id) }))!);
      } else {
        const values = p.action === "delete" ? { deletedAt: new Date() } : p.action === "set_category" ? { category: p.category || null } : { isActive: p.action === "set_active" };
        await tx.update(inventoryItem).set({ ...values, updatedAt: new Date() }).where(itemScope(ctx, item.id));
      }
      await audit(tx, ctx, "inventory_item", item.id, p.action, p, request);
    }
    return { success: true, affected: items.length };
  });
}
export async function importInventoryCsv(ctx: AuthContext, csv: string, request?: Request) {
  requireRole(ctx, "manage:inventory"); const rows = parseInventoryCsv(csv);
  let created = 0, updated = 0; const errors: { row: number; message: string }[] = [];
  // Deliberate per-row success semantics. Each row's inventory, ledger and audit are atomic.
  for (const row of rows) {
    if (!row.input) { errors.push({ row: row.row, message: row.error! }); continue; }
    try {
      const kind = await db.transaction(async tx => {
        await orgLock(tx, ctx); const input = row.input!, values = catalogPrices(input);
        const existing = await tx.query.inventoryItem.findFirst({ where: and(itemScope(ctx), eq(inventoryItem.code, input.code)) });
        if (!existing) { await createItem(tx, ctx, input, request); return "created"; }
        const before = await lockedItem(tx, ctx, existing.id);
        const { quantityOnHand: _quantity, ...patch } = values; void _quantity;
        itemDto({ ...before, ...patch, purchasePrice: patch.purchasePrice ?? 0, salePrice: patch.salePrice ?? 0, reorderPoint: patch.reorderPoint ?? 0 });
        await references(tx, ctx, { ...before, ...patch });
        const [result] = await tx.update(inventoryItem).set({ ...patch, purchasePrice: patch.purchasePrice ?? 0, salePrice: patch.salePrice ?? 0,
          reorderPoint: patch.reorderPoint ?? 0, updatedAt: new Date() }).where(itemScope(ctx, existing.id)).returning();
        await audit(tx, ctx, "inventory_item", result.id, "import_update", { before: itemDto(before), after: itemDto(result) }, request); return "updated";
      });
      if (kind === "created") created++; else updated++;
    } catch (error) {
      // Never expose SQL details or pretend infrastructure failures are invalid CSV rows.
      if (!(error instanceof AuthError || error instanceof z.ZodError || error instanceof WireCompatibilityError || (error instanceof Error && error.name === "PeriodLockedError"))) throw error;
      errors.push({ row: row.row, message: error.message });
    }
  }
  return { created, updated, errors, total: rows.length };
}
