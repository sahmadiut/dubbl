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
import { SalesReceiptMoneyDetails } from "../components/dashboard/sales-receipt-money-details";
import { salesReceiptStatusLabel } from "../i18n/sales-receipt-presentation";
import * as money from "../lib/money/sales-receipt-ui";
import { renderWithPresentation } from "./helpers/presentation";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const list = "app/(dashboard)/sales/receipts/page.tsx";
const detail = "app/(dashboard)/sales/receipts/[id]/page.tsx";
const drawer = "components/dashboard/create-drawer.tsx";
const attachments = "components/dashboard/receipt-attachments.tsx";
const locales = ["en-US", "fa-IR"] as const;
const noop = () => {};
const caller = "<script>customer & quote</script>";
const raw = {
  id: "receipt-a", receiptNumber: "SR-001", date: "2026-10-18", status: "paid", reference: caller, bankAccount: { accountName: caller }, depositAccount: null,
  currencyCode: "USD", contact: { name: caller, email: caller }, notes: caller,
  subtotal: 9007199254740991, subtotalMinor: "9007199254740991", taxTotal: 0, taxTotalMinor: "0",
  total: 9007199254740991, totalMinor: "9007199254740991", billedTotal: 0, billedTotalMinor: "0",
  lines: [{ id: "line-a", description: caller, quantity: 125, unitPrice: 9007199254740991, unitPriceMinor: "9007199254740991", amount: 9007199254740991, amountMinor: "9007199254740991", taxAmount: 0, taxAmountMinor: "0", account: { code: "4000", name: caller } }],
};
const saved = money.salesReceiptUiDocument(raw);
function translator(locale: typeof locales[number]) { return createTranslator({ locale, messages: locale === "en-US" ? en : fa, namespace: "SalesReceipts" }); }
function escape(value: string) { return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;"); }

function parse(path: string) { return ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX); }
function componentName(path: string) { return path === list ? "SalesReceiptsPage" : path === detail ? "SalesReceiptDetailContent" : path === attachments ? "ReceiptAttachments" : "SalesReceiptDrawer"; }

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
  if (path === detail) source += "\nexport { SalesReceiptDetailContent };";
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
    if (id.endsWith("/file-uploader")) return { FileUploader: () => createElement("div", { "data-shared-form": "upload" }) };
    if (id.endsWith("/create-drawer")) return { useCreateDrawer: () => ({ open: noop }) };
    if (id.endsWith("/use-debounce")) return { useDebounce: (value: string) => value };
    if (id.endsWith("/use-confirm")) return { useConfirm: () => ({ confirm: noop, dialog: null }) };
    if (id.endsWith("/use-entity-title")) return { useEntityTitle: noop };
    if (id.endsWith("/data-table")) return DataTable;
    if (id.endsWith("/ui/date-picker")) return DatePicker;
    if (id.endsWith("/sales-receipt-money-details")) return { SalesReceiptMoneyDetails };
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
  return compiled.exports[path === list ? "default" : name];
}

