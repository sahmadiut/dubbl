import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import * as React from "react";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { compile } from "tailwindcss";
import { PresentationProvider } from "../i18n/provider";
import { resolvePresentation } from "../i18n/locale";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const h = React.createElement, noop = () => {};
const require = createRequire(import.meta.url);
const CjsProvider = (require("../i18n/provider") as typeof import("../i18n/provider")).PresentationProvider;
const presentations = (["en-US", "fa-IR"] as const).flatMap(language => (["latn", "arabext"] as const)
  .map(numerals => resolvePresentation({ user: { language, numerals } })));
const caller = "  \u0646\u0627\u0645 <Caller>& file-001/ " + "long".repeat(35);
const escape = (s: string) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
type Props = Record<string, unknown>;

// Execute the actual shared JSX and captured callbacks with real provider,
// controls and next-intl. Only animation, effects and portal measurement are stubbed.
function load(file: string, name: string) {
  const controls: { type: React.ElementType; props: Props }[] = [];
  const localRequire = createRequire(resolve(file));
  const compiled = { exports: {} as Record<string, React.ComponentType<Props>> };
  const capture = (fn: typeof jsx.jsx) => (type: React.ElementType, props: Props, key?: string) => {
    controls.push({ type, props }); return fn(type, props, key);
  };
  const code = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  new Function("require", "module", "exports", code)((id: string) => {
    if (id === "react/jsx-runtime") return { ...jsx, jsx: capture(jsx.jsx), jsxs: capture(jsx.jsxs) };
    if (id.endsWith("/content-reveal")) return { ContentReveal: ({ children }: { children: React.ReactNode }) => h("div", null, children) };
    if (id.endsWith("/ui/select") || id.endsWith("/ui/sheet")) return new Proxy({}, { get: (_t, key) => {
      const component = ({ children, ...props }: Props) => h("div", { "data-control": key, "aria-label": props["aria-label"] }, children as React.ReactNode);
      Object.defineProperty(component, "name", { value: key }); return component;
    } });
    return localRequire(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  }, compiled, compiled.exports);
  return { controls, render(p: typeof presentations[number], props: Props) {
    controls.length = 0;
    const provider = { presentation: p, messages: p.locale === "fa-IR" ? fa : en, now: new Date("2026-10-25T00:00:00Z") };
    return renderToStaticMarkup(h(PresentationProvider, provider, h(CjsProvider, provider, h(compiled.exports[name], props))));
  } };
}

test("shared tag, reminder and permission fields retain exact canonical change callbacks with named directional controls", () => {
  for (const p of presentations) {
    const calls: unknown[][] = [];
    const tag = load("components/settings/tag-fields.tsx", "TagFields");
    const html = tag.render(p, { name: caller, description: caller, color: "#ef4444",
      onNameChange: (v: string) => calls.push(["name", v]), onDescriptionChange: noop,
      onColorChange: (v: string) => calls.push(["color", v]) });
    assert.ok(html.includes(`value="${escape(caller)}"`));
    assert.equal((html.match(/dir="auto"/g) ?? []).length, 2);
    assert.ok(html.includes('aria-pressed="true"'));
    const field = tag.controls.find(c => c.props.value === caller && c.props.onChange);
    (field!.props.onChange as (e: unknown) => void)({ target: { value: caller } });
    const red = tag.controls.find(c => c.type === "button" && c.props["aria-pressed"] === true)!;
    (red.props.onClick as () => void)();
    assert.deepEqual(calls, [["name", caller], ["color", "#ef4444"]]);
    const reminder = load("components/settings/reminder-template-fields.tsx", "ReminderTemplateFields");
    const insert: unknown[][] = [];
    const reminderHtml = reminder.render(p, { subjectTemplate: caller, bodyTemplate: caller,
      onChange: noop, onInsert: (...args: unknown[]) => insert.push(args) });
    assert.equal((reminderHtml.match(/dir="auto"/g) ?? []).length, 2);
    for (const c of reminder.controls.filter(c => c.props.onClick)) (c.props.onClick as () => void)();
    assert.equal(insert.length, 12);
    assert.deepEqual(insert[0], ["{{contactName}}", "subjectTemplate"]);
    assert.deepEqual(insert[6], ["{{contactName}}", "bodyTemplate"]);
    const roles = load("components/settings/role-permission-fields.tsx", "RolePermissionFields");
    const toggles: unknown[] = [];
    assert.ok(roles.render(p, { selectedPermissions: ["post:entries"], onToggleCategory: noop,
      onTogglePermission: (v: unknown) => toggles.push(v) }).includes("ps-6"));
    const selected = roles.controls.find(c => c.props.checked === true && c.props.onCheckedChange && !c.props["aria-label"]);
    (selected!.props.onCheckedChange as () => void)();
    assert.deepEqual(toggles, ["post:entries"]);
  }
});

test("actual import view keeps CSV identity and preview bytes while keyboard browse and mappings stay canonical", () => {
  for (const p of presentations) {
    const page = load("components/bulk-import-wizard.tsx", "BulkImportWizardContent");
    const changes: unknown[] = []; let clicks = 0;
    const props = { title: caller, step: "upload", csvData: [], csvHeaders: [caller], mappings: [{ csvColumn: caller, targetField: "name" }],
      preview: [{ row: 1, data: { amountMinor: "0001250", name: "\u0646\u0627\u0645" }, valid: true, errors: [] }],
      validCount: 1, fileName: caller + ".csv", result: null, loading: false, error: null, dragActive: false,
      fileInputRef: { current: { click: () => { clicks++; } } }, targetFields: [{ key: "name", label: caller }],
      setDragActive: noop, setMappings: (v: unknown) => changes.push(v), reset: noop, handleDrop: noop,
      handleFileUpload: noop, handlePreview: noop, handleImport: noop, setStep: noop, onOpenChange: noop };
    const upload = page.render(p, props);
    assert.ok(upload.includes('role="button"')); assert.ok(upload.includes('tabindex="0"'));
    const browse = page.controls.find(c => c.props.onKeyDown)!;
    let prevented = 0;
    for (const key of ["Enter", " ", "Escape"]) (browse.props.onKeyDown as (e: unknown) => void)({ key, preventDefault: () => { prevented++; } });
    assert.equal(clicks, 2); assert.equal(prevented, 2);
    const mapping = page.render(p, { ...props, step: "mapping" });
    assert.ok(mapping.includes(`>${escape(caller + ".csv")}</bdi>`));
    assert.ok(mapping.includes("rtl:rotate-180"));
    const select = page.controls.find(c => c.props.onValueChange)!;
    (select.props.onValueChange as (v: string) => void)("__skip__");
    assert.deepEqual(changes, [[{ csvColumn: caller, targetField: "" }]]);
    const preview = page.render(p, { ...props, step: "preview" });
    assert.ok(preview.includes('data-slot="identifier-text" dir="ltr"'));
    assert.ok(preview.includes(escape(JSON.stringify(props.preview[0].data))));
  }
});

test("procurement numeric inputs and switches keep raw values and named boolean callbacks", () => {
  for (const p of presentations) {
    const form = load("components/settings/procurement-settings-form.tsx", "ProcurementSettingsForm");
    const changes: unknown[] = [];
    const settings = { priceTolerancePercent: 500, qtyTolerancePercent: 250, requireGrnBeforeBill: false, blockOverBill: true };
    const html = form.render(p, { saving: false, settings, priceInput: "5.00", qtyInput: "2.50", onSave: noop,
      onPriceChange: (v: unknown) => changes.push(v), onQtyChange: noop,
      onSettingsChange: (fn: (v: typeof settings) => unknown) => changes.push(fn(settings)) });
    assert.ok(html.includes('dir="ltr"')); assert.ok(html.includes('value="5.00"'));
    const input = form.controls.find(c => c.props.value === "5.00")!;
    assert.ok(input.props["aria-label"]);
    (input.props.onChange as (e: unknown) => void)({ target: { value: "0005.50" } });
    const toggle = form.controls.find(c => c.props.checked === false && c.props.onCheckedChange)!;
    assert.ok(toggle.props["aria-label"]);
    (toggle.props.onCheckedChange as (v: boolean) => void)(true);
    assert.deepEqual(changes, ["0005.50", { ...settings, requireGrnBeforeBill: true }]);
  }
});

test("installed Tailwind generates logical indent, bounded scrolling and directional arrow rules", async () => {
  const css = (await compile('@theme { --spacing: 0.25rem; } @tailwind utilities;')).build(["ps-6", "me-0.5", "overflow-x-auto", "rtl:rotate-180", "flex-wrap", "[unicode-bidi:isolate]"]);
  assert.ok(css.includes("padding-inline-start")); assert.ok(css.includes("margin-inline-end"));
  assert.ok(css.includes("overflow-x: auto")); assert.ok(css.includes(":dir(rtl)"));
  assert.ok(css.includes("unicode-bidi: isolate")); assert.ok(css.includes("flex-wrap: wrap"));
});
