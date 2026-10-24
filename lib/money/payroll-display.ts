import { currencyMetadata } from "./exact";
import type { NumberPresentation } from "../../i18n/numbers";
import { formatExactCurrencyDecimal } from "../../i18n/numbers";

/** Payroll retains its existing two-decimal cents contract until qualified unit migration. */
export function payrollMoneyDisplay(value: number | bigint | string, currency = "USD", presentation: NumberPresentation = { locale: "en-US", numerals: "latn" }) {
  if (typeof value === "number" && !Number.isSafeInteger(value)) throw new RangeError("Payroll display requires exact cents");
  if (typeof value === "string" && !/^(0|-?[1-9]\d*)$/.test(value)) throw new RangeError("Payroll cents must be canonical");
  const amount = BigInt(value), { code } = currencyMetadata(currency), abs = amount < 0n ? -amount : amount;
  const decimal = `${amount < 0n ? "-" : ""}${abs / 100n}.${(abs % 100n).toString().padStart(2, "0")}`;
  return formatExactCurrencyDecimal(decimal, code, presentation);
}
