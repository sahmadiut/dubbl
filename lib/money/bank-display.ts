import { currencyMetadata, money, toMajorDecimal } from "./exact";

/** Exact signed English display for adopted bank statements; locale rollout is separate. */
export function bankMoneyDisplay(value: number | bigint, currency: string) {
  if (typeof value === "number" && !Number.isSafeInteger(value)) throw new RangeError("Bank money must be a safe integer or bigint minor amount");
  const amount = BigInt(value), { code, minorUnits } = currencyMetadata(currency), scale = 10n ** BigInt(minorUnits);
  const fraction = toMajorDecimal(money(amount < 0n ? -amount : amount, code)).split(".")[1];
  const whole = amount / scale;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: code, minimumFractionDigits: minorUnits, maximumFractionDigits: minorUnits })
    .formatToParts(amount < 0n && whole === 0n ? -0 : whole).map(part => part.type === "fraction" ? fraction : part.value).join("");
}
