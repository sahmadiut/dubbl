/** Explicit wire boundaries. No scaling, float coercion or implicit version negotiation. */
import { z } from "zod";
import { checkedMinor, currencyMetadata, money, type Money } from "./exact";
import { exactRate, fromLegacyRate, toLegacyRate, FX_DIRECTION } from "../currency/exact-rate";

export type WireRepresentation = "legacy" | "exact";

/** A valid domain/storage value cannot be represented by a legacy numeric client. */
export class WireCompatibilityError extends RangeError {
  readonly code = "LEGACY_NUMERIC_RANGE";
  readonly status = 422;
  constructor() {
    super("Value cannot be represented safely by the legacy numeric contract; an exact string contract is required");
    this.name = "WireCompatibilityError";
  }
}

export function legacyMinor(value: bigint): number {
  checkedMinor(value);
  const limit = BigInt(Number.MAX_SAFE_INTEGER);
  if (value < -limit || value > limit) throw new WireCompatibilityError();
  return Number(value);
}

/** Canonical signed int64 integer string: no leading zero, exponent, plus sign or negative zero. */
export const exactMinorSchema = z.string().max(20).regex(/^(?:0|-?[1-9]\d*)$/)
  .refine(value => {
    if (value.length > 20) return false;
    try { checkedMinor(BigInt(value)); return true; } catch { return false; }
  }, "Amount must fit signed int64 minor units")
  .describe("Canonical ASCII integer string in currency minor units, signed int64; no rescaling");

export const legacyMinorSchema = z.number().int().min(Number.MIN_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER)
  .describe("Legacy safe integer minor-unit number; existing cents-based contracts retain their units");

export const exactRateSchema = z.string().max(128).transform((value, ctx) => {
  try { return exactRate(value); } catch {
    ctx.addIssue({ code: "custom", message: "Rate must be a positive ASCII decimal with at most 20 whole and 18 fractional digits" });
    return z.NEVER;
  }
}).describe("Exact positive quote units per one base unit as an ASCII decimal string (20 whole/18 fractional digits)");

const wireCurrencySchema = z.string().transform((value, ctx) => {
  try { return currencyMetadata(value).code; } catch {
    ctx.addIssue({ code: "custom", message: "Unsupported currency code" });
    return z.NEVER;
  }
}).describe("Currency code defining the minor units; USD 1250 remains 1250 and IRR 1250 remains 1250");

/** Additive minor-unit input only. Do not apply to legacy major-unit prices or scaled quantities. */
export const moneyInputSchema = z.object({
  amount: legacyMinorSchema.optional().describe("Optional legacy safe integer minor-unit amount"),
  amountMinor: exactMinorSchema.optional().describe("Optional canonical signed int64 minor-unit string"),
  currencyCode: wireCurrencySchema,
}).strict().superRefine((value, ctx) => {
  if (value.amount === undefined && value.amountMinor === undefined) {
    ctx.addIssue({ code: "custom", message: "Provide amount or amountMinor", path: ["amountMinor"] });
  }
  if (value.amount !== undefined && value.amountMinor !== undefined
    && legacyMinorSchema.safeParse(value.amount).success && exactMinorSchema.safeParse(value.amountMinor).success
    && BigInt(value.amount) !== BigInt(value.amountMinor)) {
    ctx.addIssue({ code: "custom", message: "amount and amountMinor disagree", path: ["amountMinor"] });
  }
}).transform(value => money(
  value.amountMinor !== undefined ? BigInt(value.amountMinor) : BigInt(value.amount!),
  value.currencyCode,
));

/** Exact-only endpoints may use full int64; existing number consumers must opt into this bridge. */
export function legacyMoneyInput(input: unknown): { amount: number; currencyCode: string } {
  const parsed = moneyInputSchema.parse(input);
  return { amount: legacyMinor(parsed.amountMinor), currencyCode: parsed.currency };
}

export function moneyDto(value: Money, representation: WireRepresentation = "legacy") {
  const amountMinor = checkedMinor(value.amountMinor).toString();
  const currencyCode = currencyMetadata(value.currency).code;
  assertRepresentation(representation);
  return representation === "exact"
    ? { amountMinor, currencyCode }
    : { amount: legacyMinor(value.amountMinor), amountMinor, currencyCode };
}

/** Legacy rate input is integer millionths, never unscaled decimal Number. */
export const rateInputSchema = z.object({
  rate: z.number().int().positive().max(2147483647).optional()
    .describe("Optional positive int32 millionths; 1000000 = 1 quote unit per base unit"),
  rateExact: exactRateSchema.optional().describe("Optional exact quote-per-base decimal string"),
  rateDirection: z.literal(FX_DIRECTION).default(FX_DIRECTION).describe("Explicit quote units per one base unit"),
}).strict().superRefine((value, ctx) => {
  if (value.rate === undefined && value.rateExact === undefined) {
    ctx.addIssue({ code: "custom", message: "Provide rate or rateExact", path: ["rateExact"] });
  }
  if (value.rate !== undefined && value.rateExact !== undefined
    && Number.isInteger(value.rate) && value.rate > 0 && value.rate <= 2147483647
    && fromLegacyRate(value.rate) !== value.rateExact) {
    ctx.addIssue({ code: "custom", message: "rate and rateExact disagree", path: ["rateExact"] });
  }
}).transform(value => ({
  rateExact: value.rateExact ?? fromLegacyRate(value.rate!), rateDirection: value.rateDirection,
}));

export function rateDto(value: string, representation: WireRepresentation = "legacy") {
  const rateExact = exactRate(value);
  assertRepresentation(representation);
  if (representation === "exact") return { rateExact, rateDirection: FX_DIRECTION };
  try { return { rate: toLegacyRate(rateExact), rateExact, rateDirection: FX_DIRECTION }; } catch {
    throw new WireCompatibilityError();
  }
}

function assertRepresentation(value: WireRepresentation) {
  if (value !== "legacy" && value !== "exact") throw new TypeError("Unknown wire representation");
}

/** Nested bigint safety, with ordinary JSON Date/toJSON behavior and no global prototype patch.
 * Exact mode must be selected by an explicit endpoint/tool contract, never inferred from magnitude.
 * This serializer cannot recover a value already rounded by upstream Number arithmetic.
 */
export function stringifyWire(value: unknown, representation: WireRepresentation = "legacy"): string {
  assertRepresentation(representation);
  const result = JSON.stringify(value, (_key, item: unknown) => {
    if (typeof item === "bigint") return representation === "exact" ? item.toString() : legacyMinor(item);
    if (typeof item === "number" && (!Number.isFinite(item) || Math.abs(item) > Number.MAX_SAFE_INTEGER)) {
      throw new WireCompatibilityError();
    }
    return item;
  });
  // Preserve the native error for unsupported top-level JSON values.
  if (result === undefined) throw new TypeError("Response value is not JSON serializable");
  return result;
}
