import assert from "node:assert/strict";
import { test } from "node:test";
import { createTranslator } from "next-intl";
import { bankCashFlowUi, bankStatusUi, analyticalMoney } from "../lib/money/analytical-report-ui";
import { generateCSV } from "../lib/import-export/csv-utils";
import { renderReportPage as render, has, flush, withIO } from "./helpers/report-page";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const locales = ["en-US", "fa-IR"] as const;
const routes = ["bank-cash-flow", "bank-reconciliation-status"] as const;
const high = 9007199254740991n, caller = "<script>Bank & name</script>";
const pairs = (values: Record<string, bigint>) => Object.fromEntries(Object.entries(values).flatMap(([k, v]) => [[k, Number(v)], [`${k}Minor`, String(v)]]));
const cash = (currencyCode = "KWD") => ({ currencyCode,
  periods: [{ label: caller, startDate: "2024-01-01", endDate: "2024-01-31", ...pairs({ inflows: high, outflows: -1001n, net: high - 1001n, balance: high - 1001n }) }],
  totals: pairs({ inflows: high, outflows: -1001n, net: high - 1001n }) });
const account = (id: string, currencyCode: string, count = 1) => ({ id, accountName: caller, currencyCode, ...pairs({ balance: high, balanceDiscrepancy: 0n }),
  unreconciled: { count, ...pairs({ total: count ? high : 0n }), aging: Object.fromEntries(["week", "month", "twoMonths", "older"].map(k => [k, { count: k === "older" ? count : 0, ...pairs({ total: k === "older" && count ? high : 0n }) }])) },
  lastImport: { date: "2024-01-31T12:00:00Z", fileName: "import.csv" }, lastReconciliation: { endDate: "2024-01-30", status: "completed" },
  gaps: { hasGap: count > 0, gapStart: "2024-01-01", gapEnd: "2024-01-03", gapDays: 2 } });
const status = { accounts: [account("a", "KWD"), account("b", "KWD"), account("c", "JPY"), account("d", "USD", 0)] };
const ready = { initialLoad: false, loading: false, startDate: "2024-01-01", endDate: "2024-01-31", groupBy: "month", bankAccountId: "a" };
const esc = (v: string) => v.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
const contains = (html: string, v: string) => assert.ok(html.includes(esc(v)), v);

test("bank reports render all paired messages with exact money, separate currency totals and stable exports", () => {
  for (const locale of locales) {
    const messages = locale === "en-US" ? en : fa;
    const t = createTranslator({ locale, messages, namespace: "BankingReports" });
    const flow = render(routes[0], { ...ready, data: bankCashFlowUi(cash()), accounts: [{ id: "a", accountName: caller }] }, locale);
    const reconciliation = render(routes[1], { ...ready, data: bankStatusUi(status) }, locale);
    const emptyFlow = render(routes[0], { ...ready, data: bankCashFlowUi({ currencyCode: "USD", periods: [], totals: pairs({ inflows: 0n, outflows: 0n, net: 0n }) }) }, locale);
    const emptyStatus = render(routes[1], { ...ready, data: bankStatusUi({ accounts: [] }) }, locale);
    const errors = routes.map(route => render(route, { ...ready, error: true }, locale).html).join("");
    const html = [flow.html, reconciliation.html, emptyFlow.html, emptyStatus.html, errors].join("");
    for (const key of Object.keys(messages.BankingReports) as (keyof typeof en.BankingReports)[]) contains(html, t(key, { days: 2, count: 1 }));
    contains(flow.html, caller); assert.ok(!html.includes("<script>"));
    contains(flow.html, analyticalMoney(high, "KWD"));
    assert.ok(reconciliation.html.includes("18014398509481.982"));
    assert.ok(reconciliation.html.includes("9007199254740991"));
    assert.ok(reconciliation.html.includes('/accounting/banking/a/reconcile'));
    for (const [h, filename, columns] of [
      [flow, "bank-cash-flow", ["label", "currencyCode", "inflows", "outflows", "net", "balance"]],
      [reconciliation, "bank-tidy-up-status", ["accountName", "currencyCode", "balance", "toReviewCount", "toReviewTotal", "olderThan60Days", "lastReviewed", "lastImport"]],
    ] as const) {
      const exp = h.captured.find(c => c.kind === "ExportButton")!.props;
      assert.equal(exp.filename, filename); assert.deepEqual(exp.columns, columns);
      const csv = generateCSV(exp.data as Record<string, unknown>[], [...columns]);
      assert.ok(csv.includes(filename === "bank-cash-flow" ? "9007199254740991,-1001,9007199254739990" : "9007199254740.991"));
    }
    const selects = flow.captured.filter(c => c.kind === "select");
    assert.equal(selects[0].props["aria-label"], t("bankAccount"));
    (selects[0].props.onChange as (e: unknown) => void)({ target: { value: "c" } });
    (selects[1].props.onChange as (e: unknown) => void)({ target: { value: "week" } });
    assert.ok(has(flow, "bankAccountId", "c")); assert.ok(has(flow, "groupBy", "week"));
    const dates = flow.captured.find(c => c.kind === "DateRangeFilter")!.props;
    (dates.onDateChange as (s: string, e: string) => void)("2023-01-01", "2023-12-31");
    assert.ok(has(flow, "startDate", "2023-01-01")); assert.ok(has(flow, "endDate", "2023-12-31"));
  }
  for (const text of Object.values(fa.BankingReports)) assert.match(text, /[\u0600-\u06ff]/);
});

test("report effects retain org/filter contracts, checked adoption and cancellation", async () => {
  for (const route of routes) {
    const body = route === routes[0] ? cash() : status;
    for (const locale of locales) {
      await withIO(async (url, init) => {
        assert.equal((init!.headers as Record<string, string>)["x-organization-id"], "org-a");
        assert.ok(String(url).startsWith(`/api/v1/reports/${route}`));
        if (route === routes[0]) assert.ok(String(url).includes("startDate=2024-01-01&endDate=2024-01-31&groupBy=month&bankAccountId=a"));
        return Response.json(body);
      }, async () => {
        const h = render(route, ready, locale); h.effects.at(-1)!(); await flush();
        assert.ok(h.events.some(([k, v]) => k === "data" && v)); assert.ok(has(h, "error", false)); assert.ok(has(h, "loading", false));
      });
      for (const response of [() => Response.json({ error: "secret" }, { status: 403 }), () => new Response("invalid"), () => Response.json({ error: "secret" }), () => Response.json({ ...body, currencyCode: "ZZZ" }), () => { throw new Error("secret"); }]) {
        // Reconciliation has no root currency; corrupt its account alias instead.

        await withIO(async () => {
          const result = response();
          if (route === routes[1] && result.ok && result.headers.get("content-type")?.includes("json")) {
            const value = await result.clone().json();
            if (value.currencyCode === "ZZZ") return Response.json({ accounts: [{ ...status.accounts[0], balanceMinor: "01" }] });
          }
          return result;
        }, async () => {
          const h = render(route, ready, locale); h.effects.at(-1)!(); await flush();
          assert.ok(has(h, "data", null)); assert.ok(has(h, "error", true)); assert.ok(has(h, "initialLoad", false));
        });
      }
      await withIO(async () => Response.json(body), async () => {
        const h = render(route, ready, locale), cleanup = h.effects.at(-1)!();
        if (typeof cleanup === "function") cleanup(); await flush();
        assert.ok(!h.events.some(([k]) => k === "data" || k === "error" || k === "initialLoad"));
      });
    }
  }
});

