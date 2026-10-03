import { z } from "zod";
import { exactMinorSchema, WireCompatibilityError, stringifyWire } from "@/lib/money/wire";
import { invoicePrice, invoiceRound, safeInvoiceMinor } from "./invoice-write-wire";
import { publicMoneyDto } from "./public-money-wire";
import { exactRate, toLegacyRate } from "@/lib/currency/exact-rate";
import { currencyMetadata } from "@/lib/money/exact";

export const recoveryFields = {
  amount: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional().describe("Recovered cash in integer invoice-currency minor units (USD cents); omitted defaults to invoice total"),
  amountMinor: exactMinorSchema.optional().describe("Exact positive recovered cash in invoice-currency minor units, within safe numeric range; must agree with amount"),
  bankAccountCode: z.string().min(1).optional().describe("Organization bank GL code; defaults to 1100, created only when omitted"),
};
export const writeOffFields = {
  method: z.enum(["direct", "allowance"]).default("direct").describe("Direct debits bad-debt expense 6500; allowance debits allowance account 1290"),
};
export const interestFields = {
  amount: z.number().positive().max(Number.MAX_SAFE_INTEGER).optional().describe("Optional legacy interest override in decimal invoice-currency major units, e.g. USD 12.50"),
  amountExact: z.string().max(40).regex(/^(?:0|[1-9]\d{0,19})(?:\.\d{1,18})?$/).optional().describe("Exact decimal major-unit interest override; no exponent; must agree with amount"),
  amountMinor: exactMinorSchema.optional().describe("Exact positive interest override in integer invoice-currency minor units; must agree with rounded major override"),
};
export const writeOffSchema = z.object({
  action: z.enum(["write-off", "recover"]).default("write-off").describe("REST bad-debt operation; MCP exposes separate tools"),
  ...writeOffFields, ...recoveryFields,
});
export const interestSchema = z.object(interestFields);
export const approveFields = { comment: z.string().optional().describe("Optional approval comment") };
export const rejectFields = { reason: z.string().optional().describe("Optional reason for rejection") };

export function recoveredAmount(input: z.infer<typeof writeOffSchema>, fallback: number) {
  if (input.amount !== undefined && input.amountMinor !== undefined && BigInt(input.amount) !== BigInt(input.amountMinor))
    throw new z.ZodError([{ code: "custom", path: ["amountMinor"], message: "Recovery aliases disagree" }]);
  const amount = safeInvoiceMinor(BigInt(input.amountMinor ?? input.amount ?? fallback));
  if (amount <= 0) throw new z.ZodError([{ code: "custom", path: ["amount"], message: "Recovery amount must be positive" }]);
  return amount;
}
export function interestOverride(input: z.infer<typeof interestSchema>, currency: string) {
  if (input.amount === undefined && input.amountExact === undefined && input.amountMinor === undefined) return undefined;
  const amount = safeInvoiceMinor(invoicePrice({ description: "Interest", quantity: 1, discountPercent: 0,
    unitPrice: input.amount, unitPriceExact: input.amountExact, unitPriceMinor: input.amountMinor }, currency).minor);
  if (amount <= 0) throw new z.ZodError([{ code: "custom", path: ["amount"], message: "Interest amount must be positive after rounding" }]);
  return amount;
}

/** Exact annual basis-point interest; round once, to the nearest minor unit, ties up. */
export function exactInterest(principal: number, rate: number, days: number, method: string) {
  if (!Number.isSafeInteger(principal) || principal < 0 || !Number.isInteger(rate) || rate <= 0 || rate > 2147483647 ||
    !Number.isInteger(days) || days < 0 || days > 36500 || !["simple", "compound"].includes(method))
    throw new WireCompatibilityError("Interest requires nonnegative safe principal, positive int32 basis points, simple/compound method and at most 36500 days");
  const p = BigInt(principal), r = BigInt(rate), d = BigInt(days), denominator = 3650000n;
  if (p === 0n || d === 0n) return 0;
  if (method === "simple") return safeInvoiceMinor(invoiceRound(p * r * d, denominator));
  // Bounded exponentiation avoids daily rounding and binary floating-point powers.
  // Reject early if even the simple lower bound exceeds the supported output range.
  safeInvoiceMinor(invoiceRound(p * r * d, denominator));
  const bottom = denominator ** d;
  return safeInvoiceMinor(invoiceRound(p * ((denominator + r) ** d - bottom), bottom));
}

export function lifecycleDto<T extends { subtotal: number; taxTotal: number; total: number; amountPaid: number; amountDue: number }>(row: T) {
  const dto = publicMoneyDto(row, ["subtotal", "taxTotal", "total", "amountPaid", "amountDue"]);
  safeInvoiceMinor(BigInt(row.total) - BigInt(row.amountPaid));
  stringifyWire(dto);
  return dto;
}

/** Document major->base major rate, with explicit minor-unit scale conversion. */
export function convertInvoiceLegs<T extends { debitAmount: number; creditAmount: number }>(lines: T[], currency: string, base: string, rateInput: string) {
  const rate = exactRate(rateInput);
  try { toLegacyRate(rate); } catch { throw new WireCompatibilityError("Posting FX must be exactly representable in legacy int32 millionths"); }
  const [whole, fraction = ""] = rate.split(".");
  const numerator = BigInt(whole + fraction) * 10n ** BigInt(currencyMetadata(base).minorUnits);
  const denominator = 10n ** BigInt(fraction.length + currencyMetadata(currency).minorUnits);
  const totals = (field: "debitAmount" | "creditAmount") => {
    const value = lines.reduce((sum, line) => sum + BigInt(line[field]), 0n); safeInvoiceMinor(value); return value;
  };
  const debit = totals("debitAmount"), credit = totals("creditAmount");
  if (debit !== credit) throw new WireCompatibilityError("Invoice posting legs must balance before FX conversion");
  const target = invoiceRound(debit * numerator, denominator); safeInvoiceMinor(target);
  const result = lines.map(line => ({ ...line,
    debitAmount: safeInvoiceMinor(invoiceRound(BigInt(line.debitAmount) * numerator, denominator)),
    creditAmount: safeInvoiceMinor(invoiceRound(BigInt(line.creditAmount) * numerator, denominator)) }));
  for (const field of ["debitAmount", "creditAmount"] as const) {
    const sum = result.reduce((s, line) => s + BigInt(line[field]), 0n); safeInvoiceMinor(sum);
    if (!result.length) continue;
    const largest = result.reduce((idx, line, i) => Math.abs(line[field]) > Math.abs(result[idx][field]) ? i : idx, 0);
    result[largest][field] = safeInvoiceMinor(BigInt(result[largest][field]) + target - sum);
  }
  return result;
}
