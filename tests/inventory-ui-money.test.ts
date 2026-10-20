import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { inventoryUiItem, inventoryUiCatalog, inventoryUiMovement, inventoryUiStockTakeLine,
  inventoryUiValuation, inventoryUiBom, inventoryPercent, inventoryShare, inventoryAverageMargin,
  inventoryUiListSummary, inventoryTransferLines, inventoryValuationMarginCompare } from "../lib/money/inventory-ui";
import { catalogPriceMinor, catalogWholeInput } from "../lib/money/catalog-input";
import { toMajorDecimal, money } from "../lib/money/exact";

const item = { purchasePrice: 3000000001, purchasePriceMinor: "3000000001", salePrice: 3000000002, salePriceMinor: "3000000002",
  quantityOnHand: 3, totalValue: 6000000002, totalValueMinor: "6000000002", priceValue: 9000000003, priceValueMinor: "9000000003",
  averageCost: 2000000001, averageCostMinor: "2000000001", standardCost: 0, standardCostMinor: "0", reorderPoint: 0 };
const valuationItem = { quantityOnHand: 3, unitCost: 3000000001, unitCostMinor: "3000000001", salePrice: 3000000002, salePriceMinor: "3000000002",
  totalCost: 9000000003, totalCostMinor: "9000000003", totalValue: 9000000006, totalValueMinor: "9000000006",
  carryingValue: 6000000002, carryingValueMinor: "6000000002", averageCost: 2000000001, averageCostMinor: "2000000001",
  margin: 3, marginMinor: "3", currencyCode: "USD" };
const report = { items: [valuationItem], summary: { totalItems: 1, totalCost: 9000000003, totalCostMinor: "9000000003",
  totalValue: 9000000006, totalValueMinor: "9000000006", carryingValue: 6000000002, carryingValueMinor: "6000000002", currencyCode: "USD" } };

test("saved inventory consumers require agreeing safe canonical money without losing low digits", () => {
  assert.equal(inventoryUiItem(item), item);
  assert.equal(inventoryUiCatalog(item), item);
  const movement = { unitCost: 3000000001, unitCostMinor: "3000000001", value: -3000000001, valueMinor: "-3000000001",
    quantity: -1, previousQuantity: 3, newQuantity: 2 };
  assert.equal(inventoryUiMovement(movement), movement);
  const nullable = { purchasePrice: null, purchasePriceMinor: null };
  assert.equal(inventoryUiCatalog(nullable), nullable);
});

test("missing conflicting unsafe negative and noncanonical inventory aliases fail before adoption", () => {
  for (const field of ["purchasePrice", "salePrice", "averageCost", "standardCost", "totalValue", "priceValue"]) {
    for (const bad of [undefined, NaN, Infinity, -0, 1.5, Number.MAX_SAFE_INTEGER + 1])
      assert.throws(() => inventoryUiItem({ ...item, [field]: bad }));
    for (const bad of [undefined, "01", "1e3", "-0", "9007199254740992", "5"])
      assert.throws(() => inventoryUiItem({ ...item, [field + "Minor"]: bad }));
  }
  assert.throws(() => inventoryUiCatalog({ purchasePrice: null, purchasePriceMinor: "0" }));
  assert.throws(() => inventoryUiCatalog({ purchasePrice: -1, purchasePriceMinor: "-1" }));
  assert.throws(() => inventoryUiItem({ ...item, quantityOnHand: 1.5 }));
});

