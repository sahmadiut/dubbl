import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { createElement, type ComponentType, type ReactNode } from "react";
import * as React from "react";
import * as jsx from "react/jsx-runtime";
import * as intl from "next-intl";
import ts from "typescript";
import * as presentation from "../../i18n/project-collaboration-presentation";
import * as dates from "../../i18n/dates";
import * as provider from "../../i18n/provider";
import { renderWithPresentation } from "./presentation";
import en from "../../messages/en-US.json";
import fa from "../../messages/fa-IR.json";

export const locales = ["en-US", "fa-IR"] as const;
export type Locale = typeof locales[number];
export const caller = "<script>caller & name</script>";
export const esc = (v: string) => v.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
export const member = { id: "membership-a", memberId: "member-a", role: "manager", hourlyRate: Number.MAX_SAFE_INTEGER, hourlyRateMinor: String(Number.MAX_SAFE_INTEGER), member: { id: "member-a", user: { name: caller, email: "a@example.test" } } };
export const note = { id: "note-a", content: caller, isPinned: true, createdAt: "2026-10-21T21:15:00Z", author: { name: caller, email: "a@example.test" } };
export const assignment = { id: "assignment-a", teamId: "team-a", defaultRole: "contributor", team: { id: "team-a", name: caller, color: "#10b981", members: [{ id: "team-member-a", member: member.member }] } };
export const project = { id: "project-a", currency: "KWD", members: [member], notes: [note, { ...note, id: "note-b", content: "Second note", isPinned: false, createdAt: "2026-10-20T10:00:00Z", author: { name: null, email: "b@example.test" } }] };
export const translate = (locale: Locale, namespace: "ProjectMembers" | "ProjectNotes") => intl.createTranslator({ locale, messages: locale === "en-US" ? en : fa, namespace });
type Capture = { kind: string; props: Record<string, unknown> };

/** Real production JSX with real next-intl; control hook state, IO, and sheet portals. */
export function renderCollaboration(slice: "members" | "notes", locale: Locale, states: Record<string, unknown> = {}) {
  const path = `app/(dashboard)/projects/[id]/${slice}/page.tsx`, source = readFileSync(path, "utf8");
  const stateNames: string[] = [];
  const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function visit(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && node.initializer && ts.isCallExpression(node.initializer) && node.initializer.expression.getText(ast) === "useState" && ts.isArrayBindingPattern(node.name)) stateNames.push((node.name.elements[0] as ts.BindingElement).name.getText(ast));
    ts.forEachChild(node, visit);
  }
  visit(ast);
  const events: unknown[][] = [], captured: Capture[] = [], effects: (() => void | (() => void))[] = [];
  let index = 0;
  const capture = (factory: typeof jsx.jsx) => (kind: unknown, props: Record<string, unknown>, key: string) => {
    captured.push({ kind: typeof kind === "string" ? kind : (kind as { name?: string })?.name ?? "", props });
    return factory(kind as Parameters<typeof jsx.jsx>[0], props, key);
  };
  const require = createRequire(resolve(path)), compiled = { exports: {} as Record<string, ComponentType> };
  const load = (id: string): unknown => {
    if (id === "react") return { ...React,
      useState: (initial: unknown) => { const key = stateNames[index++]; return [Object.hasOwn(states, key) ? states[key] : typeof initial === "function" ? initial() : initial, (v: unknown) => events.push([key, v])]; },
      useEffect: (fn: () => void | (() => void)) => effects.push(fn), useCallback: (fn: unknown) => fn,
    };
    if (id === "react/jsx-runtime") return { ...jsx, jsx: capture(jsx.jsx), jsxs: capture(jsx.jsxs) };
    if (id === "next-intl") return intl;
    if (id === "../project-context") return { useProject: () => ({ project, orgId: "org-a", projectId: project.id, refresh: () => events.push(["refresh"]), ...(states.context as object) }) };
    if (id.endsWith("/project-collaboration-presentation")) return presentation;
    if (id.endsWith("/i18n/dates")) return dates;
    if (id.endsWith("/i18n/provider")) return provider;
    if (id === "sonner") return { toast: { error: (v: string) => events.push(["error", v]), success: (v: string) => events.push(["success", v]) } };
    if (id.endsWith("/use-document-title")) return { useDocumentTitle: (v: string) => events.push(["title", v]) };
    if (id.endsWith("/ui/sheet")) return Object.fromEntries(["Sheet", "SheetContent", "SheetHeader", "SheetTitle", "SheetDescription"].map(name => [name, ({ children }: { children: ReactNode }) => createElement("div", { "data-sheet": name }, children)]));
    return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  };
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function("require", "module", "exports", code)(load, compiled, compiled.exports);
  return { html: renderWithPresentation(createElement(compiled.exports.default), locale), captured, events, effects };
}
export const has = (h: ReturnType<typeof renderCollaboration>, key: string, value?: unknown) => h.events.some(v => JSON.stringify(v) === JSON.stringify(value === undefined ? [key] : [key, value]));
function content(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(content).join("");
  if (value && typeof value === "object" && "props" in value) return content((value.props as { children?: unknown }).children);
  return "";
}
export const button = (h: ReturnType<typeof renderCollaboration>, label: string, name?: string) => h.captured.find(c => typeof c.props.onClick === "function" && (name ? c.props.onClick.name === name : content(c.props.children) === label || c.props["aria-label"] === label))!.props.onClick as () => Promise<void>;
export const flush = async () => { for (let i = 0; i < 8; i++) await new Promise(resolve => setImmediate(resolve)); };
