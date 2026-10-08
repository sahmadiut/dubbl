import { z } from "zod";
import { CURRENCY_SCALES } from "@/lib/money/scales";
import { parseMajor } from "@/lib/money/exact";
import { exactMinorSchema, legacyMinor, WireCompatibilityError } from "@/lib/money/wire";

// Application policy, deliberately narrower than provider/account/network limits.
// The provider may impose a lower minimum/maximum based on account and method.
export const CHECKOUT_MAX_MINOR = 99_999_999;
const ZERO_DECIMAL = new Set("BIF CLP DJF GNF JPY KMF KRW PYG RWF VND VUV XAF XOF XPF".split(" "));
const TWO_DECIMAL = new Set(("AED AFN ALL AMD ANG AOA ARS AUD AWG AZN BAM BBD BDT BGN BMD BND BOB BRL BSD BWP BYN BZD CAD CDF CHF CNY COP CRC CVE CZK DKK DOP DZD EGP ETB EUR FJD FKP GBP GEL GIP GMD GTQ GYD HKD HNL HTG HUF IDR ILS INR JMD KES KGS KHR KYD KZT LAK LBP LKR LRD LSL MAD MDL MKD MMK MNT MOP MUR MVR MWK MXN MYR MZN NAD NGN NIO NOK NPR NZD PAB PEN PGK PHP PKR PLN QAR RON RSD RUB SAR SBD SCR SEK SGD SHP SLE SOS SRD SZL THB TJS TOP TRY TTD TWD TZS UAH USD UYU UZS WST XCD YER ZAR ZMW").split(" "));

/** No implicit provider/ISO rescaling. Special unequal-scale currencies are rejected. */
export function stripeCurrency(value: unknown): string {
  if (typeof value !== "string" || !/^[a-zA-Z]{3}$/.test(value)) throw new WireCompatibilityError("Invalid Stripe currency");
  const code = value.toUpperCase();
  const scale = ZERO_DECIMAL.has(code) ? 0 : TWO_DECIMAL.has(code) ? 2 : undefined;
  if (scale === undefined || CURRENCY_SCALES[code] !== scale) {
    throw new WireCompatibilityError(`Stripe currency ${code} has no qualified minor-unit contract`);
  }
  return code;
}

export function stripeMinor(value: unknown, signed = false): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || Object.is(value, -0) || (!signed && value < 0)) {
    throw new WireCompatibilityError("Stripe amounts must be safe integer minor units with the expected sign");
  }
  return value;
}

export function checkoutAmount(value: unknown, currency: unknown): number {
  stripeCurrency(currency);
  const amount = stripeMinor(value);
  if (amount === 0 || amount > CHECKOUT_MAX_MINOR) throw new WireCompatibilityError("Checkout supports 1 through 99999999 minor units");
  return amount;
}

/** CSV major units and optional canonical exact aliases must agree without rounding. */
export function csvMinor(major: string | undefined, minor: string | undefined, currency: string, signed = false): number {
  let decimal: bigint | undefined;
  if (major !== undefined && major !== "") {
    if (!/^-?\d+(?:\.\d+)?$/.test(major) || major.length > 128) throw new WireCompatibilityError("Invalid CSV decimal amount");
    try { decimal = parseMajor(major, currency, "reject").amountMinor; }
    catch { throw new WireCompatibilityError("CSV amount has fractional minor units or is out of range"); }
  }
  const exact = minor !== undefined && minor !== "" ? BigInt(exactMinorSchema.parse(minor)) : undefined;
  if (decimal === undefined && exact === undefined) throw new WireCompatibilityError("CSV amount is required");
  if (decimal !== undefined && exact !== undefined && decimal !== exact) throw new WireCompatibilityError("CSV major and minor amounts disagree");
  return stripeMinor(legacyMinor(exact ?? decimal!), signed);
}

export const stripeOperationSchema = z.object({
  integrationId: z.string().uuid().describe("Organization-scoped Stripe integration UUID"),
  days: z.number().int().min(1).max(90).default(30).describe("Whole days of history, 1 through 90"),
}).strict();

const MONEY_FIELDS = new Set("amount amount_total amount_subtotal amount_paid amount_due amount_refunded amount_reversed subtotal total total_excluding_tax subtotal_excluding_tax unit_amount fee net starting_balance ending_balance pre_payment_amount post_payment_amount out_of_band_amount shipping_cost amount_shipping amount_tax amount_discount discount_amount tax_amount".split(" "));
const SIGNED_FIELDS = new Set(["fee", "net", "starting_balance", "ending_balance"]);

/** Read-only validation; never alter a verified provider object or inject aliases. */
export function validateStripeObject(value: unknown, inheritedCurrency?: string, signedAmount = false): void {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) { for (const item of value) validateStripeObject(item, inheritedCurrency, signedAmount); return; }
  const object = value as Record<string, unknown>;
  const currency = object.currency == null ? inheritedCurrency : stripeCurrency(object.currency);
  if (object.object === "credit_note" && object.total != null && object.subtotal != null &&
    BigInt(stripeMinor(object.subtotal)) > BigInt(stripeMinor(object.total))) {
    throw new WireCompatibilityError("Stripe credit note subtotal exceeds its total");
  }
  if (object.unit_amount_decimal != null) {
    const decimal = object.unit_amount_decimal;
    if (typeof decimal !== "string" || !/^\d+(?:\.0+)?$/.test(decimal) || decimal.length > 128) throw new WireCompatibilityError("Fractional Stripe unit amounts have no integer-minor contract");
    const amount = legacyMinor(BigInt(decimal.split(".")[0]));
    if (object.unit_amount == null || stripeMinor(object.unit_amount) !== amount) throw new WireCompatibilityError("Stripe unit amount and decimal price disagree");
  }
  for (const [key, item] of Object.entries(object)) {
    if (key === "metadata") continue; // Arbitrary provider/user strings are opaque, not money fields.
    if (MONEY_FIELDS.has(key) && item != null && typeof item !== "object") {
      if (!currency) throw new WireCompatibilityError("Stripe monetary object is missing currency");
      stripeMinor(item, SIGNED_FIELDS.has(key) || (key === "amount" && (signedAmount || object.object === "balance_transaction")));
    }
    if (typeof item === "object") validateStripeObject(item, currency, signedAmount || object.object === "balance_transaction");
  }
  if (object.object === "payout" && ["HUF", "TWD"].includes(currency ?? "") && stripeMinor(object.amount) % 100 !== 0) {
    throw new WireCompatibilityError("HUF/TWD payout amounts must be divisible by 100");
  }
}

/** Explicit local mapping fields, never applied to a provider request or signed object. */
export function stripeMappingMetadata(input: Record<string, unknown> | null) {
  if (!input) return input;
  const output = { ...input };
  for (const field of ["amount", "feeRefund", "reversedAmount"]) if (input[field] != null) {
    const value = stripeMinor(input[field], true);
    if (input[`${field}Minor`] != null && exactMinorSchema.parse(input[`${field}Minor`]) !== String(value)) {
      throw new WireCompatibilityError("Stripe mapping monetary aliases disagree");
    }
    output[`${field}Minor`] = String(value);
  }
  if (Array.isArray(input.items)) output.items = input.items.map(item => stripeMappingMetadata(item as Record<string, unknown>));
  return output;
}
