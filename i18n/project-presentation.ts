import { projectCrmJson } from "@/lib/money/project-crm-ui";

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
