"use client";

import { usePresentation } from "@/i18n/provider";
import { currencyLabel } from "@/i18n/currency-labels";
import { useTranslations } from "next-intl";
import { debitNoteUiMoney, type debitNoteUiOverview } from "@/lib/money/debit-note-ui";

export function DebitNoteOverview({ groups }: { groups: ReturnType<typeof debitNoteUiOverview> }) {
  const unitPresentation = usePresentation();
  const t = useTranslations("DebitNotes");
  return <div className="grid gap-4 md:grid-cols-3">
    {([ [t("totalCredits"), "total"], [t("usedHeading"), "amountApplied"], [t("remaining"), "amountRemaining"] ] as const).map(([label, key]) =>
      <div key={key} className="rounded-lg border p-4">
        <p className="text-sm text-muted-foreground">{label}</p>
        {groups.length ? groups.map(group => <p key={group.currencyCode} className="font-mono text-lg font-semibold break-all">
          <span className="text-xs text-muted-foreground">{currencyLabel(group.currencyCode, unitPresentation.locale)} </span>{debitNoteUiMoney(group[key], group.currencyCode, unitPresentation)}
        </p>) : <p className="text-lg">—</p>}
      </div>)}
  </div>;
}
