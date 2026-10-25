import { resolvePresentation } from "../i18n/locale";
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { createElement, type ComponentType, type ReactNode } from "react";
import * as React from "react";
import * as jsx from "react/jsx-runtime";
import * as nextIntl from "next-intl";
import { createTranslator } from "next-intl";
import { catalogText, visibleText } from "./helpers/catalog-text";
import ts from "typescript";
import * as BrandLoader from "../components/dashboard/brand-loader";
import { payrollTaxPaymentJson } from "../i18n/payroll-tax-liability-presentation";
import { payrollMoneyDisplay } from "../lib/money/payroll-display";
import { renderWithPresentation } from "./helpers/presentation";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const page = "app/(dashboard)/payroll/tax-liabilities/page.tsx";
const locales = ["en-US", "fa-IR"] as const;
const noop = () => {};
const caller = "<script>caller & name</script>";
const escape = (v: string) => v.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
const translator = (locale: typeof locales[number]) => createTranslator({ locale, messages: catalogText(locale === "en-US" ? en : fa), namespace: "PayrollTaxLiabilities" });
type Capture = { kind: string; props: Record<string, unknown> };
type Harness = { captured: Capture[]; events: unknown[]; effects: (() => void | (() => void))[]; refs: Record<string, { current: unknown }> };

