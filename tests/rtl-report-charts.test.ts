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
import * as Presentation from "../i18n/provider";
import * as ReportComponents from "../app/(dashboard)/reports/_components";
import * as DateRangeFilter from "../components/dashboard/date-range-filter";
import * as DatePicker from "../components/ui/date-picker";
import * as CurrencySelect from "../components/ui/currency-select";
import * as ExportButton from "../components/dashboard/export-button";
import * as DataTable from "../components/dashboard/data-table";
import { localeDirection, resolvePresentation } from "../i18n/locale";
import { analyticalMoney } from "../lib/money/analytical-report-ui";
import { statementUiMoney } from "../lib/money/financial-statement-ui";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const h = React.createElement, noop = () => {};
type Props = Record<string, unknown>;
const presentations = (["en-US", "fa-IR"] as const).flatMap(language =>
  (["latn", "arabext"] as const).map(numerals => resolvePresentation({ user: { language, numerals } })));
const caller = "  \u0646\u0627\u0645 Caller <ACME/001> & " + "long-name-".repeat(30);
const esc = (s: string) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const amount = 9007199254740001n;
const ready = { initialLoad: false, loading: false, error: false, currencyCode: "KWD" };

// Execute actual page JSX/handlers, native controls and next-intl providers. Only
// hook state, chart measurement/animation and separately owned dialogs are controlled.
function loaded(file: string, states: Props = {}, name = "default") {
  const path = `app/(dashboard)/${file}`, require = createRequire(resolve(path));
  let source = readFileSync(path, "utf8");
  if (name !== "default") source += `\nexport { ${name} };`;
  const tree = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX), names: string[] = [];
  function hooks(n: ts.Node) {
    if (ts.isVariableDeclaration(n) && ts.isArrayBindingPattern(n.name) && n.initializer && ts.isCallExpression(n.initializer)
      && n.initializer.expression.getText(tree) === "useState") names.push(n.name.elements[0].getText(tree));
    ts.forEachChild(n, hooks);
  }
  hooks(tree);
  let index = 0;
  const controls: { type: unknown; props: Props }[] = [], events: [string, unknown][] = [];
  const box = ({ children }: { children?: React.ReactNode }) => h("div", null, children);
  const chart = Object.fromEntries(["AreaChart", "Area", "XAxis", "YAxis", "CartesianGrid", "Tooltip", "ResponsiveContainer", "Legend", "ReferenceLine"].map(k => [k, box]));
  const capture = (factory: typeof jsx.jsx) => (type: React.ElementType, props: Props, key?: string) => {
    controls.push({ type, props }); return factory(type, props, key);
  };
  const compiled = { exports: {} as Record<string, React.ComponentType<Props>> };
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function("require", "module", "exports", code)((id: string) => {
    if (id === "react") return { ...React, useState: (initial: unknown) => {
      const key = names[index++]; return [Object.hasOwn(states, key) ? states[key] : typeof initial === "function" ? initial() : initial,
        (value: unknown) => events.push([key, value])];
    }, useEffect: noop };
    if (id === "next-intl") return intl;
    if (id === "../_components") return ReportComponents;
    if (id.endsWith("/date-range-filter")) return DateRangeFilter;
    if (id.endsWith("/date-picker")) return DatePicker;
    if (id.endsWith("/currency-select")) return CurrencySelect;
    if (id.endsWith("/export-button")) return ExportButton;
    if (id.endsWith("/data-table")) return DataTable;
    if (id.endsWith("/i18n/provider")) return Presentation;
    if (id === "react/jsx-runtime") return { ...jsx, jsx: capture(jsx.jsx), jsxs: capture(jsx.jsxs) };
    if (id === "next/navigation") return { useRouter: () => ({ push: (v: unknown) => events.push(["push", v]) }) };
    if (id === "next-auth/react") return { useSession: () => ({ data: { user: { name: caller } } }) };
    if (id === "recharts") return chart;
    if (id === "motion/react") return { motion: { div: box }, AnimatePresence: box, MotionConfig: box };
    if (id === "@paper-design/shaders-react") return { GrainGradient: () => null };
    if (id.endsWith("/content-reveal")) return { ContentReveal: box };
    if (id.endsWith("/use-document-title")) return { useDocumentTitle: noop };
    if (id.endsWith("/activity-feed") || id.endsWith("/cash-flow-widget")) return new Proxy({}, { get: () => () => null });
    if (id.endsWith("/create-drawer")) return { useCreateDrawer: () => ({ open: noop }) };
    if (id.endsWith("/use-confirm")) return { useConfirm: () => ({ confirm: noop, dialog: null }) };
    if (id.endsWith("/ui/dialog")) return new Proxy({}, { get: (_o, k) => k === "Dialog"
      ? ({ open, children }: { open: boolean; children: React.ReactNode }) => open ? box({ children }) : null : box });
    return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  }, compiled, compiled.exports);
  return { controls, events, render(p: typeof presentations[number], props: Props = {}) {
    index = 0; controls.length = 0;
    return renderToStaticMarkup(h(Presentation.PresentationProvider, { presentation: p, messages: p.locale === "fa-IR" ? fa : en,
      now: new Date("2026-10-25T00:00:00Z") }, h(compiled.exports[name], props)));
  } };
}

