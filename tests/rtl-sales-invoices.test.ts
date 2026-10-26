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
import SalesLoading from "../app/(dashboard)/sales/loading";
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
const invoice = { id: "invoice-a", invoiceNumber: reference, contactId: "customer-a", contact: { name: caller, email: "billing+customer@example.com" }, issueDate: "2026-10-01", dueDate: "2026-11-01", status: "sent", currencyCode: "USD", subtotal: minor, taxTotal: 1n, total: minor + 1n, amountPaid: 1n, amountDue: minor, reference: caller, notes: caller, invoiceType: "deposit", depositPercent: 2500, lines: [{ id: "line-a", description: caller, quantity: 125, unitPrice: minor, amount: minor, taxAmount: 1n, account: { id: "account-a", code: "REV-001", name: caller }, taxRate: { id: "tax-a", name: caller, rate: 1250 } }] };
const payment = { id: "payment-a", paymentNumber: "PAY-001/حساب", date: "2026-10-02", amount: 1n, method: "bank_transfer", currencyCode: "USD", contact: { name: caller } };
const snapshot = { name: caller, address: caller, email: "snapshot@example.com", phone: "+98-21-123456", taxId: reference, registrationNumber: reference, taxNumber: reference };

// Execute the production components, provider, fields, money and shared controls.
// Only own state scheduling, effects, navigation and sheet portals are controlled.
function loaded(relative: string, exported: string, states: Props = {}, props: Props = {}) {
  const file = `app/(dashboard)/sales/${relative}`, original = readFileSync(file, "utf8");
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
    if (id === "next/navigation") return { useParams: () => ({ id: invoice.id }), useRouter: () => ({ push: (v: unknown) => events.push(v) }) };
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
    return renderToStaticMarkup(h(Provider.PresentationProvider, root, h(CjsProvider, root, h(compiled.exports[exported], props))));
  } };
}
function control(page: ReturnType<typeof loaded>, predicate: (c: { type: unknown; props: Props }) => boolean) {
  const found = page.controls.find(predicate); assert.ok(found); return found.props;
}

test("invoice list isolates complete caller/technical values and keeps filter, sort, row and creation callbacks raw", () => {
  for (const p of presentations) {
    const page = loaded("page.tsx", "default", { "InvoicesPage.initialLoad": false, "InvoicesPage.invoices": [invoice], "InvoicesPage.payments": [payment], "InvoicesPage.totalCount": 1, "InvoicesPage.summary": { currencyCode: "USD", totalCount: 1, outstanding: minor, overdue: 1n, aging: { current: { amount: minor, count: 1 } } } });
    const html = page.render(p);
    for (const text of [reference, caller, payment.paymentNumber, invoice.issueDate, invoice.dueDate, invoiceUiMoney(minor, "USD", p)]) assert.ok(html.includes(`>${esc(text)}</bdi>`), text);
    assert.ok(!html.includes("<GST/001>") && html.includes("text-end"));
    const search = control(page, c => c.props.dir === "auto" && typeof c.props.onChange === "function");
    assert.ok(search["aria-label"]); (search.onChange as (e: unknown) => void)({ target: { value: caller } });
    assert.deepEqual(page.updates.at(-1), ["InvoicesPage.search", caller]);
    const tabs = control(page, c => c.props.value === "all" && typeof c.props.onValueChange === "function");
    assert.equal(tabs.dir, localeDirection(p.locale)); (tabs.onValueChange as (v: string) => void)("partial");
    assert.deepEqual(page.updates.at(-1), ["InvoicesPage.statusFilter", "partial"]);
    const sort = control(page, c => c.props.value === "created:desc" && typeof c.props.onValueChange === "function");
    assert.equal(sort.dir, localeDirection(p.locale)); (sort.onValueChange as (v: string) => void)("amountDue:asc");
    assert.deepEqual(page.updates.slice(-2), [["InvoicesPage.sortBy", "amountDue"], ["InvoicesPage.sortOrder", "asc"]]);
    const table = control(page, c => typeof c.props.onRowClick === "function");
    (table.onRowClick as (r: typeof invoice) => void)(invoice); assert.equal(page.events.at(-1), "/sales/invoice-a");
    const create = page.controls.find(c => typeof c.props.onClick === "function" && String(c.props.className).includes("bg-emerald-600"));
    assert.ok(create); (create.props.onClick as () => void)(); assert.equal(page.events.at(-1), "invoice");
    const widths = page.controls.filter(c => (c.props.style as Props | undefined)?.width !== undefined).map(c => (c.props.style as Props).width);
    assert.deepEqual(widths, ["100%"]);
  }
});

