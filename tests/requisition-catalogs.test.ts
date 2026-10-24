import { currencyFixture, displayNumberFixture } from "./helpers/localized-fixtures";
import { resolvePresentation } from "../i18n/locale";
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
import { RequisitionLineEditor, emptyRequisitionLine } from "../components/dashboard/requisition-line-editor";
import { ProcurementMoneyDetails } from "../components/dashboard/procurement-money-details";
import { requisitionStatusLabel } from "../i18n/requisition-presentation";
import * as money from "../lib/money/procurement-ui";
import { renderWithPresentation } from "./helpers/presentation";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const list = "app/(dashboard)/purchases/requisitions/page.tsx";
const detail = "app/(dashboard)/purchases/requisitions/[id]/page.tsx";
const editor = "components/dashboard/requisition-line-editor.tsx";
const locales = ["en-US", "fa-IR"] as const;
const noop = () => {};
const caller = "<script>supplier & notes</script>";
const raw = {
  id: "req-a", requisitionNumber: "REQ-0042", requestDate: "2026-10-19", requiredDate: "2026-10-25", status: "draft",
  currencyCode: "USD", contact: { name: caller }, reference: caller, notes: caller, rejectionReason: caller, convertedPoId: "po-a",
  subtotal: 9007199254740991, subtotalMinor: "9007199254740991", taxTotal: 0, taxTotalMinor: "0", total: 9007199254740991, totalMinor: "9007199254740991",
  lines: [{ id: "line-a", description: caller, quantity: 125, unitPrice: 9007199254740991, unitPriceMinor: "9007199254740991", amount: 9007199254740991, amountMinor: "9007199254740991", taxAmount: 0, taxAmountMinor: "0", account: { code: "5000", name: caller } }],
};
const saved = money.procurementDocument(raw);
function translator(locale: typeof locales[number]) { return createTranslator({ locale, messages: locale === "en-US" ? en : fa, namespace: "Requisitions" }); }
function escape(value: string) { return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;"); }
function parse(path: string) { return ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX); }

