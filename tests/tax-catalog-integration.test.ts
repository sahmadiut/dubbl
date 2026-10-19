import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { createElement, type ComponentType, type ReactNode } from "react";
import * as React from "react";
import * as nextIntl from "next-intl";
import ts from "typescript";
import * as BrandLoader from "../components/dashboard/brand-loader";
import * as AccountPicker from "../components/dashboard/account-picker";
import * as CurrencySelect from "../components/ui/currency-select";
import * as DateRangeFilter from "../components/dashboard/date-range-filter";
import * as ExportButton from "../components/dashboard/export-button";
import * as SettlementPreview from "../components/dashboard/tax-settlement-preview";
import { taxUiMoney } from "../lib/money/tax-ui";
import { renderWithPresentation } from "./helpers/presentation";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const root = "app/(dashboard)/tax";
const noop = () => {};
const caller = '<script>\u0645\u0627\u0644\u06cc\u0627\u062a & reference</script>';
const escape = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
const period = { id: "period-a", name: caller, startDate: "2026-01-01", endDate: "2026-03-31", type: "quarterly", status: "filed", filedAt: "2026-04-02T00:00:00Z", filedReference: caller, notes: caller };
const codeCache = new Map<string, string>();

// Compose actual route templates, tax layout, TabLayout and shared controls.
// Only own hook state/effects, navigation and sheet portals are controlled.
function loaded(file: string, states: unknown[], pathname: string, exported = "default") {
  const require = createRequire(resolve(file));
  let index = 0;
  const inline = ({ children, open }: { children: ReactNode; open?: boolean }) => open === false ? null : createElement("div", null, children);
  const load = (id: string): unknown => {
    if (id === "react") return { ...React, useState: (initial: unknown) => { const i = index++; return [i < states.length ? states[i] : typeof initial === "function" ? initial() : initial, noop]; }, useEffect: noop, useCallback: (fn: unknown) => fn };
    if (id === "next-intl") return nextIntl;
    if (id === "next/navigation") return { usePathname: () => pathname, useRouter: () => ({ push: noop }) };
    if (id.endsWith("/use-document-title")) return { useDocumentTitle: noop };
    if (id.endsWith("/use-entity-title")) return { useEntityTitle: noop };
    const shared = { "brand-loader": BrandLoader, "account-picker": AccountPicker, "currency-select": CurrencySelect, "date-range-filter": DateRangeFilter, "export-button": ExportButton, "tax-settlement-preview": SettlementPreview };
    for (const [name, module] of Object.entries(shared)) if (id.endsWith(`/${name}`)) return module;
    if (id.endsWith("/ui/sheet")) return Object.fromEntries(["Sheet", "SheetContent", "SheetHeader", "SheetTitle", "SheetTrigger", "SheetFooter"].map(key => [key, inline]));
    if (id.endsWith("/tab-layout")) return compile("components/dashboard/tab-layout.tsx");
    return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  };
  function compile(path: string, extra = "") {
    const compiled = { exports: {} as Record<string, ComponentType<Record<string, unknown>>> };
    const key = path + extra;
    let code = codeCache.get(key);
    if (!code) {
      code = ts.transpileModule(readFileSync(path, "utf8") + extra, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
      codeCache.set(key, code);
    }
    new Function("require", "module", "exports", code)(load, compiled, compiled.exports);
    return compiled.exports;
  }
  return compile(file, exported === "default" ? "" : `\nexport { ${exported} };`)[exported];
}

function specs(currency: string, amount: bigint) {
  const dates = ["2026-01-01", "2026-03-31"];
  return [
    { route: "", country: "IR", ns: "TaxRates", states: [[{ id: "rate-a", name: caller, rate: 1250, type: "sales", isDefault: true }], false, false, null], key: "title" },
    { route: "currencies", country: "IR", ns: "TaxCurrencies", exported: "CurrenciesWorkspace", states: [[{ id: "currency-a", code: currency, name: caller, symbol: currency, decimalPlaces: currency === "KWD" ? 3 : currency === "JPY" ? 0 : 2 }], [], currency, false, false, "", false, false, true, false, { defaultCurrency: currency, summary: { totalItems: 1, missingRateItems: 0, totalUnrealizedGain: amount, totalUnrealizedLoss: 0n, netUnrealizedGainLoss: amount }, items: [{ id: "invoice-a", type: "invoice", number: caller, currencyCode: currency, amountDue: amount, unrealizedGainLoss: amount }] }], key: "title" },
    { route: "periods", country: "GB", ns: "TaxPeriods", states: [[period], false, false, null], key: "title" },
    { route: "periods/[id]", pathname: "/tax/periods/period-a", country: "GB", ns: "TaxPeriods", exported: "TaxPeriodWorkspace", states: [{ ...period, lines: [{ id: "line-a", boxNumber: "5", label: caller, amount, sourceDescription: caller, sortOrder: 1 }] }, false, false, currency, null], key: "settleTitle" },
    { route: "vat-return", country: "GB", ns: "VatReturn", exported: "VatReturnPageWorkspace", states: [...dates, "accrual", "14.5", false, [{ box: "5", label: caller, amount }], false, currency, null, null, {}, null], key: "title" },
    { route: "bas", country: "AU", ns: "BasReport", exported: "BasPageWorkspace", states: [...dates, [{ field: "NET", label: caller, amount }], false, currency, null], key: "title" },
    { route: "sales-tax", country: "US", ns: "SalesTaxReport", exported: "SalesTaxPageWorkspace", states: [...dates, [{ taxRateName: caller, taxRatePercent: 1250, taxableAmount: amount, taxCollected: amount, invoiceCount: 2 }], 0n, false, currency, null], key: "title" },
    { route: "schedule-c", country: "US", ns: "ScheduleCReport", exported: "ScheduleCPageWorkspace", states: [...dates, [{ line: "31", label: caller, amount }], amount, 0n, amount, false, currency, null], key: "title" },
  ] as const;
}

test("all eight tax pages compose with real bilingual navigation and exact currency amounts", () => {
  for (const locale of ["en-US", "fa-IR"] as const) for (const currency of ["USD", "JPY", "KWD"]) for (const amount of [0n, -1250n, 9007199254740991n]) {
    const messages = locale === "en-US" ? en : fa;
    for (const spec of specs(currency, amount)) {
      const pathname = "pathname" in spec ? spec.pathname : `/tax${spec.route ? `/${spec.route}` : ""}`;
      const Layout = loaded(`${root}/layout.tsx`, [spec.country, 2], pathname);
      const Page = loaded(`${root}/${spec.route ? `${spec.route}/` : ""}page.tsx`, [...spec.states], pathname, "exported" in spec ? spec.exported : "default");
      const html = renderWithPresentation(createElement(Layout, null, createElement(Page, { orgId: "org-a", id: period.id })), locale);
      assert.ok(html.includes(escape((messages[spec.ns] as Record<string, string>)[spec.key])), spec.route);
      if (spec.route === "periods/[id]") assert.ok(!html.includes("<nav"), "detail hides tax tabs");
      else {
        for (const [path, key] of [["", "rates"], ["currencies", "currencies"], ["periods", "periods"]] as const) {
          assert.ok(html.includes(`href="/tax${path ? `/${path}` : ""}"`));
          assert.ok(html.includes(escape(messages.TaxNavigation[key])));
        }
        const active = html.match(/<a\b[^>]*class="[^"]*border-foreground[^\"]*"[^>]*>/g) ?? [];
        assert.equal(active.length, 1, pathname);
        assert.ok(active[0].includes(`href="${pathname}"`), pathname);
        for (const [country, key, route] of [["GB", "vatReturn", "vat-return"], ["AU", "bas", "bas"], ["US", "salesTax", "sales-tax"], ["US", "scheduleC", "schedule-c"]] as const) {
          const visible: boolean = spec.country === country;
          assert.equal(html.includes(`href="/tax/${route}"`), visible, route);
          if (visible) assert.ok(html.includes(escape(messages.TaxNavigation[key])));
        }
      }
      if (!["", "periods", "bas", "vat-return"].includes(spec.route)) assert.ok(html.includes(escape(caller)), spec.route);
      assert.ok(!html.includes("<script>"), spec.route);
      if (!["", "periods"].includes(spec.route)) assert.ok(html.includes(escape(taxUiMoney(amount < 0n && ["bas", "schedule-c", "vat-return"].includes(spec.route) ? -amount : amount, currency))), `${spec.route}/${currency}/${amount}`);
    }
  }
});

test("settlement preview shares the tax layout locale while preserving exact decimal scales", () => {
  for (const locale of ["en-US", "fa-IR"] as const) for (const [currency, amount, minor] of [["USD", "12.50", 1250n], ["JPY", "1250", 1250n], ["KWD", "1.250", 1250n]] as const) {
    for (const input of [amount, "", "invalid"]) {
      const Layout = loaded(`${root}/layout.tsx`, ["GB", 1], "/tax/periods");
      const html = renderWithPresentation(createElement(Layout, null, createElement(SettlementPreview.TaxSettlementPreview, { currency, amount: input })), locale);
      const messages = locale === "en-US" ? en : fa;
      if (input === amount) assert.ok(html.includes('role="status"') && html.includes(escape(taxUiMoney(minor, currency))));
      else assert.ok(html.includes('role="alert"') && html.includes(escape(messages.TaxPeriods[input === "" ? "enterAmount" : "invalidAmount"])));
    }
  }
});

test("combined tax inventory pins all routes and rejects uncataloged authored display copy", () => {
  function files(dir: string): string[] { return readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(`${dir}/${entry.name}`) : entry.name.endsWith(".tsx") ? [`${dir}/${entry.name}`] : []); }
  const routes = files(root).sort();
  assert.deepEqual(routes, ["bas/page.tsx", "currencies/page.tsx", "layout.tsx", "page.tsx", "periods/[id]/page.tsx", "periods/page.tsx", "sales-tax/page.tsx", "schedule-c/page.tsx", "vat-return/page.tsx"].map(path => `${root}/${path}`).sort());
  for (const path of [...routes, "components/dashboard/tax-settlement-preview.tsx"]) {
    const ast = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(node: ts.Node) {
      if (ts.isJsxText(node)) assert.match(node.text.trim(), /^(|%|#|G1-G11, 1A-1B)$/, `${path}: ${node.text.trim()}`);
      if (ts.isJsxAttribute(node) && ["title", "description", "placeholder", "aria-label", "alt"].includes(node.name.getText(ast)) && node.initializer && ts.isStringLiteral(node.initializer)) assert.match(node.initializer.text, /^\d+(\.\d+)?$/, path);
      if (ts.isCallExpression(node) && node.expression.getText(ast) === "useDocumentTitle") assert.ok(!node.arguments.some(ts.isStringLiteral), path);
      ts.forEachChild(node, visit);
    }
    visit(ast);
  }
  const namespaces = ["TaxNavigation", "TaxRates", "TaxCurrencies", "TaxPeriods", "VatReturn", "BasReport", "SalesTaxReport", "ScheduleCReport"] as const;
  assert.equal(namespaces.reduce((sum, ns) => sum + Object.keys(en[ns]).length, 0), 345);
  for (const ns of namespaces) {
    assert.deepEqual(Object.keys(en[ns]).sort(), Object.keys(fa[ns]).sort());
    for (const value of Object.values(fa[ns])) assert.match(value, /[\u0600-\u06ff]/);
  }
});
