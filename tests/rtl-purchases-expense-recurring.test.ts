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
import { expenseUiMoney } from "../lib/money/expense-ui";
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

// Execute the production components, provider, fields, money and shared controls.
// Only own state scheduling, effects, navigation and sheet portals are controlled.
function loaded(relative: string, exported: string, states: Props = {}, props: Props = {}) {
  const file = `app/(dashboard)/purchases/${relative}`, original = readFileSync(file, "utf8");
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
  source = source.replaceAll('typeof window !== "undefined" ? localStorage.getItem("activeOrgId") : null', '"org-a"');
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
    if (id === "next/navigation") return { useParams: () => ({ id: "claim-a" }), useRouter: () => ({ push: (v: unknown) => events.push(v) }) };
    if (id.endsWith("/create-drawer")) return { useCreateDrawer: () => ({ open: (v: unknown) => events.push(v) }) };
    if (id.endsWith("/use-debounce")) return { useDebounce: (v: unknown) => v };
    if (id.endsWith("/use-confirm")) return { useConfirm: () => ({ confirm: noop, dialog: null }) };
    if (id.endsWith("/contact-picker")) return { ContactPicker: () => null };
    if (id.endsWith("/file-uploader")) return { FileUploader: () => null };
    if (["/send-document-dialog", "/email-history", "/receipt-attachments"].some(suffix => id.endsWith(suffix))) return { SendDocumentDialog: () => null, EmailHistory: () => null, ReceiptAttachments: () => null };
    if (id.endsWith("/ui/dialog")) return Object.fromEntries(["Dialog", "DialogContent", "DialogHeader", "DialogTitle", "DialogTrigger"].map(key => [key, inline]));
    if (id === "motion/react") return { motion: { div: inline }, MotionConfig: inline };
    if (id.endsWith("/use-document-title")) return { useDocumentTitle: noop };
    if (id.endsWith("/use-entity-title")) return { useEntityTitle: noop };
    if (id.endsWith("/ui/sheet")) return Object.fromEntries(["Sheet", "SheetContent", "SheetHeader", "SheetTitle", "SheetTrigger", "SheetFooter", "SheetDescription"].map(key => [key, inline]));
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

const supplier="00000000-0000-4000-8000-000000000001";
const item={id:"item-a",date:"2026-10-27",description:caller,amount:Number(minor),amountMinor:String(minor),category:caller,accountId:supplier,receiptFileKey:"",receiptFileName:"",account:{code:reference,name:caller},isMileage:false,distanceMiles:null,mileageRate:null};
const claim={id:"claim-a",title:caller,description:caller,status:"approved",totalAmount:Number(minor),totalAmountMinor:String(minor),currencyCode:"USD",createdAt:"2026-10-27T08:00:00Z",submittedAt:null,approvedAt:null,paidAt:null,rejectionReason:caller,submittedByUser:{name:caller,email:"caller@example.test"},items:[item]};
const invoke=(p:Props,key:string,...args:unknown[])=>(p[key] as (...v:unknown[])=>unknown)(...args);

test("expense list preserves mixed caller/exact totals and named directed raw filters/navigation",()=>{
 for(const p of presentations){
  const page=loaded("expenses/page.tsx","ExpensesWorkspace",{"ExpensesWorkspace.loading":false,"ExpensesWorkspace.claims":[claim],"ExpensesWorkspace.countsData":{total:1,counts:{approved:{count:1,amountMinor:String(minor),currencyCode:"USD"}}}});
  const html=page.render(p);for(const v of [caller,expenseUiMoney(minor,"USD",p)])assert.ok(html.includes(`>${esc(v)}</bdi>`),v);
  assert.ok(html.includes('role="group"')&&html.includes('text-end')&&html.includes('>(1)</bdi>'));
  const search=control(page,c=>c.props.dir==="auto"&&typeof c.props.onChange==="function");assert.ok(search["aria-label"]);invoke(search,"onChange",{target:{value:caller}});assert.equal(page.updates.at(-1)?.[1],caller);
  const tabs=control(page,c=>c.props.value==="all"&&typeof c.props.onValueChange==="function");assert.equal(tabs.dir,localeDirection(p.locale));invoke(tabs,"onValueChange","submitted");assert.equal(page.updates.at(-1)?.[1],"submitted");
  invoke(control(page,c=>typeof c.props.onRowClick==="function"),"onRowClick",claim);assert.equal(page.events.at(-1),"/purchases/expenses/claim-a");
  const sort=control(page,c=>c.props.value==="created:desc"&&typeof c.props.onValueChange==="function");assert.equal(sort.dir,localeDirection(p.locale));invoke(sort,"onValueChange","total:asc");assert.deepEqual(page.updates.slice(-2),[["ExpensesWorkspace.sortBy","total"],["ExpensesWorkspace.sortOrder","asc"]]);
 }
});

test("expense detail/editor isolates mixed records and preserves payment/rejection/edit fields",async()=>{
 for(const p of presentations){
  for(const status of ["approved","submitted","rejected"]){
   const page=loaded("expenses/[id]/page.tsx","ExpenseDetailWorkspace",{"ExpenseDetailWorkspace.loading":false,"ExpenseDetailWorkspace.claim":{...claim,status},"ExpenseDetailWorkspace.payDate":"2026-10-28","ExpenseDetailWorkspace.rejectReason":caller},{id:claim.id});
   const html=page.render(p);for(const v of [caller,reference,item.date,expenseUiMoney(minor,"USD",p)])assert.ok(html.includes(`>${esc(v)}</bdi>`),v);
   assert.ok(html.includes("rtl:rotate-180")&&html.includes("overflow-x-auto"));
   if(status==="rejected")continue;
   const id=status==="approved"?"rtl040-payDate":"rtl040-rejectReason",field=control(page,c=>c.props.id===id);assert.equal(field.dir,status==="approved"?"ltr":"auto");assert.ok(html.includes(`for="${id}"`));
   invoke(field,"onChange",{target:{value:status==="approved"?"2026-10-29":caller}});
   const previous=globalThis.fetch,requests:{url:string;init?:RequestInit}[]=[];globalThis.fetch=(async(url,init)=>{requests.push({url:String(url),init});return new Response("{}");})as typeof fetch;
   try{await invoke(control(page,c=>typeof c.props.onClick==="function"&&(c.props.onClick as()=>void).name===(status==="approved"?"handlePay":"handleReject")),"onClick");assert.equal(requests[0].url,`/api/v1/expenses/claim-a/${status==="approved"?"pay":"reject"}`);assert.equal(requests[0].init?.method,"POST");assert.deepEqual(JSON.parse(String(requests[0].init?.body)),status==="approved"?{date:"2026-10-28"}:{reason:caller});}finally{globalThis.fetch=previous;}
  }
  const editor=loaded("expenses/[id]/page.tsx","EditExpenseDrawer",{}, {open:true,claim,onClose:noop,onSaved:noop});const html=editor.render(p);for(const id of ["rtl040-editTitle","rtl040-editDescription","expense-item-date-0","expense-item-description-0","expense-item-category-0"])assert.ok(html.includes(`for="${id}"`)&&html.includes(`id="${id}"`),id);
  assert.ok(html.includes(`>${esc(expenseUiMoney(minor,"USD",p))}</bdi>`));
  const title=control(editor,c=>c.props.id==="rtl040-editTitle");assert.equal(title.dir,"auto");invoke(title,"onChange",{target:{value:caller}});assert.equal(editor.updates.at(-1)?.[1],caller);
 }
});

test("recurring expense/bill actual drawers retain canonical create payloads and accessible directed fields",async()=>{
 const storage=Object.getOwnPropertyDescriptor(globalThis,"localStorage");Object.defineProperty(globalThis,"localStorage",{configurable:true,value:{getItem:()=>"org-a"}});
 try{for(const p of presentations)for(const kind of ["expense","bill"]){
  const owner=kind==="expense"?"RecurringExpensesWorkspace":"RecurringBillsWorkspace",states:Props={};for(const [k,v]of Object.entries({loading:false,drawerOpen:true,name:caller,contactId:supplier,frequency:"monthly",startDate:"2026-10-27",endDate:"",maxOccurrences:"2",currencyCode:"USD",validLines:true,reference,templates:[{id:"template-a",name:caller,contact:{name:caller},nextRunDate:"2026-11-27",status:"active",frequency:"monthly",currencyCode:"USD",lines:[{grossMinor:minor}]}],lines:kind==="expense"?[{description:caller,amount:"0.005",accountId:null}]:[{description:caller,quantity:"1",unitPrice:"0.005",accountId:"",taxRateId:""}]}))states[`${owner}.${k}`]=v;
  const page=loaded(`${kind==="expense"?"expenses":"bills"}/recurring/page.tsx`,owner,states,{orgId:"org-a"}),html=page.render(p);for(const v of [caller,"2026-11-27"])assert.ok(html.includes(`>${esc(v)}</bdi>`),v);
  if(kind==="bill")assert.ok(html.includes(`>${esc(expenseUiMoney(minor,"USD",p))}</bdi>`));
  for(const id of ["rtl040-name","rtl040-startDate","rtl040-endDate","rtl040-maxOccurrences"])assert.ok(html.includes(`for="${id}"`)&&html.includes(`id="${id}"`),id);
  const frequency=control(page,c=>c.props.value==="monthly"&&typeof c.props.onValueChange==="function");assert.equal(frequency.dir,localeDirection(p.locale));invoke(frequency,"onValueChange","weekly");assert.equal(page.updates.at(-1)?.[1],"weekly");
  assert.ok(page.controls.some(c=>c.props.dir===localeDirection(p.locale)&&String(c.props.className).includes("max-h-dvh")));
  const previous=globalThis.fetch,requests:{url:string;init?:RequestInit}[]=[];globalThis.fetch=(async(url,init)=>{requests.push({url:String(url),init});return new Response(JSON.stringify({template:{id:"created-a"}}));})as typeof fetch;
  try{await invoke(control(page,c=>typeof c.props.onClick==="function"&&(c.props.onClick as()=>void).name==="handleSubmit"),"onClick");assert.equal(requests[0].url,"/api/v1/recurring");assert.equal(requests[0].init?.method,"POST");const body=JSON.parse(String(requests[0].init?.body));assert.equal(body.name,caller.trim());assert.equal(body.contactId,supplier);assert.equal(body.type,kind);assert.equal(body.startDate,"2026-10-27");assert.equal(body.maxOccurrences,2);assert.equal(body.lines[0].unitPriceExact,"0.005");assert.equal(body.lines[0].description,caller);}finally{globalThis.fetch=previous;}
 }}finally{if(storage)Object.defineProperty(globalThis,"localStorage",storage);else Reflect.deleteProperty(globalThis,"localStorage");}
});

test("installed CSS implements recurring/expense logical layout, wrapping, mirrored navigation and local scroll",async()=>{
 const compiler=await compile("@theme { --spacing:0.25rem; } @tailwind utilities;");const css=compiler.build(["start-3","ps-9","me-2","ms-auto","text-end","flex-wrap","overflow-x-auto","overflow-y-auto","max-h-dvh","[overflow-wrap:anywhere]","rtl:rotate-180","h-auto","whitespace-normal","min-w-[600px]","border-e","last:border-e-0","grid-cols-1","sm:grid-cols-2"]);for(const rule of ["inset-inline-start:","padding-inline-start:","margin-inline-end:","margin-inline-start:","text-align: end","flex-wrap: wrap","overflow-x: auto","overflow-y: auto","max-height: 100dvh","overflow-wrap: anywhere","rotate: 180deg","height: auto","white-space: normal","min-width: 600px","border-inline-end-width:","grid-template-columns:"])assert.ok(css.includes(rule),rule);
});
