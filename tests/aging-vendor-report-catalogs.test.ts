import { displayNumberFixture } from "./helpers/localized-fixtures";
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createTranslator } from "next-intl";
import { receivablesUi, payablesUi, reportUiMoney } from "../lib/money/ledger-aging-ui";
import { vendorSpendUi, paymentPerformanceUi, duplicateDetectionUi, analyticalMoney } from "../lib/money/analytical-report-ui";
import { agingBucketLabel } from "../i18n/aging-vendor-report-presentation";
import { invoiceStatusLabel } from "../i18n/invoice-presentation";
import { billStatusLabel } from "../i18n/bill-presentation";
import { generateCSV } from "../lib/import-export/csv-utils";
import { renderReportPage as render, has, flush, withIO } from "./helpers/report-page";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const locales = ["en-US", "fa-IR"] as const;
const routes = ["aged-receivables", "aged-payables", "payment-performance", "vendor-spend", "duplicate-detection"] as const;
const escaped = (v: string) => v.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
const caller = "<script>caller & name</script>", large = 9007199254740001n;
const pair = (key: string, value: bigint) => ({ [key]: Number(value), [`${key}Minor`]: String(value) });
const ready = { initialLoad: false, loading: false, asAt: "2024-03-15", startDate: "2024-01-01", endDate: "2024-03-15", currencyFilter: "KWD", currencyCode: "KWD" };
function aging(kind: "invoices" | "bills", currencyCode = "KWD") {
  return { asAt: ready.asAt, currencyCode, ...pair("grandTotal", large), buckets: ["Current", "1-30 days", "31-60 days", "61-90 days", "90+ days"].map((label, i) => ({ label, count: i === 0 ? 1 : 0, ...pair("total", i === 0 ? large : 0n),
    [kind]: i === 0 ? [{ id: "doc", contactName: caller, dueDate: "2024-03-20", currencyCode, daysOverdue: 0, invoiceNumber: "INV-1", billNumber: "BILL-1", ...pair("amountDue", large) }] : [] })) };
}
const vendor = { currencyCode: "KWD", ...pair("totalSpend", large), vendors: [{ contactId: "v", contactName: caller, billCount: 1, lastBillDate: "2024-01-01", percentage: 100, ...pair("totalSpend", large), ...pair("avgBillAmount", large) }] };
const timing = { contactId: "c", contactName: caller, avgDays: 2, avgTermDays: 1, lateCount: 1, onTimeRate: 50 };
const performance = { currencyCode: "KWD", avgDaysToCollect: 2, avgDaysToPay: 3, receivables: [{ ...timing, invoiceCount: 2, ...pair("totalCollected", large) }], payables: [{ ...timing, billCount: 1, ...pair("totalPaid", 1001n) }] };
const group = { type: "invoice", contactName: caller, currencyCode: "KWD", ...pair("amount", large), items: ["a", "b"].map(id => ({ id, number: id, date: "2024-01-01", status: "sent" })) };
const duplicates = { totalGroups: 2, duplicateGroups: [group, { ...group, type: "bill", items: group.items.map(item => ({ ...item, status: "received" })) }] };
const bodies = { "aged-receivables": aging("invoices"), "aged-payables": aging("bills"), "payment-performance": performance, "vendor-spend": vendor, "duplicate-detection": duplicates };
function state(route: typeof routes[number]) {
  if (route === "aged-receivables") return { ...ready, data: receivablesUi(bodies[route]) };
  if (route === "aged-payables") return { ...ready, data: payablesUi(bodies[route]) };
  if (route === "payment-performance") { const data = paymentPerformanceUi(performance); return { ...ready, receivables: data.receivables, payables: data.payables, avgCollect: data.avgDaysToCollect, avgPay: data.avgDaysToPay }; }
  if (route === "vendor-spend") { const data = vendorSpendUi(vendor); return { ...ready, vendors: data.vendors, totalSpend: data.totalSpend }; }
  return { ...ready, groups: duplicateDetectionUi(duplicates).duplicateGroups };
}

