import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { createElement, type ComponentType, type ReactNode } from "react";
import * as React from "react";
import * as jsx from "react/jsx-runtime";
import ts from "typescript";
import { createTranslator } from "next-intl";
import * as context from "../app/(dashboard)/projects/[id]/project-context";
import * as projectPresentation from "../i18n/project-overview-presentation";
import * as calendar from "../components/ui/calendar";
import * as dayPicker from "react-day-picker";
import * as loader from "../components/dashboard/brand-loader";
import { projectDetailJson, projectInvoiceJson } from "../i18n/project-presentation";
import { projectMoneyDisplay } from "../lib/money/project-display";
import { renderWithPresentation } from "./helpers/presentation";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const root = "app/(dashboard)/projects/[id]/";
const locales = ["en-US", "fa-IR"] as const;
type Locale = typeof locales[number];
const caller = "<script>caller & name</script>";
const project = {
  id: "project-a", name: caller, status: "on_hold", priority: "urgent", billingType: "hourly", color: "#10b981", currency: "KWD",
  budget: Number.MAX_SAFE_INTEGER, budgetMinor: String(Number.MAX_SAFE_INTEGER), hourlyRate: 29, hourlyRateMinor: "29", fixedPrice: 0, fixedPriceMinor: "0",
  totalBilled: 29, totalBilledMinor: "29", totalHours: 95, estimatedHours: 120, contact: { name: caller }, contactId: "contact-a", tags: [caller],
  category: caller, description: caller, startDate: "2026-10-01", endDate: "2026-10-31", enableTasks: true, enableTimeTracking: true,
  enableMilestones: true, enableNotes: true, enableBilling: true, teams: [], labels: [], runningTimers: [],
  members: [{ id: "link-a", role: "manager", member: { id: "member-a", user: { name: caller, email: "person@example.test", image: null } } }],
  tasks: ["backlog", "todo", "in_progress", "in_review", "done", "cancelled"].map((status, i) => ({ id: `task-${i}`, title: caller, status, priority: "high", dueDate: "2026-10-21" })),
  milestones: [{ id: "milestone-a", title: caller, status: "upcoming", amount: 29, amountMinor: "29", dueDate: "2026-10-21" }],
  notes: [{ id: "note-a", content: caller, isPinned: true }],
  timeEntries: [{ id: "entry-a", date: "2026-10-21", minutes: 95, hourlyRate: Number.MAX_SAFE_INTEGER, hourlyRateMinor: String(Number.MAX_SAFE_INTEGER), isBillable: true, invoiceId: null, user: { name: caller }, description: caller }],
};
const translator = (locale: Locale) => createTranslator({ locale, messages: locale === "en-US" ? en : fa, namespace: "ProjectOverview" });
const esc = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
type Capture = { kind: string; props: Record<string, unknown> };

