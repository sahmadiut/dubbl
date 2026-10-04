import { z } from "zod";
import { creditAmount, creditAmountFields } from "./credit-wire";
import { paymentAllocationFields, paymentPayFields } from "./payment-settlement-wire";
import { legacyMinor } from "@/lib/money/wire";

export const bankMatchId = z.string().uuid().describe("Organization-owned bank transaction UUID");
export const bankMatchPaymentFields = {
  ...creditAmountFields,
  date: paymentPayFields.date.optional().describe("Gregorian payment date YYYY-MM-DD; defaults to the statement date"),
  method: paymentPayFields.method,
};
export const bankDocumentMatchFields = {
  matchType: z.enum(["invoice", "bill", "existing_payment", "existing_journal"]).optional().describe("Match operation; omission infers the type from exactly one target UUID"),
  invoiceId: z.string().uuid().optional().describe("Outstanding recognized organization invoice UUID for received cash"),
  billId: z.string().uuid().optional().describe("Outstanding recognized organization bill UUID for made cash"),
  paymentId: z.string().uuid().optional().describe("Existing posted cash payment UUID on this same bank; noncash carriers are unsupported"),
  journalEntryId: z.string().uuid().optional().describe("Existing posted journal UUID with an exact matching base-currency bank GL leg"),
  ...bankMatchPaymentFields,
};
export const bankDocumentMatchSchema = z.object(bankDocumentMatchFields).strict().superRefine((input, ctx) => {
  const targets = [input.invoiceId, input.billId, input.paymentId, input.journalEntryId].filter(Boolean);
  const target = input.matchType === "invoice" ? input.invoiceId : input.matchType === "bill" ? input.billId
    : input.matchType === "existing_payment" ? input.paymentId : input.matchType === "existing_journal" ? input.journalEntryId : targets[0];
  if (targets.length !== 1 || !target) ctx.addIssue({ code: "custom", message: "Supply exactly one target UUID agreeing with matchType", path: ["matchType"] });
  const cash = input.invoiceId || input.billId;
  if (!cash && (input.amount !== undefined || input.amountMinor !== undefined || input.date !== undefined))
    ctx.addIssue({ code: "custom", message: "Existing-record matching cannot change money or posting dates", path: ["amount"] });
});
export const bankInvoiceMatchSchema = z.object({ invoiceId: bankDocumentMatchFields.invoiceId.unwrap().describe("Organization-owned invoiceId UUID"), ...bankMatchPaymentFields }).strict();
export const bankDocumentSplitFields = {
  allocations: z.array(z.object(paymentAllocationFields).strict()).min(1).max(1000).describe("Distinct same-contact/currency documents; positive minor-unit allocations must cover the entire statement amount"),
  date: bankMatchPaymentFields.date,
  method: bankMatchPaymentFields.method,
};
export const bankDocumentSplitSchema = z.object(bankDocumentSplitFields).strict();

export function bankDocumentAllocations(input: z.infer<typeof bankDocumentSplitSchema>) {
  const allocations = input.allocations.map(row => ({ documentId: row.documentId, documentType: row.documentType, amount: creditAmount(row) }));
  if (new Set(allocations.map(row => row.documentId)).size !== allocations.length)
    throw new z.ZodError([{ code: "custom", path: ["allocations"], message: "Duplicate document allocations are unsupported" }]);
  const amount = legacyMinor(allocations.reduce((sum, row) => sum + BigInt(row.amount), 0n));
  return { allocations, amount };
}
