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
import { customerPrepaymentMoney } from "../lib/money/customer-prepayment-ui";
import { paymentUiMoney } from "../lib/money/payment-ui";
import { salesReceiptUiMoney } from "../lib/money/sales-receipt-ui";
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
    if (id === "next/navigation") return { useParams: () => ({ id: "doc-a" }), useRouter: () => ({ push: (v: unknown) => events.push(v) }) };
    if (id.endsWith("/create-drawer")) return { useCreateDrawer: () => ({ open: (v: unknown) => events.push(v) }) };
    if (id.endsWith("/use-debounce")) return { useDebounce: (v: unknown) => v };
    if (id.endsWith("/use-confirm")) return { useConfirm: () => ({ confirm: noop, dialog: null }) };
    if (["/send-document-dialog", "/email-history", "/receipt-attachments"].some(suffix => id.endsWith(suffix))) return { SendDocumentDialog: () => null, EmailHistory: () => null, ReceiptAttachments: () => null };
    if (id.endsWith("/ui/select")) return Object.fromEntries(["Select", "SelectContent", "SelectItem", "SelectTrigger", "SelectValue"].map(key => [key, ({children, ...p}: {children: React.ReactNode}) => h("div", p, children)]));
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

const base = { id: "doc-a", contactId: "customer-a", contact: { name: caller, email: "billing@example.com" }, date: "2026-10-01", currencyCode: "USD", notes: caller };
const credit = { ...base, status: "open", originalAmount: minor, amountRemaining: minor, sourceType: "prepayment" };
const receipt = { ...base, receiptNumber: reference, status: "paid", reference: caller, subtotal: minor, taxTotal: 1n, total: minor + 1n, bankAccount: null, depositAccount: { code: "1010/001", name: caller }, lines: [{ id: "line-a", description: caller, quantity: 125, unitPrice: minor, amount: minor, taxAmount: 1n }] };
const payment = { ...base, paymentNumber: reference, reference: caller, method: "cash", amount: minor, allocated: minor - 1n, unallocated: 1n, bankAccount: { name: caller }, allocations: [{ documentType: "invoice", documentId: "invoice-a", amount: minor - 1n }, { documentType: "historical-test", documentId: "history-a", amount: 0n }] };
const invoice = { id: "invoice-a", invoiceNumber: reference, contactId: "customer-a", currencyCode: "USD", status: "sent", amountDue: minor, contact: { name: caller } };

test("three sales cash lists preserve isolated exact rows and raw filter/navigation callbacks", () => {
  for (const p of presentations) {
    const specs = [
      ["customer-prepayments/page.tsx", "CustomerPrepaymentsList", { "CustomerPrepaymentsList.credits": [credit], "CustomerPrepaymentsList.initialLoad": false, "CustomerPrepaymentsList.totalCount": 1 }, credit, customerPrepaymentMoney(minor, "USD", p), "created:desc"],
      ["receipts/page.tsx", "default", { "SalesReceiptsPage.loaded": { context: "org-a:all:created:desc::", receipts: [receipt], total: 1, error: null }, "SalesReceiptsPage.initialLoad": false }, receipt, salesReceiptUiMoney(receipt.total, "USD", p), "created:desc"],
      ["payments/page.tsx", "PaymentsList", { "PaymentsList.payments": [payment], "PaymentsList.loading": false }, payment, paymentUiMoney(minor, "USD", p), "date:desc"],
    ] as const;
    for (const [path, name, states, row, money, sortValue] of specs) {
      const owner = name === "default" ? "SalesReceiptsPage" : name;
      const page = loaded(path, name, states, { orgId: "org-a" });
      const html = page.render(p);
      for (const value of [caller, base.date, money]) assert.ok(html.includes(`>${esc(value)}</bdi>`), `${path}: ${value}`);
      assert.ok(html.includes("text-end") && html.includes("start-2.5") && html.includes("ps-8"));
      assert.equal((html.match(/role="group"/g) || []).length, 2);
      const search = control(page, c => c.props.dir === "auto" && typeof c.props.onChange === "function");
      assert.ok(search["aria-label"]); (search.onChange as (v: unknown) => void)({ target: { value: caller } });
      assert.deepEqual(page.updates.at(-1), [`${owner}.search`, caller]);
      const sort = control(page, c => c.props.value === sortValue && typeof c.props.onValueChange === "function");
      assert.equal(sort.dir, localeDirection(p.locale)); (sort.onValueChange as (v: string) => void)("amount:asc");
      assert.deepEqual(page.updates.slice(-2), [[`${owner}.sortBy`, "amount"], [`${owner}.sortOrder`, "asc"]]);
      const table = control(page, c => typeof c.props.onRowClick === "function");
      (table.onRowClick as (v: unknown) => void)(row);
      assert.equal(page.events.at(-1), `/sales/${path.split("/")[0]}/doc-a`);
      const filter = control(page, c => c.props.value === "all" && typeof c.props.onValueChange === "function");
      assert.equal(filter.dir, localeDirection(p.locale)); (filter.onValueChange as (v: string) => void)("raw-filter");
      assert.deepEqual(page.updates.at(-1), [`${owner}.${name === "PaymentsList" ? "methodFilter" : "statusFilter"}`, "raw-filter"]);
    }
  }
});

