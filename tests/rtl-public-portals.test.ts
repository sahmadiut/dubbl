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
import { documentMoneyText } from "../lib/documents/render-wire";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const h = React.createElement;
const require = createRequire(import.meta.url);
const CjsProvider = (require("../i18n/provider") as typeof Provider).PresentationProvider;
const presentations = (["en-US", "fa-IR"] as const).flatMap(language =>
  (["latn", "arabext"] as const).map(numerals => resolvePresentation({ user: { language, numerals } })));
type Props = Record<string, unknown>;
const caller = "  \u0634\u0631\u06a9\u062a <Caller/001> & " + "long-name-".repeat(25);
const id = "INV-\u0634\u0631\u06a9\u062a/001";
const escape = (s: string) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
const invoice = { id: "invoice/001", invoiceNumber: id, issueDate: "2026-10-24", dueDate: "2026-11-24",
  status: "sent", total: 12345, amountDue: 12345, currencyCode: "USD", paymentLinkToken: "opaque-pay" };

// Execute production JSX/handlers with real providers and UI controls. IO/hooks are
// controlled; canvas operation recordings establish geometry, not browser painting.
function loaded(file: string, p: typeof presentations[number], states: unknown[] = [], options: {
  result?: unknown; canvas?: unknown; fetcher?: typeof fetch;
} = {}) {
  const localRequire = createRequire(resolve(file));
  const controls: { type: unknown; props: Props }[] = [], updates: unknown[][] = [], effects: (() => void)[] = [], pushes: string[] = [];
  const requests: { url: string; init?: RequestInit }[] = [];
  let index = 0;
  const capture = (fn: typeof jsx.jsx) => (type: React.ElementType, props: Props, key?: string) => {
    controls.push({ type, props }); return fn(type, props, key);
  };
  const compiled = { exports: {} as Record<string, React.ComponentType<Props>> };
  const code = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  const t = intl.createTranslator({ locale: p.locale, messages: p.locale === "fa-IR" ? fa : en, namespace: "PublicSigning" });
  new Function("require", "module", "exports", "fetch", "window", code)((name: string) => {
    if (name === "react") return { ...React, useState: (initial: unknown) => {
      const key = index++; return [key < states.length ? states[key] : initial,
        (v: unknown) => updates.push([key, v])];
    }, useEffect: (fn: () => void) => effects.push(fn), useRef: () => ({ current: options.canvas ?? null }), useCallback: (fn: unknown) => fn };
    if (name === "react/jsx-runtime") return { ...jsx, jsx: capture(jsx.jsx), jsxs: capture(jsx.jsxs) };
    if (name === "next-intl") return intl;
    if (name === "next-intl/server") return { getTranslations: async () => t };
    if (name === "@/i18n/server") return { getPresentation: async () => p };
    if (name === "@/i18n/provider") return Provider;
    if (name === "next/navigation") return { useParams: () => ({ token: "opaque-token" }),
      usePathname: () => "/portal/opaque-token/quotes", useRouter: () => ({ push: (v: string) => pushes.push(v) }) };
    if (name === "@/lib/api/invoice-signatures") return { getPublicInvoiceSignature: async () => options.result };
    if (name === "./signature-canvas") return { SignatureCanvas: () => h("span", null, "canvas-boundary") };
    return localRequire(name.startsWith("@/") ? resolve(name.slice(2)) : name);
  }, compiled, compiled.exports, async (url: string, init?: RequestInit) => {
    requests.push({ url, init });
    return options.fetcher ? options.fetcher(url, init) : Response.json({});
  }, { devicePixelRatio: 2 });
  const renderNode = (node: React.ReactNode) => {
    const config = { presentation: p, messages: p.locale === "fa-IR" ? fa : en, now: new Date("2026-10-25T00:00:00Z") };
    return renderToStaticMarkup(h(Provider.PresentationProvider, config, h(CjsProvider, config, node)));
  };
  return { controls, updates, effects, pushes, requests, exports: compiled.exports, renderNode,
    render(component = "default", props: Props = {}) {
      index = 0; controls.length = 0;
      return renderNode(h(compiled.exports[component], props));
    } };
}

