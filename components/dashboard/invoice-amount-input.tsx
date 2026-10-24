"use client";
import { usePresentation } from "@/i18n/provider";
import { currencyLabel } from "@/i18n/currency-labels";
import { useTranslations } from "next-intl";

import { CurrencyInput } from "@/components/ui/currency-input";
import { currencyMetadata } from "@/lib/money/exact";
import { invoiceUiAmountValid, invoiceUiDecimal } from "@/lib/money/invoice-ui";

export function InvoiceAmountInput({ currency, value, onChange, placeholder, label, invalidMessage }: {
  currency: string; value: string; onChange: (value: string) => void; placeholder?: string;
  label?: string; invalidMessage?: string;
}) {
  const unitPresentation = usePresentation();
  const t = useTranslations("DocumentForms");
  const invalid = value !== "" && !invoiceUiAmountValid(value, currency);
  return <div>
    <CurrencyInput prefix={currency} fractionDigits={currencyMetadata(currency).minorUnits}
      value={value} onChange={onChange} placeholder={placeholder ?? invoiceUiDecimal(0n, currency)}
      aria-label={label ?? t("amountCurrency", { currency: currencyLabel(currency, unitPresentation.locale) })} aria-invalid={invalid} />
    {invalid && <p role="alert" className="mt-1 text-xs text-destructive">{invalidMessage ?? t("invalidAmount", { currency: currencyLabel(currency, unitPresentation.locale) })}</p>}
  </div>;
}
