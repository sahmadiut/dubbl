import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import React from "react";
import * as intl from "next-intl";
import ts from "typescript";
import { renderWithPresentation } from "./helpers/presentation";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";
import { Navbar } from "../components/landing/navbar";
import { Footer } from "../components/landing/footer";
import { Hero } from "../components/landing/hero";
import { CTASection } from "../components/landing/cta-section";
import { TrustBar } from "../components/landing/trust-bar";

type Locale = "en-US" | "fa-IR";
type Element = React.ReactElement<Record<string, unknown>>;
const files = ["navbar", "footer", "hero", "cta-section", "trust-bar"] as const;
const components = [Navbar, Footer, Hero, CTASection, TrustBar];

function load(file: string, mobileOpen = false) {
  const path = `components/landing/${file}.tsx`, require = createRequire(resolve(path));
  const mod = {exports: {} as Record<string, () => React.ReactNode>};
  const effects: Array<() => (() => void)> = [], updates = new Map<number, unknown>();
  let index = 0;
  const code = ts.transpileModule(readFileSync(path, "utf8"), {compilerOptions: {module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022}}).outputText;
  new Function("require", "module", "exports", code)((id: string) => {
    if (id === "next-intl") return intl;
    if (id === "react") return {...React,
      useState: () => { const i = index++; return [i === 1 && mobileOpen, (v: unknown) => updates.set(i, v)]; },
      useEffect: (fn: () => (() => void)) => effects.push(fn)};
    return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  }, mod, mod.exports);
  return {components: mod.exports, effects, updates};
}
function elements(node: React.ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!React.isValidElement(node)) return [];
  const el = node as Element;
  return [el, ...elements(el.props.children as React.ReactNode)];
}
function hrefs(html: string) { return [...html.matchAll(/href="([^"]+)"/g)].map(match => match[1]); }

test("landing shell renders real bilingual templates and retains destinations and demo literals", () => {
  for (let i = 0; i < files.length; i++) {
    const file = files[i], Component = components[i];
    const html = Object.fromEntries((["en-US", "fa-IR"] as const).map(locale => [locale, renderWithPresentation(React.createElement(Component), locale)])) as Record<Locale, string>;
    assert.deepEqual(hrefs(html["en-US"]), hrefs(html["fa-IR"]), file);
    for (const locale of ["en-US", "fa-IR"] as const) {
      const m = (locale === "en-US" ? en : fa).LandingShell;
      const headings = {navbar: m.signIn, footer: m.footerDescription, hero: m.heroDescription, "cta-section": m.ctaHeading, "trust-bar": m.trustedTools};
      assert.ok(html[locale].includes(headings[file]), `${file}: ${locale}`);
      if (file === "hero") {
        for (const value of [m.revenue, m.monthlyProfitLoss, m.liveFeed, m.clientPayment, m.assetAllocation, m.accounts, m.paid, m.getStartedFree, "$48,250", "+$12,500", "-$240", "+$5,000", "58%", "INV-012", "INV-048", "JE-102", "Dec 2025", "POST /v1/transactions", "> git clone"]) assert.ok(html[locale].includes(value.replaceAll("&", "&amp;").replaceAll(">", "&gt;")), value);
        assert.match(html[locale], /<em class="pr-1 italic bg-gradient-to-r/);
        assert.ok(hrefs(html[locale]).includes("/sign-up"));
      }
      if (file === "footer") {
        for (const value of ["Stripe Integration", "Mindroot Ltd", "16543299", "71-75 Shelton Street, London, WC2H 9JQ", "2026 dubbl", "Apache 2.0"]) assert.ok(html[locale].includes(value), value);
        for (const url of ["/docs/guides/stripe-integration", "/pricing", "/privacy", "/terms", "https://x.com/DubblHQ"]) assert.ok(hrefs(html[locale]).includes(url), url);
      }
      if (file === "cta-section") assert.deepEqual(hrefs(html[locale]), ["/sign-up", "/contact"]);
      if (file === "trust-bar") for (const value of ["Next.js", "PostgreSQL", "TypeScript", "Drizzle ORM", "REST API", "Apache 2.0"]) assert.ok(html[locale].includes(value));
    }
    if (file === "hero") {
      const paths = (value: string) => [...value.matchAll(/\sd="([^"]+)"/g)].map(match => match[1]);
      assert.deepEqual(paths(html["en-US"]), paths(html["fa-IR"]));
    }
  }
  for (const value of Object.values(fa.LandingShell)) assert.match(value, /[\u0600-\u06ff]/);
});

test("mobile navigation keeps controlled state, localized menu label and close callbacks", () => {
  for (const locale of ["en-US", "fa-IR"] as const) {
    const {components, effects, updates} = load("navbar", true);
    let tree: React.ReactNode;
    function Capture() { tree = components.Navbar(); return null; }
    renderWithPresentation(React.createElement(Capture), locale);
    const m = (locale === "en-US" ? en : fa).LandingShell;
    const nodes = elements(tree);
    assert.ok(nodes.some(node => node.props["aria-label"] === m.openMenu));
    const sheet = nodes.find(node => typeof node.props.onOpenChange === "function")!;
    assert.equal(sheet.props.open, true);
    (sheet.props.onOpenChange as (open: boolean) => void)(false);
    assert.equal(updates.get(1), false);
    const links = nodes.filter(node => typeof node.props.onClick === "function" && typeof node.props.href === "string");
    assert.deepEqual(links.map(node => node.props.href), ["#features", "/pricing", "/docs", "/sign-in", "/sign-up"]);
    for (const link of links) {
      updates.clear();
      (link.props.onClick as () => void)();
      assert.equal(updates.get(1), false);
    }
    assert.equal(effects.length, 1);
  }
});

test("owned JSX has only inventoried literal exceptions and uses the complete paired catalog", () => {
  const referenced = new Set<string>();
  const exceptions = new Set(["dubbl", "$48,250", "> git clone", "&gt; git clone"]);
  for (const file of files) {
    const text = readFileSync(`components/landing/${file}.tsx`, "utf8");
    const source = ts.createSourceFile(`${file}.tsx`, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function walk(node: ts.Node) {
      if (ts.isJsxText(node)) {
        const value = node.text.replace(/\s+/g, " ").trim();
        if (/[A-Za-z]/.test(value)) assert.ok(exceptions.has(value), `${file}: unextracted ${value}`);
      }
      if (ts.isCallExpression(node) && (node.expression.getText(source) === "t" || node.expression.getText(source) === "t.rich") && ts.isStringLiteral(node.arguments[0])) referenced.add(node.arguments[0].text);
      ts.forEachChild(node, walk);
    }
    walk(source);
  }
  // Navbar labels are selected from the stable route table.
  for (const key of ["navFeatures", "navPricing", "navDocs"]) referenced.add(key);
  assert.deepEqual([...referenced].sort(), Object.keys(en.LandingShell).sort());
});
