import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MIN_MINOR, MAX_MINOR, money, parseMajor, toMajorDecimal, currencyMetadata,
  roundRatio, addMoney, subtractMoney, negateMoney, sumMoney, multiplyRatio,
  taxMoney, allocateMoney, fromLegacyNumber, toLegacyNumber, type RoundingMode,
} from "../lib/money/exact";

test("canonical money preserves USD, IRR and 0/2/3 decimal scales", () => {
  for (const [currency, decimal] of [["USD", "12.50"], ["IRR", "1250"], ["JPY", "1250"], ["KWD", "1.250"]]) {
    assert.equal(toMajorDecimal(money(1250n, currency)), decimal);
    assert.deepEqual(parseMajor(decimal, currency, "reject"), money(1250n, currency));
    assert.equal(toMajorDecimal(money(-1250n, currency)), "-" + decimal);
  }
  assert.equal(toMajorDecimal(money(-1n, "USD")), "-0.01");
  assert.equal(toMajorDecimal(parseMajor("-0.00", "usd", "reject")), "0.00");
  assert.equal(currencyMetadata("irr").minorUnits, 0);
  assert.ok(Object.isFrozen(money(1n, "USD")));
  for (const currency of ["", "ZZZ", "XXX", "XAU", " USD"])
    assert.throws(() => money(1n, currency), /Unsupported currency/);
});

test("strict parsing rejects malformed input instead of silently changing it", () => {
  for (const input of ["", " ", " 1", "1 ", "1e2", "NaN", "Infinity", "12oops", "$12", "1,000", ".1", "1.", "--1", "1.2.3", "۱۲", "1\n", "1".repeat(257)])
    assert.throws(() => parseMajor(input, "USD", "reject"), TypeError, input);
  assert.throws(() => parseMajor(1 as unknown as string, "USD", "reject"), TypeError);
  assert.throws(() => parseMajor("1.001", "USD", "reject"), /Fractional/);
  assert.equal(parseMajor("+0001.2300", "USD", "reject").amountMinor, 123n);
  assert.equal(parseMajor("1.005", "USD", "half-away-from-zero").amountMinor, 101n);
  assert.equal(parseMajor("-1.005", "USD", "half-even").amountMinor, -100n);
});

test("rounding modes have explicit signed tie behavior and denominator direction", () => {
  const cases: [RoundingMode, bigint, bigint, bigint, bigint][] = [
    ["toward-zero", 2n, -2n, 3n, -3n],
    ["floor", 2n, -3n, 3n, -4n],
    ["ceiling", 3n, -2n, 4n, -3n],
    ["half-away-from-zero", 3n, -3n, 4n, -4n],
    ["half-even", 2n, -2n, 4n, -4n],
  ];
  for (const [mode, a, b, c, d] of cases) {
    assert.equal(roundRatio(5n, 2n, mode), a);
    assert.equal(roundRatio(-5n, 2n, mode), b);
    assert.equal(roundRatio(7n, 2n, mode), c);
    assert.equal(roundRatio(-7n, 2n, mode), d);
    assert.equal(roundRatio(5n, -2n, mode), b);
    assert.equal(roundRatio(-5n, -2n, mode), a);
    assert.equal(roundRatio(4n, 2n, mode), 2n);
    assert.equal(roundRatio(0n, 2n, mode), 0n);
  }
  assert.equal(roundRatio(24n, 10n, "half-even"), 2n);
  assert.equal(roundRatio(26n, 10n, "half-even"), 3n);
  assert.throws(() => roundRatio(1n, 2n, "reject"), /Fractional/);
  assert.throws(() => roundRatio(1n, 0n, "half-even"), /zero/);
  assert.throws(() => roundRatio(1 as unknown as bigint, 2 as unknown as bigint, "half-even"), TypeError);
  assert.throws(() => roundRatio(2n, 1n, undefined as unknown as RoundingMode), /explicit/);
});

