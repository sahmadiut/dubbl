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
import * as overview from "../i18n/project-overview-presentation";
import { displayMoney as contactMoneyDisplay } from "../lib/money/contact-dashboard-ui";
import { payrollMoneyDisplay } from "../lib/money/payroll-display";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const h = React.createElement, noop = () => {};
const caller = "  نام Caller <ACME/001> & " + "long-name-".repeat(35);
const email = "  person+001@example.test  ", phone = "  +98-001/ABC  ";
const amount = 4000000000000001;
const contact = { id: "contact/001", name: caller, email, phone, taxNumber: "  TAX-001/ABC  ", type: "both",
  paymentTermsDays: 30, creditLimit: BigInt(amount), currencyCode: "KWD", owesYou: BigInt(amount), youOwe: 0n, overdue: 0n,
  isTaxExempt: false, is1099Vendor: false, createdAt: "2026-10-25T00:00:00Z", people: [], notes: caller };
const presentations = (["en-US", "fa-IR"] as const).flatMap(language =>
  (["latn", "arabext"] as const).map(numerals => resolvePresentation({ user: { language, numerals } })));
const escape = (s: string) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
type Props = Record<string, unknown>;
const require = createRequire(import.meta.url);
const CommonJsProvider = (require("../i18n/provider") as typeof Provider).PresentationProvider;

// Production JSX, real next-intl/provider, native inputs, table and money helpers.
// State, IO and unowned portal/chart boundaries are controlled; no DB or browser.
function loaded(relative: string, states: Props = {}, context: Props = {}) {
  const file = "app/(dashboard)/" + relative, source = readFileSync(file, "utf8");
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const main = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.modifiers?.some(m => m.kind === ts.SyntaxKind.DefaultKeyword));
  assert.ok(main, "RTL relationship assertion at line 40");
  const names: string[] = [];
  function hooks(n: ts.Node) {
    if (ts.isVariableDeclaration(n) && ts.isArrayBindingPattern(n.name) && n.initializer && ts.isCallExpression(n.initializer)
      && n.initializer.expression.getText(ast) === "useState") names.push(n.name.elements[0].getText(ast));
    ts.forEachChild(n, hooks);
  }
  hooks(main);
  const controls: { type: unknown; props: Props }[] = [], updates: unknown[][] = [], events: unknown[] = [];
  const capture = (create: typeof jsx.jsx) => (type: React.ElementType, props: Props, key?: string) => {
    controls.push({ type, props }); return create(type, props, key);
  };
  let index = 0;
  const compiled = { exports: {} as Record<string, React.ComponentType> }, localRequire = createRequire(resolve(file));
  const inline = ({ children }: { children: React.ReactNode }) => h("div", null, children);
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function("require", "module", "exports", code)((id: string) => {
    if (id === "react") return { ...React, useState: (initial: unknown) => {
      const key = names[index++]; return [key in states ? states[key] : typeof initial === "function" ? initial() : initial,
        (value: unknown) => updates.push([key, value])];
    }, useEffect: noop, useRef: (value: unknown) => ({ current: value }), useMemo: (fn: () => unknown) => fn(), useCallback: (fn: unknown) => fn };
    if (id === "react/jsx-runtime") return { ...jsx, jsx: capture(jsx.jsx), jsxs: capture(jsx.jsxs) };
    if (id === "next-intl") return intl;
    if (id.endsWith("/i18n/provider")) return Provider;
    if (id.endsWith("/project-overview-presentation")) return overview;
    if (id === "next/navigation") return { useParams: () => ({ id: contact.id }), usePathname: () => "/contacts",
      useRouter: () => ({ push: (url: unknown) => events.push(url) }) };
    if (id === "./layout" && relative.startsWith("contacts/")) return { getOrgId: () => "org/001", useContactContext: () => ({
      contact, formType: "both", formTaxExempt: false, form1099Vendor: false, formCreditLimit: "40000000000000.01",
      formCurrencyCode: "KWD", formRevenueAccountId: "", formExpenseAccountId: "", formTaxRateId: "", saving: false,
      ...Object.fromEntries(["setContact", "confirm", "setFormType", "setFormTaxExempt", "setForm1099Vendor", "setFormCreditLimit",
        "setFormCurrencyCode", "setFormRevenueAccountId", "setFormExpenseAccountId", "setFormTaxRateId", "setSaving"].map(key =>
        [key, (v: unknown) => updates.push([key, v])])), ...context }) };
    if (id === "../project-context") return { useProject: () => ({ project: { currency: "KWD", timeEntries: [], tasks: [],
      members: [], runningTimers: [], ...context }, orgId: "org/001", projectId: "project/001", refresh: noop }) };
    if (id.endsWith("/use-document-title") || id.endsWith("/topbar")) return { useDocumentTitle: noop, useTopbarAction: noop };
    if (id.endsWith("/use-debounce")) return { useDebounce: (v: unknown) => v };
    if (id.endsWith("/use-confirm")) return { useConfirm: () => ({ confirm: noop, dialog: null }) };
    if (id.endsWith("/create-drawer")) return { useCreateDrawer: () => ({ open: (...args: unknown[]) => events.push(args) }) };
    if (id.endsWith("/ui/currency-select")) return { CurrencySelect: () => null };
    if (id === "recharts") return new Proxy({}, { get: () => inline });
    if (["/ui/dialog", "/ui/sheet", "/ui/select", "/ui/dropdown-menu"].some(s => id.endsWith(s))) return new Proxy({}, { get: () => inline });
    return localRequire(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  }, compiled, compiled.exports);
  return { controls, updates, events, render(p: typeof presentations[number]) {
    index = 0; controls.length = 0;
    const props = { presentation: p, messages: p.locale === "fa-IR" ? fa : en, now: new Date("2026-10-25T00:00:00Z") };
    return renderToStaticMarkup(h(Provider.PresentationProvider, props, h(CommonJsProvider, props, h(compiled.exports.default))));
  } };
}

