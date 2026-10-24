import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import * as React from "react";
import { createElement, type ComponentType, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import * as nextIntl from "next-intl";
import { PresentationProvider } from "../i18n/provider";
import { resolvePresentation, type Presentation } from "../i18n/locale";
import * as currencyHooks from "../i18n/use-currency";
import { currencyLabel, currencyPrefix, currencyPartsText } from "../i18n/currency-labels";
import { PERSIAN_CURRENCY_NAMES } from "../i18n/currency-names";
import { CURRENCY_SCALES } from "../lib/money/scales";
import { getIsoCurrencies } from "../lib/currency/iso4217";
import { MAX_MINOR, MIN_MINOR } from "../lib/money/exact";
import { formatExactMoney } from "../i18n/numbers";
import { CurrencyInput } from "../components/ui/currency-input";
import { DualAmount } from "../components/ui/dual-amount";
import type { CurrencySelect } from "../components/ui/currency-select";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const presentations = (["en-US", "fa-IR"] as const).flatMap(language => (["latn", "arabext"] as const)
  .map(numerals => resolvePresentation({ user: { language, numerals } })));
function render(node: ReactNode, presentation: Presentation) {
  return renderToStaticMarkup(createElement(PresentationProvider, { presentation,
    messages: presentation.locale === "en-US" ? en : fa, now: new Date("2026-10-24T00:00:00Z") }, node));
}

test("all supported currencies have static Persian names, with owner IRR and safe unknown fallback", () => {
  for (const code of new Set([...Object.keys(CURRENCY_SCALES), ...getIsoCurrencies().map(row => row.code)])) {
    assert.ok(Object.hasOwn(PERSIAN_CURRENCY_NAMES, code), code);
    assert.match(currencyLabel(code, "fa-IR"), /[\u0600-\u06ff]/u, code);
    assert.equal(currencyLabel(code, "en-US"), code);
  }
  assert.equal(currencyLabel("IRR", "fa-IR", "Iranian Rial"), "ریال");
  assert.equal(currencyLabel("USD", "fa-IR"), "دلار");
  assert.equal(currencyLabel("USD", "en-US", "Saved reference"), "Saved reference");
  for (const code of ["ZZZ", "toString", "__proto__", "<script>&", "irr", ""]) {
    assert.equal(currencyLabel(code, "fa-IR"), code);
    assert.equal(currencyPrefix(code, "fa-IR"), code);
  }
  for (const prefix of ["$", "%", "Fixed two", "caller & data"]) assert.equal(currencyPrefix(prefix, "fa-IR"), prefix);
});

test("exact currency names depend on language alone and preserve all numeric parts and scales", () => {
  for (const p of presentations) for (const code of ["IRR", "USD", "JPY", "KWD"]) {
    for (const amount of [0n, -1n, MAX_MINOR, MIN_MINOR]) {
      const text = formatExactMoney(amount, code, p);
      if (p.locale === "fa-IR") assert.ok(text.includes(currencyLabel(code, p.locale)), `${code}: ${text}`);
      const scale = CURRENCY_SCALES[code], magnitude = amount < 0n ? -amount : amount;
      const fraction = (magnitude % 10n ** BigInt(scale)).toString().padStart(scale, "0");
      const expected = p.numerals === "arabext" ? fraction.replace(/\d/g, n => "۰۱۲۳۴۵۶۷۸۹"[Number(n)]) : fraction;
      if (scale) assert.ok(text.includes((p.numerals === "arabext" ? "٫" : ".") + expected), text);
      else assert.doesNotMatch(text, /[.٫]/);
    }
  }
  assert.equal(formatExactMoney(-1n, "USD", presentations[0]), "-$0.01");
  assert.equal(formatExactMoney(MAX_MINOR, "USD", presentations[0]), "$92,233,720,368,547,758.07");
  const parts: Intl.NumberFormatPart[] = [{ type: "currency", value: "$" }, { type: "integer", value: "9007199254740993" }, { type: "decimal", value: "." }, { type: "fraction", value: "01" }];
  assert.equal(currencyPartsText(parts, "USD", "fa-IR"), "دلار\u00a09007199254740993.01");
  assert.equal(currencyPartsText(parts, "USD", "en-US"), "$9007199254740993.01");
  assert.equal(parts[0].value, "$");
});

test("actual inputs and dual totals localize unit names, escape callers and preserve hidden values", () => {
  for (const p of presentations) {
    const input = render(createElement(CurrencyInput, { value: "123456789", prefix: "IRR", name: "amount", fractionDigits: 0, onChange: () => {} }), p);
    assert.ok(input.includes(`<bdi>${p.locale === "fa-IR" ? "ریال" : "IRR"}</bdi>`));
    assert.match(input, /type="hidden" name="amount" value="123456789"/);
    const total = render(createElement(DualAmount, { amount: MAX_MINOR, currency: "IRR", baseCurrency: "KWD", baseAmount: -1n }), p);
    assert.ok(total.includes(currencyLabel("IRR", p.locale)) && total.includes(currencyLabel("KWD", p.locale)));
    const missing = render(createElement(DualAmount, { amount: 0n, currency: "USD", baseCurrency: "IRR" }), p);
    assert.ok(missing.includes(`≈ — ${currencyLabel("IRR", p.locale)}`));
    const escaped = render(createElement(CurrencyInput, { value: "0", prefix: "<script>&", onChange: () => {} }), p);
    assert.ok(escaped.includes("&lt;script&gt;&amp;") && !escaped.includes("<script>"));
  }
});

const referenceCurrencies = [
  { id: "irr", code: "IRR", name: "Iranian Rial", symbol: "IRR", decimalPlaces: 0 },
  { id: "usd", code: "USD", name: "US Dollar", symbol: "$", decimalPlaces: 2 },
  { id: "unknown", code: "ZZZ", name: "<script>& saved", symbol: "", decimalPlaces: 2 },
];
type Item = { value: string; onSelect: () => void; disabled: boolean; children: ReactNode };

// Real authored picker templates/callbacks and provider; inline portals/command
// items to inspect search terms and callbacks without claiming browser filtering.
function picker() {
  const path = resolve("components/ui/currency-select.tsx"), require = createRequire(path);
  const compiled = { exports: {} as { CurrencySelect: typeof CurrencySelect } };
  const items: Item[] = [];
  let state = 0;
  const inline = ({ children }: { children: ReactNode }) => createElement("div", null, children);
  const load = (id: string) => {
    if (id === "react") return { ...React, useState: () => (++state % 2 === 1 ? [true, () => {}] : [referenceCurrencies, () => {}]), useEffect: () => {} };
    if (id === "@/i18n/use-currency") return currencyHooks;
    if (id === "next-intl") return nextIntl;
    if (id.endsWith("/popover")) return { Popover: inline, PopoverContent: inline, PopoverTrigger: inline };
    if (id.endsWith("/command")) return { Command: inline, CommandEmpty: inline, CommandGroup: inline, CommandInput: inline,
      CommandList: inline, CommandItem: (props: Item) => { items.push(props); return inline(props); } };
    return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  };
  const code = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  new Function("require", "module", "exports", code)(load, compiled, compiled.exports);
  return { Component: compiled.exports.CurrencySelect as ComponentType<React.ComponentProps<typeof CurrencySelect>>, items };
}

test("actual full/compact picker search names, accessible labels and callbacks keep canonical ISO values", () => {
  for (const p of presentations) for (const compact of [false, true]) {
    const { Component, items } = picker(), values: string[] = [];
    const html = render(createElement(Component, { value: "IRR", compact, onValueChange: value => values.push(value), disabledCodes: ["USD"] }), p);
    assert.ok(html.includes(`aria-label="${p.locale === "fa-IR" ? "ریال" : "Iranian Rial"}"`));
    assert.ok(html.includes(p.locale === "fa-IR" ? "ریال" : "IRR"));
    assert.ok(items[0].value.includes("IRR") && items[0].value.includes("Iranian Rial"));
    if (p.locale === "fa-IR") assert.ok(items[0].value.includes("ریال"));
    items[0].onSelect(); items[1].onSelect(); items[2].onSelect();
    assert.deepEqual(values, ["IRR", "ZZZ"]);
    assert.equal(items[1].disabled, true);
    if (p.locale === "en-US") assert.ok(html.includes("&lt;script&gt;&amp; saved"));
    assert.ok(!html.includes("<script>"));
  }
  assert.equal(referenceCurrencies[0].name, "Iranian Rial");
});
