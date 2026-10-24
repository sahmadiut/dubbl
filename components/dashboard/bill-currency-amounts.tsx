"use client";

import { usePresentation } from "@/i18n/provider";
import { billUiMoney } from "@/lib/money/bill-ui";

export function BillCurrencyAmounts({ amounts }: { amounts: readonly { currencyCode: string; amount: bigint }[] | null }) {
  const unitPresentation = usePresentation();
  if (!amounts?.length) return <span>—</span>;
  return <>{amounts.map(({ currencyCode, amount }) => <span className="block" key={currencyCode}>{billUiMoney(amount, currencyCode, unitPresentation)}</span>)}</>;
}
