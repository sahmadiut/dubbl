import { catalogText, visibleText } from "./helpers/catalog-text";
import assert from "node:assert/strict";
import { test } from "node:test";
import { createTranslator } from "next-intl";
import { report1099Ui, taxSummaryUi, vatReturnUi, reportResultMoney } from "../lib/money/report-result-ui";
import { generateCSV } from "../lib/import-export/csv-utils";
import { renderReportPage as render, has, flush, withIO } from "./helpers/report-page";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const locales = ["en-US", "fa-IR"] as const;
const routes = ["1099", "tax-summary", "vat-return"] as const;
const large = 9007199254740001n, caller = "<script>tax & name</script>";
const pair = (key: string, value: bigint) => ({ [key]: Number(value), [`${key}Minor`]: String(value) });
const ready = { initialLoad: false, loading: false, year: 2024, startDate: "2024-02-01", endDate: "2024-02-29", basis: "cash" };
const vendors = {
  currencyCode: "KWD", taxYear: 2024, reportableCount: 1, ...pair("threshold", 60000n), ...pair("reportableTotal", large), ...pair("grandTotal", large + 1n),
  vendors: [large, 1n].map((amount, i) => ({ contactId: `v${i}`, name: caller, taxIdentifier: i ? "TIN-001" : null, w9TaxClassification: "individual", backupWithholding: !i, paymentCount: 1, reportable: !i, ...pair("totalPaid", amount) })),
};
function summary(refund = false) {
  const output = refund ? 1001n : large, input = refund ? large : 1001n;
  return { currencyCode: "KWD", ...pair("totalOutputTax", output), ...pair("totalInputTax", input), ...pair("netTaxPayable", output - input),
    rates: [{ taxRateId: "rate", taxRateName: caller, rate: 2000, type: "sales", ...pair("outputTax", output), ...pair("outputNet", large), ...pair("inputTax", input), ...pair("inputNet", 1001n), ...pair("netTax", output - input) }] };
}
const vat = { currencyCode: "KWD", basis: "cash", period: { startDate: ready.startDate, endDate: ready.endDate },
  boxes: [large, 0n, large, 1n, large - 1n, 1001n, 0n, 0n, 0n].map((amount, i) => ({ box: String(i + 1), label: `${caller}-${i + 1}`, ...pair("amount", amount) })) };
const bodies = { "1099": vendors, "tax-summary": summary(), "vat-return": vat };
const readers = { "1099": report1099Ui, "tax-summary": taxSummaryUi, "vat-return": vatReturnUi };
function state(route: typeof routes[number]) { return { ...ready, data: readers[route](bodies[route]), expanded: new Set(vat.boxes.map(b => b.box)) }; }
const esc = (v: string) => v.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
const translator = (locale: typeof locales[number]) => createTranslator({ locale, messages: catalogText(locale === "en-US" ? en : fa), namespace: "TaxReports" });
function contains(html: string, value: string) { assert.ok(visibleText(html).includes(esc(value)), value); }

test("1099 production JSX translates all vendor copy and retains exact exported data and year callbacks", () => {
  for (const locale of locales) {
    const t = translator(locale), h = render("1099", state("1099"), locale);
    for (const key of ["vendorTitle", "vendorDescription", "vendorHelp", "taxYear", "needForm", "aboveThreshold", "reportableTotal", "threshold", "contractor", "taxId", "payments", "totalPaid", "needsForm", "backupWithholding", "missing", "fileForm", "belowThreshold"] as const) contains(h.html, t(key));
    contains(h.html, caller); assert.ok(!h.html.includes("<script>"));
    contains(h.html, reportResultMoney(large, "KWD", { locale, numerals: locale === "fa-IR" ? "arabext" : "latn" }));
    const exp = h.captured.find(c => c.kind === "ExportButton")!.props;
    assert.equal(exp.filename, "1099-2024");
    assert.deepEqual(exp.columns, ["name", "taxIdentifier", "totalPaid", "paymentCount", "reportable", "currencyCode"]);
    const rows = exp.data as Record<string, unknown>[];
    assert.equal(rows[0].totalPaid, String(large)); assert.equal(rows[0].reportable, true); assert.equal(rows[0].currencyCode, "KWD");
    assert.ok(generateCSV(rows, exp.columns as string[]).includes(String(large)));
    const year = h.captured.find(c => c.kind === "Button" && typeof (c.props.children as { props?: { children: unknown } })?.props?.children === "number");
    assert.ok(year, "actual year Button retains exact isolated numeric value");
    (year.props.onClick as () => void)(); assert.ok(has(h, "year", (year.props.children as { props: { children: number } }).props.children));
    const empty = render("1099", { ...ready, data: null }, locale);
    contains(empty.html, t("noContractors")); contains(empty.html, t("noContractorsHelp", { year: "2024" }));
  }
});

