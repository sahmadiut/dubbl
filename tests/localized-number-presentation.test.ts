import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as jsxRuntime from "react/jsx-runtime";
import ts from "typescript";
import { PresentationProvider } from "../i18n/provider";
import * as presentationProvider from "../i18n/provider";
import { resolvePresentation, type Presentation } from "../i18n/locale";
import { decimalSeparatorsFor, formatDecimalDraft, formatExactDecimal, formatExactMoney, normalizeDecimalDraft } from "../i18n/numbers";
import { DualAmount } from "../components/ui/dual-amount";
import { CurrencyInput } from "../components/ui/currency-input";
import { InvoiceAmountInput } from "../components/dashboard/invoice-amount-input";
import { MAX_MINOR, MIN_MINOR, parseMajor } from "../lib/money/exact";
import { parseLocalizedMajor } from "../lib/money/localized";
import { invoiceUiAmount } from "../lib/money/invoice-ui";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const presentations = (["en-US", "fa-IR"] as const).flatMap(language => (["latn", "arabext"] as const)
  .map(numerals => resolvePresentation({ user: { language, numerals, calendar: "gregory", timeZone: "Asia/Tehran" } })));
const latin = presentations[0], persian = presentations[3];
const unbidi = (text: string) => text.replace(/[\u200e\u200f\u061c]/g, "");

function render(node: React.ReactNode, presentation: Presentation) {
  return renderToStaticMarkup(createElement(PresentationProvider, { presentation,
    messages: presentation.locale === "en-US" ? en : fa, now: new Date("2026-10-24T00:00:00Z") }, node));
}

test("exact decimal presentation retains every digit, signed subunits and trailing zeros", () => {
  assert.equal(formatExactDecimal("9007199254740993.00120", latin), "9,007,199,254,740,993.00120");
  assert.equal(formatExactDecimal("9007199254740993.00120", persian), "۹٬۰۰۷٬۱۹۹٬۲۵۴٬۷۴۰٬۹۹۳٫۰۰۱۲۰");
  assert.equal(unbidi(formatExactDecimal("-0.01", persian)), "−۰٫۰۱");
  assert.equal(formatExactDecimal("-0.01", latin), "-0.01");
  assert.equal(formatExactDecimal("123456789.000", latin, false), "123456789.000");
  const long = `1.${"1234567890".repeat(20)}`;
  assert.equal(formatExactDecimal(long, latin), long);
  for (const bad of ["", "1x", "1e3", "1,000", "۱۲", "+1", ".5", "1.", "1".repeat(257)]) {
    assert.throws(() => formatExactDecimal(bad, latin));
  }
});

test("currency presentation uses exact 0/2/3-place scales and signed int64 limits", () => {
  for (const [currency, amount, expected] of [
    ["USD", MAX_MINOR, "$92,233,720,368,547,758.07"],
    ["KWD", MIN_MINOR, "-KWD 9,223,372,036,854,775.808"],
    ["JPY", 123456789n, "¥123,456,789"], ["IRR", 123456789n, "IRR 123,456,789"],
    ["USD", -1n, "-$0.01"], ["KWD", -1n, "-KWD 0.001"],
  ] as const) assert.equal(formatExactMoney(amount, currency, latin), expected);
  assert.match(formatExactMoney(MAX_MINOR, "USD", persian), /۹۲٬۲۳۳٬۷۲۰٬۳۶۸٬۵۴۷٬۷۵۸٫۰۷/);
  assert.match(formatExactMoney(MIN_MINOR, "KWD", persian), /۹٬۲۲۳٬۳۷۲٬۰۳۶٬۸۵۴٬۷۷۵٫۸۰۸/);
  assert.throws(() => formatExactMoney(MAX_MINOR + 1n, "USD", latin));
  assert.throws(() => formatExactMoney(1n, "IRT", latin));
});

test("numeral preference is independent of language, currency, units and canonical writes", () => {
  const original = Object.freeze({ amountMinor: "123456789", currency: "IRR", date: "2026-10-24", fxRate: "1.000000000000" });
  for (const p of presentations) {
    const separators = decimalSeparatorsFor(p);
    const text = formatDecimalDraft(original.amountMinor, p);
    assert.equal(parseLocalizedMajor(text, original.currency, "reject", separators).amountMinor.toString(), original.amountMinor);
    assert.equal(normalizeDecimalDraft(text, separators, 0), original.amountMinor);
    assert.match(formatExactMoney(123456789n, "IRR", p), p.numerals === "latn" ? /123,456,789/ : /۱۲۳٬۴۵۶٬۷۸۹/);
  }
  assert.equal(JSON.stringify(original), '{"amountMinor":"123456789","currency":"IRR","date":"2026-10-24","fxRate":"1.000000000000"}');
  assert.throws(() => parseMajor("۱۲۳۴۵۶۷۸۹", "IRR", "reject"));
});

