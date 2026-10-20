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
import { payrollTimeJson, payrollTimeMatch } from "../i18n/payroll-time-presentation";
import { renderWithPresentation } from "./helpers/presentation";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const base = "app/(dashboard)/payroll/";
const files = ["leave/page.tsx", "leave/[id]/page.tsx", "timesheets/page.tsx", "timesheets/[id]/page.tsx"].map(p => base + p);
const locales = ["en-US", "fa-IR"] as const;
const noop = () => {};
const caller = "<script>caller & name</script>";
const escape = (v: string) => v.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
const translator = (locale: typeof locales[number]) => createTranslator({ locale, messages: locale === "en-US" ? en : fa, namespace: "PayrollTimeDetail" });
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
    if (id === "next/navigation") return { useParams: () => ({ id: states.recordId ?? (file.includes("/leave/") ? "leave-a" : "sheet-a") }), useRouter: () => ({ push: (v: string) => h.events.push(["push", v]) }) };
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
const entry = { id: "entry-a", date: "2026-10-01", hours: 7.5, shiftType: "regular", description: caller };
const sheet = { id: "sheet-a", employee: { name: caller, employeeNumber: "EMP-001" }, periodStart: "2026-10-01", periodEnd: "2026-10-15", totalHours: 7.5, status: "draft", rejectionReason: caller, entries: [entry] };
const leave = { id: "leave-a", employee: { name: caller }, policy: { name: "Saved policy", leaveType: "vacation" }, startDate: "2026-10-01", endDate: "2026-10-02", hours: 7.5, reason: caller, status: "pending", rejectionReason: caller, approvedAt: "2026-10-01T10:00:00Z" };
const pagination = { total: 1, page: 1, limit: 50, totalPages: 1 };
const loaded = { loading: false, requests: [leave], timesheets: [sheet], req: leave, ts: sheet, dialogOpen: true, rejectOpen: true, employees: [{ id: "employee-a", name: caller }], policies: [{ id: "policy-a", name: "Saved policy" }] };
const tsForm = { employeeId: "employee-a", periodStart: "2026-10-01", periodEnd: "2026-10-15" };
const leaveForm = { employeeId: "employee-a", policyId: "policy-a", startDate: "2026-10-01", endDate: "2026-10-02", hours: "7.5", reason: caller };
const has = (h: Harness, key: string, value: unknown) => h.events.some(v => JSON.stringify(v) === JSON.stringify([key, value]));
const action = (h: Harness, label: string) => {
  const c = h.captured.find(c => c.kind === "Button" && (c.props.children === label || Array.isArray(c.props.children) && c.props.children.includes(label) || c.props["aria-label"] === label));
  assert.ok(c, label); return c.props.onClick as () => Promise<void>;
};
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

test("four payroll templates render real bilingual labels, escaped saved data, exact dates/hours and machine choices", () => {
  for (const locale of locales) for (const file of files) {
    const t = translator(locale), h = render(file, loaded, locale);
    assert.ok(h.html.includes(escape(caller)) && !h.html.includes("<script>"));
    assert.ok(h.html.includes("2026-10-01") && h.html.includes("7.5"));
    const title = file.includes("/leave/") ? file.includes("[id]") ? "leaveDetailTitle" : "leaveTitle" : file.includes("[id]") ? "sheetDetailTitle" : "sheetTitle";
    assert.ok(has(h, "title", t(title)));
    for (const status of file.includes("/leave/") ? ["pending", "approved", "rejected", "cancelled"] : ["draft", "submitted", "approved", "rejected"]) {
      const state = file.includes("/leave/") ? { req: { ...leave, status }, requests: [{ ...leave, status }] } : { ts: { ...sheet, status }, timesheets: [{ ...sheet, status }] };
      assert.ok(render(file, { ...loaded, ...state }, locale).html.includes(escape(t(status as "draft"))), status);
    }
    if (file.endsWith("timesheets/[id]/page.tsx")) {
      assert.deepEqual(h.captured.filter(c => c.kind === "SelectItem").map(c => c.props.value), ["regular", "overtime", "night", "weekend", "holiday"]);
      for (const shiftType of ["regular", "overtime", "night", "weekend", "holiday"]) assert.ok(render(file, { ...loaded, ts: { ...sheet, entries: [{ ...entry, shiftType }] } }, locale).html.includes(escape(t(shiftType as "regular"))));
      assert.ok(h.html.includes(escape(t("delete"))));
    }
    if (!file.includes("[id]")) assert.deepEqual(h.captured.filter(c => c.kind === "TabsTrigger").map(c => c.props.value), file.includes("/leave/") ? ["all", "pending", "approved", "rejected"] : ["all", "draft", "submitted", "approved", "rejected"]);
  }
  for (const value of Object.values(fa.PayrollTimeDetail)) assert.match(value, /[\u0600-\u06ff]/);
});

