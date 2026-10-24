import { currencyLabel } from "../i18n/currency-labels";
import { resolvePresentation } from "../i18n/locale";
import { bankMoneyDisplay as localizedBankMoney } from "../lib/money/bank-display";
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
import * as BrandLoader from "../components/dashboard/brand-loader";
import { currencyMetadata } from "../lib/money/exact";
import { formatDecimalDraft } from "../i18n/numbers";
import { loanRepaymentBanks, loanJson, loanFailureMessage, LoanRequestError, loanStatusLabel } from "../i18n/loan-presentation";
import { assetCentsInput, assetLifeInput, assetMoneyDisplay, assetRateInput } from "../lib/money/asset-display";
import { renderWithPresentation } from "./helpers/presentation";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const list = "app/(dashboard)/accounting/loans/page.tsx";
const detail = "app/(dashboard)/accounting/loans/[id]/page.tsx";
const drawer = "components/dashboard/create-drawer.tsx";
const locales = ["en-US", "fa-IR"] as const;
const noop = () => {};
const caller = '<script>وام & equipment</script>';
const loan = { id: 'loan-a', name: caller, principalAmount: 4000000000000001, principalAmountMinor: '4000000000000001', interestRate: 500, termMonths: 36, startDate: '2026-10-18', monthlyPayment: 29, monthlyPaymentMinor: '29', status: 'active' };
const entry = { id: 'entry-a', periodNumber: 1, date: '2026-10-18', principalAmount: 20, principalAmountMinor: '20', interestAmount: 9, interestAmountMinor: '9', totalPayment: 29, totalPaymentMinor: '29', remainingBalance: 3999999999999981, remainingBalanceMinor: '3999999999999981', posted: false };
const bank = { id: 'bank-a', accountName: caller, currencyCode: 'USD', isActive: true, accountType: 'checking', deletedAt: null };
function translator(locale: typeof locales[number]) { return createTranslator({ locale, messages: locale === "en-US" ? en : fa, namespace: "Loans" }); }
function escape(value: string) { return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;"); }

// Real production JSX, next-intl provider, tables, fields and money. Controlled
// hooks and inline portals make every state inspectable without a dev server.
function loaded(path: string, states: unknown[], titles: string[] = []) {
  let source = readFileSync(path, "utf8"), index = 0;
  const require = createRequire(resolve(path));
  const compiled = { exports: {} as Record<string, ComponentType<Record<string, unknown>>> };
  if (path === drawer) {
    const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const names = new Set(["LoanDrawer", "DrawerFooter", "DrawerIcon", "SectionLabel"]);
    // Keep imports referenced by the selected production functions only.
    const functions = ast.statements.filter(n => ts.isFunctionDeclaration(n) && n.name && names.has(n.name.text));
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
    }).join("\n") + "\nexport { LoanDrawer };";
  }
  const inline = ({ children, title }: { children: ReactNode; title?: string }) => createElement("div", { title }, children);
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  const load = (id: string) => {
    if (id === "next-intl") return nextIntl;
    if (id === "react") return { ...React, useState: (initial: unknown) => [index < states.length ? states[index++] : initial, noop], useEffect: noop, useMemo: (fn: () => unknown) => fn(), useCallback: (fn: unknown) => fn };
    if (id === "next/navigation") return { useRouter: () => ({ push: noop }), useParams: () => ({ id: loan.id }) };
    if (id.endsWith("/create-drawer")) return { useCreateDrawer: () => ({ open: noop }) };
    if (id.endsWith("/use-debounce")) return { useDebounce: (value: string) => value };
    if (id.endsWith("/use-document-title")) return { useDocumentTitle: (title: string) => titles.push(title) };
    if (id.endsWith("/use-entity-title")) return { useEntityTitle: noop };
    if (id.endsWith("/use-confirm")) return { useConfirm: () => ({ confirm: noop, dialog: null }) };
    if (id.endsWith("/data-table")) return DataTable;
    if (id.endsWith("/date-picker")) return DatePicker;
    if (id.endsWith("/brand-loader")) return BrandLoader;
    if (id.endsWith("/account-picker")) return { AccountPicker: ({ placeholder, currencyFilter }: { placeholder: string; currencyFilter: string }) => createElement("button", { "data-currency-filter": currencyFilter }, placeholder) };
    if (id.endsWith("/ui/sheet")) return Object.fromEntries(["Sheet", "SheetContent", "SheetHeader", "SheetTitle", "SheetDescription"].map(key => [key, inline]));
    if (id.endsWith("/ui/dialog")) return Object.fromEntries(["Dialog", "DialogContent", "DialogHeader", "DialogTitle", "DialogDescription"].map(key => [key, inline]));
    if (id.endsWith("/ui/dropdown-menu")) return Object.fromEntries(["DropdownMenu", "DropdownMenuContent", "DropdownMenuItem", "DropdownMenuSeparator", "DropdownMenuTrigger"].map(key => [key, inline]));
    if (id.endsWith("/ui/select")) return { Select: ({ children, value }: { children: ReactNode; value: string }) => createElement("div", { "data-value": value }, children), SelectItem: ({ children, value }: { children: ReactNode; value: string }) => createElement("div", { "data-option": value }, children), SelectTrigger: inline, SelectContent: inline, SelectValue: ({ placeholder }: { placeholder?: string }) => createElement("span", null, placeholder) };
    return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  };
  new Function("require", "module", "exports", code)(load, compiled, compiled.exports);
  return compiled.exports[path === drawer ? "LoanDrawer" : "default"];
}
function callback(path: string, name: string, scope: Record<string, unknown>, effectIndex = 0) {
  const ast = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let expression = "", effect = 0;
  function visit(n: ts.Node) {
    if (path === drawer && ts.isFunctionDeclaration(n) && n.parent === ast && n.name?.text !== "LoanDrawer") return;
    if (ts.isFunctionDeclaration(n) && n.name?.text === name) expression = n.getText(ast);
    if (ts.isVariableDeclaration(n) && n.name.getText(ast) === name && n.initializer && ts.isCallExpression(n.initializer)) expression = n.initializer.arguments[0].getText(ast);
    if (name === "effect" && ts.isCallExpression(n) && n.expression.getText(ast) === "useEffect" && effect++ === effectIndex) expression = n.arguments[0].getText(ast);
    ts.forEachChild(n, visit);
  }
  visit(ast); assert.ok(expression, name);
  const code = ts.transpileModule(`const run = ${expression};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(scope), `${code}; return run;`)(...Object.values(scope));
}

function listStates(rows: unknown[], search = "") { return [rows, null, false, false, false, 1, rows.length, 0, "all", search, 0]; }
function drawerStates(banks: unknown[] = [bank]) { return [false, caller, "40000000000000.01", "5", "36", "2026-10-18", "bank-a", banks, "liability-a", "expense-a", "USD"]; }

test("loan list renders bilingual empty, table, search and error states with exact bigint aggregates", () => {
  for (const locale of locales) {
    const t = translator(locale), titles: string[] = [];
    const Empty = loaded(list, listStates([]), titles);
    const empty = renderWithPresentation(createElement(Empty), locale);
    assert.deepEqual(titles, [t("documentTitle")]);
    for (const key of ["loans", "emptyDescription", "new", "how", "equipment", "split", "paidOverTime", "when", "bankTitle", "bankDescription", "financeTitle", "financeDescription", "interestTitle", "interestDescription", "booksTitle", "booksDescription"] as const) assert.ok(empty.includes(escape(t(key))), key);
    const rows = [loan, { ...loan, id: "b" }, { ...loan, id: "c" }, { ...loan, id: "d", status: "paid_off" }, { ...loan, id: "e", status: "future_status" }];
    const Page = loaded(list, listStates(rows, "equipment"));
    const html = renderWithPresentation(createElement(Page), locale);
    for (const key of ["currentlyBorrowed", "monthlyPayments", "borrowed", "rate", "monthly", "status", "name", "activeTab", "paidOffTab", "defaultedTab", "all", "search", "clear", "new"] as const) assert.ok(html.includes(escape(t(key))), key);
    assert.ok(html.includes(assetMoneyDisplay(BigInt(loan.principalAmount) * 3n, resolvePresentation({ user: { language: locale } }))) && html.includes(localizedAmount("$0.87", locale)));
    assert.ok(html.includes("future_status") && html.includes(escape(caller)) && !html.includes("<script>"));
    assert.ok(html.includes(escape(t("showing", { shown: 5, count: 5 }))));
    const Missing = loaded(list, listStates(rows, "absent"));
    assert.ok(renderWithPresentation(createElement(Missing), locale).includes(escape(t("noMatches"))));
    const ErrorPage = loaded(list, [[], t("readFailed"), false]);
    assert.ok(renderWithPresentation(createElement(ErrorPage), locale).includes('role="alert"'));
    for (const count of [0, 1, 2]) assert.ok(t("showing", { shown: count, count }));
  }
});

test("loan detail renders payment previews, schedules, statuses and missing/loading/error states in both locales", () => {
  for (const locale of locales) {
    const t = translator(locale);
    for (const status of ["active", "paid_off", "defaulted", "future_status"]) {
      const Page = loaded(detail, [{ ...loan, status }, [entry, { ...entry, id: "posted", posted: true }], null, false, false]);
      const html = renderWithPresentation(createElement(Page), locale);
      for (const key of ["loan", "back", "borrowed", "rate", "length", "monthly", "date", "principal", "interest", "payment", "remaining", "posted"] as const) assert.ok(html.includes(escape(t(key))), key);
      assert.ok(html.includes(escape(t("started", { date: loan.startDate }))) && html.includes(escape(t("months", { count: 36 }))));
      assert.ok(html.includes(escape(loanStatusLabel(t, status))) && html.includes(localizedAmount("$0.29", locale)) && html.includes(assetMoneyDisplay(loan.principalAmount, resolvePresentation({ user: { language: locale } }))));
      assert.ok(html.includes(escape(caller)) && !html.includes("<script>"));
      if (status === "active") assert.ok(html.includes(escape(t("recordMonth"))) && html.includes(escape(t("recordHint"))));
      else assert.ok(!html.includes(escape(t("recordMonth"))));
    }
    for (const [states, key] of [ [[loan, [], null, false], "noSchedule"], [[null, [], null, false], "notFound"], [[null, [], null, true], "loading"], [[null, [], t("readFailed"), false], "readFailed"] ] as const) {
      const Page = loaded(detail, [...states]);
      assert.ok(renderWithPresentation(createElement(Page), locale).includes(escape(t(key))));
    }
    assert.equal(t("months", { count: 1 }), locale === "en-US" ? "1 month" : "۱ ماه");
  }
});

test("loan drawer renders localized fields while preserving account filters, machine values and caller escaping", () => {
  for (const locale of locales) {
    const t = translator(locale);
    for (const banks of [[], [bank]]) {
      const Drawer = loaded(drawer, drawerStates(banks));
      const html = renderWithPresentation(createElement(Drawer, { open: true, onClose: noop }), locale);
      for (const key of ["new", "drawerDescription", "details", "nameRequired", "nameExample", "amount", "ratePercent", "rateExample", "term", "termExample", "startDate", "landed", "paidInto", "chooseBank", "accounts", "principalAccount", "chooseLiability", "liabilityHint", "interestAccount", "chooseExpense", "expenseHint", "create"] as const) assert.ok(html.includes(escape(t(key))), key);
      assert.ok(html.includes('id="drawer-loan-principal"') && html.includes(`value="${formatDecimalDraft("40000000000000.01", resolvePresentation({ user: { language: locale } }))}"`));
      assert.ok(html.includes(escape(caller)) && !html.includes("<script>"));
      if (!banks.length) assert.ok(html.includes(escape(t("noBanks"))));
      else { assert.ok(html.includes('data-option="bank-a"')); assert.ok(html.includes(currencyLabel("USD", locale))); }
    }
  }
});

test("actual loan creation callback preserves exact request, localized exits, saving state and navigation", async () => {
  for (const locale of locales) for (const mode of ["success", "forbidden", "network", "html", "shape", "alias"]) {
    const t = translator(locale), messages: string[] = [], flags: boolean[] = [], destinations: string[] = []; let closed = 0;
    const run = callback(drawer, "handleSubmit", { unitPresentation: resolvePresentation({ user: { language: locale } }),
      t, baseCurrency: "USD", loanJson, loanFailureMessage, assetCentsInput, assetRateInput, assetLifeInput, name: caller, principalAmount: "40000000000000.01", interestPercent: "5.25", termMonths: "36", startDate: "2026-10-18", bankAccountId: "", principalAccountId: "liability-a", interestAccountId: "expense-a",
      localStorage: { getItem: () => "org-a" }, setSaving: (v: boolean) => flags.push(v), onClose: () => { closed++; }, router: { push: (v: string) => destinations.push(v) },
      toast: { success: (v: string) => messages.push(v), error: (v: string) => messages.push(v) },
      fetch: async (url: string, init: RequestInit) => {
        assert.equal(url, "/api/v1/loans"); assert.equal(init.method, "POST"); assert.equal((init.headers as Record<string, string>)["x-organization-id"], "org-a");
        assert.deepEqual(JSON.parse(String(init.body)), { name: caller, principalAmountMinor: "4000000000000001", interestRate: 525, termMonths: 36, startDate: "2026-10-18", principalAccountId: "liability-a", interestAccountId: "expense-a" });
        if (mode === "network") throw new Error("private network prose"); if (mode === "html") return new Response("private HTML");
        return Response.json(mode === "shape" ? {} : { loan: { ...loan, principalAmountMinor: mode === "alias" ? "01" : loan.principalAmountMinor } }, { status: mode === "forbidden" ? 403 : 200 });
      },
    });
    await run({ preventDefault: noop });
    assert.deepEqual(flags, [true, false]); assert.equal(closed, mode === "success" ? 1 : 0);
    assert.deepEqual(destinations, mode === "success" ? ["/accounting/loans/loan-a"] : []);
    assert.deepEqual(messages, [t(mode === "success" ? "created" : mode === "forbidden" ? "forbidden" : "createFailed")]);
  }
});

test("actual loan input validation localizes errors and never sends invalid values", async () => {
  for (const locale of locales) {
    const t = translator(locale);
    for (const [changes, key] of [ [{ name: "" }, "nameMissing"], [{ principalAccountId: "" }, "principalMissing"], [{ interestAccountId: "" }, "interestMissing"], [{ principalAmount: "1.234" }, "amountInvalid"], [{ principalAmount: "90071992547409.92" }, "amountRange"], [{ termMonths: "0" }, "termInvalid"], [{ interestPercent: "1000.01" }, "rateInvalid"] ] as const) {
      const messages: string[] = [], flags: boolean[] = [];
      await callback(drawer, "handleSubmit", { unitPresentation: resolvePresentation({ user: { language: locale } }), t, baseCurrency: "USD", loanJson, loanFailureMessage, assetCentsInput, assetRateInput, assetLifeInput, name: "Loan", principalAmount: "1", interestPercent: "0", termMonths: "36", startDate: "2026-10-18", bankAccountId: "bank-a", principalAccountId: "liability-a", interestAccountId: "expense-a", localStorage: { getItem: () => "org-a" }, setSaving: (v: boolean) => flags.push(v), toast: { error: (v: string) => messages.push(v) }, fetch: () => assert.fail("Invalid input submitted"), ...(changes as Record<string, unknown>) })({ preventDefault: noop });
      assert.deepEqual(messages, [t(key)]); assert.notEqual(flags.at(-1), true);
    }
  }
  const flags: boolean[] = [];
  await callback(drawer, "handleSubmit", { name: "Loan", baseCurrency: "USD", principalAccountId: "a", interestAccountId: "b", localStorage: { getItem: () => null }, setSaving: (v: boolean) => flags.push(v), fetch: () => assert.fail("No org submitted") })({ preventDefault: noop });
  assert.deepEqual(flags, [true, false]);
});

test("actual payment confirmation and callback preserve exact previews, request, failures and cancellation", async () => {
  for (const locale of locales) for (const mode of ["success", "forbidden", "network", "html", "shape", "alias", "cancel"]) {
    const t = translator(locale), messages: string[] = [], flags: boolean[] = []; let reloads = 0, requests = 0;
    await callback(detail, "handlePostPayment", { unitPresentation: resolvePresentation({ user: { language: locale } }),
      t, orgId: "org-a", id: loan.id, nextEntry: entry, formatMoney: assetMoneyDisplay, loanJson, loanFailureMessage,
      confirm: async (config: { title: string; description: string; confirmLabel: string; onConfirm: () => Promise<void> }) => {
        assert.equal(config.title, t("postTitle")); assert.equal(config.confirmLabel, t("record"));
        assert.equal(config.description, t("postDescription", { period: 1, total: localizedAmount("$0.29", locale), principal: localizedAmount("$0.20", locale), interest: localizedAmount("$0.09", locale) }));
        if (mode !== "cancel") await config.onConfirm();
      },
      setPosting: (v: boolean) => flags.push(v), load: () => { reloads++; }, toast: { success: (v: string) => messages.push(v), error: (v: string) => messages.push(v) },
      fetch: async (url: string, init: RequestInit) => {
        requests++; assert.equal(url, "/api/v1/loans/loan-a/post-payment"); assert.equal(init.method, "POST"); assert.equal((init.headers as Record<string, string>)["x-organization-id"], "org-a"); assert.deepEqual(JSON.parse(String(init.body)), { scheduleEntryId: entry.id });
        if (mode === "network") throw new Error("private network prose"); if (mode === "html") return new Response("private HTML");
        return Response.json(mode === "shape" ? {} : { entry: { ...entry, totalPaymentMinor: mode === "alias" ? "01" : entry.totalPaymentMinor } }, { status: mode === "forbidden" ? 403 : 200 });
      },
    })();
    assert.deepEqual(messages, mode === "cancel" ? [] : [t(mode === "success" ? "recorded" : mode === "forbidden" ? "forbidden" : "recordFailed")]);
    assert.deepEqual(flags, mode === "cancel" ? [] : [true, false]); assert.equal(reloads, mode === "success" ? 1 : 0); assert.equal(requests, mode === "cancel" ? 0 : 1);
  }
  for (const scope of [{ orgId: null, nextEntry: entry }, { orgId: "org-a", nextEntry: undefined }]) await callback(detail, "handlePostPayment", { ...scope, confirm: () => assert.fail("Missing org/schedule must not confirm") })();
});

test("actual list/detail/bank reads adopt validated data, localize failures and ignore cancelled effects", async () => {
  for (const locale of locales) for (const kind of ["list", "detail", "banks", "more"] as const) for (const mode of ["success", "forbidden", "network", "shape", "alias", "cancel"]) {
    if (mode === "cancel" && (kind === "detail" || kind === "more")) continue;
    const t = translator(locale), messages: string[] = [], adopted: unknown[] = [], flags: boolean[] = [];
    const scope = { unitPresentation: resolvePresentation({ user: { language: locale } }),
      t, currencyMetadata, loanRepaymentBanks, setBaseCurrency: noop, loanJson, loanFailureMessage, orgId: "org-a", id: loan.id, open: true, page: 1, loadingMore: false,
      localStorage: { getItem: () => "org-a" }, buildParams: (page: number) => `page=${page}&limit=50`, devDelay: async () => {},
      setLoans: (value: unknown) => adopted.push(typeof value === "function" ? value([]) : value), setLn: (value: unknown) => adopted.push(value), setSchedule: (value: unknown) => adopted.push(value), setBankAccounts: (value: unknown) => adopted.push(value),
      setReadError: (value: string) => messages.push(value), toast: { error: (value: string) => messages.push(value) },
      setRefetching: (value: boolean) => flags.push(value), setInitialLoad: (value: boolean) => flags.push(value), setLoading: (value: boolean) => flags.push(value), setLoadingMore: (value: boolean) => flags.push(value), setPage: noop, setTotalCount: noop, setFetchKey: noop,
      fetch: async (url: string, init: RequestInit) => {
        if (kind === "banks" && url === "/api/v1/organization") return Response.json({ organization: { defaultCurrency: "USD" } });
        assert.equal(url, kind === "banks" ? "/api/v1/bank-accounts" : kind === "detail" ? "/api/v1/loans/loan-a" : `/api/v1/loans?page=${kind === "more" ? 2 : 1}&limit=50`);
        assert.equal((init.headers as Record<string, string>)["x-organization-id"], "org-a");
        if (mode === "network") throw new Error("private network prose");
        const row = { ...loan, principalAmountMinor: mode === "alias" ? "01" : loan.principalAmountMinor };
        const body = mode === "shape" ? null : kind === "banks" ? { bankAccounts: [mode === "alias" ? { ...bank, amount: 29, amountMinor: "01" } : bank] } : kind === "detail" ? { loan: row, schedule: [entry] } : { data: [row], pagination: { total: 1 } };
        return Response.json(body, { status: mode === "forbidden" ? 403 : 200 });
      },
    };
    const run = callback(kind === "banks" ? drawer : kind === "detail" ? detail : list, kind === "detail" ? "load" : kind === "more" ? "loadMore" : "effect", scope);
    const cleanup = run();
    if (mode === "cancel") cleanup();
    await new Promise(resolve => setImmediate(resolve));
    const fallback = kind === "banks" ? "banksFailed" : "readFailed";
    assert.deepEqual(messages, mode === "success" || mode === "cancel" ? [] : [t(mode === "forbidden" ? "forbidden" : fallback)]);
    assert.deepEqual(adopted, kind === "banks" ? mode === "success" ? [[], [bank]] : [[]] : mode === "success" ? kind === "detail" ? [loan, [entry]] : [[loan]] : []);
    if (mode !== "cancel" && kind !== "banks") assert.equal(flags.at(-1), false);
  }
});

test("loan response boundary rejects bad shapes/money and hides arbitrary error prose in both locales", async () => {
  for (const locale of locales) {
    const t = translator(locale);
    for (const [status, code, key] of [[401, "", "unauthenticated"], [403, "", "forbidden"], [422, "", "invalidInput"], [400, "LEGACY_NUMERIC_RANGE", "invalidMoney"], [409, "", "readFailed"], [500, "", "readFailed"]] as const) {
      try { await loanJson(Response.json({ error: "private server prose", code }, { status }), t, t("readFailed"), "detail"); assert.fail("HTTP failure accepted"); }
      catch (error) { assert.equal(loanFailureMessage(error, t, t("readFailed")), t(key)); }
    }
    for (const [body, expected] of [ [null, "loan"], [{ loan: {} }, "loan"], [{ loan, schedule: {} }, "detail"], [{ data: [null] }, "list"], [{ bankAccounts: [{}] }, "banks"], [{ entry: {} }, "payment"], [{ loan: { ...loan, principalAmountMinor: "01" } }, "loan"] ] as const) await assert.rejects(loanJson(Response.json(body), t, t("readFailed"), expected));
    assert.equal(loanFailureMessage(new Error("private prose"), t, t("createFailed")), t("createFailed"));
    assert.equal(loanFailureMessage(new LoanRequestError(t("forbidden")), t, t("createFailed")), t("forbidden"));
    assert.deepEqual(await loanJson(Response.json({ loan, schedule: [entry] }), t, t("readFailed"), "detail"), { loan, schedule: [entry] });
  }
});

test("loan copy audit permits only documented technical/display exceptions and Persian messages contain Persian script", () => {
  const allowed = new Set(["%", "#", "—", "·", "$10,000.00", "-$880.00", "$0.00"]);
  for (const path of [list, detail, drawer]) {
    const ast = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(n: ts.Node) {
      if (path === drawer && ts.isFunctionDeclaration(n) && n.parent === ast && n.name?.text !== "LoanDrawer") return;
      if (path === drawer && n.parent === ast && !ts.isFunctionDeclaration(n)) return;
      if (ts.isJsxText(n) && n.text.trim()) assert.ok(allowed.has(n.text.trim()), `${path}: ${n.text.trim()}`);
      if (ts.isJsxAttribute(n) && ["title", "placeholder", "emptyMessage", "aria-label", "alt", "label", "description"].includes(n.name.getText(ast)) && n.initializer && ts.isStringLiteral(n.initializer)) assert.fail(n.getText(ast));
      ts.forEachChild(n, visit);
    }
    ts.forEachChild(ast, visit);
  }
  for (const value of Object.values(fa.Loans)) assert.match(value, /[\u0600-\u06ff]/);
});

function localizedAmount(value: string, locale: "en-US" | "fa-IR") { return (value.startsWith("+") ? "+" : "") + localizedBankMoney(BigInt(value.replace(/[$,+.]/g, "")), "USD", resolvePresentation({ user: { language: locale } })); }
