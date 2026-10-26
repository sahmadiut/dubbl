import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { test } from "node:test";
import * as React from "react";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import * as intl from "next-intl";
import ts from "typescript";
import * as Provider from "../i18n/provider";
import { resolvePresentation } from "../i18n/locale";
import { journalMoney } from "../lib/money/journal-display";
import { budgetMoney } from "../lib/money/budget-ui";
import { currencyLabel } from "../i18n/currency-labels";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const h = React.createElement, noop = () => {};
const require = createRequire(import.meta.url);
const CjsProvider = (require("../i18n/provider") as typeof Provider).PresentationProvider;
const root = "app/(dashboard)/accounting/";
const caller = "  \u062d\u0633\u0627\u0628 Caller <ACME/001> & " + "long-name-".repeat(30);
const code = "001-AB/\u062d\u0633\u0627\u0628", minor = 4000000000000001n;
const account = { id: "account-a", code, name: caller, type: "asset", subType: caller,
  description: caller, currencyCode: "KWD", amountCurrencyCode: "USD", isActive: true, isSystem: false,
  balance: Number(minor), balanceMinor: String(minor), totalDebits: Number(minor), totalDebitsMinor: String(minor),
  totalCredits: 1, totalCreditsMinor: "1", entryCount: 2 };
const budget = { id: "budget-a", name: caller, startDate: "2026-01-01", endDate: "2026-01-31",
  periodType: "monthly", isActive: true, createdAt: "2026-01-01T00:00:00Z",
  lines: [{ id: "line-a", accountId: account.id, account, total: minor,
    periods: [{ id: "period-a", label: "Jan 2026", startDate: "2026-01-01", endDate: "2026-01-31", amount: minor, sortOrder: 0 }] }] };
const presentations = (["en-US", "fa-IR"] as const).flatMap(language =>
  (["latn", "arabext"] as const).map(numerals => resolvePresentation({ user: { language, numerals } })));
const escape = (s: string) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
type Props = Record<string, unknown>;

// Share actual layout modules and their real context identity with child routes.
// Only local state/effects, router and confirmation IO are controlled. Shared
// controls, tables, money, providers and layout/context implementations stay real.
function compose(pathname: string, id: string, states: Record<string, Props> = {}) {
  const modules = new Map<string, Record<string, React.ComponentType<Props>>>();
  const controls: { type: unknown; props: Props }[] = [], routes: string[] = [];
  const capture = (create: typeof jsx.jsx) => (type: React.ElementType, props: Props, key?: string) => {
    controls.push({ type, props }); return create(type, props, key);
  };
  function load(file: string): Record<string, React.ComponentType<Props>> {
    file = resolve(file);
    const cached = modules.get(file);
    if (cached) return cached;
    const source = readFileSync(file, "utf8");
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const names: string[] = [];
    function hooks(n: ts.Node) {
      if (ts.isVariableDeclaration(n) && ts.isArrayBindingPattern(n.name) && n.initializer && ts.isCallExpression(n.initializer)
        && n.initializer.expression.getText(ast) === "useState") names.push(n.name.elements[0].getText(ast));
      ts.forEachChild(n, hooks);
    }
    hooks(ast);
    let index = 0;
    const own = states[file] ?? {}, compiled = { exports: {} as Record<string, React.ComponentType<Props>> };
    const localRequire = createRequire(file);
    const js = ts.transpileModule(source, { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
    } }).outputText;
    new Function("require", "module", "exports", js)((key: string) => {
      if (key === "react") return { ...React, useState: (initial: unknown) => {
        const name = names[index++];
        return [name in own ? own[name] : typeof initial === "function" ? initial() : initial, noop];
      }, useEffect: noop, useCallback: (fn: unknown) => fn };
      if (key === "react/jsx-runtime") return { ...jsx, jsx: capture(jsx.jsx), jsxs: capture(jsx.jsxs) };
      if (key === "next-intl") return intl;
      if (key.endsWith("/i18n/provider")) return Provider;
      if (key === "next/navigation") return { useParams: () => ({ id }), usePathname: () => pathname,
        useRouter: () => ({ push: (path: string) => routes.push(path) }) };
      if (key.endsWith("/use-document-title")) return { useDocumentTitle: noop };
      if (key.endsWith("/use-entity-title")) return { useEntityTitle: noop };
      if (key.endsWith("/use-debounce")) return { useDebounce: (value: unknown) => value };
      if (key.endsWith("/use-confirm")) return { useConfirm: () => ({ confirm: noop, dialog: null }) };
      if (key.endsWith("/create-drawer")) return { useCreateDrawer: () => ({ open: noop }) };
      const target = key.startsWith("@/") ? resolve(key.slice(2)) : key;
      const resolved = localRequire.resolve(target);
      if (resolved.startsWith(resolve(root)) || resolved === resolve("components/dashboard/tab-layout.tsx")) return load(resolved);
      return localRequire(target);
    }, compiled, compiled.exports);
    modules.set(file, compiled.exports);
    return compiled.exports;
  }
  return { load, controls, routes, render(node: React.ReactNode, p: typeof presentations[number]) {
    const props = { presentation: p, messages: p.locale === "fa-IR" ? fa : en, now: new Date("2026-10-26T00:00:00Z") };
    return renderToStaticMarkup(h(Provider.PresentationProvider, props, h(CjsProvider, props, node)));
  } };
}

