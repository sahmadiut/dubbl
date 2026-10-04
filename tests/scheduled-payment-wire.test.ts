import assert from "node:assert/strict";
import { test } from "node:test";
import { creditAmount } from "../lib/api/credit-wire";
import { scheduledPaymentCreateSchema, scheduledPaymentUpdateSchema, scheduledPaymentListSchema } from "../lib/api/scheduled-payment-wire";
import { WireCompatibilityError } from "../lib/money/wire";
import { parseMajor, fromLegacyNumber, toMajorDecimal } from "../lib/money/exact";

test("schedule input preserves minor units, exact aliases and safe bounds without currency rescaling", () => {
  const base = { billId: "00000000-0000-4000-8000-000000000001", contactId: "00000000-0000-4000-8000-000000000002", scheduledDate: "2026-10-04" };
  for (const currencyCode of ["USD", "JPY", "KWD", "IRR"]) {
    assert.equal(creditAmount(scheduledPaymentCreateSchema.parse({ ...base, currencyCode, amount: 1250, amountMinor: "1250" })), 1250);
  }
  assert.equal(creditAmount(scheduledPaymentCreateSchema.parse({ ...base, amountMinor: "9007199254740991" })), Number.MAX_SAFE_INTEGER);
  for (const patch of [{}, { amount: 12.5 }, { amountMinor: "01" }, { amountMinor: "-0" }, { amountMinor: "0" },
    { amount: 1250, amountMinor: "1251" }, { scheduledDate: "2026-02-30", amount: 1250 }, { amount: 1250, amountExact: "12.50" }])
    assert.throws(() => creditAmount(scheduledPaymentCreateSchema.parse({ ...base, ...patch })));
  assert.throws(() => creditAmount(scheduledPaymentCreateSchema.parse({ ...base, amountMinor: "9007199254740992" })), WireCompatibilityError);
  assert.deepEqual(scheduledPaymentUpdateSchema.parse({ status: "cancelled" }), { status: "cancelled" });
  assert.throws(() => scheduledPaymentUpdateSchema.parse({ status: "completed" }));
  assert.throws(() => scheduledPaymentListSchema.parse({ status: "unknown" }));
});

test("schedule form conversions retain document currency scale and exact decimal ties", () => {
  for (const [currency, major] of [["USD", "12.50"], ["JPY", "1250"], ["KWD", "1.250"], ["IRR", "1250"]]) {
    assert.equal(toMajorDecimal(fromLegacyNumber(1250, currency)), major);
    assert.equal(parseMajor(major, currency, "half-away-from-zero").amountMinor.toString(), "1250");
  }
  assert.equal(parseMajor("1.005", "USD", "half-away-from-zero").amountMinor.toString(), "101");
  assert.equal(parseMajor("90071992547409.91", "USD", "half-away-from-zero").amountMinor.toString(), "9007199254740991");
  assert.throws(() => parseMajor("1,250.00", "USD", "half-away-from-zero"));
});