test("loading, empty, missing, busy and failure states render catalog copy; authored JSX and visible attributes are extracted", () => {
  for (const locale of locales) for (const file of files) {
    const t = translator(locale);
    assert.ok(render(file, {}, locale).html.includes("brand-loader"));
    assert.ok(render(file, { ...loaded, moneyError: "Private response" }, locale).html.includes(escape(t("loadFailed"))));
    const empty = render(file, { ...loaded, requests: [], timesheets: [], ts: null, req: null }, locale);
    const key = file.includes("/leave/") ? file.includes("[id]") ? "leaveNotFound" : "noLeave" : file.includes("[id]") ? "sheetNotFound" : "noSheets";
    assert.ok(empty.html.includes(escape(t(key))));
    if (!file.includes("[id]")) assert.ok(render(file, { ...loaded, creating: true }, locale).html.includes(escape(t("creating"))));
    const ast = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(n: ts.Node) {
      if (ts.isJsxText(n)) assert.equal(n.text.trim(), "", `${file}: ${n.text}`);
      if (ts.isJsxAttribute(n) && ["placeholder", "title", "description", "aria-label"].includes(n.name.getText(ast))) assert.ok(!n.initializer || !ts.isStringLiteral(n.initializer), n.getText(ast));
      ts.forEachChild(n, visit);
    }
    visit(ast);
  }
});

test("detail readers reject malformed envelopes, saved quantities, enums, dates, entries, timestamps and nested money", async () => {
  assert.deepEqual((await payrollTimeJson(Response.json({ timesheet: sheet }), "timesheetDetail")).timesheet, sheet);
  assert.deepEqual((await payrollTimeJson(Response.json({ request: leave }), "leaveDetail")).request, leave);
  for (const change of [{ entries: null }, { entries: [entry, entry] }, { entries: [{ ...entry, date: "2026-09-01" }] }, { entries: [{ ...entry, shiftType: "Private" }] }, { entries: [{ ...entry, hours: 0.1 }] }, { rejectionReason: {} }, { employee: { name: caller } }, { employee: { ...sheet.employee, salary: 29 } }])
    await assert.rejects(payrollTimeJson(Response.json({ timesheet: { ...sheet, ...change } }), "timesheetDetail"));
  for (const change of [{ hours: "7.5" }, { hours: -1 }, { approvedAt: "invalid" }, { approvedAt: 42 }, { startDate: "2026-02-30" }, { status: "Private" }, { policy: {} }, { rejectionReason: {} }])
    await assert.rejects(payrollTimeJson(Response.json({ request: { ...leave, ...change } }), "leaveDetail"));
  await assert.rejects(payrollTimeJson(Response.json({}), "timesheetDetail"));
  await assert.rejects(payrollTimeJson(new Response("Private"), "leaveDetail"));
  await assert.rejects(payrollTimeJson(Response.json({ error: "Private" }, { status: 403 }), "leaveDetail"));
  await assert.rejects(payrollTimeJson(Response.json({ success: false }), "deleted"));
  await assert.rejects(payrollTimeJson(Response.json({ timesheet: { id: "a", status: "draft" } }), "submitted"));
  await assert.rejects(payrollTimeJson(Response.json({ entry: { ...entry, description: {} } }), "entryCreated"));
  assert.throws(() => payrollTimeMatch({ id: "wrong" }, "selected"));
});

