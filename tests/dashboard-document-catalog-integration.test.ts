import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { test } from "node:test";
import * as React from "react";
import * as jsx from "react/jsx-runtime";
import * as intl from "next-intl";
import ts from "typescript";
import * as provider from "../i18n/provider";
import * as DataTable from "../components/dashboard/data-table";
import * as SearchInput from "../components/ui/search-input";
import * as CurrencySelect from "../components/ui/currency-select";
import * as BrandLoader from "../components/dashboard/brand-loader";
import * as ErrorState from "../components/dashboard/error-state";
import { displayMoney } from "../lib/money/contact-dashboard-ui";
import { resolvePresentation } from "../i18n/locale";
import { renderWithPresentation } from "./helpers/presentation";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const routes = ["dashboard/page", "dashboard/loading", "documents/page", "documents/loading"];
const shared = ["activity-feed", "cash-flow-widget", "email-history", "send-document-dialog", "file-uploader", "receipt-attachments", "brand-loader", "error-state", "stat-card", "data-table"];
const files = [...routes.map(p => `app/(dashboard)/${p}.tsx`), ...shared.map(p => `components/dashboard/${p}.tsx`), "components/ui/search-input.tsx"];
const namespaces = ["DashboardOverview", "DocumentWorkspace", "DocumentEmailHistory", "DocumentSend", "JournalActivity", "SettingsAudit", "SharedUI", "Upload", "ReceiptAttachments"] as const;
const stripeCopy = ["Payment", "No payment link", "Online payment (Stripe)", "- not connected", 'A &quot;Pay invoice&quot; button will be included in the email, linking to a Stripe checkout page.'];

test("LOC-071 reconciles four routes, eleven shared surfaces and nine paired namespaces with exact copy exceptions", () => {
  for (const domain of ["dashboard", "documents"]) assert.deepEqual(readdirSync(`app/(dashboard)/${domain}`).sort(), ["loading.tsx", "page.tsx"]);
  const found = new Set<string>();
  const exceptions: string[] = [];
  for (const file of files) {
    const ast = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(n: ts.Node) {
      if (ts.isJsxText(n) && /[A-Za-z]/.test(n.text)) {
        const value = n.text.trim();
        assert.ok(file.endsWith("/send-document-dialog.tsx") && stripeCopy.includes(value), `${file}: uncataloged JSX ${value}`);
        exceptions.push(value);
      }
      if (ts.isJsxAttribute(n) && ["title", "description", "placeholder", "aria-label", "alt", "label", "emptyMessage"].includes(n.name.getText(ast)) && n.initializer && ts.isStringLiteral(n.initializer) && /[A-Za-z]/.test(n.initializer.text)) {
        assert.equal(file, "components/dashboard/send-document-dialog.tsx");
        assert.equal(n.getText(ast), 'placeholder="recipient@example.com"');
      }
      if (ts.isCallExpression(n)) {
        const name = n.expression.getText(ast);
        if (name === "useTranslations" && n.arguments[0] && ts.isStringLiteral(n.arguments[0])) found.add(n.arguments[0].text);
        if (name === "useDocumentTitle" || /^toast\.(error|success)$/.test(name)) assert.ok(!n.arguments.some(ts.isStringLiteral), `${file}: uncataloged notification/title`);
      }
      ts.forEachChild(n, visit);
    }
    visit(ast);
  }
  assert.equal(files.length, 15);
  assert.deepEqual([...found].sort(), [...namespaces].sort());
  assert.deepEqual(exceptions.sort(), [...stripeCopy].sort(), "DEC-008 exception inventory must remain explicit");
  // Includes the shared confirmation title, cancel and confirm defaults.
  assert.equal(namespaces.reduce((n, ns) => n + Object.keys(en[ns]).length, 0), 344);
  for (const ns of namespaces) {
    assert.deepEqual(Object.keys(en[ns]).sort(), Object.keys(fa[ns]).sort());
    for (const [key, value] of Object.entries(fa[ns])) { assert.match(value, /[\u0600-\u06ff]/, `${ns}.${key}`); assert.ok(!value.includes("???")); }
  }
});

type Props = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const caller = "<script>caller & name</script>", large = 9007199254740001n;
const dashboard = "app/(dashboard)/dashboard/page.tsx";
const component = (name: string) => `components/dashboard/${name}.tsx`;

