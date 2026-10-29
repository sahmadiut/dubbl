import { randomUUID } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { aiConversation, aiEvent, aiMessage, aiProviderAttempt, aiProviderCall, aiRun, aiRunInput, aiStep, aiUsageAttempt, contact, journalEntry, expenseClaim } from "@/lib/db/schema";
import { AuthError } from "@/lib/api/auth-context";
import { hasPermission } from "@/lib/plans";
import { assertRunLease, assertRuntimeEnabled, validateRunSnapshot } from "./run-lifecycle";
import { boundedPayload } from "./persistence";
import { executeProviderAttempt, type ProviderTransport } from "./provider-attempts";
import type { ProviderTurnInput } from "./provider-protocol";
import { executeToolOperation } from "./tool-operations";
import { catalogEntry } from "./tool-catalog";
import { getRunProgress } from "./run-progress";
import { requestRunInput } from "./run-input";
import { createRunTransport } from "./run-transport";
import { closeProviderAttempts } from "./provider-recovery";

type Run = typeof aiRun.$inferSelect;

/** Fresh minimized context, scoped to this run. No redacted tool inputs, saved
 * result blobs, prior model narration, sibling runs or private reasoning enter
 * a new request. Only live domain references can describe confirmed effects. */
export async function buildRunHistory(runId: string, lease: string): Promise<ProviderTurnInput["history"]> {
  const { run, ctx } = await assertRunLease(runId, lease);
  if (!hasPermission(ctx.permissions ?? ctx.role, "view:ai-history")) throw new AuthError("History access required", 403);
  const [message] = await db.select().from(aiMessage).where(and(eq(aiMessage.conversationId, run.conversationId), eq(aiMessage.role, "user"), sql`${aiMessage.payload}->'value'->>'runId' = ${runId}`)).limit(1);
  const payload = message?.payload?.value as { text?: unknown } | undefined;
  if (!message || message.payload?.truncated || typeof payload?.text !== "string" || !message.requiredPermissions.every(p => hasPermission(ctx.permissions ?? ctx.role, p))) throw new AuthError("Original request unavailable", 409);
  const history: ProviderTurnInput["history"] = [{ kind: "user", text: payload.text }];
  const answers = await db.select().from(aiRunInput).where(and(eq(aiRunInput.runId, runId), eq(aiRunInput.state, "answered"))).orderBy(aiRunInput.inputVersion);
  for (const answer of answers) {
    // The executor currently requests text only. Other internal question kinds
    // fail closed here rather than forwarding a stale record selection.
    if (answer.kind !== "text" || !answer.requiredPermissions.every(p => hasPermission(ctx.permissions ?? ctx.role, p)) || answer.answer?.truncated || !answer.answer?.value) throw new AuthError("Clarification unavailable", 409);
    const value = answer.answer.value as { kind?: unknown; text?: unknown };
    if (value.kind !== "text" || typeof value.text !== "string") throw new AuthError("Clarification unavailable", 409);
    history.push({ kind: "user", text: JSON.stringify({ untrustedClarification: value.text }) });
  }
  const progress = await getRunProgress(ctx, { runId, limit: 20 });
  const receipts = [];
  for (const step of progress.steps) {
    const records = [];
    for (const ref of step.records) {
      // Explicit display allowlist, reloaded from live scoped rows. No saved
      // customer email/phone/notes, journal lines or expense attachments leave.
      let label: string | undefined;
      if (ref.type === "contact") {
        const [row] = await db.select({ name: contact.name }).from(contact).where(and(eq(contact.id, ref.id), eq(contact.organizationId, ctx.organizationId), isNull(contact.deletedAt)));
        label = row?.name;
      } else if (ref.type === "journal_entry") {
        const [row] = await db.select({ number: journalEntry.entryNumber }).from(journalEntry).where(and(eq(journalEntry.id, ref.id), eq(journalEntry.organizationId, ctx.organizationId), isNull(journalEntry.deletedAt)));
        label = row ? String(row.number) : undefined;
      } else {
        const [row] = await db.select({ title: expenseClaim.title }).from(expenseClaim).where(and(eq(expenseClaim.id, ref.id), eq(expenseClaim.organizationId, ctx.organizationId), isNull(expenseClaim.deletedAt)));
        label = row?.title;
      }
      if (label !== undefined) records.push({ ...ref, untrustedLabel: label.slice(0, 200) });
    }
    receipts.push({ action: step.action, state: step.state, code: step.code, records, recordsOmitted: step.recordsOmitted || records.length !== step.records.length });
  }
  if (receipts.length) history.push({ kind: "user", text: JSON.stringify({ untrustedServerReceipts: receipts }) });
  await assertRunLease(runId, lease);
  return history;
}

/** Fenced closure. Failure preserves known business receipts and unresolved
 * charges. Stored final messages contain finite codes only; live links remain
 * available through the existing REST/MCP progress service. */