function readResponse(url: string) {
  if (url.endsWith("/employees")) return Response.json({ data: loaded.employees });
  if (url.endsWith("/policies")) return Response.json({ data: loaded.policies });
  if (url.endsWith("/leave/requests/leave-a")) return Response.json({ request: leave });
  if (url.endsWith("/timesheets/sheet-a")) return Response.json({ timesheet: sheet });
  return Response.json({ data: url.includes("/leave/") ? [leave] : [sheet], pagination });
}
test("initial reads preserve routes/headers and reject failures before adoption; cleanup ignores obsolete results", async () => {
  for (const file of files) {
    await withIO(async (url, init) => { assert.deepEqual(init?.headers, { "x-organization-id": "org-a" }); return readResponse(String(url)); }, async () => {
      const h = render(file); h.effects[0](); await flush();
      const key = file.includes("[id]") ? file.includes("/leave/") ? "req" : "ts" : file.includes("/leave/") ? "requests" : "timesheets";
      assert.ok(has(h, key, key === "req" ? leave : key === "ts" ? sheet : key === "requests" ? [leave] : [sheet]));
      assert.ok(has(h, "loading", false));
    });
    for (const fail of ["http", "json", "envelope", "network", "mismatch"]) await withIO(async url => {
      if (fail === "network") throw new Error("Private");
      if (fail === "http") return Response.json({ error: "Private" }, { status: 403 });
      if (fail === "json") return new Response("Private");
      if (fail === "mismatch") return Response.json({ request: { ...leave, id: "wrong" }, timesheet: { ...sheet, id: "wrong" } });
      return String(url).endsWith("employees") ? readResponse(String(url)) : Response.json({});
    }, async () => {
      const h = render(file); h.effects[0](); await flush();
      assert.ok(has(h, "moneyError", "loadFailed") && has(h, "loading", false));
      assert.ok(!h.events.some(e => ["req", "ts", "requests", "timesheets", "employees"].includes((e as string[])[0])));
      assert.doesNotMatch(JSON.stringify(h.events), /Private/);
    });
    for (const fail of [false, true]) {
      const completions: (() => void)[] = [];
      await withIO((url) => new Promise((resolve, reject) => completions.push(() => fail ? reject(new Error("Private")) : resolve(readResponse(String(url))))), async () => {
        const h = render(file), cleanup = h.effects[0](); (cleanup as () => void)(); completions.forEach(fn => fn()); await flush();
        assert.ok(!h.events.some(e => ["loading", "req", "ts", "requests", "timesheets", "moneyError"].includes((e as string[])[0])));
      });
    }
    for (const storageThrows of [false, true]) await withIO(async () => { throw new Error("Unexpected fetch"); }, async () => {
      const h = render(file); h.effects[0](); await flush(); assert.ok(has(h, "loading", false));
    }, null, storageThrows);
    if (file.includes("[id]")) await withIO(async () => Response.json({ error: "Private" }, { status: 404 }), async () => {
      const h = render(file); h.effects[0](); await flush(); assert.ok(has(h, file.includes("/leave/") ? "req" : "ts", null));
      assert.ok(has(h, "loading", false) && !has(h, "moneyError", "loadFailed"));
    });
  }
});