// Execute original callback syntax, preserving requests and money validation.
function callback(path: string, name: string, scope: Record<string, unknown>, effectIndex = 0) {
  const ast = parse(path); let expression = "", index = 0;
  function visit(n: ts.Node) {
    if (path === drawer && ts.isFunctionDeclaration(n) && n.parent === ast && n.name?.text !== "SalesReceiptDrawer") return;
    if (ts.isFunctionDeclaration(n) && n.name?.text === name) expression = n.getText(ast);
    if (ts.isVariableDeclaration(n) && n.name.getText(ast) === name && n.initializer && ts.isCallExpression(n.initializer)) expression = n.initializer.arguments[0].getText(ast);
    if (name === "effect" && ts.isCallExpression(n) && n.expression.getText(ast) === "useEffect" && index++ === effectIndex) expression = n.arguments[0].getText(ast);
    ts.forEachChild(n, visit);
  }
  visit(ast); assert.ok(expression, name);
  const code = ts.transpileModule(`const run = ${expression};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(scope), `${code}; return run;`)(...Object.values(scope));
}

test("cash sale list renders bilingual guidance, filters, statuses, failures and exact collected groups", () => {
  for (const locale of locales) {
    const t = translator(locale), context = "org-a:all:created:desc::";
    const Empty = loaded(list, { initialLoad: false, loaded: { context, receipts: [], total: 0, error: null } });
    const empty = renderWithPresentation(createElement(Empty), locale);
    for (const key of ["cashSales", "emptyDescription", "newCashSale", "howItWorks", "saleTotal", "paidInto", "cashDrawer", "nothingOwed", "whenToUse", "counterTitle", "counterDescription", "marketTitle", "marketDescription", "serviceTitle", "serviceDescription", "noInvoiceTitle", "noInvoiceDescription"] as const) assert.ok(empty.includes(escape(t(key))), key);
    const rows = [saved, { ...saved, id: "r2", currencyCode: "KWD" }, { ...saved, id: "r3", total: 1n }];
    const Page = loaded(list, { initialLoad: false, refetching: false, loaded: { context, receipts: rows, total: 3, error: null } });
    const html = renderWithPresentation(createElement(Page), locale);
    for (const key of ["collected", "cashSalesCount", "number", "customer", "date", "status", "total", "all", "draftHeading", "paidHeading", "cancelledHeading", "search", "from", "to", "startDate", "endDate", "sortBy", "newest", "oldest", "highest", "lowest", "numberDesc", "numberAsc"] as const) assert.ok(html.includes(escape(t(key))), key);
    assert.ok(html.includes(escape(t("showing", { loaded: 3, total: 3 }))));
    assert.ok(html.includes(localizedNumber("90,071,992,547,409.92", locale)) && html.includes(localizedNumber("9,007,199,254,740.991", locale)));
    assert.ok(html.includes(escape(caller)) && !html.includes("<script>"));
    const Filtered = loaded(list, { initialLoad: false, statusFilter: "void", loaded: { context: "org-a:void:created:desc::", receipts: [], total: 0, error: null } });
    assert.ok(renderWithPresentation(createElement(Filtered), locale).includes(escape(t("noMatches"))));
    const Failed = loaded(list, { initialLoad: false, loaded: { context, receipts: [], total: 0, error: t("readFailed") } });
    assert.ok(renderWithPresentation(createElement(Failed), locale).includes(escape(t("readFailed"))));
  }
});

test("receipt count uses real ICU plural rules and Persian leaves contain Persian script", () => {
  const t = translator("en-US");
  assert.equal(t("showing", { loaded: 1, total: 1 }), "Showing 1 of 1 cash sale");
  assert.equal(t("showing", { loaded: 0, total: 0 }), "Showing 0 of 0 cash sales");
  assert.equal(t("showing", { loaded: 1, total: 2 }), "Showing 1 of 2 cash sales");
  for (const count of [0, 1, 2, 1.5]) assert.ok(translator("fa-IR")("showing", { loaded: count, total: count }).includes("فروش نقدی"));
  for (const namespace of [fa.SalesReceipts, fa.ReceiptAttachments]) for (const [key, value] of Object.entries(namespace)) assert.match(value, /[\u0600-\u06ff]/, key);
});

test("receipt detail renders translated loading, missing, recipient, status and exact money labels", () => {
  for (const locale of locales) {
    const t = translator(locale);
    for (const status of ["draft", "paid", "void", "future", "constructor", "__proto__"]) {
      const Page = loaded(detail, { loading: false, sr: { ...saved, status } });
      const html = renderWithPresentation(createElement(Page, { orgId: "org-a", id: raw.id }), locale);
      for (const key of ["back", "total", "paidInto", "notes", "description", "quantity", "amount"] as const) assert.ok(html.includes(escape(t(key))), key);
      assert.ok(html.includes(escape(salesReceiptStatusLabel(t, status))));
      assert.ok(html.includes(escape(t("soldTo", { name: caller }))));
      assert.ok(html.includes(escape(t("referenceValue", { reference: caller }))));
      assert.ok(html.includes(escape(caller)) && !html.includes("<script>"));
      assert.ok(html.includes(">1.25</span>") && html.includes(localizedNumber("90,071,992,547,409.91", locale)));
    }
    const MissingData = loaded(detail, { loading: false, sr: { ...saved, contact: null, bankAccount: null } });
    const html = renderWithPresentation(createElement(MissingData, { orgId: "org-a", id: raw.id }), locale);
    assert.ok(html.includes(escape(t("soldTo", { name: t("unknown") }))) && html.includes(escape(t("notRecorded"))));
    for (const loading of [false, true]) {
      const Page = loaded(detail, { loading, sr: null });
      assert.ok(renderWithPresentation(createElement(Page, { orgId: "org-a", id: raw.id }), locale).includes(escape(t(loading ? "loading" : "notFound"))));
    }
    for (const currencyCode of ["USD", "JPY", "KWD"]) {
      const receipt = { ...saved, currencyCode, subtotal: 1250n, taxTotal: 0n, total: 1250n };
      const html = renderWithPresentation(createElement(SalesReceiptMoneyDetails, { receipt }), locale);
      for (const [key, amount] of [["subtotalAmount", 1250n], ["taxAmount", 0n], ["totalAmount", 1250n]] as const) assert.ok(html.includes(escape(t(key, { amount: money.salesReceiptUiMoney(amount, currencyCode, resolvePresentation({ user: { language: locale } })) }))));
      assert.ok(html.includes(escape(t("price", { currency: currencyLabel(currencyCode, locale) }))));
    }
  }
});

test("cash sale drawer renders bilingual owned fields and preserves extended-price editor policy", () => {
  for (const locale of locales) {
    const t = translator(locale), Drawer = loaded(drawer, { selectedCurrency: "KWD", date: "" });
    const html = renderWithPresentation(createElement(Drawer, { open: true, onClose: noop }), locale);
    for (const key of ["newCashSaleHeading", "drawerDescription", "saleDetails", "customerRequired", "reference", "referencePlaceholder", "date", "saleDate", "currency", "whatWasSold", "payment", "paidIntoRequired", "chooseAccount", "noAccounts", "accountHint", "notes", "notesPlaceholder", "recordCashSale"] as const) assert.ok(html.includes(escape(t(key))), key);
  }
  const source = readFileSync(drawer, "utf8").split("function SalesReceiptDrawer(")[1].split("function PurchaseOrderDrawer(")[0];
  assert.match(source, /roundPriceFirst=\{false\} priceFractionDigits=\{18\}/);
  assert.match(source, /accountTypeFilter=\{\["revenue"\]\} taxContext="sales"/);
});

test("receipt creation preserves headers, exact decimal lines, currency and nullable fields with translated failures", async () => {
  for (const locale of locales) for (const mode of ["success", "denied", "network", "json", "shape", "emptyId", "invalidLines", "customer", "account", "currency", "parser"]) {
    const t = translator(locale), errors: string[] = [], successes: string[] = [], routes: string[] = [], busy: boolean[] = [];
    let requests = 0, closed = 0;
    const lines = [{ description: caller, quantity: "1.25", unitPrice: mode === "parser" ? "bad" : "12.500", accountId: "", taxRateId: "" }];
    const run = callback(drawer, "handleSubmit", { unitPresentation: resolvePresentation({ user: { language: locale } }), ...money, t, orgId: "org-a", contactId: mode === "customer" ? "" : "customer-a", bankAccountId: mode === "account" ? "" : "bank-a", validLines: mode !== "invalidLines", lines, date: raw.date, currencyCode: mode === "currency" ? null : "KWD", reference: caller, notes: "", setSaving: (v: boolean) => busy.push(v), onClose: () => closed++, router: { push: (v: string) => routes.push(v) }, toast: { error: (v: string) => errors.push(v), success: (v: string) => successes.push(v) }, fetch: async (url: string, init: RequestInit) => {
      requests++; assert.equal(url, "/api/v1/sales-receipts"); assert.equal(init.method, "POST");
      assert.equal((init.headers as Record<string, string>)["x-organization-id"], "org-a");
      assert.deepEqual(JSON.parse(String(init.body)), { contactId: "customer-a", date: raw.date, currencyCode: "KWD", reference: caller, notes: null, bankAccountId: "bank-a", lines: money.salesReceiptEditorLines(lines) });
      if (mode === "network") throw new Error("secret");
      if (mode === "json") return new Response("private HTML");
      return Response.json(mode === "shape" ? null : { salesReceipt: { id: mode === "emptyId" ? " " : raw.id }, error: "secret server prose" }, { status: mode === "denied" ? 403 : 200 });
    } });
    await run({ preventDefault: noop });
    const ok = mode === "success", early = ["customer", "account", "invalidLines", "currency"].includes(mode);
    const key = mode === "customer" ? "selectCustomer" : mode === "account" ? "selectAccount" : ["invalidLines", "currency"].includes(mode) ? "checkLines" : "createFailed";
    assert.deepEqual(errors, ok ? [] : [t(key)]); assert.deepEqual(successes, ok ? [t("created")] : []);
    assert.deepEqual(routes, ok ? [`/sales/receipts/${raw.id}`] : []); assert.equal(closed, ok ? 1 : 0);
    assert.deepEqual(busy, early ? [] : mode === "parser" ? [false] : [true, false]); assert.equal(requests, early || mode === "parser" ? 0 : 1);
  }
});

const flush = async () => { for (let i = 0; i < 6; i++) await new Promise(resolve => setImmediate(resolve)); };

test("receipt list and detail reads reject failed HTTP, malformed JSON/shapes and conflicting aliases and honor cancellation", async () => {
  for (const locale of locales) for (const path of [list, detail]) for (const mode of ["success", "denied", "network", "json", "shape", "alias", "cancelled"]) {
    const t = translator(locale), values: unknown[] = [], errors: unknown[] = [], busy: unknown[] = [], context = "org-a:paid:created:desc::";
    const row = { ...raw, totalMinor: mode === "alias" ? "01" : raw.totalMinor }, generation = { current: 0 };
    const cleanup = callback(path, "effect", { unitPresentation: resolvePresentation({ user: { language: locale } }), ...money, t, orgId: "org-a", id: raw.id, context, generation, buildParams: () => new URLSearchParams("status=paid&page=1&limit=50"), setLoaded: (v: unknown) => values.push(v), setSr: (v: unknown) => values.push(v), setError: (v: unknown) => errors.push(v), setLoading: (v: unknown) => busy.push(v), setRefetching: noop, setLoadingMore: noop, setPage: noop, setInitialLoad: noop, setFetchKey: noop, devDelay: async () => {}, fetch: async (url: string, init: RequestInit) => {
      assert.equal((init.headers as Record<string, string>)["x-organization-id"], "org-a"); assert.equal(init.body, undefined);
      assert.equal(url, path === list ? "/api/v1/sales-receipts?status=paid&page=1&limit=50" : `/api/v1/sales-receipts/${raw.id}`);
      if (mode === "network") throw new Error("secret");
      if (mode === "json") return new Response("private HTML");
      return Response.json(mode === "shape" ? null : path === list ? { data: [row], pagination: { total: 1 } } : { salesReceipt: row }, { status: mode === "denied" ? 403 : 200 });
    } })();
    if (mode === "cancelled") cleanup();
    await flush();
    const ok = mode === "success";
    assert.deepEqual(values, mode === "cancelled" ? [] : path === list ? [{ context, receipts: ok ? [money.salesReceiptUiHeader(raw)] : [], total: ok ? 1 : 0, error: ok ? null : t("readFailed") }] : ok ? [saved] : []);
    if (path === detail) { assert.deepEqual(errors, [null, ...(!ok && mode !== "cancelled" ? [t("readFailed")] : [])]); assert.deepEqual(busy, mode === "cancelled" ? [true] : [true, false]); }
    cleanup();
  }
});

test("receipt pagination preserves prior rows, canonical query and stale generation protection", async () => {
  const params = callback(list, "buildParams", { statusFilter: "void", sortBy: "total", sortOrder: "asc", dateFrom: "2026-01-01", dateTo: "2026-10-18", PAGE_SIZE: 50 });
  assert.equal(params(2).toString(), "status=void&sortBy=total&sortOrder=asc&from=2026-01-01&to=2026-10-18&page=2&limit=50");
  for (const locale of locales) for (const mode of ["success", "denied", "network", "json", "alias", "stale"]) {
    const t = translator(locale), context = "receipt-context", generation = { current: 1 }, pages: number[] = [], busy: boolean[] = [];
    let state = { context, receipts: [saved], total: 2, error: null as string | null };
    callback(list, "loadMore", { unitPresentation: resolvePresentation({ user: { language: locale } }), ...money, t, orgId: "org-a", page: 1, loadingMore: false, waitingForContext: false, context, generation, buildParams: params, setLoadingMore: (v: boolean) => busy.push(v), setPage: (v: number) => pages.push(v), setLoaded: (fn: (v: typeof state) => typeof state) => { state = fn(state); }, fetch: async (url: string, init: RequestInit) => {
      assert.equal(url, `/api/v1/sales-receipts?${params(2)}`); assert.equal((init.headers as Record<string, string>)["x-organization-id"], "org-a");
      if (mode === "stale") generation.current++;
      if (mode === "network") throw new Error("secret");
      if (mode === "json") return new Response("private HTML");
      return Response.json({ data: [{ ...raw, totalMinor: mode === "alias" ? "001" : raw.totalMinor }] }, { status: mode === "denied" ? 403 : 200 });
    } })();
    await flush();
    assert.deepEqual(state.receipts, mode === "success" ? [saved, money.salesReceiptUiHeader(raw)] : [saved]);
    assert.equal(state.error, mode === "success" || mode === "stale" ? null : t("moreFailed"));
    assert.deepEqual(pages, mode === "success" ? [2] : []); assert.deepEqual(busy, mode === "stale" ? [true] : [true, false]);
  }
});

test("receipt currency fallback loads canonical customer/org values, translates failure and suppresses cancelled results", async () => {
  for (const locale of locales) for (const mode of ["success", "denied", "network", "json", "shape", "currency", "cancelled"]) {
    const t = translator(locale), values: unknown[] = [];
    const cleanup = callback(drawer, "effect", { unitPresentation: resolvePresentation({ user: { language: locale } }), ...money, t, open: true, orgId: "org-a", contactId: "customer/a", setCurrencyContext: (v: unknown) => values.push(v), fetch: async (url: string, init: RequestInit) => {
      assert.equal((init.headers as Record<string, string>)["x-organization-id"], "org-a");
      assert.ok(["/api/v1/contacts/customer%2Fa", "/api/v1/organization"].includes(url));
      if (mode === "network") throw new Error("secret");
      if (mode === "json") return new Response("private HTML");
      return Response.json(mode === "shape" ? {} : { contact: { currencyCode: mode === "currency" ? "BAD" : "KWD" }, organization: { defaultCurrency: "USD" } }, { status: mode === "denied" ? 403 : 200 });
    } }, 2)();
    if (mode === "cancelled") cleanup(); await flush();
    assert.deepEqual(values, mode === "cancelled" ? [] : [{ orgId: "org-a", contactId: "customer/a", ...(mode === "success" ? { code: "KWD" } : { error: t("currencyFailed") }) }]);
    cleanup();
  }
});

test("receipt attachments render translated defaults, overrides, action titles, loading and escaped file names", () => {
  for (const locale of locales) {
    const t = createTranslator({ locale, messages: locale === "en-US" ? en : fa, namespace: "ReceiptAttachments" });
    const Files = loaded(attachments, { docs: [{ id: "doc-a", fileName: caller, mimeType: "application/pdf" }] });
    const props = { orgId: "org-a", entityId: "receipt-a", entityType: "sales_receipt" };
    const html = renderWithPresentation(createElement(Files, props), locale);
    for (const key of ["label", "view", "remove"] as const) assert.ok(html.includes(escape(t(key))));
    assert.ok(html.includes(escape(caller)) && !html.includes("<script>"));
    assert.ok(renderWithPresentation(createElement(Files, { ...props, label: caller }), locale).includes(escape(caller)));
    const Loading = loaded(attachments, { loading: true });
    assert.ok(renderWithPresentation(createElement(Loading, props), locale).includes(escape(t("loading"))));
    assert.equal(renderWithPresentation(createElement(Files, { ...props, entityId: null }), locale), "");
  }
});

test("attachment callbacks preserve org requests, retain reads on failure and restore optimistic removal with translated errors", async () => {
  for (const locale of locales) for (const operation of ["load", "view", "remove"]) for (const mode of ["success", "denied", "network", "json", "shape"]) {
    const t = createTranslator({ locale, messages: locale === "en-US" ? en : fa, namespace: "ReceiptAttachments" }), errors: string[] = [], opened: unknown[][] = [];
    const doc = { id: "doc-a", fileName: caller, mimeType: "application/pdf" }, busy: boolean[] = [];
    let docs = [doc];
    const run = callback(attachments, operation, { unitPresentation: resolvePresentation({ user: { language: locale } }), t, orgId: "org-a", entityId: "receipt-a", entityType: "sales_receipt", docs, setDocs: (v: typeof docs | ((v: typeof docs) => typeof docs)) => { docs = typeof v === "function" ? v(docs) : v; }, setLoading: (v: boolean) => busy.push(v), toast: { error: (v: string) => errors.push(v) }, window: { open: (...args: unknown[]) => opened.push(args) }, fetch: async (url: string, init: RequestInit) => {
      assert.equal((init.headers as Record<string, string>)["x-organization-id"], "org-a");
      assert.equal(init.method, operation === "remove" ? "DELETE" : undefined);
      assert.equal(url, operation === "load" ? "/api/v1/documents?entityType=sales_receipt&entityId=receipt-a&limit=50" : `/api/v1/documents/doc-a${operation === "view" ? "/download" : ""}`);
      if (mode === "network") throw new Error("secret");
      if (mode === "json") return new Response("private HTML");
      return Response.json(mode === "shape" ? null : { data: [], downloadUrl: "https://example.com/file" }, { status: mode === "denied" ? 403 : 200 });
    } });
    await run("doc-a");
    const ok = mode === "success" || operation === "remove" && ["json", "shape"].includes(mode);
    assert.deepEqual(errors, ok || operation === "load" ? [] : [t(operation === "view" ? "openFailed" : "removeFailed")]);
    assert.deepEqual(docs, operation !== "view" && ok ? [] : [doc]);
    assert.deepEqual(opened, operation === "view" && ok ? [["https://example.com/file", "_blank", "noopener"]] : []);
    if (operation === "load") assert.deepEqual(busy, [true, false]);
  }
});

test("owned receipt templates contain no unextracted authored JSX or display attributes", () => {
  for (const path of [list, detail, drawer, attachments, "components/dashboard/sales-receipt-money-details.tsx"]) {
    const ast = parse(path), problems: string[] = [];
    function visit(n: ts.Node) {
      if (path === drawer && ts.isFunctionDeclaration(n) && n.parent === ast && n.name?.text !== "SalesReceiptDrawer") return;
      if (ts.isJsxText(n) && /[a-z]/i.test(n.text.replaceAll("&middot;", "").replace(/SR-0001/g, "").trim())) problems.push(n.text.trim());
      if (ts.isJsxAttribute(n) && ["title", "placeholder", "label", "description", "emptyMessage", "aria-label"].includes(n.name.getText(ast)) && n.initializer && ts.isStringLiteral(n.initializer) && /[a-z]/i.test(n.initializer.text)) problems.push(n.getText(ast));
      ts.forEachChild(n, visit);
    }
    visit(ast); assert.deepEqual(problems, [], path);
  }
});

function localizedNumber(value: string, locale: "en-US" | "fa-IR") { return localizedExactDecimal(value.replaceAll(",", ""), resolvePresentation({ user: { language: locale } })); }
