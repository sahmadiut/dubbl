import { catalogText } from "./helpers/catalog-text";
import { resolvePresentation } from "../i18n/locale";
import { displayNumberFixture } from "./helpers/localized-fixtures";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import * as React from "react";
import { createElement, type ComponentType, type ReactNode } from "react";
import * as nextIntl from "next-intl";
import ts from "typescript";
import { payrollOverviewJson } from "../i18n/payroll-overview-presentation";
import { payrollMoneyDisplay } from "../lib/money/payroll-display";
import { renderWithPresentation } from "./helpers/presentation";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const root = "app/(dashboard)/payroll";
const drawer = "components/dashboard/create-drawer.tsx";
const drawers = ["EmployeeDrawer", "ContractorDrawer"];
const namespaces = ["PayrollOverview", "PayrollEmployees", "PayrollEmployeeDetail", "PayrollContractors", "PayrollRuns", "PayrollRunDetail", "PayrollOutputs", "PayrollTimeLeave", "PayrollTimeDetail", "PayrollSelfService", "PayrollCompensation", "PayrollAnalytics", "PayrollTaxLiabilities", "PayrollSettings"] as const;
const noop = () => {};
const caller = "<script>Caller & employee</script>";
const escaped = (s: string) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
const employee = { id: "employee-a", name: caller, employeeNumber: "EMP-001", position: null, salary: 9007199254740991, salaryMinor: "9007199254740991", currency: "KWD", payFrequency: "monthly", isActive: true };
type States = Record<string, Record<string, unknown>>;

// Link production layout, page, TabLayout and drawer chrome under the same real
// translation provider. Hooks/IO and portal boundaries are controlled; this is
// composition verification, not a mounted browser or an independent reviewer.
function composition(pathname: string, states: States = {}) {
  const cache = new Map<string, Record<string, ComponentType<Record<string, unknown>>>>();
  const actions: string[] = [];
  function load(file: string) {
    const path = resolve(file);
    if (cache.has(path)) return cache.get(path)!;
    const ast = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let source = ast.text;
    if (file === drawer) {
      const functions = ast.statements.filter(n => ts.isFunctionDeclaration(n) && n.name && [...drawers, "DrawerFooter", "DrawerIcon", "SectionLabel"].includes(n.name.text));
      const used = new Set<string>();
      function identifiers(n: ts.Node) { if (ts.isIdentifier(n)) used.add(n.text); ts.forEachChild(n, identifiers); }
      functions.forEach(identifiers);
      source = ast.statements.flatMap(n => {
        if (functions.includes(n)) return [n.getText(ast)];
        if (ts.isImportDeclaration(n) && n.importClause?.namedBindings && ts.isNamedImports(n.importClause.namedBindings)) {
          const bindings = n.importClause.namedBindings.elements.filter(b => used.has(b.name.text));
          if (bindings.length) return [`import { ${bindings.map(b => b.getText(ast)).join(", ")} } from ${n.moduleSpecifier.getText(ast)};`];
        }
        return [];
      }).join("\n") + `\nexport { ${drawers.join(", ")} };`;
    }
    const parsed = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const hooks: string[] = [];
    function inspect(n: ts.Node) {
      if (ts.isVariableDeclaration(n) && ts.isArrayBindingPattern(n.name) && n.initializer && ts.isCallExpression(n.initializer) && n.initializer.expression.getText(parsed) === "useState") hooks.push(n.name.elements[0].getText(parsed));
      ts.forEachChild(n, inspect);
    }
    inspect(parsed);
    const drawerHooks = new Map<string, string[]>();
    if (file === drawer) for (const n of parsed.statements) if (ts.isFunctionDeclaration(n) && n.name && drawers.includes(n.name.text)) {
      hooks.length = 0; inspect(n); drawerHooks.set(n.name.text, [...hooks]);
    }
    let index = 0, activeHooks = hooks;
    const overrides = states[file] ?? {};
    const inline = () => function Inline({ children, ...props }: { children?: ReactNode; [key: string]: unknown }) {
      return createElement("div", null, children, typeof props.placeholder === "string" ? createElement("span", null, props.placeholder) : null);
    };
    const require = createRequire(path);
    const compiled = { exports: {} as Record<string, ComponentType<Record<string, unknown>>> };
    const dependency = (id: string): unknown => {
      if (id === "react") return { ...React, useState: (initial: unknown) => {
        const key = activeHooks[index++];
        return [Object.hasOwn(overrides, key) ? overrides[key] : typeof initial === "function" ? initial() : initial, noop];
      }, useEffect: noop };
      if (id === "next-intl") return nextIntl;
      if (id === "next/navigation") return { usePathname: () => pathname, useRouter: () => ({ push: (v: string) => actions.push(v) }) };
      if (id.endsWith("/use-document-title")) return { useDocumentTitle: noop };
      if (id.endsWith("/use-debounce")) return { useDebounce: (v: unknown) => v };
      if (id.endsWith("/create-drawer")) return { useCreateDrawer: () => ({ open: (v: string) => actions.push(v) }) };
      if (id.endsWith("/tab-layout")) return load("components/dashboard/tab-layout.tsx");
      if (["/ui/sheet", "/ui/select", "/ui/tabs", "/ui/date-picker", "/ui/currency-select"].some(s => id.endsWith(s))) return new Proxy({}, { get: () => inline() });
      return require(id.startsWith("@/") ? resolve(id.slice(2)) : id.startsWith(".") ? resolve(dirname(path), id) : id);
    };
    const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    new Function("require", "module", "exports", code)(dependency, compiled, compiled.exports);
    for (const [name, keys] of drawerHooks) {
      const Original = compiled.exports[name];
      compiled.exports[name] = (props: Record<string, unknown>) => { index = 0; activeHooks = keys; return createElement(Original, props); };
    }
    cache.set(path, compiled.exports);
    return compiled.exports;
  }
  return { load, actions };
}

