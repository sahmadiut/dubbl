import { projectCrmJson } from "@/lib/money/project-crm-ui";
import { dateOnlyToDate } from "./dates";
import type { ProjectDetail } from "@/app/(dashboard)/projects/[id]/project-context";

export const projectStatusKeys = {
  active: "active", completed: "completed", on_hold: "onHold", cancelled: "cancelled", archived: "archived",
} as const;
export const projectPriorityKeys = { low: "low", medium: "medium", high: "high", urgent: "urgent" } as const;

export interface ProjectListRow {
  id: string; name: string; status: string; priority: string; billingType: string;
  color: string; currency: string; budget: number; hourlyRate: number; totalBilled: number;
  totalHours: number; estimatedHours: number; contact: { name: string } | null;
  members: { id: string; member: { id: string; user: { name: string | null; email: string } } }[];
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid project response");
  return value as Record<string, unknown>;
}
function text(value: unknown) { return typeof value === "string" && value.trim().length > 0; }

/** Keep server diagnostics private and validate the data used by this presentation slice.
 * Existing projectCrmJson checks saved cents/Minor pairs without changing units.
 */
export async function projectListJson(response: Response) {
  if (!response.ok) throw new Error("Project read failed");
  const body = record(await projectCrmJson(response));
  return projectListRows(body);
}

function projectListRows(body: Record<string, unknown>) {
  if (!Array.isArray(body.data)) throw new Error("Invalid project list");
  const ids = new Set<string>();
  for (const value of body.data) {
    const row = record(value);
    if (!text(row.id) || ids.has(row.id as string) || !text(row.name) || !text(row.color) ||
      !Object.hasOwn(projectStatusKeys, String(row.status)) || !Object.hasOwn(projectPriorityKeys, String(row.priority)) ||
      !["hourly", "fixed", "milestone", "non_billable"].includes(String(row.billingType))) throw new Error("Invalid project row");
    ids.add(row.id as string);
    for (const field of ["totalHours", "estimatedHours"]) if (!Number.isInteger(row[field]) || (row[field] as number) < 0 || (row[field] as number) > 2147483647) throw new Error("Invalid project minutes");
    if (row.contact !== null && !text(record(row.contact).name)) throw new Error("Invalid project contact");
    if (!Array.isArray(row.members)) throw new Error("Invalid project members");
    for (const value of row.members) {
      const member = record(value), linked = record(member.member), user = record(linked.user);
      if (!text(member.id) || !text(linked.id) || !text(user.email) || (user.name !== null && typeof user.name !== "string")) throw new Error("Invalid project member");
    }
  }
  return body as typeof body & { data: ProjectListRow[] };
}

/** Create/PATCH return a project; DELETE returns success. Never navigate on a failed envelope. */
export async function projectMutationJson(response: Response, kind: "project" | "delete" = "project") {
  if (!response.ok) throw new Error("Project mutation failed");
  const body = record(await projectCrmJson(response));
  if (kind === "delete") {
    if (body.success !== true) throw new Error("Invalid project deletion response");
  } else if (!text(record(body.project).id)) throw new Error("Invalid project mutation response");
  return body as typeof body & { project: { id: string } };
}

/** Detail is adopted atomically, with the expected route identity and rendered joins. */
export async function projectDetailJson(response: Response, expectedId: string) {
  if (!response.ok) throw new Error("Project read failed");
  const body = record(await projectCrmJson(response));
  const row = record(body.project);
  if (row.id !== expectedId) throw new Error("Invalid project identity");
  projectListRows({ data: [row] });
  for (const field of ["description", "category", "contactId"]) if (row[field] !== null && typeof row[field] !== "string") throw new Error("Invalid project text");
  for (const field of ["tasks", "milestones", "notes", "timeEntries", "teams", "labels", "runningTimers", "tags"]) {
    if (!Array.isArray(row[field])) throw new Error("Invalid project collection");
  }
  for (const field of ["enableTasks", "enableTimeTracking", "enableMilestones", "enableNotes", "enableBilling"]) {
    if (typeof row[field] !== "boolean") throw new Error("Invalid project flag");
  }
  for (const field of ["startDate", "endDate"]) validDate(row[field]);
  if ((row.tags as unknown[]).some(v => typeof v !== "string")) throw new Error("Invalid project tags");
  for (const value of row.tasks as unknown[]) {
    const task = record(value);
    if (!text(task.id) || typeof task.title !== "string" || !["backlog", "todo", "in_progress", "in_review", "done", "cancelled"].includes(String(task.status)) || !Object.hasOwn(projectPriorityKeys, String(task.priority))) throw new Error("Invalid project task");
    validDate(task.dueDate);
  }
  for (const value of row.milestones as unknown[]) {
    const milestone = record(value);
    if (!text(milestone.id) || typeof milestone.title !== "string" || typeof milestone.status !== "string" || !Number.isSafeInteger(milestone.amount)) throw new Error("Invalid project milestone");
    validDate(milestone.dueDate);
  }
  for (const value of row.notes as unknown[]) {
    const note = record(value);
    if (!text(note.id) || typeof note.content !== "string" || typeof note.isPinned !== "boolean") throw new Error("Invalid project note");
  }
  for (const value of row.timeEntries as unknown[]) {
    const entry = record(value);
    if (!text(entry.id) || !Number.isInteger(entry.minutes) || (entry.minutes as number) < 0 || (entry.minutes as number) > 2147483647 || typeof entry.isBillable !== "boolean" || !Number.isSafeInteger(entry.hourlyRate)) throw new Error("Invalid project time");
    validDate(entry.date, false);
    for (const field of ["description", "invoiceId"]) if (entry[field] !== null && typeof entry[field] !== "string") throw new Error("Invalid project time text");
    if (entry.user !== null) {
      const user = record(entry.user);
      if (user.name !== null && typeof user.name !== "string") throw new Error("Invalid time user");
    }
  }
  return body as typeof body & { project: ProjectDetail };
}

function validDate(value: unknown, nullable = true) {
  if (nullable && value === null) return;
  if (typeof value !== "string" || !dateOnlyToDate(value)) throw new Error("Invalid project date");
}

export async function projectInvoiceJson(response: Response) {
  if (!response.ok) throw new Error("Project invoice failed");
  const body = record(await projectCrmJson(response));
  if (!text(record(body.invoice).id)) throw new Error("Invalid project invoice");
  return body as typeof body & { invoice: { id: string } };
}
