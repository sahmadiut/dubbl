import { z } from "zod";
import { WireCompatibilityError } from "@/lib/money/wire";
import { safeInvoiceMinor } from "./invoice-write-wire";

export const paymentDeleteFields = {
  paymentId: z.string().uuid().describe("UUID of the live organization payment to reverse; no money input or currency conversion"),
};

/** No clamping: inconsistent saved balances need remediation before reversal. */
export function reversalBalances(paid: number, due: number, amount: number) {
  if (![paid, due, amount].every(n => Number.isSafeInteger(n) && n >= 0) || amount === 0 || amount > paid)
    throw new WireCompatibilityError("Saved document balances cannot unwind this allocation");
  return { amountPaid: safeInvoiceMinor(BigInt(paid) - BigInt(amount)),
    amountDue: safeInvoiceMinor(BigInt(due) + BigInt(amount)) };
}
