import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { projectTeamAssignmentsJson, projectOrgTeamsJson, projectOrgMembersJson, projectCollaborationMutationJson } from "../i18n/project-collaboration-presentation";
import { projectMoneyDisplay } from "../lib/money/project-display";
import { formatInstant } from "../i18n/dates";
import { resolvePresentation } from "../i18n/locale";
import { locales, caller, esc, member, note, assignment, project, translate, renderCollaboration as render, has, button, flush } from "./helpers/project-collaboration";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const memberForm = { addOpen: true, addTeamOpen: true, selectedMemberId: "member-b", selectedRole: "viewer", hourlyRate: "90071992547409.91", selectedTeamId: "team-b", selectedTeamRole: "manager", teamAssignments: [assignment], orgTeams: [assignment.team, { id: "team-b", name: "Available team", color: "#3b82f6" }], orgMembers: [{ id: "member-a", userName: caller, userEmail: "a@example.test" }, { id: "member-b", userName: "Available member", userEmail: "b@example.test" }] };
const noteForm = { content: "  Caller note  ", editingId: note.id, editContent: "  Edited note  " };

test("members, teams, role descriptions, count forms and exact hourly rates render in both locales", () => {
  for (const locale of locales) {
    const t = translate(locale, "ProjectMembers"), h = render("members", locale, memberForm);
    for (const key of ["teams", "assignTeam", "addMember", "addMemberTitle", "managerHint", "contributorHint", "viewerHint", "hourlyRate", "compensation", "manager", "contributor", "viewer"] as const) assert.ok(h.html.includes(esc(t(key))), key);
    assert.ok(h.html.includes(esc(t("ratePerHour", { amount: projectMoneyDisplay(Number.MAX_SAFE_INTEGER, "KWD", resolvePresentation({ user: { language: locale } })) }))));
    assert.ok(h.html.includes(esc(caller)) && !h.html.includes("<script>"));
    assert.ok(h.html.includes(esc(t("memberCount", { count: 1 }))));
    const opts = h.captured.filter(c => c.kind === "SelectItem").map(c => c.props.value);
    for (const value of ["none", "manager", "contributor", "viewer", "team-b", "member-b"]) assert.ok(opts.includes(value), value);
    assert.ok(!opts.includes("team-a") && !opts.includes("member-a"));
    const unknown = render("members", locale, { context: { project: { ...project, members: [{ ...member, role: "private-new-role", member: { ...member.member, user: { ...member.member.user, name: null } } }] } } });
    assert.ok(unknown.html.includes(esc(t("unknownRole"))) && unknown.html.includes(esc(t("unnamed"))) && !unknown.html.includes("private-new-role"));
    const empty = render("members", locale, { context: { project: { ...project, members: [] } } });
    assert.ok(empty.html.includes(esc(t("noTeams"))) && empty.html.includes(esc(t("noMembers"))));
    const errors = render("members", locale, { ...memberForm, readError: "assignmentsLoadFailed", teamChoicesError: "teamsLoadFailed", memberChoicesError: "membersLoadFailed" });
    for (const key of ["assignmentsLoadFailed", "teamsLoadFailed", "membersLoadFailed"] as const) assert.ok(errors.html.includes(esc(t(key))));
    for (const count of [0, 1, 2]) assert.ok(t("managerCount", { count }).length);
    assert.equal(render("members", locale, { context: { project: null } }).html, "");
  }
});

