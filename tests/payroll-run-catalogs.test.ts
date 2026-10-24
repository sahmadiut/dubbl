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
import { payrollRunJson } from "../i18n/payroll-run-presentation";
import { payrollMoneyDisplay } from "../lib/money/payroll-display";
import { renderWithPresentation } from "./helpers/presentation";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const page = "app/(dashboard)/payroll/runs/page.tsx";
const offCycle = "app/(dashboard)/payroll/runs/off-cycle-dialog.tsx";
const locales = ["en-US", "fa-IR"] as const;
const noop = () => {};
const caller = "<script>caller & name</script>";
const escape = (v: string) => v.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
const translator = (locale: typeof locales[number]) => createTranslator({ locale, messages: locale === "en-US" ? en : fa, namespace: "PayrollRuns" });
type Capture = { kind: string; props: Record<string, unknown> };
type Harness = { captured: Capture[]; events: unknown[]; effects: (() => void | (() => void))[]; refs: Record<string, { current: unknown }> };

// Real production templates, next-intl, footer, money inputs and controls.
// Hook/IO state and portal/date/currency-picker boundaries are controlled.
function render(file: string, states: Record<string, unknown> = {}, locale: typeof locales[number] = "en-US", props: Record<string, unknown> = {}, component?: string) {
  const ast = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const name = component ?? (file === page ? "PayrollRunsPage" : "OffCycleDialog");
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
      const key = names[index++]; return [Object.hasOwn(states, key) ? states[key] : typeof initial === "function" ? initial() : initial, (v: unknown) => h.events.push([key, v])];
    }, useEffect: (fn: () => void | (() => void)) => h.effects.push(fn), useMemo: (fn: () => unknown) => fn(), useCallback: (fn: unknown) => fn,
    useRef: (initial: unknown) => h.refs[refNames[refIndex++]] = { current: initial } };
    if (id === "react/jsx-runtime") return { ...jsx, jsx: capture(jsx.jsx), jsxs: capture(jsx.jsxs) };
    if (id === "./off-cycle-dialog") return { OffCycleDialog: () => null };
    if (id === "next-intl") return nextIntl;
    if (id === "sonner") return { toast: { error: (v: unknown) => h.events.push(["error", v]), success: (v: unknown) => h.events.push(["success", v]) } };
    if (id === "next/navigation") return { useParams: () => ({ id: "contractor-a" }), useRouter: () => ({ push: (v: string) => h.events.push(["push", v]) }) };
    if (id.endsWith("/create-drawer")) return { useCreateDrawer: () => ({ open: (v: string) => h.events.push(["drawer", v]) }) };
    if (id.endsWith("/use-debounce")) return { useDebounce: (v: string) => states.debouncedSearch ?? v };
    if (id.endsWith("/use-document-title")) return { useDocumentTitle: (v: string) => h.events.push(["title", v]) };
    if (id.endsWith("/use-confirm")) return { useConfirm: () => ({ dialog: null, confirm: async (v: unknown) => { h.events.push(["confirm", v]); return states.confirmed !== false; } }) };
    if (id.endsWith("/brand-loader")) return BrandLoader;
    for (const [suffix, names] of Object.entries({ "/ui/select": ["Select", "SelectContent", "SelectItem", "SelectTrigger", "SelectValue"], "/ui/tabs": ["Tabs", "TabsList", "TabsTrigger"], "/ui/dialog": ["Dialog", "DialogContent", "DialogHeader", "DialogTitle", "DialogDescription", "DialogFooter"], "/ui/dropdown-menu": ["DropdownMenu", "DropdownMenuContent", "DropdownMenuItem", "DropdownMenuTrigger"], "/ui/date-picker": ["DatePicker"], "/ui/currency-select": ["CurrencySelect"] }))
      if (id.endsWith(suffix)) return Object.fromEntries(names.map(key => [key, inline(key)]));
    return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  };
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function("require", "module", "exports", code)(load, compiled, compiled.exports);
  const html = renderWithPresentation(createElement(compiled.exports[name], { open: true, onClose: () => h.events.push(["close"]), type: "bonus-only", start: "2024-01-01", end: "2024-01-07", ...props }), locale);
  return { ...h, html };
}
const control = (h: Harness, kind: string) => h.captured.find(c => c.kind === kind)!.props;
const flush = async () => { for (let i = 0; i < 8; i++) await new Promise(resolve => setImmediate(resolve)); };
const run = { id: "run-a", payPeriodStart: "2024-01-01", payPeriodEnd: "2024-01-07", status: "completed", runType: "regular",
  baseCurrency: "KWD", totalGross: Number.MAX_SAFE_INTEGER, totalGrossMinor: "9007199254740991", totalDeductions: 29, totalDeductionsMinor: "29", totalNet: 0, totalNetMinor: "0" };
