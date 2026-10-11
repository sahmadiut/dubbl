import { taxUiMoney, taxUiSettlement } from "@/lib/money/tax-ui";

export function TaxSettlementPreview({ amount, currency }: { amount: string; currency: string }) {
  const preview = taxUiSettlement(amount, currency);
  return <p role={preview.error ? "alert" : "status"} className="text-sm break-all">
    {preview.error || `Settlement: ${taxUiMoney(preview.amount, currency)}`}
  </p>;
}
