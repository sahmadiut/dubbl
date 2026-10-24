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
import { payrollSettingsJson } from "../i18n/payroll-settings-presentation";
import { payrollCentsDecimal } from "../lib/money/payroll-input";
import { payrollMoneyDisplay } from "../lib/money/payroll-display";
import { renderWithPresentation } from "./helpers/presentation";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const page = "app/(dashboard)/payroll/settings/page.tsx";
const locales = ["en-US", "fa-IR"] as const;
const noop = () => {};
const caller = "<script>caller & name</script>";
const escape = (v: string) => v.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
const translator = (locale: typeof locales[number]) => createTranslator({ locale, messages: locale === "en-US" ? en : fa, namespace: "PayrollSettings" });
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
    if (id.endsWith("/data-table")) return { DataTable: (props: { columns: { header: string; render: (row: unknown) => ReactNode }[]; data: unknown[]; emptyMessage: string }) => createElement("section", null, props.columns.map((c, i) => createElement("div", { key: i }, c.header, props.data.map((r, j) => createElement("div", { key: j }, c.render(r))))), props.data.length ? null : props.emptyMessage) };
    if (id === "react") return { ...React, useState: (initial: unknown) => {
      const key = names[index++]; return [Object.hasOwn(states, key) ? states[key] : initial, (v: unknown) => h.events.push([key, v])];
    }, useEffect: (fn: () => void | (() => void)) => h.effects.push(fn), useMemo: (fn: () => unknown) => fn(), useCallback: (fn: unknown) => fn,
    useRef: (initial: unknown) => h.refs[refNames[refIndex++]] = { current: initial } };
    if (id === "react/jsx-runtime") return { ...jsx, jsx: capture(jsx.jsx), jsxs: capture(jsx.jsxs) };
    if (id === "next-intl") return nextIntl;
    if (id === "sonner") return { toast: { error: (v: unknown) => h.events.push(["error", v]), success: (v: unknown) => h.events.push(["success", v]) } };
    if (id.endsWith("/topbar")) return { useTopbarAction: noop };
    if (id.endsWith("/use-debounce")) return { useDebounce: (v: string) => states.debouncedSearch ?? v };
    if (id.endsWith("/use-document-title")) return { useDocumentTitle: (v: string) => h.events.push(["title", v]) };
    if (id.endsWith("/use-confirm")) return { useConfirm: () => ({ dialog: null, confirm: async (v: unknown) => { h.events.push(["confirm", v]); return states.confirmed !== false; } }) };
    if (id.endsWith("/brand-loader")) return BrandLoader;
    for (const [suffix, names] of Object.entries({ "/ui/dialog": ["Dialog", "DialogContent", "DialogHeader", "DialogTitle", "DialogDescription", "DialogFooter"], "/ui/select": ["Select", "SelectContent", "SelectItem", "SelectTrigger", "SelectValue"], "/ui/tabs": ["Tabs", "TabsList", "TabsTrigger"], "/ui/sheet": ["Sheet", "SheetContent", "SheetHeader", "SheetTitle", "SheetDescription", "SheetFooter"], "/ui/date-picker": ["DatePicker"], "/ui/currency-select": ["CurrencySelect"] }))
      if (id.endsWith(suffix)) return Object.fromEntries(names.map(key => [key, inline(key)]));
    return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  };
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function("require", "module", "exports", code)(load, compiled, compiled.exports);
  const html = renderWithPresentation(createElement(compiled.exports[name]), locale);
  return { ...h, html };
}
const flush = async () => { for (let i = 0; i < 6; i++) await new Promise(resolve => setImmediate(resolve)); };
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
function button(h: ReturnType<typeof render>, label: string, last = false) {
  function text(v: unknown): string {
    if (typeof v === "string" || typeof v === "number") return String(v);
    if (Array.isArray(v)) return v.map(text).join("");
    if (React.isValidElement<{ children?: ReactNode }>(v)) return text(v.props.children);
    return "";
  }
  const matches = h.captured.filter(c => typeof c.props.onClick === "function" && text(c.props.children) === label);
  const c = last ? matches.at(-1) : matches[0]; assert.ok(c, label);
  return c.props.onClick as () => Promise<void>;
}

