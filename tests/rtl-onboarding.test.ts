import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import * as React from "react";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import * as intl from "next-intl";
import ts from "typescript";
import { compile } from "tailwindcss";
import * as Provider from "../i18n/provider";
import { resolvePresentation } from "../i18n/locale";
import Layout from "../app/(onboarding)/layout";
import { COUNTRIES, getBusinessTypesForCountry } from "../lib/data/business-types";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const h = React.createElement;
const noop = () => {};
const caller = "  \u0634\u0631\u06a9\u062a <Caller/001> & " + "long-name-".repeat(25);
const presentations = (["en-US", "fa-IR"] as const).flatMap(language =>
  (["latn", "arabext"] as const).map(numerals => resolvePresentation({ user: { language, numerals } })));
type Props = Record<string, unknown>;
const require = createRequire(import.meta.url);
const CjsProvider = (require("../i18n/provider") as typeof Provider).PresentationProvider;
const escape = (s: string) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#x27;");

// Actual production JSX/handlers and real providers/controls execute. Only hooks,
// animation/shader IO and fetch/window are controlled; this is not browser QA.
function loaded(component: string, states: unknown[] = []) {
  const file = "components/onboarding/onboarding-wizard.tsx";
  const localRequire = createRequire(resolve(file));
  const controls: { type: unknown; props: Props }[] = [], updates: unknown[][] = [];
  const requests: { url: string; init: RequestInit }[] = [];
  const location = { href: "" };
  let index = 0;
  const capture = (create: typeof jsx.jsx) => (type: React.ElementType, props: Props, key?: string) => {
    controls.push({ type, props }); return create(type, props, key);
  };
  const compiled = { exports: {} as Record<string, React.ComponentType<Props>> };
  const code = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  const animated = ({ children }: { children?: React.ReactNode }) => h("div", null, children);
  new Function("require", "module", "exports", "fetch", "window", code)((id: string) => {
    if (id === "react") return { ...React, useState: (initial: unknown) => {
      const key = index++; return [key < states.length ? states[key] : initial,
        (value: unknown) => updates.push([key, value])];
    }, useEffect: noop, useMemo: (fn: () => unknown) => fn() };
    if (id === "react/jsx-runtime") return { ...jsx, jsx: capture(jsx.jsx), jsxs: capture(jsx.jsxs) };
    if (id === "next-intl") return intl;
    if (id.endsWith("/i18n/provider")) return Provider;
    if (id === "motion/react") return { motion: { div: animated }, AnimatePresence: animated };
    if (id === "@paper-design/shaders-react") return { GrainGradient: () => null };
    if (id === "sonner") return { toast: { error: noop } };
    return localRequire(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  }, compiled, compiled.exports, async (url: string, init: RequestInit) => {
    requests.push({ url, init }); return Response.json({ organization: { id: "created/001" } });
  }, { location });
  return { controls, updates, requests, location, render(p: typeof presentations[number], props: Props = {}) {
    index = 0; controls.length = 0;
    const config = { presentation: p, messages: p.locale === "fa-IR" ? fa : en,
      now: new Date("2026-10-25T00:00:00Z") };
    return renderToStaticMarkup(h(Provider.PresentationProvider, config, h(CjsProvider, config,
      h(compiled.exports[component], props))));
  } };
}

test("onboarding review isolates exact escaped caller/legal/currency values and permits long rows to wrap", () => {
  for (const p of presentations) {
    const page = loaded("StepReview");
    const html = page.render(p, { orgName: caller, countryCode: "JP", businessType: "KK",
      industry: "technology", referralSource: "other", referralOther: caller });
    assert.equal(html.split(`>${escape(caller)}</bdi>`).length - 1, 2, "both caller fields remain exact and isolated");
    assert.ok(!html.includes("<Caller/001>"), "caller HTML is escaped");
    assert.ok(html.includes("flex min-w-0 flex-wrap items-start justify-between gap-2"), "review rows can reflow");
    assert.ok(html.includes("[overflow-wrap:anywhere]"), "unbroken caller strings can wrap");
    assert.ok(!/[\u200e\u200f\u2066-\u2069]/u.test(html), "no direction characters are inserted into values");
  }
});

test("actual name/search/referral controls are named, auto-direction and preserve raw input and canonical country codes", () => {
  for (const p of presentations) {
    for (const [component, props, id] of [
      ["StepOrgName", { name: caller, onNameChange: noop }, "org-name"],
      ["StepReferral", { selected: "other", other: caller, onSelect: noop, onOtherChange: noop }, "referral-other"],
    ] as const) {
      const changed: string[] = [];
      const page = loaded(component);
      const html = page.render(p, { ...props, onNameChange: (v: string) => changed.push(v), onOtherChange: (v: string) => changed.push(v) });
      const input = page.controls.find(c => c.props.id === id)?.props;
      assert.ok(input, "actual editable caller field exists");
      assert.equal(input.dir, "auto", "caller field follows its own script");
      assert.ok(html.includes(`for="${id}"`), "field is associated with its label");
      (input.onChange as (e: { target: { value: string } }) => void)({ target: { value: caller + "  new/001  " } });
      assert.deepEqual(changed, [caller + "  new/001  "], "raw edits are not normalized");
    }
    const selected: string[] = [], countries = loaded("StepCountry");
    const html = countries.render(p, { selected: "JP", onSelect: (v: string) => selected.push(v) });
    const search = countries.controls.find(c => c.props.type === "search")?.props;
    assert.ok(search?.["aria-label"], "search has a native accessible name");
    assert.equal(search.dir, "auto", "country search supports either script");
    assert.ok(String(search.className).includes("ps-9"), "search padding uses inline start");
    assert.ok(html.includes("absolute start-3"), "search icon follows reading direction");
    const option = countries.controls.find(c => c.props["aria-pressed"] === true)?.props;
    assert.ok(option, "selected country exposes pressed state");
    (option.onClick as () => void)();
    assert.deepEqual(selected, ["JP"], "country callback retains the ISO code");
  }
});

test("actual legal/optional options retain canonical code/toggle callbacks with isolated legal scripts and adaptive grids", () => {
  for (const p of presentations) {
    const legal: string[] = [], page = loaded("StepBusinessType");
    const html = page.render(p, { countryCode: "JP", selected: "KK", onSelect: (v: string) => legal.push(v) });
    const option = page.controls.find(c => c.props["aria-pressed"] === true)?.props;
    assert.ok(option, "canonical legal selection is exposed");
    (option.onClick as () => void)();
    assert.deepEqual(legal, ["KK"], "legal callback preserves the stored code");
    const kk = getBusinessTypesForCountry("JP").find(t => t.code === "KK")!;
    assert.ok(html.includes(`>${escape(kk.englishName)}</bdi>`), "English legal fallback stays isolated");
    for (const [component, value] of [["StepIndustry", "technology"], ["StepReferral", "other"]]) {
      const values: string[] = [], options = loaded(component);
      const markup = options.render(p, { selected: value, other: caller, onOtherChange: noop, onSelect: (v: string) => values.push(v) });
      assert.ok(markup.includes("grid-cols-1 gap-2 sm:grid-cols-2"), "optional choices stack at narrow widths");
      const selected = options.controls.find(c => c.props["aria-pressed"] === true)?.props;
      assert.ok(selected, "selected optional value exists");
      (selected.onClick as () => void)();
      assert.deepEqual(values, [""], "optional selection still toggles off with the empty machine value");
    }
  }
});

test("actual wizard direction and growing navigation preserve canonical organization submission", async () => {
  for (const p of presentations) {
    const page = loaded("OnboardingWizard", [5, 1, false, false, "org/001", caller, "JP", "KK", "technology", "other", "  raw referral  ", false, ""]);
    const html = page.render(p);
    const transition = page.controls.find(c => c.props.initial && c.props.exit)?.props;
    assert.ok(transition, "actual step transition exists");
    assert.equal((transition.initial as { x: number }).x, p.locale === "fa-IR" ? -40 : 40, "transition tracks reading direction");
    assert.equal((transition.exit as { x: number }).x, p.locale === "fa-IR" ? 40 : -40, "exit preserves logical progression");
    const complete = page.controls.find(c => typeof c.props.onClick === "function" &&
      String(c.props.className).includes("bg-emerald-600"))?.props;
    assert.ok(complete, "final native action exists");
    assert.ok(String(complete.className).includes("h-auto min-h-9 min-w-0"), "translated action can grow");
    assert.ok(html.includes("flex min-w-0 flex-wrap items-center justify-between gap-3"), "navigation reflows");
    await (complete.onClick as () => Promise<void>)();
    assert.equal(page.requests.length, 1, "existing organization submits one canonical PATCH");
    const request = page.requests[0];
    assert.equal(request.url, "/api/v1/organization", "REST operation is unchanged");
    assert.equal(request.init.method, "PATCH", "method is unchanged");
    assert.equal((request.init.headers as Record<string, string>)["x-organization-id"], "org/001", "org scope remains exact");
    assert.deepEqual(JSON.parse(request.init.body as string), { name: caller, country: COUNTRIES.find(c => c.code === "JP")!.name,
      countryCode: "JP", defaultCurrency: "JPY", businessType: "KK", industrySector: "technology", referralSource: "other: raw referral" }, "payload retains canonical data and original trimming policy");
    assert.equal(page.location.href, "/dashboard", "completion destination is unchanged");
  }
});

test("onboarding shell retains brand and symmetric decorative geometry with a logical theme edge", () => {
  for (const p of presentations) {
    const config = { presentation: p, messages: p.locale === "fa-IR" ? fa : en, now: new Date("2026-10-25T00:00:00Z") };
    const html = renderToStaticMarkup(h(Provider.PresentationProvider, config, h(CjsProvider, config, h(Layout, null, caller))));
    assert.ok(html.includes("fixed bottom-4 end-4"), "theme control follows inline end");
    assert.ok(html.includes('dir="ltr" class="text-lg font-bold'), "brand is independently ordered");
    assert.ok(html.includes("-right-[10%] -top-[15%]"), "decorative topology is retained");
    assert.ok(html.includes("-bottom-[20%] -left-[12%]"), "symmetric atmosphere is retained");
    assert.ok(html.includes('href="/"'), "brand destination is unchanged");
  }
});

test("installed CSS supports logical search/theme, wrapping, isolated text and RTL directional icons", async () => {
  const compiler = await compile("@theme { --spacing: 0.25rem; --breakpoint-sm: 40rem; } @tailwind utilities;");
  const css = compiler.build(["min-w-0", "h-auto", "min-h-9", "start-3", "end-4", "ps-9", "ms-auto",
    "flex-wrap", "whitespace-normal", "grid-cols-1", "sm:grid-cols-2", "[overflow-wrap:anywhere]", "[unicode-bidi:isolate]", "[&:dir(rtl)]:rotate-180"]);
  for (const declaration of ["inset-inline-start:", "inset-inline-end:", "padding-inline-start:", "margin-inline-start: auto",
    "flex-wrap: wrap", "white-space: normal", "overflow-wrap: anywhere", "unicode-bidi: isolate", "height: auto", "rotate: 180deg"])
    assert.ok(css.includes(declaration), `installed utility emits ${declaration}`);
});
