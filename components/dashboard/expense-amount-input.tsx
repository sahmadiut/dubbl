"use client";

import { CurrencyInput } from "@/components/ui/currency-input";

export function ExpenseAmountInput({ currency, value, onChange, label }: {
  currency: string; value: string; onChange: (value: string) => void; label: string;
}) {
  return <CurrencyInput prefix={currency} fractionDigits={18} value={value} onChange={onChange} aria-label={label} />;
}
