import assert from "node:assert/strict";
import { test } from "node:test";
import { bankReadQuery, bankReadPagination, bankReadAudit, bankReadNullableMoney, bankAmountProximity, sameBankReadCurrency } from "../lib/api/bank-transaction-read-wire";
import { stringifyWire } from "../lib/money/wire";
import { findMatches } from "../lib/banking/reconciliation-matcher";

const id = "b7a313ab-a0c5-4000-8000-91d2cfcce092";
test("bank read pagination rejects malformed and oversized offsets", () => {
  assert.equal(bankReadQuery(new URL("https://fixture.test"), id).page, 1);
  for (const query of ["page=0", "page=1.1", "page=1e2", "page=01", "page=NaN", "page=2147483647", "limit=101", "limit=-1", "status=bad"])
    assert.throws(() => bankReadQuery(new URL(`https://fixture.test?${query}`), id));
  assert.equal(bankReadPagination({ bankAccountId: id, limit: 200 }).limit, 200);
  assert.throws(() => bankReadPagination({ bankAccountId: id, limit: 201 }));
});
test("bank read aliases retain sign, null and opaque non-money units", () => {
  assert.deepEqual(bankReadNullableMoney({ amount: -1250, balance: null }, ["amount", "balance"]), { amount: -1250, amountMinor: "-1250", balance: null, balanceMinor: null });
  const audit = { amount: -1250, allocations: [{ amount: 1250, percent: 12.5 }], reversedAllocations: 3, totalAmount: null, metadata: { amount: "12.50" } };
  const result = bankReadAudit(audit) as typeof audit & { amountMinor: string };
  assert.equal(result.amountMinor, "-1250"); assert.equal(result.allocations[0].percent, 12.5);
  assert.equal(JSON.parse(stringifyWire(result)).reversedAllocations, 3);
  assert.deepEqual(result.metadata, { amount: "12.50" });
  assert.equal("amountMinor" in audit, false);
  for (const value of [1.5, Number.MAX_SAFE_INTEGER + 1, "1250"])
    assert.throws(() => bankReadAudit({ amount: value }));
  assert.throws(() => bankReadAudit({ amount: 1, amountMinor: "2" }));
  assert.throws(() => bankReadNullableMoney({ balance: Number.MAX_SAFE_INTEGER + 1 }, ["balance"]));
  for (const currency of ["USD", "JPY", "KWD", "IRR"]) assert.equal(sameBankReadCurrency(null, currency), currency);
  assert.throws(() => sameBankReadCurrency("EUR", "USD"));
});
test("bank match thresholds use exact integer ratios and reject unsafe operands", () => {
  assert.equal(bankAmountProximity(-1250, 1250), "exact");
  assert.equal(bankAmountProximity(10000, 9900), "five");
  assert.equal(bankAmountProximity(10000, 9901), "one");
  assert.equal(bankAmountProximity(10000, 9500), "none");
  assert.equal(bankAmountProximity(10000, 9501), "five");
  assert.equal(bankAmountProximity(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER - 1), "one");
  assert.throws(() => bankAmountProximity(Number.MAX_SAFE_INTEGER + 1, 1));
  assert.throws(() => findMatches({ id, date: "2026-10-04", description: "Fixture", amount: 1 }, [{ type: "invoice", id, date: "2026-10-04", description: "Fixture", amount: Number.MAX_SAFE_INTEGER + 1 }], [], []));
});
