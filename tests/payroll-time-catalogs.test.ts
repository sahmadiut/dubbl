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
import { payrollTimeJson } from "../i18n/payroll-time-presentation";
import { renderWithPresentation } from "./helpers/presentation";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const page = "app/(dashboard)/payroll/time-leave/page.tsx";
const locales = ["en-US", "fa-IR"] as const;
const noop = () => {};
const caller = "<script>caller & name</script>";
const escape = (v: string) => v.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
const translator = (locale: typeof locales[number]) => createTranslator({ locale, messages: locale === "en-US" ? en : fa, namespace: "PayrollTimeLeave" });
type Capture = { kind: string; props: Record<string, unknown> };
type Harness = { captured: Capture[]; events: unknown[]; effects: (() => void | (() => void))[]; refs: Record<string, { current: unknown }> };

// Real production templates and next-intl; hook/IO state and portals are controlled.
function render(file: string, states: Record<string, unknown> = {}, locale: typeof locales[number] = "en-US") {
  const ast = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const name = "TimeLeavePage";
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
    if (id === "next/navigation") return { useRouter: () => ({ push: (v: string) => h.events.push(["push", v]) }) };
    if (id.endsWith("/topbar")) return { useTopbarAction: noop };
    if (id.endsWith("/use-debounce")) return { useDebounce: (v: string) => states.debouncedSearch ?? v };
    if (id.endsWith("/use-document-title")) return { useDocumentTitle: (v: string) => h.events.push(["title", v]) };
    if (id.endsWith("/use-confirm")) return { useConfirm: () => ({ dialog: null, confirm: async (v: unknown) => { h.events.push(["confirm", v]); return states.confirmed !== false; } }) };
    if (id.endsWith("/brand-loader")) return BrandLoader;
    for (const [suffix, names] of Object.entries({ "/ui/select": ["Select", "SelectContent", "SelectItem", "SelectTrigger", "SelectValue"], "/ui/tabs": ["Tabs", "TabsList", "TabsTrigger"], "/ui/sheet": ["Sheet", "SheetContent", "SheetHeader", "SheetTitle", "SheetDescription"], "/ui/date-picker": ["DatePicker"], "/ui/currency-select": ["CurrencySelect"] }))
      if (id.endsWith(suffix)) return Object.fromEntries(names.map(key => [key, inline(key)]));
    return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  };
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function("require", "module", "exports", code)(load, compiled, compiled.exports);
  const html = renderWithPresentation(createElement(compiled.exports[name]), locale);
  return { ...h, html };
}
const flush = async () => { for (let i = 0; i < 6; i++) await new Promise(resolve => setImmediate(resolve)); };
const sheet = { id: "sheet-a", employee: { name: caller, employeeNumber: "EMP-001" }, periodStart: "2026-10-01", periodEnd: "2026-10-15", totalHours: 7.5, status: "draft" };
const leave = { id: "leave-a", employee: { name: caller }, policy: { name: "Saved policy", leaveType: "vacation" }, startDate: "2026-10-01", endDate: "2026-10-02", hours: 7.5, reason: caller, status: "pending" };
const pagination = { total: 1, page: 1, limit: 50, totalPages: 1 };
const loaded = { tsInitialLoad: false, leaveInitialLoad: false, timesheets: [sheet], leaveRequests: [leave], tsTotalCount: 1, leaveTotalCount: 1, employees: [{ id: "employee-a", name: caller }], policies: [{ id: "policy-a", name: "Saved policy" }] };
const tsForm = { employeeId: "employee-a", periodStart: "2026-10-01", periodEnd: "2026-10-15" };
const leaveForm = { employeeId: "employee-a", policyId: "policy-a", startDate: "2026-10-01", endDate: "2026-10-02", hours: "7.5", reason: caller };
const has = (h: Harness, key: string, value: unknown) => h.events.some(v => JSON.stringify(v) === JSON.stringify([key, value]));
const action = (h: Harness, label: string) => {
  const c = h.captured.find(c => c.kind === "Button" && (c.props.children === label || Array.isArray(c.props.children) && c.props.children.includes(label)));
  assert.ok(c, label); return c.props.onClick as () => Promise<void>;
};
const submit = (h: Harness, index = 0) => (h.captured.filter(c => c.kind === "form")[index].props.onSubmit as (e: { preventDefault: () => void }) => Promise<void>)({ preventDefault: noop });
async function withIO(fetcher: typeof fetch, run: () => Promise<void>, org: string | null = "org-a", storageThrows = false) {
  const original = globalThis.fetch, storage = Object.getOwnPropertyDescriptor(globalThis, "localStorage"), win = Object.getOwnPropertyDescriptor(globalThis, "window");
  globalThis.fetch = fetcher;
  Object.defineProperty(globalThis, "window", { configurable: true, value: {} });
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: (key: string) => {
    assert.equal(key, "activeOrgId"); if (storageThrows) throw new Error("Private storage error"); return org;
  } } });
  try { await run(); } finally {
    globalThis.fetch = original;
    for (const [key, d] of [["localStorage", storage], ["window", win]] as const)
      if (d) Object.defineProperty(globalThis, key, d); else Reflect.deleteProperty(globalThis, key);
  }
}

