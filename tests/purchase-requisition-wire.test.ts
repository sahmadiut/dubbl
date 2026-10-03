import assert from "node:assert/strict";
import { test } from "node:test";
import { requisitionLineSchema, requisitionCreateSchema, requisitionUpdateSchema,
  requisitionTotals, requisitionDto, validateRequisition } from "../lib/api/purchase-requisition-wire";
import { WireCompatibilityError } from "../lib/money/wire";
const line = (values: Record<string, unknown>) => requisitionLineSchema.parse({ description: "Item", ...values });
const total = (values: Record<string, unknown>, currency = "USD") => requisitionTotals([line(values)], currency);

test("requisition exact aliases, signed extended rounding, no tax and currency scales", () => {
  for (const [currency, price] of [["USD", "12.50"], ["JPY", "1250"], ["IRR", "1250"], ["KWD", "1.250"]]) {
    assert.equal(total({ unitPriceExact: price }, currency).total, 1250);
    assert.equal(total({ unitPriceMinor: "1250" }, currency).total, 1250);
  }
  for (const price of [{ unitPrice: 12.5 }, { unitPriceExact: "12.50" }, { unitPriceMinor: "1250" },
    { unitPrice: 12.5, unitPriceExact: "12.50", unitPriceMinor: "1250" }]) assert.equal(total(price).total, 1250);
  assert.equal(total({ unitPrice: 0.29 }).total, 29);
  assert.equal(total({ unitPriceExact: "0.005", quantity: 3 }).total, 2);
  assert.equal(total({ unitPriceExact: "-0.015" }).total, -1);
  const result = total({ quantity: 1.5, unitPriceMinor: "1250", taxRateId: "00000000-0000-4000-8000-000000000001" });
  assert.equal(result.total, 1875); assert.equal(result.taxTotal, 0); assert.equal(result.processedLines[0].quantity, 150);
  assert.equal(result.processedLines[0].taxAmount, 0); assert.equal(requisitionDto(result).totalMinor, "1875");
  assert.equal(total({}).total, 0);
});
test("requisition range, alias, syntax and date validation rejects precision loss", () => {
  assert.equal(total({ unitPriceMinor: String(Number.MAX_SAFE_INTEGER) }).total, Number.MAX_SAFE_INTEGER);
  assert.throws(() => total({ unitPriceMinor: "9007199254740992" }), WireCompatibilityError);
  assert.throws(() => total({ unitPriceMinor: String(Number.MAX_SAFE_INTEGER), quantity: 2 }), WireCompatibilityError);
  assert.throws(() => requisitionTotals([line({ unitPriceMinor: String(Number.MAX_SAFE_INTEGER) }), line({ unitPriceMinor: "1" })], "USD"), WireCompatibilityError);
  assert.throws(() => total({ unitPrice: 12.5, unitPriceMinor: "12" }), /disagree/);
  assert.throws(() => total({ unitPrice: 12.5, unitPriceExact: "12.51" }), /disagree/);
  for (const value of ["01", "1e3", " 1", "1.0", "-0", "۱۲", "9223372036854775808"]) assert.throws(() => line({ unitPriceMinor: value }));
  for (const value of ["01", "1e3", "+1", "1.0000000000000000001", "۱۲"]) assert.throws(() => line({ unitPriceExact: value }));
  assert.throws(() => line({ quantity: 21474836.48 }));
  assert.throws(() => requisitionCreateSchema.parse({ requestDate: "2026-02-30", lines: [line({})] }));
  assert.throws(() => requisitionUpdateSchema.parse({ status: "approved" }));
  assert.throws(() => requisitionUpdateSchema.parse({ requiredDate: "2026-13-01" }));
});
test("requisition saved balances reject corrupt tax, sums and unsupported line money", () => {
  const result = total({ unitPriceMinor: "1250" }); validateRequisition(result, result.processedLines);
  assert.throws(() => validateRequisition({ ...result, total: 1251 }, result.processedLines), /balances/);
  assert.throws(() => validateRequisition(result, [{ ...result.processedLines[0], taxAmount: 1 }]), /tax/);
  assert.throws(() => validateRequisition(result, [{ ...result.processedLines[0], unitPrice: 9007199254740992 }]), WireCompatibilityError);
  assert.throws(() => validateRequisition(result, []), /at least one/);
});