const settings = { defaultTaxRate: 29, overtimeThresholdHours: 40, overtimeMultiplier: 1.5,
  defaultCurrency: "KWD", salaryExpenseAccountCode: "5100", taxPayableAccountCode: null,
  bankAccountCode: "1100", autoApprovalEnabled: true };
const deduction = { id: "d", name: caller, description: null, category: "pre_tax", defaultAmount: 29,
  defaultAmountMinor: "29", defaultPercent: 2.5, isActive: true };
const bracket = { id: "b", name: caller, jurisdictionLevel: "federal", jurisdiction: caller,
  minIncome: 29, minIncomeMinor: "29", maxIncome: 1250, maxIncomeMinor: "1250", rate: 29 };
const shift = { id: "s", name: caller, shiftType: "night", startTime: "22:00", endTime: "06:00", premiumPercent: 2.5, isActive: false };
const policy = { id: "p", name: caller, leaveType: "sick", accrualMethod: "monthly", accrualRate: 7.5, maxBalance: 40, isActive: true };
const chain = { id: "c", name: caller, description: null, isActive: true, steps: [{ id: "step", stepOrder: 1, approverId: "approver" }] };
const band = { id: "band", name: caller, level: caller, currency: "KWD", minSalary: 29, minSalaryMinor: "29",
  midSalary: 1250, midSalaryMinor: "1250", maxSalary: Number.MAX_SAFE_INTEGER, maxSalaryMinor: "9007199254740991" };
const loaded = { loading: false, settings, deductionTypes: [deduction], taxBrackets: [bracket], shifts: [shift],
  leavePolicies: [policy], approvalChains: [chain], compensationBands: [band],
  deductionDrawer: true, bracketDrawer: true, shiftDrawer: true, leaveDrawer: true, bandDrawer: true };
const endpoints = ["settings", "deductions/types", "tax/brackets", "shifts", "leave/policies", "approval-chains", "compensation/bands"];
const envelopes = [{ settings }, { data: [deduction] }, { data: [bracket] }, { data: [shift] }, { data: [policy] }, { data: [chain] }, { data: [band] }];
const kinds = ["settings", "deductions", "brackets", "shifts", "policies", "chains", "bands"] as const;
const listReply = (url: unknown) => {
  const index = endpoints.indexOf(String(url).replace("/api/v1/payroll/", "")); assert.ok(index >= 0); return Response.json(envelopes[index]);
};

