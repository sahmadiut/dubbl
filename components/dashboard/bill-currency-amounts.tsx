import { billUiMoney } from "@/lib/money/bill-ui";

export function BillCurrencyAmounts({ amounts }: { amounts: readonly { currencyCode: string; amount: bigint }[] | null }) {
  if (!amounts?.length) return <span>—</span>;
  return <>{amounts.map(({ currencyCode, amount }) => <span className="block" key={currencyCode}>{billUiMoney(amount, currencyCode)}</span>)}</>;
}