test("valuation preserves separate book and projected values, all currency scales and signed ratios", () => {
  for (const currencyCode of ["USD", "JPY", "KWD"]) {
    const value = { items: [{ ...valuationItem, currencyCode }], summary: { ...report.summary, currencyCode } };
    assert.equal(inventoryUiValuation(value), value);
    assert.equal(BigInt(value.items[0].marginMinor), 3n);
  }
  assert.equal(toMajorDecimal(money(3000000001n, "USD")), "30000000.01");
  assert.equal(toMajorDecimal(money(3000000001n, "JPY")), "3000000001");
  assert.equal(toMajorDecimal(money(3000000001n, "KWD")), "3000000.001");
  assert.equal(inventoryPercent(1n, 2000n), "0.1");
  assert.equal(inventoryPercent(-1n, 2000n), "-0.1");
  assert.equal(inventoryPercent(9007199254740990n, 9007199254740991n), "100.0");
  assert.equal(inventoryShare(-1n, 10n), "0.0");
  assert.equal(inventoryShare(11n, 10n), "100.0");
  assert.equal(inventoryShare(1n, 0n), "0.0");
  assert.equal(inventoryAverageMargin("0.0500000000000000000000"), "0.1");
  assert.equal(inventoryAverageMargin("-0.0500000000000000000000"), "-0.1");
});

test("valuation rejects inconsistent products summaries currencies and money aliases", () => {
  assert.throws(() => inventoryUiValuation({ ...report, items: [{ ...valuationItem, totalCost: 4, totalCostMinor: "4" }] }));
  assert.throws(() => inventoryUiValuation({ ...report, summary: { ...report.summary, carryingValue: 1, carryingValueMinor: "1" } }));
  assert.throws(() => inventoryUiValuation({ ...report, items: [{ ...valuationItem, currencyCode: "JPY" }] }));
  assert.throws(() => inventoryUiValuation({ ...report, items: [{ ...valuationItem, marginMinor: "4" }] }));
  assert.throws(() => inventoryUiValuation({ ...report, items: [{ ...valuationItem, averageCostMinor: undefined }] }));
  assert.equal(inventoryUiListSummary({ totalValue: 1, totalValueMinor: "1", avgMargin: 0.05, avgMarginExact: "0.0500" }).totalValue, 1);
  assert.throws(() => inventoryUiListSummary({ totalValue: 1, totalValueMinor: "2", avgMargin: 0.05, avgMarginExact: "0.0500" }));
  assert.throws(() => inventoryUiListSummary({ totalValue: 1, totalValueMinor: "1", avgMargin: 0.1, avgMarginExact: "0.0500" }));
});

test("BOM exact physical decimals feed cost arithmetic and saved costs must agree", () => {
  const bom = { currencyCode: "USD", assemblyItem: item, laborCostCents: 1, laborCostCentsMinor: "1", overheadCostCents: 2, overheadCostCentsMinor: "2",
    components: [{ componentItem: item, quantity: "0.5", quantityExact: "0.500000", wastagePercent: "0", wastagePercentExact: "0" }],
    costBreakdown: { componentCost: 1500000001, componentCostMinor: "1500000001", laborCost: 1, laborCostMinor: "1", overheadCost: 2, overheadCostMinor: "2", totalCost: 1500000004, totalCostMinor: "1500000004" } };
  assert.equal(inventoryUiBom(bom), bom);
  assert.throws(() => inventoryUiBom({ ...bom, costBreakdown: { ...bom.costBreakdown, totalCost: 1500000003, totalCostMinor: "1500000003" } }));
  assert.throws(() => inventoryUiBom({ ...bom, components: [{ ...bom.components[0], quantityExact: "0.6" }] }));
});

test("nullable stock values and live-stock discrepancy retain saved units; inputs reject partial numbers", () => {
  const line = { expectedQuantity: 3, countedQuantity: 2, discrepancy: -2, valueAdjustment: -3000000001, valueAdjustmentMinor: "-3000000001" };
  assert.equal(inventoryUiStockTakeLine(line), line);
  assert.throws(() => inventoryUiStockTakeLine({ ...line, valueAdjustmentMinor: "-3000000000" }));
  assert.throws(() => inventoryUiStockTakeLine({ ...line, valueAdjustment: null }));
  assert.equal(catalogPriceMinor("30000000.01"), "3000000001");
  assert.equal(catalogWholeInput("-1", true), -1);
  for (const input of ["1.5", "1x", "1e3", "-0", "2147483648"]) assert.throws(() => catalogWholeInput(input, true));
});

