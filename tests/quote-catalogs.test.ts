import { currencyLabel } from "../i18n/currency-labels";
import { resolvePresentation } from "../i18n/locale";
import { formatExactDecimal as localizedExactDecimal } from "../i18n/numbers";
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
import { QuoteMoneyDetails } from "../components/dashboard/quote-money-details";
import { quoteStatusLabel } from "../i18n/quote-presentation";
import * as money from "../lib/money/quote-ui";
import { renderWithPresentation } from "./helpers/presentation";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const list = "app/(dashboard)/sales/quotes/page.tsx";
const detail = "app/(dashboard)/sales/quotes/[id]/page.tsx";
const drawer = "components/dashboard/create-drawer.tsx";
const locales = ["en-US", "fa-IR"] as const;
const noop = () => {};
const caller = "<script>customer & quote</script>";
const raw = {
  id: "quote-a", quoteNumber: "QTE-001", issueDate: "2026-10-18", expiryDate: "2099-01-01", status: "sent",
  currencyCode: "USD", contact: { name: caller, email: caller }, notes: caller,
  subtotal: 9007199254740991, subtotalMinor: "9007199254740991", taxTotal: 0, taxTotalMinor: "0",
  total: 9007199254740991, totalMinor: "9007199254740991", billedTotal: 0, billedTotalMinor: "0",
  lines: [{ id: "line-a", description: caller, quantity: 125, unitPrice: 9007199254740991, unitPriceMinor: "9007199254740991", amount: 9007199254740991, amountMinor: "9007199254740991", taxAmount: 0, taxAmountMinor: "0", account: { code: "4000", name: caller } }],
};
const saved = money.quoteUiDocument(raw);
function translator(locale: typeof locales[number]) { return createTranslator({ locale, messages: locale === "en-US" ? en : fa, namespace: "SalesQuotes" }); }
function escape(value: string) { return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;"); }

function parse(path: string) { return ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX); }
function componentName(path: string) { return path === list ? "QuotesPage" : path === detail ? "QuoteDetailPage" : "QuoteDrawer"; }

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
    if (id === "next/navigation") return { useParams: () => ({ id: raw.id }), useRouter: () => ({ push: noop }) };
    if (id.endsWith("/create-drawer")) return { useCreateDrawer: () => ({ open: noop }) };
    if (id.endsWith("/use-debounce")) return { useDebounce: (value: string) => value };
    if (id.endsWith("/use-confirm")) return { useConfirm: () => ({ confirm: noop, dialog: null }) };
    if (id.endsWith("/use-entity-title")) return { useEntityTitle: noop };
    if (id.endsWith("/data-table")) return DataTable;
    if (id.endsWith("/ui/date-picker")) return DatePicker;
    if (id.endsWith("/quote-money-details")) return { QuoteMoneyDetails };
    if (id.endsWith("/use-document-title")) return { useDocumentTitle: noop };
    if (id.endsWith("/line-items-editor")) return { LineItemsEditor: () => createElement("div", { "data-shared-form": "lines" }) };
    if (id.endsWith("/contact-picker")) return { ContactPicker: () => createElement("div", { "data-shared-form": "contact" }) };
    if (id.endsWith("/currency-select")) return { CurrencySelect: () => createElement("div", { "data-shared-form": "currency" }) };
    for (const [suffix, exports] of [["/ui/dialog", ["Dialog", "DialogContent", "DialogHeader", "DialogTitle", "DialogTrigger"]], ["/ui/sheet", ["Sheet", "SheetContent", "SheetHeader", "SheetTitle", "SheetDescription", "SheetFooter"]]] as const) if (id.endsWith(suffix)) return Object.fromEntries(exports.map(key => [key, inline]));
    if (id.endsWith("/ui/select")) return { Select: inline, SelectTrigger: inline, SelectContent: inline, SelectValue: ({ placeholder }: { placeholder?: string }) => createElement("span", null, placeholder), SelectItem: ({ children, value }: { children: ReactNode; value: string }) => createElement("div", { "data-option": value }, children) };
    if (["/send-document-dialog", "/email-history", "/receipt-attachments"].some(suffix => id.endsWith(suffix))) return { SendDocumentDialog: () => null, EmailHistory: () => null, ReceiptAttachments: ({ label }: { label: string }) => createElement("span", null, label) };
    return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  };
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function("require", "module", "exports", code)(load, compiled, compiled.exports);
  return compiled.exports[path === drawer ? name : "default"];
}

