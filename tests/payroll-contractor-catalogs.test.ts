import { formatDecimalDraft } from "../i18n/numbers";
import { resolvePresentation } from "../i18n/locale";
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
import { payrollContractorJson } from "../i18n/payroll-contractor-presentation";
import { payrollMoneyDisplay } from "../lib/money/payroll-display";
import { renderWithPresentation } from "./helpers/presentation";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const page = "app/(dashboard)/payroll/contractors/page.tsx";
const detailPage = "app/(dashboard)/payroll/contractors/[id]/page.tsx";
const drawer = "components/dashboard/create-drawer.tsx";
const locales = ["en-US", "fa-IR"] as const;
const noop = () => {};
const caller = "<script>caller & name</script>";
const escape = (v: string) => v.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
const translator = (locale: typeof locales[number]) => createTranslator({ locale, messages: locale === "en-US" ? en : fa, namespace: "PayrollContractors" });
type Capture = { kind: string; props: Record<string, unknown> };
type Harness = { captured: Capture[]; events: unknown[]; effects: (() => void | (() => void))[]; refs: Record<string, { current: unknown }> };

// Real production templates, next-intl, footer, money inputs and controls.
// Hook/IO state and portal/date/currency-picker boundaries are controlled.
function render(file: string, states: Record<string, unknown> = {}, locale: typeof locales[number] = "en-US") {
  const ast = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const name = file === page ? "ContractorsPage" : file === detailPage ? "ContractorDetailPage" : "ContractorDrawer";
  const owner = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name)!;
  const names: string[] = [];
  const refNames: string[] = [];
  function hooks(n: ts.Node) {
    if (ts.isVariableDeclaration(n) && ts.isArrayBindingPattern(n.name) && n.initializer && ts.isCallExpression(n.initializer) && n.initializer.expression.getText(ast) === "useState") names.push(n.name.elements[0].getText(ast));
    if (ts.isVariableDeclaration(n) && n.initializer && ts.isCallExpression(n.initializer) && n.initializer.expression.getText(ast) === "useRef") refNames.push(n.name.getText(ast));
    ts.forEachChild(n, hooks);
  }
  hooks(owner);
  let source = ast.text;
  if (file === drawer) {
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
    }).join("\n");
  }
  source += `\nexport { ${name} };`;
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
    if (id === "next/navigation") return { useParams: () => ({ id: "contractor-a" }), useRouter: () => ({ push: (v: string) => h.events.push(["push", v]) }) };
    if (id.endsWith("/create-drawer")) return { useCreateDrawer: () => ({ open: (v: string) => h.events.push(["drawer", v]) }) };
    if (id.endsWith("/use-debounce")) return { useDebounce: (v: string) => states.debouncedSearch ?? v };
    if (id.endsWith("/use-document-title")) return { useDocumentTitle: (v: string) => h.events.push(["title", v]) };
    if (id.endsWith("/use-confirm")) return { useConfirm: () => ({ dialog: null, confirm: async (v: unknown) => { h.events.push(["confirm", v]); return states.confirmed !== false; } }) };
    if (id.endsWith("/brand-loader")) return BrandLoader;
    for (const [suffix, names] of Object.entries({ "/ui/select": ["Select", "SelectContent", "SelectItem", "SelectTrigger", "SelectValue"], "/ui/tabs": ["Tabs", "TabsList", "TabsTrigger"], "/ui/sheet": ["Sheet", "SheetContent", "SheetHeader", "SheetTitle", "SheetDescription"], "/ui/date-picker": ["DatePicker"], "/ui/currency-select": ["CurrencySelect"] }))
      if (id.endsWith(suffix)) return Object.fromEntries(names.map(key => [key, inline(key)]));
    return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  };
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function("require", "module", "exports", code)(load, compiled, compiled.exports);
  const html = renderWithPresentation(createElement(compiled.exports[name], { open: true, onClose: () => h.events.push(["close"]) }), locale);
  return { ...h, html };
}
const control = (h: Harness, kind: string) => h.captured.find(c => c.kind === kind)!.props;
const flush = async () => { for (let i = 0; i < 6; i++) await new Promise(resolve => setImmediate(resolve)); };
const contractor = { id: "contractor-a", name: caller, email: "caller@example.test", company: "External Company", taxId: null,
  bankAccountNumber: "001234", hourlyRate: Number.MAX_SAFE_INTEGER, hourlyRateMinor: "9007199254740991", currency: "KWD", isActive: true, createdAt: "2026-10-21T00:00:00.000Z" };
