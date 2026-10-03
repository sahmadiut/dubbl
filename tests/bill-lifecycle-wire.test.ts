import assert from "node:assert/strict";
import { test } from "node:test";
import { billTaxSplit, billUnits, billInt32, billVarianceBp, billRejectSchema, billSettlementBalances } from "../lib/api/bill-lifecycle-wire";
import { WireCompatibilityError } from "../lib/money/wire";

test("bill taxes retain minor units with exact partial/reverse-charge rounding", () => {
  assert.deepEqual(billTaxSplit(1250, 125), { input: 125, output: 0, blocked: 0, supplier: 1375 });
  assert.deepEqual(billTaxSplit(1250, 125, { kind: "reverse_charge", rate: 1000, recoverablePercent: 5000 }),
    { input: 63, output: 125, blocked: 62, supplier: 1250 });
  assert.deepEqual(billTaxSplit(9007199254740990, 0), { input: 0, output: 0, blocked: 0, supplier: 9007199254740990 });
  assert.deepEqual(billTaxSplit(1, 1, { kind: "standard", rate: 1000, recoverablePercent: 5000 }), { input: 1, output: 0, blocked: 0, supplier: 2 });
  for (const [amount, tax] of [[Number.MAX_SAFE_INTEGER, 1], [-1, 0], [1.1, 0]]) assert.throws(() => billTaxSplit(amount, tax), WireCompatibilityError);
  assert.throws(() => billTaxSplit(1250, 124, { kind: "reverse_charge", rate: 1000, recoverablePercent: 10000 }), WireCompatibilityError);
  assert.throws(() => billTaxSplit(1, 1, { kind: "standard", rate: 1000, recoverablePercent: 10001 }), WireCompatibilityError);
});
test("bill quantity and tolerance policies use exact ratios and bounded int32 tallies", () => {
  assert.equal(billUnits(149), 1); assert.equal(billUnits(150), 2); assert.equal(billUnits(50), 1);
  assert.equal(billInt32(2147483647n), 2147483647); assert.throws(() => billInt32(2147483648n), WireCompatibilityError);
  assert.throws(() => billInt32(-1n), WireCompatibilityError); assert.throws(() => billUnits(-1), WireCompatibilityError);
  assert.equal(billVarianceBp(1250, 1000), 2500n); assert.equal(billVarianceBp(1000, 1250), -2000n);
  assert.equal(billVarianceBp(Number.MAX_SAFE_INTEGER, 1), 90071992547409900000n);
  assert.equal(billVarianceBp(1, 0), 10000n);
});
test("bill rejection input validates before mutations", () => {
  assert.deepEqual(billRejectSchema.parse({ reason: "Wrong supplier" }), { reason: "Wrong supplier" });
  assert.throws(() => billRejectSchema.parse({ reason: {} })); assert.throws(() => billRejectSchema.parse({ reason: "x".repeat(10001) }));
});
test("settlement barrier requires recognition and subtracts the actual reverse-charge payable", () => {
  const row = { status: "received", journalEntryId: "saved", subtotal: 1250, taxTotal: 125, total: 1375, amountPaid: 0, amountDue: 1250 };
  assert.deepEqual(billSettlementBalances(row, 1250), { amountPaid: 1250, amountDue: 0 });
  assert.throws(() => billSettlementBalances({ ...row, status: "draft" }, 1));
  assert.throws(() => billSettlementBalances({ ...row, journalEntryId: null }, 1));
  assert.throws(() => billSettlementBalances(row, 1251));
  assert.throws(() => billSettlementBalances(row, 0));
  assert.throws(() => billSettlementBalances({ ...row, amountPaid: Number.MAX_SAFE_INTEGER }, 1), WireCompatibilityError);
});