// Run the production JSX, shared calendar, and real next-intl. Control hooks, IO,
// router and chart dimensions so tests can inspect callbacks and plotted data.
function render(file = "page.tsx", locale: Locale = "en-US", states: Record<string, unknown> = {}, name = file === "page.tsx" ? "ProjectOverviewPage" : file === "layout.tsx" ? "ProjectLayoutInner" : "ProjectProvider", props: Record<string, unknown> = {}) {
  const path = root + file;
  const source = readFileSync(path, "utf8") + (name === "ProjectProvider" ? "" : `\nexport { ${name} };`);
  const events: unknown[][] = [], effects: (() => void | (() => void))[] = [], captured: Capture[] = [];
  const capture = (factory: typeof jsx.jsx) => (kind: unknown, props: Record<string, unknown>, key: string) => {
    captured.push({ kind: typeof kind === "string" ? kind : (kind as { name?: string })?.name ?? "", props });
    return factory(kind as Parameters<typeof jsx.jsx>[0], props, key);
  };
  let stateIndex = 0;
  const require = createRequire(resolve(path)), compiled = { exports: {} as Record<string, ComponentType<Record<string, unknown>>> };
  const load = (id: string): unknown => {
    if (id.endsWith("/project-overview-presentation")) return projectPresentation;
    if (id.endsWith("/ui/calendar")) return calendar;
    if (id.endsWith("/brand-loader")) return loader;
    if (id === "react-day-picker") return dayPicker;
    if (id === "react") return { ...React, useState: (initial: unknown) => {
      const value = typeof initial === "function" ? initial() : initial;
      const key = file === "project-context.tsx" ? ["project", "loading", "loadError", "orgId", "refreshVersion"][stateIndex++] : value instanceof Date ? "month" : "now";
      return [Object.hasOwn(states, key) ? states[key] : value, (v: unknown) => events.push([key, v])];
    }, useEffect: (fn: () => void | (() => void)) => effects.push(fn) };
    if (id === "react/jsx-runtime") return { ...jsx, jsx: capture(jsx.jsx), jsxs: capture(jsx.jsxs) };
    if (id === "./project-context") return { ...context, useProject: () => ({ project, loading: false, loadError: "", orgId: "org-a", projectId: project.id, refresh() {}, ...(states.context as object) }), ProjectProvider: ({ children }: { children: ReactNode }) => children };
    if (id === "next/navigation") return { usePathname: () => states.pathname ?? "/projects/project-a", useParams: () => ({ id: "project-a" }), useRouter: () => ({ push: (v: string) => events.push(["push", v]) }) };
    if (id === "sonner") return { toast: { error: (v: string) => events.push(["error", v]), success: (v: string) => events.push(["success", v]) } };
    if (id.endsWith("/use-document-title")) return { useDocumentTitle: (v: string) => events.push(["title", v]) };
    if (id.endsWith("/blur-reveal")) return { BlurReveal: ({ children }: { children: ReactNode }) => children };
    if (id === "recharts") return new Proxy({}, { get: (_target, key) => function Chart(props: Record<string, unknown>) {
      captured.push({ kind: String(key), props }); return createElement(key === "AreaChart" ? "svg" : "g", { "data-chart": String(key) }, props.children as ReactNode);
    } });
    return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  };
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function("require", "module", "exports", code)(load, compiled, compiled.exports);
  const html = renderWithPresentation(createElement(compiled.exports[name], props), locale);
  return { events, effects, captured, html };
}
const flush = async () => { for (let i = 0; i < 8; i++) await new Promise(resolve => setImmediate(resolve)); };
const has = (h: ReturnType<typeof render>, key: string, value: unknown) => h.events.some(v => JSON.stringify(v) === JSON.stringify([key, value]));

test("overview renders paired copy, finite enums, caller text and exact bigint revenue", () => {
  for (const locale of locales) {
    const t = translator(locale), h = render("page.tsx", locale, { month: new Date("2026-10-21T12:00:00Z") });
    assert.ok(has(h, "title", t("documentTitle")));
    for (const key of ["logged", "tasks", "revenue", "budget", "team", "details", "financials", "progress", "activeTasks", "milestones", "recentTime", "pinnedNotes", "viewAll", "taskDistribution", "time14Days", "manager", "calendar"]) assert.ok(h.html.includes(esc(t(key as "tasks"))), key);
    assert.ok(h.html.includes(esc(caller)) && !h.html.includes("<script>"));
    const amount = (95n * BigInt(Number.MAX_SAFE_INTEGER) + 30n) / 60n;
    assert.ok(amount > BigInt(Number.MAX_SAFE_INTEGER));
    assert.ok(h.html.includes(esc(projectMoneyDisplay(amount, "KWD"))));
    const pie = h.captured.find(c => c.kind === "Pie")!.props.data as { name: string; value: number }[];
    assert.deepEqual(pie.map(v => v.name), ["done", "inProgress", "inReview", "todo", "backlog", "cancelled"].map(key => t(key as "done")));
    assert.deepEqual(pie.map(v => v.value), [1, 1, 1, 1, 1, 1]);
    assert.ok(h.captured.some(c => c.kind === "Area" && c.props.dataKey === "hours" && c.props.name === t("chartHours")));
    assert.ok(h.captured.some(c => c.kind === "YAxis" && c.props.unit === t("hourUnit")));
    for (const suffix of ["tasks", "milestones", "time", "members"]) assert.ok(h.html.includes(`href="/projects/project-a/${suffix}"`));
    for (const role of ["contributor", "viewer"]) assert.ok(render("page.tsx", locale, { context: { project: { ...project, members: [{ ...project.members[0], role }] } } }).html.includes(esc(t(role as "contributor"))));
    const empty = render("page.tsx", locale, { context: { project: { ...project, tasks: [], members: [], milestones: [], timeEntries: [], notes: [], budget: 0, endDate: null, enableBilling: false, estimatedHours: 0 } } });
    for (const key of ["noActiveTasks", "noMilestones", "noTime", "noMembers", "noTasksDisplay", "summary"]) assert.ok(empty.html.includes(esc(t(key as "noTime"))), key);
    assert.equal(render("page.tsx", locale, { context: { project: null } }).html, "");
  }
});

