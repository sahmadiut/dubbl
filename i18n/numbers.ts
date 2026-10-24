import type { Presentation } from "./locale";
import { currencyMetadata, money, toMajorDecimal } from "../lib/money/exact";
import { normalizeLocalizedDecimal, type DecimalSeparators } from "../lib/money/localized";
import { currencyLabel, currencyPartsText } from "./currency-labels";

export type NumberPresentation = Pick<Presentation, "locale" | "numerals">;

function numberFormat(presentation: NumberPresentation, options: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat(presentation.locale, { ...options, numberingSystem: presentation.numerals });
}

function localizeDigits(value: string, presentation: NumberPresentation) {
  const digits = presentation.numerals === "arabext" ? "۰۱۲۳۴۵۶۷۸۹" : "0123456789";
  return value.replace(/[0-9]/g, digit => digits[Number(digit)]);
}

/** Separator policy follows the selected numeral system, independently of currency. */
export function decimalSeparatorsFor(presentation: NumberPresentation): DecimalSeparators {
  return presentation.numerals === "arabext" ? "arabic" : "ascii";
}

/**
 * Format a canonical exact decimal without converting its magnitude to Number.
 * Fractional zeros and digits are retained; grouping/sign/currency placement come
 * from Intl. The only Number passed for an amount is -0 for negative subunits.
 */
function formatDecimal(value: string, presentation: NumberPresentation, currency?: string, useGrouping = true) {
  if (typeof value !== "string" || value.length > 256 || !/^-?\d+(?:\.\d+)?$/.test(value)) {
    throw new TypeError("Expected an exact canonical decimal of at most 256 characters");
  }
  const [integer, fraction] = value.split(".");
  const whole = BigInt(integer);
  const parts = numberFormat(presentation, {
    ...(currency ? { style: "currency", currency } : {}),
    useGrouping, minimumFractionDigits: fraction === undefined ? 0 : 1,
    maximumFractionDigits: fraction === undefined ? 0 : 1,
  }).formatToParts(value.startsWith("-") && whole === 0n ? -0 : whole);
  const exactParts = parts.map(part => part.type === "fraction" ? { ...part, value: localizeDigits(fraction!, presentation) } : part);
  return currency ? currencyPartsText(exactParts, currency, presentation.locale) : exactParts.map(part => part.value).join("");
}

export function formatExactDecimal(value: string, presentation: NumberPresentation, useGrouping = true) {
  return formatDecimal(value, presentation, undefined, useGrouping);
}

/** Explicit legacy decimal scale: display its unit without reinterpreting stored minor units. */
export function formatExactCurrencyDecimal(value: string, currency: string, presentation: NumberPresentation) {
  return formatDecimal(value, presentation, currencyMetadata(currency).code);
}

/** Integer minor units with explicit ISO currency scale; never reinterpret saved units. */
export function formatExactMoney(amountMinor: bigint, currency: string, presentation: NumberPresentation) {
  const code = currencyMetadata(currency).code;
  return formatDecimal(toMajorDecimal(money(amountMinor, code)), presentation, code);
}

/** Dashboard-only Persian unit placement for the local currency after its amount. */
export function formatExactMoneyAfterAmount(amountMinor: bigint, currency: string, presentation: NumberPresentation) {
  const code = currencyMetadata(currency).code;
  const amount = formatDecimal(toMajorDecimal(money(amountMinor, code)), presentation);
  return `${amount}\u00a0${currencyLabel(code, presentation.locale)}`;
}

/**
 * Editing boundary only: allow unfinished sign/decimal states, but reject mixed
 * scripts, malformed grouping, unknown characters and excessive precision. Every
 * complete value uses the same strict grammar as the final money parser.
 */
export function normalizeDecimalDraft(input: string, separators: DecimalSeparators, fractionDigits: number): string {
  if (!Number.isInteger(fractionDigits) || fractionDigits < 0 || fractionDigits > 20) {
    throw new RangeError("Expected fraction digits from 0 to 20");
  }
  if (separators !== "ascii" && separators !== "arabic") throw new TypeError("Select decimal separators");
  if (typeof input !== "string" || input.length > 256) throw new TypeError("Invalid decimal draft");
  if (input === "" || input === "-" || input === "+") return input;
  const decimal = separators === "arabic" ? "٫" : ".";
  const prefixOnly = input === decimal || input === `-${decimal}` || input === `+${decimal}`;
  if (prefixOnly) {
    if (!fractionDigits) throw new TypeError("Fractional input is not allowed");
    return input.replace(decimal, ".");
  }
  const trailing = input.endsWith(decimal);
  const leading = input.startsWith(decimal) || input.startsWith(`-${decimal}`) || input.startsWith(`+${decimal}`);
  const zero = /[۰-۹]/.test(input) ? "۰" : /[٠-٩]/.test(input) ? "٠" : "0";
  const complete = trailing ? input + zero : input;
  const normalized = normalizeLocalizedDecimal(leading ? complete.replace(decimal, `${zero}${decimal}`) : complete, separators);
  const result = trailing ? normalized.slice(0, -1) : normalized;
  const fraction = result.split(".")[1];
  if ((fraction !== undefined && fractionDigits === 0) || (fraction?.length ?? 0) > fractionDigits) {
    throw new TypeError("Too many fraction digits");
  }
  return leading ? result.replace(/^(\+|-)?0\./, "$1.") : result;
}

/** Un-grouped editable text; canonical parent state and hidden form values stay ASCII. */
export function formatDecimalDraft(value: string, presentation: NumberPresentation): string {
  if (value.length > 256 || !/^[+-]?\d*(?:\.\d*)?$/.test(value)) throw new TypeError("Invalid canonical draft");
  return localizeDigits(value, presentation).replace(".", decimalSeparatorsFor(presentation) === "arabic" ? "٫" : ".");
}