test("list filters/search, navigation and creation preserve machine values and failed forms", async () => {
  for (const locale of locales) for (const file of [files[0], files[2]]) {
    const isLeave = file.includes("/leave/"), t = translator(locale);
    const h = render(file, loaded, locale), tabs = h.captured.find(c => c.kind === "Tabs")!;
    (tabs.props.onValueChange as (v: string) => void)(isLeave ? "pending" : "draft"); assert.ok(has(h, "statusFilter", isLeave ? "pending" : "draft"));
    assert.ok(render(file, { ...loaded, search: "absent" }, locale).html.includes(escape(t(isLeave ? "noLeave" : "noSheets"))));
    assert.ok(render(file, { ...loaded, statusFilter: "rejected" }, locale).html.includes(escape(t(isLeave ? "noLeave" : "noSheets"))));
    if (!isLeave) {
      const row = h.captured.find(c => c.kind === "button" && String(c.props.className).includes("w-full flex"))!;
      (row.props.onClick as () => void)(); assert.ok(has(h, "push", "/payroll/timesheets/sheet-a"));
    }
    for (const fail of ["none", "http", "json", "envelope", "network", "refresh"]) await withIO(async (url, init) => {
      if (!init?.method) { if (fail === "refresh") throw new Error("Private refresh"); return readResponse(String(url)); }
      assert.equal(url, isLeave ? "/api/v1/payroll/leave/requests" : "/api/v1/payroll/timesheets");
      assert.deepEqual(init.headers, { "Content-Type": "application/json", "x-organization-id": "org-a" });
      assert.deepEqual(JSON.parse(init.body as string), isLeave ? { ...leaveForm, hours: 7.5 } : tsForm);
      if (fail === "network") throw new Error("Private");
      return fail === "http" ? Response.json({ error: "Private" }, { status: 409 }) : fail === "json" ? new Response("Private") : fail === "envelope" ? Response.json({}) : Response.json(isLeave ? { request: { id: "new-a", status: "pending" } } : { timesheet: { id: "new-a" } });
    }, async () => {
      const h = render(file, { ...loaded, form: leaveForm, newTs: tsForm }, locale);
      await action(h, t(isLeave ? "submitRequest" : "create"))(); await flush();
      const ok = fail === "none" || fail === "refresh";
      assert.ok(has(h, ok ? "success" : "error", t(ok ? isLeave ? "leaveCreated" : "sheetCreated" : isLeave ? "createLeaveFailed" : "createSheetFailed")));
      assert.ok(has(h, "creating", false));
      if (ok) { assert.ok(has(h, "dialogOpen", false)); if (!isLeave) assert.ok(has(h, "push", "/payroll/timesheets/new-a")); }
      else assert.ok(!h.events.some(e => ["dialogOpen", "form", "newTs", "push", "success"].includes((e as string[])[0])));
      if (isLeave && fail === "refresh") assert.ok(has(h, "error", t("loadFailed")));
      assert.doesNotMatch(JSON.stringify(h.events), /Private/);
    });
  }
});

test("approval/rejection/submission callbacks retain confirmations, exact payloads, busy release and separate refresh errors", async () => {
  for (const locale of locales) for (const file of files) {
    const isLeave = file.includes("/leave/"), detail = file.includes("[id]"), t = translator(locale);
    if (!isLeave && !detail) continue;
    for (const operation of isLeave ? ["approve", "reject"] : ["submit", "approve", "reject"]) for (const fail of ["none", "http", "json", "envelope", "mismatch", "network", "refresh"]) {
      await withIO(async (url, init) => {
        if (!init?.method) { if (fail === "refresh") throw new Error("Private refresh"); return readResponse(String(url)); }
        assert.equal(url, `/api/v1/payroll/${isLeave ? "leave/requests/leave-a" : "timesheets/sheet-a"}/${operation}`);
        const rejecting = operation === "reject";
        assert.deepEqual(init.headers, rejecting ? { "Content-Type": "application/json", "x-organization-id": "org-a" } : { "x-organization-id": "org-a" });
        assert.equal(init.body, rejecting ? detail ? JSON.stringify({ reason: caller }) : "{}" : undefined);
        if (fail === "network") throw new Error("Private");
        return fail === "http" ? Response.json({ error: "Private" }, { status: 403 }) : fail === "json" ? new Response("Private") : fail === "envelope" ? Response.json({}) : Response.json({ [isLeave ? "request" : "timesheet"]: { id: fail === "mismatch" ? "wrong" : isLeave ? "leave-a" : "sheet-a", status: operation === "submit" ? "submitted" : operation === "approve" ? "approved" : "rejected" } });
      }, async () => {
        const state = { ...loaded, rejectReason: `  ${caller}  `, ts: { ...sheet, status: operation === "submit" ? "draft" : "submitted" } };
        const h = render(file, state, locale), label = operation === "reject" && detail ? isLeave ? "rejectRequest" : "rejectSheet" : operation;
        await action(h, t(label as "approve"))(); await flush();
        const ok = fail === "none" || fail === "refresh";
        const success = isLeave ? operation === "approve" ? "leaveApproved" : "leaveRejected" : operation === "submit" ? "sheetSubmitted" : operation === "approve" ? "sheetApproved" : "sheetRejected";
        assert.ok(has(h, ok ? "success" : "error", t(ok ? success : operation === "submit" ? "submitFailed" : operation === "approve" ? "approveFailed" : "rejectFailed")));
        if (detail && operation !== "submit") assert.ok(has(h, operation === "approve" ? "approving" : "rejecting", false));
        if (!ok) assert.ok(!h.events.some(e => ["success", "rejectOpen", "rejectReason", "ts", "req", "requests"].includes((e as string[])[0])));
        if (ok && operation === "reject" && detail) assert.ok(has(h, "rejectOpen", false) && has(h, "rejectReason", ""));
        if (fail === "refresh") assert.ok(has(h, "error", t("loadFailed")));
        if (isLeave && detail && operation === "approve") {
          const event = h.events.find(e => (e as unknown[])[0] === "confirm") as [string, Record<string, unknown>];
          assert.equal(event[1].title, t("approveTitle")); assert.equal(event[1].description, t("approveDescription", { employee: caller, policy: "Saved policy", hours: "7.5" }));
        }
        assert.doesNotMatch(JSON.stringify(h.events), /Private/);
      });
    }
  }
});

