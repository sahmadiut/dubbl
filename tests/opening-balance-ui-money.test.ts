import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { openingBalancePreview, openingBalanceSaved, OPENING_BALANCE_CURRENCY } from "../lib/money/opening-balance-ui";
import { OpeningBalanceForm } from "../components/dashboard/opening-balance-form";
import { OpeningBalanceMoneyDetails } from "../components/dashboard/opening-balance-money-details";

const row = (debit: string, credit = "", accountId = "a") => ({ accountId, debit, credit });
test("opening preview uses exact cents and the same numeric payload, including the safe edge", () => {
  const preview = openingBalancePreview([row("0.10"), row("0.20"), row("", "0.30"), row("", "", "")]);
  assert.equal(preview.isBalanced, true); assert.equal(preview.totalDebit, 30n);
  assert.deepEqual(preview.balances, [
    { accountId: "a", debitAmount: 10, creditAmount: 0 }, { accountId: "a", debitAmount: 20, creditAmount: 0 }, { accountId: "a", debitAmount: 0, creditAmount: 30 },
  ]);
  for (const [text, expected] of [["40000000000000.01", 4000000000000001n], ["90071992547409.91", 9007199254740991n]] as const) {
    const p = openingBalancePreview([row(text), row("", text)]);
    assert.equal(p.isBalanced, true); assert.equal(p.totalDebit, expected);
    assert.equal(BigInt(p.balances[0].debitAmount), expected);
  }
  // Existing contract permits one selected row with both sides.
  assert.equal(openingBalancePreview([row("1", "1"), row("", "", "")]).isBalanced, true);
});
test("opening preview rejects malformed, orphan, fractional, negative, unsafe and imbalanced amounts", () => {
  for (const text of ["1x", "1e2", ".1", "1.", " 1", "1,000", "-1", "0.001", "90071992547409.92"]) {
    const p = openingBalancePreview([row(text), row("", text)]);
    assert.equal(p.isBalanced, false, text); assert.ok(p.error, text); assert.equal(p.balances.length, 0);
  }
  assert.ok(openingBalancePreview([row("1", "", ""), row("", "1")]).error);
  assert.ok(openingBalancePreview([row("90071992547409.91"), row("0.01"), row("", "90071992547409.91"), row("", "0.01")]).error);
  assert.equal(openingBalancePreview([row(""), row("")]).isBalanced, false);
  assert.equal(openingBalancePreview([row("1"), row("", "1.01")]).isBalanced, false);
});
test("opening fixed-cents policy is explicit and saved aliases fail closed", () => {
  assert.equal(OPENING_BALANCE_CURRENCY, "USD");
  // Opening balances have no currency input/alias; neither JPY nor KWD metadata
  // may reinterpret these legacy cents as whole or three-decimal amounts.
  const saved = openingBalanceSaved([{ id: "a", debitAmount: 1250, creditAmount: 0, account: null }]);
  assert.equal(saved.totalDebit, 1250n);
  assert.equal(openingBalanceSaved([
    { id: "a", debitAmount: Number.MAX_SAFE_INTEGER, creditAmount: 0, account: null },
    { id: "b", debitAmount: Number.MAX_SAFE_INTEGER, creditAmount: 0, account: null },
  ]).totalDebit, 18014398509481982n);
  for (const value of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1, NaN]) {
    assert.throws(() => openingBalanceSaved([{ id: "a", debitAmount: value, creditAmount: 0, account: null }]));
  }
  assert.throws(() => openingBalanceSaved([{ id: "a", debitAmount: 1250, debitAmountMinor: "1251", creditAmount: 0, account: null }]));
  assert.throws(() => openingBalanceSaved([{ id: "a", debitAmount: 1250, debitAmountMinor: "01250", creditAmount: 0, account: null }]));
});
test("rendered opening form preserves English layout and gates submission on exact validation", () => {
  const render = (initialRows: ReturnType<typeof row>[]) => renderToStaticMarkup(createElement(OpeningBalanceForm, {
    accounts: [{ id: "a", code: "100", name: "Cash" }], saving: false, onSubmit: () => {}, onCancel: () => {}, initialRows,
  }));
  const valid = render([row("0.10"), row("0.20"), row("", "0.30")]);
  assert.match(valid, /Account balances \(USD\)/); assert.match(valid, /aria-label="Debit for line 1"/);
  assert.match(valid, /aria-label="Credit for line 3"/); assert.match(valid, /inputMode="decimal"/);
  assert.match(valid, /tabular-nums">0\.30<\/span>/);
  assert.doesNotMatch(valid.match(/<button[^>]*type="submit"[^>]*>/)![0], /disabled=""/);
  for (const rows of [[row("1x"), row("", "1")], [row("1", "", ""), row("", "1")]]) {
    const html = render(rows); assert.match(html, /role="alert"/);
    assert.match(html.match(/<button[^>]*type="submit"[^>]*>/)![0], /disabled=""/);
  }
});
test("rendered saved opening balances keep low digits and reject unsafe saved numbers", () => {
  const render = (amount: number) => renderToStaticMarkup(createElement(OpeningBalanceMoneyDetails, { lines: [
    { id: "a", debitAmount: amount, creditAmount: 0, account: { code: "100", name: "Cash" } },
  ] }));
  assert.match(render(4000000000000001), /\$40,000,000,000,000\.01/);
  assert.match(render(Number.MAX_SAFE_INTEGER + 1), /role="alert"/);
});
