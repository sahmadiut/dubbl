import assert from "node:assert/strict";
import { test } from "node:test";
import { calendarReportParams, recurringReportSchema, operationalQuery, normalizeRecurringDescription, recurringFrequency } from "../lib/reports/operational-wire";
import { analyticsRound } from "../lib/reports/document-analytics-wire";

test("operational strict input bounds and UTC defaults", () => {
  assert.equal(recurringReportSchema.parse({}).minOccurrences, 2);
  for (const value of [0, 1, 2.5, 10001, "2", NaN]) assert.throws(() => recurringReportSchema.parse({ minOccurrences: value }));
  for (const query of ["?minOccurrences=2x", "?minOccurrences=02", "?minOccurrences=", "?minOccurrences=2&minOccurrences=3", "?other=2"])
    assert.throws(() => recurringReportSchema.parse(operationalQuery(new Request(`http://fixture.test/${query}`), "recurring")));
  assert.equal(recurringReportSchema.parse(operationalQuery(new Request("http://fixture.test/?minOccurrences=10000"), "recurring")).minOccurrences, 10000);
  assert.deepEqual(calendarReportParams({ startDate: "2024-01-01" }), { startDate: "2024-01-01", endDate: "2024-03-01" });
  assert.equal(calendarReportParams({ startDate: "0001-01-01" }).endDate, "0001-03-02");
  assert.equal(calendarReportParams({ startDate: "9999-12-31", endDate: "9999-12-31" }).endDate, "9999-12-31");
  for (const input of [{ startDate: "2023-02-29" }, { startDate: "9999-12-31" }, { startDate: "2024-03-01", endDate: "2024-02-01" }, { currencyCode: "XXX" }])
    assert.throws(() => calendarReportParams(input));
});

test("recurring descriptions, interval buckets and signed exact average", () => {
  assert.equal(normalizeRecurringDescription("  Rent #123 PAY  "), "rent pay");
  assert.equal(normalizeRecurringDescription("123"), "");
  for (const [days, frequency] of [[7, "weekly"], [14, "biweekly"], [30, "monthly"], [90, "quarterly"], [365, "yearly"], [1, "irregular"], [null, "irregular"]] as const)
    assert.equal(recurringFrequency(days), frequency);
  assert.equal(analyticsRound(-1n, 2n), 0n);
  assert.equal(analyticsRound(1n, 2n), 1n);
  assert.equal(analyticsRound(18014398509481981n, 2n), 9007199254740991n);
});
