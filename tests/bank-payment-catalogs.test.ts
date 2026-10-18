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
import * as DatePicker from "../components/ui/date-picker";
import * as PaymentAmountPreview from "../components/dashboard/payment-amount-preview";
import { renderWithPresentation } from "./helpers/presentation";
import { bankPaymentStatus, paymentFailure, requirePaymentResponse } from "../i18n/bank-payment-presentation";
import { bankUiTransfer, bankUiMoney } from "../lib/money/bank-ui";
import { paymentUiBillAmount, paymentUiBatchInput, paymentUiDecimal, paymentUiMoney, paymentUiRemittance } from "../lib/money/payment-ui";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const base = "app/(dashboard)/accounting/banking/";
const scheduled = base + "scheduled/page.tsx", batches = base + "batches/page.tsx", detail = base + "batches/[id]/page.tsx";
const drawer = "components/dashboard/create-drawer.tsx", previewPath = "components/dashboard/payment-amount-preview.tsx";
const locales = ["en-US", "fa-IR"] as const, noop = () => {};
const amount = 4000000000000001n;
const bill = { id: "bill-a", billNumber: "<b>BILL-ASCII</b>", contactId: "supplier-a", contact: { id: "supplier-a", name: "<script>Supplier</script>" }, currencyCode: "USD", amountDue: amount, total: amount };
const item = { id: "item-a", billId: bill.id, contactId: bill.contactId, amount, currencyCode: "USD", scheduledDate: "2026-10-18", status: "pending", bill, contact: bill.contact, notes: "<b>Caller note</b>" };
const batch = { id: "batch-a", name: "<script>Caller batch</script>", status: "draft", totalAmount: amount, currencyCode: "USD", paymentCount: 1, createdAt: "2026-10-18T00:00:00Z", completedAt: null, items: [item] };
const bankAccounts = [{ id: "from", currencyCode: "USD", accountName: "Caller from" }, { id: "to", currencyCode: "USD", accountName: "Caller to" }];
const remittance = { contactId: bill.contactId, contactName: bill.contact!.name, contactEmail: null, currencyCode: "USD", totalPaid: amount, lines: [{ billId: bill.id, billNumber: bill.billNumber, billDate: "2026-10-18", billReference: "REF-ASCII", amountPaid: amount, currencyCode: "USD" }] };
function translators(locale: typeof locales[number]) {
  const messages = locale === "en-US" ? en : fa;
  return { t: createTranslator({ locale, messages, namespace: "BankPayments" }), errors: createTranslator({ locale, messages, namespace: "BankAccountErrors" }) };
}
const escaped = (s: string) => s.replaceAll("&", "&amp;").replaceAll("'", "&#x27;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
function includes(html: string, values: string[]) { for (const value of values) assert.ok(html.includes(escaped(value)), value); }

// Actual component templates, with controlled hook state/navigation and inline
// portals. next-intl, fields, previews and money formatting remain real.
function loaded(path: string, component: string, states: unknown[]) {
  let index = 0;
  const require = createRequire(resolve(path)), compiled = { exports: {} as Record<string, ComponentType<Record<string, unknown>>> };
  let source = readFileSync(path, "utf8");
  if (path === drawer) {
    const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const names = new Set([component, "DrawerFooter", "DrawerIcon", "SectionLabel"]);
    const functions = ast.statements.filter(n => ts.isFunctionDeclaration(n) && n.name && names.has(n.name.text));
    const identifiers = new Set<string>();
    const collect = (n: ts.Node) => { if (ts.isIdentifier(n)) identifiers.add(n.text); ts.forEachChild(n, collect); };
    functions.forEach(collect);
    source = ast.statements.flatMap(n => {
      if (functions.includes(n)) return [n.getText(ast)];
      if (ts.isImportDeclaration(n) && n.importClause?.namedBindings && ts.isNamedImports(n.importClause.namedBindings)) {
        const used = n.importClause.namedBindings.elements.filter(v => identifiers.has(v.name.text));
        if (used.length) return [`import { ${used.map(v => v.getText(ast)).join(", ")} } from ${n.moduleSpecifier.getText(ast)};`];
      }
      return [];
    }).join("\n");
  }
  source += `\nexport { ${component} };`;
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  const inline = ({ children }: { children: ReactNode }) => createElement("div", null, children);
  const load = (id: string) => {
    if (id === "react") return { ...React, useState: (initial: unknown) => [index < states.length ? states[index++] : typeof initial === "function" ? initial() : initial, noop], useEffect: noop, useCallback: (fn: unknown) => fn, useMemo: (fn: () => unknown) => fn(), useEffectEvent: (fn: unknown) => fn };
    if (id === "next-intl") return nextIntl;
    if (id.endsWith("/ui/date-picker")) return DatePicker;
    if (id.endsWith("/payment-amount-preview")) return PaymentAmountPreview;
    if (id === "next/navigation") return { useRouter: () => ({ push: noop }), useParams: () => ({ id: batch.id }) };
    if (id.endsWith("/use-document-title")) return { useDocumentTitle: noop };
    if (id.endsWith("/use-confirm")) return { useConfirm: () => ({ confirm: noop, dialog: null }) };
    if (id.endsWith("/ui/dialog") || id.endsWith("/ui/sheet")) return new Proxy({}, { get: (_obj, name) => name === "Dialog" || name === "Sheet" ? ({ open, children }: { open: boolean; children: ReactNode }) => open ? inline({ children }) : null : inline });
    return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  };
  new Function("require", "module", "exports", code)(load, compiled, compiled.exports);
  return compiled.exports[component];
}

// Execute production handler bodies with explicit network/state boundaries.
function callback(path: string, component: string, name: string, scope: Record<string, unknown>) {
  const ast = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const root = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === component);
  assert.ok(root);
  let expression = "";
  function visit(n: ts.Node) {
    if (ts.isFunctionDeclaration(n) && n.name?.text === name) expression = `(${n.getText(ast)})`;
    if (ts.isVariableDeclaration(n) && n.name.getText(ast) === name && n.initializer && ts.isCallExpression(n.initializer)) expression = `(${n.initializer.arguments[0].getText(ast)})`;
    ts.forEachChild(n, visit);
  }
  visit(root); assert.ok(expression, name);
  const code = ts.transpileModule(`const run = ${expression};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(scope), `${code}; return run;`)(...Object.values(scope));
}

test("scheduled template renders groups/statuses, exact money, populated form, preview, empty/read states and escaped caller data", () => {
  for (const locale of locales) {
    const { t } = translators(locale);
    const rows = ["pending", "processing", "completed", "failed", "cancelled"].map(status => ({ ...item, id: status, status }));
    const Page = loaded(scheduled, "ScheduledPaymentsList", [rows, "", false, "all", true, false, false, [bill], bill.id, "40000000000000.01", item.scheduledDate, "Caller notes"]);
    const html = renderWithPresentation(createElement(Page, { orgId: "org-a" }), locale);
    includes(html, [t("scheduledHeading"), t("scheduledHint"), t("processDue"), t("schedule"), t("scheduledDate"), t("notesOptional"), ...rows.map(row => bankPaymentStatus(t, row.status)), bill.contact!.name, item.notes, paymentUiMoney(amount, "USD"), t("paymentPreview", { amount: paymentUiMoney(amount, "USD") })]);
    assert.ok(html.includes('aria-label="' + escaped(t("paymentAmount", { currency: "USD" })) + '"'));
    assert.ok(html.includes('value="2026-10-18"'));
    assert.ok(!html.includes("<script>") && !html.includes("<b>Caller"));
    const Empty = loaded(scheduled, "ScheduledPaymentsList", [[], t("scheduledUnavailable"), false]);
    includes(renderWithPresentation(createElement(Empty, { orgId: "org-a" }), locale), [t("scheduledUnavailable"), t("noScheduled"), t("noScheduledHint")]);
  }
});

test("batch list/detail and transfer drawer render translated actions, selection, confirmation fields, remittance and exact amounts", () => {
  for (const locale of locales) {
    const { t } = translators(locale);
    const selection = [{ billId: bill.id, contactId: bill.contactId, currencyCode: "USD", amount: "40000000000000.01" }];
    const List = loaded(batches, "PaymentBatchesList", [[batch], "", false, true, false, "Caller batch", [bill], selection]);
    const html = renderWithPresentation(createElement(List, { orgId: "org-a" }), locale);
    includes(html, [t("batchesHeading"), t("createBatchTitle"), t("selectBills", { count: 1 }), t("total"), t("paymentCount", { count: 1 }), t("draft"), batch.name, bill.billNumber, paymentUiMoney(amount, "USD")]);
    assert.ok(html.includes('aria-pressed="true"'));
    includes(html, [t("paymentBillAmount", { bill: bill.billNumber, currency: "USD" })]);
    const Invalid = loaded(batches, "PaymentBatchesList", [[], "", false, true, false, "Caller batch", [bill], [{ ...selection[0], currencyCode: "EUR" }]]);
    includes(renderWithPresentation(createElement(Invalid, { orgId: "org-a" }), locale), [t("sameCurrencyBills"), t("unavailable"), t("noBatches")]);
    for (const status of ["draft", "completed"] as const) {
      const Details = loaded(detail, "BatchDetails", [{ ...batch, status, completedAt: status === "completed" ? batch.createdAt : null }, "", false, false, true, false, [remittance], false]);
      const rendered = renderWithPresentation(createElement(Details, { id: batch.id, orgId: "org-a" }), locale);
      includes(rendered, [t("backBatches"), t("totalAmount"), t("items", { count: 1 }), t(status), t("remittance"), t("remittanceHint"), t("noEmail"), t("emailSuppliers"), paymentUiMoney(amount, "USD"), "REF-ASCII"]);
      includes(rendered, [t(status === "draft" ? "submitBatch" : "viewRemittance")]);
      if (status === "draft") includes(rendered, [t("removeItem")]);
      assert.ok(!rendered.includes("<script>"));
    }
    for (const saving of [false, true]) {
      const Drawer = loaded(drawer, "BankTransferDrawer", [saving, bankAccounts, "from", "to", "40000000000000.01", "2026-10-18", "Caller memo"]);
      const rendered = renderWithPresentation(createElement(Drawer, { open: true, onClose: noop }), locale);
      includes(rendered, [t("transferTitle"), t("transferHint"), t("from"), t("to"), t("memo"), t("cancel"), t(saving ? "creating" : "recordTransfer"), t("transferPreview", { amount: bankUiMoney(amount, "USD") })]);
      assert.ok(rendered.includes('aria-label="' + escaped(t("transferAmount", { currency: "USD" })) + '"'));
    }
  }
});

test("finite presentation errors, unknown/HTML/network failures, status fallback and ICU counts remain safe in both locales", async () => {
  for (const locale of locales) {
    const { t, errors } = translators(locale);
    for (const [message, key] of [["Scheduled payment not found", "scheduleMissing"], ["Only pending scheduled payments can be updated", "pendingOnly"], ["Only draft batches can be submitted", "draftSubmitOnly"], ["Payment batch not found", "batchMissing"]] as const) {
      await assert.rejects(() => requirePaymentResponse(Response.json({ error: message }, { status: 400 }), t, errors, t("scheduleFailed")), { message: t(key) });
    }
    for (const [response, expected] of [[Response.json({ error: "SECRET stack" }, { status: 403 }), errors("forbidden")], [new Response("<html>SECRET</html>", { status: 500 }), t("submitFailed")], [Response.json({ code: "LEGACY_NUMERIC_RANGE" }, { status: 422 }), errors("invalidMoney")]] as const)
      await assert.rejects(() => requirePaymentResponse(response, t, errors, t("submitFailed")), { message: expected });
    assert.equal(paymentFailure(new Error("SECRET"), t, t("scheduleFailed")), t("scheduleFailed"));
    assert.equal(paymentFailure(new RangeError("Select distinct bank accounts in the same currency"), t, "fallback"), t("sameCurrencyAccounts"));
    assert.equal(bankPaymentStatus(t, "<script>secret</script>"), t("unknownStatus"));
    for (const count of [0, 1, 2, 11]) {
      assert.ok(t("processedScheduled", { count })); assert.ok(t("failedScheduled", { count }));
      assert.ok(t("paymentCount", { count })); assert.ok(t("emailed", { count }));
    }
    const response = Response.json({ journalEntryId: "entry-a" });
    assert.deepEqual(await (await requirePaymentResponse(response, t, errors, "fallback")).json(), { journalEntryId: "entry-a" });
  }
});

function messages() {
  const success: string[] = [], error: string[] = [], info: string[] = [], warning: string[] = [];
  return { success, error, info, warning, toast: { success: (s: string) => success.push(s), error: (s: string) => error.push(s), info: (s: string) => info.push(s), warning: (s: string) => warning.push(s) } };
}
test("schedule create/cancel/process callbacks keep exact payloads, dates, org headers, retries and translated partial results", async () => {
  for (const locale of locales) for (const currencyCode of ["USD", "JPY", "IRR", "KWD"]) {
    const { t, errors } = translators(locale), msg = messages();
    const selected = { ...bill, currencyCode };
    let closed = false, reset = false, refreshed = 0, saving = false;
    const requests: [string, RequestInit][] = [];
    let mode = "success";
    const scope = { t, errors, requirePaymentResponse, paymentFailure, paymentUiBillAmount, orgId: "org-a", selectedBillId: bill.id, scheduledDate: item.scheduledDate, amount: paymentUiDecimal(amount, currencyCode), bills: [selected], notes: "Caller note", toast: msg.toast,
      setSaving: (v: boolean) => { saving = v; }, setShowDialog: (v: boolean) => { closed = !v; }, resetForm: () => { reset = true; }, fetchItems: () => { refreshed++; }, setProcessing: noop,
      fetch: async (url: string, init: RequestInit) => { requests.push([url, init]); if (mode === "network") throw new Error("SECRET"); return mode === "denied" ? Response.json({ error: "Only pending scheduled payments can be updated" }, { status: 400 }) : Response.json({ processed: 1, failed: 2 }); } };
    await callback(scheduled, "ScheduledPaymentsList", "handleSchedule", scope)();
    assert.deepEqual(JSON.parse(requests[0][1].body as string), { billId: bill.id, contactId: bill.contactId, currencyCode, amountMinor: amount.toString(), scheduledDate: item.scheduledDate, notes: "Caller note" });
    assert.equal((requests[0][1].headers as Record<string, string>)["x-organization-id"], "org-a");
    assert.ok(closed && reset && !saving); assert.equal(refreshed, 1);
    assert.deepEqual(msg.success, [t("scheduled")]);
    closed = reset = false; mode = "denied";
    await callback(scheduled, "ScheduledPaymentsList", "handleSchedule", scope)();
    assert.deepEqual(msg.error, [t("pendingOnly")]); assert.ok(!closed && !reset && !saving);
    mode = "network";
    await callback(scheduled, "ScheduledPaymentsList", "handleSchedule", scope)();
    assert.equal(msg.error.at(-1), t("scheduleFailed"));
    const before = requests.length;
    await callback(scheduled, "ScheduledPaymentsList", "handleSchedule", { ...scope, amount: "1e3" })();
    assert.equal(requests.length, before); assert.equal(msg.error.at(-1), t("invalidPayment"));
    mode = "success";
    await callback(scheduled, "ScheduledPaymentsList", "handleCancel", scope)("schedule-a");
    assert.equal(requests.at(-1)![0], "/api/v1/scheduled-payments/schedule-a");
    assert.equal(requests.at(-1)![1].method, "PATCH"); assert.deepEqual(JSON.parse(requests.at(-1)![1].body as string), { status: "cancelled" });
    await callback(scheduled, "ScheduledPaymentsList", "handleProcessNow", scope)();
    assert.equal(requests.at(-1)![0], "/api/v1/scheduled-payments/process");
    assert.equal(msg.success.at(-1), t("processedPayments", { count: 1 }));
    assert.equal(msg.error.at(-1), t("failedPayments", { count: 2 }));
  }
});

test("batch create/submit/remove callbacks preserve exact single-currency items and confirmation/organization guards", async () => {
  for (const locale of locales) {
    const { t, errors } = translators(locale), msg = messages();
    const preview = paymentUiBatchInput([{ billId: bill.id, contactId: bill.contactId, currencyCode: "USD", amount: "40000000000000.01" }], [bill]);
    const requests: [string, RequestInit][] = [];
    let activeOrg = "org-a", allow = true, confirmation: Record<string, unknown> = {}, refresh = 0, closed = false, busy = false, deny = false;
    const scope = { t, errors, requirePaymentResponse, paymentFailure, formatMoney: paymentUiMoney, toast: msg.toast, orgId: "org-a", batch, batchName: "Caller name", preview,
      localStorage: { getItem: () => activeOrg }, confirm: async (v: Record<string, unknown>) => { confirmation = v; return allow; }, setSubmitting: (v: boolean) => { busy = v; }, setSaving: (v: boolean) => { busy = v; }, setShowDialog: (v: boolean) => { closed = !v; }, fetchBatch: () => { refresh++; }, fetchBatches: () => { refresh++; },
      fetch: async (url: string, init: RequestInit) => { requests.push([url, init]); return deny ? Response.json({ error: "Only draft batches can be submitted" }, { status: 400 }) : Response.json({ processed: 1, total: 1 }); } };
    await callback(batches, "PaymentBatchesList", "handleCreateBatch", scope)();
    assert.deepEqual(JSON.parse(requests[0][1].body as string), { name: "Caller name", currencyCode: "USD", items: [{ billId: bill.id, contactId: bill.contactId, currencyCode: "USD", amountMinor: amount.toString() }] });
    assert.ok(closed && !busy); assert.equal(msg.success[0], t("batchCreated"));
    await callback(detail, "BatchDetails", "handleSubmit", scope)();
    assert.equal(confirmation.title, t("submitTitle"));
    assert.equal(confirmation.description, t("submitConfirm", { count: 1, amount: paymentUiMoney(amount, "USD") }));
    assert.equal(requests.at(-1)![0], `/api/v1/payment-batches/${batch.id}/submit`);
    assert.equal(msg.success.at(-1), t("batchSubmitted", { processed: 1, total: 1 }));
    assert.ok(!busy);
    const count = requests.length;
    allow = false; await callback(detail, "BatchDetails", "handleSubmit", scope)();
    allow = true; activeOrg = "org-b"; await callback(detail, "BatchDetails", "handleSubmit", scope)();
    assert.equal(requests.length, count);
    activeOrg = "org-a"; deny = true; await callback(detail, "BatchDetails", "handleSubmit", scope)();
    assert.equal(msg.error.at(-1), t("draftSubmitOnly")); assert.ok(!busy);
    deny = false; await callback(detail, "BatchDetails", "handleRemoveItem", scope)(item.id);
    assert.equal(requests.at(-1)![1].method, "PATCH"); assert.deepEqual(JSON.parse(requests.at(-1)![1].body as string), { removeItemIds: [item.id] });
    assert.equal(msg.success.at(-1), t("itemRemoved")); assert.equal(refresh, 3);
  }
});

test("remittance callbacks validate totals, keep endpoints/body, mask failures and translate sent/skipped counts", async () => {
  for (const locale of locales) {
    const { t, errors } = translators(locale), msg = messages();
    let groups: unknown, open = false, busy = false, mode = "success";
    let sent = 2, skipped = 1;
    const wire = { ...remittance, totalPaid: Number(amount), totalPaidMinor: amount.toString(), lines: remittance.lines.map(line => ({ ...line, amountPaid: Number(amount), amountPaidMinor: amount.toString(), billTotal: Number(amount), billTotalMinor: amount.toString() })) };
    const requests: [string, RequestInit][] = [];
    const scope = { t, errors, requirePaymentResponse, paymentFailure, paymentUiRemittance, orgId: "org-a", batch, toast: msg.toast,
      setRemittanceOpen: (v: boolean) => { open = v; }, setRemittanceGroups: (v: unknown) => { groups = v; }, setRemittanceLoading: (v: boolean) => { busy = v; }, setSending: (v: boolean) => { busy = v; },
      fetch: async (url: string, init: RequestInit) => { requests.push([url, init]); if (mode === "network") throw new Error("SECRET"); if (mode === "html") return new Response("<html>SECRET</html>", { status: 500 }); return Response.json(init.method === "POST" ? { sent: Array(sent).fill("supplier"), skipped: Array(skipped).fill("supplier") } : { remittances: [{ ...wire, totalPaidMinor: mode === "corrupt" ? "1" : amount.toString() }] }); } };
    await callback(detail, "BatchDetails", "handleOpenRemittance", scope)();
    assert.ok(open && !busy); assert.equal((groups as typeof remittance[])[0].totalPaid, amount);
    for (mode of ["corrupt", "html", "network"]) {
      await callback(detail, "BatchDetails", "handleOpenRemittance", scope)();
      assert.ok(!open && !busy); assert.equal(groups, null); assert.equal(msg.error.at(-1), t("loadRemittanceFailed"));
    }
    mode = "success";
    for (const pair of [[2, 1], [1, 0], [0, 1], [0, 0]]) {
      [sent, skipped] = pair;
      await callback(detail, "BatchDetails", "handleSendRemittance", scope)();
      assert.equal(requests.at(-1)![0], `/api/v1/payment-batches/${batch.id}/remittance`);
      assert.equal(requests.at(-1)![1].body, "{}"); assert.ok(!busy && !open);
      if (sent) assert.equal(msg.success.at(-1), skipped ? t("emailedSkipped", { count: sent, skipped }) : t("emailed", { count: sent }));
      else assert.equal(msg.warning.at(-1), t(skipped ? "noEmailSent" : "noSuppliers"));
    }
  }
});

test("bank-transfer callback preserves canonical amounts/dates/memo/navigation and rejects cross-currency/invalid requests", async () => {
  for (const locale of locales) for (const currencyCode of ["USD", "JPY", "IRR", "KWD"]) {
    const { t, errors } = translators(locale), msg = messages();
    const requests: [string, RequestInit][] = [], pushes: string[] = [];
    let closed = false, busy = false, mode = "success";
    const scope = { t, errors, requirePaymentResponse, paymentFailure, bankUiTransfer, toast: msg.toast, fromBankAccountId: "from", toBankAccountId: "to", bankAccounts: bankAccounts.map(b => ({ ...b, currencyCode })), amount: paymentUiDecimal(amount, currencyCode), date: "2026-10-18", memo: "  Caller memo  ",
      localStorage: { getItem: () => "org-a" }, setSaving: (v: boolean) => { busy = v; }, onClose: () => { closed = true; }, router: { push: (v: string) => pushes.push(v) },
      fetch: async (url: string, init: RequestInit) => { requests.push([url, init]); return mode === "success" ? Response.json({ journalEntryId: "entry-a" }) : new Response("<html>SECRET</html>", { status: 500 }); } };
    const submit = (patch = {}) => callback(drawer, "BankTransferDrawer", "handleSubmit", { ...scope, ...patch })({ preventDefault: noop });
    await submit();
    assert.deepEqual(JSON.parse(requests[0][1].body as string), { fromBankAccountId: "from", toBankAccountId: "to", amountMinor: amount.toString(), date: "2026-10-18", memo: "Caller memo" });
    assert.equal(requests[0][0], "/api/v1/bank-transfers"); assert.equal((requests[0][1].headers as Record<string, string>)["x-organization-id"], "org-a");
    assert.deepEqual(pushes, ["/accounting/entry-a"]); assert.ok(closed && !busy); assert.equal(msg.success[0], t("transferRecorded"));
    closed = false; mode = "html"; await submit();
    assert.ok(!closed && !busy); assert.equal(msg.error.at(-1), t("transferFailed"));
    const count = requests.length;
    await submit({ fromBankAccountId: "" }); assert.equal(msg.error.at(-1), t("chooseFrom"));
    await submit({ toBankAccountId: "from" }); assert.equal(msg.error.at(-1), t("differentAccounts"));
    await submit({ bankAccounts: [{ ...bankAccounts[0], currencyCode }, { ...bankAccounts[1], currencyCode: currencyCode === "USD" ? "JPY" : "USD" }] }); assert.equal(msg.error.at(-1), t("sameCurrencyAccounts"));
    await submit({ amount: "1e3" }); assert.equal(msg.error.at(-1), t("invalidTransfer"));
    assert.equal(requests.length, count);
  }
});

test("week grouping boundaries stay canonical and locale/filter changes do not become processing-effect dependencies", () => {
  const ast = ts.createSourceFile(scheduled, readFileSync(scheduled, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const fn = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === "getWeekLabel")!;
  const fixed = new Proxy(Date, { construct: (target, args) => args.length ? Reflect.construct(target, args) : new Date(2026, 9, 18, 12) });
  const js = ts.transpileModule(fn.getText(ast), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const group = new Function("Date", `${js}; return getWeekLabel;`)(fixed);
  for (const [offset, expected] of [[-1, "overdue"], [0, "today"], [7, "thisWeek"], [8, "nextWeek"], [14, "nextWeek"], [15, "thisMonth"], [30, "thisMonth"], [31, "later"]] as const) {
    const date = new Date(2026, 9, 18 + offset);
    const text = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    assert.equal(group(text), expected);
  }
  let processEffects = 0;
  function visit(n: ts.Node) {
    if (ts.isCallExpression(n) && n.expression.getText(ast) === "useEffect" && n.arguments[0].getText(ast).includes('fetch("/api/v1/scheduled-payments/process"')) {
      processEffects++; assert.equal(n.arguments[1].getText(ast), "[orgId]");
    }
    ts.forEachChild(n, visit);
  }
  visit(ast); assert.equal(processEffects, 1);
});

test("owned JSX has no authored English copy and Persian leaves retain Persian characters", () => {
  for (const path of [scheduled, batches, detail, drawer, previewPath]) {
    const ast = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(n: ts.Node) {
      if (path === drawer && ts.isFunctionDeclaration(n) && n.name?.text !== "BankTransferDrawer") return;
      if (ts.isJsxText(n)) assert.ok(!/[A-Za-z]/.test(n.text), `${path}: ${n.text}`);
      if (ts.isJsxAttribute(n) && ["title", "placeholder", "aria-label", "label"].includes(n.name.getText(ast)) && n.initializer && ts.isStringLiteral(n.initializer)) assert.ok(!/[A-Za-z]/.test(n.initializer.text), n.getText(ast));
      ts.forEachChild(n, visit);
    }
    visit(ast);
  }
  assert.equal(Object.keys(en.BankPayments).length, Object.keys(fa.BankPayments).length);
  for (const [key, value] of Object.entries(fa.BankPayments)) assert.match(value, /[\u0600-\u06ff]/u, key);
});