function isolated(html: string, value: string, direction = "ltr") {
  assert.ok(new RegExp(`<bdi[^>]*dir="${direction}"[^>]*>${escape(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}</bdi>`).test(html),
    `exact ${direction} isolated value: ${value.slice(0, 45)}`);
}

test("portal shell and overview isolate long escaped callers and preserve navigation with active-page semantics", () => {
  for (const p of presentations) {
    const info = { organization: { name: caller }, contact: { name: caller } };
    const shell = loaded("app/portal/[token]/layout.tsx", p, [info]);
    const html = shell.render("default", { children: "child" });
    isolated(html, caller, "auto");
    assert.ok(html.includes("flex-wrap"));
    assert.equal(shell.controls.find(c => c.props.href === "/portal/opaque-token/quotes")?.props["aria-current"], "page");
    assert.equal((html.match(/aria-current="page"/g) ?? []).length, 1);
    const overview = loaded("app/portal/[token]/page.tsx", p, [info, null]);
    const content = overview.render();
    assert.equal((content.match(new RegExp(`>${escape(caller)}</bdi>`, "g")) ?? []).length, 4);
    assert.ok(content.includes("text-start"));
    const action = overview.controls.find(c => c.type === "button")!.props;
    (action.onClick as () => void)();
    assert.deepEqual(overview.pushes, ["/portal/opaque-token/invoices"]);
    assert.ok(!/[\u200e\u200f\u2066-\u2069]/u.test(content), "no direction characters inserted into caller values");
  }
});

test("invoices and all portal tables isolate exact IDs dates money and descriptions across four presentations", () => {
  for (const p of presentations) {
    const invoices = loaded("app/portal/[token]/invoices/page.tsx", p, [[invoice], false, null]);
    const html = invoices.render();
    for (const value of [id, invoice.issueDate, invoice.dueDate, documentMoneyText(12345, "USD", p)]) isolated(html, value);
    const back = invoices.controls.find(c => c.props.href === "/portal/opaque-token")!.props;
    assert.equal(back["aria-label"], (p.locale === "fa-IR" ? fa : en).PublicPortal.overview);
    assert.ok(html.includes("[&amp;:dir(rtl)]:rotate-180"));
    assert.ok(html.includes('href="/pay/opaque-pay"'));
    for (const [page, states] of [
      ["quotes", [[{ ...invoice, quoteNumber: id, expiryDate: invoice.dueDate }], false, null, null]],
      ["payments", [[{ ...invoice, invoiceId: "invoice/001", amountPaid: 12345, paidAt: null }], false, null]],
      ["statements", [[{ date: invoice.issueDate, description: caller, amount: 12345, paid: 0, balance: 12345, status: "sent" }], 12345, "USD", false, null]],
    ] as const) {
      const content = loaded(`app/portal/[token]/${page}/page.tsx`, p, [...states]).render();
      isolated(content, documentMoneyText(12345, "USD", p));
      assert.ok(content.includes("overflow-x-auto"), "real Table contains horizontal overflow");
      assert.ok(content.includes("min-w-[40rem]"));
      assert.ok(content.includes("text-end"));
      assert.ok(!content.includes("text-right"));
      if (page === "statements") isolated(content, caller, "auto");
      else isolated(content, id);
    }
  }
});

test("server signing isolates frozen signer email invoice dates and exact money without changing status branches", async () => {
  for (const p of presentations) {
    for (const status of ["pending", "signed", "declined"] as const) {
      const page = loaded("app/sign/[token]/page.tsx", p, [], { result: {
        signature: { status, signerName: caller, signerEmail: "signer+\u0634@example.test", signedAt: null },
        invoice: { ...invoice, contact: { name: caller } }, isExpired: false,
      } });
      const Component = page.exports.default as unknown as (props: { params: Promise<{ token: string }> }) => Promise<React.ReactNode>;
      const html = page.renderNode(await Component({ params: Promise.resolve({ token: "opaque-token" }) }));
      for (const value of [id, invoice.issueDate, invoice.dueDate, "signer+\u0634@example.test", documentMoneyText(12345, "USD", p)]) isolated(html, value);
      isolated(html, caller, "auto");
      assert.ok(html.includes("flex-wrap justify-between gap-2"));
      if (status === "pending") assert.ok(html.includes("canvas-boundary"));
      else assert.ok(!html.includes("canvas-boundary"));
    }
  }
});

