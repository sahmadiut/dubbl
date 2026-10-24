import { currencyFixture, displayNumberFixture } from "./helpers/localized-fixtures";
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
import { RecurringInvoiceMoneyDetails } from "../components/dashboard/recurring-invoice-money-details";
import { recurringInvoiceStatusLabel, recurringInvoiceFrequencyLabel } from "../i18n/recurring-invoice-presentation";
import * as money from "../lib/money/recurring-invoice-ui";
import { renderWithPresentation } from "./helpers/presentation";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const list = "app/(dashboard)/sales/recurring/page.tsx";
const detail = "app/(dashboard)/sales/recurring/[id]/page.tsx";
const drawer = "components/dashboard/create-drawer.tsx";
const locales = ["en-US", "fa-IR"] as const;
const noop = () => {};
const caller = "<script>customer & quote</script>";
const raw = { id: "template-a", name: caller, type: "invoice", frequency: "monthly", status: "active", startDate: "2026-10-19", endDate: null, nextRunDate: "2026-11-19", occurrencesGenerated: 2, maxOccurrences: null, contact: { name: caller }, notes: caller, currencyCode: "USD", lines: [{ id: "line-a", description: caller, quantity: 100, unitPrice: 9007199254740991, unitPriceMinor: "9007199254740991", discountPercent: 1250, account: { code: "4000", name: caller } }] };
const saved = money.recurringInvoiceUiDocument(raw);
function translator(locale: typeof locales[number]) { return createTranslator({ locale, messages: locale === "en-US" ? en : fa, namespace: "RecurringInvoices" }); }
function escape(value: string) { return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;"); }

function parse(path: string) { return ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX); }
function componentName(path: string) { return path === list ? "RecurringInvoicesContent" : path === detail ? "RecurringDetailPage" : "RecurringDrawer"; }

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
    if (id.endsWith("/recurring-invoice-money-details")) return { RecurringInvoiceMoneyDetails };
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
    if (path === drawer && ts.isFunctionDeclaration(n) && n.parent === ast && n.name?.text !== "RecurringDrawer") return;
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

test("recurring list renders bilingual guidance, filters, finite labels, ICU counts and exact upcoming amounts", () => {
  for (const locale of locales) {
    const t = translator(locale);
    const Empty = loaded(list, { initialLoad: false });
    const empty = renderWithPresentation(createElement(Empty), locale);
    for (const key of ["title", "description", "newTemplate", "calendarHint", "example", "exampleName", "exampleCustomer", "supportedFrequencies", "weekly", "fortnightly", "monthly", "quarterly", "semiAnnual", "annual", "exampleDate"] as const) assert.ok(empty.includes(escape(t(key))), key);
    const Page = loaded(list, { initialLoad: false, templates: [raw], totalCount: 1, upcoming: [{ templateName: caller, contactName: caller, lineTotal: 9007199254740991n, currencyCode: "USD", dates: [{ date: raw.nextRunDate, occurrence: 3 }] }] });
    const html = renderWithPresentation(createElement(Page), locale);
    for (const key of ["activeTemplates", "totalGenerated", "upcoming", "all", "active", "paused", "completed", "newRecurring", "search", "allFrequencies", "sortBy", "newest", "oldest", "nameAsc", "nameDesc", "nextSoonest", "name", "customer", "frequency", "status", "nextRun", "startDate", "occurrences"] as const) assert.ok(html.includes(escape(t(key))), key);
    assert.ok(html.includes(escape(t("showing", { loaded: 1, total: 1 }))));
    assert.ok(html.includes(displayNumberFixture("90,071,992,547,409.91", locale)));
    assert.ok(html.includes(escape(caller)) && !html.includes("<script>"));
    const Filtered = loaded(list, { initialLoad: false, templates: [raw], search: "missing" });
    const filtered = renderWithPresentation(createElement(Filtered), locale);
    assert.ok(filtered.includes(escape(t("noMatches"))) && filtered.includes(escape(t("clearFilters"))));
    for (const error of ["readFailed", "moreFailed", "previewFailed"] as const) {
      const Failed = loaded(list, { initialLoad: false, error });
      assert.ok(renderWithPresentation(createElement(Failed), locale).includes(escape(t(error))));
    }
  }
});

