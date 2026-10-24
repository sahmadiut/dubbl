import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import * as nextIntl from "next-intl";
import { compile } from "tailwindcss";
import ts from "typescript";
import { PresentationProvider } from "../i18n/provider";
import { resolvePresentation, type Presentation } from "../i18n/locale";
import AuthLayout from "../app/(auth)/layout";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const h = React.createElement;
const presentations = (["en-US", "fa-IR"] as const).flatMap(language =>
  (["latn", "arabext"] as const).map(numerals => resolvePresentation({ user: { language, numerals } })));
const mixed = "  شرکت <ACME-001> / Caller & " + "long-name-".repeat(30);
const escape = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
function render(node: React.ReactNode, p: Presentation) {
  return renderToStaticMarkup(h(PresentationProvider, { presentation: p,
    messages: p.locale === "fa-IR" ? fa : en, now: new Date("2026-10-25T00:00:00Z") }, node));
}
type Props = Record<string, unknown>;
// Supply only state/router/network boundaries. Actual production JSX, next-intl,
// controls and event bodies execute; this is not a mounted browser test.
function harness(name: string, states: unknown[], search = new URLSearchParams()) {
  const file = `app/(auth)/${name}/page.tsx`, require = createRequire(resolve(file));
  const controls: { type: unknown; props: Props }[] = [], updates: [number, unknown][] = [], routes: string[] = [];
  const requests: { path: string; init: RequestInit }[] = [];
  let cursor = 0;
  const capture = (create: typeof jsxRuntime.jsx) => (type: React.ElementType, props: Props, key?: string) => {
    controls.push({ type, props });
    return create(type, props, key);
  };
  const compiled = { exports: {} as { default: React.ComponentType } };
  const code = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  new Function("require", "module", "exports", "fetch", code)((id: string) => {
    if (id === "react") return { ...React, useEffect: () => {}, useState: () => {
      const index = cursor++;
      return [states[index], (value: unknown) => updates.push([index, value])];
    } };
    if (id === "next/navigation") return { useSearchParams: () => search,
      useRouter: () => ({ push: (value: string) => routes.push(value), replace: (value: string) => routes.push(value) }) };
    if (id === "next-intl") return nextIntl;
    if (id === "react/jsx-runtime") return { ...jsxRuntime, jsx: capture(jsxRuntime.jsx), jsxs: capture(jsxRuntime.jsxs) };
    return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  }, compiled, compiled.exports, async (path: string, init: RequestInit) => {
    requests.push({ path, init });
    return Response.json({ redirect_url: "/canonical-consent-result?code=A-001" });
  });
  return { controls, updates, routes, requests, render(p: Presentation) {
    cursor = 0; controls.length = 0;
    return render(h(compiled.exports.default), p);
  } };
}

test("actual credential controls preserve exact inputs, ordered secrets and growing translated actions", () => {
  const email = "person+001@example.test", password = "  pass/۱۲۳-Ab<&>  ", totp = "001234";
  const providers = { google: true, apple: true, registrationMode: "open", allowedDomains: "example.test,sub.example.test" };
  for (const p of presentations) {
    for (const name of ["sign-in", "sign-up"]) {
      const states = name === "sign-in" ? [email, password, mixed, false, false, providers, true, totp] :
        [mixed, email, password, mixed, false, providers];
      const page = harness(name, states), html = page.render(p);
      assert.match(html, /role="alert"/);
      assert.ok(html.includes(`>${escape(mixed)}</bdi>`));
      assert.match(html, /<input[^>]*dir="ltr"[^>]*id="password"/);
      assert.match(html, /<input[^>]*dir="ltr"[^>]*id="email"/);
      for (const id of name === "sign-in" ? ["email", "password", "totp"] : ["name", "email", "password"]) {
        const input = page.controls.find(c => c.props.id === id)?.props;
        assert.ok(input);
        const value = id === "email" ? email : id === "password" ? password : id === "totp" ? totp : mixed;
        assert.equal(input.value, value);
        const changed = `  ${value}/new-۰۰۱  `;
        (input.onChange as (e: { target: { value: string } }) => void)({ target: { value: changed } });
        assert.equal(page.updates.at(-1)?.[1], changed);
        assert.ok(html.includes(`for="${id}"`));
      }
      if (name === "sign-in") assert.match(html, /<input[^>]*dir="ltr"[^>]*id="totp"/);
      else {
        assert.match(html, /<input[^>]*dir="auto"[^>]*id="name"/);
        assert.match(html, /<bdi[^>]*dir="ltr"[^>]*>example.test, sub.example.test<\/bdi>/);
      }
      const submit = page.controls.find(c => c.props.type === "submit")?.props;
      assert.ok(submit);
      assert.ok(String(submit.className).includes("h-auto min-h-11 whitespace-normal"));
      assert.ok(html.includes("[&amp;:dir(rtl)]:rotate-180"));
      assert.ok(!/[\u200e\u200f\u2066-\u2069]/u.test(html));
    }
  }
});

