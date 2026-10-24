import { currencyFixture, displayNumberFixture } from "./helpers/localized-fixtures";
import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement, type ComponentType, type ReactNode } from "react";
import * as React from "react";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { createTranslator } from "next-intl";
import * as nextIntl from "next-intl";
import * as CurrencySelect from "../components/ui/currency-select";
import * as DatePicker from "../components/ui/date-picker";
import * as DataTable from "../components/dashboard/data-table";
import * as BrandLoader from "../components/dashboard/brand-loader";
import * as Command from "../components/ui/command";
import { PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import AccountingLayout from "../app/(dashboard)/accounting/layout";
import { accountTypeLabel, accountTypeGroupLabel, requireAccountResponse, accountFailureMessage } from "../i18n/account-presentation";
import { coreAccountMoney, coreLedgerMoney } from "../lib/money/core-presentation";
import { renderWithPresentation } from "./helpers/presentation";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";
import { GENERIC_ACCOUNTS } from "../lib/db/chart-templates/generic";
import { accountDisplayName } from "../i18n/account-names";

const locales = ["en-US", "fa-IR"] as const;
const base = "app/(dashboard)/accounting/accounts";
const settings = `${base}/[id]/settings/page.tsx`;
const drawer = "components/dashboard/create-drawer.tsx";
const noop = () => {};
const sample = { id: "account-a", code: "1000", name: '<script>حساب</script>', type: "asset", subType: "Caller subtype", description: "Caller description", currencyCode: "EUR", amountCurrencyCode: "USD", balance: 1250, balanceMinor: "1250", totalDebits: 1500, totalDebitsMinor: "1500", totalCredits: 250, totalCreditsMinor: "250", isActive: true, isSystem: false, entryCount: 2 };

// Render the production module with controlled loaded state and navigation.
// React/next-intl, fields, tables and money renderers stay real. Only the drawer
// portal is opened inline so server rendering can inspect its actual form.
function loaded(path: string, states: unknown[], account = sample) {
  let index = 0;
  const require = createRequire(resolve(path));
  const compiledModule = { exports: {} as Record<string, ComponentType<Record<string, unknown>>> };
  let source = readFileSync(path, "utf8");
  if (path === drawer) {
    const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const functions = new Set(["AccountDrawer", "DrawerFooter", "DrawerIcon", "SectionLabel"]);
    const bindings = new Set(["useTranslations", "requireAccountResponse", "accountFailureMessage", "useState", "useEffect", "toast", "BookOpen", "Sheet", "SheetContent", "SheetHeader", "SheetTitle", "SheetDescription", "Button", "Input", "Label", "Textarea", "Select", "SelectContent", "SelectItem", "SelectTrigger", "SelectValue", "CurrencySelect"]);
    source = ast.statements.flatMap(node => {
      if (ts.isFunctionDeclaration(node) && node.name && functions.has(node.name.text)) return [node.getText(ast)];
      if (ts.isImportDeclaration(node) && node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings)) {
        const names = node.importClause.namedBindings.elements.filter(n => bindings.has(n.name.text));
        if (names.length) return [`import { ${names.map(n => n.getText(ast)).join(", ")} } from ${node.moduleSpecifier.getText(ast)};`];
      }
      return [];
    }).join("\n");
  }
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  const load = (id: string) => {
    if (id === "next-intl") return nextIntl;
    if (id.endsWith("/currency-select")) return CurrencySelect;
    if (id.endsWith("/date-picker")) return DatePicker;
    if (id.endsWith("/data-table")) return DataTable;
    if (id.endsWith("/brand-loader")) return BrandLoader;
    if (id.endsWith("/ui/command")) return Command;
    if (id === "react") return { ...React, useState: (initial: unknown) => [index < states.length ? states[index++] : initial, noop], useEffect: noop, useCallback: (fn: unknown) => fn, useMemo: (fn: () => unknown) => fn(), useRef: () => ({ current: null }) };
    if (id === "next/navigation") return { useRouter: () => ({ push: noop }), useParams: () => ({ id: "account-a" }), usePathname: () => "/accounting/accounts/account-a" };
    if (id.endsWith("/create-drawer")) return { useCreateDrawer: () => ({ open: noop }) };
    if (id === "../layout") return { useAccountContext: () => ({ account, setAccount: noop, refetch: noop }) };
    if (id.endsWith("/use-confirm")) return { useConfirm: () => ({ confirm: noop, dialog: null }) };
    if (id.endsWith("/use-document-title")) return { useDocumentTitle: noop };
    if (id.endsWith("/ui/sheet")) return Object.fromEntries(["Sheet", "SheetContent", "SheetHeader", "SheetTitle", "SheetDescription"].map(key => [key, ({ children }: { children: ReactNode }) => createElement("div", null, children)]));
    if (id.endsWith("/ui/popover") && path.endsWith("account-picker.tsx")) return Object.fromEntries(["Popover", "PopoverContent", "PopoverTrigger"].map(key => [key, ({ children }: { children: ReactNode }) => createElement("div", null, children)]));
    return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  };
  new Function("require", "module", "exports", code)(load, compiledModule, compiledModule.exports);
  return compiledModule.exports;
}

