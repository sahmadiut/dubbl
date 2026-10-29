import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { aiConversation, aiRun, aiStep, contact, expenseClaim, journalEntry, type AiRunState } from "@/lib/db/schema";
import { AuthError, type AuthContext } from "@/lib/api/auth-context";
import { authorizeExecution, executionIdentity } from "@/lib/api/execution-identity";
import { hasPermission } from "@/lib/plans";
import { catalogEntry } from "./tool-catalog";

const id = z.string().uuid().describe("Opaque UUID checked against the authenticated run owner and organization.");
export const progressSchema = z.object({
  runId: id,
  expectedVersion: z.number().int().positive().max(2147483647).optional().describe("Observed run version. A changed version conflicts; restart from the first page. Required with afterStepId."),
  afterStepId: id.optional().describe("Last step UUID from this run's previous page; use with that page's expectedVersion. Never an execution key."),
  limit: z.number().int().min(1).max(20).default(10).describe("Maximum ordered step summaries, 1..20. Each exposes at most ten currently accessible record references."),
}).strict().refine(v => !v.afterStepId || v.expectedVersion !== undefined, "Step pagination requires expectedVersion");

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Step = typeof aiStep.$inferSelect;
type RecordReference = { type: "contact" | "journal_entry" | "expense_claim"; id: string; href: string; status?: string; amountMinor?: string; currencyCode?: string };
const terminal = new Set<AiRunState>(["succeeded", "failed", "cancelled", "expired"]);
const stateCodes: Record<AiRunState, string> = {
  queued: "QUEUED", running: "RUNNING", awaiting_input: "INPUT_REQUIRED", awaiting_approval: "APPROVAL_REQUIRED",
  reconciliation_required: "RECONCILIATION_REQUIRED", succeeded: "COMPLETED", failed: "FAILED", cancelled: "STOPPED", expired: "EXPIRED",
};
const stepCodes = { prepared: "PENDING", executing: "IN_PROGRESS", succeeded: "READ_COMPLETED", failed: "ACTION_FAILED", uncertain: "RECONCILIATION_REQUIRED", skipped: "NOT_STARTED" } as const;
const permitted = (ctx: AuthContext, permission: string) => hasPermission(ctx.permissions ?? ctx.role, permission);

/** Only reviewed record types can produce links. Never use a model-supplied URL,
 * arbitrary result text, or a record ID without reloading its current domain scope. */
async function recordReferences(tx: Tx, ctx: AuthContext, step: Step) {
  const records: RecordReference[] = [];
  const ids = [...new Set(step.recordIds)].slice(0, 10);
  for (const recordId of ids) {
    if (!id.safeParse(recordId).success) continue;
    if (step.toolName === "get_contact" || step.toolName === "list_contacts") {
      const [row] = await tx.select({ id: contact.id }).from(contact).where(and(eq(contact.id, recordId), eq(contact.organizationId, ctx.organizationId), isNull(contact.deletedAt)));
      if (row) records.push({ type: "contact", id: row.id, href: `/contacts/${row.id}` });
    } else if (step.toolName === "get_entry" || step.toolName === "list_entries") {
      const [row] = await tx.select({ id: journalEntry.id, status: journalEntry.status }).from(journalEntry).where(and(eq(journalEntry.id, recordId), eq(journalEntry.organizationId, ctx.organizationId), isNull(journalEntry.deletedAt)));
      if (row) records.push({ type: "journal_entry", id: row.id, href: `/accounting/${row.id}`, status: row.status });
    } else if (["get_expense_claim", "list_expense_claims", "create_expense_claim"].includes(step.toolName)) {
      const [row] = await tx.select({ id: expenseClaim.id, status: expenseClaim.status, amountMinor: sql<string>`${expenseClaim.totalAmount}::text`, currencyCode: expenseClaim.currencyCode })
        .from(expenseClaim).where(and(eq(expenseClaim.id, recordId), eq(expenseClaim.organizationId, ctx.organizationId), isNull(expenseClaim.deletedAt)));
      if (row) records.push({ type: "expense_claim", id: row.id, href: `/purchases/expenses/${row.id}`, status: row.status,
        ...(/^(0|[1-9][0-9]{0,18})$/.test(row.amountMinor) && /^[A-Z]{3}$/.test(row.currencyCode) ? { amountMinor: row.amountMinor, currencyCode: row.currencyCode } : {}) });
    }
  }
  return { records, recordsOmitted: records.length !== step.recordIds.length };
}

