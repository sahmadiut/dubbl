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
import { payrollEmployeeCreatedJson } from "../i18n/payroll-employee-presentation";
import { payrollMoneyDisplay } from "../lib/money/payroll-display";
import { renderWithPresentation } from "./helpers/presentation";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const page = "app/(dashboard)/payroll/employees/page.tsx";
const drawer = "components/dashboard/create-drawer.tsx";
const locales = ["en-US", "fa-IR"] as const;
const noop = () => {};
const caller = "<script>caller & name</script>";
const employee = { id: "employee-a", name: caller, employeeNumber: "EMP-001", position: "Engineer", salary: 9007199254740991,
  salaryMinor: "9007199254740991", payFrequency: "monthly", currency: "USD", isActive: true };
const inactive = { ...employee, id: "employee-b", name: "Zed", employeeNumber: "EMP-002", position: null,
  salary: 29, salaryMinor: "29", payFrequency: "weekly", isActive: false };
const escape = (v: string) => v.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
const translator = (locale: typeof locales[number]) => createTranslator({ locale, messages: locale === "en-US" ? en : fa, namespace: "PayrollEmployees" });
type Capture = { kind: string; props: Record<string, unknown> };
type Harness = { captured: Capture[]; events: unknown[]; effects: (() => void | (() => void))[] };

