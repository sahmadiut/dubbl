import { resolvePresentation } from "../i18n/locale";
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { createElement, type ComponentType, type ReactNode } from "react";
import * as React from "react";
import * as jsx from "react/jsx-runtime";
import * as nextIntl from "next-intl";
import { createTranslator } from "next-intl";
import ts from "typescript";
import * as BrandLoader from "../components/dashboard/brand-loader";
import { payrollAnalyticsJson, summaryFields } from "../i18n/payroll-analytics-presentation";
import { payrollMoneyDisplay } from "../lib/money/payroll-display";
import { renderWithPresentation } from "./helpers/presentation";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const base = "app/(dashboard)/payroll/";
const page = base + "analytics/page.tsx";
const forecastPage = base + "forecasting/page.tsx";
const reportsPage = base + "reports/page.tsx";
const detailPage = base + "reports/[type]/page.tsx";
const locales = ["en-US", "fa-IR"] as const;
const noop = () => {};
const caller = "<script>caller & name</script>";
const escape = (v: string) => v.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
const translator = (locale: typeof locales[number]) => createTranslator({ locale, messages: locale === "en-US" ? en : fa, namespace: "PayrollAnalytics" });
type Capture = { kind: string; props: Record<string, unknown> };
type Harness = { captured: Capture[]; events: unknown[]; effects: (() => void | (() => void))[]; refs: Record<string, { current: unknown }> };