test("recurring detail, money table and drawer render both catalogs with safe caller data", () => {
  for (const locale of locales) {
    const t = translator(locale);
    const Page = loaded(detail, { loading: false, loaded: { context: `org-a:${raw.id}`, template: saved } });
    const html = renderWithPresentation(createElement(Page), locale);
    for (const key of ["back", "pause", "delete", "active", "occurrences", "nextRun", "frequency", "notes", "lineDescription", "quantity", "grossAmount", "grossTotal", "grossHint"] as const) assert.ok(html.includes(escape(t(key))), key);
    for (const text of [t("contact", { name: caller }), t("schedule", { frequency: t("monthly"), start: raw.startDate, end: t("noEndDate") }), t("nextRunHint", { date: raw.nextRunDate }), t("discount", { percent: "12.5" }), t("unitPrice", { currency: currencyFixture("USD", locale) })]) assert.ok(html.includes(escape(text)), text);
    assert.ok(html.includes(escape(caller)) && !html.includes("<script>"));
    const Resume = loaded(detail, { loading: false, loaded: { context: `org-a:${raw.id}`, template: { ...saved, status: "paused", nextRunDate: null } } });
    const resume = renderWithPresentation(createElement(Resume), locale);
    assert.ok(resume.includes(escape(t("resume"))) && resume.includes(escape(t("notApplicable"))));
    for (const [states, key] of [[{ loading: true }, "loading"], [{ loading: false }, "notFound"], [{ loading: false, error: "readFailed" }, "readFailed"], [{ loading: false, error: "updateReadFailed" }, "updateReadFailed"]] as const) {
      const State = loaded(detail, states);
      assert.ok(renderWithPresentation(createElement(State), locale).includes(escape(t(key))), key);
    }
    const Drawer = loaded(drawer, { contactId: "customer-a", name: caller });
    const form = renderWithPresentation(createElement(Drawer, { open: true, onClose: noop }), locale);
    for (const key of ["newInvoice", "drawerDescription", "templateDetails", "templateName", "namePlaceholder", "customerRequired", "currency", "currencyHint", "frequency", "reference", "referencePlaceholder", "startDate", "endDateOptional", "noEndDate", "autoEmail", "autoEmailHint", "lineItems", "notes", "notesPlaceholder", "createTemplate"] as const) assert.ok(form.includes(escape(t(key))), key);
    for (const currencyCode of ["USD", "JPY", "KWD", "IRR"]) {
      const lines = money.recurringInvoiceUiDocument({ ...raw, currencyCode }).lines;
      const table = renderWithPresentation(createElement(RecurringInvoiceMoneyDetails, { currencyCode, lines }), locale);
      assert.ok(table.includes(escape(money.recurringInvoiceUiMoney(9007199254740991n, currencyCode, resolvePresentation({ user: { language: locale } })))));
    }
  }
});

test("recurring ICU, Persian script and own-key labels preserve unknown data", () => {
  const t = translator("en-US");
  assert.equal(t("showing", { loaded: 0, total: 0 }), "Showing 0 of 0 templates");
  assert.equal(t("showing", { loaded: 1, total: 1 }), "Showing 1 of 1 template");
  assert.equal(t("showing", { loaded: 1, total: 2 }), "Showing 1 of 2 templates");
  for (const count of [0, 1, 2, 1.5]) assert.ok(translator("fa-IR")("showing", { loaded: count, total: count }));
  for (const [key, value] of Object.entries(fa.RecurringInvoices)) assert.match(value, /[\u0600-\u06ff]/, key);
  for (const locale of locales) for (const code of ["active", "paused", "completed", "weekly", "fortnightly", "monthly", "quarterly", "semi_annual", "annual", "future", "constructor", "__proto__", caller]) {
    const t = translator(locale);
    const Page = loaded(list, { initialLoad: false, templates: [{ ...raw, status: code, frequency: code }] });
    const html = renderWithPresentation(createElement(Page), locale);
    assert.ok(html.includes(escape(recurringInvoiceStatusLabel(t, code))));
    assert.ok(html.includes(escape(recurringInvoiceFrequencyLabel(t, code))));
    assert.ok(!html.includes("<script>"));
  }
});

