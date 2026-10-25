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
import { catalogText, visibleText } from "./helpers/catalog-text";
import ts from "typescript";
import * as BrandLoader from "../components/dashboard/brand-loader";
import { payrollOutputJson, payslipStatuses, taxStatuses, w2Fields } from "../i18n/payroll-output-presentation";
import { payrollMoneyDisplay } from "../lib/money/payroll-display";
import { renderWithPresentation } from "./helpers/presentation";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const slipsPage = "app/(dashboard)/payroll/runs/[id]/payslips/page.tsx";
const formsPage = "app/(dashboard)/payroll/tax-forms/page.tsx";
const detailPage = "app/(dashboard)/payroll/tax-forms/[id]/page.tsx";
const pages = [slipsPage, formsPage, detailPage];
const locales = ["en-US", "fa-IR"] as const;
const caller = "<script>caller & name</script>";
const escape = (v: string) => v.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
const translator = (locale: typeof locales[number]) => createTranslator({ locale, messages: catalogText(locale === "en-US" ? en : fa), namespace: "PayrollOutputs" });
type Capture = { kind: string; props: Record<string, unknown> };
type Harness = { captured: Capture[]; events: unknown[]; effects: (() => void | (() => void))[]; refs: Record<string, { current: unknown }> };

// Real production templates, next-intl, footer, money inputs and controls.
// Hook/IO state and portal/date/currency-picker boundaries are controlled.
function render(file: string, states: Record<string, unknown> = {}, locale: typeof locales[number] = "en-US", props: Record<string, unknown> = {}, component?: string) {
  const ast = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const name = component ?? (file === slipsPage ? "RunPayslipsPage" : file === formsPage ? "TaxFormsPage" : "TaxFormDetailPage");
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
    if (id === "next/navigation") return { useParams: () => ({ id: file === detailPage ? "form-a" : "run-a" }), useRouter: () => ({ push: (v: string) => h.events.push(["push", v]) }) };
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
const money = (row: Record<string, unknown>) => ({ ...row, ...Object.fromEntries(Object.entries(row).filter(([, v]) => typeof v === "number").map(([k, v]) => [k + "Minor", String(v)])) });
const item = { ...money({ grossAmount: Number.MAX_SAFE_INTEGER, netAmount: -Number.MAX_SAFE_INTEGER, taxAmount: 29, deductions: 0, preTaxDeductions: 0, postTaxDeductions: 0 }), id: "item-a", employeeId: "employee-a", employee: { name: caller, employeeNumber: "EMP-01" }, type: "regular_salary", description: null, currency: "JPY", fxRate: 1, rateExact: "1" };
const run = { ...money({ totalGross: 29, totalNet: 0, totalDeductions: 29 }), id: "run-a", payPeriodStart: "2024-01-01", payPeriodEnd: "2024-01-07", baseCurrency: "JPY", status: "completed", runType: "regular", approvalStatus: null, processedAt: null, journalEntryId: null, items: [item] };
const payslip = { ...money({ grossAmount: Number.MAX_SAFE_INTEGER, netAmount: -Number.MAX_SAFE_INTEGER, taxAmount: 29, ytdGross: 1250, ytdTax: 29, ytdNet: 1221 }), id: "slip-a", employeeId: item.employeeId, payrollRunId: run.id, payrollItemId: item.id, status: "generated", currency: "JPY", deductionsBreakdown: [{ ...money({ amount: 29 }), name: caller, category: "pre_tax" }] };
const row = { payrollItemId: item.id, employeeId: item.employeeId, name: caller, employeeNumber: "EMP-01", payslip };
const form = { id: "form-a", recipientName: caller, recipientTaxId: "private1234", recipientType: "employee", formType: "w2", taxYear: 2025, status: "generated", formData: { ...money({ box1_wages: Number.MAX_SAFE_INTEGER, box2_federal_tax: 29 }), currency: "USD", employee_email: caller, employee_number: "EMP-01", box13_retirement_plan: true } };
const generation = { id: "gen-a", taxYear: 2025, formType: "w2", status: "generated", generatedAt: "2025-01-08T00:00:00Z", createdAt: "2025-01-08T00:00:00Z", forms: [form] };
const slipView = (states: Record<string, unknown> = {}, locale: typeof locales[number] = "en-US") => render(slipsPage, { loading: false, run, rows: [row], expanded: payslip.id, ...states }, locale);
const formsView = (states: Record<string, unknown> = {}, locale: typeof locales[number] = "en-US") => render(formsPage, { loading: false, generations: [generation], expandedId: generation.id, ...states }, locale);
const detailView = (states: Record<string, unknown> = {}, locale: typeof locales[number] = "en-US") => render(detailPage, { loading: false, form, ...states }, locale);
const action = (h: Harness, label: string) => {
  const c = h.captured.find(c => typeof c.props.onClick === "function" && (c.props.children === label || Array.isArray(c.props.children) && c.props.children.includes(label) || c.props["aria-label"] === label));
  assert.ok(c, label); return c.props.onClick as (event?: { stopPropagation: () => void }) => Promise<void>;
};
async function withIO(fetcher: typeof fetch, work: () => Promise<void>, org: string | null = "org-a", storageThrows = false) {
  const original = globalThis.fetch, storage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  globalThis.fetch = fetcher;
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: (key: string) => {
    assert.equal(key, "activeOrgId"); if (storageThrows) throw new Error("Private storage"); return org;
  } } });
  try { await work(); } finally { globalThis.fetch = original; if (storage) Object.defineProperty(globalThis, "localStorage", storage); else Reflect.deleteProperty(globalThis, "localStorage"); }
}

