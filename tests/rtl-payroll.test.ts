import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import * as React from "react";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import * as nextIntl from "next-intl";
import { compile } from "tailwindcss";
import ts from "typescript";
import * as Presentation from "../i18n/provider";
import * as CurrencyInput from "../components/ui/currency-input";
import { resolvePresentation } from "../i18n/locale";
import { payrollMoneyDisplay } from "../lib/money/payroll-display";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const h = React.createElement, noop = () => {};
const root = "app/(dashboard)/payroll/";
const presentations = (["en-US", "fa-IR"] as const).flatMap(language =>
  (["latn", "arabext"] as const).map(numerals => resolvePresentation({ user: { language, numerals } })));
const caller = "  \u0646\u0627\u0645 Caller <ACME/001> & " + "long-name-".repeat(35);
const number = "  EMP-001/ABC  ", amount = 4000000000000001;
const employee = { id: "employee/001", name: caller, employeeNumber: number, position: caller,
  salary: amount, salaryMinor: String(amount), currency: "KWD", payFrequency: "monthly", isActive: true,
  taxRate: 2029, compensationType: "salary", hourlyRate: null, startDate: "2026-10-25", endDate: null,
  member: { user: { name: caller, email: "person@example.test" } } };
const escaped = (s: string) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
type Props = Record<string, unknown>;

// Execute production JSX and event callbacks with real Intl/provider/native controls.
// Supply state and IO at their boundaries; no application server or database is used.
function loaded(file: string, states: Props = {}) {
  const require = createRequire(resolve(root + file));
  const controls: { type: unknown; props: Props }[] = [], events: unknown[] = [], updates: [string, unknown][] = [];
  const source = readFileSync(root + file, "utf8");
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const component = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.modifiers?.some(m => m.kind === ts.SyntaxKind.DefaultKeyword));
  assert.ok(component);
  const names: string[] = [];
  function hooks(n: ts.Node) {
    if (ts.isVariableDeclaration(n) && ts.isArrayBindingPattern(n.name) && n.initializer && ts.isCallExpression(n.initializer)
      && n.initializer.expression.getText(ast) === "useState") names.push(n.name.elements[0].getText(ast));
    ts.forEachChild(n, hooks);
  }
  hooks(component);
  let index = 0;
  const inline = ({ children }: { children: React.ReactNode }) => h("div", null, children);
  const capture = (create: typeof jsx.jsx) => (type: React.ElementType, props: Props, key?: string) => {
    controls.push({ type, props }); return create(type, props, key);
  };
  const compiled = { exports: {} as Record<string, React.ComponentType<Props>> };
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function("require", "module", "exports", code)((id: string) => {
    if (id === "react") return { ...React, useState: (initial: unknown) => {
      const key = names[index++]; return [key in states ? states[key] : typeof initial === "function" ? initial() : initial,
        (value: unknown) => updates.push([key, value])];
    }, useEffect: noop };
    if (id === "next-intl") return nextIntl;
    if (id.endsWith("/i18n/provider")) return Presentation;
    if (id.endsWith("/ui/currency-input")) return CurrencyInput;
    if (id === "react/jsx-runtime") return { ...jsx, jsx: capture(jsx.jsx), jsxs: capture(jsx.jsxs) };
    if (id === "next/navigation") return { useParams: () => ({ id: employee.id }), usePathname: () => "/payroll",
      useRouter: () => ({ push: (value: unknown) => events.push(value) }) };
    if (id.endsWith("/use-document-title")) return { useDocumentTitle: noop };
    if (id.endsWith("/use-debounce")) return { useDebounce: (value: unknown) => value };
    if (id.endsWith("/use-confirm")) return { useConfirm: () => ({ confirm: noop, dialog: null }) };
    if (id.endsWith("/create-drawer")) return { useCreateDrawer: () => ({ open: noop }) };
    if (id.endsWith("/ui/currency-select")) return { CurrencySelect: () => null };
    if (id === "recharts") return new Proxy({}, { get: () => inline });
    if (["/ui/dialog", "/ui/sheet"].some(s => id.endsWith(s))) return new Proxy({}, { get: (_o, key) =>
      key === "Dialog" || key === "Sheet" ? ({ open, children }: { open: boolean; children: React.ReactNode }) => open ? inline({ children }) : null : inline });
    return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  }, compiled, compiled.exports);
  return { controls, events, updates, render(p: typeof presentations[number]) {
    index = 0; controls.length = 0;
    return renderToStaticMarkup(h(Presentation.PresentationProvider, { presentation: p, messages: p.locale === "fa-IR" ? fa : en,
      now: new Date("2026-10-25T00:00:00Z") }, h(compiled.exports.default)));
  } };
}