test("combined payroll pairs all 1,045 messages and names every Persian exception", () => {
  const exceptions = new Map([
    ["PayrollRuns.employeeOption", "{name} · {currency}"],
    ["PayrollRunDetail.employeeOption", "{name} ({number})"],
    ["PayrollOutputs.formType_1099_nec", "1099-NEC"],
    ["PayrollOutputs.formType_w2", "W-2"],
    ["PayrollOutputs.formType_1099_misc", "1099-MISC"],
    ["PayrollCompensation.adjustment", "+{percent}٪"],
  ]);
  let count = 0;
  assert.deepEqual(Object.keys(en).filter(n => n.startsWith("Payroll")), [...namespaces]);
  for (const namespace of namespaces) {
    assert.deepEqual(Object.keys(en[namespace]), Object.keys(fa[namespace]));
    count += Object.keys(en[namespace]).length;
    for (const [key, value] of Object.entries(fa[namespace])) {
      const exception = exceptions.get(`${namespace}.${key}`);
      if (exception) assert.equal(catalogText(value), exception);
      else assert.match(value, /[\u0600-\u06ff]/u, `${namespace}.${key}`);
    }
  }
  assert.equal(count, 1045);
});

test("one checked employee composes payroll overview, employee list and self-service with exact salary", async () => {
  const checked = (await payrollOverviewJson(Response.json({ data: [employee] }), "employees")).data[0];
  for (const locale of ["en-US", "fa-IR"] as const) {
    const messages = locale === "en-US" ? en : fa;
    for (const [route, state, label] of [
      ["page.tsx", { employees: [checked] }, messages.PayrollOverview.recentRuns],
      ["employees/page.tsx", { employees: [checked] }, messages.PayrollEmployees.active],
      ["self-service/page.tsx", { profile: { ...checked, position: caller, ptoBalanceHours: 1.5 }, payslips: [{ id: "slip-a", employeeId: checked.id, grossAmount: checked.salary, grossAmountMinor: checked.salaryMinor, netAmount: checked.salary, netAmountMinor: checked.salaryMinor, currency: checked.currency, generatedAt: "2026-10-21T00:00:00Z", payrollRun: { payPeriodStart: "2026-10-01", payPeriodEnd: "2026-10-31" } }] }, messages.PayrollSelfService.employeeNumber],
    ] as const) {
      const pathname = route === "page.tsx" ? "/payroll" : `/payroll/${route.split("/")[0]}`;
      const { load } = composition(pathname, { [`${root}/${route}`]: { loading: false, ...state } });
      const Layout = load(`${root}/layout.tsx`).default, Page = load(`${root}/${route}`).default;
      const html = renderWithPresentation(createElement(Layout, null, createElement(Page)), locale);
      assert.ok(html.includes(escaped(label)), route);
      if (route !== "page.tsx") {
        assert.ok(html.includes(escaped(caller)) && !html.includes("<script>"), route);
        assert.ok(html.includes(escaped(payrollMoneyDisplay(checked.salary, checked.currency ?? "USD", resolvePresentation({ user: { language: locale } })))), route);
      }
      assert.ok(!html.includes("MISSING_MESSAGE"));
      if (route !== "self-service/page.tsx") assert.ok(html.includes('href="/payroll/settings"'));
    }
  }
});

