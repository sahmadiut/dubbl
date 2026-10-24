import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import * as React from "react";
import * as jsx from "react/jsx-runtime";
import * as intl from "next-intl";
import ts from "typescript";
import { renderWithPresentation } from "./helpers/presentation";
import { flush, withIO } from "./helpers/report-page";
import { displayMoney, cashForecastUi } from "../lib/money/contact-dashboard-ui";
import { resolvePresentation } from "../i18n/locale";
import { formatExactCurrencyDecimal } from "../i18n/numbers";
import { budgetDecimal } from "../lib/money/budget-ui";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";
import * as DataTable from "../components/dashboard/data-table";
import * as CurrencySelect from "../components/ui/currency-select";
import * as BrandLoader from "../components/dashboard/brand-loader";
import * as ErrorState from "../components/dashboard/error-state";

type Props = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const caller = "<script>caller & name</script>", large = 9007199254740001n;
const locales = ["en-US", "fa-IR"] as const;
function render(kind: "page" | "cash", states: Record<string, unknown>, locale: typeof locales[number]) {
  const file = kind === "page" ? "app/(dashboard)/dashboard/page.tsx" : "components/dashboard/cash-flow-widget.tsx";
  const source = readFileSync(file, "utf8"), ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const names: string[] = [];
  const walk = (n: ts.Node) => {
    if (ts.isVariableDeclaration(n) && ts.isArrayBindingPattern(n.name) && n.initializer && ts.isCallExpression(n.initializer) && n.initializer.expression.getText(ast) === "useState") names.push(n.name.elements[0].getText(ast));
    ts.forEachChild(n, walk);
  };
  walk(ast);
  const captured: Props[] = [], effects: (() => void | (() => void))[] = [], events: [string, unknown][] = [];
  let index = 0;
  const capture = (factory: typeof jsx.jsx) => (type: Parameters<typeof jsx.jsx>[0], props: Props, key: string) => { captured.push(props); return factory(type, props, key); };
  const box = ({ children }: { children?: React.ReactNode }) => React.createElement("div", null, children);
  const require = createRequire(resolve(file)), compiled = { exports: {} as Record<string, React.ComponentType> };
  const load = (id: string): unknown => {
    if (id === "react") return { ...React, useState: (initial: unknown) => {
      const name = names[index++];
      return [Object.hasOwn(states, name) ? states[name] : typeof initial === "function" ? initial() : initial, (value: unknown) => events.push([name, value])];
    }, useEffect: (fn: () => void | (() => void)) => effects.push(fn) };
    if (id === "react/jsx-runtime") return { ...jsx, jsx: capture(jsx.jsx), jsxs: capture(jsx.jsxs) };
    if (id === "next-intl") return intl;
    if (id.endsWith("/data-table")) return DataTable;
    if (id.endsWith("/currency-select")) return CurrencySelect;
    if (id.endsWith("/brand-loader")) return BrandLoader;
    if (id.endsWith("/error-state")) return ErrorState;
    if (id === "next/navigation") return { useRouter: () => ({ push: (url: string) => events.push(["push", url]) }) };
    if (id === "next-auth/react") return { useSession: () => ({ data: { user: { name: caller } } }) };
    if (id === "motion/react") return { AnimatePresence: box, MotionConfig: box, motion: { div: box } };
    if (id === "@paper-design/shaders-react") return { GrainGradient: () => null };
    if (id === "recharts") return Object.fromEntries(["AreaChart", "Area", "XAxis", "YAxis", "CartesianGrid", "Tooltip", "ResponsiveContainer", "Legend"].map(key => [key, key === "AreaChart" ? ({ children }: { children?: React.ReactNode }) => React.createElement("svg", null, children) : box]));
    if (id.endsWith("/create-drawer")) return { useCreateDrawer: () => ({ open: (type: string) => events.push(["open", type]) }) };
    if (id.endsWith("/use-document-title")) return { useDocumentTitle: (title: string) => events.push(["title", title]) };
    if (id.endsWith("/dev-delay")) return { devDelay: async () => {} };
    if (id.endsWith("/activity-feed")) return { ActivityFeed: () => null };
    if (id.endsWith("/cash-flow-widget")) return { CashFlowWidget: () => null };
    return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  };
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function("require", "module", "exports", code)(load, compiled, compiled.exports);
  const html = renderWithPresentation(React.createElement(compiled.exports[kind === "page" ? "default" : "CashFlowWidget"]), locale);
  return { html, captured, effects, events };
}
const aging = { currencyCode: "KWD", grandTotal: large, buckets: ["Current", "1-30 days", "31-60 days", "61-90 days", "90+ days"].map((label, i) => ({ label, count: 1, total: i === 0 ? large : 0n })) };
const ready = { loading: false, greeting: "morning0", showOnboarding: true,
  pnl: { currencyCode: "KWD", totalRevenue: large, totalExpenses: 1n, netIncome: large - 1n, expenses: [{ accountName: caller, balance: 1n }] }, receivables: aging, payables: aging,
  ratios: { currentRatio: 1, quickRatio: 2, grossMargin: 3, netMargin: 4, dso: 5, dpo: 6 },
  budgetAlerts: [{ accountName: caller, pct: 100, budgeted: large, actual: large, currencyCode: "KWD" }],
  actionAlerts: { overdueInvoices: { count: 1, currencyCode: "KWD", total: large }, overdueBills: { count: 2, currencyCode: "JPY", total: 1n }, uncategorizedTransactions: 3, accountsNeedingReconciliation: [{ bankAccountName: caller }] } };
