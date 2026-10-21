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
import * as presentation from "../i18n/project-task-presentation";
import * as datePicker from "../components/ui/date-picker";
import { projectTaskMutationJson } from "../i18n/project-task-presentation";
import { formatDateOnly, formatInstant } from "../i18n/dates";
import { resolvePresentation } from "../i18n/locale";
import { renderWithPresentation } from "./helpers/presentation";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const path = "app/(dashboard)/projects/[id]/tasks/page.tsx";
const locales = ["en-US", "fa-IR"] as const;
type Locale = typeof locales[number];
const caller = "<script>task & name</script>";
const person = { id: "user-a", name: caller, email: "person@example.test", image: null };
const task = {
  id: "task-a", title: caller, description: caller, status: "todo", priority: "urgent", startDate: "2026-10-20", dueDate: "2026-10-21",
  estimatedMinutes: 95, labels: ["label-a"], assigneeId: "member-a", teamId: "team-a", createdById: "user-a", completedAt: "2026-10-21T10:00:00Z",
  createdAt: "2026-10-20T10:00:00Z", assignee: { id: "member-a", role: "member", user: person }, team: { id: "team-a", name: caller, color: "#123456" },
  createdBy: person, checklist: [{ id: "item-a", title: caller, isCompleted: false, sortOrder: 0 }], comments: [{ id: "comment-a", content: caller, author: person, createdAt: "2026-10-20T10:00:00Z" }],
};
const project = { id: "project-a", color: "#10b981", tasks: [task], teams: [task.team], labels: [{ id: "label-a", name: caller, color: "#123456" }], members: [{ id: "link-a", role: "manager", member: task.assignee }] };
const tFor = (locale: Locale) => createTranslator({ locale, messages: locale === "en-US" ? en : fa, namespace: "ProjectTasks" });
const esc = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
type Capture = { kind: string; props: Record<string, unknown> };
const stateNames = ["addOpen", "viewTask", "saving", "statusFilter", "viewMode", "title", "desc", "priority", "taskStatus", "assigneeId", "teamId", "dueDate", "startDate", "estimatedMinutes", "selectedLabels", "editStatus", "editPriority", "editAssigneeId", "editTeamId", "newCheckItem", "newComment", "commentSaving", "togglingId", "deletingId", "checkItemSaving", "deletingCheckId", "deletingCommentId"];

// Execute production JSX and real next-intl/provider/UI. Replace only hooks, IO
// and the portaled sheet container to inspect both authored drawer surfaces.
function render(locale: Locale = "en-US", states: Record<string, unknown> = {}) {
  const source = readFileSync(path, "utf8");
  const captured: Capture[] = [], events: unknown[][] = [];
  let index = 0;
  const capture = (factory: typeof jsx.jsx) => (kind: unknown, props: Record<string, unknown>, key: string) => {
    captured.push({ kind: typeof kind === "string" ? kind : (kind as { name?: string })?.name ?? "", props });
    return factory(kind as Parameters<typeof jsx.jsx>[0], props, key);
  };
  const require = createRequire(resolve(path)), compiled = { exports: {} as Record<string, ComponentType> };
  const load = (id: string): unknown => {
    if (id.endsWith("/project-task-presentation")) return presentation;
    if (id.endsWith("/ui/date-picker")) return datePicker;
    if (id === "../project-context") return { ...context, useProject: () => ({ project, orgId: "org-a", projectId: project.id, refresh: () => events.push(["refresh"]), ...(states.context as object) }) };
    if (id === "react") return { ...React, useState: (initial: unknown) => { const key = stateNames[index++]; return [Object.hasOwn(states, key) ? states[key] : initial, (value: unknown) => events.push([key, value])]; } };
    if (id === "react/jsx-runtime") return { ...jsx, jsx: capture(jsx.jsx), jsxs: capture(jsx.jsxs) };
    if (id === "sonner") return { toast: { error: (v: string) => events.push(["error", v]), success: (v: string) => events.push(["success", v]) } };
    if (id.endsWith("/use-document-title")) return { useDocumentTitle: (v: string) => events.push(["title", v]) };
    if (id.endsWith("/ui/sheet")) return Object.fromEntries(["Sheet", "SheetContent", "SheetHeader", "SheetTitle", "SheetDescription"].map(name => [name, ({ children }: { children: ReactNode }) => createElement("div", { "data-sheet": name }, children)]));
    return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  };
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function("require", "module", "exports", code)(load, compiled, compiled.exports);
  return { html: renderWithPresentation(createElement(compiled.exports.default), locale), captured, events };
}
const has = (h: ReturnType<typeof render>, key: string, value?: unknown) => h.events.some(e => JSON.stringify(e) === JSON.stringify(value === undefined ? [key] : [key, value]));
const form = { addOpen: true, title: "  Caller title  ", desc: caller, priority: "urgent", taskStatus: "in_review", assigneeId: "member-a", teamId: "team-a", dueDate: "2026-10-21", startDate: "2026-10-20", estimatedMinutes: "120", selectedLabels: ["label-a"], newCheckItem: "  Checklist caller  ", newComment: "  Comment caller  ", viewTask: task, editStatus: "todo", editPriority: "urgent" };
const detail = (h: ReturnType<typeof render>) => h.captured.find(c => c.kind === "TaskDetailDrawer")!.props;

