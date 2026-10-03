import assert from "node:assert/strict";
import { test } from "node:test";
import { paymentReadDto, paymentListSchema } from "../lib/api/payment-read-wire";
import { WireCompatibilityError } from "../lib/money/wire";

const row = () => ({ organizationId: "a", amount: 1250, currencyCode: "USD",
  contact: { organizationId: "a", creditLimit: null },
  bankAccount: { organizationId: "a", balance: -2147483648, lowBalanceThreshold: 0 },
  allocations: [{ amount: 1250, documentType: "invoice" }] });

test("payment reads preserve signed minor units, metadata, nulls and paired allocations", () => {
  for (const currencyCode of ["USD", "IRR", "JPY", "KWD"]) {
    for (const amount of [0, 1250, -1250, 2147483648, Number.MAX_SAFE_INTEGER, -Number.MAX_SAFE_INTEGER]) {
      const input = { ...row(), currencyCode, amount, allocations: [{ amount }, { amount }] };
      const dto = paymentReadDto(input, "a");
      assert.equal(dto.amount, amount); assert.equal(dto.amountMinor, String(amount));
      assert.equal(dto.currencyCode, currencyCode); assert.equal(dto.allocations[1].amountMinor, String(amount));
      assert.equal(dto.contact!.creditLimitMinor, null);
      assert.equal(dto.bankAccount!.balanceMinor, "-2147483648");
      assert.equal(dto.bankAccount!.lowBalanceThresholdMinor, "0");
      assert.doesNotThrow(() => JSON.stringify(dto));
    }
  }
  assert.equal(paymentReadDto({ ...row(), bankAccount: null, contact: null }, "a").bankAccount, null);
  const { bankAccount: _bank, ...list } = row();
  void _bank;
  assert.equal(Object.hasOwn(paymentReadDto(list, "a"), "bankAccount"), false);
  assert.equal(paymentReadDto({ ...row(), bankAccount: { ...row().bankAccount, lowBalanceThreshold: null } }, "a").bankAccount!.lowBalanceThresholdMinor, null);
});

test("payment DTO rejects unsafe history and foreign references without rounding", () => {
  for (const amount of [NaN, Infinity, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => paymentReadDto({ ...row(), amount }, "a"), WireCompatibilityError);
    assert.throws(() => paymentReadDto({ ...row(), allocations: [{ amount }] }, "a"), WireCompatibilityError);
    assert.throws(() => paymentReadDto({ ...row(), contact: { ...row().contact, creditLimit: amount } }, "a"), WireCompatibilityError);
    for (const field of ["balance", "lowBalanceThreshold"]) {
      assert.throws(() => paymentReadDto({ ...row(), bankAccount: { ...row().bankAccount, [field]: amount } }, "a"), WireCompatibilityError);
    }
  }
  assert.throws(() => paymentReadDto({ ...row(), organizationId: "b" }, "a"), WireCompatibilityError);
  assert.throws(() => paymentReadDto({ ...row(), contact: { ...row().contact, organizationId: "b" } }, "a"), WireCompatibilityError);
  assert.throws(() => paymentReadDto({ ...row(), bankAccount: { ...row().bankAccount, organizationId: "b" } }, "a"), WireCompatibilityError);
});

test("payment list inputs bound offsets and reject invalid directions, references and pagination", () => {
  assert.deepEqual(paymentListSchema.parse({}), { page: 1, limit: 50 });
  assert.equal(paymentListSchema.parse({ page: 21474836, limit: 100, type: "made" }).page, 21474836);
  for (const input of [{ page: 21474837 }, { page: NaN }, { page: 1.5 }, { page: "1" },
    { limit: 0 }, { limit: 101 }, { type: "unknown" }, { contactId: "invalid" }]) {
    assert.equal(paymentListSchema.safeParse(input).success, false);
  }
});
