import { and, asc, desc, eq, getTableColumns, isNull, type SQL } from "drizzle-orm";
import type { PgTable, PgColumn } from "drizzle-orm/pg-core";
import { db } from "@/lib/db";
import { project, projectMember, projectTask, projectTeam, projectTeamMember, projectTeamAssignment,
  projectMilestone, milestoneAssignment, timeEntry, runningTimer, taskChecklist, taskComment,
  projectLabel, projectNote, member, users, contact, team, teamMember, payrollEmployee, invoice,
  invoiceLine, billLine, journalLine, projectBillableItem, payrollItem, payrollRun } from "@/lib/db/schema";
import { AuthError, type AuthContext } from "./auth-context";
import { requireRole } from "./require-role";
import { checkResourceLimit } from "./check-limit";
import { auditTax, lockTaxOrganization, type TaxTx } from "./tax-config-transaction";
import { projectOperations } from "./project-master-operations";
import { projectAmounts, projectMoneyFields, projectRowDto } from "./project-master-wire";
import { legacyMinor, stringifyWire } from "@/lib/money/wire";

type Row = Record<string, unknown>;
type Resource = { table: PgTable; id: PgColumn; parent: PgColumn; parentKey: string; key?: string; order?: PgColumn };
// Only these statically registered tables can be addressed; no client-supplied table/column names.
const resources: Record<string, Resource> = {
  member: { table: projectMember, id: projectMember.id, parent: projectMember.projectId, parentKey: "projectId", key: "memberId" },
  time: { table: timeEntry, id: timeEntry.id, parent: timeEntry.projectId, parentKey: "projectId", key: "entryId", order: timeEntry.date },
  timer: { table: runningTimer, id: runningTimer.id, parent: runningTimer.projectId, parentKey: "projectId" },
  task: { table: projectTask, id: projectTask.id, parent: projectTask.projectId, parentKey: "projectId", key: "taskId", order: projectTask.sortOrder },
  milestone: { table: projectMilestone, id: projectMilestone.id, parent: projectMilestone.projectId, parentKey: "projectId", key: "milestoneId", order: projectMilestone.sortOrder },
  assignment: { table: milestoneAssignment, id: milestoneAssignment.id, parent: milestoneAssignment.milestoneId, parentKey: "milestoneId", key: "assignmentId" },
  checklist: { table: taskChecklist, id: taskChecklist.id, parent: taskChecklist.taskId, parentKey: "taskId", key: "itemId", order: taskChecklist.sortOrder },
  comment: { table: taskComment, id: taskComment.id, parent: taskComment.taskId, parentKey: "taskId", key: "commentId", order: taskComment.createdAt },
  label: { table: projectLabel, id: projectLabel.id, parent: projectLabel.projectId, parentKey: "projectId", key: "labelId" },
  note: { table: projectNote, id: projectNote.id, parent: projectNote.projectId, parentKey: "projectId", key: "noteId", order: projectNote.createdAt },
  team: { table: projectTeam, id: projectTeam.id, parent: projectTeam.projectId, parentKey: "projectId" },
  teamAssignment: { table: projectTeamAssignment, id: projectTeamAssignment.id, parent: projectTeamAssignment.projectId, parentKey: "projectId", key: "teamId" },
};
const scope = (ctx: AuthContext, id?: string) => and(eq(project.organizationId, ctx.organizationId), isNull(project.deletedAt), id ? eq(project.id, id) : undefined);
const notFound = (what: string): never => { throw new AuthError(`${what} not found in this organization/project`, 404); };
const conflict = (message: string): never => { throw new AuthError(message, 409); };
const invalid = (message: string): never => { throw new AuthError(message, 422); };
async function publicUser(tx: TaxTx, ctx: AuthContext, id: unknown) {
  const [row] = await tx.select({ id: users.id, name: users.name, email: users.email, image: users.image }).from(users)
    .innerJoin(member, and(eq(member.userId, users.id), eq(member.organizationId, ctx.organizationId))).where(eq(users.id, String(id)));
  return row ?? notFound("Current organization user");
}
async function orgMember(tx: TaxTx, ctx: AuthContext, id: unknown) {
  const [row] = await tx.select().from(member).where(and(eq(member.id, String(id)), eq(member.organizationId, ctx.organizationId)));
  if (!row) return notFound("Organization member");
  return { ...row, user: await publicUser(tx, ctx, row.userId) };
}
async function orgTeam(tx: TaxTx, ctx: AuthContext, id: unknown) {
  const [row] = await tx.select().from(team).where(and(eq(team.id, String(id)), eq(team.organizationId, ctx.organizationId)));
  if (!row) return notFound("Organization team");
  const members = await tx.select().from(teamMember).where(eq(teamMember.teamId, row.id));
  return { ...row, members: await Promise.all(members.map(async r => ({ ...r, member: await orgMember(tx, ctx, r.memberId) }))) };
}
async function scopedContact(tx: TaxTx, ctx: AuthContext, id: unknown, live = false) {
  const [row] = await tx.select().from(contact).where(and(eq(contact.id, String(id)), eq(contact.organizationId, ctx.organizationId), live ? isNull(contact.deletedAt) : undefined));
  if (!row) return notFound("Contact");
  const result = { ...row, creditLimitMinor: row.creditLimit === null ? null : String(legacyMinor(BigInt(row.creditLimit))) };
  stringifyWire(result); return result;
}
async function child(tx: TaxTx, kind: string, parent: string, id: unknown) {
  const r = resources[kind];
  const [row] = await tx.select().from(r.table).where(and(eq(r.parent, parent), eq(r.id, String(id))));
  return row ?? notFound(kind);
}
async function references(tx: TaxTx, ctx: AuthContext, kind: string, row: Row, projectId: string, live = false) {
  if (kind === "project" && row.contactId) await scopedContact(tx, ctx, row.contactId, live);
  if (kind === "member" || kind === "assignment") if (row.memberId) await orgMember(tx, ctx, row.memberId);
  if (kind === "task") {
    if (row.assigneeId) await orgMember(tx, ctx, row.assigneeId);
    if (row.teamId) await child(tx, "team", projectId, row.teamId);
    if (row.createdById) await publicUser(tx, ctx, row.createdById);
    for (const labelId of (row.labels as string[] | undefined) ?? []) await child(tx, "label", projectId, labelId);
  }
  if (kind === "time" || kind === "timer") {
    await publicUser(tx, ctx, row.userId);
    if (row.taskId) await child(tx, "task", projectId, row.taskId);
    if (row.invoiceId) {
      const [inv] = await tx.select({ id: invoice.id, currency: invoice.currencyCode }).from(invoice).where(and(eq(invoice.id, String(row.invoiceId)), eq(invoice.organizationId, ctx.organizationId)));
      if (!inv) notFound("Time entry invoice");
      const [p] = await tx.select({ currency: project.currency }).from(project).where(scope(ctx, projectId));
      if (inv.currency !== p.currency) invalid("Time entry invoice currency differs from project");
    }
  }
  if (kind === "comment" || kind === "note") await publicUser(tx, ctx, row.authorId);
  if (kind === "assignment" && row.employeeId) {
    const [e] = await tx.select({ id: payrollEmployee.id }).from(payrollEmployee).where(and(eq(payrollEmployee.id, String(row.employeeId)), eq(payrollEmployee.organizationId, ctx.organizationId), live ? isNull(payrollEmployee.deletedAt) : undefined));
    if (!e) notFound("Payroll employee");
  }
  if (kind === "assignment" && !row.memberId && !row.employeeId) invalid("Assignment requires employeeId or memberId");
  if (kind === "assignment" && row.payrollItemId) {
    const [linked] = await tx.select({ id: payrollItem.id }).from(payrollItem).innerJoin(payrollRun, eq(payrollItem.payrollRunId, payrollRun.id))
      .where(and(eq(payrollItem.id, String(row.payrollItemId)), eq(payrollRun.organizationId, ctx.organizationId)));
    if (!linked) notFound("Assignment payroll item");
  }
  if (kind === "teamAssignment") await orgTeam(tx, ctx, row.teamId);
  if (kind === "member" && row.teamAssignmentId) await child(tx, "teamAssignment", projectId, row.teamAssignmentId);
}
async function dto(tx: TaxTx, ctx: AuthContext, kind: string, row: Row, projectId: string, joined = false): Promise<Row> {
  const result = projectRowDto(kind, row); await references(tx, ctx, kind, row, projectId);
  if (!joined) return result;
  if (kind === "project") result.contact = row.contactId ? await scopedContact(tx, ctx, row.contactId) : null;
  if (kind === "member") result.member = await orgMember(tx, ctx, row.memberId);
  if (kind === "time") result.user = await publicUser(tx, ctx, row.userId);
  if (kind === "timer") result.task = row.taskId ? await dto(tx, ctx, "task", await child(tx, "task", projectId, row.taskId), projectId) : null;
  if (kind === "task") result.assignee = row.assigneeId ? await orgMember(tx, ctx, row.assigneeId) : null;
  if (kind === "comment" || kind === "note") result.author = await publicUser(tx, ctx, row.authorId);
  if (kind === "teamAssignment") result.team = await orgTeam(tx, ctx, row.teamId);
  if (kind === "assignment") {
    result.member = row.memberId ? await orgMember(tx, ctx, row.memberId) : null;
    const [e] = row.employeeId ? await tx.select({ id: payrollEmployee.id, name: payrollEmployee.name, email: payrollEmployee.email, employeeNumber: payrollEmployee.employeeNumber }).from(payrollEmployee).where(and(eq(payrollEmployee.id, String(row.employeeId)), eq(payrollEmployee.organizationId, ctx.organizationId))) : [];
    result.employee = e ?? null;
  }
  if (kind === "team") {
    const rows = await tx.select().from(projectTeamMember).where(eq(projectTeamMember.teamId, String(row.id)));
    result.members = await Promise.all(rows.map(async r => ({ ...r, member: await orgMember(tx, ctx, r.memberId) })));
  }
  stringifyWire(result); return result;
}
async function ownedProject(tx: TaxTx, ctx: AuthContext, id: string, write = false) {
  const query = tx.select().from(project).where(scope(ctx, id));
  const [row] = await (write ? query.for("update") : query);
  if (!row) return notFound("Project");
  await dto(tx, ctx, "project", row, id); return row;
}
async function rows(tx: TaxTx, ctx: AuthContext, kind: string, projectId: string, parent = projectId) {
  const r = resources[kind];
  const result = await tx.select().from(r.table).where(eq(r.parent, parent)).orderBy(r.order ? (["time", "comment", "note"].includes(kind) ? desc(r.order) : asc(r.order)) : asc(r.id), asc(r.id));
  return Promise.all(result.map(row => dto(tx, ctx, kind, row, projectId, true)));
}
async function fullProject(tx: TaxTx, ctx: AuthContext, p: typeof project.$inferSelect, full: boolean) {
  const result = await dto(tx, ctx, "project", p, p.id, true);
  result.members = await rows(tx, ctx, "member", p.id);
  const tasks = await rows(tx, ctx, "task", p.id); result.tasks = tasks;
  if (full) {
    for (const t of tasks) {
      t.team = t.teamId ? await dto(tx, ctx, "team", await child(tx, "team", p.id, t.teamId), p.id, true) : null;
      t.createdBy = t.createdById ? await publicUser(tx, ctx, t.createdById) : null;
      t.checklist = await rows(tx, ctx, "checklist", p.id, String(t.id));
      t.comments = await rows(tx, ctx, "comment", p.id, String(t.id));
    }
    result.timeEntries = await rows(tx, ctx, "time", p.id);
    for (const t of result.timeEntries as Row[]) t.task = t.taskId ? await dto(tx, ctx, "task", await child(tx, "task", p.id, t.taskId), p.id) : null;
    for (const [kind, field] of [["label", "labels"], ["team", "teams"], ["milestone", "milestones"], ["note", "notes"], ["timer", "runningTimers"]]) result[field] = await rows(tx, ctx, kind, p.id);
  }
  stringifyWire(result); return result;
}
function page(data: Row[], q: Row) {
  const n = Number(q.page), limit = Number(q.limit);
  return { data: data.slice((n - 1) * limit, n * limit), pagination: { page: n, limit, total: data.length, totalPages: Math.ceil(data.length / limit) } };
}
async function rate(tx: TaxTx, ctx: AuthContext, p: typeof project.$inferSelect) {
  const values = await rows(tx, ctx, "member", p.id);
  const candidates = values.filter(r => (r.member as { userId: string }).userId === ctx.userId);
  if (candidates.length > 1) invalid("Ambiguous duplicate project member rates");
  return candidates[0]?.hourlyRate ?? p.hourlyRate;
}
async function totalMinutes(tx: TaxTx, ctx: AuthContext, p: typeof project.$inferSelect, delta: bigint) {
  const entries = await tx.select().from(timeEntry).where(eq(timeEntry.projectId, p.id));
  let sum = 0n;
  for (const e of entries) { await dto(tx, ctx, "time", e, p.id); sum += BigInt(e.minutes); }
  if (sum !== BigInt(p.totalHours)) invalid("Saved project totalHours differs from time entry minutes; explicit historical repair required");
  const next = sum + delta;
  if (next < 0n || next > 2147483647n) invalid("Project time total exceeds int32 physical minutes");
  return Number(next);
}
async function guardCurrency(tx: TaxTx, p: typeof project.$inferSelect) {
  if (p.totalBilled || p.totalHours) conflict("Cannot change project currency with financial/time history");
  for (const table of [timeEntry, projectMilestone, projectMember, projectBillableItem, invoiceLine, billLine, journalLine]) {
    const [existing] = await tx.select({ id: table.id }).from(table).where(eq(table.projectId, p.id)).limit(1);
    if (existing) conflict("Cannot change project currency with financial references");
  }
}
export async function executeProjectOperation(ctx: AuthContext, name: string, input: unknown, request?: Request) {
  const op = projectOperations.find(o => o.name === name);
  if (!op) throw new Error("Unregistered project operation");
  const q = op.schema.parse(input) as Row, write = !["get", "list"].includes(op.action);
  // Existing comments and own timer update/discard remain authenticated operations.
  if (write && op.kind !== "comment" && !(op.kind === "timer" && op.action !== "create")) requireRole(ctx, "manage:projects");
  return db.transaction(async tx => {
    if (write) await lockTaxOrganization(tx, ctx.organizationId);
    const projectId = String(q.projectId ?? "");
    const p = op.kind === "project" && ["list", "create"].includes(op.action) ? null : await ownedProject(tx, ctx, projectId, write);
    if (op.kind === "project") {
      if (op.action === "list") {
        const found = await tx.select().from(project).where(and(scope(ctx), q.status ? eq(project.status, q.status as typeof project.$inferSelect.status) : undefined, q.priority ? eq(project.priority, q.priority as typeof project.$inferSelect.priority) : undefined)).orderBy(desc(project.createdAt), asc(project.id));
        return page(await Promise.all(found.map(row => fullProject(tx, ctx, row, false))), q);
      }
      if (op.action === "get") return { project: await fullProject(tx, ctx, p!, true) };
      const values = projectAmounts(q, ["budget", "hourlyRate", "fixedPrice"], op.action === "create"); delete values.projectId;
      if (op.action === "create") await checkResourceLimit(ctx.organizationId, project, project.organizationId, "projects", project.deletedAt);
      if (p && values.currency && values.currency !== p.currency) await guardCurrency(tx, p);
      await references(tx, ctx, "project", { ...p, ...values }, projectId, Boolean(values.contactId));
      projectRowDto("project", { ...(p ?? { totalBilled: 0, totalHours: 0, estimatedHours: 0, currency: "USD" }), ...values });
      const [row] = op.action === "create" ? await tx.insert(project).values({ ...values, name: String(values.name), organizationId: ctx.organizationId }).returning() :
        await tx.update(project).set(op.action === "delete" ? { deletedAt: new Date(), updatedAt: new Date() } : { ...values, updatedAt: new Date() }).where(scope(ctx, projectId)).returning();
      const result = await dto(tx, ctx, "project", row, row.id);
      await auditTax(tx, ctx.organizationId, "project", row.id, op.action, result, ctx, request);
      return op.action === "delete" ? { success: true } : { project: result };
    }
    const r = resources[op.kind], parent = String(q[r.parentKey]);
    if (r.parentKey === "taskId") await dto(tx, ctx, "task", await child(tx, "task", projectId, parent), projectId);
    if (r.parentKey === "milestoneId") await dto(tx, ctx, "milestone", await child(tx, "milestone", projectId, parent), projectId);
    const columns = getTableColumns(r.table);
    const predicate = and(eq(r.parent, parent), op.kind === "timer" ? eq(runningTimer.userId, ctx.userId) :
      op.kind === "member" && q.memberId ? eq(projectMember.memberId, String(q.memberId)) :
      op.kind === "teamAssignment" && q.teamId ? eq(projectTeamAssignment.teamId, String(q.teamId)) :
      r.key && q[r.key] ? eq(r.id, String(q[r.key])) : undefined) as SQL;
    if (op.action === "list") { const found = await rows(tx, ctx, op.kind, projectId, parent); return op.kind === "time" ? page(found, q) : { [op.result]: found }; }
    const found = op.action !== "create" || ["timer", "member", "teamAssignment"].includes(op.kind) ? await tx.select().from(r.table).where(predicate) : [];
    if (["timer", "member", "teamAssignment"].includes(op.kind) && found.length > 1) invalid("Ambiguous duplicate project assignment/timer history");
    const existing = found[0];
    if (existing) await dto(tx, ctx, op.kind, existing, projectId);
    if (op.kind === "assignment" && op.action === "update" && existing?.isPaid)
      return { assignment: await dto(tx, ctx, op.kind, existing, projectId) };
    if (op.action === "get") return { [op.result]: existing ? await dto(tx, ctx, op.kind, existing, projectId, true) : op.kind === "timer" ? null : notFound(op.kind) };
    if (op.action !== "create" && !existing && !(op.kind === "timer" && op.action === "delete") && !(op.kind === "checklist" && op.action === "update")) notFound(op.kind);
    if (op.kind === "checklist" && op.action === "update") {
      const items = q.items as Row[];
      if (new Set(items.map(i => i.id)).size !== items.length) invalid("Duplicate checklist IDs");
      for (const item of items) await dto(tx, ctx, "checklist", await child(tx, "checklist", parent, item.id), projectId);
      for (const item of items) {
        const { id, ...values } = item;
        if (!Object.keys(values).length) continue;
        const [row] = await tx.update(taskChecklist).set(values).where(and(eq(taskChecklist.taskId, parent), eq(taskChecklist.id, String(id)))).returning();
        await dto(tx, ctx, "checklist", row, projectId);
      }
      await auditTax(tx, ctx.organizationId, "task_checklist", parent, "update", { items }, ctx, request); return { success: true };
    }
    if (op.action === "create" && existing && ["member", "teamAssignment"].includes(op.kind)) conflict("Already assigned to this project");
    const values = projectAmounts(q, projectMoneyFields[op.kind as keyof typeof projectMoneyFields]?.filter(f => f !== "invoicedAmountCents") ?? [], op.action === "create" && op.kind === "milestone");
    for (const key of ["projectId", "entryId", "milestoneId", "taskId", "assignmentId", "itemId", "commentId", "labelId", "noteId"])
      if (key !== "taskId" || !["time", "timer"].includes(op.kind)) delete values[key];
    if (op.kind === "member" && op.action === "update") delete values.memberId;
    if (op.kind === "member" && op.action === "create") {
      values.hourlyRate ??= null; values.costRate ??= null;
    }
    if (op.kind === "assignment" && op.action === "create" && values.amount === undefined) invalid("Assignment amount or amountMinor is required");
    if (op.kind === "team" && op.action === "create") {
      const ids = (values.memberIds as string[] | undefined) ?? [];
      if (new Set(ids).size !== ids.length) invalid("Duplicate team members");
      for (const id of ids) await orgMember(tx, ctx, id);
      delete values.memberIds;
    }
    if (op.action === "create" && (op.kind === "time" || op.kind === "timer")) values.userId = ctx.userId;
    if (op.action === "create" && (op.kind === "note" || op.kind === "comment")) values.authorId = ctx.userId;
    if (op.action === "create" && op.kind === "task") values.createdById = ctx.userId;
    if (op.kind === "timer") {
      if (values.pausedAt !== undefined) { values.pausedAt = values.pausedAt ? new Date(String(values.pausedAt)) : null; if (!values.pausedAt) values.startedAt = new Date(); }
      if (op.action === "create") values.startedAt = new Date();
    }
    if (op.kind === "assignment" && op.action === "update") values.isPaid = true;
    const combined = { ...existing, ...values };
    if (op.action !== "delete") await references(tx, ctx, op.kind, combined, projectId, true);
    if (op.kind === "time" && existing?.invoiceId && op.action !== "get") conflict("Invoiced time entries cannot be edited or deleted");
    if (op.kind === "milestone" && existing) {
      if (op.action === "delete") {
        if (existing.invoicedAmountCents) conflict("Invoiced milestones cannot be deleted");
        const assignments = await rows(tx, ctx, "assignment", projectId, String(existing.id));
        if (assignments.some(a => a.isPaid || a.payrollItemId)) conflict("Paid/payroll-linked milestones cannot be deleted");
      } else if (values.amount !== undefined && BigInt(values.amount as number) < BigInt(existing.invoicedAmountCents as number)) conflict("Milestone amount cannot be below already invoiced cents");
    }
    if (op.kind === "task" && op.action === "delete") {
      for (const table of [timeEntry, runningTimer]) {
        const [link] = await tx.select({ id: table.id }).from(table).where(eq(table.taskId, String(existing!.id))).limit(1);
        if (link) conflict("Cannot delete a task referenced by time entries or timers");
      }
    }
    if (op.kind === "label" && op.action === "delete") {
      const tasks = await rows(tx, ctx, "task", projectId);
      if (tasks.some(t => (t.labels as string[]).includes(String(existing!.id)))) conflict("Remove this label from project tasks before deleting it");
    }
    if (op.kind === "comment" && op.action === "delete" && existing?.authorId !== ctx.userId) throw new AuthError("Can only delete your own comments", 403);
    if (["task", "milestone"].includes(op.kind)) {
      const terminal = op.kind === "task" ? "done" : "completed";
      if (values.status === terminal) values.completedAt = existing?.status === terminal ? existing.completedAt : new Date();
      else if (values.status) values.completedAt = null;
    }
    if (op.action === "update" && !Object.keys(values).length)
      return { [op.result]: await dto(tx, ctx, op.kind, existing!, projectId, op.kind === "note") };
    let minutes: number | undefined;
    if (op.kind === "time") {
      if (op.action === "create" && values.hourlyRate === undefined) values.hourlyRate = await rate(tx, ctx, p!);
      const delta = op.action === "delete" ? -BigInt(existing!.minutes as number) : BigInt((values.minutes ?? existing?.minutes) as number) - BigInt((existing?.minutes ?? 0) as number);
      minutes = await totalMinutes(tx, ctx, p!, delta);
    }
    if (op.action !== "delete") projectRowDto(op.kind, {
      ...(op.kind === "milestone" ? { invoicedAmountCents: 0, progressPercent: 0 } : {}), ...existing, ...values,
    });
    if (columns.updatedAt) values.updatedAt = new Date();
    if (op.action === "delete") {
      const deleted = await tx.delete(r.table).where(predicate).returning();
      for (const row of deleted) await dto(tx, ctx, op.kind, row, projectId);
      if (minutes !== undefined) { const [row] = await tx.update(project).set({ totalHours: minutes, updatedAt: new Date() }).where(scope(ctx, projectId)).returning(); await dto(tx, ctx, "project", row, projectId); }
      if (deleted.length) await auditTax(tx, ctx.organizationId, op.kind, String(deleted[0].id), "delete", { deleted }, ctx, request);
      return { success: true };
    }
    if (op.kind === "timer" && op.action === "create" && existing) await tx.delete(r.table).where(predicate);
    const [row] = op.action === "create" ? await tx.insert(r.table).values({ ...values, [r.parentKey]: parent }).returning() : await tx.update(r.table).set(values).where(predicate).returning();
    if (op.kind === "team" && op.action === "create") {
      const ids = (q.memberIds as string[] | undefined) ?? [];
      if (ids.length) await tx.insert(projectTeamMember).values(ids.map(memberId => ({ teamId: String(row.id), memberId })));
    }
    const result = await dto(tx, ctx, op.kind, row, projectId, op.kind === "note");
    if (minutes !== undefined) { const [updated] = await tx.update(project).set({ totalHours: minutes, updatedAt: new Date() }).where(scope(ctx, projectId)).returning(); await dto(tx, ctx, "project", updated, projectId); }
    // Repeated mark-paid preserves existing metadata and does not append another audit.
    if (!(op.kind === "assignment" && op.action === "update" && existing?.isPaid)) await auditTax(tx, ctx.organizationId, op.kind, String(row.id), op.action, result, ctx, request);
    const output = { [op.result]: result }; stringifyWire(output); return output;
  }, write ? undefined : { isolationLevel: "repeatable read", accessMode: "read only" });
}
