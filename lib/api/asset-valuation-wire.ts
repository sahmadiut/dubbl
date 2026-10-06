import { z } from "zod";
import { assetDate, assetMasterId, assetMinorPair } from "./asset-master-wire";
import { exactMinorSchema, legacyMinorSchema } from "@/lib/money/wire";

const amount = legacyMinorSchema.min(0).refine(v => !Object.is(v, -0), "Negative zero is not canonical");
const exact = exactMinorSchema.refine(v => !v.startsWith("-"), "Amount must be nonnegative");
const common = {
  date: assetDate.describe("Posting date, real Gregorian YYYY-MM-DD; cannot precede service or saved history"),
  idempotencyKey: z.string().regex(/^[A-Za-z0-9._:-]{1,128}$/).optional().describe("Optional organization/asset/operation-scoped retry key; different inputs conflict"),
};
const valuation = {
  ...common,
  notes: z.string().max(10000).optional().describe("Optional valuation notes, max 10000 characters"),
  revaluationReserveAccountId: assetMasterId.optional().describe("Optional live active organization-owned equity surplus account; defaults saved account or 3400"),
  impairmentExpenseAccountId: assetMasterId.optional().describe("Optional live active organization-owned P&L impairment/reversal account; defaults saved account or 5510"),
};
export const assetRevalueSchema = z.object({ ...valuation,
  revaluedAmount: amount.optional().describe("New higher carrying amount in integer cents, max 9007199254740991; this or Minor required"),
  revaluedAmountMinor: exact.optional().describe("Canonical nonnegative carrying cents string, same safe range; must agree with revaluedAmount"),
}).strict();
export const assetImpairSchema = assetRevalueSchema;
// Preserve the existing MCP recoverableAmount name with an explicit adapter.
export const assetImpairToolSchema = z.object({ ...valuation,
  recoverableAmount: amount.optional().describe("New lower carrying amount in integer cents, max 9007199254740991; this or Minor required"),
  recoverableAmountMinor: exact.optional().describe("Canonical nonnegative recoverable cents string, same safe range; must agree with recoverableAmount"),
}).strict();
export const assetDisposeSchema = z.object({ ...common,
  disposalAmount: amount.optional().describe("Sale proceeds in integer cents, 0 for write-off, max 9007199254740991; this or Minor required"),
  disposalAmountMinor: exact.optional().describe("Canonical nonnegative sale-proceeds cents string, same safe range; must agree with disposalAmount"),
  proceedsAccountId: assetMasterId.optional().describe("Optional live active organization-owned proceeds account; defaults Undeposited Funds 1250"),
  gainAccountId: assetMasterId.optional().describe("Optional live active organization-owned gain account; defaults 4300"),
  lossAccountId: assetMasterId.optional().describe("Optional live active organization-owned loss account; defaults 5920"),
}).strict();
export function valuationAmount(input: z.infer<typeof assetRevalueSchema>) {
  return assetMinorPair(input.revaluedAmount, input.revaluedAmountMinor, "revaluedAmount", true)!;
}
export function disposalAmount(input: z.infer<typeof assetDisposeSchema>) {
  return assetMinorPair(input.disposalAmount, input.disposalAmountMinor, "disposalAmount", true)!;
}

/** Signed cents, calculated entirely with bigint intermediates. */
export function valuationSplit(previous: number, next: number, surplus: bigint, pnl: bigint, impairment: boolean) {
  amount.parse(previous); amount.parse(next);
  if (surplus < 0n || pnl > 0n) throw new RangeError("Unsupported saved surplus or impairment balance");
  const change = BigInt(next) - BigInt(previous);
  if (impairment ? change >= 0n : change <= 0n) throw new RangeError(impairment ? "Impaired amount must be lower than carrying amount" : "Revalued amount must be higher than carrying amount");
  const min = (a: bigint, b: bigint) => a < b ? a : b;
  const equity = impairment ? -min(-change, surplus) : change - min(change, -pnl);
  return { change, equity, pnl: change - equity };
}
