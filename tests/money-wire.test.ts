import assert from "node:assert/strict";
import { test } from "node:test";
import { z } from "zod";
import { money, MIN_MINOR, MAX_MINOR } from "../lib/money/exact";
import {
  exactMinorSchema, legacyMinorSchema, exactRateSchema, moneyInputSchema,
  legacyMoneyInput, moneyDto, rateDto, rateInputSchema, stringifyWire,
  WireCompatibilityError,
} from "../lib/money/wire";
import { jsonResponse } from "../lib/api/json-response";
import { decodeMoneyInteger, encodeMoneyInteger } from "../lib/db/money-column";

test("minor-unit wire strings preserve signed int64 including both storage edges", () => {
  for (const value of ["0", "1250", "-1250", "9007199254740993", MAX_MINOR.toString(), MIN_MINOR.toString()]) {
    assert.equal(exactMinorSchema.parse(value), value);
    assert.equal(moneyInputSchema.parse({ amountMinor: value, currencyCode: "USD" }).amountMinor, BigInt(value));
  }
  for (const value of ["", "-0", "01", "-01", "+1", " 1", "1 ", "1.0", "1e3", "1,000", "۱۲۵۰", (MAX_MINOR + 1n).toString(), (MIN_MINOR - 1n).toString(), "1".repeat(200)]) {
    assert.equal(exactMinorSchema.safeParse(value).success, false, value);
  }
  assert.equal(exactMinorSchema.safeParse(1250).success, false);
});

test("legacy numeric inputs reject unsafe, fractional and nonfinite values", () => {
  for (const value of [0, -1250, 1250, Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER]) {
    assert.equal(legacyMinorSchema.parse(value), value);
  }
  for (const value of [1.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1, Number.MIN_SAFE_INTEGER - 1, "1250", null]) {
    assert.equal(legacyMinorSchema.safeParse(value).success, false);
  }
});

test("additive aliases retain USD/IRR units and require agreement without coercion", () => {
  for (const currencyCode of ["USD", "IRR", "JPY", "KWD"]) {
    const legacy = moneyInputSchema.parse({ amount: 1250, currencyCode });
    const exact = moneyInputSchema.parse({ amountMinor: "1250", currencyCode });
    assert.deepEqual(exact, legacy);
    assert.deepEqual(legacyMoneyInput({ amountMinor: "1250", currencyCode }), { amount: 1250, currencyCode });
    assert.deepEqual(moneyDto(exact), { amount: 1250, amountMinor: "1250", currencyCode });
  }
  assert.deepEqual(moneyInputSchema.parse({ amount: 0, amountMinor: "0", currencyCode: "usd" }), money(0n, "USD"));
  for (const input of [
    { currencyCode: "USD" }, { amount: 1, amountMinor: "2", currencyCode: "USD" },
    { amount: 1, amountMinor: "invalid", currencyCode: "USD" },
    { amount: 1.5, amountMinor: "1", currencyCode: "USD" },
    { amount: 1250, currencyCode: "XXX" }, { amount: 1250, currencyCode: " USD" },
    { amount: 1250, currencyCode: "USD", surprise: true },
  ]) assert.throws(() => moneyInputSchema.parse(input), z.ZodError);
});

test("full-range exact inputs cannot leak into legacy number consumers", () => {
  for (const value of [9007199254740993n, -9007199254740993n, MAX_MINOR, MIN_MINOR]) {
    assert.deepEqual(moneyDto(money(value, "USD"), "exact"), { amountMinor: value.toString(), currencyCode: "USD" });
    assert.throws(() => moneyDto(money(value, "USD")), WireCompatibilityError);
    assert.throws(() => legacyMoneyInput({ amountMinor: value.toString(), currencyCode: "USD" }), WireCompatibilityError);
  }
});

