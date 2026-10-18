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
import * as AccountPicker from "../components/dashboard/account-picker";
import * as DataTable from "../components/dashboard/data-table";
import * as BrandLoader from "../components/dashboard/brand-loader";
import { ASSET_CATEGORY_METHODS, ASSET_CATEGORY_CONVENTIONS, assetCategoryMethodLabel, assetCategoryJson, assetCategoryFailureMessage } from "../i18n/asset-category-presentation";
import { assetCentsInput, assetCentsDecimal, assetLifeInput, assetRateInput, assetMoneyDisplay } from "../lib/money/asset-display";
import { renderWithPresentation } from "./helpers/presentation";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const path = "app/(dashboard)/accounting/asset-categories/page.tsx";
const source = readFileSync(path, "utf8");
const locales = ["en-US", "fa-IR"] as const;
const noop = () => {};
const form = { name: "  <script>دسته</script>  ", defaultDepreciationMethod: "declining_balance", defaultConvention: "mid_quarter", usefulLifeMonths: "36", residualValue: "40000000000000.01", depreciationRatePct: "20.25", assetAccountId: "asset-a", depreciationAccountId: "expense-a", accumulatedDepAccountId: "", cwipAccountId: "", isActive: false };
const category = { id: "category-a", name: form.name.trim(), defaultDepreciationMethod: "declining_balance", defaultConvention: "mid_quarter", defaultUsefulLifeMonths: 36, defaultResidualValue: 4000000000000001, defaultResidualValueMinor: "4000000000000001", defaultDepreciationRateBp: 2025, assetAccountId: "asset-a", depreciationAccountId: "expense-a", accumulatedDepAccountId: null, cwipAccountId: null, isActive: false };

function translators(locale: typeof locales[number]) {
  const messages = locale === "en-US" ? en : fa;
  return { t: createTranslator({ locale, messages, namespace: "AssetCategories" }), errors: createTranslator({ locale, messages, namespace: "AssetCategoryErrors" }) };
}

// Real production template/next-intl/fields/table/money with controlled hook state.
// Dialog and select portals render inline to inspect all authored choices in SSR.
function loaded(states: unknown[], titles: string[] = []) {
  let index = 0;
  const require = createRequire(resolve(path));
  const compiled = { exports: {} as { default: ComponentType } };
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  const inline = ({ children }: { children: ReactNode }) => createElement("div", null, children);
  const load = (id: string) => {
    if (id === "next-intl") return nextIntl;
    if (id.endsWith("/account-picker")) return AccountPicker;
    if (id.endsWith("/data-table")) return DataTable;
    if (id.endsWith("/brand-loader")) return BrandLoader;
    if (id === "react") return { ...React, useState: (initial: unknown) => [index < states.length ? states[index++] : initial, noop], useEffect: noop, useCallback: (fn: unknown) => fn };
    if (id.endsWith("/use-document-title")) return { useDocumentTitle: (title: string) => titles.push(title) };
    if (id.endsWith("/ui/dialog")) return Object.fromEntries(["Dialog", "DialogContent", "DialogHeader", "DialogTitle", "DialogDescription", "DialogFooter"].map(key => [key, inline]));
    if (id.endsWith("/ui/select")) return { Select: ({ children, value }: { children: ReactNode; value: string }) => createElement("div", { "data-value": value }, children), SelectItem: ({ children, value }: { children: ReactNode; value: string }) => createElement("div", { "data-option": value }, children), SelectTrigger: inline, SelectValue: () => null, SelectContent: inline };
    return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  };
  new Function("require", "module", "exports", code)(load, compiled, compiled.exports);
  return compiled.exports.default;
}

