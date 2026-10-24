import { resolvePresentation } from "../i18n/locale";
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { createElement, type ComponentType } from "react";
import * as React from "react";
import * as jsx from "react/jsx-runtime";
import * as nextIntl from "next-intl";
import { createTranslator } from "next-intl";
import ts from "typescript";
import * as BrandLoader from "../components/dashboard/brand-loader";
import { payrollOverviewJson, payrollOverviewStatuses } from "../i18n/payroll-overview-presentation";
import { payrollGroupedDisplay, payrollShare } from "../lib/money/payroll-ui";
import { payrollMoneyDisplay } from "../lib/money/payroll-display";
import { renderWithPresentation } from "./helpers/presentation";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const page = "app/(dashboard)/payroll/page.tsx";
const layout = "app/(dashboard)/payroll/layout.tsx";
const locales = ["en-US", "fa-IR"] as const;
const employee = { id: "employee-a", name: "<script>caller & name</script>", employeeNumber: "EMP-001", position: null,
  salary: 9007199254740991, salaryMinor: "9007199254740991", currency: "USD", payFrequency: "monthly", isActive: true };
const run = { id: "run-a", payPeriodStart: "2026-10-01", payPeriodEnd: "2026-10-31", status: "completed",
  totalGross: 9007199254740991, totalGrossMinor: "9007199254740991", totalDeductions: 29, totalDeductionsMinor: "29",
  totalNet: 9007199254740962, totalNetMinor: "9007199254740962", baseCurrency: "USD" };
const escape = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
const translator = (locale: typeof locales[number]) => createTranslator({ locale, messages: locale === "en-US" ? en : fa, namespace: "PayrollOverview" });
type Capture = { kind: unknown; props: Record<string, unknown> };
type Harness = { captured: Capture[]; events: unknown[]; effects: (() => void | (() => void))[] };

// Real production JSX, next-intl, money helpers and controls; only hook/IO state
// is controlled. Compile TabLayout too so its pathname hook uses this boundary.
function loaded(file = page, states: Record<string, unknown> = {}, harness: Harness = { captured: [], events: [], effects: [] }, pathname = "/payroll") {
  const source = readFileSync(file, "utf8");
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const names: string[] = [];
  function visit(n: ts.Node) {
    if (ts.isVariableDeclaration(n) && ts.isArrayBindingPattern(n.name) && n.initializer && ts.isCallExpression(n.initializer) && n.initializer.expression.getText(ast) === "useState") names.push(n.name.elements[0].getText(ast));
    ts.forEachChild(n, visit);
  }
  visit(ast);
  let index = 0;
  const require = createRequire(resolve(file)), compiled = { exports: {} as Record<string, ComponentType<Record<string, unknown>>> };
  function capture(factory: typeof jsx.jsx) {
    return (kind: unknown, props: Record<string, unknown>, key: string) => {
      harness.captured.push({ kind, props });
      return factory(kind as Parameters<typeof jsx.jsx>[0], props, key);
    };
  }
  const load = (id: string): unknown => {
    if (id === "react") return { ...React, useState: (initial: unknown) => {
      const key = names[index++];
      return [Object.hasOwn(states, key) ? states[key] : initial, (value: unknown) => harness.events.push([key, value])];
    }, useEffect: (effect: () => void | (() => void)) => harness.effects.push(effect) };
    if (id === "react/jsx-runtime") return { ...jsx, jsx: capture(jsx.jsx), jsxs: capture(jsx.jsxs) };
    if (id === "next-intl") return nextIntl;
    if (id.endsWith("/brand-loader")) return BrandLoader;
    if (id === "next/navigation") return { usePathname: () => pathname, useRouter: () => ({ push: (path: string) => harness.events.push(["push", path]) }) };
    if (id.endsWith("/create-drawer")) return { useCreateDrawer: () => ({ open: (kind: string) => harness.events.push(["drawer", kind]) }) };
    if (id.endsWith("/use-document-title")) return { useDocumentTitle: (value: string) => harness.events.push(["title", value]) };
    if (id.endsWith("/tab-layout")) return { TabLayout: loaded("components/dashboard/tab-layout.tsx", states, harness, pathname) };
    return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  };
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function("require", "module", "exports", code)(load, compiled, compiled.exports);
  return compiled.exports.default ?? compiled.exports.TabLayout;
}
function render(states: Record<string, unknown>, locale: typeof locales[number] = "en-US", file = page, pathname?: string) {
  const harness: Harness = { captured: [], events: [], effects: [] };
  const Component = loaded(file, states, harness, pathname);
  const html = renderWithPresentation(createElement(Component, null, createElement("p", null, "Caller <content>")), locale);
  return { ...harness, html };
}
const flush = async () => { for (let i = 0; i < 6; i++) await new Promise(resolve => setImmediate(resolve)); };

