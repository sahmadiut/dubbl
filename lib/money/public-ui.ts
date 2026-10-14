import { z } from "zod";
import { currencyMetadata } from "./exact";
import { coreStoredMinor } from "./core-presentation";
import { exactMinorSchema } from "./wire";
import { documentSum } from "../documents/render-wire";
import { bankMoneyDisplay } from "./bank-display";

/** Email callers supply amounts already validated by their document adapter. */
export function publicEmailMoney(amount: number | bigint | undefined, currencyCode: string | undefined) {
  if (amount === undefined) return undefined;
  if (!currencyCode || currencyMetadata(currencyCode).code !== currencyCode) throw new RangeError("A saved email currency is required");
  if (typeof amount === "number" && Object.is(amount, -0)) throw new RangeError("Unsupported email amount");
  return bankMoneyDisplay(amount, currencyCode);
}

const currency = z.string().refine(value => {
  try { return currencyMetadata(value).code === value; } catch { return false; }
}, "A saved currency is required");
const numeric = z.number().refine(value => Number.isSafeInteger(value) && !Object.is(value, -0));
const fields = <K extends string>(...keys: K[]) => Object.fromEntries(keys.flatMap(key => [
  [key, numeric], [`${key}Minor`, exactMinorSchema],
])) as Record<K, typeof numeric> & Record<`${K}Minor`, typeof exactMinorSchema>;
function validate<T extends Record<string, unknown>>(row: T, keys: readonly string[]): T {
  for (const key of keys) coreStoredMinor(row[key] as number, row[`${key}Minor`] as string);
  return row;
}
const line = z.object({ description: z.string(), quantity: numeric, discountPercent: numeric.optional(),
  ...fields("unitPrice", "amount", "taxAmount"),
}).transform(row => {
  validate(row, ["unitPrice", "amount", "taxAmount"]);
  documentSum(row.amount, row.taxAmount);
  return row;
});
const invoice = z.object({ id: z.string(), invoiceNumber: z.string(), issueDate: z.string(), dueDate: z.string(),
  currencyCode: currency, ...fields("total", "amountDue"),
}).transform(row => validate(row, ["total", "amountDue"]));
const quoteHeader = z.object({ id: z.string(), quoteNumber: z.string(), issueDate: z.string(), expiryDate: z.string(),
  status: z.string(), currencyCode: currency, ...fields("subtotal", "taxTotal", "total", "billedTotal"),
}).transform(row => validate(row, ["subtotal", "taxTotal", "total", "billedTotal"]));
export const publicPaymentSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("paid"), invoice: z.object({ invoiceNumber: z.string() }) }),
  z.object({ status: z.literal("pending"), invoice: invoice.and(z.object({ lines: z.array(line) })),
    organization: z.object({ name: z.string() }), contact: z.object({ name: z.string() }) }),
]);
export const portalInvoicesSchema = z.object({ data: z.array(invoice.and(z.object({ status: z.string(), paymentLinkToken: z.string().nullable().optional() }))) });
export const portalPaymentsSchema = z.object({ data: z.array(z.object({ invoiceNumber: z.string(), invoiceId: z.string(),
  paidAt: z.string().nullable(), status: z.string(), currencyCode: currency, ...fields("amountPaid", "total"),
}).transform(row => validate(row, ["amountPaid", "total"]))) });
export const portalQuotesSchema = z.object({ data: z.array(quoteHeader.and(z.object({ lines: z.array(line) }))) });
export const acceptedQuoteSchema = quoteHeader;
export const portalStatementSchema = z.object({ currencyCode: currency, ...fields("totalOutstanding"), lines: z.array(z.object({
  date: z.string(), description: z.string(), status: z.string(), currencyCode: currency,
  ...fields("amount", "paid", "balance", "runningBalance"),
}).transform(row => validate(row, ["amount", "paid", "balance", "runningBalance"]))) }).transform(row => {
  validate(row, ["totalOutstanding"]);
  let running = 0n;
  for (const line of row.lines) {
    if (line.currencyCode !== row.currencyCode) throw new RangeError("Statement currencies disagree");
    running += BigInt(line.balanceMinor);
    if (running !== BigInt(line.runningBalanceMinor)) throw new RangeError("Statement running balance disagrees");
  }
  if (running !== BigInt(row.totalOutstandingMinor)) throw new RangeError("Statement total disagrees");
  return row;
});
