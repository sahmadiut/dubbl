import assert from "node:assert/strict";
import { test } from "node:test";
import { getTableConfig } from "drizzle-orm/pg-core";
import { exactRate, fromLegacyRate, toLegacyRate } from "../lib/currency/exact-rate";
import { exchangeRate, journalLine } from "../lib/db/schema/bookkeeping";
import { consolidationRate } from "../lib/db/schema/consolidation";
import { payrollItem } from "../lib/db/schema/payroll";
import { legacyDecimalRateSchema, legacyScaledRateSchema } from "../lib/currency/rate-input";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

test("FX v1 decimal policy preserves extremes without float coercion or implicit rounding", () => {
  for (const value of ["1500000", "0.000000666666666667", "0.000000000000000001", "99999999999999999999.999999999999999999"]) {
    assert.equal(exactRate(value), value);
  }
  assert.equal(exactRate("0001.250000000000000000000"), "1.25");
  for (const value of ["0", "0.0", "100000000000000000000", "0.0000000000000000001"]) {
    assert.throws(() => exactRate(value), RangeError);
  }
  for (const value of ["", " 1", "1 ", "1e6", "NaN", "Infinity", "-1", "+1", "1.", ".5", "۱.۲", "1,000", 1 as unknown as string]) {
    assert.throws(() => exactRate(value), TypeError);
  }
});

test("REST scaled and MCP decimal boundaries reject unsafe v1 rates before storage", async () => {
  for (const value of [1, 2147483647]) assert.equal(legacyScaledRateSchema.parse(value), value);
  for (const value of [0, -1, 1.5, 2147483648, NaN, Infinity]) assert.equal(legacyScaledRateSchema.safeParse(value).success, false);
  for (const value of [0.000001, 1.08, 2147.483647]) assert.equal(legacyDecimalRateSchema.parse(value), value);
  for (const value of [0, -1, 0.0000001, 1.0000001, 1500000, NaN, Infinity]) assert.equal(legacyDecimalRateSchema.safeParse(value).success, false);
  const { registerCurrencyTools } = await import("../lib/mcp/tools/currencies");
  let handler: ((params: { baseCurrency: string; targetCurrency: string; rateDecimal: number; date: string }) => Promise<{ isError?: boolean; content: { text: string }[] }>) | undefined;
  const server = { tool(name: string, _description: string, _schema: unknown, callback: typeof handler) {
    if (name === "set_exchange_rate") handler = callback;
  } } as unknown as McpServer;
  registerCurrencyTools(server, { userId: "fixture-user", organizationId: "fixture-org", role: "owner" });
  assert.ok(handler);
  for (const rateDecimal of [1500000, 0.000000666666666667, 1.0000001]) {
    const result = await handler({ baseCurrency: "USD", targetCurrency: "EUR", date: "2025-12-01", rateDecimal });
    assert.equal(result.isError, true);
    assert.equal(JSON.parse(result.content[0].text).error, "Validation error");
  }
  registerCurrencyTools(server, { userId: "fixture-user", organizationId: "fixture-org", role: "member" });
  const denied = await handler({ baseCurrency: "USD", targetCurrency: "EUR", date: "2025-12-01", rateDecimal: 1.08 });
  assert.equal(denied.isError, true);
  assert.deepEqual(JSON.parse(denied.content[0].text), { error: "Insufficient permissions", status: 403 });
});

test("legacy millionths bridge is exact and rejects lossy coexistence writes", () => {
  for (const value of [1, 1234567, 1000000, 2147483647]) {
    assert.equal(toLegacyRate(fromLegacyRate(value)), value);
  }
  assert.equal(fromLegacyRate(2147483647), "2147.483647");
  for (const value of [0, -1, 1.5, NaN, Infinity, 2147483648]) assert.throws(() => fromLegacyRate(value));
  for (const value of ["1500000", "0.000000666666666667", "2147.483648"]) assert.throws(() => toLegacyRate(value), RangeError);
});

test("all four FX fields use string-only numeric adapters and unrounded SQL checks", () => {
  for (const table of [exchangeRate, journalLine, consolidationRate, payrollItem]) {
    const config = getTableConfig(table);
    const column = table.rateExact;
    assert.equal(column.getSQLType(), "numeric");
    assert.equal(column.mapFromDriverValue("1500000.000000"), "1500000");
    assert.equal(column.mapToDriverValue("0.000000666666666667"), "0.000000666666666667");
    assert.throws(() => column.mapToDriverValue(1 as unknown as string), TypeError);
    assert.throws(() => column.mapToDriverValue("0.0000000000000000001"), RangeError);
    assert.equal(config.checks.length, 1);
    assert.equal(table.rateFormatVersion.default, 1);
    assert.equal(table.rateDirection.default, "quote_per_base");
  }
});
