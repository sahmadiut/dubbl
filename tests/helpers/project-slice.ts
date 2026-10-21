import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { createElement, type ComponentType, type ReactNode } from "react";
import * as React from "react";
import * as jsx from "react/jsx-runtime";
import * as intl from "next-intl";
import ts from "typescript";
import * as context from "../../app/(dashboard)/projects/[id]/project-context";
import * as presentation from "../../i18n/project-overview-presentation";
import * as time from "../../i18n/project-time-presentation";
import * as milestones from "../../i18n/project-milestones-presentation";
import * as dates from "../../i18n/dates";
import * as provider from "../../i18n/provider";
import * as datePicker from "../../components/ui/date-picker";
import * as dataTable from "../../components/dashboard/data-table";
import { renderWithPresentation } from "./presentation";
import en from "../../messages/en-US.json";
import fa from "../../messages/fa-IR.json";

export const locales = ["en-US", "fa-IR"] as const;
export type Locale = typeof locales[number];
export const caller = "<script>caller & name</script>";
export const esc = (v: string) => v.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
export const entry = { id: "entry-a", projectId: "project-a", date: "2026-10-21", description: caller, minutes: 95, isBillable: true, hourlyRate: Number.MAX_SAFE_INTEGER, hourlyRateMinor: String(Number.MAX_SAFE_INTEGER), invoiceId: null, taskId: "task-a", user: { name: caller } };
export const milestone = { id: "milestone-a", title: caller, description: caller, dueDate: "2026-10-21", status: "upcoming", amount: Number.MAX_SAFE_INTEGER, amountMinor: String(Number.MAX_SAFE_INTEGER), invoicedAmountCents: 0, invoicedAmountCentsMinor: "0", progressPercent: 10 };
export const timer = { id: "timer-a", projectId: "project-a", userId: "user-a", taskId: null, description: null, isBillable: true, startedAt: "2026-10-21T10:00:00Z", pausedAt: null, accumulatedSeconds: 0 };
export const project = { id: "project-a", currency: "KWD", color: "#10b981", billingType: "milestone", enableBilling: true, hourlyRate: 29, fixedPrice: Number.MAX_SAFE_INTEGER, tasks: [{ id: "task-a", title: caller }], members: [{ member: { id: "member-a", user: { name: caller, email: "a@example.test" } } }], timeEntries: [entry], milestones: [milestone, { ...milestone, id: "milestone-b", status: "completed" }], runningTimers: [] };
export const translate = (locale: Locale, namespace: "ProjectTime" | "ProjectMilestones") => intl.createTranslator({ locale, messages: locale === "en-US" ? en : fa, namespace });
type Capture = { kind: string; props: Record<string, unknown> };

/** Real production JSX and localization; controlled hook state, IO and portal/chart boundaries. */
export function renderSlice(slice: "time" | "milestones", locale: Locale, states: Record<string, unknown> = {}) {
  const path = `app/(dashboard)/projects/[id]/${slice}/page.tsx`, source = readFileSync(path, "utf8");
  const stateNames: string[] = [], refNames: string[] = [];
  const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function visit(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && node.initializer && ts.isCallExpression(node.initializer)) {
      const name = node.initializer.expression.getText(ast);
      if (name === "useState" && ts.isArrayBindingPattern(node.name)) stateNames.push((node.name.elements[0] as ts.BindingElement).name.getText(ast));
      if (name === "useRef") refNames.push(node.name.getText(ast));
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  const events: unknown[][] = [], captured: Capture[] = [], effects: (() => void | (() => void))[] = [], callbacks: (() => Promise<void>)[] = [];
  const refs: Record<string, { current: unknown }> = {};
  let index = 0, refIndex = 0;
  const capture = (factory: typeof jsx.jsx) => (kind: unknown, props: Record<string, unknown>, key: string) => {
    captured.push({ kind: typeof kind === "string" ? kind : (kind as { name?: string })?.name ?? "", props });
    return factory(kind as Parameters<typeof jsx.jsx>[0], props, key);
  };
  const require = createRequire(resolve(path)), compiled = { exports: {} as Record<string, ComponentType> };
  const load = (id: string): unknown => {
    if (id === "react") return { ...React,
      useState: (initial: unknown) => { const key = stateNames[index++]; return [Object.hasOwn(states, key) ? states[key] : typeof initial === "function" ? initial() : initial, (v: unknown) => events.push([key, v])]; },
      useRef: (initial: unknown) => { const key = refNames[refIndex++]; return refs[key] = { current: initial }; },
      useEffect: (fn: () => void | (() => void)) => effects.push(fn),
      useMemo: (fn: () => unknown) => fn(), useCallback: (fn: () => Promise<void>) => { callbacks.push(fn); return fn; },
    };
    if (id === "react/jsx-runtime") return { ...jsx, jsx: capture(jsx.jsx), jsxs: capture(jsx.jsxs) };
    if (id === "next-intl") return intl;
    if (id === "../project-context") return { ...context, useProject: () => ({ project, orgId: "org-a", projectId: project.id, refresh: () => events.push(["refresh"]), ...(states.context as object) }) };
    if (id.endsWith("/project-overview-presentation")) return presentation;
    if (id.endsWith("/project-time-presentation")) return time;
    if (id.endsWith("/project-milestones-presentation")) return milestones;
    if (id.endsWith("/i18n/dates")) return dates;
    if (id.endsWith("/i18n/provider")) return provider;
    if (id.endsWith("/ui/date-picker")) return datePicker;
    if (id.endsWith("/dashboard/data-table")) return dataTable;
    if (id === "sonner") return { toast: { error: (v: string) => events.push(["error", v]), success: (v: string) => events.push(["success", v]) } };
    if (id.endsWith("/use-document-title")) return { useDocumentTitle: (v: string) => events.push(["title", v]) };
    if (id.endsWith("/ui/sheet")) return Object.fromEntries(["Sheet", "SheetContent", "SheetHeader", "SheetTitle", "SheetDescription"].map(name => [name, ({ children }: { children: ReactNode }) => createElement("div", { "data-sheet": name }, children)]));
    if (id === "recharts") return new Proxy({}, { get: (_target, key) => function Chart(props: Record<string, unknown>) { captured.push({ kind: String(key), props }); return createElement(key === "ResponsiveContainer" ? "svg" : "g", { "data-chart": String(key) }, props.children as ReactNode); } });
    return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  };
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function("require", "module", "exports", code)(load, compiled, compiled.exports);
  return { html: renderWithPresentation(createElement(compiled.exports.default), locale), captured, events, effects, callbacks, refs };
}
export const has = (h: ReturnType<typeof renderSlice>, key: string, value?: unknown) => h.events.some(v => JSON.stringify(v) === JSON.stringify(value === undefined ? [key] : [key, value]));
function content(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(content).join("");
  if (value && typeof value === "object" && "props" in value) return content((value.props as { children?: unknown }).children);
  return "";
}
export const button = (h: ReturnType<typeof renderSlice>, label: string) => h.captured.find(c => typeof c.props.onClick === "function" && (content(c.props.children) === label || c.props["aria-label"] === label))!.props.onClick as () => Promise<void>;
export const flush = async () => { for (let i = 0; i < 8; i++) await new Promise(resolve => setImmediate(resolve)); };
