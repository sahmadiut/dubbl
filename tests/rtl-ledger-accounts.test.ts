import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import * as React from "react";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import * as intl from "next-intl";
import ts from "typescript";
import { compile } from "tailwindcss";
import * as Provider from "../i18n/provider";
import { resolvePresentation } from "../i18n/locale";
import { journalMoney } from "../lib/money/journal-display";
import { accountDisplayName } from "../i18n/account-names";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const h = React.createElement, noop = () => {};
const caller = "  حساب Caller <ACME/001> & " + "long-name-".repeat(30);
const code = "  001-AB/حساب  ", minor = "4000000000000001";
const account = { id: "account/001", code, name: caller, type: "asset", subType: caller,
  description: caller, currencyCode: "KWD", amountCurrencyCode: "USD", isActive: true, isSystem: false,
  balance: Number(minor), balanceMinor: minor, totalDebits: Number(minor), totalDebitsMinor: minor,
  totalCredits: 1, totalCreditsMinor: "1", entryCount: 2 };
const row = { entryId: "entry/001", entryNumber: 42, date: "2026-10-26", description: caller,
  debitAmount: Number(minor), debitAmountMinor: minor, creditAmount: 0, creditAmountMinor: "0",
  balance: Number(minor), balanceMinor: minor, amountCurrencyCode: "USD" };
const presentations = (["en-US", "fa-IR"] as const).flatMap(language =>
  (["latn", "arabext"] as const).map(numerals => resolvePresentation({ user: { language, numerals } })));
const escape = (s: string) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
type Props = Record<string, unknown>;
const require = createRequire(import.meta.url);
const CommonJsProvider = (require("../i18n/provider") as typeof Provider).PresentationProvider;

// Production components, provider, Radix controls, table and money renderers remain real.
// Only state scheduling, route, drawer and account context IO are controlled.
function loaded(relative: string, states: Props = {}, current = account) {
  const file = "app/(dashboard)/accounting/accounts/" + relative, source = readFileSync(file, "utf8");
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const main = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.modifiers?.some(m => m.kind === ts.SyntaxKind.DefaultKeyword));
  assert.ok(main);
  const names: string[] = [];
  function hooks(n: ts.Node) {
    if (ts.isVariableDeclaration(n) && ts.isArrayBindingPattern(n.name) && n.initializer && ts.isCallExpression(n.initializer)
      && n.initializer.expression.getText(ast) === "useState") names.push(n.name.elements[0].getText(ast));
    ts.forEachChild(n, hooks);
  }
  hooks(main);
  const controls: { type: unknown; props: Props }[] = [], updates: unknown[][] = [], events: unknown[] = [];
  const capture = (create: typeof jsx.jsx) => (type: React.ElementType, props: Props, key?: string) => {
    controls.push({ type, props }); return create(type, props, key);
  };
  let index = 0;
  const compiled = { exports: {} as Record<string, React.ComponentType> }, localRequire = createRequire(resolve(file));
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function("require", "module", "exports", js)((id: string) => {
    if (id === "react") return { ...React, useState: (initial: unknown) => {
      const key = names[index++]; return [key in states ? states[key] : typeof initial === "function" ? initial() : initial,
        (value: unknown) => updates.push([key, value])];
    }, useEffect: noop, useRef: (value: unknown) => ({ current: value }), useMemo: (fn: () => unknown) => fn(), useCallback: (fn: unknown) => fn };
    if (id === "react/jsx-runtime") return { ...jsx, jsx: capture(jsx.jsx), jsxs: capture(jsx.jsxs) };
    if (id === "next-intl") return intl;
    if (id.endsWith("/i18n/provider")) return Provider;
    if (id === "next/navigation") return { useParams: () => ({ id: current.id }),
      usePathname: () => `/accounting/accounts/${current.id}`,
      useRouter: () => ({ push: (url: unknown) => events.push(url) }) };
    if (id === "../layout") return { useAccountContext: () => ({ account: current, setAccount: noop, refetch: noop }) };
    if (id.endsWith("/use-document-title")) return { useDocumentTitle: noop };
    if (id.endsWith("/use-debounce")) return { useDebounce: (v: unknown) => v };
    if (id.endsWith("/use-confirm")) return { useConfirm: () => ({ confirm: noop, dialog: null }) };
    if (id.endsWith("/create-drawer")) return { useCreateDrawer: () => ({ open: (...args: unknown[]) => events.push(args) }) };
    return localRequire(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  }, compiled, compiled.exports);
  return { controls, updates, events, render(p: typeof presentations[number]) {
    index = 0; controls.length = 0;
    const props = { presentation: p, messages: p.locale === "fa-IR" ? fa : en, now: new Date("2026-10-26T00:00:00Z") };
    return renderToStaticMarkup(h(Provider.PresentationProvider, props, h(CommonJsProvider, props, h(compiled.exports.default))));
  } };
}

