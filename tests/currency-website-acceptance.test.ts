import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import * as React from "react";
import * as nextIntl from "next-intl";
import ts from "typescript";
import { renderToStaticMarkup } from "react-dom/server";
import { PresentationProvider, usePresentation } from "../i18n/provider";
import { resolvePresentation, type Presentation } from "../i18n/locale";
import { currencyLabel } from "../i18n/currency-labels";
import { formatExactMoney } from "../i18n/numbers";
import { CurrencyInput } from "../components/ui/currency-input";
import { DualAmount } from "../components/ui/dual-amount";
import { payrollMoneyDisplay } from "../lib/money/payroll-display";
import { statementMoneyText } from "../lib/reports/statement-money";
import { OpeningBalanceForm } from "../components/dashboard/opening-balance-form";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const preferences = (["fa-IR", "en-US"] as const).flatMap(language =>
  (["latn", "arabext"] as const).map(numerals => resolvePresentation({ user: { language, numerals } })));
const org = { id: "org-iso", name: "<script>& caller</script>", slug: "caller-slug", role: "owner", memberCount: 2,
  defaultCurrency: "IRR", createdAt: "2026-10-24T00:00:00Z", plan: "free" };
function render(node: React.ReactNode, presentation: Presentation) {
  return renderToStaticMarkup(React.createElement(PresentationProvider, { presentation,
    messages: presentation.locale === "fa-IR" ? fa : en, now: new Date("2026-10-24T00:00:00Z") }, node));
}

// Execute real shell/list templates and hooks with page IO/state controlled. Inline
// portal/animation boundaries expose their authored content; no browser pass is claimed.
function organizationView(file: string, state: unknown[]) {
  const require = createRequire(resolve(file));
  const compiled = { exports: {} as { default?: React.ComponentType; OrgSwitcher?: React.ComponentType } };
  let index = 0;
  const writes: unknown[] = [], selections: { onClick?: () => void }[] = [];
  const inline = ({ children }: { children?: React.ReactNode }) => React.createElement("div", null, children);
  const load = (id: string): unknown => {
    if (id === "react") return { ...React, useState: (initial: unknown) => [index < state.length ? state[index++] : initial, (value: unknown) => writes.push(value)], useEffect: () => {} };
    if (id === "next-intl") return nextIntl;
    if (id === "@/i18n/provider") return { usePresentation };
    if (id === "@/i18n/currency-labels") return { currencyLabel };
    if (id === "@/i18n/organization-client") return { setActiveOrganization: (id: unknown) => writes.push(id) };
    if (id === "next/link") return { __esModule: true, default: ({ children, href }: { children: React.ReactNode; href: string }) => React.createElement("a", { href }, children) };
    if (id.endsWith("/use-debounce")) return { useDebounce: (value: unknown) => value };
    if (id.endsWith("/content-reveal")) return { ContentReveal: inline };
    if (id.endsWith("/search-input")) return { SearchInput: ({ value, placeholder }: { value: string; placeholder: string }) => React.createElement("input", { value, placeholder, readOnly: true }) };
    if (id.endsWith("/dropdown-menu")) return { DropdownMenu: inline, DropdownMenuContent: inline, DropdownMenuTrigger: inline,
      DropdownMenuItem: (props: { children: React.ReactNode; onClick?: () => void }) => { selections.push(props); return inline(props); } };
    if (id.endsWith("/select")) return Object.fromEntries(["Select", "SelectContent", "SelectItem", "SelectTrigger", "SelectValue"].map(name => [name, inline]));
    return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  };
  const code = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  new Function("require", "module", "exports", code)(load, compiled, compiled.exports);
  return { Component: (compiled.exports.default ?? compiled.exports.OrgSwitcher)!, selections, writes };
}

test("whole-site audit repair: organization shell/list metadata follows language without mutating org ISO or routes", () => {
  for (const presentation of preferences) {
    for (const [file, state] of [
      ["components/dashboard/org-switcher.tsx", [[org], org]],
      ["app/(admin)/admin/organizations/page.tsx", [[org], false, "", "all", "all", "all", "created", false]],
    ] as const) {
      const view = organizationView(file, [...state]);
      const html = render(React.createElement(view.Component), presentation);
      assert.ok(html.includes(`<bdi>${presentation.locale === "fa-IR" ? "ریال" : "IRR"}</bdi>`), file);
      assert.ok(html.includes("&lt;script&gt;&amp; caller&lt;/script&gt;"));
      assert.ok(!html.includes("<script>"));
      if (file.startsWith("app/")) assert.ok(html.includes('href="/admin/organizations/org-iso"'));
      assert.deepEqual(view.writes, []);
    }
    assert.equal(org.defaultCurrency, "IRR");
    assert.equal(org.id, "org-iso");
  }
});

