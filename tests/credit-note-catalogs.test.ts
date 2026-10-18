import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { createElement, type ComponentType, type ReactNode } from "react";
import * as React from "react";
import * as nextIntl from "next-intl";
import { createTranslator } from "next-intl";
import { InvoiceAmountInput } from "../components/dashboard/invoice-amount-input";
import ts from "typescript";
import * as DataTable from "../components/dashboard/data-table";
import * as DatePicker from "../components/ui/date-picker";
import { CreditNoteMoneyDetails } from "../components/dashboard/credit-note-money-details";
import { creditNoteStatusLabel } from "../i18n/credit-note-presentation";
import * as money from "../lib/money/credit-note-ui";
import { renderWithPresentation } from "./helpers/presentation";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const list = "app/(dashboard)/sales/credit-notes/page.tsx";
const detail = "app/(dashboard)/sales/credit-notes/[id]/page.tsx";
const drawer = "components/dashboard/create-drawer.tsx";
const locales = ["en-US", "fa-IR"] as const;
const noop = () => {};
const caller = "<script>customer & quote</script>";
const raw = {
  id: "credit-a", creditNoteNumber: "CN-001", issueDate: "2026-10-18", status: "sent", contactId: "customer-a", invoiceId: null, reference: caller,
  currencyCode: "USD", contact: { name: caller, email: caller }, notes: caller,
  subtotal: 9007199254740991, subtotalMinor: "9007199254740991", taxTotal: 0, taxTotalMinor: "0",
  total: 9007199254740991, totalMinor: "9007199254740991", amountApplied: 0, amountAppliedMinor: "0", amountRemaining: 9007199254740991, amountRemainingMinor: "9007199254740991",
  lines: [{ id: "line-a", description: caller, quantity: 125, unitPrice: 9007199254740991, unitPriceMinor: "9007199254740991", amount: 9007199254740991, amountMinor: "9007199254740991", taxAmount: 0, taxAmountMinor: "0", account: { code: "4000", name: caller } }],
};
const saved = money.creditNoteUiDocument(raw);
function translator(locale: typeof locales[number]) { return createTranslator({ locale, messages: locale === "en-US" ? en : fa, namespace: "CreditNotes" }); }
function escape(value: string) { return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;"); }

function parse(path: string) { return ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX); }
function componentName(path: string) { return path === list ? "CreditNotesPage" : path === detail ? "CreditNoteDetail" : "CreditNoteDrawer"; }

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
  if (path === detail) source += "\nexport { CreditNoteDetail };";
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
  source = source.replaceAll('typeof window !== "undefined" ? localStorage.getItem("activeOrgId") : null', '"org-a"');
  const require = createRequire(resolve(path));
  const compiled = { exports: {} as Record<string, ComponentType<Record<string, unknown>>> };
  const inline = ({ children, title }: { children: ReactNode; title?: string }) => createElement("div", { title }, children);
  const load = (id: string) => {
    if (id === "react") return { ...React, useState: (initial: unknown) => { const key = names[index++]; return [Object.hasOwn(states, key) ? states[key] : typeof initial === "function" ? initial() : initial, noop]; }, useEffect: noop, useRef: (value: unknown) => ({ current: value }), useMemo: (fn: () => unknown) => fn(), useCallback: (fn: unknown) => fn };
    if (id === "next-intl") return nextIntl;
    if (id.endsWith("/invoice-amount-input")) return { InvoiceAmountInput };
    if (id === "next/navigation") return { useParams: () => ({ id: raw.id }), useRouter: () => ({ push: noop }) };
    if (id.endsWith("/create-drawer")) return { useCreateDrawer: () => ({ open: noop }) };
    if (id.endsWith("/use-debounce")) return { useDebounce: (value: string) => value };
    if (id.endsWith("/use-confirm")) return { useConfirm: () => ({ confirm: noop, dialog: null }) };
    if (id.endsWith("/use-entity-title")) return { useEntityTitle: noop };
    if (id.endsWith("/data-table")) return DataTable;
    if (id.endsWith("/ui/date-picker")) return DatePicker;
    if (id.endsWith("/credit-note-money-details")) return { CreditNoteMoneyDetails };
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
  return compiled.exports[path === list ? "default" : name];
}

