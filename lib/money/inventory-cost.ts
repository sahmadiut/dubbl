import { legacyMinor } from "./wire";

/** Exact weighted unit cost, retaining the legacy Math.round tie toward +infinity. */
export function exactBlendAverageCost(prevQty: number, prevAvg: number, qty: number, unitCost: number): number {
  for (const value of [prevQty, prevAvg, qty, unitCost]) if (!Number.isSafeInteger(value)) throw new RangeError("Inventory costs and quantities must be safe integers");
  const totalQty = BigInt(prevQty) + BigInt(qty);
  if (totalQty <= 0n) return unitCost;
  return roundInventoryRatio(BigInt(prevQty) * BigInt(prevAvg) + BigInt(qty) * BigInt(unitCost), totalQty);
}

/** Round an exact derived cost; denominator is a positive whole physical quantity. */
export function roundInventoryRatio(numerator: bigint, denominator: bigint): number {
  if (denominator <= 0n) throw new RangeError("Positive inventory quantity required");
  let quotient = numerator / denominator, remainder = numerator % denominator;
  if (remainder < 0n) { quotient--; remainder += denominator; }
  return legacyMinor(quotient + (remainder * 2n >= denominator ? 1n : 0n));
}
