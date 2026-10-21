import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { createElement, type ComponentType, type ReactNode } from "react";
import * as React from "react";
import * as jsx from "react/jsx-runtime";
import * as nextIntl from "next-intl";
import ts from "typescript";
import * as BrandLoader from "../../components/dashboard/brand-loader";
import * as ReportComponents from "../../app/(dashboard)/reports/_components";
import * as DateRangeFilter from "../../components/dashboard/date-range-filter";
import * as ErrorState from "../../components/dashboard/error-state";
import * as DataTable from "../../components/dashboard/data-table";
import * as ExportButton from "../../components/dashboard/export-button";
import * as DatePicker from "../../components/ui/date-picker";
import * as CurrencySelect from "../../components/ui/currency-select";
import { renderWithPresentation } from "./presentation";

export type Capture = { kind: string; props: Record<string, unknown> };
export type Harness = { html: string; captured: Capture[]; effects: (() => void | (() => void))[]; events: [string, unknown][]; refs: Record<string, { current: unknown }> };

// Render production JSX/readers and real shared UI under PresentationProvider.
// Only page hook state, IO and animation are controlled by this harness.
export function renderReportPage(route: string, states: Record<string, unknown> = {}, locale: "en-US" | "fa-IR" = "en-US"): Harness {
  const file = `app/(dashboard)/reports/${route}/page.tsx`;
  const ast = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const names: string[] = [], refNames: string[] = [];
  function hooks(n: ts.Node) {
    if (ts.isVariableDeclaration(n) && n.initializer && ts.isCallExpression(n.initializer)) {
      if (ts.isArrayBindingPattern(n.name) && n.initializer.expression.getText(ast) === "useState") names.push(n.name.elements[0].getText(ast));
      if (n.initializer.expression.getText(ast) === "useRef") refNames.push(n.name.getText(ast));
    }
    ts.forEachChild(n, hooks);
  }
  hooks(ast);
  const h: Harness = { html: "", captured: [], effects: [], events: [], refs: {} };
  const capture = (factory: typeof jsx.jsx) => (kind: unknown, props: Record<string, unknown>, key: string) => {
    h.captured.push({ kind: typeof kind === "string" ? kind : (kind as { name?: string })?.name ?? "", props });
    return factory(kind as Parameters<typeof jsx.jsx>[0], props, key);
  };
  let index = 0, refIndex = 0;
  const require = createRequire(resolve(file)), compiled = { exports: {} as { default: ComponentType } };
  const load = (id: string): unknown => {
    if (id === "react") return { ...React, useState: (initial: unknown) => {
      const key = names[index++];
      const value = Object.hasOwn(states, key) ? states[key] : typeof initial === "function" ? initial() : initial;
      return [value, (v: unknown) => h.events.push([key, v])];
    }, useEffect: (fn: () => void | (() => void)) => h.effects.push(fn), useRef: (initial: unknown) => {
      const ref = { current: initial }; h.refs[refNames[refIndex++]] = ref; return ref;
    } };
    if (id === "react/jsx-runtime") return { ...jsx, jsx: capture(jsx.jsx), jsxs: capture(jsx.jsxs) };
    if (id === "next/navigation") return { useRouter: () => ({ push: (url: string) => h.events.push(["push", url]) }) };
    if (id === "next-intl") return nextIntl;
    if (id.endsWith("/brand-loader")) return BrandLoader;
    if (id === "../_components") return ReportComponents;
    if (id.endsWith("/date-range-filter")) return DateRangeFilter;
    if (id.endsWith("/error-state")) return ErrorState;
    if (id.endsWith("/data-table")) return DataTable;
    if (id.endsWith("/export-button")) return ExportButton;
    if (id.endsWith("/date-picker")) return DatePicker;
    if (id.endsWith("/currency-select")) return CurrencySelect;
    if (id.endsWith("/content-reveal")) return { ContentReveal: ({ children }: { children: ReactNode }) => createElement("div", null, children) };
    return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  };
  const code = ts.transpileModule(ast.text, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function("require", "module", "exports", code)(load, compiled, compiled.exports);
  h.html = renderWithPresentation(createElement(compiled.exports.default), locale);
  return h;
}
export const has = (h: Harness, key: string, value: unknown) => h.events.some(e => e[0] === key && e[1] === value);
export const flush = async () => { for (let i = 0; i < 6; i++) await new Promise(resolve => setImmediate(resolve)); };
export let reloads = 0;
export async function withIO(fetcher: typeof fetch, run: () => Promise<void>, org: string | null = "org-a", search = "", hash = "") {
  const original = globalThis.fetch, storage = Object.getOwnPropertyDescriptor(globalThis, "localStorage"), window = Object.getOwnPropertyDescriptor(globalThis, "window");
  globalThis.fetch = fetcher;
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: () => org } });
  Object.defineProperty(globalThis, "window", { configurable: true, value: { location: { search, hash, reload() { reloads++; } } } });
  try { await run(); } finally {
    globalThis.fetch = original;
    if (storage) Object.defineProperty(globalThis, "localStorage", storage); else Reflect.deleteProperty(globalThis, "localStorage");
    if (window) Object.defineProperty(globalThis, "window", window); else Reflect.deleteProperty(globalThis, "window");
  }
}
