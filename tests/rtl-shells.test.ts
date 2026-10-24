import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as radix from "radix-ui";
import * as nextIntl from "next-intl";
import { compile } from "tailwindcss";
import ts from "typescript";
import { AppRouterContext, type AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { PresentationProvider } from "../i18n/provider";
import { resolvePresentation, type Presentation } from "../i18n/locale";
import { renderWithPresentation } from "./helpers/presentation";
import { TestSession } from "./helpers/session";
import * as actualSidebar from "../components/ui/sidebar";
import { AppSidebar } from "../components/dashboard/sidebar";
import { CreateDrawerProvider } from "../components/dashboard/create-drawer";
import { Topbar } from "../components/dashboard/topbar";
import { AdminNavigation } from "../components/admin/navigation";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const h = React.createElement;
const now = new Date("2026-10-24T00:00:00Z");
const presentations = (["en-US", "fa-IR"] as const).flatMap(language =>
  (["latn", "arabext"] as const).map(numerals => resolvePresentation({ user: { language, numerals } })));
const noop = () => {};
const routes: string[] = [];
const router: AppRouterInstance = { back: () => routes.push("back"), push: path => routes.push(path),
  replace: noop, refresh: noop, forward: noop, prefetch: noop };
function render(node: React.ReactNode, p: Presentation) {
  return renderToStaticMarkup(h(PresentationProvider, { presentation: p,
    messages: p.locale === "fa-IR" ? fa : en, now }, node));
}
function routed(node: React.ReactNode, pathname = "/dashboard") {
  return h(AppRouterContext.Provider, { value: router },
    h(PathnameContext.Provider, { value: pathname }, h(TestSession, null, node)));
}
function opening(html: string, slot: string) {
  const tag = html.match(new RegExp(`<[^>]+data-slot="${slot}"[^>]*>`))?.[0];
  assert.ok(tag, `Missing ${slot}`);
  return tag;
}

// Real source and installed Direction/Sheet/Tooltip primitives. IO/media and
// portal insertion are controlled; no keyboard/focus implementation is replaced.
function load<T>(file: string, extra: Record<string, unknown> = {}) {
  const require = createRequire(resolve(file));
  const compiled = { exports: {} as T };
  const code = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  const moduleRequire = (id: string): unknown => {
    if (id in extra) return extra[id];
    if (id === "next-intl") return nextIntl;
    if (id === "radix-ui") return { ...radix, Dialog: { ...radix.Dialog,
      Portal: ({ children }: { children: React.ReactNode }) => h(React.Fragment, null, children) } };
    return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  };
  new Function("require", "module", "exports", code)(moduleRequire, compiled, compiled.exports);
  return compiled.exports;
}

test("real dashboard reserves its fixed sidebar on the same physical edge in English and Persian", () => {
  for (const language of ["en-US", "fa-IR"] as const) {
    const html = renderWithPresentation(routed(h(actualSidebar.SidebarProvider, null,
      h(CreateDrawerProvider, null, h(AppSidebar), h(actualSidebar.SidebarInset, null,
        h(Topbar), h("article", null, "IRR 9223372036854775807 caller@example.test"))))), language);
    const side = language === "fa-IR" ? "right" : "left";
    assert.ok(opening(html, "sidebar-wrapper").includes(`dir="${language === "fa-IR" ? "rtl" : "ltr"}"`));
    const sidebar = opening(html, "sidebar");
    assert.ok(sidebar.includes(`data-side="${side}"`));
    assert.ok(sidebar.includes('data-placement="start"'));
    assert.ok(sidebar.includes("shrink-0"));
    const panel = opening(html, "sidebar-container");
    assert.ok(panel.includes(`${side}-0`));
    assert.ok(!panel.includes(side === "right" ? "left-0" : "right-0"));
    assert.ok(opening(html, "sidebar-gap").includes("w-(--sidebar-width)"));
    assert.ok(opening(html, "sidebar-inset").includes("min-w-0"));
    assert.ok(opening(html, "sidebar-inset").includes("flex-1"));
    for (const path of ["/dashboard", "/sales", "/purchases", "/reports", "/settings", "/docs"])
      assert.ok(html.includes(`href="${path}"`), path);
    assert.ok(html.indexOf('href="/dashboard"') < html.indexOf('href="/sales"'));
    assert.ok(html.indexOf('href="/sales"') < html.indexOf('data-slot="sidebar-inset"'));
    assert.ok(html.includes("IRR 9223372036854775807 caller@example.test"));
    assert.ok(html.includes("&lt;script&gt;user&lt;/script&gt;"));
    assert.ok(!/tabindex="[1-9]/.test(html));
    assert.ok(!/lucide-(plus|menu|gauge|settings)[^>]*(rotate|scale-x)/.test(html));
  }
});

test("sidebar gap and side stay paired for physical/logical/local overrides and all collapse modes", () => {
  for (const p of presentations) for (const providerDir of ["ltr", "rtl"] as const) {
    for (const dir of [undefined, "ltr", "rtl"] as const) for (const side of [undefined, "start", "end", "left", "right"] as const) {
      const localDir = dir ?? providerDir;
      const expected = side === "left" || side === "right" ? side
        : side === "end" ? localDir === "rtl" ? "left" : "right"
        : localDir === "rtl" ? "right" : "left";
      for (const collapsible of ["offcanvas", "icon", "none"] as const) {
        const html = render(h(actualSidebar.SidebarProvider, { dir: providerDir, open: false },
          h(actualSidebar.Sidebar, { side, dir, collapsible, variant: "inset" }, "First nav"),
          h(actualSidebar.SidebarInset, null, "Last content")), p);
        const sidebar = opening(html, "sidebar");
        assert.ok(sidebar.includes(`data-side="${expected}"`));
        assert.ok(sidebar.includes(`data-placement="${expected === (providerDir === "rtl" ? "right" : "left") ? "start" : "end"}"`));
        assert.ok(sidebar.includes("data-[placement=end]:order-2"));
        assert.ok(html.indexOf("First nav") < html.indexOf("Last content"));
        if (collapsible !== "none") {
          assert.ok(sidebar.includes(`data-collapsible="${collapsible}"`));
          assert.ok(opening(html, "sidebar-container").includes(`${expected}-0`));
          assert.ok(opening(html, "sidebar-gap").includes("group-data-[collapsible=offcanvas]:w-0"));
          assert.ok(opening(html, "sidebar-gap").includes("group-data-[collapsible=icon]"));
        }
      }
    }
  }
});

test("mobile sidebar passes the resolved start/physical side and direction to real Sheet content", () => {
  const sheet = load<typeof import("../components/ui/sheet")>("components/ui/sheet.tsx");
  const mobile = load<typeof actualSidebar>("components/ui/sidebar.tsx", {
    "@/hooks/use-mobile": { useIsMobile: () => true },
    "@/components/ui/sheet": { ...sheet,
      Sheet: (props: React.ComponentProps<typeof sheet.Sheet>) => h(sheet.Sheet, { ...props, open: true }) },
  });
  for (const p of presentations) for (const side of [undefined, "start", "end", "left", "right"] as const) {
    const dir = p.locale === "fa-IR" ? "rtl" : "ltr";
    const expected = side === "left" || side === "right" ? side
      : side === "end" ? dir === "rtl" ? "left" : "right" : dir === "rtl" ? "right" : "left";
    const html = render(h(mobile.SidebarProvider, null,
      h(mobile.Sidebar, { side }, h("a", { href: "/sales" }, "First"), h("a", { href: "/settings" }, "Last"))), p);
    assert.ok(html.includes('role="dialog"'));
    assert.ok(html.includes('aria-describedby="'));
    assert.ok(html.includes(`data-side="${expected}"`));
    assert.ok(html.includes(`dir="${dir}"`));
    assert.ok(html.includes(`slide-in-from-${expected}`));
    assert.ok(!html.includes('data-slot="sidebar-gap"'));
    assert.ok(html.indexOf('href="/sales"') < html.indexOf('href="/settings"'));
  }
});

test("sidebar trigger/rail preserve controlled toggle callback and cookie contract", () => {
  const require = createRequire(import.meta.url);
  const runtime = require("react/jsx-runtime");
  const clicks: Record<string, React.MouseEventHandler<HTMLButtonElement>> = {};
  const wrap = (original: typeof runtime.jsx) => (type: unknown, props: Record<string, unknown>, key: unknown) => {
    if (typeof props["data-slot"] === "string" && typeof props.onClick === "function")
      clicks[props["data-slot"] as string] = props.onClick as React.MouseEventHandler<HTMLButtonElement>;
    return original(type, props, key);
  };
  const sidebar = load<typeof actualSidebar>("components/ui/sidebar.tsx", {
    "@/hooks/use-mobile": { useIsMobile: () => false },
    "react/jsx-runtime": { ...runtime, jsx: wrap(runtime.jsx), jsxs: wrap(runtime.jsxs) },
  });
  const original = Object.getOwnPropertyDescriptor(globalThis, "document");
  try {
    const doc = { cookie: "" };
    Object.defineProperty(globalThis, "document", { configurable: true, value: doc });
    for (const p of presentations) {
      const calls: (string | boolean)[] = [];
      const html = render(h(sidebar.SidebarProvider, { open: true, onOpenChange: value => calls.push(value) },
        h(sidebar.SidebarTrigger, { onClick: () => calls.push("caller") }),
        h(sidebar.Sidebar, null, h(sidebar.SidebarRail))), p);
      clicks["sidebar-trigger"]({} as React.MouseEvent<HTMLButtonElement>);
      clicks["sidebar-rail"]({} as React.MouseEvent<HTMLButtonElement>);
      assert.deepEqual(calls, ["caller", false, false]);
      assert.equal(doc.cookie, "sidebar_state=false; path=/; max-age=604800");
      assert.ok(html.includes(p.locale === "fa-IR" ? "lucide-panel-right" : "lucide-panel-left"));
      assert.ok(html.includes('tabindex="-1"'));
    }
  } finally {
    if (original) Object.defineProperty(globalThis, "document", original);
    else Reflect.deleteProperty(globalThis, "document");
  }
});

test("collapsed sidebar tooltips open toward content and retain explicit caller overrides", () => {
  const require = createRequire(import.meta.url);
  const tooltip = require("../components/ui/tooltip") as typeof import("../components/ui/tooltip");
  const sidebar = load<typeof actualSidebar>("components/ui/sidebar.tsx", {
    "@/hooks/use-mobile": { useIsMobile: () => false },
    "@/components/ui/tooltip": { ...tooltip,
      TooltipContent: (props: React.ComponentProps<typeof tooltip.TooltipContent>) =>
        h("span", { "data-tooltip-side": props.side, hidden: props.hidden }, props.children) },
  });
  for (const p of presentations) for (const side of ["left", "right"] as const) {
    const html = render(h(sidebar.SidebarProvider, { open: false },
      h(sidebar.Sidebar, { side, collapsible: "icon" },
        h(sidebar.SidebarMenuButton, { tooltip: "Default" }, "First"),
        h(sidebar.SidebarMenuButton, { tooltip: { children: "Override", side: "bottom" } }, "Last"))), p);
    assert.ok(html.includes(`data-tooltip-side="${side === "right" ? "left" : "right"}"`));
    assert.ok(html.includes('data-tooltip-side="bottom"'));
    assert.ok(html.indexOf(">First</button>") < html.indexOf(">Last</button>"));
  }
});

test("actual admin shell keeps links/permission and semantic order while using logical chrome", () => {
  for (const locale of ["en-US", "fa-IR"] as const) {
    const html = renderWithPresentation(routed(h(AdminNavigation, { allowed: true }, "Caller body"), "/admin"), locale);
    assert.ok(html.includes("border-e bg-sidebar"));
    assert.ok(html.includes("ms-auto"));
    assert.ok(html.includes("[&amp;:dir(rtl)]:rotate-180"));
    for (const route of ["/admin", "/admin/users", "/admin/organizations", "/admin/settings", "/dashboard"])
      assert.ok(html.includes(`href="${route}"`));
    assert.ok(html.indexOf('href="/admin/users"') < html.indexOf('href="/admin/organizations"'));
    assert.ok(html.indexOf("<aside") < html.indexOf("Caller body"));
    assert.ok(!/lucide-(users|settings|building-2)[^>]*(rotate|scale-x)/.test(html));
    const denied = renderWithPresentation(routed(h(AdminNavigation, { allowed: false }, "Secret body"), "/admin"), locale);
    assert.ok(!denied.includes("Secret body"));
    assert.ok(!denied.includes('href="/admin/users"'));
  }
});

test("installed CSS preserves nonshrinking sidebar reservation, constrained content and physical collapse edges", async () => {
  const compiler = await compile("@theme { --spacing: .25rem; --breakpoint-md: 48rem; } @tailwind utilities;");
  const css = compiler.build(["flex", "shrink-0", "flex-1", "min-w-0", "w-(--sidebar-width)",
    "left-0", "right-0", "data-[placement=end]:order-2", "group-data-[collapsible=offcanvas]:w-0",
    "group-data-[collapsible=icon]:w-(--sidebar-width-icon)",
    "group-data-[collapsible=offcanvas]:right-[calc(var(--sidebar-width)*-1)]",
    "group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)]", "border-e", "end-1", "text-start"]);
  for (const declaration of ["display: flex", "flex-shrink: 0", "flex: 1", "min-width: calc(var(--spacing) * 0)", "width: var(--sidebar-width)",
    "right: calc(var(--sidebar-width) * -1)", "left: calc(var(--sidebar-width) * -1)", "order: 2", "width: calc(var(--spacing) * 0)",
    "width: var(--sidebar-width-icon)", "border-inline-end-width", "inset-inline-end", "text-align: start"])
    assert.ok(css.includes(declaration), declaration);
  // The fixed panel and nonshrinking gap share the configured width. Flex-1 +
  // min-width:0 lets main occupy only the remainder, including overflowing tables.
  assert.ok(!css.includes("row-reverse"));
});
