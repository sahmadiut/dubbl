import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { fixedAsset, assetRevaluation, depreciationEntry, chartAccount, journalEntry, journalLine, auditLog, organization } from "@/lib/db/schema";
import { AuthError, type AuthContext } from "./auth-context";
import { requireRole } from "./require-role";
import { lockTaxOrganization, auditTax, type TaxTx } from "./tax-config-transaction";
import { assertNotLocked } from "./period-lock";
import { getNextEntryNumber, ensureAccountByCode } from "./journal-automation";
import { assetDto, assetMoneyDto, assetMasterId, assetDate } from "./asset-master-wire";
import { assetRevalueSchema, assetImpairSchema, assetDisposeSchema, valuationAmount, disposalAmount, valuationSplit } from "./asset-valuation-wire";
import { calculateMonthlyDepreciation } from "@/lib/fixed-assets/depreciation";
import { legacyMinor, stringifyWire } from "@/lib/money/wire";

type Asset = typeof fixedAsset.$inferSelect;
type Result = Record<string, unknown>;
const scope = (ctx: AuthContext, id: string) => and(eq(fixedAsset.organizationId, ctx.organizationId), eq(fixedAsset.id, id), isNull(fixedAsset.deletedAt));
export const revaluationDto = (row: typeof assetRevaluation.$inferSelect) => assetMoneyDto(row,
  ["previousCarryingAmount", "revaluedAmount", "changeAmount", "surplusAmount", "impairmentAmount"], ["changeAmount", "surplusAmount", "impairmentAmount"]);
const unsupported = (message: string): never => { throw new AuthError(message, 422); };

async function account(tx: TaxTx, ctx: AuthContext, id: string, currency: string, historical = false) {
  const [row] = await tx.select().from(chartAccount).where(and(eq(chartAccount.id, id), eq(chartAccount.organizationId, ctx.organizationId),
    historical ? undefined : isNull(chartAccount.deletedAt), historical ? undefined : eq(chartAccount.isActive, true))).for("share");
  if (!row || row.currencyCode !== currency) unsupported("Asset account must be organization-owned and use the base currency; new posting accounts must be live and active");
  return id;
}
async function defaultAccount(tx: TaxTx, ctx: AuthContext, currency: string, id: string | null | undefined,
  code: string, name: string, type: "asset" | "equity" | "revenue" | "expense") {
  const resolved = id ?? (await ensureAccountByCode(ctx.organizationId, { code, name, type }, currency, tx))?.id;
  if (!resolved) throw new AuthError("Cannot resolve asset posting account", 422);
  return account(tx, ctx, resolved, currency);
}
async function load(tx: TaxTx, ctx: AuthContext, id: string) {
  const [row] = await tx.select().from(fixedAsset).where(scope(ctx, id)).for("update");
  if (!row) throw new AuthError("Fixed asset not found", 404);
  assetDto(row);
  return row;
}
async function currency(tx: TaxTx, ctx: AuthContext) {
  const [org] = await tx.select({ currency: organization.defaultCurrency }).from(organization).where(eq(organization.id, ctx.organizationId));
  return org.currency;
}
/** Cost remains unchanged. Valuation changes adjust gross cost in the GL while
 * accumulated depreciation stays unchanged. Never infer or repair old history.
 * Depreciation after valuation remains unsupported until a new schedule contract.
 */
