"use client";

import { useTranslations } from "next-intl";
import { customerPrepaymentMoney } from "@/lib/money/customer-prepayment-ui";

export function CustomerPrepaymentMoneyDetails({ credit }: { credit: {
  currencyCode: string; originalAmount: bigint; amountRemaining: bigint;
} }) {
  const t = useTranslations("CustomerPrepayments");
  return <div className="grid gap-4 sm:grid-cols-3">
    {([
      [t("original"), credit.originalAmount, ""],
      [t("usedSoFar"), credit.originalAmount - credit.amountRemaining, "text-emerald-600"],
      [t("availableToUse"), credit.amountRemaining, "text-amber-600"],
    ] as const).map(([label, amount, color]) => <div key={label} className="rounded-lg border p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-xl font-bold font-mono break-all ${color}`}>{customerPrepaymentMoney(amount, credit.currencyCode)}</p>
    </div>)}
  </div>;
}
