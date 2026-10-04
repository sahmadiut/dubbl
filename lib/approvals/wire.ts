import { z } from "zod";
import { approvalEntity, conditionSchema, parseConditions } from "./conditions";

export const approvalId = z.string().uuid().describe("UUID of an organization-owned approval record");
const step = z.object({
  approverId: approvalId.describe("Organization-owned member UUID; not a user UUID"),
  isRequired: z.boolean().default(true).describe("Stored step flag; existing sequential approval behavior is preserved"),
}).strict();
export const workflowFields = {
  name: z.string().min(1).max(255).describe("Workflow name"),
  entityType: approvalEntity,
  conditions: z.array(conditionSchema).max(100).default([]).describe("AND conditions; empty matches all documents; money thresholds are minor-unit strings"),
  isActive: z.boolean().default(true).describe("Whether new document submissions can select this workflow"),
  steps: z.array(step).min(1).max(100).describe("Ordered approval steps with organization-owned members"),
};
export const workflowCreate = z.object(workflowFields).strict().superRefine((v, ctx) => {
  try { parseConditions(v.entityType, v.conditions); } catch (e) {
    ctx.addIssue({ code: "custom", path: ["conditions"], message: e instanceof Error ? e.message : "Invalid conditions" });
  }
});
export const workflowUpdate = z.object({
  name: workflowFields.name.optional(), entityType: approvalEntity.optional(),
  conditions: z.array(conditionSchema).max(100).optional().describe("Replacement conditions; validated against merged entity type"),
  isActive: z.boolean().optional().describe("New active status"), steps: workflowFields.steps.optional(),
}).strict();
export const actionSchema = z.object({
  action: z.enum(["approve", "reject", "comment"]).describe("Approve/reject the assigned current step or add a comment"),
  comment: z.string().max(4096).optional().describe("Optional comment; invoice rejection still requires a reason"),
}).strict();
export const listFields = {
  entityType: approvalEntity.optional().describe("Optional document type filter"),
  page: z.number().int().min(1).max(21474836).default(1).describe("Page number; positive bounded integer"),
  limit: z.number().int().min(1).max(100).default(50).describe("Records per page, 1 to 100"),
};
export const workflowList = z.object(listFields).strict();
export const requestList = workflowList.extend({
  status: z.enum(["pending", "approved", "rejected", "cancelled"]).optional().describe("Optional request status"),
  approverId: approvalId.optional().describe("Organization-owned member UUID assigned to the current step"),
});
export function approvalQuery(url: URL, requests = false) {
  const input: Record<string, unknown> = {};
  for (const key of ["page", "limit", "entityType", ...(requests ? ["status", "approverId"] : [])]) {
    const value = url.searchParams.get(key);
    if (value !== null) {
      if ((key === "page" || key === "limit") && !/^[1-9]\d{0,8}$/.test(value))
        throw new z.ZodError([{ code: "custom", path: [key], message: `${key} must be a canonical positive integer` }]);
      input[key] = key === "page" || key === "limit" ? Number(value) : value;
    }
  }
  return (requests ? requestList : workflowList).parse(input);
}
export async function approvalJson(request: Request) {
  try { return await request.json(); } catch { throw new z.ZodError([{ code: "custom", path: [], message: "Malformed JSON body" }]); }
}
