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
import { CustomerPrepaymentMoneyDetails } from "../components/dashboard/customer-prepayment-money-details";
import { customerPrepaymentStatusLabel, customerPrepaymentSourceLabel } from "../i18n/customer-prepayment-presentation";
import * as money from "../lib/money/customer-prepayment-ui";
import { renderWithPresentation } from "./helpers/presentation";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const list = "app/(dashboard)/sales/customer-prepayments/page.tsx";
const detail = "app/(dashboard)/sales/customer-prepayments/[id]/page.tsx";
const drawer = "components/dashboard/create-drawer.tsx";
const locales = ["en-US", "fa-IR"] as const;
const noop = () => {};
const caller = "<script>customer & quote</script>";
const raw = { id: "credit-a", date: "2026-10-18", status: "open", contactId: "customer-a", sourceType: "prepayment", currencyCode: "USD", contact: { name: caller, email: caller }, notes: caller, originalAmount: 9007199254740991, originalAmountMinor: "9007199254740991", amountRemaining: 9007199254740990, amountRemainingMinor: "9007199254740990" };
const saved = money.customerPrepaymentRow(raw);
function translator(locale: typeof locales[number]) { return createTranslator({ locale, messages: locale === "en-US" ? en : fa, namespace: "CustomerPrepayments" }); }
function escape(value: string) { return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;"); }

function parse(path: string) { return ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX); }
function componentName(path: string) { return path === list ? "CustomerPrepaymentsList" : path === detail ? "CustomerPrepaymentDetail" : "CustomerCreditForm"; }

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
    if (id.endsWith("/customer-prepayment-money-details")) return { CustomerPrepaymentMoneyDetails };
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
    if (path === drawer && ts.isFunctionDeclaration(n) && n.parent === ast && n.name?.text !== "CustomerCreditForm") return;
    if (ts.isFunctionDeclaration(n) && n.name?.text === name) expression = n.getText(ast);
    if (ts.isVariableDeclaration(n) && n.name.getText(ast) === name && n.initializer && ts.isCallExpression(n.initializer)) expression = n.initializer.arguments[0].getText(ast);
    if (name === "effect" && ts.isCallExpression(n) && n.expression.getText(ast) === "useEffect" && index++ === effectIndex) expression = n.arguments[0].getText(ast);
    ts.forEachChild(n, visit);
  }
  visit(ast); assert.ok(expression, name);
  const code = ts.transpileModule(`const run = ${expression};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(scope), `${code}; return run;`)(...Object.values(scope));
}

const invoiceRaw = { id: "invoice-a", invoiceNumber: caller, contactId: raw.contactId, currencyCode: "USD", status: "sent", amountDue: raw.originalAmount, amountDueMinor: raw.originalAmountMinor, contact: { name: caller } };
const invoice = money.customerPrepaymentInvoice(invoiceRaw);
const flush = async () => { for (let i = 0; i < 6; i++) await new Promise(resolve => setImmediate(resolve)); };

test("prepayment list renders bilingual guidance, controls, source search, counts and separate currency totals", () => {
  for (const locale of locales) {
    const t = translator(locale);
    const Empty = loaded(list, { initialLoad: false });
    const empty = renderWithPresentation(createElement(Empty, { orgId: "org-a" }), locale);
    for (const key of ["prepayments", "emptyDescription", "newPrepayment", "howItWorks", "paidEarly", "creditOnAccount", "putTowardsInvoice", "creditLeft", "whenToUse", "depositTitle", "depositDescription", "overpaidTitle", "overpaidDescription", "retainerTitle", "retainerDescription", "laterTitle", "laterDescription"] as const) assert.ok(empty.includes(escape(t(key))), key);
    const rows = [saved, { ...saved, id: "credit-b", currencyCode: "KWD" }];
    const Page = loaded(list, { initialLoad: false, credits: rows, totalCount: 2 });
    const html = renderWithPresentation(createElement(Page, { orgId: "org-a" }), locale);
    for (const key of ["receivedLoaded", "availableLoaded", "date", "customer", "source", "status", "original", "remaining", "all", "available", "used", "cancelled", "availableHint", "usedHint", "search", "from", "to", "startDate", "endDate", "sortBy", "newest", "oldest", "highest", "lowest", "mostRemaining", "leastRemaining"] as const) assert.ok(html.includes(escape(t(key))), key);
    assert.ok(html.includes(escape(t("showing", { loaded: 2, total: 2 }))));
    assert.ok(html.includes("90,071,992,547,409.91") && html.includes("9,007,199,254,740.991"));
    assert.ok(html.includes(escape(caller)) && !html.includes("<script>"));
    const Filtered = loaded(list, { initialLoad: false, credits: rows, search: "missing" });
    const filtered = renderWithPresentation(createElement(Filtered, { orgId: "org-a" }), locale);
    assert.ok(filtered.includes(escape(t("noMatches"))) && filtered.includes(escape(t("clearFilters"))));
    const Search = loaded(list, { initialLoad: false, credits: rows, search: t("prepaymentSource") });
    assert.ok(renderWithPresentation(createElement(Search, { orgId: "org-a" }), locale).includes(escape(caller)));
    for (const readError of ["readFailed", "moreFailed"] as const) {
      const Failed = loaded(list, { initialLoad: false, readError });
      assert.ok(renderWithPresentation(createElement(Failed, { orgId: "org-a" }), locale).includes(escape(t(readError))));
    }
  }
});

test("prepayment finite labels, ICU counts, Persian script and hostile values are safe", () => {
  const t = translator("en-US");
  assert.equal(t("showing", { loaded: 1, total: 1 }), "Showing 1 of 1 prepayment");
  assert.equal(t("showing", { loaded: 0, total: 0 }), "Showing 0 of 0 prepayments");
  assert.equal(t("showing", { loaded: 1, total: 2 }), "Showing 1 of 2 prepayments");
  for (const count of [0, 1, 2, 1.5]) assert.ok(translator("fa-IR")("showing", { loaded: count, total: count }).includes("پیش‌دریافت"));
  for (const [key, value] of Object.entries(fa.CustomerPrepayments)) assert.match(value, /[\u0600-\u06ff]/, key);
  for (const locale of locales) for (const code of ["open", "applied", "refunded", "void", "prepayment", "overpayment", "credit_note", "future", "constructor", "__proto__", caller]) {
    const Page = loaded(list, { initialLoad: false, credits: [{ ...saved, status: code, sourceType: code }], totalCount: 1 });
    const html = renderWithPresentation(createElement(Page, { orgId: "org-a" }), locale);
    assert.ok(html.includes(escape(customerPrepaymentStatusLabel(translator(locale), code))));
    assert.ok(html.includes(escape(customerPrepaymentSourceLabel(translator(locale), code))));
    assert.ok(!html.includes("<script>"));
  }
});

test("prepayment detail renders translated dialog, exact balances and validation across currencies", () => {
  for (const locale of locales) {
    const t = translator(locale);
    const Page = loaded(detail, { loading: false, cc: saved, applyOpen: true, invoices: [invoice], applyInvoiceId: invoice.id, applyAmount: "12.50" });
    const html = renderWithPresentation(createElement(Page, { orgId: "org-a", id: raw.id }), locale);
    for (const key of ["prepayment", "back", "applyHint", "applyAction", "applyTitle", "invoice", "selectInvoice", "amount", "applySubmit", "original", "usedSoFar", "availableToUse", "notes"] as const) assert.ok(html.includes(escape(t(key))), key);
    for (const text of [t("recipient", { name: caller }), t("received", { date: raw.date }), t("invoiceOption", { number: caller, name: caller, amount: money.customerPrepaymentMoney(invoice.amountDue, "USD") }), t("availableCredit", { amount: money.customerPrepaymentMoney(saved.amountRemaining, "USD") })]) assert.ok(html.includes(escape(text)), text);
    assert.ok(html.includes(escape(caller)) && !html.includes("<script>"));
    const Invalid = loaded(detail, { loading: false, cc: saved, applyOpen: true, invoices: [invoice], applyInvoiceId: invoice.id, applyAmount: "90071992547409.92" });
    assert.ok(renderWithPresentation(createElement(Invalid, { orgId: "org-a", id: raw.id }), locale).includes(escape(t("invalidAmount"))));
    const None = loaded(detail, { loading: false, cc: { ...saved, contact: null }, applyOpen: true, invoiceError: "invoiceReadFailed" });
    const none = renderWithPresentation(createElement(None, { orgId: "org-a", id: raw.id }), locale);
    for (const text of [t("recipient", { name: t("unknown") }), t("noInvoices", { currency: "USD" }), t("invoiceReadFailed")]) assert.ok(none.includes(escape(text)));
    for (const [states, key] of [[{ loading: true }, "loading"], [{ loading: false }, "notFound"], [{ loading: false, readError: "readFailed" }, "readFailed"], [{ loading: false, readError: "updatedReadFailed" }, "updatedReadFailed"]] as const) {
      const State = loaded(detail, states);
      assert.ok(renderWithPresentation(createElement(State, { orgId: "org-a", id: raw.id }), locale).includes(escape(t(key))));
    }
    for (const currencyCode of ["USD", "JPY", "KWD", "IRR"]) {
      const credit = { ...saved, currencyCode, originalAmount: 1250n, amountRemaining: 1249n };
      const cards = renderWithPresentation(createElement(CustomerPrepaymentMoneyDetails, { credit }), locale);
      for (const amount of [1250n, 1249n, 1n]) assert.ok(cards.includes(escape(money.customerPrepaymentMoney(amount, currencyCode))));
    }
  }
});

test("prepayment drawer renders owned bilingual controls, currency recovery and matching bank data", () => {
  for (const locale of locales) {
    const t = translator(locale);
    const Drawer = loaded(drawer, { contactId: raw.contactId, date: "", amount: "1.250", selectedCurrency: "KWD", bankAccounts: [{ id: "bank-a", accountName: caller, currencyCode: "KWD" }, { id: "bank-b", accountName: "wrong currency bank", currencyCode: "USD" }] });
    const html = renderWithPresentation(createElement(Drawer, { orgId: "org-a", open: true, onClose: noop }), locale);
    for (const key of ["newPrepayment", "drawerDescription", "details", "customerRequired", "date", "dateReceived", "amount", "type", "prepayment", "overpayment", "currency", "payment", "paidInto", "chooseBank", "bankHint", "notes", "notesPlaceholder", "recordAction"] as const) assert.ok(html.includes(escape(t(key))), key);
    assert.ok(html.includes(escape(t("receivedAmount", { amount: money.customerPrepaymentMoney(1250n, "KWD") }))));
    assert.ok(html.includes(escape(caller)) && !html.includes("wrong currency bank"));
    const Failed = loaded(drawer, { contactId: raw.contactId, date: "", currencyContext: { orgId: "org-a", contactId: raw.contactId, error: "currencyReadFailed" } });
    const failed = renderWithPresentation(createElement(Failed, { orgId: "org-a", open: true, onClose: noop }), locale);
    for (const key of ["currencyReadFailed", "selectCurrencyHint", "noBanks"] as const) assert.ok(failed.includes(escape(t(key))), key);
  }
});

test("prepayment creation preserves canonical request and rejects raw errors or invalid success identities", async () => {
  for (const locale of locales) for (const mode of ["success", "denied", "network", "json", "shape", "emptyId", "customer", "bank", "amount"]) {
    const t = translator(locale), errors: string[] = [], successes: string[] = [], routes: string[] = [], busy: boolean[] = [];
    let closed = 0, requests = 0;
    await callback(drawer, "handleSubmit", { t, orgId: "org-a", contactId: mode === "customer" ? "" : raw.contactId, bankAccountId: mode === "bank" ? "" : "bank-a", currencyCode: "KWD", exactAmount: mode === "amount" ? null : { amountMinor: "1250" }, selectedBank: { id: "bank-a" }, date: raw.date, sourceType: "overpayment", notes: caller, setSaving: (v: boolean) => busy.push(v), onClose: () => closed++, router: { push: (v: string) => routes.push(v) }, toast: { error: (v: string) => errors.push(v), success: (v: string) => successes.push(v) }, fetch: async (url: string, init: RequestInit) => {
      requests++; assert.equal(url, "/api/v1/customer-credits"); assert.equal(init.method, "POST"); assert.equal((init.headers as Record<string, string>)["x-organization-id"], "org-a");
      assert.deepEqual(JSON.parse(String(init.body)), { contactId: raw.contactId, date: raw.date, amountMinor: "1250", sourceType: "overpayment", bankAccountId: "bank-a", currencyCode: "KWD", notes: caller });
      if (mode === "network") throw new Error("secret"); if (mode === "json") return new Response("private HTML");
      return Response.json(mode === "shape" ? null : { customerCredit: { id: mode === "emptyId" ? " " : raw.id }, error: "secret" }, { status: mode === "denied" ? 403 : 200 });
    } })({ preventDefault: noop });
    const early = ["customer", "bank", "amount"].includes(mode), ok = mode === "success";
    assert.equal(requests, early ? 0 : 1); assert.equal(closed, ok ? 1 : 0); assert.deepEqual(routes, ok ? ["/sales/customer-prepayments"] : []);
    assert.deepEqual(successes, ok ? [t("created")] : []);
    assert.deepEqual(errors, ok ? [] : [t(mode === "customer" ? "selectCustomer" : mode === "bank" ? "selectBank" : mode === "amount" ? "checkAmount" : "createFailed")]);
    assert.deepEqual(busy, early ? [] : [true, false]);
  }
});

test("prepayment reads reject HTTP, JSON, shape and alias failures and ignore cancelled responses", async () => {
  for (const operation of ["list", "detail", "invoice"]) for (const mode of ["success", "denied", "network", "json", "shape", "alias", "cancelled"]) {
    const values: unknown[] = [], errors: unknown[] = [], path = operation === "list" ? list : detail;
    const cleanup = callback(path, "effect", { ...money, orgId: "org-a", id: raw.id, cc: saved, applyOpen: true, generation: { current: 0 }, buildParams: () => new URLSearchParams("page=1&limit=50"), setRefetching: noop, setPage: noop, setReadError: (v: unknown) => errors.push(v), setInvoiceError: (v: unknown) => errors.push(v), setLoadingMore: noop, setInitialLoad: noop, setLoading: noop, setFetchKey: noop, devDelay: async () => {}, setCredits: (v: unknown) => values.push(v), setCc: (v: unknown) => values.push(v), setInvoices: (v: unknown) => values.push(v), setTotalCount: noop, fetch: async (url: string, init: RequestInit) => {
      assert.equal((init.headers as Record<string, string>)["x-organization-id"], "org-a");
      assert.equal(url, operation === "list" ? "/api/v1/customer-credits?page=1&limit=50" : operation === "detail" ? `/api/v1/customer-credits/${raw.id}` : "/api/v1/invoices?limit=100&contactId=customer-a");
      if (mode === "network") throw new Error("secret"); if (mode === "json") return new Response("private HTML");
      const credit = { ...raw, originalAmountMinor: mode === "alias" ? "001" : raw.originalAmountMinor };
      const rows = [{ ...invoiceRaw, amountDueMinor: mode === "alias" ? "001" : invoiceRaw.amountDueMinor }, { ...invoiceRaw, contactId: "other" }, { ...invoiceRaw, currencyCode: "KWD" }, { ...invoiceRaw, status: "draft" }, { ...invoiceRaw, amountDue: 0, amountDueMinor: "0" }];
      return Response.json(mode === "shape" ? null : operation === "list" ? { data: [credit], pagination: { total: 1 } } : operation === "detail" ? { customerCredit: credit } : { data: rows }, { status: mode === "denied" ? 403 : 200 });
    } }, operation === "invoice" ? 1 : 0)();
    if (mode === "cancelled") cleanup(); await flush();
    if (mode === "cancelled") assert.deepEqual(values, []);
    else if (mode === "success") assert.deepEqual(values, [operation === "invoice" ? [invoice] : operation === "list" ? [saved] : saved]);
    else {
      assert.deepEqual(values, operation === "detail" ? [] : [[]]);
      assert.equal(errors.at(-1), operation === "invoice" ? "invoiceReadFailed" : "readFailed");
    }
    cleanup();
  }
});

test("prepayment pagination preserves filters, prior rows and stale generation guards", async () => {
  const params = callback(list, "buildParams", { statusFilter: "void", sortBy: "remaining", sortOrder: "asc", dateFrom: "2026-01-01", dateTo: raw.date, PAGE_SIZE: 50 });
  assert.equal(params(2).toString(), "status=void&sortBy=remaining&sortOrder=asc&from=2026-01-01&to=2026-10-18&page=2&limit=50");
  for (const mode of ["success", "denied", "network", "json", "shape", "alias", "stale"]) {
    let rows = [saved], page = 1;
    const errors: unknown[] = [], generation = { current: 0 };
    callback(list, "loadMore", { ...money, orgId: "org-a", loadingMore: false, refetching: false, readError: "", page, generation, buildParams: params, setLoadingMore: noop, setReadError: (v: unknown) => errors.push(v), setPage: (v: number) => { page = v; }, setCredits: (fn: (v: typeof rows) => typeof rows) => { rows = fn(rows); }, fetch: async (url: string, init: RequestInit) => {
      assert.equal(url, `/api/v1/customer-credits?${params(2)}`); assert.equal((init.headers as Record<string, string>)["x-organization-id"], "org-a");
      if (mode === "stale") generation.current++;
      if (mode === "network") throw new Error("secret"); if (mode === "json") return new Response("private HTML");
      return Response.json(mode === "shape" ? null : { data: [{ ...raw, originalAmountMinor: mode === "alias" ? "001" : raw.originalAmountMinor }] }, { status: mode === "denied" ? 403 : 200 });
    } })();
    await flush();
    assert.deepEqual(rows, mode === "success" ? [saved, saved] : [saved]); assert.equal(page, mode === "success" ? 2 : 1);
    assert.deepEqual(errors, ["success", "stale"].includes(mode) ? [] : ["moreFailed"]);
  }
});

test("prepayment application keeps exact payload and invalidates unreadable committed balances", async () => {
  for (const locale of locales) for (const mode of ["success", "denied", "network", "json", "shape", "alias", "parser", "bounds"]) {
    const t = translator(locale), errors: string[] = [], successes: string[] = [], reads: string[] = [], balances: unknown[] = [], busy: boolean[] = [];
    let requests = 0;
    const updated = { ...raw, amountRemaining: raw.amountRemaining - 1250, amountRemainingMinor: String(raw.amountRemaining - 1250) };
    await callback(detail, "handleApply", { ...money, t, orgId: "org-a", id: raw.id, cc: saved, applyInvoiceId: invoice.id, invoices: [invoice], applyAmount: mode === "parser" ? "bad" : mode === "bounds" ? "90071992547409.92" : "12.50", setApplyLoading: (v: boolean) => busy.push(v), setCc: (v: unknown) => balances.push(v), setReadError: (v: string) => reads.push(v), setApplyOpen: noop, setApplyInvoiceId: noop, setApplyAmount: noop, toast: { error: (v: string) => errors.push(v), success: (v: string) => successes.push(v) }, fetch: async (url: string, init: RequestInit) => {
      requests++; assert.equal(url, `/api/v1/customer-credits/${raw.id}/apply`); assert.equal(init.method, "POST"); assert.equal((init.headers as Record<string, string>)["x-organization-id"], "org-a");
      assert.deepEqual(JSON.parse(String(init.body)), { invoiceId: invoice.id, amountMinor: "1250" });
      if (mode === "network") throw new Error("secret"); if (mode === "json") return new Response("private HTML");
      return Response.json(mode === "shape" ? null : { customerCredit: { ...updated, amountRemainingMinor: mode === "alias" ? "001" : updated.amountRemainingMinor }, error: "private server prose" }, { status: mode === "denied" ? 403 : 200 });
    } })();
    const unreadable = ["json", "shape", "alias"].includes(mode);
    assert.equal(requests, ["parser", "bounds"].includes(mode) ? 0 : 1);
    assert.deepEqual(successes, mode === "success" ? [t("applySuccess")] : []);
    assert.deepEqual(errors, mode === "success" || unreadable ? [] : [t("applyFailed")]);
    assert.deepEqual(reads, unreadable ? ["updatedReadFailed"] : []);
    assert.deepEqual(balances, unreadable ? [null] : mode === "success" ? [{ ...saved, ...money.customerPrepaymentRow(updated) }] : []);
    assert.deepEqual(busy, [true, false]);
  }
});

test("customer currency resolution keeps org headers and translates failed context without adopting cancelled reads", async () => {
  for (const mode of ["success", "denied", "network", "json", "shape", "cancelled"]) {
    const values: unknown[] = [];
    const cleanup = callback(drawer, "effect", { ...money, open: true, orgId: "org-a", contactId: raw.contactId, setCurrencyContext: (v: unknown) => values.push(v), fetch: async (url: string, init: RequestInit) => {
      assert.equal((init.headers as Record<string, string>)["x-organization-id"], "org-a");
      assert.ok(["/api/v1/contacts/customer-a", "/api/v1/organization"].includes(url));
      if (mode === "network") throw new Error("secret"); if (mode === "json") return new Response("private HTML");
      return Response.json(mode === "shape" ? null : { contact: { currencyCode: "KWD" }, organization: { defaultCurrency: "USD" } }, { status: mode === "denied" ? 403 : 200 });
    } }, 1)();
    if (mode === "cancelled") cleanup(); await flush();
    assert.deepEqual(values, mode === "cancelled" ? [] : [{ orgId: "org-a", contactId: raw.contactId, ...(mode === "success" ? { code: "KWD" } : { error: "currencyReadFailed" }) }]);
    cleanup();
  }
});

test("owned prepayment templates contain no unextracted authored JSX or display attributes", () => {
  for (const path of [list, detail, drawer, "components/dashboard/customer-prepayment-money-details.tsx"]) {
    const ast = parse(path), problems: string[] = [];
    function visit(n: ts.Node) {
      if (path === drawer && ts.isFunctionDeclaration(n) && n.parent === ast && !["CustomerCreditForm", "CustomerCreditDrawer"].includes(n.name?.text ?? "")) return;
      if (ts.isJsxText(n) && /[a-z]/i.test(n.text.replaceAll("&middot;", "").replace(/INV-0042/g, "").trim())) problems.push(n.text.trim());
      if (ts.isJsxAttribute(n) && ["title", "placeholder", "label", "description", "emptyMessage", "aria-label"].includes(n.name.getText(ast)) && n.initializer && ts.isStringLiteral(n.initializer) && /[a-z]/i.test(n.initializer.text)) problems.push(n.getText(ast));
      ts.forEachChild(n, visit);
    }
    visit(ast); assert.deepEqual(problems, [], path);
  }
});