test("payslips render bilingual detail, statuses, escaped data, maximal cents and bigint differences", () => {
  for (const locale of locales) {
    const t = translator(locale), h = slipView({}, locale);
    for (const key of ["backToRun", "payslips", "beforeDeductions", "taxesDeductions", "takeHome", "taxWithheld", "otherDeductions", "deductions", "yearSoFar", "earned", "tax", "hide"] as const) assert.ok(h.html.includes(escape(t(key))), key);
    assert.ok(has(h, "title", t("payslipsDocumentTitle")));
    assert.ok(visibleText(h.html).includes(escape(t("period", { start: run.payPeriodStart, end: run.payPeriodEnd }))));
    assert.ok(h.html.includes(escape(caller))); assert.ok(!h.html.includes("<script>"));
    assert.ok(h.html.includes(escape(payrollMoneyDisplay(18014398509481982n, "JPY", resolvePresentation({ user: { language: locale } })))));
    assert.ok(h.html.includes(escape(payrollMoneyDisplay(Number.MAX_SAFE_INTEGER, "JPY", resolvePresentation({ user: { language: locale } })))));
    for (const status of payslipStatuses) assert.ok(slipView({ rows: [{ ...row, payslip: { ...payslip, status } }] }, locale).html.includes(escape(t(`payslipStatus_${status}`))));
    for (const count of [1, 2]) {
      const h = slipView({ rows: [row, ...Array.from({ length: count }, (_, i) => ({ ...row, payrollItemId: String(i), payslip: null }))] }, locale);
      assert.ok(h.html.includes(escape(t("missingPayslips", { count }))));
    }
    for (const [states, key] of [[{ run: null }, "runNotFound"], [{ rows: [] }, "noPayslipsHelp"], [{ moneyError: "payslipsReadFailed" }, "payslipsReadFailed"]] as const) assert.ok(slipView(states, locale).html.includes(escape(t(key))));
    assert.ok(slipView({ loading: true }, locale).html.includes(escape((locale === "en-US" ? en : fa).SharedUI.loading2)));
    for (const category of ["pre_tax", "post_tax"] as const) assert.ok(slipView({ rows: [{ ...row, payslip: { ...payslip, deductionsBreakdown: [{ ...money({ amount: 0 }), name: "", category }] } }] }, locale).html.includes(escape(t(`deductionCategory_${category}`))));
  }
});

