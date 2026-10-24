import { resolvePresentation } from "../i18n/locale";
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { projectTimerJson, projectTimeEntryJson, projectTimeDeleteJson } from "../i18n/project-time-presentation";
import { projectMoneyDisplay, projectTimeCents } from "../lib/money/project-display";
import { locales, caller, esc, entry, timer, project, translate, renderSlice, has, button } from "./helpers/project-slice";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const form = { drawerMode: "add", entryDate: "2026-10-21", entryDesc: caller, entryMinutes: "95", entryBillable: "true", entryTaskId: "task-a" };
test("time JSX renders translated timer, entries, drawer, charts and exact earned money", () => {
  for (const locale of locales) {
    const t = translate(locale, "ProjectTime"), h = renderSlice("time", locale, form);
    for (const key of ["timer", "startTimer", "thisWeek", "totalTime", "earned", "unbilled", "allEntries", "logTime", "addTitle", "addDescription", "date", "duration", "addEntry"]) assert.ok(h.html.includes(esc(t(key as "timer"))), key);
    assert.ok(has(h, "title", t("documentTitle")));
    assert.ok(h.html.includes(esc(caller)) && !h.html.includes("<script>"));
    assert.ok(h.html.includes(esc(projectMoneyDisplay(projectTimeCents(entry.minutes, entry.hourlyRate), project.currency, resolvePresentation({ user: { language: locale } })))));
    const opts = h.captured.filter(c => c.kind === "SelectItem").map(c => c.props.value);
    for (const value of ["all", "billable", "non-billable", "invoiced", "none", "true", "false", "task-a"]) assert.ok(opts.includes(value), value);
    const tip = h.captured.find(c => c.kind === "Tooltip")!.props.formatter as (v: number, name: string) => unknown;
    assert.deepEqual(tip(2, "billable"), [t("chartHours", { hours: 2 }), t("billable")]);
    assert.ok(renderSlice("time", locale, { context: { project: { ...project, timeEntries: [] } } }).html.includes(esc(t("empty"))));
    assert.ok(renderSlice("time", locale, { filterBillable: "invoiced" }).html.includes(esc(t("filteredEmpty"))));
    assert.equal(renderSlice("time", locale, { context: { project: null } }).html, "");
  }
});

test("entry add/edit/delete callbacks preserve physical minutes and canonical dates; failed replies retain forms", async () => {
  const original = globalThis.fetch;
  try {
    for (const locale of locales) for (const op of ["add", "edit", "delete"]) for (const mode of ["ok", "http", "json", "envelope", "network"]) {
      const t = translate(locale, "ProjectTime"), h = renderSlice("time", locale, { ...form, ...(op === "add" ? {} : { drawerMode: "edit", editingEntry: entry }) });
      globalThis.fetch = async (url, init) => {
        assert.equal(url, `/api/v1/projects/project-a/time-entries${op === "add" ? "" : "/entry-a"}`);
        assert.equal(init?.method, op === "add" ? "POST" : op === "edit" ? "PATCH" : "DELETE");
        assert.equal((init?.headers as Record<string, string>)["x-organization-id"], "org-a");
        if (op !== "delete") assert.deepEqual(JSON.parse(init!.body as string), { date: "2026-10-21", description: caller, minutes: 95, isBillable: true, taskId: "task-a" });
        if (mode === "http") return Response.json({ error: "Private server" }, { status: 403 });
        if (mode === "json") return new Response("Private JSON");
        if (mode === "network") throw new Error("Private network");
        return Response.json(mode === "envelope" ? {} : op === "delete" ? { success: true } : { timeEntry: entry });
      };
      await button(h, t(op === "add" ? "addEntry" : op === "edit" ? "updateEntry" : "delete"))();
      if (mode === "ok") assert.ok(has(h, "refresh") && has(h, "drawerMode", null));
      else assert.ok(has(h, "error", t(op === "add" ? "addFailed" : op === "edit" ? "updateFailed" : "deleteFailed")) && !has(h, "refresh") && !has(h, "drawerMode", null));
      assert.ok(!JSON.stringify(h.events).includes("Private"));
    }
    const h = renderSlice("time", "fa-IR", { ...form, entryMinutes: "95x" });
    globalThis.fetch = async () => { assert.fail("Invalid quantity must not submit"); };
    await button(h, translate("fa-IR", "ProjectTime")("addEntry"))();
    assert.ok(has(h, "error", translate("fa-IR", "ProjectTime")("invalidDuration")));
  } finally { globalThis.fetch = original; }
});

