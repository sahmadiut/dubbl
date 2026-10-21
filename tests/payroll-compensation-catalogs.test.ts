import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { createElement, type ComponentType, type ReactNode } from "react";
import * as React from "react";
import * as jsx from "react/jsx-runtime";
import * as nextIntl from "next-intl";
import { createTranslator } from "next-intl";
import ts from "typescript";
import * as BrandLoader from "../components/dashboard/brand-loader";
import { payrollCompensationJson, compensationStatuses } from "../i18n/payroll-compensation-presentation";
import { payrollMoneyDisplay } from "../lib/money/payroll-display";
import { renderWithPresentation } from "./helpers/presentation";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const base = "app/(dashboard)/payroll/";
const page = base + "compensation/page.tsx";
const detailPage = base + "compensation/reviews/[id]/page.tsx";
const locales = ["en-US", "fa-IR"] as const;
const noop = () => {};
const caller = "<script>caller & name</script>";
const escape = (v: string) => v.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
const translator = (locale: typeof locales[number]) => createTranslator({ locale, messages: locale === "en-US" ? en : fa, namespace: "PayrollCompensation" });
type Capture = { kind: string; props: Record<string, unknown> };
type Harness = { captured: Capture[]; events: unknown[]; effects: (() => void | (() => void))[]; refs: Record<string, { current: unknown }> };

