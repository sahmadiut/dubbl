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
import { payrollEmployeeDetailJson } from "../i18n/payroll-employee-detail-presentation";
import { payrollMoneyDisplay } from "../lib/money/payroll-display";
import { renderWithPresentation } from "./helpers/presentation";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const page = "app/(dashboard)/payroll/employees/[id]/page.tsx";
const locales = ["en-US", "fa-IR"] as const;
const caller = "<script>caller & name</script>";
const employee = { id: "employee-a", name: caller, employeeNumber: "EMP-001", position: "Engineer", salary: 9007199254740991,
  salaryMinor: "9007199254740991", payFrequency: "monthly", currency: "USD", isActive: true };
const escape = (v: string) => v.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
const translator = (locale: typeof locales[number]) => createTranslator({ locale, messages: locale === "en-US" ? en : fa, namespace: "PayrollEmployeeDetail" });
type Capture = { kind: string; props: Record<string, unknown> };
type Harness = { captured: Capture[]; events: unknown[]; effects: (() => void | (() => void))[] };

// Real production detail JSX, next-intl, money inputs and controls.
// Hook/IO state and portal/date/currency-picker boundaries are controlled.
function render(file: string, states: Record<string, unknown> = {}, locale: typeof locales[number] = "en-US") {
  const ast = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const name = "EmployeeDetailPage";
  const owner = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name)!;
  const names: string[] = [];
  function hooks(n: ts.Node) {
    if (ts.isVariableDeclaration(n) && ts.isArrayBindingPattern(n.name) && n.initializer && ts.isCallExpression(n.initializer) && n.initializer.expression.getText(ast) === "useState") names.push(n.name.elements[0].getText(ast));
    ts.forEachChild(n, hooks);
  }
  hooks(owner);
  const source = ast.text + `\nexport { ${name} };`;
  const h: Harness = { captured: [], events: [], effects: [] };
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
  const require = createRequire(resolve(file)), compiled = { exports: {} as Record<string, ComponentType<Record<string, unknown>>> };
  const load = (id: string): unknown => {
    if (id === "react") return { ...React, useState: (initial: unknown) => {
      const key = names[index++]; return [Object.hasOwn(states, key) ? states[key] : initial, (v: unknown) => h.events.push([key, v])];
    }, useEffect: (fn: () => void | (() => void)) => h.effects.push(fn) };
    if (id === "react/jsx-runtime") return { ...jsx, jsx: capture(jsx.jsx), jsxs: capture(jsx.jsxs) };
    if (id === "next-intl") return nextIntl;
    if (id === "sonner") return { toast: { error: (v: unknown) => h.events.push(["error", v]), success: (v: unknown) => h.events.push(["success", v]) } };
    if (id === "next/navigation") return { useParams: () => ({ id: "employee-a" }), useRouter: () => ({ push: (v: string) => h.events.push(["push", v]) }) };
    if (id.endsWith("/use-document-title")) return { useDocumentTitle: (v: string) => h.events.push(["title", v]) };
    if (id.endsWith("/use-confirm")) return { useConfirm: () => ({ dialog: null, confirm: async (v: unknown) => { h.events.push(["confirm", v]); return states.confirmed !== false; } }) };
    if (id.endsWith("/brand-loader")) return BrandLoader;
    for (const [suffix, names] of Object.entries({ "/ui/select": ["Select", "SelectContent", "SelectItem", "SelectTrigger", "SelectValue"], "/ui/currency-select": ["CurrencySelect"] }))
      if (id.endsWith(suffix)) return Object.fromEntries(names.map(key => [key, inline(key)]));
    return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  };
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function("require", "module", "exports", code)(load, compiled, compiled.exports);
  const html = renderWithPresentation(createElement(compiled.exports[name]), locale);
  return { ...h, html };
}
const control = (h: Harness, kind: string) => h.captured.find(c => c.kind === kind)!.props;
const flush = async () => { for (let i = 0; i < 6; i++) await new Promise(resolve => setImmediate(resolve)); };

