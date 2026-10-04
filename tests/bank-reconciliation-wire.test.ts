import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { reconciliationCreateSchema, reconciliationMarkSchema, reconciliationPostSchema, reconciliationAmount } from "../lib/api/bank-reconciliation-wire";
import { bankMoneyDisplay } from "../lib/money/bank-display";

test("statement minor aliases preserve signed values and reject unsafe or conflicting money", () => {
  for (const value of [0, 1250, -1250, Number.MAX_SAFE_INTEGER, -Number.MAX_SAFE_INTEGER]) {
    assert.equal(reconciliationAmount({ amount: value }, "amount"), value);
    assert.equal(reconciliationAmount({ amountMinor: String(value) }, "amount"), value);
    assert.equal(reconciliationAmount({ amount: value, amountMinor: String(value) }, "amount"), value);
  }
  for (const value of ["01", "+1", "-0", "1.0", "1e3", " 1", "۱۲۵۰", "9223372036854775808", "9007199254740992"]) {
    assert.throws(() => reconciliationAmount({ amountMinor: value }, "amount"));
  }
  for (const amount of [-0, 1.5, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => reconciliationAmount({ amount }, "amount"));
  assert.throws(() => reconciliationAmount({}, "amount"));
  assert.throws(() => reconciliationAmount({ amount: 1250, amountMinor: "1251" }, "amount"));
});
test("bank presentation keeps signed fractional units and large integer precision", () => {
  assert.equal(bankMoneyDisplay(-1, "USD"), "-$0.01");
  assert.equal(bankMoneyDisplay(-1250, "USD"), "-$12.50");
  assert.equal(bankMoneyDisplay(Number.MAX_SAFE_INTEGER, "USD"), "$90,071,992,547,409.91");
  assert.match(bankMoneyDisplay(1250, "JPY"), /1,250$/);
  assert.match(bankMoneyDisplay(1250, "KWD"), /1.250$/);
  assert.match(bankMoneyDisplay(1250, "IRR"), /1,250$/);
  assert.throws(() => bankMoneyDisplay(Number.MAX_SAFE_INTEGER + 1, "USD"));
});
test("statement contracts reject malformed dates, IDs, unknown fields and missing balance aliases", () => {
  const input = { startDate: "2026-10-01", endDate: "2026-10-31", startBalanceMinor: "-1250", endBalance: 1250 };
  assert.deepEqual(reconciliationCreateSchema.parse(input), input);
  for (const extra of [{ startDate: "2026-02-30" }, { endDate: "2026-09-01" }, { endDate: "2026-10-31T00:00:00Z" }, { startBalanceMinor: undefined }, { unknown: 1 }])
    assert.throws(() => reconciliationCreateSchema.parse({ ...input, ...extra }));
  assert.deepEqual(reconciliationMarkSchema.parse({ reconciliationId: null, journalEntryId: null }), { reconciliationId: null, journalEntryId: null });
  assert.throws(() => reconciliationMarkSchema.parse({ journalEntryId: "bad" }));
  const complete = { action: "complete", reconciliationId: randomUUID(), transactionIds: [] };
  assert.deepEqual(reconciliationPostSchema.parse(complete), complete);
  assert.throws(() => reconciliationPostSchema.parse({ ...complete, amount: 1 }));
  assert.throws(() => reconciliationPostSchema.parse({ action: "adjustment", amount: 0.1, date: "2026-10-04" }));
});
