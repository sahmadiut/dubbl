import { useTranslations } from "next-intl";

import { journalMoney } from "@/lib/money/journal-display";
import { openingBalanceSaved, OPENING_BALANCE_CURRENCY, type OpeningBalanceSavedLine } from "@/lib/money/opening-balance-ui";

export function OpeningBalanceMoneyDetails({ lines }: { lines: OpeningBalanceSavedLine[] }) {
  const t = useTranslations("Journals");
  let saved;
  let debitTotal, creditTotal;
  try {
    saved = openingBalanceSaved(lines);
    debitTotal = journalMoney(saved.totalDebit, OPENING_BALANCE_CURRENCY);
    creditTotal = journalMoney(saved.totalCredit, OPENING_BALANCE_CURRENCY);
  }
  catch { return <p role="alert" className="text-sm text-red-600">{t("invalidOpening")}</p>; }
  return (
    <div className="rounded-lg border overflow-x-auto">
      <div className="grid min-w-[500px] grid-cols-[1fr_140px_140px] gap-2 border-b bg-muted/50 px-4 py-2 text-xs font-medium text-muted-foreground">
        <span>{t("account")}</span>
        <span className="text-right">{t("moneyInDebit")}</span>
        <span className="text-right">{t("moneyOwedCredit")}</span>
      </div>
      {saved.lines.map((line) => (
        <div key={line.id} className="grid min-w-[500px] grid-cols-[1fr_140px_140px] gap-2 border-b px-4 py-2 last:border-b-0">
          <p className="text-sm">
            {line.account ? `${line.account.code} · ${line.account.name}` : t("unknownAccount")}
          </p>
          <span className="text-right text-sm font-mono">
            {line.debit > 0n ? journalMoney(line.debit, OPENING_BALANCE_CURRENCY) : "—"}
          </span>
          <span className="text-right text-sm font-mono">
            {line.credit > 0n ? journalMoney(line.credit, OPENING_BALANCE_CURRENCY) : "—"}
          </span>
        </div>
      ))}
      <div className="grid min-w-[500px] grid-cols-[1fr_140px_140px] gap-2 border-t bg-muted/30 px-4 py-2">
        <span className="text-sm font-bold">{t("total")}</span>
        <span className="text-right text-sm font-mono font-bold">{debitTotal}</span>
        <span className="text-right text-sm font-mono font-bold">{creditTotal}</span>
      </div>
    </div>
  );
}
