import assert from "node:assert/strict";
import { test } from "node:test";
import { comparisonWindows, periodChangePercent, periodReportQuery, periodRange, profitLossSchema } from "../lib/reports/period-statement-wire";

test("Period wire validates real dates, strict queries and bounded counts", () => {
  const request = (query: string) => new Request(`http://fixture.test?${query}`);
  for (const query of ["startDate=2024-02-30", "basis=other", "startDate=2024-01-01&startDate=2024-01-02", "unknown=1", "format=csv", "costCenterId=invalid"]) {
    assert.throws(() => periodReportQuery(request(query), "profit-and-loss"));
  }
  for (const periods of ["0", "-1", "1.5", "13", "01", "1e1", "", "NaN"]) {
    assert.throws(() => periodReportQuery(request(`periods=${periods}`), "pnl-comparison"));
  }
  assert.deepEqual(periodReportQuery(request("periods=12"), "pnl-comparison").input, { periods: 12 });
  assert.equal(periodReportQuery(request("format=XLSX"), "profit-and-loss").format, "xlsx");
  assert.throws(() => periodRange("2024-02-01", "2024-01-01"));
  assert.throws(() => profitLossSchema.parse({ endDate: "2024-01-31", unknown: 1 }));
});

test("Comparison windows use full UTC Gregorian periods across year/leap boundaries", () => {
  const previousTimezone = process.env.TZ;
  try {
    process.env.TZ = "Asia/Tehran";
    assert.deepEqual(comparisonWindows({ asAt: "2024-02-15", periods: 3 }).windows, [
      { startDate: "2023-12-01", endDate: "2023-12-31", label: "Dec 2023" },
      { startDate: "2024-01-01", endDate: "2024-01-31", label: "Jan 2024" },
      { startDate: "2024-02-01", endDate: "2024-02-29", label: "Feb 2024" },
    ]);
    assert.deepEqual(comparisonWindows({ compare: "quarterly", asAt: "2024-02-15", periods: 2 }).windows, [
      { startDate: "2023-10-01", endDate: "2023-12-31", label: "Q4 2023" },
      { startDate: "2024-01-01", endDate: "2024-03-31", label: "Q1 2024" },
    ]);
    assert.equal(comparisonWindows({ compare: "yearly", asAt: "0099-06-01", periods: 1 }).windows[0].startDate, "0099-01-01");
    assert.throws(() => comparisonWindows({ asAt: "0001-01-01", periods: 2 }));
    assert.equal(comparisonWindows({ asAt: "9999-12-31", periods: 1 }).windows[0].endDate, "9999-12-31");
  } finally { if (previousTimezone === undefined) delete process.env.TZ; else process.env.TZ = previousTimezone; }
});

test("Comparison percentages use exact ratios with Math.round signed tie behavior", () => {
  assert.equal(periodChangePercent(10001n, 10000n), 0.01);
  assert.equal(periodChangePercent(9999n, 10000n), -0.01);
  assert.equal(periodChangePercent(20001n, 20000n), 0.01);
  assert.equal(periodChangePercent(19999n, 20000n), 0);
  assert.equal(periodChangePercent(-50n, -100n), 50);
  assert.equal(periodChangePercent(9007199254740991n, 9007199254740990n), 0);
  assert.equal(periodChangePercent(1n, 0n), 0);
  assert.throws(() => periodChangePercent(9007199254740991n, 1n), { name: "WireCompatibilityError" });
});