// Compile production components together, retaining one real presentation
// provider. Only hooks/IO, motion/charts and portal primitives are controlled.
function composition(states: Record<string, Props> = {}) {
  const captured: Props[] = [], changes: [string, string, unknown][] = [];
  const cache = new Map<string, Record<string, React.ComponentType<Props>>>();
  const box = ({ children }: Props) => React.createElement("div", null, children);
  const capture = (factory: typeof jsx.jsx) => (type: Parameters<typeof jsx.jsx>[0], props: Props, key: string) => { captured.push(props); return factory(type, props, key); };
  function compile(file: string): Record<string, React.ComponentType<Props>> {
    if (cache.has(file)) return cache.get(file)!;
    const source = readFileSync(file, "utf8"), ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const names: string[] = [];
    function walk(n: ts.Node) {
      if (ts.isVariableDeclaration(n) && ts.isArrayBindingPattern(n.name) && n.initializer && ts.isCallExpression(n.initializer) && n.initializer.expression.getText(ast) === "useState") names.push(n.name.elements[0].getText(ast));
      ts.forEachChild(n, walk);
    }
    walk(ast);
    let index = 0;
    const require = createRequire(resolve(file)), compiled = { exports: {} as Record<string, React.ComponentType<Props>> };
    function load(id: string): unknown {
      if (id === "react") return { ...React, useState: (initial: unknown) => { const name = names[index++]; return [Object.hasOwn(states[file] ?? {}, name) ? states[file][name] : typeof initial === "function" ? initial() : initial, (value: unknown) => changes.push([file, name, value])]; }, useEffect: () => {}, useCallback: (fn: unknown) => fn };
      if (id === "react/jsx-runtime") return { ...jsx, jsx: capture(jsx.jsx), jsxs: capture(jsx.jsxs) };
      if (id === "next-intl") return intl;
      if (id === "@/i18n/provider") return provider;
      if (id.endsWith("/data-table")) return DataTable;
      if (id.endsWith("/search-input")) return SearchInput;
      if (id.endsWith("/currency-select")) return CurrencySelect;
      if (id.endsWith("/brand-loader")) return BrandLoader;
      if (id.endsWith("/error-state")) return ErrorState;
      for (const name of ["activity-feed", "cash-flow-widget", "file-uploader"]) if (id === `@/components/dashboard/${name}` || id === `./${name}`) return compile(component(name));
      if (id === "next/navigation") return { useRouter: () => ({ push: (url: string) => changes.push([file, "push", url]) }) };
      if (id === "next-auth/react") return { useSession: () => ({ data: { user: { name: caller } } }) };
      if (id === "motion/react") return { AnimatePresence: box, MotionConfig: box, motion: { div: box } };
      if (id === "@paper-design/shaders-react") return { GrainGradient: () => null };
      if (id === "recharts") return new Proxy({}, { get: () => box });
      if (/\/ui\/(dialog|sheet|dropdown-menu|select|tabs)$/.test(id)) return new Proxy({}, { get: () => box });
      if (id.endsWith("/create-drawer")) return { useCreateDrawer: () => ({ open: (value: string) => changes.push([file, "open", value]) }) };
      if (id.endsWith("/use-document-title")) return { useDocumentTitle: () => {} };
      if (id.endsWith("/use-confirm")) return { useConfirm: () => ({ dialog: null, confirm: async () => false }) };
      if (id.endsWith("/use-debounce")) return { useDebounce: (value: unknown) => value };
      if (id === "sonner") return { toast: { error: () => {}, success: () => {} } };
      return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
    }
    new Function("require", "module", "exports", ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText)(load, compiled, compiled.exports);
    const exports = Object.fromEntries(Object.entries(compiled.exports).map(([name, Original]) => [name, (props: Props) => { index = 0; return React.createElement(Original, props); }]));
    cache.set(file, exports);
    return exports;
  }
  return { compile, captured, changes };
}

