import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { AuthContext } from "@/lib/api/auth-context";
import { wrapTool } from "@/lib/mcp/errors";
import { approvalId, workflowCreate, workflowUpdate, workflowList, requestList, actionSchema } from "@/lib/approvals/wire";
import { listWorkflows, getWorkflow, createWorkflow, updateWorkflow, deleteWorkflow, listApprovalRequests, getApprovalRequest, actApprovalRequest } from "@/lib/approvals/service";
export function registerApprovalTools(server: McpServer, ctx: AuthContext) {
  const units = "Money conditions use document-currency minor units as canonical signed int64 strings: legacy value and additive valueMinor. Text supports eq/neq; integers support eq/neq/gt/lt/gte/lte. No FX conversion or rescaling.";
  server.registerTool("list_approval_workflows", { description: `List live organization workflows with ordered steps; returns workflows, total, page and limit. ${units}`, inputSchema: workflowList },
    args => wrapTool(ctx, () => listWorkflows(ctx, args)));
  server.registerTool("get_approval_workflow", { description: `Get an owned live workflow and steps. ${units}`, inputSchema: z.object({ workflowId: approvalId }).strict() },
    args => wrapTool(ctx, async () => ({ workflow: await getWorkflow(ctx, args.workflowId) })));
  server.registerTool("create_approval_workflow", { description: `Create workflow and ordered steps atomically; approverId is an owned member UUID. Requires manage:bills. Returns workflow. ${units}`, inputSchema: workflowCreate },
    args => wrapTool(ctx, async () => ({ workflow: await createWorkflow(ctx, args) })));
  server.registerTool("update_approval_workflow", { description: `Patch an owned workflow; omitted fields retain values, steps replace all. Type/steps cannot change once referenced by a request. Requires manage:bills. Returns workflow. ${units}`, inputSchema: workflowUpdate.extend({ workflowId: approvalId }).strict() },
    args => wrapTool(ctx, async () => { const { workflowId, ...patch } = args; return { workflow: await updateWorkflow(ctx, workflowId, patch) }; }));
  server.registerTool("delete_approval_workflow", { description: "Soft-delete an owned workflow, preserving existing request history. Requires manage:bills; returns success.", inputSchema: z.object({ workflowId: approvalId }).strict() },
    args => wrapTool(ctx, () => deleteWorkflow(ctx, args.workflowId)));
  server.registerTool("list_approval_requests", { description: `List scoped approval requests, optionally by document type, status or current approver member. Returns requests, total, page and limit, with workflow conditions. ${units}`, inputSchema: requestList },
    args => wrapTool(ctx, () => listApprovalRequests(ctx, args)));
  server.registerTool("get_approval_request", { description: `Get an owned approval request with workflow, ordered steps and actions. ${units}`, inputSchema: z.object({ requestId: approvalId }).strict() },
    args => wrapTool(ctx, async () => ({ request: await getApprovalRequest(ctx, args.requestId) })));
  for (const [name, action, description] of [
    ["approve_request", "approve", "Approve the assigned current step"],
    ["reject_request", "reject", "Reject as the assigned current approver; invoice rejection requires comment as a reason"],
    ["comment_approval_request", "comment", "Add a comment as an organization member without advancing the request"],
  ] as const) server.registerTool(name, {
    description: `${description}. Returns request header. Bill/invoice actions retain document role/period-lock and lifecycle checks; other types change approval metadata only.`,
    inputSchema: z.object({ requestId: approvalId, comment: actionSchema.shape.comment }).strict(),
  }, args => wrapTool(ctx, async () => ({ request: await actApprovalRequest(ctx, args.requestId, { action, comment: args.comment }) })));
}