test("time/leave production templates render both locales, finite statuses, hours, dates and unchanged choices", () => {
  for (const locale of locales) for (const view of ["timesheets", "leave"]) {
    const t = translator(locale), h = render(page, { ...loaded, view }, locale);
    for (const key of ["activeTimesheets", "pendingApprovals", "approvedThisMonth", "leaveHoursUsed", "timesheets", "leaveRequests", "employee", "policy", "periodStart", "periodEnd", "startDate", "endDate", "reason", "cancel", "createTimesheet", "submitRequest"] as const)
      assert.ok(h.html.includes(escape(t(key))), key);
    assert.ok(h.html.includes(escape(caller)) && !h.html.includes("<script>"));
    assert.ok(h.html.includes(escape(t("hoursValue", { hours: "7.5" }))));
    assert.ok(h.html.includes("2026-10-01"));
    const filters = h.captured.filter(c => c.kind === "TabsTrigger").map(c => c.props.value);
    assert.deepEqual(filters, view === "timesheets" ? ["all", "draft", "submitted", "approved", "rejected"] : ["all", "pending", "approved", "rejected"]);
    assert.deepEqual(h.captured.filter(c => c.kind === "SelectItem").map(c => c.props.value), [view === "timesheets" ? "period:desc" : "date:desc", view === "timesheets" ? "period:asc" : "date:asc", "employee:asc", "employee:desc", "hours:desc", "hours:asc", "status:asc", "status:desc"]);
    assert.ok(h.html.includes(escape(t(view === "timesheets" ? "showingTimesheets" : "showingLeave", { loaded: 1, total: 1 }))));
    for (const status of view === "timesheets" ? ["draft", "submitted", "approved", "rejected"] : ["pending", "approved", "rejected", "cancelled"]) {
      const state = view === "timesheets" ? { timesheets: [{ ...sheet, status }] } : { leaveRequests: [{ ...leave, status }] };
      assert.ok(render(page, { ...loaded, view, ...state }, locale).html.includes(escape(t(status as "draft")))) ;
    }
  }
  assert.equal(translator("en-US")("showingTimesheets", { loaded: 2, total: 2 }), "Showing 2 of 2 timesheets");
  for (const value of Object.values(fa.PayrollTimeLeave)) assert.match(value, /[\u0600-\u06ff]/);
});

