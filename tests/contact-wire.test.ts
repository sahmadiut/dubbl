import assert from "node:assert/strict";
import { test } from "node:test";
import { z } from "zod";
import { contactCreditInput, contactDto, contactBalanceDto } from "../lib/api/contact-wire";
import { WireCompatibilityError } from "../lib/money/wire";

test("contact aliases preserve omission, null, zero and exact safe-range cents", () => {
  assert.deepEqual(contactCreditInput({ name: "Unchanged" }), {});
  for (const amount of [0, 1250, 2147483648, Number.MAX_SAFE_INTEGER]) {
    for (const input of [{ creditLimit: amount }, { creditLimitMinor: String(amount) }, { creditLimit: amount, creditLimitMinor: String(amount) }]) {
      assert.deepEqual(contactCreditInput(input), { creditLimit: amount });
    }
    for (const currencyCode of ["USD", "IRR", "JPY", "KWD"]) {
      assert.deepEqual(contactDto({ creditLimit: amount, currencyCode }), { creditLimit: amount, creditLimitMinor: String(amount), currencyCode });
    }
  }
  for (const input of [{ creditLimit: null }, { creditLimitMinor: null }, { creditLimit: null, creditLimitMinor: null }]) {
    assert.deepEqual(contactCreditInput(input), { creditLimit: null });
  }
  assert.equal(contactDto({ creditLimit: null }).creditLimitMinor, null);
});

test("contact aliases reject malformed/conflicting values and unsupported exact ranges", () => {
  for (const creditLimitMinor of ["-1", "-0", "01", "1.0", "1e3", " 1", "۱", "+1", "9223372036854775808", "1".repeat(1000)]) {
    assert.throws(() => contactCreditInput({ creditLimitMinor }), z.ZodError);
  }
  for (const input of [{ creditLimit: 1, creditLimitMinor: "2" }, { creditLimit: null, creditLimitMinor: "0" },
    { creditLimit: 0, creditLimitMinor: null }, { creditLimit: -1 }, { creditLimit: 0.5 }, { creditLimit: Number.MAX_SAFE_INTEGER + 1 }]) {
    assert.throws(() => contactCreditInput(input), z.ZodError);
  }
  for (const creditLimitMinor of ["9007199254740992", "9223372036854775807"]) {
    assert.throws(() => contactCreditInput({ creditLimitMinor }), WireCompatibilityError);
  }
  assert.throws(() => contactDto({ creditLimit: Number.MAX_SAFE_INTEGER + 1 }), WireCompatibilityError);
});

test("contact balance aggregation is lossless above int32 and guards combined overdue", () => {
  assert.deepEqual(contactBalanceDto("2147483648", "1250", "2147483648", "1250"), {
    owesYou: 2147483648, owesYouMinor: "2147483648", youOwe: 1250, youOweMinor: "1250",
    overdue: 2147484898, overdueMinor: "2147484898",
  });
  assert.equal(contactBalanceDto("-1250", "0", "-1250", "0").overdueMinor, "-1250");
  assert.equal(contactBalanceDto(String(Number.MAX_SAFE_INTEGER), "0", "0", "0").owesYou, Number.MAX_SAFE_INTEGER);
  for (const args of [["9007199254740992", "0", "0", "0"], ["0", "0", "9007199254740991", "1"],
    ["18446744073709551614", "0", "0", "0"]]) {
    assert.throws(() => contactBalanceDto(...args as [string, string, string, string]), WireCompatibilityError);
  }
});
