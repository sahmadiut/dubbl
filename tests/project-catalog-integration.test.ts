import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import * as React from "react";
import { createElement, type ComponentType, type ReactNode } from "react";
import * as nextIntl from "next-intl";
import ts from "typescript";
import * as projectOverview from "../i18n/project-overview-presentation";
import * as projectTasks from "../i18n/project-task-presentation";
import * as presentation from "../i18n/provider";
import * as calendar from "../components/ui/calendar";
import * as dayPicker from "react-day-picker";
import * as dataTable from "../components/dashboard/data-table";
import * as brandLoader from "../components/dashboard/brand-loader";
import { projectDetailJson } from "../i18n/project-presentation";
import { projectMoneyDisplay } from "../lib/money/project-display";
import { renderWithPresentation } from "./helpers/presentation";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const root = "app/(dashboard)/projects";
const detail = `${root}/[id]`;
const drawer = "components/dashboard/create-drawer.tsx";
const namespaces = ["Projects", "ProjectOverview", "ProjectMilestones", "ProjectTasks", "ProjectTime", "ProjectMembers", "ProjectNotes"] as const;
const noop = () => {};
const caller = "<script>Caller & project</script>";
const escaped = (s: string) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
const user = { id: "user-a", name: caller, email: "caller@example.test", image: null };
const entry = { id: "entry-a", projectId: "project-a", date: "2026-10-21", description: caller, minutes: 95, isBillable: true, hourlyRate: Number.MAX_SAFE_INTEGER, hourlyRateMinor: String(Number.MAX_SAFE_INTEGER), invoiceId: null, taskId: "task-a", user };
const project = {
  id: "project-a", name: caller, status: "active", priority: "high", billingType: "hourly", color: "#10b981", currency: "KWD",
  budget: Number.MAX_SAFE_INTEGER, budgetMinor: String(Number.MAX_SAFE_INTEGER), hourlyRate: 29, hourlyRateMinor: "29", fixedPrice: 0, fixedPriceMinor: "0",
  totalBilled: 29, totalBilledMinor: "29", totalHours: 95, estimatedHours: 120, contact: { name: caller }, contactId: "contact-a", tags: [caller],
  category: caller, description: caller, startDate: "2026-10-01", endDate: "2026-10-31", enableTasks: true, enableTimeTracking: true,
  enableMilestones: true, enableNotes: true, enableBilling: true, teams: [], labels: [], runningTimers: [],
  members: [{ id: "link-a", role: "manager", hourlyRate: Number.MAX_SAFE_INTEGER, hourlyRateMinor: String(Number.MAX_SAFE_INTEGER), member: { id: "member-a", role: "member", user } }],
  tasks: [{ id: "task-a", title: caller, status: "todo", priority: "high", dueDate: "2026-10-21", labels: [], checklist: [], comments: [] }],
  milestones: [{ id: "milestone-a", title: caller, description: caller, status: "upcoming", amount: 29, amountMinor: "29", dueDate: "2026-10-21", progressPercent: 10, invoicedAmountCents: 0, invoicedAmountCentsMinor: "0" }],
  notes: [{ id: "note-a", content: caller, isPinned: true, author: user, createdAt: "2026-10-21T10:00:00Z" }],
  timeEntries: [entry],
};
type States = Record<string, Record<string, unknown>>;

