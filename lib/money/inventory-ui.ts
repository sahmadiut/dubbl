import { coreStoredMinor } from "./core-presentation";
import { inventoryDetailMoney, type InventoryDetailMoney } from "./inventory-detail-ui";
import { currencyMetadata, roundRatio } from "./exact";
import { catalogWholeInput } from "./catalog-input";

type Row = Record<string, unknown>;
function object(value: unknown): Row {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new RangeError("Saved inventory object required");
  return value as Row;
}
function minor(row: Row, field: string, nonnegative = false) {
  if (Object.is(row[field], -0)) throw new RangeError("Negative zero inventory money");
  const amount = coreStoredMinor(row[field] as number, row[field + "Minor"] as string);
  if (nonnegative && amount < 0n) throw new RangeError(`Negative inventory ${field}`);
  return amount;
}
function count(value: unknown) {
  if (typeof value !== "number" || !Number.isInteger(value) || Object.is(value, -0) || value < -2147483648 || value > 2147483647)
    throw new RangeError("Inventory count must be int32 whole physical units");
  return BigInt(value);
}
function decimal(value: unknown) {
  if (typeof value !== "string" || value.length > 100 || !/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value) || /^-0(?:\.0+)?$/.test(value))
    throw new RangeError("Exact inventory decimal required");
  const [whole, fraction = ""] = value.split(".");
  return { n: BigInt(whole + fraction), d: 10n ** BigInt(fraction.length) };
}
function tenthsText(tenths: bigint) {
  const magnitude = tenths < 0n ? -tenths : tenths;
  return `${tenths < 0n ? "-" : ""}${magnitude / 10n}.${magnitude % 10n}`;
}
/** Exact ratios use half-away-from-zero rounding, including loss margins. */
export function inventoryPercent(numerator: bigint, denominator: bigint) {
  return tenthsText(denominator > 0n ? roundRatio(numerator * 1000n, denominator, "half-away-from-zero") : 0n);
}
/** CSS shares are clamped before converting to decimal text; no money enters Number. */
export function inventoryShare(numerator: bigint, denominator: bigint) {
  return inventoryPercent(numerator < 0n ? 0n : numerator > denominator ? denominator : numerator, denominator);
}
export function inventoryValuationMarginCompare(left: unknown, right: unknown) {
  const ratio = (value: unknown) => {
    const row = object(value), cost = minor(row, "totalCost");
    return cost > 0n ? { n: minor(row, "margin"), d: cost } : { n: 0n, d: 1n };
  };
  const a = ratio(left), b = ratio(right), difference = a.n * b.d - b.n * a.d;
  return difference < 0n ? -1 : difference > 0n ? 1 : 0;
}
/** Validate every entered transfer line; never truncate or drop an invalid count. */
export function inventoryTransferLines(lines: readonly { inventoryItemId: string; quantity: string }[]) {
  if (lines.length === 0) throw new RangeError("Add at least one item");
  return lines.map(line => {
    const quantity = catalogWholeInput(line.quantity);
    if (!line.inventoryItemId || !quantity) throw new RangeError("Select an item and enter a positive whole-unit quantity for every line");
    return { inventoryItemId: line.inventoryItemId, quantity };
  });
}
export function inventoryUiItem<T>(value: T): T {
  const row = object(value);
  inventoryDetailMoney(value as InventoryDetailMoney);
  for (const field of ["averageCost", "standardCost"]) minor(row, field, true);
  if (count(row.reorderPoint) < 0n) throw new RangeError("Negative reorder point");
  return value;
}
export function inventoryUiCatalog<T>(value: T): T {
  const row = object(value);
  for (const field of ["purchasePrice", "salePrice"]) {
    if (field === "salePrice" && !(field in row)) continue;
    if (row[field] === null) {
      if (row[field + "Minor"] !== null) throw new RangeError("Nullable catalog aliases disagree");
    } else minor(row, field, true);
  }
  if ("quantityOnHand" in row) count(row.quantityOnHand);
  if ("leadTimeDays" in row && row.leadTimeDays !== null && count(row.leadTimeDays) < 0n) throw new RangeError("Negative lead time");
  return value;
}
export function inventoryUiMovement<T>(value: T): T {
  const row = object(value);
  minor(row, "unitCost", true); minor(row, "value");
  for (const field of ["quantity", "previousQuantity", "newQuantity"]) count(row[field]);
  return value;
}
export function inventoryUiAssembly<T>(value: T): T {
  const row = object(value), bom = object(row.bom);
  if (count(row.quantity) <= 0n) throw new RangeError("Positive assembly quantity required");
  minor(bom, "laborCostCents", true); minor(bom, "overheadCostCents", true);
  inventoryUiItem(bom.assemblyItem);
  return value;
}
export function inventoryUiStockTakeLine<T>(value: T): T {
  const row = object(value);
  count(row.expectedQuantity);
  if (row.countedQuantity === null) {
    if (row.discrepancy !== null) throw new RangeError("Uncounted stock discrepancy");
  } else {
    if (count(row.countedQuantity) < 0n) throw new RangeError("Negative stock count");
    // Applied discrepancies compare the count with live stock, which may differ
    // from the original expected count. Never reconstruct that saved adjustment.
    count(row.discrepancy);
  }
  if (row.valueAdjustment === null) {
    if (row.valueAdjustmentMinor !== null) throw new RangeError("Nullable stock value aliases disagree");
  } else minor(row, "valueAdjustment");
  return value;
}
export function inventoryUiStockTake<T>(value: T): T {
  const row = object(value);
  if (!Array.isArray(row.lines)) throw new RangeError("Stock take lines required");
  row.lines.forEach(inventoryUiStockTakeLine);
  return value;
}
export function inventoryUiListSummary<T>(value: T): T {
  const row = object(value);
  minor(row, "totalValue");
  const ratio = decimal(row.avgMarginExact);
  if (typeof row.avgMargin !== "number" || !Number.isFinite(row.avgMargin) || row.avgMargin !== Number(row.avgMarginExact))
    throw new RangeError("Inventory average margin aliases disagree");
  if (ratio.d <= 0n) throw new RangeError("Invalid margin");
  return value;
}
export function inventoryAverageMargin(value: string) {
  const ratio = decimal(value);
  return tenthsText(roundRatio(ratio.n * 10n, ratio.d, "half-away-from-zero"));
}
export function inventoryUiValuationItem<T>(value: T): T {
  const row = object(value), quantity = count(row.quantityOnHand);
  currencyMetadata(row.currencyCode as string);
  const cost = minor(row, "unitCost", true), sale = minor(row, "salePrice", true);
  const totalCost = minor(row, "totalCost"), totalValue = minor(row, "totalValue");
  minor(row, "carryingValue", true); minor(row, "averageCost", true);
  if (totalCost !== quantity * cost || totalValue !== quantity * sale || minor(row, "margin") !== totalValue - totalCost)
    throw new RangeError("Inventory valuation products disagree");
  return value;
}
export function inventoryUiValuation<T extends { items: unknown[]; summary: unknown }>(value: T): T {
  const summary = object(value.summary);
  const currency = currencyMetadata(summary.currencyCode as string).code;
  value.items.forEach(inventoryUiValuationItem);
  for (const field of ["totalCost", "totalValue", "carryingValue"]) {
    const expected = value.items.reduce<bigint>((sum, item) => {
      const row = object(item);
      if (row.currencyCode !== currency) throw new RangeError("Mixed inventory valuation currencies");
      return sum + minor(row, field);
    }, 0n);
    if (minor(summary, field) !== expected) throw new RangeError("Inventory valuation summary disagrees");
  }
  if (summary.totalItems !== value.items.length) throw new RangeError("Inventory valuation item count disagrees");
  return value;
}
export function inventoryUiBom<T>(value: T): T {
  const row = object(value);
  currencyMetadata(row.currencyCode as string);
  const labor = minor(row, "laborCostCents", true), overhead = minor(row, "overheadCostCents", true);
  inventoryUiItem(row.assemblyItem);
  if (!Array.isArray(row.components)) throw new RangeError("BOM components required");
  let numerator = 0n, denominator = 1n;
  for (const component of row.components) {
    const c = object(component); inventoryUiItem(c.componentItem);
    for (const field of ["quantityExact", "wastagePercentExact"])
      if (typeof c[field] !== "string" || !/^(?:0|[1-9]\d{0,9})(?:\.\d{1,6})?$/.test(c[field] as string)) throw new RangeError("Invalid BOM physical decimal precision");
    const q = decimal(c.quantityExact), w = decimal(c.wastagePercentExact);
    const savedQ = decimal(c.quantity), savedW = decimal(c.wastagePercent ?? "0");
    if (q.n <= 0n || q.n > 2147483647n * q.d || w.n < 0n || w.n > 100n * w.d ||
        q.n * savedQ.d !== savedQ.n * q.d || w.n * savedW.d !== savedW.n * w.d)
      throw new RangeError("Invalid BOM physical decimal aliases");
    const n = q.n * (100n * w.d + w.n) * minor(object(c.componentItem), "purchasePrice", true), d = q.d * 100n * w.d;
    const common = denominator > d ? denominator : d;
    numerator = numerator * (common / denominator) + n * (common / d); denominator = common;
  }
  const breakdown = object(row.costBreakdown), componentCost = roundRatio(numerator, denominator, "half-away-from-zero");
  if (minor(breakdown, "componentCost", true) !== componentCost || minor(breakdown, "laborCost", true) !== labor ||
      minor(breakdown, "overheadCost", true) !== overhead || minor(breakdown, "totalCost", true) !== componentCost + labor + overhead)
    throw new RangeError("BOM cost breakdown disagrees");
  return value;
}
export function inventoryUiBomDetail<T extends { bom: unknown; costBreakdown: unknown }>(value: T): T {
  inventoryUiBom(value.bom);
  const bom = object(value.bom), outer = object(value.costBreakdown), inner = object(bom.costBreakdown);
  for (const field of ["componentCost", "laborCost", "overheadCost", "totalCost"])
    if (minor(outer, field, true) !== minor(inner, field, true)) throw new RangeError("BOM response breakdowns disagree");
  return value;
}