test("actual admin organization header localizes metadata independently of frozen subscription UI", () => {
  const file = "app/(admin)/admin/organizations/[id]/page.tsx";
  const ast = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let header: ts.JsxElement | undefined;
  function visit(node: ts.Node) {
    if (ts.isJsxElement(node) && node.openingElement.tagName.getText(ast) === "p" &&
      node.getText(ast).includes("org.slug") && node.getText(ast).includes("org.defaultCurrency")) header = node;
    ts.forEachChild(node, visit);
  }
  visit(ast); assert.ok(header);
  const jsx = ts.transpileModule(`const View = () => (${header.getText(ast)});`, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  const require = createRequire(import.meta.url);
  for (const presentation of preferences) {
    const t = nextIntl.createTranslator({ locale: presentation.locale, messages: presentation.locale === "fa-IR" ? fa : en, namespace: "Admin" });
    const View = new Function("require", "exports", "org", "presentation", "currencyLabel", "t", `${jsx};return View;`)(require, {}, org, presentation, currencyLabel, t);
    const html = render(React.createElement(View), presentation);
    assert.ok(html.includes(`<bdi>${presentation.locale === "fa-IR" ? "ریال" : "IRR"}</bdi>`));
    assert.ok(html.includes("caller-slug"));
    assert.equal(org.defaultCurrency, "IRR");
  }
});

test("fixed-USD catalog labels use the language name while technical import-code help remains ISO", () => {
  for (const presentation of preferences) {
    const messages = presentation.locale === "fa-IR" ? fa : en;
    const expected = presentation.locale === "fa-IR" ? "دلار" : "USD";
    for (const label of [messages.Journals.accountBalances, messages.RecurringInvoices.currencyHint, messages.InventoryItems.writeDownAmount]) {
      assert.ok(label.includes(expected));
      if (presentation.locale === "fa-IR") assert.ok(!label.includes("USD"));
    }
    const html = render(React.createElement(OpeningBalanceForm, { accounts: [], saving: false,
      onCancel: () => {}, onSubmit: () => {} }), presentation);
    assert.ok(html.includes(messages.Journals.accountBalances));
    assert.ok(messages.SettingsImportExport.currencyDefaultUSD.includes("USD"));
  }
});

test("independent combined acceptance retains ISO scales, exact low digits, legacy cents and default output across language switching", () => {
  const expected = { IRR: { unit: "ریال", end: "807", scale: 0 }, USD: { unit: "دلار", end: ".07", scale: 2 },
    JPY: { unit: "ین ژاپن", end: "807", scale: 0 }, KWD: { unit: "دینار کویت", end: ".807", scale: 3 } };
  const digits = (text: string, presentation: Presentation) => presentation.numerals === "arabext"
    ? text.replace(/[0-9]/g, n => "۰۱۲۳۴۵۶۷۸۹"[Number(n)]).replace(".", "٫") : text;
  const saved = Object.keys(expected).map(currency => ({ currency, amountMinor: "9223372036854775807" }));
  const outputBefore = saved.map(row => statementMoneyText(BigInt(row.amountMinor), row.currency));
  for (const presentation of preferences) for (const row of saved) {
    const contract = expected[row.currency as keyof typeof expected];
    const text = formatExactMoney(BigInt(row.amountMinor), row.currency, presentation);
    assert.ok(text.includes(digits(contract.end, presentation)), `${row.currency}: ${text}`);
    if (presentation.locale === "fa-IR") assert.ok(text.includes(contract.unit));
    for (const amount of [0n, -1n]) {
      const value = formatExactMoney(amount, row.currency, presentation);
      if (contract.scale) assert.ok(value.includes(digits(amount < 0 ? "." + "0".repeat(contract.scale - 1) + "1" : "." + "0".repeat(contract.scale), presentation)));
      else assert.doesNotMatch(value, /[.٫]/);
    }
    const legacy = payrollMoneyDisplay(-1n, row.currency, presentation);
    assert.ok(legacy.includes(digits(".01", presentation)), legacy);
    const markup = render(React.createElement(React.Fragment, null,
      React.createElement(CurrencyInput, { value: "123", prefix: row.currency, name: "amount", fractionDigits: contract.scale, onChange: () => {} }),
      React.createElement(DualAmount, { amount: -1n, currency: row.currency, baseCurrency: "IRR", baseAmount: 0n })), presentation);
    assert.ok(markup.includes('type="hidden" name="amount" value="123"'));
    if (presentation.locale === "fa-IR") assert.ok(markup.includes(contract.unit) && markup.includes("ریال"));
  }
  assert.deepEqual(saved, Object.keys(expected).map(currency => ({ currency, amountMinor: "9223372036854775807" })));
  assert.deepEqual(saved.map(row => statementMoneyText(BigInt(row.amountMinor), row.currency)), outputBefore);
  assert.equal(formatExactMoney(-1n, "USD", preferences.find(p => p.locale === "en-US" && p.numerals === "latn")!), "-$0.01");
});
