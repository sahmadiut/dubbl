import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import React from "react";
import * as intl from "next-intl";
import ts from "typescript";
import { renderWithPresentation } from "./helpers/presentation";
import PricingPage from "../app/(landing)/pricing/page";
import PrivacyPage from "../app/(landing)/privacy/page";
import TermsPage from "../app/(landing)/terms/page";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

type Locale = "en-US" | "fa-IR";
type Element = React.ReactElement<Record<string, unknown>>;
const locales: Locale[] = ["en-US", "fa-IR"];
const files = ["app/(landing)/pricing/page.tsx", "app/(landing)/privacy/page.tsx", "app/(landing)/terms/page.tsx", "components/legal/legal-page-layout.tsx", "components/legal/legal-toc.tsx"];
function attrs(html: string, name: string) { return [...html.matchAll(new RegExp(`\\s${name}="([^"]+)"`, "g"))].map(m => m[1]); }
function elements(node: React.ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!React.isValidElement(node)) return [];
  const el = node as Element;
  return [el, ...elements(el.props.children as React.ReactNode)];
}
function load(path: string, state: unknown[] = [], internals: string[] = []) {
  const require = createRequire(resolve(path)), mod = {exports: {} as Record<string, (...args: never[]) => React.ReactNode>};
  const effects: Array<() => (() => void)> = [], updates = new Map<number, unknown>();
  let index = 0;
  const code = ts.transpileModule(readFileSync(path, "utf8") + internals.map(name => `\nexport {${name}};`).join(""), {compilerOptions: {module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022}}).outputText;
  new Function("require", "module", "exports", code)((id: string) => {
    if (id === "next-intl") return intl;
    if (id === "react") return {...React,
      useState: (initial: unknown) => {const i = index++; return [state[i] ?? initial, (v: unknown) => updates.set(i, v)];},
      useEffect: (fn: () => (() => void)) => effects.push(fn)};
    return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  }, mod, mod.exports);
  return {components: mod.exports, effects, updates, reset: () => { index = 0; }};
}
function capture(Component: () => React.ReactNode, locale: Locale) {
  let tree: React.ReactNode;
  function Capture() { tree = Component(); return null; }
  renderWithPresentation(React.createElement(Capture), locale);
  return tree;
}

test("public pricing and legal production pages render bilingually with invariant links, anchors and facts", () => {
  for (const [i, Component] of [PricingPage, PrivacyPage, TermsPage].entries()) {
    const html = Object.fromEntries(locales.map(locale => [locale, renderWithPresentation(React.createElement(Component), locale)])) as Record<Locale, string>;
    for (const attribute of ["href", "id", "d"]) {
      // Radix/motion may add generated IDs; legal section IDs remain exact.
      assert.deepEqual(attrs(html["en-US"], attribute), attrs(html["fa-IR"], attribute), attribute);
    }
    for (const locale of locales) {
      const m = (locale === "en-US" ? en : fa).PublicPricingLegal;
      assert.doesNotMatch(html[locale], /PublicPricingLegal\./);
      assert.ok(html[locale].includes([m.transparentPricing, m.privacyPolicy, m.termsOfService][i]));
      if (i === 0) {
        for (const value of ["$0", "$10", "$12", "$13", "$38", "$100", "100 MB", "5 GB", "25 GB", "75 GB", "300 GB", "10,000", m.unlimited, m.communitySupport, m.prioritySupport]) assert.ok(html[locale].includes(value), value);
        assert.ok(attrs(html[locale], "href").includes("/sign-up?plan=pro"));
        assert.deepEqual(attrs(html[locale], "aria-pressed"), ["false", "true"]);
      } else {
        for (const fact of ["Mindroot Ltd", "16543299", "71-75 Shelton Street, London, England, WC2H 9JQ", "team@dubbl.dev", "2 March 2026", "Stripe"]) assert.ok(html[locale].includes(fact), fact);
        assert.ok(html[locale].includes(m.onThisPage));
        assert.ok(html[locale].includes(m.tableOfContents));
        assert.equal(attrs(html[locale], "id").length, i === 1 ? 14 : 16);
        if (i === 1) for (const fact of ["ZB958997", "0303 123 1113", "ico.org.uk", "Payment data", "processed securely by Stripe", "Stripe acts as an independent controller"]) assert.ok(html[locale].includes(fact), fact);
        if (i === 2) assert.ok(attrs(html[locale], "href").includes("https://stripe.com/legal"));
      }
    }
  }
});