// Real production templates and next-intl; hook/IO state and portals are controlled.
function render(file: string, states: Record<string, unknown> = {}, locale: typeof locales[number] = "en-US") {
  const ast = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declaration = ast.statements.find((n): n is ts.FunctionDeclaration => ts.isFunctionDeclaration(n) && !!n.modifiers?.some(m => m.kind === ts.SyntaxKind.DefaultKeyword))!;
  const name = declaration.name!.text;
  const owner = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name)!;
  const names: string[] = [];
  const refNames: string[] = [];
  function hooks(n: ts.Node) {
    if (ts.isVariableDeclaration(n) && ts.isArrayBindingPattern(n.name) && n.initializer && ts.isCallExpression(n.initializer) && n.initializer.expression.getText(ast) === "useState") names.push(n.name.elements[0].getText(ast));
    if (ts.isVariableDeclaration(n) && n.initializer && ts.isCallExpression(n.initializer) && n.initializer.expression.getText(ast) === "useRef") refNames.push(n.name.getText(ast));
    ts.forEachChild(n, hooks);
  }
  hooks(owner);
  const source = ast.text + `\nexport { ${name} };`;
  const h: Harness = { captured: [], events: [], effects: [], refs: {} };
  const capture = (factory: typeof jsx.jsx) => (kind: unknown, props: Record<string, unknown>, key: string) => {
    h.captured.push({ kind: typeof kind === "string" ? kind : (kind as { name?: string })?.name ?? "", props });
    return factory(kind as Parameters<typeof jsx.jsx>[0], props, key);
  };
  const inline = (kind: string) => function Inline(props: Record<string, unknown>) {
    h.captured.push({ kind, props });
    return createElement("div", { "data-control": kind }, props.children as ReactNode,
      typeof props.placeholder === "string" ? createElement("span", null, props.placeholder) : null);
  };
  let index = 0;
  let refIndex = 0;
  const require = createRequire(resolve(file)), compiled = { exports: {} as Record<string, ComponentType<Record<string, unknown>>> };
  const load = (id: string): unknown => {
    if (id.endsWith("/data-table")) return { DataTable: (props: { columns: { header: string; render: (row: unknown) => ReactNode }[]; data: unknown[]; emptyMessage: string }) => createElement("section", null, props.columns.map((c, i) => createElement("div", { key: i }, c.header, props.data.map((r, j) => createElement("div", { key: j }, c.render(r))))), props.data.length ? null : props.emptyMessage) };
    if (id === "react") return { ...React, useState: (initial: unknown) => {
      const key = names[index++]; return [Object.hasOwn(states, key) ? states[key] : initial, (v: unknown) => h.events.push([key, v])];
    }, useEffect: (fn: () => void | (() => void)) => h.effects.push(fn), useMemo: (fn: () => unknown) => fn(), useCallback: (fn: unknown) => fn,
    useRef: (initial: unknown) => h.refs[refNames[refIndex++]] = { current: initial } };
    if (id === "react/jsx-runtime") return { ...jsx, jsx: capture(jsx.jsx), jsxs: capture(jsx.jsxs) };
    if (id === "next-intl") return nextIntl;
    if (id === "sonner") return { toast: { error: (v: unknown) => h.events.push(["error", v]), success: (v: unknown) => h.events.push(["success", v]) } };
    if (id.endsWith("/topbar")) return { useTopbarAction: noop };
    if (id.endsWith("/use-debounce")) return { useDebounce: (v: string) => states.debouncedSearch ?? v };
    if (id.endsWith("/use-document-title")) return { useDocumentTitle: (v: string) => h.events.push(["title", v]) };
    if (id.endsWith("/use-confirm")) return { useConfirm: () => ({ dialog: null, confirm: async (v: unknown) => { h.events.push(["confirm", v]); return states.confirmed !== false; } }) };
    if (id.endsWith("/brand-loader")) return BrandLoader;
    for (const [suffix, names] of Object.entries({ "/ui/dialog": ["Dialog", "DialogContent", "DialogHeader", "DialogTitle", "DialogDescription", "DialogFooter"], "/ui/select": ["Select", "SelectContent", "SelectItem", "SelectTrigger", "SelectValue"], "/ui/tabs": ["Tabs", "TabsList", "TabsTrigger"], "/ui/sheet": ["Sheet", "SheetContent", "SheetHeader", "SheetTitle", "SheetDescription", "SheetFooter"], "/ui/date-picker": ["DatePicker"], "/ui/currency-select": ["CurrencySelect"] }))
      if (id.endsWith(suffix)) return Object.fromEntries(names.map(key => [key, inline(key)]));
    return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  };
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function("require", "module", "exports", code)(load, compiled, compiled.exports);
  const html = renderWithPresentation(createElement(compiled.exports[name]), locale);
  return { ...h, html };
}
const flush = async () => { for (let i = 0; i < 6; i++) await new Promise(resolve => setImmediate(resolve)); };
const has = (h: Harness, key: string, value: unknown) => h.events.some(v => JSON.stringify(v) === JSON.stringify([key, value]));
const payment = { id: "payment-a", periodStart: "2026-10-01", periodEnd: "2026-10-21", jurisdictionLevel: "federal", jurisdiction: "US", taxKind: "941", amount: 29, amountMinor: "29", currency: "KWD", reference: caller, notes: null, status: "paid", paidAt: "2026-10-21T00:00:00.000Z", createdAt: "2026-10-21T00:00:00.000Z", journalEntryId: "journal-a" };
const list = { payments: [payment] };
const created = { payment, journalEntryId: "journal-a" };
const liability = { data: [], totalTax: 100, totalTaxMinor: "100", currency: "KWD" };
const loaded = { initialLoad: false, accruedTax: 100, reportCurrency: "KWD", payments: [payment], sheetOpen: true };
const form = { ...loaded, formAmount: "0.29", formPeriodStart: "2026-10-01", formPeriodEnd: "2026-10-21", formPaymentDate: "2026-10-21", formJurisdiction: "state", formReference: caller, formNotes: caller };
async function withIO(fetcher: typeof fetch, run: () => Promise<void>, org: string | null = "org-a", storageThrows = false) {
  const original = globalThis.fetch, storage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  globalThis.fetch = fetcher;
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: (key: string) => {
    assert.equal(key, "activeOrgId"); if (storageThrows) throw new Error("Private storage"); return org;
  } } });
  try { await run(); } finally {
    globalThis.fetch = original;
    if (storage) Object.defineProperty(globalThis, "localStorage", storage); else Reflect.deleteProperty(globalThis, "localStorage");
  }
}
function button(h: ReturnType<typeof render>, label: string, last = false) {
  function text(v: unknown): string {
    if (typeof v === "string" || typeof v === "number") return String(v);
    if (Array.isArray(v)) return v.map(text).join("");
    if (React.isValidElement<{ children?: ReactNode }>(v)) return text(v.props.children);
    return "";
  }
  const matches = h.captured.filter(c => typeof c.props.onClick === "function" && text(c.props.children) === label);
  const c = last ? matches.at(-1) : matches[0]; assert.ok(c, label);
  return c.props.onClick as () => Promise<void>;
}

