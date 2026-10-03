import assert from "node:assert/strict";
import { test } from "node:test";
import { paymentCreateSchema, paymentAllocations, paymentCashBase, paymentCarryingBase, paymentRequestInput } from "../lib/api/payment-settlement-wire";
import { WireCompatibilityError } from "../lib/money/wire";

const documentId = "00000000-0000-4000-8000-000000000001", contactId = "00000000-0000-4000-8000-000000000002";
const body = { contactId, type: "received", date: "2026-10-04", amountMinor: "1250", allocations: [{ documentType: "invoice", documentId, amount: 1250 }] };
test("settlement aliases, full allocations, dates and canonical syntax reject unsupported inputs", () => {
  assert.equal(paymentAllocations(paymentCreateSchema.parse(body)).amount, 1250);
  for (const patch of [{ amount: 1249 }, { amountMinor: "01" }, { amountMinor: "1e3" }, { amountMinor: "-1" }, { amount: 1.5, amountMinor: undefined },
    { date: "2026-02-30" }, { idempotencyKey: " key " }, { allocations: [...body.allocations, ...body.allocations] },
    { allocations: [{ ...body.allocations[0], amount: 1251 }] }, { type: "made" }])
    assert.throws(() => paymentAllocations(paymentCreateSchema.parse({ ...body, ...patch })));
  assert.throws(() => paymentAllocations(paymentCreateSchema.parse({ ...body, amountMinor: "9007199254740992" })), WireCompatibilityError);
  assert.throws(() => paymentRequestInput(new Request("http://fixture", { headers: { "idempotency-key": "a" } }), { idempotencyKey: "b" }));
});
test("settlement FX uses exact minor scales and bounded arithmetic", () => {
  assert.equal(paymentCashBase(1250, "USD", "USD", "1"), 1250);
  assert.equal(paymentCashBase(1250, "IRR", "USD", "0.01"), 1250);
  assert.equal(paymentCashBase(1250, "JPY", "USD", "0.01"), 1250);
  assert.equal(paymentCashBase(1250, "KWD", "USD", "2"), 250);
  assert.equal(paymentCashBase(Number.MAX_SAFE_INTEGER, "USD", "USD", "1"), Number.MAX_SAFE_INTEGER);
  assert.throws(() => paymentCashBase(Number.MAX_SAFE_INTEGER, "USD", "USD", "2"), WireCompatibilityError);
  assert.throws(() => paymentCashBase(1250, "USD", "USD", "0.0000001"), WireCompatibilityError);
});
test("partial carrying releases the saved residual on final settlement", () => {
  const first = paymentCarryingBase(2, 3, 0, 1), second = paymentCarryingBase(2, 3, 1, 1), last = paymentCarryingBase(2, 3, 2, 1);
  assert.deepEqual([first, second, last], [1, 0, 1]); assert.equal(first + second + last, 2);
  assert.equal(paymentCarryingBase(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, 0, Number.MAX_SAFE_INTEGER), Number.MAX_SAFE_INTEGER);
  assert.throws(() => paymentCarryingBase(2, 3, 2, 2), WireCompatibilityError);
});
