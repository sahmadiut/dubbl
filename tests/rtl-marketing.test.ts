import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import * as React from "react";
import * as jsx from "react/jsx-runtime";
import * as intl from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { compile } from "tailwindcss";
import * as Provider from "../i18n/provider";
import { resolvePresentation } from "../i18n/locale";
import { LegalPageLayout } from "../components/legal/legal-page-layout";
import { ThemeOptions } from "../components/shared/theme-toggle";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const h = React.createElement;
type Props = Record<string, unknown>;
const require = createRequire(import.meta.url);
const CjsProvider = (require("../i18n/provider") as typeof Provider).PresentationProvider;
const presentations = (["en-US", "fa-IR"] as const).flatMap(language =>
  (["latn", "arabext"] as const).map(numerals => resolvePresentation({ user: { language, numerals } })));
const caller = "\u0634\u0631\u06a9\u062a <Caller/001> & " + "long-word-".repeat(20);
const escape = (value: string) => renderToStaticMarkup(h(React.Fragment, null, value));
function render(node: React.ReactNode, p: typeof presentations[number]) {
  const props = { presentation: p, messages: p.locale === "fa-IR" ? fa : en, now: new Date("2026-10-25T00:00:00Z") };
  return renderToStaticMarkup(h(Provider.PresentationProvider, props, h(CjsProvider, props, node)));
}

