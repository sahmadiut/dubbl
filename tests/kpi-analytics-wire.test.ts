import assert from "node:assert/strict";
import { test } from "node:test";
import { executivePriorPeriod, kpiAnalyticsQuery, monthlyTrendsSchema, utcMonthWindow } from "../lib/reports/kpi-analytics-wire";
import { analyticsPercentage, analyticsRound } from "../lib/reports/document-analytics-wire";

test("KPI UTC calendar windows retain month boundaries and equal inclusive prior periods", () => {
  assert.deepEqual(utcMonthWindow(3, new Date("2024-03-31T23:00:00Z")), {
    startDate: "2024-01-01", endDate: "2024-03-31", keys: ["2024-01", "2024-02", "2024-03"],
  });
  assert.deepEqual(executivePriorPeriod("2024-03-01", "2024-03-31"), { startDate: "2024-01-30", endDate: "2024-02-29" });
  assert.throws(() => executivePriorPeriod("0001-01-01", "0001-01-02"));
});

test("monthly and KPI query contracts reject malformed, duplicate and unsupported parameters", () => {
  for (const months of [0, -1, 25, 1.5, NaN, "6"]) assert.equal(monthlyTrendsSchema.safeParse({ months }).success, false);
  for (const suffix of ["months=0", "months=-1", "months=25", "months=6x", "months=1.5", "months=", "months=06", "months=1&months=2", "other=1"]) {
    assert.throws(() => kpiAnalyticsQuery(new Request(`http://fixture.test/?${suffix}`), "monthly-trends"));
  }
  assert.deepEqual(kpiAnalyticsQuery(new Request("http://fixture.test/?months=24"), "monthly-trends").input, { months: 24 });
});

test("KPI shares and average rounding use integer ratios including negative ties", () => {
  assert.equal(analyticsRound(-3n, 2n), -1n);
  assert.equal(analyticsPercentage(1n, 32n), 3.13);
  assert.equal(analyticsPercentage(-1n, 32n), -3.12);
  assert.equal(analyticsPercentage(9007199254740991n, 9007199254740991n), 100);
});
