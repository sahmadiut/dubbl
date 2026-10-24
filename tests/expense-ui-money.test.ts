import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { createElement } from "react";
import { renderToStaticMarkup } from "./helpers/presentation";
import { expenseEditorAmount, expenseEditorItems, expenseEditorPreview, expenseUiCounts, expenseUiDecimal,
  expenseUiDocument, expenseUiHeader, expenseUiMileageSetting, expenseUiMinor, expenseUiMoney, expenseDistanceText } from "../lib/money/expense-ui";
import { expenseSummaryDisplay } from "../lib/money/expense-display";
import { recurringExpensePayload, recurringExpensePreview } from "../lib/money/recurring-expense-ui";
import { expenseAmount, expenseCreateSchema, expenseMcpCreateSchema, expenseUpdateSchema } from "../lib/api/expense-wire";
import { ExpenseAmountInput } from "../components/dashboard/expense-amount-input";

const line = (amount = "12.50") => ({ date: "2026-10-11", description: "Travel", amount, category: "Travel", accountId: "",
  receiptFileKey: "", receiptFileName: "" });

test("expense currency-scale text, subminor ties and safe-edge digits agree with both compatible transports", () => {
  for (const [currency, amount, expected] of [["USD", "12.50", 1250n], ["USD", "0.005", 1n], ["JPY", "1250", 1250n],
    ["IRR", "1250", 1250n], ["KWD", "1.250", 1250n], ["USD", "90071992547409.91", 9007199254740991n]] as const) {
    const items = [line(amount)], draft = expenseEditorItems(items, currency, true), preview = expenseEditorPreview(items, currency);
    assert.equal(preview.error, null); assert.equal(preview.total, expected); assert.equal(draft.total, expected);
    for (const [transport, schema] of [["rest", expenseCreateSchema], ["mcp", expenseMcpCreateSchema]] as const) {
      const parsed = schema.parse({ title: "Travel", currencyCode: currency, items: draft.items });
      assert.equal(BigInt(expenseAmount(parsed.items[0], currency, transport)), expected);
    }
    assert.equal(expenseUiDecimal(expected, currency), amount === "0.005" ? "0.01" : amount);
    assert.equal(expenseUiMinor(expenseUiHeader({ currencyCode: currency, totalAmount: Number(expected), totalAmountMinor: String(expected) }), "totalAmount"), expected);
  }
  assert.equal(expenseEditorPreview([line("0.005"), line("0.005")], "USD").total, 2n);
  assert.equal(expenseEditorItems([line("0")], "USD").total, 0n); // Existing edit/REST zero policy.
  assert.throws(() => expenseEditorItems([line("0")], "USD", true));
});

test("mileage extends original exact decimals, metadata retains hundredths and currency minor units per mile", () => {
  const item = { ...line(), isMileage: true, distanceMiles: "1.005", mileageRate: "0.005" };
  const amount = expenseEditorAmount(item, "USD");
  assert.equal(amount.amountMinor, "1"); assert.equal(amount.distanceMiles, 101); assert.equal(amount.mileageRateMinor, "1");
  assert.equal(expenseEditorAmount({ ...item, distanceMiles: "3", mileageRate: "0.005" }, "USD").amountMinor, "2");
  for (const [currency, rate, expected] of [["USD", "0.67", "8040"], ["JPY", "67", "8040"], ["IRR", "67", "8040"], ["KWD", "0.067", "8040"]]) {
    assert.equal(expenseEditorAmount({ ...item, distanceMiles: "120", mileageRate: rate }, currency).amountMinor, expected);
    assert.equal(expenseUiMileageSetting({ currencyCode: currency, mileageRate: 67, mileageRateMinor: "67" }).rate, rate);
  }
  assert.equal(expenseDistanceText(12050), "120.50");
  assert.throws(() => expenseEditorAmount({ ...item, distanceMiles: "21474836.48" }, "USD"));
  assert.throws(() => expenseEditorAmount({ ...item, distanceMiles: "2", mileageRate: "90071992547409.91" }, "USD"));
});

test("malformed, negative, unsupported and aggregate overflow inputs fail before submission; edit identity retains metadata ownership", () => {
  for (const amount of ["", "1e3", "1x", "NaN", "+1", "01", "-0.005", "1.", "90071992547409.92", "1.0000000000000000001"]) {
    assert.ok(expenseEditorPreview([line(amount)], "USD").error, amount);
    assert.throws(() => expenseEditorItems([line(amount)], "USD"), amount);
  }
  assert.ok(expenseEditorPreview([line()], null).error);
  assert.ok(expenseEditorPreview([line()], "BAD").error);
  assert.ok(expenseEditorPreview([line("90071992547409.91"), line("0.01")], "USD").error);
  assert.throws(() => expenseEditorItems([{ ...line(), description: " " }], "USD"));
  assert.throws(() => expenseUiMileageSetting({ currencyCode: "USD", mileageRate: 67, mileageRateMinor: "68" }));
  const edited = expenseEditorItems([{ ...line(), id: randomUUID(), accountId: randomUUID() }], "USD");
  const parsed = expenseUpdateSchema.parse({ items: edited.items }).items![0];
  assert.equal(parsed.id, edited.items[0].id); assert.equal(parsed.accountId, edited.items[0].accountId);
  for (const field of ["taxRateId", "costCenterId", "isMileage", "distanceMiles", "mileageRateMinor"]) assert.ok(!(field in parsed), field);
});

