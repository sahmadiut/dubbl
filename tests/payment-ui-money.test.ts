import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PaymentAmountPreview } from "../components/dashboard/payment-amount-preview";
import { paymentUiAmount, paymentUiBillAmount, paymentUiBill, paymentUiRow, paymentUiBatch,
  paymentUiScheduled, paymentUiRemittance, paymentUiBatchInput, paymentUiDecimal, paymentUiSummary } from "../lib/money/payment-ui";

test("payment currency scales retain low digits and require exact positive whole minor inputs", () => {
  for (const code of ["USD", "JPY", "IRR", "KWD"]) {
    for (const amount of [1n, 1250n, 3000000001n, BigInt(Number.MAX_SAFE_INTEGER)]) {
      assert.deepEqual(paymentUiAmount(paymentUiDecimal(amount, code), code), { amountMinor: amount.toString() });
    }
    for (const text of ["", " ", "1e3", "1x", "NaN", "Infinity", "+1", "-1", "0", "1,000", "1.", ".1"])
      assert.throws(() => paymentUiAmount(text, code));
    assert.throws(() => paymentUiAmount(paymentUiDecimal(BigInt(Number.MAX_SAFE_INTEGER) + 1n, code), code));
    assert.throws(() => paymentUiAmount(code === "USD" ? "0.005" : code === "KWD" ? "0.0005" : "0.5", code));
  }
});

test("payment saved adapters validate aliases and retain signed noncash allocations and bigint sums", () => {
  const raw = { currencyCode: "USD", amount: 3000000001, amountMinor: "3000000001",
    allocations: [{ amount: 3000000000, amountMinor: "3000000000" }, { amount: -1, amountMinor: "-1" }] };
  const saved = paymentUiRow(raw);
  assert.equal(saved.allocated, 2999999999n); assert.equal(saved.unallocated, 2n);
  for (const amount of [NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => paymentUiRow({ ...raw, amount }));
  for (const amountMinor of ["03000000001", "+3000000001", "3000000002", "9007199254740992", 3000000001])
    assert.throws(() => paymentUiRow({ ...raw, amountMinor }));
  assert.throws(() => paymentUiRow({ ...raw, allocations: [{ amount: 1, amountMinor: "2" }] }));
  assert.throws(() => paymentUiRow({ ...raw, currencyCode: "invalid" }));
  const summary = paymentUiSummary([{ amount: BigInt(Number.MAX_SAFE_INTEGER), currencyCode: "USD" },
    { amount: 1n, currencyCode: "USD" }, { amount: 1250n, currencyCode: "JPY" }]);
  assert.match(summary.total, /90,071,992,547,409\.92/); assert.match(summary.total, /1,250/);
  assert.match(paymentUiSummary([{ amount: 1n, currencyCode: "USD" }, { amount: 2n, currencyCode: "USD" }]).average, /0\.02/);
  assert.equal(paymentUiSummary([{ amount: -1n, currencyCode: "USD" }, { amount: -2n, currencyCode: "USD" }]).average, "-$0.01");
  assert.equal(paymentUiSummary([]).total, "—");
});

test("batch preview/payload uses explicit single currency, safe exact totals and due/contact/reference limits", () => {
  for (const currencyCode of ["USD", "JPY", "IRR", "KWD"]) {
    const bills = ["a", "b"].map(id => ({ id, contactId: "supplier", currencyCode, amountDue: 3000000001n }));
    const selected = bills.map(bill => ({ billId: bill.id, contactId: bill.contactId, currencyCode, amount: paymentUiDecimal(3000000001n, currencyCode) }));
    const preview = paymentUiBatchInput(selected, bills);
    assert.equal(preview.total, 6000000002n); assert.equal(preview.currencyCode, currencyCode);
    assert.equal(preview.items[0].amountMinor, "3000000001"); assert.equal(Object.hasOwn(preview.items[0], "amount"), false);
    assert.throws(() => paymentUiBatchInput([...selected, selected[0]], bills));
    assert.throws(() => paymentUiBatchInput([{ ...selected[0], contactId: "other" }], bills));
    assert.throws(() => paymentUiBatchInput([{ ...selected[0], billId: "missing" }], bills));
    assert.throws(() => paymentUiBatchInput([{ ...selected[0], amount: paymentUiDecimal(3000000002n, currencyCode) }], bills));
    assert.throws(() => paymentUiBatchInput([selected[0], { ...selected[1], currencyCode: "EUR" }], bills));
    const huge = bills.map(bill => ({ ...bill, amountDue: BigInt(Number.MAX_SAFE_INTEGER) }));
    assert.throws(() => paymentUiBatchInput(selected.map(row => ({ ...row, amount: paymentUiDecimal(BigInt(Number.MAX_SAFE_INTEGER), currencyCode) })), huge));
    const bill = paymentUiBill({ currencyCode, total: 1250, totalMinor: "1250", amountDue: 1250, amountDueMinor: "1250" });
    assert.equal(bill.amountDue, 1250n);
    const batch = { currencyCode, totalAmount: 1250, totalAmountMinor: "1250", items: [{ currencyCode, amount: 1250, amountMinor: "1250" }] };
    assert.equal(paymentUiBatch(batch).totalAmount, 1250n);
    assert.throws(() => paymentUiBatch({ ...batch, totalAmountMinor: "1251" }));
    assert.throws(() => paymentUiBatch({ ...batch, items: [{ ...batch.items[0], currencyCode: "EUR" }] }));
    assert.equal(paymentUiScheduled(batch.items[0]).amount, 1250n);
    assert.throws(() => paymentUiScheduled({ ...batch.items[0], amountMinor: "1251" }));
    const remittance = { currencyCode, totalPaid: 1250, totalPaidMinor: "1250", lines: [{ currencyCode, billTotal: 2000, billTotalMinor: "2000", amountPaid: 1250, amountPaidMinor: "1250" }] };
    assert.equal(paymentUiRemittance(remittance).totalPaid, 1250n);
    assert.throws(() => paymentUiRemittance({ ...remittance, lines: [{ ...remittance.lines[0], amountPaidMinor: "1251" }] }));
  }
  assert.throws(() => paymentUiBatchInput([], []));
});

test("scheduled English previews show currency precision and suppress invalid or excessive amounts", () => {
  for (const currencyCode of ["USD", "JPY", "IRR", "KWD"]) {
    const bill = { id: "a", contactId: "supplier", currencyCode, amountDue: 3000000001n };
    const text = paymentUiDecimal(bill.amountDue, currencyCode);
    assert.equal(paymentUiBillAmount(text, bill).amountMinor, "3000000001");
    const html = renderToStaticMarkup(createElement(PaymentAmountPreview, { text, bill }));
    assert.match(html, /Payment:/); assert.doesNotMatch(html, /role="alert"/);
    for (const invalid of ["x", paymentUiDecimal(bill.amountDue + 1n, currencyCode)]) {
      const error = renderToStaticMarkup(createElement(PaymentAmountPreview, { text: invalid, bill }));
      assert.match(error, /role="alert"/); assert.doesNotMatch(error, /Payment:/);
    }
  }
});