test("empty, search, busy and loading states use translated copy; authored JSX copy is cataloged", () => {
  for (const locale of locales) {
    const t = translator(locale);
    for (const view of ["timesheets", "leave"]) {
      const h = render(page, { ...loaded, view, timesheets: [], leaveRequests: [], savingTs: true, savingLeave: true }, locale);
      for (const key of [view === "timesheets" ? "noTimesheets" : "noLeave", view === "timesheets" ? "startTracking" : "startLeave", "creating", "submitting"] as const) assert.ok(h.html.includes(escape(t(key))));
      const search = render(page, { ...loaded, view, timesheets: [], leaveRequests: [], tsSearch: "missing", leaveSearch: "missing" }, locale);
      assert.ok(search.html.includes(escape(t("trySearch"))));
    }
    assert.ok(render(page, {}, locale).html.includes("brand-loader"));
  }
  const ast = ts.createSourceFile(page, readFileSync(page, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function visit(n: ts.Node) {
    if (ts.isJsxText(n)) assert.equal(n.text.trim(), "", n.text);
    if (ts.isJsxAttribute(n) && ["placeholder", "title", "aria-label"].includes(n.name.getText(ast))) assert.ok(!n.initializer || !ts.isStringLiteral(n.initializer), n.getText(ast));
    ts.forEachChild(n, visit);
  }
  visit(ast);
});

test("time reader checks envelopes, dates, hours, enum/linked display fields and payroll money aliases", async () => {
  assert.deepEqual(await payrollTimeJson(Response.json({ data: [sheet], pagination }), "timesheets"), { data: [sheet], pagination });
  assert.deepEqual(await payrollTimeJson(Response.json({ data: [leave], pagination }), "leave"), { data: [leave], pagination });
  for (const change of [{ totalHours: -1 }, { totalHours: 0.1 }, { status: "Private prose" }, { periodStart: "2026-02-30" }, { periodEnd: "2025-01-01" }, { employee: {} }, { id: "" }])
    await assert.rejects(payrollTimeJson(Response.json({ data: [{ ...sheet, ...change }], pagination }), "timesheets"));
  for (const change of [{ hours: "7.5" }, { reason: {} }, { policy: {} }, { status: "draft" }, { employee: { name: 123 } }])
    await assert.rejects(payrollTimeJson(Response.json({ data: [{ ...leave, ...change }], pagination }), "leave"));
  for (const body of [{}, { data: [sheet] }, { data: [sheet, sheet], pagination }, { data: [sheet], pagination: { ...pagination, totalPages: 0 } }])
    await assert.rejects(payrollTimeJson(Response.json(body), "timesheets"));
  await assert.rejects(payrollTimeJson(Response.json({ error: "Private error" }, { status: 403 }), "leave"));
  await assert.rejects(payrollTimeJson(new Response("broken"), "leave"));
  await assert.rejects(payrollTimeJson(Response.json({ data: [{ id: "a", name: "A", salary: 29 }] }), "employees"));
  await assert.rejects(payrollTimeJson(Response.json({ request: { id: "a", status: "pending" } }), "approved"));
  await assert.rejects(payrollTimeJson(Response.json({ timesheet: {} }), "timesheetCreated"));
});

test("initial reads preserve routes/headers, validate before adoption and suppress obsolete success/failure", async () => {
  await withIO(async (url, init) => {
    assert.deepEqual(init?.headers, { "x-organization-id": "org-a" });
    if (String(url).includes("timesheets?")) return Response.json({ data: [sheet], pagination });
    if (String(url).includes("requests?")) return Response.json({ data: [leave], pagination });
    return Response.json({ data: [{ id: "choice-a", name: caller }] });
  }, async () => {
    const h = render(page); h.effects.slice(0, 3).forEach(fn => fn()); await flush();
    assert.ok(has(h, "timesheets", [sheet])); assert.ok(has(h, "leaveRequests", [leave]));
    assert.ok(has(h, "employees", [{ id: "choice-a", name: caller }]));
    assert.ok(has(h, "policies", [{ id: "choice-a", name: caller }]));
    assert.ok(has(h, "tsInitialLoad", false) && has(h, "leaveInitialLoad", false));
  });
  for (const failure of [false, true]) await withIO(async () => {
    if (failure) throw new Error("Private network error"); return Response.json({ error: "Private" }, { status: 403 });
  }, async () => {
    const h = render(page); h.effects.slice(0, 3).forEach(fn => fn()); await flush();
    assert.equal(h.events.filter(e => (e as unknown[])[0] === "error").length, 4);
    assert.ok(!h.events.some(e => ["timesheets", "leaveRequests", "employees", "policies"].includes((e as string[])[0])));
    assert.doesNotMatch(JSON.stringify(h.events), /Private/);
  });
  for (const failure of [false, true]) {
    let finish!: (v: Response) => void, reject!: (e: Error) => void;
    await withIO(() => new Promise((r, j) => { finish = r; reject = j; }), async () => {
      const h = render(page), cleanup = h.effects[0](); (cleanup as () => void)();
      if (failure) reject(new Error("Private")); else finish(Response.json({ data: [sheet], pagination }));
      await flush(); assert.ok(!has(h, "timesheets", [sheet])); assert.ok(!has(h, "tsInitialLoad", false));
      assert.ok(!h.events.some(e => (e as unknown[])[0] === "error"));
    });
  }
  for (const storageThrows of [false, true]) await withIO(async () => { throw new Error("No request expected"); }, async () => {
    const h = render(page); h.effects.slice(0, 3).forEach(fn => fn());
    assert.ok(has(h, "tsInitialLoad", false) && has(h, "leaveInitialLoad", false));
  }, null, storageThrows);
});

test("filters, sort, search, navigation and paginated callbacks retain machine values", async () => {
  const h = render(page, loaded);
  const row = h.captured.find(c => c.kind === "button" && c.props.className?.toString().includes("w-full flex"))!;
  (row.props.onClick as () => void)(); assert.ok(has(h, "push", "/payroll/timesheets/sheet-a"));
  const tabs = h.captured.find(c => c.kind === "Tabs")!;
  (tabs.props.onValueChange as (v: string) => void)("submitted"); assert.ok(has(h, "tsFilter", "submitted"));
  const sort = h.captured.find(c => c.kind === "Select")!;
  (sort.props.onValueChange as (v: string) => void)("hours:asc");
  assert.ok(has(h, "tsSortBy", "hours") && has(h, "tsSortOrder", "asc"));
  const search = render(page, { ...loaded, tsSearch: "absent" });
  assert.ok(search.html.includes("No timesheets found"));
  assert.equal(search.captured.filter(c => c.kind === "button" && c.props.className?.toString().includes("w-full flex")).length, 0);
  const sorted = render(page, { ...loaded, employees: [], timesheets: [
    { ...sheet, id: "low", totalHours: 0.25, employee: { name: "Employee Abe", employeeNumber: "A" } },
    { ...sheet, id: "high", totalHours: 7.5, employee: { name: "Employee Zed", employeeNumber: "Z" } },
  ], tsSortBy: "hours", tsSortOrder: "desc" });
  assert.ok(sorted.html.indexOf("Employee Zed") < sorted.html.indexOf("Employee Abe"));
  const observerDescriptor = Object.getOwnPropertyDescriptor(globalThis, "IntersectionObserver");
  let intersect!: (v: { isIntersecting: boolean }[]) => void;
  Object.defineProperty(globalThis, "IntersectionObserver", { configurable: true, value: class {
    constructor(callback: typeof intersect) { intersect = callback; }
    observe() {} disconnect() {}
  } });
  try {
    for (const view of ["timesheets", "leave"]) for (const failure of [false, true]) await withIO(async (url, init) => {
      assert.equal(url, view === "timesheets" ? "/api/v1/payroll/timesheets?status=submitted&page=2&limit=50" : "/api/v1/payroll/leave/requests?status=pending&page=2&limit=50");
      assert.deepEqual(init?.headers, { "x-organization-id": "org-a" });
      return Response.json(failure ? {} : { data: [view === "timesheets" ? { ...sheet, id: "next" } : { ...leave, id: "next" }], pagination: { total: 51, page: 2, limit: 50, totalPages: 2 } });
    }, async () => {
      const h = render(page, { ...loaded, view, tsFilter: "submitted", leaveFilter: "pending" });
      h.refs[view === "timesheets" ? "tsSentinelRef" : "leaveSentinelRef"].current = {};
      const cleanup = h.effects[view === "timesheets" ? 3 : 4](); intersect([{ isIntersecting: true }]); await flush();
      const name = view === "timesheets" ? "timesheets" : "leaveRequests";
      const event = h.events.find(e => (e as unknown[])[0] === name) as [string, (prev: unknown[]) => unknown[]] | undefined;
      if (failure) { assert.equal(event, undefined); assert.ok(!has(h, view === "timesheets" ? "tsPage" : "leavePage", 2)); }
      else { assert.ok(event); assert.deepEqual(event[1](["saved"]), ["saved", view === "timesheets" ? { ...sheet, id: "next" } : { ...leave, id: "next" }]); }
      assert.ok(has(h, view === "timesheets" ? "tsLoadingMore" : "leaveLoadingMore", false));
      (cleanup as () => void)();
    });
  } finally {
    if (observerDescriptor) Object.defineProperty(globalThis, "IntersectionObserver", observerDescriptor); else Reflect.deleteProperty(globalThis, "IntersectionObserver");
  }
});

test("creation callbacks preserve payloads, navigate/refresh only after checked success and retain failed forms", async () => {
  for (const locale of locales) for (const kind of ["timesheet", "leave"]) {
    const t = translator(locale);
    await withIO(async (url, init) => {
      if (init?.method === "POST") {
        assert.equal(url, kind === "timesheet" ? "/api/v1/payroll/timesheets" : "/api/v1/payroll/leave/requests");
        assert.deepEqual(init.headers, { "Content-Type": "application/json", "x-organization-id": "org-a" });
        assert.deepEqual(JSON.parse(init.body as string), kind === "timesheet" ? tsForm : { ...leaveForm, hours: 7.5 });
        return Response.json(kind === "timesheet" ? { timesheet: { id: "new-a" } } : { request: { id: "new-a", status: "pending" } });
      }
      assert.equal(url, "/api/v1/payroll/leave/requests?page=1&limit=50");
      return Response.json({ data: [leave], pagination });
    }, async () => {
      const h = render(page, { ...loaded, newTs: tsForm, leaveForm }, locale); await submit(h, kind === "timesheet" ? 0 : 1);
      assert.ok(has(h, "success", t(kind === "timesheet" ? "timesheetCreated" : "leaveCreated")));
      assert.ok(has(h, kind === "timesheet" ? "savingTs" : "savingLeave", false));
      assert.ok(kind === "timesheet" ? has(h, "push", "/payroll/timesheets/new-a") : has(h, "leaveRequests", [leave]));
    });
    for (const fail of ["http", "json", "envelope", "network"]) await withIO(async () => {
      if (fail === "network") throw new Error("Private");
      return fail === "http" ? Response.json({ error: "Private" }, { status: 409 }) : fail === "json" ? new Response("Private") : Response.json({});
    }, async () => {
      const h = render(page, { ...loaded, newTs: tsForm, leaveForm }, locale); await submit(h, kind === "timesheet" ? 0 : 1);
      assert.ok(has(h, "error", t(kind === "timesheet" ? "createTimesheetFailed" : "createLeaveFailed")));
      assert.ok(!h.events.some(e => ["success", "push", "newTs", "leaveForm", "tsDrawerOpen", "leaveDrawerOpen"].includes((e as string[])[0])));
      assert.ok(has(h, kind === "timesheet" ? "savingTs" : "savingLeave", false));
    });
  }
});

test("leave approval and confirmed rejection retain exact operations, finite failures and successful mutation on refresh failure", async () => {
  for (const locale of locales) for (const reject of [false, true]) for (const failure of ["none", "http", "mismatch", "network", "refresh"]) {
    const t = translator(locale), label = t(reject ? "reject" : "approve");
    await withIO(async (url, init) => {
      if (init?.method === "POST") {
        assert.equal(url, `/api/v1/payroll/leave/requests/leave-a/${reject ? "reject" : "approve"}`);
        assert.deepEqual(init.headers, reject ? { "Content-Type": "application/json", "x-organization-id": "org-a" } : { "x-organization-id": "org-a" });
        assert.equal(init.body, reject ? "{}" : undefined);
        if (failure === "network") throw new Error("Private");
        return failure === "http" ? Response.json({ error: "Private" }, { status: 403 }) : Response.json({ request: { id: failure === "mismatch" ? "wrong" : "leave-a", status: reject ? "rejected" : "approved" } });
      }
      if (failure === "refresh") throw new Error("Private refresh");
      return Response.json({ data: [leave], pagination });
    }, async () => {
      const h = render(page, { ...loaded, view: "leave" }, locale); await action(h, label)();
      if (reject) {
        const event = h.events.find(e => (e as unknown[])[0] === "confirm") as [string, Record<string, unknown>];
        assert.equal(event[1].title, t("rejectTitle")); assert.equal(event[1].confirmLabel, t("reject"));
      }
      assert.ok(has(h, failure === "none" || failure === "refresh" ? "success" : "error", t(failure === "none" || failure === "refresh" ? reject ? "requestRejected" : "requestApproved" : reject ? "rejectFailed" : "approveFailed")));
      if (failure === "refresh") { assert.ok(has(h, "error", t("loadLeaveFailed"))); assert.ok(has(h, "leaveRefetching", false)); }
      assert.doesNotMatch(JSON.stringify(h.events), /Private/);
    });
  }
  await withIO(async () => { throw new Error("Cancelled rejection must not send"); }, async () => {
    const h = render(page, { ...loaded, view: "leave", confirmed: false }); await action(h, "Reject")();
    assert.ok(!h.events.some(e => ["success", "error", "leaveRequests"].includes((e as string[])[0])));
  });
});