test("actual payroll employee rows isolate long caller names, exact identifiers and fixed-two money in all four presentations", () => {
  for (const p of presentations) {
    const page = loaded("employees/page.tsx", { employees: [employee], loading: false });
    const html = page.render(p), labels = (p.locale === "fa-IR" ? fa : en).PayrollEmployees;
    assert.ok(html.includes(`>${escaped(caller)}</bdi>`));
    assert.match(html, /<bdi[^>]*dir="ltr"[^>]*>  EMP-001\/ABC  <\/bdi>/);
    assert.ok(html.includes(escaped(payrollMoneyDisplay(amount, "KWD", p))));
    assert.ok(html.includes("text-start")); assert.ok(html.includes("flex-wrap")); assert.ok(!html.includes("truncate"));
    const row = page.controls.find(c => c.type === "button" && String(c.props.className).includes("w-full flex"));
    assert.ok(row); (row.props.onClick as () => void)(); assert.deepEqual(page.events, ["/payroll/employees/employee/001"]);
    assert.ok(page.controls.some(c => c.props["aria-label"] === labels.sortBy));
    assert.ok(page.controls.some(c => c.props["aria-label"] === labels.search && c.props.dir === "auto"));
    assert.equal(employee.employeeNumber, number);
  }
});

test("actual employee detail associates native fields and isolates linked caller data without changing edit values", () => {
  for (const p of presentations) {
    const labels = (p.locale === "fa-IR" ? fa : en).PayrollEmployeeDetail;
    const page = loaded("employees/[id]/page.tsx", { emp: employee, loading: false, name: caller,
      email: " person@example.test ", employeeNumber: number, bankAccountNumber: "  001234/ABC  ",
      salary: "40000000000000.01", taxRate: "20.29", currency: "KWD", startDate: "2026-10-25" });
    const html = page.render(p);
    assert.ok(html.includes(`>${escaped(caller)}</bdi>`));
    for (const [label, value, dir] of [[labels.name, caller, "auto"], [labels.email, " person@example.test ", "ltr"],
      [labels.employeeNumber, number, "ltr"], [labels.bankAccount, "  001234/ABC  ", "ltr"]]) {
      const field = page.controls.find(c => c.props["aria-label"] === label && typeof c.props.onChange === "function");
      assert.ok(field); assert.equal(field.props.value, value); assert.equal(field.props.dir, dir); assert.ok(field.props.id);
      assert.ok(html.includes(`for="${field.props.id}"`));
    }
    const bank = page.controls.find(c => c.props["aria-label"] === labels.bankAccount)!;
    (bank.props.onChange as (e: unknown) => void)({ target: { value: "  0000-NEW/123  " } });
    assert.deepEqual(page.updates.at(-1), ["bankAccountNumber", "  0000-NEW/123  "]);
    assert.ok(html.includes("data-[size=default]:h-auto"));
    assert.ok(html.includes("rtl:rotate-180"));
  }
});