// Execute original callback syntax, preserving requests and money validation.
function callback(path: string, name: string, scope: Record<string, unknown>, effectIndex = 0) {
  const ast = parse(path); let expression = "", index = 0;
  function visit(n: ts.Node) {
    if (path === drawer && ts.isFunctionDeclaration(n) && n.parent === ast && n.name?.text !== "QuoteDrawer") return;
    if (ts.isFunctionDeclaration(n) && n.name?.text === name) expression = n.getText(ast);
    if (ts.isVariableDeclaration(n) && n.name.getText(ast) === name && n.initializer && ts.isCallExpression(n.initializer)) expression = n.initializer.arguments[0].getText(ast);
    if (name === "effect" && ts.isCallExpression(n) && n.expression.getText(ast) === "useEffect" && index++ === effectIndex) expression = n.arguments[0].getText(ast);
    ts.forEachChild(n, visit);
  }
  visit(ast); assert.ok(expression, name);
  const code = ts.transpileModule(`const run = ${expression};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(scope), `${code}; return run;`)(...Object.values(scope));
}

test("quote list renders bilingual empty, filtered, failure and exact grouped money states", () => {
  for (const locale of locales) {
    const t = translator(locale);
    const Empty = loaded(list, { loaded: { context: "org-a:all", quotes: [], error: null } });
    const empty = renderWithPresentation(createElement(Empty), locale);
    for (const key of ["proposals", "emptyTitle", "emptyDescription", "newQuote", "sampleWebsite", "sampleSeo", "turnIntoInvoice", "accepted", "draft"] as const) assert.ok(empty.includes(escape(t(key))), key);
    const Page = loaded(list, { loaded: { context: "org-a:all", quotes: [saved, { ...saved, id: "q2", currencyCode: "KWD" }], error: null } });
    const html = renderWithPresentation(createElement(Page), locale);
    for (const key of ["overview", "overviewDescription", "totalQuotes", "quotes", "listDescription", "number", "customer", "date", "expires", "status", "total", "all", "draftHeading", "sentHeading", "acceptedHeading"] as const) assert.ok(html.includes(escape(t(key))), key);
    assert.ok(html.includes(localizedNumber("90,071,992,547,409.91", locale)) && html.includes(localizedNumber("9,007,199,254,740.991", locale)));
    assert.ok(html.includes(escape(caller)) && !html.includes("<script>"));
    const Filtered = loaded(list, { statusFilter: "sent", loaded: { context: "org-a:sent", quotes: [], error: null } });
    assert.ok(renderWithPresentation(createElement(Filtered), locale).includes(escape(t("noQuotes"))));
    const Failed = loaded(list, { loaded: { context: "org-a:all", quotes: [], error: t("readFailed") } });
    assert.ok(renderWithPresentation(createElement(Failed), locale).includes(escape(t("readFailed"))));
  }
});

test("quote detail and money details render translated lifecycle labels, escaped data and unchanged amounts", () => {
  for (const locale of locales) {
    const t = translator(locale);
    for (const status of ["draft", "sent", "accepted", "declined", "expired", "converted"]) {
      const Page = loaded(detail, { loading: false, loaded: { context: `org-a:${raw.id}`, quote: { ...saved, status } } });
      const html = renderWithPresentation(createElement(Page), locale);
      for (const key of ["back", "description", "quantity", "amount"] as const) assert.ok(html.includes(escape(t(key))), key);
      assert.ok(html.includes(escape(quoteStatusLabel(t, status))));
      assert.ok(html.includes(escape(t("recipient", { name: caller }))));
      assert.ok(html.includes(escape(t("dates", { issueDate: raw.issueDate, expiryDate: raw.expiryDate }))));
      assert.ok(html.includes(escape(caller)) && !html.includes("<script>"));
      assert.ok(html.includes(">1.25</span>") && html.includes(localizedNumber("90,071,992,547,409.91", locale)));
      for (const key of status === "draft" ? ["send"] as const : status === "sent" ? ["accept", "decline"] as const : status === "accepted" ? ["createInvoice", "convertHint"] as const : []) assert.ok(html.includes(escape(t(key))));
    }
    for (const currencyCode of ["USD", "JPY", "KWD"]) {
      const quote = { ...saved, currencyCode, subtotal: 1250n, taxTotal: 0n, total: 1250n };
      const html = renderWithPresentation(createElement(QuoteMoneyDetails, { quote }), locale);
      for (const [key, amount] of [["subtotalAmount", 1250n], ["taxAmount", 0n], ["totalAmount", 1250n]] as const) assert.ok(html.includes(escape(t(key, { amount: money.quoteUiMoney(amount, currencyCode, resolvePresentation({ user: { language: locale } })) }))));
      assert.ok(html.includes(escape(t("price", { currency: currencyLabel(currencyCode, locale) }))));
    }
    for (const code of ["future", "__proto__", "constructor"]) assert.equal(quoteStatusLabel(t, code), code);
  }
  for (const [key, value] of Object.entries(fa.SalesQuotes)) assert.match(value, /[\u0600-\u06ff]/, key);
});

test("quote creation drawer renders bilingual owned fields with unchanged editor contract", () => {
  for (const locale of locales) {
    const t = translator(locale), Drawer = loaded(drawer, { currencyCode: "KWD" });
    const html = renderWithPresentation(createElement(Drawer, { open: true, onClose: noop }), locale);
    for (const key of ["newQuote", "drawerDescription", "details", "currency", "customerRequired", "reference", "referencePlaceholder", "issueDate", "expiryDate", "lineItems", "notes", "notesPlaceholder", "createQuote"] as const) assert.ok(html.includes(escape(t(key))), key);
  }
  const source = readFileSync(drawer, "utf8").split("function QuoteDrawer(")[1].split("function SalesReceiptDrawer(")[0];
  assert.match(source, /roundPriceFirst priceFractionDigits=\{18\}/);
  assert.match(source, /accountTypeFilter=\{\["revenue"\]\} taxContext="sales"/);
});

test("quote creation callbacks preserve exact decimal lines and headers and translate all failure shapes", async () => {
  for (const locale of locales) for (const mode of ["success", "denied", "network", "json", "shape", "invalidLines", "customer"]) {
    const t = translator(locale), errors: string[] = [], successes: string[] = [], routes: string[] = [], busy: boolean[] = [];
    let requests = 0;
    const lines = [{ description: caller, quantity: "1.25", unitPrice: "90071992547409.91", accountId: "00000000-0000-4000-8000-000000000001", taxRateId: "" }];
    const run = callback(drawer, "handleSubmit", { unitPresentation: resolvePresentation({ user: { language: locale } }), ...money, t, orgId: "org-a", contactId: mode === "customer" ? "" : "customer-a", validLines: mode !== "invalidLines", lines, issueDate: raw.issueDate, expiryDate: raw.expiryDate, currencyCode: "USD", reference: caller, notes: "", setSaving: (v: boolean) => busy.push(v), onClose: noop, router: { push: (v: string) => routes.push(v) }, toast: { error: (v: string) => errors.push(v), success: (v: string) => successes.push(v) }, fetch: async (url: string, init: RequestInit) => {
      requests++; assert.equal(url, "/api/v1/quotes"); assert.equal(init.method, "POST");
      assert.equal((init.headers as Record<string, string>)["x-organization-id"], "org-a");
      assert.deepEqual(JSON.parse(String(init.body)), { contactId: "customer-a", issueDate: raw.issueDate, expiryDate: raw.expiryDate, currencyCode: "USD", reference: caller, notes: null, lines: money.quoteEditorLines(lines) });
      if (mode === "network") throw new Error("secret");
      if (mode === "json") return new Response("private HTML");
      return Response.json(mode === "shape" ? null : { quote: { id: raw.id }, error: "secret server prose" }, { status: mode === "denied" ? 403 : 200 });
    } });
    await run({ preventDefault: noop });
    const ok = mode === "success", early = mode === "customer" || mode === "invalidLines";
    assert.deepEqual(errors, ok ? [] : [t(mode === "customer" ? "selectCustomer" : mode === "invalidLines" ? "checkLines" : "createFailed")]);
    assert.deepEqual(successes, ok ? [t("created")] : []); assert.deepEqual(routes, ok ? [`/sales/quotes/${raw.id}`] : []);
    assert.deepEqual(busy, early ? [] : [true, false]); assert.equal(requests, early ? 0 : 1);
  }
});

test("quote lifecycle and conversion callbacks preserve org scope and suppress stale results and private failures", async () => {
  for (const locale of locales) for (const operation of ["accept", "decline", "convert"]) for (const mode of ["success", "denied", "network", "json", "shape", "stale"]) {
    const t = translator(locale), errors: string[] = [], successes: string[] = [], routes: string[] = []; let refreshed = 0;
    const converting = operation === "convert", context = "org-a:quote-a";
    const run = callback(detail, converting ? "handleConvert" : "action", { unitPresentation: resolvePresentation({ user: { language: locale } }), t, orgId: "org-a", id: raw.id, context, currentContext: { current: mode === "stale" ? "org-b:quote-a" : context }, refreshQuote: async () => { refreshed++; }, router: { push: (v: string) => routes.push(v) }, toast: { error: (v: string) => errors.push(v), success: (v: string) => successes.push(v) }, fetch: async (url: string, init: RequestInit) => {
      assert.equal(url, `/api/v1/quotes/${raw.id}/${operation}`); assert.equal(init.method, "POST"); assert.equal(init.body, undefined); assert.equal((init.headers as Record<string, string>)["x-organization-id"], "org-a");
      if (mode === "network") throw new Error("secret");
      if (mode === "json") return new Response("private HTML");
      return Response.json(mode === "shape" ? null : { invoice: { id: "invoice-a" }, error: "secret" }, { status: mode === "denied" ? 403 : 200 });
    } });
    await run(operation);
    const ok = mode !== "stale" && (mode === "success" || !converting && ["json", "shape"].includes(mode));
    assert.deepEqual(errors, ok || mode === "stale" ? [] : [t(converting ? "convertFailed" : "actionFailed")]);
    assert.deepEqual(successes, ok ? [t(converting ? "invoiceCreated" : "done")] : []);
    assert.deepEqual(routes, ok && converting ? ["/sales/invoice-a"] : []); assert.equal(refreshed, ok && !converting ? 1 : 0);
  }
});

test("quote read effects and refresh retain canonical money and reject bad HTTP, JSON, shapes and aliases", async () => {
  for (const locale of locales) for (const path of [list, detail]) for (const mode of ["success", "denied", "json", "shape", "alias", "cancelled"]) {
    const t = translator(locale), values: unknown[] = [], errors: unknown[] = [], busy: unknown[] = [], context = path === list ? "org-a:sent" : "org-a:quote-a";
    const row = { ...raw, totalMinor: mode === "alias" ? "01" : raw.totalMinor };
    const scope = { unitPresentation: resolvePresentation({ user: { language: locale } }), ...money, t, orgId: "org-a", id: raw.id, context, currentContext: { current: context }, statusFilter: "sent", setLoaded: (v: unknown) => values.push(v), setError: (v: unknown) => errors.push(v), setLoading: (v: unknown) => busy.push(v), setOrgName: noop, setSendDialogOpen: noop, fetch: async (url: string, init: RequestInit) => {
      assert.equal((init.headers as Record<string, string>)["x-organization-id"], "org-a"); assert.equal(init.body, undefined);
      if (url === "/api/v1/organization") return Response.json({ organization: { name: caller } });
      assert.equal(url, path === list ? "/api/v1/quotes?status=sent" : `/api/v1/quotes/${raw.id}`);
      if (mode === "json") return new Response("private HTML");
      return Response.json(mode === "shape" ? null : path === list ? { data: [row] } : { quote: row }, { status: mode === "denied" ? 403 : 200 });
    } };
    const cleanup = callback(path, "effect", scope, path === detail ? 1 : 0)();
    if (mode === "cancelled") cleanup();
    for (let i = 0; i < 5; i++) await new Promise(resolve => setImmediate(resolve));
    const successful = mode === "success";
    if (path === list) assert.deepEqual(values, mode === "cancelled" ? [] : [{ context, quotes: successful ? [money.quoteUiHeader(raw)] : [], error: successful ? null : t("readFailed") }]);
    else { assert.deepEqual(values, successful ? [null, { context, quote: saved }] : [null]); assert.deepEqual(errors, [null, ...(!successful && mode !== "cancelled" ? [t("readFailed")] : [])]); assert.deepEqual(busy, mode === "cancelled" ? [true] : [true, false]); }
    cleanup();
    if (path === detail) {
      values.length = 0; errors.length = 0;
      await callback(detail, "refreshQuote", scope)();
      assert.deepEqual(values, successful || mode === "cancelled" ? [{ context, quote: saved }] : [null]);
      assert.deepEqual(errors, [successful || mode === "cancelled" ? null : t("reloadFailed")]);
    }
  }
});

test("owned quote templates contain no unextracted authored JSX or display attributes", () => {
  for (const path of [list, detail, drawer, "components/dashboard/quote-money-details.tsx"]) {
    const ast = parse(path), problems: string[] = [];
    function visit(n: ts.Node) {
      if (path === drawer && ts.isFunctionDeclaration(n) && n.parent === ast && n.name?.text !== "QuoteDrawer") return;
      if (ts.isJsxText(n) && /[a-z]/i.test(n.text.replaceAll("&middot;", "").replace(/(?:QTE|INV)-0001/g, "").trim())) problems.push(n.text.trim());
      if (ts.isJsxAttribute(n) && ["title", "placeholder", "label", "description", "emptyMessage", "aria-label"].includes(n.name.getText(ast)) && n.initializer && ts.isStringLiteral(n.initializer) && /[a-z]/i.test(n.initializer.text)) problems.push(n.getText(ast));
      ts.forEachChild(n, visit);
    }
    visit(ast); assert.deepEqual(problems, [], path);
  }
});

function localizedNumber(value: string, locale: "en-US" | "fa-IR") { return localizedExactDecimal(value.replaceAll(",", ""), resolvePresentation({ user: { language: locale } })); }