test("tax liability production JSX renders bilingual copy, exact cents, statutory values and escaped user data", () => {
  for (const locale of locales) {
    const t = translator(locale), h = render(page, loaded, locale);
    assert.ok(has(h, "title", t("documentTitle")));
    for (const key of ["title", "description", "owed", "paid", "outstanding", "whoYouPay", "incomeAgency", "incomeDescription", "payrollAgency", "payrollDescription", "pensionAgency", "pensionDescription", "paidToDate", "paymentsRecorded", "periodCovered", "covers", "level", "reference", "paidOn", "amount", "sheetTitle", "sheetDescription", "payee", "amountPaid", "periodFrom", "periodTo", "notes", "cancel", "referencePlaceholder", "notesPlaceholder"] as const) assert.ok(h.html.includes(escape(t(key))), key);
    assert.ok(visibleText(h.html).includes(escape(t("periodRange", { start: payment.periodStart, end: payment.periodEnd }))));
    assert.ok(visibleText(h.html).includes(escape(t("outstandingNotice", { amount: payrollMoneyDisplay(71, "KWD", resolvePresentation({ user: { language: locale } })) }))));
    assert.ok(h.html.includes(escape(payrollMoneyDisplay(29, "KWD", resolvePresentation({ user: { language: locale } })))));
    assert.ok(h.html.includes(escape(caller))); assert.ok(!h.html.includes("<script>"));
    const options = h.captured.filter(c => c.kind === "SelectItem");
    assert.deepEqual(options.map(c => c.props.value), ["income_tax", "fica", "pension", "federal", "state", "local"]);
    assert.deepEqual(options.map(c => c.props.children), ["incomeAgency", "payrollAgency", "pensionAgency", "federal", "state", "local"].map(k => t(k as "incomeAgency")));
    for (const jurisdictionLevel of ["federal", "state", "local"]) assert.ok(render(page, { ...loaded, payments: [{ ...payment, jurisdictionLevel }] }, locale).html.includes(escape(t(jurisdictionLevel as "federal"))));
    for (const taxKind of ["income_tax", "941", "benefits", "940", null]) {
      const r = render(page, { ...loaded, payments: [{ ...payment, taxKind, reference: null, jurisdiction: null, paidAt: null }] }, locale);
      assert.ok(r.html.includes(escape(taxKind === "940" ? taxKind : t(taxKind === "income_tax" ? "incomeAgency" : taxKind === "941" ? "payrollAgency" : taxKind === "benefits" ? "pensionAgency" : "payrollTax"))));
    }
    assert.ok(render(page, { ...loaded, payments: [] }, locale).html.includes(escape(t("empty"))));
    const max = Number.MAX_SAFE_INTEGER;
    const big = render(page, { ...loaded, payments: [payment, { ...payment, id: "payment-b", amount: max }, { ...payment, id: "payment-c", amount: max }] }, locale);
    assert.ok(big.html.includes(escape(payrollMoneyDisplay(2n * BigInt(max) + 29n, "KWD", resolvePresentation({ user: { language: locale } })))));
    assert.ok(!visibleText(big.html).includes(escape(t("outstandingNotice", { amount: payrollMoneyDisplay(71, "KWD", resolvePresentation({ user: { language: locale } })) }))));
    const mixed = render(page, { ...loaded, payments: [{ ...payment, currency: "JPY" }] }, locale);
    assert.ok(mixed.html.includes(escape(t("multipleCurrencies")))); assert.ok(mixed.html.includes(escape(t("unavailable"))));
    const pending = render(page, { ...loaded, payments: [{ ...payment, currency: "JPY", status: "pending" }] }, locale);
    assert.ok(!pending.html.includes(escape(t("multipleCurrencies"))));
    assert.ok(render(page, { ...loaded, submitting: true }, locale).html.includes(escape(t("recording"))));
    assert.ok(!render(page, {}, locale).html.includes(escape(t("title"))));
  }
});