test("calendar uses Persian/Gregorian month adapters, canonical event keys and navigation callbacks", () => {
  for (const locale of locales) {
    const t = translator(locale), h = render("page.tsx", locale, { month: new Date("2026-10-21T12:00:00Z") });
    assert.ok(h.html.includes('data-date="2026-10-21"'));
    assert.ok(h.html.includes(esc(t("calendarEvents", { tasks: 6, milestones: 1, entries: 1 }))));
    assert.ok(h.html.includes('bg-amber-400') && h.html.includes('ring-emerald-400'));
    assert.ok(h.html.includes(locale === "en-US" ? "October 2026" : "۱۴۰۵"));
    if (locale === "fa-IR") assert.ok(!h.html.includes("October 2026"));
    const calendar = h.captured.find(c => typeof c.props.onMonthChange === "function")!;
    const next = new Date("2026-11-01T00:00:00Z"); (calendar.props.onMonthChange as (v: Date) => void)(next);
    assert.ok(has(h, "month", next));
    const today = h.captured.find(c => c.kind === "button" && c.props.children === t("today"))!;
    (today.props.onClick as () => void)(); assert.ok(h.events.some(v => v[0] === "month" && v[1] instanceof Date));
  }
});

test("layout translates tabs, errors, accessibility and preserves feature visibility and active route", () => {
  for (const locale of locales) {
    const t = translator(locale), h = render("layout.tsx", locale, { pathname: "/projects/project-a/tasks" });
    for (const key of ["overview", "tasks", "time", "milestones", "notes", "team", "settings", "invoice"]) assert.ok(h.html.includes(esc(t(key as "tasks"))));
    assert.ok(h.captured.some(c => c.props.href === "/projects/project-a/tasks" && c.props["aria-current"] === "page"));
    assert.ok(h.html.includes(esc(t("backToProjects"))) && h.html.includes(esc(caller)) && !h.html.includes("<script>"));
    const hidden = render("layout.tsx", locale, { context: { project: { ...project, enableTasks: false, enableTimeTracking: false, enableMilestones: false, enableNotes: false, enableBilling: false } } });
    for (const suffix of ["tasks", "time", "milestones", "notes"]) assert.ok(!hidden.html.includes(`href="/projects/project-a/${suffix}"`));
    assert.ok(!hidden.captured.some(c => typeof c.props.onClick === "function"));
    for (const loadError of ["organizationRequired", "loadFailed"]) {
      const failed = render("layout.tsx", locale, { context: { project: null, loadError } });
      assert.ok(failed.html.includes('role="alert"') && failed.html.includes(esc(t(loadError as "loadFailed"))));
    }
    assert.ok(render("layout.tsx", locale, { context: { project: null } }).html.includes(esc(t("notFound"))));
    assert.ok(render("layout.tsx", locale, { context: { loading: true } }).html.includes("brand-loader"));
  }
});

test("invoice action validates acknowledgements and keeps private diagnostics out of translated feedback", async () => {
  const original = globalThis.fetch;
  try {
    for (const locale of locales) for (const mode of ["ok", "http", "json", "envelope", "money", "network", "org"]) {
      const t = translator(locale), h = render("layout.tsx", locale, { context: mode === "org" ? { orgId: null } : {} });
      globalThis.fetch = async (url, init) => {
        assert.notEqual(mode, "org"); assert.equal(url, "/api/v1/projects/project-a/invoice");
        assert.equal(init?.method, "POST"); assert.deepEqual(init?.headers, { "Content-Type": "application/json", "x-organization-id": "org-a" }); assert.equal(init?.body, "{}");
        if (mode === "http") return Response.json({ error: "Private server" }, { status: 403 });
        if (mode === "json") return new Response("Private JSON");
        if (mode === "envelope") return Response.json({ invoice: {} });
        if (mode === "money") return Response.json({ invoice: { id: "invoice-a", total: 29, totalMinor: "30" } });
        if (mode === "network") throw new Error("Private network");
        return Response.json({ invoice: { id: "invoice-a" } });
      };
      await (h.captured.find(c => c.kind === "Button" && typeof c.props.onClick === "function")!.props.onClick as () => Promise<void>)();
      if (mode === "ok") assert.ok(has(h, "success", t("invoiceGenerated")) && has(h, "push", "/sales/invoice-a"));
      else { assert.ok(has(h, "error", t(mode === "org" ? "organizationRequired" : "invoiceFailed"))); assert.ok(!h.events.some(v => ["push", "success"].includes(v[0] as string))); }
      assert.ok(!JSON.stringify(h.events).includes("Private"));
    }
  } finally { globalThis.fetch = original; }
});

