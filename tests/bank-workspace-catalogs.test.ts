import { currencyLabel } from "../i18n/currency-labels";
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
import * as DatePicker from "../components/ui/date-picker";
import { renderWithPresentation } from "./helpers/presentation";
import { bankUiAbs, bankUiAmount, bankUiMatchAmount, bankUiSplit, bankUiTax, bankUiMoney } from "../lib/money/bank-ui";
import { bankWorkspaceFailure, bankMatchReason } from "../i18n/bank-workspace-presentation";
import { requireBankAccountResponse } from "../i18n/bank-account-presentation";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const base = "app/(dashboard)/accounting/banking/[id]/";
const shared = base + "_components.tsx", layout = base + "(detail)/layout.tsx", overview = base + "(detail)/page.tsx", transactions = base + "(detail)/transactions/page.tsx";
const locales = ["en-US", "fa-IR"] as const, noop = () => {};
const tx = { id: "tx-a", date: "2026-10-18", description: "<script>Caller تراکنش</script>", amount: -4000000000000001n, balance: null, reference: "REF-ASCII", status: "unreconciled", payee: "Caller Payee" };
const doc = { id: "doc-a", billNumber: "B-123", invoiceNumber: "I-123", contactName: "Caller Contact", dueDate: "2026-10-20", currencyCode: "USD", total: 4000000000000001n, amountDue: 4000000000000001n, status: "approved" };
const bank = { id: "bank-a", accountName: "Caller Bank", accountType: "checking", bankName: "User Bank", currencyCode: "USD", balance: 4000000000000001n, countryCode: "US", accountNumber: "CALLER-1234", color: "#10b981", isActive: true };
const tax = { id: "tax-a", name: "Caller VAT", rate: 3333, recoverablePercent: 5000 };
const context = { account: bank, transactions: [tx], imports: [], summary: { total: 1, unreconciled: 1, reconciled: 0, excluded: 0, credits: 0n, debits: bankUiAbs(tx.amount) }, refetch: noop, openImport: noop, ...Object.fromEntries(["Reconcile", "Exclude", "Undo", "OpenMatch", "OpenExpense", "OpenCategorize", "OpenMatchInvoice", "OpenMatchUnified", "OpenTransfer", "OpenSplit"].map(k => ["handle" + k, noop])) };

function translators(locale: typeof locales[number]) {
  const messages = locale === "en-US" ? en : fa;
  return { t: createTranslator({ locale, messages, namespace: "BankWorkspace" }), errors: createTranslator({ locale, messages, namespace: "BankAccountErrors" }) };
}

// Real production templates/next-intl/money/fields. Controlled state/navigation,
// inline portals and select options permit SSR inspection without a browser.
// Unowned contact/account/tracking/attachment widgets are narrow boundaries.
function loaded(path: string, states: unknown[] = [], value = context) {
  let index = 0;
  const require = createRequire(resolve(path));
  const compiled = { exports: {} as Record<string, ComponentType<Record<string, unknown>>> };
  const code = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  const inline = ({ children }: { children: ReactNode }) => createElement("div", null, children);
  const load = (id: string) => {
    if (id === "react") return { ...React, useState: (initial: unknown) => [index < states.length ? states[index++] : typeof initial === "function" ? initial() : initial, noop], useEffect: noop, useMemo: (fn: () => unknown) => fn(), useCallback: (fn: unknown) => fn };
    if (id === "next-intl") return nextIntl;
    if (id.endsWith("/ui/date-picker")) return DatePicker;
    if (id === "next/navigation") return { useRouter: () => ({ push: noop }), useParams: () => ({ id: bank.id }), usePathname: () => "/accounting/banking/bank-a/transactions" };
    if (id === "../layout" || id === "./layout") return { useBankAccountContext: () => value };
    if (id === "../_components" || id === "../../_components") return loaded(shared);
    if (id.endsWith("/use-document-title") || id.endsWith("/use-entity-title")) return { useDocumentTitle: noop, useEntityTitle: noop };
    if (id.endsWith("/use-debounce")) return { useDebounce: (v: unknown) => v };
    if (id.endsWith("/ui/sheet") || id.endsWith("/ui/dialog") || id.endsWith("/ui/select")) return new Proxy({}, { get: (_obj, name) => name === "Sheet" || name === "Dialog" ? ({ open, children }: { open: boolean; children: ReactNode }) => open ? inline({ children }) : null : inline });
    if (id.endsWith("/account-picker")) return { AccountPicker: ({ value, placeholder }: { value: string; placeholder: string }) => createElement("input", { value, placeholder, readOnly: true, "data-picker": "account" }) };
    if (id.endsWith("/contact-picker")) return { ContactPicker: ({ value, placeholder }: { value: string; placeholder: string }) => createElement("input", { value, placeholder, readOnly: true, "data-picker": "contact" }) };
    if (id.endsWith("/tracking-picker")) return { TrackingPicker: () => null };
    if (id.endsWith("/receipt-attachments")) return { ReceiptAttachments: () => null };
    return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  };
  new Function("require", "module", "exports", code)(load, compiled, compiled.exports);
  return compiled.exports;
}

