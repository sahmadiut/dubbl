import assert from "node:assert/strict";
import { test } from "node:test";
import { itemCreateSchema, itemUpdateSchema, itemDto, openingValue, parseInventoryCsv, bulkItemSchema } from "../lib/api/inventory-master-wire";
import { catalogPrices } from "../lib/api/inventory-catalog-wire";
import { exactBlendAverageCost } from "../lib/money/inventory-cost";

test("inventory master aliases, products and independent physical units", () => {
  const input = itemCreateSchema.parse({ code: "A", name: "A", purchasePrice: 29, purchasePriceMinor: "29", quantityOnHand: 3 });
  assert.equal(openingValue(input), 87);
  assert.equal(catalogPrices(itemUpdateSchema.parse({ salePriceMinor: "9007199254740991" })).salePrice, Number.MAX_SAFE_INTEGER);
  for (const input of [{ purchasePrice: -1 }, { salePrice: 0.5 }, { purchasePriceMinor: "01" }, { quantityOnHand: 1.2 }, { reorderPoint: 2147483648 }, { totalValue: 1 }])
    assert.throws(() => itemCreateSchema.parse({ code: "A", name: "A", ...input }));
  assert.throws(() => catalogPrices(itemCreateSchema.parse({ code: "A", name: "A", purchasePrice: 1, purchasePriceMinor: "2" })));
  assert.throws(() => openingValue(itemCreateSchema.parse({ code: "A", name: "A", purchasePriceMinor: "9007199254740991", quantityOnHand: 2 })));
  assert.equal(openingValue(itemCreateSchema.parse({ code: "A", name: "A", quantityOnHand: -2, purchasePrice: 29 })), 0);
  const dto = itemDto({ purchasePrice: 29, salePrice: 40, averageCost: 29, standardCost: 0, totalValue: 87, quantityOnHand: 3, reorderPoint: 1 });
  assert.equal(dto.priceValueMinor, "87"); assert.equal(dto.totalValueMinor, "87");
  assert.throws(() => itemDto({ ...dto, averageCost: 9007199254740992 }));
  assert.throws(() => bulkItemSchema.parse({ action: "set_active", ids: ["00000000-0000-4000-8000-000000000001"], adjustment: 1 }));
});
test("inventory average cost rounds exact integer ratios at safe edges", () => {
  assert.equal(exactBlendAverageCost(1, 10, 1, 11), 11);
  assert.equal(exactBlendAverageCost(0, 0, 1, Number.MAX_SAFE_INTEGER), Number.MAX_SAFE_INTEGER);
  assert.equal(exactBlendAverageCost(1, 9007199254740990, 1, 9007199254740989), 9007199254740990);
  assert.equal(exactBlendAverageCost(-1, 5, 3, 1), -1);
  assert.equal(exactBlendAverageCost(-1, 4, 3, 1), 0);
});
test("inventory CSV preserves major units, exact aliases and complete quoted records", () => {
  const rows = parseInventoryCsv('code,name,purchasePrice,purchasePriceMinor,quantityOnHand\nA,"Two, words",0.29,29,2\nB,"line\n""two""",1.23,123,3\nC,Invalid,1.234,123,2\nD,Conflict,1,2,1\nE,Units,1,100,2junk');
  assert.equal(catalogPrices(rows[0].input!).purchasePrice, 29); assert.equal(rows[1].input!.name, 'line\n"two"');
  assert.ok(rows[2].error); assert.ok(rows[3].error); assert.ok(rows[4].error);
  assert.equal(catalogPrices(parseInventoryCsv("code,name,purchasePriceMinor\nA,Exact,3000000000")[0].input!).purchasePrice, 3000000000);
  const exported = parseInventoryCsv('"Code","Name","Category","SKU","Quantity","Reorder Point","Purchase Price","Sale Price","Status"\n"A","Item","","","0","0","90071992547409.91","1.25","Inactive"');
  assert.equal(exported[0].input!.isActive, false); assert.equal(exported[0].input!.purchasePrice, Number.MAX_SAFE_INTEGER);
  for (const csv of ['code,name\nA,"unterminated', 'code,name,name\nA,B,C', 'code,name,unknown\nA,B,C', 'code,name\nA,"B"oops']) assert.throws(() => parseInventoryCsv(csv));
});