const detail = { ...employee, email: "user@example.test", bankAccountNumber: "001234", startDate: "2024-02-29", endDate: null,
  taxRate: 2029, compensationType: "salary", hourlyRate: null, hourlyRateMinor: null, compensationBandId: "band-a", member: { user: { name: caller, email: "member@example.test" } } };
const tax = { id: "tax-a", filingStatus: "single", federalAllowances: 2, stateAllowances: 1, additionalWithholding: 29, additionalWithholdingMinor: "29" };
const band = { id: "band-a", name: caller, minSalary: 0, minSalaryMinor: "0", midSalary: 29, midSalaryMinor: "29", maxSalary: Number.MAX_SAFE_INTEGER, maxSalaryMinor: "9007199254740991", currency: "USD" };
const deduction = { id: "deduction-a", timing: "recurring", amount: 29, amountMinor: "29", percent: null, isActive: true,
  deductionType: { name: caller, category: "pre_tax", defaultAmount: null, defaultAmountMinor: null, defaultPercent: null } };
const leave = { id: "leave-a", balance: 2.5, usedHours: 0.25, policy: { name: caller, leaveType: "vacation" } };
const form = { orgId: "org-a", loading: false, emp: detail, name: caller, email: "user@example.test", position: "Engineer", employeeNumber: "EMP-001",
  salary: "90071992547409.91", hourlyRate: "0.29", payFrequency: "biweekly", taxRate: "20.29", bankAccountNumber: "001234", currency: "KWD", startDate: "2024-02-29", endDate: "",
  deductions: [deduction], taxConfig: tax, leaveBalances: [leave], compensationBand: band, tcFilingStatus: "married_joint", tcFederalAllowances: "2", tcStateAllowances: "1", tcAddlFederal: "0.29" };
function action(h: Harness, label: string) {
  const match = h.captured.find(c => c.kind === "Button" && Array.isArray(c.props.children) && c.props.children.includes(label));
  assert.ok(match, label); return match.props.onClick as () => Promise<void>;
}
async function withIO(fetcher: typeof fetch, run: () => Promise<void>, org: string | null = "org-a", storageThrows = false) {
  const original = globalThis.fetch, storage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  globalThis.fetch = fetcher;
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: () => { if (storageThrows) throw new Error("private"); return org; } } });
  try { await run(); } finally { globalThis.fetch = original; if (storage) Object.defineProperty(globalThis, "localStorage", storage); else Reflect.deleteProperty(globalThis, "localStorage"); }
}
const hasEvent = (h: Harness, key: string, value: unknown) => h.events.some(v => JSON.stringify(v) === JSON.stringify([key, value]));