test("prepayment application has named directed controls and preserves canonical allocation payload and eligibility", async () => {
  for (const p of presentations) {
    const states = { "CustomerPrepaymentDetail.cc": credit, "CustomerPrepaymentDetail.loading": false, "CustomerPrepaymentDetail.applyOpen": true, "CustomerPrepaymentDetail.applyInvoiceId": "invoice-a", "CustomerPrepaymentDetail.applyAmount": "0.01", "CustomerPrepaymentDetail.invoices": [invoice] };
    const page = loaded("customer-prepayments/[id]/page.tsx", "CustomerPrepaymentDetail", states, { id: "doc-a", orgId: "org-a" });
    const html = page.render(p);
    assert.ok(html.includes(`>${esc(caller)}</bdi>`) && html.includes('for="prepayment-apply-invoice"'));
    assert.ok(html.includes('id="prepayment-apply-invoice"'));
    const select = control(page, c => c.props.value === "invoice-a" && typeof c.props.onValueChange === "function");
    assert.equal(select.dir, localeDirection(p.locale)); (select.onValueChange as (v: string) => void)("raw-invoice-b");
    assert.deepEqual(page.updates.at(-1), ["CustomerPrepaymentDetail.applyInvoiceId", "raw-invoice-b"]);
    const amount = control(page, c => c.props.currency === "USD" && c.props.value === "0.01" && typeof c.props.onChange === "function");
    assert.equal(amount["aria-label"], (p.locale === "fa-IR" ? fa : en).CustomerPrepayments.amount);
    (amount.onChange as (v: string) => void)("1.23"); assert.deepEqual(page.updates.at(-1), ["CustomerPrepaymentDetail.applyAmount", "1.23"]);
    const dialog = control(page, c => c.props.className === "max-h-dvh overflow-y-auto [overflow-wrap:anywhere]");
    assert.equal(dialog.dir, localeDirection(p.locale));
    const requests: { url: string; init?: RequestInit }[] = [], previous = globalThis.fetch;
    globalThis.fetch = (async (url, init) => { requests.push({ url: String(url), init }); return new Response("{}", { status: 200 }); }) as typeof fetch;
    try {
      const apply = control(page, c => typeof c.props.onClick === "function" && (c.props.onClick as () => void).name === "handleApply");
      assert.equal(apply.disabled, false); await (apply.onClick as () => Promise<void>)();
      assert.equal(requests[0].url, "/api/v1/customer-credits/doc-a/apply"); assert.equal(requests[0].init?.method, "POST");
      assert.equal((requests[0].init?.headers as Props)["x-organization-id"], "org-a");
      assert.deepEqual(JSON.parse(String(requests[0].init?.body)), { invoiceId: "invoice-a", amountMinor: "1" });
    } finally { globalThis.fetch = previous; }
    const invalid = loaded("customer-prepayments/[id]/page.tsx", "CustomerPrepaymentDetail", { ...states, "CustomerPrepaymentDetail.applyAmount": "40000000000000.02" }, { id: "doc-a", orgId: "org-a" });
    invalid.render(p);
    assert.equal(control(invalid, c => typeof c.props.onClick === "function" && (c.props.onClick as () => void).name === "handleApply").disabled, true);
  }
});

