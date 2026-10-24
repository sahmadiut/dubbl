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
import { BidiText, IdentifierText } from "../components/ui/bidi-text";
import { Input } from "../components/ui/input";
import { ApiKeyFields } from "../components/settings/api-key-fields";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const h = React.createElement;
const presentations = (["en-US", "fa-IR"] as const).flatMap(language =>
  (["latn", "arabext"] as const).map(numerals => resolvePresentation({ user: { language, numerals } })));
const now = new Date("2026-10-25T00:00:00Z");
function render(node: React.ReactNode, presentation: Presentation) {
  return renderToStaticMarkup(h(PresentationProvider, { presentation,
    messages: presentation.locale === "fa-IR" ? fa : en, now }, node));
}
function escape(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
}

test("real mixed text scopes isolate caller content without rewriting or escaping it twice", () => {
  const value = "نام <caller> & account-001 (2026)";
  for (const p of presentations) {
    const html = render(h("p", null, "قبل (", h(BidiText, { title: "Caller title" }, value), ") بعد"), p);
    assert.match(html, /<bdi[^>]*data-slot="bidi-text"[^>]*dir="auto"/);
    assert.ok(html.includes(`[unicode-bidi:isolate]`));
    assert.ok(html.includes(`title="Caller title"`));
    assert.ok(html.includes(escape(value)));
    assert.ok(!html.includes("&amp;lt;caller"));
    assert.ok(!html.includes("<caller>"));
    assert.ok(html.indexOf("قبل (") < html.indexOf("<bdi"));
    assert.ok(html.indexOf("</bdi>") < html.indexOf(") بعد"));
  }
});

test("real email URL key IBAN UUID and document labels stay LTR selectable and byte-stable in every presentation", () => {
  const values = ["dev+accounts@example.test", "https://example.test/a?q=inv-001&lang=fa",
    "IR06 0170 0000 0010 3242 2003 72", "550e8400-e29b-41d4-a716-446655440000",
    "INV-2026/000123", "IR06  0170\n0000 0010 3242 2003 72", "dk_live_<caller>&" + "x".repeat(512)];
  const snapshot = JSON.stringify(values);
  for (const p of presentations) for (const value of values) {
    const html = render(h(IdentifierText, { "aria-label": "Caller identifier", title: value }, value), p);
    assert.match(html, /<bdi[^>]*data-slot="identifier-text"[^>]*dir="ltr"/);
    assert.ok(html.includes("select-text"));
    assert.ok(html.includes("tabular-nums"));
    assert.ok(html.includes("whitespace-pre-wrap"));
    assert.ok(html.includes("[overflow-wrap:anywhere]"));
    assert.ok(html.includes(`>${escape(value)}</bdi>`));
    assert.ok(html.includes('aria-label="Caller identifier"'));
    assert.ok(!/[\u200e\u200f\u2066-\u2069]/u.test(html));
  }
  assert.equal(JSON.stringify(values), snapshot);
  assert.match(render(h(IdentifierText, { dir: "auto" }, "نام account-1"), presentations[1]), /dir="auto"/);
  assert.match(render(h(BidiText, { dir: "rtl" }, "نام"), presentations[0]), /dir="rtl"/);
});

test("real semantic input defaults preserve native types validation values refs and explicit overrides", () => {
  const ref = { current: null };
  const events: string[] = [];
  for (const type of ["email", "url"]) {
    const value = type === "email" ? "team+001@example.test" : "https://example.test/INV-001?q=fa&n=1250";
    const element = Input({ type, value, name: "canonical", required: true, pattern: "caller-pattern",
      "aria-describedby": "caller-help", "aria-invalid": true, ref,
      onChange: event => events.push(event.target.value) });
    assert.equal(element.props.type, type);
    assert.equal(element.props.dir, "ltr");
    assert.equal(element.props.value, value);
    assert.equal(element.props.name, "canonical");
    assert.equal(element.props.required, true);
    assert.equal(element.props.pattern, "caller-pattern");
    assert.equal(element.props["aria-describedby"], "caller-help");
    assert.equal(element.props["aria-invalid"], true);
    assert.equal(element.props.ref, ref);
    assert.ok(element.props.className.includes("[unicode-bidi:isolate]"));
    element.props.onChange({ target: { value } });
    assert.equal(events.at(-1), value);
    for (const p of presentations) assert.ok(render(element, p).includes(`value="${escape(value)}"`));
    for (const dir of ["auto", "rtl", "ltr"] as const) assert.equal(Input({ type, dir }).props.dir, dir);
  }
  for (const type of [undefined, "text", "search", "number", "password", "date"]) {
    assert.equal(Input({ type }).props.dir, undefined);
    assert.ok(!Input({ type }).props.className.includes("[unicode-bidi:isolate]"));
  }
});