test("employee detail renders real bilingual sections, escaped data, exact money and canonical controls", () => {
  for (const locale of locales) for (const compensationType of ["salary", "hourly", "milestone", "commission"]) {
    const t = translator(locale), h = render(page, { ...form, compensationType }, locale);
    for (const key of ["back", "personalInfo", "personalHelp", "compensation", "compensationHelp", "details", "detailsHelp", "deductions", "deductionsHelp", "taxConfig", "taxHelp", "leaveBalances", "leaveHelp", "bandTitle", "bandHelp", "danger", "dangerHelp", "save", "delete", "preTax", "vacation"] as const)
      assert.ok(h.html.includes(escape(t(key))), key);
    assert.ok(h.html.includes(escape(caller)) && !h.html.includes("<script>"));
    if (compensationType === "salary") assert.ok(h.html.includes(escape(payrollMoneyDisplay(detail.salary, "KWD", resolvePresentation({ user: { language: locale } })))));
    if (compensationType === "hourly") assert.ok(h.html.includes(escape(payrollMoneyDisplay(29, "KWD", resolvePresentation({ user: { language: locale } })))));
    assert.ok(h.html.includes(escape(t("hours", { value: "2.5" }))));
    assert.ok(hasEvent(h, "title", t("documentTitle")));
    assert.deepEqual(h.captured.filter(c => c.kind === "SelectItem").map(c => c.props.value), ["salary", "hourly", "milestone", "commission", "weekly", "biweekly", "monthly", "single", "married_joint", "married_separate", "head_of_household"]);
    const dates = h.captured.filter(c => c.kind === "Input" && c.props.type === "date");
    assert.deepEqual(dates.map(c => [c.props.value, c.props.disabled]), [["2024-02-29", true], ["", true]]);
    for (const c of h.captured.filter(c => c.kind === "Select")) (c.props.onValueChange as (v: string) => void)(c.props.value as string);
    const currency = control(h, "CurrencySelect"); (currency.onValueChange as (v: string) => void)("JPY"); assert.ok(hasEvent(h, "currency", "JPY"));
    (h.captured.find(c => c.kind === "button" && c.props.onClick)!.props.onClick as () => void)(); assert.ok(hasEvent(h, "push", "/payroll/employees"));
  }
});

test("employee detail covers empty, pending, not-found, active and finite error states", () => {
  for (const locale of locales) {
    const t = translator(locale);
    const empty = render(page, { ...form, deductions: [], taxConfig: null, leaveBalances: [], compensationBand: null, isActive: false }, locale);
    for (const key of ["noDeductions", "noTax", "noLeave", "inactive", "activate"] as const) assert.ok(empty.html.includes(escape(t(key))), key);
    assert.ok(!empty.html.includes(escape(t("bandTitle"))));
    const busy = render(page, { ...form, saving: true, taxSaving: true }, locale);
    assert.equal(busy.captured.filter(c => c.kind === "Button" && Array.isArray(c.props.children) && c.props.children.includes(t("saving"))).length, 2);
    assert.ok(render(page, { loading: false }, locale).html.includes(escape(t("notFound"))));
    assert.ok(!render(page, {}, locale).html.includes(escape(t("notFound"))));
    for (const moneyError of ["readFailed", "organizationRequired"]) {
      const h = render(page, { ...form, moneyError }, locale); assert.ok(h.html.includes('role="alert"')); assert.ok(!h.html.includes("EMP-001"));
    }
  }
});

test("deduction overrides and defaults, leave types and currency-safe bands retain their display contracts", () => {
  for (const locale of locales) {
    const t = translator(locale);
    for (const [patch, expected] of [
      [{}, payrollMoneyDisplay(29, "USD", resolvePresentation({ user: { language: locale } }))],
      [{ amount: null, amountMinor: null, percent: 2.5 }, "2.5%"],
      [{ amount: null, amountMinor: null, deductionType: { ...deduction.deductionType, defaultAmount: 0, defaultAmountMinor: "0" } }, payrollMoneyDisplay(0, "USD", resolvePresentation({ user: { language: locale } }))],
      [{ amount: null, amountMinor: null, deductionType: { ...deduction.deductionType, category: "post_tax", defaultPercent: 1.25 } }, "1.25%"],
      [{ amount: null, amountMinor: null, isActive: false }, t("noAmount")],
    ] as const) assert.ok(render(page, { ...form, deductions: [{ ...deduction, ...patch }] }, locale).html.includes(escape(expected)));
    for (const leaveType of ["vacation", "sick", "personal", "parental", "bereavement", "unpaid", "other"] as const)
      assert.ok(render(page, { ...form, leaveBalances: [{ ...leave, policy: { ...leave.policy, leaveType } }] }, locale).html.includes(escape(t(leaveType))));
    assert.ok(render(page, { ...form, compensationBand: { ...band, currency: "JPY" } }, locale).html.includes(escape(payrollMoneyDisplay(band.maxSalary, "JPY", resolvePresentation({ user: { language: locale } })))));
    assert.ok(!render(page, { ...form, compensationBand: { ...band, currency: "JPY" } }, locale).html.includes(escape(t("range"))));
  }
});

