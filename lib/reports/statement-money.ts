import { checkedMinor, currencyMetadata, money, toMajorDecimal } from "@/lib/money/exact";
import { WireCompatibilityError } from "@/lib/money/wire";
import { reportStoredMinor } from "./statement-wire";
import { formatExactMoney, type NumberPresentation } from "@/i18n/numbers";

function exportAmount(value: number | bigint, currency: string) {
  const amount = typeof value === "bigint" ? checkedMinor(value) : reportStoredMinor(value);
  try { return money(amount, currency); }
  catch { throw new WireCompatibilityError("Unsupported statement currency or amount"); }
}

/** Numeric XLSX cells require both decimal round-trip and Excel's 15-digit precision. */
export function statementCellNumber(value: number | bigint, currency: string): number {
  const amount = exportAmount(value, currency);
  const decimal = toMajorDecimal(amount);
  const significant = (amount.amountMinor < 0n ? -amount.amountMinor : amount.amountMinor).toString().replace(/0+$/, "");
  const numeric = Number(decimal);
  if (significant.length > 15 || numeric.toFixed(currencyMetadata(currency).minorUnits) !== decimal) {
    throw new WireCompatibilityError("Statement amount cannot be represented exactly by a numeric spreadsheet cell");
  }
  return numeric;
}

/** Format the integer and fractional parts separately, retaining every stored minor unit. */
export function statementMoneyText(value: number | bigint, currency: string, presentation?: NumberPresentation): string {
  const amount = exportAmount(value, currency);
  if (presentation) return formatExactMoney(amount.amountMinor, currency, presentation);
  const [whole, fraction] = toMajorDecimal(amount).split(".");
  const scale = currencyMetadata(currency).minorUnits;
  return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: scale, maximumFractionDigits: scale })
    .formatToParts(whole === "-0" ? -0 : BigInt(whole)).map(part => part.type === "fraction" ? fraction : part.value).join("");
}
