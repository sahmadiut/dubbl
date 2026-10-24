import { resolvePresentation } from "../i18n/locale";
import { displayNumberFixture } from "./helpers/localized-fixtures";
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { createElement, type ComponentType } from "react";
import * as React from "react";
import * as nextIntl from "next-intl";
import { createTranslator } from "next-intl";
import ts from "typescript";
import * as DatePicker from "../components/ui/date-picker";
import * as DataTable from "../components/dashboard/data-table";
import * as BrandLoader from "../components/dashboard/brand-loader";
import * as Details from "../components/dashboard/procurement-money-details";
import { goodsReceiptStatusLabel } from "../i18n/goods-receipt-presentation";
import { procurementReceipt, procurementMoney, procurementOverviewText, procurementFilter } from "../lib/money/procurement-ui";
import { renderWithPresentation } from "./helpers/presentation";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const listPath = "app/(dashboard)/purchases/goods-receipts/page.tsx";
const detailPath = "app/(dashboard)/purchases/goods-receipts/[id]/page.tsx";
const locales = ["en-US", "fa-IR"] as const;
const noop = () => {};
const caller = "<script>تأمین‌کننده & stock</script>";
const raw = { id: "receipt-a", receiptNumber: "GRN-A", date: "2026-10-18", status: "received", currencyCode: "USD",
  contact: { name: caller }, notes: caller, purchaseOrderId: "order-a", purchaseOrder: { id: "order-a", poNumber: caller },
  lines: [{ id: "line-a", description: caller, quantityReceived: 100, quantityReceivedExact: "1.00",
    unitCost: 9007199254740991, unitCostMinor: "9007199254740991", journalEntryId: "journal-a",
    inventoryItem: { name: caller, sku: caller }, warehouse: { name: caller } }] };
const saved = procurementReceipt(raw);
function translator(locale: typeof locales[number]) {
  return createTranslator({ locale, messages: locale === "en-US" ? en : fa, namespace: "GoodsReceipts" });
}
function escape(text: string) { return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("'", "&#x27;").replaceAll('"', "&quot;"); }

