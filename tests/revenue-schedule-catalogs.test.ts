import { resolvePresentation } from "../i18n/locale";
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
import * as DataTable from "../components/dashboard/data-table";
import * as DatePicker from "../components/ui/date-picker";
import { revenueStatusLabel, revenueMethodLabel, revenueScheduleValid } from "../i18n/revenue-schedule-presentation";
import { assetMoneyDisplay } from "../lib/money/asset-display";
import { renderWithPresentation } from "./helpers/presentation";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const list = "app/(dashboard)/sales/revenue-schedules/page.tsx";
const detail = "app/(dashboard)/sales/revenue-schedules/[id]/page.tsx";
const drawer = "components/dashboard/create-drawer.tsx";
const locales = ["en-US", "fa-IR"] as const;
const noop = () => {};
const caller = "<script>customer & quote</script>";
const raw = { id: "schedule-a", invoiceId: "invoice-a", totalAmount: 9007199254740991, totalAmountMinor: "9007199254740991", recognizedAmount: 1250, recognizedAmountMinor: "1250", startDate: "2026-10-19", endDate: "2026-12-19", method: "straight_line", status: "active", entries: [{ id: "entry-a", amount: 1250, amountMinor: "1250", recognized: true, periodDate: "2026-10-19", journalEntryId: "journal-a" }, { id: "entry-b", amount: 1250, amountMinor: "1250", recognized: false, periodDate: "2026-11-19", journalEntryId: null }] };
function translator(locale: typeof locales[number]) { return createTranslator({ locale, messages: locale === "en-US" ? en : fa, namespace: "RevenueSchedules" }); }
function escape(value: string) { return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;"); }

function parse(path: string) { return ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX); }
function componentName(path: string) { return path === list ? "RevenueSchedulesPage" : path === detail ? "RevenueScheduleDetailPage" : "RevenueScheduleDrawer"; }

// Render production functions and real fields/tables/translation/money. Only
// state, navigation, portals and out-of-slice forms use controlled boundaries.
function loaded(path: string, states: Record<string, unknown> = {}) {
  const ast = parse(path), name = componentName(path);
  const component = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name)!;
  const names: string[] = [];
  function hooks(n: ts.Node) {
    if (ts.isVariableDeclaration(n) && ts.isArrayBindingPattern(n.name) && n.initializer && ts.isCallExpression(n.initializer) && n.initializer.expression.getText(ast) === "useState") names.push(n.name.elements[0].getText(ast));
    ts.forEachChild(n, hooks);
  }
  hooks(component);
  let source = ast.text, index = 0;
  if (path === detail || path === list) source += `\nexport { ${name} };`;
  if (path === drawer) {
    const functions = ast.statements.filter(n => ts.isFunctionDeclaration(n) && n.name && [name, "DrawerFooter", "DrawerIcon", "SectionLabel"].includes(n.name.text));
    const used = new Set<string>();
    function identifiers(n: ts.Node) { if (ts.isIdentifier(n)) used.add(n.text); ts.forEachChild(n, identifiers); }
    functions.forEach(identifiers);
    source = ast.statements.flatMap(n => {
      if (functions.includes(n)) return [n.getText(ast)];
      if (ts.isImportDeclaration(n) && n.importClause?.namedBindings && ts.isNamedImports(n.importClause.namedBindings)) {
        const bindings = n.importClause.namedBindings.elements.filter(b => used.has(b.name.text));
        if (bindings.length) return [`import { ${bindings.map(b => b.getText(ast)).join(", ")} } from ${n.moduleSpecifier.getText(ast)};`];
      }
      return [];
    }).join("\n") + `\nexport { ${name} };`;
  }
  source = source.replace(/typeof window !== "undefined"\s*\? localStorage.getItem\("activeOrgId"\)\s*: null/g, '"org-a"');
  const require = createRequire(resolve(path));
  const compiled = { exports: {} as Record<string, ComponentType<Record<string, unknown>>> };
  const inline = ({ children, title }: { children: ReactNode; title?: string }) => createElement("div", { title }, children);
  const load = (id: string) => {
    if (id === "react") return { ...React, useState: (initial: unknown) => { const key = names[index++]; return [Object.hasOwn(states, key) ? states[key] : typeof initial === "function" ? initial() : initial, noop]; }, useEffect: noop, useRef: (value: unknown) => ({ current: value }), useMemo: (fn: () => unknown) => fn(), useCallback: (fn: unknown) => fn };
    if (id === "next-intl") return nextIntl;
    if (id === "next/navigation") return { useParams: () => ({ id: raw.id }), useRouter: () => ({ push: noop }) };
    if (id.endsWith("/create-drawer")) return { useCreateDrawer: () => ({ open: noop }) };
    if (id.endsWith("/use-debounce")) return { useDebounce: (value: string) => value };
    if (id.endsWith("/use-confirm")) return { useConfirm: () => ({ confirm: noop, dialog: null }) };
    if (id.endsWith("/use-entity-title")) return { useEntityTitle: noop };
    if (id.endsWith("/data-table")) return DataTable;
    if (id.endsWith("/ui/date-picker")) return DatePicker;
    if (id.endsWith("/use-document-title")) return { useDocumentTitle: noop };
    if (id.endsWith("/line-items-editor")) return { LineItemsEditor: () => createElement("div", { "data-shared-form": "lines" }) };
    if (id.endsWith("/contact-picker")) return { ContactPicker: () => createElement("div", { "data-shared-form": "contact" }) };
    if (id.endsWith("/currency-select")) return { CurrencySelect: () => createElement("div", { "data-shared-form": "currency" }) };
    for (const [suffix, exports] of [["/ui/dialog", ["Dialog", "DialogContent", "DialogHeader", "DialogTitle", "DialogTrigger"]], ["/ui/sheet", ["Sheet", "SheetContent", "SheetHeader", "SheetTitle", "SheetDescription", "SheetFooter"]]] as const) if (id.endsWith(suffix)) return Object.fromEntries(exports.map(key => [key, inline]));
    if (id.endsWith("/ui/select")) return { Select: inline, SelectTrigger: inline, SelectContent: inline, SelectValue: ({ placeholder }: { placeholder?: string }) => createElement("span", null, placeholder), SelectItem: ({ children, value }: { children: ReactNode; value: string }) => createElement("div", { "data-option": value }, children) };
    if (["/send-document-dialog", "/email-history"].some(suffix => id.endsWith(suffix))) return { SendDocumentDialog: () => null, EmailHistory: () => null };
    return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  };
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function("require", "module", "exports", code)(load, compiled, compiled.exports);
  return compiled.exports[name];
}

