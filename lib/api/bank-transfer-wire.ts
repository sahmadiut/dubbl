import { z } from "zod";
import { rateDateSchema } from "@/lib/currency/rate-policy";
import { expenseAmount, expenseItemFields, type ExpenseTransport } from "./expense-wire";
import { bankReadId } from "./bank-transaction-read-wire";

export const bankTransferFields = {
  fromBankAccountId: bankReadId.describe("Live organization-owned sending bank UUID; must differ from receiving bank"),
  toBankAccountId: bankReadId.describe("Live organization-owned receiving bank UUID in the same currency"),
  amount: expenseItemFields.amount.describe("Optional positive legacy REST decimal major-unit amount, USD 12.50; rounds once to currency minor units"),
  amountExact: expenseItemFields.amountExact.describe("Optional exact positive decimal major-unit string, USD '12.50'; agrees with amount"),
  amountMinor: expenseItemFields.amountMinor.describe("Optional positive canonical integer currency minor-unit string, USD '1250'; maximum 9007199254740991"),
  date: rateDateSchema.describe("Gregorian transfer date YYYY-MM-DD; must be in an open period and fiscal year"),
  memo: z.string().max(10000).nullable().optional().describe("Optional transfer note; blank or null becomes no reference"),
};
export const bankTransferMcpFields = { ...bankTransferFields,
  amount: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional().describe("Optional positive legacy integer currency minor units, USD 1250 cents = $12.50; agrees with exact aliases"),
};
export const bankTransferSchema = z.object(bankTransferFields).strict();
export const bankTransferMcpSchema = z.object(bankTransferMcpFields).strict();
export const bankMatchTransferFields = {
  targetBankAccountId: bankReadId.describe("Other live organization-owned bank UUID in the same currency as the source"),
  counterTransactionId: bankReadId.nullable().optional().describe("Optional unlinked unreconciled statement UUID in target bank, opposite sign and equal amount; omit/null creates a mirror"),
};
export const bankMatchTransferSchema = z.object(bankMatchTransferFields).strict();
export function bankTransferAmount(input: Parameters<typeof expenseAmount>[0], currency: string, transport: ExpenseTransport = "rest") {
  const amount = expenseAmount(input, currency, transport);
  if (amount <= 0) throw new z.ZodError([{ code: "custom", path: ["amount"], message: "Transfer amount must round to positive minor units" }]);
  return amount;
}
export async function readBankTransferJson(request: Request): Promise<unknown> {
  try { return await request.json(); } catch {
    throw new z.ZodError([{ code: "custom", path: [], message: "Invalid JSON bank transfer body" }]);
  }
}
