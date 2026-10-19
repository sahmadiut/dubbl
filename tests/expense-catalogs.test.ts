import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import * as React from "react";
import { createElement, isValidElement, type ReactElement, type ReactNode } from "react";
import * as nextIntl from "next-intl";
import { createTranslator } from "next-intl";
import ts from "typescript";
import * as Select from "../components/ui/select";
import { CurrencySelect } from "../components/ui/currency-select";
import { DatePicker } from "../components/ui/date-picker";
import { DataTable } from "../components/dashboard/data-table";
import { ExpenseAmountInput } from "../components/dashboard/expense-amount-input";
import * as presentation from "../i18n/expense-presentation";
import * as money from "../lib/money/expense-ui";
import { expenseSummaryDisplay } from "../lib/money/expense-display";
import { recurringExpensePayload, recurringExpensePreview } from "../lib/money/recurring-expense-ui";
import { renderWithPresentation } from "./helpers/presentation";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const list = "app/(dashboard)/purchases/expenses/page.tsx";
const detail = "app/(dashboard)/purchases/expenses/[id]/page.tsx";
const recurring = "app/(dashboard)/purchases/expenses/recurring/page.tsx";
const create = "components/dashboard/create-drawer.tsx";
const locales = ["en-US", "fa-IR"] as const;
const noop = () => {};
const caller = "<script>هزینه & caller</script>";
const supplier = "00000000-0000-4000-8000-000000000001";
const item = { id: supplier, date: "2026-10-19", description: caller, amount: 1250, amountMinor: "1250", category: caller, accountId: "", receiptFileKey: "", receiptFileName: "", account: null, isMileage: false, distanceMiles: null, mileageRate: null };
const claim = { id: "claim-a", title: caller, description: caller, status: "draft", totalAmount: 1250, totalAmountMinor: "1250", currencyCode: "USD", createdAt: "2026-10-19T08:00:00Z", submittedAt: null, approvedAt: null, paidAt: null, rejectionReason: caller, submittedByUser: { name: caller, email: "caller@example.test" }, approvedByUser: { name: caller, email: "caller@example.test" }, items: [item] };
const editItem = { ...item, amount: "12.50" };
const recurringLine = { description: caller, amount: "0.005", accountId: null };
const header = { name: "Rent", contactId: supplier, frequency: "monthly", startDate: "2026-10-19", endDate: "", maxOccurrences: "", currencyCode: "USD" };
const tFor = (locale: typeof locales[number]) => createTranslator({ locale, messages: locale === "en-US" ? en : fa, namespace: "Expenses" });
const escape = (v: string) => v.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
function parse(path: string) { return ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX); }
function findFunction(ast: ts.SourceFile, name: string) {
  let result: ts.FunctionDeclaration | undefined;
  function visit(n: ts.Node) { if (ts.isFunctionDeclaration(n) && n.name?.text === name) result = n; ts.forEachChild(n, visit); }
  visit(ast); assert.ok(result, name); return result;
}