test("checked payment envelopes reject HTTP, parser, shape, date, currency and exact-money failures", async () => {
  for (const [kind, body] of [["list", list], ["created", created]] as const) {
    assert.deepEqual(await payrollTaxPaymentJson(Response.json(body), kind), body);
    await assert.rejects(payrollTaxPaymentJson(Response.json(body, { status: 403 }), kind));
    await assert.rejects(payrollTaxPaymentJson(new Response("Private parser diagnostic"), kind));
    for (const bad of [null, [], {}, { success: true }, { ...body, error: "Private error" }]) await assert.rejects(payrollTaxPaymentJson(Response.json(bad), kind));
  }
  for (const change of [{ id: "" }, { amount: null, amountMinor: null }, { amount: 0, amountMinor: "0" }, { amount: -1, amountMinor: "-1" }, { amountMinor: "029" }, { amountMinor: "30" }, { amount: 1.2 }, { currency: null }, { currency: "unknown" }, { periodStart: "2026-02-30" }, { periodEnd: "2026-09-30" }, { jurisdictionLevel: "other" }, { status: "other" }, { reference: 1 }, { notes: {} }, { paidAt: "Private date" }, { paidAt: "2026-02-30T00:00:00Z" }, { createdAt: null }]) {
    await assert.rejects(payrollTaxPaymentJson(Response.json({ payments: [{ ...payment, ...change }] }), "list"));
  }
  await assert.rejects(payrollTaxPaymentJson(Response.json({ payments: [payment, payment] }), "list"));
  await assert.rejects(payrollTaxPaymentJson(Response.json({ ...created, journalEntryId: "other" }), "created"));
  await assert.rejects(payrollTaxPaymentJson(Response.json({ ...created, payment: { ...payment, status: "pending" } }), "created"));
});

test("paired reads adopt atomically and localize failure, missing organization and obsolete responses", async () => {
  for (const locale of locales) {
    const t = translator(locale);
    await withIO(async (url, init) => {
      assert.equal((init!.headers as Record<string, string>)["x-organization-id"], "org-a");
      return Response.json(String(url).endsWith("tax-payments") ? list : liability);
    }, async () => {
      const h = render(page, {}, locale); h.effects[0](); await flush();
      assert.ok(has(h, "payments", list.payments)); assert.ok(has(h, "accruedTax", 100)); assert.ok(has(h, "reportCurrency", "KWD")); assert.ok(has(h, "initialLoad", false));
    });
    for (const fail of [() => Response.json({ error: "Private server diagnostic" }, { status: 500 }), () => new Response("Private parser diagnostic"), () => Response.json({ payments: [payment, { ...payment, amountMinor: "wrong" }] }), () => { throw new Error("Private network diagnostic"); }]) {
      await withIO(async url => String(url).endsWith("tax-payments") ? fail() : Response.json(liability), async () => {
        const h = render(page, loaded, locale); h.effects[0](); await flush();
        assert.ok(has(h, "reportError", t("loadFailed"))); assert.ok(has(h, "initialLoad", false)); assert.ok(has(h, "payments", []));
        assert.ok(!h.events.some(v => Array.isArray(v) && v[0] === "accruedTax"));
        assert.ok(!JSON.stringify(h.events).includes("Private"));
      });
    }
    for (const storageThrows of [false, true]) await withIO(async () => { throw new Error("Must not fetch"); }, async () => {
      const h = render(page, {}, locale); h.effects[0](); await flush();
      assert.ok(has(h, "reportError", t("loadFailed"))); assert.ok(has(h, "initialLoad", false));
    }, null, storageThrows);
    let resolveRead!: (r: Response) => void;
    await withIO(async url => String(url).endsWith("tax-payments") ? new Promise<Response>(resolve => { resolveRead = resolve; }) : Response.json(liability), async () => {
      const h = render(page, {}, locale), cleanup = h.effects[0]()!; await flush();
      const count = h.events.length; cleanup(); resolveRead(Response.json(list)); await flush(); assert.equal(h.events.length, count);
    });
    let rejectRead!: (r: Error) => void;
    await withIO(async () => new Promise<Response>((_, reject) => { rejectRead = reject; }), async () => {
      const h = render(page, {}, locale), cleanup = h.effects[0]()!; await flush();
      const count = h.events.length; cleanup(); rejectRead(new Error("Private obsolete failure")); await flush(); assert.equal(h.events.length, count);
    });
  }
});

