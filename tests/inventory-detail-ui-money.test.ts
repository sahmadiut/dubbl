import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { inventoryDetailMoney, inventoryWriteDown } from "../lib/money/inventory-detail-ui";
import { bankMoneyDisplay } from "../lib/money/bank-display";

const row = {
  purchasePrice: 3000000001, purchasePriceMinor: "3000000001",
  salePrice: 3000000002, salePriceMinor: "3000000002",
  totalValue: 6000000002, totalValueMinor: "6000000002",
  priceValue: 9000000003, priceValueMinor: "9000000003", quantityOnHand: 3,
};

test("inventory detail keeps carrying and catalog price value distinct and preserves low digits", () => {
  const result = inventoryDetailMoney(row);
  assert.equal(result.carrying, 6000000002n);
  assert.equal(result.priceValue, 9000000003n);
  assert.equal(result.profit, 1n);
  assert.equal(result.margin, "0.0%");
  assert.equal(bankMoneyDisplay(result.carrying, "USD"), "$60,000,000.02");
  const edge = inventoryDetailMoney({ ...row, quantityOnHand: 1, purchasePrice: Number.MAX_SAFE_INTEGER,
    purchasePriceMinor: "9007199254740991", priceValue: Number.MAX_SAFE_INTEGER, priceValueMinor: "9007199254740991" });
  assert.equal(edge.priceValue, 9007199254740991n);
  const margin = (purchase: number, sale: number) => inventoryDetailMoney({ ...row, quantityOnHand: 1, purchasePrice: purchase,
    purchasePriceMinor: String(purchase), priceValue: purchase, priceValueMinor: String(purchase), salePrice: sale, salePriceMinor: String(sale) }).margin;
  assert.equal(margin(2000, 2001), "0.1%");
  assert.equal(margin(2000, 1999), "-0.1%");
  assert.equal(margin(2000, 2500), "25.0%");
  assert.equal(margin(0, 100), "-");
});

test("inventory saved fields reject malformed missing conflicting or unsafe aliases before display/actions", () => {
  for (const field of ["purchasePrice", "salePrice", "totalValue", "priceValue"] as const) {
    for (const bad of [NaN, Infinity, 1.5, -0, Number.MAX_SAFE_INTEGER + 1])
      assert.throws(() => inventoryDetailMoney({ ...row, [field]: bad }));
    for (const bad of [undefined, "01", "1e3", "-0", "9007199254740992", "2"])
      assert.throws(() => inventoryDetailMoney({ ...row, [field + "Minor"]: bad }));
  }
  for (const quantityOnHand of [1.5, NaN, -0, 2147483648, -2147483649])
    assert.throws(() => inventoryDetailMoney({ ...row, quantityOnHand }));
  assert.throws(() => inventoryDetailMoney({ ...row, quantityOnHand: 4 }));
  assert.throws(() => inventoryDetailMoney({ ...row, totalValue: -1, totalValueMinor: "-1" }));
});

test("write-down preview and canonical payload preserve cents without float rounding", () => {
  assert.deepEqual(inventoryWriteDown("30000000.01", 9000000003n), {
    valueDeltaMinor: "3000000001", amount: 3000000001n, remaining: 6000000002n,
  });
  assert.equal(inventoryWriteDown("12.50", 1250n).remaining, 0n);
  assert.equal(inventoryWriteDown("0.01", 1n).valueDeltaMinor, "1");
  assert.equal(inventoryWriteDown("90071992547409.91", 9007199254740991n).amount, 9007199254740991n);
  for (const input of ["", "0", "-1", "-0", "1e3", "1,000", "12x", " 1", "1 ", "01", "0.001", "NaN", "Infinity", "90071992547409.92"])
    assert.throws(() => inventoryWriteDown(input, 9007199254740991n));
  assert.throws(() => inventoryWriteDown("12.51", 1250n));
  assert.throws(() => inventoryWriteDown("0.01", 0n));
  assert.throws(() => inventoryWriteDown("0.01", -1n));
});

test("scoped UI guard rejects monetary float assumptions and keeps exact write/read wiring", () => {
  const source = readFileSync("app/(dashboard)/inventory/[id]/layout.tsx", "utf8");
  assert.doesNotMatch(source, /parseFloat|Math\.round|\.toFixed\(|CurrencyInput|valueDelta:\s/);
  assert.match(source, /valueDeltaMinor: preview\.valueDeltaMinor/);
  assert.match(source, /formatMoney\(detail\.carrying\)/);
  assert.match(source, /formatMoney\(detail\.priceValue\)/);
  assert.match(source, /inventoryDetailMoney\(data\.inventoryItem\)/);
  assert.match(source, /inputMode="decimal"/);
  assert.match(source, /role="alert"/);
  assert.match(source, /!writeDownPreview \|\| !writeDownReason\.trim\(\)/);
});