test("editing accepts complete localized decimals and deliberate unfinished states only", () => {
  for (const [input, separators, expected] of [
    ["۱۲۳۴۵۶۷۸۹", "ascii", "123456789"], ["١٢٣٤٥٦٧٨٩", "ascii", "123456789"],
    ["-۱٬۲۳۴٫۵۰", "arabic", "-1234.50"], ["+1,234.50", "ascii", "+1234.50"],
    ["٫۵", "arabic", ".5"], ["-٫۵", "arabic", "-.5"], ["١٫", "arabic", "1."],
    ["۱۲٫", "arabic", "12."], ["", "ascii", ""], ["-", "ascii", "-"],
    ["+", "arabic", "+"], [".", "ascii", "."], ["-٫", "arabic", "-."],
  ] as const) assert.equal(normalizeDecimalDraft(input, separators, 2), expected);
  for (const input of ["1۲", "۱٢", "12x", "1e3", " 12", "12 ", "1\u202e2", "1\n", "1,,234", "1,23", "1.234", "--1", "−1"]) {
    assert.throws(() => normalizeDecimalDraft(input, "ascii", 2), Error, input);
  }
  for (const input of ["1.25", "۱٫۲۳۴", "۱٬۲۳", "۱٫٢", "۱٫۲x"]) assert.throws(() => normalizeDecimalDraft(input, "arabic", 2));
  for (const input of ["1.", ".", "1.0"]) assert.throws(() => normalizeDecimalDraft(input, "ascii", 0));
  assert.throws(() => normalizeDecimalDraft("1", "ascii", -1));
  assert.throws(() => normalizeDecimalDraft("1", "ascii", 21));
  assert.throws(() => normalizeDecimalDraft("1".repeat(257), "ascii", 0));
  for (const draft of ["", "-", "+", ".", "-.", "1.", "123.00", "-.5"]) {
    assert.equal(normalizeDecimalDraft(formatDecimalDraft(draft, persian), "arabic", 2), draft);
  }
});

test("actual shared controls render preferred numerals but hidden form money stays canonical", () => {
  for (const p of presentations) {
    const html = render(createElement(CurrencyInput, { value: "90071992547409.91", name: "amount", prefix: "USD", onChange: () => {} }), p);
    assert.match(html, /type="hidden" name="amount" value="90071992547409\.91"/);
    assert.match(html, /dir="ltr" inputMode="decimal"/);
    assert.ok(html.includes(p.numerals === "latn" ? 'value="90071992547409.91"' : 'value="۹۰۰۷۱۹۹۲۵۴۷۴۰۹٫۹۱"'));
    const dual = render(createElement(DualAmount, { amount: MAX_MINOR, currency: "USD", baseCurrency: "KWD", baseAmount: -1n }), p);
    assert.ok(dual.includes(p.numerals === "latn" ? "92,233,720,368,547,758.07" : "۹۲٬۲۳۳٬۷۲۰٬۳۶۸٬۵۴۷٬۷۵۸٫۰۷"));
    assert.match(dual, /<bdi>/);
    const valid = render(createElement(InvoiceAmountInput, { value: "12.50", currency: "USD", onChange: () => {} }), p);
    assert.doesNotMatch(valid, /role="alert"/);
    const invalid = render(createElement(InvoiceAmountInput, { value: "1.1", currency: "IRR", onChange: () => {} }), p);
    assert.match(invalid, /aria-invalid="true"/);
  }
  assert.throws(() => render(createElement(DualAmount, { amount: 9007199254740992, currency: "USD" }), latin));
});

// Render the production control through the real provider. Capture its authored
// input handler via the JSX runtime; no DOM/browser/keyboard claim is made.
function capturedInput(p: Presentation, fractionDigits = 2) {
  const path = resolve("components/ui/currency-input.tsx"), require = createRequire(path);
  let handler: ((event: { target: { value: string } }) => void) | undefined;
  const capture = (factory: typeof jsxRuntime.jsx) => (type: unknown, props: Record<string, unknown>, key?: string) => {
    if (type === "input" && props.type === "text") handler = props.onChange as typeof handler;
    return factory(type as "input", props, key);
  };
  const compiled = { exports: {} as { CurrencyInput: ComponentType<React.ComponentProps<typeof CurrencyInput>> } };
  const load = (id: string) => id === "react/jsx-runtime" ? { ...jsxRuntime, jsx: capture(jsxRuntime.jsx), jsxs: capture(jsxRuntime.jsxs) }
    : id === "@/i18n/provider" ? presentationProvider
    : require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  const code = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  new Function("require", "module", "exports", code)(load, compiled, compiled.exports);
  const writes: string[] = [];
  render(createElement(compiled.exports.CurrencyInput, { value: "", fractionDigits, onChange: v => writes.push(v) }), p);
  assert.ok(handler);
  return { writes, edit: (value: string) => handler!({ target: { value } }) };
}

test("actual input callbacks preserve low digits and reject whole malformed edits before financial validation", () => {
  for (const p of presentations) {
    const control = capturedInput(p);
    control.edit(formatDecimalDraft("90071992547409.91", p));
    assert.deepEqual(control.writes, ["90071992547409.91"]);
    assert.deepEqual(invoiceUiAmount(control.writes[0], "USD"), { amountMinor: "9007199254740991" });
    for (const bad of ["12oops", "1۲", "1e3", "1,23", "\u200f12", "1\n", formatDecimalDraft("1.234", p)]) control.edit(bad);
    assert.equal(control.writes.length, 1);
    control.edit(formatDecimalDraft("1.", p));
    assert.equal(control.writes[1], "1.");
    assert.throws(() => invoiceUiAmount(control.writes[1], "USD"));
  }
  const irr = capturedInput(persian, 0);
  irr.edit("۱۲۳۴۵۶۷۸۹");
  assert.deepEqual(invoiceUiAmount(irr.writes[0], "IRR"), { amountMinor: "123456789" });
  irr.edit("۱٫۱");
  assert.equal(irr.writes.length, 1);
});
