import { z } from "zod";
import { journalLineFields, journalLineInput, journalTotals } from "./journal-wire";
import { currencyCodeSchema } from "@/lib/currency/zod";
import { WireCompatibilityError } from "@/lib/money/wire";

export const recurringJournalLeg = z.strictObject({
  description: z.string().min(1).describe("Journal leg memo"),
  accountId: journalLineFields.accountId,
  debitAmount: journalLineFields.debitAmount,
  debitAmountMinor: journalLineFields.debitAmountMinor,
  creditAmount: journalLineFields.creditAmount,
  creditAmountMinor: journalLineFields.creditAmountMinor,
  costCenterId: journalLineFields.costCenterId,
});
export const recurringJournalFields = {
  name: z.string().min(1).describe("Template name"),
  frequency: z.enum(["weekly", "fortnightly", "monthly", "quarterly", "semi_annual", "annual"]).describe("Occurrence frequency; existing UTC date advancement applies"),
  startDate: z.iso.date().describe("First run, canonical Gregorian YYYY-MM-DD"),
  endDate: z.iso.date().nullable().optional().describe("Inclusive last run date; null means unlimited"),
  maxOccurrences: z.number().int().min(1).max(2147483647).nullable().optional().describe("Int32 occurrence cap including skipped locked dates; null means unlimited"),
  reference: z.string().nullable().optional().describe("Optional reference on generated journals"),
  notes: z.string().nullable().optional().describe("Optional generated journal description"),
  currencyCode: currencyCodeSchema.default("USD").describe("Saved template currency tag; stored minor units post verbatim at fixed 1:1, without currency conversion"),
  exchangeRate: z.literal(1000000).optional().describe("Fixed identity rate in legacy millionths; recurring templates do not store configurable FX"),
  rateExact: journalLineFields.rateExact.optional().describe("Fixed identity quote-per-base decimal string only; nonidentity FX is unsupported"),
  rateDirection: journalLineFields.rateDirection,
  lines: z.array(recurringJournalLeg).min(2).describe("Balanced nonzero legs, safe-integer stored minor units (USD cents); each leg has one positive side"),
};
export const recurringJournalCreateSchema = z.strictObject(recurringJournalFields);
export const recurringJournalUpdateSchema = recurringJournalCreateSchema.omit({ startDate: true }).extend({
  currencyCode: currencyCodeSchema.describe("Optional replacement currency tag; omitted retains the saved tag, without rescaling amounts"),
  status: z.enum(["active", "paused", "completed"]).describe("Template status; reactivation catches up from the saved nextRunDate"),
}).partial();
export const recurringJournalCreateHeader = recurringJournalCreateSchema.omit({ lines: true, exchangeRate: true, rateExact: true, rateDirection: true }).strip();
export const recurringJournalUpdateHeader = recurringJournalUpdateSchema.omit({ lines: true, exchangeRate: true, rateExact: true, rateDirection: true }).strip();

export function recurringJournalLegs(input: unknown, currencyCode: string) {
  const raw = z.array(recurringJournalLeg).min(2).parse(input);
  const legs = raw.map(line => journalLineInput({ ...line, currencyCode }));
  for (const leg of legs) {
    if ((leg.debitAmount > 0) === (leg.creditAmount > 0)) throw new z.ZodError([
      { code: "custom", path: ["lines"], message: "Each leg must have exactly one nonzero debit or credit" },
    ]);
  }
  journalTotals(legs); // Bigint sums, safe Number bridge; no FX multiplication at identity.
  return legs;
}

export function assertRecurringJournalDates(startDate: string, endDate?: string | null) {
  z.iso.date().parse(startDate);
  if (endDate !== undefined && endDate !== null) {
    z.iso.date().parse(endDate);
    if (endDate < startDate) throw new z.ZodError([{ code: "custom", path: ["endDate"], message: "endDate must be on or after startDate" }]);
  }
}

export function assertRecurringJournalRate(input: { rateExact?: string; exchangeRate?: number; rateDirection?: "quote_per_base" }) {
  // There is no template FX column. Validate rather than silently discard a rate.
  const rate = journalLineInput({ accountId: "00000000-0000-4000-8000-000000000000", ...input });
  if (rate.exchangeRate !== 1000000) throw new WireCompatibilityError("Recurring journal templates support fixed 1:1 FX only");
}

type Leg = { debitAmount: number; creditAmount: number };
export function recurringJournalDto<T extends { currencyCode: string; lines?: Leg[] }>(template: T) {
  const currencyCode = currencyCodeSchema.parse(template.currencyCode);
  const lines = template.lines?.map(line => {
    if (!Number.isSafeInteger(line.debitAmount) || !Number.isSafeInteger(line.creditAmount) || line.debitAmount < 0 || line.creditAmount < 0) throw new WireCompatibilityError("Stored recurring leg is outside the supported nonnegative safe-integer range");
    return { ...line, debitAmountMinor: BigInt(line.debitAmount).toString(), creditAmountMinor: BigInt(line.creditAmount).toString(),
      currencyCode, exchangeRate: 1000000, rateExact: "1", rateDirection: "quote_per_base" as const };
  });
  if (lines) for (const side of ["debitAmount", "creditAmount"] as const) {
    if (lines.reduce((sum, line) => sum + BigInt(line[side]), BigInt(0)) > BigInt(Number.MAX_SAFE_INTEGER)) throw new WireCompatibilityError("Stored recurring journal sum exceeds the safe Number workflow range");
  }
  return { ...template, currencyCode, exchangeRate: 1000000, rateExact: "1", rateDirection: "quote_per_base" as const,
    ...(lines ? { lines } : {}) };
}
