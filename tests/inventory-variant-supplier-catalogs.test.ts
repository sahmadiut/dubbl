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
import * as presentation from "../i18n/inventory-catalog-presentation";
import { catalogPriceMinor, catalogWholeInput } from "../lib/money/catalog-input";
import { bankMoneyDisplay } from "../lib/money/bank-display";
import * as BrandLoader from "../components/dashboard/brand-loader";
import { renderWithPresentation } from "./helpers/presentation";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const variants = "app/(dashboard)/inventory/[id]/variants/page.tsx";
const suppliers = "app/(dashboard)/inventory/[id]/suppliers/page.tsx";
const locales = ["en-US", "fa-IR"] as const;
const noop = () => {};
const caller = '<script>کالا & "name"</script>';
const variant = { id: "variant-a", inventoryItemId: "item-a", name: caller, sku: caller,
  purchasePrice: 3000000001, purchasePriceMinor: "3000000001", salePrice: 9007199254740991,
  salePriceMinor: "9007199254740991", quantityOnHand: -3, isActive: true, options: { [caller]: caller } };
const supplier = { id: "supplier-a", inventoryItemId: "item-a", contactId: "contact-a", contactName: caller,
  supplierCode: caller, leadTimeDays: 14, purchasePrice: 3000000001, purchasePriceMinor: "3000000001", isPreferred: true };
const escape = (v: string) => v.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
const translator = (locale: typeof locales[number]) => createTranslator({ locale, messages: locale === "en-US" ? en : fa, namespace: "InventoryCatalogs" });
const parse = (file: string) => ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
type Captured = { kind: string; props: Record<string, unknown> };
type Effect = () => void | (() => void);

