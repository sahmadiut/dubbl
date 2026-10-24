"use client";

import { usePresentation } from "./provider";
import { formatExactDecimal, formatExactMoney } from "./numbers";

/** Presentation only; callers retain explicit currency, units and write validation. */
export function useNumberPresentation() {
  const presentation = usePresentation();
  return {
    decimal: (value: string, useGrouping = true) => formatExactDecimal(value, presentation, useGrouping),
    money: (amountMinor: bigint, currency: string) => formatExactMoney(amountMinor, currency, presentation),
  };
}
