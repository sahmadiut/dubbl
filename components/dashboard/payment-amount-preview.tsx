import { paymentUiBillAmount, paymentUiMoney } from "@/lib/money/payment-ui";

export function PaymentAmountPreview({ text, bill }: {
  text: string;
  bill?: { id: string; contactId: string; currencyCode: string; amountDue: bigint };
}) {
  if (!text) return null;
  try {
    if (!bill) throw new RangeError("Select a bill");
    const parsed = paymentUiBillAmount(text, bill);
    return <p className="text-sm break-all">Payment: {paymentUiMoney(BigInt(parsed.amountMinor), bill.currencyCode)}</p>;
  } catch {
    return <p role="alert" className="text-sm text-destructive">Enter a positive amount that fits this currency&apos;s decimal places and does not exceed the bill balance.</p>;
  }
}
