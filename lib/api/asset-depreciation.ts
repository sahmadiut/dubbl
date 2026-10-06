import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { fixedAsset, depreciationEntry, chartAccount, journalEntry, journalLine, auditLog, assetRevaluation, organization, costCenter, project } from "@/lib/db/schema";
import { AuthError, type AuthContext } from "./auth-context";
import { requireRole } from "./require-role";
import { lockTaxOrganization, auditTax, type TaxTx } from "./tax-config-transaction";
import { assetDto, assetMoneyDto, assetMasterId, assetDate } from "./asset-master-wire";
import { assetDepreciationSchema, assetDepreciationBatchSchema, assetDepreciationRollbackSchema } from "./asset-depreciation-wire";
import { calculateMonthlyDepreciation } from "@/lib/fixed-assets/depreciation";
import { legacyMinor, stringifyWire } from "@/lib/money/wire";
import { assertNotLocked } from "./period-lock";
import { getNextEntryNumber } from "./journal-automation";

type Asset = typeof fixedAsset.$inferSelect;
type Dep = typeof depreciationEntry.$inferSelect;
const scope = (ctx: AuthContext, id: string) => and(eq(fixedAsset.organizationId, ctx.organizationId), eq(fixedAsset.id, id), isNull(fixedAsset.deletedAt));
const today = () => new Date().toISOString().slice(0, 10);
async function lockPeriods(tx: TaxTx) {
  // Also protects missing lock/year rows against concurrent insertion. The legacy
  // period writers do not yet share the organization-lock protocol.
  await tx.execute(sql`lock table period_lock, fiscal_year in share mode`);
}
const totals = (row: Asset) => assetMoneyDto({ accumulatedDepreciation: row.accumulatedDepreciation, netBookValue: row.netBookValue, status: row.status }, ["accumulatedDepreciation", "netBookValue"]);
async function load(tx: TaxTx, ctx: AuthContext, id: string) {
  const [row] = await tx.select().from(fixedAsset).where(scope(ctx, id)).for("update");
  if (!row) throw new AuthError("Fixed asset not found", 404);
  assetDto(row);
  if (row.inServiceDate && row.inServiceDate < row.purchaseDate) throw new AuthError("Saved service date precedes purchase", 422);
  if (BigInt(row.residualValue) + BigInt(row.accumulatedDepreciation) > BigInt(row.purchasePrice) ||
      BigInt(row.netBookValue) !== BigInt(row.purchasePrice) - BigInt(row.accumulatedDepreciation))
    throw new AuthError("Saved asset cost, residual and book totals disagree", 422);
  // Revaluation changes the economic base; that history requires MON-088 policy.
  const [revaluation] = await tx.select({ id: assetRevaluation.id }).from(assetRevaluation).where(eq(assetRevaluation.fixedAssetId, id)).limit(1);
  if (revaluation || row.revaluedAmount !== null || row.revaluationSurplusBalance !== 0)
    throw new AuthError("Depreciation of revalued assets is not supported by this contract", 422);
  return row;
}

/** Adopted masters and all still-legacy lifecycle writers share organization/asset locks.
 * Legacy writers calculate outside the transaction; reject their stale snapshot under lock.
 */
