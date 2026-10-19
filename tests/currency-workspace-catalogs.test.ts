import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { createElement, type ComponentType, type ReactNode } from "react";
import * as React from "react";
import * as nextIntl from "next-intl";
import { createTranslator } from "next-intl";
import ts from "typescript";
import * as CurrencySelect from "../components/ui/currency-select";
import * as BrandLoader from "../components/dashboard/brand-loader";
import { taxUiMinor, taxUiCurrency, taxUiRate, taxUiRateInput, taxUiMoney } from "../lib/money/tax-ui";
import { renderWithPresentation } from "./helpers/presentation";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const path = "app/(dashboard)/tax/currencies/page.tsx";
const source = readFileSync(path, "utf8");
const locales = ["en-US", "fa-IR"] as const;
const noop = () => {};
const caller = '<script>ارز & data</script>';
const escape = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
const translator = (locale: typeof locales[number]) => createTranslator({ locale, messages: locale === "en-US" ? en : fa, namespace: "TaxCurrencies" });

// Production templates + real provider/shared controls; only hooks and portals
// are controlled. Inline content permits inspecting both sheet/collapsible bodies.
function loaded(states: unknown[] = []) {
  const require = createRequire(resolve(path));
  const compiled = { exports: {} as Record<string, ComponentType<Record<string, unknown>>> };
  let index = 0;
  const code = ts.transpileModule(source + "\nexport { CurrenciesWorkspace, AddCurrencySheet, AddRateSheet };", { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  const inline = ({ children }: { children: ReactNode }) => createElement("div", null, children);
  const load = (id: string) => {
    if (id === "react") return { ...React, useState: (initial: unknown) => [index < states.length ? states[index++] : typeof initial === "function" ? initial() : initial, noop], useEffect: noop };
    if (id === "next-intl") return nextIntl;
    if (id.endsWith("/currency-select")) return CurrencySelect;
    if (id.endsWith("/brand-loader")) return BrandLoader;
    if (id.endsWith("/use-document-title")) return { useDocumentTitle: noop };
    if (id.endsWith("/ui/sheet")) return Object.fromEntries(["Sheet", "SheetContent", "SheetHeader", "SheetTitle", "SheetFooter"].map(key => [key, inline]));
    if (id.endsWith("/ui/collapsible")) return Object.fromEntries(["Collapsible", "CollapsibleTrigger", "CollapsibleContent"].map(key => [key, inline]));
    return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  };
  new Function("require", "module", "exports", code)(load, compiled, compiled.exports);
  return compiled.exports;
}

// Extract actual authored callbacks, disambiguated by their owning component.
function callback(owner: string, name: string, scope: Record<string, unknown>) {
  const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let expression = "";
  function find(node: ts.Node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) expression = `(${node.getText(ast)})`;
    ts.forEachChild(node, find);
  }
  for (const node of ast.statements) if (ts.isFunctionDeclaration(node) && node.name?.text === owner) find(node);
  assert.ok(expression, `${owner}.${name}`);
  const code = ts.transpileModule(`const run = ${expression};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(scope), `${code}; return run;`)(...Object.values(scope));
}

const currencies = [0, 1, 2].map((decimalPlaces, i) => ({ id: `c-${i}`, code: ["JPY", "USD", "EUR"][i], name: caller, symbol: ["¥", "$", "€"][i], decimalPlaces }));
const rates = ["manual", "api"].map((source, i) => ({ id: `r-${i}`, baseCurrency: "USD", targetCurrency: "EUR", rate: 1234567, rateExact: "1.234567", date: "2026-10-18", source }));
const report = {
  defaultCurrency: "USD",
  summary: { totalItems: 3, missingRateItems: 1, totalUnrealizedGain: 1250n, totalUnrealizedLoss: 500n, netUnrealizedGainLoss: 750n },
  items: ["invoice", "bill", caller].map((type, i) => ({ id: `d-${i}`, type, number: caller, currencyCode: "JPY", amountDue: 1250n, unrealizedGainLoss: [1250n, -500n, null][i] })),
};
function renderPage(locale: typeof locales[number], options: { currencies?: unknown[]; rates?: unknown[]; loading?: boolean; search?: string; open?: boolean; error?: boolean; report?: unknown } = {}) {
  const Page = loaded([options.currencies ?? currencies, options.rates ?? rates, "USD", options.loading ?? false, false, options.search ?? "", false, false, options.open ?? true, options.error ?? false, options.report ?? report]).CurrenciesWorkspace;
  return renderWithPresentation(createElement(Page, { orgId: "org-a" }), locale);
}

test("currency workspace renders real bilingual copy, source labels, exact amounts/rates and escaped reference data", () => {
  for (const locale of locales) {
    const t = translator(locale);
    const html = renderPage(locale);
    for (const key of ["title", "description", "addCurrency", "addRate", "organizationCurrency", "baseHelp", "exchangeRates", "currencyPairs", "isoCurrencies", "fxTitle", "netUnrealized", "gains", "losses", "invoice", "bill", "manual", "auto", "manualHelp", "autoHelp", "reference", "hide", "filterPlaceholder"] as const) assert.ok(html.includes(escape(t(key))), key);
    for (const c of currencies) assert.ok(html.includes(escape(t("decimals", { count: c.decimalPlaces }))));
    assert.ok(html.includes(escape(t("missingRates", { count: 1 }))));
    assert.ok(html.includes(escape(t("fxEstimate", { currency: "USD" }))));
    assert.ok(html.includes(escape(t("amountDue", { amount: taxUiMoney(1250n, "JPY") }))));
    assert.ok(html.includes(escape(taxUiMoney(-500n, "USD"))) && html.includes("—"));
    assert.ok(html.includes("1.234567") && html.includes("USD") && html.includes("EUR"));
    assert.ok(html.includes(escape(caller)) && !html.includes("<script>"));
    assert.ok(html.includes("text-red-600") && html.includes("text-emerald-600"));
  }
});

test("loading, empty, report errors, search matches/no matches and reference toggle render in both locales", () => {
  for (const locale of locales) {
    const t = translator(locale);
    const loading = renderPage(locale, { loading: true });
    assert.ok(loading.includes(escape(t("title"))) && !loading.includes(escape(t("addRate"))));
    const empty = renderPage(locale, { currencies: [], rates: [], report: { ...report, summary: { ...report.summary, totalItems: 0 } }, open: false });
    for (const key of ["noRates", "noRatesHelp", "noCurrencies", "noCurrenciesHelp", "fxEmpty", "show"] as const) assert.ok(empty.includes(escape(t(key))), key);
    assert.ok(!empty.includes(escape(t("netUnrealized"))));
    const errors = renderPage(locale, { error: true, report: false });
    assert.ok(errors.includes('role="alert"') && errors.includes(escape(t("fxFailed"))));
    const matches = renderPage(locale, { search: "jPy" });
    assert.ok(matches.includes(escape(t("showing", { count: 1, total: 3 }))) && !matches.includes("€"));
    const noMatches = renderPage(locale, { search: caller + "missing" });
    assert.ok(noMatches.includes(escape(t("noMatches", { query: caller + "missing" }))) && noMatches.includes(escape(t("trySearch"))) && !noMatches.includes("<script>"));
    const symbol = renderPage(locale, { search: "€" });
    assert.ok(symbol.includes(escape(t("showing", { count: 1, total: 3 }))));
  }
});

test("both sheets render translated fields/busy controls and preserve numeric inputs and currency picker", () => {
  for (const locale of locales) for (const busy of [true, false]) {
    const t = translator(locale);
    const Currency = loaded(["JPY", caller, "¥", "0", busy]).AddCurrencySheet;
    const html = renderWithPresentation(createElement(Currency, { open: true, setOpen: noop, onCreated: noop }), locale);
    for (const key of ["addCurrency", "code", "name", "symbol", "decimalPlaces", "cancel", "codePlaceholder", "namePlaceholder", "symbolPlaceholder", busy ? "adding" : "addCurrency"] as const) assert.ok(html.includes(escape(t(key))), key);
    assert.equal(html.includes('disabled=""'), busy);
    assert.ok(html.includes('maxLength="3"') && html.includes('min="0"') && html.includes('max="4"') && html.includes(escape(caller)));
    const Rate = loaded(["USD", "JPY", "1.234567", "2026-10-18", busy]).AddRateSheet;
    const rate = renderWithPresentation(createElement(Rate, { open: true, setOpen: noop, onCreated: noop, orgId: "org-a" }), locale);
    for (const key of ["newRate", "baseCurrency", "targetCurrency", "rate", "rateHelp", "date", "cancel", busy ? "creating" : "create"] as const) assert.ok(rate.includes(escape(t(key))), key);
    assert.equal(rate.includes('disabled=""'), busy);
    assert.ok(rate.includes('step="0.000001"') && rate.includes('value="1.234567"') && rate.includes('value="2026-10-18"') && rate.includes('role="combobox"') && rate.includes("USD") && rate.includes("JPY"));
  }
});

test("actual currency create callback preserves POST values, success resets, retry inputs and localized failure fallback", async () => {
  for (const locale of locales) for (const mode of ["success", "status", "network", "empty"]) {
    const t = translator(locale); const events: unknown[] = []; let calls = 0;
    await callback("AddCurrencySheet", "handleCreate", {
      t, code: mode === "empty" ? "" : "JPY", name: caller, symbol: "¥", decimalPlaces: "0",
      setSaving: (v: boolean) => events.push(["saving", v]), setOpen: (v: boolean) => events.push(["open", v]), setCode: (v: string) => events.push(["code", v]), setName: (v: string) => events.push(["name", v]), setSymbol: (v: string) => events.push(["symbol", v]), setDecimalPlaces: (v: string) => events.push(["decimals", v]), onCreated: () => events.push("refresh"),
      toast: { success: (s: string) => events.push(s), error: (s: string) => events.push(s) },
      fetch: async (url: string, init: RequestInit) => {
        calls++; assert.equal(url, "/api/currencies"); assert.equal(init.method, "POST"); assert.deepEqual(init.headers, { "Content-Type": "application/json" });
        assert.deepEqual(JSON.parse(init.body as string), { code: "JPY", name: caller, symbol: "¥", decimalPlaces: 0 });
        if (mode === "network") throw new Error("private server prose");
        return new Response("private server prose", { status: mode === "status" ? 400 : 201 });
      },
    })();
    assert.equal(calls, mode === "empty" ? 0 : 1);
    assert.deepEqual(events, mode === "empty" ? [] : mode === "success" ? [["saving", true], t("currencyAdded"), ["open", false], ["code", ""], ["name", ""], ["symbol", ""], ["decimals", "2"], "refresh", ["saving", false]] : [["saving", true], t("currencyFailed"), ["saving", false]]);
  }
});

test("actual rate callback retains exact direction/date/org payload, guards and localized validation failures", async () => {
  for (const locale of locales) for (const mode of ["success", "status", "network", "precision", "zero", "no-org", "empty"]) {
    const t = translator(locale); const events: unknown[] = []; let calls = 0;
    await callback("AddRateSheet", "handleCreate", {
      t, orgId: mode === "no-org" ? null : "org-a", baseCurrency: "USD", targetCurrency: "JPY", rate: mode === "precision" ? "1.2345678" : mode === "zero" ? "0" : mode === "empty" ? "" : "1.234567", date: "2026-10-18", taxUiRateInput,
      setSaving: (v: boolean) => events.push(["saving", v]), setOpen: (v: boolean) => events.push(["open", v]), setBaseCurrency: (v: string) => events.push(["base", v]), setTargetCurrency: (v: string) => events.push(["target", v]), setRate: (v: string) => events.push(["rate", v]), setDate: (v: string) => { assert.match(v, /^\d{4}-\d{2}-\d{2}$/); events.push("reset-date"); }, onCreated: () => events.push("refresh"),
      toast: { success: (s: string) => events.push(s), error: (s: string) => events.push(s) },
      fetch: async (url: string, init: RequestInit) => {
        calls++; assert.equal(url, "/api/v1/exchange-rates"); assert.equal(init.method, "POST"); assert.deepEqual(init.headers, { "Content-Type": "application/json", "x-organization-id": "org-a" });
        assert.deepEqual(JSON.parse(init.body as string), { rates: [{ baseCurrency: "USD", targetCurrency: "JPY", rateExact: "1.234567", rateDirection: "quote_per_base", date: "2026-10-18", source: "manual" }] });
        if (mode === "network") throw new Error("private prose");
        return new Response("private prose", { status: mode === "status" ? 403 : 201 });
      },
    })();
    const guard = ["no-org", "empty"].includes(mode);
    assert.equal(calls, guard || ["precision", "zero"].includes(mode) ? 0 : 1);
    assert.deepEqual(events, guard ? [] : mode === "success" ? [["saving", true], t("rateCreated"), ["open", false], ["base", ""], ["target", ""], ["rate", ""], "reset-date", "refresh", ["saving", false]] : [["saving", true], t("rateFailed"), ["saving", false]]);
  }
});

test("list reads handle HTTP/JSON/envelope/network failures without adopting invalid data; exact rate aliases stay checked", async () => {
  for (const locale of locales) for (const name of ["fetchCurrencies", "fetchExchangeRates"]) for (const mode of ["success", "status", "json", "shape", "network", "alias", "no-org"]) {
    const t = translator(locale); const events: unknown[] = []; let calls = 0;
    const rows = name === "fetchCurrencies" ? currencies : rates;
    await callback("CurrenciesWorkspace", name, {
      t, orgId: mode === "no-org" ? null : "org-a", taxUiRate,
      setCurrencies: (v: unknown) => events.push(v), setExchangeRates: (v: unknown) => events.push(v), setLoading: (v: boolean) => events.push(v), setRatesLoading: (v: boolean) => events.push(v), toast: { error: (s: string) => events.push(s) },
      fetch: async (url: string, init?: RequestInit) => {
        calls++; assert.equal(url, name === "fetchCurrencies" ? "/api/currencies" : "/api/v1/exchange-rates");
        assert.deepEqual(init, name === "fetchCurrencies" ? undefined : { headers: { "x-organization-id": "org-a" } });
        if (mode === "network") throw new Error("private prose");
        if (mode === "json") return new Response("private prose");
        return Response.json({ [name === "fetchCurrencies" ? "currencies" : "data"]: mode === "shape" ? {} : mode === "alias" && name === "fetchExchangeRates" ? [{ ...rates[0], rateExact: "2" }] : rows }, { status: mode === "status" ? 403 : 200 });
      },
    })();
    const guard = name === "fetchExchangeRates" && mode === "no-org";
    const success = ["success", "no-org"].includes(mode) || (mode === "alias" && name === "fetchCurrencies");
    assert.equal(calls, guard ? 0 : 1);
    assert.deepEqual(events, guard ? [false] : success ? [rows, false] : name === "fetchCurrencies" ? [t("currenciesFailed"), false] : [[], t("ratesFailed"), false]);
  }
});

const wireReport = {
  defaultCurrency: "USD", summary: { totalItems: 2, missingRateItems: 1, totalUnrealizedGain: 1250, totalUnrealizedGainMinor: "1250", totalUnrealizedLoss: 500, totalUnrealizedLossMinor: "500", netUnrealizedGainLoss: 750, netUnrealizedGainLossMinor: "750" },
  items: [{ id: "doc-a", type: "invoice", number: caller, currencyCode: "JPY", amountDue: 1250, amountDueMinor: "1250", unrealizedGainLoss: null, unrealizedGainLossMinor: null }],
};
test("FX read preserves exact minor-unit conversion/nulls and rejects mismatched aliases, malformed and failed responses", async () => {
  for (const mode of ["success", "legacy", "valued", "status", "json", "shape", "network", "currency", "summary-alias", "item-alias", "no-org"]) {
    const events: unknown[] = []; let calls = 0;
    const wire = structuredClone(wireReport);
    if (mode === "legacy") {
      for (const k of ["totalUnrealizedGainMinor", "totalUnrealizedLossMinor", "netUnrealizedGainLossMinor"] as const) delete (wire.summary as Partial<typeof wire.summary>)[k];
      delete (wire.items[0] as Partial<typeof wire.items[number]>).amountDueMinor;
    }
    if (mode === "currency") wire.defaultCurrency = "XXX";
    if (mode === "summary-alias") wire.summary.netUnrealizedGainLossMinor = "751";
    if (mode === "item-alias") wire.items[0].amountDueMinor = "1251";
    if (mode === "valued") Object.assign(wire.items[0], { unrealizedGainLoss: -500, unrealizedGainLossMinor: "-500" });
    await callback("CurrenciesWorkspace", "fetchFxReport", {
      orgId: mode === "no-org" ? null : "org-a", taxUiCurrency, taxUiMinor,
      setFxReport: (v: unknown) => events.push(v), setFxError: (v: boolean) => events.push(v),
      fetch: async (url: string, init: RequestInit) => {
        calls++; assert.equal(url, "/api/v1/reports/unrealized-gains-losses"); assert.deepEqual(init, { headers: { "x-organization-id": "org-a" } });
        if (mode === "network") throw new Error("private prose");
        if (mode === "json") return new Response("private prose");
        return Response.json(mode === "shape" ? {} : wire, { status: mode === "status" ? 403 : 200 });
      },
    })();
    assert.equal(calls, mode === "no-org" ? 0 : 1);
    if (mode === "no-org") assert.deepEqual(events, []);
    else if (["success", "legacy", "valued"].includes(mode)) assert.deepEqual(events, [{ ...wire, summary: { ...wire.summary, totalUnrealizedGain: 1250n, totalUnrealizedLoss: 500n, netUnrealizedGainLoss: 750n }, items: [{ ...wire.items[0], amountDue: 1250n, unrealizedGainLoss: mode === "valued" ? -500n : null }] }, false]);
    else assert.deepEqual(events, [null, true]);
  }
});

test("organization reads retain scope and ignore unsuccessful/invalid responses", async () => {
  for (const mode of ["success", "status", "json", "network", "no-org"]) {
    const events: unknown[] = [];
    await callback("CurrenciesWorkspace", "fetchOrganization", {
      orgId: mode === "no-org" ? null : "org-a", setBaseCurrency: (v: string) => events.push(v),
      fetch: async (url: string, init: RequestInit) => {
        assert.equal(url, "/api/v1/organization"); assert.deepEqual(init, { headers: mode === "no-org" ? {} : { "x-organization-id": "org-a" } });
        if (mode === "network") throw new Error("private prose");
        if (mode === "json") return new Response("private prose");
        return Response.json({ organization: { defaultCurrency: "JPY" } }, { status: mode === "status" ? 403 : 200 });
      },
    })();
    assert.deepEqual(events, ["success", "no-org"].includes(mode) ? ["JPY"] : []);
  }
});

test("catalog plurals cover zero/one/many and owned authored display strings are fully extracted", () => {
  for (const locale of locales) {
    const t = translator(locale);
    for (const count of [0, 1, 2, 12]) for (const key of ["missingRates", "decimals", "showing"] as const) assert.ok(t(key, { count, total: count }).length > 0);
  }
  const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function visit(node: ts.Node) {
    if (ts.isJsxText(node)) assert.equal(node.text.trim(), "", node.text.trim());
    if (ts.isJsxAttribute(node) && ["title", "description", "placeholder", "aria-label", "alt"].includes(node.name.getText(ast)) && node.initializer && ts.isStringLiteral(node.initializer)) assert.equal(node.initializer.text, "1.234567");
    if (ts.isCallExpression(node) && /^(toast\.(success|error|info)|useDocumentTitle)$/.test(node.expression.getText(ast))) assert.ok(!node.arguments.some(ts.isStringLiteral), node.getText(ast));
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(!source.includes("err.message") && !source.includes("data.error"));
  assert.ok(source.includes('key={`${item.type}-${item.id}`}'));
  assert.equal(Object.keys(en.TaxCurrencies).length, 60);
  assert.deepEqual(Object.keys(en.TaxCurrencies), Object.keys(fa.TaxCurrencies));
  for (const value of Object.values(fa.TaxCurrencies)) assert.match(value, /[\u0600-\u06ff]/);
});