// Link the real layout, provider and sibling pages in one React context and
// translation provider. Control hooks/IO, motion, charts and portal boundaries.
function composition(pathname: string, states: States = {}) {
  const cache = new Map<string, Record<string, ComponentType<Record<string, unknown>>>>();
  function load(file: string) {
    const path = resolve(file);
    if (cache.has(path)) return cache.get(path)!;
    const source = readFileSync(path, "utf8");
    const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const hooks: string[] = [];
    function inspect(n: ts.Node) {
      if (ts.isVariableDeclaration(n) && ts.isArrayBindingPattern(n.name) && n.initializer && ts.isCallExpression(n.initializer) && n.initializer.expression.getText(ast) === "useState") hooks.push(n.name.elements[0].getText(ast));
      ts.forEachChild(n, inspect);
    }
    inspect(ast);
    let index = 0;
    const overrides = states[file] ?? {};
    const inline = () => function Inline({ children, placeholder }: { children?: ReactNode; placeholder?: string }) {
      return createElement("div", null, children, placeholder);
    };
    const require = createRequire(path);
    const compiled = { exports: {} as Record<string, ComponentType<Record<string, unknown>>> };
    const dependency = (id: string): unknown => {
      if (id === "react") return { ...React, useState: (initial: unknown) => {
        const key = hooks[index++];
        return [Object.hasOwn(overrides, key) ? overrides[key] : typeof initial === "function" ? initial() : initial, noop];
      }, useEffect: noop };
      if (id === "next-intl") return nextIntl;
      if (id.endsWith("/project-overview-presentation")) return projectOverview;
      if (id.endsWith("/project-task-presentation")) return projectTasks;
      if (id.endsWith("/i18n/provider")) return presentation;
      if (id.endsWith("/ui/calendar")) return calendar;
      if (id === "react-day-picker") return dayPicker;
      if (id.endsWith("/data-table")) return dataTable;
      if (id.endsWith("/brand-loader")) return brandLoader;
      if (id === "./project-context" || id === "../project-context") return load(`${detail}/project-context.tsx`);
      if (id === "next/navigation") return { usePathname: () => pathname, useParams: () => ({ id: "project-a" }), useRouter: () => ({ push: noop }) };
      if (id.endsWith("/use-document-title")) return { useDocumentTitle: noop };
      if (id.endsWith("/create-drawer")) return { useCreateDrawer: () => ({ open: noop }) };
      if (id.endsWith("/use-confirm")) return { useConfirm: () => ({ dialog: null, confirm: async () => false }) };
      if (id.endsWith("/blur-reveal")) return { BlurReveal: inline() };
      if (id.endsWith("/content-reveal")) return { ContentReveal: inline() };
      if (["/ui/sheet", "/ui/select", "/ui/tabs", "/ui/date-picker", "/contact-picker"].some(s => id.endsWith(s))) return new Proxy({}, { get: () => inline() });
      if (id === "recharts") return new Proxy({}, { get: (_target, key) => function Chart({ children }: { children?: ReactNode }) { return createElement(key === "ResponsiveContainer" ? "svg" : "g", null, children); } });
      return require(id.startsWith("@/") ? resolve(id.slice(2)) : id.startsWith(".") ? resolve(dirname(path), id) : id);
    };
    const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    new Function("require", "module", "exports", code)(dependency, compiled, compiled.exports);
    cache.set(path, compiled.exports);
    return compiled.exports;
  }
  return { load };
}

test("combined project catalogs pair all seven namespaces and 498 Persian messages", () => {
  assert.deepEqual(Object.keys(en).filter(n => n.startsWith("Project")), [...namespaces]);
  let count = 0;
  for (const namespace of namespaces) {
    assert.deepEqual(Object.keys(en[namespace]).sort(), Object.keys(fa[namespace]).sort());
    count += Object.keys(en[namespace]).length;
    for (const [key, value] of Object.entries(fa[namespace])) assert.match(value, /[\u0600-\u06ff]/u, `${namespace}.${key}`);
  }
  assert.equal(count, 498);
});

test("one checked project composes actual provider, navigation and all seven detail workflows in both locales", async () => {
  const checked = (await projectDetailJson(Response.json({ project }), project.id)).project;
  for (const locale of ["en-US", "fa-IR"] as const) {
    const messages = locale === "en-US" ? en : fa;
    for (const [route, label] of [
      ["page.tsx", messages.ProjectOverview.financials],
      ["tasks/page.tsx", messages.ProjectTasks.newTask],
      ["time/page.tsx", messages.ProjectTime.logTime],
      ["milestones/page.tsx", messages.ProjectMilestones.newMilestone],
      ["members/page.tsx", messages.ProjectMembers.assignTeam],
      ["notes/page.tsx", messages.ProjectNotes.addNote],
      ["settings/page.tsx", messages.Projects.saveChanges],
    ] as const) {
      const suffix = route === "page.tsx" ? "" : `/${route.split("/")[0]}`;
      const { load } = composition(`/projects/project-a${suffix}`, { [`${detail}/project-context.tsx`]: { project: checked, loading: false, orgId: "org-a" } });
      const Layout = load(`${detail}/layout.tsx`).default, Page = load(`${detail}/${route}`).default;
      const html = renderWithPresentation(createElement(Layout, null, createElement(Page)), locale);
      assert.ok(html.includes(escaped(label)), route);
      assert.ok(html.includes(escaped(caller)) && !html.includes("<script>"), route);
      for (const tab of ["", "/tasks", "/time", "/milestones", "/notes", "/members", "/settings"]) assert.ok(html.includes(`href="/projects/project-a${tab}"`), `${route}: ${tab}`);
      assert.ok(new RegExp(`<a(?=[^>]*href="/projects/project-a${suffix}")(?=[^>]*aria-current="page")[^>]*>`).test(html), route);
      assert.ok(html.includes(escaped(projectMoneyDisplay(checked.budget, checked.currency))), route);
      if (["page.tsx", "time/page.tsx"].includes(route)) {
        const derived = (95n * BigInt(Number.MAX_SAFE_INTEGER) + 30n) / 60n;
        assert.ok(derived > BigInt(Number.MAX_SAFE_INTEGER));
        assert.ok(html.includes(escaped(projectMoneyDisplay(derived, checked.currency))), route);
      }
      assert.ok(!html.includes("MISSING_MESSAGE"));
    }
  }
});