// Real JSX, next-intl, provider and controls; hook/portal/IO boundaries are
// controlled to expose production forms and callbacks without a browser mount.
function loaded(file: string, states: Record<string, unknown> = {}, captured: Captured[] = [], events: unknown[] = [], effects: Effect[] = [], io: Record<string, unknown> = {}) {
  const ast = parse(file), names: string[] = [];
  function hooks(n: ts.Node) {
    if (ts.isVariableDeclaration(n) && ts.isArrayBindingPattern(n.name) && n.initializer && ts.isCallExpression(n.initializer) && n.initializer.expression.getText(ast) === "useState") names.push(n.name.elements[0].getText(ast));
    ts.forEachChild(n, hooks);
  }
  hooks(ast);
  const inline = (kind: string) => function Inline(props: Record<string, unknown>) {
    captured.push({ kind, props });
    return createElement("div", { "data-control": kind }, props.children as ReactNode,
      typeof props.placeholder === "string" ? createElement("span", null, props.placeholder) : null);
  };
  let index = 0;
  const require = createRequire(resolve(file)), compiled = { exports: {} as { default: ComponentType } };
  const load = (id: string): unknown => {
    if (id === "react") return { ...React,
      useState: (initial: unknown) => { const key = names[index++]; return [Object.hasOwn(states, key) ? states[key] : initial, (v: unknown) => events.push([key, v])]; },
      useEffect: (effect: Effect) => effects.push(effect), useCallback: (fn: unknown) => fn };
    if (id === "next-intl") return nextIntl;
    if (id === "next/navigation") return { useParams: () => ({ id: "item-a" }) };
    if (id === "sonner") return { toast: { success: (v: string) => events.push(v), error: (v: string) => events.push(v) } };
    if (id.endsWith("/use-document-title")) return { useDocumentTitle: (v: string) => events.push(v) };
    if (id.endsWith("/use-confirm")) return { useConfirm: () => ({ confirm: noop, dialog: null }) };
    if (id.endsWith("/brand-loader")) return BrandLoader;
    if (id.endsWith("/contact-picker")) return { ContactPicker: inline("ContactPicker") };
    if (id.endsWith("/ui/sheet")) return Object.fromEntries(["Sheet", "SheetContent", "SheetHeader", "SheetTitle", "SheetFooter"].map(n => [n, inline(n)]));
    return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  };
  const code = ts.transpileModule(ast.text, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function("require", "module", "exports", ...Object.keys(io), code)(load, compiled, compiled.exports, ...Object.values(io));
  return compiled.exports.default;
}
function callback(file: string, name: string, scope: Record<string, unknown>) {
  const ast = parse(file); let expression = "";
  function visit(n: ts.Node) {
    if (ts.isFunctionDeclaration(n) && n.name?.text === name) expression = n.getText(ast);
    if (ts.isVariableDeclaration(n) && n.name.getText(ast) === name && n.initializer && ts.isCallExpression(n.initializer)) expression = n.initializer.arguments[0].getText(ast);
    ts.forEachChild(n, visit);
  }
  visit(ast); assert.ok(expression, name);
  const code = ts.transpileModule(`const run = ${expression};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(scope), `${code}; return run;`)(...Object.values(scope));
}
const flush = async () => { for (let i = 0; i < 6; i++) await new Promise(resolve => setImmediate(resolve)); };

test("variant page renders both locales, exact prices, active states, nullable history and escaped caller options", () => {
  for (const locale of locales) for (const saving of [false, true]) {
    const t = translator(locale), events: unknown[] = [];
    const Page = loaded(variants, { variants: [variant, { ...variant, id: "inactive", isActive: false }, { ...variant, id: "nullable", purchasePrice: null, salePrice: null, quantityOnHand: null, options: null, isActive: null }], loading: false, saving, addOpen: true }, [], events);
    const html = renderWithPresentation(createElement(Page), locale);
    for (const key of ["variants", "addVariant", "active", "inactive", "nameRequired", "variantExample", "sku", "optionalSku", "purchasePrice", "salePrice", "quantityOnHand", "cancel"] as const) assert.ok(html.includes(escape(t(key))), key);
    for (const [key, value] of [["costValue", bankMoneyDisplay(variant.purchasePrice, "USD")], ["saleValue", bankMoneyDisplay(variant.salePrice, "USD")], ["quantityValue", "-3"], ["skuValue", caller]] as const) assert.ok(html.includes(escape(t(key, { value }))));
    assert.ok(html.includes(escape(caller)) && !html.includes("<script>"));
    assert.equal(/<button(?=[^>]*disabled="")/.test(html), saving);
    assert.ok(events.includes(t("variantsTitle")));
  }
});

test("supplier page renders translated form and days, contact fallback, preference and accessible unlink", () => {
  for (const locale of locales) {
    const t = translator(locale), captured: Captured[] = [], events: unknown[] = [];
    const Page = loaded(suppliers, { suppliers: [supplier, { ...supplier, id: "fallback", contactName: null, contact: { name: caller } }, { ...supplier, id: "id-only", contactName: null, supplierCode: null, purchasePrice: null, leadTimeDays: null, isPreferred: null }], loading: false, linkOpen: true, saving: true }, captured, events);
    const html = renderWithPresentation(createElement(Page), locale);
    for (const key of ["suppliers", "linkSupplier", "preferred", "supplierRequired", "selectSupplier", "supplierCode", "optionalSupplierCode", "leadTimeDays", "leadExample", "purchasePrice", "preferredSupplier", "cancel"] as const) assert.ok(html.includes(escape(t(key))), key);
    assert.ok(html.includes(escape(t("leadValue", { value: "14" }))));
    assert.ok(html.includes(escape(t("priceValue", { value: bankMoneyDisplay(supplier.purchasePrice, "USD") }))));
    assert.ok(html.includes(escape(t("codeValue", { value: caller }))));
    assert.equal((html.match(/aria-label=/g) || []).length, 3);
    assert.ok(html.includes(`aria-label="${escape(t("unlink"))}"`) && html.includes("contact-a"));
    assert.ok(html.includes(escape(caller)) && !html.includes("<script>"));
    assert.ok(events.includes(t("suppliersTitle")));
    const picker = captured.find(c => c.kind === "ContactPicker")!;
    assert.equal(picker.props.type, "supplier");
    (picker.props.onChange as (v: string) => void)(supplier.contactId);
    assert.deepEqual(events.at(-1), ["contactId", supplier.contactId]);
  }
});

test("empty, read-error and initial-loading states are localized and separate on both routes", () => {
  for (const locale of locales) for (const file of [variants, suppliers]) {
    const t = translator(locale);
    const Page = loaded(file, { loading: false });
    const html = renderWithPresentation(createElement(Page), locale);
    for (const key of file === variants ? ["emptyVariants", "emptyVariantsHelp"] as const : ["emptySuppliers", "emptySuppliersHelp"] as const) assert.ok(html.includes(escape(t(key))));
    const ErrorPage = loaded(file, { loading: false, readError: true });
    assert.equal(renderWithPresentation(createElement(ErrorPage), locale), `<p role="alert">${escape(t("readFailed"))}</p>`);
    const Loading = loaded(file);
    assert.ok(!renderWithPresentation(createElement(Loading), locale).includes(escape(t("readFailed"))));
  }
});

test("presentation boundary preserves nullable history and rejects invalid envelopes, aliases, counts and display fields", async () => {
  assert.deepEqual(await presentation.inventoryVariantsJson(Response.json({ data: [variant] })), [variant]);
  assert.deepEqual(await presentation.inventorySuppliersJson(Response.json({ data: [supplier] })), [supplier]);
  const nullableVariant = { ...variant, purchasePrice: null, purchasePriceMinor: null, salePrice: null, salePriceMinor: null, quantityOnHand: null, options: null, isActive: null };
  assert.deepEqual(presentation.inventoryVariantRow(nullableVariant), nullableVariant);
  const nullableSupplier = { ...supplier, purchasePrice: null, purchasePriceMinor: null, leadTimeDays: null, isPreferred: null };
  assert.deepEqual(presentation.inventorySupplierRow(nullableSupplier), nullableSupplier);
  for (const read of [presentation.inventoryVariantsJson, presentation.inventorySuppliersJson]) {
    for (const value of [null, [], {}, { data: {} }, { data: [null] }]) await assert.rejects(read(Response.json(value)));
    await assert.rejects(read(new Response("private prose")));
    await assert.rejects(read(Response.json({ data: [] }, { status: 403 })));
  }
  for (const changes of [{ name: 3 }, { id: null }, { inventoryItemId: null }, { sku: {} }, { isActive: "true" }, { options: [] }, { options: { color: 3 } }, { purchasePriceMinor: "3000000002" }, { salePriceMinor: "09007199254740991" }, { salePrice: undefined }, { quantityOnHand: 0.5 }, { quantityOnHand: 2147483648 }, { quantityOnHand: -0 }, { purchasePrice: null }]) assert.throws(() => presentation.inventoryVariantRow({ ...variant, ...changes }));
  for (const changes of [{ contactId: null }, { contactName: {} }, { contact: { name: 3 } }, { supplierCode: [] }, { isPreferred: 1 }, { leadTimeDays: -1 }, { leadTimeDays: 0.5 }, { purchasePrice: Number.MAX_SAFE_INTEGER + 1 }, { purchasePriceMinor: "-1" }]) assert.throws(() => presentation.inventorySupplierRow({ ...supplier, ...changes }));
});

test("create/link callbacks preserve organization, exact cents, signed quantities and lead days; failed writes retain forms", async () => {
  for (const locale of locales) for (const file of [variants, suppliers]) for (const mode of ["success", "status", "json", "shape", "network", "no-org", "missing", "refresh"]) {
    if (mode === "refresh" && file === variants) continue;
    const t = translator(locale), events: unknown[] = [], isVariant = file === variants;
    const set = (key: string) => (v: unknown) => events.push([key, v]);
    const scope = { ...presentation, catalogPriceMinor, catalogWholeInput, t, id: "item-a", name: mode === "missing" ? " " : ` ${caller} `, sku: caller, purchasePrice: "30000000.01", salePrice: "90071992547409.91", quantity: "-3", contactId: mode === "missing" ? " " : ` ${supplier.contactId} `, supplierCode: caller, leadDays: "14", price: "30000000.01", preferred: true,
      setSaving: set("saving"), setVariants: (fn: (v: unknown[]) => unknown[]) => events.push(["variants", fn([])]), setAddOpen: set("open"), setLinkOpen: set("open"), setName: set("name"), setSku: set("sku"), setPurchasePrice: set("purchasePrice"), setSalePrice: set("salePrice"), setQuantity: set("quantity"), setContactId: set("contactId"), setSupplierCode: set("supplierCode"), setLeadDays: set("leadDays"), setPrice: set("price"), setPreferred: set("preferred"),
      fetchSuppliers: async () => { events.push("refresh"); return mode !== "refresh"; },
      localStorage: { getItem: () => mode === "no-org" ? null : "org-a" }, toast: { success: set("success"), error: set("error") },
      fetch: async (url: string, init: RequestInit) => {
        assert.equal(url, `/api/v1/inventory/item-a/${isVariant ? "variants" : "suppliers"}`);
        assert.equal(init.method, "POST");
        assert.deepEqual(init.headers, { "Content-Type": "application/json", "x-organization-id": "org-a" });
        assert.deepEqual(JSON.parse(init.body as string), isVariant ? { name: caller, sku: caller, purchasePriceMinor: "3000000001", salePriceMinor: "9007199254740991", quantityOnHand: -3 } : { contactId: supplier.contactId, supplierCode: caller, leadTimeDays: 14, purchasePriceMinor: "3000000001", isPreferred: true });
        if (mode === "network") throw new Error("private prose");
        if (mode === "json") return new Response("private prose");
        return Response.json(mode === "shape" ? {} : isVariant ? { inventoryVariant: variant } : { inventoryItemSupplier: supplier }, { status: mode === "status" ? 403 : 200 });
      } };
    await callback(file, isVariant ? "handleAdd" : "handleLink", scope)();
    if (["success", "refresh"].includes(mode)) {
      assert.ok(events.some(e => JSON.stringify(e) === '["open",false]'));
      assert.ok(events.some(e => JSON.stringify(e) === JSON.stringify([mode === "refresh" ? "error" : "success", t(mode === "refresh" ? "linkedRefreshFailed" : isVariant ? "variantAdded" : "supplierLinked")])));
    } else {
      assert.ok(!events.includes("refresh") && !events.some(e => Array.isArray(e) && ["open", "name", "contactId", "variants"].includes(e[0])));
      assert.ok(events.some(e => JSON.stringify(e) === JSON.stringify(["error", t(mode === "no-org" ? "organizationRequired" : mode === "missing" ? isVariant ? "variantNameRequired" : "contactRequired" : isVariant ? "variantAddFailed" : "supplierLinkFailed")])));
    }
    if (!["no-org", "missing"].includes(mode)) assert.deepEqual(events.at(-1), ["saving", false]);
    assert.ok(!JSON.stringify(events).includes("private prose"));
  }
});

test("local invalid prices and physical counts never send requests and use finite localized feedback", async () => {
  for (const locale of locales) for (const file of [variants, suppliers]) for (const [field, value, key] of [[file === variants ? "purchasePrice" : "price", "1.001", "invalidPrice"], [file === variants ? "salePrice" : "price", "90071992547409.92", "priceRange"], [file === variants ? "quantity" : "leadDays", "1.5", "invalidWhole"], [file === variants ? "quantity" : "leadDays", file === variants ? "2147483648" : "-1", "wholeRange"]] as const) {
    const t = translator(locale), events: unknown[] = [];
    await callback(file, file === variants ? "handleAdd" : "handleLink", { ...presentation, catalogPriceMinor, catalogWholeInput, t, localStorage: { getItem: () => "org-a" }, name: "A", sku: "", purchasePrice: "", salePrice: "", quantity: "", contactId: "contact-a", supplierCode: "", leadDays: "", price: "", preferred: false, [field]: value, toast: { error: (v: string) => events.push(v) } })();
    assert.deepEqual(events, [t(key)]);
  }
  for (const error of [new Error("private prose"), new Error("__proto__"), "priceRange", null]) assert.equal(presentation.inventoryCatalogInputError(error), "invalidInput");
});

test("blank optional inputs stay omitted while explicit zero retains canonical minor strings and whole units", async () => {
  for (const file of [variants, suppliers]) for (const input of ["", "0"]) {
    const captured: unknown[] = [], isVariant = file === variants;
    const scope = { ...presentation, catalogPriceMinor, catalogWholeInput, t: translator("en-US"), id: "item-a", localStorage: { getItem: () => "org-a" },
      name: " A ", sku: "", purchasePrice: input, salePrice: input, quantity: input, contactId: " contact-a ", supplierCode: "", leadDays: input, price: input, preferred: false,
      setSaving: noop, setVariants: noop, setAddOpen: noop, setLinkOpen: noop, setName: noop, setSku: noop, setPurchasePrice: noop, setSalePrice: noop, setQuantity: noop, setContactId: noop, setSupplierCode: noop, setLeadDays: noop, setPrice: noop, setPreferred: noop, fetchSuppliers: async () => true, toast: { success: noop, error: noop },
      fetch: async (_url: string, init: RequestInit) => { captured.push(JSON.parse(init.body as string)); return Response.json(isVariant ? { inventoryVariant: variant } : { inventoryItemSupplier: supplier }); } };
    await callback(file, isVariant ? "handleAdd" : "handleLink", scope)();
    assert.deepEqual(captured, [isVariant ? { name: "A", ...(input ? { purchasePriceMinor: "0", salePriceMinor: "0", quantityOnHand: 0 } : {}) } : { contactId: "contact-a", isPreferred: false, ...(input ? { leadTimeDays: 0, purchasePriceMinor: "0" } : {}) }]);
  }
});

test("supplier unlink confirms translated labels, respects cancellation, and removes only after verified success", async () => {
  for (const locale of locales) for (const mode of ["success", "cancel", "no-org", "status", "json", "shape", "network"]) {
    const t = translator(locale), events: unknown[] = [];
    await callback(suppliers, "handleUnlink", { ...presentation, t, id: "item-a", localStorage: { getItem: () => mode === "no-org" ? null : "org-a" },
      confirm: async (options: unknown) => { assert.deepEqual(options, { title: t("unlinkTitle"), description: t("unlinkDescription"), confirmLabel: t("unlink"), cancelLabel: t("cancel"), destructive: true }); return mode !== "cancel"; },
      setSuppliers: (fn: (v: unknown[]) => unknown[]) => events.push(fn([supplier, { ...supplier, id: "keep" }])), toast: { success: (v: string) => events.push(v), error: (v: string) => events.push(v) },
      fetch: async (url: string, init: RequestInit) => {
        assert.equal(url, `/api/v1/inventory/item-a/suppliers/${supplier.id}`);
        assert.deepEqual(init, { method: "DELETE", headers: { "x-organization-id": "org-a" } });
        if (mode === "network") throw new Error("private prose");
        if (mode === "json") return new Response("private prose");
        return Response.json({ success: mode !== "shape" }, { status: mode === "status" ? 403 : 200 });
      } })(supplier.id);
    assert.deepEqual(events, mode === "cancel" ? [] : mode === "success" ? [[{ ...supplier, id: "keep" }], t("supplierUnlinked")] : [t(mode === "no-org" ? "organizationRequired" : "supplierUnlinkFailed")]);
  }
});

test("route read effects validate all rows, handle missing org and ignore cancelled requests", async () => {
  for (const file of [variants, suppliers]) for (const mode of ["success", "cancel", "no-org", "status", "json", "shape", "network"]) {
    const events: unknown[] = [], effects: Effect[] = [];
    const Page = loaded(file, {}, [], events, effects, {
      localStorage: { getItem: () => mode === "no-org" ? null : "org-a" },
      fetch: async (url: string, init: RequestInit) => {
        assert.equal(url, `/api/v1/inventory/item-a/${file === variants ? "variants" : "suppliers"}`);
        assert.deepEqual(init, { headers: { "x-organization-id": "org-a" } });
        if (mode === "network") throw new Error("private prose");
        if (mode === "json") return new Response("private prose");
        return Response.json({ data: [file === variants ? variant : supplier, ...(mode === "shape" ? [null] : [])] }, { status: mode === "status" ? 403 : 200 });
      } });
    renderWithPresentation(createElement(Page), "en-US");
    events.length = 0;
    const cleanup = effects[0]();
    if (mode === "cancel") { assert.equal(typeof cleanup, "function"); cleanup!(); }
    await flush();
    const adopted = events.filter(e => Array.isArray(e) && ["variants", "suppliers"].includes(e[0]));
    assert.deepEqual(adopted, mode === "success" ? [[file === variants ? "variants" : "suppliers", [file === variants ? variant : supplier]]] : []);
    if (mode === "cancel") assert.ok(!events.some(e => Array.isArray(e) && (e[0] === "readError" && e[1] === true || e[0] === "loading" && e[1] === false)));
    else assert.deepEqual(events.at(-1), ["loading", false]);
    if (!["success", "cancel"].includes(mode)) assert.ok(events.some(e => JSON.stringify(e) === '["readError",true]'));
  }
});

test("owned authored JSX and document titles have no untranslated English; paired Persian is actual script", () => {
  assert.deepEqual(Object.keys(en.InventoryCatalogs), Object.keys(fa.InventoryCatalogs));
  for (const value of Object.values(fa.InventoryCatalogs)) assert.match(value, /[\u0600-\u06ff]/);
  for (const file of [variants, suppliers]) {
    const ast = parse(file);
    function visit(n: ts.Node) {
      if (ts.isJsxText(n)) assert.ok(!/[A-Za-z]/.test(n.text), n.text);
      if (ts.isJsxAttribute(n) && ["title", "description", "placeholder", "aria-label"].includes(n.name.getText(ast)) && n.initializer && ts.isStringLiteral(n.initializer)) assert.ok(!/[A-Za-z]/.test(n.initializer.text), n.getText(ast));
      if (ts.isCallExpression(n) && n.expression.getText(ast) === "useDocumentTitle") assert.ok(!ts.isStringLiteral(n.arguments[0]));
      ts.forEachChild(n, visit);
    }
    visit(ast);
  }
});