function callback(name: string, scope: Record<string, unknown>) {
  const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let expression = "";
  function visit(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name && node.initializer && ts.isCallExpression(node.initializer)) expression = node.initializer.arguments[0].getText(ast);
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) expression = `(${node.getText(ast)})`;
    ts.forEachChild(node, visit);
  }
  visit(ast); assert.ok(expression, name);
  const code = ts.transpileModule(`const run = ${expression};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(scope), `${code}; return run;`)(...Object.values(scope));
}

test("asset-category production page renders bilingual empty/table/create/edit states and exact cents safely", () => {
  for (const locale of locales) {
    const { t } = translators(locale), titles: string[] = [];
    const Empty = loaded([[], null, false, false, true, null, form, false, null], titles);
    const empty = renderWithPresentation(createElement(Empty), locale);
    assert.deepEqual(titles, [t("documentTitle")]);
    for (const key of ["title", "description", "newAction", "emptyTitle", "emptyDescription", "newTitle", "create"] as const) assert.ok(empty.includes(t(key)), key);
    const Page = loaded([[category, { ...category, id: "b", isActive: true, defaultUsefulLifeMonths: null, defaultResidualValue: 0, defaultResidualValueMinor: "0" }], null, false, false, true, category.id, form, true, t("saveFailed")]);
    const html = renderWithPresentation(createElement(Page), locale);
    for (const key of ["name", "method", "lifespan", "residual", "status", "active", "inactive", "editTitle", "dialogDescription", "nameExample", "convention", "lifeMonths", "lifeHint", "residualHint", "rate", "rateHint", "books", "assetAccount", "expenseAccount", "accumulatedAccount", "cwipAccount", "cwipHint", "available", "availableHint", "cancel", "save", "saveFailed"] as const) assert.ok(html.includes(t(key).replaceAll("&", "&amp;").replaceAll("'", "&#x27;")), key);
    assert.ok(html.includes(t("months", { count: 36 })));
    assert.ok(html.includes(assetMoneyDisplay(category.defaultResidualValue)));
    assert.ok(html.includes("&lt;script&gt;دسته&lt;/script&gt;") && !html.includes("<script>"));
    assert.ok(html.includes(t("editAction", { name: category.name }).replaceAll("<", "&lt;").replaceAll(">", "&gt;")));
    assert.ok(html.includes('data-value="declining_balance"') && html.includes('data-value="mid_quarter"'));
    for (const value of [...ASSET_CATEGORY_METHODS, ...ASSET_CATEGORY_CONVENTIONS]) { assert.ok(html.includes(`data-option="${value}"`)); assert.ok(html.includes(t(value).replaceAll("'", "&#x27;"))); }
    assert.ok(html.includes('value="40000000000000.01"') && html.includes('placeholder="0.00"'));
    assert.match(html, /<button(?=[^>]*disabled="")[^>]*>/);
    if (locale === "fa-IR") assert.match(t("title"), /[\u0600-\u06ff]/);
  }
});

test("category display mappings retain unknown codes and known method names without prototype lookups", () => {
  for (const locale of locales) {
    const { t } = translators(locale);
    for (const method of ASSET_CATEGORY_METHODS) assert.equal(assetCategoryMethodLabel(t, method), t(`${method}Short`));
    for (const code of ["future_method", "__proto__", "constructor"]) assert.equal(assetCategoryMethodLabel(t, code), code);
  }
});

test("category errors translate approved status/service/input failures and hide unknown prose", async () => {
  for (const locale of locales) {
    const { t, errors } = translators(locale);
    const cases = [[401, "secret", "unauthenticated"], [403, "secret", "forbidden"], [400, "secret", "invalidInput"], [422, "secret", "invalidInput"], [404, "Asset category not found", "missing"], [404, "Saved asset account is outside the organization", "savedAccountInvalid"]] as const;
    for (const [status, error, key] of cases) await assert.rejects(assetCategoryJson(Response.json({ error }, { status }), errors, t("saveFailed")), { message: errors(key) });
    for (const field of ["assetAccountId", "depreciationAccountId", "accumulatedDepAccountId", "cwipAccountId"]) await assert.rejects(assetCategoryJson(Response.json({ error: `${field} must be a live active organization account` }, { status: 404 }), errors, t("saveFailed")), { message: errors("accountUnavailable") });
    await assert.rejects(assetCategoryJson(Response.json({ code: "LEGACY_NUMERIC_RANGE" }, { status: 409 }), errors, t("readFailed")), { message: errors("invalidMoney") });
    for (const body of [null, { error: "secret" }, { error: "constructor" }, { error: "__proto__" }, { error: {} }]) await assert.rejects(assetCategoryJson(Response.json(body, { status: 500 }), errors, t("saveFailed")), { message: t("saveFailed") });
    await assert.rejects(assetCategoryJson(new Response("HTML secret", { status: 500 }), errors, t("saveFailed")), { message: t("saveFailed") });
    for (const error of [new Error("secret"), new RangeError("constructor"), new SyntaxError("secret")]) assert.equal(assetCategoryFailureMessage(error, errors, t("saveFailed")), t("saveFailed"));
    assert.deepEqual(await assetCategoryJson(Response.json({ category }), errors, t("readFailed")), { category });
    await assert.rejects(assetCategoryJson(Response.json({ category: { ...category, defaultResidualValueMinor: "04000000000000001" } }), errors, t("readFailed")));
  }
});

test("actual category loader scopes requests, rejects error/malformed data, clears stale errors after successful reload", async () => {
  for (const locale of locales) for (const failure of ["success", "forbidden", "network", "html", "alias", "shape"]) {
    const { t, errors } = translators(locale), rows: unknown[][] = [], messages: (string | null)[] = [], initial: boolean[] = [], busy: boolean[] = [];
    const run = callback("load", { t, errors, assetCategoryJson, assetCategoryFailureMessage, orgId: "org-a", setCategories: (v: unknown[]) => rows.push(v), setReadError: (v: string | null) => messages.push(v), setInitialLoad: (v: boolean) => initial.push(v), setRefetching: (v: boolean) => busy.push(v), fetch: async (url: string, init: RequestInit) => {
      assert.equal(url, "/api/v1/asset-categories?limit=200"); assert.equal((init.headers as Record<string, string>)["x-organization-id"], "org-a");
      if (failure === "network") throw new Error("secret");
      if (failure === "html") return new Response("secret");
      return Response.json(failure === "shape" ? {} : { data: [{ ...category, defaultResidualValueMinor: failure === "alias" ? "01" : category.defaultResidualValueMinor }] }, { status: failure === "forbidden" ? 403 : 200 });
    } });
    run(); await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(busy, [true, false]); assert.deepEqual(initial, [false]);
    assert.deepEqual(rows, failure === "success" ? [[category]] : []);
    assert.deepEqual(messages, [failure === "success" ? null : failure === "forbidden" ? errors("forbidden") : t("readFailed")]);
    if (failure !== "success") {
      const Page = loaded([[], messages[0], false, false]);
      const html = renderWithPresentation(createElement(Page), locale);
      assert.ok(html.includes('role="alert"') && html.includes(String(messages[0])) && !html.includes(t("emptyTitle")));
    }
  }
});

test("actual create/update callback preserves exact Minor payloads, nulls, codes and org scope; failures leave the dialog open", async () => {
  for (const locale of locales) for (const editingId of [null, category.id]) for (const failure of ["success", "forbidden", "network", "html", "alias", "shape"]) {
    const { t, errors } = translators(locale), busy: boolean[] = [], messages: (string | null)[] = [], closed: boolean[] = [];
    let reloads = 0;
    const run = callback("handleSave", { t, errors, assetCategoryJson, assetCategoryFailureMessage, assetCentsInput, assetLifeInput, assetRateInput, orgId: "org-a", form, editingId, setError: (v: string | null) => messages.push(v), setSaving: (v: boolean) => busy.push(v), setDialogOpen: (v: boolean) => closed.push(v), load: () => { reloads++; }, fetch: async (url: string, init: RequestInit) => {
      assert.equal(url, editingId ? `/api/v1/asset-categories/${category.id}` : "/api/v1/asset-categories"); assert.equal(init.method, editingId ? "PATCH" : "POST"); assert.equal((init.headers as Record<string, string>)["x-organization-id"], "org-a");
      assert.deepEqual(JSON.parse(String(init.body)), { name: form.name.trim(), defaultDepreciationMethod: "declining_balance", defaultConvention: "mid_quarter", defaultUsefulLifeMonths: 36, defaultResidualValueMinor: "4000000000000001", defaultDepreciationRateBp: 2025, assetAccountId: "asset-a", depreciationAccountId: "expense-a", accumulatedDepAccountId: null, cwipAccountId: null, isActive: false });
      if (failure === "network") throw new Error("secret");
      if (failure === "html") return new Response("secret");
      return Response.json({ category: failure === "shape" ? {} : { ...category, defaultResidualValueMinor: failure === "alias" ? "01" : category.defaultResidualValueMinor } }, { status: failure === "forbidden" ? 403 : 200 });
    } });
    await run(); assert.deepEqual(busy, [true, false]);
    assert.deepEqual(closed, failure === "success" ? [false] : []); assert.equal(reloads, failure === "success" ? 1 : 0);
    assert.deepEqual(messages, failure === "success" ? [null] : [null, failure === "forbidden" ? errors("forbidden") : t("saveFailed")]);
  }
});

test("actual save validation translates name, amount/range, months and rate errors without sending requests", async () => {
  for (const locale of locales) {
    const { t, errors } = translators(locale);
    for (const [changes, expected] of [[{ name: " " }, t("nameRequired")], [{ residualValue: "1.234" }, errors("amount")], [{ residualValue: "90071992547409.92" }, errors("amountRange")], [{ usefulLifeMonths: "0" }, errors("life")], [{ depreciationRatePct: "1000.01" }, errors("rate")]] as const) {
      const messages: (string | null)[] = [], busy: boolean[] = [];
      const run = callback("handleSave", { t, errors, assetCategoryFailureMessage, assetCentsInput, assetLifeInput, assetRateInput, orgId: "org-a", form: { ...form, ...changes }, setError: (v: string | null) => messages.push(v), setSaving: (v: boolean) => busy.push(v), fetch: () => assert.fail("invalid input must not send") });
      await run(); assert.equal(messages.at(-1), expected); assert.deepEqual(busy, "name" in changes ? [] : [true, false]);
    }
    const run = callback("handleSave", { orgId: null, setSaving: () => assert.fail("must not start saving") }); await run();
  }
});

test("edit initialization retains exact low digits, nullable defaults, IDs and active state", () => {
  const toForm = callback("categoryToForm", { assetCentsDecimal });
  assert.deepEqual(toForm(category), { ...form, name: category.name });
  const blank = toForm({ ...category, defaultUsefulLifeMonths: null, defaultResidualValue: 0, defaultDepreciationRateBp: null, assetAccountId: null, depreciationAccountId: null });
  for (const key of ["usefulLifeMonths", "residualValue", "depreciationRatePct", "assetAccountId", "depreciationAccountId"]) assert.equal(blank[key], "");
});
