import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { aiConversation, aiEvent, aiProviderAttempt, aiRun, aiStep, contact, expenseClaim, journalEntry, type AiRunState } from "@/lib/db/schema";
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

export const observationSchema = z.object({
  runId: id,
  after: z.number().int().min(0).max(2147483647).default(0).describe("Last observed execution version, or zero on first read/cursor loss. Always replace the display with the returned snapshot: permissions and records can change without a new execution version. Never an execution or retry key."),
}).strict();

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
async function readRunProgress(ctx: AuthContext, value: z.infer<typeof progressSchema>, after?: number) {
  const identity = executionIdentity(ctx);
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
    const hasMore = rows.length > value.limit;
    const states = await tx.select({ state: aiStep.state }).from(aiStep).where(eq(aiStep.runId, run.id)).limit(21);
    if (states.length > 20) throw new AuthError("Run step limit exceeded", 413);
    const stopped = run.cancelRequestedAt !== null;
    const code = stopped && run.state === "running" ? "STOP_REQUESTED" : stateCodes[run.state];
    // Only finite server-authored milestones cross this boundary. Provider text,
    // even a validated final answer, is neither safe display data nor a receipt.
    // Select no request/response blobs, tool arguments, keys, leases or digests.
    const [attempt] = after === undefined ? [] : await tx.select({ state: aiProviderAttempt.state })
      .from(aiProviderAttempt).where(eq(aiProviderAttempt.runId, run.id)).orderBy(desc(aiProviderAttempt.ordinal)).limit(1);
    const delayed = run.state === "running" && (!run.leaseExpiresAt || run.leaseExpiresAt.getTime() <= Date.now() || !run.deadlineAt || run.deadlineAt.getTime() <= Date.now());
    const provisionalCode = stopped && run.state === "running" ? "STOP_REQUESTED" : delayed ? "OBSERVATION_DELAYED" : run.state === "queued" ? "WAITING_FOR_EXECUTION"
      : run.state === "running" ? attempt?.state === "dispatched" ? "WAITING_FOR_RESPONSE" : attempt?.state === "reserved" ? "PREPARING_RESPONSE" : "PROCESSING"
      : "NO_PROVISIONAL_CONTENT";
    const [cursor] = !after ? [] : await tx.select({ sequence: aiEvent.sequence }).from(aiEvent)
      .where(and(eq(aiEvent.runId, run.id), eq(aiEvent.sequence, after))).limit(1);
    const cursorReset = !!after && (after > run.version || !cursor);
    // Expiry and grants can change during asynchronous reads. Discard the
    // entire response on a late authority change; clients fetch a fresh snapshot.
    const latest = await authorizeExecution(identity, current.organizationId, "view:ai-history");
    const grants = (context: AuthContext) => JSON.stringify({ role: context.role, permissions: context.permissions ? [...context.permissions].sort() : null,
      customRoleId: context.customRoleId, isAdvisor: context.isAdvisor, advisorRole: context.advisorRole });
    if (grants(latest) !== grants(actor)) throw new AuthError("Run disclosure changed; fetch a fresh snapshot", 409);
    // Resolve domain records after the execution/cursor and authorization waits,
    // so those waits cannot release a previously read, now-deleted record link.
    const steps = [];
    for (const step of rows.slice(0, value.limit)) steps.push(await stepSummary(tx, latest, step));
    if (conversation.contentExpiresAt.getTime() <= Date.now()) throw new AuthError("Run not found or expired", 404);
    const progress = {
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
    return { progress, provisional: { state: provisionalCode === "NO_PROVISIONAL_CONTENT" ? "unavailable" : "provisional", code: provisionalCode, source: "server_status", records: [] },
      delivery: { mode: "snapshot_poll", next: run.version, cursorReset, executionChanged: after !== run.version || cursorReset, replace: true } };
  });
}

export async function getRunProgress(ctx: AuthContext, input: unknown) {
  return (await readRunProgress(ctx, progressSchema.parse(input))).progress;
}

/** A fresh bounded display snapshot, never execution authority or a text stream.
 * The whole-response adapter still validates all raw provider JSON before calls
 * are accepted. Reconnecting reads receipts; it cannot replay any effect. */
export async function getRunObservation(ctx: AuthContext, input: unknown) {
  const value = observationSchema.parse(input);
  const view = await readRunProgress(ctx, progressSchema.parse({ runId: value.runId, limit: 20 }), value.after);
  return { provisional: view.provisional, confirmed: view.progress, delivery: view.delivery };
}