const payment = { id: "payment-a", amount: 29, amountMinor: "29", currency: "JPY", description: caller, invoiceNumber: "INV-001", status: "pending", paidAt: null };
const detail = { ...contractor, payments: [payment, { ...payment, id: "paid-a", status: "paid" }, { ...payment, id: "void-a", status: "void" }] };
const pagination = { total: 1, page: 1, limit: 50, totalPages: 1 };
const form = { cName: caller, cEmail: "", cCompany: "", cRate: "90071992547409.91", cCurrency: "KWD" };
const edit = { loading: false, contractor: detail, name: caller, email: "", company: "", hourlyRate: "0.29", bankAccount: "001234",
  paymentAmount: "90071992547409.91", paymentCurrency: "JPY", paymentDesc: "", paymentInvoice: "" };
const has = (h: Harness, key: string, value: unknown) => h.events.some(v => JSON.stringify(v) === JSON.stringify([key, value]));
const action = (h: Harness, label: string) => {
  const c = h.captured.find(c => c.kind === "Button" && (c.props.children === label || Array.isArray(c.props.children) && c.props.children.includes(label)));
  assert.ok(c, label); return c.props.onClick as () => Promise<void>;
};
const submit = (h: Harness) => (control(h, "form").onSubmit as (e: { preventDefault: () => void }) => Promise<void>)({ preventDefault: noop });
async function withIO(fetcher: typeof fetch, run: () => Promise<void>, org: string | null = "org-a", storageThrows = false) {
  const original = globalThis.fetch, storage = Object.getOwnPropertyDescriptor(globalThis, "localStorage"), win = Object.getOwnPropertyDescriptor(globalThis, "window");
  globalThis.fetch = fetcher;
  Object.defineProperty(globalThis, "window", { configurable: true, value: {} });
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: (key: string) => {
    assert.equal(key, "activeOrgId"); if (storageThrows) throw new Error("Private storage error"); return org;
  } } });
  try { await run(); } finally {
    globalThis.fetch = original;
    for (const [key, d] of [["localStorage", storage], ["window", win]] as const)
      if (d) Object.defineProperty(globalThis, key, d); else Reflect.deleteProperty(globalThis, key);
  }
}

test("contractor list renders bilingual controls, plural counts, exact cents and escaped data", () => {
  for (const locale of locales) for (const currency of ["USD", "JPY", "KWD", null]) for (const hourlyRate of [0, 29, Number.MAX_SAFE_INTEGER]) {
    const h = render(page, { initialLoad: false, contractors: [{ ...contractor, currency, hourlyRate }], totalCount: 1 }, locale), t = translator(locale);
    for (const key of ["activeContractors", "inactive", "totalContractors", "all", "active", "search", "sortBy", "newest", "oldest", "nameAsc", "nameDesc", "highestRate", "lowestRate"] as const) assert.ok(h.html.includes(escape(t(key))), key);
    assert.ok(h.html.includes(escape(caller)) && !h.html.includes("<script>"));
    assert.ok(h.html.includes(escape(t("hourly", { amount: payrollMoneyDisplay(hourlyRate, currency ?? "USD", resolvePresentation({ user: { language: locale } })) }))));
    assert.ok(h.html.includes(escape(t("showing", { loaded: 1, total: 1 }))));
    assert.deepEqual(h.captured.filter(c => c.kind === "SelectItem").map(c => c.props.value), ["created:desc", "created:asc", "name:asc", "name:desc", "rate:desc", "rate:asc"]);
    assert.deepEqual(h.captured.filter(c => c.kind === "TabsTrigger").map(c => c.props.value), ["all", "active", "inactive"]);
    const row = h.captured.find(c => c.kind === "button" && c.props.className?.toString().includes("w-full flex"))!;
    (row.props.onClick as () => void)(); assert.ok(has(h, "push", "/payroll/contractors/contractor-a"));
    (control(h, "Tabs").onValueChange as (v: string) => void)("inactive"); assert.ok(has(h, "statusFilter", "inactive"));
    (control(h, "Select").onValueChange as (v: string) => void)("rate:asc"); assert.ok(has(h, "sortValue", "rate:asc"));
  }
  const t = translator("en-US");
  assert.equal(t("showing", { loaded: 2, total: 2 }), "Showing 2 of 2 contractors");
});

