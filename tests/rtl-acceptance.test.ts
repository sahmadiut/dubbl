import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { compile } from "tailwindcss";
import { PresentationProvider } from "../i18n/provider";
import { resolvePresentation } from "../i18n/locale";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Check, Search, Menu } from "lucide-react";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const h = React.createElement;
const require = createRequire(import.meta.url);
const radixRequire = createRequire(require.resolve("radix-ui"));
const tabsRequire = createRequire(radixRequire.resolve("@radix-ui/react-tabs"));
const dialogRequire = createRequire(radixRequire.resolve("@radix-ui/react-dialog"));

test("independent bilingual tabpanel review preserves DOM/ISO/icon contracts and supplies keyboard focus indicator", async () => {
  for (const language of ["en-US", "fa-IR"] as const) for (const numerals of ["latn", "arabext"] as const) {
    const p = resolvePresentation({ user: { language, numerals } });
    const html = renderToStaticMarkup(h(PresentationProvider, { presentation: p,
      messages: language === "fa-IR" ? fa : en, now: new Date("2026-10-24T00:00:00Z") },
    h(Tabs, { defaultValue: "first" },
      h(TabsList, { "aria-label": "Caller tabs" },
        h(TabsTrigger, { value: "first" }, "First"),
        h(TabsTrigger, { value: "disabled", disabled: true }, "Disabled"),
        h(TabsTrigger, { value: "last" }, "Last")),
      h(TabsContent, { value: "first" },
        h("input", { name: "currency", dir: "ltr", defaultValue: "IRR" }),
        h("button", null, "Save <caller>"),
        h(Check), h(Search), h(Menu)))));
    assert.ok(html.includes(`dir="${language === "fa-IR" ? "rtl" : "ltr"}"`));
    const panel = html.match(/<div[^>]*role="tabpanel"[^>]*>/)?.[0];
    assert.ok(panel?.includes('tabindex="0"'));
    for (const token of ["focus-visible:ring-2", "focus-visible:ring-ring", "focus-visible:ring-offset-2"])
      assert.ok(panel?.includes(token));
    assert.ok(html.indexOf(">First</button>") < html.indexOf(">Last</button>"));
    assert.ok(html.indexOf('name="currency"') < html.indexOf("Save &lt;caller&gt;"));
    assert.ok(html.includes('value="IRR"'));
    assert.doesNotMatch(html, /tabindex="[1-9]/);
    assert.doesNotMatch(html, /lucide-(check|search|menu)[^>]*(rotate|scale-x)/);
  }
  const compiler = await compile("@theme { --color-ring: #00a; --spacing: .25rem; } @tailwind utilities;");
  const css = compiler.build(["focus-visible:ring-2", "focus-visible:ring-ring", "focus-visible:ring-offset-2"]);
  assert.ok(css.includes(":focus-visible"));
  assert.ok(css.includes("--tw-ring-shadow"));
  assert.ok(css.includes("--tw-ring-offset-width: 2px"));
});

test("installed roving keyboard algorithm reverses only horizontal arrows and preserves Home/End/vertical intent", () => {
  // Execute installed implementation, not a copied key map. Export only its
  // internal pure resolver into this test-local module; no vendor file is changed.
  const file = tabsRequire.resolve("@radix-ui/react-roving-focus");
  const compiled = { exports: {} as { focusIntent: (event: { key: string }, orientation: string, dir: string) => unknown } };
  new Function("require", "module", "exports", readFileSync(file, "utf8") +
    "\nmodule.exports.focusIntent = getFocusIntent;")(createRequire(file), compiled, compiled.exports);
  const intent = compiled.exports.focusIntent;
  for (const dir of ["ltr", "rtl"]) {
    assert.equal(intent({ key: "ArrowLeft" }, "horizontal", dir), dir === "rtl" ? "next" : "prev");
    assert.equal(intent({ key: "ArrowRight" }, "horizontal", dir), dir === "rtl" ? "prev" : "next");
    assert.equal(intent({ key: "Home" }, "horizontal", dir), "first");
    assert.equal(intent({ key: "End" }, "horizontal", dir), "last");
    assert.equal(intent({ key: "ArrowDown" }, "vertical", dir), "next");
    assert.equal(intent({ key: "ArrowUp" }, "vertical", dir), "prev");
    assert.equal(intent({ key: "ArrowDown" }, "horizontal", dir), undefined);
    assert.equal(intent({ key: "ArrowLeft" }, "vertical", dir), undefined);
    assert.equal(intent({ key: "Tab" }, "horizontal", dir), undefined);
  }
});

test("installed focus-scope Tab handler loops in DOM order and filters disabled/hidden controls independently of direction", () => {
  // Only DOM services are modeled here. The actual installed FocusScope renders
  // with real React and supplies the actual keyboard callback under test. This is
  // runtime algorithm coverage, not a mounted browser/computed visibility claim.
  const file = dialogRequire.resolve("@radix-ui/react-focus-scope");
  let onKey: ((event: Record<string, unknown>) => void) | undefined;
  const compiled = { exports: {} as { FocusScope: React.ComponentType<{ loop: boolean; trapped: boolean }> } };
  const moduleRequire = createRequire(file);
  new Function("require", "module", "exports", readFileSync(file, "utf8"))((id: string) =>
    id === "react" ? { ...React, useCallback: (fn: (...args: never[]) => unknown) => {
      if (fn.toString().includes("getTabbableEdges")) onKey = fn as typeof onKey;
      return React.useCallback((...args: never[]) => fn(...args), [fn]);
    } } : moduleRequire(id), compiled, compiled.exports);
  renderToStaticMarkup(h(compiled.exports.FocusScope, { loop: true, trapped: true }));
  assert.ok(onKey);
  const saved = Object.fromEntries(["document", "NodeFilter", "getComputedStyle", "HTMLInputElement"]
    .map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  type Node = { tagName: string; type?: string; disabled?: boolean; hidden?: boolean;
    tabIndex: number; parentElement?: Node; style?: { display?: string; visibility?: string }; focus: () => void };
  const doc = { activeElement: null as Node | null,
    createTreeWalker: (_root: Node, _show: number, filter: { acceptNode: (node: Node) => number }) => {
      const candidates = nodes.filter(node => filter.acceptNode(node) === 1);
      let index = -1;
      return { currentNode: null as Node | null, nextNode() { this.currentNode = candidates[++index] ?? null; return this.currentNode; } };
    } };
  const node = (props: Partial<Node> = {}): Node => {
    const result: Node = { tagName: "BUTTON", tabIndex: 0, focus: () => { doc.activeElement = result; }, ...props };
    return result;
  };
  const root = node({ tabIndex: -1 });
  const first = node({ parentElement: root }), last = node({ parentElement: root });
  const nodes = [node({ disabled: true }), first, node({ hidden: true }), node({ tagName: "INPUT", type: "hidden" }),
    node({ style: { display: "none" } }), last];
  try {
    Object.defineProperty(globalThis, "document", { configurable: true, value: doc });
    Object.defineProperty(globalThis, "NodeFilter", { configurable: true, value: { SHOW_ELEMENT: 1, FILTER_ACCEPT: 1, FILTER_SKIP: 3 } });
    Object.defineProperty(globalThis, "getComputedStyle", { configurable: true, value: (n: Node) => ({ display: "block", visibility: "visible", ...n.style }) });
    Object.defineProperty(globalThis, "HTMLInputElement", { configurable: true, value: class Input {} });
    for (const direction of ["ltr", "rtl"]) {
      Object.assign(root, { dir: direction });
      for (const shiftKey of [false, true]) {
        doc.activeElement = shiftKey ? first : last;
        let prevented = false;
        onKey!({ key: "Tab", shiftKey, currentTarget: root, preventDefault: () => { prevented = true; } });
        assert.equal(prevented, true);
        assert.equal(doc.activeElement, shiftKey ? last : first);
      }
      doc.activeElement = first;
      let prevented = false;
      onKey!({ key: "Tab", shiftKey: false, ctrlKey: true, currentTarget: root, preventDefault: () => { prevented = true; } });
      assert.equal(prevented, false);
      assert.equal(doc.activeElement, first);
    }
  } finally {
    for (const [key, descriptor] of Object.entries(saved)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
