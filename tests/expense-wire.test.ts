import assert from "node:assert/strict";
import { test } from "node:test";
import { expenseCreateSchema, expenseMcpCreateSchema, expenseUpdateSchema, expenseAmount,
  expenseMileageRate, expenseHeaderDto, expenseItemDto } from "../lib/api/expense-wire";
import { WireCompatibilityError } from "../lib/money/wire";
import { expenseMoneyDisplay, expenseSummaryDisplay } from "../lib/money/expense-display";
import { fromLegacyNumber, toMajorDecimal, parseMajor } from "../lib/money/exact";

test("expense legacy/exact amounts preserve major REST and minor MCP units and explicit currency scales", () => {
  for (const [currency, major] of [["USD", "12.50"], ["JPY", "1250"], ["KWD", "1.250"], ["IRR", "1250"]]) {
    assert.equal(expenseAmount({ amountExact: major, amountMinor: "1250" }, currency, "rest"), 1250);
    assert.equal(expenseAmount({ amount: Number(major) }, currency, "rest"), 1250);
    assert.equal(expenseAmount({ amount: 1250, amountMinor: "1250", amountExact: major }, currency, "mcp"), 1250);
  }
  assert.equal(expenseAmount({ amountExact: "1.005" }, "USD", "rest"), 101);
  assert.equal(expenseAmount({ amount: 1e-7 }, "USD", "rest"), 0);
  assert.equal(expenseAmount({ amountMinor: "9007199254740991" }, "USD", "rest"), Number.MAX_SAFE_INTEGER);
  assert.equal(expenseAmount({ amountExact: "90071992547409.91" }, "USD", "rest"), Number.MAX_SAFE_INTEGER);
  for (const input of [{}, { amount: 12.5, amountExact: "12.51" }, { amountExact: "12.50", amountMinor: "1251" }, { amountMinor: "-1" }, { amountExact: "-0.01" }])
    assert.throws(() => expenseAmount(input, "USD", "rest"));
  assert.throws(() => expenseAmount({ amount: 1250, amountMinor: "1251" }, "USD", "mcp"));
  assert.throws(() => expenseAmount({ amountMinor: "9007199254740992" }, "USD", "rest"), WireCompatibilityError);
});
test("expense editor and summary presentation retain exact fractions, currency and aggregate units", () => {
  assert.equal(toMajorDecimal(fromLegacyNumber(Number.MAX_SAFE_INTEGER, "USD")), "90071992547409.91");
  assert.equal(parseMajor("1.005", "USD", "half-away-from-zero").amountMinor, 101n);
  assert.equal(expenseMoneyDisplay(9007199254740991n, "USD"), "$90,071,992,547,409.91");
  assert.equal(expenseMoneyDisplay(1250n, "JPY"), "¥1,250");
  assert.ok(expenseMoneyDisplay(1250n, "KWD").endsWith("1.250"));
  assert.equal(expenseSummaryDisplay([{ amountMinor: "9007199254740991", currencyCode: "USD" }, { amountMinor: "1", currencyCode: "USD" }]), "$90,071,992,547,409.92");
  assert.equal(expenseSummaryDisplay([{ amountMinor: "1", currencyCode: "USD" }, { amountMinor: "1", currencyCode: "EUR" }]), "Multiple currencies");
});
test("expense schemas reject unsupported input and metadata, and DTOs retain numeric and exact aliases", () => {
  const item = { date: "2026-10-04", description: "Fixture", amountMinor: "0" };
  const create = { title: "Fixture", items: [item] };
  assert.equal(expenseCreateSchema.safeParse(create).success, true);
  for (const extra of [{ amountMinor: "01" }, { amountMinor: "1e3" }, { amountExact: "۱" }, { amountExact: "1e3" },
    { amount: Infinity }, { amount: -1 }, { date: "2026-02-30" }, { distanceMiles: 2147483648 }, { projectId: "any" }])
    assert.equal(expenseCreateSchema.safeParse({ ...create, items: [{ ...item, ...extra }] }).success, false);
  assert.equal(expenseMcpCreateSchema.safeParse({ ...create, items: [{ ...item, amount: 12.5 }] }).success, false);
  assert.equal(expenseUpdateSchema.safeParse({ totalAmount: 1 }).success, false);
  assert.equal(expenseUpdateSchema.safeParse({ currencyCode: "EUR" }).success, false);
  assert.equal(expenseMileageRate({ mileageRate: 67, mileageRateMinor: "67" }), 67);
  assert.equal(expenseMileageRate({ mileageRateMinor: null }), null);
  assert.throws(() => expenseMileageRate({ mileageRate: 67, mileageRateMinor: "68" }));
  assert.throws(() => expenseMileageRate({ mileageRateMinor: "9007199254740992" }), WireCompatibilityError);
  assert.throws(() => expenseMileageRate({ mileageRateMinor: "-1" }));
  assert.deepEqual(expenseHeaderDto({ totalAmount: 1250 }), { totalAmount: 1250, totalAmountMinor: "1250" });
  assert.deepEqual(expenseItemDto({ amount: 1250, mileageRate: 67, distanceMiles: 100 }),
    { amount: 1250, amountMinor: "1250", mileageRate: 67, mileageRateMinor: "67", distanceMiles: 100 });
  assert.throws(() => expenseHeaderDto({ totalAmount: 9007199254740992 }), WireCompatibilityError);
  assert.throws(() => expenseItemDto({ amount: -1, mileageRate: null, distanceMiles: null }), WireCompatibilityError);
});
