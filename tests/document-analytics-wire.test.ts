import assert from "node:assert/strict";
import { test } from "node:test";
import { analyticsMoney, analyticsPercentage, analyticsRound, analyticsStoredMinor, documentAnalyticsDates, documentAnalyticsQuery } from "../lib/reports/document-analytics-wire";

test("analytics integer averages and percentages retain exact rounding, signs and bounds", () => {
  assert.equal(analyticsRound(2003n, 2n), 1002n);
  assert.equal(analyticsRound(-2003n, 2n), -1001n);
  assert.equal(analyticsRound(-2004n, 2n), -1002n);
  assert.equal(analyticsPercentage(1n, 3n), 33.33);
  assert.equal(analyticsPercentage(9007199254740991n, 9007199254740991n), 100);
  assert.equal(analyticsPercentage(-1n, 0n), 0);
  assert.deepEqual(analyticsMoney("total", -9007199254740991n), { total: -Number.MAX_SAFE_INTEGER, totalMinor: "-9007199254740991" });
  for (const value of ["9007199254740992", "9223372036854775807", "1.5", "01", "NaN"]) assert.throws(() => analyticsStoredMinor(value));
  assert.throws(() => analyticsMoney("total", 9007199254740992n));
});

test("analytics dates, formats and currency filters validate without coercion", () => {
  assert.equal(documentAnalyticsDates({ startDate: "2024-02-29", endDate: "2024-03-01", currencyCode: "IRR" }).currencyCode, "IRR");
  for (const input of [{ startDate: "2023-02-29" }, { startDate: "2024-03-02", endDate: "2024-03-01" }, { currencyCode: "usd" }, { currencyCode: "XXX" }, { endDate: "" }])
    assert.throws(() => documentAnalyticsDates(input));
  for (const query of ["?startDate=2024-01-01&startDate=2024-01-01", "?unknown=x", "?format=csv"]) assert.throws(() => documentAnalyticsQuery(new Request(`http://fixture.test/${query}`), true));
  assert.throws(() => documentAnalyticsQuery(new Request("http://fixture.test/?format=pdf"), false));
});