function callback(path: string, name: string, scope: Record<string, unknown>, owner?: string) {
  const ast = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let expression = "";
  function visit(node: ts.Node) {
    if (owner && ts.isFunctionDeclaration(node) && node.parent === ast && node.name?.text !== owner) return;
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) expression = `(${node.getText(ast)})`;
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name && node.initializer && ts.isCallExpression(node.initializer)) expression = node.initializer.arguments[0].getText(ast);
    if (name === "initialEffect" && ts.isCallExpression(node) && node.expression.getText(ast) === "useEffect") expression ||= node.arguments[0].getText(ast);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(expression, name);
  const js = ts.transpileModule(`const run = ${expression};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(scope), `${js}; return run;`)(...Object.values(scope));
}

test("accounting navigation keeps all destinations and translates labels and explanatory titles", () => {
  const paths = ["", "accounts", "banking", "loans", "fixed-assets", "asset-categories", "budgets", "opening-balances", "accruals", "recurring-journals"];
  for (const locale of locales) {
    const messages = locale === "en-US" ? en : fa;
    const html = renderWithPresentation(createElement(PathnameContext.Provider, { value: "/accounting/accounts" }, createElement(AccountingLayout, null, "Caller content")), locale);
    for (const suffix of paths) assert.ok(html.includes(`href="/accounting${suffix ? "/" + suffix : ""}"`), suffix);
    assert.ok(html.includes(messages.Accounts.accounts));
    assert.ok(html.includes(messages.Accounts.loanHint));
    assert.ok(html.includes("Caller content"));
  }
});

test("loaded chart, empty examples and errors render from the real page in both locales", () => {
  for (const locale of locales) {
    const messages = locale === "en-US" ? en : fa;
    for (const rows of [[], [sample]]) {
      const Page = loaded(`${base}/page.tsx`, [rows, null, false, "", "all", "code:asc"]).default;
      const html = renderWithPresentation(createElement(Page), locale);
      assert.ok(html.includes(messages.Accounts.chartOfAccounts));
      assert.ok(html.includes(messages.Accounts.newAccount));
      if (rows.length) { assert.ok(html.includes("&lt;script&gt;حساب&lt;/script&gt;")); assert.ok(html.includes(currencyFixture("EUR", locale))); assert.ok(html.includes(messages.Accounts.chartDescription + " ")); }
      else { assert.ok(html.includes(messages.Accounts.example1000)); assert.ok(html.includes(messages.Accounts.example5300)); }
      assert.ok(!html.includes("<script>"));
    }
    const Page = loaded(`${base}/page.tsx`, [[], messages.Accounts.loadAccountsFailed, false]).default;
    const html = renderWithPresentation(createElement(Page), locale);
    assert.ok(html.includes('role="alert"'));
    assert.ok(html.includes(messages.Accounts.loadAccountsFailed));
    assert.ok(!html.includes(messages.Accounts.example1000));
  }
});

test("built-in names render in Persian without renaming saved accounts or custom names", () => {
  const rows = GENERIC_ACCOUNTS.map((a, index) => ({ ...sample, ...a, id: `system-${index}`, isSystem: true, currencyCode: "IRR" }));
  const snapshot = JSON.stringify(rows);
  for (const locale of locales) {
    const messages = locale === "en-US" ? en : fa;
    const names = createTranslator({ locale, messages, namespace: "AccountNames" });
    const pageRows = rows.slice(0, 4);
    const Page = loaded(`${base}/page.tsx`, [pageRows, null, false, "", "all", "code:asc"]).default;
    const html = renderWithPresentation(createElement(Page), locale);
    for (const row of rows) {
      const displayName = accountDisplayName(names, row);
      if (pageRows.includes(row)) assert.ok(html.includes(displayName), displayName);
      if (locale === "fa-IR") assert.match(displayName, /\p{Script=Arabic}/u);
      assert.equal(accountDisplayName(names, { ...row, isSystem: false }), row.name);
      assert.equal(accountDisplayName(names, { ...row, name: "صادرات" }), "صادرات");
      assert.equal(accountDisplayName(names, { ...row, type: "custom" }), row.name);
    }
    assert.ok(html.includes(messages.Accounts.rial));
    const cash = loaded(`${base}/page.tsx`, [pageRows, null, false, locale === "fa-IR" ? "صندوق" : "Cash", "all", "name:asc"]).default;
    const filtered = renderWithPresentation(createElement(cash), locale);
    assert.ok(filtered.includes(accountDisplayName(names, rows[0])));
    assert.ok(!filtered.includes(accountDisplayName(names, rows.find(row => row.code === "1100")!)));
    const Picker = loaded("components/dashboard/account-picker.tsx", [true, [rows[0]], null, false]).AccountPicker;
    const picker = renderWithPresentation(createElement(Picker, { value: rows[0].id, onChange: noop }), locale);
    assert.ok(picker.includes(accountDisplayName(names, rows[0])));
  }
  assert.equal(JSON.stringify(rows), snapshot);
});

test("account drawer adopts organization currency, retains failed loading state, and cancels stale reads", async () => {
  for (const mode of ["IRR", "USD", "failure", "invalid", "cancelled"] as const) {
    const adopted: string[] = [], failures: string[] = [];
    let finish!: (response: Response) => void;
    const pending = new Promise<Response>(resolve => { finish = resolve; });
    const effect = callback(drawer, "initialEffect", {
      open: true, setAcctCurrency: (v: string) => adopted.push(v), localStorage: { getItem: () => "org-a" }, AbortController,
      errors: createTranslator({ locale: "en-US", messages: en, namespace: "AccountErrors" }),
      t: createTranslator({ locale: "en-US", messages: en, namespace: "Accounts" }), requireAccountResponse, accountFailureMessage,
      toast: { error: (v: string) => failures.push(v) },
      fetch: async (url: string, init: RequestInit) => {
        assert.equal(url, "/api/v1/organization"); assert.equal((init.headers as Record<string, string>)["x-organization-id"], "org-a");
        return pending;
      },
    }, "AccountDrawer");
    const cleanup = effect();
    if (mode === "cancelled") cleanup();
    finish(mode === "failure" ? new Response("private", { status: 500 }) : Response.json({ organization: { defaultCurrency: mode === "invalid" ? "" : mode === "USD" ? "USD" : "IRR" } }));
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(adopted, ["", ...(["IRR", "USD"].includes(mode) ? [mode] : [])]);
    assert.equal(failures.length, mode === "failure" || mode === "invalid" ? 1 : 0);
    cleanup();
  }
});

test("actual account settings preserve system locks, field names, saved data and localized rich notice", () => {
  for (const locale of locales) for (const isSystem of [false, true]) {
    const messages = locale === "en-US" ? en : fa;
    const Page = loaded(settings, [false], { ...sample, isSystem }).default;
    const html = renderWithPresentation(createElement(Page), locale);
    for (const key of ["accountCode", "accountName", "saveChanges", "dangerZone", "deleteAccount"] as const) assert.ok(html.includes(messages.Accounts[key]), key);
    for (const field of ["code", "name", "subType", "description", "isActive"]) assert.ok(html.includes(`name="${field}"`), field);
    assert.equal((html.match(/<input[^>]*disabled=""/g) ?? []).length, isSystem ? 2 : 0);
    assert.equal(html.includes(messages.Accounts.systemDeleteNotice.replaceAll("'", "&#x27;")), isSystem);
    assert.equal(html.includes('class="font-medium text-foreground"'), isSystem);
    assert.ok(html.includes("&lt;script&gt;حساب&lt;/script&gt;"));
    assert.ok(html.includes("Caller subtype"));
    assert.ok(html.includes(messages.Accounts.asset));
  }
});

test("account drawer renders translated fields, canonical type/currency values and saving footer", () => {
  for (const locale of locales) for (const saving of [false, true]) {
    const messages = locale === "en-US" ? en : fa;
    const Page = loaded(drawer, [saving, "EUR"]).AccountDrawer;
    const html = renderWithPresentation(createElement(Page, { open: true, onClose: noop }), locale);
    for (const key of ["newAccountTitle", "createDescription", "codeRequired", "nameRequired", "cancel"] as const) assert.ok(html.includes(messages.Accounts[key]), key);
    assert.ok(html.includes(saving ? messages.Accounts.creating : messages.Accounts.createAccount));
    assert.ok(html.includes('name="code"') && html.includes('placeholder="1000"'));
    assert.ok(html.includes(currencyFixture("EUR", locale)));
    assert.ok(readFileSync(drawer, "utf8").includes('<Select name="type" defaultValue="asset">'));
    assert.equal(/<button(?=[^>]*type="submit")(?=[^>]*disabled="")[^>]*>/.test(html), saving);
  }
});

test("type labels and ICU counts translate without changing unknown codes or account identifiers", () => {
  for (const locale of locales) {
    const messages = locale === "en-US" ? en : fa;
    const t = createTranslator({ locale, messages, namespace: "Accounts" });
    for (const type of ["asset", "liability", "equity", "revenue", "expense"] as const) assert.equal(accountTypeLabel(t, type), t(type));
    assert.equal(accountTypeGroupLabel(t, "revenue"), t("incomeGroup"));
    for (const unknown of ["constructor", "__proto__", "custom-type"]) { assert.equal(accountTypeLabel(t, unknown), unknown); assert.equal(accountTypeGroupLabel(t, unknown), unknown); }
    for (const count of [0, 1, 2, 1.5]) { assert.ok(!t("accountCount", { count }).includes("MISSING")); assert.ok(!t("entryCount", { count }).includes("INVALID")); }
    if (locale === "en-US") { assert.equal(t("accountCount", { count: 1 }), "1 account"); assert.equal(t("accountCount", { count: 2 }), "2 accounts"); }
  }
});

test("loaded ledger and account header retain currency provenance, canonical dates and escaped caller text", () => {
  const row = { entryId: "entry-a", entryNumber: 42, date: "2026-10-18", description: "<script>description</script>", debitAmount: 1250, debitAmountMinor: "1250", creditAmount: 0, creditAmountMinor: "0", balance: 1250, balanceMinor: "1250", amountCurrencyCode: "USD" };
  for (const locale of locales) {
    const messages = locale === "en-US" ? en : fa;
    const Header = loaded(`${base}/[id]/layout.tsx`, [sample, false, null]).default;
    const header = renderWithPresentation(createElement(Header, null, "Caller content"), locale);
    assert.ok(header.includes(messages.Accounts.totalDebits));
    assert.ok(header.includes(currencyFixture("USD", locale)) && header.includes(currencyFixture("EUR", locale)));
    assert.ok(header.includes(displayNumberFixture("12.50", locale)));
    assert.ok(header.includes("&lt;script&gt;حساب&lt;/script&gt;"));
    const Ledger = loaded(`${base}/[id]/page.tsx`, [[row], false, null, 1, "", "", "", "date:desc", "all", false, 0, 1, false, false]).default;
    const ledger = renderWithPresentation(createElement(Ledger), locale);
    for (const key of ["transactions", "date", "description", "debit", "credit", "balance"] as const) assert.ok(ledger.includes(messages.Accounts[key]), key);
    assert.ok(ledger.includes("2026-10-18"));
    assert.ok(ledger.includes('href="/accounting/entry-a"'));
    assert.ok(ledger.includes(displayNumberFixture("12.50", locale)));
    assert.ok(ledger.includes("&lt;script&gt;description&lt;/script&gt;"));
    assert.ok(!ledger.includes("<script>"));
  }
});

test("account picker keeps selected IDs, translated grouping and type/currency/subtype filters", async () => {
  const path = "components/dashboard/account-picker.tsx";
  for (const locale of locales) {
    const messages = locale === "en-US" ? en : fa;
    const Page = loaded(path, [true, [sample], null, false]).AccountPicker;
    const html = renderWithPresentation(createElement(Page, { value: sample.id, onChange: noop, allowCreate: true }), locale);
    assert.ok(html.includes("&lt;script&gt;حساب&lt;/script&gt;"));
    assert.ok(html.includes(messages.Accounts.assetsGroup));
    assert.ok(html.includes(messages.Accounts.manageAccounts));
    const adopted: unknown[] = [];
    const effect = callback(path, "initialEffect", {
      t: createTranslator({ locale, messages, namespace: "Accounts" }), errors: createTranslator({ locale, messages, namespace: "AccountErrors" }), requireAccountResponse, accountFailureMessage,
      typeKey: "asset", currencyFilter: "EUR", activeOnly: false, subTypeFilter: "Caller subtype", localStorage: { getItem: () => "org-a" },
      setAccounts: (v: unknown) => adopted.push(v), setError: noop, setLoading: noop,
      fetch: async (url: string, init: RequestInit) => {
        assert.equal(url, "/api/v1/accounts");
        assert.equal((init.headers as Record<string, string>)["x-organization-id"], "org-a");
        return Response.json({ accounts: [sample, { ...sample, id: "wrong-type", type: "expense" }, { ...sample, id: "wrong-currency", currencyCode: "USD" }, { ...sample, id: "wrong-subtype", subType: "Other" }] });
      },
    });
    effect(); await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(adopted, [[sample]]);
  }
});

test("HTTP account errors use approved copy; network/HTML/JSON prose and prototype keys stay hidden", async () => {
  for (const locale of locales) {
    const messages = locale === "en-US" ? en : fa;
    const errors = createTranslator({ locale, messages, namespace: "AccountErrors" });
    const fallback = messages.Accounts.createFailed;
    for (const [status, error, key] of [[409, "Account code already exists", "duplicateCode"], [409, "Cannot delete account with existing transactions", "hasTransactions"], [403, "secret", "forbidden"], [401, "secret", "unauthenticated"], [422, "secret", "invalidInput"]] as const) {
      await assert.rejects(requireAccountResponse(Response.json({ error }, { status }), errors, fallback), { message: messages.AccountErrors[key] });
    }
    for (const error of ["constructor", "__proto__", "<script>secret</script>"]) await assert.rejects(requireAccountResponse(Response.json({ error }, { status: 500 }), errors, fallback), { message: fallback });
    await assert.rejects(requireAccountResponse(new Response("secret", { status: 500 }), errors, fallback), { message: fallback });
    assert.equal(accountFailureMessage(new Error("secret"), fallback), fallback);
    const response = Response.json({ account: sample });
    assert.deepEqual(await (await requireAccountResponse(response, errors, fallback)).json(), { account: sample });
  }
});

test("production account create/save callbacks retain canonical payloads and never succeed after failed requests", async () => {
  for (const locale of locales) for (const operation of ["create", "save"] as const) for (const failure of ["success", "forbidden", "network", "json"] as const) for (const isSystem of operation === "save" ? [true, false] : [false]) {
    const messages = locale === "en-US" ? en : fa;
    const successes: string[] = [], failures: string[] = [], bodies: Record<string, unknown>[] = [], saving: boolean[] = [];
    let changes = 0;
    const fields: Record<string, string> = { code: "1000", name: "نام کاربر", type: "asset", subType: "", description: "", isActive: "true" };
    const run = callback(operation === "create" ? drawer : settings, operation === "create" ? "handleSubmit" : "handleSave", {
      t: createTranslator({ locale, messages, namespace: "Accounts" }), errors: createTranslator({ locale, messages, namespace: "AccountErrors" }), requireAccountResponse, accountFailureMessage,
      orgId: "org-a", id: "account-a", account: sample, isSystem, acctCurrency: "EUR", localStorage: { getItem: () => "org-a" },
      FormData: class { get(key: string) { return fields[key]; } }, setSaving: (v: boolean) => saving.push(v),
      setAccount: () => { changes++; }, refetch: () => { changes++; }, onClose: () => { changes++; }, window: { dispatchEvent: () => { changes++; } }, CustomEvent: class {},
      toast: { success: (v: string) => successes.push(v), error: (v: string) => failures.push(v) },
      fetch: async (url: string, init: RequestInit) => {
        assert.equal(url, operation === "create" ? "/api/v1/accounts" : "/api/v1/accounts/account-a");
        assert.equal(init.method, operation === "create" ? "POST" : "PATCH");
        assert.equal((init.headers as Record<string, string>)["x-organization-id"], "org-a");
        bodies.push(JSON.parse(String(init.body)));
        if (failure === "network") throw new Error("network-secret");
        if (failure === "json") return new Response("bad-json-secret", { status: operation === "create" ? 500 : 200 });
        return Response.json({ account: sample, error: "server-secret" }, { status: failure === "forbidden" ? 403 : 200 });
      },
    }, operation === "create" ? "AccountDrawer" : undefined);
    await run({ preventDefault: noop, currentTarget: {} });
    const expected = { subType: null, description: null, ...(operation === "create" ? { currencyCode: "EUR", type: "asset" } : { isActive: true }), ...(!isSystem ? { code: "1000", name: "نام کاربر" } : {}) };
    assert.deepEqual(bodies, [expected]);
    assert.deepEqual(saving, [true, false]);
    assert.equal(successes.length, failure === "success" ? 1 : 0);
    assert.equal(changes > 0, failure === "success");
    assert.equal(failures.length, failure === "success" ? 0 : 1);
    assert.ok(failures.every(v => !v.includes("secret")));
  }
});

test("production delete and status confirmations preserve payloads and stay open on failures", async () => {
  for (const locale of locales) for (const operation of ["handleDelete", "handleDeactivate"] as const) for (const active of [true, false]) for (const failure of ["success", "forbidden", "network", "html"] as const) {
    const ok = failure === "success";
    const messages = locale === "en-US" ? en : fa;
    const successes: string[] = [], failures: string[] = [];
    let changes = 0;
    const run = callback(settings, operation, {
      t: createTranslator({ locale, messages, namespace: "Accounts" }), errors: createTranslator({ locale, messages, namespace: "AccountErrors" }), requireAccountResponse, accountFailureMessage,
      orgId: "org-a", id: "account-a", account: { ...sample, isActive: active },
      confirm: async (options: { cancelLabel: string; destructive: boolean; onConfirm(): Promise<void> }) => { assert.equal(options.cancelLabel, messages.Accounts.cancel); assert.equal(options.destructive, operation === "handleDelete" || active); await options.onConfirm(); },
      refetch: () => { changes++; }, router: { push: () => { changes++; } }, window: { dispatchEvent: () => { changes++; } }, CustomEvent: class {},
      toast: { success: (v: string) => successes.push(v), error: (v: string) => failures.push(v) },
      fetch: async (url: string, init: RequestInit) => {
        assert.equal(url, "/api/v1/accounts/account-a");
        assert.equal(init.method, operation === "handleDelete" ? "DELETE" : "PATCH");
        assert.equal((init.headers as Record<string, string>)["x-organization-id"], "org-a");
        if (operation === "handleDeactivate") assert.deepEqual(JSON.parse(String(init.body)), { isActive: !active });
        if (failure === "network") throw new Error("network-secret");
        if (failure === "html") return new Response("html-secret", { status: 500 });
        return Response.json({ error: "server-secret" }, { status: ok ? 200 : 403 });
      },
    });
    if (ok) await run(); else await assert.rejects(run());
    assert.equal(changes, ok ? 2 : 0);
    assert.equal(successes.length, ok ? 1 : 0);
    assert.deepEqual(failures, ok ? [] : [failure === "forbidden" ? messages.AccountErrors.forbidden : operation === "handleDelete" ? messages.Accounts.deleteFailed : messages.Accounts.updateAccountFailed]);
  }
});

test("account read callback still rejects contradictory exact-money aliases before state adoption", async () => {
  for (const locale of locales) for (const valid of [false, true]) {
    const messages = locale === "en-US" ? en : fa;
    const adopted: unknown[] = [], errors: unknown[] = [];
    const run = callback(`${base}/[id]/layout.tsx`, "fetchAccount", {
      t: createTranslator({ locale, messages, namespace: "Accounts" }), errors: createTranslator({ locale, messages, namespace: "AccountErrors" }), requireAccountResponse, accountFailureMessage, coreAccountMoney,
      orgId: "org-a", id: "account-a", setAccount: (v: unknown) => adopted.push(v), setError: (v: unknown) => errors.push(v), setLoading: noop,
      fetch: async () => Response.json({ account: { ...sample, balanceMinor: valid ? "1250" : "1251" } }),
    });
    run(); await new Promise(resolve => setImmediate(resolve));
    assert.equal(adopted[0] !== null, valid);
    assert.deepEqual(errors, [valid ? null : messages.Accounts.invalidAccountAmounts]);
  }
  assert.throws(() => coreLedgerMoney({ debitAmount: 1, debitAmountMinor: "2", creditAmount: 0, creditAmountMinor: "0", balance: 1, balanceMinor: "1", amountCurrencyCode: "USD" }));
});

test("the bounded account slice contains no remaining authored JSX copy outside catalogs", () => {
  const paths = [`${base}/page.tsx`, `${base}/[id]/layout.tsx`, `${base}/[id]/page.tsx`, settings, "app/(dashboard)/accounting/layout.tsx", "components/dashboard/account-picker.tsx", drawer];
  for (const path of paths) {
    const ast = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(node: ts.Node) {
      if (path === drawer && ts.isFunctionDeclaration(node) && node.name?.text !== "AccountDrawer") return;
      if (ts.isJsxText(node)) assert.ok(!/\p{L}/u.test(node.text), `${path}: ${node.text.trim()}`);
      if (ts.isJsxAttribute(node) && ["title", "placeholder", "aria-label", "emptyMessage", "label", "header"].includes(node.name.getText(ast)) && node.initializer && ts.isStringLiteral(node.initializer)) assert.ok(!/\p{L}/u.test(node.initializer.text), `${path}: ${node.getText(ast)}`);
      ts.forEachChild(node, visit);
    }
    visit(ast);
  }
});
