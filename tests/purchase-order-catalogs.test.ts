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
import * as DataTable from "../components/dashboard/data-table";
import * as DatePicker from "../components/ui/date-picker";
import { ProcurementMoneyDetails } from "../components/dashboard/procurement-money-details";
import { purchaseOrderStatusLabel } from "../i18n/purchase-order-presentation";
import * as money from "../lib/money/procurement-ui";
import { renderWithPresentation } from "./helpers/presentation";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const list = "app/(dashboard)/purchases/orders/page.tsx";
const detail = "app/(dashboard)/purchases/orders/[id]/page.tsx";
const drawer = "components/dashboard/create-drawer.tsx";
const locales = ["en-US", "fa-IR"] as const;
const noop = () => {};
const caller = "<script>supplier & notes</script>";
const raw = {
  id: "po-a", poNumber: "PO-0042", contactId: "supplier-a", issueDate: "2026-10-19", deliveryDate: "2026-10-25", status: "draft",
  currencyCode: "USD", contact: { name: caller, email: "supplier@example.com" }, reference: caller, notes: caller,
  subtotal: 9007199254740991, subtotalMinor: "9007199254740991", taxTotal: 0, taxTotalMinor: "0", total: 9007199254740991, totalMinor: "9007199254740991",
  lines: [{ id: "line-a", description: caller, quantity: 125, quantityReceived: 25, quantityBilled: 0, unitPrice: 9007199254740991, unitPriceMinor: "9007199254740991", amount: 9007199254740991, amountMinor: "9007199254740991", taxAmount: 0, taxAmountMinor: "0", account: { id: "11111111-1111-4111-8111-111111111111", code: "5000", name: caller }, taxRate: null }],
};
const editLines = [{ description: caller, quantity: "1.25", unitPrice: "12.500", accountId: "11111111-1111-4111-8111-111111111111", taxRateId: "" }];
const saved = money.procurementDocument(raw);
function translator(locale: typeof locales[number]) { return createTranslator({ locale, messages: locale === "en-US" ? en : fa, namespace: "PurchaseOrders" }); }
function escape(value: string) { return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;"); }
function parse(path: string) { return ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX); }

