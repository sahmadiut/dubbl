import { z } from "zod";
import { currencyMetadata } from "@/lib/money/exact";
import { WireCompatibilityError } from "@/lib/money/wire";
import { reportMinor } from "@/lib/reports/statement-wire";

export const dashboardWidgetType = z.enum([
  "accounts_receivable", "accounts_payable", "bank_balances", "inventory_alerts", "quick_actions",
]).describe("Existing dashboard widget operation");

export const dashboardQuerySchema = z.object({
  currencyCode: z.string().refine(value => {
    try { return currencyMetadata(value).code === value; } catch { return false; }
  }, "Expected a supported uppercase ISO currency").optional()
    .describe("Optional currency filter for document totals or bank balances; mixed document currencies require a filter. Documents retain fixed cents; bank balances retain currency minor units. No FX conversion or rescaling"),
}).strict();

export function dashboardQuery(request: Request) {
  const params = new URL(request.url).searchParams;
  if ([...params.keys()].some(key => key !== "currencyCode") || params.getAll("currencyCode").length > 1) {
    throw new z.ZodError([{ code: "custom", path: [], message: "Unsupported or duplicate dashboard parameter" }]);
  }
  return dashboardQuerySchema.parse(Object.fromEntries(params));
}

export function dashboardCurrency(value: string) {
  try { if (currencyMetadata(value).code === value) return value; } catch { /* classify below */ }
  throw new WireCompatibilityError("Unsupported stored dashboard currency");
}

export function dashboardStoredMinor(value: string) {
  if (!/^-?(0|[1-9]\d*)$/.test(value) || value === "-0" || value.length > 20) {
    throw new WireCompatibilityError("Unsupported stored dashboard integer");
  }
  const result = BigInt(value);
  reportMinor(result);
  return result;
}

export function dashboardMoney<T extends string>(key: T, value: bigint) {
  return { [key]: reportMinor(value), [`${key}Minor`]: value.toString() } as
    Record<T, number> & Record<`${T}Minor`, string>;
}

export function dashboardSelectedCurrency(values: string[], filter: string | undefined, fallback: string) {
  const currencies = new Set(values.map(dashboardCurrency));
  if (currencies.size > 1) throw new WireCompatibilityError("Mixed dashboard currencies require a currencyCode filter");
  return filter ?? [...currencies][0] ?? dashboardCurrency(fallback);
}
