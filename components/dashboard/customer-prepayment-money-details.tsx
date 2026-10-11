import { customerPrepaymentMoney } from "@/lib/money/customer-prepayment-ui";

export function CustomerPrepaymentMoneyDetails({ credit }: { credit: {
  currencyCode: string; originalAmount: bigint; amountRemaining: bigint;
} }) {
  return <div className="grid gap-4 sm:grid-cols-3">
    {([
      ["Original", credit.originalAmount, ""],
      ["Used so far", credit.originalAmount - credit.amountRemaining, "text-emerald-600"],
      ["Available to use", credit.amountRemaining, "text-amber-600"],
    ] as const).map(([label, amount, color]) => <div key={label} className="rounded-lg border p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-xl font-bold font-mono break-all ${color}`}>{customerPrepaymentMoney(amount, credit.currencyCode)}</p>
    </div>)}
  </div>;
}
