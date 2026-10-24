import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Direction } from "radix-ui";
import { RootProvider as DocumentationProvider } from "fumadocs-ui/provider/base";
import { FrameworkProvider } from "fumadocs-core/framework";
import { Search, Check } from "lucide-react";
import ts from "typescript";
import { localeDirection, resolvePresentation, type Presentation } from "../i18n/locale";
import { PresentationProvider, usePresentation } from "../i18n/provider";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Select, SelectTrigger, SelectValue } from "../components/ui/select";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const now = new Date("2026-10-24T00:00:00Z");
const preferences = (["en-US", "fa-IR"] as const).flatMap(language =>
  (["latn", "arabext"] as const).map(numerals => resolvePresentation({ user: { language, numerals } })));
const canonical = { currency: "IRR", amountMinor: "9223372036854775807", id: "journal-first", email: "user@example.test" };
// createElement's variadic children do not satisfy a required children prop in
// this library's declaration; the actual child is supplied as the third arg.
const FrameworkBoundary = FrameworkProvider as React.ComponentType<Omit<React.ComponentProps<typeof FrameworkProvider>, "children"> & {
  children?: React.ReactNode;
}>;

function Probe() {
  const presentation = usePresentation();
  const direction = Direction.useDirection();
  return React.createElement("output", { "data-direction": direction, "data-locale": presentation.locale,
    "data-numerals": presentation.numerals }, JSON.stringify(canonical));
}

function PrimitiveFixture({ dir }: { dir?: "ltr" | "rtl" }) {
  return React.createElement(React.Fragment, null,
    React.createElement(Tabs, { defaultValue: "first", dir },
      React.createElement(TabsList, { "aria-label": "Caller tabs" },
        React.createElement(TabsTrigger, { value: "first" }, "First"),
        React.createElement(TabsTrigger, { value: "last" }, "Last")),
      React.createElement(TabsContent, { value: "first" }, "First panel")),
    React.createElement(Select, { defaultValue: "IRR", dir },
      React.createElement(SelectTrigger, { "aria-label": "Caller currency" }, React.createElement(SelectValue, null, "IRR"))),
    React.createElement(Probe),
    React.createElement(Search, { "aria-label": "universal-search" }),
    React.createElement(Check, { "aria-label": "universal-check" }));
}

function render(node: React.ReactNode, presentation: Presentation) {
  return renderToStaticMarkup(React.createElement(PresentationProvider, { presentation,
    messages: presentation.locale === "fa-IR" ? fa : en, now }, node));
}

