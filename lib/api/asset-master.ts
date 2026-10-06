import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { assetCategory, fixedAsset, chartAccount, depreciationEntry, assetRevaluation, cwipCost, journalEntry } from "@/lib/db/schema";
import { AuthError, type AuthContext } from "./auth-context";
import { requireRole } from "./require-role";
import { lockTaxOrganization, auditTax, type TaxTx } from "./tax-config-transaction";
import { legacyMinor, stringifyWire } from "@/lib/money/wire";
import { assetMasterId, assetCategoryCreateSchema, assetCategoryUpdateSchema, assetCreateSchema, assetUpdateSchema,
  assetCategoryListSchema, assetListSchema, assetCategoryAmounts, assetAmounts, assetDto, assetCategoryDto, assetMoneyDto } from "./asset-master-wire";

const categoryScope = (ctx: AuthContext, id?: string) => and(eq(assetCategory.organizationId, ctx.organizationId), isNull(assetCategory.deletedAt), id ? eq(assetCategory.id, id) : undefined);
const assetScope = (ctx: AuthContext, id?: string) => and(eq(fixedAsset.organizationId, ctx.organizationId), isNull(fixedAsset.deletedAt), id ? eq(fixedAsset.id, id) : undefined);
const accountFields = ["assetAccountId", "depreciationAccountId", "accumulatedDepAccountId", "cwipAccountId"] as const;
async function ownedAccounts(tx: TaxTx, ctx: AuthContext, values: Partial<Record<typeof accountFields[number], string | null>>) {
  for (const field of accountFields) if (values[field]) {
    const [account] = await tx.select({ id: chartAccount.id }).from(chartAccount)
      .where(and(eq(chartAccount.id, values[field]!), eq(chartAccount.organizationId, ctx.organizationId), isNull(chartAccount.deletedAt), eq(chartAccount.isActive, true))).for("share");
    if (!account) throw new AuthError(`${field} must be a live active organization account`, 404);
  }
}
async function ownedCategory(tx: TaxTx, ctx: AuthContext, id: string | null | undefined) {
  if (!id) return;
  const [row] = await tx.select().from(assetCategory).where(categoryScope(ctx, id)).for("share");
  if (!row) throw new AuthError("Asset category not found", 404);
  assetCategoryDto(row); return row;
}
async function accountRead(tx: TaxTx, ctx: AuthContext, id: string | null) {
  if (!id) return null;
  const [row] = await tx.select().from(chartAccount).where(and(eq(chartAccount.id, id), eq(chartAccount.organizationId, ctx.organizationId)));
  if (!row) throw new AuthError("Saved asset account is outside the organization", 422);
  stringifyWire(row); return row;
}
async function categoryRead(tx: TaxTx, ctx: AuthContext, row: typeof assetCategory.$inferSelect) {
  return { ...assetCategoryDto(row), assetAccount: await accountRead(tx, ctx, row.assetAccountId),
    depreciationAccount: await accountRead(tx, ctx, row.depreciationAccountId), accumulatedDepAccount: await accountRead(tx, ctx, row.accumulatedDepAccountId),
    cwipAccount: await accountRead(tx, ctx, row.cwipAccountId) };
}
async function journalRead(tx: TaxTx, ctx: AuthContext, id: string | null) {
  if (!id) return null;
  const [row] = await tx.select().from(journalEntry).where(and(eq(journalEntry.id, id), eq(journalEntry.organizationId, ctx.organizationId)));
  if (!row) throw new AuthError("Saved asset journal is outside the organization", 422);
  stringifyWire(row); return row;
}
async function assetRead(tx: TaxTx, ctx: AuthContext, row: typeof fixedAsset.$inferSelect) {
  let category = null;
  if (row.categoryId) {
    const [linked] = await tx.select().from(assetCategory).where(and(eq(assetCategory.id, row.categoryId), eq(assetCategory.organizationId, ctx.organizationId)));
    if (!linked) throw new AuthError("Saved asset category is outside the organization", 422);
    category = assetCategoryDto(linked);
  }
  const depreciation = await tx.select().from(depreciationEntry).where(eq(depreciationEntry.fixedAssetId, row.id)).orderBy(asc(depreciationEntry.date), asc(depreciationEntry.createdAt), asc(depreciationEntry.id));
  const revaluations = await tx.select().from(assetRevaluation).where(eq(assetRevaluation.fixedAssetId, row.id)).orderBy(desc(assetRevaluation.date), asc(assetRevaluation.id));
  const costs = await tx.select().from(cwipCost).where(eq(cwipCost.fixedAssetId, row.id)).orderBy(asc(cwipCost.date), asc(cwipCost.id));
  return { ...assetDto(row), category, assetAccount: await accountRead(tx, ctx, row.assetAccountId),
    depreciationAccount: await accountRead(tx, ctx, row.depreciationAccountId), accumulatedDepAccount: await accountRead(tx, ctx, row.accumulatedDepAccountId),
    cwipAccount: await accountRead(tx, ctx, row.cwipAccountId),
    depreciationEntries: await Promise.all(depreciation.map(async r => ({ ...assetMoneyDto(r, ["amount"]), journalEntry: await journalRead(tx, ctx, r.journalEntryId) }))),
    revaluations: await Promise.all(revaluations.map(async r => ({ ...assetMoneyDto(r, ["previousCarryingAmount", "revaluedAmount", "changeAmount", "surplusAmount", "impairmentAmount"], ["changeAmount", "surplusAmount", "impairmentAmount"]), journalEntry: await journalRead(tx, ctx, r.journalEntryId) }))),
    cwipCosts: await Promise.all(costs.map(async r => ({ ...assetMoneyDto(r, ["amount"]), journalEntry: await journalRead(tx, ctx, r.journalEntryId) }))),
  };
}
function validateAsset(row: { purchasePrice: number; residualValue: number; accumulatedDepreciation: number; usefulLifeMonths: number;
  depreciationMethod: string; totalExpectedUnits: number | null; purchaseDate: string; inServiceDate: string | null }) {
  if (row.residualValue > row.purchasePrice || BigInt(row.residualValue) + BigInt(row.accumulatedDepreciation) > BigInt(row.purchasePrice))
    throw new AuthError("Residual and accumulated depreciation cannot exceed asset cost", 400);
  if (row.inServiceDate && row.inServiceDate < row.purchaseDate) throw new AuthError("In-service date cannot precede purchase date", 400);
  if (row.depreciationMethod === "units_of_production" && (!row.totalExpectedUnits || row.totalExpectedUnits < 1))
    throw new AuthError("Units-of-production requires positive totalExpectedUnits", 400);
}
export async function listAssetCategories(ctx: AuthContext, input: unknown) {
  requireRole(ctx, "manage:assets"); const p = assetCategoryListSchema.parse(input);
  return db.transaction(async tx => {
    const scope = and(categoryScope(ctx), p.isActive === undefined ? undefined : eq(assetCategory.isActive, p.isActive));
    const rows = await tx.select().from(assetCategory).where(scope).orderBy(asc(assetCategory.name), asc(assetCategory.id)).limit(p.limit).offset((p.page - 1) * p.limit);
    const [count] = await tx.select({ count: sql<string>`count(*)::text` }).from(assetCategory).where(scope);
    return { categories: rows.map(assetCategoryDto), total: legacyMinor(BigInt(count.count)), page: p.page, limit: p.limit };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
export async function getAssetCategory(ctx: AuthContext, id: string) {
  requireRole(ctx, "manage:assets"); assetMasterId.parse(id);
  return db.transaction(async tx => {
    const [row] = await tx.select().from(assetCategory).where(categoryScope(ctx, id));
    if (!row) throw new AuthError("Asset category not found", 404);
    return categoryRead(tx, ctx, row);
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
export async function createAssetCategory(ctx: AuthContext, input: unknown, request?: Request) {
  requireRole(ctx, "manage:assets"); const values = assetCategoryAmounts(assetCategoryCreateSchema.parse(input));
  return db.transaction(async tx => {
    await lockTaxOrganization(tx, ctx.organizationId); await ownedAccounts(tx, ctx, values);
    const [row] = await tx.insert(assetCategory).values({ ...values, organizationId: ctx.organizationId, defaultResidualValue: values.defaultResidualValue ?? 0 }).returning();
    const result = assetCategoryDto(row); await auditTax(tx, ctx.organizationId, "asset_category", row.id, "create", result, ctx, request); return result;
  });
}
export async function updateAssetCategory(ctx: AuthContext, id: string, input: unknown, request?: Request) {
  requireRole(ctx, "manage:assets"); assetMasterId.parse(id); const values = assetCategoryAmounts(assetCategoryUpdateSchema.parse(input));
  return db.transaction(async tx => {
    await lockTaxOrganization(tx, ctx.organizationId);
    const [before] = await tx.select().from(assetCategory).where(categoryScope(ctx, id)).for("update");
    if (!before) throw new AuthError("Asset category not found", 404);
    const old = assetCategoryDto(before); await ownedAccounts(tx, ctx, { ...before, ...values });
    const [row] = await tx.update(assetCategory).set({ ...values, updatedAt: new Date() }).where(categoryScope(ctx, id)).returning();
    const result = assetCategoryDto(row); await auditTax(tx, ctx.organizationId, "asset_category", id, "update", { before: old, after: result }, ctx, request); return result;
  });
}
export async function deleteAssetCategory(ctx: AuthContext, id: string, request?: Request) {
  requireRole(ctx, "manage:assets"); assetMasterId.parse(id);
  return db.transaction(async tx => {
    await lockTaxOrganization(tx, ctx.organizationId);
    const [row] = await tx.select().from(assetCategory).where(categoryScope(ctx, id)).for("update");
    if (!row) throw new AuthError("Asset category not found", 404);
    const before = assetCategoryDto(row);
    await tx.update(assetCategory).set({ deletedAt: new Date(), updatedAt: new Date() }).where(categoryScope(ctx, id));
    await auditTax(tx, ctx.organizationId, "asset_category", id, "delete", before, ctx, request); return { success: true };
  });
}
export async function listFixedAssets(ctx: AuthContext, input: unknown) {
  requireRole(ctx, "manage:assets"); const p = assetListSchema.parse(input);
  return db.transaction(async tx => {
    const scope = and(assetScope(ctx), p.status === undefined ? undefined : eq(fixedAsset.status, p.status), p.categoryId === undefined ? undefined : eq(fixedAsset.categoryId, p.categoryId));
    const rows = await tx.select().from(fixedAsset).where(scope).orderBy(desc(fixedAsset.createdAt), asc(fixedAsset.id)).limit(p.limit).offset((p.page - 1) * p.limit);
    const [count] = await tx.select({ count: sql<string>`count(*)::text` }).from(fixedAsset).where(scope);
    return { assets: rows.map(assetDto), total: legacyMinor(BigInt(count.count)), page: p.page, limit: p.limit };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
export async function getFixedAsset(ctx: AuthContext, id: string) {
  requireRole(ctx, "manage:assets"); assetMasterId.parse(id);
  return db.transaction(async tx => {
    const [row] = await tx.select().from(fixedAsset).where(assetScope(ctx, id));
    if (!row) throw new AuthError("Fixed asset not found", 404);
    return assetRead(tx, ctx, row);
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
export async function createFixedAsset(ctx: AuthContext, input: unknown, request?: Request) {
  requireRole(ctx, "manage:assets"); const parsed = assetAmounts(assetCreateSchema.parse(input), true);
  return db.transaction(async tx => {
    await lockTaxOrganization(tx, ctx.organizationId); const category = await ownedCategory(tx, ctx, parsed.categoryId);
    const values = { ...parsed, purchasePrice: parsed.purchasePrice!, residualValue: parsed.residualValue ?? category?.defaultResidualValue ?? 0,
      usefulLifeMonths: parsed.usefulLifeMonths ?? category?.defaultUsefulLifeMonths ?? 0,
      depreciationMethod: parsed.depreciationMethod ?? category?.defaultDepreciationMethod ?? "straight_line",
      convention: parsed.convention ?? category?.defaultConvention ?? "full_month",
      inServiceDate: parsed.inServiceDate ?? parsed.purchaseDate, totalExpectedUnits: parsed.totalExpectedUnits ?? null,
      isCwip: parsed.isCwip ?? false, netBookValue: parsed.purchasePrice!, accumulatedDepreciation: 0 };
    if (values.usefulLifeMonths < 1) throw new AuthError("usefulLifeMonths is required directly or via category", 400);
    for (const field of accountFields) values[field] = parsed[field] === undefined ? category?.[field] ?? null : parsed[field];
    validateAsset(values); await ownedAccounts(tx, ctx, values);
    const [row] = await tx.insert(fixedAsset).values({ ...values, organizationId: ctx.organizationId, status: values.isCwip ? "in_progress" : "active" }).returning();
    const result = assetDto(row); await auditTax(tx, ctx.organizationId, "fixed_asset", row.id, "create", result, ctx, request); return result;
  });
}
export async function updateFixedAsset(ctx: AuthContext, id: string, input: unknown, request?: Request) {
  requireRole(ctx, "manage:assets"); assetMasterId.parse(id); const parsed = assetAmounts(assetUpdateSchema.parse(input));
  // ORM omits undefined values; merged validation must do the same.
  const values = Object.fromEntries(Object.entries(parsed).filter(([, value]) => value !== undefined)) as typeof parsed;
  return db.transaction(async tx => {
    await lockTaxOrganization(tx, ctx.organizationId);
    const [before] = await tx.select().from(fixedAsset).where(assetScope(ctx, id)).for("update");
    if (!before) throw new AuthError("Fixed asset not found", 404);
    const old = assetDto(before); const merged = { ...before, ...values, residualValue: values.residualValue ?? before.residualValue }; validateAsset(merged);
    if (values.isCwip !== undefined && values.isCwip !== before.isCwip) throw new AuthError("Use the CWIP capitalization workflow to change state", 409);
    const economic = ["residualValue", "usefulLifeMonths", "depreciationMethod", "convention", "inServiceDate", "totalExpectedUnits", ...accountFields] as const;
    if (economic.some(field => merged[field] !== before[field])) {
      const [dep] = await tx.select({ id: depreciationEntry.id }).from(depreciationEntry).where(eq(depreciationEntry.fixedAssetId, id)).limit(1);
      const [rev] = await tx.select({ id: assetRevaluation.id }).from(assetRevaluation).where(eq(assetRevaluation.fixedAssetId, id)).limit(1);
      const [cost] = await tx.select({ id: cwipCost.id }).from(cwipCost).where(eq(cwipCost.fixedAssetId, id)).limit(1);
      if (dep || rev || cost || before.accumulatedDepreciation !== 0 || before.revaluedAmount !== null || before.revaluationSurplusBalance !== 0 ||
        before.status === "disposed" || before.status === "fully_depreciated" || before.capitalizedDate || before.disposalDate)
        throw new AuthError("Economic settings cannot change with asset history", 409);
    }
    if (values.categoryId !== undefined) await ownedCategory(tx, ctx, values.categoryId);
    else if (before.categoryId) {
      const [saved] = await tx.select().from(assetCategory).where(and(eq(assetCategory.id, before.categoryId), eq(assetCategory.organizationId, ctx.organizationId)));
      if (!saved) throw new AuthError("Saved asset category is outside the organization", 422);
      assetCategoryDto(saved);
    }
    await ownedAccounts(tx, ctx, merged);
    const [row] = await tx.update(fixedAsset).set({ ...values, updatedAt: new Date() }).where(assetScope(ctx, id)).returning();
    const result = assetDto(row); await auditTax(tx, ctx.organizationId, "fixed_asset", id, "update", { before: old, after: result }, ctx, request); return result;
  });
}
export async function deleteFixedAsset(ctx: AuthContext, id: string, request?: Request) {
  requireRole(ctx, "manage:assets"); assetMasterId.parse(id);
  return db.transaction(async tx => {
    await lockTaxOrganization(tx, ctx.organizationId);
    const [row] = await tx.select().from(fixedAsset).where(assetScope(ctx, id)).for("update");
    if (!row) throw new AuthError("Fixed asset not found", 404);
    const before = assetDto(row);
    await tx.update(fixedAsset).set({ deletedAt: new Date(), updatedAt: new Date() }).where(assetScope(ctx, id));
    await auditTax(tx, ctx.organizationId, "fixed_asset", id, "delete", before, ctx, request); return { success: true };
  });
}
