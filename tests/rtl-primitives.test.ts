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
import { PresentationProvider, usePresentation } from "../i18n/provider";
import { resolvePresentation, type Presentation } from "../i18n/locale";
import { dateOnlyToDate, dateToDateOnly } from "../i18n/dates";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Switch } from "../components/ui/switch";
import { DualAmount } from "../components/ui/dual-amount";
import { BreadcrumbSeparator, BreadcrumbEllipsis } from "../components/ui/breadcrumb";
import { Table, TableHeader, TableRow, TableHead } from "../components/ui/table";
import { Input } from "../components/ui/input";
import { Calendar } from "../components/ui/calendar";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const presentations = (["en-US", "fa-IR"] as const).flatMap(language =>
  (["latn", "arabext"] as const).map(numerals => resolvePresentation({ user: { language, numerals } })));
const now = new Date("2026-10-24T00:00:00Z");
const h = React.createElement;
function render(node: React.ReactNode, p: Presentation) {
  return renderToStaticMarkup(h(PresentationProvider, { presentation: p,
    messages: p.locale === "fa-IR" ? fa : en, now }, node));
}

// Execute real source/installed primitives. Only portals are made inline for
// SSR; their Content, scopes, semantics and keyboard implementations stay real.
function loadUi<T>(name: string, extra: Record<string, unknown> = {}) {
  const file = `components/ui/${name}.tsx`, require = createRequire(resolve(file));
  const compiled = { exports: {} as T };
  const inline = ({ children }: { children: React.ReactNode }) => h(React.Fragment, null, children);
  const code = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  const load = (id: string): unknown => {
    if (id in extra) return extra[id];
    if (id === "next-intl") return nextIntl;
    if (id === "@/i18n/provider") return { PresentationProvider, usePresentation };
    if (id === "radix-ui") return { ...radix,
      Dialog: { ...radix.Dialog, Portal: inline },
      DropdownMenu: { ...radix.DropdownMenu, Portal: inline },
      Select: { ...radix.Select, Portal: inline } };
    return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  };
  new Function("require", "module", "exports", code)(load, compiled, compiled.exports);
  return compiled.exports;
}
const sheet = loadUi<typeof import("../components/ui/sheet")>("sheet");
const dialog = loadUi<typeof import("../components/ui/dialog")>("dialog");
const menu = loadUi<typeof import("../components/ui/dropdown-menu")>("dropdown-menu");
const select = loadUi<typeof import("../components/ui/select")>("select");

function sheetFixture(props: React.ComponentProps<typeof sheet.SheetContent> = {}) {
  return h(sheet.Sheet, { open: true },
    h(sheet.SheetTrigger, null, "Open"),
    h(sheet.SheetContent, { forceMount: true, ...props },
      h(sheet.SheetTitle, null, "Caller & title"),
      h(sheet.SheetDescription, null, "Caller description"),
      h("input", { name: "currency", defaultValue: "IRR", dir: "ltr" }),
      h("button", { type: "button" }, "Save")));
}