test("tax list/detail render bilingual statutory labels, metadata, masking and unchanged year choices", () => {
  for (const locale of locales) {
    const t = translator(locale), list = formsView({}, locale), detail = detailView({}, locale);
    for (const key of ["taxForms", "taxHelp", "generateNec", "generateW2", "taxYear", "formType", "status", "formsCount", "generated", "recipient", "taxId", "keyAmount", "actions"] as const) assert.ok(list.html.includes(escape(t(key))), key);
    for (const key of ["formType", "taxYear", "recipient", "taxId", "formData", "download", ...w2Fields, "metadata_currency", "metadata_employee_email", "metadata_employee_number"] as const) assert.ok(detail.html.includes(escape(t(key))), key);
    assert.ok(has(list, "title", t("taxDocumentTitle"))); assert.ok(has(detail, "title", t("taxDetailDocumentTitle")));
    for (const h of [list, detail]) { assert.ok(h.html.includes("***-1234")); assert.ok(!h.html.includes("private1234")); assert.ok(h.html.includes(escape(caller))); assert.ok(!h.html.includes("<script>")); assert.ok(h.html.includes(escape(payrollMoneyDisplay(Number.MAX_SAFE_INTEGER, "USD", resolvePresentation({ user: { language: locale } }))))); }
    assert.ok(visibleText(detail.html).includes(escape(t("recipientHeading", { name: caller, type: t("recipientType_employee") }))));
    assert.ok(detail.html.includes(escape(t("formHeading", { type: "W-2", year: "2025" }))));
    assert.deepEqual(list.captured.filter(c => c.kind === "SelectItem").map(c => c.props.value), Array.from({ length: 7 }, (_, i) => String(2020 + i)));
    assert.ok(list.html.includes("2025-01-08"));
    assert.ok(formsView({ generations: [{ ...generation, formType: "1099_misc", forms: [] }] }, locale).html.includes("1099-MISC"));
    for (const status of taxStatuses) {
      assert.ok(formsView({ generations: [{ ...generation, status }] }, locale).html.includes(escape(t(`taxStatus_${status}`))));
      assert.ok(detailView({ form: { ...form, status } }, locale).html.includes(escape(t(`taxStatus_${status}`))));
    }
    const nec = { ...form, formType: "1099_nec", recipientType: "contractor", formData: { ...money({ box1_nonemployee_compensation: 29 }), currency: "USD", recipient_company: caller, recipient_email: caller } };
    const h = detailView({ form: nec }, locale);
    for (const key of ["box1_nonemployee_compensation", "metadata_recipient_company", "metadata_recipient_email", "recipientType_contractor"] as const) assert.ok(h.html.includes(escape(t(key))));
    assert.ok(formsView({ generations: [] }, locale).html.includes(escape(t("noGenerations"))));
    assert.ok(detailView({ form: null }, locale).html.includes(escape(t("formNotFound"))));
    for (const file of [formsPage, detailPage]) {
      assert.ok(render(file, {}, locale).html.includes(escape(t("loading"))));
      assert.ok(render(file, { loading: false, moneyError: "taxReadFailed" }, locale).html.includes(escape(t("taxReadFailed"))));
    }
    assert.ok(formsView({ generating: true }, locale).captured.filter(c => c.kind === "Button" && c.props.disabled).every(c => c.props.children === t("generating")));
  }
});

