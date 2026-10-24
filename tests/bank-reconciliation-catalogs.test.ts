import { currencyFixture } from "./helpers/localized-fixtures";
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
import { requireReconciliationResponse, reconciliationFailure } from "../i18n/bank-reconciliation-presentation";
import { bankUiBalance, bankUiMoney, bankUiAccount, bankUiTransaction, bankUiReconciliation, bankUiReport } from "../lib/money/bank-ui";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const base = "app/(dashboard)/accounting/banking/[id]/";
const shared = base + "_components.tsx", page = base + "reconcile/page.tsx";
const locales = ["en-US", "fa-IR"] as const, noop = () => {};
const tx = { id: "tx-a", date: "2026-10-18", description: "<script>Caller تراکنش</script>", reference: "REF-ASCII", amount: 4000000000000001n, balance: null, status: "reconciled", journalEntryId: "je-a", accountName: "Caller ledger" };
const bank = { id: "bank-a", accountName: "<b>Caller bank</b>", currencyCode: "USD", balance: tx.amount };
const rec = { id: "rec-a", startDate: "2026-10-01", endDate: tx.date, startBalance: 0n, endBalance: tx.amount, status: "in_progress", createdAt: "2026-10-18T00:00:00Z" };
const report = { bankAccountId: bank.id, reconciliation: rec, currencyCode: "USD", glCurrencyCode: "USD", comparisonUnavailableReason: null, statementEndBalance: tx.amount, glBalance: 0n, difference: tx.amount, differenceMinor: tx.amount.toString(), isBalanced: false, hasLedgerAccount: true, reconciled: { count: 1, total: tx.amount, transactions: [tx] }, unreconciled: { count: 0, total: 0n, transactions: [] } };
const form = { startDate: rec.startDate, endDate: rec.endDate, startBalance: "-40000000000000.01", endBalance: "40000000000000.01" };

function translators(locale: typeof locales[number]) {
  const messages = locale === "en-US" ? en : fa;
  return { t: createTranslator({ locale, messages, namespace: "BankReconciliation" }), errors: createTranslator({ locale, messages, namespace: "BankAccountErrors" }) };
}