function callback(path: string, component: string, name: string, scope: Record<string, unknown>) {
  const ast = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const root = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === component);
  assert.ok(root, component);
  let expression = "";
  function visit(n: ts.Node) { if (ts.isFunctionDeclaration(n) && n.name?.text === name) expression = `(${n.getText(ast)})`; ts.forEachChild(n, visit); }
  visit(root); assert.ok(expression, name);
  const js = ts.transpileModule(`const run = ${expression};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(scope), `${js}; return run;`)(...Object.values(scope));
}

const escaped = (s: string) => s.replaceAll("&", "&amp;").replaceAll("'", "&#x27;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
function includes(html: string, strings: string[]) { for (const s of strings) assert.ok(html.includes(escaped(s)), s); }

test("bank workspace renders real pages, all derived states and confirmation guidance in both locales", () => {
  for (const locale of locales) {
    const { t } = translators(locale);
    const Layout = loaded(layout, [bank, [tx], [], false]).default;
    const html = renderWithPresentation(createElement(Layout, null, createElement("p", null, "Child")), locale);
    includes(html, [t("overview"), t("transactions"), t("imports"), t("settings"), t("balance"), t("moneyIn"), t("matchStatement"), bankUiMoney(bank.balance, "USD", resolvePresentation({ user: { language: locale } })), "Caller Bank", "1234"]);
    const Missing = loaded(layout, [null, [], [], false]).default;
    includes(renderWithPresentation(createElement(Missing), locale), [t("accountNotFound"), t("backBanking")]);
    for (const [state, extra, label] of [
      ["unreconciled", {}, "toDoLower"], ["excluded", {}, "ignoredLower"], ["reconciled", {}, "cleared"],
      ["reconciled", { journalEntryId: "je-a", accountId: "ledger-a", accountName: "<b>Caller account</b>" }, "inBooks"],
      ["reconciled", { reconciliationId: "rec-a" }, "matchedToStatement"],
    ] as const) {
      const Row = loaded(shared, [true, true]).TransactionRow;
      const row = renderWithPresentation(createElement(Row, { tx: { ...tx, status: state, ...extra }, cur: "USD", isLast: true, onReconcile: noop, onExclude: noop, onCategorize: noop, onUndo: noop }), locale);
      includes(row, [t(label), t("clearTitle"), t("undoTitle"), t("noPurposeRecorded"), bankUiMoney(tx.amount, "USD", resolvePresentation({ user: { language: locale } }))]);
      assert.ok(row.includes("&lt;script&gt;Caller تراکنش&lt;/script&gt;") && !row.includes("<script>"));
      assert.ok(row.includes("<em>") && row.includes("font-medium"));
    }
    const Overview = loaded(overview).default;
    includes(renderWithPresentation(createElement(Overview), locale), [t("recentTransactions"), t("toDo"), t("done"), t("ignored")]);
    const Page = loaded(transactions).default;
    includes(renderWithPresentation(createElement(Page), locale), [t("list"), t("assignBulk"), t("searchTransactions"), t("startDate"), t("transactionCount", { count: 1 })]);
  }
});

test("all matching sheets render selected documents, exact previews, known reasons, safe caller text and invoice/bill branches", () => {
  for (const locale of locales) {
    const { t } = translators(locale);
    for (const [name, states, props, keys] of [
      ["MatchToBillSheet", [doc.id, "40000000000000.01", false, ""], { bills: [doc], suggestions: [{ candidate: { id: doc.id }, confidence: 95, reasons: ["Exact amount match"] }] }, ["matchBillTitle", "billLinked", "searchBills"]],
      ["MatchToInvoiceSheet", [doc.id, "40000000000000.01", false, ""], { invoices: [doc], suggestions: [{ candidate: { id: doc.id }, confidence: 95, reasons: ["Same date"] }] }, ["matchInvoiceTitle", "invoiceLinked", "searchInvoices"]],
      ["MatchSheet", [{ kind: "bill", doc }, "40000000000000.01", "", false], { invoices: [], bills: [doc], documentSuggestions: [], existingMatches: [{ candidate: { type: "existing_payment", id: "pay-a", description: "<b>Caller payment</b>", amount: tx.amount, date: tx.date }, confidence: 90, reasons: ["secret unknown reason"] }] }, ["findMatch", "alreadyInBooks", "noDuplicateHint"]],
    ] as const) {
      const Sheet = loaded(shared, [...states])[name];
      const html = renderWithPresentation(createElement(Sheet, { ...props, transaction: tx, currencyCode: "USD", orgId: "org-a", loading: false, onClose: noop, onMatched: noop }), locale);
      includes(html, [t(keys[0]), t(keys[2]), "Caller Contact", bankUiMoney(doc.amountDue, "USD", resolvePresentation({ user: { language: locale } })), t("paymentPreview", { amount: bankUiMoney(doc.amountDue, "USD", resolvePresentation({ user: { language: locale } })) })]);
      assert.ok(!html.includes("secret unknown reason") && !html.includes("<script>"));
      if (name === "MatchSheet") includes(html, [t("unknownReason"), t("existingPayment")]);
    }
    const Sheet = loaded(shared, [null, "", "", false]).MatchSheet;
    includes(renderWithPresentation(createElement(Sheet, { transaction: { ...tx, amount: 1250n }, invoices: [], bills: [], documentSuggestions: [], existingMatches: [], currencyCode: "USD", orgId: "org-a", loading: false, onClose: noop, onMatched: noop }), locale), [t("matchIncomingHint"), t("noOpenInvoices")]);
  }
});

test("expense, categorize, transfer, split and bulk templates render guidance, canonical fields and bigint tax/allocation totals", () => {
  for (const locale of locales) {
    const { t } = translators(locale), props = { transaction: tx, currencyCode: "USD", orgId: "org-a", onClose: noop };
    const Expense = loaded(shared, ["Caller expense", "", "Caller item", "40000000000000.01", "ledger-a", tax.id, [tax], "", "", "", false]).CreateExpenseSheet;
    includes(renderWithPresentation(createElement(Expense, props), locale), [t("expenseTitle"), t("chooseExpenseCategory"), t("partlyReclaimable", { tax: "Caller VAT (33.33%)", percent: 50 }), t("amountInCurrency", { currency: currencyLabel("USD", locale) })]);
    const Categorize = loaded(shared, ["ledger-a", "", "", tax.id, [tax], "", "", false, [], false, "", undefined, ""]).CategorizeSheet;
    const html = renderWithPresentation(createElement(Categorize, { ...props, onSwitchToTransfer: noop, onSwitchToSplit: noop }), locale);
    const preview = bankUiTax(bankUiAbs(tx.amount), tax, false);
    assert.ok(preview);
    includes(html, [t("assignCategoryTitle"), t("businessCost"), t("ownAccounts"), t("net"), bankUiMoney(preview.net, "USD", resolvePresentation({ user: { language: locale } })), bankUiMoney(preview.recoverable, "USD", resolvePresentation({ user: { language: locale } })), bankUiMoney(preview.absorbed, "USD", resolvePresentation({ user: { language: locale } }))]);
    const Transfer = loaded(shared, ["bank-b", null, [], false, false]).TransferSheet;
    includes(renderWithPresentation(createElement(Transfer, { ...props, currentBankAccountId: bank.id, bankAccounts: [{ ...bank, id: "bank-b", hasLedgerAccount: false }] }), locale), [t("setupFirst"), t("notSetupSuffix"), t("mirrorHint")]);
    const Split = loaded(shared, [[{ key: "a", accountId: "ledger-a", amount: "20000000000000.00", taxRateId: "none", memo: "" }, { key: "b", accountId: "ledger-b", amount: "20000000000000.01", taxRateId: "none", memo: "" }], [tax], false]).SplitAccountSheet;
    includes(renderWithPresentation(createElement(Split, props), locale), [t("splitOutgoingHint"), t("partNumber", { count: 2 }), t("allocatedOf", { amount: bankUiMoney(bankUiAbs(tx.amount), "USD", resolvePresentation({ user: { language: locale } })), total: bankUiMoney(bankUiAbs(tx.amount), "USD", resolvePresentation({ user: { language: locale } })) }), t("saveSplit")]);
    const Grid = loaded(shared, [{ [tx.id]: { account: "ledger-a", taxRateId: "none", contact: "", memo: "" } }, [tax], false]).CashCodingGrid;
    includes(renderWithPresentation(createElement(Grid, { transactions: [tx], currencyCode: "USD", orgId: "org-a", onDone: noop }), locale), [t("fillDown"), t("gridHint"), t("readyCount", { count: 1 }), t("linesToAssign", { count: 1 })]);
  }
});

test("catalog errors, matcher explanations and plurals never leak unknown machine prose", async () => {
  for (const locale of locales) {
    const { t, errors } = translators(locale);
    for (const message of ["Select an outstanding document", "Document currency must match the bank", "Payment must cover the full statement amount", "Amount exceeds the document balance", "The parts must add up to the transaction amount", "Expense must equal the statement amount"]) assert.notEqual(bankWorkspaceFailure(new RangeError(message), t, "fallback"), "fallback");
    assert.equal(bankWorkspaceFailure(new RangeError("Enter a positive amount with valid decimal places for KWD and within the supported range"), t, "fallback"), t("invalidAmount", { currency: "KWD" }));
    for (const secret of ["network secret", "__proto__", "constructor"]) {
      assert.equal(bankWorkspaceFailure(new Error(secret), t, t("requestFailed")), t("requestFailed"));
      assert.equal(bankMatchReason(t, secret), t("unknownReason"));
    }
    assert.equal(bankMatchReason(t, "Exact amount match"), t("exactAmount"));
    try { await requireBankAccountResponse(Response.json({ error: "secret" }, { status: 403 }), errors, t("requestFailed")); assert.fail(); }
    catch (error) { assert.equal(bankWorkspaceFailure(error, t, "fallback"), errors("forbidden")); }
    for (const count of [0, 1, 2, 1.5]) for (const key of ["assignedCount", "linesToAssign", "ignoredCount", "categorizedCount", "transactionCount", "importedCount"] as const) assert.ok(!/MISSING|INVALID/.test(t(key, { count })));
    if (locale === "en-US") { assert.equal(t("assignedCount", { count: 1 }), "Assigned 1 transaction"); assert.equal(t("assignedCount", { count: 2 }), "Assigned 2 transactions"); }
  }
});

test("actual matching callbacks preserve document and existing-record discriminators, exact minor strings and org scope", async () => {
  for (const locale of locales) for (const kind of ["bill", "invoice", "existing_payment", "existing_journal", "transfer"] as const) {
    const { t, errors } = translators(locale), messages: string[] = [], saving: boolean[] = [];
    let matched = 0;
    const selection = kind === "bill" || kind === "invoice" ? { kind, doc } : { kind: "existing", match: { candidate: { type: kind, id: "existing-a", journalEntryId: "je-a" } } };
    const run = callback(shared, "MatchSheet", "handleMatch", { unitPresentation: resolvePresentation({ user: { language: locale } }),
      t, errors, requireBankAccountResponse, bankWorkspaceFailure, bankUiMatchAmount, orgId: "org-a", transaction: tx, selection, payAmount: "40000000000000.01", currencyCode: "USD", setSaving: (v: boolean) => saving.push(v), onMatched: () => { matched++; },
      toast: { success: (v: string) => messages.push(v), error: (v: string) => assert.fail(v) },
      fetch: async (url: string, init: RequestInit) => {
        assert.equal(url, `/api/v1/bank-transactions/${tx.id}/match`); assert.equal(init.method, "POST"); assert.equal((init.headers as Record<string, string>)["x-organization-id"], "org-a");
        const expected = kind === "invoice" ? { matchType: "invoice", invoiceId: doc.id, amountMinor: "4000000000000001", date: tx.date } : kind === "bill" ? { matchType: "bill", billId: doc.id, amountMinor: "4000000000000001", date: tx.date } : kind === "existing_payment" ? { matchType: "existing_payment", paymentId: "existing-a" } : { matchType: "existing_journal", journalEntryId: "je-a" };
        assert.deepEqual(JSON.parse(String(init.body)), expected); return Response.json({ success: true });
      },
    });
    await run(); assert.deepEqual(saving, [true, false]); assert.equal(matched, 1); assert.deepEqual(messages, [t("linked")]);
  }
});

test("actual matching callbacks reject invalid amounts and HTTP/network/HTML failures without success or closing", async () => {
  for (const locale of locales) for (const mode of ["amount", "forbidden", "network", "html"] as const) {
    const { t, errors } = translators(locale), failures: string[] = [], saving: boolean[] = [];
    let requests = 0;
    const run = callback(shared, "MatchSheet", "handleMatch", { unitPresentation: resolvePresentation({ user: { language: locale } }), t, errors, requireBankAccountResponse, bankWorkspaceFailure, bankUiMatchAmount, orgId: "org-a", transaction: tx, selection: { kind: "bill", doc }, payAmount: mode === "amount" ? "1.00" : "40000000000000.01", currencyCode: "USD", setSaving: (v: boolean) => saving.push(v), onMatched: () => assert.fail("must stay open"), toast: { success: () => assert.fail("no success"), error: (v: string) => failures.push(v) }, fetch: async () => { requests++; if (mode === "network") throw new Error("network secret"); return mode === "html" ? new Response("HTML secret", { status: 500 }) : Response.json({ error: "secret" }, { status: 403 }); } });
    await run(); assert.equal(requests, mode === "amount" ? 0 : 1); assert.deepEqual(saving, [true, false]);
    assert.deepEqual(failures, [mode === "amount" ? t("fullPayment") : mode === "forbidden" ? errors("forbidden") : mode === "html" ? t("requestFailed") : t("linkFailed")]);
  }
});

test("legacy bill/invoice match callbacks retain exact payment payloads", async () => {
  for (const locale of locales) for (const invoice of [false, true]) {
    const { t, errors } = translators(locale);
    let matched = 0;
    const run = callback(shared, invoice ? "MatchToInvoiceSheet" : "MatchToBillSheet", "handleMatch", { unitPresentation: resolvePresentation({ user: { language: locale } }),
      t, errors, requireBankAccountResponse, bankWorkspaceFailure, bankUiMatchAmount, orgId: "org-a", transaction: { ...tx, amount: invoice ? 1250n : -1250n }, selectedBill: doc.id, selectedInvoice: doc.id,
      bills: [{ ...doc, currencyCode: "KWD", amountDue: 1250n }], invoices: [{ ...doc, currencyCode: "KWD", amountDue: 1250n }], payAmount: "1.250", currencyCode: "KWD", setSaving: noop, onMatched: () => { matched++; }, toast: { success: noop, error: (v: string) => assert.fail(v) },
      fetch: async (url: string, init: RequestInit) => { assert.equal(url, `/api/v1/bank-transactions/${tx.id}/${invoice ? "match-invoice" : "match"}`); assert.deepEqual(JSON.parse(String(init.body)), { [invoice ? "invoiceId" : "billId"]: doc.id, amountMinor: "1250", date: tx.date }); return Response.json({ success: true }); },
    });
    await run(); assert.equal(matched, 1);
  }
});

test("expense, categorize, transfer and split callbacks preserve canonical payloads and exact units", async () => {
  for (const locale of locales) {
    const { t, errors } = translators(locale);
    for (const [component, handler, extra, operation, expected] of [
      ["CreateExpenseSheet", "handleCreate", { title: " Caller expense ", description: "", itemDesc: " Caller item ", itemAmount: "1.250", accountId: "ledger-a", taxRateId: "none", contactId: "", costCenterId: "", projectId: "", onCreated: noop }, "create-expense", { title: "Caller expense", description: null, currencyCode: "KWD", contactId: null, taxRateId: null, costCenterId: null, projectId: null, items: [{ date: tx.date, description: "Caller item", amountMinor: "1250", accountId: "ledger-a" }] }],
      ["CategorizeSheet", "handleSave", { accountId: "ledger-a", contactId: "contact-a", memo: " Caller memo ", taxRateId: "tax-a", costCenterId: "cc-a", projectId: "project-a", isEditing: true, onCategorized: noop }, "categorize", { accountId: "ledger-a", contactId: "contact-a", memo: "Caller memo", taxRateId: "tax-a", costCenterId: "cc-a", projectId: "project-a" }],
      ["TransferSheet", "handleTransfer", { targetId: "bank-b", counterTx: "counter-a", onTransferred: noop }, "match-transfer", { targetBankAccountId: "bank-b", counterTransactionId: "counter-a" }],
      ["SplitAccountSheet", "handleSave", { rows: [{ accountId: "a", amount: "0.625", taxRateId: "none", memo: "" }, { accountId: "b", amount: "0.625", taxRateId: "none", memo: "" }], onSplit: noop }, "split-account", { allocations: [{ accountId: "a", amountMinor: "625", taxRateId: null, memo: null }, { accountId: "b", amountMinor: "625", taxRateId: null, memo: null }] }],
    ] as const) {
      let requests = 0;
      const run = callback(shared, component, handler, { unitPresentation: resolvePresentation({ user: { language: locale } }), t, errors, requireBankAccountResponse, bankWorkspaceFailure, bankUiAmount, bankUiAbs, bankUiSplit, orgId: "org-a", transaction: { ...tx, amount: -1250n }, currencyCode: "KWD", setSaving: noop, toast: { success: noop, error: (v: string) => assert.fail(v) }, ...extra, fetch: async (url: string, init: RequestInit) => { requests++; assert.equal(url, `/api/v1/bank-transactions/${tx.id}/${operation}`); assert.equal(init.method, "POST"); assert.equal((init.headers as Record<string, string>)["x-organization-id"], "org-a"); assert.deepEqual(JSON.parse(String(init.body)), expected); return Response.json({ success: true }); } });
      await run(); assert.equal(requests, 1);
    }
  }
});

test("batch ignore rejects HTTP failures without false success; categorize uses ICU partial-result notifications", async () => {
  for (const locale of locales) for (const failure of [false, true]) {
    const { t, errors } = translators(locale), successes: string[] = [], failures: string[] = [], loading: boolean[] = [];
    let cleared = 0, refreshed = 0;
    const scope = { unitPresentation: resolvePresentation({ user: { language: locale } }), t, errors, requireBankAccountResponse, bankWorkspaceFailure, orgId: "org-a", selectedIds: new Set([tx.id]), batchAccountId: "ledger-a", setBatchSaving: (v: boolean) => loading.push(v), clearSelection: () => { cleared++; }, refetch: () => { refreshed++; }, toast: { success: (v: string) => successes.push(v), error: (v: string) => failures.push(v) }, fetch: async (_url: string, init: RequestInit) => { assert.equal((init.headers as Record<string, string>)["x-organization-id"], "org-a"); return Response.json({ summary: { succeeded: 1, failed: 2 }, error: "secret" }, { status: failure ? 403 : 200 }); } };
    await callback(transactions, "BankTransactionsPage", "batchIgnore", scope)();
    assert.deepEqual(successes, failure ? [] : [t("ignoredCount", { count: 1 })]); assert.deepEqual(failures, failure ? [t("ignoreFailed")] : []); assert.deepEqual(loading, [true, false]); assert.equal(cleared, failure ? 0 : 1); assert.equal(refreshed, cleared);
    successes.length = failures.length = loading.length = 0;
    await callback(transactions, "BankTransactionsPage", "applyBatchCategorize", scope)();
    assert.deepEqual(successes, failure ? [] : [t("categorizedWithSkipped", { count: 1, failed: 2 })]); assert.deepEqual(failures, failure ? [errors("forbidden")] : []);
  }
});

test("bulk grid fill-down preserves existing assignments; save submits only canonical selected rows", async () => {
  for (const locale of locales) {
    const { t, errors } = translators(locale);
    const codeable = [tx, { ...tx, id: "tx-b" }, { ...tx, id: "tx-c" }];
    let rows: Record<string, { account: string; taxRateId: string; contact: string; memo: string }> = {
      [tx.id]: { account: "ledger-a", taxRateId: "tax-a", contact: "contact-a", memo: " Caller memo " },
      "tx-b": { account: "ledger-b", taxRateId: "none", contact: "", memo: "Existing memo" },
    };
    const rowFor = (id: string) => rows[id] || { account: "", taxRateId: "none", contact: "", memo: "" };
    callback(shared, "CashCodingGrid", "fillDown", { unitPresentation: resolvePresentation({ user: { language: locale } }), t, codeable, rowFor, setRows: (fn: (previous: typeof rows) => typeof rows) => { rows = fn(rows); }, toast: { error: (v: string) => assert.fail(v) } })();
    assert.equal(rows["tx-b"].account, "ledger-b"); assert.equal(rows["tx-b"].memo, "Existing memo"); assert.deepEqual(rows["tx-c"], { account: "ledger-a", taxRateId: "tax-a", contact: "contact-a", memo: "" });
    const warnings: string[] = [];
    await callback(shared, "CashCodingGrid", "handleSave", { unitPresentation: resolvePresentation({ user: { language: locale } }), t, errors, requireBankAccountResponse, bankWorkspaceFailure, orgId: "org-a", readyIds: [tx.id, "tx-b"], rowFor, setSaving: noop, setRows: noop, onDone: noop, toast: { success: () => assert.fail("partial result uses warning"), warning: (v: string) => warnings.push(v), error: (v: string) => assert.fail(v) }, fetch: async (url: string, init: RequestInit) => { assert.equal(url, "/api/v1/bulk/bank-transactions/categorize"); assert.deepEqual(JSON.parse(String(init.body)), { items: [{ transactionId: tx.id, accountId: "ledger-a", taxRateId: "tax-a", contactId: "contact-a", memo: "Caller memo" }, { transactionId: "tx-b", accountId: "ledger-b", taxRateId: null, contactId: null, memo: "Existing memo" }] }); return Response.json({ summary: { succeeded: 1, failed: 1 } }); } })();
    assert.deepEqual(warnings, [t("assignedWithFailures", { count: 1, failed: 1 })]);
  }
});

test("owned workspace JSX has no remaining authored English copy or unlocalized visible string attributes", () => {
  for (const path of [shared, layout, overview, transactions]) {
    const ast = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(n: ts.Node) {
      if (path === shared && ts.isFunctionDeclaration(n) && ["ImportRow", "ImportSheet", "ReconciliationReport", "RecLineList"].includes(n.name?.text ?? "")) return;
      if (ts.isJsxText(n)) assert.ok(!/[A-Za-z]/.test(n.text.replaceAll("&rarr;", "")), `${path}: ${n.text}`);
      if (ts.isJsxAttribute(n) && ["title", "placeholder", "aria-label"].includes(n.name.getText(ast)) && n.initializer && ts.isStringLiteral(n.initializer)) assert.ok(!/[A-Za-z]/.test(n.initializer.text), n.getText(ast));
      ts.forEachChild(n, visit);
    }
    visit(ast);
  }
});