test("payroll overview renders complete bilingual setup, steps and document title", () => {
  for (const locale of locales) {
    const t = translator(locale), view = render({ loading: false }, locale);
    for (const key of ["activeEmployees", "monthlyCost", "lastTakeHome", "paidThisYear", "setup", "setupHelp", "addEmployees", "runPayroll", "trackPayments", "addFirstEmployee", "recentRuns"] as const)
      assert.ok(view.html.includes(escape(t(key))), key);
    assert.ok(view.events.some(v => JSON.stringify(v) === JSON.stringify(["title", t("documentTitle")])));
    const actions = view.captured.filter(c => typeof c.props.onClick === "function");
    assert.equal(actions.length, 1);
    (actions[0].props.onClick as () => void)();
    assert.deepEqual(view.events.at(-1), ["drawer", "employee"]);
  }
});

test("payroll overview renders every finite run status, period and exact monetary summary", () => {
  for (const locale of locales) for (const currency of ["USD", "JPY", "KWD"]) {
    const employees = [employee, { ...employee, id: "employee-b" }, { ...employee, id: "employee-c", salary: 29, salaryMinor: "29", currency: "JPY" }, { ...employee, isActive: false }];
    const runs = payrollOverviewStatuses.map((status, i) => ({ ...run, id: `run-${i}`, status, baseCurrency: currency }));
    const view = render({ loading: false, employees, runs }, locale), t = translator(locale);
    for (const key of ["overview", "activeEmployees", "monthlyPayrollCost", "paidThisYear", "unfinished", "recentRuns", "viewAll", "beforeAndTakeHome", "breakdown", "takeHome", "taxesDeductions", "totalBefore", "quickActions", "newRun", "addEmployee", "draft", "processing", "completed", "void", "pendingApproval"] as const)
      assert.ok(view.html.includes(escape(t(key))), key);
    assert.ok(view.html.includes(escape(t("period", { start: run.payPeriodStart, end: run.payPeriodEnd }))));
    assert.ok(view.html.includes(escape(payrollMoneyDisplay(run.totalNet, currency, resolvePresentation({ user: { language: locale } })))));
    const monthly = payrollGroupedDisplay(employees.filter(e => e.isActive).map(e => ({ amount: e.salary, currency: e.currency })), 12n, resolvePresentation({ user: { language: locale } }));
    assert.ok(view.html.includes(escape(monthly)));
    assert.ok(view.html.includes(escape(payrollGroupedDisplay([{ amount: run.totalNet, currency }], 1n, resolvePresentation({ user: { language: locale } })))));
    assert.ok(!view.html.includes("<script>") && !view.html.includes(employee.name)); // Names are not overview output.
    const actions = view.captured.filter(c => typeof c.props.onClick === "function");
    for (const c of actions) (c.props.onClick as () => void)();
    assert.deepEqual(view.events.slice(1), [["push", "/payroll/runs"], ...runs.map(r => ["push", `/payroll/runs/${r.id}`]), ["push", "/payroll/runs"], ["drawer", "employee"]]);
    const widths = view.captured.map(c => c.props.animate as { width?: string } | undefined).filter(v => v?.width).map(v => v!.width);
    assert.deepEqual(widths, [`${payrollShare(BigInt(run.totalNet), BigInt(run.totalGross))}%`, `${payrollShare(29n, BigInt(run.totalGross))}%`]);
  }
});