const employee = { id: "employee-a", name: caller, currency: "JPY" };
const parent = { ...run, items: [{ employeeId: employee.id, currency: "JPY", employee: { name: caller } }] };
const pagination = { total: 1, page: 1, limit: 100, totalPages: 1 };
const edit = { loading: false, employees: [employee], parents: [parent], employeeId: employee.id, parentRunId: run.id,
  amount: "0.29", notes: caller, pto: true, periodStart: "2024-01-01", periodEnd: "2024-01-07" };
const has = (h: Harness, key: string, value: unknown) => h.events.some(v => JSON.stringify(v) === JSON.stringify([key, value]));
const action = (h: Harness, label: string) => {
  const c = h.captured.find(c => c.kind === "Button" && (c.props.children === label || Array.isArray(c.props.children) && c.props.children.includes(label)));
  assert.ok(c, label); return c.props.onClick as () => Promise<void>;
};
const submit = async (h: Harness) => { (control(h, "form").onSubmit as (e: { preventDefault: () => void }) => void)({ preventDefault: noop }); await flush(); };
async function withIO(fetcher: typeof fetch, work: () => Promise<void>, org: string | null = "org-a", storageThrows = false) {
  const original = globalThis.fetch, storage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  globalThis.fetch = fetcher;
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: (key: string) => {
    assert.equal(key, "activeOrgId"); if (storageThrows) throw new Error("Private storage"); return org;
  } } });
  try { await work(); } finally { globalThis.fetch = original; if (storage) Object.defineProperty(globalThis, "localStorage", storage); else Reflect.deleteProperty(globalThis, "localStorage"); }
}

test("payroll run list, states, badges, sort/filter controls and new dialog render bilingually", () => {
  for (const locale of locales) {
    const t = translator(locale);
    const runs = ["draft", "processing", "completed", "pending_approval", "void"].map((status, i) => ({ ...run, id: String(i), status, runType: ["regular", "termination", "bonus_only", "correction", "off_cycle"][i] }));
    const h = render(page, { loading: false, runs, search: "" }, locale);
    for (const key of ["all", "draft", "processing", "completed", "pendingApproval", "void", "regular", "termination", "bonus", "correction", "offCycle", "date", "gross", "net", "deductions", "newRun", "oneOff", "fixPast"] as const) assert.ok(h.html.includes(escape(t(key))), key);
    assert.ok(h.html.includes(escape(payrollMoneyDisplay(run.totalGross, "KWD", resolvePresentation({ user: { language: locale } })))));
    assert.ok(h.html.includes(escape(t("period", { start: run.payPeriodStart, end: run.payPeriodEnd }))));
    assert.ok(has(h, "title", t("documentTitle")));
    assert.deepEqual(h.captured.filter(c => c.kind === "SelectItem").map(c => c.props.value), ["date", "gross", "net"]);
    assert.deepEqual(h.captured.filter(c => c.kind === "TabsTrigger").map(c => c.props.value), ["all", "draft", "completed", "pending_approval", "void", "all", "regular", "termination", "bonus_only", "correction", "off_cycle"]);
    for (const [state, key] of [[{ loading: true }, "loading"], [{ loading: false, runs: [] }, "firstRun"], [{ loading: false, moneyError: "readFailed" }, "readFailed"], [{ loading: false, runs, search: "missing" }, "trySearch"], [{ loading: false, runs: [run], statusFilter: "draft" }, "noMatch"]] as const) {
      const html = render(page, state, locale).html;
      assert.ok(html.includes(escape(key === "loading" ? (locale === "en-US" ? en : fa).SharedUI.loading2 : t(key))), key);
    }
    const dialog = render(page, {}, locale, { payPeriodStart: run.payPeriodStart, payPeriodEnd: run.payPeriodEnd, onSubmit: noop, onOpenChange: noop, setPayPeriodStart: noop, setPayPeriodEnd: noop }, "NewRunDialog");
    for (const key of ["newRun", "periodStart", "periodEnd", "cancel", "create"] as const) assert.ok(dialog.html.includes(escape(t(key))));
    const busy = render(page, {}, locale, { loading: true }, "NewRunDialog");
    assert.equal(busy.captured.find(c => c.kind === "Button" && c.props.children === t("creating"))!.props.disabled, true);
    for (const type of ["termination", "bonus-only", "correction"] as const) {
      const h = render(offCycle, edit, locale, { type });
      for (const key of ["approvalHelp", "employee", "notes", "createPayRun", type === "termination" ? "pto" : type === "correction" ? "adjustmentHelp" : "bonusOnly"] as const) assert.ok(h.html.includes(escape(t(key))), key);
      assert.ok(h.html.includes(escape(caller))); assert.ok(!h.html.includes("<script>"));
      assert.ok(h.captured.some(c => c.kind === "SelectItem" && c.props.value === employee.id));
    }
  }
});