test("detail readers reject HTTP, JSON, shape, money and enum failures without accepting unchecked state", async () => {
  const good = { employee: { employee: detail }, tax: { taxConfig: tax }, deductions: { data: [deduction] }, leave: { data: [leave] }, band: { band }, deleted: { success: true } };
  for (const kind of Object.keys(good) as (keyof typeof good)[]) {
    assert.deepEqual(await payrollEmployeeDetailJson(Response.json(good[kind]), kind), good[kind]);
    for (const body of [null, [], {}, { error: "private" }]) await assert.rejects(payrollEmployeeDetailJson(Response.json(body), kind));
    await assert.rejects(payrollEmployeeDetailJson(Response.json(good[kind], { status: 403 }), kind));
    await assert.rejects(payrollEmployeeDetailJson(new Response("{"), kind));
  }
  for (const patch of [{ salaryMinor: "1" }, { salary: undefined }, { hourlyRateMinor: "0" }, { payFrequency: "other" }, { compensationType: "other" }, { currency: "bad" }, { taxRate: 1.5 }, { startDate: "2024-02-30" }, { member: { user: null } }])
    await assert.rejects(payrollEmployeeDetailJson(Response.json({ employee: { ...detail, ...patch } }), "employee"));
  await assert.rejects(payrollEmployeeDetailJson(Response.json({ taxConfig: { ...tax, federalAllowances: -1 } }), "tax"));
  await assert.rejects(payrollEmployeeDetailJson(Response.json({ data: [{ ...deduction, deductionType: null }] }), "deductions"));
  await assert.rejects(payrollEmployeeDetailJson(Response.json({ data: [{ ...leave, balance: "2.5" }] }), "leave"));
  await assert.rejects(payrollEmployeeDetailJson(Response.json({ leaveBalances: [leave] }), "leave"));
  await assert.rejects(payrollEmployeeDetailJson(Response.json({ band: { ...band, minSalary: 50, minSalaryMinor: "50" } }), "band"));
  for (const currency of [null, "USD", "JPY", "KWD"]) for (const salary of [0, 29, Number.MAX_SAFE_INTEGER])
    assert.equal((await payrollEmployeeDetailJson(Response.json({ employee: { ...detail, currency, salary, salaryMinor: String(salary) } }), "employee")).employee.salary, salary);
});

test("profile and tax callbacks preserve canonical exact payloads and validate success before feedback", async () => {
  for (const locale of locales) {
    const t = translator(locale), requests: { url: unknown; init?: RequestInit }[] = [];
    await withIO(async (url, init) => { requests.push({ url, init }); return Response.json(String(url).endsWith("tax-config") ? { taxConfig: tax } : { employee: detail }); }, async () => {
      const h = render(page, form, locale);
      await action(h, t("save"))(); await action(h, t("saveTax"))();
      assert.deepEqual(requests.map(r => [r.url, r.init?.method]), [["/api/v1/payroll/employees/employee-a", "PATCH"], ["/api/v1/payroll/employees/employee-a/tax-config", "PUT"]]);
      assert.deepEqual(JSON.parse(requests[0].init!.body as string), { name: caller, email: "user@example.test", position: "Engineer", salaryMinor: "9007199254740991", payFrequency: "biweekly", taxRate: 2029, bankAccountNumber: "001234", isActive: true, compensationType: "salary", hourlyRateMinor: "29", currency: "KWD" });
      assert.deepEqual(JSON.parse(requests[1].init!.body as string), { filingStatus: "married_joint", federalAllowances: 2, stateAllowances: 1, additionalWithholdingMinor: "29" });
      assert.deepEqual(requests[0].init!.headers, { "Content-Type": "application/json", "x-organization-id": "org-a" });
      assert.ok(hasEvent(h, "emp", detail) && hasEvent(h, "taxConfig", tax));
      assert.ok(hasEvent(h, "success", t("updated")) && hasEvent(h, "success", t("taxUpdated")));
      assert.ok(hasEvent(h, "saving", false) && hasEvent(h, "taxSaving", false));
    });
    for (const fail of [async () => Response.json({ error: "private" }, { status: 409 }), async () => new Response("{"), async () => Response.json({}), async () => { throw new Error("private"); }])
      await withIO(fail, async () => {
        const h = render(page, form, locale); await action(h, t("save"))(); await action(h, t("saveTax"))();
        assert.ok(hasEvent(h, "error", t("saveFailed")) && hasEvent(h, "error", t("taxFailed")));
        assert.ok(!h.events.some(v => ["emp", "taxConfig", "name", "salary", "success", "push"].includes((v as string[])[0])));
        assert.ok(!JSON.stringify(h.events).includes("private"));
      });
  }
});