// Real production templates and next-intl; hook/IO state and portals are controlled.
function render(file: string, states: Record<string, unknown> = {}, locale: typeof locales[number] = "en-US") {
  const ast = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declaration = ast.statements.find((n): n is ts.FunctionDeclaration => ts.isFunctionDeclaration(n) && !!n.modifiers?.some(m => m.kind === ts.SyntaxKind.DefaultKeyword))!;
  const name = declaration.name!.text;
  const owner = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name)!;
  const names: string[] = [];
  const refNames: string[] = [];
  function hooks(n: ts.Node) {
    if (ts.isVariableDeclaration(n) && ts.isArrayBindingPattern(n.name) && n.initializer && ts.isCallExpression(n.initializer) && n.initializer.expression.getText(ast) === "useState") names.push(n.name.elements[0].getText(ast));
    if (ts.isVariableDeclaration(n) && n.initializer && ts.isCallExpression(n.initializer) && n.initializer.expression.getText(ast) === "useRef") refNames.push(n.name.getText(ast));
    ts.forEachChild(n, hooks);
  }
  hooks(owner);
  const source = ast.text + `\nexport { ${name} };`;
  const h: Harness = { captured: [], events: [], effects: [], refs: {} };
  const capture = (factory: typeof jsx.jsx) => (kind: unknown, props: Record<string, unknown>, key: string) => {
    h.captured.push({ kind: typeof kind === "string" ? kind : (kind as { name?: string })?.name ?? "", props });
    return factory(kind as Parameters<typeof jsx.jsx>[0], props, key);
  };
  const inline = (kind: string) => function Inline(props: Record<string, unknown>) {
    h.captured.push({ kind, props });
    return createElement("div", { "data-control": kind }, props.children as ReactNode,
      typeof props.placeholder === "string" ? createElement("span", null, props.placeholder) : null);
  };
  let index = 0;
  let refIndex = 0;
  const require = createRequire(resolve(file)), compiled = { exports: {} as Record<string, ComponentType<Record<string, unknown>>> };
  const load = (id: string): unknown => {
    if (id === "react") return { ...React, useState: (initial: unknown) => {
      const key = names[index++]; return [Object.hasOwn(states, key) ? states[key] : initial, (v: unknown) => h.events.push([key, v])];
    }, useEffect: (fn: () => void | (() => void)) => h.effects.push(fn), useMemo: (fn: () => unknown) => fn(), useCallback: (fn: unknown) => fn,
    useRef: (initial: unknown) => h.refs[refNames[refIndex++]] = { current: initial } };
    if (id === "react/jsx-runtime") return { ...jsx, jsx: capture(jsx.jsx), jsxs: capture(jsx.jsxs) };
    if (id === "next-intl") return nextIntl;
    if (id === "sonner") return { toast: { error: (v: unknown) => h.events.push(["error", v]), success: (v: unknown) => h.events.push(["success", v]) } };
    if (id === "next/navigation") return { useRouter: () => ({ push: (v: unknown) => h.events.push(["navigate", v]) }), useParams: () => ({ type: states.reportType ?? "summary" }) };
    if (id.endsWith("/topbar")) return { useTopbarAction: noop };
    if (id.endsWith("/use-debounce")) return { useDebounce: (v: string) => states.debouncedSearch ?? v };
    if (id.endsWith("/use-document-title")) return { useDocumentTitle: (v: string) => h.events.push(["title", v]) };
    if (id.endsWith("/use-confirm")) return { useConfirm: () => ({ dialog: null, confirm: async (v: unknown) => { h.events.push(["confirm", v]); return states.confirmed !== false; } }) };
    if (id.endsWith("/brand-loader")) return BrandLoader;
    for (const [suffix, names] of Object.entries({ "/ui/dialog": ["Dialog", "DialogContent", "DialogHeader", "DialogTitle", "DialogDescription", "DialogFooter"], "/ui/select": ["Select", "SelectContent", "SelectItem", "SelectTrigger", "SelectValue"], "/ui/tabs": ["Tabs", "TabsList", "TabsTrigger"], "/ui/sheet": ["Sheet", "SheetContent", "SheetHeader", "SheetTitle", "SheetDescription"], "/ui/date-picker": ["DatePicker"], "/ui/currency-select": ["CurrencySelect"] }))
      if (id.endsWith(suffix)) return Object.fromEntries(names.map(key => [key, inline(key)]));
    return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  };
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function("require", "module", "exports", code)(load, compiled, compiled.exports);
  const html = renderWithPresentation(createElement(compiled.exports[name]), locale);
  return { ...h, html };
}
const flush = async () => { for (let i = 0; i < 6; i++) await new Promise(resolve => setImmediate(resolve)); };
const money = (key: string, amount: number | null) => ({ [key]: amount, [key + "Minor"]: amount === null ? null : String(amount) });
const summary = { currency: "KWD", totalRuns: 2, activeEmployees: 1, ...money("totalGross", 3000000000), ...money("totalDeductions", 29), ...money("totalNet", 2999999971), ...money("avgCostPerRun", 1500000000) };
const projection = { currency: "KWD", month: "2026-11", headcount: 1, ...money("gross", 29), ...money("tax", 1), ...money("net", 28) };
const scenario = { currency: "KWD", current: { headcount: 1, ...money("monthlyGross", 29), ...money("projectedTotal", 348) }, projected: { headcount: 2, ...money("monthlyGross", 28), ...money("projectedTotal", 336) }, difference: { ...money("monthlyGross", -1), ...money("projectedTotal", -12) } };
const taxRow = { employeeId: "employee-a", employeeName: caller, currency: "KWD", ...money("totalGross", Number.MAX_SAFE_INTEGER), ...money("totalTax", 29) };
const laborRow = { department: caller, employeeCount: 1, currency: "KWD", ...money("totalGross", 29), ...money("totalNet", 28) };
const yoyRow = { month: "2026-10", runCount: 2, currency: "KWD", ...money("totalGross", 29), ...money("totalNet", 28) };
const bodies = { summary: { summary }, projection: { currency: "KWD", data: [projection], totals: { ...money("gross", 29), ...money("tax", 1), ...money("net", 28) } }, scenario,
  "tax-liability": { data: [taxRow], currency: "KWD", ...money("totalTax", 29) }, "labor-cost": { data: [laborRow] }, yoy: { data: [yoyRow] } };