test("recurring creation retains canonical exact payload, autoSend and safe failure outcomes", async () => {
  for (const locale of locales) for (const mode of ["success", "denied", "network", "json", "shape", "emptyId", "customer", "name", "org", "lines", "parser"]) {
    const t = translator(locale), errors: string[] = [], successes: string[] = [], routes: string[] = [], busy: boolean[] = [];
    let requests = 0, closed = 0;
    await callback(drawer, "handleSubmit", { ...money, t, orgId: mode === "org" ? null : "org-a", contactId: mode === "customer" ? "" : "customer-a", name: mode === "name" ? " " : caller, validLines: mode !== "lines", currencyCode: "KWD", frequency: "semi_annual", startDate: raw.startDate, endDate: "", reference: "", notes: caller, autoSend: true, lines: [{ description: caller, quantity: "1.234", unitPrice: mode === "parser" ? "bad" : "1.2505", accountId: "", taxRateId: "" }], setSaving: (v: boolean) => busy.push(v), onClose: () => closed++, router: { push: (v: string) => routes.push(v) }, toast: { error: (v: string) => errors.push(v), success: (v: string) => successes.push(v) }, fetch: async (url: string, init: RequestInit) => {
      requests++; assert.equal(url, "/api/v1/recurring-invoices"); assert.equal(init.method, "POST"); assert.equal((init.headers as Record<string, string>)["x-organization-id"], "org-a");
      assert.deepEqual(JSON.parse(String(init.body)), { name: caller, contactId: "customer-a", frequency: "semi_annual", startDate: raw.startDate, currencyCode: "KWD", endDate: null, reference: null, notes: caller, autoSend: true, lines: [{ description: caller, quantity: 1.234, unitPriceExact: "1.2505", accountId: null, taxRateId: null }] });
      if (mode === "network") throw new Error("private server prose"); if (mode === "json") return new Response("private HTML");
      return Response.json(mode === "shape" ? null : { template: { id: mode === "emptyId" ? " " : raw.id }, error: "private server prose" }, { status: mode === "denied" ? 403 : 200 });
    } })({ preventDefault: noop });
    const early = ["customer", "name", "org", "lines"].includes(mode), ok = mode === "success";
    assert.equal(requests, early || mode === "parser" ? 0 : 1); assert.equal(closed, ok ? 1 : 0);
    assert.deepEqual(routes, ok ? ["/sales/recurring"] : []); assert.deepEqual(successes, ok ? [t("created")] : []);
    const key = mode === "customer" ? "selectCustomer" : mode === "name" ? "enterName" : mode === "org" ? "selectOrg" : mode === "lines" ? "checkLines" : "createFailed";
    assert.deepEqual(errors, ok ? [] : [t(key)]); assert.deepEqual(busy, early ? [] : [true, false]);
  }
});

test("recurring detail reads translate HTTP, JSON, shape and money alias failures and ignore cancelled data", async () => {
  for (const mode of ["success", "denied", "network", "json", "shape", "alias", "cancelled"]) {
    const values: unknown[] = [], errors: unknown[] = [], busy: boolean[] = [];
    const context = `org-a:${raw.id}`;
    const cleanup = callback(detail, "effect", { ...money, orgId: "org-a", id: raw.id, context, setLoaded: (v: unknown) => values.push(v), setError: (v: unknown) => errors.push(v), setLoading: (v: boolean) => busy.push(v), fetch: async (url: string, init: RequestInit) => {
      assert.equal(url, `/api/v1/recurring/${raw.id}`); assert.equal((init.headers as Record<string, string>)["x-organization-id"], "org-a");
      if (mode === "network") throw new Error("secret"); if (mode === "json") return new Response("private HTML");
      return Response.json(mode === "shape" ? null : { template: { ...raw, lines: [{ ...raw.lines[0], unitPriceMinor: mode === "alias" ? "001" : raw.lines[0].unitPriceMinor }] } }, { status: mode === "denied" ? 403 : 200 });
    } })();
    if (mode === "cancelled") cleanup(); await flush();
    assert.deepEqual(values, mode === "cancelled" ? [] : mode === "success" ? [{ context, template: saved }] : [null]);
    assert.deepEqual(errors, mode === "cancelled" ? [] : mode === "success" ? [null] : ["readFailed"]);
    assert.deepEqual(busy, mode === "cancelled" ? [] : [false]); cleanup();
  }
});

