import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { approvalWorkflow, approvalWorkflowStep, approvalRequest, approvalAction, member } from "@/lib/db/schema";
import { AuthError, type AuthContext } from "@/lib/api/auth-context";
import { requireRole } from "@/lib/api/require-role";
import { WireCompatibilityError, stringifyWire } from "@/lib/money/wire";
import { conditionDto, parseConditions } from "./conditions";
import { approvalId, workflowCreate, workflowUpdate, workflowList, requestList, actionSchema } from "./wire";
import { billApprovalRequestAction } from "@/lib/api/bill-lifecycle";
import { invoiceApprovalRequestAction } from "@/lib/api/invoice-lifecycle";
import { processApprovalAction, ownedApprovalEntity } from "./engine";
import { lockApprovalOrganization, auditApproval, approvalMembers, type ApprovalTx } from "./transaction";

const userColumns = { id: true, name: true, email: true, image: true } as const;
const stepsWith = { orderBy: asc(approvalWorkflowStep.stepOrder), with: { approver: { with: { user: { columns: userColumns } } } } } as const;
const workflowWith = { steps: stepsWith } as const;
const requestWith = {
  workflow: { with: workflowWith }, requestedBy: { with: { user: { columns: userColumns } } },
  actions: { orderBy: asc(approvalAction.createdAt), with: { user: { with: { user: { columns: userColumns } } }, step: true } },
} as const;
const workflowScope = (ctx: AuthContext, id?: string) => and(eq(approvalWorkflow.organizationId, ctx.organizationId), isNull(approvalWorkflow.deletedAt), id ? eq(approvalWorkflow.id, id) : undefined);
type Workflow = NonNullable<Awaited<ReturnType<typeof readWorkflow>>>;
async function readWorkflow(tx: ApprovalTx, ctx: AuthContext, id: string) {
  return tx.query.approvalWorkflow.findFirst({ where: workflowScope(ctx, id), with: workflowWith });
}
function workflowDto(ctx: AuthContext, row: Workflow) {
  if (row.organizationId !== ctx.organizationId || !row.steps.length || row.steps.some((s, i) => !Number.isInteger(s.stepOrder) || s.stepOrder < 1 || s.stepOrder > 2147483647 || (i > 0 && s.stepOrder <= row.steps[i - 1].stepOrder) || s.approver?.organizationId !== ctx.organizationId))
    throw new WireCompatibilityError("Saved approval workflow steps are invalid or cross-organization");
  const result = { ...row, conditions: conditionDto(row.entityType, row.conditions) }; stringifyWire(result); return result;
}
async function readRequest(tx: ApprovalTx, ctx: AuthContext, id: string) {
  return tx.query.approvalRequest.findFirst({ where: and(eq(approvalRequest.id, id), eq(approvalRequest.organizationId, ctx.organizationId)), with: requestWith });
}
type RequestRow = NonNullable<Awaited<ReturnType<typeof readRequest>>>;
function requestDto(ctx: AuthContext, row: RequestRow) {
  const workflow = workflowDto(ctx, row.workflow);
  if (row.requestedBy?.organizationId !== ctx.organizationId || row.entityType !== workflow.entityType
    || !workflow.steps.some(s => s.stepOrder === row.currentStepOrder)
    || row.actions.some(a => a.user?.organizationId !== ctx.organizationId || a.step?.workflowId !== workflow.id))
    throw new WireCompatibilityError("Saved approval request references are invalid or cross-organization");
  const result = { ...row, workflow }; stringifyWire(result); return result;
}
export async function getWorkflow(ctx: AuthContext, id: string) {
  approvalId.parse(id);
  return db.transaction(async tx => { const row = await readWorkflow(tx, ctx, id); if (!row) throw new AuthError("Approval workflow not found", 404); return workflowDto(ctx, row); }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
export async function listWorkflows(ctx: AuthContext, input: unknown) {
  const p = workflowList.parse(input);
  return db.transaction(async tx => {
    const where = and(workflowScope(ctx), p.entityType ? eq(approvalWorkflow.entityType, p.entityType) : undefined);
    const rows = await tx.query.approvalWorkflow.findMany({ where, with: workflowWith, orderBy: desc(approvalWorkflow.createdAt), limit: p.limit, offset: (p.page - 1) * p.limit });
    const [count] = await tx.select({ total: sql<number>`count(*)`.mapWith(Number) }).from(approvalWorkflow).where(where);
    return { workflows: rows.map(row => workflowDto(ctx, row)), total: count.total, page: p.page, limit: p.limit };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
export async function createWorkflow(ctx: AuthContext, input: unknown, request?: Request) {
  requireRole(ctx, "manage:bills"); const p = workflowCreate.parse(input);
  return db.transaction(async tx => {
    await lockApprovalOrganization(tx, ctx.organizationId); await approvalMembers(tx, ctx.organizationId, p.steps.map(s => s.approverId));
    const [row] = await tx.insert(approvalWorkflow).values({ organizationId: ctx.organizationId, name: p.name, entityType: p.entityType,
      conditions: parseConditions(p.entityType, p.conditions), isActive: p.isActive }).returning();
    await tx.insert(approvalWorkflowStep).values(p.steps.map((s, i) => ({ ...s, workflowId: row.id, stepOrder: i + 1 })));
    const result = workflowDto(ctx, (await readWorkflow(tx, ctx, row.id))!);
    await auditApproval(tx, ctx, "approval_workflow", row.id, "create", { after: result }, request); return result;
  });
}
export async function updateWorkflow(ctx: AuthContext, id: string, input: unknown, request?: Request) {
  requireRole(ctx, "manage:bills"); approvalId.parse(id); const p = workflowUpdate.parse(input);
  return db.transaction(async tx => {
    await lockApprovalOrganization(tx, ctx.organizationId);
    const old = await readWorkflow(tx, ctx, id); if (!old) throw new AuthError("Approval workflow not found", 404);
    const entityType = p.entityType ?? old.entityType;
    let conditions;
    if (p.conditions === undefined) { conditionDto(old.entityType, old.conditions); }
    try { conditions = parseConditions(entityType, p.conditions ?? old.conditions); } catch (e) {
      throw new z.ZodError([{ code: "custom", path: ["conditions"], message: e instanceof Error ? e.message : "Invalid conditions" }]);
    }
    await approvalMembers(tx, ctx.organizationId, (p.steps ?? old.steps).map(s => s.approverId));
    const replaceSteps = p.steps !== undefined && (p.steps.length !== old.steps.length
      || p.steps.some((s, i) => s.approverId !== old.steps[i].approverId || s.isRequired !== old.steps[i].isRequired));
    if (replaceSteps || entityType !== old.entityType) {
      const used = await tx.query.approvalRequest.findFirst({ where: eq(approvalRequest.workflowId, id) });
      if (used) throw new AuthError("Workflow type and steps cannot change after a request references them", 422);
    }
    const { steps, ...fields } = p;
    await tx.update(approvalWorkflow).set({ ...fields, entityType, conditions, updatedAt: new Date() }).where(workflowScope(ctx, id));
    if (steps && replaceSteps) {
      await tx.delete(approvalWorkflowStep).where(eq(approvalWorkflowStep.workflowId, id));
      await tx.insert(approvalWorkflowStep).values(steps.map((s, i) => ({ ...s, workflowId: id, stepOrder: i + 1 })));
    }
    const result = workflowDto(ctx, (await readWorkflow(tx, ctx, id))!);
    await auditApproval(tx, ctx, "approval_workflow", id, "update", { before: old, after: result }, request); return result;
  });
}
export async function deleteWorkflow(ctx: AuthContext, id: string, request?: Request) {
  requireRole(ctx, "manage:bills"); approvalId.parse(id);
  return db.transaction(async tx => {
    await lockApprovalOrganization(tx, ctx.organizationId);
    const old = await readWorkflow(tx, ctx, id); if (!old) throw new AuthError("Approval workflow not found", 404);
    const before = workflowDto(ctx, old);
    await tx.update(approvalWorkflow).set({ deletedAt: new Date(), updatedAt: new Date() }).where(workflowScope(ctx, id));
    await auditApproval(tx, ctx, "approval_workflow", id, "delete", { before }, request); return { success: true };
  });
}
export async function getApprovalRequest(ctx: AuthContext, id: string) {
  approvalId.parse(id);
  return db.transaction(async tx => {
    const row = await readRequest(tx, ctx, id); if (!row) throw new AuthError("Approval request not found", 404);
    await ownedApprovalEntity(tx, ctx.organizationId, row.entityType, row.entityId); return requestDto(ctx, row);
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
export async function listApprovalRequests(ctx: AuthContext, input: unknown) {
  const p = requestList.parse(input);
  return db.transaction(async tx => {
    if (p.approverId) {
      const mem = await tx.query.member.findFirst({ where: and(eq(member.id, p.approverId), eq(member.organizationId, ctx.organizationId)) });
      if (!mem) throw new AuthError("Approver member not found", 404);
    }
    const where = and(eq(approvalRequest.organizationId, ctx.organizationId), p.entityType ? eq(approvalRequest.entityType, p.entityType) : undefined,
      p.status ? eq(approvalRequest.status, p.status) : undefined, p.approverId ? sql`exists (select 1 from approval_workflow_step s where s.workflow_id = ${approvalRequest.workflowId} and s.step_order = ${approvalRequest.currentStepOrder} and s.approver_id = ${p.approverId})` : undefined);
    const rows = await tx.query.approvalRequest.findMany({ where, with: requestWith, orderBy: desc(approvalRequest.createdAt), limit: p.limit, offset: (p.page - 1) * p.limit });
    const [count] = await tx.select({ total: sql<number>`count(*)`.mapWith(Number) }).from(approvalRequest).where(where);
    for (const row of rows) await ownedApprovalEntity(tx, ctx.organizationId, row.entityType, row.entityId);
    return { requests: rows.map(row => requestDto(ctx, row)), total: count.total, page: p.page, limit: p.limit };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
export async function actApprovalRequest(ctx: AuthContext, id: string, input: unknown, request?: Request) {
  approvalId.parse(id); const p = actionSchema.parse(input);
  // Qualify nested saved payloads before the already-adopted document lifecycle delegates mutate.
  await getApprovalRequest(ctx, id);
  const invoiceResult = await invoiceApprovalRequestAction(ctx, id, p.action, p.comment, request);
  if (invoiceResult) return invoiceResult.request;
  const billResult = await billApprovalRequestAction(ctx, id, p.action, p.comment, request);
  if (billResult) return billResult.request;
  return processApprovalAction(ctx, id, p.action, p.comment, request);
}