test("actual sheet defaults to logical end and preserves all physical/explicit direction overrides", () => {
  for (const p of presentations) {
    const direction = p.locale === "fa-IR" ? "rtl" : "ltr";
    for (const side of [undefined, "start", "end", "left", "right", "top", "bottom"] as const) {
      const physical = side === "start" ? direction === "rtl" ? "right" : "left"
        : !side || side === "end" ? direction === "rtl" ? "left" : "right" : side;
      const html = render(sheetFixture({ side }), p);
      assert.ok(html.includes(`data-side="${physical}"`));
      assert.ok(html.includes(`dir="${direction}"`));
      assert.ok(html.includes(`slide-in-from-${physical}`));
      assert.ok(html.includes(`slide-out-to-${physical}`));
      assert.ok(html.includes("end-4"));
      assert.ok(html.includes("focus:ring-2"));
      assert.ok(html.includes("Caller &amp; title"));
      assert.match(html, /<input[^>]*dir="ltr"[^>]*value="IRR"/);
      assert.ok(html.indexOf('name="currency"') < html.indexOf(">Save</button>"));
      assert.ok(!/tabindex="[1-9]/.test(html));
      assert.ok(!/scale-x|rotate-180/.test(html)); // Close X is universal.
    }
    const opposite = direction === "rtl" ? "ltr" : "rtl";
    const explicit = render(sheetFixture({ dir: opposite }), p);
    assert.ok(explicit.includes(`data-side="${opposite === "rtl" ? "left" : "right"}"`));
    const nested = render(h(radix.Direction.Provider, { dir: opposite }, sheetFixture()), p);
    assert.ok(nested.includes(`data-side="${opposite === "rtl" ? "left" : "right"}"`));
  }
});

test("real dialog/menu/select content retains semantics, logical indicators, caller order and overrides", () => {
  for (const p of presentations) {
    const dir = p.locale === "fa-IR" ? "ltr" : "rtl";
    const html = render(h(React.Fragment, null,
      h(dialog.Dialog, { open: true }, h(dialog.DialogTrigger, null, "Dialog"),
        h(dialog.DialogContent, { forceMount: true },
          h(dialog.DialogHeader, null, h(dialog.DialogTitle, null, "First title"),
            h(dialog.DialogDescription, null, "Description")), h("button", null, "Last action"))),
      h(menu.DropdownMenu, { open: true, dir },
        h(menu.DropdownMenuTrigger, null, "Menu"),
        h(menu.DropdownMenuContent, { forceMount: true, side: "right" },
          h(menu.DropdownMenuCheckboxItem, { checked: true }, "First checkbox"),
          h(menu.DropdownMenuItem, { disabled: true }, "Disabled"),
          h(menu.DropdownMenuRadioGroup, { value: "IRR" },
            h(menu.DropdownMenuRadioItem, { value: "IRR" }, "Rial choice")),
          h(menu.DropdownMenuSub, null, h(menu.DropdownMenuSubTrigger, null, "Child menu")),
          h(menu.DropdownMenuShortcut, null, "Ctrl+K"))),
      h(select.Select, { open: true, value: "IRR", dir },
        h(select.SelectTrigger, null, h(select.SelectValue, null, "IRR")),
        h(select.SelectContent, null, h(select.SelectItem, { value: "IRR" }, "Rial")))), p);
    assert.ok(html.includes("sm:text-start"));
    assert.ok(html.includes("top-[50%] left-[50%]")); // Physical centered dialog stays centered.
    assert.ok(html.includes("translate-x-[-50%]"));
    assert.ok(html.includes("end-4"));
    assert.ok(html.includes('role="menuitemcheckbox"'));
    assert.ok(html.includes('role="menuitemradio"'));
    assert.ok(html.includes('aria-checked="true"'));
    assert.ok(html.includes('aria-disabled="true"'));
    assert.ok(html.includes('role="option"'));
    assert.ok(html.includes(`dir="${dir}"`));
    assert.ok(html.includes("start-2"));
    assert.ok(html.includes("end-2"));
    assert.ok(html.includes("ps-8"));
    assert.ok(html.includes("pe-8"));
    assert.ok(html.includes("ms-auto"));
    assert.ok(html.includes("[&amp;:dir(rtl)]:rotate-180"));
    assert.ok(html.includes("data-[side=right]:slide-in-from-left-2"));
    assert.ok(html.indexOf("First checkbox") < html.indexOf("Child menu"));
    assert.ok(html.indexOf("First title") < html.indexOf("Last action"));
    assert.ok(!/tabindex="[1-9]/.test(html));
  }
});

test("actual tabs/switch/table/breadcrumb preserve order, local direction, focus styles and universal icons", () => {
  for (const p of presentations) {
    for (const dir of ["ltr", "rtl"] as const) {
      const html = render(h("section", { dir },
        h(Tabs, { dir, defaultValue: "first", orientation: "vertical" },
          h(TabsList, { variant: "line", "aria-label": "Ordered tabs" },
            h(TabsTrigger, { value: "first" }, "First"),
            h(TabsTrigger, { value: "blocked", disabled: true }, "Blocked"),
            h(TabsTrigger, { value: "last" }, "Last")),
          h(TabsContent, { value: "first" }, "Panel")),
        h(Switch, { dir, checked: true, "aria-label": "Enable" }),
        h(Table, null, h(TableHeader, null, h(TableRow, null,
          h(TableHead, null, "Name"), h(TableHead, { className: "text-right", dir: "ltr" }, "IRR 1250")))),
        h("ol", null, h(BreadcrumbSeparator), h("li", null, h(BreadcrumbEllipsis)),
          h(BreadcrumbSeparator, null, h("span", null, "/")))), p);
      const toggle = html.match(/<button[^>]*role="switch"[^>]*>/)?.[0];
      assert.ok(toggle?.includes(`dir="${dir}"`));
      assert.ok(toggle?.includes('data-state="checked"'));
      assert.ok(html.includes("[&amp;:dir(rtl)]:data-[state=checked]:-translate-x-4"));
      assert.ok(html.includes("after:-end-1"));
      assert.ok(html.includes("focus-visible:ring-"));
      assert.ok(html.includes("disabled="));
      assert.ok(html.includes("text-start"));
      assert.ok(html.includes('text-right'));
      assert.ok(html.includes("IRR 1250"));
      assert.ok(html.indexOf(">First</button>") < html.indexOf(">Last</button>"));
      assert.ok(!/tabindex="[1-9]/.test(html));
      assert.match(html, /lucide-chevron-right[^>]*dir\(rtl\)/);
      assert.doesNotMatch(html, /lucide-ellipsis[^>]*(rotate|scale)/);
      assert.ok(html.includes("<span>/</span>")); // Caller-provided separator is untouched.
    }
  }
});

test("actual Calendar resolves default/after/around arrows once and retains canonical navigation/range/focus", () => {
  for (const p of presentations) for (const dir of ["ltr", "rtl"] as const) {
    for (const navLayout of [undefined, "after", "around"] as const) {
      const handlers: Record<string, React.MouseEventHandler<HTMLButtonElement> | undefined> = {};
      const changed: string[] = [];
      const html = render(h(Calendar, { dir, navLayout, mode: "range", defaultMonth: dateOnlyToDate("2024-03-01"),
        selected: { from: dateOnlyToDate("2024-03-10"), to: dateOnlyToDate("2024-03-12") },
        today: dateOnlyToDate("2024-03-20"), onMonthChange: date => changed.push(dateToDateOnly(date)),
        components: {
          PreviousMonthButton: props => { handlers.previous = props.onClick; return h("button", props); },
          NextMonthButton: props => { handlers.next = props.onClick; return h("button", props); },
        } }), { ...p, calendar: "gregory" });
      const previous = html.match(/<button[^>]*class="[^"]*rdp-button_previous[^>]*>[\s\S]*?<\/button>/)?.[0];
      const next = html.match(/<button[^>]*class="[^"]*rdp-button_next[^>]*>[\s\S]*?<\/button>/)?.[0];
      assert.ok(previous?.includes(`lucide-chevron-${dir === "rtl" ? "right" : "left"}`));
      assert.ok(next?.includes(`lucide-chevron-${dir === "rtl" ? "left" : "right"}`));
      assert.ok(!html.includes("rotate-180"));
      assert.ok(html.includes("rounded-s-md"));
      assert.ok(html.includes("rounded-e-md"));
      assert.ok(html.includes('data-day="2024-03-10"'));
      assert.ok(html.includes("focus"));
      handlers.previous?.({} as React.MouseEvent<HTMLButtonElement>);
      handlers.next?.({} as React.MouseEvent<HTMLButtonElement>);
      assert.deepEqual(changed, ["2024-02-01", "2024-04-01"]);
    }
  }
});

test("real search callbacks preserve caller text and clear behavior with logical adornments", () => {
  const require = createRequire(import.meta.url);
  const runtime = require("react/jsx-runtime");
  const actions: { input?: React.ComponentProps<typeof Input>; clear?: () => void } = {};
  const wrapJsx = (original: typeof runtime.jsx) => (type: unknown, props: Record<string, unknown>, key: unknown) => {
    if (type === "button" && props["aria-label"]) actions.clear = props.onClick as () => void;
    return original(type, props, key);
  };
  const { SearchInput } = loadUi<typeof import("../components/ui/search-input")>("search-input", {
    "@/components/ui/input": { Input: (props: React.ComponentProps<typeof Input>) => {
      actions.input = props; return h(Input, props);
    } },
    "react/jsx-runtime": { ...runtime, jsx: wrapJsx(runtime.jsx), jsxs: wrapJsx(runtime.jsxs) },
  });
  for (const p of presentations) {
    const values: string[] = [];
    const html = render(h(SearchInput, { value: "IRR & نمونه", onChange: value => values.push(value) }), p);
    assert.ok(html.includes("start-3"));
    assert.ok(html.includes("end-2.5"));
    assert.ok(html.includes("ps-9 pe-8"));
    assert.ok(html.includes("IRR &amp; نمونه"));
    assert.doesNotMatch(html, /rotate|scale-x/);
    actions.input?.onChange?.({ target: { value: "caller@example.test" } } as React.ChangeEvent<HTMLInputElement>);
    actions.clear?.();
    assert.deepEqual(values, ["caller@example.test", ""]);
  }
});

test("logical amount alignment preserves explicit physical totals and exact monetary text", () => {
  for (const p of presentations) for (const align of [undefined, "start", "end", "left", "right"] as const) {
    const html = render(h(DualAmount, { align, amount: -9223372036854775808n, currency: "USD" }), p);
    assert.ok(html.includes(align === "end" ? "items-end" : align === "right"
      ? "items-end [&amp;:dir(rtl)]:items-start" : align === "left"
        ? "items-start [&amp;:dir(rtl)]:items-end" : "items-start"));
    assert.ok(html.includes(p.numerals === "arabext" ? "۷۵۸٫۰۸" : "758.08"));
    assert.ok(html.includes("<bdi>"));
  }
});

test("installed Tailwind emits logical CSS and override-safe self-direction variants", async () => {
  const compiler = await compile("@theme { --spacing: 0.25rem; --radius-md: .375rem; } @tailwind utilities;");
  const css = compiler.build(["start-3", "end-2", "ps-9", "pe-8", "ms-auto", "rounded-s-md", "rounded-e-md",
    "-end-1", "-space-x-2", "[&:dir(rtl)]:rotate-180", "[&:dir(rtl)]:data-[state=checked]:-translate-x-4"]);
  for (const property of ["inset-inline-start:", "inset-inline-end:", "padding-inline-start:", "padding-inline-end:",
    "margin-inline-start:", "border-start-start-radius:", "border-end-end-radius:"]) assert.ok(css.includes(property));
  assert.ok(css.includes("&:dir(rtl)"));
  assert.ok(!css.includes('[dir="rtl"] *')); // Opposite local dir must beat the ancestor.
  assert.ok(css.includes("margin-inline-end:")); // Existing AvatarGroup space-x is already logical in Tailwind 4.
});
