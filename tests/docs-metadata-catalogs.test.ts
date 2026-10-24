import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createTranslator } from "next-intl";
import type { Metadata } from "next";
import ts from "typescript";
import { resolvePresentation } from "../i18n/locale";
import { renderWithPresentation } from "./helpers/presentation";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

type Locale = "en-US" | "fa-IR";
type Props = {children?: React.ReactNode};
type PageProps = {params: Promise<{slug?: string[]}>};
type I18n = {locale: string; translations: Record<string, string>};
type RootModule = {generateMetadata(): Promise<Metadata>; default(props: Props): Promise<React.ReactElement>};
type DocsModule = {generateMetadata(props: PageProps): Promise<Metadata>; default(props: PageProps): Promise<React.ReactElement>; generateStaticParams(): Promise<unknown>};
const locales: Locale[] = ["en-US", "fa-IR"];
const rootFile = "app/layout.tsx", docsFile = "app/docs/[[...slug]]/page.tsx";
const publicFiles = [rootFile, "app/(landing)/privacy/page.tsx", "app/(landing)/terms/page.tsx"];
const chromeKeys = ["search", "searchNoResult", "toc", "tocNoHeadings", "lastUpdate", "chooseLanguage", "nextPage", "previousPage", "chooseTheme", "editOnGithub"] as const;
const escape = (text: string) => renderToStaticMarkup(React.createElement(React.Fragment, null, text));

// Execute production server components/metadata with real next-intl catalogs.
// Only request I/O, fonts, auth and framework rendering boundaries are replaced.
function load<T>(path: string, locale: Locale, extra: Record<string, unknown> = {}) {
  const require = createRequire(resolve(path)), mod = {exports: {} as T};
  const catalog = locale === "en-US" ? en : fa;
  const captured: {i18n?: I18n} = {};
  const pass = ({children}: Props) => children;
  const font = () => ({variable: "font-variable", className: "font-class", style: {fontFamily: "Vazirmatn, fallback"}});
  const mocks: Record<string, unknown> = {
    "next/font/local": {default: font},
    "next/font/google": {Geist_Mono: font, Playfair_Display: font},
    "next-intl/server": {
      getTranslations: async (namespace: "Docs" | "PublicMetadata") => createTranslator({locale, messages: {Docs: catalog.Docs, PublicMetadata: catalog.PublicMetadata}, namespace}),
      getMessages: async () => catalog,
      getNow: async () => new Date("2026-10-24T00:00:00Z"),
    },
    "@/i18n/server": {getPresentation: async () => resolvePresentation({user: {language: locale}})},
    "next-auth/react": {SessionProvider: pass},
    "@/components/shared/theme-provider": {ThemeProvider: pass},
    "fumadocs-ui/provider/next": {RootProvider: ({children, i18n}: Props & {i18n: I18n}) => {
      captured.i18n = i18n;
      return React.createElement("div", {"data-docs-locale": i18n.locale}, ...Object.values(i18n.translations).map((value, i) => React.createElement("span", {key: i}, value)), children);
    }},
    "sonner": {Toaster: () => null},
    ...extra,
  };
  const code = ts.transpileModule(readFileSync(path, "utf8"), {compilerOptions: {module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022}}).outputText;
  new Function("require", "module", "exports", code)((id: string) => {
    if (id in mocks) return mocks[id];
    if (id.endsWith(".css")) return {};
    return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  }, mod, mod.exports);
  return {module: mod.exports, captured};
}

