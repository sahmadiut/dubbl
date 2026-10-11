import { salesReceiptUiMoney } from "@/lib/money/sales-receipt-ui";

export function SalesReceiptMoneyDetails({ receipt }: { receipt: {
  currencyCode: string; total: bigint; subtotal: bigint; taxTotal: bigint;
  lines: { id: string; description: string; quantity: number; unitPrice: bigint; amount: bigint }[];
} }) {
  return <div className="rounded-lg border overflow-x-auto">
    <div className="grid min-w-[500px] grid-cols-[1fr_80px_100px_120px] gap-2 border-b bg-muted/50 px-4 py-2 text-xs font-medium text-muted-foreground">
      <span>Description</span><span className="text-right">Qty</span><span className="text-right">Price ({receipt.currencyCode})</span><span className="text-right">Amount</span>
    </div>
    {receipt.lines.map(line => <div key={line.id} className="grid min-w-[500px] grid-cols-[1fr_80px_100px_120px] gap-2 border-b px-4 py-2 last:border-b-0">
      <p className="text-sm">{line.description}</p>
      <span className="text-right text-sm font-mono">{line.quantity / 100}</span>
      <span className="text-right text-sm font-mono break-all">{salesReceiptUiMoney(line.unitPrice, receipt.currencyCode)}</span>
      <span className="text-right text-sm font-mono font-medium break-all">{salesReceiptUiMoney(line.amount, receipt.currencyCode)}</span>
    </div>)}
    <div className="border-t bg-muted/30 px-4 py-2 text-right flex flex-wrap justify-end gap-x-4 gap-y-1">
      <span className="text-sm font-medium break-all">Subtotal: {salesReceiptUiMoney(receipt.subtotal, receipt.currencyCode)}</span>
      <span className="text-sm break-all">Tax: {salesReceiptUiMoney(receipt.taxTotal, receipt.currencyCode)}</span>
      <span className="text-sm font-bold break-all">Total: {salesReceiptUiMoney(receipt.total, receipt.currencyCode)}</span>
    </div>
  </div>;
}
