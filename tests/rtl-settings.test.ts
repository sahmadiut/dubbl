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
import { resolvePresentation } from "../i18n/locale";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const h = React.createElement, noop = () => {};
const caller = "  \u0646\u0627\u0645 Caller <ACME/001> & " + "long-name-".repeat(24);
const email = "  person+001@example.test  ", code = "  TAX-001/ABC  ";
const presentations = (["en-US", "fa-IR"] as const).flatMap(language =>
  (["latn", "arabext"] as const).map(numerals => resolvePresentation({ user: { language, numerals } })));
const escape = (s: string) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
type Props = Record<string, unknown>;
const require = createRequire(import.meta.url);
const CommonJsProvider = (require("../i18n/provider") as typeof Provider).PresentationProvider;

// Execute production JSX with real next-intl and native controls. IO, hook state
// and separately owned portal/picker/widget boundaries are controlled.
function loaded(relative: string, states: Props = {}, component?: string) {
  const file = "app/(dashboard)/settings/" + relative, source = readFileSync(file, "utf8");
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const main = ast.statements.find(n => ts.isFunctionDeclaration(n) && (component
    ? n.name?.text === component : n.modifiers?.some(m => m.kind === ts.SyntaxKind.DefaultKeyword)));
  assert.ok(main, "requested settings component exists");
  const names: string[] = [];
  function hooks(n: ts.Node) {
    if (ts.isVariableDeclaration(n) && ts.isArrayBindingPattern(n.name) && n.initializer && ts.isCallExpression(n.initializer)
      && n.initializer.expression.getText(ast) === "useState") names.push(n.name.elements[0].getText(ast));
    ts.forEachChild(n, hooks);
  }
  hooks(main);
  const controls: { type: unknown; props: Props }[] = [], updates: unknown[][] = [], copied: unknown[] = [];
  const capture = (create: typeof jsx.jsx) => (type: React.ElementType, props: Props, key?: string) => {
    controls.push({ type, props }); return create(type, props, key);
  };
  let index = 0;
  const compiled = { exports: {} as Record<string, React.ComponentType<Props>> }, localRequire = createRequire(resolve(file));
  const inline = ({ children }: { children: React.ReactNode }) => h("div", null, children);
  const code = ts.transpileModule(source + (component ? `\nexport { ${component} };` : ""), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function("require", "module", "exports", code)((id: string) => {
    if (id === "react") return { ...React, useState: (initial: unknown) => {
      const key = names[index++]; return [key in states ? states[key] : typeof initial === "function" ? initial() : initial,
        (value: unknown) => updates.push([key, value])];
    }, useEffect: noop, useRef: (value: unknown) => ({ current: value }), useMemo: (fn: () => unknown) => fn(), useCallback: (fn: unknown) => fn };
    if (id === "react/jsx-runtime") return { ...jsx, jsx: capture(jsx.jsx), jsxs: capture(jsx.jsxs) };
    if (id === "next-intl") return intl;
    if (id.endsWith("/i18n/provider")) return Provider;
    if (id === "next/navigation") return { useRouter: () => ({ push: noop }), usePathname: () => "/settings", useParams: () => ({}) };
    if (id.endsWith("/use-document-title")) return { useDocumentTitle: noop };
    if (id.endsWith("/use-debounce")) return { useDebounce: (v: unknown) => v };
    if (id.endsWith("/use-confirm")) return { useConfirm: () => ({ confirm: noop, dialog: null }) };
    if (id.endsWith("/ui/currency-select")) return { CurrencySelect: () => null };
    if (id.endsWith("/settings/locale-preferences")) return { LocalePreferences: () => null };
    if (["/ui/dialog", "/ui/sheet", "/ui/select", "/ui/dropdown-menu", "/ui/popover", "/ui/command"].some(s => id.endsWith(s)))
      return new Proxy({}, { get: () => inline });
    return localRequire(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  }, compiled, compiled.exports);
  return { controls, updates, copied, render(p: typeof presentations[number]) {
    index = 0; controls.length = 0;
    const props = { presentation: p, messages: p.locale === "fa-IR" ? fa : en, now: new Date("2026-10-25T00:00:00Z") };
    return renderToStaticMarkup(h(Provider.PresentationProvider, props, h(CommonJsProvider, props,
      h(compiled.exports[component || "default"], component ? { activeOrgId: "org/001" } : {}))));
  } };
}

test("actual organization controls associate labels and preserve raw caller and ordered technical edits in four presentations", () => {
  const form = { name: caller, defaultLanguage: "fa-IR", countryCode: "US", businessType: "", defaultCurrency: "KWD",
    fiscalYearStartMonth: "1", defaultPaymentTerms: "30", taxId: code, businessRegistrationNumber: code,
    addressStreet: caller, addressCity: caller, addressState: caller, addressPostalCode: code, addressCountry: "US",
    contactPhone: " +98-001/ABC ", contactEmail: email, contactWebsite: " https://example.test/a?b=001 ", industrySector: caller };
  for (const p of presentations) {
    const page = loaded("page.tsx", { form, lockDate: "2026-10-25", peppolId: code }), html = page.render(p);
    const labels = (p.locale === "fa-IR" ? fa : en).SettingsGeneral;
    for (const [label, value, dir] of [[labels.name, caller, "auto"], [labels.taxIDVAT, code, "ltr"],
      [labels.email, email, "ltr"], [labels.postalCode, code, "ltr"], [labels.peppolParticipantId, code, "ltr"]]) {
      const field = page.controls.find(c => c.props["aria-label"] === label && typeof c.props.onChange === "function");
      assert.ok(field, "native field has a translated accessible name");
      assert.equal(field.props.value, value); assert.equal(field.props.dir, dir);
      assert.ok(html.includes(`for="${field.props.id}"`), "visible label points to its field");
    }
    const emailField = page.controls.find(c => c.props["aria-label"] === labels.email && typeof c.props.onChange === "function");
    assert.ok(emailField, "email callback exists");
    (emailField.props.onChange as (e: unknown) => void)({ target: { value: "  raw+002@example.test  " } });
    assert.deepEqual(page.updates.at(-1), ["form", { ...form, contactEmail: "  raw+002@example.test  " }]);
    assert.match(html, /<bdi[^>]*dir="ltr"[^>]*>2026-10-25<\/bdi>/, "lock date remains one ordered fragment");
  }
});

test("actual member and key rows isolate callers and technical prefixes without changing invite or clipboard values", () => {
  for (const p of presentations) {
    const member = { id: "m/001", userId: "u/001", userName: caller, userEmail: email, role: "member", customRoleId: null, createdAt: "2026-10-25" };
    const page = loaded("members/page.tsx", { members: [member], loading: false, invitations: [{ id: "i/001", email,
      role: "member", invitedBy: { name: caller, email }, expiresAt: "2099-01-01", createdAt: "2026-10-25" }] });
    const html = page.render(p);
    assert.ok(html.includes(`>${escape(caller)}</bdi>`), "caller member and inviter names isolated");
    assert.ok(html.includes(`>${escape(email)}</bdi>`), "exact email including whitespace isolated");
    const key = loaded("api-keys/page.tsx", { loading: false, keys: [{ id: "k/001", name: caller,
      keyPrefix: "dk_live_001", lastUsedAt: "2026-10-25", createdAt: "2026-10-25" }] });
    const keyHtml = key.render(p);
    assert.match(keyHtml, /<bdi[^>]*dir="ltr"[^>]*>dk_live_001\.\.\.<\/bdi>/, "prefix and ellipsis have ordered isolation");
    assert.ok(keyHtml.includes('<pre dir="ltr"'), "code sample remains LTR");
    assert.ok(keyHtml.includes('Bearer dk_live_...'), "authentication sample bytes retained");
    const labels = (p.locale === "fa-IR" ? fa : en).SettingsApiKeys;
    assert.ok(key.controls.some(c => c.props["aria-label"] === labels.copyExample && typeof c.props.onClick === "function"), "existing copy callback retained");
  }
});

test("actual cost-center hierarchy uses logical indentation and retains exact code/raw field callbacks", () => {
  for (const p of presentations) {
    const page = loaded("cost-centers/page.tsx", { loading: false, costCenters: [
      { id: "p/001", code: "P/001", name: caller, parentId: null, isActive: true },
      { id: "c/001", code, name: caller, parentId: "p/001", isActive: true }], formCode: code, formName: caller });
    const html = page.render(p), labels = (p.locale === "fa-IR" ? fa : en).SettingsCostCenters;
    assert.ok(html.includes('padding-inline-start:24px') && !html.includes('padding-left:'), "hierarchy follows inline start");
    assert.ok(html.includes(`>${escape(code)}</bdi>`), "copyable hierarchy code is exact and isolated");
    const field = page.controls.find(c => c.props["aria-label"] === labels.code && typeof c.props.onChange === "function");
    assert.ok(field, "code field named"); assert.equal(field.props.dir, "ltr");
    (field.props.onChange as (e: unknown) => void)({ target: { value: "  RAW/002  " } });
    assert.deepEqual(page.updates.at(-1), ["formCode", "  RAW/002  "]);
    assert.ok(html.includes("rtl:rotate-180") && html.includes("text-end"), "hierarchy chevrons and actions use logical geometry");
  }
});

test("actual approval and bank controls keep operator IDs, ordered amounts and approver callbacks", () => {
  for (const p of presentations) {
    const approval = loaded("approval-workflows/page.tsx", { loading: false, name: caller,
      conditions: [{ field: "amount", operator: "gte", value: "000123" }], steps: [{ approverId: "u/001", isRequired: true }],
      members: [{ id: "m/001", userId: "u/001", user: { id: "u/001", name: caller, email } }] }, "ApprovalWorkflowsWorkspace");
    const html = approval.render(p), labels = (p.locale === "fa-IR" ? fa : en).SettingsApprovals;
    const operator = approval.controls.find(c => c.props.value === "gte" && typeof c.props.onValueChange === "function");
    assert.ok(operator, "operator control exists");
    (operator.props.onValueChange as (v: string) => void)("lt");
    const update = approval.updates.at(-1);
    assert.deepEqual(update, ["conditions", [{ field: "amount", operator: "lt", value: "000123" }]]);
    assert.ok(approval.controls.some(c => c.props["aria-label"] === labels.moveStepUp), "ordered step movement named");
    assert.ok(html.includes(`>${escape(caller)}</bdi>`), "approver caller label isolated");
    const bank = loaded("bank-rules/page.tsx", { loading: false, useSplits: true, splits: [{ accountId: "a/001", amountMinor: "4000000000000001" }],
      conditions: [{ field: "amount", op: "between", value: "-123,456" }], accounts: [{ id: "a/001", name: caller }] });
    const bankHtml = bank.render(p);
    assert.ok(!bankHtml.includes('class="col-span-2 '), "amount range does not create implicit narrow grid columns");
    const fixed = bank.controls.find(c => c.props.value === "4000000000000001");
    assert.ok(fixed, "canonical large minor-unit draft retained"); assert.equal(fixed.props.dir, "ltr");
    for (const value of ["-123", "456"]) {
      const bound = bank.controls.find(c => c.props.value === value);
      assert.ok(bound, "signed bound retained"); assert.equal(bound.props.dir, "ltr"); assert.equal(bound.props.step, "1");
    }
  }
});

test("actual webhook rows preserve full exact URLs/events and raw ordered endpoint edits", () => {
  const url = "https://example.test/" + "endpoint-".repeat(30) + "?id=001&next=ABC";
  for (const p of presentations) {
    const page = loaded("webhooks/page.tsx", { loading: false, webhooks: [{ id: "w/001", url, description: caller,
      events: ["invoice.created"], isActive: true }], formUrl: url, formDescription: caller, formEvents: ["invoice.created"] });
    const html = page.render(p), labels = (p.locale === "fa-IR" ? fa : en).SettingsWebhooks;
    assert.ok(html.includes(`>${escape(url)}</bdi>`), "full URL stays copyable and isolated");
    assert.match(html, /<bdi[^>]*dir="ltr"[^>]*>invoice\.created<\/bdi>/, "event token order preserved");
    const field = page.controls.find(c => c.props["aria-label"] === labels.endpointURL && typeof c.props.onChange === "function");
    assert.ok(field, "endpoint field named"); assert.equal(field.props.dir, "ltr");
    (field.props.onChange as (e: unknown) => void)({ target: { value: "  https://raw.test/a?b=002  " } });
    assert.deepEqual(page.updates.at(-1), ["formUrl", "  https://raw.test/a?b=002  "]);
    assert.ok(html.includes("text-start") && !html.includes("truncate"), "caller data wraps at logical start");
  }
});

test("actual template editor chooses the logical sheet edge while preview and saved output remain delegated", () => {
  for (const p of presentations) {
    const page = loaded("document-templates/page.tsx", { loading: false, templates: [], sheetOpen: true });
    page.render(p);
    assert.ok(page.controls.some(c => c.props.side === "end" && String(c.props.className).includes("sm:max-w-lg")),
      "template editor uses the shared direction-aware end edge");
  }
});

test("installed settings CSS supports logical timeline/indent geometry and resilient translated controls", async () => {
  const compiler = await compile("@theme { --spacing: 0.25rem; } @tailwind utilities;");
  const css = compiler.build(["start-2.5", "start-[12px]", "ps-8", "pe-3", "me-1.5", "text-start", "text-end", "flex-wrap",
    "h-auto", "min-h-8", "whitespace-normal", "[overflow-wrap:anywhere]", "data-[size=default]:h-auto",
    "*:data-[slot=select-value]:line-clamp-none", "rtl:rotate-180", "group-focus-within:opacity-100"]);
  for (const declaration of ["inset-inline-start:", "padding-inline-start:", "padding-inline-end:", "margin-inline-end:",
    "text-align: start", "text-align: end", "flex-wrap: wrap", "height: auto", "min-height:", "white-space: normal",
    "overflow-wrap: anywhere", "-webkit-line-clamp: unset", "rotate: 180deg", "focus-within"])
    assert.ok(css.includes(declaration), declaration);
});
