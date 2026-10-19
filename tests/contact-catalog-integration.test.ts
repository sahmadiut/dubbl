import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import * as React from "react";
import { createElement, type ComponentType, type ReactNode } from "react";
import * as jsxRuntime from "react/jsx-runtime";
import * as nextIntl from "next-intl";
import { createTranslator } from "next-intl";
import ts from "typescript";
import * as DatePicker from "../components/ui/date-picker";
import * as BrandLoader from "../components/dashboard/brand-loader";
import { contactDetailUi, contactCreditDecimal, contactStatementUi, displayMoney } from "../lib/money/contact-dashboard-ui";
import { renderWithPresentation } from "./helpers/presentation";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const root = "app/(dashboard)/contacts";
const layout = `${root}/[id]/layout.tsx`;
const tabs = ["details", "activity", "statement", "bookkeeping", "people", "files"] as const;
type Tab = typeof tabs[number];
const noop = () => {};
const caller = '<script>\u0645\u062e\u0627\u0637\u0628 & contact</script>';
const person = { id: "person-a", name: caller, email: "person@example.test", phone: "+98-123", jobTitle: caller, isPrimary: true, notes: null };
const raw = { id: "contact-a", name: caller, email: "contact@example.test", phone: null, taxNumber: null, type: "both", paymentTermsDays: 45,
  creditLimit: 9007199254740991, creditLimitMinor: "9007199254740991", currencyCode: "USD", isTaxExempt: true, is1099Vendor: true,
  defaultRevenueAccountId: "revenue-a", defaultExpenseAccountId: "expense-a", defaultTaxRateId: "tax-a",
  defaultRevenueAccount: null, defaultExpenseAccount: null, defaultTaxRate: null, notes: caller, people: [person], createdAt: "2026-10-19T00:00:00Z" };
type Captured = { kind: string; props: Record<string, unknown> };
function parse(path: string) { return ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX); }
function contains(html: string, value: string) {
  const escaped = value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
  assert.ok(html.includes(escaped), value);
}

