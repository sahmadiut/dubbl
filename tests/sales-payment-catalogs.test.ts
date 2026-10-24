import { resolvePresentation } from "../i18n/locale";
import { displayNumberFixture } from "./helpers/localized-fixtures";
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { createElement, type ComponentType, type ReactNode } from "react";
import * as React from "react";
import * as nextIntl from "next-intl";
import { createTranslator } from "next-intl";
import ts from "typescript";
import * as DatePicker from "../components/ui/date-picker";
import * as DataTable from "../components/dashboard/data-table";
import * as BrandLoader from "../components/dashboard/brand-loader";
import { salesPaymentMethodLabel, salesPaymentDocumentLabel } from "../i18n/sales-payment-presentation";
import { paymentUiRow, paymentUiMoney, paymentUiSummary } from "../lib/money/payment-ui";
import { renderWithPresentation } from "./helpers/presentation";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const listPath = "app/(dashboard)/sales/payments/page.tsx";
const detailPath = "app/(dashboard)/sales/payments/[id]/page.tsx";
const locales = ["en-US", "fa-IR"] as const;
const noop = () => {};
const caller = "<script>مشتری & bank</script>";
const raw = {
  id: "payment-a", paymentNumber: "PMT-001", type: "received", date: "2026-10-18",
  amount: 9007199254740991, amountMinor: "9007199254740991", currencyCode: "USD", method: "bank_transfer",
  reference: caller, notes: caller, contactId: "customer-a", contact: { name: caller, email: null },
  bankAccount: { name: caller },
  allocations: [{ documentType: "invoice", documentId: "invoice-a", amount: 1, amountMinor: "1" },
    { documentType: "credit_note", documentId: "credit-a", amount: -1, amountMinor: "-1" }],
};
const saved = paymentUiRow(raw);
function translator(locale: typeof locales[number]) {
  return createTranslator({ locale, messages: locale === "en-US" ? en : fa, namespace: "SalesPayments" });
}
function escape(text: string) { return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("'", "&#x27;").replaceAll('"', "&quot;"); }