const loaded = { loading: false, summary, projection: [projection], currency: "KWD", totals: bodies.projection.totals, whatIf: scenario };
const has = (h: Harness, key: string, value: unknown) => h.events.some(v => JSON.stringify(v) === JSON.stringify([key, value]));
async function withIO(fetcher: typeof fetch, run: () => Promise<void>, org: string | null = "org-a", storageThrows = false) {
  const original = globalThis.fetch, storage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  globalThis.fetch = fetcher;
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: (key: string) => {
    assert.equal(key, "activeOrgId"); if (storageThrows) throw new Error("Private storage"); return org;
  } } });
  try { await run(); } finally {
    globalThis.fetch = original;
    if (storage) Object.defineProperty(globalThis, "localStorage", storage); else Reflect.deleteProperty(globalThis, "localStorage");
  }
}
function response(url: string | URL | Request) {
  const key = String(url).split("?")[0].split("/").at(-1)!;
  return Response.json(bodies[(key === "what-if" ? "scenario" : key) as keyof typeof bodies]);
}
function button(h: ReturnType<typeof render>, label: string) {
  function text(v: unknown): string {
    if (typeof v === "string" || typeof v === "number") return String(v);
    if (Array.isArray(v)) return v.map(text).join("");
    if (React.isValidElement<{ children?: ReactNode }>(v)) return text(v.props.children);
    return "";
  }
  const c = h.captured.find(c => typeof c.props.onClick === "function" && text(c.props.children).includes(label));
  assert.ok(c, label); return c.props.onClick as () => Promise<void>;
}

test("analytics production templates render both catalogs, exact cents, plural counts and escaped saved data", () => {
  for (const locale of locales) {
    const t = translator(locale);
    const a = render(page, loaded, locale);
    assert.ok(has(a, "title", t("analyticsDocumentTitle")));
    for (const key of ["totalRuns", "totalGross", "totalNet", "activeEmployees", "live", "reports", "forecast", "whatIf", "salaryAdjustment", "newHires", "avgHireSalary", "terminations", "runScenario", "currentMonthly", "projectedMonthly", "difference", "perMonth"] as const) assert.ok(a.html.includes(escape(t(key))), key);
    assert.ok(a.html.includes(escape(payrollMoneyDisplay(3000000000, "KWD", resolvePresentation({ user: { language: locale } })))));
    assert.ok(a.html.includes(escape(payrollMoneyDisplay(-1, "KWD", resolvePresentation({ user: { language: locale } })))));
    for (const count of [0, 1, 2]) assert.ok(render(page, { ...loaded, whatIf: { ...scenario, current: { ...scenario.current, headcount: count } } }, locale).html.includes(escape(t("employeesCount", { count }))));
    for (const key of ["noAnalytics", "noAnalyticsDescription", "goToRuns"] as const) assert.ok(render(page, { loading: false }, locale).html.includes(escape(t(key))));
    assert.ok(render(page, { ...loaded, projection: [] }, locale).html.includes(escape(t("noForecast"))));
    const f = render(forecastPage, loaded, locale);
    assert.ok(has(f, "title", t("forecastDocumentTitle")));
    for (const key of ["forecastTitle", "forecastDescription", "yearGross", "yearNet", "headcount", "month", "gross", "net"] as const) assert.ok(f.html.includes(escape(t(key))), key);
    const r = render(reportsPage, loaded, locale);
    assert.ok(has(r, "title", t("reportsDocumentTitle")));
    for (const key of ["reportsTitle", "reportsDescription", "summaryTitle", "taxTitle", "laborTitle", "yoyTitle", "avgCostPerRun", "exportCsv"] as const) assert.ok(r.html.includes(escape(t(key))), key);
    for (const kind of ["summary", "tax-liability", "labor-cost", "yoy"] as const) {
      const d = render(detailPage, { loading: false, data: bodies[kind], reportType: kind }, locale);
      assert.ok(has(d, "title", t("detailDocumentTitle")));
      for (const key of ["backToReports", "startDate", "endDate"] as const) assert.ok(d.html.includes(escape(t(key))));
      if (kind === "summary") for (const key of summaryFields) assert.ok(d.html.includes(escape(t(key))), key);
      if (kind === "tax-liability" || kind === "labor-cost") { assert.ok(d.html.includes(escape(caller))); assert.ok(!d.html.includes("<script>")); }
      if (kind === "tax-liability") assert.ok(d.html.includes(escape(payrollMoneyDisplay(Number.MAX_SAFE_INTEGER, "KWD", resolvePresentation({ user: { language: locale } })))));
      if (kind === "yoy") assert.ok(d.html.includes("2026-10"));
      const failed = render(detailPage, { loading: false, data: bodies[kind], reportType: kind, moneyError: t("loadFailed") }, locale);
      assert.ok(failed.html.includes('role="alert"')); assert.ok(failed.html.includes(escape(t("startDate"))));
      assert.ok(!failed.html.includes(escape(caller)));
    }
    for (const file of [page, forecastPage]) assert.ok(render(file, { ...loaded, whatIfLoading: true }, locale).html.includes(escape(t("calculating"))));
  }
});

