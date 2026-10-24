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
import { payrollRunDetailJson, payrollItemTypes, payrollBonusTypes, payrollApprovalStatuses } from "../i18n/payroll-run-detail-presentation";
import { payrollMoneyDisplay } from "../lib/money/payroll-display";
import { renderWithPresentation } from "./helpers/presentation";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const page = "app/(dashboard)/payroll/runs/[id]/page.tsx";
const locales = ["en-US", "fa-IR"] as const;
const caller = "<script>caller & name</script>";
const escape = (v: string) => v.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
const translator = (locale: typeof locales[number]) => createTranslator({ locale, messages: locale === "en-US" ? en : fa, namespace: "PayrollRunDetail" });
type Capture = { kind: string; props: Record<string, unknown> };
type Harness = { captured: Capture[]; events: unknown[]; effects: (() => void | (() => void))[]; refs: Record<string, { current: unknown }> };

// Real production templates, next-intl, footer, money inputs and controls.
// Hook/IO state and portal/date/currency-picker boundaries are controlled.
function render(file: string, states: Record<string, unknown> = {}, locale: typeof locales[number] = "en-US", props: Record<string, unknown> = {}, component?: string) {
  const ast = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const name = component ?? "PayrollRunDetailPage";
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
    if (id === "next/navigation") return { useParams: () => ({ id: "run-a" }), useRouter: () => ({ push: (v: string) => h.events.push(["push", v]) }) };
    if (id.endsWith("/create-drawer")) return { useCreateDrawer: () => ({ open: (v: string) => h.events.push(["drawer", v]) }) };
    if (id.endsWith("/use-debounce")) return { useDebounce: (v: string) => states.debouncedSearch ?? v };
    if (id.endsWith("/use-document-title")) return { useDocumentTitle: (v: string) => h.events.push(["title", v]) };
    if (id.endsWith("/use-confirm")) return { useConfirm: () => ({ dialog: null, confirm: async (v: unknown) => { h.events.push(["confirm", v]); return states.confirmed !== false; } }) };
    if (id.endsWith("/brand-loader")) return BrandLoader;
    for (const [suffix, names] of Object.entries({ "/ui/select": ["Select", "SelectContent", "SelectItem", "SelectTrigger", "SelectValue"], "/ui/tabs": ["Tabs", "TabsList", "TabsTrigger"], "/ui/dialog": ["Dialog", "DialogContent", "DialogHeader", "DialogTitle", "DialogDescription", "DialogFooter", "DialogTrigger"], "/ui/dropdown-menu": ["DropdownMenu", "DropdownMenuContent", "DropdownMenuItem", "DropdownMenuTrigger"], "/ui/date-picker": ["DatePicker"], "/ui/currency-select": ["CurrencySelect"] }))
      if (id.endsWith(suffix)) return Object.fromEntries(names.map(key => [key, inline(key)]));
    return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  };
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function("require", "module", "exports", code)(load, compiled, compiled.exports);
  const html = renderWithPresentation(createElement(compiled.exports[name], { open: true, onClose: () => h.events.push(["close"]), type: "bonus-only", start: "2024-01-01", end: "2024-01-07", ...props }), locale);
  return { ...h, html };
}
const flush = async () => { for (let i = 0; i < 8; i++) await new Promise(resolve => setImmediate(resolve)); };
const has = (h: Harness, key: string, value: unknown) => h.events.some(v => JSON.stringify(v) === JSON.stringify([key, value]));
const item = { id: "item-a", employeeId: "employee-a", currency: "JPY", fxRate: 1.25, rateExact: "1.25", type: "regular_salary", description: caller,
  employee: { name: caller, employeeNumber: "EMP-01" }, grossAmount: Number.MAX_SAFE_INTEGER, grossAmountMinor: "9007199254740991",
  taxAmount: 29, taxAmountMinor: "29", deductions: 29, deductionsMinor: "29", netAmount: 0, netAmountMinor: "0",
  preTaxDeductions: Number.MAX_SAFE_INTEGER, preTaxDeductionsMinor: "9007199254740991", postTaxDeductions: Number.MAX_SAFE_INTEGER, postTaxDeductionsMinor: "9007199254740991" };