test("actual timesheet entry controls preserve physical fractional hours, exact dates and raw description callbacks", () => {
  const sheet = { id: employee.id, employee, periodStart: "2026-10-01", periodEnd: "2026-10-25", totalHours: 1.75,
    status: "draft", entries: [{ id: "entry/001", date: "2026-10-25", hours: 1.75, shiftType: "regular", description: caller }] };
  for (const p of presentations) {
    const page = loaded("timesheets/[id]/page.tsx", { ts: sheet, loading: false, newHours: "1.75", newDate: "2026-10-25", newDesc: caller });
    const html = page.render(p), labels = (p.locale === "fa-IR" ? fa : en).PayrollTimeDetail;
    assert.ok(html.includes(`>${escaped(caller)}</bdi>`));
    const hours = page.controls.find(c => c.props.type === "number" && c.props["aria-label"] === labels.hours);
    assert.ok(hours); assert.equal(hours.props.dir, "ltr"); assert.equal(hours.props.step, "0.25"); assert.equal(hours.props.value, "1.75");
    (hours.props.onChange as (e: unknown) => void)({ target: { value: "2.25" } });
    assert.deepEqual(page.updates.at(-1), ["newHours", "2.25"]);
    const date = page.controls.find(c => c.props.type === "date"); assert.ok(date); assert.equal(date.props.value, "2026-10-25"); assert.equal(date.props.dir, "ltr");
    assert.match(html, /<bdi[^>]*dir="ltr"[^>]*>2026-10-25<\/bdi>/);
  }
});

test("actual tax form screen preserves masked statutory ID, caller recipient and exact amounts across all presentations", () => {
  const form = { id: employee.id, formType: "1099_nec", taxYear: 2026, recipientName: caller, recipientType: "contractor",
    recipientTaxId: "001-23-5678", status: "generated", formData: { box1_nonemployee_compensation: amount } };
  for (const p of presentations) {
    const page = loaded("tax-forms/[id]/page.tsx", { form, loading: false }), html = page.render(p);
    assert.ok(html.includes(`>${escaped(caller)}</bdi>`));
    assert.match(html, /<bdi[^>]*dir="ltr"[^>]*>\*\*\*-5678<\/bdi>/);
    assert.ok(html.includes(escaped(payrollMoneyDisplay(amount, "USD", p))));
    assert.ok(!html.includes(form.recipientTaxId)); assert.equal(form.recipientName, caller);
  }
});

test("actual forecast keeps the explicit positive sign and fixed-two amount in one ordered group", () => {
  for (const p of presentations) for (const difference of [29, -29]) {
    const whatIf = { currency: "KWD", current: { monthlyGross: 100, projectedTotal: 1200, headcount: 1 },
      projected: { monthlyGross: 129, projectedTotal: 1548, headcount: 1 },
      difference: { monthlyGross: difference, projectedTotal: difference * 12 } };
    const page = loaded("forecasting/page.tsx", { loading: false, whatIf }), html = page.render(p);
    const text = (difference >= 0 ? "+" : "") + payrollMoneyDisplay(difference, "KWD", p);
    assert.ok(html.includes(`>${escaped(text)}</bdi>`));
  }
});

test("installed payroll CSS supports logical search geometry, wrapping tabs/actions and unclamped select text", async () => {
  const compiler = await compile("@theme { --spacing: 0.25rem; } @tailwind utilities;");
  const css = compiler.build(["start-3", "end-2.5", "ps-9", "me-1.5", "text-start", "text-end", "h-auto", "min-h-8", "flex-wrap",
    "whitespace-normal", "[overflow-wrap:anywhere]", "data-[size=default]:h-auto", "*:data-[slot=select-value]:line-clamp-none", "rtl:rotate-180"]);
  for (const declaration of ["inset-inline-start:", "inset-inline-end:", "padding-inline-start:", "margin-inline-end:",
    "text-align: start", "text-align: end", "height: auto", "min-height:", "flex-wrap: wrap", "white-space: normal", "overflow-wrap: anywhere", "-webkit-line-clamp: unset", "rotate: 180deg"])
    assert.ok(css.includes(declaration), declaration);
});