// Layout and all six pages share one production module cache and the actual
// ContactContext. Initial state/effects/navigation and portal boundaries are
// controlled. State setters persist for explicit rerenders; form callbacks are
// captured from production JSX with their real closures, not extracted/rebuilt.
function composition(currencyCode = "USD", options: { empty?: boolean; missing?: boolean; loading?: boolean; fetch?: typeof fetch } = {}) {
  const contact = contactDetailUi({ ...raw, currencyCode, people: options.empty ? [] : [person] });
  const shared: Record<string, unknown> = { contact: options.missing ? null : contact, loading: options.loading ?? false,
    formType: "both", formRevenueAccountId: "revenue-a", formExpenseAccountId: "expense-a", formTaxRateId: "tax-a",
    formTaxExempt: true, form1099Vendor: true, formCreditLimit: contactCreditDecimal(contact.creditLimit!, currencyCode), formCurrencyCode: currencyCode };
  const captured: Captured[] = [], events: unknown[] = [];
  const cache = new Map<string, { exports: Record<string, unknown> }>();
  let active: Tab = "details";
  const statement = contactStatementUi({ contact: { id: raw.id, name: caller, email: raw.email, type: raw.type }, currencyCode,
    startDate: "2026-01-01", endDate: "2026-10-19", openingBalance: 0, openingBalanceMinor: "0",
    closingBalance: raw.creditLimit, closingBalanceMinor: raw.creditLimitMinor, totalDebit: raw.creditLimit, totalDebitMinor: raw.creditLimitMinor,
    totalCredit: 0, totalCreditMinor: "0", transactions: [{ date: "2026-10-19", type: "invoice", documentNumber: caller, description: caller,
      currencyCode, debit: raw.creditLimit, debitMinor: raw.creditLimitMinor, credit: 0, creditMinor: "0", balance: raw.creditLimit, balanceMinor: raw.creditLimitMinor }] });
  const pageStates: Record<string, unknown> = { accounts: [{ id: "revenue-a", code: "4000", name: caller, type: "revenue" }, { id: "expense-a", code: "5000", name: caller, type: "expense" }],
    taxRates: [{ id: "tax-a", name: caller, rate: 1250 }], activityHasMore: false,
    activityItems: options.empty ? [] : [{ id: "invoice-a", type: "invoice", number: caller, status: "draft", amount: contact.creditLimit, currencyCode, date: "2026-10-19", createdAt: raw.createdAt }],
    statementData: options.empty ? null : statement,
    files: options.empty ? [] : [{ id: "file-a", fileName: caller, fileSize: 1024, mimeType: "application/pdf", visibility: "private", uploadedBy: null, createdAt: raw.createdAt }] };
  const inline = (kind: string) => function Control(props: Record<string, unknown>) {
    captured.push({ kind, props });
    return createElement("div", { "data-control": kind, "data-value": props.value, title: props.title as string | undefined }, props.children as ReactNode,
      typeof props.placeholder === "string" ? createElement("span", null, props.placeholder) : null);
  };
  function loadModule(file: string): Record<string, unknown> {
    const path = resolve(file);
    if (cache.has(path)) return cache.get(path)!.exports;
    const compiled = { exports: {} as Record<string, unknown> };
    cache.set(path, compiled);
    const ast = parse(path), names: string[] = [];
    function hooks(n: ts.Node) {
      if (ts.isVariableDeclaration(n) && ts.isArrayBindingPattern(n.name) && n.initializer && ts.isCallExpression(n.initializer) && n.initializer.expression.getText(ast) === "useState") names.push(n.name.elements[0].getText(ast));
      ts.forEachChild(n, hooks);
    }
    hooks(ast);
    const state = path === resolve(layout) ? shared : { ...pageStates };
    let index = 0;
    const require = createRequire(path);
    const load = (id: string): unknown => {
      if (id === "react") return { ...React, useState: (initial: unknown) => {
        const key = names[index++];
        assert.ok(key, `Unexpected state hook in ${path}`);
        if (!Object.hasOwn(state, key)) state[key] = typeof initial === "function" ? initial() : initial;
        return [state[key], (value: unknown) => { state[key] = typeof value === "function" ? value(state[key]) : value; }];
      }, useEffect: noop, useCallback: (fn: unknown) => fn };
      if (id === "react/jsx-runtime") return { ...jsxRuntime, jsx: captureJsx(jsxRuntime.jsx), jsxs: captureJsx(jsxRuntime.jsxs) };
      if (id === "next-intl") return nextIntl;
      if (id === "next/navigation") return { useParams: () => ({ id: raw.id }), usePathname: () => `/contacts/${raw.id}${active === "details" ? "" : `/${active}`}`, useRouter: () => ({ push: noop }) };
      if (id === "sonner") return { toast: { success: (s: string) => events.push(s), error: (s: string) => events.push(s) } };
      if (id.endsWith("/use-entity-title")) return { useEntityTitle: noop };
      if (id.endsWith("/use-confirm")) return { useConfirm: () => ({ confirm: noop, dialog: null }) };
      if (id.endsWith("/create-drawer")) return { useCreateDrawer: () => ({ open: noop }) };
      if (id.endsWith("/ui/date-picker")) return DatePicker;
      if (id.endsWith("/brand-loader")) return BrandLoader;
      if (["/ui/select", "/ui/dialog", "/ui/currency-select", "/ui/currency-input"].some(suffix => id.endsWith(suffix))) return new Proxy({}, { get: (_target, key) => inline(String(key)) });
      if (id.startsWith(".")) return loadModule(resolve(dirname(path), `${id}.tsx`));
      return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
    };
    function captureJsx(make: typeof jsxRuntime.jsx): typeof jsxRuntime.jsx {
      return (type, props, key) => {
        if (type === "form") captured.push({ kind: "form", props: props as Record<string, unknown> });
        return make(type, props, key);
      };
    }
    const code = ts.transpileModule(ast.text, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
    new Function("require", "module", "exports", "fetch", "localStorage", code)(load, compiled, compiled.exports,
      options.fetch ?? (() => { throw new Error("Unexpected IO in composition rendering"); }), { getItem: () => "org-a" });
    const Original = compiled.exports.default as (props: Record<string, unknown>) => ReactNode;
    compiled.exports.default = (props: Record<string, unknown>) => { index = 0; return Original(props); };
    return compiled.exports;
  }
  const Layout = loadModule(layout).default as ComponentType<{ children: ReactNode }>;
  return { captured, events, shared, render(tab: Tab, locale: "en-US" | "fa-IR") {
    active = tab;
    captured.length = 0;
    const path = `${root}/[id]/${tab === "details" ? "" : `${tab}/`}page.tsx`;
    const Page = loadModule(path).default as ComponentType;
    return renderWithPresentation(createElement(Layout, null, createElement(Page)), locale);
  }, loading(locale: "en-US" | "fa-IR") {
    const Loading = loadModule(`${root}/loading.tsx`).default as ComponentType;
    return renderWithPresentation(createElement(Loading), locale);
  } };
}

test("all six contact pages compose with the real shell/context, bilingual catalogs and exact currencies", () => {
  for (const locale of ["en-US", "fa-IR"] as const) for (const currency of ["USD", "JPY", "KWD"]) {
    const c = composition(currency), m = locale === "en-US" ? en : fa;
    const headings = { details: m.ContactDetails.general, activity: m.ContactActivity.all, statement: m.ContactStatement.opening,
      bookkeeping: m.ContactBookkeeping.accounts, people: m.ContactPeople.title, files: m.ContactFiles.title };
    for (const tab of tabs) {
      const html = c.render(tab, locale);
      for (const label of [m.ContactDetails.tabsDetails, m.ContactDetails.tabsActivity, m.ContactDetails.tabsStatement, m.ContactDetails.tabsBookkeeping, m.ContactDetails.tabsPeople, m.ContactDetails.tabsFiles, headings[tab]]) contains(html, label);
      contains(html, caller);
      assert.ok(!html.includes("<script>") && !html.includes("MISSING_MESSAGE"));
      assert.equal((html.match(/border-foreground text-foreground/g) ?? []).length, 1);
      if (tab === "details") {
        assert.equal(c.captured.find(v => v.kind === "CurrencyInput")!.props.value, contactCreditDecimal(9007199254740991n, currency));
        assert.equal(c.captured.find(v => v.kind === "CurrencySelect")!.props.value, currency);
      }
      if (tab === "activity" || tab === "statement") contains(html, displayMoney(9007199254740991n, currency));
      if (tab === "activity") contains(html, m.ContactActivity.typeInvoice); // actual layout configuration
      if (tab === "bookkeeping") assert.deepEqual(c.captured.filter(v => v.kind === "SelectItem").map(v => v.props.value), ["none", "revenue-a", "none", "expense-a", "none", "tax-a"]);
      if (tab === "people") contains(html, m.ContactPeople.primary);
      if (tab === "files") contains(html, m.ContactFiles.private);
    }
  }
});

test("shared contact state reaches bookkeeping submit and both tabs observe pending and failed saves", async () => {
  for (const locale of ["en-US", "fa-IR"] as const) for (const invalid of [false, true]) {
    let finish!: (response: Response) => void;
    const requests: { url: string; init?: RequestInit }[] = [];
    const c = composition("KWD", { fetch: (async (url, init) => {
      requests.push({ url: String(url), init });
      return new Promise<Response>(resolve => { finish = resolve; });
    }) as typeof fetch });
    c.render("details", locale);
    (c.captured.find(v => v.kind === "CurrencyInput")!.props.onChange as (v: string) => void)("123456.789");
    c.render("bookkeeping", locale);
    const submit = c.captured.find(v => v.kind === "form")!.props.onSubmit as (e: { preventDefault: () => void }) => Promise<void>;
    const pending = submit({ preventDefault: noop });
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, "/api/v1/contacts/contact-a");
    assert.equal(requests[0].init!.method, "PATCH");
    assert.deepEqual(requests[0].init!.headers, { "Content-Type": "application/json", "x-organization-id": "org-a" });
    assert.deepEqual(JSON.parse(requests[0].init!.body as string), { name: caller, email: raw.email, phone: null, taxNumber: null, type: "both", paymentTermsDays: 45,
      creditLimitMinor: "123456789", isTaxExempt: true, currencyCode: "KWD", defaultRevenueAccountId: "revenue-a", defaultExpenseAccountId: "expense-a", defaultTaxRateId: "tax-a", notes: caller });
    for (const tab of ["details", "bookkeeping"] as const) assert.match(c.render(tab, locale), /<button(?=[^>]*type="submit")(?=[^>]*disabled="")[^>]*>/);
    finish(Response.json({ contact: { ...raw, currencyCode: "KWD", creditLimit: 123456789, creditLimitMinor: invalid ? "1" : "123456789" } }));
    await pending;
    assert.equal(c.shared.saving, false);
    const m = locale === "en-US" ? en : fa;
    assert.deepEqual(c.events, [invalid ? m.ContactBookkeeping.updateFailed : m.ContactBookkeeping.updated]);
    assert.equal((c.shared.contact as { creditLimit: bigint }).creditLimit, invalid ? 9007199254740991n : 123456789n);
    const html = c.render("details", locale);
    assert.ok(!/<button(?=[^>]*type="submit")(?=[^>]*disabled="")[^>]*>/.test(html));
    assert.equal(c.captured.find(v => v.kind === "CurrencyInput")!.props.value, "123456.789");
  }
});

