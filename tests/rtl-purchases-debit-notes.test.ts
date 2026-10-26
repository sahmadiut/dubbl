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
import { debitNoteUiMoney } from "../lib/money/debit-note-ui";
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
const base = { id: "doc-a", contactId: "customer-a", contact: { name: caller, email: "billing@example.com" }, issueDate: "2026-10-01", expiryDate: "2026-11-01", status: "sent", currencyCode: "USD", subtotal: minor, taxTotal: 1n, total: minor + 1n, notes: caller, lines: [{ id: "line-a", description: caller, quantity: 125, unitPrice: minor, amount: minor, taxAmount: 1n, account: { code: "REV-001", name: caller } }] };
const credit = { ...base, contactId: "supplier-a", debitNoteNumber: reference, amountApplied: 1n, amountRemaining: minor, billId: null, reference: caller };
const bill = { id: "bill-a", billNumber: reference, contactId: "supplier-a", currencyCode: "USD", status: "received", amountDue: minor, contact: { name: caller } };
// Execute the production components, provider, fields, money and shared controls.
// Only own state scheduling, effects, navigation and sheet portals are controlled.
function loaded(relative: string, exported: string, states: Props = {}, props: Props = {}) {
  const file = `app/(dashboard)/purchases/debit-notes/${relative}`, original = readFileSync(file, "utf8");
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

test("debit list preserves isolated exact rows, named directed filters and raw callbacks", () => {
  for (const p of presentations) {
    const page = loaded("page.tsx", "default", { "DebitNotesPage.loaded": { context: "org-a:page=1&limit=50", rows: [credit], total: 1, page: 1, error: null } });
    const html = page.render(p);
    for (const value of [reference, caller, base.issueDate, debitNoteUiMoney(credit.total, "USD", p)]) assert.ok(html.includes(`>${esc(value)}</bdi>`), value);
    assert.ok(!html.includes("<GST/001>") && html.includes("text-end"));
    const tabs = control(page, c => c.props.value === "all" && typeof c.props.onValueChange === "function");
    assert.equal(tabs.dir, localeDirection(p.locale)); (tabs.onValueChange as (v: string) => void)("sent");
    assert.deepEqual(page.updates.at(-1), ["DebitNotesPage.statusFilter", "sent"]);
    const search = control(page, c => c.props.dir === "auto" && typeof c.props.onChange === "function");
    assert.ok(search["aria-label"]); (search.onChange as (v: unknown) => void)({ target: { value: caller } });
    assert.deepEqual(page.updates.at(-1), ["DebitNotesPage.search", caller]);
    const sort = control(page, c => c.props.value === "created:desc" && typeof c.props.onValueChange === "function");
    assert.equal(sort.dir, localeDirection(p.locale)); (sort.onValueChange as (v: string) => void)("total:asc");
    assert.deepEqual(page.updates.slice(-2), [["DebitNotesPage.sortBy", "total"], ["DebitNotesPage.sortOrder", "asc"]]);
    const table = control(page, c => typeof c.props.onRowClick === "function");
    (table.onRowClick as (v: unknown) => void)(credit); assert.equal(page.events.at(-1), "/purchases/debit-notes/doc-a");
    const create = control(page, c => typeof c.props.onClick === "function" && c.props.className?.toString().includes("bg-emerald-600") === true);
    (create.onClick as () => void)(); assert.equal(page.events.at(-1), "debitNote");
    assert.ok(html.includes('role="group"') && html.includes("max-w-full"));
    const empty = loaded("page.tsx", "default", { "DebitNotesPage.loaded": { context: "org-a:page=1&limit=50", rows: [], total: 0, page: 1, error: null } }).render(p);
    for (const amount of [120000n, -20000n, 100000n]) assert.ok(empty.includes(`>${esc(debitNoteUiMoney(amount, "USD", p))}</bdi>`));
    assert.ok(empty.includes('dir="ltr"') && empty.includes("border-s-[3px]") && !empty.includes("border-l-"));
  }
});

test("debit application keeps directed named controls, raw dispatch and exact payloads", async () => {
  for (const p of presentations) {
    const states = { "DebitNoteDetail.dn": credit, "DebitNoteDetail.loading": false, "DebitNoteDetail.applyOpen": true, "DebitNoteDetail.applyBillId": "bill-a", "DebitNoteDetail.applyAmount": "0.01", "DebitNoteDetail.billLoaded": { context: `supplier-a:USD:${minor}:0`, rows: [bill], error: null } };
    const page = loaded("[id]/page.tsx", "DebitNoteDetail", states, { id: "doc-a", orgId: "org-a" });
    const html = page.render(p);
    assert.ok(html.includes(`>${esc(caller)}</bdi>`) && html.includes('for="debit-apply-bill"') && html.includes("rtl:rotate-180"));
    assert.ok(html.includes('aria-label="' + (p.locale === "fa-IR" ? fa : en).DebitNotes.amount + '"'));
    const select = control(page, c => c.props.value === "bill-a" && typeof c.props.onValueChange === "function");
    assert.equal(select.dir, localeDirection(p.locale)); (select.onValueChange as (v: string) => void)("raw-bill-b");
    assert.deepEqual(page.updates.at(-1), ["DebitNoteDetail.applyBillId", "raw-bill-b"]);
    const amount = control(page, c => c.props.currency === "USD" && c.props.value === "0.01" && typeof c.props.onChange === "function");
    (amount.onChange as (v: string) => void)("1.23"); assert.deepEqual(page.updates.at(-1), ["DebitNoteDetail.applyAmount", "1.23"]);
    const dialog = control(page, c => c.props.className === "max-h-dvh overflow-y-auto [overflow-wrap:anywhere]");
    assert.equal(dialog.dir, localeDirection(p.locale));
    const send = control(page, c => c.props.documentType === "debit_note" && c.props.sendApiUrl !== undefined);
    assert.equal(send.documentId, "doc-a"); assert.equal(send.documentNumber, reference); assert.equal(send.contactName, caller);
    assert.equal(send.amountDue, credit.total); assert.equal(send.currencyCode, "USD"); assert.equal(send.sendApiUrl, "/api/v1/debit-notes/doc-a/send");
    const requests: { url: string; init?: RequestInit }[] = [], previous = globalThis.fetch;
    globalThis.fetch = (async (url, init) => { requests.push({ url: String(url), init }); return new Response("{}", { status: 200 }); }) as typeof fetch;
    try {
      const apply = control(page, c => typeof c.props.onClick === "function" && (c.props.onClick as () => void).name === "handleApply");
      assert.equal(apply.disabled, false); await (apply.onClick as () => Promise<void>)();
      assert.equal(requests[0].url, "/api/v1/debit-notes/doc-a/apply"); assert.equal(requests[0].init?.method, "POST");
      assert.equal((requests[0].init?.headers as Props)["x-organization-id"], "org-a");
      assert.deepEqual(JSON.parse(String(requests[0].init?.body)), { billId: "bill-a", amountMinor: "1" });
    } finally { globalThis.fetch = previous; }
    const invalid = loaded("[id]/page.tsx", "DebitNoteDetail", { ...states, "DebitNoteDetail.applyAmount": "40000000000000.02" }, { id: "doc-a", orgId: "org-a" });
    assert.ok(invalid.render(p).includes('role="alert"'));
    assert.equal(control(invalid, c => typeof c.props.onClick === "function" && (c.props.onClick as () => void).name === "handleApply").disabled, true);
  }
});

test("installed CSS supports logical debit layout, scrolling and complete long controls", async () => {
  const compiler = await compile("@theme { --spacing:0.25rem; --breakpoint-sm:40rem; --color-blue-400:#60a5fa; } @tailwind utilities;");
  const css = compiler.build(["start-2.5", "ps-8", "me-2", "text-end", "border-s-[3px]", "border-s-blue-400", "min-w-0", "max-w-full", "flex-wrap", "overflow-x-auto", "overflow-y-auto", "max-h-dvh", "[overflow-wrap:anywhere]", "rtl:rotate-180", "h-auto", "whitespace-normal", "*:data-[slot=select-value]:line-clamp-none"]);
  for (const rule of ["inset-inline-start:", "padding-inline-start:", "margin-inline-end:", "text-align: end", "border-inline-start-width:", "border-inline-start-color:", "min-width:", "max-width: 100%", "flex-wrap: wrap", "overflow-x: auto", "overflow-y: auto", "max-height: 100dvh", "overflow-wrap: anywhere", "rotate: 180deg", "height: auto", "white-space: normal", "-webkit-line-clamp: unset"]) assert.ok(css.includes(rule), rule);
});
