import assert from "node:assert/strict";
import { test } from "node:test";
import { contractorPaymentCreateSchema, contractorPaymentUpdateSchema, taxPaymentCreateSchema, paymentAmounts, paymentAllocations, payrollPaymentDto, resolvePayrollLiability, paymentDate } from "../lib/api/payroll-payment-wire";
import { payrollConvert } from "../lib/payroll/exact";

test("payroll payments preserve cents and reject malformed/conflicting/unsupported money", () => {
  for (const amount of [29, 1250, 3000000000, Number.MAX_SAFE_INTEGER]) {
    assert.equal(paymentAmounts(contractorPaymentCreateSchema.parse({ amount })).amount, amount);
    assert.equal(paymentAmounts(contractorPaymentCreateSchema.parse({ amountMinor: String(amount) })).amount, amount);
    assert.equal(paymentAmounts(contractorPaymentCreateSchema.parse({ amount, amountMinor: String(amount) })).amount, amount);
  }
  for (const input of [{}, { amount: 0 }, { amount: -1 }, { amount: 0.5 }, { amount: 1, amountMinor: "2" },
    { amountMinor: "01" }, { amountMinor: "-0" }, { amountMinor: "1e3" }, { amountMinor: "۱۲۵۰" }, { amountMinor: "9007199254740992" },
    { amountMinor: "9223372036854775807" }, { amount: 1, currency: "ZZZ" }, { amount: 1, unexpected: 1 }])
    assert.throws(() => paymentAmounts(contractorPaymentCreateSchema.parse(input)));
  assert.deepEqual(paymentAmounts(contractorPaymentUpdateSchema.parse({ description: null }), false), { description: null });
});
test("tax allocations group exact safe totals and reject unknown buckets/overflow", () => {
  const period = { periodStart: "2024-01-01", periodEnd: "2024-01-31" };
  const p = taxPaymentCreateSchema.parse({ ...period, allocations: [{ bucket: "medicare", amount: 29 }, { bucket: "fica", amountMinor: "1250" }, { bucket: "2220", amount: 3000000000 }] });
  assert.deepEqual(paymentAllocations(p), { allocations: [{ code: "2220", amount: 3000000000 }, { code: "2235", amount: 1279 }], amount: 3000001279 });
  assert.equal(resolvePayrollLiability("pension"), "2245"); assert.equal(resolvePayrollLiability("statutory"), "2236");
  assert.throws(() => resolvePayrollLiability("unknown"));
  assert.throws(() => paymentAllocations(taxPaymentCreateSchema.parse({ ...period, allocations: [{ bucket: "fica", amount: Number.MAX_SAFE_INTEGER }, { bucket: "fit", amount: 1 }] })));
  for (const date of ["0000-01-01", "2024-04-31", "2023-02-29", "2024-1-01"]) assert.equal(paymentDate.safeParse(date).success, false);
});
test("saved payment snapshot validates exact conversion and rejects partial/unsafe history", () => {
  const p = { amount: 1250, currency: "EUR", status: "paid", baseAmount: 1500, baseCurrency: "USD", rateExact: "1.2", paymentDate: "2024-01-31" };
  assert.equal(payrollPaymentDto(p).baseAmountMinor, "1500"); assert.equal(payrollPaymentDto(p).amountMinor, "1250");
  for (const bad of [{ amount: -1 }, { baseAmount: 1501 }, { rateExact: null }, { baseCurrency: null }, { status: "pending" }, { paymentDate: "2024-02-30" }, { amount: 9007199254740992 }])
    assert.throws(() => payrollPaymentDto({ ...p, ...bad }));
  assert.equal(payrollPaymentDto({ amount: 1250, currency: null, status: "paid", baseAmount: null, baseCurrency: null, rateExact: null, paymentDate: null }).baseAmountMinor, null);
  assert.equal(payrollConvert(29, "1.5"), 44); assert.equal(payrollConvert(1250, "1.2"), 1500);
  assert.throws(() => payrollConvert(Number.MAX_SAFE_INTEGER, "1.2"));
});
