import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { fixedAsset, cwipCost, assetCategory, depreciationEntry, assetRevaluation, chartAccount, journalEntry, journalLine, auditLog, organization } from "@/lib/db/schema";
import { AuthError, type AuthContext } from "./auth-context";
import { requireRole } from "./require-role";
import { lockTaxOrganization, auditTax, type TaxTx } from "./tax-config-transaction";
import { assertNotLocked } from "./period-lock";
import { ensureAccountByCode, getNextEntryNumber } from "./journal-automation";
import { assetDto, assetMoneyDto, assetMasterId, assetDate } from "./asset-master-wire";
import { assetCwipCostSchema, assetCapitalizeSchema, cwipAmount } from "./asset-cwip-wire";
import { legacyMinor, stringifyWire } from "@/lib/money/wire";

type Asset = typeof fixedAsset.$inferSelect;
type Result = Record<string, unknown>;
const scope = (ctx: AuthContext, id: string) => and(eq(fixedAsset.id, id), eq(fixedAsset.organizationId, ctx.organizationId), isNull(fixedAsset.deletedAt));
const unsupported = (message: string): never => { throw new AuthError(message, 422); };
async function load(tx: TaxTx, ctx: AuthContext, id: string, lock = false) {
  const query = tx.select().from(fixedAsset).where(scope(ctx, id));
  const [asset] = await (lock ? query.for("update") : query);
  if (!asset) throw new AuthError("Fixed asset not found", 404);
  assetDto(asset); return asset;
}
async function account(tx: TaxTx, ctx: AuthContext, id: string, base: string, assetOnly = false, historical = false) {
  const query = tx.select().from(chartAccount).where(and(eq(chartAccount.id, id), eq(chartAccount.organizationId, ctx.organizationId),
    historical ? undefined : isNull(chartAccount.deletedAt), historical ? undefined : eq(chartAccount.isActive, true)));
  const [row] = await (historical ? query : query.for("share"));
  if (!row || row.currencyCode !== base || (assetOnly && row.type !== "asset")) unsupported("Posting account must belong to the organization and use base currency; CWIP/destination accounts must be assets; new accounts must be live and active");
  return id;
}
async function resolveAccount(tx: TaxTx, ctx: AuthContext, base: string, id: string | null | undefined, code: string, name: string) {
  const resolved = id ?? (await ensureAccountByCode(ctx.organizationId, { code, name, type: "asset", subType: "fixed_asset" }, base, tx))?.id;
  if (!resolved) return unsupported("Cannot resolve asset posting account");
  return account(tx, ctx, resolved, base, true);
}
async function replay(tx: TaxTx, ctx: AuthContext, id: string, action: string, key: string | undefined, fingerprint: string) {
  if (!key) return;
  const [row] = await tx.select().from(auditLog).where(and(eq(auditLog.organizationId, ctx.organizationId), eq(auditLog.entityType, "fixed_asset"),
    eq(auditLog.entityId, id), eq(auditLog.action, action), sql`${auditLog.changes}->>'retryKey' = ${key}`)).orderBy(desc(auditLog.createdAt)).limit(1);
  if (!row) return;
  const saved = row.changes as { fingerprint: string; result: Result };
  if (saved.fingerprint !== fingerprint) throw new AuthError("Retry key was used with different inputs", 409);
  stringifyWire(saved.result); return saved.result;
}
async function record(tx: TaxTx, ctx: AuthContext, id: string, action: string, key: string | undefined, fingerprint: string, result: Result, request?: Request) {
  stringifyWire(result);
  await auditTax(tx, ctx.organizationId, "fixed_asset", id, action, { retryKey: key ?? null, fingerprint, result }, ctx, request);
}
async function costs(tx: TaxTx, ctx: AuthContext, asset: Asset, base: string) {
  const rows = await tx.select().from(cwipCost).where(eq(cwipCost.fixedAssetId, asset.id)).orderBy(desc(cwipCost.date), desc(cwipCost.createdAt), desc(cwipCost.id));
  let sum = 0n, latest = asset.purchaseDate;
  const links = new Set<string>();
  const result = [];
  for (const row of rows) {
    const dto = assetMoneyDto(row, ["amount"]); sum += BigInt(row.amount);
    if (!assetDate.safeParse(row.date).success || row.date < asset.purchaseDate || row.amount <= 0) unsupported("Unsupported saved construction cost date or amount");
    if (row.date > latest) latest = row.date;
    let entry = null;
    if (!row.journalEntryId) unsupported("Saved construction cost requires its posted journal; remediate unsupported history separately");
    if (row.journalEntryId) {
      if (links.has(row.journalEntryId)) unsupported("Construction costs reuse the same journal");
      links.add(row.journalEntryId);
      const [saved] = await tx.select().from(journalEntry).where(and(eq(journalEntry.id, row.journalEntryId), eq(journalEntry.organizationId, ctx.organizationId)));
      if (!saved || saved.status !== "posted" || saved.deletedAt || saved.date !== row.date || saved.sourceType !== "cwip_cost" || saved.sourceId !== asset.id) unsupported("Saved CWIP journal does not match cost history");
      const lines = await tx.select().from(journalLine).where(eq(journalLine.journalEntryId, saved.id));
      if (lines.length !== 2 || new Set(lines.map(l => l.accountId)).size !== 2) unsupported("Saved CWIP journal must have distinct debit/credit accounts");
      let debit = 0n, credit = 0n;
      for (const l of lines) {
        assetMoneyDto(l, ["debitAmount", "creditAmount"]);
        await account(tx, ctx, l.accountId, base, false, true);
        if (l.currencyCode !== base || l.exchangeRate !== 1000000 || (l.rateExact !== null && l.rateExact !== "1") ||
          (l.rateDirection !== null && l.rateDirection !== "quote_per_base") || (l.debitAmount > 0 && l.creditAmount > 0)) unsupported("Unsupported CWIP journal currency, rate or legs");
        if (l.debitAmount && l.accountId !== asset.cwipAccountId) unsupported("Saved construction cost is held in a different CWIP account");
        debit += BigInt(l.debitAmount); credit += BigInt(l.creditAmount);
      }
      if (debit !== BigInt(row.amount) || credit !== debit) unsupported("Saved CWIP journal does not equal cost amount");
      entry = saved;
    }
    result.push({ ...dto, journalEntry: entry });
  }
  const total = legacyMinor(sum);
  if (sum > BigInt(asset.purchasePrice)) unsupported("Construction cost history exceeds recorded purchase cost");
  return { costs: result, total, totalMinor: String(total), latest };
}
async function state(tx: TaxTx, ctx: AuthContext, asset: Asset, date: string) {
  if (asset.status !== "in_progress" || !asset.isCwip || asset.capitalizedDate || asset.disposalDate || asset.disposalAmount !== null)
    throw new AuthError("Asset must be uncapitalized CWIP and in progress", 400);
  if (date < asset.purchaseDate) throw new AuthError("Posting date precedes purchase date", 400);
  if (asset.accumulatedDepreciation !== 0 || asset.revaluedAmount !== null || asset.revaluationSurplusBalance !== 0 || asset.netBookValue !== asset.purchasePrice || asset.residualValue > asset.purchasePrice)
    unsupported("Unsupported saved CWIP carrying amounts");
  const [dep] = await tx.select({ id: depreciationEntry.id }).from(depreciationEntry).where(eq(depreciationEntry.fixedAssetId, asset.id)).limit(1);
  const [rev] = await tx.select({ id: assetRevaluation.id }).from(assetRevaluation).where(eq(assetRevaluation.fixedAssetId, asset.id)).limit(1);
  if (dep || rev) unsupported("CWIP cannot have depreciation or valuation history");
  if (asset.categoryId) {
    const [category] = await tx.select().from(assetCategory).where(and(eq(assetCategory.id, asset.categoryId), eq(assetCategory.organizationId, ctx.organizationId), isNull(assetCategory.deletedAt))).for("share");
    if (!category) unsupported("Saved asset category must belong to the organization and be live");
  }
  await tx.execute(sql`lock table period_lock, fiscal_year in share mode`);
  await assertNotLocked(ctx.organizationId, date, ctx, tx);
  const [org] = await tx.select().from(organization).where(eq(organization.id, ctx.organizationId));
  return org.defaultCurrency;
}
async function post(tx: TaxTx, ctx: AuthContext, asset: Asset, date: string, base: string, source: string, amount: number, debit: string, credit: string, description?: string) {
  if (debit === credit) unsupported("CWIP and counterparty accounts must differ");
  if (!amount) return null;
  const [entry] = await tx.insert(journalEntry).values({ organizationId: ctx.organizationId, entryNumber: await getNextEntryNumber(ctx.organizationId, tx), date,
    description: `${source} - ${asset.name} (${asset.assetNumber})`, reference: asset.assetNumber, status: "posted", sourceType: source, sourceId: asset.id, postedAt: new Date(), createdBy: ctx.userId }).returning();
  const legs = [{ accountId: debit, debitAmount: amount, creditAmount: 0 }, { accountId: credit, debitAmount: 0, creditAmount: amount }];
  const saved = await tx.insert(journalLine).values(legs.map(l => ({ ...l, journalEntryId: entry.id, description: description ?? entry.description, currencyCode: base,
    exchangeRate: 1000000, rateExact: "1", rateDirection: "quote_per_base", rateFormatVersion: 1, rateMigrationStatus: "exact" }))).returning();
  for (let i = 0; i < legs.length; i++) {
    assetMoneyDto(saved[i], ["debitAmount", "creditAmount"]);
    if (saved[i].accountId !== legs[i].accountId || saved[i].debitAmount !== legs[i].debitAmount || saved[i].creditAmount !== legs[i].creditAmount ||
      saved[i].currencyCode !== base || saved[i].exchangeRate !== 1000000 || saved[i].rateExact !== "1" || saved[i].rateDirection !== "quote_per_base") unsupported("Saved CWIP journal differs from exact posting");
  }
  return entry.id;
}
export async function listCwipCosts(ctx: AuthContext, id: string) {
  requireRole(ctx, "manage:assets"); assetMasterId.parse(id);
  return db.transaction(async tx => {
    const asset = await load(tx, ctx, id);
    const [org] = await tx.select().from(organization).where(eq(organization.id, ctx.organizationId));
    const { costs: rows, total, totalMinor } = await costs(tx, ctx, asset, org.defaultCurrency);
    const result = { costs: rows, total, totalMinor }; stringifyWire(result); return result;
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
export async function addCwipCost(ctx: AuthContext, id: string, input: unknown, request?: Request) {
  requireRole(ctx, "manage:assets"); assetMasterId.parse(id); const p = assetCwipCostSchema.parse(input), amount = cwipAmount(p);
  const fingerprint = stringifyWire({ amount, date: p.date, description: p.description ?? null, sourceAccountId: p.sourceAccountId, cwipAccountId: p.cwipAccountId ?? null });
  return db.transaction(async tx => {
    await lockTaxOrganization(tx, ctx.organizationId); const asset = await load(tx, ctx, id, true);
    const saved = await replay(tx, ctx, id, "add_cwip_cost", p.idempotencyKey, fingerprint); if (saved) return saved;
    const base = await state(tx, ctx, asset, p.date), h = await costs(tx, ctx, asset, base);
    if (p.date < h.latest) throw new AuthError("Cost date precedes saved construction history", 409);
    const price = legacyMinor(BigInt(asset.purchasePrice) + BigInt(amount));
    const cwip = await resolveAccount(tx, ctx, base, p.cwipAccountId ?? asset.cwipAccountId, "1700", "Assets Under Construction");
    if (asset.purchasePrice > 0 && asset.cwipAccountId !== cwip) unsupported("Cannot redirect an existing CWIP carrying balance");
    await account(tx, ctx, p.sourceAccountId, base);
    const journalEntryId = await post(tx, ctx, asset, p.date, base, "cwip_cost", amount, cwip, p.sourceAccountId, p.description);
    const [cost] = await tx.insert(cwipCost).values({ fixedAssetId: id, date: p.date, description: p.description ?? null, amount, journalEntryId }).returning();
    const [updated] = await tx.update(fixedAsset).set({ purchasePrice: price, netBookValue: price, cwipAccountId: cwip, updatedAt: new Date() }).where(scope(ctx, id)).returning();
    const costDto = assetMoneyDto(cost, ["amount"]);
    if (cost.amount !== amount || cost.journalEntryId !== journalEntryId) unsupported("Saved construction cost differs from input");
    const result = { cost: costDto, asset: assetDto(updated), journalEntryId };
    if (updated.purchasePrice !== price || updated.netBookValue !== price || updated.cwipAccountId !== cwip) unsupported("Saved CWIP root differs from accumulated cost");
    await record(tx, ctx, id, "add_cwip_cost", p.idempotencyKey, fingerprint, result, request); return result;
  });
}
export async function capitalizeCwipAsset(ctx: AuthContext, id: string, input: unknown, request?: Request) {
  requireRole(ctx, "manage:assets"); assetMasterId.parse(id); const p = assetCapitalizeSchema.parse(input);
  const service = p.inServiceDate ?? p.date;
  if (service < p.date) throw new AuthError("In-service date cannot precede capitalization", 400);
  const fingerprint = stringifyWire({ date: p.date, inServiceDate: service, assetAccountId: p.assetAccountId ?? null, cwipAccountId: p.cwipAccountId ?? null });
  const key = p.idempotencyKey ?? "capitalization";
  return db.transaction(async tx => {
    await lockTaxOrganization(tx, ctx.organizationId); const asset = await load(tx, ctx, id, true);
    const saved = await replay(tx, ctx, id, "capitalize_cwip", key, fingerprint); if (saved) return saved;
    const base = await state(tx, ctx, asset, p.date), h = await costs(tx, ctx, asset, base);
    if (p.date < h.latest) throw new AuthError("Capitalization precedes saved construction history", 409);
    // Recorded cost includes any opening CWIP basis plus all added costs. Never
    // overwrite that opening basis with just the tracked construction-cost sum.
    const capitalizedCost = asset.purchasePrice;
    const cwip = await resolveAccount(tx, ctx, base, p.cwipAccountId ?? asset.cwipAccountId, "1700", "Assets Under Construction");
    if (capitalizedCost > 0 && asset.cwipAccountId !== cwip) unsupported("Existing CWIP basis requires its saved holding account");
    const destination = await resolveAccount(tx, ctx, base, p.assetAccountId ?? asset.assetAccountId, "1500", "Property, Plant & Equipment");
    const journalEntryId = await post(tx, ctx, asset, p.date, base, "cwip_capitalization", capitalizedCost, destination, cwip);
    const [updated] = await tx.update(fixedAsset).set({ isCwip: false, status: "active", capitalizedDate: p.date, inServiceDate: service,
      assetAccountId: destination, cwipAccountId: cwip, updatedAt: new Date() }).where(scope(ctx, id)).returning();
    const result = { asset: assetDto(updated), capitalizedCost, capitalizedCostMinor: String(capitalizedCost), journalEntryId };
    if (updated.purchasePrice !== capitalizedCost || updated.netBookValue !== capitalizedCost || updated.isCwip || updated.status !== "active" || updated.capitalizedDate !== p.date || updated.inServiceDate !== service ||
      updated.cwipAccountId !== cwip || updated.assetAccountId !== destination) unsupported("Saved capitalization differs from input");
    await record(tx, ctx, id, "capitalize_cwip", key, fingerprint, result, request); return result;
  });
}
