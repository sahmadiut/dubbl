import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { createTranslator } from "next-intl";
import { cashForecastUi, financialCalendarUi, analyticalMoney } from "../lib/money/analytical-report-ui";
import { renderReportPage as render, has, flush, withIO, type Harness } from "./helpers/report-page";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const locales = ["en-US", "fa-IR"] as const;
const routes = ["cash-flow-forecast", "financial-calendar"] as const;
const large = 9007199254740001n, caller = "<script>caller & name</script>";
const pairs = (values: Record<string, bigint>) => Object.fromEntries(Object.entries(values).flatMap(([key, value]) => [[key, Number(value)], [`${key}Minor`, String(value)]]));
const forecast = { currencyCode: "KWD", forecastPeriod: { start: "2024-02-04", end: "2024-02-11", weeks: 1 },
  ...pairs({ totalInflows: large, totalOutflows: 1n, netForecast: large - 1n }),
  weeks: [{ weekOf: "2024-02-04", entryCount: 2, ...pairs({ inflows: large, outflows: 1n, net: large - 1n, cumulativeNet: large - 1n }) }] };
const types = ["invoice_due", "bill_due", "recurring_generation", "budget_period_start"] as const;
const calendar = { events: types.map((type, i) => ({ type, date: "2024-02-29", title: caller, id: String(i), currencyCode: i === 1 ? "JPY" : "KWD", ...pairs({ amount: i === 1 ? -1n : large }) })) };
const ready = { initialLoad: false, loading: false, currencyCode: "KWD", currencyFilter: "KWD", weeksAhead: 12, currentMonth: new Date(2024, 1, 1) };
const state = (route: typeof routes[number]) => route === "cash-flow-forecast" ? { ...ready, ...cashForecastUi(forecast) } : { ...ready, ...financialCalendarUi(calendar), selectedDate: "2024-02-29" };
const tFor = (locale: typeof locales[number]) => createTranslator({ locale, messages: locale === "en-US" ? en : fa, namespace: "ForecastCalendarReports" });
const escape = (s: string) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
const text = (h: Harness, value: string) => assert.ok(h.html.includes(escape(value)), value);

test("forecast production JSX localizes copy, options and controls with exact chart carriers", () => {
  for (const locale of locales) {
    const t = tFor(locale), h = render("cash-flow-forecast", state("cash-flow-forecast"), locale);
    for (const key of ["forecastTitle", "forecastDescription", "clearFilter", "estimateHelp", "expectedIn", "expectedOut", "expectedChange", "cumulativeCashFlow", "weeklyBreakdown", "weekOf", "inflows", "outflows", "net", "cumulative"] as const) text(h, t(key));
    text(h, analyticalMoney(large, "KWD")); text(h, analyticalMoney(1n, "KWD")); text(h, "2024-02-04");
    assert.ok(h.html.includes('href="/reports"'));
    const options = h.captured.filter(c => c.kind === "SelectItem").map(c => c.props);
    assert.deepEqual(options.map(p => p.value), ["4", "8", "12", "26", "52"]);
    assert.deepEqual(options.map(p => p.children), [4, 8, 12, 26, 52].map(count => t("weeks", { count })));
    (h.captured.find(c => c.kind === "Select")!.props.onValueChange as (v: string) => void)("26"); assert.ok(has(h, "weeksAhead", 26));
    (h.captured.find(c => c.kind === "CurrencySelect")!.props.onValueChange as (v: string) => void)("JPY"); assert.ok(has(h, "currencyFilter", "JPY"));
    (h.captured.find(c => c.props.children === t("clearFilter"))!.props.onClick as () => void)(); assert.ok(has(h, "currencyFilter", ""));
    const chart = h.captured.find(c => Array.isArray(c.props.data) && (c.props.data[0] as { minor?: unknown })?.minor)!.props;
    const point = (chart.data as { minor: ReturnType<typeof cashForecastUi>["weeks"][number] }[])[0];
    assert.equal(point.minor.inflows, large);
    const tooltip = h.captured.find(c => c.props.formatter)!.props.formatter as (v: number, name: string, item: unknown) => unknown;
    for (const [dataKey, key, amount] of [["inflows", "inflows", large], ["outflows", "outflows", 1n], ["cumulative", "cumulativeNet", large - 1n]] as const) {
      assert.equal(h.captured.find(c => c.props.dataKey === dataKey)!.props.name, t(key));
      assert.deepEqual(tooltip(0, t(key), { dataKey, payload: point }), [analyticalMoney(amount, "KWD"), t(key)]);
      assert.deepEqual(tooltip(0, "arbitrary display name", { dataKey, payload: point }), [analyticalMoney(amount, "KWD"), "arbitrary display name"]);
    }
    const signed = render("cash-flow-forecast", { ...state("cash-flow-forecast"), netForecast: -1n, weeks: [{ ...point.minor, inflows: 0n, outflows: 1n, net: -1n, cumulativeNet: -1n }] }, locale);
    text(signed, analyticalMoney(-1n, "KWD")); assert.ok(signed.html.includes("text-red-600"));
  }
});