test("summary production JSX translates tax/refund states without losing currency precision or signed meaning", () => {
  for (const locale of locales) for (const refund of [false, true]) {
    const t = translator(locale);
    for (const currencyCode of ["USD", "KWD", "JPY", "IRR"]) {
      const data = taxSummaryUi({ ...summary(refund), currencyCode }), h = render("tax-summary", { ...ready, data }, locale);
      for (const key of ["summaryTitle", "summaryDescription", "summaryHelp", "openReturn", "outputTax", "inputTax", "taxRate", "rate", "salesBeforeTax", "taxCharged", "purchasesBeforeTax", "taxPaid", "oweRefund", "total", refund ? "refundOffice" : "oweOffice"] as const) contains(h.html, t(key));
      contains(h.html, t(refund ? "refundAmount" : "dueAmount", { amount: reportResultMoney(large - 1001n, currencyCode, { locale, numerals: locale === "fa-IR" ? "arabext" : "latn" }) }));
      contains(h.html, caller); assert.ok(h.html.includes('href="/reports/vat-return"') && !h.html.includes("<script>"));
      assert.ok(h.html.includes("20.00%"));
      const filter = h.captured.find(c => c.kind === "DateRangeFilter")!.props;
      (filter.onDateChange as (s: string, e: string) => void)("2024-01-01", "2024-01-31");
      assert.ok(has(h, "startDate", "2024-01-01") && has(h, "endDate", "2024-01-31"));
    }
    const empty = render("tax-summary", { ...ready, data: taxSummaryUi({ currencyCode: "KWD", rates: [], ...pair("totalOutputTax", 0n), ...pair("totalInputTax", 0n), ...pair("netTaxPayable", 0n) }) }, locale);
    contains(empty.html, t("noActivity"));
  }
});

test("VAT production JSX translates nine boxes and retains official labels, expansion, basis, raw and drill URLs", () => {
  for (const locale of locales) {
    const t = translator(locale), h = render("vat-return", state("vat-return"), locale);
    for (const key of ["returnTitle", "returnDescription", "returnHelp", "rawFigures", "drillDown"] as const) contains(h.html, t(key));
    for (const b of vat.boxes) {
      contains(h.html, t(`box${b.box}Title` as "box1Title")); contains(h.html, t(`box${b.box}Help` as "box1Help"));
      contains(h.html, t("officialLabel", { label: b.label }));
    }
    contains(h.html, reportResultMoney(large, "KWD", { locale, numerals: locale === "fa-IR" ? "arabext" : "latn" })); assert.ok(!h.html.includes("<script>"));
    assert.ok(h.html.includes('href="/api/v1/reports/vat-return?startDate=2024-02-01&amp;endDate=2024-02-29&amp;basis=cash"'));
    assert.equal((h.html.match(/href="\/reports\/tax-summary\?startDate=2024-02-01&amp;endDate=2024-02-29"/g) ?? []).length, 5);
    const buttons = h.captured.filter(c => c.kind === "button" && typeof c.props["aria-expanded"] === "boolean");
    assert.equal(buttons.length, 9); assert.ok(buttons.every(c => c.props["aria-expanded"] === true));
    (buttons[0].props.onClick as () => void)();
    const update = h.events.find(e => e[0] === "expanded")![1] as (s: Set<string>) => Set<string>;
    const opened = update(new Set()); assert.ok(opened.has("1")); assert.ok(!update(opened).has("1")); assert.ok(opened.has("1"));
    const closed = render("vat-return", { ...state("vat-return"), expanded: new Set() }, locale);
    assert.ok(!closed.html.includes(esc(t("box1Help"))));
    const basis = h.captured.find(c => c.kind === "BasisToggle")!.props;
    (basis.onChange as (s: string) => void)("accrual"); assert.ok(has(h, "basis", "accrual"));
    const filter = h.captured.find(c => c.kind === "DateRangeFilter")!.props;
    (filter.onDateChange as (s: string, e: string) => void)("2024-01-01", "2024-01-31"); assert.ok(has(h, "endDate", "2024-01-31"));
    contains(render("vat-return", { ...ready, data: null }, locale).html, t("noFigures"));
  }
});