const run = { id: "run-a", payPeriodStart: "2024-01-01", payPeriodEnd: "2024-01-07", status: "draft", runType: "regular", approvalStatus: null,
  baseCurrency: "KWD", totalGross: Number.MAX_SAFE_INTEGER, totalGrossMinor: "9007199254740991", totalDeductions: 29, totalDeductionsMinor: "29", totalNet: 0, totalNetMinor: "0",
  journalEntryId: null, processedAt: null, items: [item] };
const bonus = { id: "bonus-a", employeeId: item.employeeId, amount: 29, amountMinor: "29", bonusType: "spot", description: caller, employee: { name: caller, currency: "JPY" } };
const form = { employeeId: item.employeeId, bonusType: "other", amount: "0.29", description: caller };
const view = (states: Record<string, unknown> = {}, locale: typeof locales[number] = "en-US") => render(page, { loading: false, run, bonuses: [bonus], bonusDialogOpen: true, bonusForm: form, ...states }, locale);
const action = (h: Harness, label: string, last = false) => {
  const rows = h.captured.filter(c => c.kind === "Button" && (c.props.children === label || Array.isArray(c.props.children) && c.props.children.includes(label)));
  assert.ok(rows.length, label); return rows[last ? rows.length - 1 : 0].props.onClick as () => Promise<void>;
};
async function withIO(fetcher: typeof fetch, work: (reloads: () => number) => Promise<void>, org: string | null = "org-a", storageThrows = false) {
  const original = globalThis.fetch, storage = Object.getOwnPropertyDescriptor(globalThis, "localStorage"), win = Object.getOwnPropertyDescriptor(globalThis, "window");
  let reloads = 0;
  globalThis.fetch = fetcher;
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: (key: string) => {
    assert.equal(key, "activeOrgId"); if (storageThrows) throw new Error("Private storage"); return org;
  } } });
  Object.defineProperty(globalThis, "window", { configurable: true, value: { location: { reload: () => reloads++ } } });
  try { await work(() => reloads); } finally {
    globalThis.fetch = original;
    if (storage) Object.defineProperty(globalThis, "localStorage", storage); else Reflect.deleteProperty(globalThis, "localStorage");
    if (win) Object.defineProperty(globalThis, "window", win); else Reflect.deleteProperty(globalThis, "window");
  }
}

test("run detail renders bilingual copy, finite enums, exact cents, escaped data and retained bonus choices", () => {
  for (const locale of locales) {
    const t = translator(locale);
    const h = view({ run: { ...run, items: payrollItemTypes.map((type, i) => ({ ...item, id: String(i), type })) }, bonuses: payrollBonusTypes.map((bonusType, i) => ({ ...bonus, id: String(i), bonusType })) }, locale);
    for (const key of ["back", "send", "finish", "gross", "deductions", "net", "beforeDeductions", "tax", "otherDeductions", "takeHome", "addBonus", "employee", "bonusTypeLabel", "amount", "description", "addBonusHelp"] as const) assert.ok(h.html.includes(escape(t(key))), key);
    for (const type of payrollItemTypes) assert.ok(h.html.includes(escape(t(`itemType_${type}`))));
    for (const type of payrollBonusTypes) assert.ok(h.html.includes(escape(t(`bonusType_${type}`))));
    assert.ok(has(h, "title", t("documentTitle")));
    assert.ok(h.html.includes(escape(t("period", { start: run.payPeriodStart, end: run.payPeriodEnd }))));
    assert.ok(h.html.includes(escape(caller))); assert.ok(!h.html.includes("<script>"));
    assert.ok(h.html.includes(escape(payrollMoneyDisplay(item.grossAmount, "JPY", resolvePresentation({ user: { language: locale } })))));
    assert.ok(h.html.includes(escape(payrollMoneyDisplay(18014398509481982n, "JPY", resolvePresentation({ user: { language: locale } })))));
    assert.deepEqual(h.captured.filter(c => c.kind === "SelectItem").map(c => c.props.value), [item.employeeId, "performance", "signing", "holiday", "referral", "retention", "other"]);
    for (const status of ["draft", "processing", "completed", "pending_approval", "void"] as const) assert.ok(view({ run: { ...run, status } }, locale).html.includes(escape(t(`status_${status}`))));
    for (const approvalStatus of payrollApprovalStatuses) assert.ok(view({ run: { ...run, approvalStatus } }, locale).html.includes(escape(t(`approval_${approvalStatus}`))));
    for (const runType of ["termination", "bonus_only", "correction", "off_cycle"] as const) assert.ok(view({ run: { ...run, runType } }, locale).html.includes(escape(t(`runType_${runType}`))));
    const completed = view({ run: { ...run, status: "completed", journalEntryId: "journal-a", processedAt: "2024-01-08T00:00:00Z" } }, locale);
    for (const key of ["viewEntry", "generate", "viewPayslips"] as const) assert.ok(completed.html.includes(escape(t(key))));
    assert.ok(completed.html.includes(escape(t("processedAt", { date: "2024-01-08T00:00:00Z" }))));
    for (const [states, key] of [[{ run: null }, "notFound"], [{ moneyError: "readFailed" }, "readFailed"], [{ run: { ...run, items: [] } }, "noEmployees"], [{ search: "unmatched" }, "noMatch"], [{ bonuses: [] }, "noBonuses"], [{ run: { ...run, status: "completed" } }, "noEntryHelp"]] as const)
      assert.ok(view(states, locale).html.includes(escape(t(key))), key);
    assert.ok(view({ loading: true }, locale).html.includes(escape((locale === "en-US" ? en : fa).SharedUI.loading2)));
  }
});