// Real production templates and next-intl; hook/IO state and portals are controlled.
function render(file: string, states: Record<string, unknown> = {}, locale: typeof locales[number] = "en-US") {
  const ast = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declaration = ast.statements.find((n): n is ts.FunctionDeclaration => ts.isFunctionDeclaration(n) && !!n.modifiers?.some(m => m.kind === ts.SyntaxKind.DefaultKeyword))!;
  const name = declaration.name!.text;
  const owner = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name)!;
  const names: string[] = [];
  const refNames: string[] = [];
  function hooks(n: ts.Node) {
    if (ts.isVariableDeclaration(n) && ts.isArrayBindingPattern(n.name) && n.initializer && ts.isCallExpression(n.initializer) && n.initializer.expression.getText(ast) === "useState") names.push(n.name.elements[0].getText(ast));
    if (ts.isVariableDeclaration(n) && n.initializer && ts.isCallExpression(n.initializer) && n.initializer.expression.getText(ast) === "useRef") refNames.push(n.name.getText(ast));
    ts.forEachChild(n, hooks);
  }
  hooks(owner);
  const source = ast.text + `\nexport { ${name} };`;
  const h: Harness = { captured: [], events: [], effects: [], refs: {} };
  const capture = (factory: typeof jsx.jsx) => (kind: unknown, props: Record<string, unknown>, key: string) => {
    h.captured.push({ kind: typeof kind === "string" ? kind : (kind as { name?: string })?.name ?? "", props });
    return factory(kind as Parameters<typeof jsx.jsx>[0], props, key);
  };
  const inline = (kind: string) => function Inline(props: Record<string, unknown>) {
    h.captured.push({ kind, props });
    return createElement("div", { "data-control": kind }, props.children as ReactNode,
      typeof props.placeholder === "string" ? createElement("span", null, props.placeholder) : null);
  };
  let index = 0;
  let refIndex = 0;
  const require = createRequire(resolve(file)), compiled = { exports: {} as Record<string, ComponentType<Record<string, unknown>>> };
  const load = (id: string): unknown => {
    if (id === "react") return { ...React, useState: (initial: unknown) => {
      const key = names[index++]; return [Object.hasOwn(states, key) ? states[key] : initial, (v: unknown) => h.events.push([key, v])];
    }, useEffect: (fn: () => void | (() => void)) => h.effects.push(fn), useMemo: (fn: () => unknown) => fn(), useCallback: (fn: unknown) => fn,
    useRef: (initial: unknown) => h.refs[refNames[refIndex++]] = { current: initial } };
    if (id === "react/jsx-runtime") return { ...jsx, jsx: capture(jsx.jsx), jsxs: capture(jsx.jsxs) };
    if (id === "next-intl") return nextIntl;
    if (id === "sonner") return { toast: { error: (v: unknown) => h.events.push(["error", v]), success: (v: unknown) => h.events.push(["success", v]) } };
    if (id === "next/navigation") return { useRouter: () => ({ push: (v: unknown) => h.events.push(["navigate", v]) }), useParams: () => ({ id: "review-a" }) };
    if (id.endsWith("/topbar")) return { useTopbarAction: noop };
    if (id.endsWith("/use-debounce")) return { useDebounce: (v: string) => states.debouncedSearch ?? v };
    if (id.endsWith("/use-document-title")) return { useDocumentTitle: (v: string) => h.events.push(["title", v]) };
    if (id.endsWith("/use-confirm")) return { useConfirm: () => ({ dialog: null, confirm: async (v: unknown) => { h.events.push(["confirm", v]); return states.confirmed !== false; } }) };
    if (id.endsWith("/brand-loader")) return BrandLoader;
    for (const [suffix, names] of Object.entries({ "/ui/dialog": ["Dialog", "DialogContent", "DialogHeader", "DialogTitle", "DialogDescription", "DialogFooter"], "/ui/select": ["Select", "SelectContent", "SelectItem", "SelectTrigger", "SelectValue"], "/ui/tabs": ["Tabs", "TabsList", "TabsTrigger"], "/ui/sheet": ["Sheet", "SheetContent", "SheetHeader", "SheetTitle", "SheetDescription"], "/ui/date-picker": ["DatePicker"], "/ui/currency-select": ["CurrencySelect"] }))
      if (id.endsWith(suffix)) return Object.fromEntries(names.map(key => [key, inline(key)]));
    return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  };
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function("require", "module", "exports", code)(load, compiled, compiled.exports);
  const html = renderWithPresentation(createElement(compiled.exports[name]), locale);
  return { ...h, html };
}
const flush = async () => { for (let i = 0; i < 6; i++) await new Promise(resolve => setImmediate(resolve)); };
const money = (key: string, amount: number | null) => ({ [key]: amount, [key + "Minor"]: amount === null ? null : String(amount) });
const band = { id: "band-a", name: caller, level: "L3", currency: "KWD", ...money("minSalary", 29), ...money("midSalary", 3000000000), ...money("maxSalary", Number.MAX_SAFE_INTEGER) };
const review = { id: "review-a", name: caller, effectiveDate: "2026-10-21", status: "draft", currency: "KWD", ...money("totalBudget", 29), _count: { entries: 1 } };
const entry = { id: "entry-a", ...money("currentSalary", 29), ...money("proposedSalary", 28), reason: caller, approved: null, adjustmentPercent: Math.fround(-0.29), employee: { name: caller, employeeNumber: "EMP-001" } };
const detail = { ...review, entries: [entry], totals: { ...money("currentSalary", 29), ...money("proposedSalary", 28), ...money("difference", -1) } };
const bodies = { bands: { data: [band] }, reviews: { data: [review], currency: "KWD" }, band: { band }, review: { review }, detail: { review: detail } };
const loaded = { loading: false, bands: [band], reviews: [review] };
const newBand = { name: caller, level: "L3", minSalary: "0.29", midSalary: "30000000.00", maxSalary: "90071992547409.91", currency: "KWD" };
const newReview = { name: caller, effectiveDate: "2026-10-21", totalBudget: "0.29", currency: "KWD" };
const has = (h: Harness, key: string, value: unknown) => h.events.some(v => JSON.stringify(v) === JSON.stringify([key, value]));
async function withIO(fetcher: typeof fetch, run: () => Promise<void>, org: string | null = "org-a", storageThrows = false) {
  const original = globalThis.fetch, storage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  globalThis.fetch = fetcher;
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: (key: string) => {
    assert.equal(key, "activeOrgId"); if (storageThrows) throw new Error("Private storage"); return org;
  } } });
  try { await run(); } finally {
    globalThis.fetch = original;
    if (storage) Object.defineProperty(globalThis, "localStorage", storage); else Reflect.deleteProperty(globalThis, "localStorage");
  }
}
function response(url: string | URL | Request) {
  return Response.json(String(url).endsWith("/bands") ? bodies.bands : String(url).endsWith("/reviews") ? bodies.reviews : bodies.detail);
}
function submit(h: ReturnType<typeof render>, index: number) {
  const form = h.captured.filter(c => c.kind === "form")[index]; assert.ok(form);
  return (form.props.onSubmit as (e: { preventDefault(): void }) => Promise<void>)({ preventDefault: noop });
}

