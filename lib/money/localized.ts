import { parseMajor, type Money, type RoundingMode } from "./exact";

export type DecimalSeparators = "ascii" | "arabic";

/**
 * UI input boundary, never a wire/storage parser. Accept one numeral script per
 * value: Latin, Persian or Arabic-Indic. The caller selects separators explicitly:
 * ascii uses . and ,; arabic uses U+066B and U+066C. Grouping is optional, but
 * when present requires a 1-3 digit first group and three digits thereafter.
 * Only a leading ASCII + or - is allowed. Whitespace, bidi controls, currency
 * labels, exponents, mixed scripts and unrecognized characters are rejected.
 */
export function normalizeLocalizedDecimal(input: string, separators: DecimalSeparators): string {
  if (typeof input !== "string" || input.length === 0 || input.length > 256) {
    throw new TypeError("Enter a decimal amount of at most 256 characters");
  }
  if (separators !== "ascii" && separators !== "arabic") {
    throw new TypeError("Select ascii or arabic decimal separators");
  }
  let script: number | undefined;
  const digits = input.replace(/[0-9\u06f0-\u06f9\u0660-\u0669]/g, digit => {
    const code = digit.charCodeAt(0);
    const base = code >= 0x06f0 ? 0x06f0 : code >= 0x0660 ? 0x0660 : 0x30;
    if (script !== undefined && script !== base) throw new TypeError("Use one numeral script per amount");
    script = base;
    return String.fromCharCode(0x30 + code - base);
  });
  const grammar = separators === "ascii"
    ? /^[+-]?(?:[0-9]+|[0-9]{1,3}(?:,[0-9]{3})+)(?:\.[0-9]+)?$/
    : /^[+-]?(?:[0-9]+|[0-9]{1,3}(?:\u066c[0-9]{3})+)(?:\u066b[0-9]+)?$/;
  if (!grammar.test(digits)) throw new TypeError("Enter an amount with valid digits, sign and separators");
  // Remove only grouping characters already validated by the complete grammar.
  return separators === "ascii" ? digits.replaceAll(",", "") : digits.replaceAll("\u066c", "").replace("\u066b", ".");
}

/** Normalize UI text, then apply the exact currency scale, explicit rounding and int64 bounds. */
export function parseLocalizedMajor(input: string, currency: string, rounding: RoundingMode,
  separators: DecimalSeparators): Money {
  return parseMajor(normalizeLocalizedDecimal(input, separators), currency, rounding);
}
