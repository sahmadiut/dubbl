import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import * as React from "react";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import * as intl from "next-intl";
import ts from "typescript";
import { compile } from "tailwindcss";
import * as Provider from "../i18n/provider";
import { localeDirection, resolvePresentation } from "../i18n/locale";
import { recurringInvoiceUiMoney } from "../lib/money/recurring-invoice-ui";
import { assetMoneyDisplay } from "../lib/money/asset-display";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

type Props = Record<string, unknown>;
const h = React.createElement, noop = () => {};
const require = createRequire(import.meta.url);
const CjsProvider = (require("../i18n/provider") as typeof Provider).PresentationProvider;
const caller = "  \u0645\u0627\u0644\u06cc\u0627\u062a Caller <GST/001> & " + "long-name-".repeat(24);
const reference = "HMRC-001/\u062D\u0633\u0627\u0628", minor = 4000000000000001n;
const presentations = (["en-US", "fa-IR"] as const).flatMap(language => (["latn", "arabext"] as const).map(numerals => resolvePresentation({ user: { language, numerals } })));
const esc = (v: string) => v.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
const template = { id: "doc-a", name: caller, type: "invoice", contactId: "customer-a", contact: { name: caller }, frequency: "monthly", status: "active", startDate: "2026-10-01", endDate: null, nextRunDate: "2026-11-01", lastRunDate: null, occurrencesGenerated: 12, maxOccurrences: null, reference, notes: caller, currencyCode: "USD", lines: [] };
const schedule = { id: "doc-a", totalAmount: 9007199254740991, recognizedAmount: 1, startDate: "2026-10-01", endDate: "2027-01-01", method: "straight_line", status: "active", invoiceId: "invoice-a", entries: [{ id: "raw-entry-a", periodDate: "2026-11-01", amount: 1, recognized: false, journalEntryId: null }] };
// Execute the production components, provider, fields, money and shared controls.
// Only own state scheduling, effects, navigation and sheet portals are controlled.
function loaded(relative: string, exported: string, states: Props = {}, props: Props = {}) {
  const file = `app/(dashboard)/sales/${relative}`, original = readFileSync(file, "utf8");
  const ast = ts.createSourceFile(file, original, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const edits: { start: number; end: number; text: string }[] = [];
  function visit(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && ts.isArrayBindingPattern(node.name) && node.initializer && ts.isCallExpression(node.initializer) && node.initializer.expression.getText(ast) === "useState") {
      let owner: ts.Node | undefined = node.parent;
      while (owner && !ts.isFunctionDeclaration(owner)) owner = owner.parent;
      assert.ok(owner && ts.isFunctionDeclaration(owner) && owner.name);
      const key = `${owner.name.text}.${node.name.elements[0].getText(ast)}`;
      edits.push({ start: node.initializer.getStart(ast), end: node.initializer.end, text: `controlledState(${JSON.stringify(key)}, ${node.initializer.arguments[0]?.getText(ast) ?? "undefined"})` });
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  let source = original;
  for (const edit of edits.sort((a, b) => b.start - a.start)) source = source.slice(0, edit.start) + edit.text + source.slice(edit.end);
  source = source.replace(/typeof window !== "undefined"\s*\? localStorage.getItem\("activeOrgId"\)\s*: null/g, '"org-a"');
  if (exported !== "default") source += `\nexport { ${exported} };`;
  const compiled = { exports: {} as Record<string, React.ComponentType<Props>> }, localRequire = createRequire(resolve(file));
  const controls: { type: unknown; props: Props }[] = [], updates: unknown[][] = [], events: unknown[] = [];
  const capture = (create: typeof jsx.jsx) => (type: React.ElementType, p: Props, key?: string) => { controls.push({ type, props: p }); return create(type, p, key); };
  const controlledState = (key: string, initial: unknown) => [key in states ? states[key] : typeof initial === "function" ? initial() : initial, (v: unknown) => updates.push([key, v])];
  const inline = ({ children, dir, className }: { children: React.ReactNode; dir?: string; className?: string }) => h("div", { dir, className }, children);
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function("require", "module", "exports", "controlledState", js)((id: string) => {
    if (id === "react") return { ...React, useEffect: noop, useCallback: (fn: unknown) => fn, useMemo: (fn: () => unknown) => fn() };
    if (id === "react/jsx-runtime") return { ...jsx, jsx: capture(jsx.jsx), jsxs: capture(jsx.jsxs) };
    if (id === "next-intl") return intl;
    if (id.endsWith("/i18n/provider")) return Provider;
    if (id === "next/navigation") return { useParams: () => ({ id: "doc-a" }), useRouter: () => ({ push: (v: unknown) => events.push(v) }) };
    if (id.endsWith("/create-drawer")) return { useCreateDrawer: () => ({ open: (v: unknown) => events.push(v) }) };
    if (id.endsWith("/use-debounce")) return { useDebounce: (v: unknown) => v };
    if (id.endsWith("/use-confirm")) return { useConfirm: () => ({ confirm: noop, dialog: null }) };
    if (["/send-document-dialog", "/email-history", "/receipt-attachments"].some(suffix => id.endsWith(suffix))) return { SendDocumentDialog: () => null, EmailHistory: () => null, ReceiptAttachments: () => null };
    if (id.endsWith("/ui/select")) return Object.fromEntries(["Select", "SelectContent", "SelectItem", "SelectTrigger", "SelectValue"].map(key => [key, ({children, ...p}: {children: React.ReactNode}) => h("div", p, children)]));
    if (id.endsWith("/ui/dialog")) return Object.fromEntries(["Dialog", "DialogContent", "DialogHeader", "DialogTitle", "DialogTrigger"].map(key => [key, inline]));
    if (id.endsWith("/use-document-title")) return { useDocumentTitle: noop };
    if (id.endsWith("/use-entity-title")) return { useEntityTitle: noop };
    if (id.endsWith("/ui/sheet")) return Object.fromEntries(["Sheet", "SheetContent", "SheetHeader", "SheetTitle", "SheetTrigger", "SheetFooter"].map(key => [key, inline]));
    return localRequire(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  }, compiled, compiled.exports, controlledState);
  return { controls, updates, events, render(p: typeof presentations[number]) {
    controls.length = 0;
    const root = { presentation: p, messages: p.locale === "fa-IR" ? fa : en, now: new Date("2026-10-26T00:00:00Z") };
    return renderToStaticMarkup(h(Provider.PresentationProvider, root, h(CjsProvider, root, h(compiled.exports[exported], props))));
  } };
}
function control(page: ReturnType<typeof loaded>, predicate: (c: { type: unknown; props: Props }) => boolean) {
  const found = page.controls.find(predicate); assert.ok(found); return found.props;
}

test("recurring and revenue lists isolate exact caller/date/money tokens and preserve directed raw callbacks", () => {
  for (const p of presentations) {
    const recurring = loaded("recurring/page.tsx", "RecurringInvoicesContent", { "RecurringInvoicesContent.initialLoad": false, "RecurringInvoicesContent.templates": [template], "RecurringInvoicesContent.upcoming": [{ templateName: caller, contactName: caller, currencyCode: "USD", lineTotal: minor, dates: [{ date: template.nextRunDate, occurrence: 1 }] }] });
    const revenue = loaded("revenue-schedules/page.tsx", "default", { "RevenueSchedulesPage.initialLoad": false, "RevenueSchedulesPage.schedules": [schedule] });
    for (const [page, row, route] of [[recurring, template, "/sales/recurring/doc-a"], [revenue, schedule, "/sales/revenue-schedules/doc-a"]] as const) {
      const html = page.render(p);
      assert.ok(html.includes("text-end") && html.includes('dir="ltr"'));
      const tabs = control(page, c => c.props.value === "all" && typeof c.props.onValueChange === "function"); assert.equal(tabs.dir, localeDirection(p.locale));
      (tabs.onValueChange as (v: string) => void)("active"); assert.equal(page.updates.at(-1)?.[1], "active");
      const search = control(page, c => c.props.dir === "auto" && typeof c.props.onChange === "function"); assert.ok(search["aria-label"]);
      (search.onChange as (v: unknown) => void)({ target: { value: caller } }); assert.equal(page.updates.at(-1)?.[1], caller);
      (control(page, c => typeof c.props.onRowClick === "function").onRowClick as (v: unknown) => void)(row); assert.equal(page.events.at(-1), route);
    }
    const html = recurring.render(p); for (const value of [caller, template.startDate, template.nextRunDate, recurringInvoiceUiMoney(minor, "USD", p), "12 / \u221e"]) assert.ok(html.includes(`>${esc(value)}</bdi>`), value);
    const sort = control(recurring, c => c.props.value === "created:desc" && typeof c.props.onValueChange === "function"); assert.equal(sort.dir, localeDirection(p.locale));
    (sort.onValueChange as (v: string) => void)("nextRun:asc"); assert.deepEqual(recurring.updates.slice(-2), [["RecurringInvoicesContent.sortBy", "nextRun"], ["RecurringInvoicesContent.sortOrder", "asc"]]);
    const revenueHtml = revenue.render(p); assert.ok(revenueHtml.includes(`>${esc(assetMoneyDisplay(schedule.totalAmount, p))}</bdi>`));
  }
});

test("recurring details retain raw status PATCH and isolate caller notes/count/date", async () => {
  for (const p of presentations) {
    const page = loaded("recurring/[id]/page.tsx", "default", { "RecurringDetailPage.loaded": { context: "org-a:doc-a", template }, "RecurringDetailPage.loading": false });
    const html = page.render(p); for (const value of [caller, template.nextRunDate, "12 / \u221e"]) assert.ok(html.includes(`>${esc(value)}</bdi>`), value);
    const previous = globalThis.fetch, requests: {url:string; init?:RequestInit}[] = [];
    globalThis.fetch = (async (url, init) => { requests.push({url:String(url), init}); return new Response(JSON.stringify({template: {...template,status:"paused"}})); }) as typeof fetch;
    try { await (control(page, c => typeof c.props.onClick === "function" && (c.props.onClick as () => void).name === "handleToggleStatus").onClick as () => Promise<void>)();
      assert.equal(requests[0].url,"/api/v1/recurring/doc-a"); assert.equal(requests[0].init?.method,"PATCH"); assert.deepEqual(JSON.parse(String(requests[0].init?.body)),{status:"paused"}); assert.equal((requests[0].init?.headers as Props)["x-organization-id"],"org-a");
    } finally {globalThis.fetch=previous;}
  }
});

test("revenue details isolate exact signed amounts and retain recognition entry POST", async () => {
  for (const p of presentations) {
    const page=loaded("revenue-schedules/[id]/page.tsx","default",{"RevenueScheduleDetailPage.rs":schedule,"RevenueScheduleDetailPage.loading":false});
    const html=page.render(p); for(const value of [schedule.entries[0].periodDate,assetMoneyDisplay(1,p),assetMoneyDisplay(schedule.totalAmount,p)]) assert.ok(html.includes(`>${esc(value)}</bdi>`),value);
    const previous=globalThis.fetch, requests:{url:string;init?:RequestInit}[]=[];
    globalThis.fetch=(async(url,init)=>{requests.push({url:String(url),init});return new Response(JSON.stringify({schedule}));}) as typeof fetch;
    try{await(control(page,c=>typeof c.props.onClick==="function"&&(c.props.onClick as ()=>void).name==="handleRecognize").onClick as ()=>Promise<void>)();assert.equal(requests[0].url,"/api/v1/revenue-schedules/doc-a/recognize");assert.equal(requests[0].init?.method,"POST");assert.deepEqual(JSON.parse(String(requests[0].init?.body)),{entryId:"raw-entry-a"});assert.equal((requests[0].init?.headers as Props)["x-organization-id"],"org-a");}finally{globalThis.fetch=previous;}
  }
});

test("empty recurring/revenue examples isolate complete signed money and keep create callbacks",()=>{
 for(const p of presentations)for(const [path,name,key,action,amount] of [["recurring/page.tsx","RecurringInvoicesContent","RecurringInvoicesContent","recurring",recurringInvoiceUiMoney(29900n,"USD",p)],["revenue-schedules/page.tsx","default","RevenueSchedulesPage","revenueSchedule","+"+recurringInvoiceUiMoney(10000n,"USD",p)]] as const){const page=loaded(path,name,{[key+".initialLoad"]:false});const html=page.render(p);assert.ok(html.includes(`>${esc(amount)}</bdi>`),amount);(control(page,c=>typeof c.props.onClick==="function").onClick as ()=>void)();assert.equal(page.events.at(-1),action);}
});

test("installed CSS exposes logical alignment/spacing, local scroll and long caller/control wrapping",async()=>{
 const compiler=await compile("@theme { --spacing:0.25rem; --color-blue-400:#60a5fa; } @tailwind utilities;");const css=compiler.build(["start-2.5","ps-8","me-2","ms-2","text-end","border-s-[3px]","border-s-blue-400","flex-wrap","max-w-full","min-w-0","overflow-x-auto","[overflow-wrap:anywhere]","h-auto","whitespace-normal"]);for(const rule of ["inset-inline-start:","padding-inline-start:","margin-inline-end:","margin-inline-start:","text-align: end","border-inline-start-width:","border-inline-start-color:","flex-wrap: wrap","max-width: 100%","min-width:","overflow-x: auto","overflow-wrap: anywhere","height: auto","white-space: normal"])assert.ok(css.includes(rule),rule);
});
