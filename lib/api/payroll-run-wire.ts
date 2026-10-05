import { z } from "zod";
import { payrollDate } from "./payroll-master-wire";
import { exactMinorSchema, legacyMinorSchema, legacyMinor, stringifyWire, WireCompatibilityError } from "@/lib/money/wire";
import { exactRate } from "@/lib/currency/exact-rate";
import { currencyCodeSchema } from "@/lib/currency/zod";
import { payrollInteger, payrollLegacyRate, payrollReal } from "@/lib/payroll/exact";

export const runId = z.string().uuid().describe("Payroll record UUID in the authenticated organization");
const date = payrollDate.refine(v => v.slice(0, 4) !== "0000", "Year must be 1..9999").describe("Valid Gregorian YYYY-MM-DD, year 1..9999");
const notes = z.string().max(10000).nullable().optional().describe("Optional notes; null clears");
const cents = legacyMinorSchema.refine(v => !Object.is(v, -0), "Negative zero is not canonical");
const amount = cents.min(1).optional().describe("Positive integer cents in employee currency, max 9007199254740991; amount or amountMinor required");
const amountMinor = exactMinorSchema.refine(v => v !== "0" && !v.startsWith("-"), "Amount must be positive").optional().describe("Canonical positive cents string; same safe range; must agree with amount");
export const runCreateSchema = z.object({ payPeriodStart: date, payPeriodEnd: date,
  runType: z.enum(["regular", "off_cycle"]).optional().describe("Draft run type; use dedicated operations for bonus_only, termination or correction"),
}).strict();
export const bonusCreateSchema = z.object({ employeeId: runId.describe("Live active owned employee UUID"),
  bonusType: z.enum(["performance", "signing", "referral", "holiday", "spot", "retention", "other"]).describe("Bonus category"),
  amount, amountMinor, description: notes.describe("Optional bonus description; null clears"),
}).strict();
export const bonusRunSchema = runCreateSchema.omit({ runType: true }).extend({ notes,
  bonuses: z.array(bonusCreateSchema).min(1).max(200).describe("1..200 bonuses in each employee's pay currency; withholding calculated once per employee"),
});
export const terminationRunSchema = runCreateSchema.omit({ runType: true }).extend({ employeeId: runId.describe("Live active owned employee UUID"),
  includeUnusedPto: z.boolean().optional().describe("Include existing binary32 PTO hours, clear paid PTO on completion; defaults false"), notes,
});
export const correctionRunSchema = z.object({ parentRunId: runId.describe("Completed owned parent run UUID; preserve its per-employee FX and deductions"), notes,
  adjustments: z.array(z.object({ employeeId: runId.describe("Owned employee present in the parent run"),
    grossAdjustment: cents.optional().describe("Signed safe integer cents in parent employee currency; positive pays more, negative claws back"),
    grossAdjustmentMinor: exactMinorSchema.optional().describe("Canonical signed cents string; same safe range; must agree with grossAdjustment"),
    description: notes.describe("Optional correction description"),
  }).strict()).min(1).max(200).describe("1..200 adjustments; one per employee; nonzero grossAdjustment or grossAdjustmentMinor required"),
}).strict();
export const runUpdateSchema = z.object({ notes }).strict();
export const runRejectSchema = z.object({ reason: notes.describe("Optional rejection reason") }).strict();
export const runProcessSchema = z.object({ accrued: z.boolean().optional().describe("Credit net wages to payable account 2310 instead of paying bank; defaults false. Completed retries return the existing journal.") }).strict();
export const runListSchema = z.object({
  page: z.number().int().min(1).max(1000000).default(1).describe("One-based page, max 1000000"),
  limit: z.number().int().min(1).max(200).default(50).describe("Page size, max 200"),
  status: z.enum(["draft", "processing", "completed", "void", "pending_approval"]).optional().describe("Optional status filter"),
}).strict();
export function runQuery(url: URL) {
  const numeric = (key: string) => { const v = url.searchParams.get(key); if (v === null) return undefined;
    if (!/^[1-9]\d{0,6}$/.test(v)) throw new z.ZodError([{ code: "custom", path: [key], message: "Use a positive integer" }]); return Number(v); };
  const parsed = runListSchema.parse({ page: numeric("page"), limit: numeric("limit"), status: url.searchParams.get("status") ?? undefined });
  z.number().max(100).parse(parsed.limit); return parsed;
}
export async function runProcessBody(request: Request) {
  const body = await request.text(); if (!body.length) return {};
  try { return JSON.parse(body) as unknown; } catch { throw new z.ZodError([{ code: "custom", path: [], message: "Invalid JSON payroll body" }]); }
}
export function runAmount(input: Record<string, unknown>, field = "amount"): number {
  const numeric = input[field], alias = input[field + "Minor"];
  if (numeric === undefined && alias === undefined) throw new z.ZodError([{ code: "custom", path: [field], message: `Provide ${field} or ${field}Minor` }]);
  if (numeric !== undefined) cents.parse(numeric);
  if (alias !== undefined) exactMinorSchema.parse(alias);
  if (numeric !== undefined && alias !== undefined && alias !== String(numeric))
    throw new z.ZodError([{ code: "custom", path: [field + "Minor"], message: "Money aliases disagree" }]);
  const value = alias === undefined ? numeric as number : legacyMinor(BigInt(alias as string));
  if ((field === "amount" && value <= 0) || (field === "grossAdjustment" && value === 0))
    throw new z.ZodError([{ code: "custom", path: [field], message: "Amount must be nonzero; bonuses must be positive" }]);
  return value;
}
/** Add explicit cents aliases to actual money columns, never hours, counts, basis points or FX. */
export function runMoneyDto<T extends object>(row: T, fields: readonly string[]) {
  const result = { ...row } as T & Record<string, unknown>;
  for (const field of fields) {
    const value = (row as Record<string, unknown>)[field];
    if (value === undefined) continue;
    if (value !== null) { if (Object.is(value, -0)) throw new WireCompatibilityError("Noncanonical saved money"); payrollInteger(value as number); }
    (result as Record<string, unknown>)[field + "Minor"] = value === null ? null : String(value);
  }
  stringifyWire(result); return result;
}
export const runMoneyFields = ["totalGross", "totalDeductions", "totalNet"] as const;
export const itemMoneyFields = ["grossAmount", "taxAmount", "deductions", "netAmount", "overtimeAmount", "bonusAmount", "preTaxDeductions", "postTaxDeductions"] as const;
export function itemRate(row: { rateExact: string | null; rateMigrationStatus: string; rateFormatVersion: number; rateDirection: string; fxRate: number | null }) {
  if (row.rateMigrationStatus === "exact" && row.rateExact !== null && row.rateFormatVersion === 1 && row.rateDirection === "quote_per_base") return exactRate(row.rateExact);
  if (row.rateExact === null && row.rateMigrationStatus === "pending" && row.rateFormatVersion === 1 && row.rateDirection === "quote_per_base" && row.fxRate !== null) return payrollLegacyRate(row.fxRate);
  throw new WireCompatibilityError("Payroll item's stored FX is unsupported or quarantined");
}
export function runItemDto<T extends { currency: string | null; overtimeHours: number | null; fxRate: number | null; rateExact: string | null; rateMigrationStatus: string; rateFormatVersion: number; rateDirection: string }>(row: T): T & Record<string, unknown> & { rateExact: string } {
  try {
    if (row.currency === null || currencyCodeSchema.parse(row.currency) !== row.currency) throw new Error("Currency required");
    if (row.overtimeHours !== null) payrollReal(row.overtimeHours);
    // PostgreSQL float4 text uses the shortest round-tripping decimal (e.g. 1.2).
    // Recover that stored binary32 value for the explicitly approximate legacy field.
    const fxRate = row.fxRate === null ? null : Math.fround(row.fxRate);
    if (fxRate !== null && (!Number.isFinite(fxRate) || fxRate <= 0)) throw new Error("Invalid legacy FX");
    if (row.rateMigrationStatus === "exact" && row.rateExact !== null && fxRate !== null && Math.fround(Number(row.rateExact)) !== fxRate)
      throw new Error("FX approximation disagrees with decimal snapshot");
    return { ...runMoneyDto(row, itemMoneyFields), fxRate, rateExact: itemRate({ ...row, fxRate }) };
  } catch (error) { if (error instanceof WireCompatibilityError) throw error; throw new WireCompatibilityError("Unsupported saved payroll item units or FX"); }
}