test("aging production JSX translates buckets and counts while preserving exact money and CSV", () => {
  for (const locale of locales) for (const route of routes.slice(0, 2)) {
    const t = createTranslator({ locale, messages: locale === "en-US" ? en : fa, namespace: "AgingVendorReports" });
    const h = render(route, state(route), locale), isReceivable = route === "aged-receivables";
    for (const key of [isReceivable ? "receivablesTitle" : "payablesTitle", isReceivable ? "receivablesDescription" : "payablesDescription", "dueDate", "daysOverdue", "amountDue", "asOfLabel"] as const) assert.ok(h.html.includes(escaped(t(key))), key);
    for (const bucket of aging("invoices").buckets) assert.ok(h.html.includes(escaped(agingBucketLabel(t, bucket.label))));
    for (const count of [0, 1, 2]) assert.ok(t(isReceivable ? "invoiceCount" : "billCount", { count }));
    assert.ok(h.html.includes(escaped(t(isReceivable ? "invoiceCount" : "billCount", { count: 1 }))));
    assert.ok(h.html.includes(escaped(caller)) && !h.html.includes("<script>"));
    assert.ok(h.html.includes(escaped(reportUiMoney(large, "KWD", { locale, numerals: locale === "fa-IR" ? "arabext" : "latn" }))));
    const exp = h.captured.find(c => c.kind === "ExportButton")!.props;
    assert.equal(exp.filename, route);
    assert.deepEqual(exp.columns, [isReceivable ? "invoiceNumber" : "billNumber", "contactName", "dueDate", "daysOverdue", "currencyCode", "amountDueMinor", "bucket"]);
    const rows = exp.data as Record<string, unknown>[]; assert.equal(rows[0].amountDueMinor, String(large)); assert.equal(rows[0].bucket, "Current");
    assert.ok(generateCSV(rows, exp.columns as string[]).includes(String(large)));
    for (const currencyCode of ["USD", "JPY", "IRR", "KWD"]) {
      const data = isReceivable ? receivablesUi(aging("invoices", currencyCode)) : payablesUi(aging("bills", currencyCode));
      assert.ok(render(route, { ...ready, data }, locale).html.includes(escaped(reportUiMoney(large, currencyCode, { locale, numerals: locale === "fa-IR" ? "arabext" : "latn" }))));
    }
  }
});

test("vendor and timing JSX translate copy and day units without changing exported values", () => {
  for (const locale of locales) {
    const t = createTranslator({ locale, messages: locale === "en-US" ? en : fa, namespace: "AgingVendorReports" });
    for (const route of ["vendor-spend", "payment-performance"] as const) {
      const h = render(route, state(route), locale);
      for (const key of route === "vendor-spend" ? ["vendorTitle", "vendorDescription", "totalSpend", "avgBill", "lastBill", "documentCurrency", "clearFilter"] as const : ["perfTitle", "perfDescription", "customersPayYou", "youPaySuppliers", "onTime", "avgDays", "terms"] as const) assert.ok(h.html.includes(escaped(t(key))), key);
      assert.ok(h.html.includes(escaped(caller)) && !h.html.includes("<script>"));
      const exp = h.captured.find(c => c.kind === "ExportButton")!.props; assert.equal(exp.filename, route);
      const csv = generateCSV(exp.data as Record<string, unknown>[], exp.columns as string[]); assert.ok(csv.includes(String(large)) && csv.includes("KWD"));
      if (route === "payment-performance") {
        assert.ok(h.html.includes(escaped(t("dayValue", { days: 2 })))); assert.ok(h.html.includes(displayNumberFixture("9007199254740.001", locale)));
        assert.deepEqual((exp.data as { type: string }[]).map(row => row.type), ["receivable", "payable"]);
        assert.ok((exp.columns as string[]).includes("totalCollectedMinor"));
      } else assert.ok(h.html.includes(escaped(analyticalMoney(large, "KWD", { locale, numerals: locale === "fa-IR" ? "arabext" : "latn" }))));
      const filtered = h.captured.find(c => c.kind === "CurrencySelect")!.props; (filtered.onValueChange as (v: string) => void)("JPY"); assert.ok(has(h, "currencyFilter", "JPY"));
      const clear = h.captured.find(c => c.props.children === t("clearFilter"))!; (clear.props.onClick as () => void)(); assert.ok(has(h, "currencyFilter", ""));
      for (const mode of ["error", "loading"]) assert.deepEqual(render(route, { ...state(route), [mode]: true }, locale).captured.find(c => c.kind === "ExportButton")!.props.data, []);
    }
  }
});

test("duplicate badges localize known types/statuses and preserve navigation and escaped unknown data", () => {
  for (const locale of locales) {
    const messages = locale === "en-US" ? en : fa;
    const t = createTranslator({ locale, messages, namespace: "AgingVendorReports" });
    const ti = createTranslator({ locale, messages, namespace: "SalesInvoices" }), tb = createTranslator({ locale, messages, namespace: "SupplierBills" });
    const h = render("duplicate-detection", state("duplicate-detection"), locale);
    for (const text of [t("dupTitle"), t("dupDescription"), t("dupGroupCount", { count: 2 }), t("invoice"), t("bill"), invoiceStatusLabel(ti, "sent"), billStatusLabel("received", tb), caller]) assert.ok(h.html.includes(escaped(text)), text);
    const buttons = h.captured.filter(c => c.kind === "button"); (buttons[0].props.onClick as () => void)(); (buttons[2].props.onClick as () => void)();
    assert.ok(has(h, "push", "/sales/a") && has(h, "push", "/purchases/a"));
    const unknown = render("duplicate-detection", { ...ready, groups: [{ ...duplicateDetectionUi(duplicates).duplicateGroups[0], items: group.items.map(item => ({ ...item, status: caller })) }] }, locale);
    assert.ok(unknown.html.includes(escaped(caller)) && !unknown.html.includes("<script>"));
  }
});