test("actual contact rows isolate long names, exact technical values and bigint money in all four presentations", () => {
  for (const p of presentations) {
    const page = loaded("contacts/page.tsx", { contacts: [contact], loading: false, hasMore: false });
    const html = page.render(p);
    assert.ok(html.includes(`>${escape(caller)}</bdi>`), "RTL relationship assertion at line 96");
    const isolated = [...html.matchAll(/<bdi\b([^>]*)>(.*?)<\/bdi>/gs)];
    for (const value of [email, phone]) assert.ok(isolated.some(m => m[1].includes('dir="ltr"') && m[2] === escape(value)), "RTL relationship assertion at line 99");
    assert.ok(html.includes(escape(contactMoneyDisplay(BigInt(amount), "KWD", p))), "RTL relationship assertion at line 99");
    assert.ok(html.includes("text-end") && html.includes("[overflow-wrap:anywhere]"), "RTL relationship assertion at line 100");
    const table = page.controls.find(c => Array.isArray(c.props.data) && c.props.data[0] === contact);
    assert.ok(table, "RTL relationship assertion at line 102"); (table.props.onRowClick as (r: unknown) => void)(contact);
    assert.ok(page.events.includes("/contacts/contact/001"), "RTL relationship assertion at line 103");
    const search = page.controls.find(c => c.props.placeholder === (p.locale === "fa-IR" ? fa : en).Contacts.search);
    assert.ok(search, "RTL relationship assertion at line 105"); assert.equal(search.props.dir, "auto"); assert.equal(search.props["aria-label"], search.props.placeholder);
    assert.equal(contact.creditLimit, BigInt(amount));
  }
});

test("actual contact form labels and directional fields retain raw caller/identifier edits", () => {
  for (const p of presentations) {
    const page = loaded("contacts/[id]/page.tsx"), html = page.render(p), labels = (p.locale === "fa-IR" ? fa : en).ContactDetails;
    for (const [name, label, value, dir] of [["name", labels.name, caller, "auto"], ["email", labels.email, email, "ltr"],
      ["phone", labels.phone, phone, "ltr"], ["taxNumber", labels.taxNumber, contact.taxNumber, "ltr"]]) {
      const field = page.controls.find(c => c.props.name === name);
      assert.ok(field, "RTL relationship assertion at line 116"); assert.equal(field.props.defaultValue, value); assert.equal(field.props.dir, dir);
      assert.equal(field.props["aria-label"], label); assert.ok(html.includes(`for="${field.props.id}"`), "RTL relationship assertion at line 118");
    }
    const money = page.controls.find(c => c.props["aria-label"] === labels.creditLimit && typeof c.props.onChange === "function");
    assert.ok(money, "RTL relationship assertion at line 120"); (money.props.onChange as (v: string) => void)("000123.450");
    assert.deepEqual(page.updates.at(-1), ["setFormCreditLimit", "000123.450"]);
    assert.equal(contact.taxNumber, "  TAX-001/ABC  ");
  }
});