test("form callbacks preserve machine fields, exact allocations and retry keys across failures", async () => {
  for (const locale of locales) for (const [formBucket, taxKind] of [["income_tax", "income_tax"], ["fica", "941"], ["pension", "benefits"]]) {
    const t = translator(locale), requests: Record<string, unknown>[] = [];
    let succeed = false;
    await withIO(async (url, init) => {
      assert.equal(url, "/api/v1/payroll/tax-payments"); assert.equal(init!.method, "POST");
      assert.deepEqual(init!.headers, { "Content-Type": "application/json", "x-organization-id": "org-a" });
      requests.push(JSON.parse(init!.body as string));
      return succeed ? Response.json(created) : Response.json({ error: "Private posting diagnostic" }, { status: 409 });
    }, async () => {
      const h = render(page, { ...form, formBucket }, locale), send = button(h, t("record"), true);
      await send(); const retryKey = h.refs.remittanceKey.current;
      assert.equal(typeof retryKey, "string"); assert.ok(has(h, "error", t("recordFailed"))); assert.ok(has(h, "submitting", false));
      assert.ok(!has(h, "sheetOpen", false)); assert.ok(!JSON.stringify(h.events).includes("Private"));
      succeed = true; await send();
      assert.equal(requests[0].idempotencyKey, retryKey); assert.deepEqual(requests[1], requests[0]);
      assert.deepEqual(requests[0], { idempotencyKey: retryKey, periodStart: "2026-10-01", periodEnd: "2026-10-21", jurisdictionLevel: "state", taxKind, allocations: [{ bucket: formBucket, amountMinor: "29" }], paymentDate: "2026-10-21", reference: caller, notes: caller });
      assert.equal(h.refs.remittanceKey.current, null); assert.ok(has(h, "success", t("recorded"))); assert.ok(has(h, "sheetOpen", false));
      const refresh = h.events.find(v => Array.isArray(v) && v[0] === "refreshKey") as [string, (n: number) => number]; assert.equal(refresh[1](4), 5);
      h.refs.remittanceKey.current = "old-key"; h.refs.remittanceInput.current = "different-input"; await send(); assert.notEqual(requests[2].idempotencyKey, "old-key");
    });
  }
});

test("validation, malformed success and editor callbacks retain form values with translated feedback", async () => {
  for (const locale of locales) {
    const t = translator(locale);
    await withIO(async () => { throw new Error("Must not fetch"); }, async () => {
      for (const [change, key] of [[{ formAmount: "0" }, "positiveAmount"], [{ formAmount: "wrong" }, "invalidAmount"], [{ formPeriodStart: "" }, "choosePeriod"], [{ formBucket: "unknown" }, "recordFailed"]] as const) {
        const h = render(page, { ...form, ...change }, locale); await button(h, t("record"), true)(); assert.ok(has(h, "error", t(key)));
      }
      const h = render(page, form, locale);
      button(h, t("cancel"))(); assert.ok(has(h, "sheetOpen", false));
      for (const [i, bucket] of ["income_tax", "fica", "pension"].entries()) {
        h.events.length = 0;
        const buttons = h.captured.filter(c => typeof c.props.onClick === "function" && c.props.size === "sm");
        (buttons[i].props.onClick as () => void)();
        assert.ok(has(h, "formBucket", bucket)); assert.ok(has(h, "formAmount", "")); assert.ok(has(h, "formJurisdiction", "federal")); assert.ok(has(h, "sheetOpen", true));
      }
      const selectors = h.captured.filter(c => c.kind === "Select");
      (selectors[0].props.onValueChange as (v: string) => void)("pension"); (selectors[1].props.onValueChange as (v: string) => void)("local");
      assert.ok(has(h, "formBucket", "pension")); assert.ok(has(h, "formJurisdiction", "local"));
      const dates = h.captured.filter(c => c.kind === "DatePicker");
      dates.forEach(c => (c.props.onChange as (v: string) => void)("2026-11-01"));
      for (const key of ["formPeriodStart", "formPeriodEnd", "formPaymentDate"]) assert.ok(has(h, key, "2026-11-01"));
    });
    await withIO(async () => Response.json({ success: true }), async () => {
      const h = render(page, form, locale); await button(h, t("record"), true)();
      assert.ok(has(h, "error", t("recordFailed"))); assert.ok(!has(h, "sheetOpen", false)); assert.ok(!has(h, "success", t("recorded")));
    });
    await withIO(async () => { throw new Error("Must not fetch"); }, async () => {
      const h = render(page, form, locale); await button(h, t("record"), true)(); assert.ok(has(h, "error", t("organizationRequired")));
    }, null);
  }
});