test("production settings JSX renders paired sections, drawers, enums, exact cents and escaped saved data", () => {
  assert.deepEqual(Object.keys(en.PayrollSettings), Object.keys(fa.PayrollSettings));
  for (const value of Object.values(fa.PayrollSettings)) assert.match(value, /[\u0600-\u06ff]/);
  for (const locale of locales) {
    const t = translator(locale), h = render(page, loaded, locale);
    for (const key of ["general", "generalDescription", "taxRate", "overtimeThreshold", "overtimeMultiplier", "currency", "salaryAccount", "taxAccount", "bankAccount", "autoApprove", "save", "deductions", "deductionsDescription", "brackets", "bracketsDescription", "shifts", "shiftsDescription", "policies", "policiesDescription", "chains", "chainsDescription", "bands", "bandsDescription", "portal", "portalDescription", "openPortal", "deductionTitle", "deductionDescription", "bracketTitle", "bracketDescription", "shiftDescription", "leaveTitle", "leaveDescription", "bandTitle", "bandDescription", "name", "category", "defaultAmount", "defaultPercent", "jurisdiction", "rate", "minIncome", "maxIncome", "unlimited", "type", "premium", "startTime", "endTime", "leaveType", "accrual", "hoursEarned", "maxBalance", "level", "levelPlaceholder", "minSalary", "midSalary", "maxSalary", "create", "cancel"] as const) assert.ok(h.html.includes(escape(t(key))), key);
    assert.ok(h.html.includes(escape(t("bracketSummary", { level: t("federal"), jurisdiction: ` · ${caller}`, min: "0.29", ceiling: t("bracketCeiling", { amount: "12.50" }), rate: "0.29" }))));
    assert.ok(h.html.includes(escape(t("shiftSummary", { start: "22:00", end: "06:00", type: t("night") }))));
    assert.ok(h.html.includes(escape(t("leaveSummary", { type: t("sick"), hours: "7.5", method: t("monthly") }))));
    assert.ok(h.html.includes(escape(t("steps", { count: 1 }))));
    assert.ok(h.html.includes(escape(payrollMoneyDisplay(Number.MAX_SAFE_INTEGER, "KWD", resolvePresentation({ user: { language: locale } })))));
    assert.ok(h.html.includes(escape(caller))); assert.ok(!h.html.includes("<script>"));
    assert.ok(h.html.includes('href="/payroll/self-service"'));
    const options = h.captured.filter(c => c.kind === "SelectItem");
    assert.deepEqual(options.map(c => c.props.value), ["pre_tax", "post_tax", "federal", "state", "local", "regular", "overtime", "night", "weekend", "holiday", "vacation", "sick", "personal", "parental", "bereavement", "unpaid", "other", "per_pay_period", "monthly", "annually", "front_loaded"]);
    assert.deepEqual(options.map(c => c.props.children), ["preTax", "postTax", "federal", "state", "local", "regular", "overtime", "night", "weekend", "holiday", "vacation", "sick", "personal", "parental", "bereavement", "unpaid", "other", "perPayPeriod", "monthly", "annually", "frontLoaded"].map(k => t(k as "regular")));
    const empty = render(page, { loading: false }, locale);
    for (const key of ["noDeductions", "noBrackets", "noShifts", "noPolicies", "noChains", "noBands"] as const) assert.ok(empty.html.includes(escape(t(key))));
    assert.ok(render(page, { ...loaded, saving: true }, locale).html.includes(escape(t("saving"))));
    assert.ok(!render(page, {}, locale).html.includes(escape(t("general"))));
    assert.ok(render(page, { ...loaded, moneyError: t("loadFailed") }, locale).html.includes('role="alert"'));
    const unknown = render(page, { ...loaded, deductionTypes: [{ ...deduction, category: "constructor" }], shifts: [{ ...shift, shiftType: "alien" }], leavePolicies: [{ ...policy, leaveType: "alien", accrualMethod: "alien" }], taxBrackets: [{ ...bracket, jurisdictionLevel: "alien", maxIncome: null, maxIncomeMinor: null }] }, locale);
    assert.ok(unknown.html.includes(escape(t("unknown")))); assert.ok(!unknown.html.includes("alien"));
  }
  assert.equal(payrollCentsDecimal(29), "0.29");
});

test("settings readers reject HTTP/JSON/envelope, missing fields, duplicate rows and invalid units", async () => {
  for (const [i, kind] of kinds.entries()) {
    assert.deepEqual(await payrollSettingsJson(Response.json(envelopes[i]), kind), envelopes[i]);
    await assert.rejects(payrollSettingsJson(Response.json(envelopes[i], { status: 403 }), kind));
    await assert.rejects(payrollSettingsJson(new Response("Private parser diagnostic"), kind));
    for (const bad of [null, [], {}, { success: true }, { ...envelopes[i], error: "Private" }]) await assert.rejects(payrollSettingsJson(Response.json(bad), kind));
    if (i) {
      const rows = (envelopes[i] as { data: unknown[] }).data;
      await assert.rejects(payrollSettingsJson(Response.json({ data: [...rows, ...rows] }), kind));
    }
  }
  for (const [kind, row, changes] of [
    ["deductions", deduction, [{ defaultAmountMinor: "029" }, { defaultAmountMinor: "30" }, { defaultAmount: null }, { defaultPercent: 2.9 }, { isActive: "yes" }]],
    ["brackets", bracket, [{ rate: 0.1 }, { rate: 10001 }, { maxIncome: 29, maxIncomeMinor: "29" }, { minIncomeMinor: undefined }]],
    ["shifts", shift, [{ startTime: "25:00" }, { premiumPercent: -1 }, { endTime: null }]],
    ["policies", policy, [{ accrualRate: 2.9 }, { maxBalance: -1 }, { accrualMethod: null }]],
    ["chains", chain, [{ steps: null }, { steps: [{ id: "s", stepOrder: 0.5, approverId: "a" }] }]],
    ["bands", band, [{ maxSalaryMinor: "9007199254740992" }, { currency: "ZZZ" }]],
  ] as const) for (const change of changes) await assert.rejects(payrollSettingsJson(Response.json({ data: [{ ...row, ...change }] }), kind));
  for (const change of [{ defaultTaxRate: 1.5 }, { overtimeMultiplier: 1.1 }, { defaultCurrency: "ZZZ" }, { autoApprovalEnabled: null }, { bankAccountCode: 1 }]) await assert.rejects(payrollSettingsJson(Response.json({ settings: { ...settings, ...change } }), "settings"));
  await payrollSettingsJson(Response.json({ settings: { ...settings, overtimeThresholdHours: 2 ** 54, overtimeMultiplier: 2 ** 54 } }), "settings");
  assert.deepEqual(await payrollSettingsJson(Response.json({ success: true }), "deleted"), { success: true });
  await assert.rejects(payrollSettingsJson(Response.json({ success: false }), "deleted"));
});

