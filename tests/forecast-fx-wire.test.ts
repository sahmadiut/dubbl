import assert from "node:assert/strict";
import { test } from "node:test";
import { cashForecastSchema, forecastFxQuery, forecastFxRate, forecastFxConvert, forecastAddDays, forecastWeekOf, forecastFxInverse } from "../lib/reports/forecast-fx-wire";

test("forecast horizon/currency and FX empty input reject unsupported parameters", () => {
  const request = (query: string) => new Request(`https://fixture.test/${query}`);
  assert.equal(cashForecastSchema.parse({}).weeks, 12);
  assert.deepEqual(forecastFxQuery(request("?weeks=52&currencyCode=IRR"), true), { weeks: 52, currencyCode: "IRR" });
  for (const query of ["?weeks=0", "?weeks=-1", "?weeks=53", "?weeks=1.5", "?weeks=12junk", "?weeks=01", "?weeks=", "?weeks=1e1", "?weeks=2&weeks=2", "?currencyCode=usd", "?currencyCode=XXX", "?format=csv"]) {
    assert.throws(() => forecastFxQuery(request(query), true));
  }
  assert.throws(() => cashForecastSchema.parse({ weeks: "12" }));
  assert.throws(() => forecastFxQuery(request("?asOf=2020-01-01"), false));
});

test("forecast UTC dates and exact FX cents preserve legacy tie rounding", () => {
  assert.equal(forecastWeekOf("2024-03-01"), "2024-02-25");
  assert.equal(forecastAddDays("2024-02-28", 1), "2024-02-29");
  assert.throws(() => forecastAddDays("2023-02-29", 1));
  assert.equal(forecastFxConvert(1n, "0.5"), 1n);
  assert.equal(forecastFxConvert(-1n, "0.5"), 0n);
  assert.equal(forecastFxConvert(9007199254740991n, "0.5"), 4503599627370496n);
  assert.equal(forecastFxConvert(9007199254740991n, "2147.483647"), 19342813104826865393n);
  assert.deepEqual(forecastFxRate("1.250000"), { rate: 1250000, rateExact: "1.25" });
  assert.equal(forecastFxInverse("2"), "0.5");
  assert.throws(() => forecastFxInverse("3"), { code: "LEGACY_NUMERIC_RANGE" });
  for (const quote of ["0", "0.0000001", "1.0000001", "2147.483648", "NaN"])
    assert.throws(() => forecastFxRate(quote), { code: "LEGACY_NUMERIC_RANGE" });
});
