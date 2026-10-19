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
import * as ErrorState from "../components/dashboard/error-state";
import * as RateNote from "../components/ui/rate-note";
import { InvoiceAmountInput } from "../components/dashboard/invoice-amount-input";
import { billStatusLabel } from "../i18n/bill-presentation";
import * as money from "../lib/money/bill-ui";
import { billLineInputs, billEditorCurrency } from "../lib/money/bill-editor";
import { renderWithPresentation } from "./helpers/presentation";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const list = "app/(dashboard)/purchases/page.tsx";
const detail = "app/(dashboard)/purchases/[id]/page.tsx";
const drawer = "components/dashboard/create-drawer.tsx";
const locales = ["en-US", "fa-IR"] as const;
const noop = () => {};
const caller = "<script>تأمین‌کننده & bill</script>";
const raw = {
  id: "bill-a", billNumber: "BILL-001", contactId: "supplier-a", contact: { name: caller },
  issueDate: "2026-10-18", dueDate: "2026-10-19", status: "received", currencyCode: "USD",
  subtotal: 9007199254740991, subtotalMinor: "9007199254740991", taxTotal: 0, taxTotalMinor: "0",
  total: 9007199254740991, totalMinor: "9007199254740991", amountPaid: 1, amountPaidMinor: "1",
  amountDue: 9007199254740990, amountDueMinor: "9007199254740990", notes: caller, rejectionReason: caller,
  lines: [{ id: "line-a", description: caller, quantity: 100, unitPrice: 9007199254740991, unitPriceMinor: "9007199254740991",
    amount: 9007199254740991, amountMinor: "9007199254740991", taxAmount: 0, taxAmountMinor: "0", account: null,
    goodsReceiptLineId: "receipt-line-a" }],
};
const saved = money.billUiDocument(raw);
function translator(locale: typeof locales[number]) { return createTranslator({ locale, messages: locale === "en-US" ? en : fa, namespace: "SupplierBills" }); }
function escape(value: string) { return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;"); }

function parse(path: string) { return ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX); }
function componentName(path: string) { return path === list ? "BillsPage" : path === detail ? "BillDetailPage" : "BillDrawer"; }

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
    if (id.endsWith("/invoice-amount-input")) return { InvoiceAmountInput };
    if (id === "next/navigation") return { useParams: () => ({ id: raw.id }), useRouter: () => ({ push: noop }) };
    if (id.endsWith("/create-drawer")) return { useCreateDrawer: () => ({ open: noop }) };
    if (id.endsWith("/use-debounce")) return { useDebounce: (value: string) => value };
    if (id.endsWith("/use-confirm")) return { useConfirm: () => ({ confirm: noop, dialog: null }) };
    if (id.endsWith("/use-entity-title")) return { useEntityTitle: noop };
    if (id.endsWith("/data-table")) return DataTable;
    if (id.endsWith("/ui/date-picker")) return DatePicker;
    if (id.endsWith("/error-state")) return ErrorState;
    if (id.endsWith("/ui/rate-note")) return RateNote;
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
    if (path === drawer && ts.isFunctionDeclaration(n) && n.parent === ast && n.name?.text !== "BillDrawer") return;
    if (ts.isFunctionDeclaration(n) && n.name?.text === name) expression = n.getText(ast);
    if (ts.isVariableDeclaration(n) && n.name.getText(ast) === name && n.initializer && ts.isCallExpression(n.initializer)) expression = n.initializer.arguments[0].getText(ast);
    if (name === "effect" && ts.isCallExpression(n) && n.expression.getText(ast) === "useEffect" && index++ === effectIndex) expression = n.arguments[0].getText(ast);
    ts.forEachChild(n, visit);
  }
  visit(ast); assert.ok(expression, name);
  const code = ts.transpileModule(`const run = ${expression};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(scope), `${code}; return run;`)(...Object.values(scope));
}

test("bill production list translates empty/populated/filter states and keeps exact currency groups and sort codes", () => {
  for (const locale of locales) {
    const t = translator(locale);
    const Empty = loaded(list, { loading: false, loadedOrg: "org-a" });
    const empty = renderWithPresentation(createElement(Empty), locale);
    for (const key of ["emptyTitle", "emptyDescription", "newBill", "agingTracking", "agingTrackingHint", "overdueAlerts", "overdueAlertsHint", "paymentMatching", "paymentMatchingHint"] as const) assert.ok(empty.includes(escape(t(key))), key);
    const bills = [saved, { ...saved, id: "bill-b", currencyCode: "KWD", total: 1n, amountDue: 1n, status: "future_code" }];
    const countsData = { total: 2, counts: { received: { count: 1 }, paid: { count: 1 } }, currencies: [{ currencyCode: "USD", outstanding: 9007199254740990n, overdue: 0n }, { currencyCode: "KWD", outstanding: 1n, overdue: 0n }] };
    const Page = loaded(list, { loading: false, loadedOrg: "org-a", bills, allBills: bills, countsData, dateFrom: "2026-10-01" });
    const html = renderWithPresentation(createElement(Page), locale);
    for (const key of ["title", "description", "outstanding", "paid", "overdue", "number", "supplier", "date", "due", "status", "total", "balance", "clearDates", "search", "endDate", "newest", "oldest", "dueSoonest", "dueLatest", "highestAmount", "lowestAmount", "highestBalance", "numberDesc", "numberAsc", "current", "daysOneThirty", "daysThirtySixty", "daysSixtyPlus"] as const) assert.ok(html.includes(escape(t(key))), key);
    assert.ok(html.includes(escape(t("aging", { currency: "USD" }))));
    assert.ok(html.includes(escape(t("allTab", { count: 2 }))) && html.includes(escape(t("receivedTab", { count: 1 }))));
    assert.ok(html.includes("90,071,992,547,409.90") && html.includes("0.001"));
    assert.ok(html.includes(escape(caller)) && !html.includes("<script>") && html.includes("future_code"));
    for (const code of ["created:desc", "created:asc", "due:asc", "due:desc", "total:desc", "total:asc", "amountDue:desc", "number:desc", "number:asc"]) assert.ok(html.includes(`data-option="${code}"`));
    const Filtered = loaded(list, { loading: false, loadedOrg: "org-a", search: "missing" });
    assert.ok(renderWithPresentation(createElement(Filtered), locale).includes(escape(t("noMatches"))));
    const Failed = loaded(list, { loading: false, loadedOrg: "org-a", moneyError: t("listFailed"), overviewError: t("overviewFailed") });
    const failed = renderWithPresentation(createElement(Failed), locale);
    assert.ok(failed.includes('role="alert"') && failed.includes(escape(t("listFailed"))) && failed.includes(escape(t("overviewFailed"))));
  }
});

test("bill production detail renders lifecycle dialogs, delivery links, escaped content and exact amounts in both locales", () => {
  for (const locale of locales) {
    const t = translator(locale);
    for (const status of ["draft", "pending_approval", "received", "partial", "paid", "overdue", "void", "__proto__"]) {
      const Page = loaded(detail, { b: { ...saved, status }, loading: false, loadedContext: "org-a:bill-a", payAmount: "90071992547409.91" });
      const html = renderWithPresentation(createElement(Page), locale);
      for (const key of ["statement", "statementHint", "from", "bill", "issued", "due", "lineDescription", "quantity", "price", "subtotal", "total", "paymentStatus", "paid", "details", "lastRejection", "notes", "orderMatch", "orderMatchHint", "matched", "supplierDocuments", "attachLabel"] as const) assert.ok(html.includes(escape(t(key))), `${status}: ${key}`);
      assert.ok(html.includes(escape(billStatusLabel(status, t))) && html.includes(escape(caller)) && !html.includes("<script>"));
      assert.ok(html.includes('href="/contacts/supplier-a/statement"') && html.includes("90,071,992,547,409.91"));
      if (status === "pending_approval") for (const key of ["approve", "reject", "rejectTitle", "rejectDescription", "reason", "reasonPlaceholder", "rejectBill"] as const) assert.ok(html.includes(escape(t(key))), key);
      if (status === "draft") assert.ok(html.includes(escape(t("addToBooks"))));
      if (["received", "partial", "overdue"].includes(status)) {
        assert.ok(html.includes(escape(t("recordPayment"))) && html.includes(escape(t("paymentTooHigh"))));
        assert.match(html, /aria-label="[^"]*USD[^"]*"/);
        assert.match(html, /<button(?=[^>]*disabled="")[^>]*>/);
      }
    }
    const Missing = loaded(detail, { loading: false, loadedContext: "org-a:bill-a" });
    assert.ok(renderWithPresentation(createElement(Missing), locale).includes(escape(t("notFound"))));
    const Failed = loaded(detail, { loading: false, loadedContext: "org-a:bill-a", moneyError: t("detailFailed") });
    assert.ok(renderWithPresentation(createElement(Failed), locale).includes(escape(t("detailFailed"))));
    const Base = loaded(detail, { loading: false, loadedContext: "org-a:bill-a", b: { ...saved, notes: null, contact: null, lines: [{ ...saved.lines[0], goodsReceiptLineId: "receipt-a" }, { ...saved.lines[0], id: "line-b", goodsReceiptLineId: null }] }, base: { baseCurrency: "KWD", amounts: { total: 1n, amountDue: null } } });
    const baseHtml = renderWithPresentation(createElement(Base), locale);
    for (const key of ["unknownSupplier", "noNotes", "notOnOrder"] as const) assert.ok(baseHtml.includes(escape(t(key))), key);
    assert.ok(baseHtml.includes(escape(t("inCurrency", { currency: "KWD" }))) && baseHtml.includes("0.001"));
  }
});

test("bill creation drawer translates duplicate/approval/currency controls and shared footer", () => {
  for (const locale of locales) {
    const t = translator(locale);
    const Drawer = loaded(drawer, { contactId: "supplier-a", currencyContext: { orgId: "org-a", contactId: "supplier-a", error: t("currencyFailed") }, duplicateBillNumber: caller, notes: caller, issueDate: "", dueDate: "", forApproval: true });
    const html = renderWithPresentation(createElement(Drawer, { open: true, onClose: noop }), locale);
    for (const key of ["newBill", "drawerDescription", "billDetails", "supplierRequired", "supplierBillNumber", "numberPlaceholder", "reference", "referencePlaceholder", "currency", "issueDate", "dueDate", "forApproval", "forApprovalHint", "duplicateHint", "createAnyway", "goBack", "lineItems", "notes", "notesPlaceholder", "createBill", "currencyFailed"] as const) assert.ok(html.includes(escape(t(key))), key);
    assert.ok(html.includes(escape(t("duplicate", { number: caller }))) && !html.includes("<script>"));
    assert.match(html, /type="checkbox"[^>]*checked=""/);
    const forms = createTranslator({ locale, messages: locale === "en-US" ? en : fa, namespace: "DocumentForms" });
    assert.ok(html.includes(escape(forms("cancel"))));
    const Busy = loaded(drawer, { saving: true, duplicateBillNumber: "BILL-A" });
    assert.ok(renderWithPresentation(createElement(Busy, { open: true, onClose: noop }), locale).includes(escape(t("creating"))));
  }
});

test("bill payment and lifecycle callbacks preserve org scope, canonical payloads and localized HTTP/network failures", async () => {
  for (const locale of locales) for (const name of ["handleReceive", "handleApprove", "handleReject", "handlePay", "handleVoid", "handleSupplierCredit"]) for (const mode of ["success", "status", "network"]) {
    const t = translator(locale), messages: string[] = [], busy: boolean[] = [], requests: unknown[] = [];
    const routes = { handleReceive: "receive", handleApprove: "approve", handleReject: "reject", handlePay: "pay", handleVoid: "void", handleSupplierCredit: "credit" };
    const route = routes[name as keyof typeof routes];
    const successKeys = { receive: "receivedSuccess", approve: "approvedSuccess", reject: "rejectedSuccess", pay: "paymentSuccess", void: "cancelledSuccess", credit: "creditSuccess" } as const;
    const failKeys = { receive: "receiveFailed", approve: "approveFailed", reject: "rejectFailed", pay: "paymentFailed", void: "cancelFailed", credit: "creditFailed" } as const;
    const scope = { t, orgId: "org-a", id: raw.id, b: saved, loadedContext: "org-a:bill-a", context: "org-a:bill-a", paying: false,
      payAmount: "90071992547409.90", payDate: "2026-10-19", rejectReason: "  دلیل  ",
      billUiPaymentAmount: money.billUiPaymentAmount, billUiSupplierCreditLines: money.billUiSupplierCreditLines,
      toast: { success: (v: string) => messages.push(v), error: (v: string) => messages.push(v) },
      confirm: async (options: { title: string }) => { assert.ok(options.title === t("cancelTitle") || options.title === t("creditTitle")); return true; },
      setApproving: (v: boolean) => busy.push(v), setRejecting: (v: boolean) => busy.push(v), setPaying: (v: boolean) => busy.push(v), setCreditingSupplier: (v: boolean) => busy.push(v),
      setRejectOpen: noop, setRejectReason: noop, setPayOpen: noop, loadBill: noop, router: { push: (url: string) => assert.equal(url, "/purchases") },
      fetch: async (url: string, init: RequestInit) => {
        assert.equal(url, route === "credit" ? "/api/v1/debit-notes" : `/api/v1/bills/bill-a/${route}`);
        assert.equal(init.method, "POST"); assert.equal((init.headers as Record<string, string>)["x-organization-id"], "org-a");
        const body = init.body ? JSON.parse(String(init.body)) : undefined; requests.push(body);
        if (route === "pay") assert.deepEqual(body, { amountMinor: "9007199254740990", date: "2026-10-19" });
        if (route === "reject") assert.deepEqual(body, { reason: "دلیل" });
        if (route === "credit") { assert.equal(body.billId, raw.id); assert.equal(body.contactId, raw.contactId); assert.equal(body.currencyCode, "USD"); assert.deepEqual(body.lines, money.billUiSupplierCreditLines(saved.lines, "USD")); }
        if (mode === "network") throw new Error("private server prose");
        return new Response("private HTML", { status: mode === "status" ? 409 : 200 });
      } };
    await callback(detail, name, scope)();
    assert.equal(requests.length, 1);
    const key = mode === "success" ? successKeys[route as keyof typeof successKeys] : mode === "network" && route === "pay" ? "paymentRetry" : failKeys[route as keyof typeof failKeys];
    assert.deepEqual(messages, [t(key)]);
    if (["approve", "reject", "pay", "credit"].includes(route)) assert.deepEqual(busy, [true, false]);
  }
  const t = translator("fa-IR");
  await callback(detail, "handlePay", { t, orgId: "org-a", b: saved, context: "org-a:bill-a", loadedContext: "org-a:bill-a", paying: false,
    payAmount: "90071992547409.91", billUiPaymentAmount: money.billUiPaymentAmount,
    toast: { error: (message: string) => assert.equal(message, t("invalidPayment")) }, fetch: () => assert.fail("overpayment must not fetch") })();
  for (const name of ["handleReceive", "handleApprove", "handleReject", "handlePay", "handleVoid", "handleSupplierCredit"]) await callback(detail, name, { orgId: null, fetch: () => assert.fail("missing org must not fetch") })();
});

test("bill creation callbacks preserve exact line/approval/duplicate semantics and hide unknown failures", async () => {
  for (const locale of locales) for (const mode of ["success", "approval", "duplicate", "hardDuplicate", "html", "network", "shape", "invalidLines"]) {
    const t = translator(locale), messages: string[] = [], busy: boolean[] = [], duplicates: unknown[] = [], pushes: string[] = [];
    const lines = [{ description: caller, quantity: "1", unitPrice: mode === "invalidLines" ? "1x" : "90071992547409.91", accountId: "00000000-0000-4000-8000-000000000001", taxRateId: "" }];
    await callback(drawer, "submitBill", { t, contactId: "supplier-a", orgId: "org-a", currencyCode: "USD", validLines: true,
      lines, billLineInputs, issueDate: "2026-10-18", dueDate: "2026-10-19", billNumber: " BILL-A ", reference: caller, notes: caller, forApproval: mode === "approval",
      setSaving: (v: boolean) => busy.push(v), setDuplicateBillNumber: (v: unknown) => duplicates.push(v), onClose: noop,
      toast: { success: (v: string) => messages.push(v), error: (v: string) => messages.push(v) }, router: { push: (v: string) => pushes.push(v) },
      fetch: async (url: string, init: RequestInit) => {
        assert.equal(url, "/api/v1/bills"); assert.equal(init.method, "POST");
        assert.equal((init.headers as Record<string, string>)["x-organization-id"], "org-a");
        const body = JSON.parse(String(init.body));
        assert.deepEqual(body, { contactId: "supplier-a", issueDate: "2026-10-18", dueDate: "2026-10-19", currencyCode: "USD", billNumber: "BILL-A", reference: caller, notes: caller,
          ...(mode === "approval" ? { submitForApproval: true, confirmDuplicate: true } : {}), lines: billLineInputs(lines) });
        if (mode === "network") throw new Error("private server prose");
        if (mode === "html") return new Response("private HTML", { status: 500 });
        return Response.json(mode === "shape" ? {} : ["duplicate", "hardDuplicate"].includes(mode) ? { warning: mode === "duplicate" ? "duplicate_bill" : undefined, duplicate: { billNumber: caller }, error: "private server prose" } : { bill: { id: "new-bill", status: mode === "approval" ? "pending_approval" : "draft" } }, { status: ["duplicate", "hardDuplicate"].includes(mode) ? 409 : 200 });
      } })(mode === "approval");
    assert.deepEqual(duplicates, mode === "duplicate" ? [caller] : []);
    assert.deepEqual(messages, mode === "duplicate" ? [] : [t(mode === "success" ? "created" : mode === "approval" ? "savedForApproval" : "createFailed")]);
    assert.deepEqual(pushes, ["success", "approval"].includes(mode) ? ["/purchases/new-bill"] : []);
    assert.equal(busy.at(-1), false);
  }
});

test("bill currency and detail read effects localize invalid JSON/money/network and abort stale state", async () => {
  for (const locale of locales) for (const mode of ["success", "status", "html", "network", "alias", "stale"]) {
    const t = translator(locale), errors: string[] = [], writes: unknown[] = [];
    const scope = { t, orgId: "org-a", id: raw.id, context: "org-a:bill-a", billUiDocument: money.billUiDocument, billUiBase: money.billUiBase,
      setLoading: noop, setB: (v: unknown) => { if (v !== null) writes.push(v); }, setBase: noop, setMoneyError: (v: string) => { if (v) errors.push(v); }, setPayOpen: noop, setPayAmount: noop, setLoadedContext: noop,
      fetch: async (url: string, init: RequestInit) => {
        assert.equal(url, "/api/v1/bills/bill-a"); assert.equal((init.headers as Record<string, string>)["x-organization-id"], "org-a");
        if (mode === "network") throw new Error("private server prose");
        if (mode === "html") return new Response("private HTML");
        return Response.json({ bill: { ...raw, totalMinor: mode === "alias" ? "09007199254740991" : raw.totalMinor } }, { status: mode === "status" ? 403 : 200 });
      } };
    const cleanup = callback(detail, "effect", scope)();
    if (mode === "stale") cleanup();
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(writes, mode === "success" ? [saved] : []);
    assert.deepEqual(errors, ["success", "stale"].includes(mode) ? [] : [t("detailFailed")]);
    cleanup();
    const contexts: unknown[] = [];
    const currencyCleanup = callback(drawer, "effect", { t, open: true, orgId: "org-a", contactId: "supplier-a", billEditorCurrency,
      setCurrencyContext: (v: unknown) => contexts.push(v),
      fetch: async (url: string) => {
        if (mode === "network") throw new Error("private");
        if (mode === "html") return new Response("private");
        return Response.json(url.includes("contacts") ? { contact: { currencyCode: mode === "alias" ? "bad" : "KWD" } } : { organization: { defaultCurrency: "USD" } }, { status: mode === "status" ? 403 : 200 });
      } }, 1)();
    if (mode === "stale") currencyCleanup();
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(contexts, mode === "stale" ? [] : [{ orgId: "org-a", contactId: "supplier-a", ...(mode === "success" ? { code: "KWD" } : { error: t("currencyFailed") }) }]);
    currencyCleanup();
  }
});

test("bill list reads, pagination, overview and filters preserve machine values and localize failures", async () => {
  for (const locale of locales) for (const mode of ["success", "status", "html", "network", "alias", "stale"]) for (const kind of ["list", "more", "overview"]) {
    const t = translator(locale), errors: string[] = [], writes: unknown[] = [], generation = { current: 1 };
    const buildParams = (page: number) => new URLSearchParams({ status: "received", sortBy: "amountDue", sortOrder: "asc", from: "2026-10-01", to: "2026-10-31", search: caller, page: String(page), limit: "50" });
    const scope = { t, orgId: "org-a", page: 1, loading: false, loadingMore: false, refetching: false, moneyError: "", hasMore: true,
      requestGeneration: generation, buildParams, billUiList: money.billUiList, billUiCounts: money.billUiCounts, billUiAging: money.billUiAging, devDelay: async () => {},
      setCountsData: (v: unknown) => { if (v) writes.push(v); }, setAllBills: (v: unknown[]) => { if (v.length) writes.push(v); },
      setBills: (v: unknown) => { if (typeof v === "function") writes.push(v([])); else if (Array.isArray(v) && v.length) writes.push(v); },
      setMoneyError: (v: string) => { if (v) errors.push(v); }, setOverviewError: (v: string) => { if (v) errors.push(v); },
      setListTotal: noop, setLoadingMore: noop, setPage: noop, setHasMore: noop, setRefetching: noop, setLoadedOrg: noop, setLoading: noop, setFetchKey: noop,
      fetch: async (url: string, init: RequestInit) => {
        assert.equal((init.headers as Record<string, string>)["x-organization-id"], "org-a");
        if (kind !== "overview") assert.equal(url, `/api/v1/bills?${buildParams(kind === "more" ? 2 : 1)}`);
        if (mode === "stale" && kind === "more") generation.current++;
        if (mode === "network") throw new Error("private");
        if (mode === "html") return new Response("private");
        const row = { ...raw, amountDueMinor: mode === "alias" ? "09007199254740990" : raw.amountDueMinor };
        return Response.json(url.endsWith("/counts") ? { counts: { received: { count: 1, amount: row.amountDue, amountMinor: row.amountDueMinor, currencyCode: "USD" } }, total: 1 } : { data: [row], pagination: { page: kind === "more" ? 2 : 1, totalPages: 2, total: 2 } }, { status: mode === "status" ? 403 : 200 });
      } };
    const cleanup = callback(list, kind === "more" ? "loadMore" : "effect", scope, kind === "overview" ? 0 : 1)();
    if (mode === "stale" && kind !== "more") cleanup();
    await new Promise(resolve => setImmediate(resolve));
    if (mode === "success") { assert.equal(errors.length, 0); assert.equal(writes.length, kind === "overview" ? 2 : 1); }
    else if (mode === "stale") { assert.deepEqual(writes, []); assert.deepEqual(errors, []); }
    else { assert.deepEqual(writes, []); assert.deepEqual(errors.sort(), (kind === "overview" ? [t("overviewFailed"), t("agingFailed")] : [t(kind === "more" ? "moreFailed" : "listFailed")]).sort()); }
    if (kind !== "more") cleanup();
  }
  const params = callback(list, "buildParams", { statusFilter: "received", debouncedSearch: caller, sortBy: "amountDue", sortOrder: "asc", dateFrom: "2026-10-01", dateTo: "2026-10-31" })(3);
  assert.deepEqual(Object.fromEntries(params), { status: "received", search: caller, sortBy: "amountDue", sortOrder: "asc", from: "2026-10-01", to: "2026-10-31", page: "3", limit: "50" });
});

test("bill catalog source inventory has no authored English JSX/attributes and finite statuses preserve future codes", () => {
  for (const path of [list, detail, drawer]) {
    const ast = parse(path);
    function visit(node: ts.Node) {
      if (path === drawer && ts.isFunctionDeclaration(node) && node.parent === ast && node.name?.text !== "BillDrawer") return;
      if (ts.isJsxText(node)) assert.doesNotMatch(node.text.trim(), /[A-Za-z]/, `${path}: ${node.text}`);
      if (ts.isJsxAttribute(node) && ["title", "label", "description", "placeholder", "aria-label", "emptyMessage"].includes(node.name.getText(ast)) && node.initializer && ts.isStringLiteral(node.initializer)) assert.doesNotMatch(node.initializer.text, /[A-Za-z]/, `${path}: ${node.getText(ast)}`);
      ts.forEachChild(node, visit);
    }
    visit(ast);
  }
  for (const locale of locales) {
    const t = translator(locale);
    for (const status of ["draft", "pending_approval", "received", "partial", "paid", "overdue", "void"]) assert.notEqual(billStatusLabel(status, t), "");
    for (const status of ["__proto__", "constructor", "future_code"]) assert.equal(billStatusLabel(status, t), status);
    for (const count of [0, 1, 2, 3.5]) for (const key of ["dueIn", "daysOverdue", "days"] as const) assert.ok(t(key, { count }));
  }
  for (const value of Object.values(fa.SupplierBills)) assert.match(value, /[\u0600-\u06ff]/);
});