test("run detail controls retain filtering, navigation, busy states and bonus editing constraints", () => {
  const t = translator("en-US");
  for (const search of ["emp-01", "CALLER"]) assert.ok(view({ search }).html.includes(escape(caller)));
  const h = view({ search: "EMP" });
  (h.captured.find(c => c.props["aria-label"] === t("clearSearch"))!.props.onClick as () => void)(); assert.ok(has(h, "search", ""));
  const done = view({ run: { ...run, status: "completed", journalEntryId: "journal-a" } });
  const journal = done.captured.find(c => typeof c.props.onClick === "function" && c.props.className?.toString().includes("group flex w-full"))!;
  (journal.props.onClick as () => void)(); assert.ok(has(done, "push", "/accounting/journal-a"));
  action(done, t("viewPayslips"))(); assert.ok(has(done, "push", "/payroll/runs/run-a/payslips"));
  for (const [states, label] of [[{ processing: true }, "finishing"], [{ submittingApproval: true }, "sending"], [{ creatingBonus: true }, "adding"], [{ run: { ...run, status: "pending_approval" }, approving: true }, "approving"], [{ run: { ...run, status: "pending_approval" }, rejecting: true }, "rejecting"], [{ run: { ...run, status: "completed" }, generatingPayslips: true }, "generating"]] as const) {
    const h = view(states); assert.ok(h.captured.some(c => c.kind === "Button" && c.props.disabled === true && (c.props.children === t(label) || Array.isArray(c.props.children) && c.props.children.includes(t(label)))));
  }
  for (const patch of [{ status: "completed" }, { approvalStatus: "approved" }, { runType: "correction" }, { runType: "termination" }]) {
    const h = view({ run: { ...run, ...patch } });
    assert.equal(h.captured.find(c => c.kind === "Button" && Array.isArray(c.props.children) && c.props.children.includes(t("addBonus")))!.props.disabled, true);
  }
});

