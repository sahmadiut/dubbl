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
import { renderWithPresentation } from "./helpers/presentation";
import * as money from "../lib/money/contact-dashboard-ui";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const layout = "app/(dashboard)/contacts/[id]/layout.tsx";
const overview = "app/(dashboard)/contacts/[id]/page.tsx";
const locales = ["en-US", "fa-IR"] as const;
const noop = () => {};
const caller = '<script>مخاطب & contact</script>';
const raw = { id: "contact-a", name: caller, email: "contact@example.test", phone: "+98-123", taxNumber: "T-123", type: "both", paymentTermsDays: 45,
  creditLimit: 9007199254740991, creditLimitMinor: "9007199254740991", currencyCode: "USD", isTaxExempt: true, is1099Vendor: true,
  defaultRevenueAccountId: "revenue-a", defaultExpenseAccountId: "expense-a", defaultTaxRateId: "tax-a", notes: caller,
  createdAt: "2026-10-19T00:00:00Z", people: [{ id: "person-a" }] };
const saved = money.contactDetailUi(raw);
function translator(locale: typeof locales[number]) { return createTranslator({ locale, messages: locale === "en-US" ? en : fa, namespace: "ContactDetails" }); }
function escape(value: string) { return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;"); }
function parse(path: string) { return ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX); }
type Captured = { kind: string; props: Record<string, unknown> };

