import { debitNoteUiMoney } from "@/lib/money/debit-note-ui";

export function DebitNoteMoneyDetails({ credit }: { credit: {
  currencyCode: string; total: bigint; subtotal: bigint; taxTotal: bigint; amountApplied: bigint; amountRemaining: bigint;
  lines: { id: string; description: string; quantity: number; unitPrice: bigint; amount: bigint;
    account: { code: string; name: string } | null }[];
} }) {
  return <>
    <div className="grid gap-4 sm:grid-cols-3">
      {([
        ["Total", credit.total, ""], ["Used", credit.amountApplied, "text-emerald-600"], ["Remaining", credit.amountRemaining, "text-amber-600"],
      ] as const).map(([label, value, color]) =>
        <div key={label} className="rounded-lg border p-4"><p className="text-xs text-muted-foreground">{label}</p>
          <p className={`text-xl font-bold font-mono break-all ${color}`}>{debitNoteUiMoney(value, credit.currencyCode)}</p></div>)}
    </div>
    <div className="rounded-lg border overflow-x-auto">
      <div className="grid min-w-[500px] grid-cols-[1fr_80px_100px_120px] gap-2 border-b bg-muted/50 px-4 py-2 text-xs font-medium text-muted-foreground">
        <span>Description</span><span className="text-right">Qty</span><span className="text-right">Price ({credit.currencyCode})</span><span className="text-right">Amount</span>
      </div>
      {credit.lines.map(line => <div key={line.id} className="grid min-w-[500px] grid-cols-[1fr_80px_100px_120px] gap-2 border-b px-4 py-2 last:border-b-0">
        <div><p className="text-sm">{line.description}</p>{line.account && <p className="text-xs text-muted-foreground">{line.account.code} &middot; {line.account.name}</p>}</div>
        <span className="text-right text-sm font-mono">{line.quantity / 100}</span>
        <span className="text-right text-sm font-mono break-all">{debitNoteUiMoney(line.unitPrice, credit.currencyCode)}</span>
        <span className="text-right text-sm font-mono font-medium break-all">{debitNoteUiMoney(line.amount, credit.currencyCode)}</span>
      </div>)}
      <div className="border-t bg-muted/30 px-4 py-2 text-right flex flex-wrap justify-end gap-x-4 gap-y-1 [overflow-wrap:anywhere]">
        <span className="text-sm font-medium">Subtotal: {debitNoteUiMoney(credit.subtotal, credit.currencyCode)}</span>
        <span className="text-sm">Tax: {debitNoteUiMoney(credit.taxTotal, credit.currencyCode)}</span>
        <span className="text-sm font-bold">Total: {debitNoteUiMoney(credit.total, credit.currencyCode)}</span>
      </div>
    </div>
  </>;
}