test("shared provider prevents every detail page from rendering failed or previous-route data", () => {
  for (const locale of ["en-US", "fa-IR"] as const) for (const failed of [null, { ...project, id: "previous-route" }]) {
    const messages = locale === "en-US" ? en : fa;
    for (const route of ["page.tsx", "tasks/page.tsx", "time/page.tsx", "milestones/page.tsx", "members/page.tsx", "notes/page.tsx", "settings/page.tsx"]) {
      const { load } = composition("/projects/project-a", { [`${detail}/project-context.tsx`]: { project: failed, loading: false, loadError: "loadFailed" } });
      const Layout = load(`${detail}/layout.tsx`).default, Page = load(`${detail}/${route}`).default;
      const html = renderWithPresentation(createElement(Layout, null, createElement(Page)), locale);
      assert.ok(html.includes('role="alert"') && html.includes(escaped(messages.ProjectOverview.loadFailed)), route);
      assert.ok(html.includes('href="/projects"') && !html.includes('href="/projects/project-a/tasks"'), route);
      assert.ok(!html.includes(escaped(caller)) && !html.includes("90071992547409.91"), route);
    }
  }
});

test("combined extraction audits all 11 project components and the creation drawer with explicit exceptions", () => {
  function files(path: string): string[] { return readdirSync(path, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(`${path}/${e.name}`) : e.name.endsWith(".tsx") ? [`${path}/${e.name}`] : []); }
  const routes = files(root);
  assert.deepEqual(routes.map(p => p.slice(root.length + 1)).sort(), ["page.tsx", "loading.tsx", "[id]/layout.tsx", "[id]/page.tsx", "[id]/project-context.tsx", "[id]/tasks/page.tsx", "[id]/time/page.tsx", "[id]/milestones/page.tsx", "[id]/members/page.tsx", "[id]/notes/page.tsx", "[id]/settings/page.tsx"].sort());
  for (const path of [...routes, drawer]) {
    const ast = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const owners = path === drawer ? ast.statements.filter(n => ts.isFunctionDeclaration(n) && n.name && ["ProjectDrawer", "DrawerFooter", "SectionLabel"].includes(n.name.text)) : [ast];
    function audit(n: ts.Node) {
      if (ts.isJsxText(n)) assert.doesNotMatch(n.text.trim().replace(/&(?:rarr|middot|ndash|mdash|infin);/g, ""), /[A-Za-z]/, `${path}: ${n.text.trim()}`);
      if (ts.isJsxAttribute(n) && ["title", "description", "placeholder", "aria-label", "alt", "label", "emptyMessage"].includes(n.name.getText(ast)) && n.initializer && ts.isStringLiteral(n.initializer)) assert.doesNotMatch(n.initializer.text, /[A-Za-z]/, `${path}: ${n.getText(ast)}`);
      if (ts.isCallExpression(n) && /^(toast\.(success|error)|useDocumentTitle)$/.test(n.expression.getText(ast))) assert.ok(!n.arguments.some(ts.isStringLiteral), `${path}: ${n.getText(ast)}`);
      // Legacy context formatters are compatibility exports only. Config imports
      // in presentation helpers supply colors; all rendered labels are translated.
      if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier) && n.moduleSpecifier.text.endsWith("project-context") && n.importClause?.namedBindings && ts.isNamedImports(n.importClause.namedBindings)) {
        for (const binding of n.importClause.namedBindings.elements) assert.ok(!["formatHours", "formatDate", "formatDateShort", "statusConfig", "priorityConfig", "taskStatusConfig"].includes(binding.name.text), `${path}: ${binding.name.text}`);
      }
      ts.forEachChild(n, audit);
    }
    owners.forEach(audit);
  }
});