test("actual report cash rows retain exact mixed labels, currency-minor text and native picker values", () => {
  for (const p of presentations) {
    const page = loaded("reports/bank-cash-flow/page.tsx", { ...ready, accounts: [{ id: "bank/001", accountName: caller }],
      data: { currencyCode: "KWD", periods: [{ startDate: "2026-10-01", label: caller, inflows: amount, outflows: -1n, net: amount - 1n, balance: -amount }],
        totals: { inflows: amount, outflows: -1n, net: amount - 1n } } });
    const html = page.render(p);
    assert.ok(html.includes(`>${esc(caller)}</bdi>`), "caller period is escaped and isolated");
    assert.ok(html.includes(esc(analyticalMoney(-amount, "KWD", p))), "exact negative KWD value retained");
    assert.match(html, /<option[^>]*dir="auto"[^>]*value="bank\/001"/, "native option retains id and direction");
    const select = page.controls.find(c => c.type === "select" && c.props.value === "");
    assert.ok(select, "account select exists");
    (select.props.onChange as (e: unknown) => void)({ target: { value: "bank/002" } });
    assert.deepEqual(page.events.at(-1), ["bankAccountId", "bank/002"], "native callback preserves raw account id");
  }
});

test("actual forecast chart keeps chronological coordinates and exact tooltip values in every presentation", () => {
  for (const p of presentations) {
    const week = { weekOf: "2026-10-25", inflows: amount, outflows: 1n, net: amount - 1n, cumulativeNet: -amount };
    const page = loaded("reports/cash-flow-forecast/page.tsx", { ...ready, weeks: [week], totalInflows: amount, totalOutflows: 1n, netForecast: amount - 1n });
    const html = page.render(p), chart = page.controls.find(c => Array.isArray(c.props.data) && c.props.data.length === 1);
    assert.ok(chart, "chart series exists");
    assert.equal((chart.props.data as { minor: unknown }[])[0].minor, week, "exact minor payload remains the tooltip source");
    const tooltip = page.controls.find(c => typeof c.props.formatter === "function");
    assert.ok(tooltip, "exact tooltip exists");
    assert.deepEqual((tooltip.props.formatter as (...a: unknown[]) => unknown)(0, "Caller series", { dataKey: "cumulative", payload: { minor: week } }),
      [analyticalMoney(-amount, "KWD", p), "Caller series"], "tooltip ignores floating chart coordinate");
    assert.match(html, /dir="ltr"[^>]*class="min-w-0 \[&amp;_text\]/, "SVG chronology has an explicit LTR boundary");
    assert.equal((tooltip.props.contentStyle as Props).direction, localeDirection(p.locale), "tooltip labels follow presentation direction");
    const trigger = page.controls.find(c => c.props["aria-label"] === (p.locale === "fa-IR" ? fa : en).ForecastCalendarReports.forecastPeriodLabel);
    assert.ok(trigger, "forecast period has accessible name");
    assert.ok(html.includes("data-[size=default]:h-auto"), "period trigger can grow");
  }
});

test("actual positive and negative comparison values keep sign, amount and percent in single groups", () => {
  for (const p of presentations) for (const amount of [1n, -1n]) {
    const page = loaded("reports/pnl-comparison/page.tsx", {}, "ChangeCell"), html = page.render(p, { amount, pct: Number(amount), currencyCode: "KWD" });
    const sign = amount > 0n ? "+" : "";
    assert.ok(html.includes(`>${esc(sign + statementUiMoney(amount, "KWD", p))}</bdi>`), "sign and money share one LTR group");
    assert.ok(html.includes(`>(${amount > 0n ? "+" : ""}${amount}%)</bdi>`), "percent parentheses and sign share one group");
  }
});

test("actual report calendar keeps dates in order, grows cells and preserves date-selection callbacks", () => {
  for (const p of presentations) {
    const page = loaded("reports/financial-calendar/page.tsx", { ...ready, currentMonth: new Date(2026, 9, 1), selectedDate: "2026-10-25",
      events: [{ date: "2026-10-25", title: caller, type: "invoice_due", amount: -amount, currencyCode: "KWD" }] });
    const html = page.render(p);
    assert.match(html, /dir="ltr" class="min-w-0 rounded-lg border overflow-hidden"/, "calendar chronology explicit");
    assert.ok(html.includes("min-h-24 h-auto min-w-0"), "long event cells grow");
    assert.ok(html.includes(`>${esc(caller)}</bdi>`), "event caller isolated");
    const day = page.controls.find(c => c.props["aria-label"] === "2026-10-26");
    assert.ok(day, "date selection has exact accessible date");
    (day.props.onClick as () => void)();
    assert.deepEqual(page.events.at(-1), ["selectedDate", "2026-10-26"], "exact Gregorian day preserved");
  }
});

test("actual scheduled report fields retain associated labels, native time/email direction and raw edits", () => {
  for (const p of presentations) {
    const page = loaded("reports/schedules/page.tsx", { ...ready, dialogOpen: true, savedReports: [{ id: "report/001", name: caller }],
      frequency: "weekly", timeOfDay: "13:05", recipients: "a+001@example.com, b@example.com" });
    const html = page.render(p);
    for (const id of ["savedReportId", "frequency", "format", "dayOfWeek"])
      assert.ok(html.includes(`for="schedule-${id}"`) && html.includes(`id="schedule-${id}"`), `schedule ${id} is associated`);
    for (const id of ["timeOfDay", "recipients"]) {
      const field = page.controls.find(c => c.props.id === id);
      assert.ok(field, `native ${id} exists`); assert.equal(field.props.dir, "ltr", `${id} remains ordered`);
      (field.props.onChange as (e: unknown) => void)({ target: { value: " raw-value/001 " } });
      assert.deepEqual(page.events.at(-1), [id, " raw-value/001 "], "callback input is unchanged");
    }
  }
});

test("actual consolidation group selection and deletion are separate named native buttons", () => {
  for (const p of presentations) {
    const page = loaded("reports/consolidation/page.tsx", { ...ready, groups: [{ id: "group/001", name: caller, members: [] }], selectedGroupId: "group/001" });
    const html = page.render(p), buttons = [...html.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)].map(m => m[0]);
    assert.ok(buttons.every(s => !s.slice(7).includes("<button")), "no nested native buttons");
    const select = page.controls.find(c => c.type === "button" && c.props["aria-pressed"] === true);
    assert.ok(select, "group selection is a native pressed button");
    (select.props.onClick as () => void)(); assert.deepEqual(page.events.at(-1), ["selectedGroupId", "group/001"], "original selected id retained");
    assert.ok(html.includes(`>${esc(caller)}</bdi>`), "group caller isolated");
  }
});

