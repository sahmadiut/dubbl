import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { Landmark } from "lucide-react";
import * as nextIntl from "next-intl";
import { compile } from "tailwindcss";
import ts from "typescript";
import { PresentationProvider } from "../i18n/provider";
import { resolvePresentation, type Presentation } from "../i18n/locale";
import { PageHeader } from "../components/dashboard/page-header";
import { Section } from "../components/dashboard/section";
import { EmptyState } from "../components/dashboard/empty-state";
import { StatCard } from "../components/dashboard/stat-card";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const h = React.createElement;
const presentations = (["en-US", "fa-IR"] as const).flatMap(language =>
  (["latn", "arabext"] as const).map(numerals => resolvePresentation({ user: { language, numerals } })));
function render(node: React.ReactNode, presentation: Presentation) {
  return renderToStaticMarkup(h(PresentationProvider, { presentation,
    messages: presentation.locale === "fa-IR" ? fa : en, now: new Date("2026-10-25T00:00:00Z") }, node));
}
const escape = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
const mixed = "نام مشتری (ACME-2026/001) <caller> & " + "long-token-".repeat(40);

type Props = Record<string, unknown>;
// Only pathname is supplied at the Next runtime boundary. Actual production
// React/next-intl/Link/motion/Button components and event bodies execute intact.
function harness(name: string, exportName: string, pathname = "/reports") {
  const file = `components/dashboard/${name}.tsx`, require = createRequire(resolve(file));
  const controls: { type: unknown; props: Props }[] = [];
  const capture = (create: typeof jsxRuntime.jsx) => (type: React.ElementType, props: Props, key?: string) => {
    controls.push({ type, props });
    return create(type, props, key);
  };
  const compiledModule = { exports: {} as Record<string, React.ComponentType<Props>> };
  const code = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  new Function("require", "module", "exports", code)((id: string) => {
    if (id === "next/navigation") return { usePathname: () => pathname };
    if (id === "next-intl") return nextIntl;
    if (id === "react/jsx-runtime") return { ...jsxRuntime, jsx: capture(jsxRuntime.jsx), jsxs: capture(jsxRuntime.jsxs) };
    return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  }, compiledModule, compiledModule.exports);
  return { controls, render(p: Presentation, props: Props) {
    controls.length = 0;
    return render(h(compiledModule.exports[exportName], props), p);
  } };
}

test("actual headings, descriptions and empty states isolate exact long mixed text in all presentations", () => {
  for (const p of presentations) {
    for (const node of [
      h(PageHeader, { title: mixed, description: mixed }, h("button", { type: "button" }, "Action")),
      h(Section, { title: mixed, description: mixed, children: h("input", { name: "canonical", defaultValue: mixed }) }),
      h(EmptyState, { icon: Landmark, title: mixed, description: mixed }, h("a", { href: "/sales?reference=INV-001" }, "Open")),
    ]) {
      const html = render(node, p);
      assert.equal((html.match(/data-slot="bidi-text"/g) || []).length, 2);
      assert.ok(html.includes(`>${escape(mixed)}</bdi>`));
      assert.match(html, /<bdi[^>]*dir="auto"/);
      assert.ok(html.includes("[overflow-wrap:anywhere]"));
      assert.ok(html.includes("min-w-0"));
      assert.ok(!/[\u200e\u200f\u2066-\u2069]/u.test(html));
    }
    assert.ok(render(h(Section, { title: mixed, description: mixed, children: "content" }), p)
      .includes("sm:grid-cols-[200px_minmax(0,1fr)]"));
    assert.ok(render(h(PageHeader, { title: mixed }, h("button", null, mixed)), p).includes("max-w-full flex-wrap"));
  }
});

test("real summary money/change text stays exact and chronological sparkline points do not mirror in RTL", () => {
  const value = "−۹۰۰٬۷۱۹٬۹۲۵٬۴۷۴٬۰۹۹٫۳۱ IRR", change = "+12.50% (دوره قبل)";
  const data = [10, 30, 20], before = JSON.stringify(data);
  for (const p of presentations) {
    const html = render(h(StatCard, { title: mixed, value, change, icon: Landmark, sparklineData: data }), p);
    assert.ok(html.includes(`>${escape(value)}</bdi>`));
    assert.ok(html.includes(`>${escape(change)}</bdi>`));
    assert.ok(html.includes('points="0,24 40,0 80,12"'));
    assert.match(html, /<svg[^>]*aria-hidden="true"/);
    assert.ok(html.includes("flex-wrap"));
    assert.ok(!html.includes("scale-x"));
  }
  assert.equal(JSON.stringify(data), before);
});

