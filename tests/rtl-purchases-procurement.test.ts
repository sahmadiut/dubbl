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
import { procurementMoney } from "../lib/money/procurement-ui";
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
const base = { id: "doc-a", contactId: "customer-a", contact: { name: caller, email: "billing@example.com" }, issueDate: "2026-10-01", expiryDate: "2026-11-01", status: "sent", currencyCode: "USD", subtotal: minor, taxTotal: 1n, total: minor + 1n, notes: caller, lines: [{ id: "line-a", description: caller, quantity: 125, unitPrice: minor, amount: minor, taxAmount: 1n, account: { code: "REV-001", name: caller } }] };
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
  source = source.replace(/typeof window !== "undefined"\s*\? localStorage.getItem\("activeOrgId"\)(?: \|\| "")?\s*: (?:null|"")/g, '"org-a"');
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
    if (id.endsWith("/use-confirm")) return { useConfirm: () => ({ confirm: async () => true, dialog: null }) };
    if (["/send-document-dialog", "/email-history", "/receipt-attachments"].some(suffix => id.endsWith(suffix))) return { SendDocumentDialog: () => null, EmailHistory: () => null, ReceiptAttachments: () => null };
    if (id.endsWith("/ui/select")) return Object.fromEntries(["Select", "SelectContent", "SelectItem", "SelectTrigger", "SelectValue"].map(key => [key, ({children, ...p}: {children: React.ReactNode}) => h("div", p, children)]));
    if (id.endsWith("/ui/dialog")) return Object.fromEntries(["Dialog", "DialogContent", "DialogHeader", "DialogTitle", "DialogTrigger"].map(key => [key, inline]));
    if (["/contact-picker", "/account-picker", "/currency-select", "/requisition-line-editor"].some(s => id.endsWith(s))) return { ContactPicker: () => null, AccountPicker: () => null, CurrencySelect: () => null, RequisitionLineEditor: () => null, emptyRequisitionLine: () => ({description:"", quantity:"1", unitPrice:"", accountId:"", taxRateId:""}) };
    if (id.endsWith("/use-document-title")) return { useDocumentTitle: noop };
    if (id.endsWith("/use-entity-title")) return { useEntityTitle: noop };
    if (id.endsWith("/ui/sheet")) return Object.fromEntries(["Sheet", "SheetContent", "SheetHeader", "SheetTitle", "SheetDescription", "SheetTrigger", "SheetFooter"].map(key => [key, inline]));
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

const line = { id: "line-a", description: caller, quantity: 125, quantityReceived: 25, quantityBilled: 0, unitPrice: 100n, amount: 125n, taxAmount: 0n, account: { id: "account-a", code: "5000", name: caller }, taxRate: null };
const order = { ...base, poNumber: reference, deliveryDate: "2026-11-01", subtotal: 125n, taxTotal: 0n, total: 125n, reference: caller, lines: [line] };
const req = { ...order, requisitionNumber: reference, requestDate: "2026-10-01", requiredDate: "2026-11-01", rejectionReason: caller, convertedPoId: "po-a" };
const receipt = { ...order, receiptNumber: reference, date: "2026-10-01", purchaseOrder: { id: "po-a", poNumber: reference }, lines: [{ ...line, unitCost: 100n, quantityReceived: 125, journalEntryId: "journal-a", inventoryItem: { name: caller, sku: reference }, warehouse: { name: caller } }] };
const landed = { id: "doc-a", name: caller, allocationMethod: "by_value", totalCostAmount: 4000000000000001, currencyCode: "USD", status: "allocated", createdAt: "2026-10-01T00:00:00Z", allocatedAt: null, purchaseOrder: { poNumber: reference }, bill: { billNumber: reference }, components: [{ id: "component-a", description: caller, amount: 1250, accountId: reference }], lineAllocations: [{ id: "allocation-a", purchaseOrderLineId: "po-line-a", componentId: "component-a", allocationBasis: 125, allocatedAmount: 1250 }] };