test("remaining inventory pages keep validated adoption and exact money guards", () => {
  const files = ["page", "valuation/page", "[id]/page", "[id]/history/page"];
  for (const path of files) assert.match(readFileSync(`app/(dashboard)/inventory/${path}.tsx`, "utf8"), /inventoryUi/);
  const assembly = readFileSync("i18n/inventory-assembly-presentation.ts", "utf8");
  for (const validator of ["inventoryUiBom(row)", "inventoryUiAssembly(row)", "inventoryUiBomDetail({ bom: body.bom, costBreakdown: body.costBreakdown })"]) assert.ok(assembly.includes(validator));
  for (const [path, reader] of [["bom/page", "assemblyBomsJson"], ["bom/[id]/page", "assemblyBomJson"], ["assembly/page", "assemblyOrdersJson"]])
    assert.ok(readFileSync(`app/(dashboard)/inventory/${path}.tsx`, "utf8").includes(`${reader}(await fetch(`));
  const movement = readFileSync("i18n/inventory-movement-presentation.ts", "utf8");
  assert.match(movement, /inventoryUiStockTakeLine\(row\)/);
  assert.match(movement, /inventoryUiItem\(value\)/);
  assert.match(readFileSync("app/(dashboard)/inventory/stock-takes/[id]/page.tsx", "utf8"), /movementStockJson\(res\)/);
  assert.match(readFileSync("app/(dashboard)/inventory/transfers/page.tsx", "utf8"), /\.then\(movementItemsJson\)/);
  // Catalog routes now validate full presentation rows before state adoption;
  // that shared boundary retains the exact-money/count inventory validator.
  assert.match(readFileSync("i18n/inventory-catalog-presentation.ts", "utf8"), /inventoryUiCatalog\(/);
  for (const [path, reader, row] of [["variants", "inventoryVariantsJson", "inventoryVariantRow"], ["suppliers", "inventorySuppliersJson", "inventorySupplierRow"]]) {
    const source = readFileSync(`app/(dashboard)/inventory/[id]/${path}/page.tsx`, "utf8");
    assert.ok(source.includes(`${reader}(await fetch(`) && source.includes(`${row}(data.`));
  }
  const valuation = readFileSync("app/(dashboard)/inventory/valuation/page.tsx", "utf8");
  assert.doesNotMatch(valuation, /\.toFixed\(|Number\(profitAmount\)|summary\.totalCost\s*\//);
  assert.match(valuation, /inventoryShare\(/);
  assert.doesNotMatch(readFileSync("app/(dashboard)/inventory/[id]/page.tsx", "utf8"), /item\.totalValue\s*\?\?/);
});


test("valuation sorting distinguishes ratios below floating-point precision and transfers retain every line", () => {
  const ratio = (margin: number, totalCost: number) => ({ margin, marginMinor: String(margin), totalCost, totalCostMinor: String(totalCost) });
  assert.equal(inventoryValuationMarginCompare(ratio(9007199254740990, 9007199254740991), ratio(9007199254740989, 9007199254740990)), 1);
  assert.equal(inventoryValuationMarginCompare(ratio(-1, 2000), ratio(0, 0)), -1);
  assert.deepEqual(inventoryTransferLines([{ inventoryItemId: "owned", quantity: "2147483647" }]), [{ inventoryItemId: "owned", quantity: 2147483647 }]);
  for (const quantity of ["", "0", "-1", "1.5", "1x", "1e3", "2147483648"])
    assert.throws(() => inventoryTransferLines([{ inventoryItemId: "first", quantity: "1" }, { inventoryItemId: "second", quantity }]));
  assert.throws(() => inventoryTransferLines([{ inventoryItemId: "", quantity: "1" }]));
  assert.throws(() => inventoryTransferLines([]));
});