test("task list, board, creation and detail render paired catalogs and escaped caller data", () => {
  for (const locale of locales) {
    const t = tFor(locale), h = render(locale, form);
    assert.ok(has(h, "title", t("documentTitle")));
    for (const key of ["newTask", "newTaskDescription", "details", "classification", "assignment", "schedule", "titleRequired", "description", "priority", "status", "assignee", "team", "startDate", "dueDate", "estimatedTime", "labels", "cancel", "createTask", "checklist", "postComment", "close", "markDone"]) assert.ok(h.html.includes(esc(t(key as "newTask"))), key);
    assert.ok(h.html.includes(esc(t("comments", { count: 1 }))) && h.html.includes(esc(t("createdBy", { name: caller }))));
    assert.ok(h.html.includes(esc(caller)) && !h.html.includes("<script>"));
    const pref = resolvePresentation({ user: { language: locale } });
    assert.ok(h.html.includes(esc(formatDateOnly(task.dueDate, pref))));
    assert.ok(h.html.includes(esc(formatInstant(new Date(task.createdAt), pref))));
    const opts = h.captured.filter(c => c.kind === "SelectItem").map(c => c.props.value);
    for (const value of ["low", "medium", "high", "urgent", "todo", "in_progress", "in_review", "backlog", "none", "member-a", "team-a"]) assert.ok(opts.includes(value), value);
    const board = render(locale, { viewMode: "board" });
    assert.ok(board.html.includes('draggable="true"') && board.html.includes(esc(caller)));
    const empty = render(locale, { context: { project: { ...project, tasks: [] } } });
    assert.ok(empty.html.includes(esc(t("noTasks"))));
    const unset = render(locale, { ...form, viewTask: { ...task, dueDate: null, estimatedMinutes: null, createdBy: null } });
    assert.ok(unset.html.includes(esc(t("notSet"))) && unset.html.includes(esc(t("taskDetails"))));
    assert.equal(render(locale, { context: { project: null } }).html, "");
  }
});

