import assert from "node:assert/strict";
import { test } from "node:test";
import { batchMajorAmount, immediateBatchSchema, batchCreateSchema, storedBatchItems } from "../lib/api/payment-batch-wire";
import { WireCompatibilityError } from "../lib/money/wire";
import { formatInvoiceReminderAmount } from "../lib/api/invoice-bulk-wire";

test("batch major aliases retain currency scales, exact decimal rounding and numeric agreement", () => {
  for (const input of [{ amount: 12.50 }, { amountExact: "12.50" }, { amountMinor: "1250" }, { amount: 12.5, amountExact: "12.500", amountMinor: "1250" }])
    assert.equal(batchMajorAmount(input, "USD"), 1250);
  assert.equal(batchMajorAmount({ amount: 1.005 }, "USD"), 101);
  assert.equal(batchMajorAmount({ amountExact: "1.004999999999999999" }, "USD"), 100);
  assert.equal(batchMajorAmount({ amount: 1250 }, "JPY"), 1250);
  assert.equal(batchMajorAmount({ amountExact: "1250" }, "IRR"), 1250);
  assert.equal(batchMajorAmount({ amountExact: "1.250" }, "KWD"), 1250);
  assert.equal(batchMajorAmount({ amountMinor: "9007199254740991" }, "USD"), Number.MAX_SAFE_INTEGER);
  for (const input of [{}, { amount: 0.001 }, { amountMinor: "0" }, { amountMinor: "-1" },
    { amount: 12.5, amountExact: "12.501" }, { amount: 12.5, amountMinor: "12" }])
    assert.throws(() => batchMajorAmount(input, "USD"));
  assert.throws(() => batchMajorAmount({ amountMinor: "9007199254740992" }, "USD"), WireCompatibilityError);
});
test("batch schemas distinguish decimal-major immediate allocations from stored integer-minor items", () => {
  const uuid = "00000000-0000-4000-8000-000000000001";
  const parsed = batchCreateSchema.parse({ name: "Batch", items: [{ billId: uuid, contactId: uuid, amount: 1250, amountMinor: "1250" }] });
  assert.equal(storedBatchItems(parsed.items)[0].amount, 1250);
  assert.throws(() => batchCreateSchema.parse({ name: "Batch", items: [{ billId: uuid, contactId: uuid, amount: 12.50 }] }));
  for (const amountMinor of ["01", "+1", "1.0", " 1", "9223372036854775808"]) assert.throws(() => immediateBatchSchema.parse({
    type: "made", date: "2026-10-04", contactId: uuid, allocations: [{ documentId: uuid, documentType: "bill", amountMinor }] }));
  assert.equal(formatInvoiceReminderAmount(Number.MAX_SAFE_INTEGER, "USD"), "$90,071,992,547,409.91");
});