async function closeRun(runId: string, lease: string, completed: boolean) {
  return db.transaction(async tx => {
    const [found] = await tx.select().from(aiRun).where(eq(aiRun.id, runId));
    if (!found) throw new AuthError("Run not found", 404);
    const [conversation] = await tx.select().from(aiConversation).where(eq(aiConversation.id, found.conversationId)).for("share");
    const [run] = await tx.select().from(aiRun).where(eq(aiRun.id, runId)).for("update");
    if (run.state !== "running" || run.leaseOwner !== lease || !run.leaseExpiresAt || run.leaseExpiresAt.getTime() <= Date.now()) return { runId, state: run.state };
    // A receipt-persistence error can leave an attempt dispatched after usage
    // settles. Close its authority without discarding any known charge.
    await closeProviderAttempts(tx, run);
    const steps = await tx.select().from(aiStep).where(eq(aiStep.runId, runId));
    const calls = await tx.select().from(aiProviderCall).where(eq(aiProviderCall.runId, runId));
    const attempts = await tx.select().from(aiProviderAttempt).where(eq(aiProviderAttempt.runId, runId)).orderBy(aiProviderAttempt.ordinal);
    const unknown = await tx.select({ id: aiUsageAttempt.id }).from(aiUsageAttempt).where(and(eq(aiUsageAttempt.runId, runId), sql`${aiUsageAttempt.state} in ('reserved','in_flight','unknown')`));
    const unsafe = steps.some(s => ["executing", "uncertain"].includes(s.state)) || calls.some(c => !steps.some(s => s.operationKey === c.operationKey && ["succeeded", "failed", "skipped"].includes(s.state)));
    let authorized = false;
    try { await validateRunSnapshot(run); authorized = true; } catch { /* Close safely without disclosing or starting work. */ }
    const active = !!conversation && !conversation.deletedAt && conversation.contentExpiresAt.getTime() > Date.now();
    const success = completed && authorized && active && !unsafe && !unknown.length && !steps.some(s => s.state !== "succeeded") && attempts.at(-1)?.code === "PROVIDER_COMPLETED";
    const state: Run["state"] = unsafe || unknown.length ? "reconciliation_required" : run.cancelRequestedAt ? "cancelled"
      : !active || !run.deadlineAt || run.deadlineAt.getTime() <= Date.now() ? "expired" : success ? "succeeded" : "failed";
    await tx.update(aiStep).set({ state: "skipped", version: sql`${aiStep.version} + 1`, updatedAt: new Date() }).where(and(eq(aiStep.runId, runId), eq(aiStep.state, "prepared")));
    await tx.update(aiStep).set({ state: "uncertain", version: sql`${aiStep.version} + 1`, updatedAt: new Date() }).where(and(eq(aiStep.runId, runId), eq(aiStep.state, "executing")));
    const code = state === "succeeded" ? steps.length ? "COMPLETED" : "NO_CONFIRMED_ACTION" : state === "reconciliation_required" ? "RECONCILIATION_REQUIRED" : steps.some(s => s.state === "succeeded") ? "PARTIAL_COMPLETION" : "NO_CONFIRMED_ACTION";
    if (active) {
      const payload = boundedPayload({ runId, code });
      const bytes = Buffer.byteLength(JSON.stringify(payload));
      if (run.payloadBytes + bytes <= 1048576) {
        await tx.insert(aiMessage).values({ organizationId: run.organizationId, ownerId: run.ownerId, conversationId: run.conversationId, role: "assistant", payload, requiredPermissions: ["view:ai-history"] });
        await tx.update(aiRun).set({ payloadBytes: run.payloadBytes + bytes }).where(eq(aiRun.id, runId));
      }
    }
    await tx.update(aiRun).set({ state, version: run.version + 1, leaseOwner: null, leaseExpiresAt: null, updatedAt: new Date(), finishedAt: state === "reconciliation_required" ? null : new Date() }).where(eq(aiRun.id, runId));
    await tx.insert(aiEvent).values({ runId, organizationId: run.organizationId, ownerId: run.ownerId, sequence: run.version + 1, kind: state });
    if (state === "succeeded") {
      assertRuntimeEnabled(); await validateRunSnapshot(run);
      // Event persistence and live authorization can wait. Roll back completion
      // and its message if content expired meanwhile; the caller closes the run
      // again from current state without publishing expired conversation data.
      if (conversation.contentExpiresAt.getTime() <= Date.now()) throw new AuthError("Conversation expired during completion", 409);
      if (run.leaseExpiresAt.getTime() <= Date.now() || run.deadlineAt!.getTime() <= Date.now()) throw new AuthError("Run expired during completion", 409);
    }
    return { runId, state };
  });
}

/** One claimed run only; no polling, claim, heartbeat, deployment or activation.
 * A session advisory lock prevents competing loop invocations, even under the
 * same lease, without holding a DB transaction across provider/business calls.
 * Process death releases it. AI-036 owns process scheduling and lease renewal. */