// Real production templates, next-intl, footer, money inputs and controls.
// Hook/IO state and portal/date/currency-picker boundaries are controlled.
function render(file: string, states: Record<string, unknown> = {}, locale: typeof locales[number] = "en-US") {
  const ast = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const name = file === page ? "EmployeesPage" : "EmployeeDrawer";
  const owner = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name)!;
  const names: string[] = [];
  function hooks(n: ts.Node) {
    if (ts.isVariableDeclaration(n) && ts.isArrayBindingPattern(n.name) && n.initializer && ts.isCallExpression(n.initializer) && n.initializer.expression.getText(ast) === "useState") names.push(n.name.elements[0].getText(ast));
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
    if (id === "next/navigation") return { useRouter: () => ({ push: (v: string) => h.events.push(["push", v]) }) };
    if (id.endsWith("/create-drawer")) return { useCreateDrawer: () => ({ open: (v: string) => h.events.push(["drawer", v]) }) };
    if (id.endsWith("/use-debounce")) return { useDebounce: (v: string) => states.debouncedSearch ?? v };
    if (id.endsWith("/use-document-title")) return { useDocumentTitle: (v: string) => h.events.push(["title", v]) };
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
const form = { empName: caller, employeeNumber: "EMP-007", salary: "90071992547409.91", taxRate: "20.29", empStartDate: "2026-10-20", empCurrency: "KWD", payFrequency: "biweekly", email: "user@example.test", position: "Engineer", bankAccountNumber: "001234" };
const submit = (h: Harness) => (control(h, "form").onSubmit as (e: { preventDefault: () => void }) => Promise<void>)({ preventDefault: noop });

test("employee list renders bilingual copy, finite frequencies, exact salary and escaped caller data", () => {
  for (const locale of locales) for (const currency of ["USD", "JPY", "KWD", null]) {
    const h = render(page, { loading: false, employees: [{ ...employee, currency }, inactive, { ...employee, id: "employee-c", payFrequency: "biweekly" }] }, locale), t = translator(locale);
    for (const key of ["all", "active", "inactive", "addEmployee", "sortName", "sortNumber", "sortSalary", "sortStartDate", "weekly", "biweekly", "monthly"] as const) assert.ok(h.html.includes(escape(t(key))), key);
    assert.ok(h.html.includes(escape(caller)) && !h.html.includes("<script>"));
    assert.ok(h.html.includes(escape(payrollMoneyDisplay(employee.salary, currency ?? "USD"))));
    assert.ok(h.html.includes("EMP-001") && h.html.includes("Engineer"));
    assert.deepEqual(h.events, [["title", t("documentTitle")]]);
    assert.deepEqual(h.captured.filter(c => c.kind === "SelectItem").map(c => c.props.value), ["name", "number", "salary", "startDate"]);
    assert.deepEqual(h.captured.filter(c => c.kind === "TabsTrigger").map(c => c.props.value), ["all", "active", "inactive"]);
    (control(h, "Tabs").onValueChange as (v: string) => void)("inactive");
    (control(h, "Select").onValueChange as (v: string) => void)("salary");
    const actions = h.captured.filter(c => ["button", "Button"].includes(c.kind) && typeof c.props.onClick === "function");
    for (const c of actions) (c.props.onClick as () => void)();
    assert.ok(h.events.some(v => JSON.stringify(v) === JSON.stringify(["drawer", "employee"])));
    assert.ok(h.events.some(v => JSON.stringify(v) === JSON.stringify(["push", `/payroll/employees/${employee.id}`])));
    assert.ok(h.events.some(v => JSON.stringify(v) === JSON.stringify(["sortBy", "salary"])));
  }
});

test("employee empty, filtered, pending, loading and finite errors stay distinct in both locales", () => {
  for (const locale of locales) {
    const t = translator(locale), empty = render(page, { loading: false }, locale);
    for (const key of ["buildTeam", "emptyHelp", "addEmployee"] as const) assert.ok(empty.html.includes(escape(t(key))));
    assert.ok(empty.html.includes("JD") && empty.html.includes("AK"));
    for (const [states, key] of [[{ search: "absent" }, "trySearch"], [{ statusFilter: "inactive" }, "noFilterMatches"]] as const) {
      const h = render(page, { loading: false, employees: [employee], ...states }, locale);
      assert.ok(h.html.includes(escape(t("noEmployees"))) && h.html.includes(escape(t(key))));
    }
    for (const moneyError of ["readFailed", "organizationRequired"] as const) {
      const h = render(page, { loading: false, moneyError }, locale);
      assert.ok(h.html.includes('role="alert"') && h.html.includes(escape(t(moneyError))));
      assert.ok(!h.html.includes(escape(t("buildTeam"))));
    }
    for (const patch of [{ refetching: true }, { search: "new", debouncedSearch: "old" }]) {
      const h = render(page, { employees: [employee], loading: false, ...patch }, locale);
      assert.ok(h.html.includes(`aria-label="${escape(t("loading"))}"`) && !h.html.includes("EMP-001"));
    }
    assert.ok(!render(page, {}, locale).html.includes(escape(t("buildTeam"))));
  }
});

test("employee search, active filters and ascending/descending salary/name/number sort preserve behavior", () => {
  for (const search of ["EMP-001", "engineer", "caller"]) {
    const h = render(page, { loading: false, employees: [employee, inactive], search });
    assert.ok(h.html.includes("EMP-001") && !h.html.includes("EMP-002"));
    const clear = h.captured.find(c => c.kind === "button" && c.props["aria-label"] === en.PayrollEmployees.clearSearch)!;
    (clear.props.onClick as () => void)(); assert.deepEqual(h.events.at(-1), ["search", ""]);
  }
  for (const statusFilter of ["active", "inactive"]) {
    const h = render(page, { loading: false, employees: [employee, inactive], statusFilter });
    assert.equal(h.html.includes("EMP-001"), statusFilter === "active");
    assert.equal(h.html.includes("EMP-002"), statusFilter === "inactive");
  }
  for (const sortBy of ["name", "number", "salary", "startDate"]) for (const sortOrder of ["asc", "desc"]) {
    const h = render(page, { loading: false, employees: [employee, inactive], sortBy, sortOrder });
    const rows = h.captured.filter(c => c.kind === "button" && c.props.className?.toString().includes("w-full flex"));
    assert.equal(rows.length, 2);
    const firstA = (sortBy === "salary") === (sortOrder === "desc");
    assert.equal(h.html.indexOf("EMP-001") < h.html.indexOf("EMP-002"), firstA);
    const toggle = h.captured.find(c => c.kind === "Button" && c.props["aria-label"] === en.PayrollEmployees.toggleSort)!;
    (toggle.props.onClick as () => void)();
    const updater = (h.events.at(-1) as [string, (v: string) => string])[1];
    assert.equal(updater(sortOrder), sortOrder === "asc" ? "desc" : "asc");
  }
});

async function withIO(org: string | null, fetcher: typeof fetch, check: (listeners: Map<string, () => void>) => Promise<void>, throws = false) {
  const originalFetch = globalThis.fetch, storage = Object.getOwnPropertyDescriptor(globalThis, "localStorage"), windowValue = Object.getOwnPropertyDescriptor(globalThis, "window");
  const listeners = new Map<string, () => void>();
  globalThis.fetch = fetcher;
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: (key: string) => { assert.equal(key, "activeOrgId"); if (throws) throw new Error("Private storage failure"); return org; } } });
  Object.defineProperty(globalThis, "window", { configurable: true, value: { addEventListener: (key: string, fn: () => void) => listeners.set(key, fn), removeEventListener: (key: string) => listeners.delete(key) } });
  try { await check(listeners); } finally {
    globalThis.fetch = originalFetch;
    for (const [key, descriptor] of [["localStorage", storage], ["window", windowValue]] as const)
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
  }
}

