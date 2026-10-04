import { z } from "zod";
import { currencyCodeSchema } from "@/lib/currency/zod";
import { exactMinorSchema, legacyMinor, WireCompatibilityError } from "@/lib/money/wire";
import { publicMoneyDto } from "./public-money-wire";

export const bankAccountIdField = z.string().uuid().describe("Live bank account UUID in the authenticated organization");
const numeric = z.number().int().min(-Number.MAX_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER)
  .refine(value => !Object.is(value, -0), "Negative zero is not canonical money");
export const bankAccountCreateFields = {
  accountName: z.string().min(1).max(10000).describe("Nonempty bank account name"),
  accountNumber: z.string().max(10000).nullable().optional().describe("Optional account number; null clears"),
  bankName: z.string().max(10000).nullable().optional().describe("Optional bank name; null clears"),
  currencyCode: currencyCodeSchema.default("USD").describe("ISO currency, defaults to USD; stored minor units never rescale"),
  countryCode: z.string().length(2).nullable().optional().describe("Optional two-character country code; null clears"),
  accountType: z.enum(["checking", "savings", "credit_card", "cash", "loan", "investment", "other"]).default("checking").describe("Bank account type; determines asset or liability GL account"),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#0f766e").describe("Six-digit hexadecimal display color"),
  chartAccountId: z.string().uuid().nullable().optional().describe("Optional unclaimed active organization-owned GL UUID with matching type/currency; null allocates a GL account"),
  balance: numeric.optional().describe("Signed statement balance in integer currency minor units, USD 1250 cents; defaults to zero; does not post opening GL"),
  balanceMinor: exactMinorSchema.optional().describe("Canonical signed integer minor-unit string; agrees with balance; supported range +/-9007199254740991"),
};
export const bankAccountUpdateFields = {
  accountName: bankAccountCreateFields.accountName.optional().describe("Optional replacement nonempty account name"),
  accountNumber: bankAccountCreateFields.accountNumber,
  bankName: bankAccountCreateFields.bankName,
  countryCode: bankAccountCreateFields.countryCode,
  chartAccountId: bankAccountCreateFields.chartAccountId,
  balance: bankAccountCreateFields.balance,
  balanceMinor: bankAccountCreateFields.balanceMinor,
  currencyCode: bankAccountCreateFields.currencyCode.removeDefault().optional().describe("Optional replacement currency; only empty accounts can change currency"),
  accountType: bankAccountCreateFields.accountType.removeDefault().optional().describe("Optional replacement type; requires no statement/payment/GL history"),
  color: bankAccountCreateFields.color.removeDefault().optional().describe("Optional six-digit hexadecimal display color"),
  isActive: z.boolean().optional().describe("Optional active status"),
};
export const bankAccountCreateSchema = z.object(bankAccountCreateFields).strict();
export const bankAccountUpdateSchema = z.object(bankAccountUpdateFields).strict();
export const bankBalanceAlertFields = {
  threshold: numeric.nullable().optional().describe("Signed low balance threshold in integer currency minor units; null clears"),
  thresholdMinor: exactMinorSchema.nullable().optional().describe("Canonical signed minor-unit threshold string, +/-9007199254740991; null clears; agrees with threshold"),
};
export const bankBalanceAlertSchema = z.object(bankBalanceAlertFields).strict();
export function bankMinor(value: number | null | undefined, exact: string | null | undefined, required = false) {
  if (value !== undefined && exact !== undefined && exact !== (value === null ? null : String(value)))
    throw new z.ZodError([{ code: "custom", path: [], message: "Numeric and exact money aliases disagree" }]);
  if (value === undefined && exact === undefined && required)
    throw new z.ZodError([{ code: "custom", path: [], message: "Provide a numeric or exact money alias" }]);
  return exact === null ? null : exact === undefined ? value : legacyMinor(BigInt(exact));
}
export function bankAccountDto<T extends { balance: number; lowBalanceThreshold: number | null; currencyCode: string }>(row: T) {
  const currency = currencyCodeSchema.safeParse(row.currencyCode);
  if (!currency.success || currency.data !== row.currencyCode) throw new WireCompatibilityError("Unrecognized or noncanonical saved bank currency");
  return { ...publicMoneyDto(row, ["balance"]), lowBalanceThresholdMinor: row.lowBalanceThreshold === null ? null
    : publicMoneyDto({ amount: row.lowBalanceThreshold }, ["amount"]).amountMinor };
}
export async function readBankAccountJson(request: Request): Promise<unknown> {
  try { return await request.json(); } catch {
    throw new z.ZodError([{ code: "custom", path: [], message: "Invalid JSON bank account body" }]);
  }
}
