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
import * as CurrencySelect from "../components/ui/currency-select";
import * as AccountPicker from "../components/dashboard/account-picker";
import * as BrandLoader from "../components/dashboard/brand-loader";
import * as Presentation from "../i18n/provider";
import { BANK_ACCOUNT_TYPES, bankAccountTypeLabel, bankAccountGroupLabel, requireBankAccountResponse, bankAccountFailureMessage } from "../i18n/bank-account-presentation";
import { bankUiAccount, bankUiMoney } from "../lib/money/bank-ui";
import { renderWithPresentation } from "./helpers/presentation";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const locales = ["en-US", "fa-IR"] as const;
const list = "app/(dashboard)/accounting/banking/page.tsx";
const settings = "app/(dashboard)/accounting/banking/[id]/(detail)/settings/page.tsx";
const drawer = "components/dashboard/create-drawer.tsx";
const noop = () => {};
const colors = ["#10b981", "#3b82f6"];
const sample = { id: "bank-a", accountName: "<script>حساب</script>", bankName: "Caller Bank", accountNumber: "CALLER-1234", accountType: "checking", currencyCode: "USD", countryCode: "US", color: colors[0], balance: 4000000000000001, balanceMinor: "4000000000000001", lowBalanceThreshold: null, lowBalanceThresholdMinor: null, isActive: true, chartAccountId: "ledger-a" };

// Render real production templates with controlled state/navigation. The sheet
// portal is inline for SSR inspection; next-intl, fields and money remain real.
function loaded(path: string, states: unknown[], account = sample) {
  let index = 0;
  const require = createRequire(resolve(path));
  const compiled = { exports: {} as Record<string, ComponentType<Record<string, unknown>>> };
  let source = readFileSync(path, "utf8");
  if (path === drawer) {
    const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const names = new Set(["BankAccountDrawer", "DrawerFooter", "DrawerIcon", "SectionLabel"]);
    const functions = ast.statements.filter(n => ts.isFunctionDeclaration(n) && n.name && names.has(n.name.text));
    const bindings = new Set<string>();
    const visit = (n: ts.Node) => { if (ts.isIdentifier(n)) bindings.add(n.text); ts.forEachChild(n, visit); };
    functions.forEach(visit);
    source = ast.statements.flatMap(n => {
      if (functions.includes(n)) return [n.getText(ast)];
      if (ts.isImportDeclaration(n) && n.importClause?.namedBindings && ts.isNamedImports(n.importClause.namedBindings)) {
        const used = n.importClause.namedBindings.elements.filter(v => bindings.has(v.name.text));
        if (used.length) return [`import { ${used.map(v => v.getText(ast)).join(", ")} } from ${n.moduleSpecifier.getText(ast)};`];
      }
      if (ts.isVariableStatement(n) && n.declarationList.declarations.some(v => v.name.getText(ast) === "BANK_ACCOUNT_COLORS")) return [n.getText(ast)];
      return [];
    }).join("\n") + "\nexport { BankAccountDrawer };";
  }
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  const load = (id: string) => {
    if (id === "next-intl") return nextIntl;
    if (id.endsWith("/currency-select")) return CurrencySelect;
    if (id.endsWith("/account-picker")) return AccountPicker;
    if (id.endsWith("/brand-loader")) return BrandLoader;
    if (id.endsWith("/i18n/provider")) return Presentation;
    if (id === "react") return { ...React, useState: (initial: unknown) => [index < states.length ? states[index++] : initial, noop], useEffect: noop, useMemo: (fn: () => unknown) => fn(), useCallback: (fn: unknown) => fn };
    if (id === "next/navigation") return { useRouter: () => ({ push: noop }), useParams: () => ({ id: sample.id }) };
    if (id.endsWith("/create-drawer")) return { useCreateDrawer: () => ({ open: noop }) };
    if (id === "../layout") return { useBankAccountContext: () => ({ account, setAccount: noop, refetch: noop }) };
    if (id === "../../_components") return { ACCOUNT_COLORS: colors };
    if (id.endsWith("/use-confirm")) return { useConfirm: () => ({ confirm: noop, dialog: null }) };
    if (id.endsWith("/use-document-title")) return { useDocumentTitle: noop };
    if (id.endsWith("/ui/sheet")) return Object.fromEntries(["Sheet", "SheetContent", "SheetHeader", "SheetTitle", "SheetDescription"].map(key => [key, ({ children }: { children: ReactNode }) => createElement("div", null, children)]));
    return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  };
  new Function("require", "module", "exports", code)(load, compiled, compiled.exports);
  return compiled.exports;
}