// Production templates, next-intl, fields, table, money and headers remain real.
// Control component state/navigation; inline Select portals to inspect choices.
function loaded(path: string, name: string, states: unknown[], titles: (string | undefined)[] = []) {
  const source = readFileSync(path, "utf8");
  const require = createRequire(resolve(path));
  const compiled = { exports: {} as Record<string, ComponentType<Record<string, unknown>>> };
  const code = ts.transpileModule(`${source}\nexport { ${name} };`, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  let index = 0;
  const inline = ({ children }: { children: ReactNode }) => createElement("div", null, children);
  const load = (id: string) => {
    if (id === "react") return { ...React, useState: (initial: unknown) => [index < states.length ? states[index++] : initial, noop], useEffect: noop, useCallback: (fn: unknown) => fn, useMemo: (fn: () => unknown) => fn() };
    if (id === "next-intl") return nextIntl;
    if (id.endsWith("/ui/date-picker")) return DatePicker;
    if (id.endsWith("/data-table")) return DataTable;
    if (id.endsWith("/brand-loader")) return BrandLoader;
    if (id === "next/navigation") return { useRouter: () => ({ push: noop }), useParams: () => ({ id: raw.id }) };
    if (id.endsWith("/use-document-title")) return { useDocumentTitle: (title: string) => titles.push(title) };
    if (id.endsWith("/use-entity-title")) return { useEntityTitle: (title?: string) => titles.push(title) };
    if (id.endsWith("/use-debounce")) return { useDebounce: (value: string) => value };
    if (id.endsWith("/ui/select")) return { Select: ({ children, value }: { children: ReactNode; value: string }) => createElement("div", { "data-value": value }, children), SelectItem: ({ children, value }: { children: ReactNode; value: string }) => createElement("div", { "data-option": value }, children), SelectTrigger: inline, SelectValue: ({ placeholder }: { placeholder: string }) => createElement("span", null, placeholder), SelectContent: inline };
    return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  };
  new Function("require", "module", "exports", code)(load, compiled, compiled.exports);
  return compiled.exports[name];
}

// Execute the actual callback syntax with controlled network/state boundaries.
function callback(path: string, name: string, scope: Record<string, unknown>, effectIndex = 0) {
  const source = readFileSync(path, "utf8");
  const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let expression = "", seen = 0;
  function visit(node: ts.Node) {
    if (name === "effect" && ts.isCallExpression(node) && node.expression.getText(ast) === "useEffect" && seen++ === effectIndex) expression = node.arguments[0].getText(ast);
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name && node.initializer && ts.isCallExpression(node.initializer)) expression = node.initializer.arguments[0].getText(ast);
    ts.forEachChild(node, visit);
  }
  visit(ast); assert.ok(expression, name);
  const code = ts.transpileModule(`const run = ${expression};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(scope), `${code}; return run;`)(...Object.values(scope));
}

test("production payment list renders translated empty, loading, error, filters, plural counts and exact mixed-currency sample", () => {
  for (const locale of locales) {
    const t = translator(locale), titles: (string | undefined)[] = [];
    const Empty = loaded(listPath, "PaymentsList", [[], "", false], titles);
    const empty = renderWithPresentation(createElement(Empty, { orgId: "org-a" }), locale);
    for (const key of ["title", "description", "emptyTitle", "emptyDescription", "backInvoices"] as const) assert.ok(empty.includes(escape(t(key))), key);
    assert.deepEqual(titles, [t("documentTitle")]);
    const rows = [saved, { ...saved, id: "b", paymentNumber: "PMT-002", amount: 1n, allocations: [saved.allocations[0]] },
      { ...saved, id: "c", paymentNumber: "PMT-003", currencyCode: "KWD", amount: 1n, method: "__proto__", allocations: [] }];
    const Page = loaded(listPath, "PaymentsList", [rows, "", false, "", "all", "", "", "date", "desc", 0]);
    const html = renderWithPresentation(createElement(Page, { orgId: "org-a" }), locale);
    for (const key of ["sampleHint", "totalReceived", "average", "search", "allMethods", "bankTransfer", "cash", "check", "card", "other", "from", "to", "startDate", "endDate", "sort", "newest", "oldest", "highest", "lowest", "numberDesc", "numberAsc", "number", "customer", "date", "method", "reference", "amount", "allocations"] as const) assert.ok(html.includes(escape(t(key))), key);
    for (const value of ["all", "bank_transfer", "cash", "check", "card", "other", "date:desc", "date:asc", "amount:desc", "amount:asc", "number:desc", "number:asc"]) assert.ok(html.includes(`data-option="${value}"`));
    assert.ok(html.includes(escape(paymentUiSummary(rows, resolvePresentation({ user: { language: locale } })).total)));
    assert.ok(html.includes(displayNumberFixture("90,071,992,547,409.92", locale)) && html.includes(displayNumberFixture("0.001", locale)));
    for (const count of [1, 2]) assert.ok(html.includes(escape(t("invoiceCount", { count }))));
    assert.ok(html.includes(escape(caller)) && !html.includes("<script>"));
    assert.ok(html.includes("__proto__"));
    const Filtered = loaded(listPath, "PaymentsList", [rows, "", false, "missing", "cash", "2026-10-19", "", "date", "desc", 0]);
    const filtered = renderWithPresentation(createElement(Filtered, { orgId: "org-a" }), locale);
    assert.ok(filtered.includes(escape(t("noMatches"))) && filtered.includes(escape(t("clearFilters"))));
    const Failed = loaded(listPath, "PaymentsList", [[], t("readFailed"), false]);
    const failed = renderWithPresentation(createElement(Failed, { orgId: "org-a" }), locale);
    assert.ok(failed.includes('role="alert"') && failed.includes(t("readFailed")) && !failed.includes(t("emptyTitle")));
    const Loading = loaded(listPath, "PaymentsList", [[], "", true]);
    assert.ok(!renderWithPresentation(createElement(Loading, { orgId: "org-a" }), locale).includes(t("emptyTitle")));
  }
});

test("production detail renders exact signed allocations, historical warning, safe caller text and translated missing/loading states", () => {
  for (const locale of locales) {
    const t = translator(locale), titles: (string | undefined)[] = [];
    const pmt = { ...saved, allocations: [...saved.allocations, { documentType: "future_document", documentId: "future", amount: 0n }] };
    const Page = loaded(detailPath, "PaymentDetail", [pmt, false, { "invoice-a": { invoiceNumber: "INV-A", contact: { name: caller } } }, ""], titles);
    const html = renderWithPresentation(createElement(Page, { id: raw.id, orgId: "org-a" }), locale);
    assert.deepEqual(titles, [t("paymentTitle", { number: raw.paymentNumber })]);
    for (const key of ["back", "paymentAmount", "allocated", "unallocated", "coveredInvoices", "notes", "bankTransferDetail", "creditNote"] as const) assert.ok(html.includes(escape(t(key))), key);
    for (const message of [t("fromCustomer", { name: caller }), t("referenceValue", { reference: caller }), t("intoAccount", { name: caller }), t("received", { date: raw.date }), t("historicalBalance", { amount: paymentUiMoney(saved.unallocated, "USD", resolvePresentation({ user: { language: locale } })) })]) assert.ok(html.includes(escape(message)));
    assert.ok(html.includes('href="/sales/invoices/invoice-a"') && html.includes("INV-A"));
    assert.ok(html.includes(locale === "fa-IR" ? "‎−‎دلار ۰٫۰۱" : "-$0.01") && html.includes("future_document") && !html.includes("<script>"));
    const Unlinked = loaded(detailPath, "PaymentDetail", [{ ...saved, allocations: [], contact: null }, false, {}, ""]);
    const unlinked = renderWithPresentation(createElement(Unlinked, { id: raw.id, orgId: "org-a" }), locale);
    assert.ok(unlinked.includes(escape(t("noAllocations"))) && unlinked.includes(escape(t("fromCustomer", { name: t("unknown") }))));
    for (const [state, key] of [[[null, true, {}, ""], "loading"], [[null, false, {}, ""], "notFound"], [[null, false, {}, t("readFailed")], "readFailed"]] as const) {
      const State = loaded(detailPath, "PaymentDetail", [...state]);
      assert.ok(renderWithPresentation(createElement(State, { id: raw.id, orgId: "org-a" }), locale).includes(escape(t(key))));
    }
  }
});

test("finite method/document display labels translate known values and preserve unknown/prototype codes", () => {
  for (const locale of locales) {
    const t = translator(locale);
    for (const value of ["__proto__", "constructor", "future_code"]) {
      assert.equal(salesPaymentMethodLabel(t, value), value);
      assert.equal(salesPaymentDocumentLabel(t, value), value);
    }
    assert.equal(salesPaymentMethodLabel(t, "bank_transfer"), t("bankTransfer"));
    assert.equal(salesPaymentMethodLabel(t, "bank_transfer", true), t("bankTransferDetail"));
    for (const [value, key] of [["invoice", "invoice"], ["bill", "bill"], ["credit_note", "creditNote"], ["debit_note", "debitNote"], ["prepayment", "prepayment"]] as const) assert.equal(salesPaymentDocumentLabel(t, value), t(key));
    for (const count of [0, 1, 2]) assert.ok(t("invoiceCount", { count }).length);
    if (locale === "fa-IR") for (const key of Object.keys(en.SalesPayments) as (keyof typeof en.SalesPayments)[]) assert.match(fa.SalesPayments[key], /[\u0600-\u06ff]/);
  }
});

test("actual list/detail fetch callbacks retain org/read-only paths, validate money, localize all failures and ignore aborted results", async () => {
  for (const locale of locales) for (const mode of ["success", "status", "network", "html", "alias", "allocation", "shape", "aborted"]) for (const detail of [false, true]) {
    const t = translator(locale), rows: unknown[] = [], errors: string[] = [], busy: boolean[] = [];
    const controller = new AbortController();
    const bodyRow = { ...raw, amountMinor: mode === "alias" ? "09007199254740991" : raw.amountMinor,
      allocations: mode === "allocation" ? [{ ...raw.allocations[0], amountMinor: "2" }] : raw.allocations };
    const fetch = async (url: string, init: RequestInit) => {
      assert.equal(url, detail ? `/api/v1/payments/${raw.id}` : "/api/v1/payments?type=received");
      assert.equal((init.headers as Record<string, string>)["x-organization-id"], "org-a");
      assert.equal(init.method, undefined); assert.equal(init.body, undefined);
      if (mode === "aborted") (init.signal === controller.signal ? controller : activeController).abort();
      if (mode === "network") throw new Error("secret server prose");
      if (mode === "html") return new Response("private HTML");
      return Response.json(mode === "shape" ? null : detail ? { payment: bodyRow } : { data: [bodyRow] }, { status: mode === "status" ? 403 : 200 });
    };
    let activeController = controller;
    const scope = { t, orgId: "org-a", id: raw.id, paymentUiRow, fetch, devDelay: async () => {}, setPmt: (value: unknown) => rows.push(value), setPayments: (value: unknown) => rows.push(value), setReadError: (value: string) => errors.push(value), setLoading: (value: boolean) => busy.push(value) };
    let cleanup: (() => void) | undefined;
    if (detail) callback(detailPath, "loadPayment", scope)(controller.signal);
    else cleanup = callback(listPath, "effect", { ...scope, AbortController: function () { activeController = new AbortController(); return activeController; } })();
    await new Promise(resolve => setImmediate(resolve));
    if (mode === "aborted") { assert.deepEqual(rows, []); assert.deepEqual(errors, []); assert.deepEqual(busy, []); }
    else {
      assert.deepEqual(busy, [false]);
      assert.deepEqual(errors, [mode === "success" ? "" : t("readFailed")]);
      assert.deepEqual(rows, mode === "success" ? [detail ? saved : [saved]] : [detail ? null : []]);
    }
    cleanup?.(); assert.equal(activeController.signal.aborted, !detail || mode === "aborted");
  }
  const scope = { orgId: null, fetch: () => assert.fail("missing org must not fetch") };
  callback(listPath, "effect", scope)(); callback(detailPath, "loadPayment", scope)();
});

test("actual filters and exact amount sorting use canonical method/date codes across locales", () => {
  const rows = [saved, { ...saved, id: "b", date: "2026-10-19", paymentNumber: "PMT-002", amount: 1n, method: "cash" }, { ...saved, id: "c", currencyCode: "KWD", amount: 2n }];
  for (const locale of locales) {
    const base = { t: translator(locale), payments: rows, debouncedSearch: "", methodFilter: "all", dateFrom: "", dateTo: "", sortBy: "amount", sortOrder: "asc" };
    const run = (changes: Record<string, unknown>) => callback(listPath, "filtered", { ...base, ...changes })();
    assert.deepEqual(run({}).map((p: typeof saved) => p.id), ["c", "b", saved.id]);
    assert.deepEqual(run({ sortOrder: "desc" }).map((p: typeof saved) => p.id), [saved.id, "b", "c"]);
    assert.deepEqual(run({ methodFilter: "cash" }).map((p: typeof saved) => p.id), ["b"]);
    assert.deepEqual(run({ dateFrom: "2026-10-19", dateTo: "2026-10-19" }).map((p: typeof saved) => p.id), ["b"]);
    assert.deepEqual(run({ debouncedSearch: "pmt-002" }).map((p: typeof saved) => p.id), ["b"]);
    assert.equal(run({ debouncedSearch: "مشتری" }).length, 3);
    assert.equal(run({ debouncedSearch: "no match" }).length, 0);
  }
});

test("actual invoice-label lookup stays contact/org scoped, read-only and abortable", async () => {
  const lookups: unknown[] = [];
  const run = callback(detailPath, "effect", { orgId: "org-a", pmt: saved, setInvoiceLookup: (value: unknown) => lookups.push(value), fetch: async (url: string, init: RequestInit) => {
    assert.equal(url, "/api/v1/invoices?limit=100&contactId=customer-a");
    assert.equal((init.headers as Record<string, string>)["x-organization-id"], "org-a");
    assert.equal(init.method, undefined); assert.equal(init.body, undefined);
    return Response.json({ data: [{ id: "invoice-a", invoiceNumber: "INV-A" }] });
  } }, 1);
  const cleanup = run(); await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(lookups, [{ "invoice-a": { id: "invoice-a", invoiceNumber: "INV-A" } }]); cleanup();
});