test("contractor list empty, search, filter, loading and finite error states stay distinct", () => {
  for (const locale of locales) {
    const t = translator(locale), empty = render(page, { initialLoad: false }, locale);
    for (const key of ["emptyTitle", "emptyHelp", "addFirst"] as const) assert.ok(empty.html.includes(escape(t(key))));
    action(empty, t("addFirst"))(); assert.ok(has(empty, "drawer", "contractor"));
    for (const [state, key] of [[{ search: "absent" }, "trySearch"], [{ statusFilter: "inactive" }, "noFilterMatches"]] as const) {
      const h = render(page, { initialLoad: false, ...state }, locale);
      assert.ok(h.html.includes(escape(t("notFoundList"))) && h.html.includes(escape(t(key))));
    }
    for (const moneyError of ["readFailed", "organizationRequired"]) assert.ok(render(page, { initialLoad: false, moneyError }, locale).html.includes(escape(t(moneyError as "readFailed"))));
    for (const state of [{}, { initialLoad: false, refetching: true }, { initialLoad: false, search: "new", debouncedSearch: "old" }]) {
      const h = render(page, { contractors: [contractor], ...state }, locale);
      assert.ok(h.html.includes("brand-loader") && !h.html.includes(escape(caller)));
    }
    for (const search of ["caller", "external", "example.test"]) assert.ok(render(page, { initialLoad: false, contractors: [contractor], totalCount: 1, search }, locale).html.includes(escape(caller)));
  }
  const second = { ...contractor, id: "b", name: "Zed", hourlyRate: 0, createdAt: "2025-01-01" };
  for (const sortValue of ["name:asc", "name:desc", "rate:asc", "rate:desc", "created:asc", "created:desc"]) {
    const h = render(page, { initialLoad: false, contractors: [contractor, second], totalCount: 2, sortValue });
    const first = sortValue === "name:asc" || sortValue === "rate:desc" || sortValue === "created:desc";
    assert.equal(h.html.indexOf(escape(caller)) < h.html.indexOf("Zed"), first);
  }
});

test("contractor detail and drawer render bilingual labels, statuses and canonical controls", () => {
  for (const locale of locales) {
    const t = translator(locale), h = render(detailPage, edit, locale);
    for (const key of ["back", "details", "detailsHelp", "name", "email", "company", "hourlyRate", "bankAccount", "delete", "save", "payments", "paymentsHelp", "amount", "currency", "description", "invoice", "addPayment", "pending", "paid", "void", "process"] as const) assert.ok(h.html.includes(escape(t(key))), key);
    assert.ok(h.html.includes(escape(caller)) && !h.html.includes("<script>"));
    assert.ok(h.html.includes(escape(payrollMoneyDisplay(29, "JPY", resolvePresentation({ user: { language: locale } })))));
    assert.equal(control(h, "CurrencySelect").value, "JPY");
    for (const saving of [false, true]) {
      const d = render(drawer, { ...form, saving }, locale);
      for (const key of ["newContractor", "drawerHelp", "info", "nameRequired", "email", "company", "defaultRate", "currency", "nameExample", "companyExample", saving ? "adding" : "addContractor"] as const) assert.ok(d.html.includes(escape(t(key))), key);
      assert.ok(d.html.includes("jane@example.com"));
      assert.equal(control(d, "CurrencySelect").value, "KWD");
      assert.ok(d.html.includes(formatDecimalDraft("150.00", resolvePresentation({ user: { language: locale } }))));
      assert.ok(d.html.includes(formatDecimalDraft("90071992547409.91", resolvePresentation({ user: { language: locale } }))));
    }
    assert.ok(render(detailPage, { loading: false }, locale).html.includes(escape(t("notFound"))));
    assert.ok(render(detailPage, { ...edit, contractor: { ...detail, payments: [] } }, locale).html.includes(escape(t("noPayments"))));
  }
});

