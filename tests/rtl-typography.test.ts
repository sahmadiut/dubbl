import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash } from "node:crypto";
import * as fs from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { compile } from "tailwindcss";
import ts from "typescript";
import { FONT_FAMILIES, localeDirection, resolvePresentation, type Presentation } from "../i18n/locale";
import { PresentationProvider } from "../i18n/provider";
import { CurrencyInput } from "../components/ui/currency-input";
import { IdentifierText } from "../components/ui/bidi-text";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const require = createRequire(import.meta.url);
const fontPath = resolve("public/fonts/vazirmatn/Vazirmatn-Variable.woff2");
const fontHash = "4e3fa217d38fdafc1fea4414ceb58ca5e662cf0ab5fa735a8c8c20e8b42cad92";
const hash = (buffer: Buffer) => createHash("sha256").update(buffer).digest("hex");
type FontOptions = { src: string; variable: string; weight: string; style: string; display: string; fallback: string[] };

// Compile actual root JSX with font/request/session I/O controlled. Record the
// exact local-font options for the installed Next loader test below; this is not
// a generated Next build or a browser/computed-style claim.
function loadRoot(presentation: Presentation) {
  const file = resolve("app/layout.tsx");
  let options: FontOptions | undefined;
  const compiled = { exports: {} as { default: (props: { children: React.ReactNode }) => Promise<React.ReactElement> } };
  const passthrough = ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children);
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  const load = (id: string): unknown => {
    if (id.endsWith(".css")) return {};
    if (id === "next/font/local") return { default: (value: FontOptions) => {
      options = value;
      return { className: "local-vazirmatn", variable: "local-vazirmatn-variable", style: { fontFamily: "Vazirmatn" } };
    } };
    if (id === "next/font/google") return Object.fromEntries(["Geist_Mono", "Playfair_Display"].map(name =>
      [name, () => ({ variable: `font-${name}`, className: `font-${name}`, style: { fontFamily: `${name}, Arial` } })]));
    if (id === "next-auth/react") return { SessionProvider: passthrough };
    if (id === "@/components/shared/theme-provider") return { ThemeProvider: passthrough };
    if (id === "fumadocs-ui/provider/next") return { RootProvider: passthrough };
    if (id === "sonner") return { Toaster: () => null };
    if (id === "@/i18n/server") return { getPresentation: async () => presentation };
    if (id === "@/i18n/provider") return { PresentationProvider };
    if (id === "@/i18n/locale") return { localeDirection };
    if (id === "next-intl/server") return { getMessages: async () => presentation.locale === "fa-IR" ? fa : en,
      getNow: async () => new Date("2026-10-25T00:00:00Z"), getTranslations: async () => (key: string) => key };
    return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  };
  new Function("require", "module", "exports", code)(load, compiled, compiled.exports);
  assert.ok(options);
  return { Layout: compiled.exports.default, options, directory: dirname(file) };
}

test("approved font and original OFL notice are pinned locally", () => {
  const buffer = fs.readFileSync(fontPath);
  assert.equal(buffer.toString("ascii", 0, 4), "wOF2");
  assert.equal(hash(buffer), fontHash);
  const notice = fs.readFileSync("public/fonts/vazirmatn/OFL.txt");
  assert.equal(hash(notice), "17e355067c8284f47743a1ee3b1ef7ff684ff0601eda357f9353b10b3016ab31");
  assert.match(notice.toString("utf8"), /Copyright 2015 The Vazirmatn Project Authors/);
  assert.match(notice.toString("utf8"), /SIL OPEN FONT LICENSE Version 1\.1/);
  const readme = fs.readFileSync("public/fonts/vazirmatn/README.md", "utf8");
  assert.ok(readme.includes("f68f7bc5dd1d046bd6a5a2bda355bd6d430e807a"));
  assert.ok(readme.includes(fontHash));
});

test("installed Next local loader emits the exact bundled font offline, swap and variable-weight fallback", async () => {
  const { options, directory } = loadRoot(resolvePresentation({}));
  assert.equal(resolve(directory, options.src), fontPath);
  assert.equal(options.variable, "--font-vazirmatn");
  assert.equal(options.weight, "100 900");
  assert.equal(options.style, "normal");
  assert.equal(options.display, "swap");
  assert.deepEqual(options.fallback, ["Arial", "sans-serif"]);
  const loader = require("next/dist/compiled/@next/font/dist/local/loader").default as (input: {
    functionName: string; variableName: string; data: FontOptions[];
    emitFontFile: (buffer: Buffer, extension: string, preload: boolean) => string;
    resolve: (path: string) => Promise<string>; loaderContext: { fs: typeof fs };
  }) => Promise<{ css: string; variable: string; fallbackFonts: string[]; adjustFontFallback: { fallbackFont: string } }>;
  let emitted = 0;
  const result = await loader({ functionName: "", variableName: "vazirmatn", data: [options],
    resolve: async path => resolve(directory, path), loaderContext: { fs },
    emitFontFile: (buffer, extension, preload) => {
      emitted++;
      assert.equal(hash(buffer), fontHash);
      assert.equal(extension, "woff2");
      assert.equal(preload, true);
      return `/_next/static/media/${fontHash}.woff2`;
    } });
  assert.equal(emitted, 1);
  assert.match(result.css, /font-display: swap/);
  assert.match(result.css, /font-weight: 100 900/);
  assert.match(result.css, /font-style: normal/);
  assert.ok(result.css.includes(`url(/_next/static/media/${fontHash}.woff2)`));
  assert.doesNotMatch(result.css, /https?:|googleapis|gstatic/);
  assert.equal(result.variable, "--font-vazirmatn");
  assert.deepEqual(result.fallbackFonts, ["Arial", "sans-serif"]);
  assert.equal(result.adjustFontFallback.fallbackFont, "Arial");
});

