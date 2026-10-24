import { currencyLabel } from "../i18n/currency-labels";
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
import * as DatePicker from "../components/ui/date-picker";
import * as budgetPresentation from "../i18n/budget-presentation";
import * as money from "../lib/money/budget-ui";
import { generatePeriods } from "../lib/budget-periods";
import { renderWithPresentation } from "./helpers/presentation";
import { formatDecimalDraft } from "../i18n/numbers";
import { resolvePresentation } from "../i18n/locale";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const list = "app/(dashboard)/accounting/budgets/page.tsx";
const layout = "app/(dashboard)/accounting/budgets/[id]/layout.tsx";
const overview = "app/(dashboard)/accounting/budgets/[id]/page.tsx";
const settings = "app/(dashboard)/accounting/budgets/[id]/settings/page.tsx";
const drawer = "components/dashboard/create-drawer.tsx";
const locales = ["en-US", "fa-IR"] as const;
const noop = () => {};
const caller = '<script>Budget & account</script>';
const amount = 4000000000000001n;
const periods = generatePeriods("monthly", "2026-01-01", "2026-02-28").map((p,i) => ({ ...p, id: `p${i}`, amount: i ? 2000000000000000n : 2000000000000001n, budgeted: i ? 2000000000000000n : 2000000000000001n, actual: 1n, variance: 2000000000000000n }));
const account = { id: "a", name: caller, code: "500", type: "expense" };
const line = { id: "l", accountId: "a", account, total: amount, periods: periods.map(({id,label,startDate,endDate,sortOrder,amount}) => ({id,label,startDate,endDate,sortOrder,amount})) };
const budget = { id: "b", name: caller, periodType: "monthly", startDate: "2026-01-01", endDate: "2026-02-28", isActive: true, lines: [line] };
const comparison = { accountId: "a", accountName: caller, accountCode: "500", budgeted: amount, actual: 2n, variance: amount-2n, burnRate: 3n, periods };
const context = { budget, currencyCode: "USD", comparisons: [comparison], totalBudgeted: amount, totalActual: 2n, accounts: [account], refetch: noop };
function translator(locale: typeof locales[number]) { return createTranslator({ locale, messages: locale === "en-US" ? en : fa, namespace: "Budgets" }); }
function escape(value: string) { return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;"); }

// Production JSX and next-intl; controlled hooks and inline portals avoid a dev server.
function loaded(path: string, states: unknown[], titles: string[] = [], ctx = context, charts: Record<string, Record<string, unknown>> = {}) {
  let source = readFileSync(path, "utf8"), index = 0;
  const require = createRequire(resolve(path));
  const compiled = { exports: {} as Record<string, ComponentType<Record<string, unknown>>> };
  if (path === drawer) {
    const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const names = new Set(["BudgetDrawer", "DrawerFooter", "DrawerIcon", "SectionLabel", "emptyBudgetLine"]);
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
    }).join("\n") + "\nexport { BudgetDrawer };";
  }
  const inline = ({ children }: { children?: ReactNode }) => createElement("div", null, children);
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  const load = (id: string) => {
    if (id === "next-intl") return nextIntl;
    if (id === "react") return { ...React, useState: (initial: unknown) => [index < states.length ? states[index++] : initial, noop], useEffect: noop, useMemo: (fn: () => unknown) => fn(), useCallback: (fn: unknown) => fn };
    if (id === "next/navigation") return { useRouter: () => ({ push: noop }), useParams: () => ({ id: budget.id }), usePathname: () => `/accounting/budgets/${budget.id}` };
    if (id.endsWith("/layout")) return { useBudgetContext: () => ctx };
    if (id.endsWith("/create-drawer")) return { useCreateDrawer: () => ({ open: noop }) };
    if (id.endsWith("/use-debounce")) return { useDebounce: (value: string) => value };
    if (id.endsWith("/use-document-title")) return { useDocumentTitle: (title: string) => titles.push(title) };
    if (id.endsWith("/use-entity-title")) return { useEntityTitle: noop };
    if (id.endsWith("/use-confirm")) return { useConfirm: () => ({ confirm: noop, dialog: null }) };
    if (id.endsWith("/date-picker")) return DatePicker;
    if (id === "recharts") return Object.fromEntries(["AreaChart", "Area", "XAxis", "YAxis", "CartesianGrid", "Tooltip", "ResponsiveContainer", "Legend"].map(key => [key, (props: Record<string, unknown>) => { charts[key] = props; return createElement(key === "AreaChart" ? "svg" : inline, key === "AreaChart" ? null : props, props.children as ReactNode); }]));
    if (id.endsWith("/ui/sheet")) return Object.fromEntries(["Sheet", "SheetContent", "SheetHeader", "SheetTitle", "SheetDescription"].map(key => [key, inline]));
    if (id.endsWith("/ui/select")) return { Select: inline, SelectItem: ({ children, value }: { children: ReactNode; value: string }) => createElement("div", { "data-option": value }, children), SelectTrigger: inline, SelectContent: inline, SelectValue: ({ placeholder }: { placeholder?: string }) => createElement("span", null, placeholder) };
    return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  };
  new Function("require", "module", "exports", code)(load, compiled, compiled.exports);
  return compiled.exports[path === drawer ? "BudgetDrawer" : "default"];
}