test("membership and team mutations preserve scoped JSON and exact cents; every failure keeps forms and avoids success", async () => {
  const original = globalThis.fetch;
  try {
    for (const locale of locales) for (const op of ["add", "assign", "remove", "unassign"] as const) for (const mode of ["ok", "http", "json", "envelope", "identity", "money", "network"] as const) {
      const t = translate(locale, "ProjectMembers"), h = render("members", locale, memberForm);
      const requests: { url: string; method?: string; body?: unknown }[] = [];
      globalThis.fetch = async (url, init) => {
        requests.push({ url: String(url), method: init?.method, body: init?.body ? JSON.parse(init.body as string) : undefined });
        assert.equal((init?.headers as Record<string, string>)["x-organization-id"], "org-a");
        if (!init?.method) return Response.json({ assignments: [assignment] });
        if (mode === "http") return Response.json({ error: "PRIVATE server" }, { status: 403 });
        if (mode === "json") return new Response("PRIVATE JSON");
        if (mode === "network") throw new Error("PRIVATE network");
        if (mode === "envelope") return Response.json({});
        if (mode === "money") return Response.json({ projectMember: { id: "new", memberId: "member-b", hourlyRate: 29, hourlyRateMinor: "30" } });
        if (op === "add") return Response.json({ projectMember: { ...member, memberId: mode === "identity" ? "wrong" : "member-b" } });
        if (op === "assign") return Response.json({ assignment: { id: "new", teamId: mode === "identity" ? "wrong" : "team-b" } });
        return Response.json({ success: mode !== "identity" });
      };
      await button(h, t(({ add: "addMember", assign: "assignTeam", remove: "removeMember", unassign: "removeTeam" } as const)[op]), ({ add: "handleAdd", assign: "handleAddTeam", remove: "", unassign: "" })[op] || undefined)();
      await flush();
      const req = requests[0], root = "/api/v1/projects/project-a";
      if (op === "add") assert.deepEqual(req, { url: root + "/members", method: "POST", body: { memberId: "member-b", role: "viewer", hourlyRateMinor: String(Number.MAX_SAFE_INTEGER) } });
      if (op === "assign") assert.deepEqual(req, { url: root + "/team-assignments", method: "POST", body: { teamId: "team-b", defaultRole: "manager" } });
      if (op === "remove") assert.deepEqual(req, { url: root + "/members?memberId=member-a", method: "DELETE", body: undefined });
      if (op === "unassign") assert.deepEqual(req, { url: root + "/team-assignments?teamId=team-a", method: "DELETE", body: undefined });
      const busy = ({ add: "saving", assign: "savingTeam", remove: "removingId", unassign: "removingTeamId" })[op];
      assert.ok(has(h, busy, op === "add" || op === "assign" ? false : null));
      if (mode === "ok") {
        assert.ok(h.events.some(v => v[0] === "success"));
        if (op === "add" || op === "remove") assert.ok(has(h, "refresh"));
        else assert.ok(has(h, "teamAssignments", [assignment]));
      } else {
        assert.ok(has(h, "error", t(({ add: "addFailed", assign: "assignFailed", remove: "removeMemberFailed", unassign: "removeTeamFailed" } as const)[op])));
        assert.ok(!has(h, "refresh") && !h.events.some(v => v[0] === "success"));
        for (const key of ["addOpen", "addTeamOpen", "selectedMemberId", "selectedTeamId", "hourlyRate"]) assert.ok(!h.events.some(v => v[0] === key));
      }
      assert.ok(!JSON.stringify(h.events).includes("PRIVATE"));
    }
  } finally { globalThis.fetch = original; }
});

test("assignment and choice effects validate atomically and ignore cleaned-up responses", async () => {
  const original = globalThis.fetch;
  try {
    for (const locale of locales) for (const effectIndex of [0, 1, 2]) for (const mode of ["ok", "http", "json", "envelope", "network", "cleanup"] as const) {
      const h = render("members", locale, memberForm);
      let complete!: (r: Response) => void;
      globalThis.fetch = async (url, init) => {
        assert.equal((init?.headers as Record<string, string>)["x-organization-id"], "org-a");
        assert.equal(url, ["/api/v1/projects/project-a/team-assignments", "/api/v1/teams?limit=100", "/api/v1/members"][effectIndex]);
        if (mode === "cleanup") return new Promise<Response>(r => { complete = r; });
        if (mode === "network") throw new Error("PRIVATE network");
        if (mode === "json") return new Response("PRIVATE JSON");
        if (mode === "http") return Response.json({ error: "PRIVATE server" }, { status: 403 });
        if (mode === "envelope") return Response.json({ assignments: [{}], data: [{}], members: [{}] });
        return Response.json([{ assignments: [assignment] }, { data: [assignment.team] }, { members: memberForm.orgMembers }][effectIndex]);
      };
      const cleanup = h.effects[effectIndex](); await flush();
      const [state, error] = [["teamAssignments", "readError"], ["orgTeams", "teamChoicesError"], ["orgMembers", "memberChoicesError"]][effectIndex];
      if (mode === "cleanup") {
        assert.equal(typeof cleanup, "function"); if (typeof cleanup === "function") cleanup();
        const before = h.events.length; complete(Response.json([{ assignments: [assignment] }, { data: [assignment.team] }, { members: memberForm.orgMembers }][effectIndex])); await flush();
        assert.equal(h.events.length, before);
      } else if (mode === "ok") assert.ok(h.events.some(v => v[0] === state && Array.isArray(v[1]) && v[1].length > 0));
      else { assert.ok(h.events.some(v => v[0] === error && !!v[1])); assert.ok(!h.events.some(v => v[0] === state && Array.isArray(v[1]) && v[1].length > 0)); }
      assert.ok(!JSON.stringify(h.events).includes("PRIVATE"));
    }
  } finally { globalThis.fetch = original; }
});