test("list read validates before adoption, preserves organization header and refetch event", async () => {
  const requests: unknown[] = [];
  await withIO("org-a", async (url, init) => { requests.push([url, init]); return Response.json({ data: [employee] }); }, async listeners => {
    const h = render(page); const cleanup = h.effects[0](); await flush();
    assert.deepEqual(requests, [["/api/v1/payroll/employees", { headers: { "x-organization-id": "org-a" } }]]);
    assert.ok(h.events.some(v => JSON.stringify(v) === JSON.stringify(["employees", [employee]])));
    listeners.get("refetch-employees")!(); await flush(); assert.equal(requests.length, 2);
    (cleanup as () => void)(); assert.equal(listeners.size, 0);
  });
});

test("list failures never adopt malformed data or expose HTTP/parser/network text", async () => {
  for (const mode of ["http", "json", "money", "envelope", "network", "frequency"]) {
    await withIO("org-a", async () => {
      if (mode === "http") return Response.json({ error: "Private server text" }, { status: 403 });
      if (mode === "json") return new Response("Private parser text");
      if (mode === "money") return Response.json({ data: [{ ...employee, salaryMinor: "29" }] });
      if (mode === "frequency") return Response.json({ data: [{ ...employee, payFrequency: "private-frequency" }] });
      if (mode === "envelope") return Response.json({ error: "Private text" });
      throw new Error("Private network text");
    }, async () => {
      const h = render(page); h.effects[0](); await flush();
      assert.ok(!h.events.some(v => (v as unknown[])[0] === "employees"));
      assert.ok(h.events.some(v => JSON.stringify(v) === JSON.stringify(["moneyError", "readFailed"])));
      assert.ok(h.events.some(v => JSON.stringify(v) === JSON.stringify(["loading", false])));
      assert.ok(h.events.some(v => JSON.stringify(v) === JSON.stringify(["refetching", false])));
      assert.ok(!JSON.stringify(h.events).includes("Private"));
    });
  }
  for (const throws of [false, true]) await withIO(null, async () => { assert.fail("Unexpected request"); }, async () => {
    const h = render(page); h.effects[0](); await flush();
    assert.ok(h.events.some(v => JSON.stringify(v) === JSON.stringify(["moneyError", throws ? "readFailed" : "organizationRequired"])));
    assert.ok(h.events.some(v => JSON.stringify(v) === JSON.stringify(["loading", false])));
  }, throws);
});

test("late unmounted or superseded employee requests cannot overwrite newer state", async () => {
  for (const fail of [false, true]) {
    const pending: { resolve: (r: Response) => void; reject: (e: Error) => void }[] = [];
    await withIO("org-a", () => new Promise((resolve, reject) => pending.push({ resolve, reject })), async listeners => {
      const h = render(page); const cleanup = h.effects[0]();
      listeners.get("refetch-employees")!();
      pending[1].resolve(Response.json({ data: [inactive] })); await flush();
      const after = h.events.length;
      if (fail) pending[0].reject(new Error("Late private failure")); else pending[0].resolve(Response.json({ data: [employee] }));
      await flush(); assert.equal(h.events.length, after);
      listeners.get("refetch-employees")!(); (cleanup as () => void)(); const unmounted = h.events.length;
      if (fail) pending[2].reject(new Error("Late private failure")); else pending[2].resolve(Response.json({ data: [employee] }));
      await flush(); assert.equal(h.events.length, unmounted);
    });
  }
});

test("employee drawer renders bilingual labels, examples, raw identifiers, currencies and busy footer", () => {
  for (const locale of locales) for (const saving of [false, true]) {
    const h = render(drawer, { ...form, saving }, locale), t = translator(locale);
    for (const key of ["newEmployee", "drawerDescription", "personalInfo", "nameRequired", "numberRequired", "email", "position", "compensation", "salaryRequired", "payFrequency", "taxRate", "currency", "details", "bankAccount", "startDateRequired", "nameExample", "positionExample", "accountPlaceholder", "startDatePlaceholder", "weekly", "biweekly", "monthly", saving ? "adding" : "addEmployee"] as const) assert.ok(h.html.includes(escape(t(key))), key);
    assert.ok(h.html.includes(escape(caller)) && !h.html.includes("<script>"));
    for (const sample of ["EMP-001", "john@example.com", "75000.00", "20.00", "001234", "90071992547409.91", "KWD"]) assert.ok(h.html.includes(sample), sample);
    assert.deepEqual(h.captured.filter(c => c.kind === "SelectItem").map(c => c.props.value), ["weekly", "biweekly", "monthly"]);
    assert.equal(control(h, "DatePicker").value, "2026-10-20");
    (control(h, "DatePicker").onChange as (v: string) => void)("2026-10-21");
    assert.deepEqual(h.events.at(-1), ["empStartDate", "2026-10-21"]);
    (control(h, "CurrencySelect").onValueChange as (v: string) => void)("JPY");
    assert.deepEqual(h.events.at(-1), ["empCurrency", "JPY"]);
    const button = h.captured.find(c => c.kind === "Button" && c.props.type === "submit")!;
    assert.equal(button.props.disabled, saving);
  }
});

