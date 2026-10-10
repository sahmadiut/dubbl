import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EntryForm } from "../components/dashboard/entry-form";
import { CurrencyInput } from "../components/ui/currency-input";

function submitButton(html: string) {
  const button = html.match(/<button[^>]*type="submit"[^>]*>/)?.[0];
  assert.ok(button);
  return button;
}

function render(lines: { accountId: string; description: string; debit: string; credit: string }[]) {
  return renderToStaticMarkup(createElement(EntryForm, {
    accounts: [{ id: "a", code: "100", name: "Cash" }], onSubmit: () => {}, onCancel: () => {},
    initial: { date: "2026-10-11", description: "UI test", reference: "", lines },
  }));
}
test("rendered journal form shows exact totals and enables only valid balanced submission", () => {
  const row = (debit: string, credit: string) => ({ accountId: "a", description: "", debit, credit });
  const valid = render([row("0.10", ""), row("0.20", ""), row("", "0.30")]);
  assert.match(valid, /aria-label="Debit for line 1"/);
  assert.match(valid, /aria-label="Credit for line 3"/);
  assert.match(valid, /tabular-nums">0\.30<\/span>/);
  assert.doesNotMatch(submitButton(valid), /disabled=""/);
  const invalid = render([row("1x", ""), row("", "1")]);
  assert.match(invalid, /role="alert"/); assert.match(submitButton(invalid), /disabled=""/);
  const unbalanced = render([row("1", ""), row("", "1.01")]);
  assert.match(submitButton(unbalanced), /disabled=""/);
  const orphan = render([{ ...row("1", ""), accountId: "" }, row("", "1")]);
  assert.match(orphan, /Select an account for every amount/); assert.match(submitButton(orphan), /disabled=""/);
});

test("currency input keeps text values, keyboard decimal mode and accessible labels", () => {
  const html = renderToStaticMarkup(createElement(CurrencyInput, {
    value: "9007199254740.991", fractionDigits: 3, prefix: "KWD", "aria-label": "Debit amount", onChange: () => {},
  }));
  assert.match(html, /type="text"/); assert.match(html, /inputMode="decimal"/);
  assert.match(html, /value="9007199254740\.991"/); assert.match(html, /aria-label="Debit amount"/);
});