type ShapedFont = {
  familyName: string; version: string;
  variationAxes: { wght: { min: number; default: number; max: number } };
  availableFeatures: string[];
  hasGlyphForCodePoint: (codePoint: number) => boolean;
  glyphForCodePoint: (codePoint: number) => { id: number };
  layout: (text: string, features: string[]) => { glyphs: { id: number }[]; positions: { xAdvance: number }[] };
};

test("actual shipped variable font shapes Persian and supplies tabular Latin/Persian digits", () => {
  const font = (require("next/dist/compiled/@next/font/dist/fontkit").default as (buffer: Buffer) => ShapedFont)(fs.readFileSync(fontPath));
  assert.equal(font.familyName, "Vazirmatn");
  assert.equal(font.version, "Version 33.003");
  assert.deepEqual(font.variationAxes.wght, { name: "Weight", min: 100, default: 400, max: 900 });
  assert.ok(font.availableFeatures.includes("tnum"));
  for (const char of "سلام پ چ ژ گ ک ی ریال English IRR 0123456789 ۰۱۲۳۴۵۶۷۸۹ ٫٬−") {
    assert.ok(font.hasGlyphForCodePoint(char.codePointAt(0)!), `Missing ${char}`);
  }
  for (const digits of ["0123456789", "۰۱۲۳۴۵۶۷۸۹"]) {
    const widths = [...digits].map(digit => font.layout(digit, ["tnum"]).positions.reduce((sum, position) => sum + position.xAdvance, 0));
    assert.equal(new Set(widths).size, 1);
    assert.ok(widths[0] > 0);
  }
  const proportionalPersian = [..."۰۱۲۳۴۵۶۷۸۹"].map(digit => font.layout(digit, []).positions[0].xAdvance);
  assert.ok(new Set(proportionalPersian).size > 1); // Proves tnum is meaningful for Persian.
  const text = "سلام";
  const isolated = [...text].map(char => font.glyphForCodePoint(char.codePointAt(0)!).id);
  const joined = font.layout(text, ["tnum"]).glyphs.map(glyph => glyph.id);
  assert.ok(joined.every(id => id !== 0));
  assert.notDeepEqual(joined, isolated); // Contextual Persian shaping, not codepoint substitution.
});

test("actual root retains every selected font and exact control/identifier text in all four presentations", async () => {
  const identifier = "INV-2026/001 شناسه <caller>";
  for (const language of ["en-US", "fa-IR"] as const) for (const numerals of ["latn", "arabext"] as const) {
    for (const fontFamily of FONT_FAMILIES) {
      const p = resolvePresentation({ user: { language, numerals, fontFamily } });
      const { Layout } = loadRoot(p);
      const html = renderToStaticMarkup(await Layout({ children: React.createElement(React.Fragment, null,
        React.createElement(CurrencyInput, { value: "1234567.89", onChange: () => {}, name: "amountMajor", "aria-label": "Exact amount" }),
        React.createElement(IdentifierText, null, identifier),
        React.createElement("code", null, "IRR 9223372036854775807 فارسی")) }));
      assert.ok(html.includes(`<html lang="${language}" dir="${language === "fa-IR" ? "rtl" : "ltr"}"`));
      assert.ok(html.includes('class="local-vazirmatn antialiased' + (fontFamily === "vazirmatn" ? '"' : ` font-${fontFamily}"`)));
      assert.ok(html.includes('style="--font-geist-mono:Geist_Mono"'));
      assert.match(html, /type="hidden" name="amountMajor" value="1234567\.89"/);
      assert.ok(html.includes(`value="${numerals === "arabext" ? "۱۲۳۴۵۶۷٫۸۹" : "1234567.89"}"`));
      assert.ok(html.includes("INV-2026/001 شناسه &lt;caller&gt;"));
      assert.ok(html.includes("IRR 9223372036854775807 فارسی"));
      assert.ok(html.includes("font-mono tabular-nums"));
    }
  }
});

test("compiled typography inherits tabular digits and retains per-character selected-site monospace fallback", async () => {
  const source = fs.readFileSync("app/globals.css", "utf8");
  const theme = fs.readFileSync(require.resolve("tailwindcss/theme.css"), "utf8");
  const compiler = await compile(theme + source.replace(/^@import[^\n]+\n/gm, "") + "\n@tailwind utilities;");
  const css = compiler.build(["font-mono", "font-sans", "tabular-nums"]);
  assert.match(css, /body\s*\{[^}]*font-variant-numeric: tabular-nums;/s);
  assert.match(css, /\.font-sans\s*\{\s*font-family: var\(--font-site\);/);
  assert.match(css, /\.font-mono\s*\{\s*font-family: var\(--font-geist-mono\), var\(--font-site\), monospace;/);
  assert.match(css, /code, kbd, samp, pre\s*\{\s*font-family: var\(--font-geist-mono\), var\(--font-site\), monospace;/);
  assert.ok(css.includes("--font-site: var(--font-vazirmatn), sans-serif;"));
  for (const [tag, family] of [["abar", "Abar"], ["filimo", "Filimo"], ["estedad", "Estedad"], ["iransansx", "IRANSansX"], ["digikala", "Digikala"]]) {
    assert.ok(css.includes(`body.font-${tag}`));
    assert.ok(css.includes(`--font-site: "${family}", sans-serif;`));
    assert.ok(css.includes(`font-family: "${family}", sans-serif !important;`));
  }
  assert.doesNotMatch(css, /@import|url\(\s*["']?https?:\/\//);
});