test("canvas retains physical mouse touch DPR clearing and exact PNG submission while exposing named feedback", async () => {
  for (const p of presentations) {
    const calls: unknown[][] = [];
    const ctx = Object.fromEntries(["scale", "beginPath", "moveTo", "lineTo", "stroke", "clearRect"].map(name =>
      [name, (...args: unknown[]) => calls.push([name, ...args])])) as unknown as CanvasRenderingContext2D;
    const canvas = { width: 0, height: 0, getBoundingClientRect: () => ({ left: 100, top: 50, width: 320, height: 160 }),
      getContext: () => ctx, toDataURL: (type: string) => { assert.equal(type, "image/png"); return "data:image/png;base64,exact"; } };
    const page = loaded("app/sign/[token]/signature-canvas.tsx", p, [true, true, false, false, null], { canvas });
    const html = page.render("SignatureCanvas", { token: "opaque-token" });
    const drawing = page.controls.find(c => c.type === "canvas")!.props;
    assert.equal(drawing.dir, "ltr");
    assert.equal(drawing["role"], "img");
    assert.equal(drawing["aria-label"], (p.locale === "fa-IR" ? fa : en).PublicSigning.drawHint);
    assert.ok(html.includes('id="signature-hint"'));
    assert.ok(!String(drawing.className).includes("rotate"));
    page.effects[0]();
    assert.equal(canvas.width, 640); assert.equal(canvas.height, 320);
    assert.deepEqual(calls.shift(), ["scale", 2, 2]);
    const event = { clientX: 140, clientY: 70, preventDefault() {} };
    (drawing.onMouseDown as (e: unknown) => void)(event);
    (drawing.onMouseMove as (e: unknown) => void)({ ...event, clientX: 160, clientY: 90 });
    (drawing.onTouchMove as (e: unknown) => void)({ touches: [], changedTouches: [{ clientX: 180, clientY: 110 }], preventDefault() {} });
    assert.deepEqual(calls.slice(0, 6), [["beginPath"], ["moveTo", 40, 20], ["lineTo", 60, 40], ["stroke"], ["lineTo", 80, 60], ["stroke"]]);
    const buttons = page.controls.filter(c => c.type === "button");
    (buttons[0].props.onClick as () => void)();
    assert.deepEqual(calls.at(-1), ["clearRect", 0, 0, 320, 160]);
    await (buttons[1].props.onClick as () => Promise<void>)();
    assert.equal(page.requests[0].url, "/api/sign/opaque-token");
    assert.equal(page.requests[0].init?.method, "POST");
    assert.deepEqual(JSON.parse(page.requests[0].init?.body as string), { signatureDataUrl: "data:image/png;base64,exact" });
    assert.ok(page.updates.some(v => v[0] === 3 && v[1] === true));
    for (const [states, role] of [[[false, true, false, true, null], "status"], [[false, true, false, false, "error"], "alert"]] as const)
      assert.ok(loaded("app/sign/[token]/signature-canvas.tsx", p, [...states]).render("SignatureCanvas", { token: "opaque" }).includes(`role="${role}"`));
  }
});

test("installed CSS provides portal logical alignment wrapping isolation and direction-aware arrows", async () => {
  const compiler = await compile("@theme { --spacing: 0.25rem; --breakpoint-sm: 40rem; } @tailwind utilities;");
  const css = compiler.build(["text-start", "text-end", "ms-auto", "flex-wrap", "min-w-0", "h-auto", "min-h-7", "whitespace-normal",
    "overflow-x-auto", "min-w-[40rem]", "[overflow-wrap:anywhere]", "[unicode-bidi:isolate]", "[&:dir(rtl)]:rotate-180"]);
  for (const rule of ["text-align: start", "text-align: end", "margin-inline-start: auto", "flex-wrap: wrap", "white-space: normal",
    "overflow-x: auto", "min-width: 40rem", "overflow-wrap: anywhere", "unicode-bidi: isolate", "rotate: 180deg"])
    assert.ok(css.includes(rule), rule);
});
