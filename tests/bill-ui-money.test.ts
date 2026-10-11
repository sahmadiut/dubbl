import assert from "node:assert/strict";
import { test } from "node:test";
import { billUiDocument, billUiList, billUiBase, billUiCounts, billUiAging, billUiMoney,
  billUiDecimal, billUiAmount, billUiAmountValid, billUiPaymentAmount, billUiPaymentValid, billUiPercent, billUiSupplierCreditLines } from "../lib/money/bill-ui";
import { billEditorPreview } from "../lib/money/bill-editor";
import { debitNoteTotals } from "../lib/api/debit-note-wire";

const raw = { currencyCode: "USD", subtotal: 1250, subtotalMinor: "1250", taxTotal: 0,
  total: 1250, amountPaid: 0, amountDue: 1250, lines: [{ description: "Saved", quantity: 125,
    unitPrice: 1000, unitPriceMinor: "1000", amount: 1250, taxAmount: 0 }] };

test("saved bill aliases adopt exact raw units with strict legacy fallback and currency scale", () => {
  for (const [currency, decimal] of [["USD", "12.50"], ["JPY", "1250"], ["IRR", "1250"], ["KWD", "1.250"]]) {
    const bill = billUiDocument({ ...raw, currencyCode: currency });
    assert.equal(bill.total, 1250n); assert.equal(bill.lines![0].unitPrice, 1000n);
    assert.equal(billUiDecimal(bill.amountDue, currency), decimal);
    assert.equal(billUiList({ total: 1250, amountDue: 1250, currencyCode: currency }).amountDue, 1250n);
  }
  const large = billUiDocument({ ...raw, total: Number.MAX_SAFE_INTEGER, totalMinor: "9007199254740991" });
  assert.match(billUiMoney(large.total, "USD"), /90,071,992,547,409\.91/);
  assert.throws(() => billUiDocument({ ...raw, totalMinor: "1251" }));
  for (const alias of ["01", "+1", "-0", "1.1", "1e3", 1250, null]) assert.throws(() => billUiDocument({ ...raw, totalMinor: alias }));
  for (const total of [NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => billUiDocument({ ...raw, total }));
  assert.throws(() => billUiDocument({ ...raw, currencyCode: "INVALID" }));
  assert.throws(() => billUiDocument({ ...raw, lines: undefined }));
  assert.throws(() => billUiDocument({ ...raw, lines: [{ ...raw.lines[0], quantity: 1.25 }] }));
  const reverse = billUiDocument({ ...raw, taxTotal: 250, total: 1500 });
  assert.equal(reverse.total, 1500n); assert.equal(reverse.amountDue, 1250n);
});

test("bill payment input sends positive exact Minor without silent rounding or rescaling", () => {
  for (const [currency, input, expected] of [["USD", "12.50", "1250"], ["JPY", "1250", "1250"],
    ["IRR", "1250", "1250"], ["KWD", "1.251", "1251"], ["USD", "90071992547409.91", "9007199254740991"]]) {
    assert.deepEqual(billUiAmount(input, currency), { amountMinor: expected });
    assert.equal(billUiAmountValid(input, currency), true);
  }
  for (const value of ["", "0", "-1", "1e3", "1.2x", " 1", "1,000", "0.001", "90071992547409.92"])
    assert.equal(billUiAmountValid(value, "USD"), false);
  assert.equal(billUiAmountValid("1.1", "JPY"), false);
  assert.equal(billUiAmountValid("1.0001", "KWD"), false);
  assert.deepEqual(billUiPaymentAmount("12.50", "USD", 1250n), { amountMinor: "1250" });
  assert.equal(billUiPaymentValid("12.51", "USD", 1250n), false);
  assert.equal(billUiPaymentValid("1", "JPY", 0n), false);
  assert.equal(billUiPercent(4000000000000001n, 8000000000000002n), 50);
  assert.equal(billUiPercent(1n, 3n, 2), 33.33);
  assert.equal(billUiPercent(999n, 1n), 100);
  assert.equal(billUiPercent(-1n, 1n), 0);
});

test("bill counts and aging never mix currencies or lose low digits in bigint sums", () => {
  const summary = billUiCounts({ total: 4, counts: {
    received: { count: 1, currencyCode: "USD", amount: 9007199254740991, amountMinor: "9007199254740991" },
    partial: { count: 1, currencyCode: "USD", amount: 2 },
    overdue: { count: 1, currencyCode: "JPY", amount: 1250 },
    paid: { count: 1, currencyCode: "KWD", amount: 0 },
  } });
  assert.deepEqual(summary.currencies, [{ currencyCode: "JPY", outstanding: 1250n, overdue: 1250n },
    { currencyCode: "USD", outstanding: 9007199254740993n, overdue: 0n }]);
  assert.deepEqual(billUiCounts({ total: 0, counts: {} }).currencies, []);
  assert.throws(() => billUiCounts({ total: 1, counts: { received: { count: 1, amount: 1, amountMinor: "2", currencyCode: "USD" } } }));
  assert.throws(() => billUiCounts({ total: 2, counts: { paid: { count: 1, amount: 0, currencyCode: "USD" } } }));
  const aging = billUiAging([
    { status: "received", dueDate: "2026-10-12", currencyCode: "USD", amountDue: 9007199254740991n },
    { status: "partial", dueDate: "2026-10-01", currencyCode: "USD", amountDue: 2n },
    { status: "overdue", dueDate: "2026-08-01", currencyCode: "JPY", amountDue: 1250n },
    { status: "draft", dueDate: "2026-08-01", currencyCode: "JPY", amountDue: 9999n },
  ], new Date("2026-10-11T00:00:00Z"));
  assert.equal(aging[0].currencyCode, "JPY"); assert.equal(aging[0].buckets["60+"].amount, 1250n);
  assert.equal(aging[1].total, 9007199254740993n); assert.equal(aging[1].buckets["1-30"].amount, 2n);
});

test("bill base display stays nullable and supplier-credit payload preserves accepted dimensions", () => {
  const amounts = { subtotal: null, taxTotal: null, total: null, amountDue: null, amountPaid: null };
  assert.equal(billUiBase({ baseCurrency: "USD", amounts }).amounts.total, null);
  assert.throws(() => billUiBase({ baseCurrency: "USD", amounts: { ...amounts, totalMinor: "0" } }));
  assert.equal(billUiBase({ baseCurrency: "KWD", amounts: { subtotal: 1250, taxTotal: 0, total: 1250,
    amountDue: 1250, amountPaid: 0, totalMinor: "1250" } }).amounts.total, 1250n);
  for (const [currency, decimal] of [["USD", "12.50"], ["JPY", "1250"], ["IRR", "1250"], ["KWD", "1.250"]]) {
    const [line] = billUiSupplierCreditLines([{ description: "Copy", quantity: 125, unitPrice: 1250n,
      accountId: "account", taxRateId: "tax", costCenterId: "center", discountPercent: 1000 }], currency);
    assert.deepEqual(line, { description: "Copy", quantity: 1.25, unitPriceExact: decimal,
      accountId: "account", taxRateId: "tax", costCenterId: "center", discountPercent: 1000 });
    assert.equal(Object.hasOwn(line, "unitPrice"), false);
  }
  // Saved prices cannot reconstruct hidden source precision; keep the actual debit-note policy explicit.
  const preview = billEditorPreview([{ description: "Sub-minor", unitPrice: "0.005", quantity: "3", accountId: "", taxRateId: "" }], "USD", []);
  assert.equal(preview.total, 2n); assert.equal(preview.lines[0].priceMinor, 1n);
  const copied = billUiSupplierCreditLines([{ description: "Sub-minor", quantity: 300, unitPrice: 1n }], "USD");
  assert.equal(copied[0].unitPriceExact, "0.01");
  assert.equal(debitNoteTotals(copied, "rest", "USD", new Map()).total, 3);
});
