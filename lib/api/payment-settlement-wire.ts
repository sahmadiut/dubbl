import { z } from "zod";
import { rateDateSchema } from "@/lib/currency/rate-policy";
import { currencyCodeSchema } from "@/lib/currency/zod";
import { exactRate, toLegacyRate } from "@/lib/currency/exact-rate";
import { currencyMetadata } from "@/lib/money/exact";
import { WireCompatibilityError } from "@/lib/money/wire";
import { creditAmountFields, creditAmount } from "./credit-wire";
import { invoiceRound, safeInvoiceMinor } from "./invoice-write-wire";

export const paymentPayFields = {
  ...creditAmountFields,
  date: rateDateSchema.describe("Gregorian cash posting date, YYYY-MM-DD; MCP omission defaults to today in UTC"),
  method: z.enum(["bank_transfer", "cash", "check", "card", "other"]).default("bank_transfer").describe("Payment method; defaults to bank_transfer"),
  reference: z.string().max(10000).nullable().optional().describe("Optional external payment reference; never used as an idempotency key"),
  bankAccountId: z.string().uuid().nullable().optional().describe("Optional active organization bank UUID in the document currency; omission uses GL code 1100"),
  idempotencyKey: z.string().min(1).max(128).regex(/^[A-Za-z0-9._:-]+$/).optional().describe("Optional organization-wide retry key, 1-128 ASCII letters/digits/._:-; reuse must match the normalized operation"),
};
export const paymentMcpPayFields = { ...paymentPayFields, date: paymentPayFields.date.optional().describe("Gregorian cash posting date; omission defaults to today in UTC") };
export const paymentAllocationFields = {
  documentType: z.enum(["invoice", "bill"]).describe("invoice for received cash, bill for made cash"),
  documentId: z.string().uuid().describe("Organization-owned recognized outstanding document UUID, same contact and currency"),
  ...creditAmountFields,
};
export const paymentCreateFields = {
  ...paymentPayFields,
  contactId: z.string().uuid().describe("Organization-owned active customer/supplier contact UUID"),
  type: z.enum(["received", "made"]).describe("received settles invoices; made settles bills"),
  notes: z.string().max(10000).nullable().optional().describe("Optional payment notes"),
  currencyCode: currencyCodeSchema.optional().describe("Optional currency; must match all allocations, otherwise derived from documents"),
  allocations: z.array(z.object(paymentAllocationFields).strict()).min(1).max(1000).describe("1-1000 distinct document allocations; must fully cover cash, with no overpayments or unapplied remainder"),
};
export const paymentCreateSchema = z.object(paymentCreateFields).strict();
export const paymentPaySchema = z.object(paymentPayFields).strict();

export function paymentAllocations(input: z.infer<typeof paymentCreateSchema>) {
  const amount = creditAmount(input);
  const allocations = input.allocations.map(row => ({ documentId: row.documentId, documentType: row.documentType, amount: creditAmount(row) }));
  if (new Set(allocations.map(row => row.documentId)).size !== allocations.length)
    throw new z.ZodError([{ code: "custom", path: ["allocations"], message: "Duplicate settlement documents are not supported" }]);
  if (allocations.some(row => row.documentType !== (input.type === "received" ? "invoice" : "bill")))
    throw new z.ZodError([{ code: "custom", path: ["allocations"], message: "Payment direction must agree with every allocation" }]);
  if (allocations.reduce((sum, row) => sum + BigInt(row.amount), 0n) !== BigInt(amount))
    throw new z.ZodError([{ code: "custom", path: ["allocations"], message: "Allocations must exactly equal the cash payment; use customer credits for unapplied cash" }]);
  return { amount, allocations: allocations.sort((a, b) => a.documentId.localeCompare(b.documentId)) };
}

/** Exact major-to-major FX with explicit source/destination minor scales. */
export function paymentCashBase(amount: number, currency: string, base: string, input: string) {
  const rate = exactRate(input);
  try { toLegacyRate(rate); } catch { throw new WireCompatibilityError("Settlement FX must fit legacy int32 millionths exactly"); }
  const [whole, fraction = ""] = rate.split(".");
  const numerator = BigInt(whole + fraction) * 10n ** BigInt(currencyMetadata(base).minorUnits);
  const denominator = 10n ** BigInt(fraction.length + currencyMetadata(currency).minorUnits);
  return safeInvoiceMinor(invoiceRound(BigInt(amount) * numerator, denominator));
}

/** Cumulative allocation releases the final rounding remainder instead of revaluing history. */
export function paymentCarryingBase(original: number, payable: number, paid: number, amount: number) {
  for (const value of [original, payable, paid, amount])
    if (!Number.isSafeInteger(value) || value < 0) throw new WireCompatibilityError("Invalid saved settlement carrying values");
  if (!payable || !original || !amount || BigInt(paid) + BigInt(amount) > BigInt(payable))
    throw new WireCompatibilityError("Settlement exceeds recognized outstanding carrying value");
  return safeInvoiceMinor(invoiceRound(BigInt(original) * (BigInt(paid) + BigInt(amount)), BigInt(payable))
    - invoiceRound(BigInt(original) * BigInt(paid), BigInt(payable)));
}

export function paymentRequestInput(request: Request, input: unknown) {
  const key = request.headers.get("idempotency-key");
  if (key === null) return input;
  if (!input || typeof input !== "object" || Array.isArray(input)) return input;
  const body = input as Record<string, unknown>;
  if (body.idempotencyKey !== undefined && body.idempotencyKey !== key)
    throw new z.ZodError([{ code: "custom", path: ["idempotencyKey"], message: "Body and header idempotency keys disagree" }]);
  return { ...body, idempotencyKey: key };
}