const aliases = (values: Record<string, bigint>) => Object.fromEntries(Object.entries(values).flatMap(([key, value]) => [[key, Number(value)], [`${key}Minor`, String(value)]]));
const forecast = { currencyCode: "KWD", forecastPeriod: { start: "2024-02-04", end: "2024-02-11", weeks: 1 }, ...aliases({ totalInflows: large, totalOutflows: 1n, netForecast: large - 1n }), weeks: [{ weekOf: "2024-02-04", entryCount: 2, ...aliases({ inflows: large, outflows: 1n, net: large - 1n, cumulativeNet: large - 1n }) }] };

test("dashboard production rendering localizes overview, aging, alerts and onboarding while retaining exact values and actions", () => {
  for (const locale of locales) {
    const messages = locale === "en-US" ? en : fa, t = intl.createTranslator({ locale, messages, namespace: "DashboardOverview" });
    const h = render("page", ready, locale);
    for (const key of ["overviewHelp", "morning0", "gettingStarted", "setupHelp", "budgetAlerts", "revenue", "expenses", "netIncome", "aging", "kpis", "overdueInvoices", "overdueBills", "uncategorized", "needsReconciliation", "recentEntries", "noEntries", "firstEntry", "bucket0", "bucket4"] as const) assert.ok(h.html.includes(t(key)), key);
    assert.ok(h.html.includes("&lt;script&gt;caller")); assert.ok(!h.html.includes("<script>"));
    const presentation = resolvePresentation({ user: { language: locale } });
    assert.ok(h.html.includes(displayMoney(large, "KWD", presentation))); assert.ok(h.html.includes(displayMoney(1n, "JPY", presentation)));
    assert.ok(h.events.some(([key, value]) => key === "title" && value === t("documentTitle")));
    for (const props of h.captured.filter(p => p.onClick && p.children === t("newEntry"))) props.onClick();
    // Button children also include icons, so test every declared navigation callback.
    for (const props of h.captured.filter(p => typeof p.onClick === "function" && String(p.onClick).includes("router.push"))) props.onClick();
    assert.ok(h.events.some(([key, value]) => key === "push" && value === "/sales"));
    assert.ok(h.events.some(([key, value]) => key === "push" && value === "/accounting/opening-balances"));
    const table = h.captured.find(p => p.emptyAction)!; table.emptyAction.onClick(); table.onRowClick({ id: "entry-id" });
    assert.ok(h.events.some(([key, value]) => key === "open" && value === "entry"));
    assert.ok(h.events.some(([key, value]) => key === "push" && value === "/accounting/entry-id"));
    for (const status of ["draft", "posted", "void"] as const) {
      assert.ok(renderWithPresentation(table.columns.find((p: Props) => p.key === "status").render({ status }), locale).includes(t(`status_${status}`)));
    }
    assert.ok(render("page", { loading: true }, locale).html.includes(messages.SharedUI.loading2));
    for (const error of ["loadError", "reportError", "alertError"] as const) assert.ok(render("page", { loading: false, error }, locale).html.includes(t(error)));
    assert.ok(render("page", { ...ready, dismissingOnboarding: true }, locale).html.includes(t("saving")));
    for (const value of Object.values(fa.DashboardOverview)) assert.match(value, /[\u0600-\u06ff]/);
  }
});