test("output readers reject malformed envelopes, missing fields, money aliases, enums and metadata", async () => {
  const bodies = { run: { run }, payslips: { payslips: [payslip] }, payslip: { payslip }, generations: { data: [generation] }, form, generated: { generation, formsGenerated: 0 } };
  for (const [kind, body] of Object.entries(bodies)) {
    const k = kind as keyof typeof bodies;
    assert.deepEqual(await payrollOutputJson(Response.json(body), k), body);
    for (const bad of [null, [], {}, { error: "Private error" }]) await assert.rejects(payrollOutputJson(Response.json(bad), k));
    await assert.rejects(payrollOutputJson(Response.json(body, { status: 403 }), k));
    await assert.rejects(payrollOutputJson(new Response("Private JSON"), k));
  }
  for (const patch of [{ id: "" }, { payrollItemId: null }, { employeeId: "" }, { status: "private" }, { currency: "usd" }, { grossAmountMinor: "29" }, { netAmount: undefined }, { ytdGross: 0.29 }, { deductionsBreakdown: [{}] }, { deductionsBreakdown: [{ ...money({ amount: 0 }), name: null, category: "pre_tax" }] }]) await assert.rejects(payrollOutputJson(Response.json({ payslips: [{ ...payslip, ...patch }] }), "payslips"));
  for (const patch of [{ id: "" }, { recipientName: null }, { recipientTaxId: 5 }, { status: "private" }, { formType: "1099_misc" }, { recipientType: "contractor" }, { taxYear: "2025" }, { formData: { box1_wagesMinor: "29" } }, { formData: { ...form.formData, box1_wagesMinor: "29" } }, { formData: { ...form.formData, secret_key: "private" } }, { formData: { ...form.formData, employee_email: {} } }, { formData: { ...form.formData, box13_retirement_plan: "true" } }, { generation: { id: "", status: "private" } }]) await assert.rejects(payrollOutputJson(Response.json({ ...form, ...patch }), "form"));
  for (const patch of [{ createdAt: "private" }, { generatedAt: "private" }, { forms: null }, { formType: "1099_nec" }, { taxYear: 2024 }]) await assert.rejects(payrollOutputJson(Response.json({ data: [{ ...generation, ...patch }] }), "generations"));
  for (const formsGenerated of [-1, 0.1, "0", null]) await assert.rejects(payrollOutputJson(Response.json({ generation, formsGenerated }), "generated"));
  const historic = { data: [{ ...generation, formType: "1099_misc", status: "corrected", forms: [] }] };
  assert.deepEqual(await payrollOutputJson(Response.json(historic), "generations"), historic);
});

test("initial output reads adopt validated data, handle absent organization and finish loading", async () => {
  for (const file of pages) for (const locale of locales) {
    let requests = 0;
    await withIO(async (url, init) => {
      requests++; assert.deepEqual(init?.headers, { "x-organization-id": "org-a" });
      assert.equal(url, file === formsPage ? "/api/v1/payroll/tax-forms" : file === detailPage ? "/api/v1/payroll/tax-forms/form-a" : requests === 1 ? "/api/v1/payroll/runs/run-a" : "/api/v1/payroll/runs/run-a/payslips");
      return Response.json(file === formsPage ? { data: [generation] } : file === detailPage ? form : requests === 1 ? { run } : { payslips: [payslip] });
    }, async () => {
      const h = render(file, {}, locale); h.effects[0](); await flush(); assert.ok(has(h, "loading", false));
      assert.ok(has(h, file === slipsPage ? "run" : file === formsPage ? "generations" : "form", file === slipsPage ? run : file === formsPage ? [generation] : form));
    });
    for (const mode of ["http", "json", "envelope", "money", "network", "no-org", "storage", ...(file === slipsPage ? ["second", "wrong-link", "duplicate"] : [])]) {
      requests = 0;
      await withIO(async () => {
        requests++;
        if (mode === "network") throw new Error("Private network");
        if (mode === "http") return Response.json({ error: "Private server" }, { status: 403 });
        if (mode === "json") return new Response("Private parser");
        if (mode === "envelope" || mode === "second" && requests === 2) return Response.json({});
        if (file === slipsPage) return Response.json(requests === 1 ? { run: mode === "money" ? { ...run, totalGrossMinor: "1" } : run } : { payslips: mode === "wrong-link" ? [{ ...payslip, payrollRunId: "foreign" }] : mode === "duplicate" ? [payslip, payslip] : [payslip] });
        return Response.json(file === formsPage ? { data: [{ ...generation, forms: [{ ...form, formData: {} }] }] } : { ...form, formData: {} });
      }, async () => {
        const h = render(file, {}, locale); h.effects[0](); await flush();
        assert.ok(has(h, "moneyError", ["no-org", "storage"].includes(mode) ? "organizationRequired" : file === slipsPage ? "payslipsReadFailed" : "taxReadFailed"), `${file} ${mode}`);
        assert.ok(has(h, "loading", false)); assert.ok(!JSON.stringify(h.events).includes("Private"));
        assert.ok(!h.events.some(v => Array.isArray(v) && ["run", "rows", "generations", "form"].includes(v[0])));
        if (["no-org", "storage"].includes(mode)) assert.equal(requests, 0);
      }, mode === "no-org" ? null : "org-a", mode === "storage");
    }
  }
});