test("actual CRM cards isolate each caller and exact amount and retain navigation/filter values", () => {
  const deal = { id: "deal/001", title: caller, stageId: "lead", currency: "KWD", valueCents: amount, probability: 33,
    source: "cold_outreach", expectedCloseDate: "2026-10-25", createdAt: "2026-10-25T00:00:00Z", wonAt: null, lostAt: null,
    contact: { name: caller }, assignedUser: { name: caller } };
  const pipeline = { id: "pipe/001", name: caller, stages: [{ id: "lead", name: caller, color: "#10b981" }], isDefault: true };
  const summary = { currency: "KWD", activeCount: 1, activeValue: amount, wonCount: 1, wonValue: amount,
    totalDeals: 2, stageDistribution: { lead: { count: 1, value: amount } } };
  for (const p of presentations) {
    const page = loaded("crm/page.tsx", { initialLoading: false, pipelinesReady: true, pipelines: [pipeline], activePipeline: pipeline,
      deals: [deal], summary, total: 1, hasMore: false }), html = page.render(p);
    assert.ok(html.includes(`>${escape(caller)}</bdi>`), "RTL relationship assertion at line 136");
    assert.ok(html.includes(escape(payrollMoneyDisplay(amount, "KWD", p))), "RTL relationship assertion at line 137");
    assert.match(html, /<bdi[^>]*dir="ltr"[^>]*>33%<\/bdi>/);
    const card = page.controls.find(c => c.type === "button" && String(c.props.className).includes("w-full rounded-xl"));
    assert.ok(card, "RTL relationship assertion at line 140"); (card.props.onClick as () => void)(); assert.ok(page.events.includes("/crm/deals/deal/001"), "RTL relationship assertion at line 141");
    const sort = page.controls.find(c => c.props["aria-label"] === (p.locale === "fa-IR" ? fa : en).CrmPipeline.sortBy);
    assert.ok(sort && String(sort.props.className).includes("line-clamp-none"), "RTL relationship assertion at line 142");
    assert.equal(deal.source, "cold_outreach");
  }
});

test("actual project timer preserves H:M:S order and native fractional-hour/description callbacks", () => {
  for (const p of presentations) {
    const page = loaded("projects/[id]/time/page.tsx", { drawerMode: "add", entryHours: "1.75", entryDesc: caller,
      timerSeconds: 3723, timerData: { startedAt: "2026-10-25T00:00:00Z" } }), html = page.render(p);
    assert.match(html, /dir="ltr" class="flex items-baseline gap-1 select-none \[unicode-bidi:isolate\]"/);
    const digits = new Intl.NumberFormat(p.locale, { numberingSystem: p.numerals, minimumIntegerDigits: 2, useGrouping: false });
    const hoursPosition = html.indexOf(`>${digits.format(1)}</span>`), minutesPosition = html.indexOf(`>${digits.format(2)}</span>`), secondsPosition = html.indexOf(`>${digits.format(3)}</span>`);
    assert.ok(hoursPosition >= 0 && hoursPosition < minutesPosition && minutesPosition < secondsPosition, "RTL relationship assertion at line 153");
    const labels = (p.locale === "fa-IR" ? fa : en).ProjectTime;
    const hours = page.controls.find(c => c.props.type === "number" && c.props.step === "0.25");
    assert.ok(hours, "RTL relationship assertion at line 156"); assert.equal(hours.props.dir, "ltr"); assert.equal(hours.props["aria-label"], labels.hours);
    assert.equal(hours.props.value, "1.75"); assert.ok(html.includes(`for="${hours.props.id}"`), "RTL relationship assertion at line 158");
    (hours.props.onChange as (e: unknown) => void)({ target: { value: "2.25" } });
    assert.deepEqual(page.updates.slice(-2), [["entryHours", "2.25"], ["entryMinutes", ""]]);
    const desc = page.controls.find(c => c.props.value === caller && typeof c.props.onChange === "function");
    assert.ok(desc, "RTL relationship assertion at line 161"); assert.equal(desc.props.dir, "auto");
    (desc.props.onChange as (e: unknown) => void)({ target: { value: "  متن New & <1>  " } });
    assert.deepEqual(page.updates.at(-1), ["entryDesc", "  متن New & <1>  "]);
  }
});

