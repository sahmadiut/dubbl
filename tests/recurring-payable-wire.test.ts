import assert from "node:assert/strict";
import { test } from "node:test";
import { recurringPayableStoredLines, recurringPayableTotals, recurringPayableCreateSchema } from "../lib/api/recurring-payable-wire";

test("payable prices preserve exact fixed cents and signed ties", () => {
  for (const price of [{ unitPrice: 12.5 }, { unitPriceExact: "12.50" }, { unitPriceMinor: "1250" }, { unitPrice: 12.5, unitPriceExact: "12.50", unitPriceMinor: "1250" }]) {
    assert.equal(recurringPayableStoredLines([{ description: "Price", ...price }])[0].unitPrice, 1250);
  }
  assert.equal(recurringPayableStoredLines([{ description: "Tie", unitPriceExact: "1.005" }])[0].unitPrice, 101);
  assert.equal(recurringPayableStoredLines([{ description: "Tie", unitPriceExact: "-1.005" }])[0].unitPrice, -100);
  for (const price of [{ unitPriceMinor: "01" }, { unitPriceMinor: "9007199254740992" }, { unitPriceExact: "1e3" }, { unitPrice: 1, unitPriceExact: "2" }, { unitPriceMinor: "101", unitPriceExact: "1" }])
    assert.throws(() => recurringPayableStoredLines([{ description: "Invalid", ...price }]));
  const base = { name: "Template", type: "bill", contactId: "00000000-0000-4000-8000-000000000001", frequency: "monthly", startDate: "2026-01-01", lines: [{ description: "Price", unitPriceExact: "12.5" }] };
  for (const currencyCode of ["USD", "JPY", "KWD", "IRR"]) {
    const parsed = recurringPayableCreateSchema.parse({ ...base, currencyCode });
    assert.equal(recurringPayableStoredLines(parsed.lines)[0].unitPrice, 1250);
  }
});
test("payable totals use exact products/sums and preserve bill versus expense policies", () => {
  const lines = recurringPayableStoredLines([{ description: "Line", quantity: 1.5, unitPriceExact: "12.5", discountPercent: 1000, taxRateId: "00000000-0000-4000-8000-000000000001" }]);
  const rates = new Map([[lines[0].taxRateId!, 1000]]);
  assert.equal(recurringPayableTotals(lines, rates, "bill").total, 1856);
  assert.equal(recurringPayableTotals(lines, rates, "expense").total, 1875);
  assert.equal(recurringPayableTotals(lines, rates, "bill", true).total, 1875);
  const large = recurringPayableStoredLines([{ description: "Large", unitPriceMinor: "9007199254740991" }]);
  assert.equal(recurringPayableTotals(large, new Map(), "bill").total, Number.MAX_SAFE_INTEGER);
  assert.throws(() => recurringPayableTotals([...large, ...large], new Map(), "expense"));
  assert.throws(() => recurringPayableTotals([{ ...large[0], quantity: 200, discountPercent: 10000 }], new Map(), "bill"));
});