test("read cleanup suppresses obsolete fulfillment and failure; HTTP 404 retains not-found", async () => {
  for (const file of pages) for (const fails of [false, true]) {
    let finish!: (r: Response) => void, fail!: (e: Error) => void;
    await withIO(async () => new Promise((resolve, reject) => { finish = resolve; fail = reject; }), async () => {
      const h = render(file), cleanup = h.effects[0](); (cleanup as () => void)(); const size = h.events.length;
      if (fails) fail(new Error("Private late")); else finish(Response.json({ run, data: [generation], ...form }));
      await flush(); assert.equal(h.events.length, size);
    });
  }
  for (const file of [slipsPage, detailPage]) await withIO(async () => new Response(null, { status: 404 }), async () => {
    const h = render(file); h.effects[0](); await flush(); assert.ok(has(h, file === slipsPage ? "run" : "form", null)); assert.ok(has(h, "loading", false)); assert.ok(!has(h, "moneyError", file === slipsPage ? "payslipsReadFailed" : "taxReadFailed"));
  });
});

test("payslip toggles preserve viewed GET, retain amounts and avoid false viewed status on failure", async () => {
  for (const locale of locales) for (const mode of ["ok", "http", "json", "envelope", "money", "network", "wrong-id", "not-viewed", "no-org", "storage"]) {
    let requests = 0; const t = translator(locale);
    await withIO(async (url, init) => {
      requests++; assert.equal(url, "/api/v1/payroll/payslips/slip-a"); assert.deepEqual(init?.headers, { "x-organization-id": "org-a" }); assert.equal(init?.method, undefined);
      if (mode === "network") throw new Error("Private network");
      if (mode === "http") return Response.json({ error: "Private server" }, { status: 403 });
      if (mode === "json") return new Response("Private parser");
      return Response.json(mode === "envelope" ? {} : { payslip: { ...payslip, status: mode === "not-viewed" ? "generated" : "viewed", ...(mode === "money" ? { netAmountMinor: "29" } : {}), ...(mode === "wrong-id" ? { id: "foreign" } : {}) } });
    }, async () => {
      const h = slipView({ expanded: null }, locale); await action(h, t("viewPayslip"))(); assert.ok(has(h, "expanded", "slip-a")); assert.equal(requests, ["no-org", "storage"].includes(mode) ? 0 : 1);
      const setter = h.events.find(v => Array.isArray(v) && v[0] === "rows") as [string, (r: unknown[]) => unknown[]] | undefined;
      if (mode === "ok") assert.deepEqual(setter?.[1]([row]), [{ ...row, payslip: { ...payslip, status: "viewed" } }]);
      else { assert.equal(setter, undefined); assert.ok(has(h, "error", t(["no-org", "storage"].includes(mode) ? "organizationRequired" : "viewFailed"))); }
      assert.ok(!JSON.stringify(h.events).includes("Private"));
    }, mode === "no-org" ? null : "org-a", mode === "storage");
  }
  await withIO(async () => { assert.fail("closing/already viewed must not fetch"); }, async () => {
    const h = slipView(); await action(h, translator("en-US")("hide"))(); assert.ok(has(h, "expanded", null));
    const seen = slipView({ expanded: null, rows: [{ ...row, payslip: { ...payslip, status: "viewed" } }] }); await action(seen, translator("en-US")("viewPayslip"))();
    const back = h.captured.find(c => c.kind === "button" && Array.isArray(c.props.children) && c.props.children.includes(translator("en-US")("backToRun")))!;
    (back.props.onClick as () => void)(); assert.ok(has(h, "push", "/payroll/runs/run-a"));
  });
});

