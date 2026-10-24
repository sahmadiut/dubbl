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
import ts from "typescript";
import * as BrandLoader from "../components/dashboard/brand-loader";
import { payrollSelfServiceJson, selfLeaveTypes, selfSheetStatuses } from "../i18n/payroll-self-service-presentation";
import { payrollMoneyDisplay } from "../lib/money/payroll-display";
import { renderWithPresentation } from "./helpers/presentation";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const base = "app/(dashboard)/payroll/";
const page = base + "self-service/page.tsx";
const locales = ["en-US", "fa-IR"] as const;
const noop = () => {};
const caller = "<script>caller & name</script>";
const escape = (v: string) => v.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
const translator = (locale: typeof locales[number]) => createTranslator({ locale, messages: locale === "en-US" ? en : fa, namespace: "PayrollSelfService" });
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
    if (id === "react") return { ...React, useState: (initial: unknown) => {
      const key = names[index++]; return [Object.hasOwn(states, key) ? states[key] : initial, (v: unknown) => h.events.push([key, v])];
    }, useEffect: (fn: () => void | (() => void)) => h.effects.push(fn), useMemo: (fn: () => unknown) => fn(), useCallback: (fn: unknown) => fn,
    useRef: (initial: unknown) => h.refs[refNames[refIndex++]] = { current: initial } };
    if (id === "react/jsx-runtime") return { ...jsx, jsx: capture(jsx.jsx), jsxs: capture(jsx.jsxs) };
    if (id === "next-intl") return nextIntl;
    if (id === "sonner") return { toast: { error: (v: unknown) => h.events.push(["error", v]), success: (v: unknown) => h.events.push(["success", v]) } };
    if (id === "next/navigation") return {};
    if (id.endsWith("/topbar")) return { useTopbarAction: noop };
    if (id.endsWith("/use-debounce")) return { useDebounce: (v: string) => states.debouncedSearch ?? v };
    if (id.endsWith("/use-document-title")) return { useDocumentTitle: (v: string) => h.events.push(["title", v]) };
    if (id.endsWith("/use-confirm")) return { useConfirm: () => ({ dialog: null, confirm: async (v: unknown) => { h.events.push(["confirm", v]); return states.confirmed !== false; } }) };
    if (id.endsWith("/brand-loader")) return BrandLoader;
    for (const [suffix, names] of Object.entries({ "/ui/dialog": ["Dialog", "DialogContent", "DialogHeader", "DialogTitle", "DialogDescription", "DialogFooter"], "/ui/select": ["Select", "SelectContent", "SelectItem", "SelectTrigger", "SelectValue"], "/ui/tabs": ["Tabs", "TabsList", "TabsTrigger"], "/ui/sheet": ["Sheet", "SheetContent", "SheetHeader", "SheetTitle", "SheetDescription"], "/ui/date-picker": ["DatePicker"], "/ui/currency-select": ["CurrencySelect"] }))
      if (id.endsWith(suffix)) return Object.fromEntries(names.map(key => [key, inline(key)]));
    return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  };
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function("require", "module", "exports", code)(load, compiled, compiled.exports);
  const html = renderWithPresentation(createElement(compiled.exports[name]), locale);
  return { ...h, html };
}
const flush = async () => { for (let i = 0; i < 6; i++) await new Promise(resolve => setImmediate(resolve)); };
const profile = { id: "employee-a", name: caller, email: "old@example.test", employeeNumber: "EMP-001", position: caller,
  salary: Number.MAX_SAFE_INTEGER, salaryMinor: String(Number.MAX_SAFE_INTEGER), currency: "KWD", bankAccountNumber: "001234", ptoBalanceHours: 7.5 };
const slip = { id: "slip-a", employeeId: profile.id, grossAmount: Number.MAX_SAFE_INTEGER, grossAmountMinor: String(Number.MAX_SAFE_INTEGER),
  netAmount: 29, netAmountMinor: "29", currency: "KWD", generatedAt: "2026-10-01T10:00:00Z", payrollRun: { payPeriodStart: "2026-09-01", payPeriodEnd: "2026-09-30" } };
