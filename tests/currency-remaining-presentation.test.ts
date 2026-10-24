import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderWithPresentation } from "./helpers/presentation";
import { renderReportPage, has, withIO, flush } from "./helpers/report-page";
import { TaxSettlementPreview } from "../components/dashboard/tax-settlement-preview";
import { DashboardPreview } from "../components/landing/dashboard-preview";
import { statementMoneyText } from "../lib/reports/statement-money";
import { authoredUsdText } from "../i18n/currency-labels";

const state = { initialLoad: false, loading: false, error: false, currencyCode: "IRR", currencyFilter: "IRR", startDate: "2026-01-01", endDate: "2026-12-31",
  totalRevenue: 9223372036854775807n, totalCosts: 1n, totalProfit: 9223372036854775806n, overallMargin: 1,
  entries: [{ contactId: "caller-id", contactName: "<script>Caller &</script>", revenue: 1250n, costs: 1251n, profit: -1n, margin: -1, invoiceCount: 1, billCount: 1 }] };

test("real report IRR display preserves exact signed int64 digits, escaping, ISO selectors and scoped query", async () => {
  const h = renderReportPage("profitability", state, "fa-IR");
  assert.ok(h.html.includes("ریال"));
  assert.ok(h.html.includes("۹٬۲۲۳٬۳۷۲٬۰۳۶٬۸۵۴٬۷۷۵٬۸۰۷"));
  assert.ok(h.html.includes("&lt;script&gt;Caller &amp;&lt;/script&gt;"));
  assert.ok(!h.html.includes("<script>"));
  const picker = h.captured.find(item => item.kind === "CurrencySelect")!;
  assert.equal(picker.props.value, "IRR");
  (picker.props.onValueChange as (code: string) => void)("KWD");
  assert.ok(has(h, "currencyFilter", "KWD"));
  let calls = 0;
  await withIO((async (url: string, init: RequestInit) => {
    const parsed = new URL(url, "http://local.test");
    assert.equal(parsed.pathname, "/api/v1/reports/profitability");
    assert.equal(parsed.searchParams.get("currencyCode"), "IRR");
    assert.equal((init.headers as Record<string, string>)["x-organization-id"], "org-a");
    calls++;
    return new Response(JSON.stringify({error: "unreviewed"}), {status: 400});
  }) as typeof fetch, async () => { for (const effect of h.effects) effect(); await flush(); });
  assert.equal(calls, 1);
  const english = renderReportPage("profitability", state, "en-US");
  assert.ok(english.html.includes("9,223,372,036,854,775,807"));
  assert.ok(english.html.includes("IRR"));
});

test("tax settlement real preview uses literal rial while preserving its currency parsing policy", () => {
  const html = renderWithPresentation(React.createElement(TaxSettlementPreview, {amount: "1250", currency: "IRR"}), "fa-IR");
  assert.ok(html.includes("ریال"));
  assert.ok(html.includes("۱٬۲۵۰"));
  assert.ok(!html.includes("IRR"));
});

test("explicit website presentation does not change default document/email money output", () => {
  const value = 9223372036854775807n;
  const before = statementMoneyText(value, "IRR");
  for (const numerals of ["latn", "arabext"] as const) {
    const text = statementMoneyText(value, "IRR", {locale: "fa-IR", numerals});
    assert.ok(text.includes("ریال"));
    assert.ok(text.includes(numerals === "arabext" ? "۹٬۲۲۳٬۳۷۲٬۰۳۶٬۸۵۴٬۷۷۵٬۸۰۷" : "9,223,372,036,854,775,807"));
    assert.equal(statementMoneyText(value, "IRR"), before);
  }
  assert.ok(before.includes("IRR"));
});

test("authored USD landing illustrations translate the unit without reinterpreting samples or percentages", () => {
  assert.equal(authoredUsdText("-$84.2k", "fa-IR"), "-دلار\u00a084.2k");
  assert.equal(authoredUsdText("50.3%", "fa-IR"), "50.3%");
  assert.equal(authoredUsdText("+$12,500", "en-US"), "+$12,500");
  const html = renderWithPresentation(React.createElement(DashboardPreview), "fa-IR");
  assert.ok(html.includes("دلار"));
  assert.ok(html.includes("84,200"));
  assert.ok(!html.includes("$84,200"));
  assert.ok(html.includes("TXN") || html.includes("Mar 01"));
});