async function stepSummary(tx: Tx, ctx: AuthContext, step: Step) {
  const entry = catalogEntry(step.toolName);
  const visible = entry && step.requiredPermissions.length > 0 && step.requiredPermissions.every(p => permitted(ctx, p)) && permitted(ctx, entry.permission) && permitted(ctx, "view:data");
  const base = { id: step.id, version: step.version, state: step.state, createdAt: step.createdAt, updatedAt: step.updatedAt };
  if (!visible) return { ...base, action: null, code: "RESULT_RESTRICTED", records: [], recordsOmitted: true };
  // Executing/provisional output is never confirmed. Known references on uncertain
  // effects remain inspectable without claiming that the operation completed.
  const refs = ["succeeded", "uncertain"].includes(step.state) ? await recordReferences(tx, ctx, step) : { records: [], recordsOmitted: step.recordIds.length > 0 };
  const code = step.state === "succeeded" && entry.effect === "draft"
    ? refs.records.length ? "DRAFT_CREATED" : "RESULT_UNAVAILABLE"
    : stepCodes[step.state];
  return { ...base, action: step.toolName, code, ...refs };
}

/** Observation only: no dispatch, maintenance, retry, resume or policy writes.
 * Conversation -> run lock order matches erasure. Step writers lock the run, so
 * each page and its version describe one committed snapshot of execution state. */
export async function getRunProgress(ctx: AuthContext, input: unknown) {
  const value = progressSchema.parse(input), identity = executionIdentity(ctx);
  const current = await authorizeExecution(identity, ctx.organizationId, "view:ai-history");
  return db.transaction(async tx => {
    const scope = and(eq(aiRun.id, value.runId), eq(aiRun.organizationId, current.organizationId), eq(aiRun.ownerId, current.userId));
    const [found] = await tx.select({ conversationId: aiRun.conversationId }).from(aiRun).where(scope);
    if (!found) throw new AuthError("Run not found or expired", 404);
    const [conversation] = await tx.select().from(aiConversation).where(and(eq(aiConversation.id, found.conversationId), eq(aiConversation.organizationId, current.organizationId), eq(aiConversation.ownerId, current.userId))).for("share");
    if (!conversation || conversation.deletedAt || conversation.contentExpiresAt.getTime() <= Date.now()) throw new AuthError("Run not found or expired", 404);
    const [run] = await tx.select().from(aiRun).where(scope).for("share");
    if (!run) throw new AuthError("Run not found or expired", 404);
    // Access can change while this request waits behind a writer or deletion.
    const actor = await authorizeExecution(identity, current.organizationId, "view:ai-history");
    if (value.expectedVersion !== undefined && value.expectedVersion !== run.version) throw new AuthError("Run progress version conflict; restart pagination", 409);
    if (value.afterStepId) {
      const [cursor] = await tx.select({ id: aiStep.id }).from(aiStep).where(and(eq(aiStep.id, value.afterStepId), eq(aiStep.runId, run.id)));
      if (!cursor) throw new AuthError("Invalid run progress cursor", 400);
    }
    const rows = await tx.select().from(aiStep).where(and(eq(aiStep.runId, run.id), value.afterStepId
      ? sql`(${aiStep.createdAt}, ${aiStep.id}) > (select created_at, id from ai_step where id = ${value.afterStepId} and run_id = ${run.id})` : undefined))
      .orderBy(aiStep.createdAt, aiStep.id).limit(value.limit + 1);
    const steps = [];
    for (const step of rows.slice(0, value.limit)) steps.push(await stepSummary(tx, actor, step));
    const hasMore = rows.length > value.limit;
    const states = await tx.select({ state: aiStep.state }).from(aiStep).where(eq(aiStep.runId, run.id));
    const stopped = run.cancelRequestedAt !== null;
    const code = stopped && run.state === "running" ? "STOP_REQUESTED" : stateCodes[run.state];
    return {
      run: { id: run.id, conversationId: run.conversationId, state: run.state, version: run.version, code,
        createdAt: run.createdAt, startedAt: run.startedAt, deadlineAt: run.deadlineAt, finishedAt: run.finishedAt,
        stop: stopped ? run.state === "running" ? "requested" : "acknowledged" : "not_requested" },
      // Computed from live receipts on every read, never from model narration.
      outcome: { code: run.state === "reconciliation_required" ? "RECONCILIATION_REQUIRED"
        : terminal.has(run.state) ? states.some(s => s.state === "succeeded") && run.state !== "succeeded" ? "PARTIAL_COMPLETION"
          : run.state === "succeeded" ? states.length ? "COMPLETED" : "NO_CONFIRMED_ACTION" : stateCodes[run.state] : stateCodes[run.state],
        recordsSource: "live_step_receipts" },
      steps, hasMore, next: hasMore ? { afterStepId: steps.at(-1)!.id, expectedVersion: run.version } : null,
      observation: { persistedOnly: true, workerAvailability: "unknown", pollAfterMs: terminal.has(run.state) ? null : 2000 },
      actions: { canStop: !terminal.has(run.state) && !stopped, canObserve: true, canInspectRecords: steps.some(s => s.records.length > 0), requiresReconciliation: run.state === "reconciliation_required" },
    };
  });
}
