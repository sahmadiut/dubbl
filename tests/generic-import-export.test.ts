import assert from "node:assert/strict";
import { test } from "node:test";
import { parseMoney } from "../lib/import-export/transformers";
import { centsToDecimal, generateCSV, parseCSV, spreadsheetCell } from "../lib/import-export/csv-utils";
import { mappedCsvRows, parseGenericRow } from "../lib/import-export/generic-wire";
import { preProcessBankTransactions, preProcessProducts } from "../lib/import-export/pre-process";
import { WireCompatibilityError } from "../lib/money/wire";
import { createZip } from "../lib/import-export/zip";
import { spawnSync } from "node:child_process";
import { z } from "zod";

test("generic decimal imports preserve hundredths and valid source grouping without rounding", () => {
  for (const [input, expected] of [["0.29", 29], ["$1,234.56", 123456], ["1.234,56", 123456], ["(12.50)", -1250], ["-0.01", -1], ["", 0], ["90071992547409.91", Number.MAX_SAFE_INTEGER]] as const) assert.equal(parseMoney(input), expected);
  for (const input of ["1.005", "1e3", "NaN", "123foo", "12,34", "1.234,567", "--1", "(-1)", "۱.۲۵", "- 1", "1 234.56"]) assert.throws(() => parseMoney(input));
  for (const input of ["90071992547409.92", 2 ** 45, Infinity]) assert.throws(() => parseMoney(input), WireCompatibilityError);
  assert.deepEqual(preProcessProducts([{ unitPrice: "0.29", costPrice: "$12.50" }]), [{ unitPrice: "0.29", costPrice: "12.50" }]);
  assert.deepEqual(preProcessBankTransactions([{ credit: "0.29", debit: "0.01" }], "custom"), [{ amount: "0.28" }]);
});
test("generic exact product aliases agree and preflight the opening-stock value", () => {
  const row = parseGenericRow("products", { name: "Item", unitPrice: "0.29", unitPriceMinor: "29", costPriceMinor: "2147483750" }, "custom");
  assert.equal(row.entity, "products"); if (row.entity === "products") assert.equal(row.data.purchasePrice, 2147483750);
  for (const value of [{ unitPriceMinor: "01" }, { unitPrice: "0.29", unitPriceMinor: "30" }, { unitPriceMinor: "-1" }, { quantityOnHand: "1.5" }, { quantityOnHand: 1 }, { type: "inventory" }, { organizationId: "foreign" }])
    assert.throws(() => parseGenericRow("products", { name: "Item", ...value }, "custom"));
  assert.throws(() => parseGenericRow("products", { name: "Item", costPriceMinor: "9007199254740991", quantityOnHand: 2 }, "custom"), WireCompatibilityError);
  assert.throws(() => parseGenericRow("products", { name: "Item", unitPriceMinor: "9007199254740992" }, "custom"), WireCompatibilityError);
  assert.throws(() => parseGenericRow("products", { name: "Item", quantityOnHand: "1.5" }, "custom"), z.ZodError);
});
test("CSV parser preserves exact lexemes, escaped quotes and multiline data and rejects ambiguous columns", () => {
  const rows = [{ name: 'One, "item"\ncontinued', unitPriceMinor: "9007199254740991" }];
  assert.deepEqual(parseCSV(generateCSV(rows, ["name", "unitPriceMinor"])).rows, rows);
  const mapped = mappedCsvRows("products", "quickbooks", 'Item Name,Sales Price,SKU\r\n"First, item",0.29,SKU-1');
  assert.deepEqual(mapped, [{ name: "First, item", unitPrice: "0.29", sku: "SKU-1" }]);
  for (const text of ['name,name\na,b', 'name\n"unterminated', 'name,price\nitem', 'name\n"x"trailing', 'name,,price\nx,y,z', "name\nx\n".repeat(1002)]) assert.throws(() => parseCSV(text));
  assert.throws(() => mappedCsvRows("products", "quickbooks", 'Item Name,name\na,b'));
});
test("CSV and spreadsheet forwarding preserve full integer text and reject rounded numeric carriers", () => {
  assert.equal(centsToDecimal(Number.MAX_SAFE_INTEGER), "90071992547409.91");
  assert.equal(centsToDecimal(-Number.MAX_SAFE_INTEGER), "-90071992547409.91");
  assert.equal(centsToDecimal(9223372036854775807n), "92233720368547758.07");
  assert.equal(spreadsheetCell(9007199254740991, true), "9007199254740991");
  assert.equal(spreadsheetCell(9223372036854775807n), "9223372036854775807");
  assert.equal(spreadsheetCell("-0.01", true), "-0.01");
  assert.equal(spreadsheetCell(1.5), 1.5);
  assert.throws(() => spreadsheetCell(1.5, true), WireCompatibilityError);
  for (const value of [Number.MAX_SAFE_INTEGER + 1, NaN, Infinity]) {
    assert.throws(() => centsToDecimal(value), WireCompatibilityError);
    assert.throws(() => spreadsheetCell(value), WireCompatibilityError);
    assert.throws(() => generateCSV([{ value }], ["value"]), WireCompatibilityError);
  }
  assert.throws(() => generateCSV([{ value: {} }], ["value"]));
});
test("ZIP export contains valid checksums accepted by an independent ZIP reader", () => {
  const zip = createZip([{ name: "products.csv", data: new TextEncoder().encode('name,unitPriceMinor\n"item, one",9007199254740991') }]);
  const result = spawnSync("python", ["-c", "import sys,io,zipfile; z=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())); assert z.testzip() is None; assert z.read('products.csv').endswith(b'9007199254740991')"], { input: zip });
  assert.equal(result.status, 0, String(result.stderr));
});