// Production functions run with controlled hooks/router and portal boundaries.
// Tables, inputs, selectors, next-intl and all money helpers remain real.
function loaded(path: string, name: string, states: Record<string, unknown> = {}, events: unknown[] = [], inspect: (tree: ReactElement) => void = noop, props: object = {}) {
  const ast = parse(path), names: string[] = [];
  function visit(n: ts.Node) {
    if (ts.isVariableDeclaration(n) && ts.isArrayBindingPattern(n.name) && n.initializer && ts.isCallExpression(n.initializer) && n.initializer.expression.getText(ast) === "useState") names.push(n.name.elements[0].getText(ast));
    ts.forEachChild(n, visit);
  }
  visit(findFunction(ast, name));
  const require = createRequire(resolve(path)), compiled = { exports: {} as Record<string, (p: object) => ReactElement> };
  let index = 0;
  const inline = ({ children }: { children: ReactNode }) => createElement("div", null, children);
  const load = (id: string) => {
    if (id === "react") return { ...React, useState: (initial: unknown) => {
      const key = names[index++];
      return [Object.hasOwn(states, key) ? states[key] : typeof initial === "function" ? initial() : initial, (v: unknown) => events.push([key, v])];
    }, useEffect: noop, useCallback: (fn: unknown) => fn, useMemo: (fn: () => unknown) => fn(), useRef: () => ({ current: null }) };
    if (id === "next-intl") return nextIntl;
    if (id === "next/navigation") return { useRouter: () => ({ push: (v: string) => events.push(["push", v]) }) };
    if (id === "motion/react") return { motion: { div: inline }, MotionConfig: inline };
    if (id.endsWith("/use-debounce")) return { useDebounce: (v: unknown) => v };
    if (id.endsWith("/use-document-title")) return { useDocumentTitle: (v: string) => events.push(["documentTitle", v]) };
    if (id.endsWith("/use-entity-title")) return { useEntityTitle: noop };
    if (id.endsWith("/use-confirm")) return { useConfirm: () => ({ confirm: async () => true, dialog: null }) };
    if (id.endsWith("/create-drawer")) return { useCreateDrawer: () => ({ open: (v: string) => events.push(["drawer", v]) }) };
    if (id.endsWith("/ui/sheet")) return Object.fromEntries(["Sheet", "SheetContent", "SheetHeader", "SheetTitle", "SheetDescription"].map(k => [k, inline]));
    if (id.endsWith("/ui/dialog")) return Object.fromEntries(["Dialog", "DialogContent", "DialogHeader", "DialogTitle", "DialogTrigger"].map(k => [k, inline]));
    if (id.endsWith("/ui/select")) return Select;
    if (id.endsWith("/currency-select")) return { CurrencySelect };
    if (id.endsWith("/date-picker")) return { DatePicker };
    if (id.endsWith("/data-table")) return { DataTable };
    if (id.endsWith("/expense-amount-input")) return { ExpenseAmountInput };
    if (id.endsWith("/account-picker")) return { AccountPicker: () => createElement("span", null) };
    if (id.endsWith("/contact-picker")) return { ContactPicker: ({ placeholder }: { placeholder: string }) => createElement("span", null, placeholder) };
    if (id.endsWith("/file-uploader")) return { FileUploader: () => createElement("span", null) };
    return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  };
  const code = ts.transpileModule(ast.text + `\nexport { ${name} };`, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function("require", "module", "exports", code)(load, compiled, compiled.exports);
  return function Probe() { index = 0; const tree = compiled.exports[name](props); inspect(tree); return tree; };
}
function nodes(tree: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!isValidElement<Record<string, unknown>>(tree)) return [];
  return [tree, ...nodes(tree.props.children as ReactNode)];
}
function callback(path: string, parent: string, name: string, scope: Record<string, unknown>, effectIndex = 0) {
  const ast = parse(path); let expression = "", index = 0;
  function visit(n: ts.Node) {
    if (ts.isCallExpression(n) && n.expression.getText(ast) === "useEffect" && name === "effect" && index++ === effectIndex) expression = n.arguments[0].getText(ast);
    if (ts.isFunctionDeclaration(n) && n.name?.text === name) expression = n.getText(ast);
    if (ts.isVariableDeclaration(n) && n.name.getText(ast) === name && n.initializer) {
      expression = ts.isCallExpression(n.initializer) && n.initializer.expression.getText(ast) === "useCallback" ? n.initializer.arguments[0].getText(ast) : n.initializer.getText(ast);
    }
    ts.forEachChild(n, visit);
  }
  visit(findFunction(ast, parent)); assert.ok(expression, name);
  const code = ts.transpileModule(`const run = ${expression};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(scope), `${code}; return run;`)(...Object.values(scope));
}
const flush = async () => { for (let i = 0; i < 5; i++) await new Promise(r => setImmediate(r)); };

test("expense list renders bilingual lifecycle, filters, exact mixed-currency totals and escaped caller data", () => {
  for (const locale of locales) {
    const t = tFor(locale), events: unknown[] = [], captured: ReactElement[] = [];
    const Empty = loaded(list, "ExpensesWorkspace", { loading: false, countsData: { counts: {}, total: 0 } }, events, tree => captured.push(tree));
    const empty = renderWithPresentation(createElement(Empty), locale);
    for (const key of ["emptyTitle", "emptyDescription", "draftStep", "submittedStep", "approvedStep", "paidStep", "newClaim"] as const) assert.ok(empty.includes(escape(t(key))), key);
    assert.deepEqual(events[0], ["documentTitle", t("documentTitle")]);
    (nodes(captured[0]).find(n => n.props.onClick)?.props.onClick as () => void)();
    assert.deepEqual(events.at(-1), ["drawer", "expense"]);
    const Page = loaded(list, "ExpensesWorkspace", { loading: false, claims: [claim, { ...claim, id: "b", currencyCode: "JPY", status: "paid" }], countsData: { total: 2, counts: { draft: { count: 1, amountMinor: "1250", currencyCode: "USD" }, paid: { count: 1, amountMinor: "1250", currencyCode: "JPY" } } } });
    const html = renderWithPresentation(createElement(Page), locale);
    for (const key of ["title", "description", "newExpense", "multipleCurrencies", "search", "newest", "submittedBy", "amount", "paid"] as const) assert.ok(html.includes(escape(t(key))), key);
    assert.ok(html.includes(escape(caller)) && !html.includes("<script>"));
    assert.ok(html.includes(escape(money.expenseUiMoney(1250n, "JPY"))) && html.includes("12.50"));
    for (const key of ["countsFailed", "readFailed", "moreFailed"] as const) {
      const Failed = loaded(list, "ExpensesWorkspace", { loading: false, claimsError: key });
      assert.ok(renderWithPresentation(createElement(Failed), locale).includes(escape(t(key))));
    }
  }
});

test("expense details and edit drawer render all workflow states, timeline, mileage and exact previews in both locales", () => {
  for (const locale of locales) for (const status of ["draft", "submitted", "approved", "paid", "rejected", "constructor"]) {
    const t = tFor(locale), current = { ...claim, status, submittedAt: claim.createdAt, approvedAt: claim.createdAt, paidAt: claim.createdAt, items: [{ ...item, isMileage: true, distanceMiles: 300, mileageRate: 67 }] };
    const Page = loaded(detail, "ExpenseDetailWorkspace", { loading: false, claim: current }, [], noop, { id: claim.id });
    const html = renderWithPresentation(createElement(Page), locale);
    assert.ok(html.includes(escape(caller)) && !html.includes("<script>"));
    for (const key of ["totalAmount", "currency", "receipt", "category"] as const) assert.ok(html.includes(escape(t(key))), key);
    assert.ok(html.includes(escape(t("mileageDetail", { distance: "3.00", rate: "$0.67" }))));
    assert.ok(html.includes(status === "constructor" ? status : escape(presentation.expenseStatusLabel(t, status))));
  }
  for (const locale of locales) for (const currencyCode of ["USD", "JPY", "KWD", "IRR"]) {
    const t = tFor(locale), current = { ...claim, currencyCode };
    const Edit = loaded(detail, "EditExpenseDrawer", {}, [], noop, { open: true, claim: current, onClose: noop, onSaved: noop });
    const html = renderWithPresentation(createElement(Edit), locale);
    for (const key of ["editClaim", "editDescription", "claimInfo", "saveChanges", "cancel", "expenseItems"] as const) assert.ok(html.includes(escape(t(key))), key);
    assert.ok(html.includes(escape(t("editCurrency", { currency: currencyCode }))));
    assert.ok(html.includes(escape(money.expenseUiMoney(1250n, currencyCode))));
    assert.ok(html.includes(escape(t("itemAmount", { number: 1 }))));
  }
});

test("expense creation and recurring drawers translate amount guidance, preview errors, frequency values and busy controls", () => {
  for (const locale of locales) {
    const t = tFor(locale);
    const Create = loaded(create, "ExpenseDrawer", { settings: { currencyCode: "USD", rate: "0.67" }, items: [{ ...editItem, isMileage: true, distanceMiles: "3", mileageRate: "0.005" }] }, [], noop, { open: true, onClose: noop });
    const html = renderWithPresentation(createElement(Create), locale);
    for (const key of ["newClaim", "newDescription", "mileageClaim", "distanceRequired", "rateRequired", "createClaim", "cancel"] as const) assert.ok(html.includes(escape(t(key))), key);
    assert.ok(html.includes("$0.02") && html.includes(escape(t("itemRate", { number: 1 }))));
    const Failed = loaded(create, "ExpenseDrawer", { settingsError: "taxesFailed" }, [], noop, { open: true, onClose: noop });
    assert.ok(renderWithPresentation(createElement(Failed), locale).includes(escape(t("taxesFailed"))));
    const captured: ReactElement[] = [], events: unknown[] = [];
    const Recurring = loaded(recurring, "RecurringExpensesWorkspace", { loading: false, drawerOpen: true, ...header, lines: [recurringLine] }, events, tree => captured.push(tree));
    const recurringHtml = renderWithPresentation(createElement(Recurring), locale);
    for (const key of ["recurringTitle", "recurringDescription", "recurringScale", "monthly", "fixedTwo", "createRecurring"] as const) assert.ok(recurringHtml.includes(escape(t(key))), key);
    assert.ok(recurringHtml.includes("$0.01"));
    const elements = nodes(captured[0]);
    assert.deepEqual(elements.filter(n => n.type === Select.SelectItem).map(n => n.props.value), ["weekly", "fortnightly", "monthly", "quarterly", "semi_annual", "annual"]);
    const select = elements.find(n => n.type === Select.Select)!;
    (select.props.onValueChange as (v: string) => void)("semi_annual"); assert.deepEqual(events.at(-1), ["frequency", "semi_annual"]);
    const Busy = loaded(recurring, "RecurringExpensesWorkspace", { submitting: true });
    assert.ok(renderWithPresentation(createElement(Busy), locale).includes(escape(t("creating"))));
  }
});

test("expense lifecycle actions preserve routes, methods, reason/date payloads and contain network/server failures", async () => {
  for (const locale of locales) for (const action of ["submit", "approve", "reject", "pay", "recall", "reverse", "delete"]) for (const mode of ["success", "status", "network"]) {
    const t = tFor(locale), errors: string[] = [], successes: string[] = [], requests: RequestInit[] = []; let reloads = 0;
    const body = action === "reject" ? { reason: caller } : action === "pay" ? { date: "2026-10-19" } : undefined;
    const result = await callback(detail, "ExpenseDetailWorkspace", "runAction", { orgId: "org-a", id: claim.id, t, loadClaim: () => reloads++, toast: { error: (v: string) => errors.push(v), success: (v: string) => successes.push(v) }, fetch: async (url: string, init: RequestInit) => {
      assert.equal(url, `/api/v1/expenses/${claim.id}${action === "delete" ? "" : "/" + action}`); requests.push(init);
      if (mode === "network") throw new Error("private server prose");
      return new Response("private HTML", { status: mode === "status" ? 403 : 200 });
    } })(action, body);
    assert.equal(result, mode === "success"); assert.equal(reloads, mode === "success" && action !== "delete" ? 1 : 0);
    assert.equal(requests[0].method, action === "delete" ? "DELETE" : "POST");
    assert.deepEqual(requests[0].headers, { ...(body ? { "Content-Type": "application/json" } : {}), "x-organization-id": "org-a" });
    assert.deepEqual(requests[0].body ? JSON.parse(String(requests[0].body)) : undefined, body);
    assert.equal(errors.length, mode === "success" ? 0 : 1); assert.equal(successes.length, mode === "success" ? 1 : 0);
    assert.ok([...errors, ...successes].every(v => !v.includes("private") && Object.values(locale === "en-US" ? en.Expenses : fa.Expenses).includes(v)));
  }
  const noOrg = callback(detail, "ExpenseDetailWorkspace", "runAction", { orgId: null, fetch: () => assert.fail("no org") });
  assert.equal(await noOrg("submit"), false);
});

test("expense create and edit retain exact money, mileage and item identity payloads and keep failed forms open", async () => {
  for (const kind of ["create", "edit"]) for (const mode of ["success", "status", "network", "invalid", ...(kind === "create" ? ["shape"] : [])]) {
    const t = tFor("fa-IR"), errors: string[] = [], busy: boolean[] = []; let closes = 0, saved = 0;
    const current = { ...editItem, amount: mode === "invalid" ? "1x" : "0.005" };
    const path = kind === "create" ? create : detail, parent = kind === "create" ? "ExpenseDrawer" : "EditExpenseDrawer";
    const requests: RequestInit[] = [];
    await callback(path, parent, "handleSubmit", { t, localStorage: { getItem: () => "org-a" }, title: caller, description: caller, items: [current], settings: { currencyCode: "USD" }, settingsError: null, editTitle: caller, editDescription: caller, editItems: [current], claim,
      ...money, ...presentation, setSaving: (v: boolean) => busy.push(v), toast: { error: (v: string) => errors.push(v), success: noop }, onClose: () => closes++, onSaved: () => saved++, router: { push: noop },
      fetch: async (url: string, init: RequestInit) => { assert.equal(url, kind === "create" ? "/api/v1/expenses" : `/api/v1/expenses/${claim.id}`); requests.push(init); if (mode === "network") throw new Error("private"); return Response.json(mode === "shape" ? {} : { expenseClaim: { id: "new" }, error: "private prose" }, { status: mode === "status" ? 403 : 200 }); },
    })({ preventDefault: noop });
    assert.equal(requests.length, mode === "invalid" ? 0 : 1); assert.equal(closes, mode === "success" ? 1 : 0); assert.equal(saved, kind === "edit" && mode === "success" ? 1 : 0);
    if (requests.length) {
      assert.equal(requests[0].method, kind === "create" ? "POST" : "PATCH");
      const body = JSON.parse(String(requests[0].body)); assert.equal(body.title, caller); assert.equal(body.description, caller);
      assert.equal(body.items[0].amountMinor, "1"); assert.equal(body.items[0].amountExact, "0.005"); assert.equal(body.items[0].id, supplier);
      assert.equal(body.currencyCode, kind === "create" ? "USD" : undefined);
    }
    assert.ok(errors.every(v => !v.includes("private"))); assert.equal(errors.length, mode === "success" ? 0 : 1); assert.equal(busy.at(-1), false);
  }
});

test("expense list and detail reads preserve org headers, exact adoption and localized safe errors", async () => {
  for (const target of ["counts", "list", "detail"]) for (const mode of ["success", "status", "shape", "alias", "network", "html", ...(target !== "detail" ? ["stale"] : [])]) {
    const writes: unknown[] = [], errors: unknown[] = [];
    const counts = { counts: { draft: { count: 1, amount: 1250, amountMinor: mode === "alias" ? "01250" : "1250", currencyCode: "USD" } }, total: 1 };
    const current = { ...claim, totalAmountMinor: mode === "alias" ? "01250" : "1250" };
    const path = target === "detail" ? detail : list, parent = target === "detail" ? "ExpenseDetailWorkspace" : "ExpensesWorkspace";
    const scope = { orgId: "org-a", id: claim.id, loading: true, ...money, setCountsData: (v: unknown) => writes.push(v), setCountsError: (v: unknown) => errors.push(v), setClaims: (v: unknown) => writes.push(v), setClaimsError: (v: unknown) => errors.push(v), setClaim: (v: unknown) => writes.push(v), setLoadError: (v: unknown) => errors.push(v), setLoading: noop, setRefetching: noop, setPage: noop, setHasMore: noop, setFetchKey: noop, buildParams: (page: number) => new URLSearchParams({ page: String(page), limit: "50" }), fetch: async (url: string, init: RequestInit) => {
      assert.equal((init.headers as Record<string, string>)["x-organization-id"], "org-a");
      assert.equal(url, target === "counts" ? "/api/v1/expenses/counts" : target === "detail" ? `/api/v1/expenses/${claim.id}` : "/api/v1/expenses?page=1&limit=50");
      if (mode === "network") throw new Error("private"); if (mode === "html") return new Response("private");
      return Response.json(mode === "shape" ? {} : target === "counts" ? counts : target === "detail" ? { expenseClaim: current } : { data: [current], pagination: { page: 1, totalPages: 1 } }, { status: mode === "status" ? 403 : 200 });
    } };
    const cleanup = callback(path, parent, target === "detail" ? "loadClaim" : "effect", scope, target === "list" ? 1 : 0)();
    if (mode === "stale") cleanup(); await flush();
    const success = mode === "success", stale = mode === "stale";
    const errorKey = target === "counts" ? "countsFailed" : target === "detail" ? "detailFailed" : "readFailed";
    assert.equal(writes.length, stale ? 0 : 1); assert.deepEqual(errors.filter(v => v !== null), success || stale ? [] : [errorKey]);
    if (success) assert.deepEqual(writes[0], target === "counts" ? counts : target === "detail" ? claim : [claim]);
    if (typeof cleanup === "function") cleanup();
  }
});

test("expense creation settings use distinct error keys, preserve mileage rates, and ignore cancelled work", async () => {
  for (const mode of ["success", "currency", "taxes", "shape", "stale"]) {
    const writes: unknown[] = [], errors: unknown[] = [], items: unknown[] = [];
    const cleanup = callback(create, "ExpenseDrawer", "effect", { open: true, localStorage: { getItem: () => "org-a" }, ...money, setSettings: (v: unknown) => writes.push(v), setSettingsError: (v: unknown) => errors.push(v), setTaxRates: noop, setItems: (fn: (v: unknown[]) => unknown) => items.push(fn([{ mileageRate: "" }, { mileageRate: "0.99" }])), fetch: async (url: string, init: RequestInit) => {
      assert.equal((init.headers as Record<string, string>)["x-organization-id"], "org-a");
      const taxes = url === "/api/v1/tax-rates";
      return Response.json(mode === "shape" && taxes ? {} : taxes ? { taxRates: [] } : { currencyCode: "USD", mileageRate: 67, mileageRateMinor: "67" }, { status: (mode === "taxes" && taxes || mode === "currency" && !taxes) ? 403 : 200 });
    } })();
    if (mode === "stale") cleanup(); await flush();
    assert.deepEqual(errors, mode === "currency" ? ["currencyFailed"] : ["taxes", "shape"].includes(mode) ? ["taxesFailed"] : []);
    assert.equal(writes.length, ["currency", "stale"].includes(mode) ? 0 : 1);
    if (writes.length) { assert.deepEqual(writes[0], { currencyCode: "USD", rate: "0.67" }); assert.deepEqual(items[0], [{ mileageRate: "0.67" }, { mileageRate: "0.99" }]); }
    cleanup();
  }
});

test("recurring expense read cancellation and create callbacks preserve fixed-two exact inputs, schedule and retry state", async () => {
  for (const mode of ["success", "status", "html", "shape", "network", "stale"]) {
    const errors: unknown[] = [], writes: unknown[] = [], busy: boolean[] = [];
    const cleanup = callback(recurring, "RecurringExpensesWorkspace", "fetchTemplates", { orgId: "org-a", orgHeaders: () => ({ "x-organization-id": "org-a" }), setLoading: (v: boolean) => busy.push(v), setError: (v: unknown) => errors.push(v), setTemplates: (v: unknown) => writes.push(v), fetch: async (url: string, init: RequestInit) => {
      assert.equal(url, "/api/v1/recurring?type=expense"); assert.equal((init.headers as Record<string, string>)["x-organization-id"], "org-a");
      if (mode === "network") throw new Error("private"); if (mode === "html") return new Response("private");
      return Response.json(mode === "shape" ? {} : { data: [{ id: "template-a" }] }, { status: mode === "status" ? 403 : 200 });
    } })();
    if (mode === "stale") cleanup(); await flush();
    assert.deepEqual(writes, mode === "stale" ? [] : mode === "success" ? [[{ id: "template-a" }]] : [[]]);
    assert.deepEqual(errors, ["success", "stale"].includes(mode) ? [null] : [null, "recurringReadFailed"]); assert.deepEqual(busy, mode === "stale" ? [true] : [true, false]); cleanup();
  }
  for (const mode of ["success", "status", "shape", "network", "amount", "limit", "dates"]) {
    const errors: string[] = []; let resets = 0, closes = 0, reads = 0; const requests: RequestInit[] = [];
    const currentHeader = { ...header, currencyCode: "JPY", maxOccurrences: mode === "limit" ? "1.5" : "2", endDate: mode === "dates" ? "2026-01-01" : "2027-10-19" };
    const lines = [{ ...recurringLine, amount: mode === "amount" ? "1x" : "12.50" }];
    await callback(recurring, "RecurringExpensesWorkspace", "handleSubmit", { ...currentHeader, lines, orgId: "org-a", submitting: false, recurringExpensePayload, ...presentation, t: tFor("fa-IR"), orgHeaders: () => ({ "x-organization-id": "org-a" }), setSubmitting: noop, setDrawerOpen: () => closes++, resetForm: () => resets++, fetchTemplates: () => reads++, toast: { error: (v: string) => errors.push(v) }, fetch: async (_url: string, init: RequestInit) => { requests.push(init); if (mode === "network") throw new Error("private"); return Response.json(mode === "shape" ? {} : { template: { id: "new" } }, { status: mode === "status" ? 403 : 201 }); } })();
    assert.equal(closes, mode === "success" ? 1 : 0); assert.equal(resets, closes); assert.equal(reads, closes); assert.equal(errors.length, mode === "success" ? 0 : 1); assert.ok(errors.every(v => !v.includes("private")));
    if (requests.length) { const body = JSON.parse(String(requests[0].body)); assert.equal(body.type, "expense"); assert.equal(body.lines[0].unitPriceExact, "12.50"); assert.equal(body.currencyCode, "JPY"); assert.equal(body.maxOccurrences, 2); assert.equal(recurringExpensePreview(lines, "JPY").total, 1250n); }
  }
});

test("receipt URL callback checks status/shape, contains network/JSON failures and settles loading", async () => {
  for (const mode of ["success", "status", "shape", "network", "html", "noOrg"]) {
    const writes: unknown[] = [], busy: boolean[] = [];
    await callback(detail, "ReceiptViewer", "loadUrl", { url: null, fileKey: "a & b.pdf", setLoading: (v: boolean) => busy.push(v), setUrl: (v: unknown) => writes.push(v), localStorage: { getItem: () => mode === "noOrg" ? null : "org-a" }, fetch: async (url: string) => { assert.notEqual(mode, "noOrg"); assert.equal(url, "/api/v1/expenses/receipt-url?fileKey=a%20%26%20b.pdf"); if (mode === "network") throw new Error("private"); if (mode === "html") return new Response("private"); return Response.json(mode === "shape" ? {} : { downloadUrl: "https://example.test/receipt" }, { status: mode === "status" ? 403 : 200 }); } })();
    assert.deepEqual(writes, mode === "noOrg" ? [] : mode === "success" ? ["https://example.test/receipt"] : [null]); assert.deepEqual(busy, mode === "noOrg" ? [] : [true, false]);
  }
});

test("expense source inventory and finite labels/errors retain safe unknown data and valid Persian", () => {
  for (const path of [list, detail, recurring, create]) {
    const ast = parse(path), root = path === create ? findFunction(ast, "ExpenseDrawer") : ast;
    function visit(n: ts.Node) {
      if (ts.isJsxText(n)) assert.doesNotMatch(n.text.trim(), /[A-Za-z]/, `${path}: ${n.text}`);
      if (ts.isJsxAttribute(n) && ["title", "label", "description", "placeholder", "aria-label", "emptyMessage"].includes(n.name.getText(ast)) && n.initializer && ts.isStringLiteral(n.initializer)) assert.doesNotMatch(n.initializer.text, /[A-Za-z]/, `${path}: ${n.initializer.text}`);
      ts.forEachChild(n, visit);
    }
    visit(root);
  }
  for (const value of Object.values(fa.Expenses)) assert.match(value, /[\u0600-\u06ff]/);
  for (const locale of locales) for (const code of ["constructor", "__proto__", "future_code"]) {
    assert.equal(presentation.expenseStatusLabel(tFor(locale), code), code); assert.equal(presentation.expenseFrequencyLabel(tFor(locale), code), code);
  }
  assert.equal(presentation.expenseInputError(new Error("private server prose")), "checkAmounts");
  assert.equal(presentation.expenseInputError(new Error("__proto__")), "checkAmounts");
  assert.equal(expenseSummaryDisplay([{ amountMinor: "9007199254740991", currencyCode: "USD" }, { amountMinor: "1", currencyCode: "USD" }]), "$90,071,992,547,409.92");
});
