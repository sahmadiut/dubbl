import { legacyMinor } from "./wire";
import { WireCompatibilityError } from "./wire";

/** Largest-remainder apportionment; input order breaks equal remainders. */
export function allocateInventoryCost(amount: number, weights: number[]): number[] {
  if (!Number.isSafeInteger(amount) || amount < 0 || weights.some(v => !Number.isSafeInteger(v) || v < 0))
    throw new WireCompatibilityError("Allocation requires nonnegative safe integer amounts and weights");
  const total = weights.reduce((s, v) => s + BigInt(v), 0n);
  if (total === 0n) throw new WireCompatibilityError("Positive allocation basis required");
  const rows = weights.map((w, i) => ({ i, value: BigInt(amount) * BigInt(w) / total, remainder: BigInt(amount) * BigInt(w) % total }));
  let residual = BigInt(amount) - rows.reduce((s, r) => s + r.value, 0n);
  for (const row of [...rows].sort((a, b) => a.remainder === b.remainder ? a.i - b.i : a.remainder > b.remainder ? -1 : 1)) {
    if (residual === 0n) break;
    row.value++; residual--;
  }
  return rows.map(r => legacyMinor(r.value));
}

export function inventoryLayerValue(layer: { remainingQuantity: number; unitCost: number; remainingValue: number | null }) {
  for (const v of [layer.remainingQuantity, layer.unitCost, layer.remainingValue ?? 0])
    if (!Number.isSafeInteger(v) || v < 0) throw new WireCompatibilityError("Invalid saved FIFO layer");
  return layer.remainingValue ?? legacyMinor(BigInt(layer.remainingQuantity) * BigInt(layer.unitCost));
}

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
