import assert from "node:assert/strict";
import { test } from "node:test";
import { taxReportQuery, report1099Schema, taxReportDto, taxReportThreshold, roundTaxRatio } from "../lib/reports/tax-report-wire";
import { WireCompatibilityError } from "../lib/money/wire";

test("tax report queries reject partial numeric parsing, invalid dates, duplicates and alias conflicts", () => {
  for (const query of ["year=2024tail", "year=2e3", "threshold=1.5", "threshold=01", "threshold=-0", "threshold=9007199254740992", "threshold=1&thresholdMinor=2", "year=2024&year=2024", "amount=1"])
    assert.throws(() => taxReportQuery(new Request(`https://fixture.test/?${query}`), "1099"));
  for (const query of ["startDate=2023-02-29", "startDate=2024-02-02&endDate=2024-02-01", "basis=bad", "flatRatePercent=14.5", "flatRatePercent=10001"])
    assert.throws(() => taxReportQuery(new Request(`https://fixture.test/?${query}`), "vat-return"));
  assert.equal(taxReportThreshold(report1099Schema.parse({ threshold: 1250, thresholdMinor: "1250" })), 1250n);
  assert.throws(() => taxReportThreshold(report1099Schema.parse({ thresholdMinor: "9007199254740992" })), WireCompatibilityError);
});
test("final tax cents have numeric compatibility and exact aliases; unsafe finals fail", () => {
  assert.deepEqual(taxReportDto({ amount: -1250n, rows: [{ total: 9007199254740991n, count: 2 }] }),
    { amount: -1250, amountMinor: "-1250", rows: [{ total: 9007199254740991, totalMinor: "9007199254740991", count: 2 }] });
  assert.throws(() => taxReportDto({ amount: 9007199254740992n }), WireCompatibilityError);
});
test("flat-rate rounding retains positive-infinity ties with exact large operands", () => {
  for (const [value, result] of [[50n, 1n], [-50n, 0n], [149n, 1n], [-149n, -1n], [-150n, -1n]] as const)
    assert.equal(roundTaxRatio(value, 100n), result);
  assert.equal(roundTaxRatio(9007199254740991n * 1450n, 10000n), 1306043891937444n);
});
