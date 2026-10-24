import { resolvePresentation } from "../i18n/locale";
import { formatDecimalDraft, formatExactDecimal as localizedExactDecimal } from "../i18n/numbers";
import { bankMoneyDisplay as localizedBankMoney } from "../lib/money/bank-display";
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
import * as BrandLoader from "../components/dashboard/brand-loader";
import * as AccountPicker from "../components/dashboard/account-picker";
import { fixedAssetJson, fixedAssetFailureMessage, FixedAssetRequestError, fixedAssetMethodLabel, fixedAssetStatusLabel } from "../i18n/fixed-asset-presentation";
import { assetCentsInput, assetLifeInput, assetMoneyDisplay, assetPercent } from "../lib/money/asset-display";
import { renderWithPresentation } from "./helpers/presentation";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const list = "app/(dashboard)/accounting/fixed-assets/page.tsx";
const detail = "app/(dashboard)/accounting/fixed-assets/[id]/page.tsx";
const drawer = "components/dashboard/create-drawer.tsx";
const locales = ["en-US", "fa-IR"] as const;
const noop = () => {};
const caller = "<script>دارایی & equipment</script>";
const asset = { id: "asset-a", name: caller, assetNumber: "FA-001", description: caller, purchaseDate: "2026-10-18", purchasePrice: 4000000000000001, purchasePriceMinor: "4000000000000001", residualValue: 29, residualValueMinor: "29", accumulatedDepreciation: 100, accumulatedDepreciationMinor: "100", netBookValue: 3999999999999901, netBookValueMinor: "3999999999999901", status: "active", depreciationMethod: "straight_line", usefulLifeMonths: 60, disposalDate: null, disposalAmount: null, disposalAmountMinor: null, assetAccount: { code: "1000", name: caller }, depreciationAccount: null, accumulatedDepAccount: null, depreciationEntries: [{ id: "dep-a", date: "2026-10-18", amount: 100, amountMinor: "100", journalEntry: { id: "j-a", entryNumber: 12 } }], revaluations: [{ id: "rev-a", date: "2026-10-18", revaluedAmount: 1250, revaluedAmountMinor: "1250", changeAmount: -29, changeAmountMinor: "-29", isImpairment: true, notes: caller }] };
const cost = { id: "cost-a", date: "2026-10-18", description: caller, amount: 29, amountMinor: "29" };
const account = { id: "account-a", code: "1000", name: caller, type: "asset" };
function translator(locale: typeof locales[number]) { return createTranslator({ locale, messages: locale === "en-US" ? en : fa, namespace: "FixedAssets" }); }
function escape(value: string) { return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;"); }

// Real production JSX, next-intl provider, tables, fields and money. Controlled
// hooks and inline portals make every state inspectable without a dev server.
function loaded(path: string, states: unknown[], titles: string[] = []) {
  let source = readFileSync(path, "utf8"), index = 0;
  const require = createRequire(resolve(path));
  const compiled = { exports: {} as Record<string, ComponentType<Record<string, unknown>>> };
  if (path === drawer) {
    const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const names = new Set(["FixedAssetDrawer", "DrawerFooter", "DrawerIcon", "SectionLabel"]);
    // Keep imports referenced by the selected production functions only.
    const functions = ast.statements.filter(n => ts.isFunctionDeclaration(n) && n.name && names.has(n.name.text));
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
    }).join("\n") + "\nexport { FixedAssetDrawer };";
  }
  const inline = ({ children, title }: { children: ReactNode; title?: string }) => createElement("div", { title }, children);
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  const load = (id: string) => {
    if (id === "next-intl") return nextIntl;
    if (id === "react") return { ...React, useState: (initial: unknown) => [index < states.length ? states[index++] : initial, noop], useEffect: noop, useMemo: (fn: () => unknown) => fn(), useCallback: (fn: unknown) => fn };
    if (id === "next/navigation") return { useRouter: () => ({ push: noop }), useParams: () => ({ id: asset.id }) };
    if (id.endsWith("/create-drawer")) return { useCreateDrawer: () => ({ open: noop }) };
    if (id.endsWith("/use-debounce")) return { useDebounce: (value: string) => value };
    if (id.endsWith("/use-document-title")) return { useDocumentTitle: (title: string) => titles.push(title) };
    if (id.endsWith("/use-confirm")) return { useConfirm: () => ({ confirm: noop, dialog: null }) };
    if (id.endsWith("/data-table")) return DataTable;
    if (id.endsWith("/date-picker")) return DatePicker;
    if (id.endsWith("/brand-loader")) return BrandLoader;
    if (id.endsWith("/account-picker")) return AccountPicker;
    if (id.endsWith("/ui/sheet")) return Object.fromEntries(["Sheet", "SheetContent", "SheetHeader", "SheetTitle", "SheetDescription"].map(key => [key, inline]));
    if (id.endsWith("/ui/dialog")) return Object.fromEntries(["Dialog", "DialogContent", "DialogHeader", "DialogTitle", "DialogDescription"].map(key => [key, inline]));
    if (id.endsWith("/ui/dropdown-menu")) return Object.fromEntries(["DropdownMenu", "DropdownMenuContent", "DropdownMenuItem", "DropdownMenuSeparator", "DropdownMenuTrigger"].map(key => [key, inline]));
    if (id.endsWith("/ui/select")) return { Select: ({ children, value }: { children: ReactNode; value: string }) => createElement("div", { "data-value": value }, children), SelectItem: ({ children, value }: { children: ReactNode; value: string }) => createElement("div", { "data-option": value }, children), SelectTrigger: inline, SelectContent: inline, SelectValue: ({ placeholder }: { placeholder?: string }) => createElement("span", null, placeholder) };
    return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  };
  new Function("require", "module", "exports", code)(load, compiled, compiled.exports);
  return compiled.exports[path === drawer ? "FixedAssetDrawer" : "default"];
}
function callback(path: string, name: string, scope: Record<string, unknown>, effectIndex = 0) {
  const ast = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let expression = "", effect = 0;
  function visit(n: ts.Node) {
    if (path === drawer && ts.isFunctionDeclaration(n) && n.parent === ast && n.name?.text !== "FixedAssetDrawer") return;
    if (ts.isFunctionDeclaration(n) && n.name?.text === name) expression = n.getText(ast);
    if (name === "effect" && ts.isCallExpression(n) && n.expression.getText(ast) === "useEffect" && effect++ === effectIndex) expression = n.arguments[0].getText(ast);
    ts.forEachChild(n, visit);
  }
  visit(ast); assert.ok(expression, name);
  const code = ts.transpileModule(`const run = ${expression};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(scope), `${code}; return run;`)(...Object.values(scope));
}
function listStates(rows: unknown[], search = "") { return [rows, rows, null, false, false, "all", search, false, 0, 0]; }
function detailStates(row: unknown = asset, costs: unknown[] = [cost]) { return [row, null, false, true, "0.29", "2026-10-18", true, "0.29", "2026-10-18", caller, true, "0.29", "2026-10-18", caller, true, "2026-10-18", true, "0.29", "2026-10-18", caller, account.id, costs, true]; }

test("fixed asset production list renders bilingual empty/table/search/error states and exact aggregate cents", () => {
  for (const locale of locales) {
    const t = translator(locale), titles: string[] = [];
    const Empty = loaded(list, listStates([]), titles);
    const empty = renderWithPresentation(createElement(Empty), locale);
    assert.deepEqual(titles, [t("documentTitle")]);
    for (const key of ["emptyTitle", "emptyDescription", "addAssets", "addAssetsHint", "spreadCost", "spreadCostHint", "trackValue", "trackValueHint", "addItem", "totalCost"] as const) assert.ok(empty.includes(escape(t(key))), key);
    const rows = [asset, { ...asset, id: "b", status: "disposed", depreciationMethod: "future_method" }, { ...asset, id: "c", status: "future_status" }];
    const Page = loaded(list, listStates(rows, "FA-001"));
    const html = renderWithPresentation(createElement(Page), locale);
    for (const key of ["assetNumber", "name", "purchased", "methodHint", "purchasePrice", "usedValue", "currentValue", "status", "runHint", "run", "search", "clear", "active", "disposed", "fullyDepreciated", "all"] as const) assert.ok(html.includes(escape(t(key))), key);
    assert.ok(html.includes(assetMoneyDisplay(BigInt(asset.purchasePrice) * 3n, resolvePresentation({ user: { language: locale } }))) && html.includes("future_method") && html.includes("future_status"));
    assert.ok(html.includes(escape(caller)) && !html.includes("<script>"));
    assert.ok(html.includes(escape(t("showingMatching", { count: 3, query: "FA-001" }))));
    const Missing = loaded(list, listStates(rows, "absent"));
    assert.ok(renderWithPresentation(createElement(Missing), locale).includes(escape(t("noMatches"))));
    const ErrorPage = loaded(list, [[], [], t("readFailed"), false]);
    assert.ok(renderWithPresentation(createElement(ErrorPage), locale).includes('role="alert"'));
    for (const count of [0, 1, 2]) { assert.ok(t("showing", { count })); assert.ok(t("runSuccess", { count })); }
  }
});

test("fixed asset detail renders all lifecycle dialogs, history, status and caller content in both locales", () => {
  for (const locale of locales) {
    const t = translator(locale), titles: string[] = [];
    for (const row of [asset, { ...asset, status: "in_progress", isCwip: true }, { ...asset, status: "disposed" }]) {
      const Page = loaded(detail, detailStates(row), titles);
      const html = renderWithPresentation(createElement(Page), locale);
      for (const key of ["back", "dispose", "disposeDescription", "disposalAmount", "disposalZero", "disposalDate", "revalue", "revalueDescription", "higherValue", "revalueNotes", "saveHigher", "impair", "impairDescription", "lowerValue", "impairNotes", "saveLower", "capitalize", "capitalizeDescription", "inServiceDate", "addConstructionCost", "costDescription", "amount", "sourceAccount", "sourceHint", "purposeExample", "addCost", "books", "booksDescription", "assetAccountHint", "expenseAccountHint", "accumulatedAccountHint", "depreciationHistory", "constructionCosts", "valueHistory", "writtenDown", "notSet"] as const) assert.ok(html.includes(escape(t(key))), key);
      assert.ok(html.includes(escape(t("lifeSummary", { method: t("straightLine"), count: 60 }))));
      assert.ok(html.includes(escape(t("currentAmount", { amount: assetMoneyDisplay(asset.netBookValue, resolvePresentation({ user: { language: locale } })) }))));
      assert.ok(html.includes(escape(t("totalAmount", { amount: localizedAmount("$0.29", locale) }))));
      assert.ok(html.includes(escape(caller)) && !html.includes("<script>"));
      assert.ok(html.includes(localizedNumber("40,000,000,000,000.01", locale)) && html.includes(localizedAmount("$0.29", locale)));
      if (row.status === "disposed") assert.ok(html.includes(escape(t("disposalDetails"))) && html.includes(escape(t("unavailable"))));
      if (row.status === "active") for (const key of ["depreciateHint", "revalueHint", "impairHint", "undoHint", "disposeHint", "deleteHint"] as const) assert.ok(html.includes(escape(t(key))), key);
    }
    assert.equal(titles[0], t("detailDocumentTitle"));
    const Empty = loaded(detail, detailStates({ ...asset, depreciationEntries: [], revaluations: [], status: "in_progress" }, []));
    const empty = renderWithPresentation(createElement(Empty), locale);
    assert.ok(empty.includes(escape(t("noDepreciation"))) && empty.includes(escape(t("noCosts"))));
    for (const [state, key] of [[[null, null, true], "loading"], [[null, null, false], "notFound"], [[null, t("readFailed"), false], "readFailed"]] as const) {
      const Page = loaded(detail, [...state]); assert.ok(renderWithPresentation(createElement(Page), locale).includes(escape(t(key))));
    }
  }
});

test("fixed asset creation drawer translates all fields and choices while keeping machine values and samples", () => {
  for (const locale of locales) {
    const t = translator(locale);
    const Drawer = loaded(drawer, [true, [account, { ...account, id: "expense-a", type: "expense" }], caller, caller, "FA-001", "2026-10-18", "40000000000000.01", "0.29", "60", "declining_balance", account.id, "expense-a", account.id]);
    const html = renderWithPresentation(createElement(Drawer, { open: true, onClose: noop }), locale);
    for (const key of ["newTitle", "newDescription", "assetInfo", "nameRequired", "numberRequired", "nameExample", "description", "descriptionExample", "purchase", "purchaseDateRequired", "priceRequired", "depreciation", "residual", "lifeMonths", "method", "straightLine", "decliningBalance", "accounts", "assetAccount", "expenseAccount", "accumulatedAccount", "selectAccount", "cancel", "creating"] as const) assert.ok(html.includes(escape(t(key))), key);
    assert.ok(html.includes('data-value="declining_balance"') && html.includes('data-option="straight_line"'));
    assert.ok(html.includes(`value="${formatDecimalDraft("40000000000000.01", resolvePresentation({ user: { language: locale } }))}"`) && html.includes('placeholder="FA-001"') && html.includes(`placeholder="${formatDecimalDraft("10000.00", resolvePresentation({ user: { language: locale } }))}"`));
    assert.ok(html.includes(escape(caller)) && !html.includes("<script>"));
    assert.match(html, /<button(?=[^>]*disabled="")[^>]*>/);
  }
});

test("asset request presentation rejects unknown prose, malformed response shapes and corrupt exact-money aliases", async () => {
  for (const locale of locales) {
    const t = translator(locale);
    for (const [status, code, key] of [[401, undefined, "unauthenticated"], [403, undefined, "forbidden"], [400, undefined, "invalidInput"], [422, undefined, "invalidInput"], [409, "LEGACY_NUMERIC_RANGE", "invalidMoney"], [500, undefined, "updateFailed"]] as const) await assert.rejects(fixedAssetJson(Response.json({ error: "private prose", code }, { status }), t, t("updateFailed")), { message: t(key) });
    for (const body of [null, [], {}, { asset: {} }, { asset: { ...asset, netBookValueMinor: "01" } }]) await assert.rejects(fixedAssetJson(Response.json(body), t, t("readFailed"), "detail"));
    for (const kind of ["data", "accounts", "costs"] as const) await assert.rejects(fixedAssetJson(Response.json({ [kind]: [{}] }), t, t("readFailed"), kind));
    await assert.rejects(fixedAssetJson(new Response("private HTML"), t, t("readFailed")));
    await assert.rejects(fixedAssetJson(new Response("private HTML", { status: 500 }), t, t("readFailed")), { message: t("readFailed") });
    assert.deepEqual(await fixedAssetJson(Response.json({ asset }), t, t("readFailed"), "detail"), { asset });
    for (const error of [new Error("private prose"), new RangeError("constructor"), new SyntaxError("private prose")]) assert.equal(fixedAssetFailureMessage(error, t, t("updateFailed")), t("updateFailed"));
    for (const [value, key] of [["1.234", "amountInvalid"], ["90071992547409.92", "amountRange"]] as const) { try { assetCentsInput(value); assert.fail(); } catch (error) { assert.equal(fixedAssetFailureMessage(error, t, "fallback"), t(key)); } }
    for (const code of ["future", "__proto__", "constructor"]) { assert.equal(fixedAssetStatusLabel(t, code), code); assert.equal(fixedAssetMethodLabel(t, code), code); }
    assert.equal(fixedAssetStatusLabel(t, "fully_depreciated"), t("fullyDepreciated"));
    assert.equal(fixedAssetMethodLabel(t, "declining_balance"), t("decliningBalance"));
  }
});

test("actual asset list/detail/account loaders localize failures and reject stale work before adopting state", async () => {
  for (const locale of locales) for (const kind of ["counts", "filtered", "detail", "accounts"]) for (const mode of ["success", "forbidden", "network", "html", "alias", "shape", "stale"]) {
    const t = translator(locale), writes: unknown[] = [], messages: unknown[] = [], busy: boolean[] = [];
    const scope = { unitPresentation: resolvePresentation({ user: { language: locale } }), t, fixedAssetJson, fixedAssetFailureMessage, orgId: "org-a", id: asset.id, statusFilter: "disposed", open: true,
      localStorage: { getItem: () => "org-a" }, devDelay: async () => {},
      setAssets: (v: unknown) => writes.push(v), setAllAssets: (v: unknown) => writes.push(v), setAsset: (v: unknown) => writes.push(v), setAccounts: (v: unknown) => writes.push(v), setCwipCosts: (v: unknown) => writes.push(v),
      setReadError: (v: unknown) => messages.push(v), toast: { error: (v: unknown) => messages.push(v) },
      setInitialLoad: (v: boolean) => busy.push(v), setLoading: (v: boolean) => busy.push(v), setRefetching: noop, setFetchKey: noop,
      fetch: async (url: string, init: RequestInit) => {
        assert.equal((init.headers as Record<string, string>)["x-organization-id"], "org-a");
        assert.equal(init.body, undefined);
        if (mode === "network") throw new Error("private prose");
        if (mode === "html") return new Response("private HTML");
        const row = { ...asset, purchasePriceMinor: mode === "alias" ? "01" : asset.purchasePriceMinor };
        const body = mode === "shape" ? {} : url.endsWith("cwip-cost") ? { costs: [cost] } : kind === "detail" ? { asset: row } : kind === "accounts" ? { accounts: [account], ...(mode === "alias" ? { amount: 1, amountMinor: "2" } : {}) } : { data: [row] };
        return Response.json(body, { status: mode === "forbidden" ? 403 : 200 });
      } };
    const run = callback(kind === "detail" ? detail : kind === "accounts" ? drawer : list, "effect", scope, kind === "filtered" ? 1 : 0);
    const cleanup = run(); if (mode === "stale" && cleanup) cleanup();
    await new Promise(resolve => setImmediate(resolve));
    if (mode === "success") assert.ok(writes.length > 0);
    else if (mode === "stale") { assert.deepEqual(writes, []); assert.ok(messages.every(v => v === null)); }
    else { assert.ok(messages.some(v => typeof v === "string" && !v.includes("private"))); if (kind !== "detail") assert.deepEqual(writes, []); }
    if (mode !== "stale" && ["filtered", "detail"].includes(kind)) assert.ok(busy.includes(false));
  }
});

test("production lifecycle callbacks preserve exact payloads, confirmations, org scope and stay-open failures", async () => {
  const operations = [
    ["handleDepreciate", "depreciate", undefined, "depreciated", "depreciateFailed"],
    ["handleUndoDepreciation", "rollback-depreciation", { depreciationEntryId: "dep-a" }, "undone", "undoFailed"],
    ["handleRevalue", "revalue", { revaluedAmountMinor: "4000000000000001", date: "2026-10-18", notes: caller }, "revalued", "revalueFailed"],
    ["handleImpair", "impair", { revaluedAmountMinor: "29", date: "2026-10-18" }, "impaired", "impairFailed"],
    ["handleCapitalize", "capitalize", { date: "2026-10-18" }, "capitalized", "capitalizeFailed"],
    ["handleAddCost", "cwip-cost", { amountMinor: "29", date: "2026-10-18", description: caller, sourceAccountId: account.id }, "costAdded", "costFailed"],
    ["handleDispose", "dispose", { disposalAmountMinor: "29", date: "2026-10-18" }, "disposedSuccess", "disposeFailed"],
  ] as const;
  for (const locale of locales) for (const [name, endpoint, payload, success, fallback] of operations) for (const mode of ["success", "forbidden", "network", "html", "alias"]) {
    const t = translator(locale), messages: string[] = [], closed: unknown[] = [], flags: boolean[] = []; let reloads = 0;
    const run = callback(detail, name, { unitPresentation: resolvePresentation({ user: { language: locale } }), t, orgId: "org-a", id: asset.id, asset, fixedAssetJson, fixedAssetFailureMessage, FixedAssetRequestError, assetCentsInput,
      revalueAmount: "40000000000000.01", revalueDate: "2026-10-18", revalueNotes: caller, impairAmount: "0.29", impairDate: "2026-10-18", impairNotes: "", capitalizeDate: "2026-10-18", costAmount: "0.29", costDate: "2026-10-18", costDescription: caller, costSourceAccountId: account.id, disposeAmount: "0.29", disposeDate: "2026-10-18",
      confirm: async (config: Record<string, unknown>) => { assert.equal(config.title, t("undoTitle")); assert.equal(config.confirmLabel, t("undoConfirm")); return true; },
      toast: { success: (v: string) => messages.push(v), error: (v: string) => messages.push(v) }, setBusy: (v: boolean) => flags.push(v),
      setRevalueOpen: (v: boolean) => closed.push(v), setImpairOpen: (v: boolean) => closed.push(v), setCapitalizeOpen: (v: boolean) => closed.push(v), setCostOpen: (v: boolean) => closed.push(v), setDisposeOpen: (v: boolean) => closed.push(v),
      setRevalueAmount: noop, setRevalueNotes: noop, setImpairAmount: noop, setImpairNotes: noop, setCostAmount: noop, setCostDescription: noop, setCostSourceAccountId: noop,
      setAsset: (fn: (prev: typeof asset) => typeof asset) => { const merged = fn(asset); assert.deepEqual(merged.depreciationEntries, asset.depreciationEntries); },
      reloadAsset: async () => { reloads++; }, reloadCwipCosts: async () => { reloads++; },
      fetch: async (url: string, init: RequestInit) => {
        assert.equal(url, `/api/v1/fixed-assets/${asset.id}/${endpoint}`); assert.equal(init.method, "POST"); assert.equal((init.headers as Record<string, string>)["x-organization-id"], "org-a");
        assert.deepEqual(init.body ? JSON.parse(String(init.body)) : undefined, payload);
        if (mode === "network") throw new Error("private prose");
        if (mode === "html") return new Response("private HTML");
        return Response.json({ asset: { ...asset, netBookValueMinor: mode === "alias" ? "01" : asset.netBookValueMinor } }, { status: mode === "forbidden" ? 403 : 200 });
      } });
    await run();
    assert.deepEqual(messages, [t(mode === "success" ? success : mode === "forbidden" ? "forbidden" : fallback)]);
    if (mode !== "success") { assert.deepEqual(closed, []); assert.equal(reloads, 0); }
    if (!["handleDepreciate", "handleDispose"].includes(name)) assert.deepEqual(flags, [true, false]);
  }
});

test("actual creation, batch depreciation and deletion callbacks localize all exits and preserve requests", async () => {
  for (const locale of locales) for (const kind of ["create", "batch", "delete"]) for (const mode of ["success", "forbidden", "network", "html", "shape"]) {
    const t = translator(locale), messages: string[] = [], flags: boolean[] = [], destinations: string[] = []; let closed = 0, reloaded = 0;
    const run = callback(kind === "create" ? drawer : kind === "batch" ? list : detail, kind === "create" ? "handleSubmit" : kind === "batch" ? "handleRunDepreciation" : "handleDelete", { unitPresentation: resolvePresentation({ user: { language: locale } }),
      t, fixedAssetJson, fixedAssetFailureMessage, assetCentsInput, assetLifeInput, name: caller, description: "", assetNumber: "FA-001", purchaseDate: "2026-10-18", purchasePrice: "40000000000000.01", residualValue: "", usefulLifeMonths: "60", depreciationMethod: "declining_balance", assetAccountId: account.id, depreciationAccountId: "", accumulatedDepAccountId: "",
      orgId: "org-a", id: asset.id, localStorage: { getItem: () => "org-a" }, setSaving: (v: boolean) => flags.push(v), setRunningDepreciation: (v: boolean) => flags.push(v),
      onClose: () => { closed++; }, router: { push: (v: string) => destinations.push(v) }, window: { location: { reload: () => { reloaded++; } } },
      confirm: async (config: Record<string, unknown>) => { assert.deepEqual(config, { title: t("deleteTitle"), description: t("deleteDescription"), confirmLabel: t("delete"), destructive: true }); return true; },
      toast: { success: (v: string) => messages.push(v), error: (v: string) => messages.push(v) },
      fetch: async (url: string, init: RequestInit) => {
        assert.equal(url, `/api/v1/fixed-assets${kind === "create" ? "" : kind === "batch" ? "/run-depreciation" : "/asset-a"}`);
        assert.equal(init.method, kind === "delete" ? "DELETE" : "POST"); assert.equal((init.headers as Record<string, string>)["x-organization-id"], "org-a");
        if (kind === "create") assert.deepEqual(JSON.parse(String(init.body)), { name: caller, description: null, assetNumber: "FA-001", purchaseDate: "2026-10-18", purchasePriceMinor: "4000000000000001", residualValueMinor: "0", usefulLifeMonths: 60, depreciationMethod: "declining_balance", assetAccountId: account.id, depreciationAccountId: null, accumulatedDepAccountId: null });
        else assert.equal(init.body, undefined);
        if (mode === "network") throw new Error("private prose"); if (mode === "html") return new Response("private HTML");
        return Response.json(mode === "shape" ? null : kind === "create" ? { asset } : kind === "batch" ? { processed: 2 } : { success: true }, { status: mode === "forbidden" ? 403 : 200 });
      } });
    await run({ preventDefault: noop });
    assert.deepEqual(messages, [mode === "success" ? kind === "create" ? t("created") : kind === "delete" ? t("deleted") : t("runSuccess", { count: 2 }) : t(mode === "forbidden" ? "forbidden" : kind === "create" ? "createFailed" : kind === "delete" ? "deleteFailed" : "runFailed")]);
    if (kind !== "delete") assert.deepEqual(flags, [true, false]);
    assert.equal(closed, kind === "create" && mode === "success" ? 1 : 0); assert.equal(reloaded, kind === "batch" && mode === "success" ? 1 : 0);
    assert.deepEqual(destinations, mode === "success" && kind !== "batch" ? [kind === "create" ? "/accounting/fixed-assets/asset-a" : "/accounting/fixed-assets"] : []);
  }
  const run = callback(drawer, "handleSubmit", { name: "x", assetNumber: "x", purchasePrice: "1", localStorage: { getItem: () => null }, setSaving: () => assert.fail("No org must not start saving") });
  await run({ preventDefault: noop });
});

test("actual validation and cancelled confirmations do not submit or close dialogs", async () => {
  for (const locale of locales) {
    const t = translator(locale);
    for (const [name, changes, key] of [
      ["handleRevalue", { revalueAmount: "1.234" }, "amountInvalid"],
      ["handleImpair", { impairAmount: "90071992547409.92" }, "amountRange"],
      ["handleDispose", { disposeAmount: "-1" }, "amountInvalid"],
      ["handleAddCost", { costAmount: "0" }, "positiveAmount"],
      ["handleAddCost", { costAmount: "1", costSourceAccountId: "" }, "sourceRequired"],
      ["handleSubmit", { usefulLifeMonths: "0" }, "lifeInvalid"],
      ["handleSubmit", { name: "" }, "requiredFields"],
    ] as const) {
      const messages: string[] = [];
      const run = callback(name === "handleSubmit" ? drawer : detail, name, { unitPresentation: resolvePresentation({ user: { language: locale } }), t, orgId: "org-a", fixedAssetFailureMessage, FixedAssetRequestError, assetCentsInput, assetLifeInput,
        localStorage: { getItem: () => "org-a" }, name: "asset", assetNumber: "FA-001", purchaseDate: "2026-10-18", purchasePrice: "1", description: "", residualValue: "", depreciationMethod: "straight_line", assetAccountId: "", depreciationAccountId: "", accumulatedDepAccountId: "", setSaving: noop,
        toast: { error: (value: string) => messages.push(value) }, fetch: () => assert.fail("Invalid inputs must not submit"), ...changes });
      await run({ preventDefault: noop }); assert.deepEqual(messages, [t(key)]);
    }
    for (const name of ["handleDelete", "handleUndoDepreciation"]) await callback(detail, name, { unitPresentation: resolvePresentation({ user: { language: locale } }), t, orgId: "org-a", confirm: async () => false, fetch: () => assert.fail("Cancelled confirmation must not submit") })();
    for (const name of ["handleDepreciate", "handleUndoDepreciation", "handleRevalue", "handleImpair", "handleCapitalize", "handleAddCost", "handleDispose", "handleDelete"]) await callback(detail, name, { orgId: null, fetch: () => assert.fail("No org must not submit") })();
  }
});

test("owned copy has no unexplained display literals and every Persian catalog value contains Persian script", () => {
  const allowed = new Set(["%", "-", "$", "+", "FA-001", "10000.00", "500.00", "60"]);
  for (const path of [list, detail, drawer]) {
    const ast = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(n: ts.Node) {
      if (path === drawer && ts.isFunctionDeclaration(n) && n.parent === ast && n.name?.text !== "FixedAssetDrawer") return;
      if (path === drawer && n.parent === ast && !ts.isFunctionDeclaration(n)) return;
      if (ts.isJsxText(n) && n.text.trim()) assert.ok(allowed.has(n.text.trim()), `${path}: ${n.text.trim()}`);
      if (ts.isJsxAttribute(n) && ["title", "placeholder", "emptyMessage", "aria-label", "alt", "label"].includes(n.name.getText(ast)) && n.initializer && ts.isStringLiteral(n.initializer)) assert.ok(allowed.has(n.initializer.text), n.getText(ast));
      ts.forEachChild(n, visit);
    }
    ts.forEachChild(ast, visit);
  }
  for (const value of Object.values(fa.FixedAssets)) assert.match(value, /[\u0600-\u06ff]/);
  assert.equal(assetPercent(29, 100), 29);
});

function localizedAmount(value: string, locale: "en-US" | "fa-IR") { return (value.startsWith("+") ? "+" : "") + localizedBankMoney(BigInt(value.replace(/[$,+.]/g, "")), "USD", resolvePresentation({ user: { language: locale } })); }

function localizedNumber(value: string, locale: "en-US" | "fa-IR") { return localizedExactDecimal(value.replaceAll(",", ""), resolvePresentation({ user: { language: locale } })); }
