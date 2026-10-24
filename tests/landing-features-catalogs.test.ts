import assert from "node:assert/strict";
import { test, mock } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import React from "react";
import * as intl from "next-intl";
import ts from "typescript";
import { renderWithPresentation } from "./helpers/presentation";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";
import { BentoFeatures } from "../components/landing/bento-features";
import { DashboardPreview } from "../components/landing/dashboard-preview";
import { FeatureSections } from "../components/landing/feature-sections";
import { HowItWorks } from "../components/landing/how-it-works";
import { Integrations } from "../components/landing/integrations";
import { OpenSource } from "../components/landing/open-source";
import { Testimonials } from "../components/landing/testimonials";
import { FAQ } from "../components/landing/faq";

type Locale = "en-US" | "fa-IR";
type Element = React.ReactElement<Record<string, unknown>>;
const files = ["bento-features", "dashboard-preview", "feature-sections", "how-it-works", "integrations", "open-source", "testimonials", "faq"];
const components = [BentoFeatures, DashboardPreview, FeatureSections, HowItWorks, Integrations, OpenSource, Testimonials, FAQ];
const locales: Locale[] = ["en-US", "fa-IR"];
const escape = (s: string) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
function attrs(html: string, name: string) { return [...html.matchAll(new RegExp(`\\s${name}="([^"]+)"`, "g"))].map(m => m[1]); }
function elements(node: React.ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!React.isValidElement(node)) return [];
  const el = node as Element;
  return [el, ...elements(el.props.children as React.ReactNode)];
}

// Capture the production component's actual props/callbacks with deterministic
// hook state; rendered-copy assertions above use static imports and real intl.
function load(file: string, internals: string[] = [], state: number[] = [], isActive = true) {
  const path = `components/landing/${file}.tsx`, require = createRequire(resolve(path));
  const mod = {exports: {} as Record<string, () => React.ReactNode>};
  const effects: Array<() => (() => void)> = [], updates = new Map<number, unknown>();
  let index = 0;
  const code = ts.transpileModule(readFileSync(path, "utf8") + internals.map(name => `\nexport {${name}};`).join(""), {compilerOptions: {module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022}}).outputText;
  new Function("require", "module", "exports", code)((id: string) => {
    if (id === "next-intl") return intl;
    if (id === "./use-landing-activity") return {useLandingActivity: () => ({ref: {current: null}, isActive})};
    if (id === "react") return {...React,
      useState: (initial: unknown) => {
        const i = index++, value = state[i] ?? initial;
        return [value, (next: unknown) => updates.set(i, typeof next === "function" ? next(value) : next)];
      },
      useEffect: (fn: () => (() => void)) => effects.push(fn)};
    return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  }, mod, mod.exports);
  return {components: mod.exports, effects, updates};
}
function capture(Component: () => React.ReactNode, locale: Locale) {
  let tree: React.ReactNode;
  function Capture() { tree = Component(); return null; }
  renderWithPresentation(React.createElement(Capture), locale);
  return tree;
}

