import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { inventoryItem, inventoryVariant, inventoryItemSupplier, contact, auditLog } from "@/lib/db/schema";
import { AuthError, type AuthContext } from "./auth-context";
import { requireRole } from "./require-role";
import { catalogId, catalogDto, catalogPrices, variantCreateSchema, variantUpdateSchema, supplierCreateSchema, supplierUpdateSchema } from "./inventory-catalog-wire";
import { stringifyWire } from "@/lib/money/wire";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
const itemScope = (ctx: AuthContext, id: string) => and(eq(inventoryItem.id, id), eq(inventoryItem.organizationId, ctx.organizationId), isNull(inventoryItem.deletedAt));
const variantScope = (ctx: AuthContext, itemId: string, id?: string) => and(eq(inventoryVariant.organizationId, ctx.organizationId),
  eq(inventoryVariant.inventoryItemId, itemId), isNull(inventoryVariant.deletedAt), id ? eq(inventoryVariant.id, id) : undefined);
const supplierScope = (ctx: AuthContext, itemId: string, id?: string) => and(eq(inventoryItemSupplier.organizationId, ctx.organizationId),
  eq(inventoryItemSupplier.inventoryItemId, itemId), id ? eq(inventoryItemSupplier.id, id) : undefined);
async function parent(tx: Tx, ctx: AuthContext, id: string, lock = false) {
  catalogId.parse(id);
  const query = tx.select({ id: inventoryItem.id }).from(inventoryItem).where(itemScope(ctx, id));
  const [row] = await (lock ? query.for("update") : query);
  if (!row) throw new AuthError("Inventory item not found", 404);
}
async function audit(tx: Tx, ctx: AuthContext, type: string, id: string, action: string, changes: unknown, request?: Request) {
  await tx.insert(auditLog).values({ organizationId: ctx.organizationId, userId: ctx.userId, entityType: type, entityId: id, action,
    changes: JSON.parse(stringifyWire(changes)), ipAddress: request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
    userAgent: request?.headers.get("user-agent") || null });
}
async function ownedSupplier(tx: Tx, ctx: AuthContext, id: string) {
  const [row] = await tx.select({ id: contact.id, type: contact.type }).from(contact)
    .where(and(eq(contact.id, id), eq(contact.organizationId, ctx.organizationId), isNull(contact.deletedAt))).for("share");
  if (!row || !["supplier", "both"].includes(row.type)) throw new AuthError("Contact must be a live organization-owned supplier", 404);
}
export async function listInventoryVariants(ctx: AuthContext, itemId: string) {
  return db.transaction(async tx => {
    await parent(tx, ctx, itemId);
    return (await tx.select().from(inventoryVariant).where(variantScope(ctx, itemId)).orderBy(asc(inventoryVariant.name), inventoryVariant.id)).map(catalogDto);
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
export async function createInventoryVariant(ctx: AuthContext, itemId: string, input: unknown, request?: Request) {
  requireRole(ctx, "manage:inventory"); const values = catalogPrices(variantCreateSchema.parse(input));
  return db.transaction(async tx => {
    await parent(tx, ctx, itemId, true);
    const [row] = await tx.insert(inventoryVariant).values({ ...values, organizationId: ctx.organizationId, inventoryItemId: itemId,
      purchasePrice: values.purchasePrice ?? 0, salePrice: values.salePrice ?? 0, quantityOnHand: values.quantityOnHand ?? 0, options: values.options ?? {} }).returning();
    const result = catalogDto(row); await audit(tx, ctx, "inventory_variant", row.id, "create", result, request); return result;
  });
}
export async function updateInventoryVariant(ctx: AuthContext, itemId: string, id: string, input: unknown, request?: Request) {
  requireRole(ctx, "manage:inventory"); catalogId.parse(id); const values = catalogPrices(variantUpdateSchema.parse(input));
  return db.transaction(async tx => {
    await parent(tx, ctx, itemId, true);
    const [existing] = await tx.select().from(inventoryVariant).where(variantScope(ctx, itemId, id)).for("update");
    if (!existing) throw new AuthError("Variant not found", 404);
    const before = catalogDto(existing);
    const [row] = await tx.update(inventoryVariant).set({ ...values, updatedAt: new Date() }).where(variantScope(ctx, itemId, id)).returning();
    const result = catalogDto(row); await audit(tx, ctx, "inventory_variant", id, "update", { before, after: result }, request); return result;
  });
}
export async function deleteInventoryVariant(ctx: AuthContext, itemId: string, id: string, request?: Request) {
  requireRole(ctx, "manage:inventory"); catalogId.parse(id);
  return db.transaction(async tx => {
    await parent(tx, ctx, itemId, true);
    const [row] = await tx.select({ id: inventoryVariant.id }).from(inventoryVariant).where(variantScope(ctx, itemId, id)).for("update");
    if (!row) throw new AuthError("Variant not found", 404);
    await tx.update(inventoryVariant).set({ deletedAt: new Date(), updatedAt: new Date() }).where(variantScope(ctx, itemId, id));
    await audit(tx, ctx, "inventory_variant", id, "delete", { id, inventoryItemId: itemId }, request); return { success: true };
  });
}
export async function listInventorySuppliers(ctx: AuthContext, itemId: string) {
  return db.transaction(async tx => {
    await parent(tx, ctx, itemId);
    // Scope the join too: a malformed historical foreign link must never disclose contact details.
    const rows = await tx.select({ id: inventoryItemSupplier.id, inventoryItemId: inventoryItemSupplier.inventoryItemId,
      contactId: inventoryItemSupplier.contactId, supplierCode: inventoryItemSupplier.supplierCode, leadTimeDays: inventoryItemSupplier.leadTimeDays,
      purchasePrice: inventoryItemSupplier.purchasePrice, isPreferred: inventoryItemSupplier.isPreferred,
      createdAt: inventoryItemSupplier.createdAt, updatedAt: inventoryItemSupplier.updatedAt, contactName: contact.name, contactEmail: contact.email,
    }).from(inventoryItemSupplier).innerJoin(contact, and(eq(contact.id, inventoryItemSupplier.contactId), eq(contact.organizationId, ctx.organizationId)))
      .where(supplierScope(ctx, itemId)).orderBy(inventoryItemSupplier.id);
    return rows.map(catalogDto);
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
export async function createInventorySupplier(ctx: AuthContext, itemId: string, input: unknown, request?: Request) {
  requireRole(ctx, "manage:inventory"); const values = catalogPrices(supplierCreateSchema.parse(input));
  return db.transaction(async tx => {
    await parent(tx, ctx, itemId, true); await ownedSupplier(tx, ctx, values.contactId);
    const [existing] = await tx.select({ id: inventoryItemSupplier.id }).from(inventoryItemSupplier)
      .where(and(eq(inventoryItemSupplier.inventoryItemId, itemId), eq(inventoryItemSupplier.contactId, values.contactId)));
    if (existing) throw new AuthError("Supplier is already linked to this item", 409);
    const [row] = await tx.insert(inventoryItemSupplier).values({ ...values, organizationId: ctx.organizationId, inventoryItemId: itemId,
      purchasePrice: values.purchasePrice ?? 0, leadTimeDays: values.leadTimeDays ?? 0, isPreferred: values.isPreferred ?? false }).returning();
    const result = catalogDto(row); await audit(tx, ctx, "inventory_item_supplier", row.id, "create", result, request); return result;
  });
}
export async function updateInventorySupplier(ctx: AuthContext, itemId: string, id: string, input: unknown, request?: Request) {
  requireRole(ctx, "manage:inventory"); catalogId.parse(id); const values = catalogPrices(supplierUpdateSchema.parse(input));
  return db.transaction(async tx => {
    await parent(tx, ctx, itemId, true);
    const [existing] = await tx.select().from(inventoryItemSupplier).where(supplierScope(ctx, itemId, id)).for("update");
    if (!existing) throw new AuthError("Supplier link not found", 404);
    await ownedSupplier(tx, ctx, existing.contactId); const before = catalogDto(existing);
    const [row] = await tx.update(inventoryItemSupplier).set({ ...values, updatedAt: new Date() }).where(supplierScope(ctx, itemId, id)).returning();
    const result = catalogDto(row); await audit(tx, ctx, "inventory_item_supplier", id, "update", { before, after: result }, request); return result;
  });
}
export async function deleteInventorySupplier(ctx: AuthContext, itemId: string, id: string, request?: Request) {
  requireRole(ctx, "manage:inventory"); catalogId.parse(id);
  return db.transaction(async tx => {
    await parent(tx, ctx, itemId, true);
    const [row] = await tx.select({ id: inventoryItemSupplier.id }).from(inventoryItemSupplier).where(supplierScope(ctx, itemId, id)).for("update");
    if (!row) throw new AuthError("Supplier link not found", 404);
    await tx.delete(inventoryItemSupplier).where(supplierScope(ctx, itemId, id));
    await audit(tx, ctx, "inventory_item_supplier", id, "delete", { id, inventoryItemId: itemId }, request); return { success: true };
  });
}