const balance = { id: "balance-a", employeeId: profile.id, balance: 7.5, usedHours: 0.25, policy: { name: caller, leaveType: "vacation" } };
const sheet = { id: "sheet-a", employeeId: profile.id, periodStart: "2026-09-01", periodEnd: "2026-09-30", status: "draft", totalHours: 7.5 };
const loaded = { loading: false, profile, payslips: [slip], leaveBalances: [balance], timesheets: [sheet], email: "new@example.test", bankAccount: "00999" };
const bodies = { profile: { employee: profile }, payslips: { data: [slip] }, leave: { data: [balance] }, timesheets: { data: [sheet] } };
const has = (h: Harness, key: string, value: unknown) => h.events.some(v => JSON.stringify(v) === JSON.stringify([key, value]));
function save(h: Harness, locale: typeof locales[number]) {
  const c = h.captured.find(c => c.kind === "Button" && Array.isArray(c.props.children) && c.props.children.includes(translator(locale)("save")));
  assert.ok(c); return c.props.onClick as () => Promise<void>;
}
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
function response(url: string | URL | Request) {
  const path = String(url).split("/").at(-1);
  return Response.json(path === "profile" ? bodies.profile : path === "payslips" ? bodies.payslips : path === "leave-balance" ? bodies.leave : bodies.timesheets);
}

