import { quoteUiMoney } from "@/lib/money/quote-ui";

export function QuoteMoneyDetails({ quote }: { quote: {
  currencyCode: string; total: bigint; subtotal: bigint; taxTotal: bigint;
  lines: { id: string; description: string; quantity: number; unitPrice: bigint; amount: bigint;
    account: { code: string; name: string } | null }[];
} }) {
  return <>
    <div className="rounded-lg border p-4"><p className="text-xl font-bold font-mono break-all">{quoteUiMoney(quote.total, quote.currencyCode)}</p></div>
    <div className="rounded-lg border overflow-x-auto">
      <div className="grid min-w-[500px] grid-cols-[1fr_80px_100px_120px] gap-2 border-b bg-muted/50 px-4 py-2 text-xs font-medium text-muted-foreground">
        <span>Description</span><span className="text-right">Qty</span><span className="text-right">Price ({quote.currencyCode})</span><span className="text-right">Amount</span>
      </div>
      {quote.lines.map(line => <div key={line.id} className="grid min-w-[500px] grid-cols-[1fr_80px_100px_120px] gap-2 border-b px-4 py-2 last:border-b-0">
        <div><p className="text-sm">{line.description}</p>{line.account && <p className="text-xs text-muted-foreground">{line.account.code} &middot; {line.account.name}</p>}</div>
        <span className="text-right text-sm font-mono">{line.quantity / 100}</span>
        <span className="text-right text-sm font-mono break-all">{quoteUiMoney(line.unitPrice, quote.currencyCode)}</span>
        <span className="text-right text-sm font-mono font-medium break-all">{quoteUiMoney(line.amount, quote.currencyCode)}</span>
      </div>)}
    </div>
    <div className="space-y-1 text-right text-sm font-mono tabular-nums">
      <p>Subtotal: {quoteUiMoney(quote.subtotal, quote.currencyCode)}</p>
      <p>Tax: {quoteUiMoney(quote.taxTotal, quote.currencyCode)}</p>
      <p className="font-semibold">Total: {quoteUiMoney(quote.total, quote.currencyCode)}</p>
    </div>
  </>;
}