function control(page: ReturnType<typeof loaded>, predicate: (c: { type: unknown; props: Props }) => boolean) {
  const found = page.controls.find(predicate); assert.ok(found); return found.props;
}

test("actual account rows isolate long caller/code values and preserve routes, raw search, type and sort callbacks", () => {
  const snapshot = JSON.stringify(account, (_, value) => typeof value === "bigint" ? value.toString() : value);
  for (const p of presentations) {
    const page = loaded("page.tsx", { accounts: [account], loading: false }), html = page.render(p);
    const labels = (p.locale === "fa-IR" ? fa : en).Accounts;
    assert.ok(html.includes(`>${escape(caller)}</bdi>`));
    assert.match(html, new RegExp(`<bdi[^>]*dir="ltr"[^>]*>${escape(code)}</bdi>`));
    assert.ok(!html.includes("<ACME/001>") && !html.includes("truncate"));
    const search = control(page, c => c.props.placeholder === labels.searchAccounts);
    assert.equal(search.dir, "auto"); assert.equal(search["aria-label"], labels.searchAccounts);
    (search.onChange as (e: unknown) => void)({ target: { value: code } });
    assert.deepEqual(page.updates.at(-1), ["search", code]);
    const tabs = control(page, c => c.props.value === "all" && typeof c.props.onValueChange === "function");
    assert.equal(tabs.dir, p.locale === "fa-IR" ? "rtl" : "ltr");
    (tabs.onValueChange as (value: string) => void)("liability"); assert.deepEqual(page.updates.at(-1), ["typeFilter", "liability"]);
    const sort = control(page, c => c.props.value === "code:asc" && typeof c.props.onValueChange === "function");
    (sort.onValueChange as (value: string) => void)("name:desc"); assert.deepEqual(page.updates.at(-1), ["sort", "name:desc"]);
    const item = control(page, c => c.type === "button" && String(c.props.className).includes("w-full flex"));
    assert.equal(item.type, "button"); (item.onClick as () => void)(); assert.equal(page.events.at(-1), "/accounting/accounts/account/001");
    assert.ok(String(item.className).includes("flex-wrap") && String(item.className).includes("text-start"));
    const create = control(page, c => typeof c.props.onClick === "function" && String(c.props.className).includes("bg-emerald-600"));
    (create.onClick as () => void)(); assert.deepEqual(page.events.at(-1), ["account"]);
    assert.ok(page.controls.some(c => c.props["aria-label"] === labels.sortBy));
    const empty = loaded("page.tsx", { accounts: [], loading: false }).render(p);
    assert.ok(empty.includes(labels.example1000) && empty.includes("grid-cols-1"));
  }
  assert.equal(JSON.stringify(account, (_, value) => typeof value === "bigint" ? value.toString() : value), snapshot);
});

test("actual account header isolates bigint summary, caller and exact code and keeps directional navigation semantics", () => {
  for (const p of presentations) {
    const page = loaded("[id]/layout.tsx", { account, loading: false }), html = page.render(p);
    assert.ok(html.includes(`>${escape(caller)}</bdi>`));
    assert.ok(html.includes(escape(journalMoney(BigInt(minor), "USD", p))));
    assert.match(html, /<bdi[^>]*dir="ltr"[^>]*>2<\/bdi>/);
    assert.ok(html.includes("rtl:rotate-180") && html.includes('aria-current="page"'));
    assert.ok(html.includes(escape(code)) && html.includes("flex-wrap"));
    const active = control(page, c => c.props["aria-current"] === "page");
    assert.equal(active.type, "button"); (active.onClick as () => void)();
    assert.equal(page.events.at(-1), "/accounting/accounts/account/001");
    const back = control(page, c => c.type === "button" && String(c.props.className).includes("mb-6"));
    (back.onClick as () => void)(); assert.equal(page.events.at(-1), "/accounting/accounts");
  }
});