test("actual primitive roots inherit language direction independently of numeral preferences", () => {
  for (const presentation of preferences) {
    const expected = presentation.locale === "fa-IR" ? "rtl" : "ltr";
    const html = render(React.createElement(PrimitiveFixture), presentation);
    assert.equal(localeDirection(presentation.locale), expected);
    assert.match(html, new RegExp(`dir="${expected}" data-orientation="horizontal" data-slot="tabs"`));
    assert.match(html, new RegExp(`<button[^>]*role="combobox"[^>]*dir="${expected}"`));
    assert.ok(html.includes(`data-direction="${expected}"`));
    assert.ok(html.includes(`data-numerals="${presentation.numerals}"`));
    assert.ok(html.indexOf(">First</button>") < html.indexOf(">Last</button>"));
    assert.ok(!/tabindex="[1-9]/.test(html));
    assert.ok(html.includes("focus-visible:ring-"));
    assert.ok(html.includes("9223372036854775807"));
    assert.ok(html.includes("user@example.test"));
    assert.ok(!html.includes("scale-x-"));
    assert.ok(!html.includes("rotate-180"));
    for (const name of ["universal-search", "universal-check"]) assert.ok(html.includes(`aria-label="${name}"`));
  }
  assert.equal(canonical.currency, "IRR");
});

test("explicit primitive overrides and nested direction scopes remain independent", () => {
  for (const presentation of preferences) {
    const explicit = presentation.locale === "fa-IR" ? "ltr" : "rtl";
    const html = render(React.createElement(PrimitiveFixture, { dir: explicit }), presentation);
    assert.match(html, new RegExp(`dir="${explicit}" data-orientation="horizontal" data-slot="tabs"`));
    assert.match(html, new RegExp(`<button[^>]*role="combobox"[^>]*dir="${explicit}"`));
    // A primitive override does not rewrite the enclosing presentation/context.
    assert.ok(html.includes(`data-direction="${localeDirection(presentation.locale)}"`));
    const nested = render(React.createElement(Direction.Provider, { dir: explicit }, React.createElement(Probe)), presentation);
    assert.ok(nested.includes(`data-direction="${explicit}"`));
    assert.ok(nested.includes(`data-locale="${presentation.locale}"`));
  }
});

test("serialized presentation preserves actual provider/primitive markup and canonical text", () => {
  for (const presentation of preferences) {
    const before = render(React.createElement(PrimitiveFixture), presentation);
    const restored = JSON.parse(JSON.stringify(presentation)) as Presentation;
    assert.equal(render(React.createElement(PrimitiveFixture), restored), before);
    assert.equal(restored.numerals, presentation.numerals);
    assert.equal(restored.calendar, presentation.calendar);
  }
});

// Execute the actual async root JSX with only request/font/session/framework I/O
// controlled. Use the real installed documentation base provider: its default
// LTR DirectionProvider must not silently override the application's RTL scope.
function rootLayout(presentation: Presentation) {
  const file = "app/layout.tsx", require = createRequire(resolve(file));
  const compiled = { exports: {} as { default: (props: { children: React.ReactNode }) => Promise<React.ReactElement> } };
  const passthrough = ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children);
  const code = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  const load = (id: string): unknown => {
    if (id.endsWith(".css")) return {};
    if (id === "next/font/google") return Object.fromEntries(["Geist_Mono", "Playfair_Display", "Vazirmatn"].map(name =>
      [name, () => ({ variable: `font-${name}`, className: `font-${name}`, style: { fontFamily: name } })]));
    if (id === "next-auth/react") return { SessionProvider: passthrough };
    if (id === "@/components/shared/theme-provider") return { ThemeProvider: passthrough };
    if (id === "@/i18n/server") return { getPresentation: async () => presentation };
    if (id === "@/i18n/provider") return { PresentationProvider };
    if (id === "@/i18n/locale") return { localeDirection };
    if (id === "next-intl/server") return { getMessages: async () => presentation.locale === "fa-IR" ? fa : en,
      getNow: async () => now, getTranslations: async () => (key: string) => key };
    if (id === "fumadocs-ui/provider/next") return { RootProvider: (props: React.ComponentProps<typeof DocumentationProvider>) =>
      React.createElement(FrameworkBoundary, {
        usePathname: () => "/docs", useParams: () => ({}), useRouter: () => ({ push: () => {}, refresh: () => {} }),
      }, React.createElement(DocumentationProvider, { ...props, theme: { enabled: false }, search: { enabled: false } })) };
    if (id === "sonner") return { Toaster: (props: { dir: string; position: string }) =>
      React.createElement("output", { "data-toaster-direction": props.dir, "data-toaster-position": props.position }) };
    return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  };
  new Function("require", "module", "exports", code)(load, compiled, compiled.exports);
  return compiled.exports.default;
}

test("actual document, nested documentation Radix scope and notifications use one resolved direction", async () => {
  for (const presentation of preferences) {
    const Layout = rootLayout(presentation);
    const html = renderToStaticMarkup(await Layout({ children: React.createElement(PrimitiveFixture) }));
    const expected = presentation.locale === "fa-IR" ? "rtl" : "ltr";
    assert.ok(html.includes(`<html lang="${presentation.locale}" dir="${expected}"`));
    assert.ok(html.includes(`data-direction="${expected}"`));
    assert.match(html, new RegExp(`dir="${expected}" data-orientation="horizontal" data-slot="tabs"`));
    assert.ok(html.includes(`data-toaster-direction="${expected}"`));
    assert.ok(html.includes(`data-toaster-position="bottom-${expected === "rtl" ? "left" : "right"}"`));
    assert.ok(html.includes("9223372036854775807"));
    assert.ok(html.indexOf(">First</button>") < html.indexOf(">Last</button>"));
  }
});