test("tax report effects retain machine queries/org scope and reject unsafe responses before adoption", async () => {
  for (const locale of locales) for (const route of routes) for (const mode of ["ok", "http", "json", "envelope", "money", "network"]) {
    await withIO(async (url, init) => {
      const u = new URL(String(url), "https://local.test"); assert.equal(u.pathname, `/api/v1/reports/${route}`);
      assert.deepEqual(Object.fromEntries(u.searchParams), route === "1099" ? { year: "2024" } : { startDate: ready.startDate, endDate: ready.endDate, ...(route === "vat-return" ? { basis: "cash" } : {}) });
      assert.equal((init?.headers as Record<string, string>)["x-organization-id"], "org-a");
      if (mode === "network") throw new Error("private network"); if (mode === "json") return new Response("private JSON");
      const body = structuredClone(bodies[route]);
      if (mode === "money") { if ("grandTotalMinor" in body) body.grandTotalMinor = "1"; else if ("netTaxPayableMinor" in body) body.netTaxPayableMinor = "1"; else Object.assign((body as typeof vat).boxes[0], { amountMinor: "1" }); }
      return Response.json(mode === "envelope" ? { error: "private envelope" } : mode === "http" ? { error: "private server" } : body, { status: mode === "http" ? 403 : 200 });
    }, async () => {
      const h = render(route, state(route), locale); h.effects[0](); await flush();
      assert.ok(has(h, "loading", false) && has(h, "initialLoad", false)); assert.equal(has(h, "error", true), mode !== "ok");
      assert.equal(h.events.filter(([k, v]) => k === "data" && v !== null).length, mode === "ok" ? 1 : 0);
      assert.ok(!h.events.some(e => typeof e[1] === "string" && e[1].includes("private")));
    });
  }
});

test("localized loading/failure, URL date initialization, missing org and obsolete completion retain behavior", async () => {
  for (const locale of locales) for (const route of routes) {
    const t = translator(locale);
    contains(render(route, { ...ready, error: true }, locale).html, t("loadFailed"));
    for (const key of ["initialLoad", "loading"]) assert.ok(render(route, { ...ready, [key]: true }, locale).captured.some(c => c.kind === "BrandLoader"));
    for (const reject of [false, true]) await withIO(async () => { if (reject) throw new Error("obsolete"); return Response.json(bodies[route]); }, async () => {
      const h = render(route, state(route), locale), cleanup = h.effects[0](); assert.equal(typeof cleanup, "function"); if (cleanup) cleanup(); const count = h.events.length; await flush(); assert.equal(h.events.length, count);
    });
    await withIO(async () => { throw new Error("must not fetch"); }, async () => { const h = render(route, state(route), locale); assert.equal(h.effects[0](), undefined); assert.deepEqual(h.events, []); }, null);
  }
  await withIO(async () => Response.json(summary()), async () => {
    const h = render("tax-summary", { initialLoad: false });
    const filter = h.captured.find(c => c.kind === "DateRangeFilter")!.props;
    assert.equal(filter.startDate, "2023-01-01"); assert.equal(filter.endDate, "2023-12-31");
  }, "org-a", "?startDate=2023-01-01&endDate=2023-12-31");
});

test("paired Persian tax report messages contain Persian script", () => {
  assert.deepEqual(Object.keys(en.TaxReports), Object.keys(fa.TaxReports));
  for (const [key, value] of Object.entries(fa.TaxReports)) assert.match(value, /[\u0600-\u06ff]/, key);
});
