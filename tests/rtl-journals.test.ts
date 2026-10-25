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
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const h = React.createElement, noop = () => {};
const caller = "  حساب Caller <ACME/001> & " + "long-name-".repeat(30);
const code = "  001-AB/حساب  ", minor = "4000000000000001";
const lines = [0, 1].map(i => ({ id: `line-${i}`, accountId: code, accountCode: code, accountName: caller,
  description: caller, debitAmount: i ? "0.00" : "40000000000000.01", creditAmount: i ? "40000000000000.01" : "0.00",
  debitAmountMinor: i ? "0" : minor, creditAmountMinor: i ? minor : "0", currencyCode: "USD", amountCurrencyCode: "USD",
  exchangeRate: 1000000, costCenterId: "cc-a", projectId: "project-a" }));
const entry = { id: "entry-a", entryNumber: 42, date: "2026-10-26", description: caller, reference: code, status: "draft",
  sourceType: "manual", createdAt: "2026-10-26T12:00:00Z", lines, fiscalYearId: "fy-a" };
const recurring = { id: "rj-a", name: caller, frequency: "semi_annual", status: "active", nextRunDate: "2026-11-26",
  lastRunDate: null, occurrencesGenerated: 2, maxOccurrences: null, reference: code, notes: caller, currencyCode: "USD", lines };
const listEntry = { ...entry, totalDebit: "40000000000000.01", totalDebitMinor: minor,
  debitTotals: [{ currencyCode: "USD", totalDebit: Number(minor), totalDebitMinor: minor }] };
const presentations = (["en-US", "fa-IR"] as const).flatMap(language =>
  (["latn", "arabext"] as const).map(numerals => resolvePresentation({ user: { language, numerals } })));
const escape = (s: string) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
type Props = Record<string, unknown>;
const require = createRequire(import.meta.url);
const CommonJsProvider = (require("../i18n/provider") as typeof Provider).PresentationProvider;