test("creation preserves canonical dates, integer minutes, IDs and scoped JSON; failures retain input", async () => {
  const original = globalThis.fetch;
  try {
    for (const locale of locales) for (const mode of ["ok", "http", "json", "envelope", "network", "org", "blank"]) {
      const t = tFor(locale), h = render(locale, { ...form, ...(mode === "org" ? { context: { orgId: null } } : {}), ...(mode === "blank" ? { title: " " } : {}) });
      let requests = 0;
      globalThis.fetch = async (url, init) => {
        requests++; assert.equal(url, "/api/v1/projects/project-a/tasks"); assert.equal(init?.method, "POST");
        assert.deepEqual(init?.headers, { "Content-Type": "application/json", "x-organization-id": "org-a" });
        assert.deepEqual(JSON.parse(init!.body as string), { title: "Caller title", description: caller, priority: "urgent", status: "in_review", assigneeId: "member-a", teamId: "team-a", startDate: "2026-10-20", dueDate: "2026-10-21", estimatedMinutes: 120, labels: ["label-a"] });
        if (mode === "http") return Response.json({ error: "Private server detail" }, { status: 403 });
        if (mode === "json") return new Response("Private JSON");
        if (mode === "envelope") return Response.json({ task: {} });
        if (mode === "network") throw new Error("Private network");
        return Response.json({ task: { id: "task-a" } });
      };
      await (h.captured.find(c => c.kind === "Button" && c.props.children === t("createTask"))!.props.onClick as () => Promise<void>)();
      if (["org", "blank"].includes(mode)) assert.equal(requests, 0);
      else if (mode === "ok") assert.ok(has(h, "success", t("created")) && has(h, "addOpen", false) && has(h, "title", "") && has(h, "refresh"));
      else assert.ok(has(h, "error", t("createFailed")) && !has(h, "title", "") && !has(h, "addOpen", false) && !has(h, "refresh"));
      assert.ok(!JSON.stringify(h.events).includes("Private"));
    }
  } finally { globalThis.fetch = original; }
});

test("task/checklist/comment callbacks preserve REST contracts and reject failed acknowledgements", async () => {
  const original = globalThis.fetch;
  const operations = [
    { callback: "onUpdate", args: [task.id, { priority: "low" }], suffix: "", method: "PATCH", body: { priority: "low" }, response: { task: { id: task.id } }, failure: "updateFailed" },
    { callback: "onToggleStatus", args: [task.id, "done"], suffix: "", method: "PATCH", body: { status: "todo" }, response: { task: { id: task.id } }, failure: "updateFailed" },
    { callback: "onDelete", args: [task.id], suffix: "", method: "DELETE", response: { success: true }, failure: "deleteFailed" },
    { callback: "onAddCheckItem", args: [task.id], suffix: "/checklist", method: "POST", body: { title: "Checklist caller" }, response: { item: { id: "item-a" } }, failure: "addItemFailed", clear: "newCheckItem" },
    { callback: "onToggleCheckItem", args: [task.id, "item-a", true], suffix: "/checklist", method: "PATCH", body: { items: [{ id: "item-a", isCompleted: true }] }, response: { success: true }, failure: "updateItemFailed" },
    { callback: "onDeleteCheckItem", args: [task.id, "item-a"], suffix: "/checklist?itemId=item-a", method: "DELETE", response: { success: true }, failure: "deleteItemFailed" },
    { callback: "onAddComment", args: [task.id], suffix: "/comments", method: "POST", body: { content: "Comment caller" }, response: { comment: { id: "comment-a" } }, failure: "commentFailed", clear: "newComment" },
    { callback: "onDeleteComment", args: [task.id, "comment-a"], suffix: "/comments?commentId=comment-a", method: "DELETE", response: { success: true }, failure: "deleteCommentFailed" },
  ];
  try {
    for (const locale of locales) for (const operation of operations) for (const mode of ["ok", "http", "json", "envelope", "network", "org"]) {
      const t = tFor(locale), h = render(locale, { ...form, ...(mode === "org" ? { context: { orgId: null } } : {}) });
      let requests = 0;
      globalThis.fetch = async (url, init) => {
        requests++; assert.equal(url, `/api/v1/projects/project-a/tasks/task-a${operation.suffix}`); assert.equal(init?.method, operation.method);
        assert.deepEqual(init?.headers, { ...(operation.body ? { "Content-Type": "application/json" } : {}), "x-organization-id": "org-a" });
        assert.deepEqual(init?.body ? JSON.parse(init.body as string) : undefined, operation.body);
        if (mode === "http") return Response.json({ error: "Private server detail" }, { status: 403 });
        if (mode === "json") return new Response("Private JSON");
        if (mode === "envelope") return Response.json({});
        if (mode === "network") throw new Error("Private network");
        return Response.json(operation.response);
      };
      await (detail(h)[operation.callback] as (...args: unknown[]) => Promise<void>)(...operation.args);
      if (mode === "org") assert.equal(requests, 0);
      else if (mode === "ok") { assert.ok(has(h, "refresh")); if (operation.clear) assert.ok(has(h, operation.clear, "")); }
      else { assert.ok(has(h, "error", t(operation.failure as "updateFailed")), operation.callback + ":" + mode); assert.ok(!has(h, "refresh")); if (operation.clear) assert.ok(!has(h, operation.clear, "")); }
      assert.ok(!JSON.stringify(h.events).includes("Private"));
    }
  } finally { globalThis.fetch = original; }
});

