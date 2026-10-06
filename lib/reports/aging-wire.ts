import { z } from "zod";
import { currencyMetadata } from "@/lib/money/exact";
import { WireCompatibilityError } from "@/lib/money/wire";
import { reportDateSchema, reportMinor } from "./statement-wire";

export const agingSchema = z.object({
  asAt: reportDateSchema.optional().describe("Inclusive historical cutoff YYYY-MM-DD; omit for today's stored open balances, measured in UTC"),
  currencyCode: z.string().refine(value => {
    try { return currencyMetadata(value).code === value; } catch { return false; }
  }, "Expected a supported uppercase ISO currency").optional()
    .describe("Optional single document currency filter; mixed-currency totals without a filter reject, with no FX conversion"),
}).strict();

export function agingQuery(request: Request) {
  const query = new URL(request.url).searchParams;
  const allowed = ["asAt", "currencyCode", "format"];
  if ([...query.keys()].some(key => !allowed.includes(key)) || allowed.some(key => query.getAll(key).length > 1)) {
    throw new z.ZodError([{ code: "custom", path: [], message: "Unsupported or duplicate aging parameter" }]);
  }
  return {
    input: agingSchema.parse(Object.fromEntries([...query].filter(([key]) => key !== "format"))),
    format: z.enum(["json", "pdf", "xlsx"]).parse((query.get("format") ?? "json").toLowerCase()),
  };
}

export function agingCurrency(value: string) {
  try { if (currencyMetadata(value).code === value) return value; } catch { /* classified below */ }
  throw new WireCompatibilityError("Unsupported saved aging currency");
}

export function agingDate(value: string) {
  if (!reportDateSchema.safeParse(value).success) throw new WireCompatibilityError("Unsupported saved aging date");
  return value;
}

export function agingMoney<T extends string>(key: T, value: bigint) {
  return { [key]: reportMinor(value), [`${key}Minor`]: value.toString() } as
    Record<T, number> & Record<`${T}Minor`, string>;
}

export function agingDays(asAt: string, dueDate: string) {
  return Math.floor((Date.parse(`${agingDate(asAt)}T00:00:00Z`) - Date.parse(`${agingDate(dueDate)}T00:00:00Z`)) / 86400000);
}

export function agingBucket(days: number) {
  return days <= 0 ? 0 : days <= 30 ? 1 : days <= 60 ? 2 : days <= 90 ? 3 : 4;
}
