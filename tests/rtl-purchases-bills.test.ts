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
import { billUiMoney } from "../lib/money/bill-ui";
import { PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import PurchasesLayout from "../app/(dashboard)/purchases/layout";
import PurchasesLoading from "../app/(dashboard)/purchases/loading";
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
const bill = { id: "bill-a", billNumber: reference, contactId: "supplier-a", contact: { name: caller }, issueDate: "2026-10-01", dueDate: "2026-11-01", status: "received", currencyCode: "USD", subtotal: minor, taxTotal: 1n, total: minor + 1n, amountPaid: 1n, amountDue: minor, notes: caller, rejectionReason: caller, lines: [{ id: "line-a", description: caller, quantity: 125, unitPrice: minor, amount: minor, taxAmount: 1n, account: { id: "account-a", code: "PAY-001", name: caller }, goodsReceiptLineId: "raw-receipt-line" }] };
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
    if (id === "next/navigation") return { useParams: () => ({ id: bill.id }), useRouter: () => ({ push: (v: unknown) => events.push(v) }) };
    if (id.endsWith("/create-drawer")) return { useCreateDrawer: () => ({ open: (v: unknown) => events.push(v) }) };
    if (id.endsWith("/use-debounce")) return { useDebounce: (v: unknown) => v };
    if (id.endsWith("/use-confirm")) return { useConfirm: () => ({ confirm: noop, dialog: null }) };
    if (["/send-document-dialog", "/email-history", "/receipt-attachments"].some(suffix => id.endsWith(suffix))) return { SendDocumentDialog: () => null, EmailHistory: () => null, ReceiptAttachments: () => null };
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

test("bill list isolates caller/date/exact money and keeps named directed filters and raw navigation", () => {
  for (const p of presentations) {
    const page = loaded("page.tsx", "default", { "BillsPage.loading": false, "BillsPage.loadedOrg": "org-a", "BillsPage.bills": [bill], "BillsPage.allBills": [bill], "BillsPage.listTotal": 1 });
    const html = page.render(p);
    for (const value of [caller, reference, bill.issueDate, bill.dueDate, billUiMoney(minor, "USD", p)]) assert.ok(html.includes(`>${esc(value)}</bdi>`), value);
    assert.ok(html.includes("text-end") && html.includes('role="group"'));
    const search = control(page, c => c.props.dir === "auto" && typeof c.props.onChange === "function"); assert.ok(search["aria-label"]);
    (search.onChange as (v: unknown) => void)({target:{value:caller}}); assert.equal(page.updates.at(-1)?.[1],caller);
    const tabs=control(page,c=>c.props.value==="all"&&typeof c.props.onValueChange==="function"); assert.equal(tabs.dir,localeDirection(p.locale));
    (tabs.onValueChange as (v:string)=>void)("received"); assert.equal(page.updates.at(-1)?.[1],"received");
    const sort=control(page,c=>c.props.value==="created:desc"&&typeof c.props.onValueChange==="function"); assert.equal(sort.dir,localeDirection(p.locale));
    (sort.onValueChange as(v:string)=>void)("amountDue:asc"); assert.deepEqual(page.updates.slice(-2),[["BillsPage.sortBy","amountDue"],["BillsPage.sortOrder","asc"]]);
    (control(page,c=>typeof c.props.onRowClick==="function").onRowClick as(v:unknown)=>void)(bill); assert.equal(page.events.at(-1),"/purchases/bill-a");
  }
});

test("bill detail isolates complete money/percent/line tokens and retains exact payment POST and invalid bound",async()=>{
 for(const p of presentations){
  for(const amount of ["0.01","40000000000000.02"]){
   const page=loaded("[id]/page.tsx","default",{"BillDetailPage.b":bill,"BillDetailPage.loading":false,"BillDetailPage.loadedContext":"org-a:bill-a","BillDetailPage.payAmount":amount,"BillDetailPage.payDate":"2026-10-27"});
   const html=page.render(p);for(const value of [caller,reference,bill.dueDate,billUiMoney(minor,"USD",p),"0%",`1.25 \u00d7 ${billUiMoney(minor,"USD",p)}`])assert.ok(html.includes(`>${esc(value)}</bdi>`),value);
   assert.ok(html.includes('for="bill-payment-date"')&&html.includes('id="bill-payment-date"'));
   const date=control(page,c=>c.props.id==="bill-payment-date");assert.equal(date.dir,"ltr");(date.onChange as(v:unknown)=>void)({target:{value:"2026-10-28"}});assert.equal(page.updates.at(-1)?.[1],"2026-10-28");
   const previous=globalThis.fetch,requests:{url:string;init?:RequestInit}[]=[];globalThis.fetch=(async(url,init)=>{requests.push({url:String(url),init});return new Response("{}");})as typeof fetch;
   try{await(control(page,c=>typeof c.props.onClick==="function"&&(c.props.onClick as()=>void).name==="handlePay").onClick as()=>Promise<void>)();if(amount==="0.01"){assert.equal(requests.length,1);assert.equal(requests[0].url,"/api/v1/bills/bill-a/pay");assert.equal(requests[0].init?.method,"POST");assert.deepEqual(JSON.parse(String(requests[0].init?.body)),{amountMinor:"1",date:"2026-10-27"});assert.equal((requests[0].init?.headers as Props)["x-organization-id"],"org-a");}else assert.equal(requests.length,0);}finally{globalThis.fetch=previous;}
  }
  const reject=loaded("[id]/page.tsx","default",{"BillDetailPage.b":{...bill,status:"pending_approval"},"BillDetailPage.loading":false,"BillDetailPage.loadedContext":"org-a:bill-a"});const html=reject.render(p);assert.ok(html.includes('for="bill-reject-reason"'));const input=control(reject,c=>c.props.id==="bill-reject-reason");assert.equal(input.dir,"auto");(input.onChange as(v:unknown)=>void)({target:{value:caller}});assert.equal(reject.updates.at(-1)?.[1],caller);
 }
});

test("purchase shell/loading compose across locales and installed CSS supports local scroll, logical spacing and wrapping",async()=>{
 for(const p of presentations){const root={presentation:p,messages:p.locale==="fa-IR"?fa:en,now:new Date("2026-10-27T00:00:00Z")};for(const path of ["/purchases","/purchases/expenses","/purchases/bill-a"]){const html=renderToStaticMarkup(h(Provider.PresentationProvider,root,h(CjsProvider,root,h(PathnameContext.Provider,{value:path},h(PurchasesLayout,null,h("span",null,caller))))));assert.ok(html.includes(esc(caller)));if(path==="/purchases/bill-a")assert.ok(!html.includes("<nav"));else{const anchor=[...html.matchAll(/<a\b[^>]*>/g)].map(m=>m[0]).find(a=>a.includes(`href="${path}"`));assert.ok(anchor?.includes('aria-current="page"'));for(const route of ["bills/recurring","debit-notes","expenses","orders","goods-receipts","requisitions","landed-costs"])assert.ok(html.includes(`href="/purchases/${route}"`));}}assert.ok(renderToStaticMarkup(h(Provider.PresentationProvider,root,h(CjsProvider,root,h(PurchasesLoading)))).includes(`aria-label="${esc(root.messages.SharedUI.loading2)}"`));}
 const compiler=await compile("@theme { --spacing:0.25rem; } @tailwind utilities;");const css=compiler.build(["start-3","ps-9","me-2","ms-1.5","text-start","text-end","flex-wrap","overflow-x-auto","overflow-y-auto","max-h-dvh","[overflow-wrap:anywhere]","rtl:rotate-180","h-auto","whitespace-normal","min-w-[500px]","rounded-s-full","rounded-e-full"]);for(const rule of ["inset-inline-start:","padding-inline-start:","margin-inline-end:","margin-inline-start:","text-align: start","text-align: end","flex-wrap: wrap","overflow-x: auto","overflow-y: auto","max-height: 100dvh","overflow-wrap: anywhere","rotate: 180deg","height: auto","white-space: normal","min-width: 500px","border-start-start-radius:","border-end-end-radius:"])assert.ok(css.includes(rule),rule);
});