test("rate DTOs preserve int32 millionths direction and exact decimal extremes", () => {
  for (const [rate, rateExact] of [[1, "0.000001"], [1000000, "1"], [1234567, "1.234567"], [2147483647, "2147.483647"]] as const) {
    const parsed = rateInputSchema.parse({ rate });
    assert.equal(parsed.rateExact, rateExact);
    assert.equal(parsed.rateDirection, "quote_per_base");
    assert.deepEqual(rateDto(rateExact), { rate, rateExact, rateDirection: "quote_per_base" });
    assert.deepEqual(rateInputSchema.parse({ rate, rateExact: rateExact + "0".repeat(rateExact.includes(".") ? 3 : 0) }), parsed);
  }
  for (const rateExact of ["1500000", "0.000000666666666667", "0.000000000000000001", "99999999999999999999.999999999999999999"]) {
    assert.equal(exactRateSchema.parse(rateExact), rateExact);
    assert.deepEqual(rateInputSchema.parse({ rateExact }), { rateExact, rateDirection: "quote_per_base" });
    assert.deepEqual(rateDto(rateExact, "exact"), { rateExact, rateDirection: "quote_per_base" });
    assert.throws(() => rateDto(rateExact), WireCompatibilityError);
  }
});

test("rate input rejects invalid direction, conflicts, malformed values and silent rounding", () => {
  for (const value of ["0", "-1", "1e6", "+1", " 1", "1,000", "NaN", "۱", "1.0000000000000000001", "100000000000000000000", 1]) {
    assert.equal(exactRateSchema.safeParse(value).success, false);
  }
  for (const input of [{}, { rate: 0 }, { rate: 2147483648 }, { rate: 1.5 },
    { rate: 1000000, rateExact: "1.1" }, { rate: 0, rateExact: "1" },
    { rate: 1000000, rateExact: "bad" }, { rateExact: "1", rateDirection: "base_per_quote" }]) {
    assert.throws(() => rateInputSchema.parse(input), z.ZodError);
  }
  assert.throws(() => rateDto("bad"), TypeError);
});

test("legacy JSON preserves numeric types, nesting, nulls, dates and standard JSON omission", () => {
  const value = { amount: 1250n, refund: -1250n, nil: null, missing: undefined,
    counts: [0, 2, 3n, null], ratio: 0.125, date: new Date("2026-10-02T00:00:00Z") };
  assert.deepEqual(JSON.parse(stringifyWire(value)), {
    amount: 1250, refund: -1250, nil: null, counts: [0, 2, 3, null], ratio: 0.125, date: "2026-10-02T00:00:00.000Z",
  });
  assert.equal(JSON.parse(stringifyWire(Number.MAX_SAFE_INTEGER)), Number.MAX_SAFE_INTEGER);
  assert.equal(JSON.parse(stringifyWire(BigInt(Number.MIN_SAFE_INTEGER))), Number.MIN_SAFE_INTEGER);
});

test("exact JSON strings round-trip signed amounts beyond JS precision without changing non-money values", () => {
  const payload = { money: [moneyDto(money(MAX_MINOR, "USD"), "exact"), moneyDto(money(MIN_MINOR, "IRR"), "exact")],
    nested: { amount: 9007199254740993n }, count: 2, quantity: 1.25, rate: "0.000000000000000001" };
  const parsed = JSON.parse(stringifyWire(payload, "exact"));
  assert.equal(BigInt(parsed.money[0].amountMinor), MAX_MINOR);
  assert.equal(BigInt(parsed.money[1].amountMinor), MIN_MINOR);
  assert.equal(parsed.nested.amount, "9007199254740993");
  assert.equal(parsed.count, 2);
  assert.equal(parsed.quantity, 1.25);
  assert.equal(parsed.rate, payload.rate);
});

test("JSON never silently emits rounded large Numbers, null nonfinite values or magnitude-based strings", () => {
  for (const representation of ["legacy", "exact"] as const) {
    for (const value of [NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1, Number.MIN_SAFE_INTEGER - 1]) {
      assert.throws(() => stringifyWire({ rows: [{ value }] }, representation), WireCompatibilityError);
    }
  }
  assert.throws(() => stringifyWire({ amount: MAX_MINOR }), WireCompatibilityError);
  assert.throws(() => stringifyWire(undefined), TypeError);
  const cyclic: { self?: unknown } = {}; cyclic.self = cyclic;
  assert.throws(() => stringifyWire(cyclic), TypeError);
  assert.throws(() => stringifyWire({}, "unknown" as "legacy"), TypeError);
  assert.equal(Object.hasOwn(BigInt.prototype, "toJSON"), false);
});