test("detail readers reject malformed envelopes, fields, money, enums and mutation success", async () => {
  assert.deepEqual(await payrollRunDetailJson(Response.json({ run }), "detail"), { run });
  for (const patch of [{ id: "" }, { payPeriodStart: "2024-02-30" }, { totalGrossMinor: "29" }, { totalNet: undefined }, { status: "private" }, { runType: "private" }, { approvalStatus: "private" }, { journalEntryId: 3 }, { processedAt: "private" }, { items: null }, { baseCurrency: "usd" }])
    await assert.rejects(payrollRunDetailJson(Response.json({ run: { ...run, ...patch } }), "detail"));
  for (const patch of [{ id: "" }, { employeeId: "" }, { grossAmount: undefined }, { preTaxDeductionsMinor: "29" }, { postTaxDeductions: undefined }, { rateExact: "private" }, { fxRate: -1 }, { type: "private" }, { employee: { name: null } }, { currency: "usd" }, { description: 4 }])
    await assert.rejects(payrollRunDetailJson(Response.json({ run: { ...run, items: [{ ...item, ...patch }] } }), "detail"));
  for (const patch of [{ amountMinor: "28" }, { id: "" }, { bonusType: "private" }, { description: 1 }, { employee: { name: null } }])
    await assert.rejects(payrollRunDetailJson(Response.json({ bonuses: [{ ...bonus, ...patch }] }), "bonuses"));
  for (const kind of ["detail", "bonus", "bonuses", "payslips"] as const) {
    for (const body of [{}, null, [], { error: "private" }]) await assert.rejects(payrollRunDetailJson(Response.json(body), kind));
    await assert.rejects(payrollRunDetailJson(Response.json({ run, bonus, bonuses: [bonus], count: 0 }, { status: 403 }), kind));
  }
  for (const count of [-1, 0.1, "0", null]) await assert.rejects(payrollRunDetailJson(Response.json({ count }), "payslips"));
  assert.deepEqual(await payrollRunDetailJson(Response.json({ count: 0 }), "payslips"), { count: 0 });
});

test("initial detail and bonus reads adopt checked data atomically and release loading", async () => {
  let requests = 0;
  await withIO(async (url, init) => {
    requests++; assert.equal(url, `/api/v1/payroll/runs/run-a${requests === 2 ? "/bonuses" : ""}`); assert.deepEqual(init?.headers, { "x-organization-id": "org-a" });
    return Response.json(requests === 1 ? { run } : { bonuses: [bonus] });
  }, async () => { const h = render(page); h.effects[0](); await flush(); assert.equal(requests, 2); assert.ok(has(h, "run", run)); assert.ok(has(h, "bonuses", [bonus])); assert.ok(has(h, "loading", false)); });
  for (const locale of locales) for (const mode of ["http", "json", "envelope", "money", "network", "no-org", "storage", "bonus"]) {
    let requests = 0;
    await withIO(async () => {
      requests++;
      if (mode === "http") return Response.json({ error: "Private server" }, { status: 403 });
      if (mode === "json") return new Response("Private parser");
      if (mode === "envelope") return Response.json({ error: "Private envelope" });
      if (mode === "network") throw new Error("Private network");
      return Response.json(mode === "bonus" && requests === 1 ? { run } : mode === "bonus" ? { bonuses: [ { ...bonus, amountMinor: "28" } ] } : { run: { ...run, totalNetMinor: "29" } });
    }, async () => {
      const h = render(page, {}, locale); h.effects[0](); await flush();
      assert.ok(has(h, "moneyError", mode === "no-org" || mode === "storage" ? "organizationRequired" : "readFailed")); assert.ok(has(h, "loading", false));
      assert.ok(!has(h, "run", run)); assert.ok(!has(h, "bonuses", [bonus])); assert.ok(!JSON.stringify(h.events).includes("Private"));
      if (mode === "no-org" || mode === "storage") assert.equal(requests, 0);
    }, mode === "no-org" ? null : "org-a", mode === "storage");
  }
  await withIO(async () => new Response(null, { status: 404 }), async () => { const h = render(page); h.effects[0](); await flush(); assert.ok(has(h, "run", null)); assert.ok(!has(h, "moneyError", "readFailed")); assert.ok(has(h, "loading", false)); });
});

test("effect cleanup ignores late initial and bonus fulfillment or failure", async () => {
  for (const stage of [1, 2]) for (const failure of [true, false]) {
    let requests = 0, finish!: (r: Response) => void, fail!: (e: Error) => void;
    await withIO(async () => {
      if (++requests < stage) return Response.json({ run });
      return new Promise((resolve, reject) => { finish = resolve; fail = reject; });
    }, async () => {
      const h = render(page), cleanup = h.effects[0](); await flush(); (cleanup as () => void)(); const length = h.events.length;
      if (failure) fail(new Error("Private late")); else finish(Response.json(stage === 1 ? { run } : { bonuses: [bonus] }));
      await flush(); assert.equal(h.events.length, length); assert.equal(requests, stage);
    });
  }
});

