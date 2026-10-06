import { currencyMetadata } from "./exact";

/** Payroll retains its existing two-decimal cents contract until qualified unit migration. */
export function payrollMoneyDisplay(value: number | bigint | string, currency = "USD") {
  if (typeof value === "number" && !Number.isSafeInteger(value)) throw new RangeError("Payroll display requires exact cents");
  if (typeof value === "string" && !/^(0|-?[1-9]\d*)$/.test(value)) throw new RangeError("Payroll cents must be canonical");
  const amount = BigInt(value), { code } = currencyMetadata(currency), abs = amount < 0n ? -amount : amount;
  const whole = amount / 100n, fraction = (abs % 100n).toString().padStart(2, "0");
  return new Intl.NumberFormat("en-US", { style: "currency", currency: code, minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .formatToParts(amount < 0n && whole === 0n ? -0 : whole).map(p => p.type === "fraction" ? fraction : p.value).join("");
}
