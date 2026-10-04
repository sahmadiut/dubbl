import { z } from "zod";
import { rateDateSchema } from "@/lib/currency/rate-policy";
import { exactMinorSchema, legacyMinorSchema, legacyMinor, stringifyWire, WireCompatibilityError } from "@/lib/money/wire";

export const taxPeriodId = z.string().uuid().describe("Organization-owned tax period UUID");
const text = z.string().max(10000);
export const taxPeriodFields = {
  name: text.min(1).describe("Tax period display name"),
  startDate: rateDateSchema.describe("Inclusive Gregorian start date YYYY-MM-DD"),
  endDate: rateDateSchema.describe("Inclusive Gregorian end date YYYY-MM-DD; must not precede start"),
  type: z.enum(["monthly", "quarterly", "annual"]).describe("Filing frequency; does not impose a statutory calendar"),
  notes: text.optional().describe("Optional notes"),
};
export const taxPeriodCreateSchema = z.object(taxPeriodFields).strict();
export const taxPeriodUpdateSchema = z.object({ ...taxPeriodFields,
  notes: text.nullable().optional().describe("Optional notes; null clears"),
}).partial().strict();
export const taxPeriodFileSchema = z.object({
  filedReference: text.optional().describe("Optional filing reference"),
  basis: z.enum(["accrual", "cash"]).optional().describe("Recognition basis; omission uses organization vatScheme; cash uses existing cash-entry heuristic"),
  flatRatePercent: z.number().int().positive().max(2147483647).optional()
    .describe("Positive int32 basis points, 1000=10%; retains legacy zero boxes 1/4, without turnover computation"),
}).strict();
export const taxSettlementSchema = z.object({
  bankGlAccountId: z.string().uuid().describe("Live active organization-owned bank/cash GL UUID, denominated in base currency"),
  amount: legacyMinorSchema.min(0).refine(v => !Object.is(v, -0), "Negative zero is not canonical").optional().describe("Nonnegative base-currency minor-unit integer; maximum 9007199254740991; zero is a no-op"),
  amountMinor: exactMinorSchema.refine(v => !v.startsWith("-"), "Amount must be nonnegative").optional()
    .describe("Canonical nonnegative minor-unit string, agrees with amount; safe Number coexistence range"),
  isRefund: z.boolean().default(false).describe("true: bank debit and suspense credit; false: suspense debit and bank credit"),
  date: rateDateSchema.optional().describe("Gregorian settlement date; omission uses today's UTC date"),
  reference: text.optional().describe("Optional settlement reference"),
}).strict();
export function taxSettlementAmount(input: z.infer<typeof taxSettlementSchema>) {
  if (input.amount === undefined && input.amountMinor === undefined) throw new z.ZodError([{ code: "custom", path: ["amount"], message: "Supply amount or amountMinor" }]);
  if (input.amount !== undefined && input.amountMinor !== undefined && BigInt(input.amount) !== BigInt(input.amountMinor))
    throw new z.ZodError([{ code: "custom", path: ["amountMinor"], message: "Money aliases disagree" }]);
  return legacyMinor(BigInt(input.amountMinor ?? input.amount!));
}
export function taxPeriodRange(start: string, end: string) {
  rateDateSchema.parse(start); rateDateSchema.parse(end);
  if (start > end) throw new z.ZodError([{ code: "custom", path: ["endDate"], message: "End date precedes start date" }]);
}
export function taxSafeMinor(value: bigint) {
  const limit = BigInt(Number.MAX_SAFE_INTEGER);
  if (value < -limit || value > limit) throw new WireCompatibilityError("Tax money or aggregate exceeds the safe Number coexistence range");
  return legacyMinor(value);
}
export function taxReturnLineDto<T extends { amount: number }>(line: T) {
  if (!Number.isSafeInteger(line.amount) || Object.is(line.amount, -0)) throw new WireCompatibilityError("Unsupported saved return line amount");
  return { ...line, amountMinor: String(line.amount) };
}
export function taxPeriodDto<T extends { startDate: string; endDate: string; lines?: { amount: number }[] }>(row: T) {
  try { taxPeriodRange(row.startDate, row.endDate); }
  catch { throw new WireCompatibilityError("Unsupported saved tax period date range"); }
  const result = row.lines === undefined ? row : { ...row, lines: row.lines.map(taxReturnLineDto) };
  stringifyWire(result); return result;
}
