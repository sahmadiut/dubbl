import { z } from "zod";
import { exactMinorSchema, legacyMinorSchema, legacyMinor, stringifyWire, WireCompatibilityError } from "@/lib/money/wire";
import { invoiceDecimalRatio, invoiceRound } from "./invoice-write-wire";
import { assetDate, assetMoneyDto } from "./asset-master-wire";

export const accrualId = z.string().uuid().describe("Accrual schedule, period, journal or account UUID in the authenticated organization");
const date = assetDate.refine(v => v >= "0001-01-01", "Gregorian year must be 0001..9999");
const retry = z.string().min(1).max(200).optional().describe("Optional organization-scoped retry key; normalized identical input replays, changed input conflicts");
const common = {
  sourceEntryId: accrualId.optional().describe("Optional live organization-owned posted source journal UUID"),
  totalAmountMinor: exactMinorSchema.refine(v => !v.startsWith("-") && v !== "0", "Amount must be positive").optional()
    .describe("Positive canonical integer CENTS string, max 9007199254740991; agrees with other aliases; no currency rescaling"),
  startDate: date.describe("First period, Gregorian YYYY-MM-DD; subsequent dates use UTC calendar-month overflow from this date"),
  endDate: date.describe("Gregorian YYYY-MM-DD, at least the last generated period date"),
  periods: z.number().int().min(1).max(1200).describe("Monthly period count, 1..1200; last period absorbs exact floor-division remainder"),
  accountId: accrualId.describe("Live active organization-owned base-currency GL UUID credited each period"),
  reverseAccountId: accrualId.describe("Distinct live active organization-owned base-currency GL UUID debited each period"),
  description: z.string().min(1).max(10000).describe("Nonempty accrual description, at most 10000 characters"),
  idempotencyKey: retry,
};
export const accrualCreateRestSchema = z.object({ ...common,
  totalAmount: z.number().positive().max(Number.MAX_SAFE_INTEGER).optional()
    .describe("Legacy decimal major amount: 12.50 stores 1250 CENTS in every currency; positive ties round up"),
  totalAmountExact: z.string().max(40).regex(/^(?:0|[1-9]\d{0,19})(?:\.\d{1,18})?$/).optional()
    .describe("Exact positive decimal major amount string; fixed two-decimal cents, positive ties round up; agrees with numeric major alias"),
}).strict();
export const accrualCreateMcpSchema = z.object({ ...common,
  totalAmount: legacyMinorSchema.positive().optional().describe("Positive integer CENTS, max 9007199254740991; 1250 stores 1250 without multiplication"),
}).strict();
export const accrualPostSchema = z.object({
  entryId: accrualId.optional().describe("Optional expected next period UUID; successful target replays without posting another period"),
  idempotencyKey: retry,
}).strict();
export const accrualListSchema = z.object({
  status: z.enum(["active", "completed", "cancelled"]).optional().describe("Optional status filter"),
  page: z.number().int().min(1).max(1000000).default(1).describe("One-based page, max 1000000"),
  limit: z.number().int().min(1).max(100).default(50).describe("Page size, 1..100"),
}).strict();
function invalid(message: string): never {
  throw new z.ZodError([{ code: "custom", path: ["totalAmount"], message }]);
}
export function accrualInput(input: unknown, transport: "rest" | "mcp") {
  const p = transport === "rest" ? accrualCreateRestSchema.parse(input) : accrualCreateMcpSchema.parse(input);
  const exact = "totalAmountExact" in p && typeof p.totalAmountExact === "string" ? p.totalAmountExact : undefined;
  const numeric = p.totalAmount === undefined ? undefined : invoiceDecimalRatio(p.totalAmount);
  const decimal = exact === undefined ? undefined : invoiceDecimalRatio(exact);
  if (numeric && decimal && numeric.numerator * decimal.denominator !== decimal.numerator * numeric.denominator)
    invalid("Major amount aliases disagree");
  let amount: bigint | undefined;
  const major = decimal ?? numeric;
  if (p.totalAmount !== undefined && transport === "mcp") amount = BigInt(p.totalAmount);
  else if (major) amount = invoiceRound(major.numerator * 100n, major.denominator);
  if (p.totalAmountMinor !== undefined) {
    const minor = BigInt(p.totalAmountMinor);
    if (amount !== undefined && amount !== minor) invalid("Cents alias disagrees with rounded amount");
    amount = minor;
  }
  if (amount === undefined || amount <= 0n) invalid("Provide a positive totalAmount, totalAmountExact (REST) or totalAmountMinor");
  // Strip transport-only aliases from storage and normalized retry fingerprint.
  return { values: { sourceEntryId: p.sourceEntryId, accountId: p.accountId, reverseAccountId: p.reverseAccountId,
    startDate: p.startDate, endDate: p.endDate, periods: p.periods, description: p.description, totalAmount: legacyMinor(amount) },
    idempotencyKey: p.idempotencyKey };
}
/** Preserve the legacy month-overflow rule, but use UTC regardless of host timezone. */
export function accrualPeriods(total: number, start: string, end: string, count: number) {
  legacyMinorSchema.positive().parse(total); date.parse(start); date.parse(end); common.periods.parse(count);
  const per = BigInt(total) / BigInt(count);
  const entries = Array.from({ length: count }, (_, i) => {
    const d = new Date(start + "T00:00:00Z"); d.setUTCMonth(d.getUTCMonth() + i);
    const periodDate = d.toISOString().slice(0, 10);
    if (!date.safeParse(periodDate).success || periodDate > end) invalid("Generated periods must fit endDate and Gregorian years 0001..9999");
    return { periodDate, amount: legacyMinor(i === count - 1 ? BigInt(total) - per * BigInt(count - 1) : per), sortOrder: i };
  });
  return entries;
}
export const accrualDto = <T extends object>(row: T) => assetMoneyDto(row, ["totalAmount"]);
export const accrualEntryDto = <T extends object>(row: T) => assetMoneyDto(row, ["amount"]);
export function accrualPreflight<T>(value: T): T {
  try { stringifyWire(value); return value; }
  catch { throw new WireCompatibilityError("Unsupported accrual response"); }
}