test("filters, board drag/drop and selector edits retain machine values", async () => {
  const original = globalThis.fetch;
  try {
    for (const locale of locales) {
      const h = render(locale, { viewMode: "board" });
      const values: unknown[][] = [];
      const dragged = h.captured.find(c => typeof c.props.onDragStart === "function")!;
      (dragged.props.onDragStart as (e: unknown) => void)({ dataTransfer: { setData: (...args: unknown[]) => values.push(args) } });
      assert.deepEqual(values, [["taskId", task.id]]);
      const requests: unknown[] = [];
      globalThis.fetch = async (url, init) => { requests.push([url, JSON.parse(init!.body as string)]); return Response.json({ task: { id: task.id } }); };
      const drop = h.captured.filter(c => typeof c.props.onDrop === "function")[3];
      (drop.props.onDrop as (e: unknown) => void)({ dataTransfer: { getData: (key: string) => { assert.equal(key, "taskId"); return task.id; } } });
      assert.deepEqual(requests, [["/api/v1/projects/project-a/tasks/task-a", { status: "in_review" }]]);
      const filtered = render(locale, { statusFilter: "done" });
      assert.ok(filtered.html.includes(esc(tFor(locale)("noTasks"))));
      const drawer = render(locale, form);
      const selects = drawer.captured.filter(c => c.kind === "Select" && typeof c.props.onValueChange === "function");
      (selects[selects.length - 2].props.onValueChange as (v: string) => void)("none");
      assert.deepEqual(requests.at(-1), ["/api/v1/projects/project-a/tasks/task-a", { assigneeId: null }]);
    }
  } finally { globalThis.fetch = original; }
});

test("task readers reject bad envelopes, foreign update identity and private errors", async () => {
  for (const kind of ["task", "item", "comment", "success"] as const) {
    await assert.rejects(projectTaskMutationJson(Response.json({ error: "Private" }, { status: 500 }), kind));
    await assert.rejects(projectTaskMutationJson(new Response("Private JSON"), kind));
    for (const body of [null, [], {}, { [kind]: null }, { [kind]: false }, { [kind]: {} }]) await assert.rejects(projectTaskMutationJson(Response.json(body), kind));
    await projectTaskMutationJson(Response.json({ [kind]: kind === "success" ? true : { id: "saved-id" } }), kind);
  }
  await assert.rejects(projectTaskMutationJson(Response.json({ task: { id: "foreign" } }), "task", task.id));
});

test("all authored task JSX copy is extracted and Persian catalog keys are paired", () => {
  const ast = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function visit(node: ts.Node) {
    if (ts.isJsxText(node)) assert.doesNotMatch(node.text, /[A-Za-z]/, node.text.trim());
    if (ts.isJsxAttribute(node) && ["placeholder", "title", "aria-label"].includes(node.name.getText(ast)) && node.initializer && ts.isStringLiteral(node.initializer)) assert.fail(node.getText(ast));
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.doesNotMatch(ast.text, /error\.message|data\.error|toLocaleDateString|toast\.(?:error|success)\("/);
  assert.deepEqual(Object.keys(en.ProjectTasks).sort(), Object.keys(fa.ProjectTasks).sort());
  for (const value of Object.values(fa.ProjectTasks)) assert.match(value, /[\u0600-\u06ff]/);
});