test("actual custom and saved result cells isolate arbitrary caller text without changing raw Minor columns", () => {
  const cellCaller = "  \u0645\u0642\u062f\u0627\u0631 Cell <RAW/001> & " + "long-value-".repeat(30);
  const columns = ["contactName", "totalMinor"], results = [{ contactName: cellCaller, totalMinor: "-9007199254740001" }];
  const report = { id: "report/001", name: "Report name", config: { dataSource: "invoices", columns, filters: [], groupBy: [] } };
  for (const p of presentations) for (const route of ["custom", "saved"]) {
    const page = loaded(`reports/${route}/page.tsx`, { ...ready, builderOpen: true, runOpen: true, runReportItem: report,
      dataSource: "invoices", selectedColumns: columns, results });
    const html = page.render(p);
    assert.ok(html.includes(`>${esc(cellCaller)}</bdi>`), `${route} result caller is escaped, isolated and untrimmed`);
    assert.ok(html.includes('>-9007199254740001</bdi>'), `${route} raw Minor column keeps exact digits and sign`);
    assert.match(html, /<bdi[^>]*dir="ltr"[^>]*>-9007199254740001<\/bdi>/, `${route} raw Minor sign has an explicit LTR boundary`);
    assert.ok(!html.includes("<RAW/001>"), `${route} result caller is never raw markup`);
    if (route === "saved") assert.ok(html.includes('text-xs whitespace-normal [overflow-wrap:anywhere]'), "saved caller cells may wrap");
    assert.equal(results[0].totalMinor, "-9007199254740001", "projection input is unchanged");
  }
});

test("installed report utilities provide logical sticky/edge geometry, wrapping controls and chart text isolation", async () => {
  const compiler = await compile("@theme { --spacing: 0.25rem; } @tailwind utilities;");
  const css = compiler.build(["text-start", "text-end", "start-0", "end-3", "me-2", "ms-1", "border-e", "h-auto", "min-h-24", "flex-wrap",
    "grid-cols-[minmax(0,1fr)_340px]", "[overflow-wrap:anywhere]", "[&_text]:[unicode-bidi:plaintext]", "[&:dir(rtl)]:rotate-180",
    "[&_[data-slot=select-value]]:line-clamp-none", "[&_[data-slot=select-value]]:whitespace-normal"]);
  for (const declaration of ["text-align: start", "text-align: end", "inset-inline-start:", "inset-inline-end:", "margin-inline-end:", "margin-inline-start:",
    "border-inline-end-style:", "height: auto", "min-height:", "flex-wrap: wrap", "grid-template-columns: minmax(0,1fr) 340px", "overflow-wrap: anywhere", "unicode-bidi: plaintext", "rotate: 180deg", "-webkit-line-clamp: unset", "white-space: normal"])
    assert.ok(css.includes(declaration), declaration);
});