test("checked contractor envelopes reject malformed fields, enums, money and pagination", async () => {
  assert.deepEqual(await payrollContractorJson(Response.json({ contractor: detail }), "detail"), { contractor: detail });
  assert.deepEqual(await payrollContractorJson(Response.json({ data: [contractor], pagination }), "list"), { data: [contractor], pagination });
  assert.deepEqual(await payrollContractorJson(Response.json({ contractor: { id: "a" } }), "created"), { contractor: { id: "a" } });
  for (const patch of [{ name: null }, { email: 2 }, { isActive: "true" }, { currency: "usd" }, { hourlyRateMinor: "29" }, { hourlyRate: undefined }, { hourlyRateMinor: undefined }, { hourlyRate: -1, hourlyRateMinor: "-1" }])
    await assert.rejects(payrollContractorJson(Response.json({ contractor: { ...detail, ...patch } }), "detail"));
  for (const patch of [{ status: "private-status" }, { amount: 0, amountMinor: "0" }, { amountMinor: undefined }, { amountMinor: "029" }, { currency: undefined }])
    await assert.rejects(payrollContractorJson(Response.json({ payment: { ...payment, ...patch } }), "payment"));
  for (const body of [{ data: [contractor] }, { data: [contractor], pagination: { ...pagination, total: -1 } }, { data: [contractor], pagination: { ...pagination, page: 0 } }, { data: [contractor], pagination: { ...pagination, totalPages: 7 } }])
    await assert.rejects(payrollContractorJson(Response.json(body), "list"));
  await assert.rejects(payrollContractorJson(Response.json({ contractor: { id: "" } }), "created"));
  await assert.rejects(payrollContractorJson(Response.json({ success: false }), "deleted"));
});

test("contractor list and detail reads adopt checked DTOs, retain headers and suppress late responses", async () => {
  for (const file of [page, detailPage]) await withIO(async (url, init) => {
    assert.equal(url, file === page ? "/api/v1/payroll/contractors?page=1&limit=50" : "/api/v1/payroll/contractors/contractor-a");
    assert.deepEqual(init?.headers, { "x-organization-id": "org-a" });
    return Response.json(file === page ? { data: [contractor], pagination } : { contractor: detail });
  }, async () => {
    const h = render(file); h.effects[0](); await flush();
    assert.ok(has(h, file === page ? "contractors" : "contractor", file === page ? [contractor] : detail));
    assert.ok(has(h, file === page ? "initialLoad" : "loading", false));
  });
  for (const file of [page, detailPage]) for (const fail of [false, true]) {
    let resolve!: (v: Response) => void, reject!: (e: Error) => void;
    await withIO(() => new Promise((r, j) => { resolve = r; reject = j; }), async () => {
      const h = render(file), cleanup = h.effects[0](); (cleanup as () => void)(); const length = h.events.length;
      if (fail) reject(new Error("Private late error")); else resolve(Response.json(file === page ? { data: [contractor], pagination } : { contractor: detail }));
      await flush(); assert.equal(h.events.length, length);
    });
  }
});

test("contractor failed reads never adopt data or leak server/parser/storage prose", async () => {
  for (const file of [page, detailPage]) for (const mode of ["http", "json", "envelope", "money", "network", "no-org", "storage"]) {
    await withIO(async () => {
      if (mode === "http") return Response.json({ error: "Private server" }, { status: 403 });
      if (mode === "json") return new Response("Private parser");
      if (mode === "envelope") return Response.json({ error: "Private envelope" });
      if (mode === "network") throw new Error("Private network");
      if (mode === "no-org" || mode === "storage") assert.fail("Unexpected request");
      const bad = { ...contractor, hourlyRateMinor: "29" };
      return Response.json(file === page ? { data: [bad], pagination } : { contractor: { ...detail, ...bad } });
    }, async () => {
      const h = render(file); h.effects[0](); await flush();
      assert.ok(has(h, "moneyError", mode === "no-org" ? "organizationRequired" : "readFailed"));
      assert.ok(!h.events.some(v => ["contractor", "contractors"].includes((v as string[])[0])));
      assert.ok(!JSON.stringify(h.events).includes("Private"));
    }, mode === "no-org" ? null : "org-a", mode === "storage");
  }
  await withIO(async () => Response.json({ error: "Private" }, { status: 404 }), async () => {
    const h = render(detailPage); h.effects[0](); await flush(); assert.ok(has(h, "contractor", null)); assert.ok(!has(h, "moneyError", "readFailed"));
  });
});

