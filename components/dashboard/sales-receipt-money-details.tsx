"use client";

import { usePresentation } from "@/i18n/provider";
import { currencyLabel } from "@/i18n/currency-labels";
import { useTranslations } from "next-intl";
import { salesReceiptUiMoney } from "@/lib/money/sales-receipt-ui";

export function SalesReceiptMoneyDetails({ receipt }: { receipt: {
  currencyCode: string; total: bigint; subtotal: bigint; taxTotal: bigint;
  lines: { id: string; description: string; quantity: number; unitPrice: bigint; amount: bigint }[];
} }) {
  const unitPresentation = usePresentation();
  const t = useTranslations("SalesReceipts");
  return <div className="rounded-lg border overflow-x-auto">
    <div className="grid min-w-[500px] grid-cols-[1fr_80px_100px_120px] gap-2 border-b bg-muted/50 px-4 py-2 text-xs font-medium text-muted-foreground">
      <span>{t("description")}</span><span className="text-right">{t("quantity")}</span><span className="text-right">{t("price", { currency: currencyLabel(receipt.currencyCode, unitPresentation.locale) })}</span><span className="text-right">{t("amount")}</span>
    </div>
    {receipt.lines.map(line => <div key={line.id} className="grid min-w-[500px] grid-cols-[1fr_80px_100px_120px] gap-2 border-b px-4 py-2 last:border-b-0">
      <p className="text-sm">{line.description}</p>
      <span className="text-right text-sm font-mono">{line.quantity / 100}</span>
      <span className="text-right text-sm font-mono break-all">{salesReceiptUiMoney(line.unitPrice, receipt.currencyCode, unitPresentation)}</span>
      <span className="text-right text-sm font-mono font-medium break-all">{salesReceiptUiMoney(line.amount, receipt.currencyCode, unitPresentation)}</span>
    </div>)}
    <div className="border-t bg-muted/30 px-4 py-2 text-right flex flex-wrap justify-end gap-x-4 gap-y-1">
      <span className="text-sm font-medium break-all">{t("subtotalAmount", { amount: salesReceiptUiMoney(receipt.subtotal, receipt.currencyCode, unitPresentation) })}</span>
      <span className="text-sm break-all">{t("taxAmount", { amount: salesReceiptUiMoney(receipt.taxTotal, receipt.currencyCode, unitPresentation) })}</span>
      <span className="text-sm font-bold break-all">{t("totalAmount", { amount: salesReceiptUiMoney(receipt.total, receipt.currencyCode, unitPresentation) })}</span>
    </div>
  </div>;
}