function callback(path: string, name: string, scope: Record<string, unknown>) {
  const ast = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let expression = "";
  function visit(n: ts.Node) {
    if (path === drawer && ts.isFunctionDeclaration(n) && n.parent === ast && n.name?.text !== "BudgetDrawer") return;
    if (ts.isFunctionDeclaration(n) && n.name?.text === name) expression = n.getText(ast);
    ts.forEachChild(n, visit);
  }
  visit(ast); assert.ok(expression, name);
  const code = ts.transpileModule(`const run = ${expression};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(scope), `${code}; return run;`)(...Object.values(scope));
}

test("actual IRR budget cards and exact chart tooltip retain fixed-two cents and localize the axis unit", () => {
  for (const locale of locales) {
    const charts: Record<string, Record<string, unknown>> = {};
    const Page = loaded(overview, [], [], { ...context, currencyCode: "IRR" }, charts);
    const html = renderWithPresentation(createElement(Page), locale);
    assert.ok(html.includes(locale === "fa-IR" ? "ریال" : "IRR"));
    assert.ok(html.includes(escape(money.budgetMoney(amount, "IRR", resolvePresentation({ user: { language: locale } })))));
    const axis = charts.YAxis.tickFormatter as (value: number) => string;
    assert.ok(axis(1234).includes(locale === "fa-IR" ? "ریال" : "IRR"));
    const tooltip = charts.Tooltip.formatter as (...args: unknown[]) => string[];
    assert.deepEqual(tooltip(0, "", { dataKey: "actual", payload: { actualExact: -1n } }), [money.budgetMoney(-1n, "IRR", resolvePresentation({ user: { language: locale } }))]);
  }
});

test("budget list, detail shell, overview, settings and drawer render bilingual production content and exact amounts", () => {
  for (const locale of locales) {
    const t = translator(locale);
    const report = { currencyCode: "USD", totalBudgeted: amount, totalActual: 2n, comparisons: [comparison], daysRemaining: 2, totalDays: 59, daysElapsed: 57 };
    const cases: [string, unknown[], string[]][] = [
      [list, ["", [], false, {}, "", "all", false], ["budgets", "new", "tracking", "marketing"]],
      [list, ["", [budget, {...budget,id:"c",isActive:false}], false, { b: report, c: report }, "", "all", false], ["active", "inactive", "search"]],
      [layout, ["USD", budget, [comparison], amount, 2n, 3n, 57, 2, 59, [account], "", false], ["back", "totalBudget", "overview", "settings"]],
      [overview, [true], ["spendingTrend", "periodBreakdown", "budgeted", "actual"]],
      [settings, [caller, budget.startDate, budget.endDate, "monthly", [line], {}, {}, 0, false], ["general", "name", "save", "deleteBudget"]],
      [drawer, ["USD", false, caller, budget.startDate, budget.endDate, "monthly", [line], {}, {}, [account], 0], ["new", "info", "create", "totalBudgetLower"]],
    ];
    for (const [path, states, keys] of cases) {
      const Page = loaded(path, states);
      const html = renderWithPresentation(createElement(Page, { open: true, onClose: noop }), locale);
      for (const key of keys) assert.ok(html.includes(escape(t(key as keyof typeof en.Budgets))), `${path} ${locale} ${key}`);
      if (path !== list || states[1] !== cases[0][1][1]) {
        assert.ok(html.includes(escape(caller)), path);
        assert.ok(!html.includes("<script>"));
      }
      if ([overview,drawer,layout].includes(path)) assert.ok(html.includes(money.budgetMoney(amount, "USD", resolvePresentation({ user: { language: locale } }))), path);
      if (path === settings) assert.ok(html.includes(formatDecimalDraft(money.budgetDecimal(amount), resolvePresentation({ user: { language: locale } }))), path);
      if ([settings,drawer].includes(path)) {
        assert.ok(html.includes('data-option="monthly"'));
        assert.ok(html.includes(escape(t("amountForPeriod", { period: budgetPresentation.budgetPeriodLabel(t, "Jan 2026") }))));
      }
      if (path === drawer) assert.ok(html.includes(escape(t("cancel"))));
    }
    const Empty = loaded(overview, [], [], {...context,budget:{...budget,lines:[]},comparisons:[]});
    assert.ok(renderWithPresentation(createElement(Empty), locale).includes(escape(t("noConfiguredLines"))));
    const ErrorPage = loaded(list, [t("loadFailed"), [], false]);
    assert.ok(renderWithPresentation(createElement(ErrorPage),locale).includes(escape(t("loadFailed"))));
  }
});

test("display labels and translated chart names preserve canonical period keys and exact tooltip selection", () => {
  for (const locale of locales) {
    const t=translator(locale), charts: Record<string, Record<string, unknown>> = {};
    const Page=loaded(overview, [], [], context, charts);
    renderWithPresentation(createElement(Page),locale);
    const formatter=charts.Tooltip.formatter as (...args: unknown[]) => unknown;
    assert.deepEqual(formatter(0,t("budgeted"),{ dataKey:"budgeted",payload:{budgetedExact:amount,actualExact:2n}}),[money.budgetMoney(amount,"USD", resolvePresentation({ user: { language: locale } }))]);
    assert.deepEqual(formatter(0,t("actual"),{ dataKey:"actual",payload:{budgetedExact:amount,actualExact:2n}}),[money.budgetMoney(2n,"USD", resolvePresentation({ user: { language: locale } }))]);
    const data=charts.AreaChart.data as {name:string}[];
    assert.equal(data[0].name,"Jan 2026");
    for(const label of ["Full Period","Week 1","Q4 2026","Jan 2026","Jan 2, 2026"]) {
      const shown=budgetPresentation.budgetPeriodLabel(t,label);
      assert.equal(shown === label,locale === "en-US");
    }
    assert.equal(budgetPresentation.budgetPeriodLabel(t,caller),caller);
    assert.equal(budgetPresentation.budgetTypeLabel(t,"future_type"),"future_type");
    assert.equal((charts.YAxis.tickFormatter as (value:number)=>string)(2000), `${currencyLabel("USD", locale)} ${t("chartThousands",{value:"2"})}`);
  }
});

test("localized reads reject HTTP, malformed JSON and inconsistent exact money without exposing raw server errors", async () => {
  for(const locale of locales) {
    const t=translator(locale), fallback=t("detailLoadFailed");
    for(const [status,key] of [[401,"unauthenticated"],[403,"forbidden"],[422,"invalidInput"],[500,"detailLoadFailed"]] as const) {
      await assert.rejects(()=>budgetPresentation.budgetReadJson(Response.json({error:caller},{status}),t,fallback),{message:t(key)});
    }
    await assert.rejects(()=>budgetPresentation.budgetReadJson(Response.json({code:"LEGACY_NUMERIC_RANGE"},{status:409}),t,fallback),{message:t("invalidMoney")});
    for(const response of [new Response("bad json"),Response.json({amount:1,amountMinor:"2"})]) {
      try { await budgetPresentation.budgetReadJson(response,t,fallback); assert.fail(); } catch(error) { assert.equal(budgetPresentation.budgetFailureMessage(error,t,fallback),fallback); }
    }
    assert.equal(budgetPresentation.budgetFailureMessage(new Error(caller),t,fallback),fallback);
    for(const [value,key] of [["1e3","amountInvalid"],["90071992547409.92","amountRange"]] as const) {
      try { money.budgetInput(value); assert.fail(); } catch(error) { assert.equal(budgetPresentation.budgetFailureMessage(error,t,fallback),t(key)); }
    }
  }
});

test("production creation and settings callbacks keep exact wire payloads, localized failures, confirmations and success boundaries", async () => {
  for(const locale of locales) {
    const t=translator(locale);
    for(const path of [drawer,settings]) {
      const calls: {url:string;init:RequestInit}[]=[], errors:string[]=[], successes:string[]=[], events:string[]=[], redirects:string[]=[], saving:boolean[]=[];
      let status=200, currentOrg:string|null="org-a";
      const scope={ ...money,...budgetPresentation,t,id:"b",orgId:"org-a",budget,lines:[line],budgetLines:[line],budgetName:caller,name:caller,startDate:budget.startDate,endDate:budget.endDate,periodType:"monthly",annualAmounts:{},periodDrafts:{},
        localStorage:{getItem:()=>currentOrg},setSaving:(v:boolean)=>saving.push(v), toast:{error:(m:string)=>errors.push(m),success:(m:string)=>successes.push(m)},onClose:noop,refetch:noop,window:{dispatchEvent:(e:Event)=>events.push(e.type)},router:{push:(url:string)=>redirects.push(url)},
        fetch:async(url:string,init:RequestInit)=>{calls.push({url,init});return Response.json({error:caller},{status});},Event };
      const run=callback(path,path===drawer?"handleSubmit":"handleSave",scope);
      await run({preventDefault:noop});
      assert.equal(calls[0].url,path===drawer?"/api/v1/budgets":"/api/v1/budgets/b");
      assert.equal(calls[0].init.method,path===drawer?"POST":"PATCH");
      assert.equal((calls[0].init.headers as Record<string,string>)["x-organization-id"],"org-a");
      const body=JSON.parse(calls[0].init.body as string);
      assert.equal(body.lines[0].totalMinor,amount.toString()); assert.equal(body.lines[0].periods[0].label,"Jan 2026");
      assert.equal(body.name,caller); assert.equal(body.periodType,"monthly"); assert.equal(body.startDate,budget.startDate);
      assert.deepEqual(saving,[true,false]); assert.equal(errors.length,0); assert.equal(successes[0],t(path===drawer?"created":"updated"));
      status=500;successes.length=0;events.length=0;redirects.length=0;
      await run({preventDefault:noop});
      assert.equal(errors.at(-1),t(path===drawer?"createFailed":"updateFailed")); assert.equal(successes.length,0);assert.equal(events.length,0);assert.equal(redirects.length,0);
      if(path===drawer){currentOrg=null;saving.length=0;await run({preventDefault:noop});assert.deepEqual(saving,[]);}
      for(const [draft,key] of [["1e3","amountInvalid"],["90071992547409.92","amountRange"]] as const) {
        calls.length=0;errors.length=0;saving.length=0;currentOrg="org-a";
        await callback(path,path===drawer?"handleSubmit":"handleSave",{...scope,periodDrafts:{"0:0":draft}})({preventDefault:noop});
        assert.equal(calls.length,0);assert.equal(errors[0],t(key));assert.deepEqual(saving,[true,false]);
      }
      errors.length=0;calls.length=0;
      await callback(path,path===drawer?"handleSubmit":"handleSave",{...scope,lines:[],budgetLines:[]})({preventDefault:noop});
      assert.equal(calls.length,0);assert.equal(errors[0],t(path===drawer?"addAccountDrawer":"addAccount"));
    }
    for(const name of ["handleDelete","handleToggleActive"]) {
      let confirmOptions: Record<string,unknown>={}, status=500;
      const successes:string[]=[],errors:string[]=[],calls:RequestInit[]=[],events:string[]=[],redirects:string[]=[];
      const run=callback(settings,name,{...budgetPresentation,t,orgId:"org-a",id:"b",budget,confirm:async(opts:Record<string,unknown>)=>{confirmOptions=opts;},toast:{success:(m:string)=>successes.push(m),error:(m:string)=>errors.push(m)},fetch:async(_url:string,init:RequestInit)=>{calls.push(init);return Response.json({error:caller},{status});},refetch:noop,window:{dispatchEvent:(e:Event)=>events.push(e.type)},router:{push:(url:string)=>redirects.push(url)},Event});
      await run();assert.equal(calls.length,0);assert.equal(confirmOptions.cancelLabel,t("cancel"));
      const confirm=confirmOptions.onConfirm as ()=>Promise<void>;
      await assert.rejects(confirm);assert.equal(successes.length,0);assert.equal(events.length,0);assert.equal(redirects.length,0);assert.equal(errors[0],t(name==="handleDelete"?"deleteFailed":"updateFailed"));
      status=200;await confirm();assert.equal(successes.length,1);assert.deepEqual(events,["budgets-changed"]);
      if(name==="handleToggleActive") assert.deepEqual(JSON.parse(calls.at(-1)!.body as string),{isActive:false});
      else assert.equal(calls.at(-1)!.method,"DELETE");
    }
  }
});

test("budget source copy is cataloged and every Persian message retains Persian script", () => {
  for(const path of [list,layout,overview,settings,drawer]) {
    const source=readFileSync(path,"utf8"),ast=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
    function visit(node:ts.Node) {
      if(path===drawer && ts.isFunctionDeclaration(node) && node.parent===ast && node.name?.text!=="BudgetDrawer") return;
      if(ts.isJsxText(node)) assert.ok(!/[A-Za-z]/.test(node.text),`${path}: ${node.text.trim()}`);
      if(ts.isJsxAttribute(node) && ["placeholder","aria-label","title","alt","description"].includes(node.name.getText(ast)) && node.initializer && ts.isStringLiteral(node.initializer)) assert.equal(node.initializer.text,"0.00");
      ts.forEachChild(node,visit);
    }
    visit(ast);
  }
  for(const [key,value] of Object.entries(fa.Budgets)) {
    if(key === "monthLabel") assert.equal(value,"{month} {year}");
    else assert.ok(/[\u0600-\u06ff]/.test(value),key);
    assert.ok(!/\?{2,}|\ufffd/.test(value),key);
  }
});