test("seven checked reads adopt atomically, release loading and suppress obsolete replies and raw errors", async () => {
  for (const locale of locales) {
    const t = translator(locale);
    await withIO(async (url, init) => {
      assert.deepEqual(init?.headers, { "x-organization-id": "org-a" }); return listReply(url);
    }, async () => {
      const h = render(page, {}, locale); h.effects[0](); await flush();
      for (const [key, value] of [["settings", settings], ["deductionTypes", [deduction]], ["taxBrackets", [bracket]], ["shifts", [shift]], ["leavePolicies", [policy]], ["approvalChains", [chain]], ["compensationBands", [band]]]) assert.ok(has(h, key as string, value));
      assert.ok(has(h, "defaultTaxPercent", "0.29")); assert.ok(has(h, "moneyError", null)); assert.ok(has(h, "loading", false));
    });
    for (const fail of [() => Response.json({ error: "Private server" }, { status: 500 }), () => new Response("Private JSON"), () => Response.json({ data: [{ ...shift, startTime: null }] }), () => { throw new Error("Private network"); }]) await withIO(async url => String(url).endsWith("/shifts") ? fail() : listReply(url), async () => {
      const h = render(page, {}, locale); h.effects[0](); await flush();
      assert.ok(has(h, "moneyError", t("loadFailed"))); assert.ok(has(h, "loading", false));
      assert.ok(!h.events.some(e => Array.isArray(e) && e[0] === "settings")); assert.ok(!JSON.stringify(h.events).includes("Private"));
    });
    for (const throws of [false, true]) await withIO(async () => { throw new Error("Must not fetch"); }, async () => {
      const h = render(page, {}, locale); h.effects[0](); await flush(); assert.ok(has(h, "moneyError", t("loadFailed"))); assert.ok(has(h, "loading", false));
    }, null, throws);
    let finish!: (r: Response) => void;
    await withIO(async url => String(url).endsWith("/settings") ? new Promise<Response>(r => { finish = r; }) : listReply(url), async () => {
      const h = render(page, {}, locale), cleanup = h.effects[0]()!; await flush(); const count = h.events.length;
      cleanup(); finish(Response.json({ settings })); await flush(); assert.equal(h.events.length, count);
    });
  }
});

