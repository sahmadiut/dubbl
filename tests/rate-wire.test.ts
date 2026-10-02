import assert from "node:assert/strict";
import { test } from "node:test";
import { z } from "zod";
import { coexistRateSchema, manualWireRateSchema, mcpWireRateSchema, storedRateDto } from "../lib/currency/rate-wire";
import { WireCompatibilityError } from "../lib/money/wire";
import type { exchangeRate } from "../lib/db/schema";

test("REST millionths and MCP decimal aliases keep their distinct v1 units", () => {
  const expected = { rate: 1234567, rateExact: "1.234567", rateDirection: "quote_per_base" };
  for (const input of [{ rate: 1234567 }, { rateExact: "1.234567000" }, { rate: 1234567, rateExact: "1.234567" }]) {
    assert.deepEqual(coexistRateSchema.parse(input), expected);
  }
  for (const input of [{ rateDecimal: 1.234567 }, { rateExact: "1.234567000" }, { rateDecimal: 1.234567, rateExact: "1.234567" }]) {
    assert.deepEqual(mcpWireRateSchema.parse(input), expected);
  }
  assert.equal(mcpWireRateSchema.parse({ rateDecimal: 1 }).rate, 1000000);
  assert.equal(coexistRateSchema.parse({ rate: 1 }).rateExact, "0.000001");
});

test("valid exact FX outside coexistence fails with classified 422 rather than rounding", () => {
  for (const schema of [coexistRateSchema, mcpWireRateSchema]) {
    for (const rateExact of ["1500000", "2147.483648", "0.000000000000000001", "1.0000001"]) {
      assert.throws(() => schema.parse({ rateExact }), WireCompatibilityError);
    }
    assert.equal(schema.parse({ rateExact: "2147.483647" }).rate, 2147483647);
    assert.equal(schema.parse({ rateExact: "0.000001" }).rate, 1);
  }
});

test("conflicting, missing, malformed and inverted FX aliases are validation errors", () => {
  for (const input of [{}, { rate: 1.5 }, { rate: 2147483648 }, { rate: 0 },
    { rate: 1000000, rateExact: "2" }, { rate: 0, rateExact: "1" },
    { rateExact: "1e0" }, { rateExact: "1", rateDirection: "base_per_quote" }]) {
    assert.throws(() => coexistRateSchema.parse(input), z.ZodError);
  }
  for (const input of [{}, { rateDecimal: Infinity }, { rateDecimal: 0 },
    { rateDecimal: 1, rateExact: "2" }, { rateDecimal: 1, rateExact: "bad" },
    { rateDecimal: 0.0000001 }, { rateDecimal: 1, rateExact: "1", rateDirection: "base_per_quote" }]) {
    assert.throws(() => mcpWireRateSchema.parse(input), z.ZodError);
  }
});

test("manual aliases validate canonical dates/currencies and prohibit non-1 same-currency rates", () => {
  const input = { baseCurrency: " usd ", targetCurrency: "eur", date: "2026-10-02", rateExact: "0.9000" };
  const parsed = manualWireRateSchema.parse(input);
  assert.equal(parsed.baseCurrency, "USD"); assert.equal(parsed.targetCurrency, "EUR");
  assert.equal(parsed.rate, 900000); assert.equal(parsed.rateExact, "0.9");
  for (const invalid of [ { ...input, date: "2026-02-29" }, { ...input, targetCurrency: "USD" },
    { ...input, baseCurrency: "XXX" }, { ...input, rate: 800000 },
    { ...input, source: "api" }, { ...input, rateExact: undefined }]) {
    assert.throws(() => manualWireRateSchema.parse(invalid), z.ZodError);
  }
  assert.equal(manualWireRateSchema.parse({ ...input, targetCurrency: "USD", rateExact: "1" }).rate, 1000000);
});

test("stored DTOs retain quarantine/null and reject inconsistent authoritative aliases", () => {
  const row = { rate: 900000, rateExact: "0.900000000", rateMigrationStatus: "exact",
    rateFormatVersion: 1, rateDirection: "quote_per_base" } as typeof exchangeRate.$inferSelect;
  assert.equal(storedRateDto(row).rateExact, "0.9");
  for (const changed of [{ rate: 800000 }, { rateExact: null }, { rateFormatVersion: 2 }, { rateDirection: "base_per_quote" }]) {
    assert.throws(() => storedRateDto({ ...row, ...changed }), WireCompatibilityError);
  }
  assert.equal(storedRateDto({ ...row, rateMigrationStatus: "pending" }).rateExact, null);
  assert.equal(storedRateDto({ ...row, rate: 0, rateMigrationStatus: "invalid_legacy" }).rateExact, null);
});
