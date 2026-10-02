import assert from "node:assert/strict";
import { test } from "node:test";
import { createRateProvider, decodeRateFeed, validateRateFeed } from "../lib/currency/rate-provider";
import { deriveProviderQuotes } from "../lib/currency/triangulate";
import { divideRates, isExtremeRateChange, legacyProviderRate, parseRateJson, providerDecimal, rateDateSchema } from "../lib/currency/rate-policy";
import { manualRateSchema } from "../lib/currency/rate-input";

const now = new Date("2026-10-02T12:00:00Z");
const stamp = Date.parse("2026-10-02T00:00:00Z") / 1000;
const body = (rates = '"USD":1,"EUR":0.900000000000000001,"IRR":1500000') =>
  `{"result":"success","base_code":"USD","time_last_update_unix":${stamp},"rates":{${rates}}}`;

test("providers preserve JSON decimal lexemes, direction and real source timestamps", () => {
  const feed = decodeRateFeed("exchangerate-api", body(), "USD", now);
  assert.equal(feed.rates.EUR, "0.900000000000000001");
  assert.equal(feed.rates.IRR, "1500000");
  assert.equal(feed.observedAt, "2026-10-02T00:00:00.000Z");
  assert.equal(feed.importedAt, now.toISOString());
  const frankfurter = decodeRateFeed("frankfurter", '{"date":"2026-10-01","base":"EUR","rates":{"USD":1.1}}', "EUR", now);
  assert.equal(frankfurter.observedAt, null);
  assert.equal(frankfurter.date, "2026-10-01");
  const oxr = decodeRateFeed("openexchangerates", `{"timestamp":${stamp},"base":"USD","rates":{"EUR":0.9}}`, "EUR", now);
  assert.equal(oxr.base, "USD");
  assert.equal(providerDecimal("6.66666666667e-7"), "0.000000666666666667");
  assert.equal(providerDecimal("1e-18"), "0.000000000000000001");
});

test("malformed, poisoned, missing, future and stale feeds fail closed", () => {
  for (const rate of ["0", "-1", '"NaN"', '"Infinity"', "1e10000000", "1e-19", "1.0000000000000000001", "100000000000000000000", "null", "true", "[]", "{}"])
    assert.throws(() => decodeRateFeed("exchangerate-api", body(`"EUR":${rate}`), "USD", now));
  for (const invalid of [body().replace('"success"', '"error"'), body().replace('"base_code":"USD"', '"base_code":"EUR"'),
    body().replace(`"time_last_update_unix":${stamp},`, ""), body().replace(String(stamp), String(stamp + 86400)),
    body().replace(String(stamp), String(stamp - 8 * 86400)), body('"USD":2,"EUR":1'), body("")])
    assert.throws(() => decodeRateFeed("exchangerate-api", invalid, "USD", now));
  for (const invalid of ['{"rate":01}', '{"rate":1.}', '{"rate":NaN}']) assert.throws(() => parseRateJson(invalid));
  assert.throws(() => parseRateJson(" ".repeat(256001)));
  const feed = decodeRateFeed("exchangerate-api", body(), "USD", now);
  assert.throws(() => validateRateFeed({ ...feed, observedAt: null }, now));
  assert.throws(() => validateRateFeed({ ...feed, observedAt: "2026-10-02" }, now));
  assert.throws(() => validateRateFeed({ ...feed, importedAt: "2026-10-02" }, now));
});

test("exact triangulation and reciprocals use explicit half-up rounding without double rounding", () => {
  assert.equal(divideRates("1", "1500000"), "0.000000666666666667");
  assert.equal(divideRates("0.8", "0.9"), "0.888888888888888889");
  assert.equal(divideRates("1.2345665", "1", 6), "1.234567");
  // 18-place rounding would create a tie at 6dp; direct rational rounding must not.
  assert.equal(divideRates("0.123456649999999999", "0.1", 6), "1.234566");
  const quotes = deriveProviderQuotes({ base: "USD", rates: { EUR: "0.9", IRR: "1500000" } }, "IRR");
  assert.equal(quotes.find(row => row.targetCurrency === "USD")?.quote, "0.000000666666666667");
  assert.equal(quotes.find(row => row.targetCurrency === "USD")?.legacyQuote, "0.000001");
  assert.throws(() => legacyProviderRate("0.000000666666666667", "0.000001"));
  assert.throws(() => legacyProviderRate("1500000", "1500000"));
  assert.equal(legacyProviderRate("0.888888888888888889", "0.888889"), 888889);
  assert.deepEqual(deriveProviderQuotes({ base: "USD", rates: { EUR: "0.9" } }, "GBP"), []);
  assert.equal(deriveProviderQuotes({ base: "USD", rates: { EUR: "0.000000000000000001", IRR: "1500000" } }, "EUR")
    .find(row => row.targetCurrency === "IRR")?.quote, null);
  assert.equal(isExtremeRateChange("1", "1.2"), false);
  assert.equal(isExtremeRateChange("1", "1.200000000000000001"), true);
  assert.equal(isExtremeRateChange("1", "0.8"), false);
  assert.equal(isExtremeRateChange("1", "0.799999999999999999"), true);
});

test("manual boundaries validate Gregorian dates and same-currency identity", () => {
  for (const date of ["2026-02-29", "2026-13-01", "2026-1-01", "2026-10-02T00:00:00Z", "0000-01-01"])
    assert.equal(rateDateSchema.safeParse(date).success, false);
  assert.equal(rateDateSchema.safeParse("2024-02-29").success, true);
  assert.equal(manualRateSchema.safeParse({ baseCurrency: "USD", targetCurrency: "USD", rate: 2, date: "2026-10-02" }).success, false);
  assert.equal(manualRateSchema.safeParse({ baseCurrency: "USD", targetCurrency: "EUR", rate: 2, date: "2026-10-02", source: "api" }).success, false);
});

test("HTTP failures, rate limits, timeouts and oversized responses redact paid-provider credentials", async () => {
  const secret = "synthetic-secret-do-not-log";
  const fetchers: typeof fetch[] = [
    async () => new Response("unavailable", { status: 503 }),
    async () => new Response("rate limited", { status: 429 }),
    async () => new Response("x".repeat(256001)),
    async () => { throw new Error(`https://example.test?app_id=${secret}`); },
    async (_input, init) => new Promise((_resolve, reject) => {
      init!.signal!.addEventListener("abort", () => reject(new Error(secret)), { once: true });
      // Keep the test alive while AbortSignal's unref'ed timer expires.
      setTimeout(() => reject(new Error(secret)), 30);
    }),
  ];
  for (const fetcher of fetchers) {
    const provider = createRateProvider("openexchangerates", secret, { fetcher, now: () => now, timeoutMs: 5 });
    await assert.rejects(provider.fetchRates("USD"), error => {
      assert.equal((error as Error).message, "FX provider openexchangerates unavailable or invalid");
      return true;
    });
  }
});