// Run production functions with controlled state/navigation/portal boundaries.
// Fields, table, editor, saved money details and next-intl render normally.
function loaded(path: string, states: Record<string, unknown> = {}) {
  const ast = parse(path), name = path === list ? "RequisitionsContent" : "RequisitionDetailContent";
  const component = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name)!;
  const names: string[] = [];
  function hooks(n: ts.Node) {
    if (ts.isVariableDeclaration(n) && ts.isArrayBindingPattern(n.name) && n.initializer && ts.isCallExpression(n.initializer) && n.initializer.expression.getText(ast) === "useState") names.push(n.name.elements[0].getText(ast));
    ts.forEachChild(n, hooks);
  }
  hooks(component);
  const source = ast.text.replace(/typeof window !== "undefined"\s*\? localStorage.getItem\("activeOrgId"\)\s*: null/g, '"org-a"') + `\nexport { ${name} };`;
  let index = 0;
  const require = createRequire(resolve(path));
  const compiled = { exports: {} as Record<string, ComponentType<Record<string, unknown>>> };
  const inline = ({ children }: { children: ReactNode }) => createElement("div", null, children);
  const load = (id: string) => {
    if (id === "react") return { ...React, useState: (initial: unknown) => { const key = names[index++]; return [Object.hasOwn(states, key) ? states[key] : typeof initial === "function" ? initial() : initial, noop]; }, useEffect: noop, useRef: (value: unknown) => ({ current: value }), useMemo: (fn: () => unknown) => fn(), useCallback: (fn: unknown) => fn };
    if (id === "next-intl") return nextIntl;
    if (id === "next/navigation") return { useParams: () => ({ id: raw.id }), useRouter: () => ({ push: noop }) };
    if (id.endsWith("/use-debounce")) return { useDebounce: (value: string) => value };
    if (id.endsWith("/use-entity-title")) return { useEntityTitle: noop };
    if (id.endsWith("/use-document-title")) return { useDocumentTitle: noop };
    if (id.endsWith("/data-table")) return DataTable;
    if (id.endsWith("/requisition-line-editor")) return { RequisitionLineEditor, emptyRequisitionLine };
    if (id.endsWith("/procurement-money-details")) return { ProcurementMoneyDetails };
    if (id.endsWith("/ui/date-picker")) return DatePicker;
    if (id.endsWith("/contact-picker")) return { ContactPicker: () => createElement("div", { "data-shared-form": "contact" }) };
    if (id.endsWith("/currency-select")) return { CurrencySelect: () => createElement("div", { "data-shared-form": "currency" }) };
    if (id.endsWith("/ui/sheet")) return Object.fromEntries(["Sheet", "SheetContent", "SheetHeader", "SheetTitle"].map(key => [key, inline]));
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

test("requisition list renders bilingual pipeline, filters, creation fields, status and exact totals", () => {
  for (const locale of locales) {
    const t = translator(locale), Empty = loaded(list, { loading: false });
    const empty = renderWithPresentation(createElement(Empty), locale);
    for (const key of ["emptyTitle", "emptyDescription", "newRequisition", "pipelineDraft", "pipelineSubmitted", "pipelineApproved", "pipelineRejected", "pipelineConverted", "newPurchaseRequisition", "requestDate", "requiredBy", "reference", "referencePlaceholder", "notes", "notesPlaceholder", "optionalSupplier", "currency", "createRequisition", "lineItems", "noTax"] as const) assert.ok(empty.includes(escape(t(key))), key);
    const Page = loaded(list, { loading: false, items: [saved], totalCount: 1, dateFrom: "2026-01-01" });
    const html = renderWithPresentation(createElement(Page), locale);
    for (const key of ["title", "description", "number", "supplier", "status", "total", "draft", "submitted", "approved", "rejected", "converted", "loadedScope", "search", "from", "to", "endDate", "sortBy", "newest", "oldest", "highest", "lowest", "numberAsc", "numberDesc", "clearDates"] as const) assert.ok(html.includes(escape(t(key))), key);
    const Unfiltered = loaded(list, { loading: false, items: [saved], totalCount: 1 });
    assert.ok(renderWithPresentation(createElement(Unfiltered), locale).includes(escape(t("startDate"))));
    assert.ok(html.includes(escape(t("allCount", { count: 1 }))));
    for (const value of ["created:desc", "created:asc", "total:desc", "total:asc", "number:desc", "number:asc"]) assert.ok(html.includes(`data-option="${value}"`));
    assert.ok(html.includes(displayNumberFixture("90,071,992,547,409.91", locale)) && html.includes(escape(caller)) && !html.includes("<script>"));
    const Failed = loaded(list, { loading: false, readError: "readFailed" });
    assert.ok(renderWithPresentation(createElement(Failed), locale).includes(escape(t("readFailed"))));
    const PageFailure = loaded(list, { loading: false, items: [saved], totalCount: 1, readError: "readFailed" });
    const pageFailure = renderWithPresentation(createElement(PageFailure), locale);
    assert.ok(pageFailure.includes(escape(t("readFailed"))) && pageFailure.includes(raw.requisitionNumber));
    const Filtered = loaded(list, { loading: false, items: [saved], totalCount: 1, search: "missing" });
    assert.ok(renderWithPresentation(createElement(Filtered), locale).includes(escape(t("noMatches"))));
  }
});

test("requisition detail renders each lifecycle, rejection form, dates and shared money details", () => {
  for (const locale of locales) {
    const t = translator(locale);
    for (const status of ["draft", "submitted", "approved", "rejected", "converted"] as const) {
      const Page = loaded(detail, { loading: false, req: { ...saved, status } });
      const html = renderWithPresentation(createElement(Page), locale);
      for (const key of [status, "back", "reference", "notes", "rejectRequisition", "optionalReason", "reasonPlaceholder"] as const) assert.ok(html.includes(escape(t(key))), key);
      const visible = { draft: ["submit"], submitted: ["approve", "reject"], approved: ["createOrder"], rejected: ["rejectionReason"], converted: ["convertedNotice", "viewOrder"] } as const;
      for (const key of visible[status]) assert.ok(html.includes(escape(t(key))), key);
      assert.ok(html.includes(escape(t("supplierName", { name: caller }))));
      assert.ok(html.includes(escape(t("requested", { date: raw.requestDate }))) && html.includes(escape(t("requiredDate", { date: raw.requiredDate }))));
      assert.ok(html.includes(displayNumberFixture("90,071,992,547,409.91", locale)) && html.includes("1.25") && html.includes(escape(caller)) && !html.includes("<script>"));
      if (status === "converted") assert.ok(html.includes('href="/purchases/orders/po-a"'));
    }
    for (const [states, key] of [[{ loading: true }, "loading"], [{ loading: false }, "notFound"], [{ readError: "detailReadFailed" }, "detailReadFailed"]] as const) {
      const Page = loaded(detail, states); assert.ok(renderWithPresentation(createElement(Page), locale).includes(escape(t(key))));
    }
    const Unassigned = loaded(detail, { loading: false, req: { ...saved, contact: null, requiredDate: null } });
    assert.ok(renderWithPresentation(createElement(Unassigned), locale).includes(escape(t("supplierName", { name: t("notAssigned") }))));
  }
});

test("line editor renders translated accessible labels, no-tax preview and safe validation at currency scales", () => {
  for (const locale of locales) for (const [currencyCode, unitPrice, expected] of [["USD", "12.50", 1875n], ["JPY", "1250", 1875n], ["KWD", "1.250", 1875n]] as const) {
    const t = translator(locale), lines = [{ ...emptyRequisitionLine(), description: caller, quantity: "1.5", unitPrice }];
    const html = renderWithPresentation(createElement(RequisitionLineEditor, { lines, onChange: noop, currencyCode }), locale);
    for (const key of ["lineDescription", "lineQuantity", "linePrice"] as const) assert.ok(html.includes(`aria-label="${escape(t(key, { line: 1 }))}"`));
    assert.ok(html.includes(escape(t("unitPrice", { currency: currencyFixture(currencyCode, locale) }))) && html.includes(escape(t("previewTotal", { amount: money.procurementMoney(expected, currencyCode, resolvePresentation({ user: { language: locale } })) }))));
    assert.ok(html.includes(escape(t("noTax"))) && html.includes(escape(caller)));
    const invalid = renderWithPresentation(createElement(RequisitionLineEditor, { lines: [{ ...lines[0], unitPrice: "secret-invalid-price" }], onChange: noop, currencyCode }), locale);
    assert.ok(invalid.includes(escape(t("checkLines"))) && invalid.includes('role="alert"'));
  }
  assert.equal(money.procurementPreview([{ ...emptyRequisitionLine(), description: caller, quantity: "3", unitPrice: "0.005" }], "USD", [], "requisition").total, 2n);
});

test("line editor add, edit and remove callbacks preserve exact caller strings and line identity", () => {
  const lines = [{ ...emptyRequisitionLine(), description: caller }, { ...emptyRequisitionLine(), description: "second" }];
  const edits: unknown[] = [], elements: React.ReactElement<Record<string, unknown>>[] = [];
  function Capture() {
    const tree = RequisitionLineEditor({ lines, currencyCode: "USD", onChange: value => edits.push(value) });
    function walk(node: ReactNode) { React.Children.forEach(node, child => { if (React.isValidElement<Record<string, unknown>>(child)) { elements.push(child); walk(child.props.children as ReactNode); } }); }
    walk(tree); return tree;
  }
  renderWithPresentation(createElement(Capture), "en-US");
  const edit = elements.find(e => e.props["aria-label"] === "Price for line 1")!;
  (edit.props.onChange as (e: unknown) => void)({ target: { value: "0.000000000000000001" } });
  assert.deepEqual(edits.pop(), [{ ...lines[0], unitPrice: "0.000000000000000001" }, lines[1]]);
  const remove = elements.find(e => e.props["aria-label"] === "Remove line 1")!;
  (remove.props.onClick as () => void)(); assert.deepEqual(edits.pop(), [lines[1]]);
  const add = elements.find(e => e.props.variant === "outline")!;
  (add.props.onClick as () => void)(); assert.deepEqual(edits.pop(), [...lines, emptyRequisitionLine()]);
});

test("creation preserves org, nullable supplier/fields, exact lines and failed-form state in both locales", async () => {
  for (const locale of locales) for (const mode of ["success", "supplier", "denied", "network", "json", "shape", "emptyId", "invalid", "parser", "busy"]) {
    const t = translator(locale), errors: string[] = [], successes: string[] = [], routes: string[] = [], busy: boolean[] = [];
    let requests = 0, closes = 0, resets = 0;
    const lines = [{ ...emptyRequisitionLine(), description: caller, quantity: "1.25", unitPrice: mode === "parser" ? "bad" : "12.500" }];
    await callback(list, "handleCreate", { ...money, t, orgId: "org-a", creating: mode === "busy", preview: { error: mode === "invalid" ? "private parser prose" : null }, formLines: lines, formRequestDate: raw.requestDate, formRequiredDate: "", formReference: caller, formNotes: "", currencyCode: "KWD", contactId: mode === "supplier" ? "supplier-a" : "", setCreating: (v: boolean) => busy.push(v), setSheetOpen: () => closes++, resetForm: () => resets++, router: { push: (v: string) => routes.push(v) }, toast: { error: (v: string) => errors.push(v), success: (v: string) => successes.push(v) }, fetch: async (url: string, init: RequestInit) => {
      requests++; assert.equal(url, "/api/v1/purchase-requisitions"); assert.equal(init.method, "POST"); assert.equal((init.headers as Record<string, string>)["x-organization-id"], "org-a");
      assert.deepEqual(JSON.parse(String(init.body)), { requestDate: raw.requestDate, currencyCode: "KWD", contactId: mode === "supplier" ? "supplier-a" : null, requiredDate: null, reference: caller, notes: null, lines: money.procurementEditorLines(lines, "requisition") });
      if (mode === "network") throw new Error("secret"); if (mode === "json") return new Response("private HTML");
      return Response.json(mode === "shape" ? null : { requisition: { id: mode === "emptyId" ? " " : raw.id }, error: "secret server prose" }, { status: mode === "denied" ? 403 : 201 });
    } })();
    const ok = ["success", "supplier"].includes(mode), early = ["invalid", "busy"].includes(mode);
    assert.deepEqual(errors, ok || mode === "busy" ? [] : [t(mode === "invalid" ? "checkLines" : "createFailed")]);
    assert.deepEqual(successes, ok ? [t("created")] : []); assert.deepEqual(routes, ok ? [`/purchases/requisitions/${raw.id}`] : []);
    assert.equal(closes, ok ? 1 : 0); assert.equal(resets, ok ? 1 : 0); assert.equal(requests, early || mode === "parser" ? 0 : 1); assert.deepEqual(busy, early ? [] : [true, false]);
  }
});

test("list/detail reads reject HTTP, JSON, shape and exact alias failures with abort guards", async () => {
  for (const operation of ["list", "detail"] as const) for (const mode of ["success", "denied", "network", "json", "shape", "alias", "cancelled"]) {
    const values: unknown[] = [], errors: unknown[] = [], busy: unknown[] = [];
    const row = { ...raw, totalMinor: mode === "alias" ? "01" : raw.totalMinor };
    const cleanup = callback(operation === "list" ? list : detail, "effect", { ...money, orgId: "org-a", id: raw.id, loading: true, generation: { current: 0 }, buildParams: () => new URLSearchParams("page=1&limit=50"), setItems: (v: unknown) => values.push(v), setReq: (v: unknown) => values.push(v), setReadError: (v: unknown) => errors.push(v), setLoading: (v: unknown) => busy.push(v), setRefetching: noop, setFetchKey: noop, setPage: noop, setHasMore: noop, setLoadingMore: noop, setTotalCount: noop, fetch: async (url: string, init: RequestInit) => {
      assert.equal((init.headers as Record<string, string>)["x-organization-id"], "org-a");
      assert.equal(url, operation === "list" ? "/api/v1/purchase-requisitions?page=1&limit=50" : `/api/v1/purchase-requisitions/${raw.id}`);
      if (mode === "network") throw new Error("secret"); if (mode === "json") return new Response("private HTML");
      return Response.json(mode === "shape" ? null : operation === "list" ? { data: [row], pagination: { total: 1, page: 1, totalPages: 1 } } : row, { status: mode === "denied" ? 403 : 200 });
    } })();
    if (mode === "cancelled") cleanup(); await flush();
    if (mode === "cancelled") { assert.deepEqual(values, []); assert.deepEqual(errors, []); assert.deepEqual(busy, []); }
    else if (operation === "list") { assert.deepEqual(values, [mode === "success" ? [money.procurementList(raw)] : []]); assert.deepEqual(errors, [mode === "success" ? null : "readFailed"]); assert.deepEqual(busy, [false]); }
    else { assert.deepEqual(values, [mode === "success" ? saved : null]); assert.deepEqual(errors, mode === "success" ? [] : ["detailReadFailed"]); assert.deepEqual(busy, [false]); }
    cleanup();
  }
});

test("pagination retains query machine values, prior rows and generation guards", async () => {
  const params = callback(list, "buildParams", { statusFilter: "submitted", debouncedSearch: caller, sortBy: "total", sortOrder: "asc", dateFrom: "2026-01-01", dateTo: "2026-10-19" });
  assert.equal(params(2).get("status"), "submitted"); assert.equal(params(2).get("search"), caller); assert.equal(params(2).get("sortBy"), "total"); assert.equal(params(2).get("sortOrder"), "asc"); assert.equal(params(2).get("from"), "2026-01-01"); assert.equal(params(2).get("to"), "2026-10-19"); assert.equal(params(2).get("page"), "2"); assert.equal(params(2).get("limit"), "50");
  for (const mode of ["success", "denied", "network", "json", "shape", "alias", "stale"]) {
    let items = [money.procurementList(raw)]; const errors: unknown[] = [], pages: unknown[] = [], busy: unknown[] = [], generation = { current: 1 };
    callback(list, "loadMore", { ...money, orgId: "org-a", page: 1, loadingMore: false, hasMore: true, generation, buildParams: params, setLoadingMore: (v: unknown) => busy.push(v), setItems: (fn: (v: typeof items) => typeof items) => { items = fn(items); }, setReadError: (v: unknown) => errors.push(v), setPage: (v: unknown) => pages.push(v), setHasMore: noop, fetch: async (url: string, init: RequestInit) => {
      assert.equal(url, `/api/v1/purchase-requisitions?${params(2)}`); assert.equal((init.headers as Record<string, string>)["x-organization-id"], "org-a");
      if (mode === "stale") generation.current++;
      if (mode === "network") throw new Error("secret"); if (mode === "json") return new Response("private HTML");
      return Response.json(mode === "shape" ? {} : { data: [{ ...raw, totalMinor: mode === "alias" ? "001" : raw.totalMinor }], pagination: { page: 2, totalPages: 3 } }, { status: mode === "denied" ? 403 : 200 });
    } })();
    await flush(); assert.equal(items.length, mode === "success" ? 2 : 1); assert.deepEqual(errors, mode === "success" ? [null] : mode === "stale" ? [] : ["readFailed"]); assert.deepEqual(pages, mode === "success" ? [2] : []); assert.deepEqual(busy, mode === "stale" ? [true] : [true, false]);
  }
});

test("lifecycle callbacks preserve canonical requests and localize failures without resetting rejection data", async () => {
  for (const locale of locales) for (const action of ["Submit", "Approve", "Reject", "Convert"] as const) for (const mode of ["success", "denied", "network", "json", "shape", "busy", "emptyReason"]) {
    const t = translator(locale), errors: string[] = [], successes: string[] = [], routes: string[] = [], busy: boolean[] = [];
    let req = saved, resets = 0, requests = 0;
    const code = action.toLowerCase() as "submit" | "approve" | "reject" | "convert";
    const status = action === "Approve" ? "approved" : action === "Reject" ? "rejected" : "submitted";
    const reason = mode === "emptyReason" ? "" : caller;
    await callback(detail, `handle${action}`, { t, orgId: "org-a", id: raw.id, req, acting: mode === "busy", rejectReason: reason, setActing: (v: boolean) => busy.push(v), setReq: (fn: (v: typeof req) => typeof req) => { req = fn(req); }, setRejectSheetOpen: () => resets++, setRejectReason: () => resets++, router: { push: (v: string) => routes.push(v) }, toast: { error: (v: string) => errors.push(v), success: (v: string) => successes.push(v) }, fetch: async (url: string, init: RequestInit) => {
      requests++; assert.equal(url, `/api/v1/purchase-requisitions/${raw.id}${action === "Submit" ? "" : `/${code}`}`); assert.equal(init.method, action === "Submit" ? "PUT" : "POST"); assert.equal((init.headers as Record<string, string>)["x-organization-id"], "org-a");
      if (action === "Submit") assert.deepEqual(JSON.parse(String(init.body)), { status: "submitted" });
      else if (action === "Reject") assert.deepEqual(JSON.parse(String(init.body)), reason ? { reason } : {});
      else assert.equal(init.body, undefined);
      if (mode === "network") throw new Error("secret"); if (mode === "json") return new Response("private HTML");
      return Response.json(mode === "shape" ? null : { status, purchaseOrder: { id: "po-a" }, error: "secret server prose" }, { status: mode === "denied" ? 403 : 200 });
    } })();
    const ok = mode === "success" || mode === "emptyReason";
    const failureKeys = { Submit: "submitFailed", Approve: "approveFailed", Reject: "rejectFailed", Convert: "convertFailed" } as const;
    const successKeys = { Submit: "submitSuccess", Approve: "approveSuccess", Reject: "rejectSuccess", Convert: "convertSuccess" } as const;
    assert.deepEqual(errors, ok || mode === "busy" ? [] : [t(failureKeys[action])]); assert.deepEqual(successes, ok ? [t(successKeys[action])] : []);
    assert.deepEqual(routes, ok && action === "Convert" ? ["/purchases/orders/po-a"] : []); assert.equal(resets, ok && action === "Reject" ? 2 : 0);
    assert.equal(req.status, ok && action !== "Convert" ? status : saved.status);
    if (ok && action === "Reject") assert.equal(req.rejectionReason, reason || null);
    assert.equal(requests, mode === "busy" ? 0 : 1); assert.deepEqual(busy, mode === "busy" ? [] : [true, false]);
  }
});

test("owned requisition templates have no raw authored JSX/display attributes and paired Persian messages", () => {
  assert.deepEqual(Object.keys(en.Requisitions), Object.keys(fa.Requisitions));
  for (const text of Object.values(fa.Requisitions)) assert.match(text, /[\u0600-\u06ff]/);
  for (const locale of locales) {
    const t = translator(locale);
    for (const status of ["draft", "submitted", "approved", "rejected", "converted"] as const) assert.equal(requisitionStatusLabel(t, status), t(status));
    for (const unknown of ["toString", "__proto__", "constructor", caller]) assert.equal(requisitionStatusLabel(t, unknown), unknown);
  }
  for (const path of [list, detail, editor]) {
    const ast = parse(path), problems: string[] = [];
    function visit(n: ts.Node) {
      if (ts.isJsxText(n) && /[a-z]/i.test(n.text.trim())) problems.push(n.text.trim());
      if (ts.isJsxAttribute(n) && ["title", "placeholder", "label", "description", "emptyMessage", "aria-label"].includes(n.name.getText(ast)) && n.initializer && ts.isStringLiteral(n.initializer) && /[a-z]/i.test(n.initializer.text)) problems.push(n.getText(ast));
      ts.forEachChild(n, visit);
    }
    visit(ast); assert.deepEqual(problems, [], path);
  }
});