test("a committed team assignment keeps success when its follow-up read fails", async () => {
  const original = globalThis.fetch;
  try {
    for (const locale of locales) {
      const t = translate(locale, "ProjectMembers"), h = render("members", locale, memberForm);
      globalThis.fetch = async (_url, init) => init?.method === "POST"
        ? Response.json({ assignment: { id: "new", teamId: "team-b" } })
        : Response.json({ error: "PRIVATE reload" }, { status: 500 });
      await button(h, t("assignTeam"), "handleAddTeam")(); await flush();
      assert.ok(has(h, "success", t("teamAssigned")) && has(h, "addTeamOpen", false));
      assert.ok(has(h, "readError", "assignmentsLoadFailed"));
      assert.ok(!h.events.some(v => v[0] === "error") && !JSON.stringify(h.events).includes("PRIVATE"));
    }
  } finally { globalThis.fetch = original; }
});

test("notes filters, sorting, escaped highlighting, editing and timestamp preferences render in both locales", () => {
  for (const locale of locales) {
    const t = translate(locale, "ProjectNotes"), h = render("notes", locale, noteForm);
    assert.ok(has(h, "title", t("documentTitle")));
    for (const key of ["notes", "submitShortcut", "editShortcut", "save", "cancel", "addNote"] as const) assert.ok(h.html.includes(esc(t(key))), key);
    assert.ok(h.html.includes(esc(caller)) && !h.html.includes("<script>"));
    const pref = resolvePresentation({ user: { language: locale } });
    for (const options of [{ year: "numeric", month: "short", day: "numeric" }, { hour: "numeric", minute: "2-digit" }] as const) assert.ok(h.html.includes(esc(formatInstant(new Date(note.createdAt), pref, options))));
    const opts = h.captured.filter(c => c.kind === "SelectItem").map(c => c.props.value);
    for (const value of ["all", "newest", "oldest", "pinned", "unpinned", "a@example.test", "b@example.test"]) assert.ok(opts.includes(value));
    const filtered = render("notes", locale, { searchQuery: "caller", filterAuthor: "a@example.test", filterPinned: "pinned", sortBy: "oldest" });
    assert.ok(filtered.html.includes("<mark") && !filtered.html.includes("Second note"));
    assert.ok(filtered.html.includes(esc(t("filteredCount", { count: 1, total: 2 }))));
    const none = render("notes", locale, { filterPinned: "unpinned", filterAuthor: "a@example.test" });
    assert.ok(none.html.includes(esc(t("noMatches"))));
    const empty = render("notes", locale, { context: { project: { ...project, notes: [] } } });
    assert.ok(empty.html.includes(esc(t("noNotes"))));
    assert.equal(render("notes", locale, { context: { project: null } }).html, "");
    const order = render("notes", locale, { sortBy: "oldest" });
    assert.ok(order.html.indexOf(esc(caller)) < order.html.indexOf("Second note"), "pinned stays first");
    const clear = button(none, t("clearFilters")); void clear();
    for (const [key, value] of [["searchQuery", ""], ["filterAuthor", "all"], ["filterPinned", "all"]]) assert.ok(has(none, key, value));
  }
});

