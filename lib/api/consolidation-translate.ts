import { and, desc, eq, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { consolidationRate } from "@/lib/db/schema";
import { MissingExchangeRateError } from "@/lib/currency/converter";
import { createHistoricalRateResolver } from "@/lib/currency/historical-rate";
import { exactRate, fromLegacyRate } from "@/lib/currency/exact-rate";
import { roundRatio } from "@/lib/money/exact";
import { rateDto, WireCompatibilityError } from "@/lib/money/wire";
import { savedConsolidationCurrency } from "./consolidation-config-wire";

export type RateType = "closing" | "average" | "historical";
export interface TranslateGroupInfo { id: string; parentOrgId: string; presentationCurrency: string }
export function classifyRate(accountType: string): RateType {
  return accountType === "revenue" || accountType === "expense" ? "average" : accountType === "equity" ? "historical" : "closing";
}

/** Exact integer v1 Math.round: negative ties toward +infinity.
 * Fixed cents stay fixed cents, including JPY/KWD/IRR; no currency rescale. */
export function roundConsolidationRatio(numerator: bigint, denominator: bigint): bigint {
  return roundRatio(numerator * BigInt(2) + denominator, denominator * BigInt(2), "floor");
}
export function translateConsolidationCents(amount: bigint, rate: string): bigint {
  const [whole, fraction = ""] = exactRate(rate).split(".");
  return roundConsolidationRatio(amount * BigInt(whole + fraction), BigInt(10) ** BigInt(fraction.length));
}

export class RateResolver {
  private cache = new Map<string, Awaited<ReturnType<RateResolver["resolve"]>>>();
  private fallback;
  constructor(private group: TranslateGroupInfo, private periodEnd: string, private database: Pick<typeof db, "query"> = db) {
    this.fallback = createHistoricalRateResolver(group.parentOrgId, database);
  }
  private async resolve(currency: string, rateType: RateType) {
    savedConsolidationCurrency(currency); savedConsolidationCurrency(this.group.presentationCurrency);
    const common = { baseCurrency: currency, quoteCurrency: this.group.presentationCurrency, rateType };
    if (currency === this.group.presentationCurrency) return { ...common, ...rateDto("1"), effectiveDate: this.periodEnd, source: "same", inverse: false };
    const stored = await this.database.query.consolidationRate.findFirst({
      where: and(eq(consolidationRate.groupId, this.group.id), eq(consolidationRate.currencyCode, currency),
        eq(consolidationRate.rateType, rateType), lte(consolidationRate.periodEndDate, this.periodEnd)),
      orderBy: [desc(consolidationRate.periodEndDate), desc(consolidationRate.updatedAt), desc(consolidationRate.id)],
    });
    if (stored) {
      let dto;
      try {
        if (stored.rateDirection !== "quote_per_base" || stored.rateFormatVersion !== 1) throw new Error("Unsupported FX format");
        if (stored.rateMigrationStatus === "pending" && stored.rateExact === null) dto = rateDto(fromLegacyRate(stored.rate));
        else if (stored.rateMigrationStatus === "exact" && stored.rateExact) {
          dto = rateDto(stored.rateExact);
          if (dto.rate !== stored.rate) throw new Error("Conflicting FX aliases");
        } else throw new Error("Unqualified saved FX rate");
      } catch { throw new WireCompatibilityError("Saved consolidation rate cannot be represented safely or requires remediation"); }
      return { ...common, ...dto, effectiveDate: stored.periodEndDate, source: stored.source, inverse: false };
    }
    const fallback = await this.fallback(currency, this.group.presentationCurrency, this.periodEnd);
    if (!fallback) throw new MissingExchangeRateError(currency, this.group.presentationCurrency, this.periodEnd);
    const dto = rateDto(fallback.rateExact);
    if (dto.rate !== fallback.rate) throw new WireCompatibilityError("Conflicting saved exchange-rate aliases");
    return { ...common, ...dto, effectiveDate: fallback.effectiveDate, source: fallback.source, inverse: fallback.inverse };
  }
  async rate(currency: string, rateType: RateType) {
    const key = `${currency}:${rateType}`;
    if (!this.cache.has(key)) this.cache.set(key, await this.resolve(currency, rateType));
    return this.cache.get(key)!;
  }
  async translate(amount: bigint, currency: string, accountType: string) {
    return this.translateAt(amount, currency, classifyRate(accountType));
  }
  async translateAt(amount: bigint, currency: string, rateType: RateType) {
    return translateConsolidationCents(amount, (await this.rate(currency, rateType)).rateExact);
  }
  usedRates() { return [...this.cache.values()].sort((a, b) => a.baseCurrency.localeCompare(b.baseCurrency) || a.rateType.localeCompare(b.rateType)); }
}
export function naturalBalance(accountType: string, totalDebit: bigint, totalCredit: bigint): bigint {
  return accountType === "asset" || accountType === "expense" ? totalDebit - totalCredit : totalCredit - totalDebit;
}
export function computeCta(input: { translatedAssets: bigint; translatedLiabilities: bigint; translatedEquity: bigint; translatedNetIncome: bigint }): bigint {
  return input.translatedAssets - input.translatedLiabilities - input.translatedEquity - input.translatedNetIncome;
}
export function memberFunctionalCurrency(member: string | null | undefined, org: string | null | undefined, presentation: string): string {
  return savedConsolidationCurrency(member || org || presentation);
}
