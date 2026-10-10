import assert from "node:assert/strict";
import { test } from "node:test";
import { postingRatio, postingSum, postingDifference, postingGrossTax } from "../lib/money/posting";
import { convertAmount, calculateFxGainLoss } from "../lib/currency/converter";
import { convertLinesToBase, realizedSettlementLegs } from "../lib/currency/convert-entry";
import { WireCompatibilityError } from "../lib/money/wire";

test("posting tax and FX ratios preserve low digits and historical signed ties", () => {
  // Binary multiplication formerly returned 1333200000000001, one unit too much.
  assert.equal(postingRatio(4000000000000001, 3333, 10000), 1333200000000000);
  assert.equal(convertAmount(4000000000000001, 333300), 1333200000000000);
  assert.equal(convertAmount(-4000000000000001, 333300), -1333200000000000);
  assert.equal(postingRatio(1, 5000, 10000), 1);
  assert.equal(postingRatio(-1, 5000, 10000), 0);
  assert.equal(postingRatio(-3, 5000, 10000), -1);
  assert.equal(convertAmount(Number.MAX_SAFE_INTEGER, 1000000), Number.MAX_SAFE_INTEGER);
  assert.equal(calculateFxGainLoss(4000000000000001, 333300, 1000000), 2666800000000001);
});

test("gross tax conserves every unit for signed amounts and partial recoverability", () => {
  for (const gross of [0, 1, -1, 1250, -1250, 3000000000, 4000000000000001, Number.MAX_SAFE_INTEGER]) {
    for (const rate of [0, 1, 1350, 3333, 10000, 2147483647]) {
      for (const recovery of [0, 3333, 5000, 10000]) {
        const value = postingGrossTax(gross, rate, recovery);
        assert.equal(BigInt(value.net) + BigInt(value.absorbedTax) + BigInt(value.recoverableTax), BigInt(gross));
        assert.equal(BigInt(value.absorbedTax) + BigInt(value.recoverableTax), BigInt(value.tax));
      }
    }
  }
  assert.deepEqual(postingGrossTax(1250, 2000, 5000), { net: 1042, tax: 208, recoverableTax: 104, absorbedTax: 104 });
});

test("posting sums permit exact cancellation but reject unsupported input and results", () => {
  const max = Number.MAX_SAFE_INTEGER;
  assert.equal(postingSum([max, 2, -max]), 2);
  assert.equal(postingDifference(max, max - 1), 1);
  for (const value of [NaN, Infinity, 0.5, max + 1]) {
    assert.throws(() => postingSum([value]), WireCompatibilityError);
    assert.throws(() => convertAmount(value, 1000000), WireCompatibilityError);
  }
  assert.throws(() => postingSum([max, 1]), WireCompatibilityError);
  assert.throws(() => postingDifference(max, -1), WireCompatibilityError);
  assert.throws(() => convertAmount(max, 1000001), WireCompatibilityError);
  for (const rate of [0, -1, 0.5, 2147483648, NaN]) assert.throws(() => convertAmount(1, rate), WireCompatibilityError);
  for (const denominator of [0, -1]) assert.throws(() => postingRatio(1, 1, denominator), WireCompatibilityError);
  assert.throws(() => postingGrossTax(1, -1, 10000), WireCompatibilityError);
  assert.throws(() => postingGrossTax(1, 2000, 10001), WireCompatibilityError);
  assert.throws(() => realizedSettlementLegs("invoice", max, -1), WireCompatibilityError);
});

test("FX residuals conserve exact totals across the safe edge without altering input legs", () => {
  const max = Number.MAX_SAFE_INTEGER;
  const lines = [{ debitAmount: max - 1, creditAmount: 0 }, { debitAmount: 0, creditAmount: max - 2 }, { debitAmount: 0, creditAmount: 1 }];
  const before = structuredClone(lines);
  const result = convertLinesToBase(lines, 500000);
  // Both credit lines round upward: their temporary sum exceeds the target by one.
  for (const side of ["debitAmount", "creditAmount"] as const)
    assert.equal(result.reduce((s, l) => s + BigInt(l[side]), 0n), 4503599627370495n);
  assert.deepEqual(lines, before);
  assert.throws(() => convertLinesToBase([{ debitAmount: max, creditAmount: 0 }, { debitAmount: 1, creditAmount: 0 }], 1000000), WireCompatibilityError);
});