// Real production templates and next-intl. Control state/navigation and inline
// portals for SSR inspection; this does not simulate browser event dispatch.
function loaded(path: string, states: unknown[] = []) {
  let index = 0;
  const require = createRequire(resolve(path)), compiled = { exports: {} as Record<string, ComponentType<Record<string, unknown>>> };
  const code = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  const inline = ({ children }: { children: ReactNode }) => createElement("div", null, children);
  const load = (id: string) => {
    if (id === "react") return { ...React, useState: (initial: unknown) => [index < states.length ? states[index++] : typeof initial === "function" ? initial() : initial, noop], useEffect: noop, useCallback: (fn: unknown) => fn };
    if (id === "next-intl") return nextIntl;
    if (id === "next/navigation") return { useParams: () => ({ id: bank.id }), useRouter: () => ({ push: noop }) };
    if (id === "../_components") return loaded(shared);
    if (id.endsWith("/use-document-title")) return { useDocumentTitle: noop };
    if (id.endsWith("/ui/date-picker")) return DatePicker;
    if (id.endsWith("/ui/dialog") || id.endsWith("/ui/sheet")) return new Proxy({}, { get: (_obj, name) => name === "Dialog" || name === "Sheet" ? ({ open, children }: { open: boolean; children: ReactNode }) => open ? inline({ children }) : null : inline });
    return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  };
  new Function("require", "module", "exports", code)(load, compiled, compiled.exports);
  return compiled.exports;
}

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
const escaped = (s: string) => s.replaceAll("&", "&amp;").replaceAll("'", "&#x27;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
function includes(html: string, strings: string[]) { for (const s of strings) assert.ok(html.includes(escaped(s)), s); }
const props = { data: report, currencyCode: "USD", orgId: "org-a", bankAccountId: bank.id, onChanged: noop };

test("real reconciliation page renders translated checks, selection, sheet, history, exact signed totals and safe caller data", () => {
  for (const locale of locales) {
    const { t } = translators(locale);
    const Page = loaded(page, [bank, [tx, { ...tx, id: "tx-b", journalEntryId: null }], [rec, { ...rec, id: "rec-b", status: "completed" }], report, false, "", new Set([tx.id]), true, form, true, false]).default;
    const html = renderWithPresentation(createElement(Page), locale);
    includes(html, [t("title", { account: bank.accountName }), t("hint"), t("finish"), t("finishAllTitle"), t("accountBalance"), t("itemCount", { count: 1 }), t("markSelected", { count: 1 }), t("notInBooks", { count: 1 }), t("categorizeHint", { count: 1 }), t("addBooksFirst"), t("pastChecks"), t("range", { start: rec.startDate, end: rec.endDate }), t("completed"), t("inProgress"), t("statementPeriod"), t("openingBalance", { currency: currencyFixture("USD", locale) }), t("closingBalance", { currency: currencyFixture("USD", locale) }), t("starting"), bankUiMoney(tx.amount, "USD", resolvePresentation({ user: { language: locale } })), tx.description]);
    assert.ok(!html.includes("<script>") && !html.includes("<b>Caller"));
    assert.ok(html.includes('aria-label="' + escaped(t("back")) + '"'));
    const Empty = loaded(page, [bank, [], [], null, false]).default;
    includes(renderWithPresentation(createElement(Empty), locale), [t("checkStatement"), t("allCaughtUp"), t("nothingLeft")]);
    const Missing = loaded(page, [null, [], [], null, false]).default;
    includes(renderWithPresentation(createElement(Missing), locale), [t("unavailable")]);
  }
});

test("real report renders positive/negative differences, adjustment preview, empty lines, no-ledger and mixed-currency states", () => {
  for (const locale of locales) {
    const { t } = translators(locale);
    for (const sign of [1n, -1n]) {
      const Report = loaded(shared, [true, "Caller note", true]).ReconciliationReport;
      const html = renderWithPresentation(createElement(Report, { ...props, data: { ...report, difference: sign * tx.amount } }), locale);
      includes(html, [t("statementBalance"), t("booksBalance"), t("difference"), t(sign > 0n ? "statementMore" : "booksMore"), t("writeOff"), t("adjustTitle"), t("adjustHint"), t("adjustAmount"), t(sign > 0n ? "incomeHint" : "expenseHint"), t("description"), t("descriptionPlaceholder"), t("saving"), t("noUnmatched"), bankUiMoney(sign * tx.amount, "USD", resolvePresentation({ user: { language: locale } })), tx.description]);
      assert.ok(!html.includes("<script>"));
    }
    for (const [patch, key] of [
      [{ difference: 0n, isBalanced: true, reconciled: { count: 0, total: 0n, transactions: [] } }, "balanced"],
      [{ hasLedgerAccount: false, glBalance: null, difference: null }, "noLedger"],
      [{ comparisonUnavailableReason: "different_currency_units", glCurrencyCode: "KWD", difference: null }, "differentCurrencies"],
    ] as const) {
      const Report = loaded(shared).ReconciliationReport;
      includes(renderWithPresentation(createElement(Report, { ...props, data: { ...report, ...patch } }), locale), [t(key)]);
    }
    const Closed = loaded(shared, [true]).ReconciliationReport;
    const html = renderWithPresentation(createElement(Closed, { ...props, data: { ...report, reconciliation: { ...rec, status: "completed" } } }), locale);
    assert.equal((html.match(/disabled=""/g) ?? []).length, 2);
  }
});

test("reconciliation messages support runtime plurals and all new Persian leaves contain Persian text", () => {
  for (const [key, value] of Object.entries(fa.BankReconciliation)) assert.match(value, /[\u0600-\u06ff]/, key);
  for (const locale of locales) {
    const { t } = translators(locale);
    for (const count of [0, 1, 2, 1.5]) {
      for (const key of ["matchedCount", "ignoredCount", "finishSuccess", "itemCount", "notInBooks", "categorizeHint"] as const) assert.ok(!/MISSING|INVALID/.test(t(key, { count })));
      assert.ok(!/MISSING|INVALID/.test(t("partialResult", { count, failed: count })));
    }
    if (locale === "en-US") { assert.equal(t("ignoredCount", { count: 1 }), "Ignored 1 transaction"); assert.equal(t("finishSuccess", { count: 2 }), "Statement check finished — 2 lines matched"); }
  }
});

test("actual start callback preserves canonical Gregorian dates and exact signed USD/KWD minor strings", async () => {
  for (const locale of locales) for (const currencyCode of ["USD", "KWD"]) {
    const { t, errors } = translators(locale), busy: boolean[] = [], messages: string[] = [];
    let closed = false, refreshed = 0, reset: unknown;
    const recForm = currencyCode === "USD" ? form : { ...form, startBalance: "-1.250", endBalance: "1.251" };
    await callback(page, "ReconcilePage", "createReconciliation", { t, errors, requireReconciliationResponse, reconciliationFailure, bankUiBalance, orgId: "org-a", id: bank.id, account: { currencyCode }, recForm, setSavingRec: (v: boolean) => busy.push(v), setSheetOpen: (v: boolean) => { closed = !v; }, setRecForm: (v: unknown) => { reset = v; }, fetchData: () => { refreshed++; }, toast: { success: (v: string) => messages.push(v), error: assert.fail }, fetch: async (url: string, init: RequestInit) => {
      assert.equal(url, `/api/v1/bank-accounts/${bank.id}/reconciliations`); assert.equal(init.method, "POST"); assert.equal((init.headers as Record<string, string>)["x-organization-id"], "org-a");
      assert.deepEqual(JSON.parse(String(init.body)), { startDate: rec.startDate, endDate: rec.endDate, startBalanceMinor: currencyCode === "USD" ? "-4000000000000001" : "-1250", endBalanceMinor: currencyCode === "USD" ? "4000000000000001" : "1251" });
      return Response.json({ reconciliation: rec.id }, { status: 201 });
    } })();
    assert.deepEqual(busy, [true, false]); assert.ok(closed); assert.equal(refreshed, 1); assert.deepEqual(reset, { startDate: "", endDate: "", startBalance: "", endBalance: "" }); assert.deepEqual(messages, [t("startSuccess")]);
  }
});

test("actual start callback rejects invalid balances and HTTP/network/HTML failures without closing, resetting or succeeding", async () => {
  for (const locale of locales) for (const mode of ["fraction", "unsafe", "overlap", "forbidden", "network", "html", "unknown"] as const) {
    const { t, errors } = translators(locale), failures: string[] = [], busy: boolean[] = [];
    let requests = 0;
    const recForm = { ...form, startBalance: mode === "fraction" ? "1.001" : mode === "unsafe" ? "90071992547409.92" : form.startBalance };
    await callback(page, "ReconcilePage", "createReconciliation", { t, errors, requireReconciliationResponse, reconciliationFailure, bankUiBalance, orgId: "org-a", id: bank.id, account: bank, recForm, setSavingRec: (v: boolean) => busy.push(v), setSheetOpen: assert.fail, setRecForm: assert.fail, fetchData: assert.fail, toast: { success: assert.fail, error: (v: string) => failures.push(v) }, fetch: async () => {
      requests++;
      if (mode === "network") throw new Error("secret");
      if (mode === "html") return new Response("HTML secret", { status: 500 });
      return Response.json({ error: mode === "overlap" ? "Statement window overlaps an existing reconciliation" : "secret" }, { status: mode === "forbidden" ? 403 : 400 });
    } })();
    assert.equal(requests, mode === "fraction" || mode === "unsafe" ? 0 : 1); assert.deepEqual(busy, [true, false]);
    const expected = mode === "fraction" || mode === "unsafe" ? t("invalidBalance") : mode === "overlap" ? t("overlap") : mode === "forbidden" ? errors("forbidden") : mode === "unknown" ? errors("invalidInput") : t("startFailed");
    assert.deepEqual(failures, [expected]);
  }
});

test("actual completion preserves action/session/optional line IDs and translates result and balance-policy failures", async () => {
  for (const locale of locales) for (const includeIds of [undefined, [], [tx.id]]) for (const fail of [false, true]) {
    const { t, errors } = translators(locale), busy: boolean[] = [], successes: string[] = [], failures: string[] = [];
    let refreshed = 0, cleared = false;
    const run = callback(page, "ReconcilePage", "finishStatementCheck", { t, errors, requireReconciliationResponse, reconciliationFailure, orgId: "org-a", id: bank.id, reconciliations: [rec], setActing: (v: boolean) => busy.push(v), setSheetOpen: assert.fail, setSelectedIds: () => { cleared = true; }, fetchData: () => { refreshed++; }, toast: { success: (v: string) => successes.push(v), error: (v: string) => failures.push(v) }, fetch: async (url: string, init: RequestInit) => {
      assert.equal(url, `/api/v1/bank-accounts/${bank.id}/reconciliation`); assert.equal(init.method, "POST"); assert.equal((init.headers as Record<string, string>)["x-organization-id"], "org-a");
      assert.deepEqual(JSON.parse(String(init.body)), { action: "complete", reconciliationId: rec.id, ...(includeIds?.length ? { transactionIds: includeIds } : {}) });
      return fail ? Response.json({ error: "Opening balance plus statement movements must equal closing balance" }, { status: 400 }) : Response.json({ reconciledCount: 2 });
    } });
    await run(includeIds); assert.deepEqual(busy, [true, false]); assert.equal(refreshed, fail ? 0 : 1); assert.equal(cleared, !fail); assert.deepEqual(successes, fail ? [] : [t("finishSuccess", { count: 2 })]); assert.deepEqual(failures, fail ? [t("closingMovements")] : []);
  }
});

test("actual adjustment preserves exact amount, saved default description, trimmed caller description, date and session", async () => {
  for (const locale of locales) for (const adjustDesc of ["", "  Caller تعدیل  "]) for (const fail of [false, true]) {
    const { t, errors } = translators(locale), busy: boolean[] = [], successes: string[] = [], failures: string[] = [];
    let closed = false, refreshed = 0;
    await callback(shared, "ReconciliationReport", "postAdjustment", { t, errors, requireReconciliationResponse, reconciliationFailure, orgId: "org-a", bankAccountId: bank.id, diff: report.difference, data: report, adjustDesc, setPosting: (v: boolean) => busy.push(v), setAdjustOpen: (v: boolean) => { closed = !v; }, setAdjustDesc: noop, onChanged: () => { refreshed++; }, toast: { success: (v: string) => successes.push(v), error: (v: string) => failures.push(v) }, fetch: async (url: string, init: RequestInit) => {
      assert.equal(url, `/api/v1/bank-accounts/${bank.id}/reconciliation`); assert.equal(init.method, "POST"); assert.equal((init.headers as Record<string, string>)["x-organization-id"], "org-a");
      assert.deepEqual(JSON.parse(String(init.body)), { action: "adjustment", amountMinor: "4000000000000001", date: rec.endDate, description: adjustDesc.trim() || "Reconciliation adjustment", reconciliationId: rec.id });
      return fail ? new Response("secret HTML", { status: 500 }) : Response.json({ success: true });
    } })();
    assert.deepEqual(busy, [true, false]); assert.equal(closed, !fail); assert.equal(refreshed, fail ? 0 : 1); assert.deepEqual(successes, fail ? [] : [t("adjustSuccess")]); assert.deepEqual(failures, fail ? [t("adjustFailed")] : []);
  }
});

test("adjustment/selection guards keep completed/zero/missing statements and uncategorized transactions from writes", async () => {
  for (const locale of locales) {
    const { t, errors } = translators(locale), failures: string[] = [];
    for (const patch of [{ difference: null }, { difference: 0n }, { reconciliation: { ...rec, status: "completed" } }]) {
      const data = { ...report, ...patch };
      await callback(shared, "ReconciliationReport", "postAdjustment", { orgId: "org-a", diff: data.difference, data, setPosting: assert.fail, fetch: assert.fail })();
    }
    await callback(page, "ReconcilePage", "finishStatementCheck", { t, errors, orgId: "org-a", reconciliations: [], setActing: assert.fail, setSheetOpen: (v: boolean) => assert.equal(v, true), toast: { error: (v: string) => failures.push(v) } })();
    const isCategorized = (value: { journalEntryId: string | null }) => Boolean(value.journalEntryId);
    callback(page, "ReconcilePage", "toggleSelect", { t, isCategorized, toast: { error: (v: string) => failures.push(v) }, setSelectedIds: assert.fail })({ ...tx, journalEntryId: null });
    assert.deepEqual(failures, [t("startFirst"), t("addFirst")]);
    let selected: Set<string> = new Set();
    const selectAll = callback(page, "ReconcilePage", "selectAll", { selectableTransactions: [tx], selectedIds: selected, setSelectedIds: (v: Set<string>) => { selected = v; } });
    selectAll(); assert.deepEqual([...selected], [tx.id]);
  }
});

test("actual bulk callback retains canonical endpoints and reports full/partial/zero success with runtime counts", async () => {
  for (const locale of locales) for (const action of ["reconcile", "exclude"]) for (const successCount of [0, 1, 2]) {
    const { t } = translators(locale), successes: string[] = [], warnings: string[] = [], failures: string[] = [], busy: boolean[] = [];
    let requests = 0;
    await callback(page, "ReconcilePage", "bulkAction", { t, orgId: "org-a", selectedIds: new Set(["tx-a", "tx-b"]), setActing: (v: boolean) => busy.push(v), setSelectedIds: noop, fetchData: noop, toast: { success: (v: string) => successes.push(v), warning: (v: string) => warnings.push(v), error: (v: string) => failures.push(v) }, fetch: async (url: string, init: RequestInit) => {
      assert.equal(url, `/api/v1/bank-transactions/tx-${requests === 0 ? "a" : "b"}/${action}`); assert.equal(init.method, "POST"); assert.equal(init.body, "{}"); assert.equal((init.headers as Record<string, string>)["x-organization-id"], "org-a");
      return Response.json({}, { status: requests++ < successCount ? 200 : 403 });
    } })(action);
    assert.equal(requests, 2); assert.deepEqual(busy, [true, false]); assert.deepEqual(failures, successCount === 0 ? [t("bulkFailed")] : []); assert.deepEqual(warnings, successCount === 1 ? [t("partialResult", { count: 1, failed: 1 })] : []); assert.deepEqual(successes, successCount === 2 ? [t(action === "reconcile" ? "matchedCount" : "ignoredCount", { count: 2 })] : []);
  }
});

test("all finite reconciliation error mappings are sourced from the service; unknown/prototype/HTML/permission errors are safe", async () => {
  const source = readFileSync("i18n/bank-reconciliation-presentation.ts", "utf8"), service = readFileSync("lib/api/bank-reconciliations.ts", "utf8");
  const mappings = [...source.matchAll(/^  "([^"]+)": "([^"]+)",/gm)]; assert.equal(mappings.length, 17);
  for (const locale of locales) {
    const { t, errors } = translators(locale);
    for (const [, message, key] of mappings) {
      assert.ok(service.includes('"' + message + '"'));
      await assert.rejects(requireReconciliationResponse(Response.json({ error: message }, { status: 400 }), t, errors, "fallback"), { message: t(key as keyof typeof en.BankReconciliation) });
    }
    for (const message of ["__proto__", "constructor", "secret <script>"]) await assert.rejects(requireReconciliationResponse(Response.json({ error: message }, { status: 500 }), t, errors, t("requestFailed")), { message: t("requestFailed") });
    await assert.rejects(requireReconciliationResponse(Response.json({ error: "secret" }, { status: 403 }), t, errors, "fallback"), { message: errors("forbidden") });
    assert.equal(reconciliationFailure(new Error("secret"), t, "fallback"), "fallback");
    assert.equal(reconciliationFailure(new RangeError("Saved totals disagree"), t, "fallback"), "fallback");
    const response = Response.json({ value: "4000000000000001" });
    assert.deepEqual(await (await requireReconciliationResponse(response, t, errors, "fallback")).json(), { value: "4000000000000001" });
  }
});

test("actual fetch callback preserves read filters/org headers, exact adapters and categorized-line eligibility; optional report failure stays optional", async () => {
  for (const locale of locales) for (const mode of ["ok", "optional", "failed"] as const) {
    const { t, errors } = translators(locale), failures: string[] = [], requests: string[] = [];
    let account: unknown, transactions: unknown, reconciliations: unknown, result: unknown;
    let finish!: () => void;
    const completed = new Promise<void>(resolve => { finish = resolve; });
    const wire = (value: unknown) => JSON.parse(JSON.stringify(value, (_key, v) => typeof v === "bigint" ? Number(v) : v));
    callback(page, "ReconcilePage", "fetchData", {
      t, errors, requireReconciliationResponse, reconciliationFailure, bankUiAccount, bankUiTransaction, bankUiReconciliation, bankUiReport,
      orgId: "org-a", id: bank.id,
      setAccount: (v: unknown) => { account = v; }, setTransactions: (v: unknown) => { transactions = v; }, setReconciliations: (v: unknown) => { reconciliations = v; }, setReport: (v: unknown) => { result = v; }, setLoading: (v: boolean) => { assert.equal(v, false); finish(); }, toast: { error: (v: string) => failures.push(v) },
      fetch: async (url: string, init: RequestInit) => {
        requests.push(url); assert.equal((init.headers as Record<string, string>)["x-organization-id"], "org-a");
        const row = { ...tx, currencyCode: "USD", amountMinor: tx.amount.toString() };
        if (url.endsWith("?status=unreconciled&limit=100")) return Response.json(wire({ data: [{ ...row, id: "todo", journalEntryId: null }] }));
        if (url.endsWith("?status=reconciled&limit=100")) return Response.json(wire({ data: [row, { ...row, id: "attached", reconciliationId: rec.id }, { ...row, id: "no-journal", journalEntryId: null }] }));
        if (url.endsWith("/reconciliations")) return Response.json(wire({ data: [rec] }));
        if (url.endsWith("/reconciliation")) return mode === "optional" ? new Response("HTML secret", { status: 500 }) : Response.json(wire({ ...report, reconciled: { ...report.reconciled, transactions: [row] } }));
        return mode === "failed" ? Response.json({ error: "secret" }, { status: 403 }) : Response.json(wire({ bankAccount: bank }));
      },
    })();
    await completed;
    assert.deepEqual(requests, [`/api/v1/bank-accounts/${bank.id}`, `/api/v1/bank-accounts/${bank.id}/transactions?status=unreconciled&limit=100`, `/api/v1/bank-accounts/${bank.id}/transactions?status=reconciled&limit=100`, `/api/v1/bank-accounts/${bank.id}/reconciliations`, `/api/v1/bank-accounts/${bank.id}/reconciliation`]);
    if (mode === "failed") { assert.equal(account, null); assert.deepEqual(transactions, []); assert.equal(result, null); assert.deepEqual(failures, [errors("forbidden")]); }
    else {
      assert.equal((account as typeof bank).balance, tx.amount);
      assert.deepEqual((transactions as typeof tx[]).map(row => [row.id, row.amount]), [["todo", tx.amount], [tx.id, tx.amount]]);
      assert.equal((reconciliations as typeof rec[])[0].endBalance, tx.amount);
      assert.equal(mode === "optional" ? result : (result as typeof report).difference, mode === "optional" ? null : tx.amount);
      assert.deepEqual(failures, []);
    }
  }
});

test("owned reconciliation JSX contains no authored English text or visible literal string attributes", () => {
  for (const path of [page, shared]) {
    const ast = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(n: ts.Node) {
      if (path === shared && ts.isFunctionDeclaration(n) && !["ReconciliationReport", "RecLineList"].includes(n.name?.text ?? "")) return;
      if (ts.isJsxText(n)) assert.ok(!/[A-Za-z]/.test(n.text.replaceAll("&rarr;", "")), `${path}: ${n.text}`);
      if (ts.isJsxAttribute(n) && ["title", "placeholder", "aria-label", "empty"].includes(n.name.getText(ast)) && n.initializer && ts.isStringLiteral(n.initializer)) assert.ok(!/[A-Za-z]/.test(n.initializer.text), n.getText(ast));
      ts.forEachChild(n, visit);
    }
    visit(ast);
  }
});