test("pricing interval callbacks and dynamic limit/storage/annual values preserve plan contracts", () => {
  for (const locale of locales) {
    const t = intl.createTranslator({locale, messages: locale === "en-US" ? en : fa, namespace: "PublicPricingLegal"});
    for (const interval of ["monthly", "annual"]) {
      const {components: c, updates, reset} = load(files[0], [interval], ["getComparisonRows", "getFeatureRows", "getStoragePlansMeta"]);
      const Page = c.default as () => React.ReactNode;
      const tree = capture(Page, locale), buttons = elements(tree).filter(node => node.type === "button");
      assert.deepEqual(buttons.map(node => node.props["aria-pressed"]), [interval === "monthly", interval === "annual"]);
      buttons.forEach((button, i) => { (button.props.onClick as () => void)(); assert.equal(updates.get(0), i === 0 ? "monthly" : "annual"); });
      reset();
      const html = renderWithPresentation(React.createElement(Page), locale);
      const prices = interval === "annual" ? ["$10", "$13", "$38", "$100", t("billedAnnual", {amount: 120})] : ["$12", "$15", "$45", "$120", t("billedMonthly")];
      for (const value of prices) assert.ok(html.includes(value), `${interval}: ${value}`);
      type Rows = Array<{free: string | boolean; pro: string | boolean}>;
      const comparison = (c.getComparisonRows as unknown as (translator: typeof t) => Rows)(t);
      assert.deepEqual(comparison.map(row => [row.free, row.pro]), [
        ["1", t("unlimited")], ["500", t("unlimited")], ["200", t("unlimited")], ["10", t("unlimited")], ["1", t("unlimited")], ["2", "20"], ["100 MB", "5 GB"], ["25", "100"], [t("auditDays", {count: 30}), t("auditYear", {count: 1})],
      ]);
      const features = (c.getFeatureRows as unknown as (translator: typeof t) => Rows)(t);
      assert.deepEqual(features.map(row => [row.free, row.pro]), [[true,true],[true,true],[false,true],[false,true],[false,true],[false,true],[false,true],[true,true],[true,true],[true,true],[true,true],[false,true],[true,true],[false,true],[false,true]]);
      const storage = (c.getStoragePlansMeta as unknown as (translator: typeof t) => Array<{key: string}>)(t);
      assert.deepEqual(storage.map(row => row.key), ["free", "starter", "growth", "scale"]);
    }
  }
});