async function history(tx: TaxTx, ctx: AuthContext, asset: Asset, base: string) {
  const deps = await tx.select().from(depreciationEntry).where(eq(depreciationEntry.fixedAssetId, asset.id)).orderBy(asc(depreciationEntry.date), asc(depreciationEntry.createdAt), asc(depreciationEntry.id));
  const revs = await tx.select().from(assetRevaluation).where(eq(assetRevaluation.fixedAssetId, asset.id)).orderBy(asc(assetRevaluation.date), asc(assetRevaluation.createdAt), asc(assetRevaluation.id));
  let dep = 0n, surplus = 0n, pnl = 0n, carrying = BigInt(asset.purchasePrice) - BigInt(asset.accumulatedDepreciation);
  let latest = asset.inServiceDate ?? asset.purchaseDate;
  if (latest < asset.purchaseDate || carrying < 0n) unsupported("Unsupported saved asset dates or depreciation totals");
  const linked = new Map<string, { date: string; source: string; amount: bigint }>();
  const link = (id: string, date: string, source: string, amount: bigint) => {
    if (linked.has(id)) unsupported("Asset history reuses the same journal");
    linked.set(id, { date, source, amount });
  };
  for (const row of deps) {
    assetMoneyDto(row, ["amount"]);
    if (!assetDate.safeParse(row.date).success || row.date < latest) unsupported("Unsupported saved depreciation dates");
    latest = row.date; dep += BigInt(row.amount);
    if (row.journalEntryId) link(row.journalEntryId, row.date, "depreciation", BigInt(row.amount));
  }
  if (dep > BigInt(asset.accumulatedDepreciation)) unsupported("Depreciation history exceeds root total");
  if (!revs.length && BigInt(asset.residualValue) > carrying) unsupported("Residual exceeds remaining original-cost carrying base");
  for (const row of revs) {
    revaluationDto(row);
    if (!assetDate.safeParse(row.date).success || row.date < latest || BigInt(row.previousCarryingAmount) !== carrying)
      unsupported("Unsupported saved valuation chronology or carrying base");
    const change = BigInt(row.changeAmount), equity = BigInt(row.surplusAmount), loss = BigInt(row.impairmentAmount);
    if (BigInt(row.revaluedAmount) - carrying !== change || equity + loss !== change ||
      (row.isImpairment ? change >= 0n || equity > 0n || loss > 0n : change <= 0n || equity < 0n || loss < 0n))
      unsupported("Unsupported saved valuation signs or split; legacy inconsistent history requires explicit remediation");
    const expected = valuationSplit(row.previousCarryingAmount, row.revaluedAmount, surplus, pnl, row.isImpairment);
    if (expected.equity !== equity || expected.pnl !== loss) unsupported("Saved valuation split differs from available surplus/impairment balance");
    surplus += equity; pnl += loss;
    if (surplus < 0n || pnl > 0n) unsupported("Saved surplus or impairment reversal exceeds available balance");
    carrying = BigInt(row.revaluedAmount); latest = row.date;
    if (row.journalEntryId) link(row.journalEntryId, row.date, row.isImpairment ? "asset_impairment" : "asset_revaluation", change < 0n ? -change : change);
  }
  if (carrying !== BigInt(asset.netBookValue) || surplus !== BigInt(asset.revaluationSurplusBalance) ||
    (revs.length ? asset.revaluedAmount !== revs[revs.length - 1].revaluedAmount : asset.revaluedAmount !== null))
    unsupported("Saved root and valuation history disagree");
  const journals = await tx.select().from(journalEntry).where(and(eq(journalEntry.organizationId, ctx.organizationId), eq(journalEntry.sourceId, asset.id)));
  const owned = new Map(journals.map(r => [r.id, r]));
  for (const id of linked.keys()) if (!owned.has(id)) unsupported("Saved asset journal is outside the organization or asset");
  for (const entry of journals) {
    if (!assetDate.safeParse(entry.date).success) unsupported("Invalid saved journal date");
    if (entry.date > latest) latest = entry.date;
    if (entry.status !== "posted") unsupported("Asset journal is not posted");
    const lines = await tx.select().from(journalLine).where(eq(journalLine.journalEntryId, entry.id));
    let debit = 0n, credit = 0n;
    for (const line of lines) {
      assetMoneyDto(line, ["debitAmount", "creditAmount"]);
      if (line.currencyCode !== base || line.exchangeRate !== 1000000 || (line.rateExact !== null && line.rateExact !== "1"))
        unsupported("Asset journal currency/rate history differs from current base; repricing is unsupported");
      await account(tx, ctx, line.accountId, base, true);
      debit += BigInt(line.debitAmount); credit += BigInt(line.creditAmount);
    }
    if (!lines.length || debit !== credit) unsupported("Saved asset journal is empty or unbalanced");
    const expected = linked.get(entry.id);
    if (expected && (entry.date !== expected.date || entry.sourceType !== expected.source || debit !== expected.amount || entry.reversedByEntryId))
      unsupported("Saved asset journal does not match its history row");
  }
  return { deps, revs, surplus, pnl, latest, carrying };
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
function postingState(asset: Asset, date: string, latest: string) {
  if (asset.isCwip || !["active", "fully_depreciated"].includes(asset.status)) throw new AuthError("Asset must be capitalized and not disposed", 400);
  if (date < (asset.inServiceDate ?? asset.purchaseDate)) throw new AuthError("Posting date precedes in-service date", 400);
  if (date < latest) throw new AuthError("Posting date precedes saved asset history", 409);
}
type Leg = { accountId: string; debitAmount: number; creditAmount: number };
async function journal(tx: TaxTx, ctx: AuthContext, asset: Asset, date: string, base: string, sourceType: string, legs: Leg[]) {
  legs = legs.filter(l => l.debitAmount || l.creditAmount);
  if (!legs.length) return null;
  if (new Set(legs.map(l => l.accountId)).size !== legs.length) unsupported("Posting accounts for distinct legs must differ");
  let debit = 0n, credit = 0n;
  for (const leg of legs) { assetMoneyDto(leg, ["debitAmount", "creditAmount"]); debit += BigInt(leg.debitAmount); credit += BigInt(leg.creditAmount); }
  if (debit !== credit) unsupported("Asset posting does not balance");
  const [entry] = await tx.insert(journalEntry).values({ organizationId: ctx.organizationId, entryNumber: await getNextEntryNumber(ctx.organizationId, tx),
    date, description: `${sourceType} - ${asset.name} (${asset.assetNumber})`, reference: asset.assetNumber, sourceType, sourceId: asset.id,
    status: "posted", postedAt: new Date(), createdBy: ctx.userId }).returning();
  const returned = await tx.insert(journalLine).values(legs.map(l => ({ ...l, journalEntryId: entry.id, currencyCode: base, exchangeRate: 1000000,
    rateExact: "1", rateDirection: "quote_per_base", rateFormatVersion: 1, rateMigrationStatus: "exact" }))).returning();
  for (let i = 0; i < legs.length; i++) {
    const saved = returned[i], leg = legs[i]; assetMoneyDto(saved, ["debitAmount", "creditAmount"]);
    if (saved.accountId !== leg.accountId || saved.debitAmount !== leg.debitAmount || saved.creditAmount !== leg.creditAmount ||
      saved.currencyCode !== base || saved.exchangeRate !== 1000000 || saved.rateExact !== "1" || saved.rateDirection !== "quote_per_base")
      unsupported("Saved journal differs from exact posting");
  }
  return entry.id;
}
async function valueAsset(ctx: AuthContext, id: string, input: unknown, impairment: boolean, request?: Request) {
  requireRole(ctx, "manage:assets"); assetMasterId.parse(id);
  const p = (impairment ? assetImpairSchema : assetRevalueSchema).parse(input), target = valuationAmount(p);
  const fingerprint = stringifyWire({ target, date: p.date, notes: p.notes ?? null, reserve: p.revaluationReserveAccountId ?? null, expense: p.impairmentExpenseAccountId ?? null });
  const action = impairment ? "impair" : "revalue";
  return db.transaction(async tx => {
    await lockTaxOrganization(tx, ctx.organizationId); const asset = await load(tx, ctx, id);
    const saved = await replay(tx, ctx, id, action, p.idempotencyKey, fingerprint); if (saved) return saved;
    postingState(asset, p.date, asset.inServiceDate ?? asset.purchaseDate);
    await tx.execute(sql`lock table period_lock, fiscal_year in share mode`);
    const base = await currency(tx, ctx), h = await history(tx, ctx, asset, base);
    postingState(asset, p.date, h.latest); await assertNotLocked(ctx.organizationId, p.date, ctx, tx);
    let split: ReturnType<typeof valuationSplit>;
    try { split = valuationSplit(asset.netBookValue, target, h.surplus, h.pnl, impairment); }
    catch (e) { throw new AuthError((e as Error).message, 400); }
    const changeAmount = legacyMinor(split.change), surplusAmount = legacyMinor(split.equity), impairmentAmount = legacyMinor(split.pnl);
    const surplusBalance = legacyMinor(h.surplus + split.equity);
    // Validate even unused explicit/saved overrides, so foreign IDs cannot be persisted.
    for (const accountId of new Set([asset.assetAccountId, asset.revaluationReserveAccountId, asset.impairmentExpenseAccountId,
      p.revaluationReserveAccountId, p.impairmentExpenseAccountId].filter((v): v is string => !!v))) await account(tx, ctx, accountId, base);
    let reserve = p.revaluationReserveAccountId ?? asset.revaluationReserveAccountId, expense = p.impairmentExpenseAccountId ?? asset.impairmentExpenseAccountId;
    let journalEntryId: string | null = null;
    if (asset.assetAccountId) {
      if (split.equity) reserve = await defaultAccount(tx, ctx, base, reserve, "3400", "Revaluation Surplus", "equity");
      if (split.pnl) expense = await defaultAccount(tx, ctx, base, expense, "5510", "Impairment Loss", "expense");
      const leg = (accountId: string, signed: bigint): Leg => ({ accountId, debitAmount: signed < 0n ? legacyMinor(-signed) : 0, creditAmount: signed > 0n ? legacyMinor(signed) : 0 });
      const legs: Leg[] = [{ accountId: asset.assetAccountId, debitAmount: split.change > 0n ? changeAmount : 0, creditAmount: split.change < 0n ? -changeAmount : 0 }];
      if (split.equity) legs.push(leg(reserve!, split.equity));
      if (split.pnl) legs.push(leg(expense!, split.pnl));
      journalEntryId = await journal(tx, ctx, asset, p.date, base, impairment ? "asset_impairment" : "asset_revaluation", legs);
    }
    const [rev] = await tx.insert(assetRevaluation).values({ fixedAssetId: id, date: p.date, previousCarryingAmount: asset.netBookValue,
      revaluedAmount: target, changeAmount, surplusAmount, impairmentAmount, isImpairment: impairment, notes: p.notes ?? null, journalEntryId,
      // Transaction-start default timestamps can sort concurrent same-day writes
      // in the wrong order after waiting for locks. Preserve a strict history order.
      createdAt: new Date(h.revs.reduce((latest, r) => Math.max(latest, r.createdAt.getTime() + 1), Date.now())) }).returning();
    const [updated] = await tx.update(fixedAsset).set({ revaluedAmount: target, netBookValue: target, revaluationSurplusBalance: surplusBalance,
      revaluationReserveAccountId: reserve, impairmentExpenseAccountId: expense, updatedAt: new Date() }).where(scope(ctx, id)).returning();
    const result = { revaluation: revaluationDto(rev), asset: assetDto(updated), journalEntryId };
    await record(tx, ctx, id, action, p.idempotencyKey, fingerprint, result, request); return result;
  });
}
export const revalueAsset = (ctx: AuthContext, id: string, input: unknown, request?: Request) => valueAsset(ctx, id, input, false, request);
export const impairAsset = (ctx: AuthContext, id: string, input: unknown, request?: Request) => valueAsset(ctx, id, input, true, request);

export async function disposeAsset(ctx: AuthContext, id: string, input: unknown, request?: Request) {
  requireRole(ctx, "manage:assets"); assetMasterId.parse(id); const p = assetDisposeSchema.parse(input), proceeds = disposalAmount(p);
  const fingerprint = stringifyWire({ proceeds, date: p.date, proceedsAccount: p.proceedsAccountId ?? null, gainAccount: p.gainAccountId ?? null, lossAccount: p.lossAccountId ?? null });
  // A stable default fingerprint makes identical unkeyed disposals replay safely.
  const key = p.idempotencyKey ?? "disposal";
  return db.transaction(async tx => {
    await lockTaxOrganization(tx, ctx.organizationId); const asset = await load(tx, ctx, id);
    const saved = await replay(tx, ctx, id, "dispose", key, fingerprint); if (saved) return saved;
    postingState(asset, p.date, asset.inServiceDate ?? asset.purchaseDate);
    await tx.execute(sql`lock table period_lock, fiscal_year in share mode`);
    const base = await currency(tx, ctx), h = await history(tx, ctx, asset, base);
    postingState(asset, p.date, h.latest); await assertNotLocked(ctx.organizationId, p.date, ctx, tx);
    for (const accountId of new Set([asset.assetAccountId, asset.accumulatedDepAccountId, asset.depreciationAccountId, asset.revaluationReserveAccountId,
      p.proceedsAccountId, p.gainAccountId, p.lossAccountId].filter((v): v is string => !!v))) await account(tx, ctx, accountId, base);
    const gl = !!asset.assetAccountId;
    if (!gl && (asset.accumulatedDepAccountId || asset.depreciationAccountId)) unsupported("Disposal requires an asset account when depreciation accounts are configured");
    if (gl && asset.accumulatedDepreciation > 0 && !asset.accumulatedDepAccountId) unsupported("Accumulated depreciation account is required to remove its balance");
    // One unbooked monthly charge only; never double-charge the same month.
    // Revalued schedules and usage readings have no implicit catch-up policy.
    let catchUp = 0;
    if (!h.revs.length && asset.status === "active" && asset.depreciationMethod !== "units_of_production" &&
      !h.deps.some(d => d.date.slice(0, 7) === p.date.slice(0, 7))) {
      if (gl && Boolean(asset.depreciationAccountId) !== Boolean(asset.accumulatedDepAccountId)) unsupported("Configure both depreciation accounts or neither");
      if (!gl || (asset.depreciationAccountId && asset.accumulatedDepAccountId))
        catchUp = calculateMonthlyDepreciation({ ...asset, periodIndex: h.deps.length, periodDate: p.date });
    }
    const accumulated = legacyMinor(BigInt(asset.accumulatedDepreciation) + BigInt(catchUp));
    const nbv = legacyMinor(h.carrying - BigInt(catchUp)), gain = legacyMinor(BigInt(proceeds) - BigInt(nbv));
    // GL gross = current carrying + accumulated, including signed valuation deltas.
    const gross = legacyMinor(h.carrying + BigInt(asset.accumulatedDepreciation));
    let catchUpJournalEntryId: string | null = null, journalEntryId: string | null = null, surplusJournalEntryId: string | null = null;
    if (catchUp) {
      if (gl) catchUpJournalEntryId = await journal(tx, ctx, asset, p.date, base, "depreciation", [
        { accountId: asset.depreciationAccountId!, debitAmount: catchUp, creditAmount: 0 },
        { accountId: asset.accumulatedDepAccountId!, debitAmount: 0, creditAmount: catchUp }]);
      const [dep] = await tx.insert(depreciationEntry).values({ fixedAssetId: id, date: p.date, amount: catchUp, journalEntryId: catchUpJournalEntryId }).returning();
      assetMoneyDto(dep, ["amount"]);
    }
    if (gl) {
      const legs: Leg[] = [];
      if (gross) legs.push({ accountId: asset.assetAccountId!, debitAmount: 0, creditAmount: gross });
      if (accumulated) legs.push({ accountId: asset.accumulatedDepAccountId!, debitAmount: accumulated, creditAmount: 0 });
      if (proceeds) legs.push({ accountId: await defaultAccount(tx, ctx, base, p.proceedsAccountId, "1250", "Undeposited Funds", "asset"), debitAmount: proceeds, creditAmount: 0 });
      if (gain > 0) legs.push({ accountId: await defaultAccount(tx, ctx, base, p.gainAccountId, "4300", "Gain on Asset Disposal", "revenue"), debitAmount: 0, creditAmount: gain });
      if (gain < 0) legs.push({ accountId: await defaultAccount(tx, ctx, base, p.lossAccountId, "5920", "Loss on Asset Disposal", "expense"), debitAmount: -gain, creditAmount: 0 });
      journalEntryId = await journal(tx, ctx, asset, p.date, base, "disposal", legs);
      if (h.surplus) {
        const reserve = await defaultAccount(tx, ctx, base, asset.revaluationReserveAccountId, "3400", "Revaluation Surplus", "equity");
        const retained = await defaultAccount(tx, ctx, base, null, "3100", "Retained Earnings", "equity");
        const amount = legacyMinor(h.surplus);
        surplusJournalEntryId = await journal(tx, ctx, asset, p.date, base, "disposal_revaluation_transfer", [
          { accountId: reserve, debitAmount: amount, creditAmount: 0 }, { accountId: retained, debitAmount: 0, creditAmount: amount }]);
      }
    }
    const [updated] = await tx.update(fixedAsset).set({ status: "disposed", disposalDate: p.date, disposalAmount: proceeds,
      accumulatedDepreciation: accumulated, netBookValue: 0, revaluationSurplusBalance: 0, updatedAt: new Date() }).where(scope(ctx, id)).returning();
    const result = { asset: assetDto(updated), gainOrLoss: gain, gainOrLossMinor: String(gain), catchUpAmount: catchUp, catchUpAmountMinor: String(catchUp),
      netBookValueAtDisposal: nbv, netBookValueAtDisposalMinor: String(nbv), journalEntryId, catchUpJournalEntryId, surplusJournalEntryId };
    await record(tx, ctx, id, "dispose", key, fingerprint, result, request); return result;
  });
}
