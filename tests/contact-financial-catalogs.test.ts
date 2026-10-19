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
import { renderWithPresentation } from "./helpers/presentation";
import * as money from "../lib/money/contact-dashboard-ui";
import { activityStatusKey, statementTypeKey } from "../lib/i18n/contact-financial-presentation";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const base = "app/(dashboard)/contacts/[id]/";
const bookkeeping = base + "bookkeeping/page.tsx", activity = base + "activity/page.tsx", statement = base + "statement/page.tsx";
const locales = ["en-US", "fa-IR"] as const;
const noop = () => {};
const caller = '<script>مخاطب & reference</script>';
const raw = { id: "contact-a", name: caller, email: "contact@example.test", phone: null, taxNumber: null, type: "both", paymentTermsDays: 45,
  creditLimit: 9007199254740991, creditLimitMinor: "9007199254740991", currencyCode: "USD", isTaxExempt: true,
  defaultRevenueAccountId: "revenue-a", defaultExpenseAccountId: null, defaultTaxRateId: null, notes: caller };
const contact = money.contactDetailUi(raw);
const context = { contact, formType: "both", formCreditLimit: "90071992547409.91", formCurrencyCode: "USD", formTaxExempt: true,
  formRevenueAccountId: "revenue-a", formExpenseAccountId: "none", formTaxRateId: "none", saving: false,
  ...Object.fromEntries(["setContact", "setFormType", "setFormRevenueAccountId", "setFormExpenseAccountId", "setFormTaxRateId", "setSaving"].map(k => [k, noop])) };
type Namespace = "ContactBookkeeping" | "ContactActivity" | "ContactStatement";
function translator(locale: typeof locales[number], namespace: Namespace) { return createTranslator({ locale, messages: locale === "en-US" ? en : fa, namespace }); }
function escape(value: string) { return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;"); }
function parse(path: string) { return ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX); }
type Captured = { kind: string; props: Record<string, unknown> };