test("optional blank profile fields stay null and invalid cents never reach the network", async () => {
  let requests = 0;
  await withIO(async (_url, init) => {
    requests++;
    const body = JSON.parse(init!.body as string);
    assert.equal(body.email, null); assert.equal(body.position, null); assert.equal(body.bankAccountNumber, null); assert.equal(body.hourlyRateMinor, null);
    assert.equal(body.salaryMinor, "0");
    return Response.json({ employee: { ...detail, salary: 0, salaryMinor: "0" } });
  }, async () => {
    const h = render(page, { ...form, email: "", position: "", bankAccountNumber: "", hourlyRate: "", salary: "0" });
    await action(h, en.PayrollEmployeeDetail.save)(); assert.equal(requests, 1);
  });
  for (const salary of ["1.001", "1e2", "90071992547409.92"]) await withIO(async () => { throw new Error("Unexpected request"); }, async () => {
    const h = render(page, { ...form, salary }); await action(h, en.PayrollEmployeeDetail.save)();
    assert.ok(hasEvent(h, "error", en.PayrollEmployeeDetail.saveFailed) && hasEvent(h, "saving", false));
  });
});

test("delete confirmation, cancellation, missing organization and failures have finite localized behavior", async () => {
  for (const locale of locales) {
    const t = translator(locale); let requests = 0;
    await withIO(async (url, init) => { requests++; assert.equal(url, "/api/v1/payroll/employees/employee-a"); assert.equal(init?.method, "DELETE"); return Response.json({ success: true }); }, async () => {
      const h = render(page, form, locale); await action(h, t("delete"))();
      assert.ok(hasEvent(h, "confirm", { title: t("deleteTitle"), description: t("deleteConfirm"), confirmLabel: t("delete"), destructive: true }));
      assert.ok(hasEvent(h, "success", t("deleted")) && hasEvent(h, "push", "/payroll/employees"));
      const cancel = render(page, { ...form, confirmed: false }, locale); await action(cancel, t("delete"))(); assert.equal(requests, 1);
      const absent = render(page, { ...form, orgId: null }, locale);
      for (const key of ["save", "saveTax", "delete"] as const) await action(absent, t(key))();
      assert.equal(requests, 1); assert.ok(hasEvent(absent, "error", t("organizationRequired")));
    });
    for (const fail of [async () => Response.json({ error: "private" }, { status: 403 }), async () => Response.json({}), async () => { throw new Error("private"); }])
      await withIO(fail, async () => { const h = render(page, form, locale); await action(h, t("delete"))(); assert.ok(hasEvent(h, "error", t("deleteFailed"))); assert.ok(!h.events.some(v => ["success", "push"].includes((v as string[])[0]))); });
  }
});

