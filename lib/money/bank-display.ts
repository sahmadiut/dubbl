import { formatExactMoney, type NumberPresentation } from "../../i18n/numbers";

/** Exact signed display. Existing callers retain English until they pass presentation. */
export function bankMoneyDisplay(value: number | bigint, currency: string,
  presentation: NumberPresentation = { locale: "en-US", numerals: "latn" }) {
  if (typeof value === "number" && !Number.isSafeInteger(value)) throw new RangeError("Bank money must be a safe integer or bigint minor amount");
  return formatExactMoney(BigInt(value), currency, presentation);
}