test("signed int64 bounds remain exact through parse, math and formatting", () => {
  for (const amount of [MIN_MINOR, MAX_MINOR, 9007199254740993n, -9007199254740993n]) {
    for (const code of ["IRR", "USD", "KWD"]) {
      const value = money(amount, code);
      assert.deepEqual(parseMajor(toMajorDecimal(value), code, "reject"), value);
    }
  }
  assert.throws(() => money(MAX_MINOR + 1n, "USD"), /overflow/);
  assert.throws(() => money(MIN_MINOR - 1n, "USD"), /overflow/);
  assert.throws(() => money(1 as unknown as bigint, "USD"), TypeError);
  assert.throws(() => parseMajor("9223372036854775808", "IRR", "reject"), /overflow/);
  assert.throws(() => addMoney(money(MAX_MINOR, "USD"), money(1n, "USD")), /overflow/);
  assert.throws(() => subtractMoney(money(MIN_MINOR, "USD"), money(1n, "USD")), /overflow/);
  assert.throws(() => negateMoney(money(MIN_MINOR, "USD")), /overflow/);
  assert.throws(() => multiplyRatio(money(MAX_MINOR, "USD"), 2n, 1n, "reject"), /overflow/);
  assert.equal(multiplyRatio(money(MAX_MINOR, "USD"), MAX_MINOR, MAX_MINOR, "reject").amountMinor, MAX_MINOR);
  assert.equal(sumMoney([money(MAX_MINOR, "USD"), money(1n, "USD"), money(-1n, "USD")], "USD").amountMinor, MAX_MINOR);
  assert.equal(sumMoney([], "IRR").amountMinor, 0n);
  assert.throws(() => addMoney(money(1n, "USD"), money(1n, "IRR")), /mismatch/);
  assert.throws(() => sumMoney([money(1n, "IRR")], "USD"), /mismatch/);
  assert.equal(subtractMoney(money(2n, "USD"), money(3n, "USD")).amountMinor, -1n);
});

test("decimal tax and fractional quantities use exact ratios and caller rounding", () => {
  assert.equal(taxMoney(money(1250n, "USD"), "12.5", "half-even").amountMinor, 156n);
  assert.equal(taxMoney(money(-1250n, "USD"), "12.5", "half-even").amountMinor, -156n);
  assert.equal(taxMoney(money(100n, "USD"), "0.000000000000000001", "ceiling").amountMinor, 1n);
  assert.throws(() => taxMoney(money(1n, "USD"), "-1", "reject"), /nonnegative/);
  assert.throws(() => taxMoney(money(1n, "USD"), "12%", "reject"), TypeError);
  assert.equal(multiplyRatio(money(3n, "KWD"), 3n, 2n, "half-even").amountMinor, 4n);
});

test("allocation conserves totals, handles weighted ties and mirrors refunds", () => {
  assert.deepEqual(allocateMoney(money(5n, "USD"), [1n, 1n, 1n]).map(x => x.amountMinor), [2n, 2n, 1n]);
  assert.deepEqual(allocateMoney(money(11n, "IRR"), [0n, 2n, 3n]).map(x => x.amountMinor), [0n, 4n, 7n]);
  for (const amount of [0n, 1n, 7n, MAX_MINOR, MIN_MINOR]) {
    const parts = allocateMoney(money(amount, "USD"), [0n, 7n, 2n, 7n]);
    assert.equal(sumMoney(parts, "USD").amountMinor, amount);
    assert.equal(parts[0].amountMinor, 0n);
  }
  for (let total = 0n; total < 100n; total++) {
    const weights = [1n, 3n, 7n];
    const positive = allocateMoney(money(total, "USD"), weights);
    const negative = allocateMoney(money(-total, "USD"), weights);
    assert.equal(sumMoney(positive, "USD").amountMinor, total);
    assert.deepEqual(negative.map(x => x.amountMinor), positive.map(x => -x.amountMinor));
  }
  for (const weights of [[], [0n, 0n], [-1n, 2n]])
    assert.throws(() => allocateMoney(money(1n, "USD"), weights), RangeError);
});

test("legacy number bridges require safe minor-unit integers and never rescale", () => {
  for (const amount of [0, 1250, -1250, Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER]) {
    assert.equal(toLegacyNumber(fromLegacyNumber(amount, "USD")), amount);
  }
  assert.equal(fromLegacyNumber(1250, "IRR").amountMinor, 1250n);
  for (const amount of [NaN, Infinity, 1.2, Number.MAX_SAFE_INTEGER + 1])
    assert.throws(() => fromLegacyNumber(amount, "USD"), /safe integer/);
  for (const amount of [9007199254740992n, -9007199254740992n, MAX_MINOR, MIN_MINOR])
    assert.throws(() => toLegacyNumber(money(amount, "USD")), /Unsafe/);
});
