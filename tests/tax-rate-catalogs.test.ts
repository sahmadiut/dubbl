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
import * as AccountPicker from "../components/dashboard/account-picker";
import * as BrandLoader from "../components/dashboard/brand-loader";
import { renderWithPresentation } from "./helpers/presentation";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const path = "app/(dashboard)/tax/page.tsx";
const layout = "app/(dashboard)/tax/layout.tsx";
const locales = ["en-US", "fa-IR"] as const;
const noop = () => {};
const caller = '<script>Ù…Ø§Ù„ÛŒØ§Øª & GST</script>';
const kinds = ["standard", "partial_block", "blocked", "reverse_charge", "exempt", "no_vat", "sales_tax_us"] as const;
const escape = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
function translator(locale: typeof locales[number]) {
  return createTranslator({ locale, messages: locale === "en-US" ? en : fa, namespace: "TaxRates" });
}

// Actual templates, React and provider; hooks/navigation are controlled and
// portaled sheet/select surfaces are inline so all text is inspectable in SSR.
function loaded(file: string, states: unknown[] = []) {
  const require = createRequire(resolve(file));
  const compiled = { exports: {} as Record<string, ComponentType<Record<string, unknown>>> };
  let index = 0;
  const source = readFileSync(file, "utf8") + (file === path ? "\nexport { TaxRateFormFields, ComponentsEditor, QuickSetup, CreateTaxRateDialog };" : "");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  const inline = ({ children }: { children: ReactNode }) => createElement("div", null, children);
  const load = (id: string) => {
    if (id === "react") return { ...React, useState: (initial: unknown) => [index < states.length ? states[index++] : initial, noop], useEffect: noop };
    if (id === "next-intl") return nextIntl;
    if (id.endsWith("/account-picker")) return AccountPicker;
    if (id.endsWith("/brand-loader")) return BrandLoader;
    if (id.endsWith("/tab-layout")) {
      const nested = { exports: {} };
      const code = ts.transpileModule(readFileSync("components/dashboard/tab-layout.tsx", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
      new Function("require", "module", "exports", code)(load, nested, nested.exports);
      return nested.exports;
    }
    if (id.endsWith("/use-document-title")) return { useDocumentTitle: noop };
    if (id.endsWith("/ui/sheet")) return Object.fromEntries(["Sheet", "SheetContent", "SheetHeader", "SheetTitle", "SheetTrigger", "SheetFooter"].map(key => [key, inline]));
    if (id.endsWith("/ui/select")) return { ...Object.fromEntries(["Select", "SelectContent", "SelectTrigger"].map(key => [key, inline])), SelectValue: ({ placeholder }: { placeholder: string }) => createElement("span", null, placeholder), SelectItem: ({ value, children }: { value: string; children: ReactNode }) => createElement("span", { "data-value": value }, children) };
    if (id === "next/navigation") return { usePathname: () => "/tax", useRouter: () => ({ push: noop }) };
    return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  };
  new Function("require", "module", "exports", code)(load, compiled, compiled.exports);
  return compiled.exports;
}

// Execute authored callback/function bodies with controlled IO, never copies.
function callback(file: string, name: string, scope: Record<string, unknown> = {}) {
  const ast = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let expression = "";
  function visit(node: ts.Node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) expression = `(${node.getText(ast)})`;
    ts.forEachChild(node, visit);
  }
  visit(ast); assert.ok(expression, name);
  const code = ts.transpileModule(`const run = ${expression};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(scope), `${code}; return run;`)(...Object.values(scope));
}
const buildPayload = callback(path, "buildPayload", { RECOVERABLE_KINDS: new Set(["standard", "partial_block"]) });

test("tax list renders both locales, all applicability labels, default and safely escaped caller data", () => {
  for (const locale of locales) {
    const t = translator(locale);
    const rates = ["sales", "purchase", "both", caller].map((type, i) => ({ id: `r-${i}`, name: caller, rate: 1250, type, kind: "standard", isDefault: i === 0, recoverablePercent: 10000 }));
    const Page = loaded(path, [rates, false]).default;
    const html = renderWithPresentation(createElement(Page), locale);
    for (const key of ["title", "description", "totalRates", "salesRates", "purchaseRates", "onInvoices", "onBills", "type_sales", "type_purchase", "type_both", "default", "addRate"] as const) assert.ok(html.includes(escape(t(key))), key);
    assert.ok(html.includes("12.50%") && html.includes('style="width:100%"'));
    assert.ok(html.includes(escape(caller)) && !html.includes("<script>"));
    assert.ok(html.includes(`aria-label="${escape(t("editRate"))}"`));
    const Empty = loaded(path, [[], false]).default;
    const empty = renderWithPresentation(createElement(Empty), locale);
    assert.ok(empty.includes(escape(t("setupTitle"))) && empty.includes(escape(t("setupDescription"))));
    const Loading = loaded(path, [[], true]).default;
    assert.ok(!renderWithPresentation(createElement(Loading), locale).includes(escape(t("setupTitle"))));
  }
});

test("real form templates cover all tax kinds, recovery visibility, compound fields and canonical options", () => {
  for (const locale of locales) for (const kind of kinds) {
    const t = translator(locale);
    const Form = loaded(path).TaxRateFormFields;
    const html = renderWithPresentation(createElement(Form, { name: caller, rate: "12.50", type: "both", kind, recoverable: "50", components: [{ name: caller, rate: 250, accountId: null }], setName: noop, setRate: noop, setType: noop, setKind: noop, setRecoverable: noop, setComponents: noop }), locale);
    for (const key of ["name", "namePlaceholder", "rate", "appliesTo", "treatment", "parts", "addPart", "partsHelp", "partName", "partPlaceholder", "account", "defaultAccount"] as const) assert.ok(html.includes(escape(t(key))), key);
    for (const option of kinds) assert.ok(html.includes(`data-value="${option}"`) && html.includes(escape(t(`kind_${option}`))));
    assert.ok(html.includes(escape(t(`help_${kind}`))));
    assert.equal(html.includes(escape(t("reclaimableHelp"))), ["standard", "partial_block"].includes(kind));
    assert.ok(html.includes('value="2.5"') && html.includes('type="number"') && html.includes('step="0.01"'));
    assert.ok(html.includes(`aria-label="${escape(t("removePart"))}"`));
    assert.ok(html.includes(escape(caller)) && !html.includes("<script>"));
  }
});

test("create/edit sheets and quick setup render translated busy states and country interpolation", () => {
  for (const locale of locales) for (const busy of [false, true]) {
    const t = translator(locale);
    const Create = loaded(path, [caller, "12.50", "both", "standard", "100", [], busy]).CreateTaxRateDialog;
    const html = renderWithPresentation(createElement(Create, { open: true, setOpen: noop, onCreated: noop, orgId: "org-a" }), locale);
    for (const key of ["newRate", busy ? "creating" : "create"] as const) assert.ok(html.includes(escape(t(key))), key);
    assert.equal(/<button(?=[^>]*type="submit")(?=[^>]*disabled="")[^>]*>/.test(html), busy);
    const Page = loaded(path, [[], true, false, { id: "r-a" }, caller, "12.50", "both", "standard", "100", [], busy]).default;
    const edit = renderWithPresentation(createElement(Page), locale);
    for (const key of ["editRate", "cancel", busy ? "saving" : "save"] as const) assert.ok(edit.includes(escape(t(key))), key);
    const Quick = loaded(path, [[{ country: "US", countryName: caller }], "US", "US", busy]).QuickSetup;
    const setup = renderWithPresentation(createElement(Quick, { orgId: "org-a", onSeeded: noop }), locale);
    assert.ok(setup.includes(escape(t("setupRecommended", { country: caller }))));
    assert.ok(setup.includes(escape(t(busy ? "settingUp" : "quickSetup"))));
    assert.ok(setup.includes('data-value="US"') && !setup.includes("<script>"));
  }
});

test("tax navigation preserves every country eligibility branch, canonical href and open-period badge", () => {
  const eu = ["AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE"];
  for (const locale of locales) for (const country of [null, "IR", "GB", ...eu, "AU", "US"]) {
    const t = createTranslator({ locale, messages: locale === "en-US" ? en : fa, namespace: "TaxNavigation" });
    const Layout = loaded(layout, [country, 2]).default;
    const html = renderWithPresentation(createElement(Layout, null, "content"), locale);
    const links: [keyof typeof en.TaxNavigation, string][] = [["rates", "/tax"], ["currencies", "/tax/currencies"], ["periods", "/tax/periods"]];
    if (country === "GB" || eu.includes(country || "")) links.push(["vatReturn", "/tax/vat-return"]);
    if (country === "AU") links.push(["bas", "/tax/bas"]);
    if (country === "US") links.push(["salesTax", "/tax/sales-tax"], ["scheduleC", "/tax/schedule-c"]);
    for (const [key, href] of links) assert.ok(html.includes(escape(t(key))) && html.includes(`href="${href}"`));
    assert.equal((html.match(/href="\/tax/g) || []).length, links.length);
    assert.ok(html.includes(">2</span>"));
  }
});

test("payload builder retains integer basis points, recovery clamping, hidden defaults and compound account nulls", () => {
  for (const kind of kinds) {
    const input = { name: caller, rate: "12.50", type: "both", kind, recoverable: "50", components: [{ name: " PST ", rate: 250, accountId: "" }, { name: "   ", rate: 99, accountId: "unused" }, { name: caller, rate: 1000, accountId: "account-a" }] };
    const before = structuredClone(input);
    assert.deepEqual(buildPayload(input), { name: caller, rate: 1250, type: "both", kind, recoverablePercent: ["standard", "partial_block"].includes(kind) ? 5000 : 0, components: [{ name: "PST", rate: 250, accountId: null }, { name: caller, rate: 1000, accountId: "account-a" }] });
    assert.deepEqual(input, before);
  }
  for (const [value, expected] of [["-5", 0], ["101", 10000], ["", 0], ["12.34", 1234]] as const) assert.equal(buildPayload({ name: "Tax", rate: "0", type: "sales", kind: "partial_block", recoverable: value, components: [] }).recoverablePercent, expected);
});

test("create/edit callbacks preserve scoped requests, reset only on success and localize HTTP/network failures", async () => {
  for (const locale of locales) for (const edit of [false, true]) for (const mode of ["success", "status", "network", "no-org", "no-edit"]) {
    const t = translator(locale), events: unknown[] = [];
    const values = { name: caller, rate: "12.50", type: "purchase", kind: "partial_block", recoverable: "50", components: [{ name: "PST", rate: 250, accountId: null }] };
    const setter = (key: string) => (v: unknown) => events.push([key, v]);
    const scope = { t, buildPayload, orgId: mode === "no-org" ? null : "org-a", editing: mode === "no-edit" ? null : { id: "r-a" }, ...values,
      editName: values.name, editRate: values.rate, editType: values.type, editKind: values.kind, editRecoverable: values.recoverable, editComponents: values.components,
      setSaving: setter("busy"), setEditSaving: setter("busy"), setEditing: setter("editing"), setOpen: setter("open"), setName: setter("name"), setRate: setter("rate"), setType: setter("type"), setKind: setter("kind"), setRecoverable: setter("recoverable"), setComponents: setter("components"),
      onCreated: () => events.push("refresh"), fetchRates: async () => events.push("refresh"), toast: { success: (s: string) => events.push(s), error: (s: string) => events.push(s) },
      fetch: async (url: string, init: RequestInit) => {
        assert.equal(url, edit ? "/api/v1/tax-rates/r-a" : "/api/v1/tax-rates");
        assert.equal(init.method, edit ? "PATCH" : "POST");
        assert.deepEqual(init.headers, { "Content-Type": "application/json", "x-organization-id": "org-a" });
        assert.deepEqual(JSON.parse(init.body as string), buildPayload(values));
        if (mode === "network") throw new Error("private provider prose");
        return new Response(null, { status: mode === "status" ? 403 : 200 });
      } };
    await callback(path, edit ? "handleEdit" : "handleCreate", scope)({ preventDefault: noop });
    if (mode === "no-org" || edit && mode === "no-edit") assert.deepEqual(events, []);
    else if (mode === "status" || mode === "network") assert.deepEqual(events, [["busy", true], t(edit ? "updateFailed" : "createFailed"), ["busy", false]]);
    else if (edit) assert.deepEqual(events, [["busy", true], ["editing", null], "refresh", t("updated"), ["busy", false]]);
    else assert.deepEqual(events, [["busy", true], t("created"), ["open", false], ["name", ""], ["rate", ""], ["type", "both"], ["kind", "standard"], ["recoverable", "100"], ["components", []], "refresh", ["busy", false]]);
  }
});

test("quick setup callback preserves explicit/implicit country and ICU counts and cleans busy state on failures", async () => {
  for (const locale of locales) for (const country of ["", "US"]) for (const mode of ["success", "skipped", "empty", "status", "html", "network", "no-org"]) {
    const t = translator(locale), events: unknown[] = [];
    await callback(path, "handleSeed", { t, orgId: mode === "no-org" ? null : "org-a", country, setSeeding: (v: boolean) => events.push(v), onSeeded: () => events.push("refresh"), toast: { success: (s: string) => events.push(s), info: (s: string) => events.push(s), error: (s: string) => events.push(s) },
      fetch: async (url: string, init: RequestInit) => {
        assert.equal(url, "/api/v1/tax-profiles"); assert.equal(init.method, "POST");
        assert.deepEqual(init.headers, { "Content-Type": "application/json", "x-organization-id": "org-a" });
        assert.deepEqual(JSON.parse(init.body as string), country ? { country } : {});
        if (mode === "network") throw new Error("private prose");
        if (mode === "html") return new Response("private prose");
        return Response.json({ created: mode === "empty" ? [] : [{}], skipped: mode === "skipped" ? [{}, {}] : [] }, { status: mode === "status" ? 403 : 201 });
      } })();
    assert.deepEqual(events, mode === "no-org" ? [] : ["status", "html", "network"].includes(mode) ? [true, t("seedFailed"), false] : [true, mode === "empty" ? t("alreadySetup") : mode === "skipped" ? t("seedAddedWithSkipped", { created: 1, skipped: 2 }) : t("seedAdded", { created: 1 }), "refresh", false]);
    for (const created of [0, 1, 2]) {
      assert.ok(!/MISSING|INVALID/.test(t("seedAdded", { created })));
      if (locale === "en-US") assert.equal(t("seedAdded", { created }), `Added ${created} tax rate${created === 1 ? "" : "s"}`);
    }
  }
});

test("list callback handles HTTP, malformed JSON/envelope and network failures without replacing saved rows", async () => {
  for (const locale of locales) for (const mode of ["success", "status", "html", "shape", "network", "no-org"]) {
    const t = translator(locale), events: unknown[] = [], rows = [{ id: "r-a", rate: 1250 }];
    await callback(path, "fetchRates", { t, orgId: mode === "no-org" ? null : "org-a", setRates: (v: unknown) => events.push(v), setLoading: (v: boolean) => events.push(v), toast: { error: (s: string) => events.push(s) },
      fetch: async (url: string, init: RequestInit) => {
        assert.equal(url, "/api/v1/tax-rates"); assert.deepEqual(init, { headers: { "x-organization-id": "org-a" } });
        if (mode === "network") throw new Error("private prose");
        if (mode === "html") return new Response("private prose");
        return Response.json({ taxRates: mode === "shape" ? {} : rows }, { status: mode === "status" ? 403 : 200 });
      } })();
    assert.deepEqual(events, mode === "no-org" ? [] : mode === "success" ? [rows, false] : [t("readFailed"), false]);
  }
});

test("owned sources contain no untranslated authored JSX/display strings except numeric syntax and percent symbol", () => {
  for (const file of [path, layout]) {
    const ast = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(node: ts.Node) {
      if (ts.isJsxText(node)) assert.ok(["", "%"].includes(node.text.trim()), node.text.trim());
      if (ts.isJsxAttribute(node) && ["title", "description", "placeholder", "aria-label", "alt"].includes(node.name.getText(ast)) && node.initializer && ts.isStringLiteral(node.initializer)) assert.match(node.initializer.text, /^\d+(\.\d+)?$/);
      if (ts.isCallExpression(node) && /^(toast\.(success|error|info)|useDocumentTitle)$/.test(node.expression.getText(ast))) assert.ok(!node.arguments.some(ts.isStringLiteral), node.getText(ast));
      ts.forEachChild(node, visit);
    }
    visit(ast);
  }
  for (const namespace of [fa.TaxRates, fa.TaxNavigation]) for (const value of Object.values(namespace)) assert.match(value, /[\u0600-\u06ff]/);
});