test("real REST adapter preserves status/headers and explicitly emits exact JSON", async () => {
  const legacy = jsonResponse({ amount: 1250n }, { status: 201, headers: { "x-fixture": "legacy" } });
  assert.equal(legacy.status, 201);
  assert.equal(legacy.headers.get("content-type"), "application/json");
  assert.equal(legacy.headers.get("x-fixture"), "legacy");
  assert.deepEqual(await legacy.json(), { amount: 1250 });
  const exact = jsonResponse({ amountMinor: MAX_MINOR }, undefined, "exact");
  assert.deepEqual(await exact.json(), { amountMinor: MAX_MINOR.toString() });
  assert.throws(() => jsonResponse({ amount: MAX_MINOR }), WireCompatibilityError);
});

test("shared REST helpers classify storage/serialization compatibility errors without leaking values", async () => {
  const { ok, created, handleError } = await import("../lib/api/response");
  assert.deepEqual(await ok({ amount: 1250n }).json(), { amount: 1250 });
  assert.equal(created({ amount: 1250n }).status, 201);
  for (const invoke of [() => ok({ amount: MAX_MINOR }), () => decodeMoneyInteger(MAX_MINOR.toString()), () => encodeMoneyInteger(Number.MAX_SAFE_INTEGER + 1)]) {
    let captured: unknown;
    try { invoke(); } catch (err) { captured = err; }
    assert.ok(captured instanceof WireCompatibilityError);
    const response = handleError(captured);
    assert.equal(response.status, 422);
    const body = await response.json();
    assert.equal(body.code, "LEGACY_NUMERIC_RANGE");
    assert.equal(body.error, captured.message);
    assert.equal(JSON.stringify(body).includes(MAX_MINOR.toString()), false);
  }
  assert.equal(handleError(new z.ZodError([{ code: "custom", message: "Bad input", path: [] }])).status, 400);
});

test("real MCP wrapper uses the supplied org context, safe numeric default and explicit exact output", async () => {
  const { wrapTool } = await import("../lib/mcp/errors");
  const ctx = { userId: "wire-fixture", organizationId: "wire-org", role: "owner" as const };
  const legacy = await wrapTool(ctx, async supplied => {
    assert.equal(supplied, ctx);
    return { organizationId: supplied.organizationId, amount: 1250n };
  });
  assert.equal(legacy.isError, undefined);
  assert.deepEqual(JSON.parse(legacy.content[0].text), { organizationId: "wire-org", amount: 1250 });
  const exact = await wrapTool(ctx, async () => ({ amountMinor: MAX_MINOR, rateExact: "0.000000000000000001" }), "exact");
  assert.equal(exact.isError, undefined);
  assert.deepEqual(JSON.parse(exact.content[0].text), { amountMinor: MAX_MINOR.toString(), rateExact: "0.000000000000000001" });
});

test("MCP rejects unsafe serialization and synchronous compatibility/auth errors consistently", async () => {
  const { wrapTool } = await import("../lib/mcp/errors");
  const { AuthError } = await import("../lib/api/auth-context");
  const ctx = { userId: "wire-fixture", organizationId: "wire-org", role: "member" as const };
  for (const handler of [async () => ({ amount: MAX_MINOR }), async () => ({ amount: Infinity }),
    () => { throw new WireCompatibilityError(); }]) {
    const result = await wrapTool<unknown>(ctx, handler);
    assert.equal(result.isError, true);
    assert.deepEqual(JSON.parse(result.content[0].text), {
      error: new WireCompatibilityError().message, code: "LEGACY_NUMERIC_RANGE", status: 422,
    });
  }
  const denied = await wrapTool(ctx, () => { throw new AuthError("Denied", 403); });
  assert.equal(denied.isError, true);
  assert.deepEqual(JSON.parse(denied.content[0].text), { error: "Denied", status: 403 });
});
