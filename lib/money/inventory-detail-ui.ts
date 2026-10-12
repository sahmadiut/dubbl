import { catalogPriceMinor } from "./catalog-input";
import { coreStoredMinor } from "./core-presentation";
import { roundRatio } from "./exact";

export type InventoryDetailMoney = {
  purchasePrice: number; purchasePriceMinor: string;
  salePrice: number; salePriceMinor: string;
  totalValue: number; totalValueMinor: string;
  priceValue: number; priceValueMinor: string;
  quantityOnHand: number;
};

/** Catalog/detail money retains its adopted USD/cents presentation, even in a
 * different base-currency organization. Never reinterpret these stored units. */
export function inventoryDetailMoney(row: InventoryDetailMoney) {
  const purchase = coreStoredMinor(row.purchasePrice, row.purchasePriceMinor);
  const sale = coreStoredMinor(row.salePrice, row.salePriceMinor);
  const carrying = coreStoredMinor(row.totalValue, row.totalValueMinor);
  const priceValue = coreStoredMinor(row.priceValue, row.priceValueMinor);
  if (purchase < 0n || sale < 0n || carrying < 0n) throw new RangeError("Inventory money must be nonnegative");
  if (!Number.isInteger(row.quantityOnHand) || Object.is(row.quantityOnHand, -0) || row.quantityOnHand < -2147483648 || row.quantityOnHand > 2147483647)
    throw new RangeError("Inventory count must be whole physical units");
  if (priceValue !== BigInt(row.quantityOnHand) * purchase) throw new RangeError("Inventory price value disagrees with count and cost");
  const profit = sale - purchase;
  const tenths = purchase > 0n ? roundRatio(profit * 1000n, purchase, "half-away-from-zero") : null;
  const magnitude = tenths === null ? 0n : tenths < 0n ? -tenths : tenths;
  const margin = tenths === null ? "-" : `${tenths < 0n ? "-" : ""}${magnitude / 10n}.${magnitude % 10n}%`;
  return { purchase, sale, carrying, priceValue, profit, margin };
}

/** Positive USD major text -> exact legacy cents magnitude for BOTH transports.
 * Reject sub-cent text instead of silently rounding a financial write. */
export function inventoryWriteDown(text: string, carrying: bigint) {
  const exact = catalogPriceMinor(text);
  if (exact === undefined || BigInt(exact) <= 0n) throw new RangeError("Enter a positive amount with at most two decimal places");
  const amount = BigInt(exact);
  if (carrying < 0n || carrying > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError("Unsupported carrying value");
  if (amount > carrying) throw new RangeError("Write-off cannot exceed the current book value");
  return { valueDeltaMinor: exact, amount, remaining: carrying - amount };
}