test("payroll filtering, numeric sorting, navigation and UI callbacks preserve machine values", async () => {
  const runs = [{ ...run, id: "early", payPeriodStart: "2024-01-01", status: "draft", runType: null, totalGross: 29, totalNet: 30 }, { ...run, id: "late", payPeriodStart: "2024-02-01", runType: "bonus_only", totalGross: 30, totalNet: 29 }];
  for (const sortBy of ["date", "gross", "net"]) for (const sortOrder of ["asc", "desc"]) {
    const h = render(page, { loading: false, runs, sortBy, sortOrder });
    const rows = h.captured.filter(c => c.kind === "button" && typeof c.props.onClick === "function");
    const first = (sortBy === "net") === (sortOrder === "asc") ? "late" : "early";
    (rows[0].props.onClick as () => void)(); assert.ok(has(h, "push", `/payroll/runs/${first}`));
  }
  for (const state of [{ runTypeFilter: "regular" }, { statusFilter: "draft" }, { search: "draft" }, { search: "01-01" }]) {
    const h = render(page, { loading: false, runs, ...state });
    const rows = h.captured.filter(c => c.kind === "button" && !c.props["aria-label"]); assert.equal(rows.length, 1);
    (rows[0].props.onClick as () => void)(); assert.ok(has(h, "push", "/payroll/runs/early"));
  }
  const h = render(page, { loading: false, runs, search: "draft" });
  (h.captured.find(c => c.props["aria-label"] === translator("en-US")("clearSearch"))!.props.onClick as () => void)(); assert.ok(has(h, "search", ""));
  for (const type of ["termination", "bonus-only", "correction"]) {
    const item = h.captured.find(c => c.kind === "DropdownMenuItem" && c.props.children === translator("en-US")(type === "termination" ? "finalPayAction" : type === "bonus-only" ? "bonusOnly" : "fixPast"))!;
    (item.props.onClick as () => void)(); assert.ok(has(h, "offCycleType", type));
  }
  const d = render(offCycle, edit, "en-US", { type: "correction" });
  (control(d, "Select").onValueChange as (v: string) => void)("parent-b"); assert.ok(has(d, "parentRunId", "parent-b")); assert.ok(has(d, "employeeId", ""));
});

test("checked payroll run readers reject malformed envelopes, displayed fields, pagination and exact aliases", async () => {
  for (const kind of ["list", "parents"] as const) {
    const row = kind === "list" ? run : parent;
    const body = { data: [row], pagination };
    assert.deepEqual(await payrollRunJson(Response.json(body), kind), body);
    for (const patch of [{ id: "" }, { status: "private" }, { runType: "private" }, { runType: undefined }, { payPeriodStart: "2024-02-30" }, { totalGrossMinor: "29" }, { totalNet: undefined }, { baseCurrency: "usd" }, ...(kind === "parents" ? [{ items: undefined }, { status: "draft" }, { items: [{ employeeId: "a", currency: "USD", employee: { name: null } }] }] : [])])
      await assert.rejects(payrollRunJson(Response.json({ ...body, data: [{ ...row, ...patch }] }), kind));
  }
  for (const patch of [{ page: 0 }, { totalPages: 20 }, { total: -1 }, { limit: 101 }]) await assert.rejects(payrollRunJson(Response.json({ data: [run], pagination: { ...pagination, ...patch } }), "list"));
  for (const body of [{}, { data: [] }, { data: null, pagination }]) await assert.rejects(payrollRunJson(Response.json(body), "list"));
  for (const patch of [{ name: null }, { currency: undefined }, { currency: "usd" }, { id: "" }]) await assert.rejects(payrollRunJson(Response.json({ data: [{ ...employee, ...patch }], pagination }), "employees"));
  for (const body of [{ run: { id: "", status: "draft" } }, { run: { id: "a" } }, { run: { id: "a", status: "private" } }, { run: { id: "a", status: "draft", totalNet: 29 } }]) await assert.rejects(payrollRunJson(Response.json(body), "created"));
  assert.deepEqual(await payrollRunJson(Response.json({ run: { id: "a", status: "draft" } }), "created"), { run: { id: "a", status: "draft" } });
});

