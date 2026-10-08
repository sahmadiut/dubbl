import assert from "node:assert/strict";
import { test } from "node:test";
import { bankCashFlowParams, bankPeriod, bankAnalyticsQuery, bankStatusSchema } from "../lib/reports/bank-analytics-wire";
import { bankTotalDecimal } from "../lib/reports/bank-analytics-display";

test("bank report strict dates, currency, grouping and scoped selectors", () => {
  for (const input of [{ startDate: "2024-02-30" }, { startDate: "2024-04-01", endDate: "2024-03-31" },
    { groupBy: "year" }, { currencyCode: "usd" }, { currencyCode: "XXX" }, { bankAccountId: "x" }, { unknown: 1 }])
    assert.throws(() => bankCashFlowParams(input));
  for (const suffix of ["?groupBy=day&groupBy=week", "?unknown=1", "?startDate="])
    assert.throws(() => bankCashFlowParams(bankAnalyticsQuery(new Request(`http://fixture.test/${suffix}`), true)));
  assert.throws(() => bankStatusSchema.parse({ currencyCode: "USD" }));
  const defaults = bankCashFlowParams({});
  assert.equal(defaults.groupBy, "month"); assert.equal(defaults.endDate, new Date().toISOString().slice(0, 10));
  assert.equal(defaults.startDate, `${defaults.endDate.slice(0, 4)}-01-01`);
});

test("bank periods retain UTC month ends, leap years and Monday week windows", () => {
  assert.deepEqual(bankPeriod("2024-02-01", "month"), { label: "Feb 2024", startDate: "2024-02-01", endDate: "2024-02-29" });
  assert.equal(bankPeriod("2023-02-01", "month").endDate, "2023-02-28");
  assert.equal(bankPeriod("2024-12-01", "month").endDate, "2024-12-31");
  assert.deepEqual(bankPeriod("2024-02-26", "week"), { label: "2024-02-26 - 2024-03-03", startDate: "2024-02-26", endDate: "2024-03-03" });
  assert.equal(bankPeriod("2024-02-29", "day").endDate, "2024-02-29");
});

test("bank display totals retain every minor unit across currency scales beyond int64", () => {
  assert.equal(bankTotalDecimal(1250n, "USD"), "12.50");
  assert.equal(bankTotalDecimal(1250n, "IRR"), "1250");
  assert.equal(bankTotalDecimal(-1250n, "JPY"), "-1250");
  assert.equal(bankTotalDecimal(-1n, "KWD"), "-0.001");
  assert.equal(bankTotalDecimal(9223372036854775809n, "USD"), "92233720368547758.09");
});