export async function lockAssetSnapshot(tx: TaxTx, ctx: AuthContext, snapshot: Asset) {
  await lockTaxOrganization(tx, ctx.organizationId);
  const [current] = await tx.select().from(fixedAsset).where(scope(ctx, snapshot.id)).for("update");
  if (!current) throw new AuthError("Fixed asset not found", 404);
  if (stringifyWire(current) !== stringifyWire(snapshot)) throw new AuthError("Asset changed; reload before retrying", 409);
}
async function history(tx: TaxTx, ctx: AuthContext, asset: Asset) {
  const id = asset.id;
  const rows = await tx.select().from(depreciationEntry).where(eq(depreciationEntry.fixedAssetId, id))
    .orderBy(desc(depreciationEntry.date), desc(depreciationEntry.createdAt), desc(depreciationEntry.id));
  let sum = 0n;
  for (const row of rows) {
    assetMoneyDto(row, ["amount"]); sum += BigInt(row.amount);
    if (!assetDate.safeParse(row.date).success ||
      (row.periodStart !== null && !assetDate.safeParse(row.periodStart).success) ||
      (row.periodEnd !== null && !assetDate.safeParse(row.periodEnd).success) ||
      !assetDepreciationSchema.shape.unitsThisPeriod.nullable().safeParse(row.unitsThisPeriod).success)
      throw new AuthError("Unsupported saved depreciation dates or physical units", 422);
    if (row.journalEntryId) {
      const [linked] = await tx.select({ id: journalEntry.id }).from(journalEntry).where(and(eq(journalEntry.id, row.journalEntryId), eq(journalEntry.organizationId, ctx.organizationId)));
      if (!linked) throw new AuthError("Saved depreciation journal is outside the organization", 422);
    }
  }
  if (sum > BigInt(asset.accumulatedDepreciation)) throw new AuthError("Saved depreciation history exceeds accumulated total", 422);
  return rows;
}
async function accounts(tx: TaxTx, ctx: AuthContext, ids: string[], historical = false) {
  for (const id of new Set(ids)) {
    const [row] = await tx.select().from(chartAccount).where(and(eq(chartAccount.id, id), eq(chartAccount.organizationId, ctx.organizationId),
      historical ? undefined : isNull(chartAccount.deletedAt), historical ? undefined : eq(chartAccount.isActive, true))).for("share");
    if (!row) throw new AuthError("Depreciation account must belong to the organization and be usable", 422);
  }
}
async function baseCurrency(tx: TaxTx, ctx: AuthContext, id: string) {
  const [org] = await tx.select({ currency: organization.defaultCurrency }).from(organization).where(eq(organization.id, ctx.organizationId));
  const priorLines = await tx.select({ currency: journalLine.currencyCode }).from(journalLine).innerJoin(journalEntry, eq(journalEntry.id, journalLine.journalEntryId))
    .where(and(eq(journalEntry.organizationId, ctx.organizationId), eq(journalEntry.sourceId, id), eq(journalEntry.sourceType, "depreciation")));
  if (priorLines.some(line => line.currency !== org.currency)) throw new AuthError("Asset depreciation currency history differs from organization base", 422);
  return org.currency;
}
function period(date: string) {
  const end = new Date(date + "T00:00:00Z"); end.setUTCMonth(end.getUTCMonth() + 1, 0);
  return { start: date.slice(0, 7) + "-01", end: end.toISOString().slice(0, 10) };
}
type Result = Record<string, unknown>;
async function replay(tx: TaxTx, ctx: AuthContext, id: string, action: string, key: string | undefined, fingerprint: string) {
  if (!key) return;
  const [row] = await tx.select().from(auditLog).where(and(eq(auditLog.organizationId, ctx.organizationId), eq(auditLog.entityId, id),
    eq(auditLog.entityType, "fixed_asset"), eq(auditLog.action, action), sql`${auditLog.changes}->>'retryKey' = ${key}`)).orderBy(desc(auditLog.createdAt)).limit(1);
  if (!row) return;
  const saved = row.changes as { fingerprint: string; result: Result };
  if (saved.fingerprint !== fingerprint) throw new AuthError("Retry key was already used with different inputs", 409);
  stringifyWire(saved.result); return saved.result;
}
async function record(tx: TaxTx, ctx: AuthContext, id: string, action: string, key: string | undefined, fingerprint: string, result: Result, request?: Request) {
  stringifyWire(result);
  await auditTax(tx, ctx.organizationId, "fixed_asset", id, action, { retryKey: key ?? null, fingerprint, result }, ctx, request);
}
async function post(tx: TaxTx, ctx: AuthContext, asset: Asset, date: string, units: number | undefined, prior: Dep[]) {
  if (asset.isCwip || asset.status !== "active") throw new AuthError("Asset must be active and capitalized", 400);
  if (date < (asset.inServiceDate ?? asset.purchaseDate)) throw new AuthError("Posting date precedes in-service date", 400);
  if (prior[0] && date < prior[0].date) throw new AuthError("Cannot insert depreciation before existing history", 409);
  const usage = asset.depreciationMethod === "units_of_production";
  if (usage ? !units || !asset.totalExpectedUnits : units !== undefined) throw new AuthError(usage ? "Positive unitsThisPeriod and totalExpectedUnits are required" : "unitsThisPeriod is only valid for usage-based assets", 400);
  await assertNotLocked(ctx.organizationId, date, ctx, tx);
  const amount = calculateMonthlyDepreciation({ ...asset, periodIndex: prior.length, unitsThisPeriod: units, periodDate: date });
  if (amount <= 0) throw new AuthError("No depreciation remaining for this period", 400);
  if (Boolean(asset.depreciationAccountId) !== Boolean(asset.accumulatedDepAccountId)) throw new AuthError("Configure both depreciation accounts or neither", 422);
  let journalEntryId: string | null = null;
  if (asset.depreciationAccountId && asset.accumulatedDepAccountId) {
    await accounts(tx, ctx, [asset.depreciationAccountId, asset.accumulatedDepAccountId]);
    if (asset.depreciationAccountId === asset.accumulatedDepAccountId) throw new AuthError("Depreciation accounts must differ", 422);
    const currencyCode = await baseCurrency(tx, ctx, asset.id);
    const [entry] = await tx.insert(journalEntry).values({ organizationId: ctx.organizationId,
      entryNumber: await getNextEntryNumber(ctx.organizationId, tx), date, description: `Depreciation - ${asset.name} (${asset.assetNumber})`,
      reference: asset.assetNumber, status: "posted", sourceType: "depreciation", sourceId: asset.id, postedAt: new Date(), createdBy: ctx.userId }).returning();
    journalEntryId = entry.id;
    // Existing sync_exact_fx supplies provenance for the lossless scaled-rate bridge.
    const fx = { currencyCode, exchangeRate: 1000000, rateExact: "1", rateFormatVersion: 1, rateDirection: "quote_per_base", rateMigrationStatus: "exact" };
    await tx.insert(journalLine).values([
      { journalEntryId: entry.id, accountId: asset.depreciationAccountId, debitAmount: amount, creditAmount: 0, ...fx },
      { journalEntryId: entry.id, accountId: asset.accumulatedDepAccountId, debitAmount: 0, creditAmount: amount, ...fx },
    ]);
  }
  const bounds = period(date);
  const [dep] = await tx.insert(depreciationEntry).values({ fixedAssetId: asset.id, date, amount, unitsThisPeriod: units ?? null,
    periodStart: bounds.start, periodEnd: bounds.end, journalEntryId }).returning();
  const accumulated = legacyMinor(BigInt(asset.accumulatedDepreciation) + BigInt(amount));
  const nbv = legacyMinor(BigInt(asset.purchasePrice) - BigInt(accumulated));
  const [updated] = await tx.update(fixedAsset).set({ accumulatedDepreciation: accumulated, netBookValue: nbv,
    status: nbv <= asset.residualValue ? "fully_depreciated" : "active", updatedAt: new Date() }).where(scope(ctx, asset.id)).returning();
  assetDto(updated);
  const result = { depreciationEntry: assetMoneyDto(dep, ["amount"]), journalEntryId, asset: totals(updated) };
  stringifyWire(result);
  // Audit is performed by the single/batch operation in this same transaction.
  return result;
}
export async function depreciateAsset(ctx: AuthContext, id: string, input: unknown, request?: Request) {
  requireRole(ctx, "manage:assets"); assetMasterId.parse(id); const p = assetDepreciationSchema.parse(input);
  const date = p.date ?? today(), fingerprint = stringifyWire({ date: p.date ?? null, unitsThisPeriod: p.unitsThisPeriod ?? null });
  return db.transaction(async tx => {
    await lockTaxOrganization(tx, ctx.organizationId); const asset = await load(tx, ctx, id);
    await lockPeriods(tx);
    const saved = await replay(tx, ctx, id, "depreciate", p.idempotencyKey, fingerprint); if (saved) return saved;
    const prior = await history(tx, ctx, asset), bounds = period(date);
    const same = prior.find(r => r.date >= bounds.start && r.date <= bounds.end);
    if (same) {
      if ((same.unitsThisPeriod ?? undefined) !== p.unitsThisPeriod) throw new AuthError("This month was already depreciated with different units", 409);
      const result = { depreciationEntry: assetMoneyDto(same, ["amount"]), journalEntryId: same.journalEntryId, asset: totals(asset) };
      if (p.idempotencyKey) await record(tx, ctx, id, "depreciate", p.idempotencyKey, fingerprint, result, request);
      return result;
    }
    const result = await post(tx, ctx, asset, date, p.unitsThisPeriod, prior);
    await record(tx, ctx, id, "depreciate", p.idempotencyKey, fingerprint, result, request); return result;
  });
}
export async function depreciateAssets(ctx: AuthContext, input: unknown, request?: Request) {
  requireRole(ctx, "manage:assets"); const p = assetDepreciationBatchSchema.parse(input), date = p.date ?? today();
  const fingerprint = stringifyWire({ date: p.date ?? null });
  return db.transaction(async tx => {
    await lockTaxOrganization(tx, ctx.organizationId);
    await lockPeriods(tx);
    const saved = await replay(tx, ctx, ctx.organizationId, "run_depreciation", p.idempotencyKey, fingerprint); if (saved) return saved;
    const rows = await tx.select({ id: fixedAsset.id }).from(fixedAsset).where(and(eq(fixedAsset.organizationId, ctx.organizationId), isNull(fixedAsset.deletedAt), eq(fixedAsset.status, "active"))).orderBy(asc(fixedAsset.id));
    const results = []; let skipped = 0;
    for (const row of rows) {
      const asset = await load(tx, ctx, row.id), prior = await history(tx, ctx, asset), bounds = period(date);
      if (asset.isCwip || asset.depreciationMethod === "units_of_production" || date < (asset.inServiceDate ?? asset.purchaseDate) ||
        prior.some(r => r.date >= bounds.start && r.date <= bounds.end) ||
        calculateMonthlyDepreciation({ ...asset, periodIndex: prior.length, periodDate: date }) === 0) { skipped++; continue; }
      const posted = await post(tx, ctx, asset, date, undefined, prior);
      await record(tx, ctx, row.id, "depreciate", undefined, fingerprint, posted, request);
      results.push({ assetId: asset.id, assetNumber: asset.assetNumber, amount: posted.depreciationEntry.amount, amountMinor: posted.depreciationEntry.amountMinor });
    }
    const result = { message: rows.length === 0 ? "No active assets to depreciate" : "Depreciation run complete", processed: results.length, skipped, results };
    await record(tx, ctx, ctx.organizationId, "run_depreciation", p.idempotencyKey, fingerprint, result, request); return result;
  });
}
export async function rollbackAssetDepreciation(ctx: AuthContext, id: string, input: unknown, request?: Request) {
  requireRole(ctx, "manage:assets"); assetMasterId.parse(id); const p = assetDepreciationRollbackSchema.parse(input), date = p.date ?? today();
  const key = p.idempotencyKey ?? (p.depreciationEntryId ? "entry:" + p.depreciationEntryId : "daily:" + date);
  const fingerprint = stringifyWire({ date: p.date ?? null, depreciationEntryId: p.depreciationEntryId ?? null });
  return db.transaction(async tx => {
    await lockTaxOrganization(tx, ctx.organizationId); const asset = await load(tx, ctx, id);
    await lockPeriods(tx);
    const saved = await replay(tx, ctx, id, "rollback_depreciation", key, fingerprint); if (saved) return saved;
    if (asset.isCwip || !["active", "fully_depreciated"].includes(asset.status)) throw new AuthError("Asset cannot be rolled back in its current state", 400);
    const prior = await history(tx, ctx, asset), target = prior[0];
    if (!target) throw new AuthError("No depreciation entries to roll back", 400);
    if (p.depreciationEntryId && target.id !== p.depreciationEntryId) throw new AuthError("Only the latest depreciation entry can be rolled back", 409);
    if (date < target.date) throw new AuthError("Reversal date cannot precede depreciation", 400);
    await assertNotLocked(ctx.organizationId, target.date, ctx, tx); await assertNotLocked(ctx.organizationId, date, ctx, tx);
    const accumulated = BigInt(asset.accumulatedDepreciation) - BigInt(target.amount);
    if (accumulated < 0n) throw new AuthError("Depreciation history exceeds saved accumulated total", 422);
    let reversalId: string | null = null;
    if (target.journalEntryId) {
      const [original] = await tx.select().from(journalEntry).where(and(eq(journalEntry.id, target.journalEntryId), eq(journalEntry.organizationId, ctx.organizationId))).for("update");
      if (!original || original.status !== "posted" || original.reversedByEntryId || original.sourceType !== "depreciation" || original.sourceId !== id)
        throw new AuthError("Original depreciation journal is foreign, unavailable or already reversed", 422);
      await assertNotLocked(ctx.organizationId, original.date, ctx, tx);
      const lines = await tx.select().from(journalLine).where(eq(journalLine.journalEntryId, original.id));
      let debit = 0n, credit = 0n;
      for (const line of lines) { assetMoneyDto(line, ["debitAmount", "creditAmount"]); debit += BigInt(line.debitAmount); credit += BigInt(line.creditAmount); }
      if (!lines.length || debit !== BigInt(target.amount) || credit !== debit) throw new AuthError("Original journal does not match depreciation", 422);
      await accounts(tx, ctx, lines.map(l => l.accountId), true);
      for (const line of lines) {
        if (line.costCenterId) {
          const [owned] = await tx.select({ id: costCenter.id }).from(costCenter).where(and(eq(costCenter.id, line.costCenterId), eq(costCenter.organizationId, ctx.organizationId)));
          if (!owned) throw new AuthError("Original cost center is outside the organization", 422);
        }
        if (line.projectId) {
          const [owned] = await tx.select({ id: project.id }).from(project).where(and(eq(project.id, line.projectId), eq(project.organizationId, ctx.organizationId)));
          if (!owned) throw new AuthError("Original project is outside the organization", 422);
        }
      }
      const [reversal] = await tx.insert(journalEntry).values({ organizationId: ctx.organizationId, entryNumber: await getNextEntryNumber(ctx.organizationId, tx),
        date, description: `Reverse depreciation - ${asset.name}`, reference: asset.assetNumber, sourceType: "depreciation_reversal", sourceId: id,
        reversesEntryId: original.id, status: "posted", postedAt: new Date(), createdBy: ctx.userId }).returning();
      reversalId = reversal.id;
      // Keep every original currency/FX and dimension field, including exact-rate provenance.
      const returned = await tx.insert(journalLine).values(lines.map(line => ({ accountId: line.accountId, description: `Reverse depreciation - ${asset.name}`,
        journalEntryId: reversal.id, debitAmount: line.creditAmount, creditAmount: line.debitAmount, currencyCode: line.currencyCode,
        exchangeRate: line.exchangeRate, rateExact: line.rateExact, rateFormatVersion: line.rateFormatVersion, rateDirection: line.rateDirection,
        rateMigrationStatus: line.rateMigrationStatus, rateProvenance: line.rateProvenance, costCenterId: line.costCenterId, projectId: line.projectId }))).returning();
      for (let i = 0; i < lines.length; i++) {
        const source = lines[i], saved = returned[i]; assetMoneyDto(saved, ["debitAmount", "creditAmount"]);
        if (saved.debitAmount !== source.creditAmount || saved.creditAmount !== source.debitAmount || saved.accountId !== source.accountId ||
          saved.currencyCode !== source.currencyCode || saved.exchangeRate !== source.exchangeRate || saved.costCenterId !== source.costCenterId || saved.projectId !== source.projectId ||
          (source.rateExact !== null && (saved.rateExact !== source.rateExact || saved.rateProvenance !== source.rateProvenance ||
            saved.rateDirection !== source.rateDirection || saved.rateFormatVersion !== source.rateFormatVersion || saved.rateMigrationStatus !== source.rateMigrationStatus)))
          throw new AuthError("Original journal snapshot cannot be preserved by the current FX consumer", 422);
      }
      await tx.update(journalEntry).set({ reversedByEntryId: reversal.id, updatedAt: new Date() }).where(eq(journalEntry.id, original.id));
    }
    await tx.delete(depreciationEntry).where(and(eq(depreciationEntry.id, target.id), eq(depreciationEntry.fixedAssetId, id)));
    const nbv = legacyMinor(BigInt(asset.purchasePrice) - accumulated);
    const [updated] = await tx.update(fixedAsset).set({ accumulatedDepreciation: legacyMinor(accumulated), netBookValue: nbv,
      status: nbv > asset.residualValue ? "active" : "fully_depreciated", updatedAt: new Date() }).where(scope(ctx, id)).returning();
    assetDto(updated);
    const result = { asset: totals(updated), rolledBack: assetMoneyDto({ id: target.id, date: target.date, amount: target.amount }, ["amount"]),
      voidedJournalEntryId: null, journalEntryId: reversalId, reversedDepreciationEntryId: target.id, reversedAmount: target.amount, reversedAmountMinor: String(target.amount) };
    await record(tx, ctx, id, "rollback_depreciation", key, fingerprint, result, request); return result;
  });
}