test("tax generation preserves POST values, waits for checked refresh and releases busy on failures", async () => {
  for (const locale of locales) for (const type of ["w2", "1099_nec"] as const) for (const mode of ["ok", "http", "json", "envelope", "count", "wrong-type", "refresh", "network", "no-org", "storage"]) {
    let requests = 0; const t = translator(locale);
    await withIO(async (url, init) => {
      requests++;
      if (requests === 1) {
        assert.equal(url, "/api/v1/payroll/tax-forms/generate"); assert.equal(init?.method, "POST");
        assert.deepEqual(init?.headers, { "Content-Type": "application/json", "x-organization-id": "org-a" });
        assert.deepEqual(JSON.parse(init?.body as string), { taxYear: 2025, formType: type });
        if (mode === "network") throw new Error("Private network");
        if (mode === "http") return Response.json({ error: "Private server" }, { status: 422 });
        if (mode === "json") return new Response("Private parser");
        return Response.json(mode === "envelope" ? {} : { generation: { ...generation, formType: mode === "wrong-type" ? type === "w2" ? "1099_nec" : "w2" : type }, formsGenerated: mode === "count" ? -1 : 0 });
      }
      assert.equal(url, "/api/v1/payroll/tax-forms"); assert.deepEqual(init?.headers, { "x-organization-id": "org-a" });
      return Response.json(mode === "refresh" ? { data: [{}] } : { data: [generation] });
    }, async () => {
      const h = formsView({}, locale); await action(h, t(type === "w2" ? "generateW2" : "generateNec"))();
      assert.equal(requests, ["no-org", "storage"].includes(mode) ? 0 : ["ok", "refresh"].includes(mode) ? 2 : 1);
      if (mode === "ok") { assert.ok(has(h, "generations", [generation])); assert.ok(has(h, "success", t("formsGenerated", { count: 0, type: t(`formType_${type}`) }))); }
      else { assert.ok(!h.events.some(v => Array.isArray(v) && ["success", "generations"].includes(v[0]))); assert.ok(has(h, "error", t(["no-org", "storage"].includes(mode) ? "organizationRequired" : "generateFailed"))); }
      if (requests) { assert.ok(has(h, "generating", true)); assert.ok(has(h, "generating", false)); }
      assert.ok(!h.events.some(v => Array.isArray(v) && ["taxYear", "expandedId"].includes(v[0]))); assert.ok(!JSON.stringify(h.events).includes("Private"));
    }, mode === "no-org" ? null : "org-a", mode === "storage");
  }
});

