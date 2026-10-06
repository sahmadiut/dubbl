import { z } from "zod";
import { exactMinorSchema, legacyMinorSchema, legacyMinor, stringifyWire, WireCompatibilityError } from "@/lib/money/wire";
import { invoiceDecimalRatio, invoiceRound } from "./invoice-write-wire";
import { assetDate, assetMoneyDto } from "./asset-master-wire";

export const revenueId = z.string().uuid().describe("Organization-owned revenue schedule, invoice, line or period UUID");
const date = assetDate.refine(v => v >= "0001-01-01", "Gregorian year must be 0001..9999");
const retry = z.string().min(1).max(200).optional().describe("Optional organization-scoped retry key; identical normalized input replays, changed input conflicts");
const common = {
  invoiceId: revenueId.describe("Live organization-owned invoice UUID; draft schedules may be prepared, recognition requires an issued invoice"),
  invoiceLineId: revenueId.optional().describe("Optional line UUID belonging to that invoice; its account is credited, otherwise account 4000"),
  totalAmountMinor: exactMinorSchema.refine(v => !v.startsWith("-") && v !== "0", "Amount must be positive").optional()
    .describe("Positive canonical integer CENTS string, max 9007199254740991; agrees with other aliases; no currency rescaling"),
  startDate: date.describe("First period Gregorian YYYY-MM-DD; subsequent dates retain UTC month overflow from this date"),
  endDate: date.describe("Gregorian YYYY-MM-DD at or after startDate; inclusive calendar months determine 1..1200 periods"),
  method: z.enum(["straight_line", "milestone", "on_completion"]).default("straight_line")
    .describe("Stored method label; every existing method generates equal monthly floor allocations with last-period remainder"),
  idempotencyKey: retry,
};
export const revenueCreateRestSchema = z.object({ ...common,
  totalAmount: z.number().positive().max(Number.MAX_SAFE_INTEGER).optional()
    .describe("Legacy decimal major amount: 12.50 stores 1250 CENTS in every currency; positive ties round up"),
  totalAmountExact: z.string().max(40).regex(/^(?:0|[1-9]\d{0,19})(?:\.\d{1,18})?$/).optional()
    .describe("Exact positive decimal major string; fixed two-decimal cents, positive ties round up; agrees with numeric major alias"),
}).strict();
export const revenueCreateMcpSchema = z.object({ ...common,
  totalAmount: legacyMinorSchema.positive().optional().describe("Positive integer CENTS, max 9007199254740991; 1250 stores 1250 without multiplication"),
}).strict();
export const revenueRecognizeSchema = z.object({
  entryId: revenueId.optional().describe("Optional expected next period UUID; recognized targets replay without advancing"),
  idempotencyKey: retry,
}).strict();
export const revenueListSchema = z.object({
  status: z.enum(["active", "completed", "cancelled"]).optional().describe("Optional status filter"),
  page: z.number().int().min(1).max(1000000).default(1).describe("One-based page, max 1000000"),
  limit: z.number().int().min(1).max(100).default(50).describe("Page size, 1..100"),
}).strict();
function invalid(message: string): never {
  throw new z.ZodError([{ code: "custom", path: ["totalAmount"], message }]);
}
export function revenueInput(input: unknown, transport: "rest" | "mcp") {
  const p = transport === "rest" ? revenueCreateRestSchema.parse(input) : revenueCreateMcpSchema.parse(input);
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
  return { values: { invoiceId: p.invoiceId, invoiceLineId: p.invoiceLineId ?? null, totalAmount: legacyMinor(amount),
    startDate: p.startDate, endDate: p.endDate, method: p.method }, idempotencyKey: p.idempotencyKey };
}
/** Inclusive calendar months and legacy month overflow, made independent of host timezone. */
export function revenuePeriods(total: number, start: string, end: string) {
  legacyMinorSchema.positive().parse(total); date.parse(start); date.parse(end);
  if (end < start) invalid("endDate must be at or after startDate");
  const first = new Date(start + "T00:00:00Z"), last = new Date(end + "T00:00:00Z");
  const count = (last.getUTCFullYear() - first.getUTCFullYear()) * 12 + last.getUTCMonth() - first.getUTCMonth() + 1;
  if (count < 1 || count > 1200) invalid("Inclusive month count must be 1..1200");
  const per = BigInt(total) / BigInt(count);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(first); d.setUTCMonth(d.getUTCMonth() + i);
    const periodDate = d.toISOString().slice(0, 10);
    if (!date.safeParse(periodDate).success) invalid("Generated period exceeds supported Gregorian years");
    return { periodDate, amount: legacyMinor(i === count - 1 ? BigInt(total) - per * BigInt(count - 1) : per), sortOrder: i };
  });
}
export const revenueDto = <T extends object>(row: T) => assetMoneyDto(row, ["totalAmount", "recognizedAmount"]);
export const revenueEntryDto = <T extends object>(row: T) => assetMoneyDto(row, ["amount"]);
export function revenuePreflight<T>(value: T): T {
  try { stringifyWire(value); return value; }
  catch { throw new WireCompatibilityError("Unsupported revenue response"); }
}