export async function executeRun(runId: string, lease: string, transport?: ProviderTransport, options: { signal?: AbortSignal; maxOutputTokens?: number } = {}) {
  await assertRunLease(runId, lease);
  const connection = await db.$client.connect();
  let locked = false;
  try {
    const lock = await connection.query("select pg_try_advisory_lock(hashtextextended($1, 38)) as locked", [runId]);
    locked = lock.rows[0].locked;
    if (!locked) return { runId, state: "busy" as const };
    if (!transport && process.env.AI_PROVIDER_CALLS_ENABLED !== "true") return await closeRun(runId, lease, false);
    const dispatch = transport ?? createRunTransport(runId, lease);
    // Accepted calls carry executable arguments only in their fresh receipt.
    // Never reconstruct a lost handoff from display input or tool result data.
    const pending = await db.select({ id: aiProviderCall.id }).from(aiProviderCall).where(and(eq(aiProviderCall.runId, runId), sql`not exists (select 1 from ai_step where run_id = ${runId} and operation_key = ${aiProviderCall.operationKey} and state in ('succeeded','failed','skipped'))`));
    if (pending.length) return await closeRun(runId, lease, false);
    const initial = await db.select().from(aiProviderAttempt).where(eq(aiProviderAttempt.runId, runId)).orderBy(aiProviderAttempt.ordinal);
    const last = initial.at(-1);
    if (last?.code === "PROVIDER_COMPLETED") return await closeRun(runId, lease, true);
    if (last && last.code !== "PROVIDER_CALL_READY" && !["PROVIDER_RATE_LIMIT", "PROVIDER_NETWORK", "PROVIDER_UNAVAILABLE", "PROVIDER_TIMEOUT", "PROVIDER_INPUT_READY"].includes(last.code ?? "")) return await closeRun(runId, lease, false);
    if (last?.code === "PROVIDER_INPUT_READY") {
      const answered = await db.select({ id: aiRunInput.id }).from(aiRunInput).where(and(eq(aiRunInput.runId, runId), eq(aiRunInput.state, "answered"), sql`${aiRunInput.createdAt} >= ${last.createdAt}`));
      if (!answered.length) return await closeRun(runId, lease, false);
    }
    // At most eight charged attempts including retries across process restarts.
    // Retry budget is derived from persisted receipts, never a resettable counter.
    while (!options.signal?.aborted) {
      const prior = await db.select().from(aiProviderAttempt).where(eq(aiProviderAttempt.runId, runId)).orderBy(aiProviderAttempt.ordinal);
      if (prior.length >= 8 || prior.filter(a => a.code && ["PROVIDER_RATE_LIMIT", "PROVIDER_NETWORK", "PROVIDER_UNAVAILABLE", "PROVIDER_TIMEOUT"].includes(a.code)).length >= 2) return await closeRun(runId, lease, false);
      const history = await buildRunHistory(runId, lease), signature = JSON.stringify(history);
      const result = await executeProviderAttempt(runId, lease, randomUUID(), history, dispatch, { ...options,
        validateHistory: async () => {
          if (JSON.stringify(await buildRunHistory(runId, lease)) !== signature) throw new AuthError("Run disclosure changed", 403);
        } });
      if (result.status === "rejected") {
        if (result.retryable) continue;
        return await closeRun(runId, lease, false);
      }
      if (result.status !== "accepted") return await closeRun(runId, lease, false);
      if (options.signal?.aborted) return await closeRun(runId, lease, false);
      if (result.clarification) {
        const { run } = await assertRunLease(runId, lease);
        await requestRunInput(runId, lease, run.version, { kind: "text", question: result.clarification, candidates: [], requiredPermissions: ["view:ai-history"] });
        return { runId, state: "awaiting_input" as const };
      }
      if (result.finish === "completed") return await closeRun(runId, lease, true);
      for (const call of result.calls) {
        const entry = catalogEntry(call.name);
        // No model text, clarification or approval-looking answer can widen the
        // reviewed automatic catalog. AI-008 owns sensitive approval execution.
        if (!entry || entry.approval !== "automatic" || !["read", "draft"].includes(entry.effect)) return await closeRun(runId, lease, false);
        const receipt = await executeToolOperation(runId, lease, call.operationKey, call.name, call.arguments);
        // No automatic business retries: the current registry cannot establish
        // transient read errors. A future typed read policy may be more specific.
        if (receipt.state !== "succeeded") return await closeRun(runId, lease, false);
      }
    }
    return await closeRun(runId, lease, false);
  } catch {
    // Safe finite failure, retaining known effects. Stale ownership is inert.
    return await closeRun(runId, lease, false);
  } finally {
    let discard = false;
    try { if (locked) await connection.query("select pg_advisory_unlock(hashtextextended($1, 38))", [runId]); }
    catch { discard = true; }
    finally { connection.release(discard); }
  }
}