// Run production functions with controlled state/navigation/portal boundaries.
// Fields, table, editor, saved money details and next-intl render normally.
function loaded(path: string, states: Record<string, unknown> = {}, name = path === list ? "PurchaseOrdersContent" : path === detail ? "PODetailContent" : "PurchaseOrderDrawer") {
  const ast = parse(path);
  const component = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name)!;
  const names: string[] = [];
  function hooks(n: ts.Node) {
    if (ts.isVariableDeclaration(n) && ts.isArrayBindingPattern(n.name) && n.initializer && ts.isCallExpression(n.initializer) && n.initializer.expression.getText(ast) === "useState") names.push(n.name.elements[0].getText(ast));
    ts.forEachChild(n, hooks);
  }
  hooks(component);
  let source = ast.text;
  if (path === drawer) {
    const functions = ast.statements.filter(n => ts.isFunctionDeclaration(n) && n.name && [name, "DrawerFooter", "DrawerIcon", "SectionLabel"].includes(n.name.text));
    const used = new Set<string>();
    function identifiers(n: ts.Node) { if (ts.isIdentifier(n)) used.add(n.text); ts.forEachChild(n, identifiers); }
    functions.forEach(identifiers);
    source = ast.statements.flatMap(n => {
      if (functions.includes(n)) return [n.getText(ast)];
      if (ts.isImportDeclaration(n) && n.importClause?.namedBindings && ts.isNamedImports(n.importClause.namedBindings)) {
        const bindings = n.importClause.namedBindings.elements.filter(b => used.has(b.name.text));
        if (bindings.length) return [`import { ${bindings.map(b => b.getText(ast)).join(", ")} } from ${n.moduleSpecifier.getText(ast)};`];
      }
      return [];
    }).join("\n") + `\nexport { ${name} };`;
  }
  source = source.replaceAll('typeof window !== "undefined" ? localStorage.getItem("activeOrgId") : null', '"org-a"');
  if (path !== drawer) source += `\nexport { ${name} };`;
  let index = 0;
  const require = createRequire(resolve(path));
  const compiled = { exports: {} as Record<string, ComponentType<Record<string, unknown>>> };
  const inline = ({ children }: { children: ReactNode }) => createElement("div", null, children);
  const load = (id: string) => {
    if (id === "react") return { ...React, useState: (initial: unknown) => { const key = names[index++]; return [Object.hasOwn(states, key) ? states[key] : typeof initial === "function" ? initial() : initial, noop]; }, useEffect: noop, useRef: (value: unknown) => ({ current: value }), useMemo: (fn: () => unknown) => fn(), useCallback: (fn: unknown) => fn };
    if (id === "next-intl") return nextIntl;
    if (id === "next/navigation") return { useParams: () => ({ id: raw.id }), useRouter: () => ({ push: noop }) };
    if (id.endsWith("/create-drawer")) return { useCreateDrawer: () => ({ open: noop }) };
    if (id.endsWith("/use-confirm")) return { useConfirm: () => ({ confirm: noop, dialog: null }) };
    if (id.endsWith("/account-picker")) return { AccountPicker: () => null };
    if (id.endsWith("/email-history")) return { EmailHistory: () => null };
    if (id.endsWith("/send-document-dialog")) return { SendDocumentDialog: () => null };
    if (id.endsWith("/use-debounce")) return { useDebounce: (value: string) => value };
    if (id.endsWith("/use-entity-title")) return { useEntityTitle: noop };
    if (id.endsWith("/use-document-title")) return { useDocumentTitle: noop };
    if (id.endsWith("/data-table")) return DataTable;
    if (id.endsWith("/line-items-editor")) return { LineItemsEditor: () => createElement("div", { "data-shared-form": "lines" }) };
    if (id.endsWith("/procurement-money-details")) return { ProcurementMoneyDetails };
    if (id.endsWith("/ui/date-picker")) return DatePicker;
    if (id.endsWith("/contact-picker")) return { ContactPicker: () => createElement("div", { "data-shared-form": "contact" }) };
    if (id.endsWith("/currency-select")) return { CurrencySelect: () => createElement("div", { "data-shared-form": "currency" }) };
    if (id.endsWith("/ui/sheet")) return Object.fromEntries(["Sheet", "SheetContent", "SheetHeader", "SheetTitle", "SheetDescription"].map(key => [key, inline]));
    if (id.endsWith("/ui/select")) return { Select: inline, SelectTrigger: inline, SelectContent: inline, SelectValue: ({ placeholder }: { placeholder?: string }) => createElement("span", null, placeholder), SelectItem: ({ children, value }: { children: ReactNode; value: string }) => createElement("div", { "data-option": value }, children) };
    return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  };
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function("require", "module", "exports", code)(load, compiled, compiled.exports);
  return compiled.exports[name];
}