// Execute actual production callback syntax with test network/state boundaries.
function callback(path: string, name: string, scope: Record<string, unknown>) {
  const ast = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let expression = "";
  function visit(node: ts.Node) {
    if (path === drawer && ts.isFunctionDeclaration(node) && node.parent === ast && node.name?.text !== "BankAccountDrawer") return;
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) expression = `(${node.getText(ast)})`;
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name && node.initializer && ts.isCallExpression(node.initializer)) expression = node.initializer.arguments[0].getText(ast);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(expression, name);
  const code = ts.transpileModule(`const run = ${expression};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(scope), `${code}; return run;`)(...Object.values(scope));
}

function translators(locale: typeof locales[number]) {
  const messages = locale === "en-US" ? en : fa;
  return { t: createTranslator({ locale, messages, namespace: "BankAccounts" }), errors: createTranslator({ locale, messages, namespace: "BankAccountErrors" }) };
}

test("bank-account list renders translated onboarding, exact currency groups, types, active counts and caller text safely", () => {
  for (const locale of locales) {
    const { t } = translators(locale);
    const Empty = loaded(list, [[], false, "", true]).default;
    const empty = renderWithPresentation(createElement(Empty), locale);
    for (const key of ["firstAccount", "newBankAccount", "addAccountHint", "importHint", "sortHint", "totalBalance"] as const) assert.ok(empty.includes(t(key)), key);
    const rows = [bankUiAccount(sample), bankUiAccount({ ...sample, id: "bank-b", accountType: "savings", currencyCode: "EUR", balance: -1250, balanceMinor: "-1250", isActive: false }), bankUiAccount({ ...sample, id: "bank-c", balance: 1, balanceMinor: "1" })];
    const Page = loaded(list, [rows, false, "", true]).default;
    const html = renderWithPresentation(createElement(Page), locale);
    for (const key of ["checkingGroup", "savingsGroup", "inactive", "listHint", "moveMoney", "positiveBalances", "negativeBalances"] as const) assert.ok(html.includes(t(key)), key);
    assert.ok(html.includes(bankUiMoney(4000000000000002n, "USD", resolvePresentation({ user: { language: locale } }))));
    assert.ok(html.includes(bankUiMoney(-1250n, "EUR", resolvePresentation({ user: { language: locale } }))));
    assert.ok(html.includes(t("activeCount", { count: 2 })));
    assert.ok(html.includes(t("currencyCount", { count: 2 })));
    assert.ok(html.includes("&lt;script&gt;حساب&lt;/script&gt;"));
    assert.ok(html.includes("1234") && html.includes("Caller Bank"));
    assert.ok(!html.includes("<script>"));
    const Hidden = loaded(list, [rows, false, "", false]).default;
    const hidden = renderWithPresentation(createElement(Hidden), locale);
    assert.ok(hidden.includes(t("show")) && hidden.includes("********"));
    assert.ok(!hidden.includes(bankUiMoney(4000000000000002n, "USD", resolvePresentation({ user: { language: locale } }))));
  }
});

test("bank settings and creation drawer render translated fields, saving footer, accessible colors and canonical values", () => {
  for (const locale of locales) for (const saving of [false, true]) {
    const { t } = translators(locale);
    const Settings = loaded(settings, [saving, "USD", "ledger-a"]).default;
    const html = renderWithPresentation(createElement(Settings), locale);
    for (const key of ["generalHint", "booksHint", "changeHint", "saveChanges", "dangerZone", "accountName", "currency", "country", "deleteHint"] as const) assert.ok(html.includes(t(key).replaceAll("'", "&#x27;")), key);
    for (const field of ["accountName", "bankName", "accountNumber", "accountType", "countryCode", "color"]) assert.ok(html.includes(`name="${field}"`), field);
    assert.ok(html.includes('value="US"'), "saved country remains canonical");
    assert.ok(readFileSync(settings, "utf8").includes('name="accountType" defaultValue={account.accountType}'), "saved type remains the select value");
    assert.ok(html.includes(t("chooseColor", { color: colors[0] })));
    assert.ok(html.includes("&lt;script&gt;حساب&lt;/script&gt;"));
    const Drawer = loaded(drawer, [saving, sample.accountName, sample.bankName, sample.accountNumber, "checking", "USD", "US", colors[0], "ledger-a"]).BankAccountDrawer;
    const form = renderWithPresentation(createElement(Drawer, { open: true, onClose: noop }), locale);
    for (const key of ["newBankAccount", "createHint", "accountNameRequired", "accountDetails", "booksOptional", "automaticHint", "cancel"] as const) assert.ok(form.includes(t(key).replaceAll("'", "&#x27;")), key);
    assert.ok(form.includes(saving ? t("creating") : t("createAccount")));
    assert.ok(form.includes(t("chooseColor", { color: colors[0] })));
    assert.equal(/<button(?=[^>]*type="submit")(?=[^>]*disabled="")[^>]*>/.test(form), saving);
    assert.ok(form.includes("USD") && form.includes('value="US"'));
  }
});

test("type and group labels keep canonical codes, unknown values and ICU plural rules", () => {
  for (const locale of locales) {
    const { t } = translators(locale);
    for (const type of BANK_ACCOUNT_TYPES) { assert.equal(bankAccountTypeLabel(t, type), t(type)); assert.equal(bankAccountGroupLabel(t, type), t(`${type}Group`)); }
    for (const code of ["custom", "__proto__", "constructor"]) { assert.equal(bankAccountTypeLabel(t, code), code); assert.equal(bankAccountGroupLabel(t, code), code); }
    for (const count of [0, 1, 2, 1.5]) for (const key of ["activeCount", "currencyCount"] as const) assert.ok(!/MISSING|INVALID/.test(t(key, { count })));
    if (locale === "en-US") { assert.equal(t("currencyCount", { count: 1 }), "1 currency"); assert.equal(t("currencyCount", { count: 2 }), "2 currencies"); }
    else assert.match(t("accountName"), /[\u0600-\u06ff]/);
  }
});

test("fixed bank errors translate while unknown server/network/parser prose never leaks", async () => {
  const cases = [
    [404, "Bank account not found", "missing"], [404, "Organization not found", "organizationMissing"],
    [400, "Bank GL account must be active", "inactiveLedger"], [400, "GL account is already assigned to another bank account", "ledgerAssigned"],
    [400, "Bank currency, type and GL link cannot change after statement, payment or opening GL history", "historyLock"],
    [400, "Currency changes require zero saved and new balances and threshold", "currencyBalanceLock"],
    [500, "Couldn't connect this bank account to your books automatically. Please contact support.", "automaticLinkFailed"],
    [401, "secret", "unauthenticated"], [403, "secret", "forbidden"], [422, "secret", "invalidInput"],
  ] as const;
  for (const locale of locales) {
    const { t, errors } = translators(locale);
    for (const [status, error, key] of cases) await assert.rejects(requireBankAccountResponse(Response.json({ error }, { status }), errors, t("createFailed")), { message: errors(key) });
    await assert.rejects(requireBankAccountResponse(Response.json({ code: "LEGACY_NUMERIC_RANGE", error: "secret" }, { status: 409 }), errors, t("updateFailed")), { message: errors("invalidMoney") });
    for (const body of [null, { error: "secret" }, { error: "constructor" }, { error: "__proto__" }, { error: { detail: "secret" } }]) await assert.rejects(requireBankAccountResponse(Response.json(body, { status: 500 }), errors, t("createFailed")), { message: t("createFailed") });
    await assert.rejects(requireBankAccountResponse(new Response("HTML secret", { status: 500 }), errors, t("updateFailed")), { message: t("updateFailed") });
    assert.equal(bankAccountFailureMessage(new Error("network secret"), t("readFailed")), t("readFailed"));
    const response = Response.json({ bankAccount: sample });
    assert.equal(await requireBankAccountResponse(response, errors, "fallback"), response);
    assert.deepEqual(await response.json(), { bankAccount: sample });
  }
});

test("actual account-list request shows failures, rejects malformed exact aliases and recovers on reload", async () => {
  for (const locale of locales) for (const failure of ["forbidden", "network", "html", "alias", "success"]) {
    const { t, errors } = translators(locale);
    const messages: string[] = [], rows: unknown[][] = [], loading: boolean[] = [];
    const run = callback(list, "fetchAccounts", {
      t, errors, requireBankAccountResponse, bankAccountFailureMessage, bankUiAccount,
      localStorage: { getItem: () => "org-a" }, setAccounts: (v: unknown[]) => rows.push(v), setReadError: (v: string) => messages.push(v), setLoading: (v: boolean) => loading.push(v),
      fetch: async (url: string, init: RequestInit) => {
        assert.equal(url, "/api/v1/bank-accounts"); assert.equal((init.headers as Record<string, string>)["x-organization-id"], "org-a");
        if (failure === "network") throw new Error("network secret");
        if (failure === "html") return new Response("HTML secret");
        return Response.json({ bankAccounts: [{ ...sample, balanceMinor: failure === "alias" ? "04000000000000001" : sample.balanceMinor }] }, { status: failure === "forbidden" ? 403 : 200 });
      },
    });
    run(); await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(loading, [false]);
    assert.deepEqual(messages, [failure === "success" ? "" : failure === "forbidden" ? errors("forbidden") : t("readFailed")]);
    assert.equal(rows[0].length, failure === "success" ? 1 : 0);
    if (failure !== "success") {
      const Page = loaded(list, [[], false, messages[0]]).default;
      const html = renderWithPresentation(createElement(Page), locale);
      assert.ok(html.includes('role="alert"') && html.includes(messages[0]));
      assert.ok(!html.includes(t("firstAccount")));
    }
  }
});

test("create callback preserves org scope, canonical payload, events and route; failures leave form open", async () => {
  for (const locale of locales) for (const linked of [false, true]) for (const failure of ["success", "forbidden", "network", "html", "shape"]) {
    const { t, errors } = translators(locale);
    const successes: string[] = [], failures: string[] = [], loading: boolean[] = [], paths: string[] = [], events: string[] = [];
    let closed = 0;
    const run = callback(drawer, "handleSubmit", {
      t, errors, requireBankAccountResponse, bankAccountFailureMessage, accountName: sample.accountName, bankName: "", accountNumber: "", currencyCode: "USD", countryCode: "", accountType: "credit_card", color: colors[0], chartAccountId: linked ? "ledger-a" : "",
      localStorage: { getItem: () => "org-a" }, setSaving: (v: boolean) => loading.push(v), onClose: () => { closed++; }, router: { push: (v: string) => paths.push(v) }, window: { dispatchEvent: (v: Event) => events.push(v.type) }, CustomEvent,
      toast: { success: (v: string) => successes.push(v), error: (v: string) => failures.push(v) },
      fetch: async (url: string, init: RequestInit) => {
        assert.equal(url, "/api/v1/bank-accounts"); assert.equal(init.method, "POST"); assert.equal((init.headers as Record<string, string>)["x-organization-id"], "org-a");
        assert.deepEqual(JSON.parse(String(init.body)), { accountName: sample.accountName, bankName: null, accountNumber: null, currencyCode: "USD", countryCode: null, accountType: "credit_card", color: colors[0], ...(linked ? { chartAccountId: "ledger-a" } : {}) });
        if (failure === "network") throw new Error("network secret");
        if (failure === "html") return new Response("HTML secret");
        return Response.json({ bankAccount: failure === "shape" ? {} : sample, error: "secret" }, { status: failure === "forbidden" ? 403 : 201 });
      },
    });
    await run({ preventDefault: noop });
    assert.deepEqual(loading, [true, false]);
    assert.deepEqual(successes, failure === "success" ? [t("created")] : []);
    assert.deepEqual(failures, failure === "success" ? [] : [failure === "forbidden" ? errors("forbidden") : t("createFailed")]);
    assert.equal(closed, failure === "success" ? 1 : 0);
    assert.deepEqual(paths, failure === "success" ? ["/accounting/banking/bank-a"] : []);
    assert.deepEqual(events, failure === "success" ? ["bank-accounts-changed"] : []);
  }
});

test("create validates translated name and missing-org submissions do not get stuck saving", async () => {
  for (const locale of locales) for (const name of ["", "Named"]) {
    const { t, errors } = translators(locale), messages: string[] = [];
    const run = callback(drawer, "handleSubmit", { t, errors, accountName: name, localStorage: { getItem: () => null }, setSaving: () => assert.fail("must not start saving"), toast: { error: (v: string) => messages.push(v) } });
    await run({ preventDefault: noop });
    assert.deepEqual(messages, name ? [] : [t("nameRequired")]);
  }
});

test("settings callback preserves fields and optional ledger links; malformed data never becomes success", async () => {
  for (const locale of locales) for (const linked of [false, true]) for (const failure of ["success", "history", "network", "html", "alias"]) {
    const { t, errors } = translators(locale);
    const successes: string[] = [], failures: string[] = [], loading: boolean[] = [], accounts: unknown[] = [];
    let refreshed = 0;
    const fields = { accountName: sample.accountName, bankName: "", accountNumber: "", countryCode: "US", accountType: "cash", color: colors[1] };
    const run = callback(settings, "handleSaveSettings", {
      t, errors, requireBankAccountResponse, bankAccountFailureMessage, bankUiAccount, id: sample.id, orgId: "org-a", bankCurrency: "EUR", chartAccountId: linked ? "ledger-a" : "",
      FormData: class { get(key: keyof typeof fields) { return fields[key]; } }, setSaving: (v: boolean) => loading.push(v), setAccount: (update: () => unknown) => accounts.push(update), refetch: () => { refreshed++; },
      toast: { success: (v: string) => successes.push(v), error: (v: string) => failures.push(v) },
      fetch: async (url: string, init: RequestInit) => {
        assert.equal(url, "/api/v1/bank-accounts/bank-a"); assert.equal(init.method, "PATCH"); assert.equal((init.headers as Record<string, string>)["x-organization-id"], "org-a");
        assert.deepEqual(JSON.parse(String(init.body)), { ...fields, bankName: null, accountNumber: null, currencyCode: "EUR", ...(linked ? { chartAccountId: "ledger-a" } : {}) });
        if (failure === "network") throw new Error("network secret");
        if (failure === "html") return new Response("HTML secret");
        return Response.json({ bankAccount: { ...sample, balanceMinor: failure === "alias" ? "01250" : sample.balanceMinor }, error: "Bank currency, type and GL link cannot change after statement, payment or opening GL history" }, { status: failure === "history" ? 400 : 200 });
      },
    });
    await run({ preventDefault: noop, currentTarget: {} });
    assert.deepEqual(loading, [true, false]);
    assert.equal(accounts.length, failure === "success" ? 1 : 0); assert.equal(refreshed, accounts.length);
    if (failure === "success") assert.equal((accounts[0] as () => { balance: bigint })().balance, 4000000000000001n);
    assert.deepEqual(successes, failure === "success" ? [t("updated")] : []);
    assert.deepEqual(failures, failure === "success" ? [] : [failure === "history" ? errors("historyLock") : t("updateFailed")]);
  }
});

test("delete confirmation localizes and rejects failures so the confirmation stays open", async () => {
  for (const locale of locales) for (const failure of ["success", "forbidden", "network", "html"]) {
    const { t, errors } = translators(locale);
    const successes: string[] = [], failures: string[] = [], paths: string[] = [];
    let action: (() => Promise<void>) | undefined;
    const run = callback(settings, "handleDelete", {
      t, errors, requireBankAccountResponse, bankAccountFailureMessage, orgId: "org-a", id: sample.id,
      confirm: async (options: { title: string; description: string; confirmLabel: string; cancelLabel: string; destructive: boolean; onConfirm: () => Promise<void> }) => {
        assert.equal(options.title, t("deleteTitle")); assert.equal(options.description, t("deleteDescription")); assert.equal(options.confirmLabel, t("deleteConfirm")); assert.equal(options.cancelLabel, t("cancel")); assert.equal(options.destructive, true); action = options.onConfirm;
      },
      router: { push: (v: string) => paths.push(v) }, toast: { success: (v: string) => successes.push(v), error: (v: string) => failures.push(v) },
      fetch: async (url: string, init: RequestInit) => {
        assert.equal(url, "/api/v1/bank-accounts/bank-a"); assert.equal(init.method, "DELETE"); assert.equal((init.headers as Record<string, string>)["x-organization-id"], "org-a"); assert.equal(init.body, undefined);
        if (failure === "network") throw new Error("network secret");
        if (failure === "html") return new Response("HTML secret", { status: 500 });
        return Response.json({ success: true, error: "secret" }, { status: failure === "forbidden" ? 403 : 200 });
      },
    });
    await run(); assert.ok(action);
    if (failure === "success") await action();
    else await assert.rejects(action(), { message: failure === "forbidden" ? errors("forbidden") : t("deleteFailed") });
    assert.deepEqual(successes, failure === "success" ? [t("deleted")] : []);
    assert.deepEqual(failures, failure === "success" ? [] : [failure === "forbidden" ? errors("forbidden") : t("deleteFailed")]);
    assert.deepEqual(paths, failure === "success" ? ["/accounting/banking"] : []);
  }
});
