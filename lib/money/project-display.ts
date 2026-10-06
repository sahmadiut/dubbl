import { assetCentsInput, assetCentsDecimal } from "./asset-display";
export const projectCentsInput = assetCentsInput;
export const projectCentsDecimal = assetCentsDecimal;
/** Existing project fields are fixed cents, independently of the saved ISO label. */
export function projectMoneyDisplay(value: number | bigint | string, currency = "USD") {
  const [whole, fraction] = assetCentsDecimal(value).split(".");
  return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .formatToParts(whole === "-0" ? -0 : BigInt(whole)).map(p => p.type === "fraction" ? fraction : p.value).join("");
}
export function projectTimeCents(minutes: number, hourlyRate: number) {
  if (!Number.isSafeInteger(minutes) || minutes < 0 || !Number.isSafeInteger(hourlyRate) || hourlyRate < 0) throw new RangeError("Exact project time and cents required");
  return (BigInt(minutes) * BigInt(hourlyRate) + 30n) / 60n;
}
export function projectHoursInput(value: string) {
  if (value.length > 32 || !/^\d+(?:\.\d{1,9})?$/.test(value)) throw new RangeError("Enter nonnegative decimal hours");
  const [whole, fraction = ""] = value.split("."), scale = 10n ** BigInt(fraction.length);
  const units = BigInt(whole) * scale + BigInt(fraction || "0");
  const minutes = (units * 60n * 2n + scale) / (scale * 2n);
  if (minutes > 2147483647n) throw new RangeError("Whole minutes must fit int32");
  return Number(minutes);
}
export function projectWholeMinutes(value: string) {
  if (!/^(0|[1-9]\d{0,9})$/.test(value) || Number(value) > 2147483647) throw new RangeError("Enter whole minutes through 2147483647");
  return Number(value);
}
/** Nine decimal places round-trip every supported whole-minute value. */
export function projectHoursDecimal(minutes: number) {
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 2147483647) throw new RangeError("Whole int32 minutes required");
  const value = BigInt(minutes), fraction = ((value % 60n) * 1000000000n / 60n).toString().padStart(9, "0").replace(/0+$/, "");
  return `${value / 60n}${fraction ? `.${fraction}` : ""}`;
}
export function projectPercent(part: number | bigint, total: number | bigint) {
  const p = BigInt(part), t = BigInt(total);
  return t > 0n ? Number((p * 200n + t) / (t * 2n)) : 0;
}
