import assert from "node:assert/strict";
import { test } from "node:test";
import { parseDashboardLayoutInput, validateLayoutJson } from "../lib/api/dashboard-layout-wire";
import { WireCompatibilityError } from "../lib/money/wire";

const widget = (config: Record<string, unknown>) => ({ widgetType: "custom", x: 0.5, y: -1, w: 4, h: 2, config });
test("opaque layout JSON preserves existing numbers and exact strings without guessing units", () => {
  const config = { amount: 1250, amountMinor: "9223372036854775807", rateExact: "0.000000000000000001",
    nested: [null, true, { currencyCode: "IRR", text: "۱۲۵۰", count: Number.MAX_SAFE_INTEGER, decimal: 1.25 }] };
  const input = { name: "Original", layout: [widget(config)] };
  assert.deepEqual(parseDashboardLayoutInput(input), input);
  // This layer stores opaque strings, it does not validate domain-specific money/FX aliases.
  validateLayoutJson({ amountMinor: "custom-value", amount: "001.50" });
  const specialKeys = JSON.parse('{"__proto__":{"amountMinor":"1250"},"constructor":1,"prototype":2}');
  assert.deepEqual(parseDashboardLayoutInput({ name: "Keys", layout: [widget(specialKeys)] }), { name: "Keys", layout: [widget(specialKeys)] });
});
test("layout input rejects unsafe numbers, non-JSON types and malformed shapes before writes", () => {
  for (const value of [NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1, Number.MIN_SAFE_INTEGER - 1]) {
    assert.throws(() => parseDashboardLayoutInput({ name: "Bad", layout: [widget({ nested: [value] })] }), WireCompatibilityError);
  }
  const cycle: Record<string, unknown> = {}; cycle.self = cycle;
  const namedArray = [1]; Object.assign(namedArray, { extra: "hidden" });
  for (const value of [1n, undefined, () => 1, Symbol("bad"), new Date(), new Map(), cycle, namedArray, new Array(2)])
    assert.throws(() => parseDashboardLayoutInput({ name: "Bad", layout: [widget({ value })] }));
  let getterCalled = false;
  assert.throws(() => parseDashboardLayoutInput({ name: "Bad", layout: [widget({ get value() { getterCalled = true; return 1; } })] }));
  assert.equal(getterCalled, false);
  for (const input of [{}, { name: "", layout: [] }, { name: "Bad", layout: [{ ...widget({}), x: "1" }] },
    { name: "Bad", layout: [widget([] as unknown as Record<string, unknown>)] }, { name: "Bad", layout: [], organizationId: "spoof" }])
    assert.throws(() => parseDashboardLayoutInput(input));
  assert.throws(() => parseDashboardLayoutInput({}, true));
  assert.deepEqual(parseDashboardLayoutInput({ isDefault: false }, true), { isDefault: false });
});
test("layout JSON complexity and size are bounded across the complete payload", () => {
  let deep: unknown = null; for (let i = 0; i < 34; i++) deep = [deep];
  for (const value of [deep, Array.from({ length: 10000 }, () => null), "x".repeat(262144)])
    assert.throws(() => parseDashboardLayoutInput({ name: "Bad", layout: [widget({ value })] }));
});