test("dashboard composes actual activity and cash widgets under one locale with exact money and canonical navigation", () => {
  for (const locale of ["en-US", "fa-IR"] as const) {
    const m = locale === "en-US" ? en : fa;
    const h = composition({
      [dashboard]: { loading: false, greeting: "morning0", pnl: { currencyCode: "KWD", totalRevenue: large, totalExpenses: 1n, netIncome: large - 1n, expenses: [] } },
      [component("cash-flow-widget")]: { loading: false, error: "forecastError" },
      [component("activity-feed")]: { loading: false, entries: [{ id: "audit-id", action: "create", entityType: "invoice", userName: caller, createdAt: "invalid-date" }, { id: "unknown", action: "custom_code", entityType: "custom_entity", userName: caller, createdAt: "invalid-date" }] },
    });
    const html = renderWithPresentation(React.createElement(h.compile(dashboard).default), locale);
    for (const value of [m.DashboardOverview.revenue, m.DashboardOverview.forecastTitle, m.DashboardOverview.forecastError, m.JournalActivity.title, m.JournalActivity.viewAll, m.SettingsAudit.action_create, m.SettingsAudit.entity_invoice, m.SettingsAudit.unknownDate, displayMoney(large, "KWD", resolvePresentation({ user: { language: locale } }))]) assert.ok(html.includes(value), value);
    assert.ok(html.includes("&lt;script&gt;caller &amp; name&lt;/script&gt;"));
    assert.ok(html.includes('href="/settings/audit-log"'));
    assert.ok(html.includes("custom_code") && html.includes("custom entity"), "unknown audit values retain technical-data exception");
    assert.ok(!html.includes("MISSING_MESSAGE") && !html.includes("<script>"));
    const period = h.captured.find(p => p.children === intl.createTranslator({ locale, messages: m, namespace: "DashboardOverview" })("periodDays", { count: 60 }));
    period!.onClick();
    assert.ok(h.changes.some(([file, key, value]) => file === component("cash-flow-widget") && key === "weeks" && value === 9));
  }
});

test("document workspace, send/history and attachment uploader share locale while loaders/errors retain shared translations", () => {
  for (const locale of ["en-US", "fa-IR"] as const) {
    const m = locale === "en-US" ? en : fa;
    const h = composition({
      "app/(dashboard)/documents/page.tsx": { loading: false, documents: [{ id: "doc", fileName: caller, fileSize: 2048, mimeType: "application/pdf", folderId: null, visibility: "organization", uploadedBy: "owner", createdAt: "2026-10-23T00:00:00Z" }] },
      [component("send-document-dialog")]: { recipientEmail: "person@example.test" },
      [component("email-history")]: { loading: false, emails: [{ id: "log", recipientEmail: "person@example.test", subject: caller, status: "sent", sentAt: "2026-10-16T23:58:00Z" }] },
      [component("receipt-attachments")]: { docs: [{ id: "doc", fileName: caller, mimeType: "application/pdf" }] },
    });
    const html = renderWithPresentation(React.createElement(React.Fragment, null,
      React.createElement(h.compile("app/(dashboard)/documents/page.tsx").default),
      React.createElement(h.compile(component("send-document-dialog")).SendDocumentDialog, { open: true, onOpenChange: () => {}, onSent: () => {}, documentType: "quote", documentId: "document-id", documentNumber: "Q-42", contactName: caller, amountDue: large, currencyCode: "KWD", sendApiUrl: "/api/v1/quotes/document-id/send" }),
      React.createElement(h.compile(component("email-history")).EmailHistory, { documentType: "quote", documentId: "document-id" }),
      React.createElement(h.compile(component("receipt-attachments")).ReceiptAttachments, { orgId: "org-id", entityType: "invoice", entityId: "document-id" }),
      React.createElement(BrandLoader.BrandLoader), React.createElement(ErrorState.ErrorState, { onRetry: () => {} }),
    ), locale);
    for (const value of [m.DocumentWorkspace.documents, m.DocumentSend.sendEmail, m.DocumentSend.type_quote, m.DocumentEmailHistory.title, m.DocumentEmailHistory.sent, m.ReceiptAttachments.label, m.Upload.dropAFileOrClickToUpload, m.SharedUI.loading2, m.SharedUI.tryAgain]) assert.ok(html.includes(value), value);
    assert.ok(html.includes("&lt;script&gt;caller &amp; name&lt;/script&gt;"));
    assert.ok(html.includes("9,007,199,254,740.001"));
    assert.ok(!html.includes("MISSING_MESSAGE") && !html.includes("<script>"));
    for (const route of ["dashboard", "documents"]) assert.ok(renderWithPresentation(React.createElement(h.compile(`app/(dashboard)/${route}/loading.tsx`).default), locale).includes(m.SharedUI.loading2));
  }
});
