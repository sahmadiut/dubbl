import { parseMajor } from "./exact";

/** Asset masters retain their historical fixed two-decimal cents input contract. */
export function assetCentsInput(value: string) {
  if (value.length > 256 || !/^\d+(?:\.\d{1,2})?$/.test(value)) throw new RangeError("Enter a nonnegative amount with at most two decimal places");
  const amount = parseMajor(value, "USD", "reject").amountMinor;
  if (amount < 0n || amount > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError("Enter a nonnegative amount with at most two decimal places within the supported range");
  return String(amount);
}
export function assetLifeInput(value: string) {
  if (!/^[1-9]\d{0,9}$/.test(value) || Number(value) > 2147483647) throw new RangeError("Enter a whole useful life in months from 1 to 2147483647");
  return Number(value);
}
export function assetRateInput(value: string) {
  const bp = assetCentsInput(value);
  if (BigInt(bp) > 100000n) throw new RangeError("Enter a depreciation rate from 0% to 1000% with at most two decimal places");
  return Number(bp);
}
export function assetCentsDecimal(value: number | bigint | string) {
  if (typeof value === "number" && !Number.isSafeInteger(value)) throw new RangeError("Asset amount requires exact cents");
  if (typeof value === "string" && !/^(0|-?[1-9]\d*)$/.test(value)) throw new RangeError("Asset cents must be canonical");
  const amount = BigInt(value), abs = amount < 0n ? -amount : amount;
  return `${amount < 0n ? "-" : ""}${abs / 100n}.${(abs % 100n).toString().padStart(2, "0")}`;
}
export function assetMoneyDisplay(value: number | bigint | string) {
  const decimal = assetCentsDecimal(value), [whole, fraction] = decimal.split(".");
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .formatToParts(whole === "-0" ? -0 : BigInt(whole)).map(p => p.type === "fraction" ? fraction : p.value).join("");
}
/** Presentation percentage only; bigint sums stay exact before conversion. */
export function assetPercent(part: number | bigint, total: number | bigint) {
  const p = BigInt(part), t = BigInt(total);
  if (t <= 0n) return 0;
  const bp = p * 10000n / t;
  return Number(bp > 10000n ? 10000n : bp < 0n ? 0n : bp) / 100;
}