test("issued detail keeps exact money, percentages, snapshots and scoped raw correction/payment field callbacks", async () => {
  const before = JSON.stringify({ invoice, snapshot }, (_, v) => typeof v === "bigint" ? String(v) : v);
  for (const p of presentations) {
    const states: Props = { "InvoiceDetailPage.inv": invoice, "InvoiceDetailPage.loading": false, "InvoiceDetailPage.loadedContext": "org-a:invoice-a", "InvoiceDetailPage.payments": [payment], "InvoiceDetailPage.senderSnapshot": snapshot, "InvoiceDetailPage.recipientSnapshot": snapshot, "InvoiceDetailPage.bankAccounts": [{ id: "bank-a", name: caller }], "InvoiceDetailPage.snapshotSheetOpen": true };
    for (const [key, value] of Object.entries({ senderName: caller, senderAddress: caller, senderEmail: snapshot.email, senderPhone: snapshot.phone, senderTaxId: reference, senderReg: reference, recipientName: caller, recipientAddress: caller, recipientEmail: snapshot.email, recipientTaxNumber: reference })) states[`InvoiceDetailPage.${key}`] = value;
    const page = loaded("[id]/page.tsx", "default", states), html = page.render(p);
    for (const text of [reference, caller, payment.paymentNumber, snapshot.email, snapshot.phone, "25%", "12.50%", "0%", "1.25", "REV-001", invoiceUiMoney(minor, "USD", p)]) assert.ok(html.includes(`>${esc(text)}</bdi>`), text);
    assert.ok(html.includes("rtl:rotate-180") && html.includes('href="/sales"') && html.includes("overflow-x-auto") && html.includes("min-w-[500px]"));
    for (const [key, direction] of [["senderName", "auto"], ["senderAddress", "auto"], ["senderEmail", "ltr"], ["senderPhone", "ltr"], ["senderTaxId", "ltr"], ["senderReg", "ltr"], ["recipientName", "auto"], ["recipientAddress", "auto"], ["recipientEmail", "ltr"], ["recipientTaxNumber", "ltr"]]) {
      const field = control(page, c => c.props.id === `invoice-${key}`);
      assert.equal(field.dir, direction); assert.ok(html.includes(`for="invoice-${key}"`));
      (field.onChange as (e: unknown) => void)({ target: { value: caller + " raw " } });
      assert.deepEqual(page.updates.at(-1), [`InvoiceDetailPage.${key}`, caller + " raw "]);
    }
    const method = control(page, c => c.props.value === "bank_transfer" && typeof c.props.onValueChange === "function");
    assert.equal(method.dir, localeDirection(p.locale)); (method.onValueChange as (v: string) => void)("cash");
    assert.deepEqual(page.updates.at(-1), ["InvoiceDetailPage.payMethod", "cash"]);
    const sheet = control(page, c => c.props.className === "sm:max-w-md w-full max-h-dvh overflow-y-auto");
    assert.equal(sheet.dir, localeDirection(p.locale)); assert.equal(sheet.side, p.locale === "fa-IR" ? "left" : "right");
    const requests: { url: string; init: RequestInit }[] = [], previous = globalThis.fetch;
    globalThis.fetch = (async (url, init) => { requests.push({ url: String(url), init: init! }); return new Response(JSON.stringify({ sender: snapshot, recipient: snapshot }), { status: 200 }); }) as typeof fetch;
    try {
      const save = control(page, c => typeof c.props.onClick === "function" && (c.props.onClick as () => void).name === "handleSaveSnapshot");
      await (save.onClick as () => Promise<void>)();
      assert.equal(requests[0].url, "/api/v1/invoices/invoice-a/snapshot");
      assert.equal(requests[0].init.method, "PATCH"); assert.equal((requests[0].init.headers as Props)["x-organization-id"], "org-a");
      assert.deepEqual(JSON.parse(String(requests[0].init.body)), { sender: { name: caller, address: caller, email: snapshot.email, phone: snapshot.phone, taxId: reference, registrationNumber: reference }, recipient: { name: caller, address: caller, email: snapshot.email, taxNumber: reference } });
    } finally { globalThis.fetch = previous; }
  }
  assert.equal(JSON.stringify({ invoice, snapshot }, (_, v) => typeof v === "bigint" ? String(v) : v), before);
});

test("sales shell preserves exact route/detail semantics and installed CSS supports long narrow directional controls", async () => {
  for (const p of presentations) {
    const root = { presentation: p, messages: p.locale === "fa-IR" ? fa : en, now: new Date("2026-10-26T00:00:00Z") };
    for (const path of ["/sales", "/sales/quotes", "/sales/invoice-a", "/sales/quotes/quote-a"]) {
      const html = renderToStaticMarkup(h(Provider.PresentationProvider, root, h(CjsProvider, root, h(PathnameContext.Provider, { value: path }, h(SalesLayout, null, h("span", null, caller))))));
      assert.ok(html.includes(esc(caller)));
      if (["/sales", "/sales/quotes"].includes(path)) {
        const anchor = [...html.matchAll(/<a\b[^>]*>/g)].map(m => m[0]).find(a => a.includes(`href="${path}"`));
        assert.ok(anchor?.includes('aria-current="page"'));
        for (const route of ["quotes", "receipts", "credit-notes", "payments", "customer-prepayments", "revenue-schedules", "recurring"]) assert.ok(html.includes(`href="/sales/${route}"`));
      } else assert.ok(!html.includes("<nav"));
    }
    assert.ok(renderToStaticMarkup(h(Provider.PresentationProvider, root, h(CjsProvider, root, h(SalesLoading)))).includes(`aria-label="${esc(root.messages.SharedUI.loading2)}"`));
  }
  const compiler = await compile("@theme { --spacing:0.25rem; --breakpoint-sm:40rem; } @tailwind utilities;");
  const css = compiler.build(["start-2.5", "ps-8", "me-2", "ms-auto", "text-start", "text-end", "max-w-full", "min-w-0", "flex-wrap", "overflow-x-auto", "overflow-y-auto", "max-h-dvh", "[overflow-wrap:anywhere]", "rtl:rotate-180", "h-auto", "*:data-[slot=select-value]:line-clamp-none", "min-w-[500px]"]);
  for (const rule of ["inset-inline-start:", "padding-inline-start:", "margin-inline-end:", "margin-inline-start:", "text-align: start", "text-align: end", "max-width: 100%", "min-width:", "flex-wrap: wrap", "overflow-x: auto", "overflow-y: auto", "max-height: 100dvh", "overflow-wrap: anywhere", "rotate: 180deg", "height: auto", "-webkit-line-clamp: unset", "min-width: 500px"]) assert.ok(css.includes(rule), rule);
});
