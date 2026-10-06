import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, customRole, contact, team, teamMember, payrollEmployee,
  project, projectMember, projectTask, runningTimer, milestoneAssignment } from "../../lib/db/schema";
import type { AuthContext } from "../../lib/api/auth-context";
import { projectOperations } from "../../lib/api/project-master-operations";
import { registerAllTools } from "../../lib/mcp/tools";

async function connect(ctx: AuthContext) {
  const server = new McpServer({ name: "Project fixture", version: "1" }); registerAllTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1" }), [ct, st] = InMemoryTransport.createLinkedPair();
  await server.connect(st); await client.connect(ct);
  const tools = (await client.listTools()).tools;
  assert.equal(new Set(tools.map(t => t.name)).size, tools.length);
  for (const op of projectOperations) {
    const tool = tools.find(t => t.name === op.name)!; assert.ok(tool); assert.equal(tool.inputSchema.additionalProperties, false);
    for (const [key, value] of Object.entries(tool.inputSchema.properties ?? {})) assert.ok((value as { description?: string }).description, `${op.name}.${key}`);
  }
  return { async call(name: string, args: Record<string, unknown>) {
    const result = await client.callTool({ name, arguments: args }), text = (result.content as { text: string }[])[0].text;
    return { isError: result.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
  }, async close() { await client.close(); await server.close(); } };
}
async function run() {
  const [a, b] = await db.insert(organization).values([{ name: "Projects A", slug: "projects-a" }, { name: "Projects B", slug: "projects-b" }]).returning();
  const [owner, viewer, outsider] = await db.insert(users).values([{ email: "projects-owner@example.test", passwordHash: "PRIVATE" }, { email: "projects-viewer@example.test" }, { email: "projects-outsider@example.test" }]).returning();
  const [none] = await db.insert(customRole).values({ organizationId: a.id, name: "None", permissions: [] }).returning();
  const [m, vm, fm] = await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner" }, { organizationId: a.id, userId: viewer.id, role: "member", customRoleId: none.id }, { organizationId: b.id, userId: outsider.id, role: "owner" }]).returning();
  const [c, fc] = await db.insert(contact).values([{ organizationId: a.id, name: "Owned", creditLimit: 1250 }, { organizationId: b.id, name: "Foreign" }]).returning();
  const [t, ft] = await db.insert(team).values([{ organizationId: a.id, name: "Owned" }, { organizationId: b.id, name: "Foreign" }]).returning();
  await db.insert(teamMember).values({ teamId: t.id, memberId: m.id });
  const [employee, foreignEmployee] = await db.insert(payrollEmployee).values([{ organizationId: a.id, name: "Owned", employeeNumber: "A", salary: 1250, startDate: "2024-01-01" }, { organizationId: b.id, name: "Foreign", employeeNumber: "B", salary: 1, startDate: "2024-01-01" }]).returning();
  const keys = { a: "dk_project_a", b: "dk_project_b", viewer: "dk_project_viewer", expired: "dk_project_expired" };
  for (const [name, key] of Object.entries(keys)) await db.insert(apiKey).values({ organizationId: name === "b" ? b.id : a.id,
    createdBy: name === "b" ? outsider.id : name === "viewer" ? viewer.id : owner.id, name, keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_project", expiresAt: name === "expired" ? new Date("2020-01-01") : null });
  const ctx: AuthContext = { organizationId: a.id, userId: owner.id, role: "owner" };
  const ma = await connect(ctx), mb = await connect({ ...ctx, organizationId: b.id, userId: outsider.id }), ro = await connect({ ...ctx, userId: viewer.id, role: "member", permissions: [] });
  const managed = await connect({ ...ctx, role: "member", permissions: ["manage:projects"] });
  const opByName = (name: string) => projectOperations.find(o => o.name === name)!;
  async function rest(name: string, args: Record<string, unknown>, key = keys.a) {
    const op = opByName(name), params: Record<string, string> = {}, body = { ...args }, query = new URLSearchParams();
    for (const match of op.path.matchAll(/\[([^\]]+)\]/g)) {
      const field = match[1] === "id" ? "projectId" : match[1]; params[match[1]] = String(body[field]); delete body[field];
    }
    if (op.queryId) { query.set(op.queryId, String(body[op.queryId])); delete body[op.queryId]; }
    if (op.action === "list") for (const [key, value] of Object.entries(body)) { query.set(key, String(value)); delete body[key]; }
    const mod = await import(pathToFileURL(path.resolve(`app/api/v1/projects${op.path}/route.ts`)).href);
    const request = new Request(`http://fixture.test/projects?${query}`, { method: op.method,
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-organization-id": b.id },
      ...(["POST", "PATCH"].includes(op.method) ? { body: JSON.stringify(body) } : {}) });
    const response: Response = await mod[op.method](request, { params: Promise.resolve(params) });
    return { status: response.status, body: await response.json(), isError: !response.ok };
  }
  const allTables = ["project", "project_member", "project_task", "time_entry", "running_timer", "project_milestone", "milestone_assignment", "task_checklist", "task_comment", "project_label", "project_note", "project_team", "project_team_member", "project_team_assignment", "audit_log"];
  async function snapshot() {
    const fields = allTables.map(name => `'${name}',(select jsonb_agg(to_jsonb(t) order by id) from ${name} t)`).join(",");
    const result = await db.execute(sql.raw(`select jsonb_build_object(${fields}) as state`)); return JSON.stringify(result.rows[0].state);
  }
  async function denied(name: string, args: Record<string, unknown>, status?: number, mode = "rest", key = keys.a, client = ma) {
    const before = await snapshot(), originalError = console.error;
    const invoke = async () => {
      try { console.error = () => {}; return mode === "rest" ? await rest(name, args, key) : await client.call(name, args); }
      finally { console.error = originalError; }
    };
    const r = await invoke();
    assert.equal(r.isError, true, `${name}: ${JSON.stringify(r)}`);
    if (mode === "mcp" && status === 500) assert.equal(r.body.error, "Internal error");
    else if (status) assert.equal(mode === "rest" ? (r as Awaited<ReturnType<typeof rest>>).status : r.body.status, status, `${name}: ${JSON.stringify(r)}`);
    assert.equal(await snapshot(), before, `${name} mutated on failure`);
  }
  const covered = new Set<string>();
  try {
    for (const mode of ["rest", "mcp"]) {
      async function call(name: string, args: Record<string, unknown> = {}) {
        const r = mode === "rest" ? await rest(name, args) : await ma.call(name, args);
        assert.equal(r.isError, false, `${mode} ${name}: ${JSON.stringify(r)}`);
        covered.add(`${mode}:${name}`); return r.body;
      }
      const p = (await call("create_project", { name: mode, contactId: c.id, budget: 1250, hourlyRateMinor: "9007199254740991", fixedPrice: 2, fixedPriceMinor: "2", estimatedHours: 60, currency: "JPY" })).project;
      assert.equal(p.budgetMinor, "1250"); assert.equal(p.hourlyRate, Number.MAX_SAFE_INTEGER); assert.equal(p.organizationId, a.id);
      const root = { projectId: p.id };
      await call("list_projects", { limit: 1, page: 1, status: "active", priority: "medium" });
      await call("update_project", { ...root, budgetMinor: "9007199254740991" });
      const pm = (await call("add_project_member", { ...root, memberId: m.id, hourlyRateMinor: "1250", costRate: 1250 })).projectMember;
      assert.equal(pm.costRateMinor, "1250");
      await call("list_project_members", root);
      await call("update_project_member", { ...root, memberId: m.id, hourlyRateMinor: null });
      const pt = (await call("create_project_team", { ...root, name: "Local", memberIds: [m.id, vm.id] })).team;
      await call("list_project_teams", root);
      await call("assign_project_team", { ...root, teamId: t.id }); await call("list_project_team_assignments", root);
      const task = (await call("create_project_task", { ...root, title: "Task", assigneeId: m.id, teamId: pt.id, estimatedMinutes: 0, startDate: "2024-02-29", dueDate: "2024-03-01" })).task;
      assert.equal(task.estimatedMinutes, 0);
      const taskRoot = { ...root, taskId: task.id };
      await call("list_project_tasks", root);
      await call("update_project_task", { ...taskRoot, status: "done", estimatedMinutes: 2147483647, sortOrder: -1 });
      const ci = (await call("create_project_task_checklist_item", { ...taskRoot, title: "Check" })).item;
      await call("update_project_task_checklist", { ...taskRoot, items: [{ id: ci.id, isCompleted: true, sortOrder: 2147483647 }] });
      await call("list_project_task_checklist", taskRoot);
      const comment = (await call("create_project_task_comment", { ...taskRoot, content: "Comment" })).comment;
      await call("list_project_task_comments", taskRoot);
      const label = (await call("create_project_label", { ...root, name: "Label" })).label; await call("list_project_labels", root);
      const note = (await call("create_project_note", { ...root, content: "Note" })).note;
      await call("update_project_note", { ...root, noteId: note.id, isPinned: true }); await call("list_project_notes", root);
      const ms = (await call("create_project_milestone", { ...root, title: "Milestone", amountMinor: "9007199254740991" })).milestone;
      const milestoneRoot = { ...root, milestoneId: ms.id };
      await call("update_project_milestone", { ...milestoneRoot, amount: 1250, amountMinor: "1250", status: "completed", progressPercent: 100 });
      await call("list_project_milestones", root);
      const assignment = (await call("create_project_milestone_assignment", { ...milestoneRoot, employeeId: employee.id, memberId: m.id, amountMinor: "1250" })).assignment;
      await call("list_project_milestone_assignments", milestoneRoot);
      const entry = (await call("create_project_time_entry", { ...root, date: "2024-02-29", minutes: 1, taskId: task.id })).timeEntry;
      assert.equal(entry.hourlyRateMinor, "9007199254740991");
      await call("list_project_time_entries", { ...root, page: 1, limit: 1 }); await call("get_project_time_entry", { ...root, entryId: entry.id });
      await call("update_project_time_entry", { ...root, entryId: entry.id, minutes: 60, hourlyRateMinor: "1250" });
      await call("start_project_timer", { ...root, taskId: task.id, description: "First" });
      const timer = (await call("get_project_timer", root)).timer;
      await call("update_project_timer", { ...root, pausedAt: "2024-02-29T01:00:00+03:30", accumulatedSeconds: 30 });
      await call("update_project_timer", { ...root, pausedAt: null });
      const detail = (await call("get_project", root)).project;
      assert.equal(detail.totalHours, 60); assert.equal(detail.contact.creditLimitMinor, "1250");
      assert.equal(detail.tasks[0].checklist[0].id, ci.id);
      assert.equal(JSON.stringify(detail).includes("PRIVATE"), false); assert.equal(JSON.stringify(detail).includes("passwordHash"), false);
      assert.deepEqual((await rest("get_project", root)).body.project, (await ma.call("get_project", root)).body.project);
      const beforeEmpty = await snapshot();
      for (const [name, args] of [
        ["update_project_member", { ...root, memberId: m.id }], ["update_project_time_entry", { ...root, entryId: entry.id }],
        ["update_project_timer", root], ["update_project_milestone", milestoneRoot], ["update_project_task", taskRoot], ["update_project_note", { ...root, noteId: note.id }],
      ] as const) await call(name, args);
      assert.equal(await snapshot(), beforeEmpty);
      await denied("delete_project_task_comment", { ...taskRoot, commentId: comment.id }, 403, mode, keys.viewer, ro);
      assert.equal((await ro.call("get_project_timer", root)).body.timer, null);
      const timerSnapshot = await snapshot();
      assert.equal((await ro.call("discard_project_timer", root)).body.success, true); assert.equal(await snapshot(), timerSnapshot);
      await denied("update_project_timer", { ...root, description: "Another user's timer" }, 404, mode, keys.viewer, ro);
      const samples: Record<string, Record<string, unknown>> = {
        project: { ...root, name: "Changed" }, member: { ...root, memberId: m.id, role: "manager" }, time: { ...root, entryId: entry.id, minutes: 61 }, timer: { ...root, description: "Changed" },
        task: { ...taskRoot, title: "Changed" }, milestone: { ...milestoneRoot, title: "Changed" }, assignment: { ...milestoneRoot, assignmentId: assignment.id },
        checklist: { ...taskRoot, itemId: ci.id, items: [{ id: ci.id, title: "Changed" }] }, comment: { ...taskRoot, commentId: comment.id },
        label: { ...root, labelId: label.id }, note: { ...root, noteId: note.id, content: "Changed" }, team: root, teamAssignment: { ...root, teamId: t.id },
      };
      const creates: Record<string, Record<string, unknown>> = {
        project: { name: "New" }, member: { ...root, memberId: vm.id }, time: { ...root, date: "2024-02-29", minutes: 1 }, timer: root,
        task: { ...root, title: "New" }, milestone: { ...root, title: "New" }, assignment: { ...milestoneRoot, memberId: m.id, amount: 1 },
        checklist: { ...taskRoot, title: "New" }, comment: { ...taskRoot, content: "New" }, label: { ...root, name: "New" }, note: { ...root, content: "New" }, team: { ...root, name: "New", memberIds: [m.id] }, teamAssignment: { ...root, teamId: ft.id },
      };
      // Every root route/tool rejects a foreign project, including task/milestone subresources.
      for (const op of projectOperations.filter(o => Object.hasOwn(o.schema.shape, "projectId"))) {
        let args: Record<string, unknown> = { ...(op.action === "create" ? creates[op.kind] : samples[op.kind]), projectId: p.id };
        if (op.action === "get" || op.action === "list" || op.action === "delete") args = Object.fromEntries(Object.entries(args).filter(([k]) => Object.hasOwn(op.schema.shape, k))) as typeof args;
        if (op.kind === "teamAssignment" && op.action === "create") args.teamId = t.id;
        args = Object.fromEntries(Object.entries(args).filter(([k]) => Object.hasOwn(op.schema.shape, k))) as typeof args;
        await denied(op.name, args, 404, mode, keys.b, mb);
      }
      for (const op of projectOperations.filter(o => !["list", "get"].includes(o.action) && o.kind !== "comment" && !(o.kind === "timer" && o.action !== "create"))) {
        const source = op.action === "create" ? creates[op.kind] : samples[op.kind];
        const args = Object.fromEntries(Object.entries(source).filter(([k]) => Object.hasOwn(op.schema.shape, k)));
        if (op.kind === "teamAssignment" && op.action === "create") args.teamId = t.id;
        await denied(op.name, args, 403, mode, keys.viewer, ro);
      }
      // Failing audit triggers must roll back every writer (including timer replacement and time totals).
      const [unusedTask] = await db.insert(projectTask).values({ projectId: p.id, title: "Unlinked delete fixture", createdById: owner.id }).returning();
      await db.execute(sql.raw("create function project_fail_audit() returns trigger language plpgsql as $$ begin raise exception 'fixture audit fault'; end $$; create trigger project_audit_fault before insert on audit_log for each row execute function project_fail_audit()"));
      for (const op of projectOperations.filter(o => !["list", "get"].includes(o.action))) {
        const source = op.action === "create" ? creates[op.kind] : samples[op.kind];
        const args = Object.fromEntries(Object.entries(source).filter(([k]) => Object.hasOwn(op.schema.shape, k)));
        if (op.kind === "teamAssignment" && op.action === "create") {
          const [newTeam] = await db.insert(team).values({ organizationId: a.id, name: `New-${mode}` }).returning(); args.teamId = newTeam.id;
        }
        if (op.kind === "task" && op.action === "delete") args.taskId = unusedTask.id;
        await denied(op.name, args, 500, mode);
      }
      await db.execute(sql.raw("drop trigger project_audit_fault on audit_log; drop function project_fail_audit()"));
      await call("delete_project_task", { ...root, taskId: unusedTask.id });
      // All financial inserts/updates and soft project deletion validate returned money before commit.
      for (const [kind, table, field] of [["project", "project", "budget"], ["member", "project_member", "cost_rate"], ["time", "time_entry", "hourly_rate"], ["milestone", "project_milestone", "amount"], ["assignment", "milestone_assignment", "amount"]]) {
        await db.execute(sql.raw(`create function project_poison_output() returns trigger language plpgsql as $$ begin new.${field} = 9007199254740992; return new; end $$; create trigger project_output_fault before insert or update on ${table} for each row execute function project_poison_output()`));
        for (const op of projectOperations.filter(o => o.kind === kind && (["create", "update"].includes(o.action) || (kind === "project" && o.action === "delete")))) {
          const source = op.action === "create" ? creates[kind] : samples[kind];
          const args = Object.fromEntries(Object.entries(source).filter(([k]) => Object.hasOwn(op.schema.shape, k)));
          await denied(op.name, args, 422, mode);
        }
        if (kind === "project") await denied("create_project_time_entry", { ...root, date: "2024-01-01", minutes: 1 }, 422, mode);
        await db.execute(sql.raw(`drop trigger project_output_fault on ${table}; drop function project_poison_output()`));
      }
      for (const [name, args] of [
        ["update_project", { ...root, budget: 1, budgetMinor: "2" }], ["update_project", { ...root, budgetMinor: "9007199254740992" }],
        ["update_project", { ...root, startDate: "2024-03-01", endDate: "2024-02-01" }],
        ["create_project_time_entry", { ...root, date: "2023-02-29", minutes: 1 }], ["update_project_time_entry", { ...root, entryId: entry.id, minutes: 2147483648 }],
        ["update_project_milestone", { ...milestoneRoot, progressPercent: 101 }],
        ["update_project_task_checklist", { ...taskRoot, items: [{ id: ci.id, title: "Changed" }, { id: ci.id, isCompleted: true }] }],
      ] as const) await denied(name, args, undefined, mode);
      for (const [name, args] of [
        ["create_project", { name: "Bad", contactId: fc.id }], ["update_project", { ...root, contactId: fc.id }],
        ["add_project_member", { ...root, memberId: fm.id }], ["create_project_task", { ...root, title: "Bad", assigneeId: fm.id }],
        ["create_project_team", { ...root, name: "Bad", memberIds: [fm.id] }], ["assign_project_team", { ...root, teamId: ft.id }],
        ["create_project_milestone_assignment", { ...milestoneRoot, amount: 1, employeeId: foreignEmployee.id }],
      ] as const) await denied(name, args, 404, mode);
      await denied("update_project", { ...root, currency: "USD" }, 409, mode);
      await denied("delete_project_task", taskRoot, 409, mode);
      await db.execute(sql`update project_milestone set invoiced_amount_cents = 1 where id = ${ms.id}`);
      await denied("update_project_milestone", { ...milestoneRoot, amountMinor: "0" }, 409, mode);
      await denied("delete_project_milestone", milestoneRoot, 409, mode);
      await db.execute(sql`update project_milestone set invoiced_amount_cents = 0 where id = ${ms.id}`);
      await call("update_project_task", { ...taskRoot, labels: [label.id] });
      await denied("delete_project_label", { ...root, labelId: label.id }, 409, mode);
      await call("update_project_task", { ...taskRoot, labels: [] });
      await denied("start_project_timer", { ...root, isBillable: "bad" }, undefined, mode);
      assert.equal((await call("get_project_timer", root)).timer.id, timer.id);
      // Unsupported saved values and output trigger faults fail without partial mutations.
      await db.execute(sql.raw("create function project_poison_money() returns trigger language plpgsql as $$ begin new.hourly_rate = 9007199254740992; return new; end $$; create trigger project_output_fault before update on time_entry for each row execute function project_poison_money()"));
      await denied("update_project_time_entry", { ...root, entryId: entry.id, minutes: 61 }, 422, mode);
      await db.execute(sql.raw("drop trigger project_output_fault on time_entry; drop function project_poison_money()"));
      await db.update(projectMember).set({ hourlyRate: 1 }).where(eq(projectMember.id, pm.id));
      const inherited = (await call("create_project_time_entry", { ...root, date: "2024-03-01", minutes: 1 })).timeEntry;
      assert.equal(inherited.hourlyRateMinor, "1"); await call("delete_project_time_entry", { ...root, entryId: inherited.id });
      await call("mark_project_milestone_assignment_paid", { ...milestoneRoot, assignmentId: assignment.id });
      const paidSnapshot = await snapshot(); await call("mark_project_milestone_assignment_paid", { ...milestoneRoot, assignmentId: assignment.id }); assert.equal(await snapshot(), paidSnapshot);
      await denied("delete_project_milestone", milestoneRoot, 409, mode);
      await db.update(milestoneAssignment).set({ isPaid: false }).where(eq(milestoneAssignment.id, assignment.id));
      await call("discard_project_timer", root); await call("delete_project_time_entry", { ...root, entryId: entry.id });
      assert.equal((await call("get_project", root)).project.totalHours, 0);
      await call("delete_project_task_checklist_item", { ...taskRoot, itemId: ci.id }); await call("delete_project_task_comment", { ...taskRoot, commentId: comment.id });
      await call("delete_project_task", taskRoot); await call("delete_project_milestone", milestoneRoot);
      await call("delete_project_label", { ...root, labelId: label.id }); await call("delete_project_note", { ...root, noteId: note.id });
      await call("remove_project_member", { ...root, memberId: m.id }); await call("unassign_project_team", { ...root, teamId: t.id });
      await call("delete_project", root); await denied("get_project", root, 404, mode);
    }
    assert.equal(covered.size, projectOperations.length * 2);
    const p = (await ma.call("create_project", { name: "Isolation" })).body.project;
    const other = (await ma.call("create_project", { name: "Other project" })).body.project;
    const foreignTask = (await ma.call("create_project_task", { projectId: other.id, title: "Foreign task" })).body.task;
    const foreignItem = (await ma.call("create_project_task_checklist_item", { projectId: other.id, taskId: foreignTask.id, title: "Foreign item" })).body.item;
    const foreignLabel = (await ma.call("create_project_label", { projectId: other.id, name: "Foreign label" })).body.label;
    const ownTask = (await ma.call("create_project_task", { projectId: p.id, title: "Own task" })).body.task;
    for (const mode of ["rest", "mcp"]) {
      for (const name of ["list_project_task_checklist", "list_project_task_comments"]) await denied(name, { projectId: p.id, taskId: foreignTask.id }, 404, mode);
      await denied("update_project_task_checklist", { projectId: p.id, taskId: ownTask.id, items: [{ id: foreignItem.id, title: "Bad" }] }, 404, mode);
      await denied("delete_project_task_checklist_item", { projectId: p.id, taskId: ownTask.id, itemId: foreignItem.id }, 404, mode);
      await denied("create_project_time_entry", { projectId: p.id, date: "2024-01-01", minutes: 1, taskId: foreignTask.id }, 404, mode);
      await denied("update_project_task", { projectId: p.id, taskId: ownTask.id, labels: [foreignLabel.id] }, 404, mode);
      await denied("update_project_timer", { projectId: p.id, taskId: foreignTask.id }, 404, mode);
    }
    for (const key of [keys.expired, "dk_bad"]) await denied("create_project", { name: "No" }, 401, "rest", key);
    const route = await import("../../app/api/v1/projects/[id]/route");
    for (const query of [`projectId=${other.id}`, "unknown=1", "x=1&x=2"]) {
      const before = await snapshot();
      const response = await route.GET(new Request(`http://fixture.test/projects?${query}`, { headers: { authorization: `Bearer ${keys.a}` } }), { params: Promise.resolve({ id: p.id }) });
      assert.equal(response.status, 400); assert.equal(await snapshot(), before);
    }
    assert.equal((await managed.call("update_project", { projectId: p.id, name: "Custom role" })).isError, false);
    // Organization locks serialize simultaneous time totals, timer replacements and duplicate membership.
    const results = await Promise.all(Array.from({ length: 8 }, () => ma.call("create_project_time_entry", { projectId: p.id, date: "2024-01-01", minutes: 1, hourlyRateMinor: "1250" })));
    assert.ok(results.every(r => !r.isError)); assert.equal((await ma.call("get_project", { projectId: p.id })).body.project.totalHours, 8);
    await Promise.all(Array.from({ length: 4 }, () => ma.call("start_project_timer", { projectId: p.id })));
    assert.equal((await db.select().from(runningTimer).where(eq(runningTimer.projectId, p.id))).length, 1);
    const members = await Promise.all(Array.from({ length: 4 }, () => ma.call("add_project_member", { projectId: p.id, memberId: m.id })));
    assert.equal(members.filter(r => !r.isError).length, 1);
    const entry = results[0].body.timeEntry;
    await ma.call("update_project_time_entry", { projectId: p.id, entryId: entry.id, minutes: 2147483640 });
    assert.equal((await ma.call("get_project", { projectId: p.id })).body.project.totalHours, 2147483647);
    await denied("create_project_time_entry", { projectId: p.id, date: "2024-01-01", minutes: 1 }, 422, "rest");
    await denied("create_project_time_entry", { projectId: p.id, date: "2024-01-01", minutes: 1 }, 422, "mcp");
    await ma.call("update_project_time_entry", { projectId: p.id, entryId: entry.id, minutes: 1 });
    await db.update(project).set({ totalHours: 0 }).where(eq(project.id, p.id));
    await denied("create_project_time_entry", { projectId: p.id, date: "2024-01-01", minutes: 1 }, 422, "mcp");
    await db.update(project).set({ totalHours: 8 }).where(eq(project.id, p.id));
    // Saved unsafe amounts and cross-org joins never leak through master detail.
    await db.execute(sql`update project set budget = 9007199254740992 where id = ${p.id}`);
    await denied("update_project", { projectId: p.id, budgetMinor: "1250" }, 422, "mcp");
    await db.update(project).set({ budget: 1250 }).where(eq(project.id, p.id));
    await db.update(projectTask).set({ assigneeId: fm.id }).where(eq(projectTask.id, ownTask.id));
    await denied("get_project", { projectId: p.id }, 404, "rest"); await denied("get_project", { projectId: p.id }, 404, "mcp");
    assert.equal((await mb.call("list_projects", {})).body.data.length, 0);
    console.log(`Project master contracts verified: ${covered.size} actual REST/MCP operation cases, negative scope/auth/history and atomic faults`);
  } finally { await Promise.all([ma.close(), mb.close(), ro.close(), managed.close()]); }
}
run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
