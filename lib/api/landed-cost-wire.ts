import { z } from "zod";
import { currencyCodeSchema } from "@/lib/currency/zod";
import { exactMinorSchema, legacyMinor, legacyMinorSchema, WireCompatibilityError } from "@/lib/money/wire";
import { invoiceDecimalRatio, invoiceInputError, invoiceRound } from "./invoice-write-wire";
import { publicMoneyDto } from "./public-money-wire";

const text = z.string().min(1).max(10000);
const ref = z.string().uuid().nullable().optional();
// Legacy landed costs used two-decimal major units, independently of currency.
export const landedComponentSchema = z.object({
  description: text.describe("Cost component description"),
  amount: z.number().min(0).max(Number.MAX_SAFE_INTEGER).refine(v => !Object.is(v, -0)).optional().describe("Legacy two-decimal major amount: 12.50 stores 1250, for every currency"),
  amountMinor: exactMinorSchema.refine(v => !v.startsWith("-")).optional().describe("Canonical nonnegative integer stored-unit string (USD cents); safe Number range; agrees with rounded amount times 100"),
  accountId: ref.describe("Optional live organization-owned source account UUID; metadata only, journal credits clearing 2160"),
}).strict();
export const landedCreateSchema = z.object({
  name: text.describe("Landed cost batch name"),
  billId: ref.describe("Optional live owned bill UUID"),
  purchaseOrderId: ref.describe("Optional live owned purchase order UUID; required for capitalization"),
  allocationMethod: z.enum(["by_value", "by_quantity"]).default("by_value").describe("Exact allocation by PO line minor value or stored quantity hundredths; weight/manual unsupported"),
  currencyCode: currencyCodeSchema.default("USD").describe("Batch currency, defaults USD; capitalization requires organization base currency"),
  components: z.array(landedComponentSchema).min(1).max(1000).describe("1..1000 cost components"),
}).strict();
export const landedUpdateSchema = landedCreateSchema.pick({ name: true, allocationMethod: true }).partial();
export const landedIdSchema = z.object({ landedCostId: z.string().uuid().describe("Live organization-owned landed cost UUID") }).strict();
export const landedListSchema = z.object({
  page: z.number().int().min(1).max(1000000).default(1).describe("One-based page, max 1000000"),
  limit: z.number().int().min(1).max(100).default(50).describe("Page size 1..100"),
}).strict();
export function landedAmount(input: z.infer<typeof landedComponentSchema>): number {
  let amount: bigint | undefined;
  if (input.amount !== undefined) {
    const r = invoiceDecimalRatio(input.amount);
    amount = invoiceRound(r.numerator * 100n, r.denominator);
  }
  if (input.amountMinor !== undefined) {
    const exact = BigInt(input.amountMinor);
    if (amount !== undefined && exact !== amount) invoiceInputError("Landed cost money aliases disagree");
    amount = exact;
  }
  if (amount === undefined) invoiceInputError("Component amount or amountMinor required");
  return legacyMinor(amount);
}
export function landedTotal(components: z.infer<typeof landedComponentSchema>[]) {
  return legacyMinor(components.reduce((s, c) => s + BigInt(landedAmount(c)), 0n));
}
export function savedNonnegative(value: number) {
  if (!legacyMinorSchema.min(0).safeParse(value).success) throw new WireCompatibilityError("Invalid saved landed cost money");
  return value;
}
export function landedDto<T extends { totalCostAmount: number }>(row: T) {
  savedNonnegative(row.totalCostAmount); return publicMoneyDto(row, ["totalCostAmount"]);
}
export function componentDto<T extends { amount: number }>(row: T) {
  savedNonnegative(row.amount); return publicMoneyDto(row, ["amount"]);
}
export function lineAllocationDto<T extends { allocatedAmount: number; allocationBasis: number | null }>(row: T) {
  savedNonnegative(row.allocatedAmount); if (row.allocationBasis !== null) savedNonnegative(row.allocationBasis);
  return { ...publicMoneyDto(row, ["allocatedAmount"]), allocationBasisExact: row.allocationBasis === null ? null : String(row.allocationBasis) };
}
