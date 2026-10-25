import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import * as React from "react";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import * as intl from "next-intl";
import ts from "typescript";
import { compile } from "tailwindcss";
import * as Provider from "../i18n/provider";
import { resolvePresentation } from "../i18n/locale";
import { budgetMoney } from "../lib/money/budget-ui";
import { assetMoneyDisplay } from "../lib/money/asset-display";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const h = React.createElement, noop = () => {};
const caller = "  \u062D\u0633\u0627\u0628 Caller <ACME/001> & " + "long-name-".repeat(30);
const code = "001-AB/\u062D\u0633\u0627\u0628", minor = 4000000000000001n;
const account = { id: "account-a", code, name: caller, type: "expense" };
const periods = [1, 0].map(i => ({ id: `period-${i}`, label: i ? "Feb 2026" : "Jan 2026", sortOrder: i,
  startDate: i ? "2026-02-01" : "2026-01-01", endDate: i ? "2026-02-28" : "2026-01-31",
  amount: i ? 1n : minor - 1n, budgeted: i ? 1n : minor - 1n, actual: 1n, variance: i ? 0n : minor - 2n }));
const line = { id: "line-a", accountId: account.id, account, total: minor, periods };
const budget = { id: "budget-a", name: caller, startDate: "2026-01-01", endDate: "2026-02-28", periodType: "monthly", isActive: true, lines: [line] };
const comparison = { accountId: account.id, accountName: caller, accountCode: code, budgeted: minor, actual: 2n, variance: minor - 2n, burnRate: 3n, periods };
const context = { budget, currencyCode: "USD", accounts: [account], comparisons: [comparison], totalBudgeted: minor, totalActual: 2n, refetch: noop };
const loan = { id: "loan-a", name: caller, principalAmount: Number(minor), monthlyPayment: 1250, interestRate: 550, termMonths: 36, startDate: "2026-01-01", status: "active" };
const schedule = [{ id: "schedule-a", periodNumber: 1, date: "2026-02-01", principalAmount: Number(minor) - 1, interestAmount: 1, totalPayment: Number(minor), remainingBalance: 1, posted: false }];
const accrual = { id: "accrual-a", description: caller, totalAmount: Number(minor), startDate: "2026-01-01", endDate: "2026-02-28", periods: 2, status: "active",
  entries: [{ id: "entry-b", periodDate: "2026-02-01", amount: 1, sortOrder: 1, posted: false }, { id: "entry-a", periodDate: "2026-01-01", amount: Number(minor)-1, sortOrder: 0, posted: true }] };
const presentations = (["en-US", "fa-IR"] as const).flatMap(language => (["latn", "arabext"] as const).map(numerals => resolvePresentation({ user: { language, numerals } })));
type Props = Record<string, unknown>;
const require = createRequire(import.meta.url);
const CjsProvider = (require("../i18n/provider") as typeof Provider).PresentationProvider;
const escape = (s: string) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;");

// Real production components/provider/controls, with state scheduling, navigation and chart IO controlled.
function loaded(relative: string, states: Props = {}) {
  const file = "app/(dashboard)/accounting/" + relative, source = readFileSync(file, "utf8");
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const main = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.modifiers?.some(m => m.kind === ts.SyntaxKind.DefaultKeyword));
  assert.ok(main);
  const names: string[] = [];
  function hooks(n: ts.Node) {
    if (ts.isVariableDeclaration(n) && ts.isArrayBindingPattern(n.name) && n.initializer && ts.isCallExpression(n.initializer) && n.initializer.expression.getText(ast) === "useState") names.push(n.name.elements[0].getText(ast));
    ts.forEachChild(n, hooks);
  }
  hooks(main);
  const controls: { type: unknown; props: Props }[] = [], updates: unknown[][] = [], events: unknown[] = [], charts: Record<string, Props> = {};
  const capture = (create: typeof jsx.jsx) => (type: React.ElementType, props: Props, key?: string) => { controls.push({ type, props }); return create(type, props, key); };
  let index = 0;
  const compiled = { exports: {} as Record<string, React.ComponentType<Props>> }, localRequire = createRequire(resolve(file));
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function("require", "module", "exports", js)((id: string) => {
    if (id === "react") return { ...React, useState: (initial: unknown) => {
      const key = names[index++] ?? "expanded";
      return [key in states ? states[key] : typeof initial === "function" ? initial() : initial, (value: unknown) => updates.push([key, value])];
    }, useEffect: noop, useRef: (value: unknown) => ({ current: value }), useMemo: (fn: () => unknown) => fn(), useCallback: (fn: unknown) => fn };
    if (id === "react/jsx-runtime") return { ...jsx, jsx: capture(jsx.jsx), jsxs: capture(jsx.jsxs) };
    if (id === "next-intl") return intl;
    if (id.endsWith("/i18n/provider")) return Provider;
    if (id === "next/navigation") return { useParams: () => ({ id: budget.id }), usePathname: () => `/accounting/budgets/${budget.id}`, useRouter: () => ({ push: (url: unknown) => events.push(url) }) };
    if (id === "./layout" || id === "../layout") return { useBudgetContext: () => context };
    if (id.endsWith("/use-entity-title")) return { useEntityTitle: noop };
    if (id.endsWith("/use-document-title")) return { useDocumentTitle: noop };
    if (id.endsWith("/use-debounce")) return { useDebounce: (v: unknown) => v };
    if (id.endsWith("/use-confirm")) return { useConfirm: () => ({ confirm: noop, dialog: null }) };
    if (id.endsWith("/create-drawer")) return { useCreateDrawer: () => ({ open: (...args: unknown[]) => events.push(args) }) };
    if (id === "recharts") return Object.fromEntries(["AreaChart", "Area", "XAxis", "YAxis", "CartesianGrid", "Tooltip", "ResponsiveContainer", "Legend"].map(key => [key, (props: Props) => { charts[key] = props; return h(key === "AreaChart" ? "svg" : "g", null, props.children as React.ReactNode); }]));
    return localRequire(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  }, compiled, compiled.exports);
  return { controls, updates, events, charts, render(p: typeof presentations[number]) {
    index = 0; controls.length = 0;
    const props = { presentation: p, messages: p.locale === "fa-IR" ? fa : en, now: new Date("2026-10-26T00:00:00Z") };
    return renderToStaticMarkup(h(Provider.PresentationProvider, props, h(CjsProvider, props, h(compiled.exports.default))));
  } };
}
function control(page: ReturnType<typeof loaded>, predicate: (c: { type: unknown; props: Props }) => boolean) {
  const found = page.controls.find(predicate); assert.ok(found); return found.props;
}

