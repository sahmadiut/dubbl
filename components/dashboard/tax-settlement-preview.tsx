"use client";

import { useTranslations } from "next-intl";
import { taxUiMoney, taxUiSettlement } from "@/lib/money/tax-ui";

export function TaxSettlementPreview({ amount, currency }: { amount: string; currency: string }) {
  const t = useTranslations("TaxPeriods");
  const preview = taxUiSettlement(amount, currency);
  return <p role={preview.error ? "alert" : "status"} className="text-sm break-all">
    {preview.error
      ? amount === "" ? t("enterAmount") : t("invalidAmount")
      : t("settlementPreview", { amount: taxUiMoney(preview.amount, currency) })}
  </p>;
}