test("list and paginated off-cycle choices validate before adoption and ignore obsolete reads", async () => {
  await withIO(async (url, init) => {
    assert.equal(url, "/api/v1/payroll/runs"); assert.deepEqual(init?.headers, { "x-organization-id": "org-a" });
    return Response.json({ data: [run], pagination });
  }, async () => { const h = render(page); h.effects[0](); await flush(); assert.ok(has(h, "runs", [run])); assert.ok(has(h, "loading", false)); });
  for (const type of ["termination", "bonus-only", "correction"] as const) {
    let requests = 0;
    await withIO(async (url, init) => {
      requests++;
      assert.equal(url, `${type === "correction" ? "/api/v1/payroll/runs?status=completed" : "/api/v1/payroll/employees?active=true"}&limit=100&page=${requests}`);
      assert.deepEqual(init?.headers, { "x-organization-id": "org-a" });
      return Response.json({ data: [type === "correction" ? parent : employee], pagination: { ...pagination, total: 101, totalPages: 2, page: requests } });
    }, async () => {
      const h = render(offCycle, {}, "en-US", { type }); h.effects[0](); await flush(); assert.equal(requests, 2);
      assert.ok(has(h, type === "correction" ? "parents" : "employees", [type === "correction" ? parent : employee, type === "correction" ? parent : employee]));
      assert.ok(has(h, "loading", false));
    });
  }
  for (const file of [page, offCycle]) for (const failure of [true, false]) {
    let resolve!: (r: Response) => void, reject!: (e: Error) => void;
    await withIO(() => new Promise((r, j) => { resolve = r; reject = j; }), async () => {
      const h = render(file), cleanup = h.effects[0](); (cleanup as () => void)(); const length = h.events.length;
      if (failure) reject(new Error("Private late")); else resolve(Response.json({ data: [file === page ? run : employee], pagination }));
      await flush(); assert.equal(h.events.length, length);
    });
  }
});

test("failed payroll reads use translated finite messages, release loading and reject private prose", async () => {
  for (const locale of locales) for (const file of [page, offCycle]) for (const mode of ["http", "json", "envelope", "money", "network", "no-org", "storage", "page"]) await withIO(async () => {
    if (mode === "http") return Response.json({ error: "Private server" }, { status: 403 });
    if (mode === "json") return new Response("Private parser");
    if (mode === "envelope") return Response.json({ error: "Private envelope" });
    if (mode === "network") throw new Error("Private network");
    if (mode === "no-org" || mode === "storage") assert.fail("Unexpected fetch");
    return Response.json({ data: [{ ...(file === page ? run : employee), totalNet: 29, totalNetMinor: "28" }], pagination: mode === "page" ? { ...pagination, page: 0 } : pagination });
  }, async () => {
    const h = render(file, {}, locale); h.effects[0](); await flush();
    assert.ok(has(h, "loading", false));
    assert.ok(has(h, file === page ? "moneyError" : "error", file === page ? mode === "no-org" ? "organizationRequired" : "readFailed" : translator(locale)(mode === "no-org" ? "organizationRequired" : "choicesFailed")));
    assert.ok(!h.events.some(v => (v as unknown[])[0] === "runs")); assert.ok(!JSON.stringify(h.events).includes("Private"));
  }, mode === "no-org" ? null : "org-a", mode === "storage");
});

