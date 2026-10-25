"use client";

import { usePresentation } from "@/i18n/provider";
import { useNumberPresentation } from "@/i18n/use-numbers";
import { BidiText, IdentifierText } from "@/components/ui/bidi-text";
import { currencyLabel } from "@/i18n/currency-labels";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** Mirrors lib/currency/rate-status.ts RateStatus (the JSON shape from the API). */
export interface RateInfo {
  rate: number | null;
  origin: "same" | "manual" | "api" | "manual-inverse" | "api-inverse" | null;
  effectiveDate: string | null;
  ageDays: number | null;
  stale: boolean;
  missing: boolean;
}

function formatRate(rate: number, presentation: ReturnType<typeof usePresentation>): string {
  return (rate / 1_000_000).toLocaleString(presentation.locale, {
    maximumFractionDigits: 6, numberingSystem: presentation.numerals,
  });
}

/**
 * One compact line describing the exchange rate behind a base-currency figure:
 * the rate itself, whether it was entered manually or fetched automatically,
 * its date, a stale warning, or — when no rate exists — a prompt to set a
 * custom one. Renders nothing when the document is already in the base currency.
 */
export function RateNote({
  currency,
  baseCurrency,
  status,
  className,
}: {
  currency: string;
  baseCurrency: string;
  status: RateInfo | null | undefined;
  className?: string;
}) {
  const unitPresentation = usePresentation();
  const numbers = useNumberPresentation();
  const t = useTranslations("SharedUI");
  if (!status || !baseCurrency || baseCurrency === currency) return null;

  if (status.missing) {
    return (
      <span className={cn("inline-flex flex-wrap items-center gap-1 text-xs text-amber-600", className)}>
        <BidiText>{t("missingRate", { currency: currencyLabel(currency, unitPresentation.locale), baseCurrency: currencyLabel(baseCurrency, unitPresentation.locale) })}</BidiText>{" "}
        <Link href="/tax/currencies" className="font-medium underline underline-offset-2">
          {t("setACustomRate")}
        </Link>
      </span>
    );
  }

  const isManual = status.origin === "manual" || status.origin === "manual-inverse";

  return (
    <span className={cn("inline-flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground", className)}>
      {status.rate != null && (
        <BidiText className="tabular-nums">
          <bdi>{numbers.decimal("1")} {currencyLabel(currency, unitPresentation.locale)}</bdi> ≈ <bdi>{formatRate(status.rate, unitPresentation)} {currencyLabel(baseCurrency, unitPresentation.locale)}</bdi>
        </BidiText>
      )}
      <span>·</span>
      {isManual ? (
        <span className="font-medium text-blue-600">{t("manualRate")}</span>
      ) : (
        <span>{t("autoRate")}</span>
      )}
      {status.effectiveDate && <span>· <IdentifierText>{status.effectiveDate}</IdentifierText></span>}
      {status.stale && status.ageDays != null && (
        <span className="font-medium text-amber-600">· {t("rateAge", { count: status.ageDays })}</span>
      )}
    </span>
  );
}