test("compensation production JSX renders both catalogs, exact cents, escaped data and finite status labels", () => {
  for (const locale of locales) {
    const t = translator(locale), h = render(page, loaded, locale);
    assert.ok(has(h, "title", t("documentTitle")));
    for (const key of ["totalBands", "activeReviews", "avgWidth", "totalEntries", "bandsTitle", "reviewsTitle", "bandSheetTitle", "reviewSheetTitle", "searchBands", "searchReviews", "namePlaceholder", "levelPlaceholder", "reviewPlaceholder", "optional", "minSalary", "midSalary", "maxSalary"] as const) assert.ok(h.html.includes(escape(t(key))), key);
    assert.ok(h.html.includes(escape(caller))); assert.ok(!h.html.includes("<script>"));
    assert.ok(h.html.includes(escape(payrollMoneyDisplay(Number.MAX_SAFE_INTEGER, "KWD"))));
    assert.ok(h.html.includes(escape(t("effective", { date: "2026-10-21" }))));
    const sorts = h.captured.filter(c => c.kind === "SelectItem");
    assert.deepEqual(sorts.map(c => c.props.value), ["name:asc", "name:desc", "min:asc", "max:desc", "date:desc", "date:asc", "name:asc", "budget:desc", "budget:asc"]);
    assert.deepEqual(sorts.map(c => c.props.children), ["nameAsc", "nameDesc", "minSort", "maxSort", "newest", "oldest", "nameAsc", "budgetHigh", "budgetLow"].map(k => t(k as "nameAsc")));
    for (const status of compensationStatuses) {
      assert.ok(render(page, { ...loaded, reviews: [{ ...review, status }] }, locale).html.includes(escape(t(`status_${status}`))));
      assert.ok(render(detailPage, { loading: false, review: { ...detail, status } }, locale).html.includes(escape(t(`status_${status}`))));
    }
    const d = render(detailPage, { loading: false, review: detail }, locale);
    assert.ok(has(d, "title", t("detailDocumentTitle")));
    for (const key of ["currentTotal", "proposedTotal", "totalIncrease", "current", "proposed", "backToCompensation"] as const) assert.ok(d.html.includes(escape(t(key))), key);
    assert.ok(d.html.includes(escape(payrollMoneyDisplay(-1, "KWD"))));
    assert.ok(d.html.includes(escape(t("adjustment", { percent: "-0.3" }))));
    assert.ok(d.html.includes(escape(caller))); assert.ok(!d.html.includes("<script>"));
    const empty = render(page, { loading: false }, locale);
    for (const key of ["management", "managementDescription", "firstBand", "startReview"] as const) assert.ok(empty.html.includes(escape(t(key))));
    const missing = render(detailPage, { loading: false }, locale);
    assert.ok(missing.html.includes(escape(t("notFound"))));
    (missing.captured.find(c => c.kind === "button")!.props.onClick as () => void)();
    assert.ok(has(missing, "navigate", "/payroll/compensation"));
    const noEntries = { ...detail, entries: [], _count: { entries: 0 }, totals: { ...money("currentSalary", 0), ...money("proposedSalary", 0), ...money("difference", 0) } };
    assert.ok(render(detailPage, { loading: false, review: noEntries }, locale).html.includes(escape(t("noEntries"))));
    assert.ok(render(detailPage, { loading: false, review: { ...detail, entries: [{ ...entry, employee: null, reason: null, adjustmentPercent: null }] } }, locale).html.includes(escape(t("unknown"))));
    assert.ok(render(page, { ...loaded, bands: [band, { ...band, id: "band-b", currency: "JPY" }] }, locale).html.includes(escape(t("multipleCurrencies"))));
    assert.ok(render(page, { ...loaded, bandSaving: true, reviewSaving: true }, locale).html.includes(escape(t("creating"))));
    assert.ok(render(page, { ...loaded, moneyError: t("loadFailed") }, locale).html.includes('role="alert"'));
    assert.ok(!render(page, {}, locale).html.includes(escape(t("management"))));
  }
});