test("actual ledger keeps canonical entry/date and bigint low digits with exact filter callbacks", () => {
  for (const p of presentations) {
    const page = loaded("[id]/page.tsx", { ledger: [row], loading: false, total: 1, hasMore: false });
    const html = page.render(p), labels = (p.locale === "fa-IR" ? fa : en).Accounts;
    assert.ok(html.includes('href="/accounting/entry/001"'));
    assert.match(html, /<bdi[^>]*dir="ltr"[^>]*>42<\/bdi>/);
    assert.match(html, /<bdi[^>]*dir="ltr"[^>]*>2026-10-26<\/bdi>/);
    assert.ok(html.includes(`>${escape(caller)}</bdi>`));
    assert.ok(html.includes(escape(journalMoney(BigInt(minor), "USD", p))));
    const table = control(page, c => Array.isArray(c.props.data) && c.props.data[0] === row);
    const columns = table.columns as { key: string; className?: string; render: (entry: typeof row) => React.ReactNode }[];
    for (const key of ["debit", "credit", "balance"]) assert.ok(columns.find(c => c.key === key)?.className?.includes("text-end"));
    const credit = columns.find(c => c.key === "credit")!;
    assert.equal(renderToStaticMarkup(h(React.Fragment, null, credit.render(row))).replace(/<[^>]*>/g, ""), "");
    const search = control(page, c => c.props.placeholder === labels.searchLedger);
    assert.equal(search.dir, "auto"); assert.equal(search["aria-label"], labels.searchLedger);
    (search.onChange as (e: unknown) => void)({ target: { value: code } }); assert.deepEqual(page.updates.at(-1), ["search", code]);
    const start = control(page, c => c.props.placeholder === labels.startDate);
    (start.onChange as (v: string) => void)("2026-01-02"); assert.deepEqual(page.updates.at(-1), ["dateFrom", "2026-01-02"]);
    assert.ok(page.controls.some(c => c.props.role === "group" && c.props["aria-label"] === labels.startDate));
    assert.ok(page.controls.some(c => c.props.role === "group" && c.props["aria-label"] === labels.endDate));
  }
});

test("actual account settings label native fields, retain caller values and built-in locks in both numeral systems", () => {
  for (const p of presentations) for (const isSystem of [false, true]) {
    const current = isSystem ? { ...account, code: "1000", name: "Cash on Hand", subType: "cash", isSystem } : account;
    const page = loaded("[id]/settings/page.tsx", {}, current), html = page.render(p);
    const labels = (p.locale === "fa-IR" ? fa : en).Accounts;
    const names = intl.createTranslator({ locale: p.locale, messages: p.locale === "fa-IR" ? fa : en, namespace: "AccountNames" });
    for (const [name, label, dir, value] of [["code", labels.accountCode, "ltr", current.code],
      ["name", labels.accountName, "auto", accountDisplayName(names, current)],
      ["subType", labels.subType, "auto", current.subType], ["description", labels.description, "auto", current.description]]) {
      const field = control(page, c => c.props.name === name);
      assert.equal(field.defaultValue, value); assert.equal(field.dir, dir); assert.equal(field["aria-label"], label);
      assert.ok(html.includes(`for="${field.id}"`));
      if (name === "code" || name === "name") assert.equal(field.disabled, isSystem);
    }
    assert.ok(page.controls.some(c => c.props.name === "isActive" && c.props.defaultValue === "true"));
    assert.ok(page.controls.some(c => c.props["aria-label"] === labels.status));
    assert.ok(html.includes("sm:flex-wrap") && html.includes("whitespace-normal"));
  }
});

test("installed account CSS supports logical search/amount geometry, wrapping tabs and unclamped selection", async () => {
  const compiler = await compile("@theme { --spacing:0.25rem; --breakpoint-sm:40rem; } @tailwind utilities;");
  const css = compiler.build(["start-3", "ps-9", "me-2", "ms-auto", "text-start", "text-end", "flex-wrap", "sm:flex-nowrap",
    "sm:flex-wrap", "[overflow-wrap:anywhere]", "rtl:rotate-180", "group-data-[orientation=horizontal]/tabs:h-auto",
    "[&_[role=tab]]:whitespace-normal", "data-[size=default]:h-auto", "*:data-[slot=select-value]:line-clamp-none"]);
  for (const declaration of ["inset-inline-start:", "padding-inline-start:", "margin-inline-end:", "margin-inline-start: auto",
    "text-align: start", "text-align: end", "flex-wrap: wrap", "flex-wrap: nowrap", "overflow-wrap: anywhere", "rotate: 180deg",
    "height: auto", "white-space: normal", "-webkit-line-clamp: unset"])
    assert.ok(css.includes(declaration), declaration);
});
