import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import * as React from "react";
import { createElement, type ComponentType, type ReactNode } from "react";
import * as nextIntl from "next-intl";
import ts from "typescript";
import * as DatePicker from "../components/ui/date-picker";
import * as AccountPicker from "../components/dashboard/account-picker";
import { budgetMoney, budgetDecimal } from "../lib/money/budget-ui";
import { renderWithPresentation } from "./helpers/presentation";
import { formatDecimalDraft } from "../i18n/numbers";
import { resolvePresentation } from "../i18n/locale";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const root = "app/(dashboard)/accounting";
const layout = `${root}/budgets/[id]/layout.tsx`;
const drawer = "components/dashboard/create-drawer.tsx";
const drawerNames = ["FixedAssetDrawer", "LoanDrawer", "BudgetDrawer", "AccrualScheduleDrawer"] as const;
const noop = () => {};
const amount = 4000000000000001n;
const caller = "<script>Caller & account</script>";
const account = { id: "account-a", name: caller, code: "500", type: "expense" };
const period = { id: "period-a", label: "Jan 2026", startDate: "2026-01-01", endDate: "2026-01-31", amount, sortOrder: 0 };
const line = { id: "line-a", accountId: account.id, account, total: amount, periods: [period] };
const budget = { id: "budget-a", name: caller, periodType: "monthly", startDate: period.startDate, endDate: period.endDate, isActive: true, lines: [line] };
const comparison = { accountId: account.id, accountName: caller, accountCode: account.code, budgeted: amount, actual: 29n, variance: amount - 29n, burnRate: 2n, periods: [{ ...period, budgeted: amount, actual: 29n, variance: amount - 29n }] };
const inline = ({ children }: { children?: ReactNode }) => createElement("div", null, children);

// Compile production modules into one cache so layout and consumers use the
// actual BudgetContext. Only initial state, effects, navigation and portals are
// controlled. No budget context, financial helper or translation is replaced.
function composedBudget(page: "" | "settings", currency: string, state: "populated" | "empty" | "error" = "populated") {
  const cache = new Map<string, { exports: Record<string, ComponentType<Record<string, unknown>>> }>();
  const layoutStates = [currency, state === "error" ? null : state === "empty" ? { ...budget, lines: [] } : budget, state === "empty" ? [] : [comparison], amount, 29n, 2n, 15, 16, 31, [account], state === "error" ? "LOCALIZED-READ-ERROR" : "", false];
  function loadModule(file: string): Record<string, ComponentType<Record<string, unknown>>> {
    const path = resolve(file);
    if (cache.has(path)) return cache.get(path)!.exports;
    const compiled = { exports: {} as Record<string, ComponentType<Record<string, unknown>>> };
    cache.set(path, compiled);
    const require = createRequire(path);
    let index = 0;
    const load = (id: string): unknown => {
      if (id === "react") return { ...React, useState: (initial: unknown) => {
        const i = index++;
        return [path === resolve(layout) && i < layoutStates.length ? layoutStates[i] : typeof initial === "function" ? initial() : initial, noop];
      }, useEffect: noop };
      if (id === "next-intl") return nextIntl;
      if (id === "next/navigation") return { useParams: () => ({ id: budget.id }), useRouter: () => ({ push: noop }), usePathname: () => `/accounting/budgets/${budget.id}/${page}` };
      if (id.endsWith("/use-document-title")) return { useDocumentTitle: noop };
      if (id.endsWith("/use-entity-title")) return { useEntityTitle: noop };
      if (id.endsWith("/use-confirm")) return { useConfirm: () => ({ confirm: noop, dialog: null }) };
      if (id.endsWith("/ui/date-picker")) return DatePicker;
      if (id.endsWith("/account-picker")) return AccountPicker;
      if (id.endsWith("/ui/select")) return new Proxy({}, { get: () => inline });
      if (id.startsWith(".")) return loadModule(resolve(dirname(path), `${id}.tsx`));
      return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
    };
    const code = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
    new Function("require", "module", "exports", code)(load, compiled, compiled.exports);
    return compiled.exports;
  }
  const Layout = loadModule(layout).default;
  const Page = loadModule(`${root}/budgets/[id]/${page ? page + "/" : ""}page.tsx`).default;
  return createElement(Layout, null, createElement(Page));
}