function callback(path: string, name: string, scope: Record<string, unknown>, effectIndex = 0) {
  const ast = parse(path); let expression = "", index = 0;
  function visit(n: ts.Node) {
    if (path === drawer && ts.isFunctionDeclaration(n) && n.parent === ast && n.name?.text !== "PurchaseOrderDrawer") return;
    if (ts.isFunctionDeclaration(n) && n.name?.text === name) expression = n.getText(ast);
    if (ts.isVariableDeclaration(n) && n.name.getText(ast) === name && n.initializer && ts.isCallExpression(n.initializer)) expression = n.initializer.arguments[0].getText(ast);
    if (name === "effect" && ts.isCallExpression(n) && n.expression.getText(ast) === "useEffect" && index++ === effectIndex) expression = n.arguments[0].getText(ast);
    ts.forEachChild(n, visit);
  }
  visit(ast); assert.ok(expression, name);
  const code = ts.transpileModule(`const run = ${expression};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(scope), `${code}; return run;`)(...Object.values(scope));
}
const flush = async () => { for (let i = 0; i < 6; i++) await new Promise(resolve => setImmediate(resolve)); };

test("purchase order list renders bilingual empty/list/filter/error states with exact amounts and machine values", () => {
  for (const locale of locales) {
    const t = translator(locale), Empty = loaded(list, { loading: false });
    const empty = renderWithPresentation(createElement(Empty), locale);
    for (const key of ["emptyTitle", "emptyDescription", "newPurchaseOrder", "pipelineCreate", "pipelineCreateDescription", "pipelineSend", "pipelineSendDescription", "pipelineReceive", "pipelineReceiveDescription"] as const) assert.ok(empty.includes(escape(t(key))), key);
    const Page = loaded(list, { loading: false, pos: [saved], totalCount: 1, countsError: true, readError: "readFailed", dateFrom: "2026-01-01" });
    const html = renderWithPresentation(createElement(Page), locale);
    for (const key of ["title", "description", "number", "supplier", "date", "delivery", "status", "total", "draft", "loadedValue", "loadedActive", "loadedReceived", "orders", "loadedScope", "search", "from", "to", "endDate", "sortBy", "newest", "oldest", "highest", "lowest", "numberAsc", "numberDesc", "clearDates", "countsFailed", "readFailed"] as const) assert.ok(html.includes(escape(t(key))), key);
    assert.ok(html.includes(escape(t("allCount", { count: 1 }))));
    for (const value of ["created:desc", "created:asc", "total:desc", "total:asc", "number:asc", "number:desc"]) assert.ok(html.includes(`data-option="${value}"`));
    assert.ok(html.includes(displayNumberFixture("90,071,992,547,409.91", locale)) && html.includes(escape(caller)) && !html.includes("<script>"));
    const Filtered = loaded(list, { loading: false, pos: [saved], totalCount: 1, search: "missing" });
    assert.ok(renderWithPresentation(createElement(Filtered), locale).includes(escape(t("noMatches"))));
    const Failed = loaded(list, { loading: false, readError: "private error" });
    const failed = renderWithPresentation(createElement(Failed), locale); assert.ok(failed.includes(escape(t("readFailed"))) && !failed.includes("private error"));
  }
});

test("purchase order detail and edit/create drawers render bilingual lifecycle and safe previews", () => {
  for (const locale of locales) {
    const t = translator(locale);
    for (const status of ["draft", "sent", "partial", "received", "closed", "void", "__proto__"]) {
      const Page = loaded(detail, { loading: false, po: { ...saved, status } });
      const html = renderWithPresentation(createElement(Page), locale);
      assert.ok(html.includes(escape(purchaseOrderStatusLabel(t, status))));
      for (const key of ["notes", "total", "items", "supplier"] as const) assert.ok(html.includes(escape(t(key))), key);
      if (status === "draft") for (const key of ["edit", "send", "delete"] as const) assert.ok(html.includes(escape(t(key))), key);
      if (["sent", "partial"].includes(status)) assert.ok(html.includes(escape(t("receive"))));
      if (["sent", "partial", "received"].includes(status)) assert.ok(html.includes(escape(t("convert"))));
      assert.ok(html.includes(displayNumberFixture("90,071,992,547,409.91", locale)) && html.includes("1.25") && html.includes(escape(caller)) && !html.includes("<script>"));
    }
    const Edit = loaded(detail, { contactId: raw.contactId, lines: editLines }, "EditPODrawer");
    const edit = renderWithPresentation(createElement(Edit, { open: true, onClose: noop, onSaved: noop, po: saved }), locale);
    for (const key of ["editTitle", "editDescription", "orderDetails", "requiredSupplier", "issueDate", "deliveryDate", "lineItems", "addLine", "editPolicy", "saveChanges", "cancel", "notes"] as const) assert.ok(edit.includes(escape(t(key))), key);
    for (const key of ["lineDescription", "lineQuantity", "linePrice"] as const) assert.ok(edit.includes(`aria-label="${escape(t(key, { line: 1 }))}"`));
    assert.ok(edit.includes(escape(t("previewTotal", { amount: money.procurementMoney(1563n, "USD", resolvePresentation({ user: { language: locale } })) }))));
    const Invalid = loaded(detail, { lines: [{ ...editLines[0], unitPrice: "private-invalid" }] }, "EditPODrawer");
    const invalid = renderWithPresentation(createElement(Invalid, { open: true, onClose: noop, onSaved: noop, po: saved }), locale);
    assert.ok(invalid.includes(escape(t("checkLines"))) && !invalid.includes("Invalid saved"));
    const Create = loaded(drawer, { saving: true });
    const create = renderWithPresentation(createElement(Create, { open: true, onClose: noop }), locale);
    for (const key of ["newPurchaseOrder", "createDescription", "currency", "reference", "referencePlaceholder", "internalNotes", "cancel", "saving"] as const) assert.ok(create.includes(escape(t(key))), key);
    const Missing = loaded(detail, { loading: false }); assert.ok(renderWithPresentation(createElement(Missing), locale).includes(escape(t("notFound"))));
  }
});

test("create and edit submit preserve exact payloads and fields on HTTP/network/JSON/shape/parser failures", async () => {
  for (const locale of locales) for (const operation of ["create", "edit"]) for (const mode of ["success", "denied", "network", "json", "shape", "emptyId", "parser", "invalid", "supplier", "busy"]) {
    const t = translator(locale), errors: string[] = [], successes: string[] = [], routes: string[] = [], busy: boolean[] = [];
    let requests = 0, closes = 0, reloads = 0;
    const lines = [{ ...editLines[0], unitPrice: mode === "parser" ? "bad" : "12.500" }];
    await callback(operation === "create" ? drawer : detail, "handleSubmit", { ...money, t, orgId: "org-a", saving: mode === "busy", validLines: mode !== "invalid", preview: { error: mode === "invalid" ? "secret" : null }, contactId: mode === "supplier" ? "" : raw.contactId, lines, po: saved, issueDate: raw.issueDate, deliveryDate: "", reference: caller, notes: "", currencyCode: "KWD", localStorage: { getItem: () => "org-a" }, setSaving: (v: boolean) => busy.push(v), onClose: () => closes++, onSaved: () => reloads++, router: { push: (v: string) => routes.push(v) }, toast: { error: (v: string) => errors.push(v), success: (v: string) => successes.push(v) }, fetch: async (url: string, init: RequestInit) => {
      requests++; assert.equal(url, `/api/v1/purchase-orders${operation === "edit" ? `/${raw.id}` : ""}`); assert.equal(init.method, operation === "edit" ? "PATCH" : "POST"); assert.equal((init.headers as Record<string, string>)["x-organization-id"], "org-a");
      assert.deepEqual(JSON.parse(String(init.body)), { contactId: raw.contactId, issueDate: raw.issueDate, ...(operation === "create" ? { currencyCode: "KWD", reference: caller } : {}), deliveryDate: null, notes: null, lines: money.procurementEditorLines(lines, operation === "create" ? "purchaseOrder" : "purchaseOrderUpdate") });
      if (mode === "network") throw new Error("secret"); if (mode === "json") return new Response("private HTML");
      return Response.json(mode === "shape" ? null : { purchaseOrder: { id: mode === "emptyId" ? " " : raw.id }, error: "private server prose" }, { status: mode === "denied" ? 403 : 201 });
    } })({ preventDefault: noop });
    const ok = mode === "success", early = ["invalid", "supplier", "busy"].includes(mode);
    assert.deepEqual(errors, ok || mode === "busy" ? [] : [t(mode === "supplier" ? operation === "create" ? "selectSupplier" : "supplierRequired" : mode === "invalid" ? operation === "create" ? "checkAmounts" : "checkLines" : operation === "create" ? "createFailed" : "updateFailed")]);
    assert.deepEqual(successes, ok ? [t(operation === "create" ? "created" : "updated")] : []); assert.equal(closes, ok ? 1 : 0); assert.equal(reloads, ok && operation === "edit" ? 1 : 0);
    assert.deepEqual(routes, ok && operation === "create" ? [`/purchases/orders/${raw.id}`] : []); assert.equal(requests, early || mode === "parser" ? 0 : 1); assert.deepEqual(busy, early ? [] : [true, false]);
  }
});

test("receiving, conversion and delete use canonical requests, localize failures and restore busy state", async () => {
  for (const locale of locales) for (const action of ["ReceiveItems", "Convert", "Delete"] as const) for (const mode of ["success", "denied", "network", "json", "shape", "emptyId", "cancelled", "confirmError", "busy", "allReceived"]) {
    const t = translator(locale), errors: string[] = [], successes: string[] = [], infos: string[] = [], routes: string[] = [], busy: boolean[] = [];
    let requests = 0, reloads = 0;
    await callback(detail, `handle${action}`, { ...money, t, orgId: "org-a", id: raw.id, po: { ...saved, lines: mode === "allReceived" ? saved.lines.map(l => ({ ...l, quantityReceived: l.quantity })) : saved.lines }, acting: mode === "busy", setActing: (v: boolean) => busy.push(v), loadPO: () => reloads++, router: { push: (v: string) => routes.push(v) }, confirm: async (opts: { title: string; confirmLabel: string }) => { assert.equal(opts.title, t(action === "Delete" ? "deleteTitle" : "receiveTitle")); if (mode === "confirmError") throw new Error("private dialog error"); return mode !== "cancelled"; }, toast: { error: (v: string) => errors.push(v), success: (v: string) => successes.push(v), info: (v: string) => infos.push(v) }, fetch: async (url: string, init: RequestInit) => {
      requests++; assert.equal(url, action === "ReceiveItems" ? "/api/v1/goods-receipts" : `/api/v1/purchase-orders/${raw.id}${action === "Convert" ? "/convert" : ""}`); assert.equal(init.method, action === "Delete" ? "DELETE" : "POST"); assert.equal((init.headers as Record<string, string>)["x-organization-id"], "org-a");
      if (action === "ReceiveItems") { const body = JSON.parse(String(init.body)); assert.equal(body.purchaseOrderId, raw.id); assert.match(body.date, /^\d{4}-\d{2}-\d{2}$/); assert.deepEqual(body.lines, [{ purchaseOrderLineId: "line-a", quantityExact: "1" }]); } else assert.equal(init.body, undefined);
      if (mode === "network") throw new Error("secret"); if (mode === "json") return new Response("private HTML");
      return Response.json(mode === "shape" ? null : { bill: { id: mode === "emptyId" ? " " : "bill-a" }, goodsReceipt: { id: mode === "emptyId" ? " " : "gr-a" }, success: mode !== "emptyId", error: "private server prose" }, { status: mode === "denied" ? 403 : 200 });
    } })();
    const noRequest = mode === "busy" || (action !== "Convert" && ["cancelled", "confirmError"].includes(mode)) || (action === "ReceiveItems" && mode === "allReceived");
    const ok = !noRequest && !["denied", "network", "json", "shape", "emptyId"].includes(mode);
    const failed = !ok && (!noRequest || mode === "confirmError");
    assert.equal(requests, noRequest ? 0 : 1); assert.deepEqual(errors, failed ? [t(action === "ReceiveItems" ? "receiveFailed" : action === "Convert" ? "convertFailed" : "deleteFailed")] : []);
    assert.deepEqual(successes, ok ? [t(action === "ReceiveItems" ? "receivedSuccess" : action === "Convert" ? "converted" : "deleted")] : []);
    assert.deepEqual(routes, ok && action !== "ReceiveItems" ? [action === "Convert" ? "/purchases/bill-a" : "/purchases/orders"] : []); assert.equal(reloads, ok && action === "ReceiveItems" ? 1 : 0);
    assert.deepEqual(infos, action === "ReceiveItems" && mode === "allReceived" ? [t("alreadyReceived")] : []); assert.deepEqual(busy, mode === "busy" ? [] : [true, false]);
  }
});

test("order list and detail reads reject HTTP/JSON/shape/exact alias failures and respect cancellation", async () => {
  for (const operation of ["list", "detail"] as const) for (const mode of ["success", "denied", "network", "json", "shape", "alias", "cancelled"]) {
    const values: unknown[] = [], errors: unknown[] = [], busy: unknown[] = [];
    const row = { ...raw, totalMinor: mode === "alias" ? "01" : raw.totalMinor };
    const controller = new AbortController();
    const run = callback(operation === "list" ? list : detail, operation === "list" ? "effect" : "loadPO", { ...money, orgId: "org-a", id: raw.id, loading: true, generation: { current: 0 }, buildParams: () => new URLSearchParams("page=1&limit=50"), setPos: (v: unknown) => values.push(v), setPo: (v: unknown) => values.push(v), setReadError: (v: unknown) => errors.push(v), setLoading: (v: unknown) => busy.push(v), setRefetching: noop, setFetchKey: noop, setPage: noop, setHasMore: noop, setLoadingMore: noop, setTotalCount: noop, fetch: async (url: string, init: RequestInit) => {
      assert.equal((init.headers as Record<string, string>)["x-organization-id"], "org-a"); assert.equal(url, operation === "list" ? "/api/v1/purchase-orders?page=1&limit=50" : `/api/v1/purchase-orders/${raw.id}`);
      if (mode === "network") throw new Error("secret"); if (mode === "json") return new Response("private HTML");
      return Response.json(mode === "shape" ? null : operation === "list" ? { data: [row], pagination: { total: 1, page: 1, totalPages: 1 } } : { purchaseOrder: row }, { status: mode === "denied" ? 403 : 200 });
    } }, 1);
    const cleanup = operation === "list" ? run() : (void run(controller.signal), () => controller.abort());
    if (mode === "cancelled") cleanup(); await flush();
    if (mode === "cancelled") { assert.deepEqual(values, []); assert.deepEqual(errors, []); assert.deepEqual(busy, []); }
    else { assert.deepEqual(values, [mode === "success" ? operation === "list" ? [money.procurementList(raw)] : saved : operation === "list" ? [] : null]); assert.deepEqual(errors, [mode === "success" ? null : operation === "list" ? "readFailed" : "detailReadFailed"]); assert.deepEqual(busy, [false]); }
    cleanup();
  }
});

test("pagination retains loaded orders and query/generation boundaries on failure", async () => {
  const params = callback(list, "buildParams", { statusFilter: "sent", debouncedSearch: caller, sortBy: "total", sortOrder: "asc", dateFrom: "2026-01-01", dateTo: "2026-10-19" });
  assert.deepEqual(Object.fromEntries(params(2)), { status: "sent", search: caller, sortBy: "total", sortOrder: "asc", from: "2026-01-01", to: "2026-10-19", page: "2", limit: "50" });
  for (const mode of ["success", "denied", "network", "json", "shape", "alias", "stale"]) {
    let rows = [money.procurementList(raw)]; const errors: unknown[] = [], pages: unknown[] = [], busy: unknown[] = [], generation = { current: 1 };
    callback(list, "loadMore", { ...money, orgId: "org-a", page: 1, loadingMore: false, hasMore: true, generation, buildParams: params, setLoadingMore: (v: unknown) => busy.push(v), setPos: (fn: (v: typeof rows) => typeof rows) => { rows = fn(rows); }, setReadError: (v: unknown) => errors.push(v), setPage: (v: unknown) => pages.push(v), setTotalCount: noop, setHasMore: noop, fetch: async (url: string, init: RequestInit) => {
      assert.equal(url, `/api/v1/purchase-orders?${params(2)}`); assert.equal((init.headers as Record<string, string>)["x-organization-id"], "org-a"); if (mode === "stale") generation.current++;
      if (mode === "network") throw new Error("secret"); if (mode === "json") return new Response("private HTML");
      return Response.json(mode === "shape" ? {} : { data: [{ ...raw, totalMinor: mode === "alias" ? "001" : raw.totalMinor }], pagination: { page: 2, total: 3, totalPages: 3 } }, { status: mode === "denied" ? 403 : 200 });
    } })(); await flush();
    assert.equal(rows.length, mode === "success" ? 2 : 1); assert.deepEqual(errors, mode === "success" ? [null] : mode === "stale" ? [] : ["readFailed"]); assert.deepEqual(pages, mode === "success" ? [2] : []); assert.deepEqual(busy, mode === "stale" ? [true] : [true, false]);
  }
});

test("edit hydration and line operations retain rounded prices, quantity units and exact caller input", () => {
  const values: unknown[] = [];
  callback(detail, "effect", { ...money, open: true, po: saved, setContactId: noop, setIssueDate: noop, setDeliveryDate: noop, setNotes: noop, setLines: (v: unknown) => values.push(v) })();
  assert.deepEqual(values.pop(), [{ description: caller, quantity: "1.25", unitPrice: "90071992547409.91", accountId: "11111111-1111-4111-8111-111111111111", taxRateId: "" }]);
  let lines = [...editLines, { ...editLines[0], description: "second" }]; const scope = { lines, setLines: (fn: (v: typeof lines) => typeof lines) => { lines = fn(lines); } };
  callback(detail, "updateLine", scope)(0, { unitPrice: "0.000000000000000001" }); assert.equal(lines[0].unitPrice, "0.000000000000000001");
  callback(detail, "removeLine", scope)(1); assert.equal(lines.length, 1);
  callback(detail, "addLine", scope)(); assert.equal(lines.length, 2); assert.equal(lines[1].quantity, "1");
});

test("order overview checks HTTP/JSON/exact counts and creation reset retains USD and field defaults", async () => {
  for (const mode of ["success", "denied", "json", "shape", "alias", "cancelled"]) {
    const values: unknown[] = [], errors: unknown[] = [];
    const cleanup = callback(list, "effect", { billUiCounts: (await import("../lib/money/bill-ui")).billUiCounts, orgId: "org-a", setCountsData: (v: unknown) => values.push(v), setCountsError: (v: unknown) => errors.push(v), fetch: async (url: string, init: RequestInit) => {
      assert.equal(url, "/api/v1/purchase-orders/counts"); assert.equal((init.headers as Record<string, string>)["x-organization-id"], "org-a");
      if (mode === "json") return new Response("secret HTML");
      return Response.json(mode === "shape" ? null : { counts: { sent: { count: 1, amount: 1250, amountMinor: mode === "alias" ? "01250" : "1250", currencyCode: "USD" } }, total: 1 }, { status: mode === "denied" ? 403 : 200 });
    } })();
    if (mode === "cancelled") cleanup(); await flush();
    assert.equal(values.length, mode === "success" ? 1 : 0); assert.deepEqual(errors, ["success", "cancelled"].includes(mode) ? [] : [true]); cleanup();
  }
  for (const open of [false, true]) {
    const values: Record<string, unknown> = {};
    const setters = Object.fromEntries(["CurrencyCode", "ValidLines", "ContactId", "Reference", "Notes", "DeliveryDate", "IssueDate", "Lines"].map(name => [`set${name}`, (v: unknown) => { values[name] = v; }]));
    callback(drawer, "effect", { open, ...setters })();
    if (open) assert.deepEqual(values, {});
    else { assert.equal(values.CurrencyCode, "USD"); assert.equal(values.ValidLines, false); for (const key of ["ContactId", "Reference", "Notes", "DeliveryDate"]) assert.equal(values[key], ""); assert.match(String(values.IssueDate), /^\d{4}-\d{2}-\d{2}$/); assert.deepEqual(values.Lines, [{ description: "", quantity: "1", unitPrice: "", accountId: "", taxRateId: "" }]); }
  }
});

test("owned order templates contain only catalog-authored copy and paired Persian messages", () => {
  assert.deepEqual(Object.keys(en.PurchaseOrders), Object.keys(fa.PurchaseOrders));
  for (const text of Object.values(fa.PurchaseOrders)) assert.match(text, /[\u0600-\u06ff]/);
  for (const locale of locales) {
    const t = translator(locale);
    for (const status of ["draft", "sent", "partial", "received", "closed", "void"] as const) assert.equal(purchaseOrderStatusLabel(t, status), t(status));
    for (const unknown of ["toString", "__proto__", "constructor", caller]) assert.equal(purchaseOrderStatusLabel(t, unknown), unknown);
  }
  for (const path of [list, detail, drawer]) {
    const ast = parse(path), problems: string[] = [];
    function visit(n: ts.Node) {
      if (path === drawer && ts.isFunctionDeclaration(n) && n.parent === ast && n.name?.text !== "PurchaseOrderDrawer") return;
      if (ts.isJsxText(n) && /[a-z]/i.test(n.text.trim())) problems.push(n.text.trim());
      if (ts.isJsxAttribute(n) && ["title", "placeholder", "label", "description", "emptyMessage", "aria-label"].includes(n.name.getText(ast)) && n.initializer && ts.isStringLiteral(n.initializer) && /[a-z]/i.test(n.initializer.text)) problems.push(n.getText(ast));
      ts.forEachChild(n, visit);
    }
    visit(ast); assert.deepEqual(problems, [], path);
  }
});