test("budget list/layout isolate long caller and exact values and retain raw filter/navigation contracts", () => {
  assert.match(caller, /\p{Script=Arabic}/u);
  for (const p of presentations) {
    const page = loaded("budgets/page.tsx", { budgets: [budget], loading: false, reports: { [budget.id]: { ...context, daysRemaining: 2, totalDays: 59, daysElapsed: 57 } } });
    const html = page.render(p);
    assert.ok(html.includes(`>${escape(caller)}</bdi>`));
    assert.ok(html.includes(`>${escape(code)}</bdi>`));
    assert.ok(html.includes(budgetMoney(minor, "USD", p)));
    const search = control(page, c => c.props.placeholder === (p.locale === "fa-IR" ? fa : en).Budgets.search);
    assert.equal(search.dir, "auto"); assert.equal(typeof search["aria-label"], "string");
    (search.onChange as (e: unknown) => void)({ target: { value: code } }); assert.deepEqual(page.updates.at(-1), ["search", code]);
    const status = control(page, c => c.props.value === "all" && typeof c.props.onValueChange === "function");
    (status.onValueChange as (value: string) => void)("inactive"); assert.deepEqual(page.updates.at(-1), ["statusFilter", "inactive"]);
    const link = control(page, c => typeof c.props.onClick === "function" && String(c.props.className).includes("group"));
    (link.onClick as () => void)(); assert.equal(page.events.at(-1), `/accounting/budgets/${budget.id}`);
    const shell = loaded("budgets/[id]/layout.tsx", { ...context, loading: false, totalBurnRate: 3n, daysElapsed: 57, daysRemaining: 2, totalDays: 59 });
    const shellHtml = shell.render(p);
    assert.ok(shellHtml.includes('aria-current="page"') && shellHtml.includes(`>${escape(caller)}</bdi>`));
    assert.match(shellHtml, /<bdi[^>]*dir="ltr"[^>]*>2026-01-01<\/bdi>/);
  }
});

test("budget chart chronology and exact tooltip keys stay canonical while controls and tables wrap", () => {
  const before = periods.map(row => row.id).join();
  for (const p of presentations) {
    const page = loaded("budgets/[id]/page.tsx", { expanded: true }), html = page.render(p);
    assert.ok(html.includes('dir="ltr" class="min-w-0 rounded-lg border p-4"'));
    assert.deepEqual((page.charts.AreaChart.data as { name: string }[]).map(row => row.name), ["Jan 2026", "Feb 2026"]);
    assert.equal(page.charts.XAxis.reversed, undefined);
    const tooltip = page.charts.Tooltip.formatter as (...args: unknown[]) => string[];
    assert.deepEqual(tooltip(0, "ignored label", { dataKey: "budgeted", payload: { budgetedExact: minor, actualExact: 1n } }), [budgetMoney(minor, "USD", p)]);
    assert.equal((page.charts.Tooltip.contentStyle as Props).direction, p.locale === "fa-IR" ? "rtl" : "ltr");
    assert.ok(html.includes('aria-expanded="true"') && html.includes("min-w-[560px]"));
  }
  assert.equal(periods.map(row => row.id).join(), before);
});

