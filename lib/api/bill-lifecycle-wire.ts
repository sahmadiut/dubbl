import { z } from "zod";
import { invoiceRound, safeInvoiceMinor } from "./invoice-write-wire";
import { WireCompatibilityError } from "@/lib/money/wire";
import { AuthError } from "./auth-context";
import { billWriteDto } from "./bill-write-wire";

export const billRejectFields = {
  reason: z.string().max(10000).optional().describe("Optional rejection reason, at most 10000 characters; omission clears the reason"),
};
export const billRejectSchema = z.object(billRejectFields);

/** Settlement itself remains MON-021; it must never bypass bill recognition. */
export function assertBillSettlementReady(row: { status: string; journalEntryId: string | null; subtotal: number; taxTotal: number;
  total: number; amountPaid: number; amountDue: number }) {
  billWriteDto(row);
  if (!["received", "partial", "overdue"].includes(row.status) || !row.journalEntryId)
    throw new AuthError("Only recognized outstanding bills can be paid", 400);
  if (row.amountPaid < 0 || row.amountDue <= 0) throw new AuthError("Bill has no valid outstanding payable", 400);
}

export function billSettlementBalances(row: Parameters<typeof assertBillSettlementReady>[0], amount: number) {
  assertBillSettlementReady(row);
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new WireCompatibilityError("Bill payment must be a positive safe integer in stored minor units");
  if (amount > row.amountDue) throw new AuthError("Payment exceeds the outstanding bill payable", 400);
  return { amountPaid: safeInvoiceMinor(BigInt(row.amountPaid) + BigInt(amount)), amountDue: safeInvoiceMinor(BigInt(row.amountDue) - BigInt(amount)) };
}

/** Document quantities remain hundredths; inventory retains whole-unit rounding. */
export function billUnits(quantity: number) {
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > 2147483647)
    throw new WireCompatibilityError("Bill quantity must be a nonnegative int32 in hundredths");
  return Number(invoiceRound(BigInt(quantity), 100n));
}
export function billInt32(value: bigint) {
  if (value < 0n || value > 2147483647n) throw new WireCompatibilityError("Bill stock/PO quantity exceeds nonnegative int32 capacity");
  return Number(value);
}
export function billTaxSplit(amount: number, tax: number, rate?: { kind: string; rate: number; recoverablePercent: number }) {
  for (const value of [amount, tax]) {
    if (!Number.isSafeInteger(value) || value < 0) throw new WireCompatibilityError("Bill posting requires nonnegative safe minor amounts");
  }
  if (rate && (!Number.isInteger(rate.rate) || rate.rate < 0 || rate.rate > 10000 ||
    !Number.isInteger(rate.recoverablePercent) || rate.recoverablePercent < 0 || rate.recoverablePercent > 10000))
    throw new WireCompatibilityError("Bill tax rate/recoverability must be 0 through 10000 basis points");
  const output = rate?.kind === "reverse_charge" ? safeInvoiceMinor(invoiceRound(BigInt(amount) * BigInt(rate.rate), 10000n)) : 0;
  if (rate?.kind === "reverse_charge" && output !== tax) throw new WireCompatibilityError("Saved reverse-charge tax does not agree with the line and rate");
  const input = safeInvoiceMinor(invoiceRound(BigInt(tax) * BigInt(rate?.recoverablePercent ?? 10000), 10000n));
  const blocked = safeInvoiceMinor(BigInt(tax) - BigInt(input));
  return { input, output, blocked, supplier: safeInvoiceMinor(BigInt(amount) + BigInt(tax) - BigInt(output)) };
}
export function billVarianceBp(actual: number, expected: number) {
  if (!Number.isSafeInteger(actual) || !Number.isSafeInteger(expected) || actual < 0 || expected < 0) throw new WireCompatibilityError();
  return expected === 0 ? (actual === 0 ? 0n : 10000n) : invoiceRound((BigInt(actual) - BigInt(expected)) * 10000n, BigInt(expected));
}