test("tax download callbacks preserve authenticated JSON file request and translate every failure", async () => {
  const savedDocument = Object.getOwnPropertyDescriptor(globalThis, "document"), create = URL.createObjectURL, revoke = URL.revokeObjectURL;
  const links: { href: string; download: string; click: () => void }[] = [], events: string[] = [];
  Object.defineProperty(globalThis, "document", { configurable: true, value: { createElement: (tag: string) => { assert.equal(tag, "a"); const link = { href: "", download: "", click: () => events.push("click") }; links.push(link); return link; } } });
  URL.createObjectURL = () => "blob:form"; URL.revokeObjectURL = url => { assert.equal(url, "blob:form"); events.push("revoke"); };
  try {
    for (const locale of locales) for (const file of [formsPage, detailPage]) for (const mode of ["ok", "http", "json", "network", "blob", "no-org", "storage"]) {
      let requests = 0, stopped = false; const t = translator(locale), size = links.length;
      await withIO(async (url, init) => {
        requests++; assert.equal(url, "/api/v1/payroll/tax-forms/form-a/pdf"); assert.deepEqual(init?.headers, { "x-organization-id": "org-a" });
        if (mode === "network") throw new Error("Private network");
        if (mode === "http") return Response.json({ error: "Private server" }, { status: 403 });
        if (mode === "json") return new Response("Private parser", { status: 500 });
        const response = Response.json({ formData: form.formData });
        if (mode === "blob") response.blob = async () => { throw new Error("Private blob"); };
        return response;
      }, async () => {
        const h = file === formsPage ? formsView({}, locale) : detailView({}, locale);
        await action(h, t("download"))({ stopPropagation: () => { stopped = true; } }); await flush();
        assert.equal(requests, ["no-org", "storage"].includes(mode) ? 0 : 1);
        if (file === formsPage) assert.ok(stopped);
        if (mode === "ok") { assert.equal(links.length, size + 1); assert.equal(links.at(-1)?.download, "tax-form-form-a.json"); assert.equal(links.at(-1)?.href, "blob:form"); }
        else { assert.equal(links.length, size); assert.ok(has(h, "error", t(["no-org", "storage"].includes(mode) ? "organizationRequired" : "downloadFailed"))); }
        assert.ok(!JSON.stringify(h.events).includes("Private"));
      }, mode === "no-org" ? null : "org-a", mode === "storage");
    }
    assert.equal(events.filter(e => e === "click").length, 4); assert.equal(events.filter(e => e === "revoke").length, 4);
  } finally { URL.createObjectURL = create; URL.revokeObjectURL = revoke; if (savedDocument) Object.defineProperty(globalThis, "document", savedDocument); else Reflect.deleteProperty(globalThis, "document"); }
});

test("tax expansion, recipient navigation and year editing retain machine values", () => {
  const h = formsView(), t = translator("en-US");
  const parent = h.captured.find(c => c.kind === "TableRow" && typeof c.props.onClick === "function")!;
  (parent.props.onClick as () => void)(); assert.ok(has(h, "expandedId", null));
  const child = h.captured.filter(c => c.kind === "TableRow" && typeof c.props.onClick === "function")[1];
  let stopped = false; (child.props.onClick as (e: { stopPropagation: () => void }) => void)({ stopPropagation: () => { stopped = true; } });
  assert.ok(stopped); assert.ok(has(h, "push", "/payroll/tax-forms/form-a"));
  (h.captured.find(c => c.kind === "Select")!.props.onValueChange as (s: string) => void)("2024"); assert.ok(has(h, "taxYear", "2024"));
  assert.ok(detailView().captured.some(c => c.props.href === "/payroll/tax-forms" && c.props["aria-label"] === t("backToTaxForms")));
});

test("owned copy audit and Persian script preserve only statutory code exceptions", () => {
  for (const file of pages) {
    const ast = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(n: ts.Node) {
      if (ts.isJsxText(n)) assert.doesNotMatch(n.text.trim(), /[A-Za-z]/, n.text);
      if (ts.isJsxAttribute(n) && ["title", "placeholder", "aria-label", "label"].includes(n.name.getText(ast)) && n.initializer && ts.isStringLiteral(n.initializer)) assert.fail(n.getText(ast));
      ts.forEachChild(n, visit);
    }
    visit(ast);
    assert.doesNotMatch(ast.text, /err\.message|error\.message|data\.error|replace\(\/_\/g|useDocumentTitle\("/);
  }
  for (const [key, value] of Object.entries(fa.PayrollOutputs)) {
    if (key.startsWith("formType_")) assert.equal(value, en.PayrollOutputs[key as keyof typeof en.PayrollOutputs]);
    else assert.match(value, /[\u0600-\u06ff]/, key);
  }
});