test("checked analytics reader rejects failed or malformed envelopes and preserves mixed-currency labor groups", async () => {
  for (const kind of Object.keys(bodies) as (keyof typeof bodies)[]) {
    assert.deepEqual(await payrollAnalyticsJson(Response.json(bodies[kind]), kind), bodies[kind]);
    for (const body of [{}, null, [], { error: "Private backend" }, { data: null }]) await assert.rejects(payrollAnalyticsJson(Response.json(body), kind));
    await assert.rejects(payrollAnalyticsJson(Response.json(bodies[kind], { status: 403 }), kind));
    await assert.rejects(payrollAnalyticsJson(new Response("Private JSON"), kind));
  }
  for (const row of [{ ...summary, totalGrossMinor: "29" }, { ...summary, totalRuns: -1 }, { ...summary, activeEmployees: 1.5 }, { ...summary, currency: "kwd" }, { ...summary, totalNet: undefined, totalNetMinor: undefined }]) await assert.rejects(payrollAnalyticsJson(Response.json({ summary: row }), "summary"));
  for (const row of [{ ...projection, month: "2026-13" }, { ...projection, month: "0000-01" }, { ...projection, headcount: -1 }, { ...projection, grossMinor: "029" }, { ...projection, currency: "USD" }]) await assert.rejects(payrollAnalyticsJson(Response.json({ ...bodies.projection, data: [row] }), "projection"));
  await assert.rejects(payrollAnalyticsJson(Response.json({ ...bodies.projection, totals: null }), "projection"));
  await assert.rejects(payrollAnalyticsJson(Response.json({ ...bodies.projection, data: [projection, projection] }), "projection"));
  await assert.rejects(payrollAnalyticsJson(Response.json({ ...scenario, difference: { ...scenario.difference, ...money("monthlyGross", 0) } }), "scenario"));
  await assert.rejects(payrollAnalyticsJson(Response.json({ ...scenario, current: { ...scenario.current, headcount: null } }), "scenario"));
  await assert.rejects(payrollAnalyticsJson(Response.json({ ...bodies["tax-liability"], data: [{ ...taxRow, employeeName: null }] }), "tax-liability"));
  await assert.rejects(payrollAnalyticsJson(Response.json({ data: [{ ...laborRow, employeeCount: "1" }] }), "labor-cost"));
  await assert.rejects(payrollAnalyticsJson(Response.json({ data: [{ ...yoyRow, runCount: -1 }] }), "yoy"));
  const mixed = { data: [laborRow, { ...laborRow, currency: "USD" }] };
  assert.deepEqual(await payrollAnalyticsJson(Response.json(mixed), "labor-cost"), mixed);
});

