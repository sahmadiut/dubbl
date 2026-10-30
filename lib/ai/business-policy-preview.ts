import { createHash } from "node:crypto";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { approvalWorkflow, approvalWorkflowStep, approvalRequest, approvalAction, member, journalEntry } from "@/lib/db/schema";
import type { AuthContext } from "@/lib/api/auth-context";
import { checkApprovalRequired } from "@/lib/approvals/engine";
import { conditionDto, evaluateConditions, type ApprovalEntity } from "@/lib/approvals/conditions";
import { WireCompatibilityError } from "@/lib/money/wire";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export class PreviewPolicyError extends Error {
  constructor(readonly code: "PREVIEW_POLICY_INVALID" | "PREVIEW_TOO_LARGE") { super(code); }
}
function invalid(): never { throw new PreviewPolicyError("PREVIEW_POLICY_INVALID"); }
function bounded(value: unknown) {
  if (Buffer.byteLength(JSON.stringify(value), "utf8") > 32768) throw new PreviewPolicyError("PREVIEW_TOO_LARGE");
}

/** Observation in the caller's read-only repeatable snapshot. Never submit or
 * act on requests. Legacy requests have no resource/policy digest, so even an
 * approved request cannot satisfy approval of this observed resource revision.
 * No workflow/step/request/member IDs, names or conditions leave this helper.
 */
export function previewJournalBusinessPolicy(tx: Tx, ctx: AuthContext, entry: typeof journalEntry.$inferSelect) {
  return previewBusinessPolicy(tx, ctx, "journal_entry", entry);
}

export async function previewBusinessPolicy(tx: Tx, ctx: AuthContext, entityType: ApprovalEntity, entry: { id: string; organizationId: string; createdBy?: string | null } & Record<string, unknown>) {
  if (entry.organizationId !== ctx.organizationId) invalid();
  const workflows = await tx.select().from(approvalWorkflow).where(and(eq(approvalWorkflow.organizationId, ctx.organizationId),
    eq(approvalWorkflow.entityType, entityType), eq(approvalWorkflow.isActive, true), isNull(approvalWorkflow.deletedAt))).orderBy(asc(approvalWorkflow.id)).limit(21);
  if (workflows.length > 20) throw new PreviewPolicyError("PREVIEW_TOO_LARGE");
  const [request] = await tx.select().from(approvalRequest).where(and(eq(approvalRequest.organizationId, ctx.organizationId),
    eq(approvalRequest.entityType, entityType), eq(approvalRequest.entityId, entry.id))).orderBy(desc(approvalRequest.createdAt), asc(approvalRequest.id)).limit(1);
  // Include the latest request's historical workflow even if now inactive or
  // deleted. Neither a foreign reference nor an old approval is a capability.
  const [historical] = request && !workflows.some(w => w.id === request.workflowId)
    ? await tx.select().from(approvalWorkflow).where(and(eq(approvalWorkflow.id, request.workflowId), eq(approvalWorkflow.organizationId, ctx.organizationId))) : [];
  if (request && !workflows.some(w => w.id === request.workflowId) && !historical) invalid();
  const policies = historical ? [...workflows, historical].sort((a, b) => a.id.localeCompare(b.id)) : workflows;
  const snapshots = [];
  for (const workflow of policies) {
    if (workflow.entityType !== entityType) invalid();
    bounded(workflow);
    const steps = await tx.select().from(approvalWorkflowStep).where(eq(approvalWorkflowStep.workflowId, workflow.id)).orderBy(asc(approvalWorkflowStep.stepOrder), asc(approvalWorkflowStep.id)).limit(101);
    if (steps.length > 100) throw new PreviewPolicyError("PREVIEW_TOO_LARGE");
    if (!steps.length || steps.some((s, i) => !Number.isInteger(s.stepOrder) || s.stepOrder < 1 || s.stepOrder > 2147483647 || (i > 0 && s.stepOrder <= steps[i - 1].stepOrder))) invalid();
    try { conditionDto(entityType, workflow.conditions); }
    catch (err) { if (err instanceof WireCompatibilityError) invalid(); throw err; }
    snapshots.push({ ...workflow, steps });
  }
  const actions = request ? await tx.select().from(approvalAction).where(eq(approvalAction.requestId, request.id)).orderBy(asc(approvalAction.createdAt), asc(approvalAction.id)).limit(101) : [];
  if (actions.length > 100) throw new PreviewPolicyError("PREVIEW_TOO_LARGE");
  const actorIds = [...new Set([...snapshots.flatMap(w => w.steps.map(s => s.approverId)), ...actions.map(a => a.userId), ...(request ? [request.requestedById] : [])])];
  const actors = actorIds.length ? await tx.select({ id: member.id, userId: member.userId }).from(member)
    .where(and(eq(member.organizationId, ctx.organizationId), inArray(member.id, actorIds))).orderBy(asc(member.id)) : [];
  if (actors.length !== actorIds.length) invalid();
  const requestPolicy = request ? snapshots.find(w => w.id === request.workflowId) : undefined;
  if (request && (!requestPolicy?.steps.some(s => s.stepOrder === request.currentStepOrder)
    || actions.some(a => !requestPolicy.steps.some(s => s.id === a.stepId)))) invalid();
  const snapshot = { schemaVersion: 1, organizationId: ctx.organizationId, actor: ctx.userId, workflows: snapshots, request: request ?? null, actions, actors };
  bounded(snapshot);
  let selected;
  try {
    // Existing domain engine owns condition semantics. Multiple matching rules
    // have no stable precedence in that engine; observation fails closed rather
    // than suggesting a policy chosen by incidental SQL row order.
    const matches = workflows.filter(w => evaluateConditions(entityType, w.conditions, entry));
    if (matches.length > 1) invalid();
    selected = await checkApprovalRequired(ctx.organizationId, entityType, entry, tx);
    if ((selected?.id ?? null) !== (matches[0]?.id ?? null)) invalid();
  } catch (err) { if (err instanceof WireCompatibilityError) invalid(); throw err; }
  const requester = actors.find(a => a.id === request?.requestedById)?.userId;
  // All sequential steps are visited by the current engine, including steps
  // whose isRequired flag is false. Do not invent a bypass for those steps.
  const selfAssignment = !!selected?.steps.some(s => {
    const assigned = actors.find(a => a.id === s.approverId)?.userId;
    return assigned === ctx.userId || assigned === entry.createdBy || (request?.workflowId === selected.id && assigned === requester);
  });
  const policyVersion = createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
  return {
    evaluation: "evaluated" as const, activeWorkflowPresent: workflows.length > 0, latestRequestStatus: request?.status ?? null,
    policyVersion, required: !!selected,
    requirement: !selected ? "not_required" as const : selfAssignment ? "policy_repair_required" as const : "resource_bound_approval_required" as const,
    approvalSatisfied: false as const, resourceBoundApproval: false as const, canCurrentActorApprove: false as const,
    nextActors: !selected ? [] : selfAssignment ? ["approval_administrator"] : ["independent_business_approver"],
    blockers: !selected ? [] : [...(selfAssignment ? ["self_approval_assignment"] : []), "approval_resource_binding_missing"],
  };
}