test("employee-only payroll, loading and translated error states remain distinct", () => {
  for (const locale of locales) {
    const t = translator(locale), view = render({ loading: false, employees: [employee] }, locale);
    for (const key of ["noRuns", "noRunsHelp", "firstRunHelp"] as const) assert.ok(view.html.includes(escape(t(key))));
    for (const moneyError of ["readFailed", "organizationRequired"] as const) {
      const error = render({ loading: false, moneyError }, locale);
      assert.ok(error.html.includes('role="alert"') && error.html.includes(escape(t(moneyError))));
      assert.ok(!error.html.includes(escape(t("setup"))));
    }
    assert.ok(!render({ loading: true }, locale).html.includes(escape(t("setup"))));
  }
});

test("real payroll navigation retains canonical routes, exact overview and detail hiding", () => {
  const routes = ["/payroll", "/payroll/employees", "/payroll/runs", "/payroll/tax-liabilities", "/payroll/time-leave", "/payroll/contractors", "/payroll/compensation", "/payroll/analytics", "/payroll/settings"];
  for (const locale of locales) {
    const view = render({}, locale, layout), t = translator(locale);
    for (const key of ["overview", "employees", "runs", "taxLiabilities", "taxLiabilitiesHelp", "timeLeave", "contractors", "compensation", "analytics", "settings"] as const) assert.ok(view.html.includes(escape(t(key))), key);
    for (const href of routes) assert.ok(view.html.includes(`href="${href}"`));
    assert.ok(view.html.includes("Caller &lt;content&gt;"));
    const tabs = view.captured.find(c => Array.isArray(c.props.tabs))!.props.tabs as { href: string; exact?: boolean }[];
    assert.deepEqual(tabs.map(t => t.href), routes);
    assert.equal(tabs[0].exact, true);
    assert.ok(!render({}, locale, layout, "/payroll/runs/run-a").html.includes("<nav"));
  }
});

test("overview reader accepts canonical legacy cents and signed correction totals without mutation", async () => {
  for (const currency of ["USD", "JPY", "KWD", null]) {
    const employees = { data: [{ ...employee, currency }] };
    assert.deepEqual(await payrollOverviewJson(Response.json(employees), "employees"), employees);
    for (const status of payrollOverviewStatuses) {
      const runs = { data: [{ ...run, status, baseCurrency: currency, totalGross: -29, totalGrossMinor: "-29" }] };
      assert.deepEqual(await payrollOverviewJson(Response.json(runs), "runs"), runs);
    }
  }
});

test("overview reader rejects HTTP, JSON, envelope, required fields and conflicting money before adoption", async () => {
  await assert.rejects(payrollOverviewJson(Response.json({ data: [employee] }, { status: 403 }), "employees"));
  await assert.rejects(payrollOverviewJson(new Response("not json"), "runs"));
  for (const body of [null, [], {}, { data: {} }, { data: [null] }, { data: ["row"] }]) {
    await assert.rejects(payrollOverviewJson(Response.json(body), "employees"));
    await assert.rejects(payrollOverviewJson(Response.json(body), "runs"));
  }
  for (const patch of [{ salary: undefined, salaryMinor: undefined }, { salaryMinor: undefined }, { salaryMinor: "029" }, { salaryMinor: "29" }, { salary: -1, salaryMinor: "-1" }, { salary: Number.MAX_SAFE_INTEGER + 1, salaryMinor: "9007199254740992" }, { currency: undefined }, { currency: "usd" }, { isActive: null }, { payFrequency: "fortnightly" }, { position: 42 }, { id: null }])
    await assert.rejects(payrollOverviewJson(Response.json({ data: [{ ...employee, ...patch }] }), "employees"));
  for (const patch of [{ totalGross: undefined, totalGrossMinor: undefined }, { totalNet: null, totalNetMinor: null }, { totalDeductionsMinor: "28" }, { status: "<script>unknown</script>" }, { baseCurrency: undefined }, { payPeriodStart: "2026-02-30" }, { payPeriodEnd: "0000-01-01" }, { payPeriodEnd: "2026-10-01T00:00:00Z" }])
    await assert.rejects(payrollOverviewJson(Response.json({ data: [{ ...run, ...patch }] }), "runs"));
});