// Keep the four owned production drawers and their shared chrome together,
// filtering unrelated imports/functions without recreating any JSX or labels.
function ownedDrawers(saving: boolean) {
  const source = readFileSync(drawer, "utf8");
  const ast = ts.createSourceFile(drawer, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const names = new Set<string>([...drawerNames, "DrawerFooter", "DrawerIcon", "SectionLabel", "emptyBudgetLine"]);
  const functions = ast.statements.filter(n => ts.isFunctionDeclaration(n) && n.name && names.has(n.name.text));
  const used = new Set<string>();
  function identifiers(n: ts.Node) { if (ts.isIdentifier(n)) used.add(n.text); ts.forEachChild(n, identifiers); }
  functions.forEach(identifiers);
  const selected = ast.statements.flatMap(n => {
    if (functions.includes(n)) return [n.getText(ast)];
    if (ts.isImportDeclaration(n) && n.importClause?.namedBindings && ts.isNamedImports(n.importClause.namedBindings)) {
      const bindings = n.importClause.namedBindings.elements.filter(b => used.has(b.name.text));
      if (bindings.length) return [`import { ${bindings.map(b => b.getText(ast)).join(", ")} } from ${n.moduleSpecifier.getText(ast)};`];
    }
    return [];
  }).join("\n") + `\nexport { ${drawerNames.join(", ")} };`;
  const require = createRequire(resolve(drawer));
  const compiled = { exports: {} as Record<string, ComponentType<Record<string, unknown>>> };
  let states: unknown[] = [], index = 0;
  const load = (id: string): unknown => {
    if (id === "react") return { ...React, useState: (initial: unknown) => [index < states.length ? states[index++] : typeof initial === "function" ? initial() : initial, noop], useEffect: noop };
    if (id === "next-intl") return nextIntl;
    if (id === "next/navigation") return { useRouter: () => ({ push: noop }) };
    if (id.endsWith("/ui/date-picker")) return DatePicker;
    if (id.endsWith("/account-picker")) return AccountPicker;
    if (id.endsWith("/ui/sheet") || id.endsWith("/ui/select")) return new Proxy({}, { get: () => inline });
    return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  };
  const code = ts.transpileModule(selected, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function("require", "module", "exports", code)(load, compiled, compiled.exports);
  return createElement("div", null, drawerNames.map(name => createElement(function OwnedDrawer() {
    states = name === "BudgetDrawer" ? ["USD", saving] : [saving];
    index = 0;
    return createElement(compiled.exports[name], { open: true, onClose: noop });
  }, { key: name })));
}

function contains(html: string, value: string) {
  assert.ok(html.includes(value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;")), value);
}

test("combined budget layout and both pages share real context, catalogs and exact currency amounts", () => {
  for (const locale of ["en-US", "fa-IR"] as const) for (const currency of ["USD", "JPY", "IRR", "KWD"]) for (const page of ["", "settings"] as const) {
    const messages = locale === "en-US" ? en : fa;
    const html = renderWithPresentation(composedBudget(page, currency), locale);
    for (const value of [messages.Budgets.overview, messages.Budgets.settings, messages.Budgets.totalBudget, caller, budget.startDate, budgetMoney(amount, currency, resolvePresentation({ user: { language: locale } })), budgetMoney(29n, currency, resolvePresentation({ user: { language: locale } }))]) contains(html, value);
    assert.ok(!html.includes("<script>") && !html.includes("MISSING_MESSAGE"));
    if (page === "settings") {
      contains(html, messages.Budgets.save);
      contains(html, formatDecimalDraft(budgetDecimal(amount), resolvePresentation({ user: { language: locale } })));
    } else contains(html, messages.Budgets.periodBreakdown);
  }
});

test("composed empty and failed budgets render without admitting stale child context", () => {
  for (const locale of ["en-US", "fa-IR"] as const) {
    const messages = locale === "en-US" ? en : fa;
    contains(renderWithPresentation(composedBudget("", "USD", "empty"), locale), messages.Budgets.noConfiguredLines);
    const error = renderWithPresentation(composedBudget("settings", "USD", "error"), locale);
    contains(error, "LOCALIZED-READ-ERROR");
    contains(error, messages.Budgets.backCapital);
    assert.ok(!error.includes(budgetDecimal(amount)) && !error.includes(caller));
  }
});

test("all four creation drawers use localized shared footer in ready and saving states", () => {
  for (const locale of ["en-US", "fa-IR"] as const) for (const saving of [false, true]) {
    const messages = locale === "en-US" ? en : fa;
    const html = renderWithPresentation(ownedDrawers(saving), locale);
    for (const namespace of ["FixedAssets", "Loans", "Budgets", "Accruals"] as const) {
      contains(html, messages[namespace].cancel);
      contains(html, messages[namespace][saving ? "creating" : "create"]);
    }
    if (saving) assert.equal((html.match(/<button(?=[^>]*type="submit")(?=[^>]*disabled="")[^>]*>/g) ?? []).length, 4);
    if (locale === "fa-IR") assert.ok(!html.includes(">Cancel<") && !html.includes("Creating..."));
    assert.ok(!html.includes("MISSING_MESSAGE"));
  }
});

test("complete assets loans budgets accruals source inventory catalogs authored JSX and visible attributes", () => {
  function files(path: string): string[] {
    return readdirSync(path, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(`${path}/${e.name}`) : e.name.endsWith(".tsx") ? [`${path}/${e.name}`] : []);
  }
  const paths = ["asset-categories", "fixed-assets", "loans", "budgets", "accruals"].flatMap(name => files(`${root}/${name}`));
  assert.equal(paths.length, 11, "Review new routes in the combined inventory");
  for (const path of [...paths, drawer]) {
    const ast = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(n: ts.Node) {
      if (path === drawer && n.parent === ast && !(ts.isFunctionDeclaration(n) && n.name && drawerNames.some(name => name === n.name!.text))) return;
      if (ts.isJsxText(n)) assert.ok(!/[A-Za-z]/.test(n.text), `${path}: ${n.text}`);
      if (ts.isJsxAttribute(n) && ["title", "placeholder", "aria-label", "label", "alt"].includes(n.name.getText(ast)) && n.initializer && ts.isStringLiteral(n.initializer)) {
        // Fixed-asset inventory explicitly preserves this technical ID sample.
        if (path === drawer && n.name.getText(ast) === "placeholder" && n.initializer.text === "FA-001") return;
        assert.ok(!/[A-Za-z]/.test(n.initializer.text), `${path}: ${n.getText(ast)}`);
      }
      ts.forEachChild(n, visit);
    }
    ts.forEachChild(ast, visit);
  }
});