test("saved claim aliases, item totals, rate/distance and count currency are validated without rescaling", () => {
  const item = { amount: 1250, amountMinor: "1250", mileageRate: 67, mileageRateMinor: "67", distanceMiles: 1800, isMileage: true };
  const row = { totalAmount: 1250, totalAmountMinor: "1250", currencyCode: "USD", items: [item] };
  assert.equal(expenseUiDocument(row), row);
  assert.throws(() => expenseUiDocument({ ...row, totalAmount: 0, totalAmountMinor: "0", items: [] }));
  assert.equal(expenseUiMinor({ amount: 1250 }, "amount"), 1250n); // Retained safe numeric-only compatibility.
  for (const patch of [{ totalAmountMinor: "01250" }, { totalAmountMinor: "1251" }, { totalAmount: 1.25 }, { totalAmount: Number.MAX_SAFE_INTEGER + 1 }, { currencyCode: "BAD" }]) assert.throws(() => expenseUiDocument({ ...row, ...patch }));
  for (const patch of [{ amountMinor: "1251" }, { amount: -1 }, { mileageRateMinor: "68" }, { mileageRate: null }, { distanceMiles: 1.5 }, { distanceMiles: null }]) assert.throws(() => expenseUiDocument({ ...row, items: [{ ...item, ...patch }] }));
  assert.throws(() => expenseUiDocument({ ...row, totalAmount: 1251, totalAmountMinor: "1251" }));
  assert.throws(() => expenseUiDocument({ ...row, items: [{ ...item, isMileage: false, mileageRate: null, mileageRateMinor: "0" }] }));
  const counts = { counts: { draft: { amount: 9007199254740991, amountMinor: "9007199254740991", currencyCode: "USD" }, approved: { amount: 9007199254740991, amountMinor: "9007199254740991", currencyCode: "USD" } } };
  expenseUiCounts(counts);
  assert.equal(expenseSummaryDisplay(Object.values(counts.counts)), "$180,143,985,094,819.82");
  assert.equal(expenseSummaryDisplay([{ amountMinor: "1250", currencyCode: "JPY" }, { amountMinor: "1250", currencyCode: "USD" }]), "Multiple currencies");
  assert.throws(() => expenseUiCounts({ counts: { draft: { amount: 1, amountMinor: "2", currencyCode: "USD" } } }));
});

test("recurring expense keeps fixed-two payable prices, supplier/schedule controls and gross policy", () => {
  const lines = [{ description: "Rent", amount: "12.50", accountId: null }];
  const header = { name: "Rent", contactId: randomUUID(), frequency: "monthly", startDate: "2026-10-11", endDate: "2026-11-11", maxOccurrences: "2" };
  for (const currencyCode of ["USD", "JPY", "IRR", "KWD"]) {
    const payload = recurringExpensePayload({ ...header, currencyCode }, lines);
    assert.equal(payload.type, "expense"); assert.equal(payload.currencyCode, currencyCode); assert.equal(payload.maxOccurrences, 2);
    assert.equal(payload.lines[0].unitPriceExact, "12.50"); assert.equal(recurringExpensePreview(lines, currencyCode).total, 1250n);
  }
  assert.equal(recurringExpensePreview([{ ...lines[0], amount: "0.005" }], "USD").total, 1n);
  for (const amount of ["1e3", "1x", "90071992547409.92", "-0.005", ""]) assert.ok(recurringExpensePreview([{ ...lines[0], amount }], "USD").error);
  assert.throws(() => recurringExpensePayload({ ...header, currencyCode: "USD", maxOccurrences: "2x" }, lines));
  assert.throws(() => recurringExpensePayload({ ...header, currencyCode: "USD", endDate: "2026-10-01" }, lines));
});

test("expense English currency labels and exact decimal keyboard inputs retain low digits", () => {
  for (const [currency, amount, text] of [["USD", 9007199254740991n, "$90,071,992,547,409.91"], ["JPY", 1250n, "¥1,250"], ["IRR", 1250n, "IRR 1,250"], ["KWD", 1250n, "KWD 1.250"]] as const) {
    assert.equal(expenseUiMoney(amount, currency), text);
    const markup = renderToStaticMarkup(createElement(ExpenseAmountInput, { currency, value: expenseUiDecimal(amount, currency), onChange: () => {}, label: "Expense amount" }));
    assert.match(markup, /inputMode="decimal"/); assert.match(markup, /aria-label="Expense amount"/); assert.ok(markup.includes(currency)); assert.ok(markup.includes(expenseUiDecimal(amount, currency)));
  }
});