test("employee submit retains exact cents, basis points, canonical date/nulls and navigation in both locales", async () => {
  for (const locale of locales) for (const currency of ["USD", "JPY", "KWD"]) for (const salary of ["0", "0.29", "90071992547409.91"]) {
    let payload: Record<string, unknown> | undefined;
    await withIO("org-a", async (url, init) => {
      assert.equal(url, "/api/v1/payroll/employees"); assert.equal(init?.method, "POST");
      assert.deepEqual(init?.headers, { "Content-Type": "application/json", "x-organization-id": "org-a" });
      payload = JSON.parse(init!.body as string);
      return Response.json({ employee }, { status: 201 });
    }, async () => {
      const h = render(drawer, { ...form, email: "", position: "", bankAccountNumber: "", salary, empCurrency: currency }, locale); await submit(h);
      assert.deepEqual(payload, { name: caller, email: null, employeeNumber: "EMP-007", position: null,
        salaryMinor: salary === "0" ? "0" : salary === "0.29" ? "29" : "9007199254740991", payFrequency: "biweekly", taxRate: 2029,
        bankAccountNumber: null, startDate: "2026-10-20", currency });
      assert.deepEqual(h.events, [["saving", true], ["success", translator(locale)("added")], ["close"], ["push", `/payroll/employees/${employee.id}`], ["saving", false]]);
    });
  }
});

test("employee create failures preserve fields, release saving and show finite feedback without close/navigation", async () => {
  for (const locale of locales) for (const mode of ["http", "json", "envelope", "money", "network", "salary", "tax", "storage", "org", "required"]) {
    await withIO(mode === "org" ? null : "org-a", async () => {
      if (["salary", "tax", "storage", "org", "required"].includes(mode)) assert.fail("Unexpected request");
      if (mode === "http") return Response.json({ error: "Private server text" }, { status: 422 });
      if (mode === "json") return new Response("Private parser text");
      if (mode === "envelope") return Response.json({ employee: { id: " " } });
      if (mode === "money") return Response.json({ employee: { ...employee, salaryMinor: "29" } });
      throw new Error("Private network text");
    }, async () => {
      const h = render(drawer, { ...form, ...(mode === "salary" ? { salary: "-1" } : mode === "tax" ? { taxRate: "100.01" } : mode === "required" ? { empName: "" } : {}) }, locale);
      await submit(h);
      const key = mode === "org" ? "organizationRequired" : mode === "required" ? "requiredFields" : "createFailed";
      assert.ok(h.events.some(v => JSON.stringify(v) === JSON.stringify(["error", translator(locale)(key)])));
      assert.ok(!h.events.some(v => ["close", "push", "success", "empName", "salary"].includes((v as string[])[0])));
      if (mode !== "required") assert.deepEqual(h.events.at(-1), ["saving", false]);
      assert.ok(!JSON.stringify(h.events).includes("Private"));
    }, mode === "storage");
  }
});

test("creation response validates HTTP, envelopes, IDs and present exact aliases", async () => {
  assert.deepEqual(await payrollEmployeeCreatedJson(Response.json({ employee })), { employee });
  for (const body of [null, [], {}, { employee: null }, { employee: [] }, { employee: { id: "" } }, { employee: { ...employee, salaryMinor: "29" } }])
    await assert.rejects(payrollEmployeeCreatedJson(Response.json(body)));
  await assert.rejects(payrollEmployeeCreatedJson(Response.json({ employee }, { status: 500 })));
  await assert.rejects(payrollEmployeeCreatedJson(new Response("private parser text")));
});

test("employee owned source has no unextracted copy; paired Persian catalog uses real script", () => {
  for (const file of [page, drawer]) {
    const ast = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const owner = file === drawer ? ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === "EmployeeDrawer")! : ast;
    const exceptions = new Set(["EMP-001", "john@example.com", "75000.00", "20.00"]);
    function visit(n: ts.Node) {
      if (ts.isJsxText(n)) assert.doesNotMatch(n.text, /[A-Za-z]/, n.text.trim());
      if (ts.isJsxAttribute(n) && ["title", "label", "placeholder", "aria-label"].includes(n.name.getText(ast)) && n.initializer && ts.isStringLiteral(n.initializer)) assert.ok(exceptions.has(n.initializer.text), n.getText(ast));
      ts.forEachChild(n, visit);
    }
    visit(owner);
    assert.doesNotMatch(owner.getText(ast), /error\.message|err\.message|data\.error|\.json\(\)/);
  }
  assert.deepEqual(Object.keys(en.PayrollEmployees), Object.keys(fa.PayrollEmployees));
  for (const value of Object.values(fa.PayrollEmployees)) assert.match(value, /[\u0600-\u06ff]/);
});
