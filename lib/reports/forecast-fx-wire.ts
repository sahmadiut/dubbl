import { z } from "zod";
import { currencyMetadata } from "@/lib/money/exact";
import { WireCompatibilityError } from "@/lib/money/wire";
import { exactRate, toLegacyRate } from "@/lib/currency/exact-rate";
import { divideRates } from "@/lib/currency/rate-policy";
import { reportDateSchema } from "./statement-wire";
import { analyticsRound } from "./document-analytics-wire";

export const forecastCurrencySchema = z.string().refine(value => {
  try { return currencyMetadata(value).code === value; } catch { return false; }
}, "Expected a supported uppercase ISO currency").describe("Document currency, uppercase ISO code; no implicit conversion or rescaling");

export const cashForecastSchema = z.object({
  weeks: z.number().int().min(1).max(52).default(12).describe("Forecast horizon in weeks, integer 1-52, default 12; inclusive today through today plus weeks times seven UTC days"),
  currencyCode: forecastCurrencySchema.optional().describe("Optional document currency filter; mixed currencies require a filter, empty results use organization currency"),
}).strict();

export const unrealizedFxSchema = z.object({}).strict();

export function forecastFxQuery(request: Request, forecast: boolean) {
  const query = new URL(request.url).searchParams;
  const allowed = forecast ? ["weeks", "currencyCode"] : [];
  if ([...query.keys()].some(key => !allowed.includes(key)) || allowed.some(key => query.getAll(key).length > 1)) {
    throw new z.ZodError([{ code: "custom", path: [], message: "Unsupported or duplicate forecast/FX parameter" }]);
  }
  const input: Record<string, unknown> = Object.fromEntries(query);
  if (query.has("weeks")) {
    const value = query.get("weeks")!;
    if (!/^[1-9]\d?$/.test(value)) throw new z.ZodError([{ code: "custom", path: ["weeks"], message: "weeks must be an integer from 1 to 52" }]);
    input.weeks = Number(value);
  }
  return forecast ? cashForecastSchema.parse(input) : unrealizedFxSchema.parse(input);
}

export function forecastSavedDate(value: string) {
  if (!reportDateSchema.safeParse(value).success) throw new WireCompatibilityError("Unsupported saved forecast/FX date");
  return value;
}

export function forecastAddDays(value: string, days: number) {
  const date = new Date(`${forecastSavedDate(value)}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return forecastSavedDate(date.toISOString().slice(0, 10));
}

export function forecastWeekOf(value: string) {
  return forecastAddDays(value, -new Date(`${value}T00:00:00Z`).getUTCDay());
}

/** Explicit legacy coexistence: never silently round an exact quote to millionths. */
export function forecastFxRate(value: string) {
  try { const rateExact = exactRate(value); return { rateExact, rate: toLegacyRate(rateExact) }; }
  catch { throw new WireCompatibilityError("FX report rate cannot be represented exactly in legacy int32 millionths"); }
}

export function forecastFxInverse(value: string) {
  try {
    const original = exactRate(value), inverse = divideRates("1", original);
    const [whole, fraction = ""] = original.split(".");
    const [inverseWhole, inverseFraction = ""] = inverse.split(".");
    if (BigInt(whole + fraction) * BigInt(inverseWhole + inverseFraction) !== 10n ** BigInt(fraction.length + inverseFraction.length)) {
      throw new RangeError("Inexact reciprocal");
    }
    return inverse;
  } catch { throw new WireCompatibilityError("FX report reciprocal cannot be represented exactly"); }
}

/** Documents retain fixed-cent integers; quote-per-base rates do not rescale them. */
export function forecastFxConvert(amount: bigint, rate: string) {
  const [whole, fraction = ""] = exactRate(rate).split(".");
  return analyticsRound(amount * BigInt(whole + fraction), 10n ** BigInt(fraction.length));
}