test("production read effects are atomic, localize failures, release loading and ignore obsolete reads", async () => {
  for (const locale of locales) for (const file of [page, forecastPage, reportsPage, detailPage]) for (const mode of ["ok", "http", "network", "json", "envelope", "money", "no-org", "storage"]) {
    let calls = 0;
    await withIO(async (url, init) => {
      calls++; assert.deepEqual(init?.headers, { "x-organization-id": "org-a" });
      if (mode === "http") return Response.json({ error: "Private backend" }, { status: 403 });
      if (mode === "network") throw new Error("Private network");
      if (mode === "json") return new Response("Private JSON");
      if (mode === "envelope") return Response.json({ success: true });
      if (mode === "money") return Response.json(String(url).includes("projection") ? { ...bodies.projection, totals: { ...bodies.projection.totals, grossMinor: "28" } } : { summary: { ...summary, totalGrossMinor: "28" } });
      return response(url);
    }, async () => {
      const h = render(file, {}, locale); h.effects[0](); await flush();
      assert.equal(calls, ["no-org", "storage"].includes(mode) ? 0 : file === page ? 2 : 1);
      assert.ok(has(h, "loading", false));
      if (mode === "ok") {
        assert.ok(has(h, "moneyError", null));
        assert.ok(has(h, file === page || file === reportsPage ? "summary" : file === forecastPage ? "projection" : "data", file === page || file === reportsPage ? summary : file === forecastPage ? [projection] : bodies.summary));
      } else {
        assert.ok(has(h, "moneyError", translator(locale)(["no-org", "storage"].includes(mode) ? "organizationRequired" : "loadFailed")));
        assert.ok(!h.events.some(v => Array.isArray(v) && ["summary", "projection", "data", "currency", "totals"].includes(v[0])));
      }
      assert.ok(!JSON.stringify(h.events).includes("Private"));
    }, mode === "no-org" ? null : "org-a", mode === "storage");
  }
  for (const file of [page, forecastPage, reportsPage, detailPage]) for (const rejected of [false, true]) {
    const pending: { resolve: (r: Response) => void; reject: (e: Error) => void; url: string | URL | Request }[] = [];
    await withIO(url => new Promise((resolve, reject) => pending.push({ resolve, reject, url })), async () => {
      const h = render(file); const cleanup = h.effects[0](); assert.equal(typeof cleanup, "function");
      await flush(); assert.ok(pending.length > 0);
      (cleanup as () => void)(); const before = h.events.length;
      for (const p of pending) { if (rejected) p.reject(new Error("Private obsolete")); else p.resolve(response(p.url)); }
      await flush(); assert.equal(h.events.length, before);
    });
  }
});

test("report navigation and Gregorian filter callbacks preserve routes, query keys and header", async () => {
  for (const file of [page, reportsPage]) {
    const h = render(file, loaded);
    const cards = h.captured.filter(c => typeof c.props.onClick === "function" && String(c.props.className).includes("items-start"));
    assert.equal(cards.length, 4);
    cards.forEach(c => (c.props.onClick as () => void)());
    assert.deepEqual(h.events.filter(v => Array.isArray(v) && v[0] === "navigate"), ["summary", "tax-liability", "labor-cost", "yoy"].map(kind => ["navigate", `/payroll/reports/${kind}`]));
  }
  for (const kind of ["summary", "tax-liability", "labor-cost", "yoy", "unknown"]) {
    await withIO(async (url, init) => {
      assert.equal(String(url), `/api/v1/payroll/reports/${kind === "unknown" ? "summary" : kind}?startDate=2026-01-01&endDate=2026-10-21`);
      assert.deepEqual(init?.headers, { "x-organization-id": "org-a" }); return response(url);
    }, async () => {
      const h = render(detailPage, { loading: false, reportType: kind, startDate: "2026-01-01", endDate: "2026-10-21" });
      h.effects[0](); await flush(); assert.ok(has(h, "moneyError", null));
      const inputs = h.captured.filter(c => c.props.type === "date" && typeof c.props.onChange === "function");
      (inputs[0].props.onChange as (e: unknown) => void)({ target: { value: "2026-02-01" } });
      (inputs[1].props.onChange as (e: unknown) => void)({ target: { value: "2026-09-01" } });
      assert.ok(has(h, "startDate", "2026-02-01")); assert.ok(has(h, "endDate", "2026-09-01"));
      await button(h, translator("en-US")("backToReports"))(); assert.ok(has(h, "navigate", "/payroll/reports"));
    });
  }
});

