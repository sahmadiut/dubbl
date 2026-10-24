import { PERSIAN_CURRENCY_NAMES } from "./currency-names";

/** Display only: never pass the result back to currency state or a machine API. */
export function currencyLabel(code: string, locale: string, referenceName?: string): string {
  if (locale === "fa-IR") return Object.hasOwn(PERSIAN_CURRENCY_NAMES, code) ? PERSIAN_CURRENCY_NAMES[code] : code;
  return referenceName ?? code;
}

/** Prefixes may also be symbols or caller-authored text; only known ISO codes localize. */
export function currencyPrefix(prefix: string, locale: string): string {
  return Object.hasOwn(PERSIAN_CURRENCY_NAMES, prefix) ? currencyLabel(prefix, locale) : prefix;
}

/** Authored USD illustrations only; never infer a saved/user amount's currency from $. */
export function authoredUsdText(text: string, locale: string): string {
  return locale === "fa-IR" ? text.replaceAll("$", currencyLabel("USD", locale) + "\u00a0") : text;
}

/** Replace only Intl's identified currency unit, preserving all exact number parts. */
export function currencyPartsText(parts: readonly Intl.NumberFormatPart[], code: string, locale: string): string {
  if (locale !== "fa-IR") return parts.map(part => part.value).join("");
  return parts.map((part, index) => {
    if (part.type !== "currency") return part.value;
    const before = parts[index - 1], after = parts[index + 1];
    const leading = before && ["integer", "fraction"].includes(before.type) ? "\u00a0" : "";
    const trailing = after && ["integer", "fraction"].includes(after.type) ? "\u00a0" : "";
    return leading + currencyLabel(code, locale) + trailing;
  }).join("");
}