test("calendar production JSX localizes event kinds, weekdays, overflow and accessible navigation", () => {
  for (const locale of locales) {
    const t = tFor(locale), h = render("financial-calendar", state("financial-calendar"), locale);
    for (const key of ["calendarTitle", "calendarDescription", "today", "invoiceDue", "billDue", "recurring", "budgetPeriod", "allEvents", "sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const) text(h, t(key));
    text(h, t("moreEvents", { count: 1 })); text(h, caller); assert.ok(!h.html.includes("<script>"));
    text(h, analyticalMoney(large, "KWD")); text(h, analyticalMoney(-1n, "JPY"));
    assert.ok(h.html.includes('href="/reports"'));
    for (const [key, year, month] of [["previousMonth", 2024, 0], ["nextMonth", 2024, 2]] as const) {
      (h.captured.find(c => c.props["aria-label"] === t(key))!.props.onClick as () => void)();
      assert.ok(h.events.some(([name, value]) => name === "currentMonth" && value instanceof Date && value.getFullYear() === year && value.getMonth() === month && value.getDate() === 1));
    }
    (h.captured.find(c => c.props.children === t("today"))!.props.onClick as () => void)();
    const now = new Date(); assert.ok(h.events.some(([key, value]) => key === "currentMonth" && value instanceof Date && value.getMonth() === now.getMonth() && value.getFullYear() === now.getFullYear()));
    const days = h.captured.filter(c => c.kind === "button" && typeof c.props.onClick === "function");
    assert.equal(days.length, 29);
    (days[28].props.onClick as () => void)(); assert.ok(has(h, "selectedDate", null));
    (days[0].props.onClick as () => void)(); assert.ok(has(h, "selectedDate", "2024-02-01"));
    text(render("financial-calendar", { ...state("financial-calendar"), selectedDate: null }, locale), t("selectDate"));
    text(render("financial-calendar", { ...state("financial-calendar"), selectedDate: "2024-02-01" }, locale), t("noEvents"));
    const rollover = render("financial-calendar", { ...ready, currentMonth: new Date(2024, 11, 1) }, locale);
    (rollover.captured.find(c => c.props["aria-label"] === t("nextMonth"))!.props.onClick as () => void)();
    assert.ok(rollover.events.some(([key, value]) => key === "currentMonth" && value instanceof Date && value.getFullYear() === 2025 && value.getMonth() === 0));
  }
});

test("empty, loading and finite failure states render in both locales", () => {
  for (const locale of locales) {
    const t = tFor(locale);
    text(render("cash-flow-forecast", { ...ready, weeks: [] }, locale), t("noForecast"));
    for (const route of routes) {
      const error = render(route, { ...state(route), error: true }, locale); text(error, t(route === "cash-flow-forecast" ? "forecastLoadError" : "calendarLoadError"));
      assert.ok(error.html.includes('role="alert"'));
      for (const initialLoad of [true, false]) {
        const loading = render(route, { ...ready, initialLoad, loading: true }, locale);
        assert.ok(loading.html.includes('class="brand-loader"'));
        assert.ok(loading.html.includes(`aria-label="${escape((locale === "en-US" ? en : fa).SharedUI.loading2)}"`));
      }
    }
  }
});

test("checked report effects preserve canonical queries and org scope and reject unsafe responses before adoption", async () => {
  for (const route of routes) for (const mode of ["ok", "http", "json", "money", "network"] as const) {
    await withIO(async (url, init) => {
      const parsed = new URL(String(url), "http://localhost"); assert.equal(parsed.pathname, `/api/v1/reports/${route}`);
      assert.deepEqual(Object.fromEntries(parsed.searchParams), route === "cash-flow-forecast" ? { weeks: "12", currencyCode: "KWD" } : { startDate: "2024-02-01", endDate: "2024-02-29" });
      assert.equal((init?.headers as Record<string, string>)["x-organization-id"], "org-a");
      if (mode === "network") throw new Error("private network"); if (mode === "json") return new Response("private JSON");
      const body = structuredClone(route === "cash-flow-forecast" ? forecast : calendar);
      if (mode === "money") { if ("totalInflowsMinor" in body) body.totalInflowsMinor = "1"; else body.events[0].amountMinor = "1"; }
      return Response.json(mode === "http" ? { error: "private server" } : body, { status: mode === "http" ? 403 : 200 });
    }, async () => {
      const h = render(route, state(route)); h.effects[0](); await flush();
      assert.ok(has(h, "error", mode !== "ok")); assert.ok(has(h, "loading", false)); assert.ok(has(h, "initialLoad", false));
      const dataKey = route === "cash-flow-forecast" ? "weeks" : "events";
      assert.equal(h.events.filter(([key, value]) => key === dataKey && Array.isArray(value) && value.length > 0).length, mode === "ok" ? 1 : 0);
      assert.ok(!h.events.some(([, value]) => typeof value === "string" && value.includes("private")));
    });
  }
});

test("cancelled requests never adopt data or reset active state and missing org makes no request", async () => {
  for (const route of routes) {
    for (const reject of [false, true]) {
      let resolve!: (r: Response) => void, fail!: (e: Error) => void;
      await withIO(() => new Promise<Response>((yes, no) => { resolve = yes; fail = no; }), async () => {
        const h = render(route, state(route)), cleanup = h.effects[0](); assert.equal(typeof cleanup, "function"); (cleanup as () => void)();
        const before = h.events.length;
        if (reject) fail(new Error("private")); else resolve(Response.json(route === "cash-flow-forecast" ? forecast : calendar));
        await flush(); assert.equal(h.events.length, before);
      });
    }
    await withIO(async () => { throw new Error("unexpected request"); }, async () => {
      const h = render(route, ready); h.effects[0](); await flush(); assert.deepEqual(h.events, []);
    }, null);
  }
});

test("scoped JSX has no unexplained authored text and paired messages contain Persian script", () => {
  assert.deepEqual(Object.keys(en.ForecastCalendarReports), Object.keys(fa.ForecastCalendarReports));
  for (const value of Object.values(fa.ForecastCalendarReports)) assert.match(value, /[\u0600-\u06ff]/);
  for (const route of routes) {
    const source = readFileSync(`app/(dashboard)/reports/${route}/page.tsx`, "utf8");
    const ast = ts.createSourceFile(route, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(n: ts.Node) { if (ts.isJsxText(n)) assert.equal(n.text.trim(), ""); ts.forEachChild(n, visit); }
    visit(ast); assert.ok(!source.includes("err.message"));
  }
});