const operations = [
  { label: "finish", path: "process", busy: "processing", success: "finished", error: "processFailed", confirm: "finishTitle", status: "draft" },
  { label: "send", path: "submit-for-approval", busy: "submittingApproval", success: "submitted", error: "submitFailed", status: "draft" },
  { label: "approve", path: "approve", busy: "approving", success: "approved", error: "approveFailed", confirm: "approveTitle", status: "pending_approval" },
  { label: "reject", path: "reject", busy: "rejecting", success: "rejected", error: "rejectFailed", confirm: "rejectTitle", status: "pending_approval" },
  { label: "generate", path: "generate-payslips", busy: "generatingPayslips", success: "payslipsGenerated", error: "payslipsFailed", status: "completed" },
] as const;
test("lifecycle and generation callbacks preserve POST contracts, translated confirms and success navigation", async () => {
  for (const locale of locales) for (const op of operations) {
    const t = translator(locale); let requests = 0;
    await withIO(async (url, init) => {
      requests++; assert.equal(url, `/api/v1/payroll/runs/run-a/${op.path}`); assert.equal(init?.method, "POST"); assert.equal(init?.body, undefined); assert.deepEqual(init?.headers, { "x-organization-id": "org-a" });
      return Response.json(op.path === "generate-payslips" ? { count: 0 } : { run });
    }, async reloads => {
      const h = view({ run: { ...run, status: op.status } }, locale); await action(h, t(op.label))(); assert.equal(requests, 1);
      assert.ok(has(h, "success", t(op.success))); assert.ok(has(h, op.busy, true)); assert.ok(has(h, op.busy, false));
      if ("confirm" in op) assert.ok(h.events.some(v => Array.isArray(v) && v[0] === "confirm" && v[1].title === t(op.confirm)));
      assert.equal(reloads(), op.path === "generate-payslips" ? 0 : 1);
      if (op.path === "generate-payslips") assert.ok(has(h, "push", "/payroll/runs/run-a/payslips"));
    });
  }
});

test("failed lifecycle mutations keep forms, release busy and suppress success/reload/private errors", async () => {
  for (const locale of locales) for (const op of operations) for (const mode of ["http", "json", "envelope", "network", "no-org", "storage", ...("confirm" in op ? ["cancel"] : [])]) {
    let requests = 0; const t = translator(locale);
    await withIO(async () => {
      requests++;
      if (mode === "network") throw new Error("Private network");
      if (mode === "json") return new Response("Private parser");
      return Response.json({ error: "Private server" }, { status: mode === "http" ? 409 : 200 });
    }, async reloads => {
      const h = view({ run: { ...run, status: op.status }, confirmed: mode !== "cancel" }, locale); await action(h, t(op.label))();
      assert.equal(requests, ["no-org", "storage", "cancel"].includes(mode) ? 0 : 1);
      if (mode !== "cancel") assert.ok(has(h, "error", t(mode === "no-org" || mode === "storage" ? "organizationRequired" : op.error)));
      if (requests) assert.ok(has(h, op.busy, false));
      assert.ok(!h.events.some(v => Array.isArray(v) && ["success", "push", "bonusForm", "bonusDialogOpen"].includes(v[0]))); assert.equal(reloads(), 0);
      assert.ok(!JSON.stringify(h.events).includes("Private"));
    }, mode === "no-org" ? null : "org-a", mode === "storage");
  }
});

