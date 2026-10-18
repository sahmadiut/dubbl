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
import * as DataTable from "../components/dashboard/data-table";
import * as DatePicker from "../components/ui/date-picker";
import * as BrandLoader from "../components/dashboard/brand-loader";
import * as AccountPicker from "../components/dashboard/account-picker";
import * as presentation from "../i18n/accrual-presentation";
import { accrualUiInput, accrualUiPeriods } from "../lib/money/budget-ui";
import { assetMoneyDisplay } from "../lib/money/asset-display";
import { renderWithPresentation } from "./helpers/presentation";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const list = "app/(dashboard)/accounting/accruals/page.tsx";
const detail = "app/(dashboard)/accounting/accruals/[id]/page.tsx";
const drawer = "components/dashboard/create-drawer.tsx";
const locales = ["en-US", "fa-IR"] as const;
const noop = () => {};
const caller = '<script>Accrual & account</script>';
const entry = { id: "entry-a", periodDate: "2026-01-01", amount: 4000000000000001, amountMinor: "4000000000000001", posted: false, journalEntryId: null, sortOrder: 0 };
const schedule = { id: "schedule-a", description: caller, totalAmount: 4000000000000001, totalAmountMinor: "4000000000000001", startDate: "2026-01-01", endDate: "2026-01-31", periods: 1, status: "active", entries: [entry] };
function translator(locale: typeof locales[number]) { return createTranslator({ locale, messages: locale === "en-US" ? en : fa, namespace: "Accruals" }); }
function escape(value: string) { return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;"); }

// Real production JSX, next-intl provider, tables, fields and money. Controlled
// hooks and inline portals make every state inspectable without a dev server.
function loaded(path: string, states: unknown[], titles: string[] = []) {
  let source = readFileSync(path, "utf8"), index = 0;
  const require = createRequire(resolve(path));
  const compiled = { exports: {} as Record<string, ComponentType<Record<string, unknown>>> };
  if (path === drawer) {
    const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const names = new Set(["AccrualScheduleDrawer", "DrawerFooter", "DrawerIcon", "SectionLabel"]);
    // Keep imports referenced by the selected production functions only.
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
    }).join("\n") + "\nexport { AccrualScheduleDrawer };";
  }
  const inline = ({ children, title }: { children: ReactNode; title?: string }) => createElement("div", { title }, children);
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  const load = (id: string) => {
    if (id === "next-intl") return nextIntl;
    if (id === "react") return { ...React, useState: (initial: unknown) => [index < states.length ? states[index++] : initial, noop], useEffect: noop, useMemo: (fn: () => unknown) => fn(), useCallback: (fn: unknown) => fn, useRef: (value: unknown) => ({ current: value }) };
    if (id === "next/navigation") return { useRouter: () => ({ push: noop }), useParams: () => ({ id: schedule.id }) };
    if (id.endsWith("/create-drawer")) return { useCreateDrawer: () => ({ open: noop }) };
    if (id.endsWith("/use-debounce")) return { useDebounce: (value: string) => value };
    if (id.endsWith("/use-document-title")) return { useDocumentTitle: (title: string) => titles.push(title) };
    if (id.endsWith("/use-entity-title")) return { useEntityTitle: noop };
    if (id.endsWith("/use-confirm")) return { useConfirm: () => ({ confirm: noop, dialog: null }) };
    if (id.endsWith("/data-table")) return DataTable;
    if (id.endsWith("/date-picker")) return DatePicker;
    if (id.endsWith("/brand-loader")) return BrandLoader;
    if (id.endsWith("/account-picker")) return AccountPicker;
    if (id.endsWith("/ui/sheet")) return Object.fromEntries(["Sheet", "SheetContent", "SheetHeader", "SheetTitle", "SheetDescription"].map(key => [key, inline]));
    if (id.endsWith("/ui/dialog")) return Object.fromEntries(["Dialog", "DialogContent", "DialogHeader", "DialogTitle", "DialogDescription"].map(key => [key, inline]));
    if (id.endsWith("/ui/dropdown-menu")) return Object.fromEntries(["DropdownMenu", "DropdownMenuContent", "DropdownMenuItem", "DropdownMenuSeparator", "DropdownMenuTrigger"].map(key => [key, inline]));
    if (id.endsWith("/ui/select")) return { Select: ({ children, value }: { children: ReactNode; value: string }) => createElement("div", { "data-value": value }, children), SelectItem: ({ children, value }: { children: ReactNode; value: string }) => createElement("div", { "data-option": value }, children), SelectTrigger: inline, SelectContent: inline, SelectValue: ({ placeholder }: { placeholder?: string }) => createElement("span", null, placeholder) };
    return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  };
  new Function("require", "module", "exports", code)(load, compiled, compiled.exports);
  return compiled.exports[path === drawer ? "AccrualScheduleDrawer" : "default"];
}
function callback(path: string, name: string, scope: Record<string, unknown>, effectIndex = 0) {
  const ast = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let expression = "", effect = 0;
  function visit(n: ts.Node) {
    if (path === drawer && ts.isFunctionDeclaration(n) && n.parent === ast && n.name?.text !== "AccrualScheduleDrawer") return;
    if (ts.isFunctionDeclaration(n) && n.name?.text === name) expression = n.getText(ast);
    if (ts.isVariableDeclaration(n) && n.name.getText(ast) === name && n.initializer && ts.isCallExpression(n.initializer)) expression = n.initializer.arguments[0].getText(ast);
    if (name === "effect" && ts.isCallExpression(n) && n.expression.getText(ast) === "useEffect" && effect++ === effectIndex) expression = n.arguments[0].getText(ast);
    ts.forEachChild(n, visit);
  }
  visit(ast); assert.ok(expression, name);
  const code = ts.transpileModule(`const run = ${expression};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(scope), `${code}; return run;`)(...Object.values(scope));
}

function listStates(rows: unknown[], search = "", error = "") { return [error, rows, false, false, false, 1, rows.length, 0, "all", search, 0]; }

test("accrual pages and drawer render real bilingual content, exact amounts, escaped data and plural sentences", () => {
  for (const locale of locales) {
    const t = translator(locale), titles: string[] = [];
    const cases: [string, unknown[], (keyof typeof en.Accruals)[]][] = [
      [list, listStates([]), ["accruals", "new", "intro", "how", "oneOff", "insurance", "spreadExample", "littleEachMonth", "fairShare", "when", "upfront", "upfrontDescription", "bigBill", "bigBillDescription", "income", "incomeDescription", "smoother", "smootherDescription"]],
      [list, listStates([schedule, {...schedule,id:"b",status:"completed"}, {...schedule,id:"c",status:"cancelled"}], "account"), ["scheduled", "runningTab", "finishedTab", "cancelledTab", "search", "clearFilters", "purpose", "total", "months", "starts", "status", "running", "finished", "cancelled"]],
      [detail, ["", {...schedule, entries:[entry,{...entry,id:"b",posted:true}]}, false, false], ["back", "post", "cancelAccrual", "recordedSoFar", "month", "amount", "recorded", "notYet"]],
      [drawer, [false, caller, "40000000000000.01", "retry-a", "2026-01-01", "2026-01-31", "1", "a", "b"], ["new", "drawerDescription", "details", "description", "totalAmount", "periodCount", "startDate", "endDate", "accounts", "account", "reverseAccount", "create", "cancel"]],
    ];
    for (const [path, states, keys] of cases) {
      const Page = loaded(path, states, titles);
      const html = renderWithPresentation(createElement(Page, {open:true,onClose:noop}),locale);
      for(const key of keys) assert.ok(html.includes(escape(t(key))),`${path} ${locale} ${key}`);
      assert.ok(!html.includes("<script>"));
      if (path !== list || states[1] !== cases[0][1][1]) assert.ok(html.includes(escape(caller)),path);
      if (path === detail || path === list && states[1] !== cases[0][1][1]) assert.ok(html.includes(assetMoneyDisplay(schedule.totalAmount)),path);
      if (path === drawer) {
        assert.ok(html.includes('value="40000000000000.01"'));
        assert.ok(html.includes('drawer-accrual-amount'));
      }
    }
    assert.equal(titles[0],t("documentTitle"));
    const ErrorPage=loaded(list,listStates([],"",t("loadFailed")));
    assert.ok(renderWithPresentation(createElement(ErrorPage),locale).includes(`role="alert">${escape(t("loadFailed"))}`));
    const Missing=loaded(detail,["",null,false]);
    assert.ok(renderWithPresentation(createElement(Missing),locale).includes(escape(t("notFound"))));
    const Filtered=loaded(list,listStates([schedule],"no match"));
    assert.ok(renderWithPresentation(createElement(Filtered),locale).includes(escape(t("noMatches"))));
    const Large=loaded(list,listStates(Array.from({length:4},(_,i)=>({...schedule,id:String(i)}))));
    assert.ok(renderWithPresentation(createElement(Large),locale).includes(assetMoneyDisplay(16000000000000004n)));
    const Saving=loaded(drawer,[true,caller,"1.00","retry-a","2026-01-01","2026-01-31","1","a","b"]);
    assert.ok(renderWithPresentation(createElement(Saving,{open:true,onClose:noop}),locale).includes(escape(t("creating"))));
    assert.equal(presentation.accrualStatusLabel(t,"future_status"),"future_status");
    for(const count of [0,1,2]) {
      assert.ok(t("showing",{shown:count,count}).length>0);
      assert.ok(t("summary",{amount:"$1.00",count}).includes("$1.00"));
    }
    if(locale==="en-US") { assert.equal(t("summary",{amount:"$1.00",count:1}),"$1.00 over 1 month"); assert.equal(t("showing",{shown:2,count:2}),"Showing 2 of 2 accruals"); }
  }
});

test("accrual response validation preserves exact aliases and hides unknown, malformed and authorization failures", async () => {
  for(const locale of locales) {
    const t=translator(locale), fallback=t("loadFailed");
    assert.deepEqual(await presentation.accrualJson(Response.json({schedule}),t,fallback,"schedule"),{schedule});
    for(const [status,key] of [[401,"unauthenticated"],[403,"forbidden"],[422,"invalidInput"],[500,"loadFailed"]] as const) {
      try { await presentation.accrualJson(Response.json({error:caller},{status}),t,fallback,"list"); assert.fail(); }
      catch(err) { assert.equal(presentation.accrualFailureMessage(err,t,fallback),t(key)); }
    }
    await assert.rejects(()=>presentation.accrualJson(Response.json({code:"LEGACY_NUMERIC_RANGE"},{status:409}),t,fallback,"list"),{message:t("invalidMoney")});
    for(const payload of [{schedule:{...schedule,totalAmountMinor:"1"}}, {schedule:{...schedule,entries:[{...entry,amountMinor:"2"}]}}, {schedule:{...schedule,totalAmountMinor:undefined}}, {schedule:{...schedule,entries:null}}, {data:[],pagination:{total:"2"}}, null]) {
      try { await presentation.accrualJson(Response.json(payload),t,fallback,"schedule"); assert.fail(); }
      catch(err) { assert.equal(presentation.accrualFailureMessage(err,t,fallback),fallback); }
    }
    await assert.rejects(()=>presentation.accrualJson(new Response("not json"),t,fallback,"schedule"));
    assert.equal(presentation.accrualFailureMessage(new Error(caller),t,fallback),fallback);
  }
});

test("production accrual creation keeps exact decimal, dates, retry and org payloads and localizes validation and failures", async () => {
  for(const locale of locales) {
    const t=translator(locale), errors:string[]=[], successes:string[]=[], redirects:string[]=[], saving:boolean[]=[], calls:{url:string;init:RequestInit}[]=[];
    let status=200, invalid=false, org:string|null="org-a", closed=0;
    const scope={...presentation,accrualUiInput,accrualUiPeriods,t,description:caller,totalAmount:"40000000000000.01",periods:"1",startDate:schedule.startDate,endDate:schedule.endDate,accountId:"account-a",reverseAccountId:"account-b",retryKey:"retry-a",
      localStorage:{getItem:()=>org},setSaving:(v:boolean)=>saving.push(v),toast:{error:(m:string)=>errors.push(m),success:(m:string)=>successes.push(m)},onClose:()=>closed++,router:{push:(url:string)=>redirects.push(url)},
      fetch:async(url:string,init:RequestInit)=>{calls.push({url,init});return Response.json(status===200&&!invalid?{schedule}:{error:caller},{status});}};
    const run=callback(drawer,"handleSubmit",scope);
    await run({preventDefault:noop});
    assert.deepEqual(JSON.parse(calls[0].init.body as string),{description:caller,totalAmountExact:"40000000000000.01",idempotencyKey:"retry-a",startDate:schedule.startDate,endDate:schedule.endDate,periods:1,accountId:"account-a",reverseAccountId:"account-b"});
    assert.equal(calls[0].url,"/api/v1/accrual-schedules");assert.equal(calls[0].init.method,"POST");
    assert.equal((calls[0].init.headers as Record<string,string>)["x-organization-id"],"org-a");
    assert.deepEqual(saving,[true,false]);assert.deepEqual(successes,[t("created")]);assert.equal(closed,1);assert.deepEqual(redirects,[`/accounting/accruals/${schedule.id}`]);
    for(const failure of ["http","malformed"]) {
      status=failure==="http"?500:200;invalid=true;successes.length=0;redirects.length=0;closed=0;
      await run({preventDefault:noop}); assert.equal(errors.at(-1),t("createFailed"));assert.deepEqual(successes,[]);assert.deepEqual(redirects,[]);assert.equal(closed,0);
    }
    for(const [input,key] of [[{description:" "},"descriptionRequired"],[{accountId:""},"accountRequired"],[{reverseAccountId:""},"reverseRequired"],[{endDate:""},"endRequired"],[{totalAmount:"1e3"},"amountInvalid"],[{totalAmount:"90071992547409.92"},"amountRange"],[{periods:"1201"},"periodsInvalid"]] as const) {
      calls.length=0;saving.length=0;
      await callback(drawer,"handleSubmit",{...scope,...input})({preventDefault:noop});
      assert.equal(errors.at(-1),t(key));assert.deepEqual(calls,[]);assert.deepEqual(saving,[]);
    }
    org=null;saving.length=0;await run({preventDefault:noop});assert.deepEqual(saving,[]);assert.equal(errors.at(-1),t("unauthenticated"));
  }
});

test("production accrual posting and cancellation retain failure/retry state and announce only validated success", async () => {
  for(const locale of locales) {
    const t=translator(locale);
    for(const name of ["handlePostNext","handleCancel"]) {
      const calls:{url:string;init:RequestInit}[]=[],errors:string[]=[],successes:string[]=[],posting:boolean[]=[];
      let options:Record<string,unknown>={}, refresh=0, status=500, malformed=false;
      const run=callback(detail,name,{...presentation,t,orgId:"org-a",id:schedule.id,acc:schedule,setPosting:(v:boolean)=>posting.push(v),refetch:async()=>refresh++,confirm:async(opts:Record<string,unknown>)=>{options=opts;},toast:{error:(m:string)=>errors.push(m),success:(m:string)=>successes.push(m)},fetch:async(url:string,init:RequestInit)=>{calls.push({url,init});return Response.json(status!==200||malformed?{error:caller}:name==="handlePostNext"?{entry}:{success:true},{status});}});
      await run();
      const perform=name==="handleCancel"?options.onConfirm as ()=>Promise<void>:run;
      if(name==="handleCancel") {
        assert.equal(options.title,t("cancelQuestion"));assert.equal(options.cancelLabel,t("keep"));assert.equal(calls.length,0);
        await assert.rejects(perform);
      }
      assert.equal(errors.at(-1),t(name==="handleCancel"?"cancelFailed":"postFailed"));assert.deepEqual(successes,[]);assert.equal(refresh,0);
      status=200;malformed=true;
      if(name==="handleCancel") await assert.rejects(perform);else await perform();
      assert.deepEqual(successes,[]);assert.equal(refresh,0);
      malformed=false;await perform();assert.equal(refresh,1);assert.equal(successes[0],t(name==="handleCancel"?"cancelSuccess":"posted"));
      assert.equal(calls.at(-1)!.url,`/api/v1/accrual-schedules/${schedule.id}${name==="handlePostNext"?"/post":""}`);
      assert.equal(calls.at(-1)!.init.method,name==="handlePostNext"?"POST":"DELETE");assert.equal((calls.at(-1)!.init.headers as Record<string,string>)["x-organization-id"],"org-a");
      if(name==="handlePostNext") { assert.deepEqual(JSON.parse(calls.at(-1)!.init.body as string),{entryId:entry.id});assert.deepEqual(posting,[true,false,true,false,true,false]); }
    }
  }
});

test("production accrual reads preserve saved state on failure and list paging keeps machine filters", async () => {
  for(const locale of locales) {
    const t=translator(locale), errors:string[]=[], saved:unknown[]=[], loading:boolean[]=[], pages:number[]=[],calls:string[]=[];
    let valid=false;
    const scope={...presentation,t,id:schedule.id,orgId:"org-a",setError:(m:string)=>errors.push(m),setAcc:(v:unknown)=>saved.push(v),setSchedules:(v:unknown)=>saved.push(v),setTotalCount:noop,setInitialLoad:(v:boolean)=>loading.push(v),setLoading:(v:boolean)=>loading.push(v),setRefetching:noop,setPage:(v:number)=>pages.push(v),setFetchKey:noop,setLoadingMore:noop,devDelay:noop,page:1,loadingMore:false,buildParams:(p:number)=>new URLSearchParams({status:"active",page:String(p),limit:"50"}),fetch:async(url:string)=>{calls.push(url);return Response.json(valid?(url.includes("?")?{data:[schedule],pagination:{total:1}}:{schedule}):{error:caller},{status:valid?200:500});}};
    const read=callback(detail,"refetch",scope);await read();assert.equal(errors.at(-1),t("detailLoadFailed"));assert.deepEqual(saved,[]);assert.deepEqual(loading,[false]);
    valid=true;await read();assert.deepEqual(saved,[schedule]);assert.equal(errors.at(-1),"");
    valid=false;saved.length=0;
    callback(list,"effect",scope)();await new Promise(r=>setImmediate(r));assert.equal(errors.at(-1),t("loadFailed"));assert.deepEqual(saved,[]);
    valid=true;callback(list,"effect",scope)();await new Promise(r=>setImmediate(r));assert.deepEqual(saved,[[schedule]]);
    callback(list,"loadMore",scope)();await new Promise(r=>setImmediate(r));assert.equal(calls.at(-1),"/api/v1/accrual-schedules?status=active&page=2&limit=50");assert.equal(pages.at(-1),2);
  }
});

test("all authored accrual JSX copy uses catalogs and Persian messages retain Persian script", () => {
  for(const path of [list,detail,drawer]) {
    const source=readFileSync(path,"utf8"),ast=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
    function visit(node:ts.Node) {
      if(path===drawer && ts.isFunctionDeclaration(node) && node.parent===ast && node.name?.text!=="AccrualScheduleDrawer") return;
      if(ts.isJsxText(node)) assert.ok(!/[A-Za-z]/.test(node.text),`${path}: ${node.text.trim()}`);
      if(ts.isJsxAttribute(node) && ["placeholder","aria-label","title","alt","description","label"].includes(node.name.getText(ast)) && node.initializer && ts.isStringLiteral(node.initializer)) assert.fail(`${path}: ${node.getText(ast)}`);
      ts.forEachChild(node,visit);
    }
    visit(ast);
  }
  for(const [key,value] of Object.entries(fa.Accruals)) { assert.ok(/[\u0600-\u06ff]/.test(value),key);assert.ok(!/\?{2,}|\ufffd/.test(value),key); }
});