test("contractor infinite scroll retains pagination/filter values and ignores superseded responses", async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "IntersectionObserver");
  let intersect!: (entries: { isIntersecting: boolean }[]) => void;
  Object.defineProperty(globalThis, "IntersectionObserver", { configurable: true, value: class {
    constructor(callback: typeof intersect) { intersect = callback; }
    observe() {} disconnect() {}
  } });
  try {
    for (const mode of ["success", "stale", "failure"]) {
      let complete!: (v: Response) => void;
      let requests = 0;
      await withIO(async (url, init) => {
        assert.equal(url, `/api/v1/payroll/contractors?isActive=false&page=${++requests}&limit=50`);
        assert.deepEqual(init?.headers, { "x-organization-id": "org-a" });
        if (requests === 1) return Response.json({ data: [contractor], pagination });
        return new Promise(resolve => { complete = resolve; });
      }, async () => {
        const h = render(page, { initialLoad: false, statusFilter: "inactive", contractors: [contractor], totalCount: 2 });
        const cleanup = h.effects[0](); await flush();
        h.refs.sentinelRef.current = {};
        h.effects[1](); intersect([{ isIntersecting: true }]);
        if (mode === "stale") (cleanup as () => void)();
        const length = h.events.length;
        complete(mode === "failure" ? Response.json({ error: "Private" }, { status: 403 }) : Response.json({ data: [contractor], pagination: { ...pagination, page: 2 } }));
        await flush(); assert.equal(requests, 2);
        if (mode === "stale") assert.equal(h.events.length, length);
        else if (mode === "failure") assert.ok(has(h, "moneyError", "readFailed"));
        else {
          const updater = h.events.findLast(v => (v as unknown[])[0] === "contractors") as [string, (prev: unknown[]) => unknown[]];
          assert.deepEqual(updater[1]([contractor]), [contractor, contractor]); assert.ok(has(h, "page", 2));
        }
      });
    }
  } finally { if (descriptor) Object.defineProperty(globalThis, "IntersectionObserver", descriptor); else Reflect.deleteProperty(globalThis, "IntersectionObserver"); }
});

test("contractor create/save callbacks preserve exact cents, nulls, headers and success navigation", async () => {
  for (const locale of locales) for (const cents of ["", "0", "0.29"]) {
    for (const file of [drawer, detailPage]) await withIO(async (url, init) => {
      assert.equal(url, file === drawer ? "/api/v1/payroll/contractors" : "/api/v1/payroll/contractors/contractor-a");
      assert.equal(init?.method, file === drawer ? "POST" : "PATCH");
      assert.deepEqual(init?.headers, { "Content-Type": "application/json", "x-organization-id": "org-a" });
      assert.deepEqual(JSON.parse(init!.body as string), { name: caller, email: null, company: null,
        hourlyRateMinor: cents === "" ? null : cents === "0" ? "0" : cents === "0.29" ? "29" : "9007199254740991",
        ...(file === drawer ? { currency: "KWD" } : { bankAccountNumber: "001234" }) });
      return Response.json({ contractor });
    }, async () => {
      const h = render(file, file === drawer ? { ...form, cRate: cents } : { ...edit, hourlyRate: cents }, locale);
      if (file === drawer) await submit(h); else await action(h, translator(locale)("save"))();
      assert.ok(has(h, "success", translator(locale)(file === drawer ? "added" : "updated")));
      assert.ok(has(h, "saving", false));
      if (file === drawer) { assert.ok(has(h, "close", undefined) || h.events.some(v => (v as string[])[0] === "close")); assert.ok(has(h, "push", "/payroll/contractors/contractor-a")); }
    });
  }
});

test("payment callbacks preserve positive cents and currency; confirmed processing and deletion retain routes", async () => {
  for (const locale of locales) for (const key of ["addPayment", "process", "delete"] as const) await withIO(async (url, init) => {
    const base = "/api/v1/payroll/contractors/contractor-a";
    if (!init?.method) return Response.json({ contractor: detail });
    assert.equal(url, key === "addPayment" ? `${base}/payments` : key === "process" ? `${base}/payments/payment-a/process` : base);
    assert.equal(init.method, key === "delete" ? "DELETE" : "POST");
    if (key === "addPayment") assert.deepEqual(JSON.parse(init.body as string), { amountMinor: "9007199254740991", currency: "JPY" });
    else { assert.equal(init.body, undefined); assert.deepEqual(init.headers, { "x-organization-id": "org-a" }); }
    return Response.json(key === "delete" ? { success: true } : { payment });
  }, async () => {
    const h = render(detailPage, edit, locale), t = translator(locale); await action(h, t(key))(); await flush();
    assert.ok(has(h, "success", t(key === "addPayment" ? "paymentAdded" : key === "process" ? "processed" : "deleted")));
    if (key === "addPayment") assert.ok(has(h, "paymentAmount", ""));
    if (key === "delete") assert.ok(has(h, "push", "/payroll/contractors"));
    if (key !== "addPayment") assert.ok(h.events.some(v => (v as string[])[0] === "confirm"));
  });
});

