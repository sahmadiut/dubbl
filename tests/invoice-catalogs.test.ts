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
import { invoiceStatusLabel, invoiceMethodLabel, invoiceCreditLabel, invoiceComplianceLabel } from "../i18n/invoice-presentation";
import * as money from "../lib/money/invoice-ui";
import { documentLineInputs, invoiceEditorCurrency } from "../lib/money/document-editor";
import { checkInvoiceCompliance } from "../lib/documents/compliance";
import { renderWithPresentation } from "./helpers/presentation";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const list = "app/(dashboard)/sales/page.tsx";
const detail = "app/(dashboard)/sales/[id]/page.tsx";
const drawer = "components/dashboard/create-drawer.tsx";
const locales = ["en-US", "fa-IR"] as const;
const noop = () => {};
const caller = "<script>مشتری & invoice</script>";
const raw = {
  id: "invoice-a", invoiceNumber: "INV-001", contactId: "customer-a", contact: { name: caller, email: caller },
  issueDate: "2026-10-18", dueDate: "2026-10-19", status: "sent", invoiceType: "deposit", depositPercent: 2500, dunningLevel: 2,
  subtotal: 9007199254740991, subtotalMinor: "9007199254740991", taxTotal: 0, taxTotalMinor: "0", total: 9007199254740991, totalMinor: "9007199254740991",
  amountPaid: 1, amountPaidMinor: "1", amountDue: 9007199254740990, amountDueMinor: "9007199254740990", currencyCode: "USD", reference: caller, notes: caller,
  lines: [{ id: "line-a", description: caller, quantity: 100, unitPrice: 9007199254740991, unitPriceMinor: "9007199254740991", amount: 9007199254740991, amountMinor: "9007199254740991", taxAmount: 0, taxAmountMinor: "0", account: null, taxRate: null }],
};
const saved = money.invoiceUiDocument(raw);
const credit = { id: "credit-a", date: "2026-10-18", currencyCode: "USD", originalAmount: 29n, amountRemaining: 29n, sourceType: "prepayment", notes: caller };
const payment = { id: "p-a", paymentNumber: "PMT-001", date: "2026-10-18", amount: 1n, currencyCode: "USD", method: "bank_transfer", contact: { name: caller } };
function translator(locale: typeof locales[number]) { return createTranslator({ locale, messages: locale === "en-US" ? en : fa, namespace: "SalesInvoices" }); }
function escape(value: string) { return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;"); }

function parse(path: string) { return ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX); }
function componentName(path: string) { return path === list ? "InvoicesPage" : path === detail ? "InvoiceDetailPage" : "InvoiceDrawer"; }

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
    if (path === drawer && ts.isFunctionDeclaration(n) && n.parent === ast && n.name?.text !== "InvoiceDrawer") return;
    if (ts.isFunctionDeclaration(n) && n.name?.text === name) expression = n.getText(ast);
    if (ts.isVariableDeclaration(n) && n.name.getText(ast) === name && n.initializer && ts.isCallExpression(n.initializer)) expression = n.initializer.arguments[0].getText(ast);
    if (name === "effect" && ts.isCallExpression(n) && n.expression.getText(ast) === "useEffect" && index++ === effectIndex) expression = n.arguments[0].getText(ast);
    ts.forEachChild(n, visit);
  }
  visit(ast); assert.ok(expression, name);
  const code = ts.transpileModule(`const run = ${expression};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(scope), `${code}; return run;`)(...Object.values(scope));
}

test("invoice list renders real bilingual empty, filtered, selected, summary and exact money states", () => {
  for (const locale of locales) {
    const t = translator(locale), Empty = loaded(list, { initialLoad: false });
    const empty = renderWithPresentation(createElement(Empty), locale);
    for (const key of ["newInvoice", "createStep", "createHint", "sendHint", "getPaid", "paidHint", "emptyTitle", "emptyDescription", "paidMonth"] as const) assert.ok(empty.includes(escape(t(key))), key);
    const Page = loaded(list, { initialLoad: false, invoices: [saved], payments: [payment], selectedIds: new Set([raw.id]), totalCount: 1, summary: { totalCount: 1, currencyCode: "USD", outstanding: 9007199254740990n, overdue: 0n, aging: { current: { amount: 9007199254740990n, count: 1 } } } });
    const html = renderWithPresentation(createElement(Page), locale);
    for (const key of ["outstanding", "overdue", "totalInvoices", "aging", "recentPayments", "viewAll", "all", "draftTab", "partialTab", "sentTab", "paidTab", "search", "startDate", "endDate", "newest", "dueSoonest", "highestBalance", "number", "customer", "date", "due", "status", "balance", "sendReminder", "markSent", "clear", "selectAll"] as const) assert.ok(html.includes(escape(t(key))), key);
    assert.ok(html.includes(escape(t("selectInvoice", { number: raw.invoiceNumber }))));
    assert.ok(html.includes(escape(t("showing", { shown: 1, count: 1 }))) && html.includes(escape(t("selected", { count: 1 }))));
    assert.ok(html.includes("90,071,992,547,409.91") && html.includes("90,071,992,547,409.90"));
    assert.ok(html.includes(escape(caller)) && !html.includes("<script>"));
    for (const code of ["created:desc", "created:asc", "due:asc", "due:desc", "total:desc", "total:asc", "amountDue:desc", "number:desc", "number:asc"]) assert.ok(html.includes(`data-option="${code}"`));
    const Filtered = loaded(list, { initialLoad: false, invoices: [saved], search: "missing" });
    const filtered = renderWithPresentation(createElement(Filtered), locale);
    assert.ok(filtered.includes(escape(t("noMatches"))) && filtered.includes(escape(t("clearFilters"))));
    const Failed = loaded(list, { initialLoad: false, error: t("readFailed") });
    assert.ok(renderWithPresentation(createElement(Failed), locale).includes(escape(t("readFailed"))));
  }
});

test("invoice detail renders lifecycle dialogs, snapshots, credits, warnings and exact signed/foreign values", () => {
  for (const locale of locales) {
    const t = translator(locale);
    for (const status of ["sent", "draft", "pending_approval", "paid", "void"]) {
      const Page = loaded(detail, { inv: { ...saved, status }, payDate: "", loading: false, loadedContext: "org-a:invoice-a", payments: [payment], credits: [credit], creditContext: "org-a:invoice-a", senderSnapshot: { name: caller, taxId: caller, registrationNumber: caller }, recipientSnapshot: { name: caller, taxNumber: caller }, complianceWarnings: [{ message: "Organization name is required", field: "org.name", severity: "error" }], base: { baseCurrency: "KWD", amounts: { total: 1250n, amountDue: 1250n } } });
      const html = renderWithPresentation(createElement(Page), locale);
      for (const key of ["back", "downloadPdf", "duplicate", "depositInvoice", "billTo", "invoice", "issued", "description", "qty", "price", "noTax", "subtotal", "total", "attachments", "attachmentDescription", "addFile", "paymentStatus", "details", "reference", "notes", "dates", "paymentHistory", "bankTransfer", "complianceTitle", "dismiss"] as const) assert.ok(html.includes(escape(t(key))), `${status}: ${key}`);
      assert.ok(html.includes(escape(t("remindersSent", { count: 2 }))));
      assert.ok(html.includes(escape(t("compliance1"))) && html.includes(escape(t("inCurrency", { currency: "KWD" }))));
      assert.ok(html.includes("90,071,992,547,409.91") && html.includes("1.250"));
      assert.ok(html.includes(escape(caller)) && !html.includes("<script>"));
      if (status === "sent") for (const key of ["recordPayment", "paymentDate", "bankTransfer", "cash", "check", "card", "other", "interestTitle", "interestDescription", "customAmount", "writeOff", "badDebt", "availableCredit", "creditDescription", "prepayment"] as const) assert.ok(html.includes(escape(t(key))), key);
      if (status === "draft") assert.ok(html.includes(escape(t("submit"))) && html.includes(escape(t("send"))));
      if (status === "pending_approval") for (const key of ["approve", "reject", "rejectTitle", "rejectDescription", "reason", "reasonPlaceholder", "rejectInvoice"] as const) assert.ok(html.includes(escape(t(key))), key);
      if (status !== "draft") for (const key of ["documentDetails", "editDocument", "sender", "recipient", "name", "address", "email", "phone", "registrationNumber", "taxId", "taxNumber", "cancel", "save"] as const) assert.ok(html.includes(escape(t(key))), key);
    }
    for (const [states, key] of [[{}, "loading"], [{ loading: false, loadedContext: "org-a:invoice-a" }, "notFound"], [{ loading: false, loadedContext: "org-a:invoice-a", moneyError: t("detailReadFailed") }, "detailReadFailed"]] as const) {
      const Page = loaded(detail, states); assert.ok(renderWithPresentation(createElement(Page), locale).includes(escape(t(key))));
    }
    for (const currency of ["USD", "JPY", "KWD"]) {
      const html = renderWithPresentation(createElement(InvoiceAmountInput, { currency, value: "-1", onChange: noop, label: t("amountLabel", { currency }), invalidMessage: t("amountInvalid", { currency }) }), locale);
      assert.ok(html.includes(escape(t("amountLabel", { currency }))) && html.includes(escape(t("amountInvalid", { currency }))));
      assert.ok(html.includes('role="alert"') && html.includes('aria-invalid="true"'));
    }
  }
});

test("invoice drawer renders bilingual own labels while shared forms retain their task boundary", () => {
  for (const locale of locales) {
    const t = translator(locale), Page = loaded(drawer, { isDepositRetainer: true, selectedCurrency: "KWD", contactId: "customer-a", validLines: true });
    const html = renderWithPresentation(createElement(Page, { open: true, onClose: noop }), locale);
    for (const key of ["newInvoice", "drawerDescription", "invoiceDetails", "customerRequired", "reference", "referencePlaceholder", "invoiceCurrency", "issueDate", "dueDate", "depositToggle", "depositDescription", "invoiceType", "deposit", "retainer", "depositPercent", "percentPlaceholder", "approvalToggle", "approvalDescription", "lineItems", "notes", "notesPlaceholder", "createInvoice"] as const) assert.ok(html.includes(escape(t(key))), key);
    assert.ok(html.includes('data-option="deposit"') && html.includes('data-option="retainer"'));
  }
});

test("finite display maps, compliance message coverage, plural counts and Persian script remain safe", () => {
  for (const locale of locales) {
    const t = translator(locale);
    for (const code of ["future_code", "__proto__", "constructor"]) for (const label of [invoiceStatusLabel, invoiceMethodLabel, invoiceCreditLabel]) assert.equal(label(t, code), code);
    assert.equal(invoiceComplianceLabel(t, "secret unreviewed prose"), t("complianceUnknown"));
    const service = readFileSync("lib/documents/compliance.ts", "utf8");
    for (const [, message] of service.matchAll(/message: "([^"]+)"/g)) assert.notEqual(invoiceComplianceLabel(t, message), t("complianceUnknown"));
    for (const countryCode of ["US", "IR", "DE", "FR", "GB", "IN", "SG", "SA", "JP", "BR", "AU", "NZ", "CA"]) for (const warning of checkInvoiceCompliance({ countryCode }, {}, {})) assert.notEqual(invoiceComplianceLabel(t, warning.message), t("complianceUnknown"));
    for (const count of [0, 1, 2]) for (const key of ["showing", "invoicesSent", "remindersSent"] as const) assert.ok(t(key, { count, shown: count }).length);
    if (locale === "en-US") { assert.equal(t("remindersSent", { count: 1 }), "1 reminder sent"); assert.equal(t("remindersSent", { count: 2 }), "2 reminders sent"); }
  }
  for (const [key, value] of Object.entries(fa.SalesInvoices)) if (key !== "summarySeparator") assert.match(value, /[\u0600-\u06ff]/, key);
});

test("production payment and credit callbacks preserve canonical amounts/org scope and translate failures", async () => {
  for (const locale of locales) for (const currency of ["USD", "JPY", "KWD"]) for (const operation of ["pay", "credit"]) for (const mode of ["success", "denied", "network", "malformed", "invalid"]) {
    const t = translator(locale), errors: string[] = [], success: string[] = [], busy: unknown[] = [], cleared: unknown[] = [], requests: string[] = [];
    const amount = currency === "USD" ? "90071992547409.91" : currency === "JPY" ? "1250" : "1.250";
    const inv = { ...saved, currencyCode: currency, amountDue: 9007199254740990n };
    const selectedCredit = { ...credit, currencyCode: mode === "invalid" ? "EUR" : currency, amountRemaining: 29n };
    const fetch = async (url: string, init: RequestInit) => {
      requests.push(url); assert.equal(init.method, "POST"); assert.equal((init.headers as Record<string, string>)["x-organization-id"], "org-a");
      const body = JSON.parse(String(init.body));
      if (operation === "pay") assert.deepEqual(body, { amountMinor: currency === "USD" ? "9007199254740991" : "1250", date: "2026-10-18", method: "bank_transfer", bankAccountId: null });
      else assert.deepEqual(body, { invoiceId: raw.id, amountMinor: "29" });
      if (mode === "network") throw new Error("secret server prose");
      return mode === "malformed" && operation === "pay" ? Response.json({ invoice: { ...raw, totalMinor: "01" } }) : Response.json({ invoice: raw, error: "secret server prose" }, { status: mode === "denied" ? 403 : 200 });
    };
    const run = callback(detail, operation === "pay" ? "handlePay" : "handleApplyCredit", { ...money, t, orgId: "org-a", id: raw.id, inv, payAmount: mode === "invalid" ? "1e2" : amount, payDate: "2026-10-18", payMethod: "bank_transfer", payBankAccountId: "", setPayLoading: (v: unknown) => busy.push(v), setApplyingCreditId: (v: unknown) => busy.push(v), setPayOpen: (v: unknown) => cleared.push(v), setPayAmount: (v: unknown) => cleared.push(v), refetchInvoice: async () => {}, formatMoney: money.invoiceUiMoney, toast: { error: (v: string) => errors.push(v), success: (v: string) => success.push(v) }, fetch });
    await run(selectedCredit);
    const failed = mode === "denied" || mode === "network" || mode === "invalid" || mode === "malformed" && operation === "pay";
    assert.equal(success.length, failed ? 0 : 1); assert.equal(errors.length, failed ? 1 : 0);
    assert.ok(!errors.join().includes("secret"));
    if (mode === "invalid") { assert.equal(requests.length, 0); assert.equal(busy.length, 0); }
    else { assert.equal(requests[0], operation === "pay" ? `/api/v1/invoices/${raw.id}/pay` : `/api/v1/customer-credits/${credit.id}/apply`); assert.equal(busy.at(-1), operation === "pay" ? false : null); }
    if (operation === "pay") assert.deepEqual(cleared, failed ? [] : [false, ""]);
  }
});

test("actual lifecycle and confirmation callbacks keep operation payloads, localize denial/network and reset busy states", async () => {
  const operations = [
    ["handleApprove", "approve", "approveFailed", "setApproving"], ["handleReject", "reject", "rejectFailed", "setRejecting"],
    ["handleSubmitForApproval", "submit-for-approval", "submitFailed", "setSubmitting"], ["handleVoid", "void", "voidFailed", ""],
    ["handleWriteOff", "write-off", "writeOffFailed", ""], ["handleChargeInterest", "charge-interest", "lateFeeFailed", "setInterestLoading"],
  ] as const;
  for (const locale of locales) for (const [name, path, key, setter] of operations) for (const mode of ["success", "denied", "network"]) {
    const t = translator(locale), errors: string[] = [], success: string[] = [], busy: boolean[] = [], confirmations: Record<string, unknown>[] = [];
    const run = callback(detail, name, { ...money, t, orgId: "org-a", id: raw.id, inv: saved, rejectReason: " reason ", interestAmount: "0.29", ...(setter ? { [setter]: (v: boolean) => busy.push(v) } : {}), setRejectOpen: noop, setRejectReason: noop, setInterestOpen: noop, setInterestAmount: noop, refetchInvoice: async () => {}, toast: { error: (v: string) => errors.push(v), success: (v: string) => success.push(v) }, confirm: async (options: Record<string, unknown>) => { confirmations.push(options); await (options.onConfirm as () => Promise<void>)(); }, fetch: async (url: string, init: RequestInit) => {
      assert.equal(url, `/api/v1/invoices/${raw.id}/${path}`); assert.equal(init.method, "POST"); assert.equal((init.headers as Record<string, string>)["x-organization-id"], "org-a");
      if (path === "reject") assert.deepEqual(JSON.parse(String(init.body)), { reason: "reason" });
      else if (path === "charge-interest") assert.deepEqual(JSON.parse(String(init.body)), { amountMinor: "29" });
      else assert.equal(init.body, undefined);
      if (mode === "network") throw new Error("secret");
      return Response.json({ invoice: raw, error: "secret" }, { status: mode === "denied" ? 403 : 200 });
    } });
    await run(); assert.deepEqual(errors, mode === "success" ? [] : [t(key)]); assert.equal(success.length, mode === "success" ? 1 : 0);
    if (setter) assert.deepEqual(busy, [true, false]);
    if (name === "handleVoid" || name === "handleWriteOff") assert.equal(confirmations[0].destructive, true);
  }
});

test("bulk callbacks preserve machine action/IDs and use ICU summaries without raw service prose", async () => {
  for (const locale of locales) for (const action of ["send-reminder", "mark-as-sent"]) for (const mode of ["success", "denied", "network", "shape"]) {
    const t = translator(locale), errors: string[] = [], successes: string[] = [], busy: boolean[] = []; let refreshed = 0;
    const run = callback(list, "runBulkAction", { t, orgId: "org-a", bulkRunning: false, setBulkRunning: (v: boolean) => busy.push(v), clearSelection: noop, refreshList: () => refreshed++, toast: { error: (v: string) => errors.push(v), success: (v: string) => successes.push(v) }, fetch: async (url: string, init: RequestInit) => {
      assert.equal(url, "/api/v1/invoices/bulk"); assert.equal((init.headers as Record<string, string>)["x-organization-id"], "org-a"); assert.deepEqual(JSON.parse(String(init.body)), { action, invoiceIds: [raw.id] });
      if (mode === "network") throw new Error("secret");
      return Response.json({ error: "secret", summary: mode === "shape" ? { sent: "secret" } : { sent: 2, skipped: 1, failed: 0, total: 3 } }, { status: mode === "denied" ? 403 : 200 });
    } });
    await run(action, [raw.id]); assert.deepEqual(busy, [true, false]);
    assert.deepEqual(errors, mode === "success" ? [] : [t(mode === "network" ? "bulkConnection" : "bulkFailed")]);
    assert.deepEqual(successes, mode === "success" ? [[t(action === "send-reminder" ? "remindersSent" : "invoicesSent", { count: 2 }), t("skipped", { count: 1 })].join(t("summarySeparator"))] : []);
    assert.equal(refreshed, mode === "success" && action === "mark-as-sent" ? 1 : 0);
  }
});

test("creation callback preserves exact line payload, deposit basis points, approval and translated failure", async () => {
  for (const locale of locales) for (const mode of ["success", "approval", "denied", "network", "malformed"]) {
    const t = translator(locale), errors: string[] = [], success: string[] = [], busy: boolean[] = [], routes: string[] = [];
    const lines = [{ description: caller, quantity: "1", unitPrice: "90071992547409.91", accountId: "00000000-0000-4000-8000-000000000001", taxRateId: "" }];
    const run = callback(drawer, "handleSubmit", { t, orgId: "org-a", contactId: "customer-a", currencyCode: "USD", validLines: true, lines, documentLineInputs, isDepositRetainer: true, invoiceType: "deposit", depositPercent: "25", forApproval: mode === "approval", issueDate: raw.issueDate, dueDate: raw.dueDate, reference: caller, notes: "", setSaving: (v: boolean) => busy.push(v), onClose: noop, router: { push: (v: string) => routes.push(v) }, toast: { error: (v: string) => errors.push(v), success: (v: string) => success.push(v) }, fetch: async (url: string, init: RequestInit) => {
      assert.equal(url, "/api/v1/invoices"); assert.equal(init.method, "POST"); assert.equal((init.headers as Record<string, string>)["x-organization-id"], "org-a");
      assert.deepEqual(JSON.parse(String(init.body)), { contactId: "customer-a", issueDate: raw.issueDate, dueDate: raw.dueDate, currencyCode: "USD", reference: caller, notes: null, invoiceType: "deposit", depositPercent: 2500, ...(mode === "approval" ? { submitForApproval: true } : {}), lines: documentLineInputs(lines) });
      if (mode === "network") throw new Error("secret");
      if (mode === "malformed") return Response.json(null);
      return Response.json({ invoice: { id: raw.id, status: mode === "approval" ? "pending_approval" : "draft" }, error: "secret" }, { status: mode === "denied" ? 403 : 200 });
    } });
    await run({ preventDefault: noop });
    const ok = mode === "success" || mode === "approval";
    assert.deepEqual(errors, ok ? [] : [t("createFailed")]); assert.deepEqual(success, ok ? [t(mode === "approval" ? "createdApproval" : "created")] : []);
    assert.deepEqual(routes, ok ? [`/sales/${raw.id}`] : []); assert.deepEqual(busy, [true, false]);
  }
});

test("owned templates contain no unextracted authored JSX or display attributes", () => {
  for (const path of [list, detail, drawer]) {
    const ast = parse(path), problems: string[] = [];
    function visit(n: ts.Node) {
      if (path === drawer && ts.isFunctionDeclaration(n) && n.parent === ast && n.name?.text !== "InvoiceDrawer") return;
      if (ts.isJsxText(n) && /[a-z]/i.test(n.text.trim())) problems.push(n.text.trim());
      if (ts.isJsxAttribute(n) && ["title", "placeholder", "label", "emptyMessage", "aria-label"].includes(n.name.getText(ast)) && n.initializer && ts.isStringLiteral(n.initializer) && /[a-z]/i.test(n.initializer.text)) problems.push(n.getText(ast));
      ts.forEachChild(n, visit);
    }
    visit(ast); assert.deepEqual(problems, [], path);
  }
});

test("list and detail reads fail visibly on HTTP/JSON/shape/money errors and discard cancelled data", async () => {
  for (const locale of locales) for (const path of [list, detail]) for (const mode of ["success", "denied", "json", "shape", "alias", "cancelled"]) {
    const t = translator(locale), adopted: unknown[] = [], errors: unknown[] = [], busy: unknown[] = [];
    const row = { ...raw, totalMinor: mode === "alias" ? "01" : raw.totalMinor };
    const scope = { ...money, t, orgId: "org-a", id: raw.id, contextKey: "org-a:invoice-a", invoiceRequest: { current: null }, buildParams: () => "page=1&limit=50", devDelay: async () => {}, setRefetching: noop, setPage: noop, setTotalCount: noop, setFetchKey: noop, setInv: (v: unknown) => adopted.push(v), setInvoices: (v: unknown) => adopted.push(v), setError: (v: unknown) => errors.push(v), setMoneyError: (v: unknown) => errors.push(v), setLoading: (v: unknown) => busy.push(v), setInitialLoad: (v: unknown) => busy.push(v), setLoadedContext: noop, setPayments: noop, setBase: noop, setComplianceWarnings: noop, setSenderSnapshot: noop, setRecipientSnapshot: noop, setOrgName: noop, setCredits: noop, setCreditContext: noop, fetch: async (url: string, init: RequestInit) => {
      assert.equal((init.headers as Record<string, string>)["x-organization-id"], "org-a"); assert.equal(init.method, undefined); assert.equal(init.body, undefined);
      if (url !== `/api/v1/invoices/${raw.id}` && path === detail) return Response.json({});
      assert.equal(url, path === list ? "/api/v1/invoices?page=1&limit=50" : `/api/v1/invoices/${raw.id}`);
      if (mode === "json") return new Response("private HTML");
      return Response.json(mode === "shape" ? null : path === list ? { data: [row], pagination: { total: 1 } } : { invoice: row, payments: [] }, { status: mode === "denied" ? 403 : 200 });
    } };
    const cleanup = callback(path, "effect", scope)();
    if (mode === "cancelled") cleanup();
    for (let i = 0; i < 5; i++) await new Promise(resolve => setImmediate(resolve));
    if (mode === "success") { assert.deepEqual(adopted, [path === list ? [saved] : saved]); assert.deepEqual(errors, [null]); }
    else if (mode === "cancelled") { assert.deepEqual(adopted, []); assert.deepEqual(errors, []); assert.deepEqual(busy, []); }
    else { assert.deepEqual(adopted, []); assert.deepEqual(errors, [t(path === list ? "readFailed" : "detailReadFailed")]); }
    cleanup();
  }
  for (const path of [list, detail]) callback(path, "effect", { orgId: null, fetch: () => assert.fail("missing org") })();
});

test("snapshot correction, exact copy and PDF callbacks retain scoped payloads and localize failed requests", async () => {
  for (const locale of locales) for (const name of ["handleSaveSnapshot", "handleDuplicate", "handleDownloadPdf"]) for (const mode of ["success", "denied", "network", "json"]) {
    const t = translator(locale), errors: string[] = [], successes: string[] = [], busy: boolean[] = [], destinations: string[] = [], downloads: unknown[] = [];
    const snapshot = { sender: { name: caller, address: null, email: null, phone: null, taxId: null, registrationNumber: null }, recipient: { name: caller, email: null, address: null, taxNumber: null } };
    const run = callback(detail, name, { ...money, t, orgId: "org-a", id: raw.id, inv: saved, senderName: caller, senderAddress: "", senderEmail: "", senderPhone: "", senderTaxId: "", senderReg: "", recipientName: caller, recipientAddress: "", recipientEmail: "", recipientTaxNumber: "", setSnapshotSaving: (v: boolean) => busy.push(v), setDuplicating: (v: boolean) => busy.push(v), setSenderSnapshot: (v: unknown) => downloads.push(v), setRecipientSnapshot: noop, setSnapshotSheetOpen: noop, router: { push: (v: string) => destinations.push(v) }, URL: { createObjectURL: () => "blob:fixture", revokeObjectURL: (v: string) => downloads.push(v) }, document: { createElement: () => ({ click() { downloads.push(this); } }) }, toast: { error: (v: string) => errors.push(v), success: (v: string) => successes.push(v) }, fetch: async (url: string, init: RequestInit) => {
      assert.equal((init.headers as Record<string, string>)["x-organization-id"], "org-a");
      if (name === "handleSaveSnapshot") { assert.equal(url, `/api/v1/invoices/${raw.id}/snapshot`); assert.equal(init.method, "PATCH"); assert.deepEqual(JSON.parse(String(init.body)), snapshot); }
      if (name === "handleDuplicate") {
        assert.equal(url, "/api/v1/invoices"); assert.equal(init.method, "POST");
        const body = JSON.parse(String(init.body));
        assert.deepEqual(body.lines, money.invoiceUiCopyLines(saved.lines!, "USD")); assert.equal(body.currencyCode, "USD"); assert.equal(body.depositPercent, 2500); assert.equal(body.reference, caller);
      }
      if (name === "handleDownloadPdf") { assert.equal(url, `/api/v1/invoices/${raw.id}/pdf?format=pdf`); assert.equal(init.method, undefined); }
      if (mode === "network") throw new Error("secret");
      if (mode === "json") return new Response("not JSON");
      return Response.json({ ...snapshot, invoice: raw, error: "secret" }, { status: mode === "denied" ? 403 : 200 });
    } });
    await run();
    const ok = mode === "success" || name === "handleDownloadPdf" && mode === "json";
    const key = name === "handleSaveSnapshot" ? "snapshotFailed" : name === "handleDuplicate" ? "duplicateFailed" : "pdfFailed";
    assert.deepEqual(errors, ok ? [] : [t(key)]);
    if (name !== "handleDownloadPdf") { assert.deepEqual(busy, [true, false]); assert.equal(successes.length, ok ? 1 : 0); }
    if (name === "handleDuplicate") assert.deepEqual(destinations, ok ? [`/sales/${raw.id}`] : []);
    if (name === "handleDownloadPdf" && ok) { assert.equal(downloads.length, 2); assert.equal((downloads[0] as { download: string }).download, "invoice-INV-001.pdf"); assert.equal(downloads[1], "blob:fixture"); }
  }
});

test("currency lookup retains customer/org precedence, aborts stale data and translates all failure shapes", async () => {
  for (const locale of locales) for (const mode of ["success", "denied", "json", "shape", "currency", "cancelled"]) {
    const t = translator(locale), values: unknown[] = [];
    const run = callback(drawer, "effect", { t, open: true, orgId: "org-a", contactId: "customer/one", invoiceEditorCurrency, setCurrencyContext: (v: unknown) => values.push(v), fetch: async (url: string, init: RequestInit) => {
      assert.equal((init.headers as Record<string, string>)["x-organization-id"], "org-a"); assert.ok(init.signal);
      assert.ok(["/api/v1/contacts/customer%2Fone", "/api/v1/organization"].includes(url));
      if (mode === "json") return new Response("private HTML");
      return Response.json(mode === "shape" ? {} : { contact: { currencyCode: mode === "currency" ? "ZZZ" : "KWD" }, organization: { defaultCurrency: "USD" } }, { status: mode === "denied" ? 403 : 200 });
    } }, 1);
    const cleanup = run(); if (mode === "cancelled") cleanup();
    for (let i = 0; i < 5; i++) await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(values, mode === "cancelled" ? [] : [{ orgId: "org-a", contactId: "customer/one", ...(mode === "success" ? { code: "KWD" } : { error: t("currencyFailed") }) }]); cleanup();
  }
});