const creates = [
  { index: 1, state: "newDeduction", values: { name: caller, category: "post_tax", defaultAmount: "0.29", defaultPercent: "2.5" }, payload: { name: caller, category: "post_tax", defaultAmountMinor: "29", defaultPercent: 2.5 }, response: { deductionType: deduction }, success: "deductionAdded", failure: "deductionFailed", drawer: "deductionDrawer" },
  { index: 2, state: "newBracket", values: { name: caller, jurisdictionLevel: "state", minIncome: "0.29", maxIncome: "", rate: "0.29" }, payload: { name: caller, jurisdictionLevel: "state", minIncomeMinor: "29", maxIncomeMinor: null, rate: 29 }, response: { bracket }, success: "bracketAdded", failure: "bracketFailed", drawer: "bracketDrawer" },
  { index: 3, state: "newShift", values: { name: caller, shiftType: "night", startTime: "22:00", endTime: "06:00", premiumPercent: "2.5" }, payload: { name: caller, shiftType: "night", startTime: "22:00", endTime: "06:00", premiumPercent: 2.5 }, response: { shift }, success: "shiftAdded", failure: "shiftFailed", drawer: "shiftDrawer" },
  { index: 4, state: "newLeave", values: { name: caller, leaveType: "sick", accrualMethod: "monthly", accrualRate: "7.5", maxBalance: "" }, payload: { name: caller, leaveType: "sick", accrualMethod: "monthly", accrualRate: 7.5, maxBalance: null }, response: { policy }, success: "policyAdded", failure: "policyFailed", drawer: "leaveDrawer" },
  { index: 6, state: "newBand", values: { name: caller, level: "L3", minSalary: "0.29", midSalary: "12.50", maxSalary: "90071992547409.91" }, payload: { name: caller, level: "L3", minSalaryMinor: "29", midSalaryMinor: "1250", maxSalaryMinor: "9007199254740991" }, response: { band }, success: "bandAdded", failure: "bandFailed", drawer: "bandDrawer" },
] as const;
test("all five create callbacks preserve request units and retain editor values on failures", async () => {
  for (const locale of locales) for (const c of creates) {
    const t = translator(locale);
    for (const outcome of ["ok", "http", "json", "shape", "network"]) await withIO(async (url, init) => {
      if (!init?.method) return listReply(url);
      assert.equal(url, `/api/v1/payroll/${endpoints[c.index]}`); assert.equal(init.method, "POST");
      assert.deepEqual(init.headers, { "Content-Type": "application/json", "x-organization-id": "org-a" });
      assert.deepEqual(JSON.parse(init.body as string), c.payload);
      if (outcome === "network") throw new Error("Private network");
      return outcome === "ok" ? Response.json(c.response) : outcome === "http" ? Response.json({ error: "Private server" }, { status: 409 }) : outcome === "json" ? new Response("Private JSON") : Response.json({ success: true });
    }, async () => {
      const h = render(page, { ...loaded, [c.state]: c.values }, locale);
      const forms = h.captured.filter(c => c.kind === "form");
      const form = forms[creates.indexOf(c)]; assert.ok(form);
      (form.props.onSubmit as (e: { preventDefault: () => void }) => void)({ preventDefault: noop }); await flush();
      if (outcome === "ok") { assert.ok(has(h, "success", t(c.success))); assert.ok(has(h, c.drawer, false)); }
      else { assert.ok(has(h, "error", t(c.failure))); assert.ok(!has(h, c.drawer, false)); assert.ok(!h.events.some(e => Array.isArray(e) && e[0] === c.state)); }
      assert.ok(!JSON.stringify(h.events).includes("Private"));
    });
  }
});

test("save and confirmed delete callbacks check success and localize failures", async () => {
  for (const locale of locales) {
    const t = translator(locale);
    for (const ok of [false, true]) await withIO(async (url, init) => {
      assert.equal(init?.method, "PUT"); assert.equal(url, "/api/v1/payroll/settings");
      assert.deepEqual(JSON.parse(init.body as string), { ...settings, defaultTaxRate: 29 });
      return Response.json(ok ? { settings } : { error: "Private" }, { status: ok ? 200 : 400 });
    }, async () => {
      const h = render(page, { ...loaded, defaultTaxPercent: "0.29" }, locale); await button(h, t("save"))();
      assert.ok(has(h, ok ? "success" : "error", t(ok ? "saved" : "saveFailed"))); assert.ok(has(h, "saving", false));
    });
    for (const entity of ["Deduction", "Band"] as const) for (const outcome of ["ok", "cancel", "http", "shape", "network"]) await withIO(async (url, init) => {
      if (!init?.method) return listReply(url);
      assert.notEqual(outcome, "cancel"); assert.equal(init.method, "DELETE");
      assert.equal(url, `/api/v1/payroll/${entity === "Deduction" ? "deductions/types/d" : "compensation/bands/band"}`);
      assert.deepEqual(init.headers, { "x-organization-id": "org-a" });
      if (outcome === "network") throw new Error("Private network");
      return Response.json(outcome === "ok" ? { success: true } : { error: "Private" }, { status: outcome === "http" ? 409 : 200 });
    }, async () => {
      const h = render(page, { ...loaded, confirmed: outcome !== "cancel" }, locale);
      const control = h.captured.find(c => c.props["aria-label"] === t(`delete${entity}Title`))!;
      await (control.props.onClick as () => Promise<void>)(); await flush();
      assert.ok(has(h, "confirm", { title: t(`delete${entity}Title`), description: t(entity === "Deduction" ? "deleteDeductionDescription" : "cannotUndo"), confirmLabel: t("delete"), destructive: true }));
      if (!["ok", "cancel"].includes(outcome)) assert.ok(has(h, "error", t(`delete${entity}Failed`)));
      assert.ok(!JSON.stringify(h.events).includes("Private"));
    });
  }
});
