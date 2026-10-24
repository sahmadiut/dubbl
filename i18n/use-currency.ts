"use client";

import { usePresentation } from "./provider";
import { currencyLabel, currencyPrefix } from "./currency-labels";

/** Language selects unit names independently of numerals, calendar and saved currency. */
export function useCurrencyPresentation() {
  const { locale } = usePresentation();
  return {
    label: (code: string, referenceName?: string) => currencyLabel(code, locale, referenceName),
    prefix: (value: string) => currencyPrefix(value, locale),
    isPersian: locale === "fa-IR",
  };
}
