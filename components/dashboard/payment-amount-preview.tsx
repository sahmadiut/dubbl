"use client";

import { useTranslations } from "next-intl";
import { paymentUiBillAmount, paymentUiMoney } from "@/lib/money/payment-ui";

export function PaymentAmountPreview({ text, bill }: {
  text: string;
  bill?: { id: string; contactId: string; currencyCode: string; amountDue: bigint };
}) {
  const t = useTranslations("BankPayments");
  if (!text) return null;
  try {
    if (!bill) throw new RangeError("Select a bill");
    const parsed = paymentUiBillAmount(text, bill);
    return <p className="text-sm break-all">{t("paymentPreview", { amount: paymentUiMoney(BigInt(parsed.amountMinor), bill.currencyCode) })}</p>;
  } catch {
    return <p role="alert" className="text-sm text-destructive">{t("invalidPayment")}</p>;
  }
}