test("budget settings associate native labels and retain unmodified raw caller/date/account callbacks", () => {
  for (const p of presentations) {
    const page = loaded("budgets/[id]/settings/page.tsx", { expandedLine: 0 }), html = page.render(p);
    for (const id of ["budget-name", "budget-start", "budget-end", "budget-period-type", "budget-annual-0", "budget-period-0-0"]) assert.ok(html.includes(`for="${id}"`) && html.includes(`id="${id}"`), id);
    const name = control(page, c => c.props.id === "budget-name"); assert.equal(name.dir, "auto");
    (name.onChange as (e: unknown) => void)({ target: { value: caller } }); assert.deepEqual(page.updates.at(-1), ["name", caller]);
    const date = control(page, c => c.props.id === "budget-start"); assert.equal(date.dir, "ltr");
    (date.onChange as (e: unknown) => void)({ target: { value: "2026-01-02" } }); assert.ok(page.updates.some(row => row[0] === "startDate" && row[1] === "2026-01-02"));
    const choice = control(page, c => c.props.value === account.id && typeof c.props.onValueChange === "function");
    (choice.onValueChange as (value: string) => void)("raw-account-id");
    const update = page.updates.at(-1)?.[1] as (rows: unknown[]) => { accountId: string; total: bigint }[];
    assert.deepEqual(update([line])[0], { ...line, accountId: "raw-account-id" });
  }
});

test("loan and accrual list/details isolate caller,date,money and retain schedule order and routes", () => {
  const before = JSON.stringify({ loan, schedule, accrual });
  for (const p of presentations) {
    for (const [prefix, row, states] of [["loans", loan, { loans: [loan], initialLoad: false, refetching: false, totalCount: 1 }], ["accruals", accrual, { schedules: [accrual], initialLoad: false, refetching: false, totalCount: 1 }]] as const) {
      const page = loaded(`${prefix}/page.tsx`, states), html = page.render(p);
      assert.ok(html.includes(`>${escape(caller)}</bdi>`)); assert.ok(html.includes(assetMoneyDisplay(Number(minor), p)));
      const tabs = control(page, c => c.props.value === "all" && typeof c.props.onValueChange === "function"); assert.equal(tabs.dir, p.locale === "fa-IR" ? "rtl" : "ltr");
      (tabs.onValueChange as (value: string) => void)(prefix === "loans" ? "paid_off" : "completed"); assert.deepEqual(page.updates.at(-1), ["statusFilter", prefix === "loans" ? "paid_off" : "completed"]);
      const table = control(page, c => typeof c.props.onRowClick === "function"); (table.onRowClick as (row: unknown) => void)(row); assert.equal(page.events.at(-1), `/accounting/${prefix}/${row.id}`);
    }
    const loanPage = loaded("loans/[id]/page.tsx", { ln: loan, schedule, loading: false }), loanHtml = loanPage.render(p);
    assert.match(loanHtml, /<bdi[^>]*dir="ltr"[^>]*>2026-01-01<\/bdi>/); assert.ok(loanHtml.includes("rtl:rotate-180"));
    const accrualPage = loaded("accruals/[id]/page.tsx", { acc: accrual, loading: false }), accrualHtml = accrualPage.render(p);
    assert.ok(accrualHtml.indexOf('>2026-01-01</bdi>', accrualHtml.indexOf('min-w-[420px]')) < accrualHtml.indexOf('>2026-02-01</bdi>', accrualHtml.indexOf('min-w-[420px]')));
    assert.ok(accrualHtml.includes(assetMoneyDisplay(Number(minor), p)));
  }
  assert.equal(JSON.stringify({ loan, schedule, accrual }), before);
});

test("installed CSS provides logical geometry, local table scrolling and wrapping account controls", async () => {
  const compiler = await compile("@theme { --spacing:0.25rem; --breakpoint-sm:40rem; } @tailwind utilities;");
  const css = compiler.build(["start-2.5", "ps-8", "me-2", "ms-4", "border-s-[3px]", "text-start", "text-end", "flex-wrap", "overflow-x-auto", "[overflow-wrap:anywhere]", "rtl:rotate-180", "data-[size=default]:h-auto", "*:data-[slot=select-value]:line-clamp-none"]);
  for (const declaration of ["inset-inline-start:", "padding-inline-start:", "margin-inline-end:", "margin-inline-start:", "border-inline-start-width:", "text-align: start", "text-align: end", "flex-wrap: wrap", "overflow-x: auto", "overflow-wrap: anywhere", "rotate: 180deg", "height: auto", "-webkit-line-clamp: unset"]) assert.ok(css.includes(declaration), declaration);
});
