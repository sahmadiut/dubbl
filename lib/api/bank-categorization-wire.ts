import { z } from "zod";
import { exactMinorSchema, legacyMinor } from "@/lib/money/wire";
import { expenseItemFields, expenseAmount, type ExpenseTransport } from "./expense-wire";
import { currencyCodeSchema } from "@/lib/currency/zod";

export const bankCodingId = z.string().uuid().describe("Bank transaction UUID owned by the authenticated organization");
const dimension = (name: string) => z.string().uuid().nullable().optional().describe(`Optional live organization-owned ${name} UUID; omission or null clears`);
export const bankCodingFields = {
  accountId: z.string().uuid().describe("Live active organization-owned ledger account UUID; denomination must be bank or base currency"),
  contactId: dimension("contact"), taxRateId: dimension("tax rate"), costCenterId: dimension("cost center"), projectId: dimension("project"),
  memo: z.string().max(10000).nullable().optional().describe("Optional journal memo; blank defaults to bank description"),
};
export const bankCodingSchema = z.object(bankCodingFields).strict();
export const bankAllocationFields = {
  ...bankCodingFields,
  amount: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional().describe("Positive allocation in integer bank-currency minor units (USD cents), tax inclusive except reverse charge"),
  amountMinor: exactMinorSchema.optional().describe("Positive canonical minor-unit integer string; agrees with amount; maximum 9007199254740991"),
};
// Contact is transaction-level metadata, not a journal-line dimension.
const { contactId: allocationContact, ...allocationFields } = bankAllocationFields; void allocationContact;
export const bankSplitFields = {
  allocations: z.array(z.object(allocationFields).strict()).min(1).max(1000).describe("1..1000 positive allocations summing exactly to the absolute bank amount"),
};
export const bankSplitSchema = z.object(bankSplitFields).strict();
const { amount, amountExact, amountMinor, date, description, category, accountId } = expenseItemFields;
const bankExpenseItem = z.object({ amount, amountExact, amountMinor, date, description, category, accountId }).strict();
export const bankExpenseFields = {
  title: z.string().min(1).max(10000).describe("Title of the expense paid directly by this outgoing bank transaction"),
  description: z.string().max(10000).nullable().optional().describe("Optional expense description"),
  currencyCode: currencyCodeSchema.optional().describe("Must equal bank currency; defaults to bank currency; never converts item input"),
  contactId: bankCodingFields.contactId, taxRateId: bankCodingFields.taxRateId,
  costCenterId: bankCodingFields.costCenterId, projectId: bankCodingFields.projectId,
  items: z.array(bankExpenseItem).min(1).max(1000)
    .describe("1..1000 expense lines; REST numeric amount is decimal major units; exact aliases amountExact major / amountMinor minor; total must equal outgoing bank magnitude"),
};
export const bankExpenseSchema = z.object(bankExpenseFields).strict();
export const bankExpenseMcpFields = { ...bankExpenseFields,
  items: z.array(bankExpenseItem.extend({
    amount: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional().describe("Optional legacy numeric integer currency minor units, USD 1250 cents = $12.50; must agree with amountExact/amountMinor"),
  })).min(1).max(1000).describe("1..1000 expense lines; numeric amount and amountMinor use integer currency minor units (USD cents); amountExact uses decimal major units; total must equal outgoing bank magnitude"),
};
export const bankExpenseMcpSchema = z.object(bankExpenseMcpFields).strict();
export const bankBulkFields = {
  items: z.array(bankCodingSchema.extend({ transactionId: bankCodingId })).min(1).max(200)
    .describe("1..200 per-account coding items; each item commits or rolls back independently; repeats fail without another posting"),
};
export const bankBulkSchema = z.object(bankBulkFields).strict();
export const bankCashFields = { ...bankCodingFields,
  transactionIds: z.array(bankCodingId).min(1).max(200).describe("1..200 bank transaction UUIDs to code to the same account; per-item failures are reported"),
};
export const bankCashSchema = z.object(bankCashFields).strict();
export function bankAllocationAmount(input: { amount?: number; amountMinor?: string }) {
  if (input.amount === undefined && input.amountMinor === undefined) invalid("Provide allocation amount or amountMinor");
  const minor = BigInt(input.amountMinor ?? input.amount!);
  if (minor <= 0n) invalid("Allocation must be positive");
  if (input.amount !== undefined && BigInt(input.amount) !== minor) invalid("Allocation amount aliases disagree");
  return legacyMinor(minor);
}
export function bankExpenseAmount(input: Parameters<typeof expenseAmount>[0], currency: string, transport: ExpenseTransport = "rest") {
  return expenseAmount(input, currency, transport);
}
function invalid(message: string): never { throw new z.ZodError([{ code: "custom", path: ["amount"], message }]); }
export async function readBankCodingJson(request: Request) {
  try { return await request.json(); } catch { invalid("Invalid JSON bank coding body"); }
}
