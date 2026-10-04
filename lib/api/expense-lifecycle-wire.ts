import { z } from "zod";
import { rateDateSchema } from "@/lib/currency/rate-policy";
import { legacyMinor, WireCompatibilityError } from "@/lib/money/wire";
import { invoiceRound } from "./invoice-write-wire";

export const expensePayFields = {
  date: rateDateSchema.describe("Gregorian reimbursement posting date YYYY-MM-DD, on or after approval; must be open"),
  bankAccountCode: z.string().min(1).max(100).default("1100").describe("Organization-owned live active asset GL account code, bank/cash subtype or standard 1100-1199 bank band; defaults to 1100; denomination must be claim or base currency"),
};
export const expenseRejectFields = {
  reason: z.string().trim().min(1).max(10000).describe("Required nonblank rejection reason, up to 10000 characters"),
};
export const expensePaySchema = z.object(expensePayFields).strict();
export const expenseRejectSchema = z.object(expenseRejectFields).strict();

/** Stored item amount is tax-inclusive except reverse charge (supplier net).
 * Preserve the explicit gross; split only recoverable input VAT. */
export function expenseTaxSplit(amount: number, tax?: { rate: number; recoverablePercent: number; kind: string } | null) {
  if (!Number.isSafeInteger(amount) || amount < 0) throw new WireCompatibilityError("Invalid saved expense amount");
  if (!tax) return { expense: amount, input: 0, output: 0 };
  if (!Number.isInteger(tax.rate) || tax.rate < 0 || tax.rate > 2147483647 ||
    !Number.isInteger(tax.recoverablePercent) || tax.recoverablePercent < 0 || tax.recoverablePercent > 10000)
    throw new WireCompatibilityError("Invalid saved expense tax metadata");
  if (["blocked", "exempt", "no_vat", "sales_tax_us"].includes(tax.kind) || !tax.rate)
    return { expense: amount, input: 0, output: 0 };
  if (!["standard", "partial_block", "reverse_charge"].includes(tax.kind))
    throw new WireCompatibilityError("Unsupported expense tax kind");
  const reverse = tax.kind === "reverse_charge";
  const vat = invoiceRound(BigInt(amount) * BigInt(tax.rate), reverse ? 10000n : 10000n + BigInt(tax.rate));
  const recoverable = invoiceRound(vat * BigInt(tax.recoverablePercent), 10000n);
  return { expense: legacyMinor(reverse ? BigInt(amount) + vat - recoverable : BigInt(amount) - recoverable),
    input: legacyMinor(recoverable), output: reverse ? legacyMinor(vat) : 0 };
}
