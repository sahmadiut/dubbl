import assert from "node:assert/strict";
import { test } from "node:test";
import { reversalBalances } from "../lib/api/payment-reversal-wire";
import { WireCompatibilityError } from "../lib/money/wire";

test("reversal preserves safe minor units exactly without clamping", () => {
  assert.deepEqual(reversalBalances(1250, 0, 500), { amountPaid: 750, amountDue: 500 });
  assert.deepEqual(reversalBalances(Number.MAX_SAFE_INTEGER, 0, Number.MAX_SAFE_INTEGER),
    { amountPaid: 0, amountDue: Number.MAX_SAFE_INTEGER });
  for (const args of [[1, Number.MAX_SAFE_INTEGER, 1], [0, 10, 1], [10, 0, 0], [-1, 0, 1], [10.5, 0, 1], [1e16, 0, 1]])
    assert.throws(() => reversalBalances(...args as [number, number, number]), WireCompatibilityError);
});
