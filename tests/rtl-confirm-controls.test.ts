import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import * as React from "react";
import * as jsx from "react/jsx-runtime";
import * as intl from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";
import { compile } from "tailwindcss";
import ts from "typescript";
import { PresentationProvider, usePresentation } from "../i18n/provider";
import { resolvePresentation, type Presentation } from "../i18n/locale";
import { useNumberPresentation } from "../i18n/use-numbers";
import { RateNote } from "../components/ui/rate-note";
import { Textarea } from "../components/ui/textarea";
import { Command, CommandInput, CommandShortcut } from "../components/ui/command";
import { DropdownMenuShortcut } from "../components/ui/dropdown-menu";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const h = React.createElement;
const presentations = (["en-US", "fa-IR"] as const).flatMap(language =>
  (["latn", "arabext"] as const).map(numerals => resolvePresentation({ user: { language, numerals } })));
const caller = "  \u0646\u0627\u0645 <caller>& ABC-001/ " + "long".repeat(40);
const escape = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
function render(node: React.ReactNode, p: Presentation) {
  return renderToStaticMarkup(h(PresentationProvider, { presentation: p,
    messages: p.locale === "fa-IR" ? fa : en, now: new Date("2026-10-25T00:00:00Z") }, node));
}
type Props = Record<string, unknown>;
function load<T>(file: string, extra: Record<string, unknown> = {}) {
  const require = createRequire(resolve(file));
  const compiled = { exports: {} as T };
  const code = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  new Function("require", "module", "exports", code)((id: string) => {
    if (id in extra) return extra[id];
    if (id === "next-intl") return intl;
    if (id === "@/i18n/provider") return { usePresentation };
    if (id === "@/i18n/use-numbers") return { useNumberPresentation };
    return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  }, compiled, compiled.exports);
  return compiled.exports;
}

test("actual confirmation hook retains cancel/success/retry promise semantics and exact escaped caller labels", async () => {
  for (const p of presentations) {
    const state: unknown[] = [false, false, {}];
    const resolver = { current: null };
    let cursor = 0;
    const controls: { type: unknown; props: Props }[] = [];
    const capture = (fn: typeof jsx.jsx) => (type: React.ElementType, props: Props, key?: string) => {
      controls.push({ type, props }); return fn(type, props, key);
    };
    const inline = ({ children }: { children: React.ReactNode }) => h("div", null, children);
    const { useConfirm } = load<typeof import("../lib/hooks/use-confirm")>("lib/hooks/use-confirm.tsx", {
      react: { ...React, useState: () => { const i = cursor++; return [state[i], (v: unknown) => { state[i] = v; }]; },
        useRef: () => resolver, useCallback: (fn: unknown) => fn },
      "react/jsx-runtime": { ...jsx, jsx: capture(jsx.jsx), jsxs: capture(jsx.jsxs) },
      "@/components/ui/dialog": new Proxy({}, { get: () => inline }),
    });
    let api!: ReturnType<typeof useConfirm>;
    function Harness() {
      // Capture the real hook's returned callbacks for this controlled render harness.
      // eslint-disable-next-line react-hooks/globals
      api = useConfirm(); return api.dialog;
    }
    function draw() { cursor = 0; controls.length = 0; return render(h(Harness), p); }
    const labels = (p.locale === "fa-IR" ? fa : en).SharedUI;
    assert.ok(draw().includes(labels.areYouSure));
    const cancelled = api.confirm(); draw();
    const buttons = () => controls.filter(c => c.props.onClick && c.props.type === "button");
    assert.equal(buttons().length, 2);
    (buttons()[0].props.onClick as () => void)();
    assert.equal(await cancelled, false);
    let calls = 0;
    const completed = api.confirm({ title: caller, description: caller, confirmLabel: caller, cancelLabel: caller,
      destructive: true, onConfirm: async () => { calls++; if (calls === 1) throw new Error("retry"); } });
    const html = draw();
    assert.equal((html.match(/data-slot="bidi-text"/g) ?? []).length, 4);
    assert.ok(html.includes(escape(caller))); assert.ok(html.includes("whitespace-normal"));
    await (buttons()[1].props.onClick as () => Promise<void>)();
    assert.equal(state[0], true); assert.equal(state[1], false); // rejection leaves promise/dialog retryable
    draw(); await (buttons()[1].props.onClick as () => Promise<void>)();
    assert.equal(await completed, true); assert.equal(calls, 2);
    const accepted = api.confirm(); draw(); await (buttons()[1].props.onClick as () => Promise<void>)();
    assert.equal(await accepted, true);
  }
});

