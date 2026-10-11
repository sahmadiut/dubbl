import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { z } from "zod";
import { customerPrepaymentAmount, customerPrepaymentCurrency, customerPrepaymentRow, customerPrepaymentMoney,
  customerPrepaymentSummary, customerPrepaymentInvoice, customerPrepaymentInvoiceEligible, customerPrepaymentApplication } from "../lib/money/customer-prepayment-ui";
import { customerCreditCreateFields, creditAmount } from "../lib/api/credit-wire";
import { CustomerPrepaymentMoneyDetails } from "../components/dashboard/customer-prepayment-money-details";
import { InvoiceAmountInput } from "../components/dashboard/invoice-amount-input";

const row = (currencyCode = "USD", value = 1250, remaining = value) => ({ currencyCode, status: "open", contactId: "customer",
  originalAmount: value, originalAmountMinor: String(value), amountRemaining: remaining, amountRemainingMinor: String(remaining) });

test("prepayment exact input matches minor-unit wire amounts and currency resolution", () => {
  for (const [currency, text, minor] of [["USD", "12.50", 1250], ["JPY", "1250", 1250], ["IRR", "1250", 1250],
    ["KWD", "1.250", 1250], ["USD", "90071992547409.91", Number.MAX_SAFE_INTEGER], ["KWD", "9007199254740.991", Number.MAX_SAFE_INTEGER]] as const) {
    const payload = customerPrepaymentAmount(text, currency);
    assert.equal(payload.amountMinor, String(minor));
    const parsed = z.object(customerCreditCreateFields).strict().parse({ ...payload, currencyCode: currency, sourceType: "prepayment",
      contactId: "11111111-1111-4111-8111-111111111111", date: "2026-10-11", bankAccountId: "22222222-2222-4222-8222-222222222222" });
    assert.equal(creditAmount(parsed), minor);
  }
  assert.equal(customerPrepaymentCurrency("KWD", "JPY", "IRR"), "KWD");
  assert.equal(customerPrepaymentCurrency(null, "JPY", "IRR"), "JPY");
  assert.equal(customerPrepaymentCurrency(null, null, "IRR"), "IRR");
  assert.equal(customerPrepaymentCurrency(null, null, null), "USD");
  for (const [text, currency] of [["0", "USD"], ["-1", "USD"], ["", "USD"], ["1x", "USD"], ["1e2", "USD"], ["1.2", "JPY"],
    ["1.001", "USD"], ["1.0001", "KWD"], ["90071992547409.92", "USD"], ["9".repeat(41), "USD"]])
    assert.throws(() => customerPrepaymentAmount(text, currency));
});

test("saved prepayments retain low digits, reject invalid aliases/balances, and group currencies", () => {
  const max = customerPrepaymentRow(row("USD", Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER - 1));
  assert.equal(max.originalAmount - max.amountRemaining, 1n);
  for (const invalid of [{ ...row(), originalAmountMinor: "01250" }, { ...row(), amountRemainingMinor: "1251" },
    { ...row(), originalAmount: Number.MAX_SAFE_INTEGER + 1 }, row("USD", 1250, 1251), row("USD", 0), row("USD", 1250, -1), row("BAD")])
    assert.throws(() => customerPrepaymentRow(invalid));
  const totals = customerPrepaymentSummary([max, max, customerPrepaymentRow(row("KWD")), { ...customerPrepaymentRow(row("JPY")), status: "void" }]);
  assert.equal(totals.received, `${customerPrepaymentMoney(1250n, "KWD")} · ${customerPrepaymentMoney(2n * BigInt(Number.MAX_SAFE_INTEGER), "USD")}`);
  assert.ok(totals.remaining.includes(customerPrepaymentMoney(2n * BigInt(Number.MAX_SAFE_INTEGER - 1), "USD")));
  assert.equal(customerPrepaymentSummary([]).received, "—");
});

test("prepayment application requires same customer/currency, outstanding status and both balances", () => {
  const credit = customerPrepaymentRow(row());
  const inv = customerPrepaymentInvoice({ id: "invoice", contactId: "customer", currencyCode: "USD", status: "sent", amountDue: 750, amountDueMinor: "750" });
  assert.equal(customerPrepaymentInvoiceEligible(credit, inv), true);
  assert.deepEqual(customerPrepaymentApplication("7.50", credit, inv), { invoiceId: "invoice", amountMinor: "750" });
  for (const invalid of [{ ...inv, contactId: "other" }, { ...inv, currencyCode: "KWD" }, { ...inv, status: "draft" }, { ...inv, amountDue: 0n }]) {
    assert.equal(customerPrepaymentInvoiceEligible(credit, invalid), false);
    assert.throws(() => customerPrepaymentApplication("1", credit, invalid));
  }
  assert.throws(() => customerPrepaymentApplication("7.51", credit, inv));
  assert.throws(() => customerPrepaymentApplication("7.50", { ...credit, amountRemaining: 749n }, inv));
  assert.throws(() => customerPrepaymentInvoice({ ...inv, amountDue: 750, amountDueMinor: "751" }));
});

test("prepayment saved cards and amount controls render exact English values across scales", () => {
  for (const [currency, text, value] of [["USD", "90071992547409.91", Number.MAX_SAFE_INTEGER], ["KWD", "1.250", 1250], ["JPY", "1250", 1250], ["IRR", "1250", 1250]] as const) {
    const credit = customerPrepaymentRow(row(currency, value, value - 1));
    const markup = renderToStaticMarkup(createElement(CustomerPrepaymentMoneyDetails, { credit }));
    for (const label of ["Original", "Used so far", "Available to use"]) assert.ok(markup.includes(label));
    assert.ok(markup.includes(customerPrepaymentMoney(BigInt(value), currency)));
    assert.ok(markup.includes(customerPrepaymentMoney(1n, currency)));
    assert.match(markup, /break-all/);
    const input = renderToStaticMarkup(createElement(InvoiceAmountInput, { currency, value: text, onChange: () => {} }));
    assert.ok(input.includes(`aria-label="Amount in ${currency}"`)); assert.match(input, /aria-invalid="false"/); assert.ok(input.includes(text));
  }
  const invalid = renderToStaticMarkup(createElement(InvoiceAmountInput, { currency: "JPY", value: "1.2", onChange: () => {} }));
  assert.match(invalid, /role="alert"/); assert.match(invalid, /aria-invalid="true"/);
});
