import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_MINOR, MIN_MINOR, parseMajor, toMajorDecimal } from "../lib/money/exact";
import { normalizeLocalizedDecimal, parseLocalizedMajor } from "../lib/money/localized";

const scripts = ["0123456789", "۰۱۲۳۴۵۶۷۸۹", "٠١٢٣٤٥٦٧٨٩"];
const translate = (input: string, digits: string) => input.replace(/[0-9]/g, value => digits[Number(value)]);

test("MONEY-IRR-01: Latin, Persian and Arabic-Indic input preserve identical raw IRR units", () => {
  for (const digits of scripts) {
    for (const separators of ["ascii", "arabic"] as const) {
      assert.deepEqual(parseLocalizedMajor(translate("123456789", digits), "IRR", "reject", separators),
        { currency: "IRR", amountMinor: 123456789n });
    }
  }
  // Machine-facing exact parsing remains canonical ASCII only.
  assert.throws(() => parseMajor("۱۲۳۴۵۶۷۸۹", "IRR", "reject"));
});

test("localized separators and signs have an explicit grammar independent of numeral script", () => {
  for (const digits of scripts) {
    assert.equal(normalizeLocalizedDecimal(translate("-1,234,567.890", digits), "ascii"), "-1234567.890");
    assert.equal(normalizeLocalizedDecimal(translate("+1٬234٬567٫890", digits), "arabic"), "+1234567.890");
    assert.equal(normalizeLocalizedDecimal(translate("00012.50", digits), "ascii"), "00012.50");
    assert.equal(parseLocalizedMajor(translate("-0.01", digits), "USD", "reject", "ascii").amountMinor, -1n);
    assert.equal(parseLocalizedMajor(translate("1٫250", digits), "KWD", "reject", "arabic").amountMinor, 1250n);
    assert.equal(parseLocalizedMajor(translate("1250", digits), "JPY", "reject", "ascii").amountMinor, 1250n);
  }
});

test("MONEY-MIX-01: mixed scripts, malformed separators and unknown characters fail without stripping", () => {
  for (const input of ["1۲", "۱2", "١۲", "12.۵۰", "۱٬234", "", " ", " 12", "12 ", "1 234", "1\u00a0234",
    "1\u202f234", "12oops", "$12", "۱۲ ریال", "1e3", "NaN", "Infinity", "0x10", "(12)", "--1", "+-1", "1-", "−1",
    "\u200e12", "\u200f۱۲", "1\u202e2", "1\u20692", "1\n", "1\t2", ".5", "1.", "1..2", "1,23", "1,,234", "1234,567",
    ",123", "123,", "1.234,56", "1,234.5,6", "1٬234٫56", "۱٫۲", "۱۲،۳۴۵", "１２", "1".repeat(257)]) {
    assert.throws(() => normalizeLocalizedDecimal(input, "ascii"), TypeError, JSON.stringify(input));
  }
  for (const input of ["1.25", "1,234", "۱٬۲۳", "۱٬٬۲۳۴", "۱٫۲٫۳", "۱٫", "٫۱", "۱٬۲۳۴.۵", "۱٬۲34"]) {
    assert.throws(() => normalizeLocalizedDecimal(input, "arabic"), TypeError, JSON.stringify(input));
  }
  assert.throws(() => normalizeLocalizedDecimal("12", "guess" as "ascii"));
  assert.throws(() => normalizeLocalizedDecimal(12 as unknown as string, "ascii"));
});

test("localized money uses exact signed int64 bounds, zero, scale and explicit rounding", () => {
  for (const digits of scripts) {
    for (const [input, currency, expected] of [
      ["9223372036854775807", "IRR", MAX_MINOR], ["-9223372036854775808", "IRR", MIN_MINOR],
      ["92233720368547758.07", "USD", MAX_MINOR], ["-9223372036854775.808", "KWD", MIN_MINOR],
      ["9007199254740993", "JPY", 9007199254740993n], ["-0", "IRR", 0n], ["+0.00", "USD", 0n],
    ] as const) {
      assert.equal(parseLocalizedMajor(translate(input, digits), currency, "reject", "ascii").amountMinor, expected);
    }
    for (const [input, currency] of [["9223372036854775808", "IRR"], ["-9223372036854775809", "IRR"],
      ["92233720368547758.08", "USD"], ["1.1", "IRR"], ["0.001", "USD"], ["0.0001", "KWD"]]) {
      assert.throws(() => parseLocalizedMajor(translate(input, digits), currency, "reject", "ascii"));
    }
    assert.equal(parseLocalizedMajor(translate("-1.005", digits), "USD", "half-away-from-zero", "ascii").amountMinor, -101n);
    assert.equal(parseLocalizedMajor(translate("1.005", digits), "USD", "half-even", "ascii").amountMinor, 100n);
    assert.equal(toMajorDecimal(parseLocalizedMajor(translate("12.50", digits), "USD", "reject", "ascii")), "12.50");
  }
  assert.throws(() => parseLocalizedMajor("12", "IRT", "reject", "ascii"));
});
