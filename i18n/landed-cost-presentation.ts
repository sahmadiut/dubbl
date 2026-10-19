import type { useTranslations } from "next-intl";

export type LandedCostTranslate = ReturnType<typeof useTranslations<"LandedCosts">>;
const statuses = { draft: "draft", allocated: "allocated" } as const;
const methods = { by_value: "byValue", by_quantity: "byQuantity" } as const;

export function landedCostStatusLabel(t: LandedCostTranslate, code: string) {
  return Object.hasOwn(statuses, code) ? t(statuses[code as keyof typeof statuses]) : code;
}

export function landedCostMethodLabel(t: LandedCostTranslate, code: string) {
  return Object.hasOwn(methods, code) ? t(methods[code as keyof typeof methods]) : code;
}