test("account shell, actual account context and ledger/settings agree on exact display, routes and field values", () => {
  assert.match(caller, /\p{Script=Arabic}/u);
  const snapshot = JSON.stringify(account);
  for (const p of presentations) for (const settings of [false, true]) {
    const path = `/accounting/accounts/${account.id}${settings ? "/settings" : ""}`;
    const fixture = compose(path, account.id, {
      [resolve(root + "accounts/[id]/layout.tsx")]: { account, loading: false },
      [resolve(root + "accounts/[id]/page.tsx")]: { loading: false, hasMore: false, total: 1, ledger: [{
        entryId: "entry-a", entryNumber: 42, date: "2026-10-26", description: caller,
        debitAmount: Number(minor), debitAmountMinor: String(minor), creditAmount: 0, creditAmountMinor: "0",
        balance: Number(minor), balanceMinor: String(minor), amountCurrencyCode: "USD",
      }] },
    });
    const Shell = fixture.load(root + "layout.tsx").default;
    const Layout = fixture.load(root + "accounts/[id]/layout.tsx").default;
    const Page = fixture.load(root + `accounts/[id]/${settings ? "settings/" : ""}page.tsx`).default;
    const html = fixture.render(h(Shell, null, h(Layout, null, h(Page))), p);
    assert.equal((html.match(/<nav\b/g) ?? []).length, 1, "detail hides outer navigation, retaining account navigation");
    assert.ok(html.includes(`>${escape(caller)}</bdi>`));
    assert.ok(html.includes(escape(journalMoney(minor, "USD", p))));
    assert.ok(html.includes(`>${escape(code)}</bdi>`));
    const active = fixture.controls.filter(c => c.props["aria-current"] === "page");
    assert.equal(active.length, 1);
    assert.equal(active[0].type, "button");
    (active[0].props.onClick as () => void)();
    assert.equal(fixture.routes.at(-1), path);
    if (settings) {
      const field = fixture.controls.find(c => c.props.id === "account-name");
      assert.ok(field);
      assert.equal(field.props.defaultValue, caller);
      assert.equal(field.props.dir, "auto");
      assert.ok(html.includes('for="account-name"'));
      assert.ok(html.includes(`>${escape(currencyLabel("KWD", p.locale))}</bdi>`));
    } else {
      assert.ok(html.includes('href="/accounting/entry-a"'));
      assert.match(html, /<bdi[^>]*dir="ltr"[^>]*>2026-10-26<\/bdi>/);
      assert.ok(html.includes(`dir="${p.locale === "fa-IR" ? "rtl" : "ltr"}"`));
    }
    assert.doesNotMatch(html, /tabindex="[1-9]/);
  }
  assert.equal(JSON.stringify(account), snapshot);
});

test("budget children consume the actual layout context without changing currency, exact low digits or saved periods", () => {
  const snapshot = JSON.stringify(budget, (_, value) => typeof value === "bigint" ? String(value) : value);
  for (const p of presentations) for (const settings of [false, true]) for (const actual of [0n, minor + 1n]) {
    const path = `/accounting/budgets/${budget.id}${settings ? "/settings" : ""}`;
    const comparison = { accountId: account.id, accountName: caller, accountCode: code,
      budgeted: minor, actual, variance: minor - actual, burnRate: 0n,
      periods: [{ ...budget.lines[0].periods[0], budgeted: minor, actual, variance: minor - actual }] };
    const fixture = compose(path, budget.id, {
      [resolve(root + "budgets/[id]/layout.tsx")]: { budget, currencyCode: "KWD", totalBudgeted: minor,
        totalActual: actual, totalBurnRate: 0n, loading: false, accounts: [account], comparisons: [comparison], daysRemaining: 2, totalDays: 31 },
      [resolve(root + "budgets/[id]/page.tsx")]: { expanded: true },
    });
    const Shell = fixture.load(root + "layout.tsx").default;
    const Layout = fixture.load(root + "budgets/[id]/layout.tsx").default;
    const Page = fixture.load(root + `budgets/[id]/${settings ? "settings/" : ""}page.tsx`).default;
    const html = fixture.render(h(Shell, null, h(Layout, null, h(Page))), p);
    assert.equal((html.match(/<nav\b/g) ?? []).length, 1);
    assert.ok(html.includes(escape(budgetMoney(minor, "KWD", p))));
    assert.ok(html.includes(`>${escape(caller)}</bdi>`));
    const active = fixture.controls.filter(c => c.props["aria-current"] === "page");
    assert.equal(active.length, 1);
    (active[0].props.onClick as () => void)();
    assert.equal(fixture.routes.at(-1), path);
    if (settings) {
      const field = fixture.controls.find(c => c.props.id === "budget-name");
      assert.ok(field);
      assert.equal(field.props.value, caller);
      assert.equal(field.props.dir, "auto");
      assert.ok(html.includes('for="budget-name"'));
      const date = fixture.controls.find(c => c.props.id === "budget-start");
      assert.ok(date);
      assert.equal(date.props.value, "2026-01-01");
      assert.equal(date.props.dir, "ltr");
    } else {
      assert.ok(html.includes(`>${escape(code)}</bdi>`));
      assert.ok(html.includes('aria-expanded="true"'));
      // Each complete percent/sign group must share a bidi boundary. The
      // budget-only card must isolate its amount just like the layout totals.
      const percent = actual === 0n ? "0%" : "100%";
      assert.match(html, new RegExp(`<bdi[^>]*dir="ltr"[^>]*>${percent}</bdi>`));
      assert.doesNotMatch(html, /<\/bdi>%/);
      assert.doesNotMatch(html, /[+-]<bdi\b/);
      const exact = `>${escape(budgetMoney(minor, "KWD", p))}</bdi>`;
      assert.ok(html.split(exact).length - 1 >= 3, "layout, card and period preserve isolated low digits");
      if (actual > minor) {
        assert.ok(html.includes(`>+${escape(budgetMoney(1n, "KWD", p))}</bdi>`));
        assert.ok(html.includes(`>-${escape(budgetMoney(1n, "KWD", p))}</bdi>`));
      }
    }
    assert.doesNotMatch(html, /tabindex="[1-9]/);
  }
  assert.equal(JSON.stringify(budget, (_, value) => typeof value === "bigint" ? String(value) : value), snapshot);
});

test("budget list composes with real accounting navigation and isolates its complete line percentage", () => {
  for (const p of presentations) {
    const fixture = compose("/accounting/budgets", budget.id, {
      [resolve(root + "budgets/page.tsx")]: { budgets: [budget], loading: false, reports: {
        [budget.id]: { currencyCode: "KWD", totalBudgeted: minor, totalActual: minor + 1n,
          daysElapsed: 29, daysRemaining: 2, totalDays: 31, comparisons: [{ accountId: account.id,
            accountName: caller, accountCode: code, budgeted: minor, actual: minor + 1n, variance: -1n, periods: [] }] },
      } },
    });
    const Shell = fixture.load(root + "layout.tsx").default, Page = fixture.load(root + "budgets/page.tsx").default;
    const html = fixture.render(h(Shell, null, h(Page)), p);
    assert.equal((html.match(/<nav\b/g) ?? []).length, 1);
    for (const route of ["", "accounts", "banking", "loans", "fixed-assets", "asset-categories", "budgets", "opening-balances", "accruals", "recurring-journals"]) {
      assert.ok(html.includes(`href="/accounting${route ? `/${route}` : ""}"`));
    }
    const active = fixture.controls.filter(c => c.props["aria-current"] === "page");
    assert.equal(active.length, 1);
    assert.equal(active[0].props.href, "/accounting/budgets");
    assert.match(html, /<bdi[^>]*dir="ltr"[^>]*>100%<\/bdi>/);
    assert.doesNotMatch(html, /<\/bdi>%/);
    assert.ok(html.includes(`>${escape(budgetMoney(minor + 1n, "KWD", p))}</bdi>`));
    const card = fixture.controls.find(c => c.type === "button" && String(c.props.className).includes("w-full px-4 py-3"));
    assert.ok(card);
    (card.props.onClick as () => void)();
    assert.equal(fixture.routes.at(-1), `/accounting/budgets/${budget.id}`);
  }
});