test("actual team membership rows isolate caller names/emails and retain raw search callbacks", () => {
  for (const p of presentations) {
    const page = loaded("teams/members/page.tsx", { loading: false, members: [{ id: "member/001", name: caller, email,
      teams: [{ id: "team/001", name: caller, color: "#10b981" }] }], search: "Caller" }), html = page.render(p);
    assert.ok(html.includes(`>${escape(caller)}</bdi>`), "RTL relationship assertion at line 171");
    assert.ok(html.includes(`>${escape(email)}</bdi>`), "RTL relationship assertion at line 172"); assert.ok(!html.includes("truncate"), "RTL relationship assertion at line 173");
    const labels = (p.locale === "fa-IR" ? fa : en).Teams;
    const search = page.controls.find(c => c.props.placeholder === labels.searchByNameOrEmail);
    assert.ok(search, "RTL relationship assertion at line 175"); assert.equal(search.props["aria-label"], labels.searchByNameOrEmail);
    (search.props.onChange as (e: unknown) => void)({ target: { value: "  نام Raw/001  " } });
    assert.deepEqual(page.updates.at(-1), ["search", "  نام Raw/001  "]);
    assert.ok(page.controls.some(c => c.type === "button" && c.props["aria-label"] === labels.clearSearch), "RTL relationship assertion at line 178");
    assert.ok(html.includes("flex-wrap"), "RTL relationship assertion at line 179");
  }
});

test("actual team cards keep exact IDs and accessible sorting while long caller descriptions wrap", () => {
  for (const p of presentations) {
    const page = loaded("teams/page.tsx", { loading: false, teams: [{ id: "team/001", name: caller,
      description: caller, color: "#10b981", memberCount: 1, members: [{ id: "member/001", name: caller }] }] });
    const html = page.render(p), labels = (p.locale === "fa-IR" ? fa : en).Teams;
    assert.ok(html.includes(`>${escape(caller)}</bdi>`), "RTL relationship assertion at line 188"); assert.ok(html.includes("text-start"), "RTL relationship assertion at line 189");
    const sort = page.controls.find(c => c.props["aria-label"] === labels.sortBy);
    assert.ok(sort, "RTL relationship assertion at line 190"); assert.ok(String(sort.props.className).includes("line-clamp-none"), "RTL relationship assertion at line 191");
    const card = page.controls.find(c => typeof c.props.onClick === "function" && String(c.props.className).includes("group relative rounded-xl"));
    assert.ok(card, "RTL relationship assertion at line 192"); (card.props.onClick as () => void)(); assert.ok(page.events.includes("/teams/team/001"), "RTL relationship assertion at line 193");
  }
});

test("installed relationship CSS supports logical geometry, wrapping controls and select overrides", async () => {
  const compiler = await compile("@theme { --spacing: 0.25rem; } @tailwind utilities;");
  const css = compiler.build(["start-3", "end-2.5", "ps-9", "me-1.5", "text-start", "text-end", "flex-wrap", "h-auto", "min-h-8",
    "whitespace-normal", "[overflow-wrap:anywhere]", "data-[size=default]:h-auto", "*:data-[slot=select-value]:line-clamp-none", "rtl:rotate-180"]);
  for (const declaration of ["inset-inline-start:", "inset-inline-end:", "padding-inline-start:", "margin-inline-end:", "text-align: start",
    "text-align: end", "flex-wrap: wrap", "height: auto", "min-height:", "white-space: normal", "overflow-wrap: anywhere", "-webkit-line-clamp: unset", "rotate: 180deg"])
    assert.ok(css.includes(declaration), declaration);
});