test("receipt and payment detail isolate saved accounts, exact allocation labels and notes without changing raw links", () => {
  for (const p of presentations) {
    const sr = loaded("receipts/[id]/page.tsx", "SalesReceiptDetailContent", { "SalesReceiptDetailContent.sr": receipt, "SalesReceiptDetailContent.loading": false }, { id: "doc-a", orgId: "org-a" });
    const receiptHtml = sr.render(p);
    assert.ok(receiptHtml.includes(`>${esc(salesReceiptUiMoney(receipt.total, "USD", p))}</bdi>`));
    assert.ok(receiptHtml.includes(`>${esc(`1010/001 · ${caller}`)}</bdi>`));
    const pmt = loaded("payments/[id]/page.tsx", "PaymentDetail", { "PaymentDetail.pmt": payment, "PaymentDetail.loading": false, "PaymentDetail.invoiceLookup": { "invoice-a": invoice } }, { id: "doc-a", orgId: "org-a" });
    const paymentHtml = pmt.render(p);
    for (const value of [caller, reference, paymentUiMoney(minor, "USD", p), paymentUiMoney(minor - 1n, "USD", p), paymentUiMoney(1n, "USD", p)]) assert.ok(paymentHtml.includes(`>${esc(value)}</bdi>`), value);
    assert.ok(paymentHtml.includes('href="/sales/invoices/invoice-a"'));
    assert.ok(paymentHtml.includes("historical-test</bdi>"));
    for (const html of [receiptHtml, paymentHtml]) assert.ok(html.includes("rtl:rotate-180") && html.includes("whitespace-pre-wrap"));
  }
});

test("empty examples retain complete signed money and identifier boundaries and original create actions", () => {
  for (const p of presentations) for (const [path, owner, states, action, sample] of [
    ["customer-prepayments/page.tsx", "CustomerPrepaymentsList", { "CustomerPrepaymentsList.initialLoad": false }, "customerCredit", "INV-0042"],
    ["receipts/page.tsx", "default", { "SalesReceiptsPage.initialLoad": false, "SalesReceiptsPage.loaded": { context: "org-a:all:created:desc::", receipts: [], total: 0, error: null } }, "salesReceipt", "SR-0001"],
  ] as const) {
    const page = loaded(path, owner, states, { orgId: "org-a" }), html = page.render(p);
    assert.ok(html.includes(`>${sample}</bdi>`) && html.includes("border-s-[3px]"));
    assert.ok(/<bdi[^>]*>\+[^<]+<\/bdi>/.test(html));
    const create = control(page, c => typeof c.props.onClick === "function"); (create.onClick as () => void)();
    assert.equal(page.events.at(-1), action);
  }
});

test("installed CSS implements logical filters, wrapped allocation rows, bounded tabs and complete selectors", async () => {
  const compiler = await compile("@theme { --spacing:0.25rem; --breakpoint-sm:40rem; --color-blue-400:#60a5fa; } @tailwind utilities;");
  const css = compiler.build(["start-2.5", "ps-8", "me-2", "text-end", "border-s-[3px]", "border-s-blue-400", "min-w-0", "max-w-full", "flex-wrap", "overflow-x-auto", "overflow-y-auto", "max-h-dvh", "[overflow-wrap:anywhere]", "rtl:rotate-180", "h-auto", "*:data-[slot=select-value]:line-clamp-none"]);
  for (const rule of ["inset-inline-start:", "padding-inline-start:", "margin-inline-end:", "text-align: end", "border-inline-start-width:", "border-inline-start-color:", "min-width:", "max-width: 100%", "flex-wrap: wrap", "overflow-x: auto", "overflow-y: auto", "max-height: 100dvh", "overflow-wrap: anywhere", "rotate: 180deg", "height: auto", "-webkit-line-clamp: unset"]) assert.ok(css.includes(rule), rule);
});