test("root metadata localizes descriptions, titles, keywords and image text while preserving SEO contracts", async () => {
  const results: Metadata[] = [];
  for (const locale of locales) {
    const {module} = load<RootModule>(rootFile, locale), m = (locale === "en-US" ? en : fa).PublicMetadata;
    const metadata = await module.generateMetadata();
    results.push(metadata);
    assert.deepEqual(metadata.title, {default: m.title, template: "%s · dubbl"});
    assert.equal(metadata.description, m.description);
    const social = metadata.openGraph as {locale: string; title: string; description: string; images: Array<{alt: string; url: string; width: number; height: number}>};
    assert.equal(social.locale, locale === "fa-IR" ? "fa_IR" : "en_US");
    assert.equal(social.title, m.socialTitle);
    assert.equal(social.description, m.socialDescription);
    assert.deepEqual(social.images, [{url: "/og.jpg", width: 1200, height: 630, alt: m.imageAlt}]);
    const twitter = metadata.twitter as {title: string; description: string; images: unknown};
    assert.equal(twitter.title, m.socialTitle);
    assert.equal(twitter.description, m.socialDescription);
    assert.deepEqual(twitter.images, social.images);
    assert.deepEqual(metadata.keywords, [m.keywordOpenSource, m.keywordBookkeeping, m.keywordInvoicing, m.keywordPayable, m.keywordReceivable, m.keywordLedger, "ERP", m.keywordPayroll, m.keywordInventory, m.keywordProjects, "CRM", m.keywordSelfHosted, m.keywordApiFirst, m.keywordSmallBusiness, m.keywordFree]);
    assert.ok(metadata.metadataBase instanceof URL);
    assert.equal(metadata.metadataBase.href, new URL(process.env.NEXT_PUBLIC_APP_URL || "https://dubbl.dev").href);
    assert.deepEqual(metadata.icons, {icon: "/logo.svg", apple: "/web-app-manifest-192x192.png"});
    assert.equal(metadata.manifest, "/manifest.json");
  }
  for (const key of ["metadataBase", "authors", "creator", "robots", "icons", "manifest"] as const) assert.deepEqual(results[0][key], results[1][key], key);
  assert.deepEqual(results[0].robots, {index: true, follow: true, googleBot: {index: true, follow: true, "max-video-preview": -1, "max-image-preview": "large", "max-snippet": -1}});
});

test("root production render supplies every Fumadocs translation and retains document and font contracts", async () => {
  const englishDefaults = ["Search", "No results found", "On this page", "No Headings", "Last updated on", "Choose a language", "Next Page", "Previous Page", "Theme", "Edit on GitHub"];
  for (const locale of locales) {
    const {module, captured} = load<RootModule>(rootFile, locale);
    const html = renderToStaticMarkup(await module.default({children: React.createElement("main", null, "child")}));
    assert.ok(html.includes(`<html lang="${locale}"`));
    assert.ok(html.includes('name="apple-mobile-web-app-title" content="Dubbl"'));
    assert.ok(html.includes("<main>child</main>"));
    assert.equal(captured.i18n?.locale, locale === "fa-IR" ? "fa" : "en");
    const messages = (locale === "en-US" ? en : fa).Docs;
    assert.deepEqual(captured.i18n?.translations, Object.fromEntries(chromeKeys.map(key => [key, messages[key]])));
    for (const key of chromeKeys) assert.ok(html.includes(escape(messages[key])), key);
    if (locale === "en-US") assert.deepEqual(chromeKeys.map(key => messages[key]), englishDefaults);
  }
});