test("timer start/pause/resume/reset/save require checked acknowledgements and keep failed timer state", async () => {
  const original = globalThis.fetch;
  try {
    for (const locale of locales) for (const op of ["start", "pause", "resume", "reset", "save"]) for (const mode of ["ok", "http", "json", "envelope", "network"]) {
      const t = translate(locale, "ProjectTime"), h = renderSlice("time", locale, { timerData: op === "start" ? null : { ...timer, pausedAt: op === "resume" ? "2026-10-21T10:01:00Z" : null }, timerSeconds: 95, timerDesc: caller, timerTaskId: "task-a" });
      const requests: string[] = [];
      globalThis.fetch = async (url, init) => {
        requests.push(String(url));
        assert.equal((init?.headers as Record<string, string>)["x-organization-id"], "org-a");
        if (mode === "http") return Response.json({ error: "Private server" }, { status: 403 });
        if (mode === "json") return new Response("Private JSON");
        if (mode === "network") throw new Error("Private network");
        if (mode === "envelope") return Response.json({});
        if (String(url).endsWith("time-entries")) {
          const body = JSON.parse(init!.body as string);
          assert.equal(body.minutes, 2); assert.match(body.date, /^\d{4}-\d{2}-\d{2}$/); assert.equal(body.taskId, "task-a");
          return Response.json({ timeEntry: { ...entry, minutes: 2 } });
        }
        return Response.json(init?.method === "DELETE" ? { success: true } : { timer });
      };
      await button(h, t(op === "start" ? "startTimer" : op === "reset" ? "resetTimer" : op as "pause" | "resume" | "save"))();
      if (mode === "ok") {
        assert.ok(has(h, "timerData", ["reset", "save"].includes(op) ? null : timer));
        if (op === "save") { assert.equal(requests.length, 2); assert.ok(has(h, "refresh")); }
      } else {
        const failure = { start: "startFailed", pause: "pauseFailed", resume: "resumeFailed", reset: "resetFailed", save: "saveFailed" } as const;
        assert.ok(has(h, "error", t(failure[op as keyof typeof failure])) && !has(h, "timerData", null) && !has(h, "refresh"));
      }
      assert.ok(!JSON.stringify(h.events).includes("Private"));
    }
    for (const ok of [false, true]) {
      const h = renderSlice("time", "en-US", { timerData: timer, timerDesc: caller });
      globalThis.fetch = async () => ok ? Response.json({ timer }) : Response.json({ error: "Private" }, { status: 500 });
      await h.callbacks[0]();
      assert.equal(h.refs.lastSavedDescRef.current, ok ? caller : "");
    }
  } finally { globalThis.fetch = original; }
});

test("time readers reject malformed envelopes, foreign identity, date and exact aliases", async () => {
  await projectTimerJson(Response.json({ timer }), "project-a");
  await projectTimeEntryJson(Response.json({ timeEntry: entry }), "project-a", entry.id);
  for (const patch of [{ projectId: "foreign" }, { accumulatedSeconds: 0.5 }, { startedAt: "bad" }, { isBillable: 1 }]) await assert.rejects(projectTimerJson(Response.json({ timer: { ...timer, ...patch } }), "project-a"));
  for (const patch of [{ projectId: "foreign" }, { id: "foreign" }, { minutes: 0.1 }, { date: "2026-02-30" }, { hourlyRateMinor: "30" }]) await assert.rejects(projectTimeEntryJson(Response.json({ timeEntry: { ...entry, ...patch } }), "project-a", entry.id));
  for (const read of [(r: Response) => projectTimerJson(r, "project-a"), (r: Response) => projectTimeEntryJson(r, "project-a"), projectTimeDeleteJson]) for (const response of [Response.json({}), Response.json(null), new Response("Private JSON"), Response.json({ error: "Private" }, { status: 500 })]) await assert.rejects(read(response));
});

test("time authored copy is extracted with paired Persian messages", () => {
  const path = "app/(dashboard)/projects/[id]/time/page.tsx", source = readFileSync(path, "utf8");
  const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function visit(n: ts.Node) {
    if (ts.isJsxText(n)) assert.doesNotMatch(n.text, /[A-Za-z]/);
    if (ts.isJsxAttribute(n) && ["title", "placeholder", "aria-label", "label", "header", "emptyMessage"].includes(n.name.getText(ast)) && n.initializer && ts.isStringLiteral(n.initializer)) assert.fail(n.getText(ast));
    ts.forEachChild(n, visit);
  }
  visit(ast); assert.doesNotMatch(source, /error\.message|data\.error|toast\.(?:success|error)\("/);
  assert.deepEqual(Object.keys(en.ProjectTime).sort(), Object.keys(fa.ProjectTime).sort());
  for (const value of Object.values(fa.ProjectTime)) assert.match(value, /[\u0600-\u06ff]/);
});