test("bonus submission preserves cents, IDs and description and refreshes both checked collections", async () => {
  for (const locale of locales) for (const [amount, amountMinor] of [["0.29", "29"], ["90071992547409.91", "9007199254740991"]]) {
    let requests = 0; const t = translator(locale);
    await withIO(async (url, init) => {
      requests++;
      if (requests === 1) {
        assert.equal(url, "/api/v1/payroll/runs/run-a/bonuses"); assert.equal(init?.method, "POST");
        assert.deepEqual(init?.headers, { "x-organization-id": "org-a", "Content-Type": "application/json" });
        assert.deepEqual(JSON.parse(init?.body as string), { employeeId: item.employeeId, bonusType: "other", amountMinor, description: caller });
        return Response.json({ bonus });
      }
      assert.deepEqual(init?.headers, { "x-organization-id": "org-a" });
      return Response.json(String(url).endsWith("/bonuses") ? { bonuses: [bonus] } : { run });
    }, async () => {
      const h = view({ bonusForm: { ...form, amount } }, locale); await action(h, t("addBonus"), true)(); assert.equal(requests, 3);
      assert.ok(has(h, "run", run)); assert.ok(has(h, "bonuses", [bonus])); assert.ok(has(h, "success", t("bonusAdded")));
      assert.ok(has(h, "bonusDialogOpen", false)); assert.ok(has(h, "bonusForm", { employeeId: "", bonusType: "", amount: "", description: "" })); assert.ok(has(h, "creatingBonus", false));
    });
  }
});

test("bonus failures retain the open form and reject invalid money before sending", async () => {
  for (const locale of locales) for (const mode of ["required", "invalid", "http", "json", "envelope", "refresh-run", "refresh-bonus", "no-org", "storage"]) {
    let requests = 0; const t = translator(locale);
    await withIO(async url => {
      requests++;
      if (mode === "http") return Response.json({ error: "Private server" }, { status: 409 });
      if (mode === "json") return new Response("Private parser");
      if (mode === "envelope") return Response.json({});
      if (requests === 1) return Response.json({ bonus });
      if (String(url).endsWith("/bonuses")) return Response.json(mode === "refresh-bonus" ? { bonuses: [{}] } : { bonuses: [bonus] });
      return Response.json(mode === "refresh-run" ? { run: {} } : { run });
    }, async () => {
      const h = view({ bonusForm: { ...form, amount: mode === "required" ? "" : mode === "invalid" ? "1.001" : form.amount } }, locale);
      await action(h, t("addBonus"), true)();
      assert.equal(requests, ["required", "invalid", "no-org", "storage"].includes(mode) ? 0 : mode.startsWith("refresh-") ? 3 : 1);
      assert.ok(has(h, "error", t(mode === "required" ? "required" : mode === "no-org" || mode === "storage" ? "organizationRequired" : "bonusFailed")));
      assert.ok(!h.events.some(v => Array.isArray(v) && ["success", "bonusForm", "bonusDialogOpen", "run", "bonuses"].includes(v[0])));
      assert.ok(!JSON.stringify(h.events).includes("Private"));
      if (!["required", "no-org", "storage"].includes(mode)) assert.ok(has(h, "creatingBonus", false));
    }, mode === "no-org" ? null : "org-a", mode === "storage");
  }
});

test("owned copy audit and Persian-script assertions document the data-only exception", () => {
  const ast = ts.createSourceFile(page, readFileSync(page, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function visit(n: ts.Node) {
    if (ts.isJsxText(n)) assert.doesNotMatch(n.text.trim(), /[A-Za-z]/, n.text);
    if (ts.isJsxAttribute(n) && ["title", "placeholder", "aria-label"].includes(n.name.getText(ast)) && n.initializer && ts.isStringLiteral(n.initializer)) assert.fail(n.getText(ast));
    ts.forEachChild(n, visit);
  }
  visit(ast);
  function leaves(value: unknown, prefix = "") {
    for (const [key, text] of Object.entries(value as Record<string, unknown>)) {
      if (typeof text !== "string") leaves(text, prefix + key + ".");
      else if (prefix + key === "employeeOption") assert.equal(text, en.PayrollRunDetail.employeeOption);
      else assert.match(text, /[\u0600-\u06ff]/, prefix + key);
    }
  }
  leaves(fa.PayrollRunDetail);
  assert.doesNotMatch(readFileSync(page, "utf8"), /err\.message|data\.error|replace\(\/_\/g/);
});