// Execute original callback syntax, preserving requests and money validation.
function callback(path: string, name: string, scope: Record<string, unknown>, effectIndex = 0) {
  const ast = parse(path); let expression = "", index = 0;
  function visit(n: ts.Node) {
    if (path === drawer && ts.isFunctionDeclaration(n) && n.parent === ast && n.name?.text !== "RevenueScheduleDrawer") return;
    if (ts.isFunctionDeclaration(n) && n.name?.text === name) expression = n.getText(ast);
    if (ts.isVariableDeclaration(n) && n.name.getText(ast) === name && n.initializer && ts.isCallExpression(n.initializer)) expression = n.initializer.arguments[0].getText(ast);
    if (name === "effect" && ts.isCallExpression(n) && n.expression.getText(ast) === "useEffect" && index++ === effectIndex) expression = n.arguments[0].getText(ast);
    ts.forEachChild(n, visit);
  }
  visit(ast); assert.ok(expression, name);
  const code = ts.transpileModule(`const run = ${expression};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(scope), `${code}; return run;`)(...Object.values(scope));
}

const flush = async () => { for (let i = 0; i < 8; i++) await new Promise(resolve => setImmediate(resolve)); };

test("revenue list renders bilingual guidance, finite labels, exact totals, filters and ICU counts", () => {
  for (const locale of locales) {
    const t = translator(locale);
    const Empty = loaded(list, { initialLoad: false });
    const empty = renderWithPresentation(createElement(Empty), locale);
    for (const key of ["title", "description", "newSchedule", "howItWorks", "paidUpfront", "exampleInvoice", "eachMonth", "spreadEvenly", "afterYear", "whenToUse", "annualTitle", "annualDescription", "retainerTitle", "retainerDescription", "deliveryTitle", "deliveryDescription", "projectTitle", "projectDescription"] as const) assert.ok(empty.includes(escape(t(key))), key);
    const Page = loaded(list, { initialLoad: false, schedules: [raw, { ...raw, id: "other" }], totalCount: 2 });
    const html = renderWithPresentation(createElement(Page), locale);
    for (const key of ["scheduled", "recognized", "remaining", "all", "activeTab", "completedTab", "cancelledTab", "activeHint", "completedHint", "search", "period", "spreadHeading", "status", "total", "straightLine", "active"] as const) assert.ok(html.includes(escape(t(key))), key);
    assert.ok(html.includes(escape(t("showing", { loaded: 2, total: 2 }))));
    assert.ok(html.includes(escape(assetMoneyDisplay(BigInt(raw.totalAmount) * 2n, resolvePresentation({ user: { language: locale } })))));
    assert.ok(html.includes(escape(assetMoneyDisplay(raw.totalAmount - raw.recognizedAmount, resolvePresentation({ user: { language: locale } })))));
    const Filtered = loaded(list, { initialLoad: false, schedules: [raw], search: "missing" });
    const filtered = renderWithPresentation(createElement(Filtered), locale);
    assert.ok(filtered.includes(escape(t("noMatches"))) && filtered.includes(escape(t("clearFilters"))));
    const Found = loaded(list, { initialLoad: false, schedules: [raw], search: t("straightLine") });
    assert.ok(renderWithPresentation(createElement(Found), locale).includes(raw.startDate));
    for (const error of ["readFailed", "moreFailed"] as const) {
      const Failed = loaded(list, { initialLoad: false, error });
      assert.ok(renderWithPresentation(createElement(Failed), locale).includes(escape(t(error))));
    }
  }
});

test("revenue detail and creation render both catalogs with escaped caller data and canonical options", () => {
  for (const locale of locales) {
    const t = translator(locale);
    const Page = loaded(detail, { loading: false, rs: raw });
    const html = renderWithPresentation(createElement(Page), locale);
    for (const key of ["detailTitle", "back", "recognize", "recognizeHint", "cancelSchedule", "cancelHint", "total", "recognized", "remaining", "period", "amount", "countedHeading", "counted", "notYet"] as const) assert.ok(html.includes(escape(t(key))), key);
    assert.ok(html.includes(escape(t("detailDescription", { start: raw.startDate, end: raw.endDate, method: t("straightLine") }))));
    const NoEntries = loaded(detail, { loading: false, rs: { ...raw, entries: [] } });
    assert.ok(renderWithPresentation(createElement(NoEntries), locale).includes(escape(t("noPeriods"))));
    for (const [states, key] of [[{ loading: true }, "loading"], [{ loading: false }, "notFound"], [{ loading: false, error: "readFailed" }, "readFailed"], [{ loading: false, error: "refreshFailed" }, "refreshFailed"]] as const) {
      const State = loaded(detail, states);
      assert.ok(renderWithPresentation(createElement(State), locale).includes(escape(t(key))), key);
    }
    for (const status of ["completed", "cancelled"]) {
      const Closed = loaded(detail, { loading: false, rs: { ...raw, status } });
      const closed = renderWithPresentation(createElement(Closed), locale);
      assert.ok(!closed.includes(escape(t("recognizeHint"))) && !closed.includes(escape(t("cancelHint"))));
    }
    const Drawer = loaded(drawer, { invoiceError: true });
    const form = renderWithPresentation(createElement(Drawer, { open: true, onClose: noop }), locale);
    for (const key of ["newTitle", "drawerDescription", "scheduleDetails", "invoiceRequired", "chooseInvoice", "noInvoices", "totalAmount", "method", "straightLineOption", "milestoneOption", "onCompletionOption", "startDate", "endDate", "create", "cancel", "invoicesFailed"] as const) assert.ok(form.includes(escape(t(key))), key);
    for (const method of ["straight_line", "milestone", "on_completion"]) assert.ok(form.includes(`data-option="${method}"`));
    for (const code of ["straight_line", "milestone", "on_completion", "active", "completed", "cancelled", "future", "constructor", "__proto__", caller]) {
      const Unknown = loaded(detail, { loading: false, rs: { ...raw, status: code, method: code } });
      const unknown = renderWithPresentation(createElement(Unknown), locale);
      assert.ok(unknown.includes(escape(revenueStatusLabel(t, code))));
      assert.ok(unknown.includes(escape(revenueMethodLabel(t, code))));
      assert.ok(!unknown.includes("<script>"));
    }
  }
});

test("revenue messages preserve plural contracts and Persian script", () => {
  assert.equal(translator("en-US")("showing", { loaded: 1, total: 1 }), "Showing 1 of 1 schedule");
  assert.equal(translator("en-US")("showing", { loaded: 0, total: 0 }), "Showing 0 of 0 schedules");
  for (const count of [0, 1, 2, 1.5]) assert.ok(translator("fa-IR")("showing", { loaded: count, total: count }));
  // Date/method-only interpolation deliberately contains no authored words.
  for (const [key, value] of Object.entries(fa.RevenueSchedules)) if (key !== "detailDescription") assert.match(value, /[\u0600-\u06ff]/, key);
});

test("revenue read validation rejects malformed cents, aliases and entries before rendering", () => {
  assert.ok(revenueScheduleValid(raw, true));
  for (const value of [null, {}, { ...raw, id: " " }, { ...raw, totalAmount: 1.2 }, { ...raw, totalAmount: Number.MAX_SAFE_INTEGER + 1 }, { ...raw, recognizedAmountMinor: "001250" }, { ...raw, entries: null }, { ...raw, entries: [{ ...raw.entries[0], amountMinor: "1" }] }]) assert.equal(revenueScheduleValid(value, true), false);
});

test("revenue creation preserves exact decimal, method, dates and retry identity on all outcomes", async () => {
  for (const locale of locales) for (const mode of ["success", "denied", "network", "json", "shape", "emptyId", "invoice", "org"]) {
    const t = translator(locale), errors: string[] = [], successes: string[] = [], routes: string[] = [], busy: boolean[] = [];
    const retryRef = { current: null as null | { fingerprint: string; key: string } };
    let requests = 0, closed = 0;
    const run = callback(drawer, "handleSubmit", { unitPresentation: resolvePresentation({ user: { language: locale } }), t, invoiceId: mode === "invoice" ? "" : "invoice-a", totalAmount: "90071992547409.91", startDate: raw.startDate, endDate: raw.endDate, method: "milestone", retryRef, localStorage: { getItem: () => mode === "org" ? null : "org-a" }, setSaving: (v: boolean) => busy.push(v), onClose: () => closed++, router: { push: (v: string) => routes.push(v) }, toast: { error: (v: string) => errors.push(v), success: (v: string) => successes.push(v) }, fetch: async (url: string, init: RequestInit) => {
      requests++; assert.equal(url, "/api/v1/revenue-schedules"); assert.equal(init.method, "POST"); assert.equal((init.headers as Record<string, string>)["x-organization-id"], "org-a");
      const body = JSON.parse(String(init.body)); assert.match(body.idempotencyKey, /^[\da-f-]{36}$/);
      assert.deepEqual(body, { invoiceId: "invoice-a", totalAmountExact: "90071992547409.91", idempotencyKey: retryRef.current?.key, startDate: raw.startDate, endDate: raw.endDate, method: "milestone" });
      if (mode === "network") throw new Error("private prose"); if (mode === "json") return new Response("private HTML");
      return Response.json(mode === "shape" ? null : { schedule: { id: mode === "emptyId" ? " " : raw.id }, error: "private prose" }, { status: mode === "denied" ? 403 : 200 });
    } });
    await run({ preventDefault: noop });
    const key = retryRef.current?.key;
    if (mode === "network") { await run({ preventDefault: noop }); assert.equal(retryRef.current?.key, key); }
    const ok = mode === "success", early = ["invoice", "org"].includes(mode), count = mode === "network" ? 2 : 1;
    assert.equal(requests, early ? 0 : count); assert.equal(closed, ok ? 1 : 0);
    assert.deepEqual(routes, ok ? [`/sales/revenue-schedules/${raw.id}`] : []);
    assert.deepEqual(successes, ok ? [t("created")] : []);
    assert.deepEqual(errors, ok ? [] : Array(count).fill(t(mode === "invoice" ? "selectInvoice" : mode === "org" ? "selectOrg" : "createFailed")));
    assert.deepEqual(busy, mode === "invoice" ? [] : count === 2 ? [true, false, true, false] : [true, false]);
  }
});

test("recognition keeps next-entry targeting, canonical request and localized failure outcomes", async () => {
  for (const locale of locales) for (const mode of ["success", "denied", "network", "org", "noEntry"]) {
    const t = translator(locale), errors: string[] = [], successes: string[] = [], busy: boolean[] = [];
    let requests = 0, reads = 0;
    await callback(detail, "handleRecognize", { unitPresentation: resolvePresentation({ user: { language: locale } }), t, orgId: mode === "org" ? null : "org-a", id: raw.id, rs: mode === "noEntry" ? { ...raw, entries: [] } : raw, setRecognizing: (v: boolean) => busy.push(v), refetch: async () => reads++, toast: { error: (v: string) => errors.push(v), success: (v: string) => successes.push(v) }, fetch: async (url: string, init: RequestInit) => {
      requests++; assert.equal(url, `/api/v1/revenue-schedules/${raw.id}/recognize`); assert.equal(init.method, "POST"); assert.equal((init.headers as Record<string, string>)["x-organization-id"], "org-a"); assert.deepEqual(JSON.parse(String(init.body)), { entryId: "entry-b" });
      if (mode === "network") throw new Error("private prose"); return new Response("private HTML", { status: mode === "denied" ? 403 : 200 });
    } })();
    const early = ["org", "noEntry"].includes(mode), ok = mode === "success";
    assert.equal(requests, early ? 0 : 1); assert.equal(reads, ok ? 1 : 0);
    assert.deepEqual(successes, ok ? [t("recognizedSuccess")] : []); assert.deepEqual(errors, early || ok ? [] : [t("recognizeFailed")]);
    assert.deepEqual(busy, early ? [] : [true, false]);
  }
});

test("cancellation preserves confirmation cancellation, DELETE and localized outcomes", async () => {
  for (const locale of locales) for (const mode of ["success", "denied", "network", "cancel"]) {
    const t = translator(locale), errors: string[] = [], successes: string[] = [];
    let requests = 0, reads = 0;
    await callback(detail, "handleCancel", { unitPresentation: resolvePresentation({ user: { language: locale } }), t, orgId: "org-a", id: raw.id, refetch: async () => reads++, toast: { error: (v: string) => errors.push(v), success: (v: string) => successes.push(v) }, confirm: async (options: { title: string; description: string; confirmLabel: string; cancelLabel: string; destructive: boolean; onConfirm: () => Promise<void> }) => {
      assert.equal(options.title, t("cancelTitle")); assert.equal(options.description, t("cancelDescription")); assert.equal(options.confirmLabel, t("cancelSchedule")); assert.equal(options.cancelLabel, t("cancel")); assert.equal(options.destructive, true);
      if (mode !== "cancel") await options.onConfirm();
    }, fetch: async (url: string, init: RequestInit) => {
      requests++; assert.equal(url, `/api/v1/revenue-schedules/${raw.id}`); assert.equal(init.method, "DELETE"); assert.equal((init.headers as Record<string, string>)["x-organization-id"], "org-a");
      if (mode === "network") throw new Error("private prose"); return new Response("private HTML", { status: mode === "denied" ? 403 : 200 });
    } })();
    assert.equal(requests, mode === "cancel" ? 0 : 1); assert.equal(reads, mode === "success" ? 1 : 0);
    assert.deepEqual(successes, mode === "success" ? [t("cancelledSuccess")] : []); assert.deepEqual(errors, ["denied", "network"].includes(mode) ? [t("cancelFailed")] : []);
  }
});

test("list and pagination reads reject HTTP, JSON, malformed money and ignore cancelled initial reads", async () => {
  for (const operation of ["list", "more"]) for (const mode of ["success", "denied", "network", "json", "shape", "alias", "cancelled"]) {
    if (operation === "more" && mode === "cancelled") continue;
    const values: unknown[] = [], errors: unknown[] = [], busy: boolean[] = [];
    const run = callback(list, operation === "list" ? "effect" : "loadMore", { revenueScheduleValid, orgId: "org-a", loadingMore: false, page: 1, buildParams: (page: number) => new URLSearchParams({ page: String(page), limit: "50" }), setRefetching: noop, setPage: noop, setInitialLoad: noop, setFetchKey: noop, setTotalCount: noop, setLoadingMore: (v: boolean) => busy.push(v), devDelay: async () => {}, setSchedules: (v: unknown) => values.push(typeof v === "function" ? v([raw]) : v), setError: (v: unknown) => errors.push(v), fetch: async (url: string, init: RequestInit) => {
      assert.equal(url, `/api/v1/revenue-schedules?page=${operation === "list" ? 1 : 2}&limit=50`); assert.equal((init.headers as Record<string, string>)["x-organization-id"], "org-a");
      if (mode === "network") throw new Error("private prose"); if (mode === "json") return new Response("private HTML");
      return Response.json(mode === "shape" ? null : { data: [{ ...raw, totalAmountMinor: mode === "alias" ? "1" : raw.totalAmountMinor }], pagination: { total: 1 } }, { status: mode === "denied" ? 403 : 200 });
    } });
    const cleanup = run(); if (mode === "cancelled") cleanup(); await flush();
    assert.deepEqual(values, mode === "success" ? [operation === "list" ? [raw] : [raw, raw]] : []);
    assert.deepEqual(errors, mode === "success" ? [null] : mode === "cancelled" ? [] : [operation === "list" ? "readFailed" : "moreFailed"]);
    if (operation === "more") assert.deepEqual(busy, [true, false]);
  }
});

test("detail initial and action refresh reads clear malformed or failed schedules and request reload", async () => {
  for (const operation of ["initial", "refresh"]) for (const mode of ["success", "denied", "network", "json", "shape", "alias", "wrongId", "cancelled"]) {
    if (operation === "refresh" && mode === "cancelled") continue;
    const values: unknown[] = [], errors: unknown[] = [];
    const run = callback(detail, operation === "initial" ? "effect" : "refetch", { revenueScheduleValid, orgId: "org-a", id: raw.id, setRs: (v: unknown) => values.push(v), setError: (v: unknown) => errors.push(v), setLoading: noop, fetch: async (url: string, init: RequestInit) => {
      assert.equal(url, `/api/v1/revenue-schedules/${raw.id}`); assert.equal((init.headers as Record<string, string>)["x-organization-id"], "org-a");
      if (mode === "network") throw new Error("private prose"); if (mode === "json") return new Response("private HTML");
      return Response.json(mode === "shape" ? null : { schedule: { ...raw, id: mode === "wrongId" ? "wrong" : raw.id, recognizedAmountMinor: mode === "alias" ? "1" : raw.recognizedAmountMinor } }, { status: mode === "denied" ? 403 : 200 });
    } });
    const result = run(); if (mode === "cancelled") result(); if (operation === "refresh") await result; await flush();
    if (operation === "initial") {
      assert.deepEqual(values, mode === "success" ? [null, raw] : [null]);
      assert.deepEqual(errors, ["success", "cancelled"].includes(mode) ? [null] : [null, "readFailed"]);
    } else {
      assert.deepEqual(values, mode === "success" ? [raw] : [null]);
      assert.deepEqual(errors, mode === "success" ? [null] : ["refreshFailed"]);
    }
  }
});

test("invoice options read failures are finite and cancelled forms cannot adopt results", async () => {
  for (const mode of ["success", "denied", "network", "json", "shape", "cancelled", "closed"]) {
    const values: unknown[] = [], errors: boolean[] = [], retryRef = { current: { fingerprint: "f", key: "k" } as unknown };
    const cleanup = callback(drawer, "effect", { open: mode !== "closed", retryRef, setInvoiceId: noop, setTotalAmount: noop, setEndDate: noop, setMethod: noop, setStartDate: noop, localStorage: { getItem: () => "org-a" }, setInvoices: (v: unknown) => values.push(v), setInvoiceError: (v: boolean) => errors.push(v), fetch: async (url: string, init: RequestInit) => {
      assert.equal(url, "/api/v1/invoices"); assert.equal((init.headers as Record<string, string>)["x-organization-id"], "org-a");
      if (mode === "network") throw new Error("private prose"); if (mode === "json") return new Response("private HTML");
      return Response.json({ data: mode === "shape" ? [null] : [{ id: "invoice-a", number: caller }] }, { status: mode === "denied" ? 403 : 200 });
    } })();
    if (mode === "cancelled") cleanup(); await flush();
    assert.deepEqual(values, mode === "closed" ? [] : mode === "success" ? [[], [{ id: "invoice-a", number: caller }]] : [[]]);
    assert.deepEqual(errors, mode === "closed" ? [] : ["success", "cancelled"].includes(mode) ? [false] : [false, true]);
    if (mode === "closed") assert.equal(retryRef.current, null);
  }
});

test("owned revenue JSX and display attributes contain no unextracted authored copy", () => {
  for (const path of [list, detail, drawer]) {
    const ast = parse(path), problems: string[] = [];
    function visit(n: ts.Node) {
      if (path === drawer && ts.isFunctionDeclaration(n) && n.parent === ast && n.name?.text !== "RevenueScheduleDrawer") return;
      if (ts.isJsxText(n) && /[a-z]/i.test(n.text.replaceAll("&ndash;", "").trim())) problems.push(n.text.trim());
      if (ts.isJsxAttribute(n) && ["title", "placeholder", "label", "description", "emptyMessage", "aria-label"].includes(n.name.getText(ast)) && n.initializer && ts.isStringLiteral(n.initializer) && /[a-z]/i.test(n.initializer.text)) problems.push(n.getText(ast));
      ts.forEachChild(n, visit);
    }
    visit(ast); assert.deepEqual(problems, [], path);
  }
});