test("recurring list reads, previews and pagination retain scope and generation guards", async () => {
  const params = callback(list, "buildParams", { statusFilter: "active", frequencyFilter: "semi_annual", sortBy: "nextRun", sortOrder: "asc", PAGE_SIZE: 50 });
  assert.equal(params(2).toString(), "type=invoice&status=active&frequency=semi_annual&sortBy=nextRun&sortOrder=asc&page=2&limit=50");
  for (const operation of ["list", "more"]) for (const mode of ["success", "denied", "network", "json", "shape", "stale"]) {
    const values: unknown[] = [], errors: unknown[] = [], previews: unknown[] = [], generation = { current: 0 };
    const run = callback(list, operation === "more" ? "loadMore" : "effect", { ...money, orgId: "org-a", generation, page: 1, loadingMore: false, buildParams: params, setRefetching: noop, setPage: noop, setLoadingMore: noop, setInitialLoad: noop, setFetchKey: noop, setTotalCount: noop, devDelay: async () => {}, setTemplates: (v: unknown) => values.push(typeof v === "function" ? v([raw]) : v), setError: (v: unknown) => errors.push(v), setUpcoming: (v: unknown) => previews.push(v), fetch: async (url: string, init: RequestInit) => {
      assert.equal((init.headers as Record<string, string>)["x-organization-id"], "org-a");
      if (url.includes("/preview")) return Response.json({ template: { currencyCode: "KWD", lineTotal: 1250, lineTotalMinor: "1250" }, upcoming: [{ date: raw.nextRunDate, occurrence: 3 }] });
      assert.equal(url, `/api/v1/recurring?${params(operation === "more" ? 2 : 1)}`);
      if (mode === "stale" && operation === "more") generation.current++;
      if (mode === "network") throw new Error("secret"); if (mode === "json") return new Response("private HTML");
      return Response.json(mode === "shape" ? null : { data: [raw], pagination: { total: 1 } }, { status: mode === "denied" ? 403 : 200 });
    } });
    const cleanup = run(); if (mode === "stale" && operation === "list") cleanup(); await flush();
    assert.deepEqual(values, mode === "success" ? [operation === "list" ? [raw] : [raw, raw]] : []);
    assert.deepEqual(errors, mode === "success" ? operation === "list" ? [null] : [] : mode === "stale" ? [] : [operation === "list" ? "readFailed" : "moreFailed"]);
    if (operation === "list" && mode === "success") assert.deepEqual(previews.at(-1), [{ templateName: caller, contactName: caller, currencyCode: "KWD", lineTotal: 1250n, dates: [{ date: raw.nextRunDate, occurrence: 3 }] }]);
    if (operation === "list") cleanup();
  }
});

test("recurring status changes and deletion keep canonical requests and translated confirmation outcomes", async () => {
  for (const locale of locales) for (const mode of ["success", "denied", "network", "json", "shape", "wrongStatus"]) for (const status of ["active", "paused"]) {
    const t = translator(locale), errors: string[] = [], successes: string[] = [], reads: string[] = [], values: unknown[] = [], busy: boolean[] = [];
    const context = `org-a:${raw.id}`, newStatus = status === "active" ? "paused" : "active";
    await callback(detail, "handleToggleStatus", { t, orgId: "org-a", id: raw.id, template: { ...saved, status }, context, setToggling: (v: boolean) => busy.push(v), setError: (v: string) => reads.push(v), setLoaded: (v: unknown) => values.push(typeof v === "function" ? v({ context, template: saved }) : v), toast: { error: (v: string) => errors.push(v), success: (v: string) => successes.push(v) }, fetch: async (url: string, init: RequestInit) => {
      assert.equal(url, `/api/v1/recurring/${raw.id}`); assert.equal(init.method, "PATCH"); assert.equal((init.headers as Record<string, string>)["x-organization-id"], "org-a"); assert.deepEqual(JSON.parse(String(init.body)), { status: newStatus });
      if (mode === "network") throw new Error("secret"); if (mode === "json") return new Response("private HTML");
      return Response.json(mode === "shape" ? null : { template: { ...raw, status: mode === "wrongStatus" ? "completed" : newStatus, lines: [{ unitPrice: 1 }] }, error: "private server prose" }, { status: mode === "denied" ? 403 : 200 });
    } })();
    const unreadable = ["json", "shape", "wrongStatus"].includes(mode);
    assert.deepEqual(reads, unreadable ? ["updateReadFailed"] : []);
    assert.deepEqual(values, unreadable ? [null] : mode === "success" ? [{ context, template: { ...saved, status: newStatus } }] : []);
    assert.deepEqual(successes, mode === "success" ? [t(newStatus === "paused" ? "pausedSuccess" : "resumedSuccess")] : []);
    assert.deepEqual(errors, mode === "success" || unreadable ? [] : [t("updateFailed")]); assert.deepEqual(busy, [true, false]);
  }
  for (const locale of locales) for (const mode of ["success", "denied", "network", "cancel"]) {
    const t = translator(locale), errors: string[] = [], successes: string[] = [], routes: string[] = [], busy: boolean[] = [];
    let requests = 0;
    await callback(detail, "handleDelete", { t, orgId: "org-a", id: raw.id, setDeleting: (v: boolean) => busy.push(v), router: { push: (v: string) => routes.push(v) }, toast: { error: (v: string) => errors.push(v), success: (v: string) => successes.push(v) }, confirm: async (options: { title: string; description: string; confirmLabel: string; destructive: boolean; onConfirm: () => Promise<void> }) => {
      assert.equal(options.title, t("deleteTitle")); assert.equal(options.description, t("deleteDescription")); assert.equal(options.confirmLabel, t("delete")); assert.equal(options.destructive, true); if (mode !== "cancel") await options.onConfirm();
    }, fetch: async (url: string, init: RequestInit) => {
      requests++; assert.equal(url, `/api/v1/recurring/${raw.id}`); assert.equal(init.method, "DELETE"); assert.equal((init.headers as Record<string, string>)["x-organization-id"], "org-a"); if (mode === "network") throw new Error("secret"); return Response.json({ success: true }, { status: mode === "denied" ? 403 : 200 });
    } })();
    assert.equal(requests, mode === "cancel" ? 0 : 1); assert.deepEqual(routes, mode === "success" ? ["/sales/recurring"] : []);
    assert.deepEqual(successes, mode === "success" ? [t("deleted")] : []); assert.deepEqual(errors, ["denied", "network"].includes(mode) ? [t("deleteFailed")] : []); assert.deepEqual(busy, mode === "cancel" ? [] : [true, false]);
  }
});

