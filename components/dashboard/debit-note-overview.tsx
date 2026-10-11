import { debitNoteUiMoney, type debitNoteUiOverview } from "@/lib/money/debit-note-ui";

export function DebitNoteOverview({ groups }: { groups: ReturnType<typeof debitNoteUiOverview> }) {
  return <div className="grid gap-4 md:grid-cols-3">
    {([ ["Total Credits", "total"], ["Used", "amountApplied"], ["Remaining", "amountRemaining"] ] as const).map(([label, key]) =>
      <div key={key} className="rounded-lg border p-4">
        <p className="text-sm text-muted-foreground">{label}</p>
        {groups.length ? groups.map(group => <p key={group.currencyCode} className="font-mono text-lg font-semibold break-all">
          <span className="text-xs text-muted-foreground">{group.currencyCode} </span>{debitNoteUiMoney(group[key], group.currencyCode)}
        </p>) : <p className="text-lg">—</p>}
      </div>)}
  </div>;
}