test("mutation failures retain fields, release saving, use finite translations and never claim success", async () => {
  for (const locale of locales) for (const file of [drawer, detailPage]) for (const key of (file === drawer ? ["create"] : ["save", "addPayment", "process", "delete"])) for (const mode of ["http", "json", "envelope", "money", "network"]) {
    await withIO(async () => {
      if (mode === "http") return Response.json({ error: "Private server" }, { status: 409 });
      if (mode === "json") return new Response("Private parser");
      if (mode === "envelope") return Response.json({ error: "Private envelope" });
      if (mode === "network") throw new Error("Private network");
      return Response.json(key === "delete" ? { success: false } : { contractor: { ...contractor, hourlyRateMinor: "29" }, payment: { ...payment, amountMinor: "28" } });
    }, async () => {
      const h = render(file, file === drawer ? form : edit, locale), t = translator(locale);
      if (file === drawer) await submit(h); else await action(h, t(key as "save"))();
      assert.ok(has(h, "error", t(key === "create" ? "createFailed" : key === "save" ? "updateFailed" : key === "addPayment" ? "paymentFailed" : key === "process" ? "processFailed" : "deleteFailed")));
      assert.ok(!h.events.some(v => ["success", "close", "push", "name", "paymentAmount", "cName"].includes((v as string[])[0])));
      if (key === "create" || key === "save") assert.ok(has(h, "saving", false));
      assert.ok(!JSON.stringify(h.events).includes("Private"));
    });
  }
  for (const storageThrows of [false, true]) await withIO(async () => { assert.fail("Unexpected request"); }, async () => {
    const h = render(drawer, form); await submit(h); assert.ok(has(h, "saving", false));
    assert.ok(has(h, "error", translator("en-US")(storageThrows ? "createFailed" : "organizationRequired")));
  }, null, storageThrows);
  for (const key of ["delete", "process"] as const) await withIO(async () => { assert.fail("Unexpected request"); }, async () => {
    const h = render(detailPage, { ...edit, confirmed: false }); await action(h, translator("en-US")(key))(); assert.ok(!h.events.some(v => ["success", "push"].includes((v as string[])[0])));
  });
});

test("invalid money fails before fetch; payment refresh failures preserve successful mutations", async () => {
  for (const cents of ["1.001", "1e2", "-1", "90071992547409.92"]) for (const file of [drawer, detailPage]) await withIO(async () => { assert.fail("Unexpected request"); }, async () => {
    const h = render(file, file === drawer ? { ...form, cRate: cents } : { ...edit, hourlyRate: cents });
    if (file === drawer) await submit(h); else await action(h, translator("en-US")("save"))();
    assert.ok(has(h, "error", translator("en-US")(file === drawer ? "createFailed" : "updateFailed")));
  });
  for (const key of ["addPayment", "process"] as const) await withIO(async (_url, init) => {
    if (!init?.method) throw new Error("Private read failure"); return Response.json({ payment });
  }, async () => {
    const h = render(detailPage, edit); await action(h, translator("en-US")(key))(); await flush();
    assert.ok(has(h, "success", translator("en-US")(key === "addPayment" ? "paymentAdded" : "processed")));
    assert.ok(has(h, "error", translator("en-US")("readFailed"))); assert.ok(!has(h, "moneyError", "readFailed"));
  });
});

test("contractor source copy audit and Persian leaves retain explicit exceptions", () => {
  for (const file of [page, detailPage, drawer]) {
    const ast = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const owner = file === drawer ? ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === "ContractorDrawer")! : ast;
    const exceptions = new Set(["jane@example.com", "150.00"]);
    function visit(n: ts.Node) {
      if (ts.isJsxText(n) && n.text.trim()) assert.fail(n.getText(ast));
      if (ts.isJsxAttribute(n) && ["title", "label", "description", "placeholder", "aria-label"].includes(n.name.getText(ast)) && n.initializer && ts.isStringLiteral(n.initializer)) assert.ok(exceptions.has(n.initializer.text), n.getText(ast));
      ts.forEachChild(n, visit);
    }
    visit(owner);
    assert.doesNotMatch(owner.getText(ast), /error\.message|err\.message|data\.error|\.json\(\)/);
  }
  assert.deepEqual(Object.keys(en.PayrollContractors), Object.keys(fa.PayrollContractors));
  for (const text of Object.values(fa.PayrollContractors)) assert.match(text, /[\u0600-\u06ff]/);
});
