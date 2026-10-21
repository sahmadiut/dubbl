import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { test } from "node:test";
import { createElement, type ComponentType, type ReactNode } from "react";
import * as jsx from "react/jsx-runtime";
import * as nextIntl from "next-intl";
import ts from "typescript";
import * as brandLoader from "../components/dashboard/brand-loader";
import { renderWithPresentation } from "./helpers/presentation";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const root = "app/(dashboard)/reports", page = `${root}/page.tsx`, shared = `${root}/_components.tsx`;
const destinations = [
  "executive-summary", "profit-and-loss", "balance-sheet", "cash-flow", "pack",
  "tracking", "pnl-comparison", "budget-vs-actual", "expense-analytics", "profitability", "vendor-spend",
  "aged-receivables", "aged-payables", "payment-performance", "duplicate-detection",
  "vat-return", "tax-summary", "1099", "cash-flow-forecast", "financial-calendar", "financial-ratios",
  "trial-balance", "general-ledger", "comparative-balance-sheet", "consolidation",
  "bank-reconciliation-status", "bank-cash-flow", "saved", "schedules",
];
const escaped = (s: string) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
type Capture = { kind: string; props: Record<string, unknown> };
type Locale = "en-US" | "fa-IR";

// Real production JSX, next-intl, Link, Section, Button and tooltip controls.
// Only animation and document-title effects are isolated from server rendering.
function render(file: string, name = "default", props: Record<string, unknown> = {}, locale: Locale = "en-US") {
  const captured: Capture[] = [], titles: string[] = [];
  const require = createRequire(resolve(file)), compiled = { exports: {} as Record<string, ComponentType<Record<string, unknown>>> };
  const capture = (factory: typeof jsx.jsx) => (kind: unknown, value: Record<string, unknown>, key: string) => {
    captured.push({ kind: typeof kind === "string" ? kind : (kind as { name?: string })?.name ?? "", props: value });
    return factory(kind as Parameters<typeof jsx.jsx>[0], value, key);
  };
  const load = (id: string): unknown => {
    if (id === "next-intl") return nextIntl;
    if (id === "react/jsx-runtime") return { ...jsx, jsx: capture(jsx.jsx), jsxs: capture(jsx.jsxs) };
    if (id.endsWith("/brand-loader")) return brandLoader;
    if (id.endsWith("/use-document-title")) return { useDocumentTitle: (v: string) => titles.push(v) };
    if (id.endsWith("/content-reveal")) return { ContentReveal: ({ children }: { children: ReactNode }) => createElement("div", null, children) };
    return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  };
  const source = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function("require", "module", "exports", source)(load, compiled, compiled.exports);
  const html = renderWithPresentation(createElement(compiled.exports[name], props), locale);
  return { captured, titles, html };
}

test("directory renders all 29 canonical report links, seven categories and paired descriptions in both locales", () => {
  for (const locale of ["en-US", "fa-IR"] as const) {
    const messages = locale === "en-US" ? en : fa;
    const h = render(page, "default", {}, locale);
    assert.deepEqual(h.titles, [messages.ReportDirectory.documentTitle]);
    assert.equal((h.html.match(/<section\b/g) ?? []).length, 7);
    const hrefs = [...h.html.matchAll(/href="([^"]+)"/g)].map(m => m[1]);
    assert.deepEqual(hrefs, destinations.map(slug => `/reports/${slug}`));
    for (const [key, value] of Object.entries(messages.ReportDirectory)) if (key !== "documentTitle") assert.ok(h.html.includes(escaped(value)), key);
    assert.ok(!h.html.includes("MISSING_MESSAGE"));
  }
});

test("shared report navigation and basis callbacks retain canonical routes and accrual/cash values", () => {
  for (const locale of ["en-US", "fa-IR"] as const) {
    const messages = locale === "en-US" ? en : fa;
    const back = render(shared, "BackToReports", {}, locale);
    assert.ok(back.html.includes('href="/reports"') && back.html.includes(escaped(messages.ReportNavigation.backToReports)));
    for (const basis of ["accrual", "cash"] as const) {
      const events: string[] = [];
      const h = render(shared, "BasisToggle", { basis, onChange: (value: string) => events.push(value) }, locale);
      assert.ok(h.html.includes(escaped(messages.ReportNavigation.basisPrompt)));
      for (const value of ["accrual", "cash"] as const) {
        const label = messages.ReportNavigation[value === "accrual" ? "accrualLabel" : "cashLabel"];
        const button = h.captured.find(c => c.kind === "Button" && c.props.children === label);
        assert.ok(button);
        assert.equal(button.props.variant, value === basis ? "default" : "outline");
        assert.equal(button.props.className?.toString().includes("bg-emerald-600"), value === basis);
        (button.props.onClick as () => void)();
        const help = messages.ReportNavigation[value === "accrual" ? "accrualHelp" : "cashHelp"];
        assert.ok(h.captured.some(c => c.kind === "TooltipContent" && c.props.children === help));
        assert.ok(h.html.includes(escaped(label)));
      }
      assert.deepEqual(events, ["accrual", "cash"]);
    }
  }
});

test("shared help escapes caller content and loading retains the shared localized accessible name", () => {
  const caller = '<script>Caller & "report"</script>';
  for (const locale of ["en-US", "fa-IR"] as const) {
    const messages = locale === "en-US" ? en : fa;
    const help = render(shared, "ReportHelp", { children: caller }, locale);
    assert.ok(help.html.includes(escaped(caller)) && !help.html.includes("<script>"));
    const loading = render(`${root}/loading.tsx`, "default", {}, locale);
    assert.ok(loading.html.includes(`aria-label="${escaped(messages.SharedUI.loading2)}"`));
  }
});

test("report directory/shared catalogs pair 79 Persian messages and contain no residual authored JSX", () => {
  for (const namespace of ["ReportDirectory", "ReportNavigation"] as const) {
    assert.deepEqual(Object.keys(en[namespace]).sort(), Object.keys(fa[namespace]).sort());
    for (const [key, value] of Object.entries(fa[namespace])) assert.match(value, /[\u0600-\u06ff]/u, `${namespace}.${key}`);
  }
  assert.equal(Object.keys(en.ReportDirectory).length + Object.keys(en.ReportNavigation).length, 79);
  for (const file of [page, shared, `${root}/loading.tsx`]) {
    const ast = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function audit(n: ts.Node) {
      if (ts.isJsxText(n)) assert.doesNotMatch(n.text, /[A-Za-z]/, `${file}: ${n.text}`);
      if (ts.isJsxAttribute(n) && ["title", "description", "placeholder", "aria-label", "alt"].includes(n.name.getText(ast)) && n.initializer && ts.isStringLiteral(n.initializer)) assert.doesNotMatch(n.initializer.text, /[A-Za-z]/);
      if (ts.isCallExpression(n) && n.expression.getText(ast) === "useDocumentTitle") assert.ok(!n.arguments.some(ts.isStringLiteral));
      ts.forEachChild(n, audit);
    }
    audit(ast);
  }
});