test("detail readers reject malformed identity, envelope, dates, exact aliases, counts and rendered joins", async () => {
  assert.deepEqual((await projectDetailJson(Response.json({ project }), project.id)).project, project);
  for (const body of [null, [], {}, { project: null }]) await assert.rejects(projectDetailJson(Response.json(body), project.id));
  for (const patch of [{ id: "foreign" }, { budgetMinor: "30" }, { billingType: "private" }, { tasks: null }, { tags: [null] }, { enableTasks: "true" }, { endDate: "2026-02-30" }, { timeEntries: [{ ...project.timeEntries[0], minutes: 0.1 }] }, { timeEntries: [{ ...project.timeEntries[0], user: {} }] }, { tasks: [{ ...project.tasks[0], status: "private" }] }, { milestones: [null] }, { notes: [{ ...project.notes[0], isPinned: 1 }] }]) await assert.rejects(projectDetailJson(Response.json({ project: { ...project, ...patch } }), project.id));
  for (const read of [(r: Response) => projectDetailJson(r, project.id), projectInvoiceJson]) {
    await assert.rejects(read(Response.json({ error: "Private" }, { status: 500 })));
    await assert.rejects(read(new Response("Private JSON")));
  }
});

test("provider releases loading without org, checks reads and ignores stale responses after cleanup", async () => {
  const original = globalThis.fetch;
  try {
    for (const mode of ["ok", "org", "http", "json", "envelope", "money", "network", "cancel"]) {
      globalThis.fetch = async (url, init) => {
        assert.notEqual(mode, "org"); assert.equal(url, "/api/v1/projects/project-a"); assert.deepEqual(init?.headers, { "x-organization-id": "org-a" });
        if (mode === "http") return Response.json({ error: "Private server" }, { status: 403 });
        if (mode === "json") return new Response("Private JSON");
        if (mode === "envelope") return Response.json({});
        if (mode === "money") return Response.json({ project: { ...project, budgetMinor: "30" } });
        if (mode === "network") throw new Error("Private network");
        return Response.json({ project });
      };
      const h = render("project-context.tsx", "en-US", { orgId: mode === "org" ? null : "org-a" });
      const cleanup = h.effects[0]() as () => void;
      if (mode === "cancel") { await Promise.resolve(); cleanup(); h.events.length = 0; }
      await flush();
      if (mode === "ok") assert.ok(has(h, "project", project) && has(h, "loadError", "") && has(h, "loading", false));
      else if (mode === "cancel") assert.deepEqual(h.events, []);
      else assert.ok(has(h, "project", null) && has(h, "loadError", mode === "org" ? "organizationRequired" : "loadFailed") && has(h, "loading", false));
      assert.ok(!JSON.stringify(h.events).includes("Private"));
    }
  } finally { globalThis.fetch = original; }
});

test("provider tolerates blocked storage and never exposes a previous route's project", async () => {
  const descriptors = ["window", "localStorage"].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
  try {
    Object.defineProperty(globalThis, "window", { configurable: true, value: {} });
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem() { throw new Error("Private storage"); } } });
    const h = render("project-context.tsx"); h.effects[0](); await flush();
    assert.ok(has(h, "loadError", "organizationRequired") && has(h, "loading", false));
    const stale = render("project-context.tsx", "en-US", { project: { ...project, id: "previous-route" }, loading: false });
    const value = stale.captured.find(c => c.props.value && typeof c.props.value === "object" && "refresh" in c.props.value)!.props.value as { project: unknown; refresh: () => void };
    assert.equal(value.project, null);
    value.refresh();
    const update = stale.events.find(v => v[0] === "refreshVersion")![1] as (value: number) => number;
    assert.equal(update(5), 6);
  } finally {
    for (const [key, descriptor] of descriptors) if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
  }
});

test("authored overview/layout copy is extracted; paired Persian strings contain Persian script", () => {
  for (const file of ["page.tsx", "layout.tsx"]) {
    const ast = ts.createSourceFile(file, readFileSync(root + file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(node: ts.Node) {
      if (ts.isJsxText(node)) assert.doesNotMatch(node.text, /[A-Za-z]/, node.text.trim());
      if (ts.isJsxAttribute(node) && ["label", "title", "aria-label", "placeholder"].includes(node.name.getText(ast)) && node.initializer && ts.isStringLiteral(node.initializer)) assert.fail(node.getText(ast));
      ts.forEachChild(node, visit);
    }
    visit(ast); assert.doesNotMatch(ast.text, /err\.message|data\.error|\.json\(\)/);
  }
  assert.deepEqual(Object.keys(en.ProjectOverview).sort(), Object.keys(fa.ProjectOverview).sort());
  for (const value of Object.values(fa.ProjectOverview)) assert.match(value, /[\u0600-\u06ff]/);
});