test("entry add/delete preserve binary32 hours, shift codes, confirmation and forms on failure", async () => {
  const file = files[3];
  for (const locale of locales) for (const deleting of [false, true]) for (const fail of ["none", "http", "json", "envelope", "network", "refresh"]) {
    const t = translator(locale);
    await withIO(async (url, init) => {
      if (!init?.method) { if (fail === "refresh") throw new Error("Private refresh"); return readResponse(String(url)); }
      assert.equal(url, `/api/v1/payroll/timesheets/sheet-a/entries${deleting ? "?entryId=entry-a" : ""}`);
      assert.equal(init.method, deleting ? "DELETE" : "POST");
      assert.deepEqual(init.headers, deleting ? { "x-organization-id": "org-a" } : { "Content-Type": "application/json", "x-organization-id": "org-a" });
      if (!deleting) assert.deepEqual(JSON.parse(init.body as string), { date: "2026-10-01", hours: 7.5, shiftType: "night", description: caller });
      if (fail === "network") throw new Error("Private");
      return fail === "http" ? Response.json({ error: "Private" }, { status: 409 }) : fail === "json" ? new Response("Private") : fail === "envelope" ? Response.json({}) : Response.json(deleting ? { success: true } : { entry });
    }, async () => {
      const h = render(file, { ...loaded, newDate: "2026-10-01", newHours: "7.5", newShiftType: "night", newDesc: caller }, locale);
      await action(h, t(deleting ? "delete" : "addEntry"))(); await flush();
      const ok = fail === "none" || fail === "refresh";
      if (!ok) { assert.ok(has(h, "error", t(deleting ? "deleteFailed" : "addFailed"))); assert.ok(!h.events.some(e => ["newDate", "newHours", "newDesc", "ts", "success"].includes((e as string[])[0]))); }
      else if (!deleting) assert.ok(has(h, "success", t("entryAdded")) && has(h, "newHours", ""));
      if (fail === "refresh") assert.ok(has(h, "error", t("loadFailed")));
      if (deleting) {
        const event = h.events.find(e => (e as unknown[])[0] === "confirm") as [string, Record<string, unknown>];
        assert.equal(event[1].title, t("deleteTitle")); assert.equal(event[1].destructive, true);
      }
      assert.doesNotMatch(JSON.stringify(h.events), /Private/);
    });
  }
  await withIO(async () => { throw new Error("Cancelled operations must not fetch"); }, async () => {
    const h = render(files[1], { ...loaded, confirmed: false }); await action(h, "Approve")();
    const d = render(files[3], { ...loaded, confirmed: false }); await action(d, "Delete")();
    assert.ok(![...h.events, ...d.events].some(e => ["success", "error"].includes((e as string[])[0])));
  });
});