test("recurring preview failures hide raw diagnostics and retain independent valid previews", async () => {
  for (const mode of ["denied", "network", "json", "alias", "shape", "cancelled"]) {
    const errors: unknown[] = [], previews: unknown[] = [];
    const cleanup = callback(list, "effect", { ...money, orgId: "org-a", generation: { current: 0 }, buildParams: () => new URLSearchParams("type=invoice&page=1&limit=50"), setRefetching: noop, setPage: noop, setLoadingMore: noop, setInitialLoad: noop, setFetchKey: noop, setTotalCount: noop, devDelay: async () => {}, setTemplates: noop, setError: (v: unknown) => errors.push(v), setUpcoming: (v: unknown) => previews.push(v), fetch: async (url: string) => {
      if (!url.includes("/preview")) return Response.json({ data: [raw, { ...raw, id: "bad" }] });
      const bad = url.includes("/bad/");
      if (bad && mode === "network") throw new Error("private server prose");
      if (bad && mode === "json") return new Response("private HTML");
      return Response.json(bad && mode === "shape" ? null : { template: { currencyCode: "JPY", lineTotal: 1250, lineTotalMinor: bad && mode === "alias" ? "001" : "1250" }, upcoming: [{ date: raw.nextRunDate, occurrence: 3 }] }, { status: bad && mode === "denied" ? 403 : 200 });
    } })();
    if (mode === "cancelled") cleanup(); await flush();
    assert.deepEqual(errors, mode === "cancelled" ? [] : [null, "previewFailed"]);
    assert.deepEqual(previews, mode === "cancelled" ? [] : [[], [{ templateName: caller, contactName: caller, currencyCode: "JPY", lineTotal: 1250n, dates: [{ date: raw.nextRunDate, occurrence: 3 }] }]]);
    cleanup();
  }
});

test("owned recurring JSX and display attributes contain no unextracted authored copy", () => {
  for (const path of [list, detail, drawer, "components/dashboard/recurring-invoice-money-details.tsx"]) {
    const ast = parse(path), problems: string[] = [];
    function visit(n: ts.Node) {
      if (path === drawer && ts.isFunctionDeclaration(n) && n.parent === ast && n.name?.text !== "RecurringDrawer") return;
      if (ts.isJsxText(n) && /[a-z]/i.test(n.text.replaceAll("&middot;", "").replaceAll("&infin;", "").trim())) problems.push(n.text.trim());
      if (ts.isJsxAttribute(n) && ["title", "placeholder", "label", "description", "emptyMessage", "aria-label"].includes(n.name.getText(ast)) && n.initializer && ts.isStringLiteral(n.initializer) && /[a-z]/i.test(n.initializer.text)) problems.push(n.getText(ast));
      ts.forEachChild(n, visit);
    }
    visit(ast); assert.deepEqual(problems, [], path);
  }
});
