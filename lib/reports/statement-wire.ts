import { z } from "zod";
import { WireCompatibilityError } from "@/lib/money/wire";

/** Final dual-contract amounts stay within the existing safe numeric cents range. */
export function reportMinor(value: bigint): number {
  const limit = BigInt(Number.MAX_SAFE_INTEGER);
  if (value < -limit || value > limit) throw new WireCompatibilityError("Unsupported financial report amount");
  return Number(value);
}

export function reportStoredMinor(value: number | bigint): bigint {
  if (typeof value === "bigint") { reportMinor(value); return value; }
  if (!Number.isSafeInteger(value)) throw new WireCompatibilityError("Unsupported stored statement amount");
  return BigInt(value);
}

/** Existing statement JSON uses fixed two-place decimals, independently of currency. */
export function reportDecimal(value: bigint): string {
  reportMinor(value);
  const absolute = value < 0n ? -value : value;
  return `${value < 0n ? "-" : ""}${absolute / 100n}.${(absolute % 100n).toString().padStart(2, "0")}`;
}

export const reportDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(value => value >= "0001-01-01" && value <= "9999-12-31" &&
    Number.isFinite(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value, "Expected a real Gregorian date")
  .describe("Real Gregorian date YYYY-MM-DD, years 0001-9999; inclusive cumulative cutoff");

export const cumulativeReportSchema = z.object({
  asAt: reportDateSchema.optional().describe("Inclusive cumulative date; defaults to today in UTC"),
  compareDates: z.array(reportDateSchema).max(12).optional()
    .describe("Up to twelve cumulative comparison dates; order retained, duplicates and primary date removed"),
}).strict();

export function cumulativeReportQuery(request: Request) {
  const params = new URL(request.url).searchParams;
  const allowed = ["asAt", "asOf", "compareDate", "format"];
  if ([...params.keys()].some(key => !allowed.includes(key)) ||
    ["asAt", "asOf", "format"].some(key => params.getAll(key).length > 1)) {
    throw new z.ZodError([{ code: "custom", path: [], message: "Unsupported or duplicate report parameter" }]);
  }
  const asAt = params.get("asAt") ?? params.get("asOf") ?? undefined;
  if (params.has("asOf")) reportDateSchema.parse(params.get("asOf"));
  if (params.has("asAt") && params.has("asOf") && params.get("asAt") !== params.get("asOf")) {
    throw new z.ZodError([{ code: "custom", path: ["asOf"], message: "asAt and asOf disagree" }]);
  }
  const compareDates = params.getAll("compareDate").flatMap(value => value.split(",")).map(value => value.trim());
  const format = z.enum(["json", "pdf", "xlsx"]).parse((params.get("format") ?? "json").toLowerCase());
  return { input: cumulativeReportSchema.parse({ asAt, compareDates }), format };
}