test("all four actual procurement lists isolate exact rows and preserve directed raw filter/navigation callbacks", () => {
  const lists = [
    { path: "orders", name: "PurchaseOrdersContent", rows: "pos", row: order, states: { loading: false, totalCount: 1 } },
    { path: "requisitions", name: "RequisitionsContent", rows: "items", row: req, states: { loading: false, totalCount: 1 } },
    { path: "goods-receipts", name: "GoodsReceiptsContent", rows: "receipts", row: receipt, states: { initialLoad: false, refetching: false, totalCount: 1 } },
    { path: "landed-costs", name: "LandedCostsPage", rows: "items", row: landed, states: { loading: false } },
  ];
  for (const p of presentations) for (const item of lists) {
    const states = Object.fromEntries(Object.entries({ ...item.states, [item.rows]: [item.row] }).map(([k,v]) => [`${item.name}.${k}`,v]));
    const page = loaded(`${item.path}/page.tsx`, item.name === "LandedCostsPage" ? "default" : item.name, states);
    const html = page.render(p);
    assert.ok(html.includes(`>${esc(caller)}</bdi>`), item.path);
    assert.ok(!html.includes("<GST/001>"));
    assert.ok(html.includes("text-end"));
    if (item.path !== "landed-costs") {
      const tabs = control(page, c => c.props.value === "all" && typeof c.props.onValueChange === "function");
      assert.equal(tabs.dir, localeDirection(p.locale));
      (tabs.onValueChange as (v:string)=>void)("draft");
      assert.deepEqual(page.updates.at(-1), [`${item.name}.statusFilter`, "draft"]);
      const search = control(page, c => c.props.dir === "auto" && typeof c.props.onChange === "function" && c.props.className?.toString().includes("ps-") === true);
      assert.ok(search["aria-label"]);
      (search.onChange as (v:unknown)=>void)({target:{value:caller}});
      assert.deepEqual(page.updates.at(-1), [`${item.name}.search`, caller]);
      const table = control(page, c => typeof c.props.onRowClick === "function");
      (table.onRowClick as (v:unknown)=>void)(item.row);
      assert.equal(page.events.at(-1), `/purchases/${item.path}/doc-a`);
      assert.ok(html.includes(`>${esc(procurementMoney(125n,"USD",p))}</bdi>`));
    } else {
      const row = control(page, c => c.props.className === "cursor-pointer" && typeof c.props.onClick === "function");
      (row.onClick as ()=>void)(); assert.equal(page.events.at(-1), "/purchases/landed-costs/doc-a");
      const selector = control(page, c => c.props.value === "by_value" && typeof c.props.onValueChange === "function");
      assert.equal(selector.dir, localeDirection(p.locale));
      (selector.onValueChange as (v:string)=>void)("by_quantity"); assert.deepEqual(page.updates.at(-1), ["LandedCostsPage.allocationMethod", "by_quantity"]);
      for (const input of page.controls.filter(c => c.type === "input")) assert.ok(input.props["aria-label"] && input.props.id);
    }
  }
});

test("all procurement detail bodies preserve isolated saved text, links, amounts and allocation IDs", () => {
  for (const p of presentations) for (const [path,name,key,value] of [
    ["orders","PODetailContent","po",order], ["requisitions","RequisitionDetailContent","req",req], ["goods-receipts","GoodsReceiptDetailContent","gr",receipt], ["landed-costs","LandedCostDetailPage","item",landed],
  ] as const) {
    const page = loaded(`${path}/[id]/page.tsx`,path === "landed-costs" ? "default" : name,{[`${name}.${key}`]:value,[`${name}.loading`]:false});
    const html=page.render(p);
    assert.ok(html.includes(`>${esc(caller)}</bdi>`),path);
    assert.ok(html.includes(esc(reference)) && !html.includes("<GST/001>"));
    assert.ok(html.includes("rtl:rotate-180"));
    if(path!=="landed-costs") assert.ok(html.includes(`>${esc(procurementMoney(125n,"USD",p))}</bdi>`));
    else assert.ok(html.includes('dir="ltr"') && html.includes("po-line-...") && html.includes("componen..."));
  }
});