test("search, sort, filter, navigation and form callbacks retain machine values", () => {
  for (const locale of locales) {
    const t = translator(locale), h = render(page, { ...loaded, bandSearch: "unmatched", reviewSearch: "unmatched" }, locale);
    assert.ok(h.html.includes(escape(t("noBandMatches")))); assert.ok(h.html.includes(escape(t("noReviewMatches"))));
    for (const c of h.captured.filter(c => c.kind === "Select")) (c.props.onValueChange as (v: string) => void)("name:desc");
    assert.ok(has(h, "bandSort", "name:desc")); assert.ok(has(h, "reviewSort", "name:desc"));
    (h.captured.find(c => c.kind === "Tabs")!.props.onValueChange as (v: string) => void)("completed");
    assert.ok(has(h, "reviewFilter", "completed"));
    for (const key of ["clearBandSearch", "clearReviewSearch"] as const) (h.captured.find(c => c.props["aria-label"] === t(key))!.props.onClick as () => void)();
    assert.ok(has(h, "bandSearch", "")); assert.ok(has(h, "reviewSearch", ""));
    const rows = render(page, loaded, locale);
    const link = rows.captured.find(c => c.kind === "button" && c.props.className?.toString().includes("first:rounded"))!;
    (link.props.onClick as () => void)(); assert.ok(has(rows, "navigate", "/payroll/compensation/reviews/review-a"));
    const edits = render(page, { ...loaded, newBand, newReview }, locale);
    const nameInputs = edits.captured.filter(c => c.kind === "Input" && c.props.name === "name");
    assert.equal(nameInputs.length, 2);
    for (const c of nameInputs) (c.props.onChange as (e: { target: { value: string } }) => void)({ target: { value: "Edited" } });
    assert.ok(has(edits, "newBand", { ...newBand, name: "Edited" })); assert.ok(has(edits, "newReview", { ...newReview, name: "Edited" }));
    const sorted = render(page, { loading: false, bands: [{ ...band, id: "z", name: "Z" }, { ...band, id: "a", name: "A" }], reviews: [review], bandSort: "name:asc" }, locale);
    assert.ok(sorted.html.indexOf('>A<') < sorted.html.indexOf('>Z<'));
    const filtered = render(page, { ...loaded, reviewFilter: "completed" }, locale);
    assert.ok(filtered.html.includes(escape(t("noReviewMatches"))));
  }
});

test("checked compensation envelopes reject bad fields, dates, money aliases, counts, totals and identities", async () => {
  for (const kind of ["bands", "reviews", "band", "review", "detail"] as const) {
    assert.deepEqual(await payrollCompensationJson(Response.json(bodies[kind]), kind), bodies[kind]);
    await assert.rejects(payrollCompensationJson(Response.json(bodies[kind], { status: 403 }), kind));
    await assert.rejects(payrollCompensationJson(new Response("Private parser"), kind));
    for (const body of [null, [], { success: true }]) await assert.rejects(payrollCompensationJson(Response.json(body), kind));
  }
  const badReviews = [
    { ...review, status: "Private status" }, { ...review, effectiveDate: "2026-02-30" }, { ...review, effectiveDate: "0000-01-01" },
    { ...review, currency: "usd" }, { ...review, totalBudgetMinor: "028" }, { ...review, totalBudget: undefined },
    { ...review, _count: { entries: -1 } }, { ...review, name: null }, { ...review, id: "" },
  ];
  for (const r of badReviews) await assert.rejects(payrollCompensationJson(Response.json({ data: [r], currency: "KWD" }), "reviews"));
  for (const b of [{ ...band, maxSalaryMinor: "1" }, { ...band, minSalary: 1.2 }, { ...band, midSalary: 0, midSalaryMinor: "0" }, { ...band, level: 1 }, { ...band, currency: "unknown" }]) await assert.rejects(payrollCompensationJson(Response.json({ band: b }), "band"));
  await assert.rejects(payrollCompensationJson(Response.json({ data: [band, band] }), "bands"));
  await assert.rejects(payrollCompensationJson(Response.json({ data: [review, review], currency: "KWD" }), "reviews"));
  await assert.rejects(payrollCompensationJson(Response.json(bodies.detail), "detail", "wrong-id"));
  const badDetails = [
    { ...detail, entries: [entry, entry] }, { ...detail, entries: null }, { ...detail, totals: { ...detail.totals, difference: 0, differenceMinor: "0" } },
    { ...detail, _count: { entries: 0 } }, ...[
      { ...entry, currentSalary: null, currentSalaryMinor: null }, { ...entry, proposedSalaryMinor: "29" }, { ...entry, reason: 1 },
      { ...entry, approved: "yes" }, { ...entry, adjustmentPercent: 0.29 }, { ...entry, adjustmentPercent: -101 },
      { ...entry, employee: { name: null, employeeNumber: "001" } },
    ].map(e => ({ ...detail, entries: [e] })),
  ];
  for (const r of badDetails) await assert.rejects(payrollCompensationJson(Response.json({ review: r }), "detail"));
  await payrollCompensationJson(Response.json({ review: { ...review, ...money("totalBudget", null) } }), "review");
});