test("effects preserve canonical queries and org headers and reject failures before adoption", async () => {
  for (const route of routes) for (const mode of ["ok", "http", "json", "envelope", "money", "network"]) {
    await withIO(async (url, init) => {
      const u = new URL(String(url), "https://local.test"); assert.equal(u.pathname, `/api/v1/reports/${route}`);
      assert.deepEqual(Object.fromEntries(u.searchParams), route.startsWith("aged-") ? { asAt: ready.asAt } : route === "duplicate-detection" ? {} : { startDate: ready.startDate, endDate: ready.endDate, currencyCode: "KWD" });
      assert.equal((init?.headers as Record<string, string>)["x-organization-id"], "org-a");
      if (mode === "network") throw new Error("private failure"); if (mode === "json") return new Response("private JSON");
      const body = JSON.parse(JSON.stringify(bodies[route]));
      if (mode === "money") { if (route.startsWith("aged-")) body.grandTotalMinor = "1"; else if (route === "vendor-spend") body.totalSpendMinor = "1"; else if (route === "payment-performance") body.receivables[0].totalCollectedMinor = "1"; else body.duplicateGroups[0].amountMinor = "1"; }
      return Response.json(mode === "envelope" ? {} : mode === "http" ? { error: "private server" } : body, { status: mode === "http" ? 403 : 200 });
    }, async () => {
      const h = render(route, state(route)); h.effects[0](); await flush();
      assert.ok(has(h, "loading", false) && has(h, "initialLoad", false)); assert.equal(has(h, "error", true), mode !== "ok");
      const adopted = route.startsWith("aged-") ? "data" : route === "payment-performance" ? "receivables" : route === "vendor-spend" ? "vendors" : "groups";
      const values = h.events.filter(([key, value]) => key === adopted && value !== null && (!Array.isArray(value) || value.length > 0)); assert.equal(values.length, mode === "ok" ? 1 : 0);
      assert.ok(!h.events.some(e => typeof e[1] === "string" && e[1].includes("private")));
    });
  }
});

test("loading, empty and localized failure states render; callbacks and cleanup retain behavior", async () => {
  for (const locale of locales) for (const route of routes) {
    const t = createTranslator({ locale, messages: locale === "en-US" ? en : fa, namespace: "AgingVendorReports" });
    assert.ok(render(route, { ...ready, error: true }, locale).html.includes(escaped(t("loadFailed"))));
    assert.ok(render(route, { ...ready, initialLoad: true }, locale).captured.some(c => c.kind === "BrandLoader"));
    assert.ok(render(route, { ...ready, loading: true }, locale).captured.some(c => c.kind === "BrandLoader"));
    const emptyKey = { "aged-receivables": "noReceivables", "aged-payables": "noPayables", "vendor-spend": "noVendorData", "payment-performance": "noPerfData", "duplicate-detection": "noDuplicates" } as const;
    const emptyData = route.startsWith("aged-") ? { ...aging(route === "aged-receivables" ? "invoices" : "bills"), ...pair("grandTotal", 0n), buckets: aging("invoices").buckets.map(b => ({ ...b, count: 0, ...pair("total", 0n), invoices: [], bills: [] })) } : null;
    const emptyState = emptyData ? { ...ready, data: receivablesUi(emptyData) } : ready;
    assert.ok(render(route, emptyState, locale).html.includes(escaped(t(emptyKey[route]))));
    const h = render(route, state(route), locale);
    if (route.startsWith("aged-")) { (h.captured.find(c => c.kind === "DatePicker")!.props.onChange as (v: string) => void)("2024-02-29"); assert.ok(has(h, "asAt", "2024-02-29")); }
    else if (route !== "duplicate-detection") { (h.captured.find(c => c.kind === "DateRangeFilter")!.props.onDateChange as (s: string, e: string) => void)("2024-02-01", "2024-02-29"); assert.ok(has(h, "endDate", "2024-02-29")); }
    for (const reject of [false, true]) await withIO(async () => { if (reject) throw new Error("obsolete"); return Response.json(bodies[route]); }, async () => {
      const old = render(route, state(route), locale); const cleanup = old.effects[0](); assert.equal(typeof cleanup, "function"); if (cleanup) cleanup(); const count = old.events.length; await flush(); assert.equal(old.events.length, count);
    });
    await withIO(async () => { throw new Error("must not fetch"); }, async () => { const missing = render(route, state(route), locale); assert.equal(missing.effects[0](), undefined); assert.equal(missing.events.length, 0); }, null);
  }
});

test("new Persian messages use Persian script and every page retains request cleanup", () => {
  for (const [key, value] of Object.entries(fa.AgingVendorReports)) if (key !== "percentage") assert.match(value, /[\u0600-\u06ff]/, key);
  for (const route of routes) assert.ok(readFileSync(`app/(dashboard)/reports/${route}/page.tsx`, "utf8").includes("cancelled = true"));
});