test("both creation drawers share translated chrome and preserve high and low cent inputs", () => {
  for (const locale of ["en-US", "fa-IR"] as const) for (const saving of [false, true]) for (const name of drawers) {
    const messages = locale === "en-US" ? en : fa;
    const { load } = composition("/payroll", { [drawer]: { saving, empName: caller, salary: "90071992547409.91", cName: caller, cRate: "0.29" } });
    const Drawer = load(drawer)[name];
    const html = renderWithPresentation(createElement(Drawer, { open: true, onClose: noop }), locale);
    assert.ok(html.includes(escaped(caller)) && !html.includes("<script>"));
    assert.ok(html.includes(`value="${displayNumberFixture(name === "EmployeeDrawer" ? "90071992547409.91" : "0.29", locale)}"`));
    assert.ok(html.includes(escaped(messages.DocumentForms.cancel)));
    assert.equal(/<button(?=[^>]*type="submit")(?=[^>]*disabled="")/.test(html), saving);
    assert.ok(!html.includes("MISSING_MESSAGE"));
  }
});

test("payroll layout retains canonical navigation while a failed employee read hides saved data", () => {
  for (const locale of ["en-US", "fa-IR"] as const) {
    const messages = locale === "en-US" ? en : fa;
    const { load } = composition("/payroll/employees", { [`${root}/employees/page.tsx`]: { loading: false, employees: [employee], moneyError: "readFailed" } });
    const Layout = load(`${root}/layout.tsx`).default, Page = load(`${root}/employees/page.tsx`).default;
    const html = renderWithPresentation(createElement(Layout, null, createElement(Page)), locale);
    for (const route of ["", "/employees", "/runs", "/tax-liabilities", "/time-leave", "/contractors", "/compensation", "/analytics", "/settings"]) assert.ok(html.includes(`href="/payroll${route}"`));
    assert.ok(html.includes('role="alert"') && html.includes(escaped(messages.PayrollEmployees.readFailed)));
    assert.ok(!html.includes(escaped(caller)) && !html.includes(displayNumberFixture("90071992547409.91", locale)));
  }
});

test("combined source audit pins all 27 payroll components and both drawer bodies", () => {
  function files(path: string): string[] { return readdirSync(path, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(`${path}/${e.name}`) : e.name.endsWith(".tsx") ? [`${path}/${e.name}`] : []); }
  const routes = files(root);
  assert.deepEqual(routes.map(p => p.slice(root.length + 1)).sort(), ["analytics/page.tsx", "compensation/page.tsx", "compensation/reviews/[id]/page.tsx", "contractors/page.tsx", "contractors/[id]/page.tsx", "employees/page.tsx", "employees/[id]/page.tsx", "forecasting/page.tsx", "layout.tsx", "leave/page.tsx", "leave/[id]/page.tsx", "loading.tsx", "page.tsx", "reports/page.tsx", "reports/[type]/page.tsx", "runs/page.tsx", "runs/off-cycle-dialog.tsx", "runs/[id]/page.tsx", "runs/[id]/payslips/page.tsx", "self-service/page.tsx", "settings/page.tsx", "tax-forms/page.tsx", "tax-forms/[id]/page.tsx", "tax-liabilities/page.tsx", "time-leave/page.tsx", "timesheets/page.tsx", "timesheets/[id]/page.tsx"].sort());
  for (const path of [...routes, drawer]) {
    const ast = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const owners = path === drawer ? ast.statements.filter(n => ts.isFunctionDeclaration(n) && n.name && [...drawers, "DrawerFooter", "SectionLabel"].includes(n.name.text)) : [ast];
    function audit(n: ts.Node) {
      if (ts.isJsxText(n)) {
        const copy = n.text.trim().replace(/&(?:rarr|middot|ndash|mdash|infin);/g, "");
        assert.ok(!/[A-Za-z]/.test(copy), `${path}: ${copy}`);
      }
      if (ts.isJsxAttribute(n) && ["title", "description", "placeholder", "aria-label", "alt", "label", "emptyMessage"].includes(n.name.getText(ast)) && n.initializer && ts.isStringLiteral(n.initializer)) assert.ok(!/[A-Za-z]/.test(n.initializer.text) || path === drawer && ["EMP-001", "john@example.com", "jane@example.com"].includes(n.initializer.text), `${path}: ${n.getText(ast)}`);
      if (ts.isCallExpression(n) && /^(toast\.(success|error)|useDocumentTitle)$/.test(n.expression.getText(ast))) assert.ok(!n.arguments.some(ts.isStringLiteral), `${path}: ${n.getText(ast)}`);
      ts.forEachChild(n, audit);
    }
    owners.forEach(audit);
  }
});
