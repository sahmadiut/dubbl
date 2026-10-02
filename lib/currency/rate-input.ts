import { z } from "zod";
import { toLegacyRate } from "./exact-rate";
import { currencyCodeSchema } from "./zod";
import { rateDateSchema } from "./rate-policy";

export const legacyScaledRateSchema = z.number().int().positive().max(2147483647)
  .describe("Positive int32 FX rate in millionths; 1000000 = 1 quote unit per base unit");

/** Preserve the v1 numeric contract, rejecting precision/range loss before any DB write. */
export const legacyDecimalRateSchema = z.number().positive().refine(value => {
  try { toLegacyRate(String(value)); return true; } catch { return false; }
}, { message: "Rate must fit positive int32 millionths exactly (maximum 2147.483647, at most 6 decimal places)" })
  .describe("Numeric quote units per base unit; at most 6 decimals, maximum 2147.483647 during legacy coexistence");

export const manualRateSchema = z.object({
  baseCurrency: currencyCodeSchema.describe("Base currency code"),
  targetCurrency: currencyCodeSchema.describe("Quote currency code"),
  rate: legacyScaledRateSchema,
  date: rateDateSchema,
  source: z.literal("manual").default("manual").describe("User override, protected from provider refresh"),
}).refine(value => value.baseCurrency !== value.targetCurrency || value.rate === 1000000,
  "Same-currency rates must equal 1000000 (1:1)");

/** A manual override must not retain an earlier automatic quote's provenance. */
export const manualProviderMetadata = {
  provider: null, providerBase: null, providerQuote: null,
  providerObservedAt: null, importedAt: null, providerRounding: null,
};