test("combined empty, missing and loading states exclude stale tab content", () => {
  for (const locale of ["en-US", "fa-IR"] as const) {
    const m = locale === "en-US" ? en : fa;
    const empty = composition("USD", { empty: true });
    for (const [tab, label] of [["people", m.ContactPeople.empty], ["files", m.ContactFiles.empty], ["activity", m.ContactActivity.empty], ["statement", m.ContactStatement.empty]] as const) contains(empty.render(tab, locale), label);
    const missing = composition("USD", { missing: true }), loading = composition("USD", { loading: true });
    for (const tab of tabs) {
      const html = missing.render(tab, locale);
      contains(html, m.ContactDetails.missing);
      assert.ok(!html.includes("<form") && !html.includes(caller) && !html.includes("<nav"));
      const busy = loading.render(tab, locale);
      contains(busy, m.SharedUI.loading2);
      assert.ok(!busy.includes("<form") && !busy.includes("<nav"));
    }
    contains(loading.loading(locale), m.SharedUI.loading2);
  }
});

test("combined contacts inventory audits every route, picker and owned drawer with exact exceptions", () => {
  function routes(path: string): string[] {
    return readdirSync(path, { withFileTypes: true }).flatMap(e => e.isDirectory() ? routes(`${path}/${e.name}`) : e.name.endsWith(".tsx") ? [`${path}/${e.name}`] : []);
  }
  const expected = ["page.tsx", "loading.tsx", "[id]/layout.tsx", "[id]/page.tsx", ...tabs.filter(t => t !== "details").map(t => `[id]/${t}/page.tsx`)].map(p => `${root}/${p}`);
  assert.deepEqual(routes(root).sort(), expected.sort(), "Review added/removed routes in parent inventory");
  const drawer = "components/dashboard/create-drawer.tsx";
  for (const path of [...expected, "components/dashboard/contact-picker.tsx", drawer]) {
    const ast = parse(path);
    function visit(n: ts.Node) {
      if (path === drawer && n.parent === ast && !(ts.isFunctionDeclaration(n) && n.name?.text === "ContactDrawer")) return;
      if (ts.isJsxText(n)) assert.ok(!/[A-Za-z]/.test(n.text), `${path}: ${n.text}`);
      if (ts.isJsxAttribute(n) && ["title", "description", "placeholder", "aria-label", "label", "alt"].includes(n.name.getText(ast)) && n.initializer && ts.isStringLiteral(n.initializer)) {
        if ([`${root}/[id]/page.tsx`, drawer].includes(path) && n.name.getText(ast) === "placeholder" && ["email@example.com", "+1 (555) 000-0000"].includes(n.initializer.text)) return;
        assert.ok(!/[A-Za-z]/.test(n.initializer.text), `${path}: ${n.getText(ast)}`);
      }
      ts.forEachChild(n, visit);
    }
    ts.forEachChild(ast, visit);
  }
  const namespaces = ["Contacts", "ContactDetails", "ContactPeople", "ContactFiles", "ContactBookkeeping", "ContactActivity", "ContactStatement"] as const;
  for (const ns of namespaces) {
    assert.deepEqual(Object.keys(en[ns]).sort(), Object.keys(fa[ns]).sort());
    for (const value of Object.values(fa[ns])) assert.match(value, /[\u0600-\u06ff]/);
    for (const locale of ["en-US", "fa-IR"] as const) {
      const t = createTranslator({ locale, messages: locale === "en-US" ? en : fa, namespace: ns });
      for (const key of Object.keys(en[ns]) as (keyof typeof en[typeof ns])[]) {
        // Real combined renders exercise rich/ICU messages with their values;
        // the schema check also pins all finite keys without translating data.
        assert.equal(t.has(key), true);
      }
    }
  }
});