// Real production templates and provider. Hook state/navigation are controlled;
// portal controls expose their production children for option/callback checks.
function loaded(path: string, states: Record<string, unknown> = {}, captured: Captured[] = [], events: unknown[] = []) {
  const ast = parse(path), names: string[] = [];
  function hooks(n: ts.Node) {
    if (ts.isVariableDeclaration(n) && ts.isArrayBindingPattern(n.name) && n.initializer && ts.isCallExpression(n.initializer) && n.initializer.expression.getText(ast) === "useState") names.push(n.name.elements[0].getText(ast));
    ts.forEachChild(n, hooks);
  }
  hooks(ast);
  const inline = (kind: string) => function Control(props: Record<string, unknown>) {
    captured.push({ kind, props });
    return createElement("div", { "data-control": kind }, props.children as ReactNode, typeof props.placeholder === "string" ? props.placeholder : null);
  };
  let index = 0;
  const require = createRequire(resolve(path)), compiled = { exports: {} as Record<string, ComponentType> };
  const load = (id: string) => {
    if (id === "react") return { ...React, useState: (initial: unknown) => { const key = names[index++]; return [Object.hasOwn(states, key) ? states[key] : initial, (v: unknown) => events.push([key, v])]; }, useRef: (current: unknown) => ({ current }), useEffect: noop, useCallback: (fn: unknown) => fn };
    if (id === "next-intl") return nextIntl;
    if (id === "next/navigation") return { useParams: () => ({ id: "contact-a" }), useRouter: () => ({ push: (v: string) => events.push(v) }) };
    if (id === "../layout") return { getOrgId: () => "org-a", useContactContext: () => ({ ...context, ...states }), activityTypeConfig: loadedLayout().activityTypeConfig };
    for (const [suffix, keys] of Object.entries({ "/ui/select": ["Select", "SelectContent", "SelectItem", "SelectTrigger", "SelectValue"], "/ui/date-picker": ["DatePicker"], "/ui/currency-select": ["CurrencySelect"] })) if (id.endsWith(suffix)) return Object.fromEntries(keys.map(key => [key, inline(key)]));
    return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  };
  const code = ts.transpileModule(ast.text, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function("require", "module", "exports", code)(load, compiled, compiled.exports);
  return compiled.exports.default;
}

// Evaluate the actual shared configuration without importing layout dependencies.
function loadedLayout() {
  const ast = parse(base + "layout.tsx"); let config = "";
  function visit(n: ts.Node) { if (ts.isVariableDeclaration(n) && n.name.getText(ast) === "activityTypeConfig") config = n.initializer!.getText(ast); ts.forEachChild(n, visit); }
  visit(ast);
  const icons = ["FileText", "ScrollText", "CreditCard", "Banknote", "Receipt"];
  return { activityTypeConfig: new Function(...icons, `return (${config});`)(...icons.map(() => () => null)) as Record<string, { labelKey: string; href: (id: string) => string }> };
}
function callback(path: string, name: string, scope: Record<string, unknown>) {
  const ast = parse(path); let expression = "";
  function visit(n: ts.Node) {
    if (ts.isFunctionDeclaration(n) && n.name?.text === name) expression = n.getText(ast);
    if (ts.isVariableDeclaration(n) && n.name.getText(ast) === name && n.initializer && ts.isCallExpression(n.initializer)) expression = n.initializer.arguments[0].getText(ast);
    if (ts.isJsxAttribute(n) && n.name.getText(ast) === "onClick" && n.initializer && ts.isJsxExpression(n.initializer) && n.initializer.expression) {
      const body = n.initializer.expression.getText(ast);
      if ((name === "clear" && body.includes('Date("")')) || (name === "navigate" && body.includes("router.push"))) expression = body;
    }
    ts.forEachChild(n, visit);
  }
  visit(ast); assert.ok(expression, name);
  const code = ts.transpileModule(`const run = ${expression};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(scope), `${code}; return run;`)(...Object.values(scope));
}
const flush = async () => { for (let i = 0; i < 8; i++) await new Promise(resolve => setImmediate(resolve)); };

test("bookkeeping translates production fields, preserves account options, callbacks and busy state", () => {
  for (const locale of locales) for (const saving of [false, true]) {
    const t = translator(locale, "ContactBookkeeping"), captured: Captured[] = [];
    const Page = loaded(bookkeeping, { saving, accounts: [{ id: "revenue-a", code: "4000", name: caller, type: "revenue" }, { id: "expense-a", code: "5000", name: caller, type: "expense" }, { id: "asset-a", type: "asset" }], taxRates: [{ id: "tax-a", name: caller, rate: 1250 }] }, captured);
    const html = renderWithPresentation(createElement(Page), locale);
    for (const key of ["accounts", "accountsDescription", "income", "expense", "selectAccount", "none", "tax", "taxDescription", "selectTax", "save"] as const) assert.ok(html.includes(escape(t(key))), key);
    assert.deepEqual(captured.filter(c => c.kind === "SelectItem").map(c => c.props.value), ["none", "revenue-a", "none", "expense-a", "none", "tax-a"]);
    assert.ok(html.includes(escape(caller)) && !html.includes("<script>") && html.includes("12.5%"));
    if (saving) assert.ok(html.includes('disabled=""'));
  }
});

test("activity renders translated filters, empty/loading states, every type/status and exact amounts", () => {
  const statuses = ["draft", "sent", "partial", "paid", "overdue", "void", "pending_approval", "rejected", "accepted", "declined", "expired", "converted", "applied", "received", "made", "constructor", "__proto__", caller];
  for (const locale of locales) {
    const t = translator(locale, "ContactActivity"), captured: Captured[] = [], events: unknown[] = [];
    const Empty = loaded(activity, {}, captured);
    const html = renderWithPresentation(createElement(Empty), locale);
    for (const key of ["all", "invoices", "quotes", "creditNotes", "payments", "bills", "from", "to", "empty", "emptyHint"] as const) assert.ok(html.includes(escape(t(key))), key);
    assert.deepEqual(captured.filter(c => c.kind === "SelectItem").map(c => c.props.value), ["all", "invoice", "quote", "credit_note", "payment", "bill"]);
    const Filtered = loaded(activity, { activityTypeFilter: "bill" });
    assert.ok(renderWithPresentation(createElement(Filtered), locale).includes(escape(t("adjust"))));
    const Loading = loaded(activity, { activityLoading: true });
    assert.ok(renderWithPresentation(createElement(Loading), locale).includes(`aria-label="${escape(t("loading"))}"`));
    const types = Object.keys(loadedLayout().activityTypeConfig);
    const items = statuses.map((status, i) => ({ id: `row-${i}`, type: types[i % types.length], number: caller, status, date: "2026-10-19", amount: 9007199254740991n, currencyCode: ["USD", "JPY", "KWD"][i % 3] }));
    const List = loaded(activity, { activityItems: items, activityStartDate: "2026-01-01", activityLoadingMore: true }, [], events);
    const list = renderWithPresentation(createElement(List), locale);
    for (const status of statuses) assert.ok(list.includes(escape(t(activityStatusKey(status)))));
    for (const item of items) assert.ok(list.includes(escape(money.displayMoney(item.amount, item.currencyCode)))) ;
    assert.ok(list.includes(escape(caller)) && !list.includes("<script>"));
    for (const type of types) {
      const config = loadedLayout().activityTypeConfig[type];
      assert.ok(list.includes(escape(t(config.labelKey as "typeInvoice"))));
      callback(activity, "navigate", { item: { id: "doc-a" }, config, router: { push: (url: string) => events.push(url) } })();
    }
    assert.deepEqual(events, ["/sales/doc-a", "/sales/quotes/doc-a", "/sales/credit-notes/doc-a", "/payments/doc-a", "/purchases/doc-a"]);
  }
});

test("statement translates summaries, types, empty/loading/busy states and preserves exact currency displays", () => {
  for (const locale of locales) for (const currencyCode of ["USD", "JPY", "KWD"]) {
    const t = translator(locale, "ContactStatement"), captured: Captured[] = [];
    const Empty = loaded(statement, {}, captured);
    const empty = renderWithPresentation(createElement(Empty), locale);
    for (const key of ["period", "thisMonth", "lastMonth", "thisQuarter", "lastQuarter", "ytd", "last12", "from", "to", "pdf", "email", "empty", "emptyHint"] as const) assert.ok(empty.includes(escape(t(key))), key);
    assert.deepEqual(captured.filter(c => c.kind === "SelectItem").map(c => c.props.value), ["this_month", "last_month", "this_quarter", "last_quarter", "ytd", "last_12"]);
    const data = { currencyCode, openingBalance: 9007199254740991n, closingBalance: 9007199254740991n, totalDebit: 0n, totalCredit: 0n, transactions: [] };
    const Blank = loaded(statement, { statementData: data, statementCurrency: currencyCode, contact: { email: null } });
    const blank = renderWithPresentation(createElement(Blank), locale);
    for (const key of ["opening", "openingHint", "charged", "chargedHint", "paid", "paidHint", "closing", "closingHint", "date", "type", "reference", "description", "charges", "chargesHint", "payments", "paymentsHint", "balance", "balanceHint", "emptyTransactions", "noEmail", "clear"] as const) assert.ok(blank.includes(escape(t(key))), key);
    const types = ["invoice", "credit_note", "payment", "bill", "debit_note", "constructor", "__proto__", caller];
    const Populated = loaded(statement, { statementData: { ...data, transactions: types.map(type => ({ type, date: "2026-10-19", documentNumber: caller, description: caller, debit: 1n, credit: 0n, balance: data.openingBalance })) }, sendingStatement: true });
    const populated = renderWithPresentation(createElement(Populated), locale);
    for (const type of types) assert.ok(populated.includes(escape(t(statementTypeKey(type)))));
    assert.ok(populated.includes(escape(money.displayMoney(data.openingBalance, currencyCode))) && populated.includes(escape(caller)) && !populated.includes("<script>"));
    const Loading = loaded(statement, { statementLoading: true });
    assert.ok(renderWithPresentation(createElement(Loading), locale).includes(`aria-label="${escape(t("loading"))}"`));
  }
});

test("bookkeeping update preserves payload and exact credit aliases; failures stay local and reset saving", async () => {
  for (const locale of locales) for (const mode of ["success", "status", "json", "alias", "network", "no-org"]) {
    const t = translator(locale, "ContactBookkeeping"), events: unknown[] = [];
    const setters = Object.fromEntries(["setContact", "setFormType", "setFormRevenueAccountId", "setFormExpenseAccountId", "setFormTaxRateId", "setSaving"].map(k => [k, (v: unknown) => events.push([k, v])]));
    await callback(bookkeeping, "handleSubmit", { ...money, ...context, ...setters, t, id: "contact-a", getOrgId: () => mode === "no-org" ? null : "org-a",
      toast: { success: (s: string) => events.push(s), error: (s: string) => events.push(s) },
      fetch: async (url: string, init: RequestInit) => {
        assert.equal(url, "/api/v1/contacts/contact-a"); assert.equal(init.method, "PATCH");
        assert.deepEqual(init.headers, { "Content-Type": "application/json", "x-organization-id": "org-a" });
        assert.deepEqual(JSON.parse(init.body as string), { name: caller, email: raw.email, phone: null, taxNumber: null, type: "both", paymentTermsDays: 45, creditLimitMinor: "9007199254740991", isTaxExempt: true, currencyCode: "USD", defaultRevenueAccountId: "revenue-a", defaultExpenseAccountId: null, defaultTaxRateId: null, notes: caller });
        if (mode === "network") throw new Error("private prose");
        if (mode === "json") return new Response("<html>private prose</html>");
        return Response.json({ contact: mode === "alias" ? { ...raw, creditLimitMinor: "1" } : raw }, { status: mode === "status" ? 403 : 200 });
      } })({ preventDefault: noop });
    if (mode === "no-org") assert.deepEqual(events, []);
    else {
      assert.deepEqual(events[0], ["setSaving", true]); assert.deepEqual(events.at(-1), ["setSaving", false]);
      assert.ok(events.includes(t(mode === "success" ? "updated" : "updateFailed")));
      assert.equal(events.some(v => Array.isArray(v) && v[0] === "setContact"), mode === "success");
    }
  }
});

test("bookkeeping reference reads validate status/envelopes/rows before adoption", async () => {
  for (const locale of locales) for (const mode of ["success", "status", "json", "shape", "row", "network", "no-org"]) {
    const t = translator(locale, "ContactBookkeeping"), events: unknown[] = [];
    callback(bookkeeping, "fetchReferenceData", { t, getOrgId: () => mode === "no-org" ? null : "org-a",
      setAccounts: (v: unknown) => events.push(v), setTaxRates: (v: unknown) => events.push(v), toast: { error: (s: string) => events.push(s) },
      fetch: async (url: string, init: RequestInit) => {
        assert.deepEqual(init, { headers: { "x-organization-id": "org-a" } });
        assert.ok(["/api/v1/accounts", "/api/v1/tax-rates"].includes(url));
        if (mode === "network") throw new Error("private prose");
        if (mode === "json") return new Response("private prose");
        const rows = mode === "shape" ? {} : mode === "row" ? [null] : [];
        return Response.json(url.endsWith("accounts") ? { accounts: rows } : { taxRates: rows }, { status: mode === "status" ? 403 : 200 });
      } })();
    await flush();
    assert.deepEqual(events, mode === "no-org" ? [] : mode === "success" ? [[], []] : [t("referenceFailed"), t("referenceFailed")]);
  }
});

test("activity fetch preserves canonical filters/cursor, validates exact aliases, and localizes failures", async () => {
  for (const locale of locales) for (const more of [false, true]) for (const mode of ["success", "status", "json", "alias", "network", "no-org"]) {
    const t = translator(locale, "ContactActivity"), events: unknown[] = [];
    const row = { id: "doc-a", type: "invoice", number: caller, status: "draft", date: "2026-10-19", createdAt: "2026-10-19T00:00:00Z", amount: 9007199254740991, amountMinor: mode === "alias" ? "1" : "9007199254740991", currencyCode: "KWD" };
    callback(activity, "fetchActivity", { ...money, t, id: "contact-a", activityStartDate: "2026-01-01", activityEndDate: "2026-10-19", activityTypeFilter: "credit_note", getOrgId: () => mode === "no-org" ? null : "org-a",
      ...Object.fromEntries(["setActivityLoading", "setActivityLoadingMore", "setActivityHasMore", "setActivityCursor"].map(k => [k, (v: unknown) => events.push([k, v])])),
      setActivityItems: (v: unknown) => events.push(["items", typeof v === "function" ? v([{ id: "previous" }]) : v]), toast: { error: (s: string) => events.push(s) },
      fetch: async (url: string, init: RequestInit) => {
        const parsed = new URL(url, "https://local.test"); assert.equal(parsed.pathname, "/api/v1/contacts/contact-a/activity");
        assert.deepEqual(Object.fromEntries(parsed.searchParams), { limit: "30", ...(more ? { cursor: "cursor-a" } : {}), startDate: "2026-01-01", endDate: "2026-10-19", type: "credit_note" });
        assert.deepEqual(init, { headers: { "x-organization-id": "org-a" } });
        if (mode === "network") throw new Error("private prose");
        if (mode === "json") return new Response("private prose");
        return Response.json({ activity: [row], nextCursor: "next-a", hasMore: true }, { status: mode === "status" ? 403 : 200 });
      } })(more ? "cursor-a" : null);
    await flush();
    if (mode === "no-org") assert.deepEqual(events, []);
    else {
      assert.deepEqual(events.slice(-2), [["setActivityLoading", false], ["setActivityLoadingMore", false]]);
      if (mode === "success") assert.deepEqual(events.find(v => Array.isArray(v) && v[0] === "items"), ["items", [...(more ? [{ id: "previous" }] : []), { ...row, amount: 9007199254740991n }]]);
      else { assert.ok(events.includes(t("readFailed"))); assert.ok(events.some(v => Array.isArray(v) && v[0] === "items" && v[1].length === 0)); }
    }
  }
});

test("statement fetch validates money and preserves currency filters, abort behavior and loading cleanup", async () => {
  for (const locale of locales) for (const mode of ["success", "status", "json", "alias", "network", "abort", "no-org"]) {
    const t = translator(locale, "ContactStatement"), events: unknown[] = [], controller = new AbortController();
    const data = { contact: { id: "contact-a", name: caller, email: null, type: "both" }, startDate: "2026-01-01", endDate: "2026-10-19", currencyCode: "JPY", transactions: [], openingBalance: 9007199254740991, openingBalanceMinor: mode === "alias" ? "1" : "9007199254740991", closingBalance: 9007199254740991, closingBalanceMinor: "9007199254740991", totalDebit: 0, totalDebitMinor: "0", totalCredit: 0, totalCreditMinor: "0" };
    await callback(statement, "fetchStatement", { ...money, t, id: "contact-a", statementStartDate: data.startDate, statementEndDate: data.endDate, statementCurrency: "JPY", getOrgId: () => mode === "no-org" ? null : "org-a",
      setStatementLoading: (v: unknown) => events.push(["loading", v]), setStatementData: (v: unknown) => events.push(["data", v]), toast: { error: (s: string) => events.push(s) },
      fetch: async (url: string, init: RequestInit) => {
        const parsed = new URL(url, "https://local.test"); assert.equal(parsed.pathname, "/api/v1/contacts/contact-a/statement");
        assert.deepEqual(Object.fromEntries(parsed.searchParams), { startDate: data.startDate, endDate: data.endDate, currencyCode: "JPY" });
        assert.deepEqual(init.headers, { "x-organization-id": "org-a" }); assert.equal(init.signal, controller.signal);
        if (mode === "abort") { controller.abort(); throw new Error("Abort"); }
        if (mode === "network") throw new Error("private prose");
        if (mode === "json") return new Response("private prose");
        return Response.json(data, { status: mode === "status" ? 403 : 200 });
      } })(controller.signal);
    assert.deepEqual(events, mode === "no-org" ? [] : mode === "abort" ? [["loading", true], ["data", null]] : mode === "success" ? [["loading", true], ["data", null], ["data", money.contactStatementUi(data)], ["loading", false]] : [["loading", true], ["data", null], ["data", null], t("readFailed"), ["loading", false]]);
  }
});

test("statement PDF/email handlers preserve scoped URLs/payloads and hide arbitrary errors", async () => {
  for (const locale of locales) for (const filtered of [false, true]) for (const mode of ["success", "status", "json", "network", "no-org"]) {
    const t = translator(locale, "ContactStatement"), events: unknown[] = [];
    const scope = { t, id: "contact-a", statementStartDate: filtered ? "2026-01-01" : "", statementEndDate: filtered ? "2026-10-19" : "", statementCurrency: filtered ? "KWD" : "", getOrgId: () => mode === "no-org" ? null : "org-a" };
    callback(statement, "handleDownloadPdf", { ...scope, window: { open: (url: string, target: string) => {
      const parsed = new URL(url, "https://local.test"); assert.equal(parsed.pathname, "/api/v1/contacts/contact-a/statement/pdf"); assert.equal(target, "_blank");
      assert.deepEqual(Object.fromEntries(parsed.searchParams), { orgId: "org-a", ...(filtered ? { startDate: "2026-01-01", endDate: "2026-10-19", currencyCode: "KWD" } : {}) });
    } } })();
    await callback(statement, "handleEmailStatement", { ...scope, setSendingStatement: (v: unknown) => events.push(v), toast: { success: (s: string) => events.push(s), error: (s: string) => events.push(s) },
      fetch: async (url: string, init: RequestInit) => {
        assert.equal(url, "/api/v1/contacts/contact-a/statement/email"); assert.equal(init.method, "POST");
        assert.deepEqual(init.headers, { "Content-Type": "application/json", "x-organization-id": "org-a" });
        assert.deepEqual(JSON.parse(init.body as string), filtered ? { startDate: "2026-01-01", endDate: "2026-10-19", currencyCode: "KWD" } : {});
        if (mode === "network") throw new Error("private prose");
        if (mode === "json") return new Response("private prose", { status: 500 });
        return Response.json({ error: "private prose" }, { status: mode === "status" ? 403 : 200 });
      } })();
    assert.deepEqual(events, mode === "no-org" ? [] : [true, t(mode === "success" ? "emailed" : "emailFailed"), false]);
  }
});

test("filters reset canonical values and every existing statement preset retains date behavior", () => {
  for (const path of [activity, statement]) {
    const events: unknown[] = [], prefix = path === activity ? "Activity" : "Statement";
    const fields = path === activity ? ["StartDate", "EndDate", "TypeFilter"] : ["StartDate", "EndDate", "Currency"];
    callback(path, "clear", Object.fromEntries(fields.map(f => [`set${prefix}${f}`, (v: string) => events.push(v)])))();
    assert.deepEqual(events, ["", "", path === activity ? "all" : ""]);
  }
  const RealDate = Date;
  class FixedDate extends RealDate { constructor(...args: unknown[]) { if (args.length === 0) super("2026-10-19T12:00:00Z"); else if (args.length === 3) super(args[0] as number, args[1] as number, args[2] as number); else super(args[0] as string); } }
  const now = new RealDate("2026-10-19T12:00:00Z"), y = now.getFullYear(), m = now.getMonth(), q = Math.floor(m / 3) * 3;
  const expected: Record<string, [Date, Date]> = { this_month: [new RealDate(y, m, 1), now], last_month: [new RealDate(y, m - 1, 1), new RealDate(y, m, 0)], this_quarter: [new RealDate(y, q, 1), now], last_quarter: [new RealDate(y, q - 3, 1), new RealDate(y, q, 0)], ytd: [new RealDate(y, 0, 1), now], last_12: [new RealDate(y - 1, m, now.getDate()), now] };
  for (const preset of [...Object.keys(expected), "unknown"]) {
    const events: string[] = [];
    callback(statement, "applyStatementPreset", { Date: FixedDate, setStatementStartDate: (v: string) => events.push(v), setStatementEndDate: (v: string) => events.push(v) })(preset);
    assert.deepEqual(events, preset === "unknown" ? [] : expected[preset].map(d => d.toISOString().slice(0, 10)));
  }
});

test("owned JSX has no authored prose literals and all added Persian messages contain Persian script", () => {
  for (const path of [bookkeeping, activity, statement]) {
    const ast = parse(path);
    function visit(n: ts.Node) {
      if (ts.isJsxText(n)) assert.ok(["", "-", "(", "%)"].includes(n.text.trim()), `${path}: ${n.text.trim()}`);
      if (ts.isJsxAttribute(n) && ["title", "description", "placeholder", "aria-label", "alt"].includes(n.name.getText(ast))) assert.ok(!n.initializer || !ts.isStringLiteral(n.initializer), n.getText(ast));
      ts.forEachChild(n, visit);
    }
    visit(ast);
  }
  for (const ns of [fa.ContactBookkeeping, fa.ContactActivity, fa.ContactStatement]) for (const value of Object.values(ns)) assert.match(value, /[\u0600-\u06ff]/);
});
