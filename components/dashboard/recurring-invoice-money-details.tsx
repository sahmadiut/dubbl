import { useTranslations } from "next-intl";
import { recurringInvoiceUiMoney, type RecurringInvoiceUiLine } from "@/lib/money/recurring-invoice-ui";

export function RecurringInvoiceMoneyDetails({ currencyCode, lines }: { currencyCode: string; lines: RecurringInvoiceUiLine[] }) {
  const t = useTranslations("RecurringInvoices");
  return <div className="rounded-lg border overflow-x-auto">
    <div className="grid min-w-[540px] grid-cols-[1fr_80px_130px_150px] gap-2 border-b bg-muted/50 px-4 py-2 text-xs font-medium text-muted-foreground">
      <span>{t("lineDescription")}</span><span className="text-right">{t("quantity")}</span><span className="text-right">{t("unitPrice", { currency: currencyCode })}</span><span className="text-right">{t("grossAmount")}</span>
    </div>
    {lines.map(line => <div key={line.id} className="grid min-w-[540px] grid-cols-[1fr_80px_130px_150px] gap-2 border-b px-4 py-2">
      <div><p className="text-sm">{line.description}</p>
        {line.account && <p className="text-xs text-muted-foreground">{line.account.code} &middot; {line.account.name}</p>}
        {line.discountPercent > 0 && <p className="text-xs text-muted-foreground">{t("discount", { percent: String(line.discountPercent / 100) })}</p>}
      </div>
      <span className="text-right text-sm font-mono">{line.quantity / 100}</span>
      <span className="text-right text-sm font-mono break-words">{recurringInvoiceUiMoney(line.unitPrice, currencyCode)}</span>
      <span className="text-right text-sm font-mono font-medium break-words">{recurringInvoiceUiMoney(line.grossMinor, currencyCode)}</span>
    </div>)}
    <div className="min-w-[540px] px-4 py-3 text-right text-sm">
      {t("grossTotal")} <span className="font-mono font-medium">{recurringInvoiceUiMoney(lines.reduce((sum, line) => sum + line.grossMinor, 0n), currencyCode)}</span>
      <p className="text-xs text-muted-foreground">{t("grossHint")}</p>
    </div>
  </div>;
}
