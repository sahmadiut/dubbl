import { z } from "zod";
import { exactMinorSchema, legacyMinor, WireCompatibilityError } from "@/lib/money/wire";
import { rateDateSchema } from "@/lib/currency/rate-policy";
import { bankReadId } from "./bank-transaction-read-wire";
import { publicMoneyDto } from "./public-money-wire";

const numeric = z.number().int().min(-Number.MAX_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER)
  .refine(value => !Object.is(value, -0), "Negative zero is not canonical money");
export const reconciliationCreateFields = {
  startDate: rateDateSchema.describe("Inclusive Gregorian statement start date YYYY-MM-DD"),
  endDate: rateDateSchema.describe("Inclusive Gregorian statement end date YYYY-MM-DD, at or after startDate"),
  startBalance: numeric.optional().describe("Signed opening balance in integer BANK currency minor units, USD cents"),
  startBalanceMinor: exactMinorSchema.optional().describe("Canonical signed opening minor-unit string; agrees with startBalance; safe numeric range"),
  endBalance: numeric.optional().describe("Signed closing balance in integer BANK currency minor units, USD cents"),
  endBalanceMinor: exactMinorSchema.optional().describe("Canonical signed closing minor-unit string; agrees with endBalance; safe numeric range"),
};
export function reconciliationAmount(input: Record<string, unknown>, key: string) {
  const number = input[key], exact = input[`${key}Minor`];
  if (number === undefined && exact === undefined) throw new z.ZodError([{ code: "custom", path: [key], message: "Provide numeric or exact minor-unit amount" }]);
  const value = exact === undefined ? BigInt(numeric.parse(number)) : BigInt(exactMinorSchema.parse(exact));
  if (number !== undefined && BigInt(numeric.parse(number)) !== value) throw new z.ZodError([{ code: "custom", path: [key], message: "Money aliases disagree" }]);
  return legacyMinor(value);
}
export const reconciliationCreateSchema = z.object(reconciliationCreateFields).strict().superRefine((value, ctx) => {
  if (value.startDate > value.endDate) ctx.addIssue({ code: "custom", path: ["endDate"], message: "End date precedes start date" });
  for (const key of ["startBalance", "endBalance"] as const) if (value[key] === undefined && value[`${key}Minor`] === undefined)
    ctx.addIssue({ code: "custom", path: [key], message: "Provide numeric or exact balance" });
});
export const reconciliationCompleteFields = {
  reconciliationId: bankReadId.describe("In-progress statement session UUID belonging to this bank"),
  transactionIds: z.array(bankReadId).max(10000).optional().describe("Optional distinct accounted statement UUIDs within the session dates; omitted selects all eligible lines; empty selects none"),
};
export const reconciliationCompleteSchema = z.object(reconciliationCompleteFields).strict();
export const reconciliationAdjustmentFields = {
  amount: numeric.optional().describe("Nonzero signed adjustment in integer BANK currency minor units; base-currency banks only"),
  amountMinor: exactMinorSchema.optional().describe("Canonical signed integer minor-unit string agreeing with amount; maximum absolute 9007199254740991"),
  date: rateDateSchema.describe("Open Gregorian adjustment date YYYY-MM-DD"),
  description: z.string().max(10000).optional().describe("Optional adjustment journal description"),
  reconciliationId: bankReadId.optional().describe("Optional in-progress own-bank statement UUID; date must fall inside its window"),
  adjustmentAccountId: bankReadId.optional().describe("Optional active owned base-currency revenue (positive) or expense (negative) GL UUID"),
};
export const reconciliationAdjustmentSchema = z.object(reconciliationAdjustmentFields).strict();
export const reconciliationPostSchema = z.discriminatedUnion("action", [
  reconciliationCompleteSchema.extend({ action: z.literal("complete").describe("Complete a balanced statement session") }),
  reconciliationAdjustmentSchema.extend({ action: z.literal("adjustment").describe("Post an exact reconciliation adjustment") }),
]);
export const reconciliationMarkFields = {
  reconciliationId: bankReadId.nullable().optional().describe("Optional in-progress own-bank session UUID; null means no session"),
  journalEntryId: bankReadId.nullable().optional().describe("Optional existing posted journal UUID with an exact matching bank leg; no new posting"),
};
export const reconciliationMarkSchema = z.object(reconciliationMarkFields).strict();
export function reconciliationDto<T extends { startBalance: number; endBalance: number; startDate: string; endDate: string }>(row: T) {
  if (!rateDateSchema.safeParse(row.startDate).success || !rateDateSchema.safeParse(row.endDate).success || row.startDate > row.endDate)
    throw new WireCompatibilityError("Saved reconciliation dates are inconsistent");
  return publicMoneyDto(row, ["startBalance", "endBalance"]);
}
