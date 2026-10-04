import { db } from "@/lib/db";
import { approvalWorkflow, approvalWorkflowStep, approvalRequest, approvalAction, member, bill, invoice, expenseClaim, journalEntry, purchaseOrder } from "@/lib/db/schema";
import { eq, and, asc, isNull } from "drizzle-orm";
import { AuthError, type AuthContext } from "@/lib/api/auth-context";
import { WireCompatibilityError, stringifyWire } from "@/lib/money/wire";
import { conditionDto, evaluateConditions, type ApprovalEntity } from "./conditions";
import { approvalId, actionSchema } from "./wire";
import { lockApprovalOrganization, auditApproval, approvalMembers, type ApprovalTx } from "./transaction";

/** Optional transaction keeps selection and submission in the same document transaction. */
export async function checkApprovalRequired(orgId: string, entityType: ApprovalEntity, entity: Record<string, unknown>, tx: ApprovalTx | typeof db = db) {
  const workflows = await tx.query.approvalWorkflow.findMany({
    where: and(eq(approvalWorkflow.organizationId, orgId), eq(approvalWorkflow.entityType, entityType), eq(approvalWorkflow.isActive, true), isNull(approvalWorkflow.deletedAt)),
    with: { steps: { orderBy: asc(approvalWorkflowStep.stepOrder) } },
  });
  // Fail closed on invalid saved conditions even if an earlier workflow matches.
  for (const workflow of workflows) conditionDto(entityType, workflow.conditions);
  for (const workflow of workflows) {
    if (!evaluateConditions(entityType, workflow.conditions, entity)) continue;
    if (!workflow.steps.length || workflow.steps.some((s, i) => !Number.isInteger(s.stepOrder) || s.stepOrder < 1 || s.stepOrder > 2147483647 || (i > 0 && s.stepOrder <= workflow.steps[i - 1].stepOrder))) throw new WireCompatibilityError("Invalid approval workflow steps");
    const ids = [...new Set(workflow.steps.map(s => s.approverId))];
    const members = await tx.query.member.findMany({ where: eq(member.organizationId, orgId) });
    if (ids.some(id => !members.some(m => m.id === id))) throw new WireCompatibilityError("Approval step belongs to another organization");
    return workflow;
  }
  return null;
}

export async function ownedApprovalEntity(tx: ApprovalTx, orgId: string, entityType: ApprovalEntity, id: string, lock = false) {
  const table = { bill, invoice, expense: expenseClaim, journal_entry: journalEntry, purchase_order: purchaseOrder }[entityType];
  // Historical request reads keep soft-deleted document references; new requests/actions require live documents.
  const query = tx.select({ id: table.id }).from(table).where(and(eq(table.id, id), eq(table.organizationId, orgId), lock ? isNull(table.deletedAt) : undefined));
  const [row] = await (lock ? query.for("share") : query);
  if (!row) throw new AuthError("Approval document not found", 404);
}

/** Retained internal helper; all references must be organization-owned. */
export async function createApprovalRequest(orgId: string, workflowId: string, entityType: ApprovalEntity, entityId: string, requestedById: string) {
  [workflowId, entityId, requestedById].forEach(id => approvalId.parse(id));
  return db.transaction(async tx => {
    await lockApprovalOrganization(tx, orgId);
    const workflow = await tx.query.approvalWorkflow.findFirst({ where: and(eq(approvalWorkflow.id, workflowId), eq(approvalWorkflow.organizationId, orgId),
      eq(approvalWorkflow.entityType, entityType), eq(approvalWorkflow.isActive, true), isNull(approvalWorkflow.deletedAt)), with: { steps: { orderBy: asc(approvalWorkflowStep.stepOrder) } } });
    if (!workflow) throw new AuthError("Approval workflow not found", 404);
    conditionDto(entityType, workflow.conditions);
    if (!workflow.steps.length || workflow.steps.some((s, i) => !Number.isInteger(s.stepOrder) || s.stepOrder < 1 || s.stepOrder > 2147483647 || (i > 0 && s.stepOrder <= workflow.steps[i - 1].stepOrder))) throw new WireCompatibilityError("Invalid approval steps");
    await approvalMembers(tx, orgId, [requestedById, ...workflow.steps.map(s => s.approverId)]); await ownedApprovalEntity(tx, orgId, entityType, entityId, true);
    const [request] = await tx.insert(approvalRequest).values({ organizationId: orgId, workflowId, entityType, entityId, requestedById, currentStepOrder: 1 }).returning();
    const requester = (await tx.query.member.findFirst({ where: eq(member.id, requestedById) }))!;
    stringifyWire(request);
    await auditApproval(tx, { organizationId: orgId, userId: requester.userId, role: requester.role }, "approval_request", request.id, "create", { after: request });
    return request;
  });
}