test("actual MCP consent isolates exact names, labels its organization control and preserves consent payload", async () => {
  const organizations = [{ id: "org-A/001", name: mixed }, { id: "org-B/002", name: "Other سازمان" }];
  const params = new URLSearchParams({ client_name: mixed, client_id: "client-001", redirect_uri: "https://client.test/callback",
    code_challenge: "challenge_001", code_challenge_method: "S256", state: "state/001", scope: "mcp" });
  for (const p of presentations) {
    const page = harness("mcp-authorize", [organizations, organizations[0].id, false, mixed], params);
    const html = page.render(p);
    assert.ok(html.includes(`<strong>${escape(mixed)}</strong></bdi>`));
    assert.ok(html.includes(`>${escape(mixed)}</bdi>`));
    assert.ok(html.includes('for="consent-organization"'));
    assert.match(html, /<button(?=[^>]*id="consent-organization")(?=[^>]*role="combobox")[^>]*>/);
    assert.ok(html.includes('role="alert"'));
    assert.ok(html.includes("me-1.5"));
    assert.ok(!html.includes("mr-1.5"));
    const select = page.controls.find(c => typeof c.props.onValueChange === "function");
    assert.ok(select);
    (select.props.onValueChange as (value: string) => void)(organizations[1].id);
    assert.deepEqual(page.updates.at(-1), [1, organizations[1].id]);
    const buttons = page.controls.filter(c => typeof c.props.onClick === "function");
    assert.equal(buttons.length, 2);
    for (const button of buttons) assert.ok(String(button.props.className).includes("h-auto min-h-11 min-w-0 whitespace-normal"));
    await (buttons[1].props.onClick as () => Promise<void>)();
    assert.equal(page.requests[0].path, "/api/mcp/oauth/consent");
    assert.equal(page.requests[0].init.method, "POST");
    assert.deepEqual(JSON.parse(page.requests[0].init.body as string), { client_id: "client-001",
      redirect_uri: "https://client.test/callback", code_challenge: "challenge_001", code_challenge_method: "S256",
      state: "state/001", scope: "mcp", organization_id: organizations[0].id });
    assert.equal(page.routes[0], "/canonical-consent-result?code=A-001");
    (buttons[0].props.onClick as () => void)();
    const denied = new URL(page.routes[1]);
    assert.equal(denied.origin + denied.pathname, "https://client.test/callback");
    assert.equal(denied.searchParams.get("error"), "access_denied");
    assert.equal(denied.searchParams.get("state"), "state/001");
    const single = harness("mcp-authorize", [[organizations[0]], organizations[0].id, false, ""], params).render(p);
    assert.ok(single.includes(`<strong>${escape(mixed)}</strong></bdi>`));
    assert.ok(!single.includes('role="combobox"'));
  }
});

test("actual auth shell keeps decorative geometry while allowing zero-minimum tracks and wrapped footer/badges", () => {
  for (const p of presentations) {
    const html = render(h(AuthLayout, null, h("p", null, mixed)), p);
    assert.ok(html.includes("lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]"));
    assert.ok(html.includes("relative flex min-w-0 flex-col justify-center"));
    assert.ok(html.includes("mt-5 flex flex-wrap items-center justify-center gap-4"));
    assert.ok(html.includes("mt-5 flex flex-wrap items-center justify-center gap-2"));
    assert.match(html, /<svg aria-hidden="true" class="absolute inset-0 h-full w-full"/);
    assert.ok(html.includes('x1="10%" y1="10%" x2="30%" y2="6%"'));
    assert.ok(html.includes(escape(mixed)));
    assert.ok(html.includes('href="/"'));
  }
});

test("installed CSS emits intrinsic sizing, logical margins and effective select value clamp/height overrides", async () => {
  const compiler = await compile("@theme { --spacing: 0.25rem; } @tailwind utilities;");
  const css = compiler.build(["grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]", "min-w-0", "h-auto", "min-h-11",
    "data-[size=default]:h-auto", "*:data-[slot=select-value]:line-clamp-none", "*:data-[slot=select-value]:whitespace-normal",
    "me-1.5", "flex-wrap", "whitespace-normal", "[overflow-wrap:anywhere]", "[unicode-bidi:isolate]", "[&:dir(rtl)]:rotate-180"]);
  for (const declaration of ["grid-template-columns: minmax(0,1.2fr) minmax(0,1fr)", "min-width:", "height: auto",
    "min-height:", "margin-inline-end:", "flex-wrap: wrap", "white-space: normal", "overflow-wrap: anywhere",
    "unicode-bidi: isolate", "-webkit-line-clamp: unset", "rotate: 180deg"])
    assert.ok(css.includes(declaration), declaration);
  assert.ok(css.includes('[data-size="default"]'));
  assert.ok(css.includes('[data-slot="select-value"]'));
});