test("actual API-key reveal wraps long exact selectable key and keeps localized copy names", () => {
  const key = "dk_live_<caller>&" + "0123456789abcdef".repeat(32);
  for (const p of presentations) {
    const html = render(h(ApiKeyFields, { newKey: key, name: "Name", onNameChange: () => {}, onCopy: () => {} }), p);
    assert.match(html, /<code[^>]*min-w-0[^>]*><bdi[^>]*data-slot="identifier-text"[^>]*dir="ltr"/);
    assert.ok(html.includes(`>${escape(key)}</bdi>`));
    assert.ok(html.includes('aria-label="' + (p.locale === "fa-IR" ? fa : en).SettingsApiKeys.copyKey + '"'));
    assert.ok(html.includes("[overflow-wrap:anywhere]"));
    assert.ok(!html.includes("<input"));
  }
});

test("actual API-key create field associates its visible label and keeps free-form auto direction", () => {
  for (const p of presentations) {
    const value = "نام <caller> production-001";
    const html = render(h(ApiKeyFields, { newKey: null, name: value, onNameChange: () => {}, onCopy: () => {} }), p);
    const id = html.match(/<input[^>]*id="([^"]+)"/)?.[1];
    assert.ok(id);
    assert.ok(html.includes(`for="${id}"`));
    assert.match(html, /<input[^>]*dir="auto"/);
    assert.ok(html.includes(`value="${escape(value)}"`));
    assert.ok(html.includes((p.locale === "fa-IR" ? fa : en).SettingsApiKeys.name));
  }
});

test("actual API-key callbacks preserve key and name values through real provider rendering", () => {
  // Instrument only JSX construction to obtain actual callbacks. Actual React,
  // useId, next-intl, controls and event bodies run unchanged; no mounted claim.
  const file = "components/settings/api-key-fields.tsx";
  const require = createRequire(resolve(file));
  const code = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  type Props = Record<string, unknown>;
  const controls: Props[] = [];
  const capture = (create: typeof jsxRuntime.jsx) => (type: React.ElementType, props: Props, key?: string) => {
    if (typeof props?.onChange === "function" || typeof props?.onClick === "function") controls.push(props);
    return create(type, props, key);
  };
  const compiled = { exports: {} as { ApiKeyFields: typeof ApiKeyFields } };
  new Function("require", "module", "exports", code)((id: string) => {
    if (id === "next-intl") return nextIntl;
    if (id === "react/jsx-runtime") return { ...jsxRuntime, jsx: capture(jsxRuntime.jsx), jsxs: capture(jsxRuntime.jsxs) };
    return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  }, compiled, compiled.exports);
  for (const p of presentations) {
    const key = "dk_live_001-A/" + "x".repeat(256);
    const copied: string[] = [], changed: string[] = [];
    controls.length = 0;
    render(h(compiled.exports.ApiKeyFields, { newKey: key, name: "نام", onNameChange: value => changed.push(value),
      onCopy: () => copied.push(key) }), p);
    const copy = controls.find(props => props["aria-label"] === (p.locale === "fa-IR" ? fa : en).SettingsApiKeys.copyKey);
    assert.ok(copy);
    (copy.onClick as () => void)();
    assert.deepEqual(copied, [key]);
    controls.length = 0;
    render(h(compiled.exports.ApiKeyFields, { newKey: null, name: "نام", onNameChange: value => changed.push(value), onCopy: () => {} }), p);
    const input = controls.find(props => props.dir === "auto" && props.id);
    assert.ok(input);
    const name = "  نام / Caller-001 <&>  ";
    (input.onChange as (event: { target: { value: string } }) => void)({ target: { value: name } });
    assert.deepEqual(changed, [name]);
  }
});

test("installed CSS compiler supplies isolation wrapping selection and tabular numeral contracts", async () => {
  const compiler = await compile("@tailwind utilities;");
  const css = compiler.build(["[unicode-bidi:isolate]", "[overflow-wrap:anywhere]", "select-text", "whitespace-pre-wrap", "tabular-nums", "text-start", "min-w-0"]);
  for (const declaration of ["unicode-bidi: isolate", "overflow-wrap: anywhere", "user-select: text",
    "white-space: pre-wrap", "tabular-nums", "text-align: start"]) assert.ok(css.includes(declaration), declaration);
});
