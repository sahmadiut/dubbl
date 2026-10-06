import assert from "node:assert/strict";
import { test } from "node:test";
import { agingQuery, agingSchema, agingDays, agingBucket, agingMoney, agingCurrency, agingDate } from "../lib/reports/aging-wire";
import { WireCompatibilityError } from "../lib/money/wire";

test("aging dates and strict queries distinguish explicit history from live mode", () => {
  const parse = (query: string) => agingQuery(new Request(`http://fixture.test/${query}`));
  assert.deepEqual(parse(""), { input: {}, format: "json" });
  assert.deepEqual(parse("?asAt=2024-02-29&currencyCode=IRR&format=XLSX"), { input: { asAt: "2024-02-29", currencyCode: "IRR" }, format: "xlsx" });
  for (const query of ["?asAt=2023-02-29", "?asAt=2024-02-30", "?asAt=0000-01-01", "?asAt=", "?asAt=2024-01-01&asAt=2024-01-01",
    "?currencyCode=usd", "?currencyCode=XXX", "?currencyCode=", "?format=csv", "?format=pdf&format=json", "?amountMinor=1"]) assert.throws(() => parse(query));
  assert.throws(() => agingSchema.parse({ extra: true }));
  for (const date of ["0001-01-01", "9999-12-31", "2024-02-29"]) agingDate(date);
  assert.throws(() => agingDate("infinity"), WireCompatibilityError);
});

test("aging day buckets use exact UTC date boundaries", () => {
  for (const [due, days, bucket] of [["2024-05-02", -1, 0], ["2024-05-01", 0, 0], ["2024-04-30", 1, 1],
    ["2024-04-01", 30, 1], ["2024-03-31", 31, 2], ["2024-03-02", 60, 2], ["2024-03-01", 61, 3],
    ["2024-02-01", 90, 3], ["2024-01-31", 91, 4]] as const) {
    assert.equal(agingDays("2024-05-01", due), days); assert.equal(agingBucket(days), bucket);
  }
});

test("aging numeric and exact fields retain signed fixed units and safe bounds", () => {
  for (const value of [0n, -1n, 1250n, 9007199254740991n, -9007199254740991n]) {
    assert.deepEqual(agingMoney("amountDue", value), { amountDue: Number(value), amountDueMinor: value.toString() });
  }
  for (const value of [9007199254740992n, -9007199254740992n]) assert.throws(() => agingMoney("total", value), WireCompatibilityError);
  for (const currency of ["USD", "IRR", "JPY", "KWD"]) assert.equal(agingCurrency(currency), currency);
  assert.throws(() => agingCurrency("XXX"), WireCompatibilityError);
});
