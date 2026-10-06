import { z } from "zod";
import { projectIdSchema as id, projectSchemas as s } from "./project-master-wire";

const root = { projectId: id.describe("Live project UUID in the authenticated organization") };
const task = { ...root, taskId: id.describe("Task UUID belonging to this project") };
const milestone = { ...root, milestoneId: id.describe("Milestone UUID belonging to this project") };
const empty = z.object({}).strict();
function operation(name: string, kind: string, action: string, path: string, method: string,
  schema: z.ZodObject, result: string, queryId?: string) {
  return { name, kind, action, path, method, schema, result, queryId,
    description: `${action} ${kind} for the authenticated organization. ${kind === "assignment" && action === "update" ? "Marks isPaid metadata only; no funds, payroll or ledger posting. " : ""}${kind === "timer" && action === "create" ? "Replaces this user's existing timer in the project, discarding its elapsed time; this is not a save-time operation. " : ""}${kind === "timer" && action === "delete" ? "Discards this user's timer without saving a time entry. " : ""}Money inputs and numeric results are integer cents with additive canonical *Minor strings (safe range 0..9007199254740991); hourlyRate and costRate are cents per hour. Minutes/seconds are whole physical int32 quantities and progress is integer percent. Returns ${result || "a paginated data envelope"}. References must belong to this organization and project; writes validate and audit atomically.` };
}
export const projectOperations = [
  operation("list_projects", "project", "list", "", "GET", s.projectList, ""),
  operation("create_project", "project", "create", "", "POST", s.projectCreate, "project"),
  operation("get_project", "project", "get", "/[id]", "GET", empty.extend(root), "project"),
  operation("update_project", "project", "update", "/[id]", "PATCH", s.projectUpdate.extend(root), "project"),
  operation("delete_project", "project", "delete", "/[id]", "DELETE", empty.extend(root), "success"),
  operation("list_project_members", "member", "list", "/[id]/members", "GET", empty.extend(root), "members"),
  operation("add_project_member", "member", "create", "/[id]/members", "POST", s.memberCreate.extend(root), "projectMember"),
  operation("update_project_member", "member", "update", "/[id]/members", "PATCH", s.memberUpdate.extend(root), "projectMember"),
  operation("remove_project_member", "member", "delete", "/[id]/members", "DELETE", empty.extend({ ...root, memberId: id.describe("Organization member UUID to remove") }), "success", "memberId"),
  operation("list_project_time_entries", "time", "list", "/[id]/time-entries", "GET", s.page.extend(root), ""),
  operation("create_project_time_entry", "time", "create", "/[id]/time-entries", "POST", s.timeCreate.extend(root), "timeEntry"),
  operation("get_project_time_entry", "time", "get", "/[id]/time-entries/[entryId]", "GET", empty.extend({ ...root, entryId: id.describe("Time entry UUID from this project") }), "timeEntry"),
  operation("update_project_time_entry", "time", "update", "/[id]/time-entries/[entryId]", "PATCH", s.timeUpdate.extend({ ...root, entryId: id.describe("Time entry UUID from this project") }), "timeEntry"),
  operation("delete_project_time_entry", "time", "delete", "/[id]/time-entries/[entryId]", "DELETE", empty.extend({ ...root, entryId: id.describe("Time entry UUID from this project") }), "success"),
  operation("get_project_timer", "timer", "get", "/[id]/timer", "GET", empty.extend(root), "timer"),
  operation("start_project_timer", "timer", "create", "/[id]/timer", "POST", s.timerCreate.extend(root), "timer"),
  operation("update_project_timer", "timer", "update", "/[id]/timer", "PATCH", s.timerUpdate.extend(root), "timer"),
  operation("discard_project_timer", "timer", "delete", "/[id]/timer", "DELETE", empty.extend(root), "success"),
  operation("list_project_milestones", "milestone", "list", "/[id]/milestones", "GET", empty.extend(root), "milestones"),
  operation("create_project_milestone", "milestone", "create", "/[id]/milestones", "POST", s.milestoneCreate.extend(root), "milestone"),
  operation("update_project_milestone", "milestone", "update", "/[id]/milestones/[milestoneId]", "PATCH", s.milestoneUpdate.extend(milestone), "milestone"),
  operation("delete_project_milestone", "milestone", "delete", "/[id]/milestones/[milestoneId]", "DELETE", empty.extend(milestone), "success"),
  operation("list_project_milestone_assignments", "assignment", "list", "/[id]/milestones/[milestoneId]/assignments", "GET", empty.extend(milestone), "assignments"),
  operation("create_project_milestone_assignment", "assignment", "create", "/[id]/milestones/[milestoneId]/assignments", "POST", s.assignmentCreate.extend(milestone), "assignment"),
  operation("mark_project_milestone_assignment_paid", "assignment", "update", "/[id]/milestones/[milestoneId]/assignments", "PATCH", empty.extend({ ...milestone, assignmentId: id.describe("Assignment UUID from this milestone; marks metadata only, does not transfer funds") }), "assignment", "assignmentId"),
  operation("list_project_tasks", "task", "list", "/[id]/tasks", "GET", empty.extend(root), "tasks"),
  operation("create_project_task", "task", "create", "/[id]/tasks", "POST", s.taskCreate.extend(root), "task"),
  operation("update_project_task", "task", "update", "/[id]/tasks/[taskId]", "PATCH", s.taskUpdate.extend(task), "task"),
  operation("delete_project_task", "task", "delete", "/[id]/tasks/[taskId]", "DELETE", empty.extend(task), "success"),
  operation("list_project_task_checklist", "checklist", "list", "/[id]/tasks/[taskId]/checklist", "GET", empty.extend(task), "items"),
  operation("create_project_task_checklist_item", "checklist", "create", "/[id]/tasks/[taskId]/checklist", "POST", s.checklistCreate.extend(task), "item"),
  operation("update_project_task_checklist", "checklist", "update", "/[id]/tasks/[taskId]/checklist", "PATCH", s.checklistUpdate.extend(task), "success"),
  operation("delete_project_task_checklist_item", "checklist", "delete", "/[id]/tasks/[taskId]/checklist", "DELETE", empty.extend({ ...task, itemId: id.describe("Checklist item UUID from this task") }), "success", "itemId"),
  operation("list_project_task_comments", "comment", "list", "/[id]/tasks/[taskId]/comments", "GET", empty.extend(task), "comments"),
  operation("create_project_task_comment", "comment", "create", "/[id]/tasks/[taskId]/comments", "POST", s.commentCreate.extend(task), "comment"),
  operation("delete_project_task_comment", "comment", "delete", "/[id]/tasks/[taskId]/comments", "DELETE", empty.extend({ ...task, commentId: id.describe("Own comment UUID from this task") }), "success", "commentId"),
  operation("list_project_labels", "label", "list", "/[id]/labels", "GET", empty.extend(root), "labels"),
  operation("create_project_label", "label", "create", "/[id]/labels", "POST", s.labelCreate.extend(root), "label"),
  operation("delete_project_label", "label", "delete", "/[id]/labels", "DELETE", empty.extend({ ...root, labelId: id.describe("Label UUID from this project") }), "success", "labelId"),
  operation("list_project_notes", "note", "list", "/[id]/notes", "GET", empty.extend(root), "notes"),
  operation("create_project_note", "note", "create", "/[id]/notes", "POST", s.noteCreate.extend(root), "note"),
  operation("update_project_note", "note", "update", "/[id]/notes", "PATCH", s.noteUpdate.extend({ ...root, noteId: id.describe("Note UUID from this project") }), "note", "noteId"),
  operation("delete_project_note", "note", "delete", "/[id]/notes", "DELETE", empty.extend({ ...root, noteId: id.describe("Note UUID from this project") }), "success", "noteId"),
  operation("list_project_teams", "team", "list", "/[id]/teams", "GET", empty.extend(root), "teams"),
  operation("create_project_team", "team", "create", "/[id]/teams", "POST", s.teamCreate.extend(root), "team"),
  operation("list_project_team_assignments", "teamAssignment", "list", "/[id]/team-assignments", "GET", empty.extend(root), "assignments"),
  operation("assign_project_team", "teamAssignment", "create", "/[id]/team-assignments", "POST", s.teamAssignmentCreate.extend(root), "assignment"),
  operation("unassign_project_team", "teamAssignment", "delete", "/[id]/team-assignments", "DELETE", empty.extend({ ...root, teamId: id.describe("Organization team UUID assigned to this project") }), "success", "teamId"),
] as const;