test("regular and off-cycle callbacks preserve canonical dates, signed cents, PTO, notes, headers and navigation", async () => {
  for (const locale of locales) for (const type of ["regular", "termination", "bonus-only", "correction"]) for (const amount of (type === "bonus-only" || type === "correction" ? ["0.29", "90071992547409.91", "-0.29"] : ["0.29"])) {
    const minor = amount === "0.29" ? "29" : amount.startsWith("-") ? "-29" : "9007199254740991";
    await withIO(async (url, init) => {
      assert.equal(url, "/api/v1/payroll/runs" + (type === "regular" ? "" : `/${type}`));
      assert.equal(init?.method, "POST"); assert.deepEqual(init.headers, { "Content-Type": "application/json", "x-organization-id": "org-a" });
      const period = { payPeriodStart: run.payPeriodStart, payPeriodEnd: run.payPeriodEnd };
      assert.deepEqual(JSON.parse(init.body as string), type === "regular" ? period : type === "termination" ? { employeeId: employee.id, ...period, includeUnusedPto: true, notes: caller }
        : type === "bonus-only" ? { ...period, notes: caller, bonuses: [{ employeeId: employee.id, bonusType: "other", amountMinor: minor.replace("-", "") }] }
        : { parentRunId: run.id, notes: caller, adjustments: [{ employeeId: employee.id, grossAdjustmentMinor: minor }] });
      return Response.json({ run: { id: run.id, status: type === "regular" ? "draft" : "completed" } });
    }, async () => {
      const h = render(type === "regular" ? page : offCycle, { ...edit, amount, payPeriodStart: run.payPeriodStart, payPeriodEnd: run.payPeriodEnd, runs: [run], dialogOpen: true }, locale, { type });
      if (type === "regular") await action(h, translator(locale)("create"))(); else await submit(h);
      assert.ok(has(h, "success", translator(locale)(type === "regular" ? "created" : "recorded")));
      assert.ok(has(h, "push", `/payroll/runs/${run.id}`)); assert.ok(has(h, type === "regular" ? "creating" : "busy", false));
    });
  }
});

test("mutation failures retain forms, avoid false success/navigation, release busy and translate errors", async () => {
  for (const locale of locales) for (const type of ["regular", "termination", "bonus-only", "correction"]) for (const mode of ["http", "json", "envelope", "money", "network", "no-org", "storage"]) await withIO(async () => {
    if (mode === "http") return Response.json({ error: "Private server" }, { status: 409 });
    if (mode === "json") return new Response("Private parser");
    if (mode === "envelope") return Response.json({ error: "Private envelope" });
    if (mode === "network") throw new Error("Private network");
    if (mode === "no-org" || mode === "storage") assert.fail("Unexpected fetch");
    return Response.json({ run: { ...run, totalNetMinor: "1" } });
  }, async () => {
    const h = render(type === "regular" ? page : offCycle, { ...edit, runs: [run], dialogOpen: true }, locale, { type });
    if (type === "regular") await action(h, translator(locale)("create"))(); else await submit(h);
    assert.ok(has(h, "error", translator(locale)(mode === "no-org" ? "organizationRequired" : "createFailed")));
    assert.ok(has(h, type === "regular" ? "creating" : "busy", false));
    assert.ok(!h.events.some(v => ["success", "push", "close", "dialogOpen", "amount", "notes", "employeeId"].includes((v as string[])[0])));
    assert.ok(!JSON.stringify(h.events).includes("Private"));
  }, mode === "no-org" ? null : "org-a", mode === "storage");
  for (const amount of ["1.001", "1e2", "90071992547409.92"]) {
    let requests = 0;
    await withIO(async () => { requests++; return Response.json({ run }); }, async () => {
      const h = render(offCycle, { ...edit, amount }); await submit(h); assert.ok(has(h, "error", translator("en-US")("createFailed")));
      assert.equal(requests, 0, "Invalid cents must fail before fetch");
    });
  }
  await withIO(async () => Response.json({ run: { id: run.id, status: "draft" } }), async () => {
    const h = render(offCycle, edit); await submit(h); assert.ok(has(h, "success", translator("en-US")("approvalCreated")));
  });
});

test("source copy and paired Persian leaves have explicit machine/data exceptions", () => {
  for (const file of [page, offCycle]) {
    const ast = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(n: ts.Node) {
      if (ts.isJsxText(n) && n.text.trim()) assert.fail(n.getText(ast));
      if (ts.isJsxAttribute(n) && ["title", "label", "description", "placeholder", "aria-label"].includes(n.name.getText(ast)) && n.initializer && ts.isStringLiteral(n.initializer)) assert.fail(n.getText(ast));
      ts.forEachChild(n, visit);
    }
    visit(ast); assert.doesNotMatch(ast.text, /error\.message|err\.message|data\.error|\.json\(\)/);
  }
  assert.deepEqual(Object.keys(en.PayrollRuns), Object.keys(fa.PayrollRuns));
  for (const [key, text] of Object.entries(fa.PayrollRuns)) {
    if (key === "employeeOption") assert.equal(text, "{name} · {currency}"); // Data-only separator; no authored prose.
    else assert.match(text, /[\u0600-\u06ff]/);
  }
});