test("list and detail effects check reads atomically, localize failures and release missing organization/storage", async () => {
  for (const locale of locales) for (const file of [page, detailPage]) for (const mode of ["ok", "network", "http", "json", "envelope", "money", "no-org", "storage", "not-found"]) {
    let calls = 0;
    await withIO(async (url, init) => {
      calls++; assert.deepEqual(init?.headers, { "x-organization-id": "org-a" });
      assert.ok(file === page ? ["/api/v1/payroll/compensation/bands", "/api/v1/payroll/compensation/reviews"].includes(String(url)) : String(url) === "/api/v1/payroll/compensation/reviews/review-a");
      if (mode === "network") throw new Error("Private network");
      if (mode === "http") return Response.json({ error: "Private server" }, { status: 403 });
      if (mode === "json") return new Response("Private parser");
      if (mode === "envelope") return Response.json({ success: true });
      if (mode === "not-found") return Response.json({ error: "Private missing" }, { status: 404 });
      if (mode === "money") return Response.json(String(url).endsWith("/bands") ? { data: [{ ...band, minSalaryMinor: "28" }] } : file === detailPage ? { review: { ...detail, totalBudgetMinor: "28" } } : bodies.reviews);
      return response(url);
    }, async () => {
      const h = render(file, {}, locale), t = translator(locale); h.effects[0](); await flush();
      assert.equal(calls, ["no-org", "storage"].includes(mode) ? 0 : file === page ? 2 : 1);
      assert.ok(has(h, "loading", false));
      if (mode === "ok") {
        assert.ok(has(h, "moneyError", null));
        assert.ok(has(h, file === page ? "bands" : "review", file === page ? [band] : detail));
        if (file === page) assert.ok(has(h, "reviews", [review]));
      } else if (file === detailPage && mode === "not-found") { assert.ok(has(h, "review", null)); assert.ok(has(h, "moneyError", null)); }
      else {
        assert.ok(has(h, "moneyError", t(["no-org", "storage"].includes(mode) ? "organizationRequired" : "loadFailed")));
        assert.ok(!h.events.some(v => Array.isArray(v) && ["bands", "reviews", "review", "newReview"].includes(v[0])));
      }
      assert.ok(!JSON.stringify(h.events).includes("Private"));
    }, mode === "no-org" ? null : "org-a", mode === "storage");
  }
});

test("effect cleanup ignores obsolete fulfillment and rejection", async () => {
  for (const file of [page, detailPage]) for (const reject of [false, true]) {
    const pending: { resolve: (r: Response) => void; reject: (e: Error) => void; url: string | URL | Request }[] = [];
    await withIO((url) => new Promise((resolve, reject) => pending.push({ resolve, reject, url })), async () => {
      const h = render(file), cleanup = h.effects[0](); assert.equal(typeof cleanup, "function");
      (cleanup as () => void)(); const before = h.events.length;
      for (const p of pending) { if (reject) p.reject(new Error("Private obsolete")); else p.resolve(response(p.url)); }
      await flush(); assert.equal(h.events.length, before);
    });
  }
});