test("cash widget renders translated periods, legend, exact tooltip and finite errors", () => {
  for (const locale of locales) {
    const messages = locale === "en-US" ? en : fa, t = intl.createTranslator({ locale, messages, namespace: "DashboardOverview" });
    const h = render("cash", { loading: false, forecast: cashForecastUi(forecast) }, locale);
    for (const key of ["forecastTitle", "expectedIn", "expectedOut", "netPosition"] as const) assert.ok(h.html.includes(t(key)));
    for (const count of [30, 60, 90]) assert.ok(h.html.includes(t("periodDays", { count })));
    for (const weeks of [4, 9, 13]) {
      h.captured.find(p => p.onClick && String(p.onClick).includes("setWeeks") && p.children === t("periodDays", { count: weeks === 4 ? 30 : weeks === 9 ? 60 : 90 }))!.onClick();
      assert.ok(h.events.some(([key, value]) => key === "weeks" && value === weeks));
    }
    h.captured.find(p => p.onValueChange)!.onValueChange("JPY");
    assert.ok(h.events.some(([key, value]) => key === "currencyCode" && value === "JPY"));
    const point = h.captured.find(p => p.data)?.data[0]; assert.equal(point.inflowsExact, large);
    for (const key of ["inflows", "outflows", "balance"] as const) assert.equal(h.captured.find(p => p.dataKey === key)?.name, t(key));
    const tooltip = h.captured.find(p => p.content)?.content;
    const html = renderWithPresentation(React.cloneElement(tooltip, { active: true, payload: [{ dataKey: "inflows", payload: point }], label: "Feb 4" }), locale);
    assert.ok(html.includes(t("inflows"))); assert.ok(html.includes(displayMoney(large, "KWD", resolvePresentation({ user: { language: locale } }))));
    assert.ok(render("cash", { loading: false, forecast: null, error: "forecastError" }, locale).html.includes(t("forecastError")));
    assert.ok(render("cash", { loading: true }, locale).html.includes("animate-pulse"));
  }
});

test("Persian dashboard uses literal rial across cards, aging, expenses, budget alerts and grouped journal amounts", () => {
  const currencyCode = "IRR", presentation = resolvePresentation({ user: { language: "fa-IR" } });
  const states = { ...ready,
    pnl: { ...ready.pnl, currencyCode, netIncome: -1n },
    receivables: { ...aging, currencyCode }, payables: { ...aging, currencyCode },
    budgetAlerts: [{ ...ready.budgetAlerts[0], currencyCode, actual: 123n, budgeted: 100n }],
    actionAlerts: { ...ready.actionAlerts, overdueInvoices: { count: 1, currencyCode, total: large }, overdueBills: { count: 1, currencyCode, total: 1n } },
  };
  const h = render("page", states, "fa-IR");
  assert.match(h.html, /ریال/);
  assert.doesNotMatch(h.html, /IRR/);
  assert.ok(h.html.includes("۹٬۰۰۷٬۱۹۹٬۲۵۴٬۷۴۰٬۰۰۱\u00a0ریال"), "owner-preferred rial unit follows the exact amount");
  assert.ok(h.html.includes("−۱\u00a0ریال"), "signed rial amount remains exact with the unit after it");
  assert.ok(h.html.includes(formatExactCurrencyDecimal(budgetDecimal(123n), currencyCode, presentation)), "budget preserves fixed-two units");
  const table = h.captured.find(p => p.emptyAction)!;
  const debitTotals = [{ currencyCode, totalDebit: Number(large), totalDebitMinor: String(large) }];
  const amount = renderWithPresentation(table.columns.find((p: Props) => p.key === "amount").render({ debitTotals }), "fa-IR");
  assert.match(amount, /ریال/); assert.doesNotMatch(amount, /IRR/);
  assert.ok(amount.includes(displayMoney(large, currencyCode, presentation)));
  assert.equal(debitTotals[0].currencyCode, "IRR"); assert.equal(debitTotals[0].totalDebitMinor, String(large));
  const english = render("page", states, "en-US");
  assert.ok(english.html.includes(displayMoney(large, currencyCode))); assert.doesNotMatch(english.html, /ریال/);
});