test("scenario callbacks keep exact cents and numeric physical counts/percent while hiding failure diagnostics", async () => {
  for (const locale of locales) for (const file of [page, forecastPage]) for (const mode of ["ok", "http", "network", "json", "envelope", "money", "input"]) {
    let calls = 0;
    await withIO(async (url, init) => {
      calls++; assert.equal(url, "/api/v1/payroll/forecasting/what-if"); assert.equal(init?.method, "POST");
      assert.deepEqual(init?.headers, { "Content-Type": "application/json", "x-organization-id": "org-a" });
      assert.deepEqual(JSON.parse(init?.body as string), { salaryAdjustmentPercent: 7.5, newHires: 2, avgNewHireSalaryMinor: "29", terminations: 1, months: 12 });
      if (mode === "http") return Response.json({ error: "Private scenario" }, { status: 422 });
      if (mode === "network") throw new Error("Private network");
      if (mode === "json") return new Response("Private JSON");
      if (mode === "envelope") return Response.json({ success: true });
      if (mode === "money") return Response.json({ ...scenario, difference: { ...scenario.difference, monthlyGrossMinor: "0" } });
      return Response.json(scenario);
    }, async () => {
      const h = render(file, { ...loaded, salaryAdj: "7.5", newHires: "2", avgHireSalary: mode === "input" ? "0.291" : "0.29", terminations: "1" }, locale);
      await button(h, translator(locale)("runScenario"))();
      assert.equal(calls, mode === "input" ? 0 : 1); assert.ok(has(h, "whatIfLoading", true)); assert.ok(has(h, "whatIfLoading", false));
      if (mode === "ok") assert.ok(has(h, "whatIf", scenario));
      else { assert.ok(has(h, "whatIf", null)); assert.ok(has(h, "error", translator(locale)("scenarioFailed"))); }
      assert.ok(!JSON.stringify(h.events).includes("Private"));
      assert.ok(!h.events.some(v => Array.isArray(v) && ["salaryAdj", "newHires", "avgHireSalary", "terminations"].includes(v[0])));
    });
  }
});

test("CSV controls use authenticated existing download helper and localized failures in both locales", async () => {
  const originalUrl = URL.createObjectURL, originalRevoke = URL.revokeObjectURL;
  const documentProperty = Object.getOwnPropertyDescriptor(globalThis, "document");
  const events: unknown[] = [];
  URL.createObjectURL = () => { events.push("blob"); return "blob:payroll"; };
  URL.revokeObjectURL = url => events.push(["revoke", url]);
  Object.defineProperty(globalThis, "document", { configurable: true, value: { createElement: (tag: string) => {
    assert.equal(tag, "a"); const link = { href: "", download: "", click: () => events.push(["click", link.href, link.download]) }; return link;
  } } });
  try {
    for (const locale of locales) for (const file of [page, reportsPage]) for (const failed of [false, true]) {
      events.length = 0;
      await withIO(async (url, init) => {
        assert.equal(url, "/api/v1/payroll/reports/export"); assert.deepEqual(init?.headers, { "x-organization-id": "org-a" });
        return failed ? Response.json({ error: "Private export" }, { status: 403 }) : new Response("Employee,Gross\nCaller,0.29");
      }, async () => {
        const h = render(file, loaded, locale); await button(h, translator(locale)("exportCsv"))(); await flush();
        if (failed) { assert.ok(has(h, "error", translator(locale)("exportFailed"))); assert.deepEqual(events, []); }
        else assert.deepEqual(events, ["blob", ["click", "blob:payroll", "payroll-export.csv"], ["revoke", "blob:payroll"]]);
        assert.ok(!JSON.stringify(h.events).includes("Private"));
      });
    }
  } finally {
    URL.createObjectURL = originalUrl; URL.revokeObjectURL = originalRevoke;
    if (documentProperty) Object.defineProperty(globalThis, "document", documentProperty); else Reflect.deleteProperty(globalThis, "document");
  }
});

test("owned authored text has no JSX or attribute copy left outside the paired catalog", () => {
  assert.deepEqual(Object.keys(en.PayrollAnalytics), Object.keys(fa.PayrollAnalytics));
  for (const value of Object.values(fa.PayrollAnalytics)) assert.match(value, /[\u0621-\u063a\u0641-\u064a\u067e\u0686\u0698\u06a9\u06af\u06cc]/);
  for (const file of [page, forecastPage, reportsPage, detailPage]) {
    const source = readFileSync(file, "utf8"), ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(n: ts.Node) {
      if (ts.isJsxText(n)) assert.doesNotMatch(n.text, /[A-Za-z]/, file + ": " + n.text.trim());
      if (ts.isJsxAttribute(n) && ["title", "description", "placeholder", "aria-label"].includes(n.name.getText(ast)) && n.initializer && ts.isStringLiteral(n.initializer)) assert.fail(file + ": " + n.getText(ast));
      ts.forEachChild(n, visit);
    }
    visit(ast);
    assert.doesNotMatch(source, /toast\.error\([^\n]*(?:\.error|\.message)|key\.replace\(/);
  }
});