// Production components, provider, Radix controls, table and money renderers remain real.
// Only state scheduling, route, drawer and account context IO are controlled.
function loaded(relative: string, states: Props = {}, owner = "default") {
  const file = "app/(dashboard)/accounting/" + relative, source = readFileSync(file, "utf8");
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const main = ast.statements.find(n => ts.isFunctionDeclaration(n) && (owner === "default" ? n.modifiers?.some(m => m.kind === ts.SyntaxKind.DefaultKeyword) : n.name?.text === owner));
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
  const compiled = { exports: {} as Record<string, React.ComponentType<Props>> }, localRequire = createRequire(resolve(file));
  const js = ts.transpileModule(source + (owner === "default" ? "" : `\nexport { ${owner} };`), { compilerOptions: { module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function("require", "module", "exports", js)((id: string) => {
    if (id === "react") return { ...React, useState: (initial: unknown) => {
      const key = names[index++]; return [key in states ? states[key] : typeof initial === "function" ? initial() : initial,
        (value: unknown) => updates.push([key, value])];
    }, useEffect: noop, useRef: (value: unknown) => ({ current: value }), useMemo: (fn: () => unknown) => fn(), useCallback: (fn: unknown) => fn };
    if (id === "react/jsx-runtime") return { ...jsx, jsx: capture(jsx.jsx), jsxs: capture(jsx.jsxs) };
    if (id === "next-intl") return intl;
    if (id.endsWith("/i18n/provider")) return Provider;
    if (id === "next/navigation") return { useParams: () => ({ id: entry.id }),
      usePathname: () => `/accounting/${entry.id}`,
      useRouter: () => ({ push: (url: unknown) => events.push(url) }) };
    if (id.endsWith("/ui/sheet") || id.endsWith("/ui/dialog")) return Object.fromEntries(["Sheet", "SheetContent", "SheetHeader", "SheetTitle", "SheetDescription", "Dialog", "DialogContent", "DialogDescription", "DialogFooter", "DialogHeader", "DialogTitle", "DialogTrigger"].map(key => [key, ({ children }: { children?: React.ReactNode }) => h("div", null, children)]));
    if (id.endsWith("/use-entity-title")) return { useEntityTitle: noop };
    if (id.endsWith("/use-document-title")) return { useDocumentTitle: noop };
    if (id.endsWith("/use-debounce")) return { useDebounce: (v: unknown) => v };
    if (id.endsWith("/use-confirm")) return { useConfirm: () => ({ confirm: noop, dialog: null }) };
    if (id.endsWith("/create-drawer")) return { useCreateDrawer: () => ({ open: (...args: unknown[]) => events.push(args) }) };
    return localRequire(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  }, compiled, compiled.exports);
  return { controls, updates, events, render(p: typeof presentations[number]) {
    index = 0; controls.length = 0;
    const props = { presentation: p, messages: p.locale === "fa-IR" ? fa : en, now: new Date("2026-10-26T00:00:00Z") };
    return renderToStaticMarkup(h(Provider.PresentationProvider, props, h(CommonJsProvider, props, h(compiled.exports[owner], owner === "default" ? {} : { open: true, onClose: noop, entry, orgId: "org-a", onSaved: noop }))));
  } };
}

function control(page: ReturnType<typeof loaded>, predicate: (c: { type: unknown; props: Props }) => boolean) {
  const found = page.controls.find(predicate); assert.ok(found); return found.props;
}

test("actual journal rows isolate caller values and preserve exact money, filters and navigation", () => {
  assert.match(caller, /\p{Script=Arabic}/u);
  const before = JSON.stringify(listEntry);
  for (const p of presentations) {
    const page = loaded("page.tsx", { entries: [listEntry], loading: false });
    const html = page.render(p), labels = (p.locale === "fa-IR" ? fa : en).Journals;
    assert.ok(html.includes(`>${escape(caller)}</bdi>`));
    assert.match(html, /<bdi[^>]*dir="ltr"[^>]*>42<\/bdi>/);
    assert.ok(html.includes(journalMoney(BigInt(minor), "USD", p)));
    assert.ok(!html.includes("<ACME/001>"));
    const search = control(page, c => c.props.placeholder === labels.searchEntries);
    assert.equal(search.dir, "auto"); assert.equal(search["aria-label"], labels.searchEntries);
    (search.onChange as (e: unknown) => void)({ target: { value: code } });
    assert.deepEqual(page.updates.at(-1), ["search", code]);
    const tabs = control(page, c => c.props.value === "all" && typeof c.props.onValueChange === "function");
    assert.equal(tabs.dir, p.locale === "fa-IR" ? "rtl" : "ltr");
    (tabs.onValueChange as (v: string) => void)("posted");
    assert.deepEqual(page.updates.at(-1), ["statusFilter", "posted"]);
    const sort = control(page, c => c.props.value === "date:desc" && typeof c.props.onValueChange === "function");
    (sort.onValueChange as (v: string) => void)("amount:asc");
    assert.deepEqual(page.updates.at(-1), ["sortBy", "amount:asc"]);
    const date = control(page, c => c.props.placeholder === labels.startDate);
    (date.onChange as (v: string) => void)("2026-10-26");
    assert.deepEqual(page.updates.at(-1), ["dateFrom", "2026-10-26"]);
    const table = control(page, c => typeof c.props.onRowClick === "function");
    (table.onRowClick as (r: unknown) => void)(listEntry);
    assert.equal(page.events.at(-1), "/accounting/entry-a");
  }
  assert.equal(JSON.stringify(listEntry), before);
});

test("actual recurring list and detail retain raw schedules while isolating long names, IDs and amounts", () => {
  const before = JSON.stringify(recurring);
  for (const p of presentations) {
    const labels = (p.locale === "fa-IR" ? fa : en).Journals;
    const list = loaded("recurring-journals/page.tsx", { templates: [recurring], initialLoad: false, totalCount: 1 });
    const listHtml = list.render(p);
    assert.ok(listHtml.includes(`>${escape(caller)}</bdi>`));
    const search = control(list, c => c.props.placeholder === labels.searchRecurring);
    (search.onChange as (e: unknown) => void)({ target: { value: code } });
    assert.deepEqual(list.updates.at(-1), ["search", code]);
    const frequency = control(list, c => c.props.value === "all" && typeof c.props.onValueChange === "function" && !("dir" in c.props));
    (frequency.onValueChange as (v: string) => void)("semi_annual");
    assert.deepEqual(list.updates.at(-1), ["frequencyFilter", "semi_annual"]);
    const detail = loaded("recurring-journals/[id]/page.tsx", { rj: recurring, loading: false });
    const html = detail.render(p);
    assert.ok(html.includes(`>${escape(caller)}</bdi>`));
    assert.ok(html.includes(`>${escape(code)}</bdi>`));
    assert.ok(html.includes(journalMoney(BigInt(minor), "USD", p)));
    assert.ok(!html.includes("truncate"));
    assert.ok(html.includes("rtl:rotate-180") && html.includes('href="/accounting/recurring-journals"'));
  }
  assert.equal(JSON.stringify(recurring), before);
});

test("actual journal detail/editor preserve caller text, exact line callbacks and accessible native fields", () => {
  for (const p of presentations) {
    const detail = loaded("[id]/page.tsx", { entry, loading: false }), html = detail.render(p);
    assert.ok(html.includes(`>${escape(caller)}</bdi>`));
    assert.ok(html.includes(`>${escape(code)}</bdi>`));
    assert.ok(html.includes(journalMoney(BigInt(minor), "USD", p)));
    const back = control(detail, c => c.props.href === "/accounting" && typeof c.props["aria-label"] === "string");
    assert.equal(back["aria-label"], (p.locale === "fa-IR" ? fa : en).Journals.backTransactions);
    const editor = loaded("[id]/page.tsx", { date: entry.date, description: caller, reference: code,
      lines: [{ accountId: code, description: caller, debit: "40000000000000.01", credit: "" },
        { accountId: code, description: caller, debit: "", credit: "40000000000000.01" }] }, "EditEntrySheet");
    const editHtml = editor.render(p);
    assert.ok(editHtml.includes('for="edit-entry-description"') && editHtml.includes('id="edit-entry-description"'));
    const description = control(editor, c => c.props.id === "edit-entry-description");
    assert.equal(description.dir, "auto");
    (description.onChange as (e: unknown) => void)({ target: { value: code } });
    assert.deepEqual(editor.updates.at(-1), ["description", code]);
    const sheet = control(editor, c => "side" in c.props);
    assert.equal(sheet.side, p.locale === "fa-IR" ? "left" : "right");
    const debit = control(editor, c => c.props.value === "40000000000000.01" && c.props.prefix === "USD");
    (debit.onChange as (v: string) => void)("0.01");
    const apply = editor.updates.at(-1)?.[1] as (rows: unknown[]) => { debit: string; credit: string }[];
    assert.equal(typeof apply, "function");
    assert.deepEqual(apply([{ debit: "1", credit: "2" }])[0], { debit: "0.01", credit: "" });
  }
});

test("opening date and drawer action remain canonical while rich inline date is isolated", () => {
  for (const p of presentations) {
    const page = loaded("opening-balances/page.tsx", { entry: { ...entry, lines: [
      { id: "a", debitAmount: Number(minor), creditAmount: 0, account: { code, name: caller } },
    ] }, loading: false });
    const html = page.render(p);
    assert.match(html, /<bdi[^>]*dir="ltr"[^>]*>2026-10-26<\/bdi>/);
    const button = control(page, c => c.props.children instanceof Array && typeof c.props.onClick === "function");
    (button.onClick as () => void)();
    assert.deepEqual(page.events.at(-1), ["openingBalance"]);
  }
});

test("installed journal CSS supports logical geometry, wrapping editors and locale directional glyphs", async () => {
  const compiler = await compile("@theme { --spacing:0.25rem; --breakpoint-sm:40rem; } @tailwind utilities;");
  const css = compiler.build(["start-2.5", "ps-8", "me-2", "ms-1.5", "text-start", "text-end", "flex-wrap",
    "[overflow-wrap:anywhere]", "rtl:rotate-180", "grid-cols-2", "sm:grid-cols-[minmax(0,1fr)_120px_120px_auto]",
    "data-[size=default]:h-auto", "*:data-[slot=select-value]:line-clamp-none"]);
  for (const declaration of ["inset-inline-start:", "padding-inline-start:", "margin-inline-end:", "margin-inline-start:",
    "text-align: start", "text-align: end", "flex-wrap: wrap", "overflow-wrap: anywhere", "rotate: 180deg",
    "grid-template-columns: minmax(0,1fr) 120px 120px auto", "height: auto", "-webkit-line-clamp: unset"])
    assert.ok(css.includes(declaration), declaration);
});
