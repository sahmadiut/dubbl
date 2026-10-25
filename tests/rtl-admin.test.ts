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
const caller = "  \u0646\u0627\u0645 Caller <ACME/001> & " + "long-name-".repeat(25);
const email = "  member+001@example.test  ", slug = "  org-001/ABC  ";
const presentations = (["en-US", "fa-IR"] as const).flatMap(language =>
  (["latn", "arabext"] as const).map(numerals => resolvePresentation({ user: { language, numerals } })));
const escape = (s: string) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
type Props = Record<string, unknown>;
const require = createRequire(import.meta.url);
const CommonJsProvider = (require("../i18n/provider") as typeof Provider).PresentationProvider;

// Execute production JSX and its callbacks with real next-intl/providers and
// native controls. Hook state, IO, animation and portal measurement are controlled.
// Provider-specific subscription UI is unchanged and is not qualified here.
function loaded(file: string, states: Props = {}, component = "default", pathname = "/admin") {
  const source = readFileSync(file, "utf8"), ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const main = ast.statements.find(n => ts.isFunctionDeclaration(n) && (component === "default"
    ? n.modifiers?.some(m => m.kind === ts.SyntaxKind.DefaultKeyword) : n.name?.text === component));
  assert.ok(main, "requested administration component exists");
  const names: string[] = [];
  function hooks(n: ts.Node) {
    if (ts.isVariableDeclaration(n) && ts.isArrayBindingPattern(n.name) && n.initializer && ts.isCallExpression(n.initializer)
      && n.initializer.expression.getText(ast) === "useState") names.push(n.name.elements[0].getText(ast));
    ts.forEachChild(n, hooks);
  }
  hooks(main);
  const controls: { type: unknown; props: Props }[] = [], updates: unknown[][] = [], requests: { url: string; init?: RequestInit }[] = [];
  const navigation: unknown[][] = [];
  const capture = (create: typeof jsx.jsx) => (type: React.ElementType, props: Props, key?: string) => {
    controls.push({ type, props }); return create(type, props, key);
  };
  let index = 0;
  const compiled = { exports: {} as Record<string, React.ComponentType<Props>> }, localRequire = createRequire(resolve(file));
  const inline = ({ children }: { children?: React.ReactNode }) => h("div", null, children);
  const modules = new Map<string, unknown>();
  function portalModule(id: string) {
    if (!modules.has(id)) modules.set(id, new Proxy({}, { get: (_target, name) => {
      if (typeof name !== "string") return undefined;
      const wrapper = ({ children, id: controlId, "aria-label": label, dir, className }: {
        children?: React.ReactNode; id?: string; "aria-label"?: string; dir?: string; className?: string;
      }) => h(name.endsWith("Trigger") ? "button" : "div", { id: controlId, "aria-label": label, dir, className }, children);
      Object.defineProperty(wrapper, "name", { value: name }); return wrapper;
    } }));
    return modules.get(id);
  }
  const code = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function("require", "module", "exports", "fetch", code)((id: string) => {
    if (id === "react") return { ...React, useState: (initial: unknown) => {
      const key = names[index++]; return [key in states ? states[key] : typeof initial === "function" ? initial() : initial,
        (value: unknown) => updates.push([key, value])];
    }, useEffect: noop, use: () => ({ id: "org/001" }), useRef: (value: unknown) => ({ current: value }),
    useMemo: (fn: () => unknown) => fn(), useCallback: (fn: unknown) => fn };
    if (id === "react/jsx-runtime") return { ...jsx, jsx: capture(jsx.jsx), jsxs: capture(jsx.jsxs) };
    if (id === "next-intl") return intl;
    if (id.endsWith("/i18n/provider")) return Provider;
    if (id === "next/navigation") return { useRouter: () => ({ push: (v: unknown) => navigation.push(["push", v]),
      back: () => navigation.push(["back"]) }), usePathname: () => pathname };
    if (id === "next/image") return { __esModule: true, default: () => null };
    if (id.endsWith("/use-debounce")) return { useDebounce: (v: unknown) => v };
    if (id.endsWith("/content-reveal")) return { ContentReveal: inline };
    if (id.endsWith("/blur-reveal")) return { BlurReveal: inline };
    if (id.endsWith("/theme-toggle")) return { ThemeToggle: () => null };
    if (id.endsWith("/shared/logo")) return { Logo: () => null };
    if (id.endsWith("/subscription-description")) return { SubscriptionDescription: () => null };
    if (id === "sonner") return { toast: { success: noop, error: noop } };
    if (["/ui/select", "/ui/dropdown-menu", "/ui/dialog", "/ui/tabs"].some(s => id.endsWith(s))) return portalModule(id);
    return localRequire(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  }, compiled, compiled.exports, async (url: string, init?: RequestInit) => {
    requests.push({ url, init }); return { ok: true, json: async () => ({ html: "<p>raw <strong>bytes</strong></p>" }) };
  });
  return { controls, updates, requests, navigation, render(p: typeof presentations[number], props: Props = {}) {
    index = 0; controls.length = 0;
    const providerProps = { presentation: p, messages: p.locale === "fa-IR" ? fa : en, now: new Date("2026-10-25T00:00:00Z") };
    return renderToStaticMarkup(h(Provider.PresentationProvider, providerProps, h(CommonJsProvider, providerProps,
      h(compiled.exports[component], props))));
  } };
}

test("actual admin users isolate long caller/email data and retain exact privilege mutation callbacks", async () => {
  for (const p of presentations) {
    const page = loaded("app/(admin)/admin/users/page.tsx", { loading: false, platformUsers: [{ id: "user/001",
      name: caller, email, isSiteAdmin: false, orgCount: 3, createdAt: "2026-10-25T00:00:00Z" }] });
    const html = page.render(p), labels = (p.locale === "fa-IR" ? fa : en).Admin;
    assert.match(html, new RegExp(`<bdi[^>]*dir="auto"[^>]*>${escape(caller)}</bdi>`), "caller name is escaped and independently isolated");
    assert.ok(html.includes(`>${escape(email)}</bdi>`), "email stays copyable without trimming");
    assert.ok(!html.includes("truncate"), "long caller data can wrap");
    const menu = page.controls.find(c => c.props["aria-label"] === labels.userActions);
    assert.ok(menu, "row action has a translated accessible name");
    const grant = page.controls.find(c => (c.type as { name?: string })?.name === "DropdownMenuItem");
    assert.ok(grant && typeof grant.props.onClick === "function", "actual privilege callback exists");
    await (grant.props.onClick as () => Promise<void>)();
    assert.deepEqual(page.requests, [{ url: "/api/v1/admin/users/user/001", init: {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: '{"isSiteAdmin":true}' } }], "raw user ID and mutation contract are unchanged");
    const sort = page.controls.find(c => c.props["aria-label"] === labels.sortBy);
    assert.ok(sort && String(sort.props.className).includes("line-clamp-none"), "named sort control overrides inherited clamping");
  }
});

test("actual organization list preserves full identifiers, canonical routes and raw filter edits", () => {
  for (const p of presentations) {
    const page = loaded("app/(admin)/admin/organizations/page.tsx", { loading: false, orgs: [{ id: "org/001", name: caller,
      slug, logo: null, defaultCurrency: "IRR", memberCount: 7, plan: "free", createdAt: "2026-10-25T00:00:00Z" }] });
    const html = page.render(p), labels = (p.locale === "fa-IR" ? fa : en).Admin;
    assert.ok(html.includes(`>${escape(caller)}</bdi>`) && html.includes(`>${escape(slug)}</bdi>`), "caller and technical metadata are independently isolated");
    assert.ok(html.includes('href="/admin/organizations/org/001"'), "canonical organization destination is retained");
    assert.ok(html.includes("rtl:rotate-180") && html.includes("ms-auto"), "row direction and trailing count use logical geometry");
    const plan = page.controls.find(c => c.props["aria-label"] === labels.plan);
    assert.ok(plan, "plan selector has a native accessible name");
    const select = page.controls.find(c => c.props.value === "all" && typeof c.props.onValueChange === "function");
    assert.ok(select, "actual filter callback exists");
    (select.props.onValueChange as (v: string) => void)("pro");
    assert.deepEqual(page.updates.at(-1), ["planFilter", "pro"], "machine filter enum is unchanged");
  }
});

test("actual organization header/member/notes surfaces isolate caller data and retain unmodified notes", () => {
  for (const p of presentations) {
    const page = loaded("app/(admin)/admin/organizations/[id]/page.tsx", { loading: false,
      org: { id: "org/001", name: caller, slug, logo: null, defaultCurrency: "KWD", createdAt: "2026-10-25T00:00:00Z" },
      sub: { plan: "free", status: "active", managedBy: "manual", seatCount: 1 }, members: [{ id: "member/001", userName: caller,
        userEmail: email, role: "custom/role", createdAt: "2026-10-25T00:00:00Z" }], editNotes: caller });
    const html = page.render(p), labels = (p.locale === "fa-IR" ? fa : en).Admin;
    assert.ok(html.includes(`>${escape(slug)}</bdi>`) && html.includes(`>${escape(email)}</bdi>`), "full technical values stay ordered");
    assert.ok(html.includes('>custom/role</bdi>'), "unknown custom role text is escaped and isolated");
    const notes = page.controls.find(c => c.props["aria-label"] === labels.notes && typeof c.props.onChange === "function");
    assert.ok(notes, "notes textarea has a translated native name");
    assert.equal(notes.props.dir, "auto", "caller prose chooses its own paragraph direction");
    assert.equal(notes.props.value, caller, "initial note is exact");
    (notes.props.onChange as (e: unknown) => void)({ target: { value: "  raw <note>/001  " } });
    assert.deepEqual(page.updates.slice(-2), [["editNotes", "  raw <note>/001  "], ["dirty", true]], "note edits retain every character and dirty-state behavior");
  }
});

test("actual registration/domain controls associate labels and preserve raw settings operations", async () => {
  for (const p of presentations) {
    const page = loaded("components/admin/site-settings-form.tsx", {}, "SiteSettingsForm");
    const settings = { registration_mode: "invite_only", allowed_email_domains: "  example.test, domain-001.test  ",
      allow_user_org_creation: "true", self_hosted_unlimited: "auto" };
    const saves: unknown[] = [], edits: unknown[] = [];
    const html = page.render(p, { settings, stripeConfigured: false, saving: true,
      save: async (v: unknown) => { saves.push(v); }, onSettingsChange: (v: unknown) => edits.push(v) });
    const labels = (p.locale === "fa-IR" ? fa : en).Admin;
    const domain = page.controls.find(c => c.props["aria-label"] === labels.allowedEmailDomains);
    assert.ok(domain, "domain field is named");
    assert.equal(domain.props.dir, "ltr", "domain list keeps technical order");
    assert.ok(html.includes(`for="${domain.props.id}"`), "visible domain label references the textarea");
    (domain.props.onChange as (e: unknown) => void)({ target: { value: "  raw+001.test, \u0645\u062b\u0627\u0644.test  " } });
    assert.deepEqual(edits, [{ ...settings, allowed_email_domains: "  raw+001.test, \u0645\u062b\u0627\u0644.test  " }], "raw settings edit is unchanged");
    await (domain.props.onBlur as () => Promise<void>)();
    assert.deepEqual(saves, [{ allowed_email_domains: settings.allowed_email_domains }], "original blur persistence contract is retained");
    const registration = page.controls.find(c => c.props.id === "admin-registration-mode" && c.props["aria-label"]);
    assert.ok(registration && html.includes('for="admin-registration-mode"'), "registration selector is associated");
    assert.ok(String(registration.props.className).includes("data-[size=default]:h-auto"), "translated mode selection grows beyond fixed height");
    assert.ok(html.includes("bottom-4 end-4"), "saving notice uses the logical edge");
  }
});

test("actual email preview retains exact template selection and saved iframe bytes", async () => {
  for (const p of presentations) {
    const rawHtml = '<p dir="rtl">raw & exact <strong>content</strong></p>';
    const page = loaded("app/(admin)/admin/email-preview/page.tsx", { loadingTemplates: false, selectedTemplate: "custom/001",
      templates: [{ id: "custom/001", name: caller }], emailHtml: rawHtml });
    const html = page.render(p), labels = (p.locale === "fa-IR" ? fa : en).Admin;
    assert.ok(html.includes(`>${escape(caller)}</bdi>`), "custom template name is fully escaped and isolated");
    const iframe = page.controls.find(c => c.type === "iframe");
    assert.ok(iframe, "actual iframe is rendered");
    assert.equal(iframe.props.srcDoc, rawHtml, "preview HTML bytes remain unchanged");
    assert.equal(iframe.props.sandbox, "allow-same-origin", "sandbox contract is retained");
    const trigger = page.controls.find(c => c.props["aria-label"] === labels.selectATemplate);
    assert.ok(trigger && String(trigger.props.className).includes("whitespace-normal"), "template selector is named and can grow");
    const selector = page.controls.find(c => c.props.value === "custom/001" && typeof c.props.onValueChange === "function");
    assert.ok(selector, "actual template callback exists");
    await (selector.props.onValueChange as (v: string) => Promise<void>)("custom/002");
    assert.equal(page.requests[0].url, "/api/v1/admin/email-preview?template=custom/002", "template ID and request destination are exact");
  }
});

test("actual admin mobile chrome grows in flow while permission, routes and detail/back behavior remain exact", () => {
  for (const p of presentations) {
    const page = loaded("components/admin/navigation.tsx", {}, "AdminNavigation");
    const html = page.render(p, { allowed: true, children: "Sensitive child" });
    assert.ok(html.includes("sticky top-0 z-50 md:hidden") && html.includes("min-h-14 flex-wrap"), "mobile chrome shares one growing in-flow boundary");
    assert.ok(!html.includes("mt-24") && !html.includes("mt-14") && !html.includes("fixed inset-x-0"), "main offset is independent of translated header height");
    assert.ok(html.indexOf('href="/admin/users"') < html.indexOf('href="/admin/organizations"'), "semantic navigation order is retained");
    assert.ok(html.indexOf("<aside") < html.indexOf("Sensitive child"), "navigation precedes the main body");
    const denied = page.render(p, { allowed: false, children: "Sensitive child" });
    assert.ok(!denied.includes("Sensitive child") && !denied.includes('href="/admin/users"'), "access-denied branch never renders protected children");
    const detail = loaded("components/admin/navigation.tsx", {}, "AdminNavigation", "/admin/organizations/org-001");
    const detailHtml = detail.render(p, { allowed: true, children: "Detail body" });
    assert.ok(!detailHtml.includes("<nav"), "detail branching is unchanged");
    const back = detail.controls.find(c => typeof c.props.onClick === "function");
    assert.ok(back, "back control exists"); (back.props.onClick as () => void)();
    assert.deepEqual(detail.navigation, [["back"]], "back preserves router history behavior");
  }
});

test("actual dashboard metrics preserve count formatting inside independent number groups", () => {
  for (const p of presentations) {
    const page = loaded("app/(admin)/admin/page.tsx", { loading: false, stats: { totalUsers: 123456, totalOrgs: 12,
      totalMembers: 19, recentUsers: 3, recentOrgs: 2, enterpriseOrgs: 4, planBreakdown: [] } });
    const html = page.render(p);
    assert.match(html, /<bdi[^>]*dir="ltr"[^>]*>123,456<\/bdi>/, "existing host count formatting remains exact and isolated");
    assert.ok(html.includes("grid-cols-1 sm:grid-cols-2 md:grid-cols-4"), "metric cards can stack at narrow widths");
    assert.deepEqual(page.updates, [], "render does not adopt or mutate data");
  }
});

test("installed admin CSS supports logical metadata/actions and growing native controls", async () => {
  const compiler = await compile("@theme { --spacing: 0.25rem; --breakpoint-md: 48rem; } @tailwind utilities;");
  const css = compiler.build(["end-4", "ms-auto", "me-2", "sticky", "top-0", "min-h-14", "flex-wrap", "md:flex-row",
    "h-auto", "min-h-8", "whitespace-normal", "[overflow-wrap:anywhere]", "data-[size=default]:h-auto",
    "data-[size=sm]:h-auto", "*:data-[slot=select-value]:line-clamp-none", "rtl:rotate-180"]);
  for (const declaration of ["inset-inline-end:", "margin-inline-start:", "margin-inline-end:", "position: sticky",
    "flex-wrap: wrap", "height: auto", "min-height:", "white-space: normal", "overflow-wrap: anywhere",
    "-webkit-line-clamp: unset", "rotate: 180deg", "flex-direction: row"])
    assert.ok(css.includes(declaration), declaration);
});