test("landing features render bilingual production templates, retaining demos, links and geometry", () => {
  const headingKeys = ["powerfulFeaturesForModernTeams", "yourFinancesAtAGlance", "theProblem", "threeStepsToGetStarted", "bringYourDataWithYou", "forkItExtendItOwnIt", "builtAPIFirst", "frequentlyAskedQuestions"] as const;
  for (let i = 0; i < files.length; i++) {
    const html = Object.fromEntries(locales.map(locale => [locale, renderWithPresentation(React.createElement(components[i]), locale)])) as Record<Locale, string>;
    for (const attr of ["href", "d", "points", "viewBox"]) assert.deepEqual(attrs(html["en-US"], attr), attrs(html["fa-IR"], attr), `${files[i]} ${attr}`);
    for (const locale of locales) {
      const m = (locale === "en-US" ? en : fa).LandingFeatures;
      assert.ok(html[locale].includes(escape(m[headingKeys[i]])), `${files[i]} heading ${locale}`);
      assert.doesNotMatch(html[locale], /LandingFeatures\./);
      if (files[i] === "bento-features") for (const text of [m.debit, m.credit, m.total, "15,650.00", "$84.2k", "TXN-4821", "JE-1042", "Stripe Payout", "Alice Wang", "Mar 01", "API-First", "Every feature accessible via REST API. Built-in Stripe integration for payment syncing. Build custom integrations in minutes."]) assert.ok(html[locale].includes(escape(text)), text);
      if (files[i] === "dashboard-preview") for (const text of [m.netProfit, m.recentTransactions, "$84,200", "$48,250", "+12.5%", "Mar 01", "60%", "17%", "23%"]) assert.ok(html[locale].includes(escape(text)), text);
      if (files[i] === "feature-sections") {
        for (const text of [m.spreadsheetErrors, m.missingRecords, "$12,580", "#2847", "$174,900", "$45,000", "INV-1041", "Acme Corp", "#REF!"]) assert.ok(html[locale].includes(escape(text)), text);
        assert.match(html[locale], /<span class="text-red-950">/);
        assert.match(html[locale], /<span class="text-emerald-950">/);
      }
      if (files[i] === "how-it-works") for (const text of [m.integrations, m.categorizeTransaction, m.balanced245000, "Mar 1, 2026", "$2,450.00", "6200", "1000"]) assert.ok(html[locale].includes(escape(text)), text);
      if (files[i] === "integrations") for (const text of ["Stripe", "Payments", "QuickBooks", "Xero", m.cSVImport, m.comingSoon, m.fullControl]) assert.ok(html[locale].includes(escape(text)), text);
      if (files[i] === "open-source") for (const text of [m.viewRepository, "terminal", "git clone", "docker compose up -d", "Container dubbl-db", "http://localhost:3000"]) assert.ok(html[locale].includes(escape(text)), text);
      if (files[i] === "testimonials") for (const text of ["// Fetch recent transactions", "// Each entry is double-entry balanced", "e.amount", "@dubbl/sdk", "npm install", "docker compose up -d", "localhost:3000", m.selfHostable]) assert.ok(html[locale].includes(escape(text)), text);
      if (files[i] === "faq") {
        assert.equal(attrs(html[locale], "aria-expanded").filter(s => s === "false").length, 9);
        assert.ok(html[locale].includes(escape(m.isDubblReallyFree)));
      }
    }
  }
});

test("showcase retains all three views, locale-independent highlighting, timer and navigation callbacks", () => {
  let englishClasses: unknown;
  for (const locale of locales) {
    for (const active of [0, 1, 2]) {
      const {components: c, effects, updates} = load("feature-sections", ["SolutionShowcase", "MarqueeView", "NetworkView", "ReceiptView"], [active, 7]);
      const tree = capture(c.SolutionShowcase, locale), nodes = elements(tree);
      const buttons = nodes.filter(node => node.type === "button");
      assert.equal(buttons.length, 3);
      assert.deepEqual(buttons.map(node => node.props["aria-pressed"]), [0, 1, 2].map(i => i === active));
      buttons.forEach((button, i) => {
        assert.equal(button.props["aria-label"], intl.createTranslator({locale, messages: locale === "en-US" ? en : fa, namespace: "LandingFeatures"})("showView", {number: i + 1}));
        (button.props.onClick as () => void)();
        assert.equal(updates.get(0), i);
        assert.equal(updates.get(1), 8);
      });
      const view = [c.MarqueeView, c.NetworkView, c.ReceiptView][active];
      const html = renderWithPresentation(React.createElement(view), locale);
      assert.match(html, /[\u0600-\u06ff]|Invoice/);
      if (active === 0) {
        const classes = attrs(html, "class").filter(value => value.includes("backdrop-blur-sm"));
        assert.ok(classes.some(value => value.includes("border-white/20")));
        assert.ok(classes.some(value => value.includes("bg-white/10")));
        if (locale === "en-US") englishClasses = classes; else assert.deepEqual(classes, englishClasses);
      }
      if (active === 1) assert.equal(attrs(html, "x1").length, 16);
      if (active === 2) assert.ok(html.includes("#CN-041"));
      assert.equal(effects.length, 1);
      mock.timers.enable({apis: ["setTimeout"]});
      try {
        updates.clear();
        const cleanup = effects[0]();
        mock.timers.tick(5999);
        assert.equal(updates.size, 0);
        mock.timers.tick(1);
        assert.equal(updates.get(0), (active + 1) % 3);
        assert.equal(updates.get(1), 8);
        cleanup();
        updates.clear();
        const cancel = effects[0]();
        cancel();
        mock.timers.tick(6000);
        assert.equal(updates.size, 0);
      } finally { mock.timers.reset(); }
    }
  }
});