// Render production templates with the real provider, table, dates and money.
// Control state/effects/navigation; this is not a mounted browser interaction.
function loaded(path: string, name: string, states: unknown[], titles: (string | undefined)[] = []) {
  const require = createRequire(resolve(path));
  const compiled = { exports: {} as Record<string, ComponentType> };
  const code = ts.transpileModule(`${readFileSync(path, "utf8")}\nexport { ${name} };`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  let index = 0;
  const load = (id: string) => {
    if (id === "react") return { ...React, useState: (initial: unknown) => [index < states.length ? states[index++] : initial, noop], useRef: (current: unknown) => ({ current }), useEffect: noop, useCallback: (fn: unknown) => fn, useMemo: (fn: () => unknown) => fn() };
    if (id === "next-intl") return nextIntl;
    if (id.endsWith("/ui/date-picker")) return DatePicker;
    if (id.endsWith("/data-table")) return DataTable;
    if (id.endsWith("/brand-loader")) return BrandLoader;
    if (id.endsWith("/procurement-money-details")) return Details;
    if (id === "next/navigation") return { useRouter: () => ({ push: noop }), useParams: () => ({ id: raw.id }) };
    if (id.endsWith("/use-document-title")) return { useDocumentTitle: (title: string) => titles.push(title) };
    if (id.endsWith("/use-entity-title")) return { useEntityTitle: (title?: string) => titles.push(title) };
    if (id.endsWith("/use-debounce")) return { useDebounce: (value: string) => value };
    return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  };
  new Function("require", "module", "exports", code)(load, compiled, compiled.exports);
  return compiled.exports[name];
}

function callback(path: string, name: string, scope: Record<string, unknown>) {
  const source = readFileSync(path, "utf8");
  const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let expression = "";
  function visit(node: ts.Node) {
    if (name === "effect" && !expression && ts.isCallExpression(node) && node.expression.getText(ast) === "useEffect") expression = node.arguments[0].getText(ast);
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) expression = node.getText(ast);
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name && node.initializer && ts.isCallExpression(node.initializer)) expression = node.initializer.arguments[0].getText(ast);
    ts.forEachChild(node, visit);
  }
  visit(ast); assert.ok(expression, name);
  const code = ts.transpileModule(`const run = ${expression};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(scope), `${code}; return run;`)(...Object.values(scope));
}
function listState(rows: unknown[], changes: Record<number, unknown> = {}) {
  const state: unknown[] = [null, rows, false, false, false, 1, rows.length, 0, "all", "created", "desc", "", "", "", 0];
  for (const [index, value] of Object.entries(changes)) state[Number(index)] = value;
  return state;
}

test("goods receipt production list translates guidance, columns, states and plurals with exact currency groups", () => {
  for (const locale of locales) {
    const t = translator(locale), titles: (string | undefined)[] = [];
    const Empty = loaded(listPath, "GoodsReceiptsContent", listState([]), titles);
    const empty = renderWithPresentation(createElement(Empty), locale);
    for (const key of ["title", "description", "goOrders", "howReceiving", "orderPlaced", "goodsReceived", "stockOnHand", "updated", "howRecord", "openOrder", "openOrderHint", "markArrived", "markArrivedHint", "stockUpdates", "stockUpdatesHint", "billLater", "billLaterHint"] as const) assert.ok(empty.includes(escape(t(key))), key);
    assert.deepEqual(titles, [t("documentTitle")]);
    assert.ok(empty.includes('href="/purchases/orders"') && empty.includes("PO-0042") && empty.includes(locale === "fa-IR" ? "‎دلار ۱٬۲۰۰٫۰۰" : "$1,200.00"));
    const rows = [saved, { ...saved, id: "b", receiptNumber: "GRN-B" },
      { ...saved, id: "c", currencyCode: "KWD", total: 1n, status: "void" },
      { ...saved, id: "d", currencyCode: "KWD", total: 1n, status: "future_code" }];
    const Page = loaded(listPath, "GoodsReceiptsContent", listState(rows));
    const html = renderWithPresentation(createElement(Page), locale);
    for (const key of ["sampleValue", "receipts", "sampleHint", "all", "receivedTab", "billedTab", "cancelledTab", "billedHint", "receivedFrom", "purchaseOrder", "search", "from", "to", "startDate", "endDate", "number", "supplier", "date", "status", "valueReceived", "receivedStatus", "cancelledStatus"] as const) assert.ok(html.includes(escape(t(key))), key);
    assert.ok(html.includes(escape(t("showing", { loaded: 4, total: 4 }))));
    assert.ok(html.includes(escape(procurementOverviewText(rows, undefined, resolvePresentation({ user: { language: locale } })))));
    assert.ok(html.includes(displayNumberFixture("180,143,985,094,819.82", locale)) && html.includes(displayNumberFixture("0.001", locale)));
    assert.ok(html.includes(escape(caller)) && !html.includes("<script>") && html.includes("future_code"));
    for (const [changes, key] of [[{ 11: "missing" }, "noMatches"], [{ 0: t("readFailed") }, "readFailed"]] as const) {
      const State = loaded(listPath, "GoodsReceiptsContent", listState(rows, changes));
      const stateHtml = renderWithPresentation(createElement(State), locale);
      assert.ok(stateHtml.includes(escape(t(key))));
      if (key === "noMatches") assert.ok(stateHtml.includes(escape(t("clearFilters"))));
      else assert.ok(stateHtml.includes('role="alert"'));
    }
    const Loading = loaded(listPath, "GoodsReceiptsContent", listState([], { 2: true }));
    assert.ok(!renderWithPresentation(createElement(Loading), locale).includes(escape(t("howReceiving"))));
    for (const count of [0, 1, 2]) {
      assert.ok(t("showing", { loaded: count, total: count }).length);
      assert.ok(t("itemCount", { count }).length);
    }
  }
});

test("goods receipt detail renders translated status/actions/lines, escaped caller data and exact quantities", () => {
  for (const locale of locales) {
    const t = translator(locale), titles: (string | undefined)[] = [];
    const Page = loaded(detailPath, "GoodsReceiptDetailContent", [saved, false, null, false], titles);
    const html = renderWithPresentation(createElement(Page), locale);
    assert.deepEqual(titles, [raw.receiptNumber]);
    for (const key of ["back", "openOrderTooltip", "createBillTooltip", "createBill", "journalTooltip", "viewJournal", "receivedStatus", "valueReceived", "itemsReceived", "notes"] as const) assert.ok(html.includes(escape(t(key))), key);
    for (const message of [t("fromSupplier", { name: caller }), t("viewOrder", { number: caller }), t("receivedDate", { date: raw.date }), t("orderNumber", { number: caller }), t("itemCount", { count: 1 })]) assert.ok(html.includes(escape(message)));
    for (const href of ["/purchases/goods-receipts", "/purchases/orders/order-a", "/accounting/journal-a"]) assert.ok(html.includes(`href="${href}"`));
    assert.ok(html.includes(escape(procurementMoney(saved.total, "USD", resolvePresentation({ user: { language: locale } })))) && !html.includes("<script>"));
    const pd = createTranslator({ locale, messages: locale === "en-US" ? en : fa, namespace: "ProcurementDetails" });
    for (const key of ["item", "quantity", "unitCost", "amount", "location"] as const) assert.ok(html.includes(escape(pd(key))), key);
    assert.ok(html.includes(escape(pd("totalValue", { amount: procurementMoney(saved.total, "USD", resolvePresentation({ user: { language: locale } })) }))));
    const Cancelled = loaded(detailPath, "GoodsReceiptDetailContent", [{ ...saved, status: "void", contact: null, purchaseOrder: null }, false, null, false]);
    const cancelled = renderWithPresentation(createElement(Cancelled), locale);
    assert.ok(cancelled.includes(escape(t("cancelledStatus"))) && cancelled.includes(escape(t("fromSupplier", { name: t("unknown") }))));
    assert.ok(!cancelled.includes(escape(t("createBill"))));
    const Busy = loaded(detailPath, "GoodsReceiptDetailContent", [saved, false, null, true]);
    assert.match(renderWithPresentation(createElement(Busy), locale), /<button(?=[^>]*disabled="")[^>]*>/);
    for (const [state, key] of [[[null, true, null, false], "loading"], [[null, false, null, false], "notFound"], [[null, false, t("detailReadFailed"), false], "detailReadFailed"]] as const) {
      const State = loaded(detailPath, "GoodsReceiptDetailContent", [...state]);
      assert.ok(renderWithPresentation(createElement(State), locale).includes(escape(t(key))));
    }
    const order = { currencyCode: "USD", subtotal: 1250n, taxTotal: 1n, total: 1251n,
      lines: [{ id: "line-b", description: caller, quantity: 125, quantityReceived: 25, quantityBilled: 100, unitPrice: 1000n, amount: 1250n, account: { code: "1000", name: caller } }] };
    const orderHtml = renderWithPresentation(createElement(Details.ProcurementMoneyDetails, { document: order }), locale);
    for (const key of ["unitPrice", "received", "billedReserved"] as const) assert.ok(orderHtml.includes(escape(pd(key))), key);
    for (const [key, amount] of [["subtotal", 1250n], ["tax", 1n], ["total", 1251n]] as const) assert.ok(orderHtml.includes(escape(pd(key, { amount: procurementMoney(amount, "USD", resolvePresentation({ user: { language: locale } })) }))));
    assert.ok(orderHtml.includes("1.25") && orderHtml.includes("0.25") && !orderHtml.includes("<script>"));
  }
});

test("production receipt reads and pagination localize HTTP/JSON/network/amount failures and reject stale work", async () => {
  for (const locale of locales) for (const mode of ["success", "status", "network", "html", "alias", "quantity", "shape", "stale"]) for (const kind of ["list", "more", "detail"]) {
    const t = translator(locale), writes: unknown[] = [], errors: unknown[] = [], busy: boolean[] = [];
    const generation = { current: 1 };
    let controller: AbortController | undefined;
    const row = { ...raw, lines: [{ ...raw.lines[0], unitCostMinor: mode === "alias" ? "09007199254740991" : raw.lines[0].unitCostMinor,
      quantityReceivedExact: mode === "quantity" ? "2.00" : "1.00" }] };
    const params = (page: number) => new URLSearchParams({ status: "void", page: String(page), limit: "50" });
    const scope = { t, orgId: "org-a", id: raw.id, generation, page: 1, loadingMore: false, buildParams: params,
      procurementReceipt, devDelay: async () => {},
      AbortController: function () { controller = new AbortController(); return controller; },
      fetch: async (url: string, init: RequestInit) => {
        assert.equal(url, kind === "detail" ? `/api/v1/goods-receipts/${raw.id}` : `/api/v1/goods-receipts?${params(kind === "more" ? 2 : 1)}`);
        assert.equal((init.headers as Record<string, string>)["x-organization-id"], "org-a");
        assert.equal(init.method, undefined); assert.equal(init.body, undefined);
        if (mode === "stale") { if (kind === "more") generation.current++; else controller!.abort(); }
        if (mode === "network") throw new Error("private server prose");
        if (mode === "html") return new Response("private HTML");
        return Response.json(mode === "shape" ? {} : kind === "detail" ? { goodsReceipt: row } : { data: [row], pagination: { total: 1 } }, { status: mode === "status" ? 403 : 200 });
      },
      setReceipts: (value: unknown) => writes.push(typeof value === "function" ? value([saved]) : value),
      setGr: (value: unknown) => writes.push(value), setReadError: (value: unknown) => errors.push(value),
      setLoading: (value: boolean) => busy.push(value), setLoadingMore: (value: boolean) => busy.push(value),
      setRefetching: noop, setInitialLoad: noop, setPage: noop, setTotalCount: noop, setFetchKey: noop };
    // List cancellation uses both its effect cleanup and AbortSignal.
    const run = callback(kind === "detail" ? detailPath : listPath, kind === "more" ? "loadMore" : "effect", scope);
    const cleanup = run();
    if (mode === "stale" && kind === "list") cleanup();
    await new Promise(resolve => setImmediate(resolve));
    if (mode === "stale") { assert.deepEqual(writes, []); assert.deepEqual(errors, []); }
    else if (mode === "success") {
      assert.deepEqual(writes, [kind === "detail" ? saved : kind === "more" ? [saved, saved] : [saved]]);
      assert.deepEqual(errors, [null]);
    } else {
      assert.deepEqual(writes, [kind === "detail" ? null : []]);
      assert.deepEqual(errors, [t(kind === "detail" ? "detailReadFailed" : "readFailed")]);
    }
    if (kind === "more" && mode !== "stale") assert.deepEqual(busy, [true, false]);
    if (kind === "detail" && mode !== "stale") assert.deepEqual(busy, [false]);
    if (kind !== "more") { cleanup(); assert.equal(controller!.signal.aborted, true); }
  }
});

test("create-bill production action retains POST, organization scope, redirect and translated failure handling", async () => {
  for (const locale of locales) for (const mode of ["success", "status", "network", "html"]) {
    const t = translator(locale), events: unknown[] = [];
    await callback(detailPath, "handleCreateBill", { orgId: "org-a", id: raw.id, t,
      setBilling: (value: boolean) => events.push(value),
      toast: { error: (message: string) => events.push(message), success: (message: string) => events.push(message) },
      router: { push: (url: string) => events.push(url) },
      fetch: async (url: string, init: RequestInit) => {
        assert.equal(url, `/api/v1/goods-receipts/${raw.id}/create-bill`);
        assert.deepEqual(init, { method: "POST", headers: { "x-organization-id": "org-a" } });
        if (mode === "network") throw new Error("private server prose");
        if (mode === "html") return new Response("private HTML");
        return Response.json(mode === "success" ? { bill: { id: "bill-a" } } : { error: "private server prose" }, { status: mode === "status" ? 409 : 200 });
      } })();
    assert.deepEqual(events, mode === "success" ? [true, t("billCreated"), "/purchases/bill-a", false] : [true, t("createBillFailed"), false]);
  }
  for (const [path, name] of [[listPath, "effect"], [listPath, "loadMore"], [detailPath, "effect"], [detailPath, "handleCreateBill"]]) {
    await callback(path, name, { orgId: null, fetch: () => assert.fail("No organization must not fetch") })();
  }
});

test("status labels and list filters preserve canonical codes, exact amounts and future values", () => {
  for (const locale of locales) {
    const t = translator(locale);
    for (const [code, key] of [["draft", "draft"], ["received", "receivedStatus"], ["billed", "billedStatus"], ["void", "cancelledStatus"]] as const) assert.equal(goodsReceiptStatusLabel(t, code), t(key));
    for (const code of ["future_code", "__proto__", "constructor"]) assert.equal(goodsReceiptStatusLabel(t, code), code);
    const params = callback(listPath, "buildParams", { statusFilter: "void", PAGE_SIZE: 50 })(2);
    assert.equal(params.toString(), "status=void&page=2&limit=50");
    const rows = [saved, { ...saved, id: "b", receiptNumber: "GRN-B", date: "2026-10-19", total: 1n }];
    const scope = { receipts: rows, procurementFilter, debouncedSearch: "", dateFrom: "", dateTo: "", sortBy: "total", sortOrder: "asc" };
    assert.deepEqual(callback(listPath, "filteredReceipts", scope)().map((row: typeof saved) => row.id), ["b", saved.id]);
    assert.deepEqual(callback(listPath, "filteredReceipts", { ...scope, debouncedSearch: "grn-b", dateFrom: "2026-10-19", dateTo: "2026-10-19" })().map((row: typeof saved) => row.id), ["b"]);
  }
});

test("owned source has no unextracted display literals beyond documented examples and punctuation", () => {
  const allowed = new Set(["PO-0042", "GRN-0001", "$1,200.00", "+$1,200.00", "·"]);
  for (const path of [listPath, detailPath, "components/dashboard/procurement-money-details.tsx"]) {
    const ast = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(node: ts.Node) {
      if (ts.isJsxText(node) && node.text.trim()) assert.ok(allowed.has(node.text.trim()), `${path}: ${node.text.trim()}`);
      if (ts.isJsxAttribute(node) && ["title", "placeholder", "emptyMessage", "aria-label", "alt"].includes(node.name.getText(ast))) assert.ok(!node.initializer || !ts.isStringLiteral(node.initializer), node.getText(ast));
      ts.forEachChild(node, visit);
    }
    visit(ast);
  }
  for (const namespace of [fa.GoodsReceipts, fa.ProcurementDetails]) for (const value of Object.values(namespace)) assert.match(value, /[\u0600-\u06ff]/);
});
