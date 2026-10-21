import { projectCrmJson } from "@/lib/money/project-crm-ui";

export const projectRoleKeys = { manager: "manager", contributor: "contributor", viewer: "viewer" } as const;

export interface ProjectTeamAssignment {
  id: string; teamId: string; defaultRole: string;
  team: { id: string; name: string; color: string; members: { id: string; member: { id: string; user: { name: string | null; email: string } } }[] };
}
export interface ProjectOrgTeam { id: string; name: string; color: string }
export interface ProjectOrgMember { id: string; userName: string | null; userEmail: string }

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid project collaboration response");
  return value as Record<string, unknown>;
}
function text(value: unknown): value is string { return typeof value === "string" && value.trim().length > 0; }
async function body(response: Response) {
  if (!response.ok) throw new Error("Project collaboration request failed");
  return record(await projectCrmJson(response));
}
function rows(value: unknown, validate: (row: Record<string, unknown>) => void) {
  if (!Array.isArray(value)) throw new Error("Invalid project collaboration list");
  const ids = new Set<string>();
  for (const item of value) {
    const row = record(item);
    if (!text(row.id) || ids.has(row.id)) throw new Error("Invalid project collaboration identity");
    ids.add(row.id);
    validate(row);
  }
}
function user(value: unknown) {
  const row = record(value);
  if (!text(row.email) || (row.name !== null && typeof row.name !== "string")) throw new Error("Invalid project user");
}

/** Validate complete choice/assignment lists before adoption. No partial or failed reads. */
export async function projectTeamAssignmentsJson(response: Response) {
  const data = await body(response);
  const teams = new Set<string>();
  rows(data.assignments, row => {
    const team = record(row.team);
    if (!text(row.teamId) || teams.has(row.teamId) || team.id !== row.teamId || !text(row.defaultRole) ||
      !text(team.name) || !text(team.color)) throw new Error("Invalid project team assignment");
    teams.add(row.teamId);
    rows(team.members, value => {
      const member = record(value.member);
      if (!text(member.id)) throw new Error("Invalid team member");
      user(member.user);
    });
  });
  return data as typeof data & { assignments: ProjectTeamAssignment[] };
}
export async function projectOrgTeamsJson(response: Response) {
  const data = await body(response);
  rows(data.data, row => { if (!text(row.name) || !text(row.color)) throw new Error("Invalid organization team"); });
  return data as typeof data & { data: ProjectOrgTeam[] };
}
export async function projectOrgMembersJson(response: Response) {
  const data = await body(response);
  const members = data.members ?? data.data;
  rows(members, row => {
    if (!text(row.userEmail) || (row.userName !== null && typeof row.userName !== "string")) throw new Error("Invalid organization member");
  });
  return members as ProjectOrgMember[];
}

/** Existing operation envelopes and optional selected identities must acknowledge a mutation. */
export async function projectCollaborationMutationJson(response: Response, kind: "projectMember" | "assignment" | "note" | "success", expected?: { field: string; id: string }) {
  const data = await body(response);
  if (kind === "success") {
    if (data.success !== true) throw new Error("Invalid project collaboration acknowledgement");
  } else {
    const row = record(data[kind]);
    if (!text(row.id) || (expected && row[expected.field] !== expected.id)) throw new Error("Invalid project collaboration mutation identity");
  }
  return data;
}