test("initial reads use real envelopes and ignore unmounted or superseded employee results", async () => {
  const responses: Record<string, unknown> = { "employee-a": { employee: detail }, deductions: { data: [deduction] }, "tax-config": { taxConfig: tax }, "leave-balances": { data: [leave] }, "band-a": { band } };
  const urls: string[] = [];
  await withIO(async (url, init) => { urls.push(String(url)); assert.deepEqual(init?.headers, { "x-organization-id": "org-a" }); return Response.json(responses[String(url).split("/").at(-1)!]); }, async () => {
    const h = render(page, { orgId: "org-a" }); h.effects[1](); await flush();
    for (const [key, value] of [["emp", detail], ["deductions", [deduction]], ["taxConfig", tax], ["leaveBalances", [leave]], ["compensationBand", band], ["salary", "90071992547409.91"], ["taxRate", "20.29"], ["tcAddlFederal", "0.29"], ["loading", false]]) assert.ok(hasEvent(h, key as string, value), String(key));
    assert.equal(urls.length, 5);
  });
  for (const section of ["deductions", "tax-config", "leave-balances", "band-a"]) await withIO(async url => {
    const name = String(url).split("/").at(-1)!;
    return Response.json(name === section ? {} : responses[name]);
  }, async () => {
    const h = render(page, { orgId: "org-a" }); h.effects[1](); await flush();
    assert.ok(hasEvent(h, "moneyError", "readFailed") && hasEvent(h, "loading", false)); assert.ok(!hasEvent(h, "emp", detail));
  });
  await withIO(async () => Response.json({ error: "private" }, { status: 404 }), async () => {
    const h = render(page, { orgId: "org-a" }); h.effects[1](); await flush();
    assert.ok(hasEvent(h, "emp", null) && hasEvent(h, "loading", false)); assert.ok(!hasEvent(h, "moneyError", "readFailed"));
  });
  for (const fail of [async () => Response.json({}, { status: 403 }), async () => Response.json({ employee: { ...detail, salaryMinor: "1" } }), async () => { throw new Error("private"); }])
    await withIO(fail, async () => { const h = render(page, { orgId: "org-a" }); h.effects[1](); await flush(); assert.ok(hasEvent(h, "moneyError", "readFailed") && hasEvent(h, "loading", false)); assert.ok(!hasEvent(h, "emp", detail)); });
  let release!: (value: Response) => void;
  await withIO(async () => new Promise<Response>(resolve => { release = resolve; }), async () => {
    const h = render(page, { orgId: "org-a" }); const cleanup = h.effects[1](); const before = h.events.length; if (cleanup) cleanup(); release(Response.json({ employee: { ...detail, compensationBandId: null } })); await flush(); assert.equal(h.events.length, before);
  });
  for (const storageThrows of [false, true]) await withIO(async () => { throw new Error("unexpected fetch"); }, async () => {
    const h = render(page); h.effects[0](); assert.ok(hasEvent(h, "loading", false)); assert.ok(hasEvent(h, "moneyError", storageThrows ? "readFailed" : "organizationRequired"));
  }, null, storageThrows);
});

test("detail copy audit and Persian script guard preserve explicit technical exceptions", () => {
  const ast = ts.createSourceFile(page, readFileSync(page, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const leftovers: string[] = [];
  function visit(n: ts.Node) {
    if (ts.isJsxText(n) && /[A-Za-z]/.test(n.text)) leftovers.push(n.text.trim());
    if (ts.isJsxAttribute(n) && ["title", "description", "placeholder", "aria-label"].includes(n.name.getText(ast)) && n.initializer && ts.isStringLiteral(n.initializer)) leftovers.push(n.initializer.text);
    ts.forEachChild(n, visit);
  }
  visit(ast); assert.deepEqual(leftovers, []);
  for (const value of Object.values(fa.PayrollEmployeeDetail)) assert.match(value, /[\u0600-\u06ff]/);
  assert.deepEqual(Object.keys(en.PayrollEmployeeDetail), Object.keys(fa.PayrollEmployeeDetail));
});