async function withIO(org: string | null, fetcher: typeof fetch, check: () => Promise<void>, storageThrows = false) {
  const originalFetch = globalThis.fetch, storage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  globalThis.fetch = fetcher;
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: (key: string) => { assert.equal(key, "activeOrgId"); if (storageThrows) throw new Error("Storage unavailable"); return org; } } });
  try { await check(); } finally {
    globalThis.fetch = originalFetch;
    if (storage) Object.defineProperty(globalThis, "localStorage", storage); else Reflect.deleteProperty(globalThis, "localStorage");
  }
}

test("overview read effect preserves routes/header and adopts both verified lists together", async () => {
  const requests: unknown[] = [];
  await withIO("org-a", async (url, init) => {
    requests.push([url, init]);
    return Response.json({ data: url.toString().endsWith("employees") ? [employee] : [run] });
  }, async () => {
    const view = render({}); view.effects[0](); await flush();
    assert.deepEqual(requests, ["employees", "runs"].map(kind => [`/api/v1/payroll/${kind}`, { headers: { "x-organization-id": "org-a" } }]));
    assert.deepEqual(view.events.slice(1), [["employees", [employee]], ["runs", [run]], ["loading", false]]);
  });
});

test("overview read failures never adopt a partial list or expose transport/parser prose", async () => {
  for (const mode of ["http", "json", "money", "envelope", "network"]) {
    await withIO("org-a", async url => {
      if (url.toString().endsWith("employees")) return Response.json({ data: [employee] });
      if (mode === "http") return Response.json({ error: "<script>private server text</script>" }, { status: 500 });
      if (mode === "json") return new Response("private parser text");
      if (mode === "money") return Response.json({ data: [{ ...run, totalNetMinor: "1" }] });
      if (mode === "envelope") return Response.json({ error: "private text" });
      throw new Error("private network text");
    }, async () => {
      const view = render({}); view.effects[0](); await flush();
      assert.deepEqual(view.events.slice(1), [["moneyError", "readFailed"], ["loading", false]], mode);
    });
  }
});

test("missing organization and unavailable storage release loading without issuing reads", async () => {
  for (const throws of [false, true]) await withIO(null, async () => { throw new Error("Unexpected fetch"); }, async () => {
    const view = render({}); view.effects[0](); await flush();
    assert.deepEqual(view.events.slice(1), [["moneyError", throws ? "readFailed" : "organizationRequired"], ["loading", false]]);
  }, throws);
});

test("effect cleanup suppresses late list success and failure after unmount", async () => {
  for (const fail of [false, true]) {
    const pending: { resolve: (r: Response) => void; reject: (e: Error) => void }[] = [];
    await withIO("org-a", () => new Promise((resolve, reject) => pending.push({ resolve, reject })), async () => {
      const view = render({}); const cleanup = view.effects[0](); assert.equal(typeof cleanup, "function");
      (cleanup as () => void)();
      if (fail) pending.forEach(p => p.reject(new Error("late failure")));
      else { pending[0].resolve(Response.json({ data: [employee] })); pending[1].resolve(Response.json({ data: [run] })); }
      await flush(); assert.equal(view.events.length, 1);
    });
  }
});

test("overview source has no authored JSX copy and paired Persian messages contain real script", () => {
  for (const file of [page, layout]) {
    const ast = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(n: ts.Node) {
      if (ts.isJsxText(n)) assert.doesNotMatch(n.text, /[A-Za-z]/, n.text.trim());
      if (ts.isJsxAttribute(n) && ["title", "placeholder", "aria-label"].includes(n.name.getText(ast)) && n.initializer && ts.isStringLiteral(n.initializer)) assert.fail(n.getText(ast));
      ts.forEachChild(n, visit);
    }
    visit(ast);
  }
  assert.deepEqual(Object.keys(en.PayrollOverview), Object.keys(fa.PayrollOverview));
  for (const value of Object.values(fa.PayrollOverview)) assert.match(value, /[\u0600-\u06ff]/);
  const source = readFileSync(page, "utf8");
  assert.doesNotMatch(source, /error\.message|data\.error|Number\(|parseFloat\(|\.json\(\)/);
  for (const key of ["payrollGroupedDisplay", "payrollShare", 'status === "completed"', 'status === "draft"', "runs.slice(0, 5)"]) assert.ok(source.includes(key));
});
