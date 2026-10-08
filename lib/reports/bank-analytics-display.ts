import { currencyMetadata } from "@/lib/money/exact";

/** Display-only totals can exceed a single stored int64 amount across many accounts. */
export function bankTotalDecimal(total: bigint, currency: string) {
  const scale = currencyMetadata(currency).minorUnits;
  const value = total < 0n ? -total : total;
  const factor = 10n ** BigInt(scale);
  return `${total < 0n ? "-" : ""}${value / factor}${scale ? `.${(value % factor).toString().padStart(scale, "0")}` : ""}`;
}