// Execute original callback syntax, preserving requests and money validation.
function callback(path: string, name: string, scope: Record<string, unknown>, effectIndex = 0) {
  const ast = parse(path); let expression = "", index = 0;
  function visit(n: ts.Node) {
    if (path === drawer && ts.isFunctionDeclaration(n) && n.parent === ast && n.name?.text !== "CreditNoteDrawer") return;
    if (ts.isFunctionDeclaration(n) && n.name?.text === name) expression = n.getText(ast);
    if (ts.isVariableDeclaration(n) && n.name.getText(ast) === name && n.initializer && ts.isCallExpression(n.initializer)) expression = n.initializer.arguments[0].getText(ast);
    if (name === "effect" && ts.isCallExpression(n) && n.expression.getText(ast) === "useEffect" && index++ === effectIndex) expression = n.arguments[0].getText(ast);
    ts.forEachChild(n, visit);
  }
  visit(ast); assert.ok(expression, name);
  const code = ts.transpileModule(`const run = ${expression};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(scope), `${code}; return run;`)(...Object.values(scope));
}

const context = "org-a:page=1&limit=50";
const summaryRaw = { currencyCode: "USD", totalCount: 1, totalAmount: raw.total, totalAmountMinor: raw.totalMinor, totalApplied: 0, totalAppliedMinor: "0", totalRemaining: raw.total, totalRemainingMinor: raw.totalMinor, statusBreakdown: { sent: { count: 1, amount: raw.total, amountMinor: raw.totalMinor } } };
const invoiceRaw = { id: "invoice-a", invoiceNumber: caller, contactId: raw.contactId, currencyCode: "USD", status: "sent", amountDue: raw.total, amountDueMinor: raw.totalMinor, contact: { name: caller } };
const selectedInvoice = money.creditNoteUiInvoice(invoiceRaw);
const invoiceContext = `${saved.contactId}:${saved.currencyCode}:${saved.amountRemaining}:0`;
const flush = async () => { for (let i = 0; i < 6; i++) await new Promise(resolve => setImmediate(resolve)); };

test("credit note list renders bilingual empty guidance, controls, status display and exact summaries", () => {
  for (const locale of locales) {
    const t = translator(locale);
    const Empty = loaded(list, { loaded: { context, rows: [], total: 0, page: 1, error: null } });
    const empty = renderWithPresentation(createElement(Empty), locale);
    for (const key of ["creditNotes", "emptyDescription", "newCreditNote", "howItWorks", "invoiceTotal", "creditApplied", "newBalance", "whenToUse", "overchargedTitle", "overchargedDescription", "returnedTitle", "returnedDescription", "serviceTitle", "serviceDescription", "discountTitle", "discountDescription"] as const) assert.ok(empty.includes(escape(t(key))), key);
    const rows = [saved, { ...saved, id: "credit-b", currencyCode: "KWD" }];
    const Page = loaded(list, { loaded: { context, rows, total: 2, page: 1, error: null }, summaryLoaded: { org: "org-a", summary: money.creditNoteUiSummary(summaryRaw), error: null } });
    const html = renderWithPresentation(createElement(Page), locale);
    for (const key of ["totalIssued", "applied", "remaining", "number", "customer", "date", "status", "total", "all", "draftHeading", "sentHeading", "usedHeading", "usedHint", "cancelledHeading", "search", "from", "to", "startDate", "endDate", "sortBy", "newest", "oldest", "highest", "lowest", "numberDesc", "numberAsc"] as const) assert.ok(html.includes(escape(t(key))), key);
    assert.ok(html.includes(escape(t("showing", { loaded: 2, total: 2 }))));
    assert.ok(html.includes("90,071,992,547,409.91") && html.includes("9,007,199,254,740.991"));
    assert.ok(html.includes(escape(caller)) && !html.includes("<script>"));
    const Failed = loaded(list, { loaded: { context, rows: [], total: 0, page: 1, error: t("readFailed") } });
    assert.ok(renderWithPresentation(createElement(Failed), locale).includes(escape(t("readFailed"))));
    const SummaryFailed = loaded(list, { loaded: { context, rows, total: 2, page: 1, error: null }, summaryLoaded: { org: "org-a", summary: null, error: t("summaryFailed") } });
    const failure = renderWithPresentation(createElement(SummaryFailed), locale);
    assert.ok(failure.includes(escape(t("summaryFailed"))) && failure.includes(escape(t("unavailable"))));
    const Filtered = loaded(list, { search: "missing", loaded: { context, rows, total: 2, page: 1, error: null } });
    const filtered = renderWithPresentation(createElement(Filtered), locale);
    assert.ok(filtered.includes(escape(t("noMatches"))) && filtered.includes(escape(t("clearFilters"))));
  }
});

test("credit note ICU plurals, status fallback and Persian script are safe", () => {
  const t = translator("en-US");
  assert.equal(t("showing", { loaded: 1, total: 1 }), "Showing 1 of 1 credit note");
  assert.equal(t("showing", { loaded: 0, total: 0 }), "Showing 0 of 0 credit notes");
  assert.equal(t("showing", { loaded: 1, total: 2 }), "Showing 1 of 2 credit notes");
  for (const count of [0, 1, 2, 1.5]) assert.ok(translator("fa-IR")("showing", { loaded: count, total: count }).includes("یادداشت اعتباری"));
  for (const [key, value] of Object.entries(fa.CreditNotes)) assert.match(value, /[\u0600-\u06ff]/, key);
  for (const locale of locales) for (const status of ["draft", "sent", "applied", "void", "future", "constructor", "__proto__", caller]) {
    const Page = loaded(list, { loaded: { context, rows: [{ ...saved, status }], total: 1, page: 1, error: null } });
    assert.ok(renderWithPresentation(createElement(Page), locale).includes(escape(creditNoteStatusLabel(translator(locale), status))));
  }
});

test("credit detail renders owned actions, application dialog, validation and escaped exact values", () => {
  for (const locale of locales) {
    const t = translator(locale);
    for (const status of ["draft", "sent", "applied", "void", "future", "constructor", "__proto__"]) {
      const Page = loaded(detail, { loading: false, cn: { ...saved, status }, applyOpen: true, applyInvoiceId: "invoice-a", applyAmount: "12.50", invoiceLoaded: { context: invoiceContext, rows: [selectedInvoice], error: null } });
      const html = renderWithPresentation(createElement(Page, { orgId: "org-a", id: raw.id }), locale);
      for (const key of ["back", "notes", "total", "applied", "remaining", "description", "quantity", "amount"] as const) assert.ok(html.includes(escape(t(key))), key);
      assert.ok(html.includes(escape(t("recipient", { name: caller }))));
      assert.ok(html.includes(escape(t("issued", { date: raw.issueDate }))));
      assert.ok(html.includes(escape(creditNoteStatusLabel(t, status))));
      assert.ok(html.includes(escape(caller)) && !html.includes("<script>"));
      assert.ok(html.includes(">1.25</span>") && html.includes("90,071,992,547,409.91"));
      if (status === "draft") assert.ok(html.includes(escape(t("send"))));
      if (status !== "void") assert.ok(html.includes(escape(t("voidAction"))) && html.includes(escape(t("voidHint"))));
      if (status === "sent") {
        for (const key of ["applyHint", "applyAction", "applyTitle", "invoice", "selectInvoice", "reduceInvoice"] as const) assert.ok(html.includes(escape(t(key))), key);
        assert.ok(html.includes(escape(t("invoiceOption", { number: caller, name: caller, amount: money.creditNoteUiMoney(selectedInvoice.amountDue, "USD") }))));
        assert.ok(html.includes(escape(t("remainingCredit", { amount: money.creditNoteUiMoney(saved.amountRemaining, "USD") }))));
      }
    }
    const Invalid = loaded(detail, { loading: false, cn: saved, applyOpen: true, applyInvoiceId: "invoice-a", applyAmount: "90071992547409.92", invoiceLoaded: { context: invoiceContext, rows: [selectedInvoice], error: null } });
    const invalid = renderWithPresentation(createElement(Invalid, { orgId: "org-a", id: raw.id }), locale);
    assert.ok(invalid.includes(escape(t("invalidAmount"))) && invalid.includes("disabled"));
    const NoInvoices = loaded(detail, { loading: false, cn: { ...saved, contact: null }, applyOpen: true, invoiceLoaded: { context: invoiceContext, rows: [], error: t("invoiceReadFailed") } });
    const noInvoices = renderWithPresentation(createElement(NoInvoices, { orgId: "org-a", id: raw.id }), locale);
    assert.ok(noInvoices.includes(escape(t("noInvoices", { currency: "USD" }))) && noInvoices.includes(escape(t("invoiceReadFailed"))));
    assert.ok(noInvoices.includes(escape(t("recipient", { name: t("unknown") }))));
    for (const loading of [false, true]) {
      const Page = loaded(detail, { loading, cn: null });
      assert.ok(renderWithPresentation(createElement(Page, { orgId: "org-a", id: raw.id }), locale).includes(escape(t(loading ? "loading" : "notFound"))));
    }
    for (const currencyCode of ["USD", "JPY", "KWD"]) {
      const credit = { ...saved, currencyCode, subtotal: 1250n, taxTotal: 0n, total: 1250n };
      const html = renderWithPresentation(createElement(CreditNoteMoneyDetails, { credit }), locale);
      for (const [key, amount] of [["subtotalAmount", 1250n], ["taxAmount", 0n], ["totalAmount", 1250n]] as const) assert.ok(html.includes(escape(t(key, { amount: money.creditNoteUiMoney(amount, currencyCode) }))));
      assert.ok(html.includes(escape(t("price", { currency: currencyCode }))));
    }
  }
});

test("credit drawer renders bilingual owned fields and retains exact extended-price policy", () => {
  for (const locale of locales) {
    const t = translator(locale), Drawer = loaded(drawer, { currencyCode: "KWD", issueDate: "" });
    const html = renderWithPresentation(createElement(Drawer, { open: true, onClose: noop }), locale);
    for (const key of ["newCreditNote", "drawerDescription", "details", "currency", "customerRequired", "reference", "referencePlaceholder", "issueDateHeading", "issueDate", "lineItems", "notes", "notesPlaceholder", "createAction"] as const) assert.ok(html.includes(escape(t(key))), key);
  }
  const source = readFileSync(drawer, "utf8").split("function CreditNoteDrawer(")[1].split("function RecurringDrawer(")[0];
  assert.match(source, /roundPriceFirst=\{false\} priceFractionDigits=\{18\}/);
  assert.match(source, /accountTypeFilter=\{\["revenue"\]\} taxContext="sales"/);
});

test("credit creation keeps canonical org, date, nullable fields and exact lines with localized failure handling", async () => {
  for (const locale of locales) for (const mode of ["success", "denied", "network", "json", "shape", "emptyId", "invalidLines", "customer", "parser"]) {
    const t = translator(locale), errors: string[] = [], successes: string[] = [], routes: string[] = [], busy: boolean[] = [];
    let requests = 0, closed = 0;
    const lines = [{ description: caller, quantity: "1.25", unitPrice: mode === "parser" ? "bad" : "12.500", accountId: "", taxRateId: "" }];
    const run = callback(drawer, "handleSubmit", { ...money, t, orgId: "org-a", contactId: mode === "customer" ? "" : raw.contactId, validLines: mode !== "invalidLines", lines, issueDate: raw.issueDate, currencyCode: "KWD", reference: caller, notes: "", setSaving: (v: boolean) => busy.push(v), onClose: () => closed++, router: { push: (v: string) => routes.push(v) }, toast: { error: (v: string) => errors.push(v), success: (v: string) => successes.push(v) }, fetch: async (url: string, init: RequestInit) => {
      requests++; assert.equal(url, "/api/v1/credit-notes"); assert.equal(init.method, "POST");
      assert.equal((init.headers as Record<string, string>)["x-organization-id"], "org-a");
      assert.deepEqual(JSON.parse(String(init.body)), { contactId: raw.contactId, issueDate: raw.issueDate, currencyCode: "KWD", reference: caller, notes: null, lines: money.creditNoteEditorLines(lines) });
      if (mode === "network") throw new Error("secret");
      if (mode === "json") return new Response("private HTML");
      return Response.json(mode === "shape" ? null : { creditNote: { id: mode === "emptyId" ? " " : raw.id }, error: "secret server prose" }, { status: mode === "denied" ? 403 : 200 });
    } });
    await run({ preventDefault: noop });
    const ok = mode === "success", early = ["customer", "invalidLines"].includes(mode);
    assert.deepEqual(errors, ok ? [] : [t(mode === "customer" ? "selectCustomer" : mode === "invalidLines" ? "checkLines" : "createFailed")]);
    assert.deepEqual(successes, ok ? [t("created")] : []); assert.deepEqual(routes, ok ? [`/sales/credit-notes/${raw.id}`] : []); assert.equal(closed, ok ? 1 : 0);
    assert.deepEqual(busy, early ? [] : mode === "parser" ? [false] : [true, false]); assert.equal(requests, early || mode === "parser" ? 0 : 1);
  }
});

test("credit list, summary and detail reads reject HTTP/JSON/alias failures and honor abort", async () => {
  for (const locale of locales) for (const operation of ["list", "summary", "detail"]) for (const mode of ["success", "denied", "network", "json", "shape", "alias", "cancelled"]) {
    const t = translator(locale), values: unknown[] = [], errors: unknown[] = [], busy: unknown[] = [];
    const path = operation === "detail" ? detail : list;
    const row = { ...raw, totalMinor: mode === "alias" ? "01" : raw.totalMinor };
    const cleanup = callback(path, "effect", { ...money, t, orgId: "org-a", id: raw.id, context, buildParams: () => new URLSearchParams("page=1&limit=50"), setLoaded: (v: unknown) => values.push(v), setSummaryLoaded: (v: unknown) => values.push(v), setCn: (v: unknown) => values.push(v), setError: (v: unknown) => errors.push(v), setLoading: (v: unknown) => busy.push(v), setFetchKey: noop, setOrgName: noop, fetch: async (url: string, init: RequestInit) => {
      assert.equal((init.headers as Record<string, string>)["x-organization-id"], "org-a"); assert.equal(init.body, undefined);
      if (url === "/api/v1/organization") return Response.json({ organization: { name: caller } });
      assert.equal(url, operation === "list" ? "/api/v1/credit-notes?page=1&limit=50" : operation === "summary" ? "/api/v1/credit-notes/summary" : `/api/v1/credit-notes/${raw.id}`);
      if (mode === "network") throw new Error("secret");
      if (mode === "json") return new Response("private HTML");
      return Response.json(mode === "shape" ? null : operation === "list" ? { data: [row], pagination: { total: 1 } } : operation === "summary" ? { ...summaryRaw, totalAmountMinor: mode === "alias" ? "001" : raw.totalMinor, error: "secret" } : { creditNote: row }, { status: mode === "denied" ? 403 : 200 });
    } }, operation === "list" ? 1 : operation === "summary" ? 3 : 1)();
    if (mode === "cancelled") cleanup(); await flush();
    const ok = mode === "success";
    if (mode === "cancelled") assert.deepEqual(values, []);
    else if (operation === "list") assert.deepEqual(values, [{ context, rows: ok ? [money.creditNoteUiHeader(raw)] : [], total: ok ? 1 : 0, page: 1, error: ok ? null : t("readFailed") }]);
    else if (operation === "summary") {
      const value = values[0] as { org: string; summary: unknown; error: string | null };
      assert.equal(value.org, "org-a"); assert.equal(value.error, ok ? null : t("summaryFailed"));
      if (ok) assert.equal((value.summary as { totalAmount: bigint }).totalAmount, saved.total); else assert.equal(value.summary, null);
    } else { assert.deepEqual(values, [ok ? saved : null]); assert.deepEqual(errors, [ok ? null : t("readFailed")]); assert.deepEqual(busy, [false]); }
    cleanup();
  }
});

test("credit pagination preserves query, prior rows and stale context guards", async () => {
  const params = callback(list, "buildParams", { statusFilter: "void", sortBy: "remaining", sortOrder: "asc", dateFrom: "2026-01-01", dateTo: "2026-10-18", PAGE_SIZE: 50 });
  assert.equal(params(2).toString(), "status=void&sortBy=remaining&sortOrder=asc&from=2026-01-01&to=2026-10-18&page=2&limit=50");
  for (const locale of locales) for (const mode of ["success", "denied", "network", "json", "shape", "alias", "stale"]) {
    const t = translator(locale), currentContext = { current: context }, busy: unknown[] = [];
    let state = { context, rows: [saved], total: 2, page: 1, error: null as string | null };
    callback(list, "loadMore", { ...money, t, orgId: "org-a", page: 1, loadingMore: false, refetching: false, context, currentContext, buildParams: params, setMoreContext: (v: unknown) => busy.push(v), setLoaded: (fn: (v: typeof state) => typeof state) => { state = fn(state); }, fetch: async (url: string, init: RequestInit) => {
      assert.equal(url, `/api/v1/credit-notes?${params(2)}`); assert.equal((init.headers as Record<string, string>)["x-organization-id"], "org-a");
      if (mode === "stale") currentContext.current = "another-org";
      if (mode === "network") throw new Error("secret");
      if (mode === "json") return new Response("private HTML");
      return Response.json(mode === "shape" ? null : { data: [{ ...raw, totalMinor: mode === "alias" ? "001" : raw.totalMinor }] }, { status: mode === "denied" ? 403 : 200 });
    } })();
    await flush();
    assert.deepEqual(state.rows, mode === "success" ? [saved, money.creditNoteUiHeader(raw)] : [saved]);
    assert.equal(state.error, mode === "success" || mode === "stale" ? null : t("readFailed"));
    assert.equal(state.page, mode === "success" ? 2 : 1);
    assert.equal(busy[0], context); assert.equal((busy[1] as (v: string) => unknown)(context), null);
  }
});

test("credit invoice read filters customer, currency, status and balance before rendering exact choices", async () => {
  for (const locale of locales) for (const mode of ["success", "denied", "network", "json", "shape", "alias", "cancelled"]) {
    const t = translator(locale), values: unknown[] = [];
    const cleanup = callback(detail, "effect", { ...money, t, orgId: "org-a", applyOpen: true, cn: saved, invoiceContext, setInvoiceLoaded: (v: unknown) => values.push(v), fetch: async (url: string, init: RequestInit) => {
      assert.equal(url, "/api/v1/invoices?limit=100&contactId=customer-a"); assert.equal((init.headers as Record<string, string>)["x-organization-id"], "org-a");
      if (mode === "network") throw new Error("secret");
      if (mode === "json") return new Response("private HTML");
      const rows = [invoiceRaw, { ...invoiceRaw, contactId: "another-customer" }, { ...invoiceRaw, currencyCode: "KWD" }, { ...invoiceRaw, status: "draft" }, { ...invoiceRaw, amountDue: 0, amountDueMinor: "0" }];
      if (mode === "alias") rows[0] = { ...invoiceRaw, amountDueMinor: "001" };
      return Response.json(mode === "shape" ? null : { data: rows }, { status: mode === "denied" ? 403 : 200 });
    } }, 2)();
    if (mode === "cancelled") cleanup(); await flush();
    assert.deepEqual(values, mode === "cancelled" ? [] : [{ context: invoiceContext, rows: mode === "success" ? [selectedInvoice] : [], error: mode === "success" ? null : t("invoiceReadFailed") }]);
    cleanup();
  }
});

test("credit application retains exact payload and suppresses raw errors and unmounted outcomes", async () => {
  for (const locale of locales) for (const mode of ["success", "denied", "network", "parser", "bounds", "unmounted"]) {
    const t = translator(locale), errors: string[] = [], successes: string[] = [], busy: boolean[] = [], active = { current: true };
    let requests = 0, reloads = 0, resets = 0;
    const run = callback(detail, "handleApply", { ...money, t, orgId: "org-a", id: raw.id, cn: saved, selectedInvoice, applyAmount: mode === "parser" ? "bad" : mode === "bounds" ? "90071992547409.92" : "12.50", active, setApplyLoading: (v: boolean) => busy.push(v), handleSendComplete: () => reloads++, setApplyOpen: () => resets++, setApplyInvoiceId: () => resets++, setApplyAmount: () => resets++, toast: { error: (v: string) => errors.push(v), success: (v: string) => successes.push(v) }, fetch: async (url: string, init: RequestInit) => {
      requests++; assert.equal(url, `/api/v1/credit-notes/${raw.id}/apply`); assert.equal(init.method, "POST"); assert.equal((init.headers as Record<string, string>)["x-organization-id"], "org-a");
      assert.deepEqual(JSON.parse(String(init.body)), { invoiceId: "invoice-a", amountMinor: "1250" });
      if (mode === "network") throw new Error("secret");
      if (mode === "unmounted") active.current = false;
      return Response.json({ error: "private server prose" }, { status: mode === "denied" ? 403 : 200 });
    } });
    await run();
    assert.equal(requests, ["parser", "bounds"].includes(mode) ? 0 : 1);
    assert.deepEqual(errors, ["success", "unmounted"].includes(mode) ? [] : [t("applyFailed")]);
    assert.deepEqual(successes, mode === "success" ? [t("applySuccess")] : []);
    assert.equal(reloads, mode === "success" ? 1 : 0); assert.equal(resets, mode === "success" ? 3 : 0);
    assert.deepEqual(busy, mode === "unmounted" ? [true] : [true, false]);
  }
});

test("credit cancellation translates confirmation and outcomes with unchanged org-scoped request", async () => {
  for (const locale of locales) for (const mode of ["success", "denied", "network", "unmounted"]) {
    const t = translator(locale), errors: string[] = [], successes: string[] = [], active = { current: true };
    let reloads = 0;
    await callback(detail, "handleVoid", { t, orgId: "org-a", id: raw.id, active, handleSendComplete: () => reloads++, confirm: async (options: { title: string; description: string; confirmLabel: string; destructive: boolean; onConfirm: () => Promise<void> }) => {
      assert.equal(options.title, t("voidTitle")); assert.equal(options.description, t("voidDescription")); assert.equal(options.confirmLabel, t("voidAction")); assert.equal(options.destructive, true); await options.onConfirm();
    }, toast: { error: (v: string) => errors.push(v), success: (v: string) => successes.push(v) }, fetch: async (url: string, init: RequestInit) => {
      assert.equal(url, `/api/v1/credit-notes/${raw.id}/void`); assert.equal(init.method, "POST"); assert.equal((init.headers as Record<string, string>)["x-organization-id"], "org-a"); assert.equal(init.body, undefined);
      if (mode === "network") throw new Error("secret"); if (mode === "unmounted") active.current = false;
      return Response.json({ error: "secret" }, { status: mode === "denied" ? 403 : 200 });
    } })();
    assert.deepEqual(errors, ["denied", "network"].includes(mode) ? [t("voidFailed")] : []);
    assert.deepEqual(successes, mode === "success" ? [t("voidSuccess")] : []); assert.equal(reloads, mode === "success" ? 1 : 0);
  }
});

test("owned credit templates contain no unextracted authored JSX or display attributes", () => {
  for (const path of [list, detail, drawer, "components/dashboard/credit-note-money-details.tsx"]) {
    const ast = parse(path), problems: string[] = [];
    function visit(n: ts.Node) {
      if (path === drawer && ts.isFunctionDeclaration(n) && n.parent === ast && n.name?.text !== "CreditNoteDrawer") return;
      if (ts.isJsxText(n) && /[a-z]/i.test(n.text.replaceAll("&middot;", "").replace(/INV-0042|CN-0001/g, "").trim())) problems.push(n.text.trim());
      if (ts.isJsxAttribute(n) && ["title", "placeholder", "label", "description", "emptyMessage", "aria-label"].includes(n.name.getText(ast)) && n.initializer && ts.isStringLiteral(n.initializer) && /[a-z]/i.test(n.initializer.text)) problems.push(n.getText(ast));
      ts.forEachChild(n, visit);
    }
    visit(ast); assert.deepEqual(problems, [], path);
  }
});
