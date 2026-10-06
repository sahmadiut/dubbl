import { z } from "zod";
import { isoRateDate } from "@/lib/currency/rate-policy";
import { legacyMinor, stringifyWire, WireCompatibilityError } from "@/lib/money/wire";

const date = z.string().max(10).refine(value => {
  try { return isoRateDate(value) === value; } catch { return false; }
}, "Expected a valid Gregorian YYYY-MM-DD date");
export const consolidationWindowSchema = z.object({
  startDate: date.optional().describe("Inclusive Gregorian YYYY-MM-DD start; defaults to January 1 of current UTC year"),
  endDate: date.optional().describe("Inclusive Gregorian YYYY-MM-DD end and translation as-of date; defaults to today UTC"),
}).strict().transform(value => {
  const today = new Date().toISOString().slice(0, 10);
  return { startDate: value.startDate ?? `${today.slice(0, 4)}-01-01`, endDate: value.endDate ?? today };
}).refine(value => value.startDate <= value.endDate, "startDate must be on or before endDate");

/** Monetary bigint fields gain safe numeric and *Minor string aliases.
 * Account byEntity maps additionally gain a byEntityMinor map. */
export type ConsolidationDto<T> = T extends bigint ? number : T extends readonly (infer U)[] ? ConsolidationDto<U>[] : T extends object ? {
  [K in keyof T]: ConsolidationDto<T[K]>
} & { [K in keyof T as T[K] extends bigint ? `${K & string}Minor` : K extends "byEntity" ? T[K] extends Record<string, bigint> ? "byEntityMinor" : never : never]: T[K] extends bigint ? string : Record<string, string> } : T;

export function consolidationReportDto<T>(value: T): ConsolidationDto<T> {
  function visit(item: unknown): unknown {
    if (typeof item === "bigint") {
      try { return legacyMinor(item); }
      catch { throw new WireCompatibilityError("Consolidation amount exceeds the supported safe integer cents range"); }
    }
    if (Array.isArray(item)) return item.map(visit);
    if (item && typeof item === "object") {
      const result: Record<string, unknown> = {};
      for (const [key, field] of Object.entries(item)) {
        if (key === "byEntity" && field && !Array.isArray(field) && typeof field === "object") {
          result.byEntity = Object.fromEntries(Object.entries(field).map(([id, amount]) => [id, visit(amount)]));
          result.byEntityMinor = Object.fromEntries(Object.entries(field).map(([id, amount]) => [id, (amount as bigint).toString()]));
          continue;
        }
        result[key] = visit(field);
        if (typeof field === "bigint") result[`${key}Minor`] = field.toString();
      }
      return result;
    }
    return item;
  }
  const result = visit(value);
  stringifyWire(result);
  return result as ConsolidationDto<T>;
}