// Production templates, fields, Section and real next-intl provider. Hooks and
// navigation are controlled; portal controls expose their authored options.
function loaded(path: string, states: Record<string, unknown> = {}, captured: Captured[] = [], events: unknown[] = []) {
  const ast = parse(path), names: string[] = [];
  function hooks(n: ts.Node) {
    if (ts.isVariableDeclaration(n) && ts.isArrayBindingPattern(n.name) && n.initializer && ts.isCallExpression(n.initializer) && n.initializer.expression.getText(ast) === "useState") names.push(n.name.elements[0].getText(ast));
    ts.forEachChild(n, hooks);
  }
  hooks(ast);
  const inline = (kind: string) => function InlineControl(props: Record<string, unknown>) {
    captured.push({ kind, props });
    return createElement("div", { "data-control": kind, "data-value": props.value, title: props.title as string | undefined }, props.children as ReactNode,
      typeof props.placeholder === "string" ? createElement("span", null, props.placeholder) : null);
  };
  let index = 0;
  const require = createRequire(resolve(path)), compiled = { exports: {} as Record<string, ComponentType<Record<string, unknown>>> };
  const load = (id: string) => {
    if (id === "react") return { ...React, useState: (initial: unknown) => { const key = names[index++]; return [Object.hasOwn(states, key) ? states[key] : initial, (v: unknown) => events.push([key, v])]; }, useEffect: noop, useCallback: (fn: unknown) => fn };
    if (id === "next-intl") return nextIntl;
    if (id === "next/navigation") return { useParams: () => ({ id: "contact-a" }), usePathname: () => states.pathname ?? "/contacts/contact-a", useRouter: () => ({ push: (v: string) => events.push(v) }) };
    if (id.endsWith("/use-entity-title")) return { useEntityTitle: (v: string) => events.push(v) };
    if (id.endsWith("/use-confirm")) return { useConfirm: () => ({ confirm: noop, dialog: null }) };
    if (id.endsWith("/create-drawer")) return { useCreateDrawer: () => ({ open: (...v: unknown[]) => events.push(v) }) };
    if (id === "./layout") return { getOrgId: () => "org-a", useContactContext: () => ({ contact: saved, formType: "both", formCreditLimit: "90071992547409.91", formCurrencyCode: "USD", formTaxExempt: true, form1099Vendor: true,
      formRevenueAccountId: "revenue-a", formExpenseAccountId: "expense-a", formTaxRateId: "tax-a", saving: states.saving ?? false, ...Object.fromEntries(["setFormType", "setFormCreditLimit", "setFormCurrencyCode", "setFormTaxExempt", "setForm1099Vendor", "setFormRevenueAccountId", "setFormExpenseAccountId", "setFormTaxRateId"].map(k => [k, (v: unknown) => events.push([k, v])])) }) };
    for (const [suffix, names] of Object.entries({ "/ui/select": ["Select", "SelectContent", "SelectItem", "SelectTrigger", "SelectValue"], "/ui/dialog": ["Dialog", "DialogContent", "DialogHeader", "DialogTitle", "DialogDescription"], "/ui/currency-select": ["CurrencySelect"], "/ui/currency-input": ["CurrencyInput"] })) {
      if (id.endsWith(suffix)) return Object.fromEntries(names.map(key => [key, inline(key)]));
    }
    return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  };
  const code = ts.transpileModule(ast.text, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function("require", "module", "exports", code)(load, compiled, compiled.exports);
  return compiled.exports.default;
}

// Run the actual authored handlers against controlled IO and real money adapters.
function callback(path: string, name: string, scope: Record<string, unknown>) {
  const ast = parse(path); let expression = "";
  function visit(n: ts.Node) {
    if (ts.isFunctionDeclaration(n) && n.name?.text === name) expression = n.getText(ast);
    if (ts.isVariableDeclaration(n) && n.name.getText(ast) === name && n.initializer && ts.isCallExpression(n.initializer)) expression = n.initializer.arguments[0].getText(ast);
    if (name === "effect" && ts.isCallExpression(n) && n.expression.getText(ast) === "useEffect" && !expression) expression = n.arguments[0].getText(ast);
    if (ts.isJsxAttribute(n) && n.name.getText(ast) === "onClick" && n.initializer && ts.isJsxExpression(n.initializer) && n.initializer.expression) {
      const body = n.initializer.expression.getText(ast);
      if ((name === "tabNavigate" && body.includes("router.push(tabHref)")) || (name === "opportunity" && body.includes('openDrawer("deal"')) || (name === "back" && body.includes('router.push("/contacts")'))) expression = body;
    }
    ts.forEachChild(n, visit);
  }
  visit(ast); assert.ok(expression, name);
  const code = ts.transpileModule(`const run = ${expression};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(scope), `${code}; return run;`)(...Object.values(scope));
}
const flush = async () => { for (let i = 0; i < 8; i++) await new Promise(resolve => setImmediate(resolve)); };

test("contact shell renders translated missing, tabs, merge states and unchanged navigation", () => {
  for (const locale of locales) {
    const t = translator(locale), events: unknown[] = [];
    const Missing = loaded(layout, { loading: false }, [], events);
    const missing = renderWithPresentation(createElement(Missing), locale);
    assert.ok(missing.includes(escape(t("missing"))) && missing.includes(escape(t("backMissing"))));
    for (const [tab, tabLabel] of [["details", "tabsDetails"], ["activity", "tabsActivity"], ["statement", "tabsStatement"], ["bookkeeping", "tabsBookkeeping"], ["people", "tabsPeople"], ["files", "tabsFiles"]] as const) for (const populated of [false, true]) {
      const captured: Captured[] = [];
      const Shell = loaded(layout, { loading: false, contact: saved, pathname: `/contacts/contact-a${tab === "details" ? "" : `/${tab}`}`, mergeOpen: true, merging: populated,
        mergeResults: populated ? [{ id: "duplicate-a", name: caller, email: "duplicate@example.test" }] : [] }, captured, events);
      const html = renderWithPresentation(createElement(Shell, null, createElement("p", null, "child-content")), locale);
      for (const key of ["back", "merge", "mergeHint", "opportunity", "opportunityHint", "mergeTitle", "mergeSearch", populated ? "mergeIn" : "mergeEmpty", "tabsDetails", "tabsActivity", "tabsStatement", "tabsBookkeeping", "tabsPeople", "tabsFiles"] as const) assert.ok(html.includes(escape(t(key))), key);
      assert.ok(html.includes(escape(caller)) && !html.includes("<script>"));
      assert.ok(html.includes("child-content") && html.includes("font-medium"));
      assert.ok(events.includes(caller)); // unchanged entity title is caller data
      const Back = captured.find(c => c.kind === "Dialog")!;
      assert.equal(Back.props.open, true);
      if (populated) assert.ok(html.includes('disabled=""'));
      const activeButtons = [...html.matchAll(/<button[^>]*class="([^"]*)"[^>]*>([\s\S]*?)<\/button>/g)].filter(match => match[1].includes("border-foreground text-foreground"));
      assert.equal(activeButtons.length, 1);
      assert.ok(activeButtons[0][2].includes(escape(t(tabLabel))));
      const route = `/contacts/contact-a${tab === "details" ? "" : `/${tab}`}`;
      callback(layout, "tabNavigate", { tabHref: route, router: { push: (v: string) => assert.equal(v, route) } })();
    }
    callback(layout, "opportunity", { contact: saved, openDrawer: (type: string, defaults: unknown) => { assert.equal(type, "deal"); assert.deepEqual(defaults, { contactId: "contact-a", contactName: caller }); } })();
    callback(layout, "back", { router: { push: (v: string) => assert.equal(v, "/contacts") } })();
  }
});

test("contact overview translates fields, canonical options, exact credit props and busy states", () => {
  for (const locale of locales) for (const saving of [false, true]) {
    const t = translator(locale), captured: Captured[] = [], events: unknown[] = [];
    const Page = loaded(overview, { saving, accounts: [{ id: "revenue-a", type: "revenue", code: "4000", name: caller }, { id: "expense-a", type: "expense", code: "5000", name: caller }, { id: "asset-a", type: "asset" }], taxRates: [{ id: "tax-a", name: caller, rate: 1250 }] }, captured, events);
    const html = renderWithPresentation(createElement(Page), locale);
    for (const key of ["general", "generalDescription", "name", "namePlaceholder", "email", "phone", "type", "customer", "supplier", "both", "taxNumber", "taxPlaceholder", "payment", "paymentDescription", "terms", "termsPlaceholder", "currency", "creditLimit", "noLimit", "taxStatus", "taxExempt", "usTax", "vendor1099", "vendor1099Hint", "accounts", "accountsDescription", "incomeAccount", "expenseAccount", "selectAccount", "none", "taxRate", "taxRateDescription", "selectTaxRate", "notes", "notesDescription", "notesPlaceholder", saving ? "saving" : "save", "danger", "dangerDescription", "deleteContact", "deleteHint", "delete"] as const) assert.ok(html.includes(escape(t(key))), key);
    assert.ok(html.includes(escape(caller)) && !html.includes("<script>"));
    assert.ok(html.includes('name="name"') && html.includes('required=""') && html.includes('type="email"') && html.includes('value="45"'));
    assert.ok(html.includes('type="button"') && html.includes("12.5%"));
    assert.deepEqual(captured.filter(c => c.kind === "SelectItem").map(c => c.props.value), ["customer", "supplier", "both", "none", "revenue-a", "none", "expense-a", "none", "tax-a"]);
    const credit = captured.find(c => c.kind === "CurrencyInput")!.props;
    assert.equal(credit.value, "90071992547409.91"); assert.equal(credit.prefix, "USD"); assert.equal(credit.fractionDigits, 2);
    (credit.onChange as (v: string) => void)("12.50");
    (captured.find(c => c.kind === "CurrencySelect")!.props.onValueChange as (v: string) => void)("KWD");
    assert.deepEqual(events, [["setFormCreditLimit", "12.50"], ["setFormCurrencyCode", "KWD"]]);
    if (saving) assert.ok(html.includes('aria-busy="true"') && html.includes('disabled=""'));
  }
});

test("contact update preserves PATCH fields, exact currency units, optional nulls and localized failures", async () => {
  for (const locale of locales) for (const code of ["USD", "JPY", "KWD"]) for (const mode of ["success", "empty", "status", "html", "alias", "network", "no-org", "invalid-credit"]) {
    const t = translator(locale), events: unknown[] = [], fields = new Map(Object.entries(mode === "empty" ? { name: caller } : { name: caller, email: raw.email, phone: raw.phone, taxNumber: raw.taxNumber, paymentTermsDays: "45", notes: caller }));
    const text = mode === "empty" ? "" : mode === "invalid-credit" ? "bad" : code === "JPY" ? "9007199254740991" : code === "KWD" ? "9007199254740.991" : "90071992547409.91";
    const limit = mode === "empty" ? null : "9007199254740991";
    let requests = 0;
    const resets = Object.fromEntries(["setFormType", "setFormRevenueAccountId", "setFormExpenseAccountId", "setFormTaxRateId", "setFormTaxExempt", "setForm1099Vendor", "setFormCreditLimit", "setFormCurrencyCode"].map(key => [key, (v: unknown) => events.push([key, v])]));
    await callback(overview, "handleSubmit", { ...resets, t, id: "contact-a", FormData: class { get(k: string) { return fields.get(k) ?? null; } }, getOrgId: () => mode === "no-org" ? null : "org-a",
      formType: "both", formCreditLimit: text, formCurrencyCode: code, formTaxExempt: true, form1099Vendor: true, formRevenueAccountId: mode === "empty" ? "none" : "revenue-a", formExpenseAccountId: "none", formTaxRateId: "none", ...money,
      setSaving: (v: boolean) => events.push(v), setContact: (v: typeof saved) => { assert.equal(v.creditLimit, limit === null ? null : 9007199254740991n); events.push("adopt"); },
      toast: { success: (v: string) => events.push(v), error: (v: string) => events.push(v) },
      fetch: async (url: string, init: RequestInit) => {
        requests++; assert.equal(url, "/api/v1/contacts/contact-a"); assert.equal(init.method, "PATCH");
        assert.deepEqual(init.headers, { "Content-Type": "application/json", "x-organization-id": "org-a" });
        assert.deepEqual(JSON.parse(init.body as string), { name: caller, email: fields.get("email") || null, phone: fields.get("phone") || null, taxNumber: fields.get("taxNumber") || null, type: "both", paymentTermsDays: mode === "empty" ? 30 : 45, creditLimitMinor: limit,
          isTaxExempt: true, is1099Vendor: true, currencyCode: code, defaultRevenueAccountId: mode === "empty" ? null : "revenue-a", defaultExpenseAccountId: null, defaultTaxRateId: null, notes: fields.get("notes") || null });
        if (mode === "network") throw new Error("private server prose"); if (mode === "html") return new Response("<html>private server prose</html>");
        return Response.json({ contact: { ...raw, currencyCode: code, creditLimit: limit === null ? null : raw.creditLimit, creditLimitMinor: mode === "alias" ? "1250" : limit }, error: "private server prose" }, { status: mode === "status" ? 403 : 200 });
      } })({ preventDefault: noop, currentTarget: {} });
    assert.equal(requests, ["no-org", "invalid-credit"].includes(mode) ? 0 : 1);
    if (mode === "no-org") { assert.deepEqual(events, []); continue; }
    assert.equal(events[0], true); assert.equal(events.at(-1), false);
    if (["success", "empty"].includes(mode)) {
      assert.ok(events.includes("adopt") && events.includes(t("updated")));
      assert.ok(events.some(v => Array.isArray(v) && v[0] === "setFormCreditLimit" && v[1] === text));
    } else assert.deepEqual(events, [true, t("updateFailed"), false]);
  }
});

test("detail loading preserves exact aliases, defaults and translated HTTP/JSON/money failures", async () => {
  for (const locale of locales) for (const mode of ["success", "empty", "status", "html", "shape", "alias", "network", "no-org"]) {
    const t = translator(locale), events: unknown[] = [];
    const setters = Object.fromEntries(["setFormType", "setFormRevenueAccountId", "setFormExpenseAccountId", "setFormTaxRateId", "setFormTaxExempt", "setForm1099Vendor", "setFormCreditLimit", "setFormCurrencyCode"].map(k => [k, (v: unknown) => events.push([k, v])]));
    await callback(layout, "fetchContact", { ...setters, ...money, t, id: "contact-a", getOrgId: () => mode === "no-org" ? null : "org-a",
      setContact: (v: typeof saved | null) => events.push(v === null ? null : v.creditLimit), setLoading: (v: boolean) => events.push(v), toast: { error: (v: string) => events.push(v) },
      fetch: async (url: string, init: RequestInit) => {
        assert.equal(url, "/api/v1/contacts/contact-a"); assert.deepEqual(init.headers, { "x-organization-id": "org-a" });
        if (mode === "network") throw new Error("private server prose"); if (mode === "html") return new Response("<html>private server prose</html>");
        return Response.json({ contact: mode === "shape" ? {} : { ...raw, creditLimit: mode === "empty" ? null : raw.creditLimit, creditLimitMinor: mode === "empty" ? null : mode === "alias" ? "1" : raw.creditLimitMinor } }, { status: mode === "status" ? 403 : 200 });
      } })();
    if (mode === "no-org") assert.deepEqual(events, [false]);
    else if (["success", "empty"].includes(mode)) {
      assert.equal(events[0], mode === "empty" ? null : 9007199254740991n); assert.equal(events.at(-1), false);
      assert.ok(events.some(v => Array.isArray(v) && v[0] === "setFormCreditLimit" && v[1] === (mode === "empty" ? "" : "90071992547409.91")));
    } else assert.deepEqual(events, [null, t("loadFailed"), false]);
  }
});

test("merge confirmation preserves survivor direction, caller names, cancellation and localized failures", async () => {
  for (const locale of locales) for (const mode of ["success", "cancel", "status", "network", "no-org"]) {
    const t = translator(locale), events: unknown[] = [];
    await callback(layout, "handleMerge", { t, contact: saved, getOrgId: () => mode === "no-org" ? null : "org-a",
      confirm: async (o: Record<string, unknown>) => { assert.equal(o.title, t("mergeConfirmTitle", { source: caller, target: caller })); assert.equal(o.description, t("mergeConfirmDescription")); assert.equal(o.confirmLabel, t("mergeConfirm")); assert.equal(o.cancelLabel, t("cancel")); assert.equal(o.destructive, true); return mode !== "cancel"; },
      setMerging: (v: boolean) => events.push(v), setMergeOpen: (v: boolean) => events.push(["open", v]), setMergeSearch: (v: string) => events.push(["search", v]), fetchContact: () => events.push("refresh"),
      toast: { success: (v: string) => events.push(v), error: (v: string) => events.push(v) },
      fetch: async (url: string, init: RequestInit) => {
        assert.equal(url, "/api/v1/contacts/duplicate-a/merge"); assert.equal(init.method, "POST");
        assert.deepEqual(init.headers, { "Content-Type": "application/json", "x-organization-id": "org-a" }); assert.deepEqual(JSON.parse(init.body as string), { targetContactId: "contact-a" });
        if (mode === "network") throw new Error("private server prose");
        return Response.json({ error: "private server prose" }, { status: mode === "status" ? 409 : 200 });
      } })("duplicate-a", caller);
    assert.deepEqual(events, ["cancel", "no-org"].includes(mode) ? [] : mode === "success" ? [true, t("merged"), ["open", false], ["search", ""], "refresh", false] : [true, t("mergeFailed"), false]);
  }
});

test("delete confirmation only navigates after successful HTTP and rejects failures for retry", async () => {
  for (const locale of locales) for (const mode of ["success", "cancel", "status", "network", "no-org"]) {
    const t = translator(locale), events: unknown[] = [];
    const run = callback(overview, "handleDelete", { t, id: "contact-a", getOrgId: () => mode === "no-org" ? null : "org-a", router: { push: (v: string) => events.push(v) },
      confirm: async (o: { title: string; description: string; confirmLabel: string; cancelLabel: string; destructive: boolean; onConfirm: () => Promise<void> }) => {
        assert.equal(o.title, t("deleteTitle")); assert.equal(o.description, t("deleteDescription")); assert.equal(o.confirmLabel, t("delete")); assert.equal(o.cancelLabel, t("cancel")); assert.equal(o.destructive, true);
        if (mode !== "cancel") await o.onConfirm();
      }, toast: { success: (v: string) => events.push(v), error: (v: string) => events.push(v) },
      fetch: async (url: string, init: RequestInit) => { assert.equal(url, "/api/v1/contacts/contact-a"); assert.equal(init.method, "DELETE"); assert.deepEqual(init.headers, { "x-organization-id": "org-a" }); if (mode === "network") throw new Error("private server prose"); return new Response("private server prose", { status: mode === "status" ? 403 : 200 }); } });
    if (["success", "cancel"].includes(mode)) await run(); else await assert.rejects(run, { message: t("deleteFailed") });
    assert.deepEqual(events, mode === "cancel" ? [] : mode === "success" ? [t("deleted"), "/contacts"] : [t("deleteFailed")]);
  }
});

test("merge search and reference callbacks reject invalid HTTP/envelopes with localized errors", async () => {
  for (const locale of locales) for (const path of [layout, overview]) for (const mode of ["success", "status", "html", "shape", "row", "network", "no-org"]) {
    const t = translator(locale), events: unknown[] = [], requests: string[] = [];
    callback(path, path === layout ? "effect" : "fetchReferenceData", { t, id: "contact-a", mergeOpen: true, mergeSearch: caller,
      getOrgId: () => mode === "no-org" ? null : "org-a", setTimeout: (fn: () => void) => { fn(); return 0; }, clearTimeout: noop,
      setMergeResults: (v: unknown) => events.push(v), setAccounts: (v: unknown) => events.push(v), setTaxRates: (v: unknown) => events.push(v), toast: { error: (v: string) => events.push(v) },
      fetch: async (url: string, init: RequestInit) => {
        requests.push(url); assert.deepEqual(init.headers, { "x-organization-id": "org-a" });
        if (path === layout) { const parsed = new URL(url, "https://example.test"); assert.equal(parsed.pathname, "/api/v1/contacts"); assert.deepEqual(Object.fromEntries(parsed.searchParams), { search: caller, limit: "20" }); }
        if (mode === "network") throw new Error("private server prose"); if (mode === "html") return new Response("<html>private server prose</html>");
        return Response.json(mode === "shape" ? { data: {}, accounts: {}, taxRates: {} } : mode === "row" ? { data: [{ ...raw, email: {} }], accounts: [null], taxRates: [{ id: "tax-a", name: caller, rate: "1250" }] } : { data: [raw, { ...raw, id: "duplicate-a" }], accounts: [{ id: "account-a", code: "4000", name: caller, type: "revenue" }], taxRates: [{ id: "tax-a", name: caller, rate: 1250 }] }, { status: mode === "status" ? 403 : 200 });
      } })();
    await flush();
    if (mode === "no-org") assert.deepEqual(events, []);
    else if (mode !== "success") assert.deepEqual(events, path === layout ? [[], t("searchFailed")] : [t("referenceFailed"), t("referenceFailed")]);
    else assert.deepEqual(events, path === layout ? [[{ ...raw, id: "duplicate-a" }]] : [[{ id: "account-a", code: "4000", name: caller, type: "revenue" }], [{ id: "tax-a", name: caller, rate: 1250 }]]);
    if (path === overview && mode !== "no-org") assert.deepEqual(requests, ["/api/v1/accounts", "/api/v1/tax-rates"]);
  }
});

test("all owned authored text is extracted with explicit technical exceptions and real Persian script", () => {
  for (const path of [layout, overview]) {
    const ast = parse(path);
    function visit(n: ts.Node) {
      if (ts.isJsxText(n)) assert.ok(["", "-", "(", "%)"].includes(n.text.trim()), `${path}: ${n.text.trim()}`);
      if (ts.isJsxAttribute(n) && ["title", "description", "placeholder", "aria-label", "label"].includes(n.name.getText(ast)) && n.initializer && ts.isStringLiteral(n.initializer)) assert.ok(["email@example.com", "+1 (555) 000-0000"].includes(n.initializer.text), n.getText(ast));
      ts.forEachChild(n, visit);
    }
    visit(ast);
  }
  for (const value of Object.values(fa.ContactDetails)) assert.match(value, /[\u0600-\u06ff]/);
});