test("legal table of contents retains observer, active section, mobile close and smooth-scroll behavior", () => {
  const savedDocument = Object.getOwnPropertyDescriptor(globalThis, "document"), savedObserver = Object.getOwnPropertyDescriptor(globalThis, "IntersectionObserver");
  try {
    for (const locale of locales) {
      let callback: IntersectionObserverCallback | undefined, options: IntersectionObserverInit | undefined, disconnected = false;
      const observed: string[] = [], scrolled: Array<[string, unknown]> = [];
      const document = {getElementById: (id: string) => id === "missing" ? null : {id, scrollIntoView: (value: unknown) => scrolled.push([id, value])}};
      class Observer {
        constructor(fn: IntersectionObserverCallback, opts: IntersectionObserverInit) {callback = fn; options = opts;}
        observe(el: HTMLElement) { observed.push(el.id); }
        disconnect() { disconnected = true; }
      }
      Object.defineProperty(globalThis, "document", {configurable: true, value: document});
      Object.defineProperty(globalThis, "IntersectionObserver", {configurable: true, value: Observer});
      const {components: c, effects, updates} = load(files[4], ["data-controller", true]);
      const items = [{id: "data-controller", title: "Controller"}, {id: "missing", title: "Missing"}];
      const Toc = c.LegalToc as unknown as (props: {items: typeof items}) => React.ReactNode;
      const nodes = elements(capture(() => Toc({items}), locale)), buttons = nodes.filter(node => node.type === "button");
      assert.equal(buttons.length, 5);
      assert.equal(effects.length, 1);
      const cleanup = effects[0]();
      assert.deepEqual(observed, ["data-controller"]);
      assert.equal(options?.rootMargin, "-96px 0px -70% 0px");
      callback!([{isIntersecting: false, target: {id: "ignored"}}, {isIntersecting: true, target: {id: "data-controller"}}] as unknown as IntersectionObserverEntry[], {} as IntersectionObserver);
      assert.equal(updates.get(0), "data-controller");
      buttons.forEach(button => (button.props.onClick as () => void)());
      assert.equal(updates.get(1), false);
      assert.deepEqual(scrolled, [["data-controller", {behavior: "smooth"}], ["data-controller", {behavior: "smooth"}]]);
      cleanup();
      assert.equal(disconnected, true);
    }
  } finally {
    if (savedDocument) Object.defineProperty(globalThis, "document", savedDocument); else Reflect.deleteProperty(globalThis, "document");
    if (savedObserver) Object.defineProperty(globalThis, "IntersectionObserver", savedObserver); else Reflect.deleteProperty(globalThis, "IntersectionObserver");
  }
});

test("pricing/legal catalog is completely referenced, paired and preserves every numeric fact", () => {
  const keys = new Set<string>();
  const exceptions = new Set(["Mindroot Ltd", "Company No. 16543299, registered in England and Wales", "71-75 Shelton Street, London, England, WC2H 9JQ", "ICO Registration: ZB958997", "Information Commissioner&apos;s Office", "Wycliffe House, Water Lane, Wilmslow, Cheshire, SK9 5AF", "Telephone: 0303 123 1113", "Website:", "ico.org.uk", "Registered office: 71-75 Shelton Street, London, England, WC2H 9JQ", "Contact:", "team@dubbl.dev"]);
  for (const file of files) {
    const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function walk(n: ts.Node) {
      if (ts.isJsxText(n)) {
        const value = n.text.replace(/\s+/g, " ").trim();
        let ancestor: ts.Node | undefined = n.parent;
        let frozen = false;
        while (ancestor) {
          if (ts.isJsxElement(ancestor) && ["p", "li"].includes(ancestor.openingElement.tagName.getText(source)) && ancestor.getText(source).includes("Stripe")) frozen = true;
          ancestor = ancestor.parent;
        }
        if (/[A-Za-z]/.test(value)) assert.ok(frozen || exceptions.has(value), `${file}: unextracted ${value}`);
      }
      if (ts.isCallExpression(n) && ["t", "t.rich"].includes(n.expression.getText(source)) && ts.isStringLiteral(n.arguments[0])) keys.add(n.arguments[0].text);
      ts.forEachChild(n, walk);
    }
    walk(source);
  }
  assert.deepEqual([...keys].sort(), Object.keys(en.PublicPricingLegal).sort());
  assert.deepEqual(Object.keys(en.PublicPricingLegal).sort(), Object.keys(fa.PublicPricingLegal).sort());
  for (const key of Object.keys(en.PublicPricingLegal) as Array<keyof typeof en.PublicPricingLegal>) {
    assert.match(fa.PublicPricingLegal[key], /[\u0600-\u06ff]/);
    assert.deepEqual(fa.PublicPricingLegal[key].match(/\d+(?:[.,]\d+)*%?/g), en.PublicPricingLegal[key].match(/\d+(?:[.,]\d+)*%?/g), key);
  }
});