/** Generic metadata actions. Bill/invoice callers must use their document lifecycle services. */
export async function processApprovalAction(ctx: AuthContext, requestId: string, action: "approve" | "reject" | "comment", comment?: string, httpRequest?: Request) {
  approvalId.parse(requestId); actionSchema.parse({ action, comment });
  return db.transaction(async tx => {
    await lockApprovalOrganization(tx, ctx.organizationId);
    const [request] = await tx.select().from(approvalRequest).where(and(eq(approvalRequest.id, requestId), eq(approvalRequest.organizationId, ctx.organizationId))).for("update");
    if (!request) throw new AuthError("Approval request not found", 404);
    if (request.entityType === "bill" || request.entityType === "invoice") throw new AuthError("Document lifecycle approval is required", 422);
    if (request.status !== "pending") throw new AuthError("Approval request is no longer pending", 422);
    const workflow = await tx.query.approvalWorkflow.findFirst({ where: and(eq(approvalWorkflow.id, request.workflowId), eq(approvalWorkflow.organizationId, ctx.organizationId)),
      with: { steps: { orderBy: asc(approvalWorkflowStep.stepOrder) } } });
    if (!workflow || workflow.entityType !== request.entityType) throw new WireCompatibilityError("Invalid approval workflow reference");
    conditionDto(workflow.entityType, workflow.conditions);
    if (!workflow.steps.length || workflow.steps.some((s, i) => !Number.isInteger(s.stepOrder) || s.stepOrder < 1 || s.stepOrder > 2147483647 || (i > 0 && s.stepOrder <= workflow.steps[i - 1].stepOrder))) throw new WireCompatibilityError("Invalid approval steps");
    await approvalMembers(tx, ctx.organizationId, [request.requestedById, ...workflow.steps.map(s => s.approverId)]);
    await ownedApprovalEntity(tx, ctx.organizationId, request.entityType, request.entityId, true);
    const actor = await tx.query.member.findFirst({ where: and(eq(member.organizationId, ctx.organizationId), eq(member.userId, ctx.userId)) });
    if (!actor) throw new AuthError("Member not found", 403);
    const step = workflow.steps.find(s => s.stepOrder === request.currentStepOrder);
    if (!step) throw new WireCompatibilityError("Current workflow step not found");
    if (action !== "comment" && step.approverId !== actor.id) throw new AuthError("You are not the approver for the current step", 403);
    await tx.insert(approvalAction).values({ requestId, stepId: step.id, userId: actor.id, action, comment: comment ?? null });
    let result = request;
    if (action !== "comment") {
      const next = workflow.steps.find(s => s.stepOrder > step.stepOrder);
      [result] = await tx.update(approvalRequest).set({ status: action === "reject" ? "rejected" : next ? "pending" : "approved",
        currentStepOrder: action === "approve" && next ? next.stepOrder : request.currentStepOrder, updatedAt: new Date() }).where(eq(approvalRequest.id, requestId)).returning();
    }
    stringifyWire(result);
    await auditApproval(tx, ctx, "approval_request", requestId, action, { before: request, after: result, comment: comment ?? null }, httpRequest); return result;
  });
}
