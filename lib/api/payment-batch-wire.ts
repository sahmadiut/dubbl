import { z } from "zod";
import { currencyCodeSchema } from "@/lib/currency/zod";
import { exactMinorSchema } from "@/lib/money/wire";
import { currencyMetadata } from "@/lib/money/exact";
import { creditAmountFields, creditAmount } from "./credit-wire";
import { invoiceDecimalRatio, invoiceInputError, invoiceRound, safeInvoiceMinor } from "./invoice-write-wire";
import { paymentPayFields } from "./payment-settlement-wire";
import { paymentListFields } from "./payment-read-wire";

export const immediateBatchAllocationFields = {
  documentId: z.string().uuid().describe("Recognized outstanding organization invoice/bill UUID, same contact and currency"),
  documentType: z.enum(["invoice", "bill"]).describe("invoice for received cash, bill for made cash"),
  amount: z.number().positive().max(Number.MAX_SAFE_INTEGER).optional().describe("Legacy decimal major-unit allocation, e.g. USD 12.50; rounded to currency minor scale with positive ties up"),
  amountExact: z.string().max(256).regex(/^(?:0|[1-9]\d*)(?:\.\d+)?$/).optional().describe("Exact ungrouped positive decimal major allocation; must agree exactly with numeric amount when both supplied"),
  amountMinor: exactMinorSchema.optional().describe("Positive canonical integer document minor-unit string; must equal the rounded major aliases and fit safe numeric range"),
};
export const immediateBatchFields = {
  date: paymentPayFields.date,
  method: paymentPayFields.method,
  reference: paymentPayFields.reference,
  bankAccountId: paymentPayFields.bankAccountId,
  idempotencyKey: paymentPayFields.idempotencyKey,
  contactId: z.string().uuid().describe("Organization customer/supplier UUID shared by every document"),
  type: z.enum(["received", "made"]).describe("received settles invoices; made settles bills"),
  allocations: z.array(z.object(immediateBatchAllocationFields).strict()).min(1).max(1000).describe("1-1000 distinct documents; total is the exact sum of rounded allocations"),
};
export const immediateBatchSchema = z.object(immediateBatchFields).strict();

export function batchMajorAmount(input: { amount?: number; amountExact?: string; amountMinor?: string }, currency: string) {
  const numeric = input.amount === undefined ? undefined : invoiceDecimalRatio(input.amount);
  const exact = input.amountExact === undefined ? undefined : invoiceDecimalRatio(input.amountExact);
  if (numeric && exact && numeric.numerator * exact.denominator !== exact.numerator * numeric.denominator)
    invoiceInputError("Batch major amount aliases disagree");
  const major = exact ?? numeric;
  if (!major && input.amountMinor === undefined) invoiceInputError("Batch allocation requires amount, amountExact or amountMinor");
  const minor = major ? invoiceRound(major.numerator * 10n ** BigInt(currencyMetadata(currency).minorUnits), major.denominator)
    : BigInt(input.amountMinor!);
  if (input.amountMinor !== undefined && minor !== BigInt(input.amountMinor)) invoiceInputError("Batch minor alias disagrees with rounded major amount");
  const amount = safeInvoiceMinor(minor);
  if (amount <= 0) invoiceInputError("Batch allocation must round to positive minor units");
  return amount;
}

export const storedBatchItemFields = {
  billId: z.string().uuid().describe("Available recognized outstanding supplier bill UUID in this organization"),
  contactId: z.string().uuid().describe("Organization supplier UUID matching the bill contact"),
  ...creditAmountFields,
  currencyCode: currencyCodeSchema.default("USD").describe("Item currency, defaults to USD; must match bill and batch without conversion"),
};
export const storedBatchItemSchema = z.object(storedBatchItemFields).strict();
export const batchCreateFields = {
  name: z.string().min(1).max(10000).describe("Payment batch name, 1-10000 characters"),
  currencyCode: currencyCodeSchema.default("USD").describe("Batch currency, defaults to USD; every item must match"),
  items: z.array(storedBatchItemSchema).min(1).max(1000).describe("1-1000 distinct bills; amount is integer minor units, amountMinor the matching string alias"),
};
export const batchCreateSchema = z.object(batchCreateFields).strict();
export const batchUpdateFields = {
  name: batchCreateFields.name.optional().describe("Optional replacement batch name"),
  addItems: z.array(storedBatchItemSchema).max(1000).optional().describe("Optional additional distinct bills; numeric amounts are integer minor units"),
  removeItemIds: z.array(z.string().uuid().describe("Existing item UUID in this batch")).max(1000).optional().describe("Item UUIDs to remove; unknown or duplicate UUIDs reject"),
};
export const batchUpdateSchema = z.object(batchUpdateFields).strict();
export const batchIdField = z.string().uuid().describe("Live payment batch UUID in the authenticated organization");
export const batchListFields = { page: paymentListFields.page, limit: paymentListFields.limit };
export const batchListSchema = z.object(batchListFields).strict();
export const remittanceFields = {
  contactId: z.string().uuid().optional().describe("Optional supplier UUID present among completed batch items"),
};
export const remittanceSendFields = {
  ...remittanceFields,
  personalMessage: z.string().max(10000).optional().describe("Optional plain text message, HTML escaped before email rendering"),
};
export const remittanceSendSchema = z.object(remittanceSendFields).strict();
export function storedBatchItems(items: z.infer<typeof storedBatchItemSchema>[]) {
  return items.map(item => ({ ...item, amount: creditAmount(item) }));
}