test("band and review creation preserve exact payloads, optional omission and failure-retained fields", async () => {
  for (const locale of locales) for (const kind of ["band", "review"] as const) for (const mode of ["ok", "network", "http", "json", "envelope", "money", "invalid-input", "no-org", "storage", "refresh-failed"]) {
    let writes = 0, reads = 0;
    await withIO(async (url, init) => {
      if (init?.method !== "POST") { reads++; if (mode === "refresh-failed") throw new Error("Private refresh"); return response(url); }
      writes++; assert.equal(url, `/api/v1/payroll/compensation/${kind === "band" ? "bands" : "reviews"}`);
      assert.deepEqual(init.headers, { "Content-Type": "application/json", "x-organization-id": "org-a" });
      assert.deepEqual(JSON.parse(String(init.body)), kind === "band" ? { name: caller, level: "L3", currency: "KWD", minSalaryMinor: "29", midSalaryMinor: "3000000000", maxSalaryMinor: "9007199254740991" } : { name: caller, effectiveDate: "2026-10-21", totalBudgetMinor: "29" });
      if (mode === "network") throw new Error("Private network");
      if (mode === "http") return Response.json({ error: "Private server" }, { status: 422 });
      if (mode === "json") return new Response("Private parser");
      if (mode === "envelope") return Response.json({ success: true });
      if (mode === "money") return Response.json(kind === "band" ? { band: { ...band, midSalaryMinor: "28" } } : { review: { ...review, totalBudgetMinor: "28" } });
      return Response.json(bodies[kind], { status: 201 });
    }, async () => {
      const h = render(page, { ...loaded, newBand: mode === "invalid-input" ? { ...newBand, minSalary: "1.001" } : newBand, newReview: mode === "invalid-input" ? { ...newReview, totalBudget: "1.001" } : newReview }, locale);
      await submit(h, kind === "band" ? 0 : 1); await flush(); const t = translator(locale);
      const ok = ["ok", "refresh-failed"].includes(mode), noWrite = ["no-org", "storage", "invalid-input"].includes(mode);
      assert.equal(writes, noWrite ? 0 : 1); assert.equal(reads, ok ? 2 : 0);
      assert.ok(has(h, ok ? "success" : "error", t(ok ? kind === "band" ? "bandAdded" : "reviewCreated" : ["no-org", "storage"].includes(mode) ? "organizationRequired" : kind === "band" ? "bandFailed" : "reviewFailed")));
      if (!["no-org", "storage"].includes(mode)) { assert.ok(has(h, kind + "Saving", true)); assert.ok(has(h, kind + "Saving", false)); }
      if (!ok) assert.ok(!h.events.some(v => Array.isArray(v) && ["newBand", "newReview", "bandSheet", "reviewSheet", "success"].includes(v[0])));
      if (ok) assert.ok(has(h, kind + "Sheet", false));
      assert.ok(!JSON.stringify(h.events).includes("Private"));
    }, mode === "no-org" ? null : "org-a", mode === "storage");
  }
  for (const kind of ["band", "review"] as const) await withIO(async (_url, init) => {
    if (init?.method !== "POST") return response(_url);
    assert.deepEqual(JSON.parse(String(init.body)), kind === "band" ? { name: caller, currency: "KWD", minSalaryMinor: "0", midSalaryMinor: "0", maxSalaryMinor: "0" } : { name: caller, effectiveDate: "2026-10-21" });
    return Response.json(bodies[kind]);
  }, async () => {
    const h = render(page, { ...loaded, newBand: { ...newBand, level: "", minSalary: "", midSalary: "", maxSalary: "" }, newReview: { ...newReview, totalBudget: "" } });
    await submit(h, kind === "band" ? 0 : 1); await flush();
  });
});

test("owned JSX/attributes are cataloged with Persian prose and an explicit symbol-only exception", () => {
  for (const file of [page, detailPage]) {
    const ast = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function inspect(node: ts.Node) {
      if (ts.isJsxText(node)) assert.doesNotMatch(node.text, /[A-Za-z]/, `${file}: ${node.text}`);
      if (ts.isJsxAttribute(node) && ["placeholder", "title", "aria-label"].includes(node.name.getText(ast)) && node.initializer && ts.isStringLiteral(node.initializer)) assert.fail(`${file}: raw ${node.name.getText(ast)}`);
      ts.forEachChild(node, inspect);
    }
    inspect(ast);
    assert.doesNotMatch(ast.text, /toast\.error\([^\n]*(?:\.error|\.message)|\.status\.replace/);
  }
  assert.deepEqual(Object.keys(en.PayrollCompensation).sort(), Object.keys(fa.PayrollCompensation).sort());
  assert.equal(Object.keys(en.PayrollCompensation).length, 82);
  for (const [key, value] of Object.entries(fa.PayrollCompensation)) {
    if (key === "adjustment") assert.equal(value, "+{percent}٪");
    else assert.match(value, /[\u0621-\u063a\u0641-\u064a\u067e\u0686\u0698\u06a9\u06af\u06cc]/, key);
  }
});