test("note create/edit/pin/delete retain canonical fields, checked identities and finite feedback", async () => {
  const original = globalThis.fetch;
  try {
    for (const locale of locales) for (const op of ["create", "edit", "pin", "delete"] as const) for (const mode of ["ok", "http", "json", "envelope", "identity", "network"] as const) {
      const t = translate(locale, "ProjectNotes"), h = render("notes", locale, noteForm);
      let request: { url: string; method?: string; body?: unknown } | undefined;
      globalThis.fetch = async (url, init) => {
        request = { url: String(url), method: init?.method, body: init?.body ? JSON.parse(init.body as string) : undefined };
        assert.equal((init?.headers as Record<string, string>)["x-organization-id"], "org-a");
        if (mode === "http") return Response.json({ error: "PRIVATE server" }, { status: 403 });
        if (mode === "json") return new Response("PRIVATE JSON");
        if (mode === "network") throw new Error("PRIVATE network");
        if (mode === "envelope") return Response.json({});
        if (op === "delete") return Response.json({ success: mode !== "identity" });
        return Response.json({ note: { ...note, id: mode === "identity" ? (op === "create" ? "" : "wrong") : note.id } });
      };
      await button(h, t(({ create: "addNote", edit: "save", pin: "unpin", delete: "delete" } as const)[op]))();
      const root = "/api/v1/projects/project-a/notes";
      assert.deepEqual(request, op === "create" ? { url: root, method: "POST", body: { content: "Caller note" } } : { url: root + "?noteId=note-a", method: op === "delete" ? "DELETE" : "PATCH", body: op === "delete" ? undefined : op === "pin" ? { isPinned: false } : { content: "Edited note" } });
      assert.ok(has(h, ({ create: "saving", edit: "editSaving", pin: "togglingPinId", delete: "deletingId" })[op], op === "create" || op === "edit" ? false : null));
      if (mode === "ok") { assert.ok(has(h, "refresh") && h.events.some(v => v[0] === "success")); }
      else {
        assert.ok(has(h, "error", t(({ create: "addFailed", edit: "updateFailed", pin: "updateFailed", delete: "deleteFailed" } as const)[op])));
        assert.ok(!has(h, "refresh") && !h.events.some(v => v[0] === "success"));
        for (const key of ["content", "editingId", "editContent"]) assert.ok(!h.events.some(v => v[0] === key));
      }
      assert.ok(!JSON.stringify(h.events).includes("PRIVATE"));
    }
  } finally { globalThis.fetch = original; }
});

test("invalid lists/envelopes/identities/money fail before adoption", async () => {
  for (const value of [null, [], {}, { assignments: [{}] }, { assignments: [assignment, assignment] }, { assignments: [{ ...assignment, teamId: "wrong" }] }, { assignments: [{ ...assignment, team: { ...assignment.team, members: [{}] } }] }]) await assert.rejects(projectTeamAssignmentsJson(Response.json(value)));
  await assert.deepEqual((await projectTeamAssignmentsJson(Response.json({ assignments: [assignment] }))).assignments, [assignment]);
  for (const value of [{}, { data: [{}] }, { data: [assignment.team, assignment.team] }]) await assert.rejects(projectOrgTeamsJson(Response.json(value)));
  assert.deepEqual(await projectOrgMembersJson(Response.json({ data: memberForm.orgMembers })), memberForm.orgMembers);
  for (const value of [{}, { members: [{}] }, { members: [memberForm.orgMembers[0], memberForm.orgMembers[0]] }]) await assert.rejects(projectOrgMembersJson(Response.json(value)));
  for (const kind of ["note", "assignment", "projectMember", "success"] as const) {
    for (const value of [null, [], {}, { [kind]: false }, { [kind]: {} }]) await assert.rejects(projectCollaborationMutationJson(Response.json(value), kind));
    await assert.rejects(projectCollaborationMutationJson(Response.json({ [kind]: { id: "a" } }, { status: 403 }), kind));
  }
  await assert.rejects(projectCollaborationMutationJson(Response.json({ projectMember: { ...member, hourlyRateMinor: "29" } }), "projectMember"));
});

test("authored copy and Persian script guards cover the production scope", () => {
  for (const slice of ["members", "notes"]) {
    const path = `app/(dashboard)/projects/[id]/${slice}/page.tsx`, source = readFileSync(path, "utf8"), ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const found: string[] = [];
    function visit(node: ts.Node) {
      if (ts.isJsxText(node) && /[A-Za-z]/.test(node.text)) found.push(node.text.trim());
      if (ts.isJsxAttribute(node) && ["placeholder", "title", "aria-label"].includes(node.name.getText(ast)) && node.initializer && ts.isStringLiteral(node.initializer)) found.push(node.initializer.text);
      ts.forEachChild(node, visit);
    }
    visit(ast); assert.deepEqual(found, [], slice);
    assert.ok(!source.includes("toLocaleDateString") && !source.includes("toLocaleTimeString") && !source.includes("err.message"));
  }
  for (const namespace of ["ProjectMembers", "ProjectNotes"] as const) {
    assert.deepEqual(Object.keys(en[namespace]).sort(), Object.keys(fa[namespace]).sort());
    for (const value of Object.values(fa[namespace])) assert.ok(/[\u0600-\u06ff]/.test(value) && !/[\ufffd]/.test(value));
  }
});
