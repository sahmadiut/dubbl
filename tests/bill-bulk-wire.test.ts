import assert from "node:assert/strict";
import { test } from "node:test";
import { billImportRowSchema, billImportGroups, billImportLine, billImportTotals, billImportAmount } from "../lib/api/bill-bulk-wire";
import { getMapping } from "../lib/import-export/mappings";

const basic = { contactName: "Supplier", issueDate: "2026-06-01", dueDate: "2026-07-01", lineDescription: "Service" };
const row = (values: Record<string, unknown> = {}) => billImportRowSchema.parse({ ...basic, ...values });
test("bill import legacy/exact prices, currency scale and extended rounding", () => {
  for (const price of [{ lineUnitPrice: 12.5 }, { lineUnitPrice: "12.50" }, { lineUnitPriceExact: "12.50" },
    { lineUnitPriceMinor: "1250" }, { lineUnitPrice: 12.5, lineUnitPriceExact: "12.50", lineUnitPriceMinor: "1250" }]) {
    assert.equal(billImportLine(row({ ...price, lineQuantity: "1.5" })).amount, 1875);
  }
  for (const [currencyCode, expected] of [["JPY", 13], ["IRR", 13], ["KWD", 12500]] as const)
    assert.equal(billImportLine(row({ currencyCode, lineUnitPriceExact: "12.50" })).amount, expected);
  assert.equal(billImportLine(row({ lineQuantity: 3, lineUnitPriceExact: "0.005" })).amount, 2);
  assert.equal(billImportLine(row({ lineUnitPriceExact: "-0.015" })).amount, -1);
  assert.equal(billImportLine(row({ lineUnitPriceMinor: "9007199254740991" })).amount, Number.MAX_SAFE_INTEGER);
  for (const lineQuantity of [21474836.474, "21474836.474"])
    assert.equal(billImportLine(row({ lineQuantity })).quantity, 2147483647);
});
test("bill import legacy formatted amount overrides and exact agreement", () => {
  for (const lineAmount of ["$1,234.56", "1.234,56", 1234.56]) {
    assert.equal(billImportLine(row({ lineUnitPrice: 1, lineAmount, lineAmountExact: "1234.56", lineAmountMinor: "123456" })).amount, 123456);
  }
  assert.equal(billImportLine(row({ lineAmount: "(0.015)" })).amount, -2);
  assert.equal(billImportLine(row({ lineAmount: "-0.015" })).amount, -1);
  assert.equal(billImportLine(row({ lineAmountMinor: "0", lineUnitPrice: 12.5 })).amount, 0);
  assert.equal(billImportLine(row({ lineAmount: "", lineUnitPrice: 12.5 })).amount, 1250);
  assert.throws(() => billImportAmount("12junk"));
  for (const values of [{ lineUnitPrice: "12.50", lineUnitPriceExact: "12.51" }, { lineAmount: "12.50", lineAmountExact: "12.51" },
    { lineAmountExact: "12.50", lineAmountMinor: "1251" }, { lineUnitPriceMinor: "9007199254740992" },
    { lineUnitPriceMinor: "9007199254740991", lineQuantity: 2, lineAmountMinor: "0" }, { lineQuantity: "21474836.48" }])
    assert.throws(() => billImportLine(row(values)));
  assert.throws(() => row({ lineUnitPriceExact: "1e3" }));
  assert.throws(() => row({ lineAmountMinor: "01" }));
});
test("bill import grouping isolates automatic rows, validates headers and sums", () => {
  assert.equal(billImportGroups([row(), row({ billNumber: "_auto_0" }), row()]).length, 3);
  assert.equal(billImportGroups([row({ billNumber: "A" }), row({ billNumber: "A", contactName: "supplier" })]).length, 1);
  assert.throws(() => billImportGroups([row({ billNumber: "A" }), row({ billNumber: "A", currencyCode: "JPY" })]));
  assert.throws(() => billImportTotals([row({ lineAmountMinor: "9007199254740991" }), row({ lineAmountMinor: "1" })]));
  assert.equal(billImportTotals([row({ lineAmountMinor: "9007199254740991" }), row({ lineAmountMinor: "-1" })]).total, 9007199254740990);
  for (const source of ["quickbooks", "xero", "freshbooks", "wave", "custom"] as const) {
    assert.ok(getMapping(source, "bills").some(field => field.targetField === "lineAmountMinor" && field.aliases.includes("lineAmountMinor")));
    assert.ok(getMapping(source, "bills").some(field => field.targetField === "currencyCode"));
  }
});
