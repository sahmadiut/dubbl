import assert from "node:assert/strict";
import { test } from "node:test";
import { budgetAlertAmounts, budgetAlertBody, budgetAlertSchema } from "../lib/api/budget-alert-wire";
import { budgetCreateSchema, budgetUpdateSchema } from "../lib/api/budget-wire";

test("budget thresholds round exact products, including safe-max half ties", () => {
  const value = budgetAlertAmounts(Number.MAX_SAFE_INTEGER, 4503599627370496n, 50, "USD");
  assert.equal(value.thresholdMinor, "4503599627370496");
  assert.equal(value.exceedsThreshold, true);
  assert.equal(budgetAlertAmounts(1, 0n, 50, "USD").exceedsThreshold, false);
  assert.equal(budgetAlertAmounts(3, -2n, 50, "USD").actualMinor, "2");
  assert.equal(budgetAlertAmounts(3, -2n, 50, "USD").exceedsThreshold, true);
  assert.equal(budgetAlertAmounts(1, 0n, 0, "USD").exceedsThreshold, true);
  for (const amount of [0, -1]) assert.equal(budgetAlertAmounts(amount, 100n, 100, "USD").exceedsThreshold, false);
});

test("budget alert body uses exact organization currency scales without rescaling data", () => {
  for (const [currency, major] of [["USD", "12.50"], ["IRR", "1250"], ["JPY", "1250"], ["KWD", "1.250"]]) {
    const value = budgetAlertAmounts(1250, 1250n, 100, currency);
    assert.equal(value.budgetedMinor, "1250");
    assert.equal(budgetAlertBody("Now", value), `Period Now: actual ${currency} ${major} vs budget ${currency} ${major} (100% threshold)`);
  }
  assert.match(budgetAlertBody("Large", budgetAlertAmounts(Number.MAX_SAFE_INTEGER, 9007199254740991n, 100, "USD")), /90071992547409\.91/);
});

test("alert payload preflight rejects unsafe results and unsupported configuration", () => {
  for (const amount of [9007199254740992, NaN, 1.5]) assert.throws(() => budgetAlertAmounts(amount, 0n, 100, "USD"));
  for (const actual of [9007199254740992n, -9007199254740992n]) assert.throws(() => budgetAlertAmounts(1, actual, 100, "USD"));
  assert.throws(() => budgetAlertAmounts(Number.MAX_SAFE_INTEGER, 0n, 101, "USD"));
  for (const pct of [-1, 1.5, NaN, 2147483648]) assert.throws(() => budgetAlertAmounts(1, 0n, pct, "USD"));
  for (const currency of ["usd", "BAD"]) assert.throws(() => budgetAlertAmounts(1, 0n, 100, currency));
});

test("threshold controls preserve defaults, allow disable and reject malformed aliases", () => {
  const input = { name: "Alert", startDate: "2026-01-01", endDate: "2026-12-31",
    lines: [{ accountId: "00000000-0000-4000-8000-000000000001", totalMinor: "1250" }] };
  assert.equal(budgetCreateSchema.parse(input).varianceThresholdPct, undefined);
  for (const pct of [null, 0, 50, 100, 2147483647]) {
    assert.equal(budgetCreateSchema.parse({ ...input, varianceThresholdPct: pct }).varianceThresholdPct, pct);
    assert.equal(budgetUpdateSchema.parse({ varianceThresholdPct: pct }).varianceThresholdPct, pct);
  }
  for (const pct of [-1, 0.5, "50", 2147483648]) assert.equal(budgetUpdateSchema.safeParse({ varianceThresholdPct: pct }).success, false);
  assert.deepEqual(budgetAlertSchema.parse({}), {});
  for (const value of [{ organizationId: "spoof" }, { today: "2026-01-01" }, { amountMinor: "1" }, null])
    assert.equal(budgetAlertSchema.safeParse(value).success, false);
});
