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
import { localeDirection, resolvePresentation } from "../i18n/locale";
import { invoiceUiMoney } from "../lib/money/invoice-ui";
import { PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import SalesLayout from "../app/(dashboard)/sales/layout";
import PurchasesLayout from "../app/(dashboard)/purchases/layout";
import { billUiMoney } from "../lib/money/bill-ui";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

type Props = Record<string, unknown>;
const h = React.createElement, noop = () => {};
const require = createRequire(import.meta.url);
const CjsProvider = (require("../i18n/provider") as typeof Provider).PresentationProvider;
const caller = "  \u0645\u0627\u0644\u06cc\u0627\u062a Caller <GST/001> & " + "long-name-".repeat(24);
const reference = "HMRC-001/\u062D\u0633\u0627\u0628", minor = 4000000000000001n;
const presentations = (["en-US", "fa-IR"] as const).flatMap(language => (["latn", "arabext"] as const).map(numerals => resolvePresentation({ user: { language, numerals } })));
const esc = (v: string) => v.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
// Compose production pages with the actual sales/purchase layout and real providers.
// Only state scheduling, effects, navigation and dialog/sheet IO are controlled.
// SSR and compiled installed CSS are not mounted browser qualification.
function loaded(relative: string, exported: string, states: Props = {}, props: Props = {}, pathname = "/sales") {
  const file = `app/(dashboard)/${relative}`, original = readFileSync(file, "utf8");
  const ast = ts.createSourceFile(file, original, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const edits: { start: number; end: number; text: string }[] = [];
  function visit(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && ts.isArrayBindingPattern(node.name) && node.initializer && ts.isCallExpression(node.initializer) && node.initializer.expression.getText(ast) === "useState") {
      let owner: ts.Node | undefined = node.parent;
      while (owner && !ts.isFunctionDeclaration(owner)) owner = owner.parent;
      assert.ok(owner && ts.isFunctionDeclaration(owner) && owner.name);
      const key = `${owner.name.text}.${node.name.elements[0].getText(ast)}`;
      edits.push({ start: node.initializer.getStart(ast), end: node.initializer.end, text: `controlledState(${JSON.stringify(key)}, ${node.initializer.arguments[0]?.getText(ast) ?? "undefined"})` });
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  let source = original;
  for (const edit of edits.sort((a, b) => b.start - a.start)) source = source.slice(0, edit.start) + edit.text + source.slice(edit.end);
  source = source.replaceAll('typeof window !== "undefined" ? localStorage.getItem("activeOrgId") : null', '"org-a"');
  if (exported !== "default") source += `\nexport { ${exported} };`;
  const compiled = { exports: {} as Record<string, React.ComponentType<Props>> }, localRequire = createRequire(resolve(file));
  const controls: { type: unknown; props: Props }[] = [], updates: unknown[][] = [], events: unknown[] = [];
  const capture = (create: typeof jsx.jsx) => (type: React.ElementType, p: Props, key?: string) => { controls.push({ type, props: p }); return create(type, p, key); };
  const controlledState = (key: string, initial: unknown) => [key in states ? states[key] : typeof initial === "function" ? initial() : initial, (v: unknown) => updates.push([key, v])];
  const inline = ({ children, dir, className }: { children: React.ReactNode; dir?: string; className?: string }) => h("div", { dir, className }, children);
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function("require", "module", "exports", "controlledState", js)((id: string) => {
    if (id === "react") return { ...React, useEffect: noop, useCallback: (fn: unknown) => fn, useMemo: (fn: () => unknown) => fn() };
    if (id === "react/jsx-runtime") return { ...jsx, jsx: capture(jsx.jsx), jsxs: capture(jsx.jsxs) };
    if (id === "next-intl") return intl;
    if (id.endsWith("/i18n/provider")) return Provider;
    if (id === "next/navigation") return { useParams: () => ({ id: "doc-a" }), useRouter: () => ({ push: (v: unknown) => events.push(v) }) };
    if (id.endsWith("/create-drawer")) return { useCreateDrawer: () => ({ open: (v: unknown) => events.push(v) }) };
    if (id.endsWith("/use-debounce")) return { useDebounce: (v: unknown) => v };
    if (id.endsWith("/use-confirm")) return { useConfirm: () => ({ confirm: noop, dialog: null }) };
    if (["/send-document-dialog", "/email-history", "/receipt-attachments"].some(suffix => id.endsWith(suffix))) return { SendDocumentDialog: () => null, EmailHistory: () => null, ReceiptAttachments: () => null };
    if (id.endsWith("/ui/dialog")) return Object.fromEntries(["Dialog", "DialogContent", "DialogHeader", "DialogTitle", "DialogTrigger"].map(key => [key, inline]));
    if (id.endsWith("/use-document-title")) return { useDocumentTitle: noop };
    if (id.endsWith("/use-entity-title")) return { useEntityTitle: noop };
    if (id.endsWith("/ui/sheet")) return Object.fromEntries(["Sheet", "SheetContent", "SheetHeader", "SheetTitle", "SheetTrigger", "SheetFooter"].map(key => [key, inline]));
    return localRequire(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  }, compiled, compiled.exports, controlledState);
  return { controls, updates, events, render(p: typeof presentations[number]) {
    controls.length = 0;
    const root = { presentation: p, messages: p.locale === "fa-IR" ? fa : en, now: new Date("2026-10-26T00:00:00Z") };
    return renderToStaticMarkup(h(Provider.PresentationProvider, root, h(CjsProvider, root, h(PathnameContext.Provider, { value: pathname }, h(pathname.startsWith("/sales") ? SalesLayout : PurchasesLayout, null, h(compiled.exports[exported], props))))));
  } };
}
function control(page: ReturnType<typeof loaded>, predicate: (c: { type: unknown; props: Props }) => boolean) {
  const found = page.controls.find(predicate); assert.ok(found); return found.props;
}

const row = { id: "doc-a", invoiceNumber: reference, billNumber: reference, issueDate: "2026-10-01", dueDate: "1970-01-01", status: "sent", currencyCode: "USD", total: minor, amountDue: minor, contact: { name: caller } };

test("actual invoice and bill pages compose with their real shells, preserving overdue isolation, exact totals and raw callbacks", () => {
  for (const p of presentations) for (const side of ["sales", "purchases"] as const) {
    for (const amount of [0n, minor]) {
      const document = { ...row, total: amount, amountDue: amount };
      const states = side === "sales" ? {
        "InvoicesPage.initialLoad": false, "InvoicesPage.invoices": [document], "InvoicesPage.totalCount": 1,
        "InvoicesPage.summary": { totalCount: 1, currencyCode: "USD", outstanding: amount, overdue: amount, aging: {} },
      } : {
        "BillsPage.loading": false, "BillsPage.loadedOrg": "org-a", "BillsPage.bills": [document], "BillsPage.allBills": [document], "BillsPage.listTotal": 1,
      };
      const before = JSON.stringify(document, (_, value) => typeof value === "bigint" ? String(value) : value);
      const page = loaded(`${side}/page.tsx`, "default", states, {}, `/${side}`), html = page.render(p);
      const active = [...html.matchAll(/<a\b[^>]*aria-current="page"[^>]*>/g)].map(m => m[0]);
      assert.equal(active.length, 1); assert.ok(active[0].includes(`href="/${side}"`));
      for (const value of [caller, reference, row.dueDate, (side === "sales" ? invoiceUiMoney : billUiMoney)(amount, "USD", p)]) assert.ok(html.includes(`>${esc(value)}</bdi>`), value);
      // The full translated overdue warning is isolated beside its canonical date,
      // and both can wrap inside the actual shared table's scrolling boundary.
      assert.match(html, /flex flex-wrap min-w-0 items-center gap-2/);
      assert.match(html, /text-\[11px\] text-red-700 font-semibold"><bdi\b[^>]*>[^<]+<\/bdi>/);
      const tabs = control(page, c => c.props.value === "all" && typeof c.props.onValueChange === "function");
      assert.equal(tabs.dir, localeDirection(p.locale));
      (tabs.onValueChange as (v: string) => void)("paid"); assert.equal(page.updates.at(-1)?.[1], "paid");
      (control(page, c => typeof c.props.onRowClick === "function").onRowClick as (v: unknown) => void)(document);
      assert.equal(page.events.at(-1), `/${side}/doc-a`);
      assert.equal(JSON.stringify(document, (_, value) => typeof value === "bigint" ? String(value) : value), before);
    }
  }
});

test("all sales and purchase navigation routes retain one active link and detail pages hide outer tabs in both directions", () => {
  const routes = {
    sales: ["", "quotes", "receipts", "credit-notes", "payments", "customer-prepayments", "revenue-schedules", "recurring"],
    purchases: ["", "bills/recurring", "debit-notes", "expenses", "orders", "goods-receipts", "requisitions", "landed-costs"],
  };
  for (const p of presentations) for (const side of ["sales", "purchases"] as const) {
    const root = { presentation: p, messages: p.locale === "fa-IR" ? fa : en, now: new Date("2026-10-27T00:00:00Z") };
    const render = (path: string) => renderToStaticMarkup(h(Provider.PresentationProvider, root, h(CjsProvider, root,
      h(PathnameContext.Provider, { value: path }, h(side === "sales" ? SalesLayout : PurchasesLayout, null, h("span", null, caller))))));
    for (const suffix of routes[side]) {
      const path = `/${side}${suffix ? `/${suffix}` : ""}`, html = render(path);
      const anchors = [...html.matchAll(/<a\b[^>]*>/g)].map(m => m[0]);
      assert.equal(anchors.length, 8); assert.equal(anchors.filter(a => a.includes('aria-current="page"')).length, 1);
      assert.ok(anchors.find(a => a.includes(`href="${path}"`))?.includes('aria-current="page"'));
      assert.ok(html.includes("overflow-x-auto") && html.includes(esc(caller)));
      if (!suffix.endsWith("recurring")) assert.ok(!render(`${path}/doc-a`).includes("<nav"));
    }
  }
});

test("installed CSS permits the integrated overdue date and warning to wrap without losing logical table alignment", async () => {
  const compiler = await compile("@theme { --spacing:0.25rem; } @tailwind utilities;");
  const css = compiler.build(["flex-wrap", "min-w-0", "text-end", "overflow-x-auto"]);
  for (const rule of ["flex-wrap: wrap", "min-width:", "text-align: end", "overflow-x: auto"]) assert.ok(css.includes(rule), rule);
});
