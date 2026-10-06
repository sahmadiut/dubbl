import { and, asc, eq, isNull, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { priceList, priceListItem, inventoryItem } from "@/lib/db/schema";
import { AuthError, type AuthContext } from "./auth-context";
import { requireRole } from "./require-role";
import { lockTaxOrganization, auditTax, type TaxTx } from "./tax-config-transaction";
import { pricingId, priceListCreateSchema, priceListUpdateSchema, priceItemCreateSchema, priceItemUpdateSchema,
  priceResolveSchema, pricingAmounts, priceListDto, priceItemDto, validatePriceWindow } from "./pricing-wire";
import { stringifyWire, WireCompatibilityError } from "@/lib/money/wire";

const scope = (orgId: string, id?: string) => and(eq(priceList.organizationId, orgId), isNull(priceList.deletedAt), id ? eq(priceList.id, id) : undefined);
const readOptions = { isolationLevel: "repeatable read", accessMode: "read only" } as const;
async function ownedList(tx: TaxTx, orgId: string, id: string) {
  const [row] = await tx.select().from(priceList).where(scope(orgId, id));
  if (!row) throw new AuthError("Price list not found", 404);
  return priceListDto(row);
}
async function ownedItem(tx: TaxTx, orgId: string, id: string, live: boolean) {
  const [row] = await tx.select().from(inventoryItem).where(and(eq(inventoryItem.id, id), eq(inventoryItem.organizationId, orgId),
    live ? isNull(inventoryItem.deletedAt) : undefined, live ? eq(inventoryItem.isActive, true) : undefined));
  if (!row) throw new AuthError("Inventory item not found in this organization", 404);
  stringifyWire(row); return row;
}
async function rows(tx: TaxTx, orgId: string, id: string) {
  const result = await tx.select().from(priceListItem).where(eq(priceListItem.priceListId, id)).orderBy(asc(priceListItem.minQuantity), asc(priceListItem.id));
  return Promise.all(result.map(async row => ({ ...priceItemDto(row), inventoryItem: await ownedItem(tx, orgId, row.inventoryItemId, false) })));
}
async function uniqueName(tx: TaxTx, orgId: string, name: string, id?: string) {
  const [clash] = await tx.select({ id: priceList.id }).from(priceList).where(and(eq(priceList.organizationId, orgId), eq(priceList.name, name), id ? ne(priceList.id, id) : undefined));
  if (clash) throw new AuthError("Price list name already exists (including deleted lists)", 409);
}
async function uniqueTier(tx: TaxTx, listId: string, inventoryId: string, qty: number, id?: string) {
  const [clash] = await tx.select({ id: priceListItem.id }).from(priceListItem).where(and(eq(priceListItem.priceListId, listId),
    eq(priceListItem.inventoryItemId, inventoryId), eq(priceListItem.minQuantity, qty), id ? ne(priceListItem.id, id) : undefined));
  if (clash) throw new AuthError("A price already exists for this item at this minimum quantity", 409);
}
export async function listPriceLists(ctx: AuthContext) {
  return db.transaction(async tx => (await tx.select().from(priceList).where(scope(ctx.organizationId)).orderBy(asc(priceList.name), asc(priceList.id))).map(priceListDto), readOptions);
}
export async function getPriceList(ctx: AuthContext, id: string) {
  pricingId.parse(id);
  return db.transaction(async tx => ({ ...await ownedList(tx, ctx.organizationId, id), items: await rows(tx, ctx.organizationId, id) }), readOptions);
}
export async function listPriceItems(ctx: AuthContext, id: string) {
  pricingId.parse(id);
  return db.transaction(async tx => { await ownedList(tx, ctx.organizationId, id); return rows(tx, ctx.organizationId, id); }, readOptions);
}
export async function createPriceList(ctx: AuthContext, input: unknown, request?: Request) {
  requireRole(ctx, "manage:inventory"); const p = priceListCreateSchema.parse(input);
  const values = { ...p, currencyCode: p.currencyCode ?? "USD", isActive: p.isActive ?? true, effectiveFrom: p.effectiveFrom ?? null, effectiveTo: p.effectiveTo ?? null };
  validatePriceWindow(values);
  return db.transaction(async tx => {
    await lockTaxOrganization(tx, ctx.organizationId); await uniqueName(tx, ctx.organizationId, values.name);
    const [row] = await tx.insert(priceList).values({ ...values, organizationId: ctx.organizationId }).returning();
    const result = priceListDto(row); await auditTax(tx, ctx.organizationId, "price_list", row.id, "create", result, ctx, request); return result;
  });
}
export async function updatePriceList(ctx: AuthContext, id: string, input: unknown, request?: Request) {
  requireRole(ctx, "manage:inventory"); pricingId.parse(id); const p = priceListUpdateSchema.parse(input);
  return db.transaction(async tx => {
    await lockTaxOrganization(tx, ctx.organizationId);
    const before = await ownedList(tx, ctx.organizationId, id); validatePriceWindow({ ...before, ...p });
    if (p.name !== undefined) await uniqueName(tx, ctx.organizationId, p.name, id);
    // Currency changes keep existing cents, as in v1; preflight every saved row.
    await rows(tx, ctx.organizationId, id);
    const [row] = await tx.update(priceList).set({ ...p, updatedAt: new Date() }).where(scope(ctx.organizationId, id)).returning();
    const result = priceListDto(row); await auditTax(tx, ctx.organizationId, "price_list", id, "update", { before, after: result }, ctx, request); return result;
  });
}
export async function deletePriceList(ctx: AuthContext, id: string, request?: Request) {
  requireRole(ctx, "manage:inventory"); pricingId.parse(id);
  return db.transaction(async tx => {
    await lockTaxOrganization(tx, ctx.organizationId); const before = await ownedList(tx, ctx.organizationId, id);
    await tx.update(priceList).set({ deletedAt: new Date(), updatedAt: new Date() }).where(scope(ctx.organizationId, id));
    await auditTax(tx, ctx.organizationId, "price_list", id, "delete", before, ctx, request); return { success: true };
  });
}
export async function addPriceItem(ctx: AuthContext, id: string, input: unknown, request?: Request) {
  requireRole(ctx, "manage:inventory"); pricingId.parse(id); const p = pricingAmounts(priceItemCreateSchema.parse(input), true);
  return db.transaction(async tx => {
    await lockTaxOrganization(tx, ctx.organizationId); await ownedList(tx, ctx.organizationId, id);
    await ownedItem(tx, ctx.organizationId, p.inventoryItemId, true); const minQuantity = p.minQuantity ?? 1;
    await uniqueTier(tx, id, p.inventoryItemId, minQuantity);
    const [row] = await tx.insert(priceListItem).values({ priceListId: id, inventoryItemId: p.inventoryItemId, unitPrice: p.unitPrice!, minQuantity }).returning();
    const result = priceItemDto(row); await auditTax(tx, ctx.organizationId, "price_list_item", row.id, "create", result, ctx, request); return result;
  });
}
export async function updatePriceItem(ctx: AuthContext, id: string, itemId: string, input: unknown, request?: Request) {
  requireRole(ctx, "manage:inventory"); pricingId.parse(id); pricingId.parse(itemId); const p = pricingAmounts(priceItemUpdateSchema.parse(input));
  return db.transaction(async tx => {
    await lockTaxOrganization(tx, ctx.organizationId); await ownedList(tx, ctx.organizationId, id);
    const [before] = await tx.select().from(priceListItem).where(and(eq(priceListItem.id, itemId), eq(priceListItem.priceListId, id)));
    if (!before) throw new AuthError("Price list item not found", 404);
    const old = priceItemDto(before); await ownedItem(tx, ctx.organizationId, before.inventoryItemId, true);
    await uniqueTier(tx, id, before.inventoryItemId, p.minQuantity ?? before.minQuantity, itemId);
    const [row] = await tx.update(priceListItem).set({ ...p, updatedAt: new Date() }).where(and(eq(priceListItem.id, itemId), eq(priceListItem.priceListId, id))).returning();
    const result = priceItemDto(row); await auditTax(tx, ctx.organizationId, "price_list_item", itemId, "update", { before: old, after: result }, ctx, request); return result;
  });
}
export async function deletePriceItem(ctx: AuthContext, id: string, itemId: string, request?: Request) {
  requireRole(ctx, "manage:inventory"); pricingId.parse(id); pricingId.parse(itemId);
  return db.transaction(async tx => {
    await lockTaxOrganization(tx, ctx.organizationId); await ownedList(tx, ctx.organizationId, id);
    const [before] = await tx.select().from(priceListItem).where(and(eq(priceListItem.id, itemId), eq(priceListItem.priceListId, id)));
    if (!before) throw new AuthError("Price list item not found", 404);
    const old = priceItemDto(before); await ownedItem(tx, ctx.organizationId, before.inventoryItemId, false);
    await tx.delete(priceListItem).where(and(eq(priceListItem.id, itemId), eq(priceListItem.priceListId, id)));
    await auditTax(tx, ctx.organizationId, "price_list_item", itemId, "delete", old, ctx, request); return { success: true };
  });
}
export interface ResolvedPrice { unitPrice: number; unitPriceMinor: string; currencyCode: string; priceListId: string; minQuantity: number }
/** Whole quantity resolver. No FX, scaling or product calculation is performed. */
export async function resolvePrice(orgId: string, itemId: string, priceListId: string, qty = 1, asOf?: string): Promise<ResolvedPrice | null> {
  pricingId.parse(priceListId); const p = priceResolveSchema.parse({ inventoryItemId: itemId, quantity: qty, asOf });
  return db.transaction(async tx => {
    const [list] = await tx.select().from(priceList).where(scope(orgId, priceListId));
    if (!list) return null;
    priceListDto(list); const today = p.asOf ?? new Date().toISOString().slice(0, 10);
    if (!list.isActive || (list.effectiveFrom && today < list.effectiveFrom) || (list.effectiveTo && today > list.effectiveTo)) return null;
    const [item] = await tx.select({ id: inventoryItem.id }).from(inventoryItem).where(and(eq(inventoryItem.id, itemId), eq(inventoryItem.organizationId, orgId), isNull(inventoryItem.deletedAt), eq(inventoryItem.isActive, true)));
    if (!item) return null;
    const tiers = await tx.select().from(priceListItem).where(and(eq(priceListItem.priceListId, priceListId), eq(priceListItem.inventoryItemId, itemId)));
    tiers.forEach(priceItemDto);
    const eligible = tiers.filter(t => t.minQuantity <= qty).sort((a, b) => b.minQuantity - a.minQuantity);
    if (eligible.length > 1 && eligible[0].minQuantity === eligible[1].minQuantity) throw new WireCompatibilityError("Ambiguous saved price tiers");
    if (!eligible.length) return null;
    const tier = priceItemDto(eligible[0]);
    return { unitPrice: tier.unitPrice, unitPriceMinor: tier.unitPriceMinor, currencyCode: list.currencyCode, priceListId: list.id, minQuantity: tier.minQuantity };
  }, readOptions);
}