test("documentation layout and metadata keep unprefixed routes and localized MDX source selection", async () => {
  for (const locale of locales) {
    const lang = locale === "fa-IR" ? "fa" : "en", title = locale === "fa-IR" ? "راهنما <API>" : "Guide <API>";
    const calls: unknown[] = [], tree = {name: "tree", children: []};
    const page = {data: {title, description: `MDX ${lang}`, full: true, toc: [{title: "section", url: "#section"}], body: () => React.createElement("a", {href: "/docs/api"}, `MDX body ${lang}`)}};
    const source = {
      getPageTree: (language: string) => {calls.push(["tree", language]); return tree;},
      getPage: (slug: string[] | undefined, language: string) => {calls.push(["page", slug, language]); return slug?.[0] === "missing" ? undefined : page;},
      getPages: () => [{slugs: []}, {slugs: ["api"]}],
    };
    const {module: layout} = load<{default(props: Props): Promise<React.ReactElement>}>("app/docs/layout.tsx", locale, {
      "@/lib/source": {source},
      "fumadocs-ui/layouts/docs": {DocsLayout: ({children, nav, links, tree: actualTree}: Props & {nav: {title: React.ReactNode; url: string}; links: Array<{text: string; url: string; external?: boolean}>; tree: unknown}) => {
        assert.equal(actualTree, tree);
        assert.equal(links[1].external, true);
        return React.createElement("section", null, React.createElement("a", {href: nav.url}, nav.title), ...links.map(link => React.createElement("a", {key: link.url, href: link.url}, link.text)), children);
      }},
    });
    const layoutHtml = renderWithPresentation(await layout.default({children: "content"}), locale);
    assert.ok(layoutHtml.includes('href="/"'));
    assert.ok(layoutHtml.includes('href="/dashboard"'));
    assert.ok(layoutHtml.includes('href="https://github.com/dubbl-org/dubbl"'));
    assert.ok(layoutHtml.includes((locale === "en-US" ? en : fa).Docs.app));
    assert.ok(layoutHtml.includes((locale === "en-US" ? en : fa).Docs.github));
    assert.deepEqual(calls.shift(), ["tree", lang]);
    const boundary = (tag: string) => function Boundary({children}: Props) { return React.createElement(tag, null, children); };
    const {module: docs} = load<DocsModule>(docsFile, locale, {
      "@/lib/source": {source}, "@/mdx-components": {getMDXComponents: () => ({})},
      "next/navigation": {notFound: () => {throw new Error("NOT_FOUND");}},
      "fumadocs-ui/page": {DocsPage: ({children, toc, full, tableOfContent}: Props & {toc: unknown; full: boolean; tableOfContent: unknown}) => {
        assert.equal(toc, page.data.toc); assert.equal(full, true); assert.deepEqual(tableOfContent, {style: "clerk"});
        return React.createElement("article", null, children);
      }, DocsBody: boundary("div"), DocsDescription: boundary("p"), DocsTitle: boundary("h1")},
    });
    for (const slug of [undefined, ["api"]]) {
      const props = {params: Promise.resolve({slug})};
      const html = renderWithPresentation(await docs.default(props), locale), metadata = await docs.generateMetadata(props);
      const t = createTranslator({locale, messages: {Docs: (locale === "en-US" ? en : fa).Docs}, namespace: "Docs"});
      assert.equal(metadata.title, t("pageTitle", {title}));
      assert.equal(metadata.description, page.data.description);
      assert.ok(html.includes(`<h1>${escape(title)}</h1>`));
      assert.ok(html.includes('href="/docs/api"'));
      assert.ok(html.includes(`MDX body ${lang}`));
      assert.deepEqual(calls.splice(0), [["page", slug, lang], ["page", slug, lang]]);
    }
    const missing = {params: Promise.resolve({slug: ["missing"]})};
    await assert.rejects(docs.default(missing), /NOT_FOUND/);
    await assert.rejects(docs.generateMetadata(missing), /NOT_FOUND/);
    assert.deepEqual(await docs.generateStaticParams(), [{slug: []}, {slug: ["api"]}]);
  }
});

test("privacy and terms metadata use complete localized messages and preserve named legal entities", async () => {
  for (const locale of locales) {
    const m = (locale === "en-US" ? en : fa).PublicMetadata;
    for (const [index, file] of publicFiles.slice(1).entries()) {
      const {module} = load<{generateMetadata(): Promise<Metadata>}>(file, locale);
      assert.deepEqual(await module.generateMetadata(), index === 0 ? {title: m.privacyTitle, description: m.privacyDescription} : {title: m.termsTitle, description: m.termsDescription});
    }
    assert.ok(m.privacyDescription.includes("Mindroot Ltd"));
    assert.ok(m.privacyDescription.includes("UK GDPR"));
    assert.ok(m.termsDescription.includes("Mindroot Ltd"));
  }
});

test("owned metadata/chrome messages are paired, referenced and use Persian script", () => {
  const referenced = new Set<string>();
  for (const file of publicFiles) {
    const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function walk(node: ts.Node) {
      if (ts.isCallExpression(node) && ["t", "metadataT"].includes(node.expression.getText(source)) && ts.isStringLiteral(node.arguments[0])) referenced.add(node.arguments[0].text);
      ts.forEachChild(node, walk);
    }
    const metadata = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "generateMetadata");
    assert.ok(metadata, `${file}: missing metadata function`);
    walk(metadata);
  }
  assert.deepEqual([...referenced].sort(), Object.keys(en.PublicMetadata).sort());
  assert.deepEqual(Object.keys(en.PublicMetadata), Object.keys(fa.PublicMetadata));
  for (const value of [...Object.values(fa.PublicMetadata), ...chromeKeys.map(key => fa.Docs[key]), fa.Docs.pageTitle]) assert.match(value, /[\u0600-\u06ff]/);
  // MDX title/description/body ownership stays in the existing bilingual content system.
  assert.match(readFileSync(docsFile, "utf8"), /title: t\("pageTitle", \{ title: page.data.title \}\)/);
  assert.doesNotMatch(readFileSync(rootFile, "utf8"), /export const metadata|search: "|description:\s*"Free/);
});