// Execute real production JSX and callbacks. Request IO/animation visibility and
// hook state are deterministic; these checks do not claim mounted browser QA.
function loaded(file: string, component: string, states: unknown[] = []) {
  const local = createRequire(resolve(file));
  const controls: Array<{ type: React.ElementType; props: Props }> = [], updates: unknown[][] = [], scrolls: unknown[][] = [];
  let index = 0;
  const capture = (create: typeof jsx.jsx) => (type: React.ElementType, props: Props, key?: string) => {
    controls.push({ type, props }); return create(type, props, key);
  };
  const mod = { exports: {} as Record<string, React.ComponentType<Props>> };
  const code = ts.transpileModule(readFileSync(file, "utf8") + `\nexport { ${component} };`, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  new Function("require", "module", "exports", "document", code)((id: string) => {
    if (id === "react") return { ...React, useEffect: () => {}, useState: (value: unknown) => {
      const slot = index++; return [slot < states.length ? states[slot] : value, (v: unknown) => updates.push([slot, v])];
    } };
    if (id === "react/jsx-runtime") return { ...jsx, jsx: capture(jsx.jsx), jsxs: capture(jsx.jsxs) };
    if (id === "next-intl") return intl;
    if (id.endsWith("/i18n/provider")) return Provider;
    if (id === "./use-landing-activity") return { useLandingActivity: () => ({ ref: { current: null }, isActive: true }) };
    return local(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  }, mod, mod.exports, { getElementById: (id: string) => ({ scrollIntoView: (options: unknown) => scrolls.push([id, options]) }) });
  return { controls, updates, scrolls, render(p: typeof presentations[number], props: Props = {}) {
    index = 0; controls.length = 0;
    return render(h(mod.exports[component], props), p);
  } };
}

test("actual legal layout isolates caller headings/dates and uses logical wrapping content tracks", () => {
  for (const p of presentations) {
    const html = render(h(LegalPageLayout, { badge: caller, title: caller, subtitle: caller, lastUpdated: "2 March 2026",
      sections: [{ id: "section/001", title: caller, content: h("ul", null, h("li", null, caller)) }] }), p);
    assert.ok(html.includes(`>${escape(caller)}</bdi>`), "section heading is escaped and isolated");
    assert.ok(html.includes('dir="auto"') && html.includes('>2 March 2026</bdi>'), "date interpolation remains exact and isolated");
    assert.ok(html.includes("minmax(0,1fr)") && html.includes("[&amp;_ul]:ms-5"), "content track shrinks and list indentation follows inline start");
    assert.ok(!html.includes("[&amp;_ul]:ml-5"), "physical list margin removed");
  }
});

test("actual legal table-of-contents preserves exact IDs, mobile state and scroll callbacks", () => {
  for (const p of presentations) {
    const page = loaded("components/legal/legal-toc.tsx", "LegalToc", ["exact/001", true]);
    const html = page.render(p, { items: [{ id: "exact/001", title: caller }] });
    assert.ok(html.includes('aria-controls="legal-mobile-toc"') && html.includes('aria-expanded="true"'), "mobile disclosure exposes state and target");
    assert.ok(html.includes("border-s-2") && html.includes("ps-4") && html.includes("text-start"), "active track and wrapping labels use logical geometry");
    assert.ok(html.includes(`>${escape(caller)}</bdi>`), "long caller title remains complete");
    const entries = page.controls.filter(c => c.type === "button" && !c.props["aria-controls"]);
    assert.equal(entries.length, 2, "desktop and open mobile entries");
    entries.forEach(c => (c.props.onClick as () => void)());
    assert.deepEqual(page.scrolls, [["exact/001", { behavior: "smooth" }], ["exact/001", { behavior: "smooth" }]], "exact destination and smooth behavior retained");
    assert.deepEqual(page.updates.at(-1), [1, false], "entry closes mobile disclosure");
  }
});

test("actual pricing selector mirrors only its highlight and retains canonical interval callbacks/prices", () => {
  for (const p of presentations) for (const interval of ["monthly", "annual"]) {
    const page = loaded("app/(landing)/pricing/page.tsx", "PricingPage", [interval]);
    const html = page.render(p);
    const expected = interval === "monthly" ? (p.locale === "fa-IR" ? -4 : 4)
      : p.locale === "fa-IR" ? "calc(-100% - 4px)" : "calc(100% + 4px)";
    assert.ok(page.controls.some(c => String(c.props.className).includes("start-0") && (c.props.animate as { x?: unknown })?.x === expected), "highlight follows language direction independently of numerals");
    const buttons = page.controls.filter(c => c.type === "button" && typeof c.props["aria-pressed"] === "boolean");
    assert.deepEqual(buttons.map(c => c.props["aria-pressed"]), [interval === "monthly", interval === "annual"], "selection state preserved");
    buttons.forEach(c => (c.props.onClick as () => void)());
    assert.deepEqual(page.updates, [[0, "monthly"], [0, "annual"]], "canonical machine interval values unchanged");
    assert.ok(html.includes('/sign-up?plan=pro') && html.includes(interval === "monthly" ? "$12" : "$10"), "plan destination and exact price unchanged");
    assert.ok(html.includes("overflow-x-auto") && html.includes("min-w-[32rem]"), "comparison table scrolls rather than clipping on narrow screens");
  }
});

test("actual demo money and ticker technical fragments preserve sign/code order without value mutation", () => {
  for (const p of presentations) {
    const demo = loaded("components/landing/hero.tsx", "DataVisuals");
    const html = demo.render(p);
    assert.match(html, /<bdi[^>]*dir="ltr"[^>]*>[^<]*12,500<\/bdi>/, "signed authored amount stays in one LTR group");
    assert.match(html, /<bdi[^>]*dir="ltr"[^>]*>INV-012<\/bdi>/, "document identifier retains exact order");
    assert.match(html, /<bdi[^>]*dir="ltr"[^>]*>JE-047<\/bdi>/, "scattered demo identifier is locally isolated");
    const ticker = loaded("components/landing/hero.tsx", "LiveTicker").render(p);
    for (const value of ["INV-048", "JE-102", "Dec 2025", "POST /v1/transactions"])
      assert.ok(ticker.includes(`>${value}</bdi>`), "ticker independently isolates " + value);
    assert.ok(!/[\u200e\u200f\u2066-\u2069]/u.test(html + ticker), "no directional characters inserted into copyable values");
  }
});

test("actual terminal/SDK blocks retain literal bytes inside explicit code direction boundaries", () => {
  for (const p of presentations) {
    for (const [file, component, snippets] of [
      ["components/landing/open-source.tsx", "TerminalBlock", ["git clone https://github.com/dubbl-org/dubbl.git", "docker compose up -d", "http://localhost:3000"]],
      ["components/landing/testimonials.tsx", "SDKCard", ["npm install @dubbl/sdk", "@dubbl/sdk"]],
      ["components/landing/testimonials.tsx", "APICodeCard", ["// Fetch recent transactions", "e.amount"]],
    ] as const) {
      const html = loaded(file, component).render(p);
      assert.match(html, /<div dir="ltr" class="[^"]*overflow-x-auto[^"]*text-left/, "technical block has local code direction and overflow boundary");
      snippets.forEach(value => assert.ok(html.includes(value), "exact code text retained: " + value));
    }
  }
});

test("actual shared numeric counter groups prefix/count/suffix and theme selector exposes exact state/callbacks", () => {
  for (const p of presentations) {
    const html = loaded("components/shared/animated-counter.tsx", "AnimatedCounter", [1234, false]).render(p, { target: 1234, prefix: "-$", suffix: "%" });
    assert.match(html, /<span dir="ltr"[^>]*>-\$1,234%<\/span>/, "counter parts stay in one isolated ordered group");
    const selected: string[] = [];
    const theme = render(h(ThemeOptions, { theme: "dark", onSelect: value => selected.push(value) }), p);
    assert.equal((theme.match(/aria-pressed="true"/g) ?? []).length, 1, "exactly one theme option is pressed");
    assert.equal((theme.match(/aria-pressed="false"/g) ?? []).length, 2, "other options remain unpressed");
  }
});

test("actual mobile navbar keeps direction-aware edge and exact close/navigation contracts", () => {
  for (const p of presentations) {
    const page = loaded("components/landing/navbar.tsx", "Navbar", [false, true]);
    page.render(p);
    assert.ok(page.controls.some(c => c.props.side === "end" && String(c.props.className).includes("max-w-full")), "sheet uses logical end and viewport bound");
    const links = page.controls.filter(c => typeof c.props.href === "string" && typeof c.props.onClick === "function");
    assert.deepEqual(links.map(c => c.props.href), ["#features", "/pricing", "/docs", "/sign-in", "/sign-up"], "destinations unchanged");
    links.forEach(c => (c.props.onClick as () => void)());
    assert.ok(page.updates.every(value => value[0] === 1 && value[1] === false), "navigation closes existing controlled sheet");
    assert.ok(page.controls.some(c => String(c.props.className).includes("lg:flex")), "desktop navigation waits for sufficient horizontal space");
  }
});

test("installed marketing CSS implements logical TOC, shrinking grids, code direction and growing actions", async () => {
  const compiler = await compile("@theme { --spacing: 0.25rem; } @tailwind utilities;");
  const css = compiler.build(["border-s-2", "ps-4", "ms-5", "text-start", "min-w-0", "h-auto", "min-h-12", "whitespace-normal",
    "[overflow-wrap:anywhere]", "overflow-x-auto", "[unicode-bidi:isolate]", "[&_pre]:[direction:ltr]", "[&:dir(rtl)]:rotate-180"]);
  for (const value of ["border-inline-start-width:", "padding-inline-start:", "margin-inline-start:", "text-align: start", "min-width:",
    "height: auto", "white-space: normal", "overflow-wrap: anywhere", "overflow-x: auto", "unicode-bidi: isolate", "direction: ltr", "rotate: 180deg"])
    assert.ok(css.includes(value), value);
});