test("search/command/text controls expose names, isolate technical shortcuts and preserve raw callbacks and overrides", () => {
  for (const p of presentations) {
    let clear: Props | undefined, input: Props | undefined;
    const capture = (fn: typeof jsx.jsx) => (type: React.ElementType, props: Props, key?: string) => {
      if (type === "button") clear = props;
      if (props["data-slot"] === "input" || props.value === caller) input = props;
      return fn(type, props, key);
    };
    const { SearchInput } = load<typeof import("../components/ui/search-input")>("components/ui/search-input.tsx", {
      "react/jsx-runtime": { ...jsx, jsx: capture(jsx.jsx), jsxs: capture(jsx.jsxs) },
    });
    const calls: string[] = [];
    const html = render(h("form", null, h(SearchInput, { value: caller, "aria-label": "Caller search",
      onChange: value => calls.push(value) })), p);
    assert.ok(html.includes('aria-label="Caller search"')); assert.ok(html.includes('dir="auto"'));
    assert.equal(clear?.type, "button");
    (input!.onChange as (e: unknown) => void)({ target: { value: caller } });
    (clear!.onClick as () => void)(); assert.deepEqual(calls, [caller, ""]);
    const controls = render(h(React.Fragment, null,
      h(Command, null, h(CommandInput, { placeholder: caller }), h(CommandShortcut, null, "Ctrl+K")),
      h(DropdownMenuShortcut, null, "Ctrl+Shift+K"),
      h(Textarea, { defaultValue: caller }), h(Textarea, { dir: "ltr", defaultValue: caller })), p);
    assert.ok(controls.includes('dir="auto"')); assert.ok(controls.includes('dir="ltr"'));
    assert.ok(controls.includes('data-slot="command-shortcut" dir="ltr"'));
    assert.ok(controls.includes('data-slot="dropdown-menu-shortcut" dir="ltr"'));
    assert.ok(controls.includes("[unicode-bidi:isolate]")); assert.ok(controls.includes(escape(caller)));
  }
});

test("rate note uses selected numerals and isolated raw date/currency identity without changing rate scale", () => {
  for (const p of presentations) {
    const status = { rate: 1234567, origin: "manual" as const, effectiveDate: "2026-10-25", ageDays: 2, stale: true, missing: false };
    const html = render(h(RateNote, { currency: "EUR", baseCurrency: "USD", status }), p);
    assert.ok(html.includes(new Intl.NumberFormat(p.locale, { numberingSystem: p.numerals, maximumFractionDigits: 6 }).format(1.234567)));
    assert.ok(html.includes('data-slot="identifier-text" dir="ltr"'));
    assert.ok(html.includes(">2026-10-25</bdi>"));
    assert.ok(html.includes((p.locale === "fa-IR" ? fa : en).SharedUI.manualRate));
    const missing = render(h(RateNote, { currency: "EUR", baseCurrency: "USD", status: { ...status, missing: true } }), p);
    assert.ok(missing.includes('href="/tax/currencies"')); assert.ok(missing.includes('data-slot="bidi-text"'));
    assert.equal(render(h(RateNote, { currency: "USD", baseCurrency: "USD", status }), p), "");
    assert.equal(status.rate, 1234567); assert.equal(status.effectiveDate, "2026-10-25");
  }
});

test("installed CSS permits bounded long copy, shrinkable titles, wrapping confirmation actions and isolated shortcuts", async () => {
  const css = (await compile('@theme { --spacing: .25rem; --breakpoint-sm: 40rem; } @tailwind utilities;')).build([
    "min-w-0", "[overflow-wrap:anywhere]", "whitespace-normal", "h-auto", "min-h-9", "sm:flex-wrap",
    "[unicode-bidi:isolate]", "max-w-[min(24rem,calc(100vw-2rem))]", "-space-x-2",
  ]);
  for (const value of ["overflow-wrap: anywhere", "unicode-bidi: isolate", "white-space: normal", "min-width:", "flex-wrap: wrap", "max-width: min(", "margin-inline-end:"])
    assert.ok(css.includes(value), value);
});