test("self-service production template renders bilingual copy, escaped data, exact money, hours and finite labels", () => {
  for (const locale of locales) {
    const t = translator(locale), h = render(page, loaded, locale);
    assert.ok(has(h, "title", t("documentTitle")));
    for (const key of ["employeeNumber", "position", "ptoBalance", "payslips", "profileTitle", "profileDescription", "email", "bankAccount", "save", "payslipsTitle", "payslipsDescription", "leaveTitle", "leaveDescription", "timesheetsTitle", "timesheetsDescription"] as const) assert.ok(h.html.includes(escape(t(key))), key);
    assert.ok(h.html.includes(escape(caller))); assert.ok(!h.html.includes("<script>"));
    assert.ok(h.html.includes(escape(payrollMoneyDisplay(Number.MAX_SAFE_INTEGER, "KWD", resolvePresentation({ user: { language: locale } })))));
    assert.ok(h.html.includes(escape(t("netAmount", { amount: payrollMoneyDisplay(29, "KWD", resolvePresentation({ user: { language: locale } })) }))));
    assert.ok(h.html.includes(escape(t("period", { start: "2026-09-01", end: "2026-09-30" }))));
    for (const [key, hours] of [["hours", "7.5"], ["hoursAvailable", "7.5"], ["hoursUsed", "0.25"]] as const) assert.ok(h.html.includes(escape(t(key, { hours }))));
    for (const status of selfSheetStatuses) assert.ok(render(page, { ...loaded, timesheets: [{ ...sheet, status }] }, locale).html.includes(escape(t(`status_${status}`))));
    for (const leaveType of selfLeaveTypes) assert.ok(render(page, { ...loaded, leaveBalances: [{ ...balance, policy: { name: caller, leaveType } }] }, locale).html.includes(escape(t(`leaveType_${leaveType}`))));
    const empty = render(page, { ...loaded, payslips: [], leaveBalances: [], timesheets: [] }, locale);
    for (const key of ["noPayslips", "noLeave", "noTimesheets"] as const) assert.ok(empty.html.includes(escape(t(key))));
    const missing = render(page, { loading: false }, locale);
    for (const key of ["noProfile", "noProfileDescription"] as const) assert.ok(missing.html.includes(escape(t(key))));
    assert.ok(render(page, {}, locale).html.includes("brand-loader"));
    assert.ok(render(page, { ...loaded, saving: true }, locale).html.includes(escape(t("saving"))));
    for (const moneyError of ["Private server error", "organizationRequired"]) {
      const html = render(page, { ...loaded, moneyError }, locale).html;
      assert.ok(html.includes(escape(t(moneyError === "organizationRequired" ? "organizationRequired" : "loadFailed"))));
      assert.ok(!html.includes("Private"));
    }
    assert.doesNotThrow(() => render(page, { ...loaded, profile: { ...profile, position: null }, payslips: [{ ...slip, payrollRun: null }], leaveBalances: [{ ...balance, policy: null }] }, locale));
    const many = render(page, { ...loaded, payslips: Array.from({ length: 12 }, (_, i) => ({ ...slip, id: `slip-${i}` })), timesheets: Array.from({ length: 8 }, (_, i) => ({ ...sheet, id: `sheet-${i}` })) }, locale);
    assert.equal(many.html.split(escape(t("netAmount", { amount: payrollMoneyDisplay(29, "KWD", resolvePresentation({ user: { language: locale } })) }))).length - 1, 10);
    assert.equal(many.html.split(escape(t("status_draft"))).length - 1, 5);
  }
  for (const value of Object.values(fa.PayrollSelfService)) assert.match(value, /[\u0600-\u06ff]/);
  const ast = ts.createSourceFile(page, readFileSync(page, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function visit(n: ts.Node) {
    if (ts.isJsxText(n)) assert.equal(n.text.trim(), "", n.text);
    if (ts.isJsxAttribute(n) && ["placeholder", "title", "description", "aria-label"].includes(n.name.getText(ast))) assert.ok(!n.initializer || !ts.isStringLiteral(n.initializer), n.getText(ast));
    ts.forEachChild(n, visit);
  }
  visit(ast);
});

test("self-service reader checks envelopes, identity, dates, quantities, finite labels and exact aliases", async () => {
  for (const [key, body] of Object.entries(bodies)) {
    const kind = key as keyof typeof bodies;
    assert.deepEqual(await payrollSelfServiceJson(Response.json(body), kind, profile.id), body);
    for (const bad of [null, [], {}, { error: "Private server" }]) await assert.rejects(payrollSelfServiceJson(Response.json(bad), kind));
    await assert.rejects(payrollSelfServiceJson(Response.json(body, { status: 403 }), kind));
    await assert.rejects(payrollSelfServiceJson(new Response("Private parser"), kind));
    await assert.rejects(payrollSelfServiceJson(Response.json(body), kind, "foreign"));
  }
  for (const patch of [{ id: "" }, { name: null }, { email: 7 }, { employeeNumber: null }, { position: 1 }, { bankAccountNumber: {} }, { salary: undefined, salaryMinor: undefined }, { salaryMinor: "29" }, { currency: "usd" }, { ptoBalanceHours: -1 }]) await assert.rejects(payrollSelfServiceJson(Response.json({ employee: { ...profile, ...patch } }), "profile"));
  for (const [kind, row, patches] of [
    ["payslips", slip, [{ currency: null }, { grossAmountMinor: "29" }, { netAmount: undefined, netAmountMinor: undefined }, { generatedAt: "Private" }, { payrollRun: {} }, { payrollRun: { payPeriodStart: "2026-02-30", payPeriodEnd: "2026-03-01" } }]],
    ["leave", balance, [{ policy: {} }, { policy: { name: null, leaveType: "sick" } }, { policy: { name: caller, leaveType: "private" } }, { balance: -1 }, { usedHours: 0.1 }]],
    ["timesheets", sheet, [{ status: "Private" }, { periodStart: "2026-10-01" }, { periodEnd: null }, { totalHours: -1 }, { totalHours: 0.1 }]],
  ] as const) {
    for (const patch of [{ id: "" }, { employeeId: null }, ...patches]) await assert.rejects(payrollSelfServiceJson(Response.json({ data: [{ ...row, ...patch }] }), kind));
    await assert.rejects(payrollSelfServiceJson(Response.json({ data: [row, row] }), kind));
    assert.deepEqual(await payrollSelfServiceJson(Response.json({ data: [] }), kind, profile.id), { data: [] });
  }
  await payrollSelfServiceJson(Response.json({ employee: { ...profile, email: null, position: null, bankAccountNumber: null } }), "profile");
});

test("initial self-service reads keep org headers and adopt only a complete checked profile and history", async () => {
  for (const locale of locales) {
    const paths: string[] = [];
    await withIO(async (url, init) => {
      paths.push(String(url)); assert.deepEqual(init?.headers, { "x-organization-id": "org-a" }); assert.equal(init?.method, undefined);
      return response(url);
    }, async () => {
      const h = render(page, {}, locale); h.effects[0](); await flush();
      for (const [key, value] of Object.entries({ profile, payslips: [slip], leaveBalances: [balance], timesheets: [sheet], email: profile.email, bankAccount: profile.bankAccountNumber, moneyError: null, loading: false })) assert.ok(has(h, key, value), key);
      assert.deepEqual(paths, ["profile", "payslips", "leave-balance", "timesheets"].map(p => "/api/v1/payroll/self-service/" + p));
    });
    for (const target of ["profile", "payslips", "leave-balance", "timesheets"]) for (const mode of ["http", "json", "envelope", "invalid", "network"]) {
      await withIO(async url => {
        if (!String(url).endsWith("/" + target)) return response(url);
        if (mode === "network") throw new Error("Private network");
        if (mode === "http") return Response.json({ error: "Private server" }, { status: 403 });
        if (mode === "json") return new Response("Private parser");
        if (mode === "envelope") return Response.json({});
        return Response.json(target === "profile" ? { employee: { ...profile, salaryMinor: "29" } } : { data: [{ ...(target === "payslips" ? slip : target === "leave-balance" ? balance : sheet), employeeId: "foreign" }] });
      }, async () => {
        const h = render(page, {}, locale); h.effects[0](); await flush();
        assert.ok(has(h, "moneyError", "loadFailed")); assert.ok(has(h, "loading", false));
        assert.ok(!h.events.some(v => Array.isArray(v) && ["profile", "payslips", "leaveBalances", "timesheets", "email", "bankAccount"].includes(v[0])));
        assert.ok(!JSON.stringify(h.events).includes("Private"));
      });
    }
  }
});

test("absent organization, storage failure, missing profile and read cleanup finish without leaking diagnostics", async () => {
  for (const storageThrows of [false, true]) await withIO(async () => { assert.fail("No org fetch"); }, async () => {
    const h = render(page); h.effects[0](); await flush();
    assert.ok(has(h, "moneyError", "organizationRequired")); assert.ok(has(h, "loading", false));
  }, null, storageThrows);
  await withIO(async url => { assert.ok(String(url).endsWith("/profile")); return Response.json({ error: "Private missing" }, { status: 404 }); }, async () => {
    const h = render(page, { moneyError: "loadFailed" }); h.effects[0](); await flush(); assert.ok(has(h, "profile", null)); assert.ok(has(h, "loading", false)); assert.ok(has(h, "moneyError", null)); assert.ok(!has(h, "moneyError", "loadFailed"));
  });
  for (const lateHistory of [false, true]) for (const failure of [false, true]) {
    let finish!: (r: Response) => void, fail!: (e: Error) => void;
    await withIO(async url => {
      if (lateHistory && String(url).endsWith("/profile")) return response(url);
      if (lateHistory && !String(url).endsWith("/payslips")) return response(url);
      return new Promise((resolve, reject) => { finish = resolve; fail = reject; });
    }, async () => {
      const h = render(page), cleanup = h.effects[0](); await flush(); (cleanup as () => void)(); const size = h.events.length;
      if (failure) fail(new Error("Private late")); else finish(Response.json(lateHistory ? bodies.payslips : bodies.profile));
      await flush(); assert.equal(h.events.length, size);
    });
  }
});

test("profile save preserves PATCH fields, validates employee identity and retains edits on every failure", async () => {
  for (const locale of locales) for (const mode of ["ok", "http", "json", "envelope", "money", "wrong-id", "network", "no-org", "storage"]) {
    let calls = 0;
    await withIO(async (url, init) => {
      calls++; assert.equal(url, "/api/v1/payroll/self-service/profile"); assert.equal(init?.method, "PATCH");
      assert.deepEqual(init?.headers, { "Content-Type": "application/json", "x-organization-id": "org-a" });
      assert.deepEqual(JSON.parse(String(init?.body)), { email: loaded.email, bankAccountNumber: loaded.bankAccount });
      if (mode === "network") throw new Error("Private network");
      if (mode === "http") return Response.json({ error: "Private server" }, { status: 403 });
      if (mode === "json") return new Response("Private parser");
      if (mode === "envelope") return Response.json({ success: true });
      return Response.json({ employee: { ...profile, ...(mode === "money" ? { salaryMinor: "29" } : {}), ...(mode === "wrong-id" ? { id: "foreign" } : {}) } });
    }, async () => {
      const h = render(page, loaded, locale); await save(h, locale)(); const t = translator(locale);
      assert.equal(calls, ["no-org", "storage"].includes(mode) ? 0 : 1);
      assert.ok(has(h, mode === "ok" ? "success" : "error", t(mode === "ok" ? "profileUpdated" : ["no-org", "storage"].includes(mode) ? "organizationRequired" : "saveFailed")));
      if (calls) { assert.ok(has(h, "saving", true)); assert.ok(has(h, "saving", false)); }
      assert.ok(!h.events.some(v => Array.isArray(v) && ["email", "bankAccount"].includes(v[0])));
      assert.ok(!JSON.stringify(h.events).includes("Private"));
      if (mode !== "ok") assert.ok(!has(h, "success", t("profileUpdated")));
    }, mode === "no-org" ? null : "org-a", mode === "storage");
  }
  await withIO(async (_url, init) => { assert.deepEqual(JSON.parse(String(init?.body)), {}); return Response.json(bodies.profile); }, async () => {
    const h = render(page, { ...loaded, email: "", bankAccount: "" }); await save(h, "en-US")();
  });
  const h = render(page, loaded), inputs = h.captured.filter(c => c.props.onChange);
  for (const [i, key] of ["email", "bankAccount"].entries()) {
    (inputs[i].props.onChange as (e: { target: { value: string } }) => void)({ target: { value: "updated" } }); assert.ok(has(h, key, "updated"));
  }
});
