import { test } from "node:test";
import assert from "node:assert/strict";
import { bankAccountCreateSchema, bankAccountUpdateSchema, bankBalanceAlertSchema, bankMinor, bankAccountDto } from "../lib/api/bank-account-wire";

test("bank money aliases preserve signed safe limits and reject conflicting, malformed and unsupported values", () => {
  for (const value of [-Number.MAX_SAFE_INTEGER, -1250, 0, 1250, Number.MAX_SAFE_INTEGER]) {
    const parsed = bankAccountCreateSchema.parse({ accountName: "Bank", balance: value, balanceMinor: String(value) });
    assert.equal(bankMinor(parsed.balance, parsed.balanceMinor), value);
    assert.equal(bankMinor(undefined, String(value)), value);
    const dto = bankAccountDto({ balance: value, lowBalanceThreshold: value, currencyCode: "USD" });
    assert.equal(dto.balanceMinor, String(value)); assert.equal(dto.lowBalanceThresholdMinor, String(value));
  }
  assert.throws(() => bankMinor(1, "2")); assert.throws(() => bankMinor(null, "0"));
  assert.throws(() => bankMinor(0, null)); assert.throws(() => bankMinor(undefined, undefined, true));
  assert.equal(bankMinor(undefined, null, true), null);
  for (const exact of ["9007199254740992", "-9007199254740992"]) assert.throws(() => bankMinor(undefined, exact));
  for (const exact of ["01", "-0", "1.5", "1e3", " 1", "۱", "9223372036854775808"]) {
    assert.equal(bankAccountCreateSchema.safeParse({ accountName: "Bank", balanceMinor: exact }).success, false);
    assert.equal(bankBalanceAlertSchema.safeParse({ thresholdMinor: exact }).success, false);
  }
  for (const balance of [-0, 1.5, Number.MAX_SAFE_INTEGER + 1, Infinity, NaN])
    assert.equal(bankAccountCreateSchema.safeParse({ accountName: "Bank", balance }).success, false);
  assert.deepEqual(bankAccountUpdateSchema.parse({ accountName: "Rename" }), { accountName: "Rename" });
  assert.equal(bankAccountUpdateSchema.safeParse({ lowBalanceThreshold: 100 }).success, false);
  assert.equal(bankAccountCreateSchema.safeParse({ accountName: "Bank", chartAccountId: "bad" }).success, false);
  assert.throws(() => bankAccountDto({ balance: Number.MAX_SAFE_INTEGER + 1, lowBalanceThreshold: null, currencyCode: "USD" }));
});