test("Persian forecast uses rial in totals, approximate axis and exact tooltip while picker retains ISO", () => {
  const currencyCode = "IRR";
  const h = render("cash", { loading: false, currencyCode, forecast: cashForecastUi({ ...forecast, currencyCode }) }, "fa-IR");
  assert.match(h.html, /ریال/); assert.doesNotMatch(h.html, /IRR/);
  const axis = h.captured.find(p => p.tickFormatter)!;
  assert.match(axis.tickFormatter(1234.5), /ریال/); assert.doesNotMatch(axis.tickFormatter(1234.5), /IRR/);
  const point = h.captured.find(p => p.data)!.data[0];
  assert.equal(point.inflowsExact, large); assert.equal(point.currencyCode, currencyCode);
  const tooltip = h.captured.find(p => p.content)!.content;
  const html = renderWithPresentation(React.cloneElement(tooltip, { active: true, payload: [{ dataKey: "inflows", payload: point }], label: "week" }), "fa-IR");
  assert.match(html, /ریال/); assert.doesNotMatch(html, /IRR/);
  assert.ok(html.includes(displayMoney(large, currencyCode, resolvePresentation({ user: { language: "fa-IR" } }))));
  h.captured.find(p => p.onValueChange)!.onValueChange("IRR");
  assert.ok(h.events.some(([key, value]) => key === "currencyCode" && value === "IRR"));
});

test("rial forecast requests keep ISO query and organization scope", async () => {
  await withIO(async (url, init) => {
    assert.equal(String(url), "/api/v1/reports/cash-flow-forecast?weeks=4&currencyCode=IRR");
    assert.deepEqual(init?.headers, { "x-organization-id": "org-a" });
    return new Response(JSON.stringify({ ...forecast, currencyCode: "IRR" }));
  }, async () => {
    const h = render("cash", { weeks: 4, currencyCode: "IRR" }, "fa-IR");
    const cleanup = h.effects[0](); await flush();
    assert.ok(h.events.some(([key, value]) => key === "forecast" && value && (value as Props).currencyCode === "IRR" && (value as Props).totalInflows === large));
    if (cleanup) cleanup();
  });
});

test("cash effect preserves org/query and cancellation, rejects failed HTTP, JSON, money and network responses", async () => {
  for (const mode of ["ok", "http", "json", "money", "network"]) await withIO(async (url, init) => {
    assert.equal(String(url), "/api/v1/reports/cash-flow-forecast?weeks=9&currencyCode=KWD");
    assert.deepEqual(init?.headers, { "x-organization-id": "org-a" }); assert.ok(init?.signal);
    if (mode === "network") throw new Error("private detail");
    if (mode === "json") return new Response("invalid");
    return new Response(JSON.stringify(mode === "money" ? { ...forecast, totalInflowsMinor: "bad" } : forecast), { status: mode === "http" ? 403 : 200 });
  }, async () => {
    const h = render("cash", { weeks: 9, currencyCode: "KWD" }, "fa-IR"); const cleanup = h.effects[0](); await flush();
    if (mode === "ok") assert.ok(h.events.some(([key, value]) => key === "forecast" && value && (value as Props).totalInflows === large));
    else assert.ok(h.events.some(([key, value]) => key === "error" && value === "forecastError"));
    assert.ok(h.events.some(([key, value]) => key === "loading" && value === false)); if (cleanup) cleanup();
  });
});

test("onboarding dismissal retains PATCH body and organization scope", async () => {
  await withIO(async (url, init) => {
    assert.equal(String(url), "/api/v1/organization"); assert.equal(init?.method, "PATCH");
    assert.deepEqual(init?.headers, { "Content-Type": "application/json", "x-organization-id": "org-a" });
    assert.equal(init?.body, JSON.stringify({ onboardingCompleted: true })); return new Response("{}");
  }, async () => {
    const h = render("page", ready, "fa-IR"); h.captured.find(p => p["aria-label"] === fa.DashboardOverview.dismissGettingStarted)!.onClick(); await flush();
    assert.ok(h.events.some(([key, value]) => key === "showOnboarding" && value === false));
    assert.ok(h.events.some(([key, value]) => key === "dismissingOnboarding" && value === false));
  });
});
