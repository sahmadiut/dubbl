import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createTranslator } from "next-intl";
import ts from "typescript";
import type { Metadata } from "next";
import Home from "../app/(landing)/page";
import LandingLayout from "../app/(landing)/layout";
import PricingPage from "../app/(landing)/pricing/page";
import PrivacyPage from "../app/(landing)/privacy/page";
import TermsPage from "../app/(landing)/terms/page";
import { resolvePresentation } from "../i18n/locale";
import { PresentationProvider } from "../i18n/provider";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

type Locale = "en-US" | "fa-IR";
type Props = {children?: React.ReactNode};
type Root = {default(props: Props): Promise<React.ReactElement>; generateMetadata(): Promise<Metadata>};
const locales: Locale[] = ["en-US", "fa-IR"];
const pages = [Home, PricingPage, PrivacyPage, TermsPage];
const routes = ["/", "/pricing", "/privacy", "/terms"];
const escape = (value: string) => renderToStaticMarkup(React.createElement(React.Fragment, null, value));
const attrs = (html: string, name: string) => [...html.matchAll(new RegExp(`\\s${name}="([^"]+)"`, "g"))].map(match => match[1]);

// Keep the actual root PresentationProvider and every landing child. Only Next
// request/font I/O and unrelated theme/auth/Fumadocs provider boundaries change.
function root(locale: Locale): Root {
  const file = "app/layout.tsx", require = createRequire(resolve(file));
  const mod = {exports: {} as Root}, catalog = locale === "en-US" ? en : fa;
  const pass = ({children}: Props) => children;
  const font = () => ({variable: "font-variable", className: "font-class", style: {fontFamily: "Vazirmatn, fallback"}});
  const mocks: Record<string, unknown> = {
    "next/font/local": {default: font},
    "next/font/google": {Geist_Mono: font, Playfair_Display: font},
    "next-intl/server": {
      getMessages: async () => catalog,
      getNow: async () => new Date("2026-10-24T00:00:00Z"),
      getTranslations: async (namespace: "Docs" | "PublicMetadata") => createTranslator({locale, messages: {Docs: catalog.Docs, PublicMetadata: catalog.PublicMetadata}, namespace}),
    },
    "@/i18n/server": {getPresentation: async () => resolvePresentation({user: {language: locale}})},
    "@/i18n/provider": {PresentationProvider},
    "next-auth/react": {SessionProvider: pass},
    "@/components/shared/theme-provider": {ThemeProvider: pass},
    "fumadocs-ui/provider/next": {RootProvider: pass},
    sonner: {Toaster: () => null},
  };
  const code = ts.transpileModule(readFileSync(file, "utf8"), {compilerOptions: {module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022}}).outputText;
  new Function("require", "module", "exports", code)((id: string) => {
    if (id in mocks) return mocks[id];
    if (id.endsWith(".css")) return {};
    return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  }, mod, mod.exports);
  return mod.exports;
}

test("actual landing composition shares one root locale across shell, feature, pricing and legal catalogs", async () => {
  const errors: unknown[][] = [], previous = console.error;
  console.error = (...args: unknown[]) => {errors.push(args);};
  try {
    const rendered: string[][] = [];
    for (const locale of locales) {
      const rootModule = root(locale), catalog = locale === "en-US" ? en : fa;
      const metadata = await rootModule.generateMetadata();
      assert.deepEqual(metadata.title, {default: catalog.PublicMetadata.title, template: "%s · dubbl"});
      assert.equal(metadata.description, catalog.PublicMetadata.description);
      const htmls: string[] = [];
      for (const [index, Page] of pages.entries()) {
        const child = React.createElement(LandingLayout, null, React.createElement(Page));
        const html = renderToStaticMarkup(await rootModule.default({children: child}));
        htmls.push(html);
        assert.ok(html.includes(`<html lang="${locale}"`), routes[index]);
        assert.equal((html.match(/<main\b/g) || []).length, 1, routes[index]);
        assert.equal((html.match(/<footer\b/g) || []).length, 1, routes[index]);
        assert.ok(html.includes(escape(catalog.LandingShell.footerDescription)), routes[index]);
        assert.ok(html.includes(escape(catalog.LandingShell.signIn)), routes[index]);
        assert.doesNotMatch(html, /(?:LandingShell|LandingFeatures|PublicPricingLegal|PublicMetadata)\.[A-Za-z]/);
        assert.ok(attrs(html, "href").includes("/docs"));
        assert.ok(attrs(html, "href").includes("/sign-up"));
        if (index === 0) {
          for (const message of [catalog.LandingShell.heroDescription, catalog.LandingFeatures.powerfulFeaturesForModernTeams, catalog.LandingFeatures.frequentlyAskedQuestions, catalog.LandingShell.ctaHeading]) assert.ok(html.includes(escape(message)), message);
          assert.ok(attrs(html, "id").includes("features"));
          const faqTriggers = [...html.matchAll(/<button\b[^>]*data-slot="accordion-trigger"[^>]*>/g)].map(match => match[0]);
          assert.equal(faqTriggers.length, 9);
          for (const trigger of faqTriggers) assert.ok(trigger.includes('aria-expanded="false"'));
          for (const sample of ["$48,250", "INV-012", "Stripe Payout", "POST /v1/transactions"]) assert.ok(html.includes(locale === "fa-IR" ? sample.replaceAll("$", "دلار\u00a0") : sample), sample);
        } else {
          const heading = [catalog.PublicPricingLegal.transparentPricing, catalog.PublicPricingLegal.privacyPolicy, catalog.PublicPricingLegal.termsOfService][index - 1];
          assert.ok(html.includes(escape(heading)), heading);
          if (index > 1) for (const fixed of ["Mindroot Ltd", "16543299", "2 March 2026", "Stripe"]) assert.ok(html.includes(fixed), fixed);
        }
      }
      rendered.push(htmls);
    }
    for (let index = 0; index < pages.length; index++) {
      for (const attribute of ["href", "d", "points", "viewBox"]) assert.deepEqual(attrs(rendered[0][index], attribute), attrs(rendered[1][index], attribute), `${routes[index]} ${attribute}`);
    }
    assert.deepEqual(errors, [], "combined production render must not emit missing-message, context, duplicate-key or markup errors");
  } finally { console.error = previous; }
});

test("landing documentation destinations keep existing bilingual content sources without locale URL prefixes", async () => {
  const html = renderToStaticMarkup(await root("fa-IR").default({children: React.createElement(LandingLayout, null, React.createElement(Home))}));
  const docs = [...new Set(attrs(html, "href").filter(href => href === "/docs" || href.startsWith("/docs/")))];
  assert.ok(docs.length >= 10);
  for (const href of docs) {
    const slug = href.slice("/docs".length).replace(/^\//, "") || "index";
    // This is a source/route contract, not MDX execution or linguistic review.
    for (const suffix of [".mdx", ".fa.mdx"]) {
      const direct = `content/docs/${slug}${suffix}`, index = `content/docs/${slug}/index${suffix}`;
      assert.ok(existsSync(direct) || existsSync(index), `${href}: missing paired source ${suffix}`);
    }
    assert.doesNotMatch(href, /^\/(?:en|fa)(?:-|\/)/);
  }
});
