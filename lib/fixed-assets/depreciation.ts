/** Exact integer-cents depreciation; positive ties round upward. */
import { legacyMinor } from "@/lib/money/wire";
import { assetDate } from "@/lib/api/asset-master-wire";

export type DepreciationMethod = "straight_line" | "declining_balance" | "units_of_production" | "sum_of_years_digits";
export type DepreciationConvention = "full_month" | "mid_month" | "half_year" | "mid_quarter" | "pro_rata_days" | "full_at_purchase";
const integer = (n: number) => {
  if (!Number.isSafeInteger(n) || n < 0 || Object.is(n, -0)) throw new RangeError("Use nonnegative safe integers for depreciation");
  return BigInt(n);
};
const rounded = (n: bigint, d: bigint) => (n + d / 2n) / d;
const min = (a: bigint, b: bigint) => a < b ? a : b;

export function applyConvention(amount: number, convention: DepreciationConvention, periodIndex: number,
  inServiceDate: string | null | undefined, periodDate: string | null | undefined, isFinal: boolean): number {
  const cents = integer(amount); integer(periodIndex);
  if (inServiceDate) assetDate.parse(inServiceDate);
  if (periodDate) assetDate.parse(periodDate);
  // The closing charge clears the remaining base; do not halve it again.
  if (isFinal || periodIndex !== 0) return amount;
  switch (convention) {
    case "full_month": case "full_at_purchase": return amount;
    // Retain the existing monthly approximation for half-year/mid-quarter.
    case "mid_month": case "half_year": case "mid_quarter": return legacyMinor(rounded(cents, 2n));
    case "pro_rata_days": {
      if (!inServiceDate) return amount;
      const date = new Date(inServiceDate + "T00:00:00Z");
      const end = new Date(date); end.setUTCMonth(end.getUTCMonth() + 1, 0);
      const days = BigInt(end.getUTCDate());
      return legacyMinor(rounded(cents * (days - BigInt(date.getUTCDate()) + 1n), days));
    }
    default: throw new RangeError("Unknown depreciation convention");
  }
}

/** periodIndex is the number of existing charges, never accumulated/monthly. */
export function calculateDepreciation(method: string, purchasePrice: number, residualValue: number,
  usefulLifeMonths: number, periodIndex: number, accumulated = 0,
  opts?: { unitsThisPeriod?: number; totalExpectedUnits?: number }): number {
  const cost = integer(purchasePrice), residual = integer(residualValue), booked = integer(accumulated);
  const life = integer(usefulLifeMonths), index = integer(periodIndex);
  if (residual + booked > cost) throw new RangeError("Asset residual plus depreciation exceeds cost");
  const base = cost - residual, remaining = base - booked;
  if (remaining === 0n) return 0;
  let charge: bigint;
  if (method === "units_of_production") {
    const units = integer(opts?.unitsThisPeriod ?? 0), total = integer(opts?.totalExpectedUnits ?? 0);
    if (units === 0n || total === 0n) return 0;
    charge = rounded(base * units, total);
  } else {
    if (life === 0n || index >= life) return 0;
    if (index === life - 1n) return legacyMinor(remaining);
    switch (method) {
      case "straight_line": charge = rounded(base, life); break;
      case "declining_balance": charge = rounded((cost - booked) * 2n, life); break;
      case "sum_of_years_digits": charge = rounded(base * (life - index), life * (life + 1n) / 2n); break;
      default: throw new RangeError("Unknown depreciation method");
    }
  }
  return legacyMinor(min(charge, remaining));
}

export function calculateMonthlyDepreciation(asset: {
  purchasePrice: number; residualValue: number; usefulLifeMonths: number; depreciationMethod: string;
  accumulatedDepreciation: number; purchaseDate: string; periodIndex: number; convention?: string;
  inServiceDate?: string | null; totalExpectedUnits?: number | null; unitsThisPeriod?: number | null; periodDate?: string | null;
}): number {
  assetDate.parse(asset.purchaseDate);
  const anchor = asset.inServiceDate ?? asset.purchaseDate; assetDate.parse(anchor);
  if (asset.periodDate) {
    assetDate.parse(asset.periodDate);
    if (asset.periodDate < anchor) return 0;
  }
  const remaining = integer(asset.purchasePrice) - integer(asset.residualValue) - integer(asset.accumulatedDepreciation);
  if (remaining < 0n) throw new RangeError("Asset residual plus depreciation exceeds cost");
  if (asset.convention === "full_at_purchase" && asset.depreciationMethod !== "units_of_production") return legacyMinor(remaining);
  const raw = calculateDepreciation(asset.depreciationMethod, asset.purchasePrice, asset.residualValue,
    asset.usefulLifeMonths, asset.periodIndex, asset.accumulatedDepreciation,
    { unitsThisPeriod: asset.unitsThisPeriod ?? 0, totalExpectedUnits: asset.totalExpectedUnits ?? 0 });
  if (raw === 0 || asset.depreciationMethod === "units_of_production") return raw;
  return applyConvention(raw, (asset.convention ?? "full_month") as DepreciationConvention,
    asset.periodIndex, anchor, asset.periodDate, asset.periodIndex === asset.usefulLifeMonths - 1);
}