test("inactive showcase pauses automatic rotation while retaining manual navigation", () => {
  const {components: c, effects, updates} = load("feature-sections", ["SolutionShowcase"], [1, 7], false);
  const nodes = elements(capture(c.SolutionShowcase, "en-US"));
  mock.timers.enable({apis: ["setTimeout"]});
  try {
    effects[0]();
    mock.timers.tick(18000);
    assert.equal(updates.size, 0);
    const buttons = nodes.filter(node => node.type === "button");
    (buttons[2].props.onClick as () => void)();
    assert.equal(updates.get(0), 2);
    assert.equal(updates.get(1), 8);
  } finally { mock.timers.reset(); }
});

test("FAQ preserves the single collapsible accordion contract and every localized answer", () => {
  for (const locale of locales) {
    const {components: c} = load("faq");
    const nodes = elements(capture(c.FAQ, locale));
    const accordion = nodes.find(node => node.props.collapsible === true)!;
    assert.equal(accordion.props.type, "single");
    const items = elements(accordion.props.children as React.ReactNode).filter(node => typeof node.props.value === "string");
    assert.deepEqual(items.map(item => item.props.value), Array.from({length: 9}, (_,i) => `item-${i}`));
    const m = (locale === "en-US" ? en : fa).LandingFeatures;
    for (const item of items) {
      const children = elements(item.props.children as React.ReactNode);
      assert.equal(children.length, 2);
      for (const child of children) assert.ok(Object.values(m).includes(child.props.children as typeof m[keyof typeof m]));
    }
  }
});

test("owned copy references cover the paired catalog and remaining JSX has inventoried exceptions", () => {
  const keys = new Set<string>();
  const exceptions = new Set(["dubbl", "Mar 1, 2026", "terminal", "index.ts", "const", "entries", "await", "list", "limit:", "status:", "total", "reduce", "sum", "e", "e.amount", "self-host", "docker compose up -d", "sdk", "npm install @dubbl/sdk", "import", "Dubbl", "from", "client", "new"]);
  for (const file of files) {
    const source = ts.createSourceFile(file, readFileSync(`components/landing/${file}.tsx`, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function walk(n: ts.Node) {
      if (ts.isJsxText(n)) {
        const value = n.text.replace(/\s+/g, " ").trim();
        if (/[A-Za-z]/.test(value)) assert.ok(exceptions.has(value), `${file}: ${value}`);
      }
      if (ts.isCallExpression(n) && ["t", "t.rich"].includes(n.expression.getText(source)) && ts.isStringLiteral(n.arguments[0])) keys.add(n.arguments[0].text);
      ts.forEachChild(n, walk);
    }
    walk(source);
  }
  assert.deepEqual([...keys].sort(), Object.keys(en.LandingFeatures).sort());
  assert.deepEqual(Object.keys(en.LandingFeatures).sort(), Object.keys(fa.LandingFeatures).sort());
  for (const value of Object.values(fa.LandingFeatures)) assert.match(value, /[\u0600-\u06ff]/);
});
