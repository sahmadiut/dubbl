/** Public FX aliases during lossless v1/storage coexistence. */
import { z } from "zod";
import { rateDto, rateInputSchema, rateInputFields, exactRateSchema, WireCompatibilityError } from "../money/wire";
import { legacyDecimalRateSchema } from "./rate-input";
import { currencyCodeSchema } from "./zod";
import { rateDateSchema } from "./rate-policy";
import { exactRate, fromLegacyRate, FX_DIRECTION } from "./exact-rate";
import type { exchangeRate } from "../db/schema";

// A valid exact string still has to fit the current int32-millionths storage/consumers.
export const coexistRateSchema = rateInputSchema.transform(value => rateDto(value.rateExact));

export const manualWireRateSchema = z.object({
  baseCurrency: currencyCodeSchema.describe("Base currency code"),
  targetCurrency: currencyCodeSchema.describe("Quote currency code"),
  date: rateDateSchema,
  source: z.literal("manual").default("manual").describe("Manual override, protected from provider refresh"),
  ...rateInputFields,
}).superRefine((value, ctx) => {
  const parsed = rateInputSchema.safeParse({ rate: value.rate, rateExact: value.rateExact, rateDirection: value.rateDirection });
  if (!parsed.success) {
    for (const issue of parsed.error.issues) ctx.addIssue({ ...issue });
  } else if (value.baseCurrency === value.targetCurrency && parsed.data.rateExact !== "1") {
    ctx.addIssue({ code: "custom", message: "Same-currency rates must equal 1:1", path: ["rateExact"] });
  }
}).transform(value => ({ ...value, ...coexistRateSchema.parse({
  rate: value.rate, rateExact: value.rateExact, rateDirection: value.rateDirection,
}) }));

/** MCP's original numeric field is unscaled decimal, unlike REST's millionths. */
export const mcpRateFields = {
  rateDecimal: legacyDecimalRateSchema.optional().describe("Legacy numeric quote units per base; at most 6 decimals, maximum 2147.483647"),
  rateExact: exactRateSchema.optional().describe("Exact decimal string; must fit positive int32 millionths during coexistence, no rounding"),
  rateDirection: z.literal(FX_DIRECTION).default(FX_DIRECTION).describe("Quote units per one base unit"),
};

export const mcpWireRateSchema = z.object(mcpRateFields).superRefine((value, ctx) => {
  if (value.rateDecimal === undefined && value.rateExact === undefined) {
    ctx.addIssue({ code: "custom", message: "Provide rateDecimal or rateExact", path: ["rateExact"] });
  }
  if (value.rateDecimal !== undefined && value.rateExact !== undefined
    && legacyDecimalRateSchema.safeParse(value.rateDecimal).success
    && exactRate(String(value.rateDecimal)) !== value.rateExact) {
    ctx.addIssue({ code: "custom", message: "rateDecimal and rateExact disagree", path: ["rateExact"] });
  }
}).transform(value => rateDto(value.rateExact ?? String(value.rateDecimal)));

/** Never promote pending/quarantined metadata or silently repair inconsistent exact rows. */
export function storedRateDto(row: typeof exchangeRate.$inferSelect) {
  if (row.rateMigrationStatus !== "exact") return { ...row, rateExact: null };
  if (row.rateFormatVersion !== 1 || row.rateDirection !== FX_DIRECTION || !row.rateExact) {
    throw new WireCompatibilityError();
  }
  const dto = rateDto(row.rateExact);
  if (dto.rate !== row.rate || fromLegacyRate(row.rate) !== dto.rateExact) throw new WireCompatibilityError();
  return { ...row, ...dto };
}