test("real navigation preserves canonical links and current-page semantics with growing isolated badges", () => {
  for (const p of presentations) {
    const tabs = [{ href: "/reports", label: mixed, icon: Landmark, badge: "123456789", exact: true },
      { href: "/sales?reference=INV-001", label: "فروش Sales", badge: 0 }];
    const before = JSON.stringify(tabs), tab = harness("tab-layout", "TabLayout");
    const html = tab.render(p, { tabs, children: h("p", null, "canonical content") });
    assert.match(html, /<a[^>]*aria-current="page"[^>]*href="\/reports"|<a[^>]*href="\/reports"[^>]*aria-current="page"/);
    assert.equal((html.match(/aria-current="page"/g) || []).length, 1);
    assert.ok(html.includes('href="/sales?reference=INV-001"'));
    assert.ok(html.includes(`>${escape(mixed)}</bdi>`));
    assert.ok(html.includes('>123456789</bdi>'));
    assert.ok(html.includes('>0</bdi>'));
    assert.ok(html.includes("ms-1"));
    assert.ok(!html.includes("ml-1"));
    assert.ok(html.includes("min-w-4.5"));
    assert.ok(html.includes("overflow-x-auto"));
    assert.equal(JSON.stringify(tabs), before);
    const nested = harness("tab-layout", "TabLayout", "/reports/saved").render(p, {
      tabs: [{ href: "/reports", label: "Reports" }, { href: "/reports/saved", label: "Saved" }], children: "saved",
    });
    assert.equal((nested.match(/aria-current="page"/g) || []).length, 1);
    assert.match(nested, /<a[^>]*aria-current="page"[^>]*href="\/reports\/saved"|<a[^>]*href="\/reports\/saved"[^>]*aria-current="page"/);
    assert.ok(!harness("tab-layout", "TabLayout", "/reports/invoice-001").render(p, { tabs, children: "detail" }).includes("<nav"));
  }
});

test("actual error alert and retry preserve exact message/callback and localized accessible button text", () => {
  let retries = 0;
  for (const p of presentations) {
    const error = harness("error-state", "ErrorState");
    const html = error.render(p, { message: mixed, onRetry: () => retries++ });
    assert.match(html, /<p role="alert"/);
    assert.ok(html.includes(`>${escape(mixed)}</bdi>`));
    const messages = p.locale === "fa-IR" ? fa : en;
    assert.ok(html.includes(messages.SharedUI.tryAgain));
    const button = error.controls.find(c => typeof c.props.onClick === "function");
    assert.ok(button);
    (button.props.onClick as () => void)();
    assert.ok(html.includes("h-auto"));
    assert.ok(html.includes("whitespace-normal"));
    const fallback = error.render(p, {});
    assert.ok(fallback.includes(messages.SharedUI.failedToLoadDataPleaseCheckYourConnectionAndTryAgain));
    assert.ok(!fallback.includes("<button"));
  }
  assert.equal(retries, presentations.length);
});

test("installed layout CSS supplies real intrinsic tracks, wrapping and logical margin without fixed badge width", async () => {
  const compiler = await compile("@theme { --spacing: 0.25rem; } @tailwind utilities;");
  const css = compiler.build(["sm:grid-cols-[200px_minmax(0,1fr)]", "grid-cols-[200px_minmax(0,1fr)]",
    "ms-1", "min-w-4.5", "min-h-4.5", "max-w-full", "min-w-0", "flex-wrap", "shrink-0",
    "h-auto", "whitespace-normal", "[overflow-wrap:anywhere]", "[unicode-bidi:isolate]"]);
  for (const declaration of ["grid-template-columns: 200px minmax(0,1fr)", "margin-inline-start:",
    "min-width:", "min-height:", "max-width: 100%", "flex-wrap: wrap", "flex-shrink: 0",
    "height: auto", "white-space: normal", "overflow-wrap: anywhere", "unicode-bidi: isolate"])
    assert.ok(css.includes(declaration), declaration);
});