test("requisition reject/approve and order receipt/convert retain canonical requests and raw callers", async () => {
  const originalFetch=globalThis.fetch, originalStorage=globalThis.localStorage;
  const requests:{url:string;init?:RequestInit}[]=[];
  Object.defineProperty(globalThis,"localStorage",{configurable:true,value:{getItem:()=>"org-a"}});
  try { for(const p of presentations) {
    globalThis.fetch=async (url,init)=>{requests.push({url:String(url),init});return Response.json({status:"rejected"});};
    const reject=loaded("requisitions/[id]/page.tsx","RequisitionDetailContent",{"RequisitionDetailContent.req":{...req,status:"submitted"},"RequisitionDetailContent.loading":false,"RequisitionDetailContent.rejectReason":caller});reject.render(p);
    const textarea=control(reject,c=>c.props.rows===3 && typeof c.props.onChange==="function"); assert.equal(textarea.dir,"auto");assert.ok(textarea.id&&textarea["aria-label"]);
    await (control(reject,c=>typeof c.props.onClick==="function"&&(c.props.onClick as ()=>void).name==="handleReject").onClick as ()=>Promise<void>)();
    assert.equal(requests.at(-1)?.url,"/api/v1/purchase-requisitions/doc-a/reject");assert.deepEqual(JSON.parse(String(requests.at(-1)?.init?.body)),{reason:caller});
    assert.equal((requests.at(-1)?.init?.headers as Record<string,string>)["x-organization-id"],"org-a");
    const po=loaded("orders/[id]/page.tsx","PODetailContent",{"PODetailContent.po":{...order,status:"sent"},"PODetailContent.loading":false});po.render(p);
    globalThis.fetch=async(url,init)=>{requests.push({url:String(url),init});return Response.json(String(url).endsWith('/convert')?{bill:{id:"bill-a"}}:String(url).includes('goods-receipts')?{goodsReceipt:{id:"receipt-a"}}:{purchaseOrder:{}});};
    await (control(po,c=>typeof c.props.onClick==="function"&&(c.props.onClick as ()=>void).name==="handleReceiveItems").onClick as ()=>Promise<void>)();
    const received=requests.findLast(r=>r.url==="/api/v1/goods-receipts");assert.ok(received);assert.deepEqual(JSON.parse(String(received.init?.body)).lines,[{purchaseOrderLineId:"line-a",quantityExact:"1"}]);
    await (control(po,c=>typeof c.props.onClick==="function"&&(c.props.onClick as ()=>void).name==="handleConvert").onClick as ()=>Promise<void>)();assert.equal(po.events.at(-1),"/purchases/bill-a");
  }} finally {globalThis.fetch=originalFetch;Object.defineProperty(globalThis,"localStorage",{configurable:true,value:originalStorage});}
});

test("landed creation and allocation retain exact minor payload, raw IDs and bodyless allocation", async () => {
 const originalFetch=globalThis.fetch,requests:{url:string;init?:RequestInit}[]=[];
 try{for(const p of presentations){
  globalThis.fetch=async(url,init)=>{requests.push({url:String(url),init});return Response.json({allocation:{id:"doc-a",status:"allocated"},data:[]});};
  const page=loaded("landed-costs/page.tsx","default",{"LandedCostsPage.loading":false,"LandedCostsPage.name":caller,"LandedCostsPage.purchaseOrderId":"po-a","LandedCostsPage.components":[{description:caller,amount:"0.01",accountId:"account-a"}]});page.render(p);
  await(control(page,c=>c.type==="form").onSubmit as(v:unknown)=>Promise<void>)({preventDefault:noop});
  const post=requests.findLast(r=>r.init?.method==="POST");assert.ok(post);assert.deepEqual(JSON.parse(String(post.init?.body)),{name:caller,purchaseOrderId:"po-a",billId:null,allocationMethod:"by_value",components:[{description:caller,amountMinor:"1",accountId:"account-a"}]});
  const detail=loaded("landed-costs/[id]/page.tsx","default",{"LandedCostDetailPage.loading":false,"LandedCostDetailPage.item":{...landed,status:"draft"}});detail.render(p);
  await(control(detail,c=>typeof c.props.onClick==="function"&&(c.props.onClick as()=>void).name==="handleAllocate").onClick as()=>Promise<void>)();
  const allocation=requests.findLast(r=>r.url.endsWith('/allocate'));assert.equal(allocation?.url,"/api/v1/landed-costs/doc-a/allocate");assert.equal(allocation?.init?.body,undefined);
 }}finally{globalThis.fetch=originalFetch;}
});

test("installed CSS supplies logical procurement layout, isolation, scrolling and long-control wrapping", async()=>{
 const compiler=await compile("@theme { --spacing:0.25rem; --breakpoint-sm:40rem; } @tailwind utilities;");
 const css=compiler.build(["start-3","ps-9","me-2","text-end","border-e","min-w-0","flex-wrap","overflow-x-auto","overflow-y-auto","[overflow-wrap:anywhere]","rtl:rotate-180","h-auto","whitespace-normal","grid-cols-1"]);
 for(const rule of ["inset-inline-start:","padding-inline-start:","margin-inline-end:","text-align: end","border-inline-end-style:","min-width:","flex-wrap: wrap","overflow-x: auto","overflow-y: auto","overflow-wrap: anywhere","rotate: 180deg","height: auto","white-space: normal","grid-template-columns:"])assert.ok(css.includes(rule),rule);
});

