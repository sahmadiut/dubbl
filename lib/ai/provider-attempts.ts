import { createHash, randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { aiBudget, aiConversation, aiEvent, aiProvider, aiProviderConfig, aiProviderAttempt, aiProviderCall, aiRun, aiStep, aiUsageAttempt, auditLog } from "@/lib/db/schema";
import { AuthError, type AuthContext } from "@/lib/api/auth-context";
import { assertRuntimeEnabled, validateRunSnapshot } from "./run-lifecycle";
import { boundedPayload } from "./persistence";
import { createResponsesTurn, type ProviderCall, type ProviderTurnInput, type ProviderUsage } from "./provider-protocol";
import { discoverTools } from "./tool-registry";
import { markAttemptDispatched, reserveAttempt, settleAttempt, type BudgetCeiling } from "./usage";
import { toolArgumentDigest } from "./tool-operations";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Run = typeof aiRun.$inferSelect;
type Attempt = typeof aiProviderAttempt.$inferSelect;
type Turn = ReturnType<typeof createResponsesTurn>;
export type ProviderTransport = (request: Turn["request"], signal: AbortSignal, validateHistory?: () => Promise<void>) => Promise<string>;
const uuid = z.string().uuid();
const digest = (text: string) => createHash("sha256").update(text).digest("hex");
const unknownUsage = (): ProviderUsage => ({ inputTokens: null, outputTokens: null, cachedTokens: null, reasoningTokens: null });

/** Only a trusted transport can classify transient failures. Provider diagnostics
 * never enter the receipt, logs or persistence. Every retry needs a NEW key. */
export class ProviderTransportError extends Error {
  constructor(readonly code: "RATE_LIMIT" | "NETWORK" | "UNAVAILABLE" | "AUTH" | "CONTEXT_LIMIT" | "INVALID_SCHEMA") { super(code); }
}
type Receipt = { attemptId: string; usageAttemptId: string; state: Attempt["state"]; code: string | null };
export type ProviderAttemptOutcome = Receipt & (
  { status: "recorded" | "stale" } |
  { status: "rejected"; retryable: boolean } |
  { status: "accepted"; finish: "completed" | "tool_calls"; calls: (ProviderCall & { operationKey: string })[]; clarification?: string }
);
const receipt = (row: Attempt): Receipt => ({ attemptId: row.id, usageAttemptId: row.usageAttemptId, state: row.state, code: row.code });
function budgetCeilings(row: Attempt): BudgetCeiling[] {
  if (!Array.isArray(row.snapshot.budgetCeilings) || row.snapshot.budgetCeilings.length !== 2) throw new AuthError("Original budget snapshot required", 409);
  return row.snapshot.budgetCeilings as BudgetCeiling[];
}

async function lockRun(tx: Tx, runId: string) {
  const [found] = await tx.select({ conversationId: aiRun.conversationId }).from(aiRun).where(eq(aiRun.id, uuid.parse(runId)));
  if (!found) throw new AuthError("Run not found", 404);
  const [conversation] = await tx.select().from(aiConversation).where(eq(aiConversation.id, found.conversationId)).for("share");
  const [run] = await tx.select().from(aiRun).where(eq(aiRun.id, runId)).for("update");
  if (!conversation || !run) throw new AuthError("Run not found", 404);
  return { run, conversation };
}
function executable(run: Run, lease: string) {
  assertRuntimeEnabled();
  if (run.state !== "running" || run.leaseOwner !== lease || run.cancelRequestedAt || !run.deadlineAt || run.deadlineAt.getTime() <= Date.now() ||
    !run.leaseExpiresAt || run.leaseExpiresAt.getTime() <= Date.now()) throw new AuthError("Run lease no longer executable", 409);
}
function authorityDigest(ctx: AuthContext) {
  return digest(JSON.stringify({ role: ctx.role, customRoleId: ctx.customRoleId ?? null, permissions: ctx.permissions ? [...ctx.permissions].sort() : null,
    isAdvisor: ctx.isAdvisor ?? false, advisorRole: ctx.advisorRole ?? null }));
}
async function authorize(run: Run, lease: string, expectedAuthority?: unknown) {
  executable(run, lease);
  const ctx = await validateRunSnapshot(run);
  if (expectedAuthority !== undefined && expectedAuthority !== authorityDigest(ctx)) throw new AuthError("Run disclosure permissions changed", 403);
  executable(run, lease);
  return ctx;
}
function activeConversation(conversation: typeof aiConversation.$inferSelect) {
  if (conversation.deletedAt || conversation.contentExpiresAt.getTime() <= Date.now()) throw new AuthError("Conversation expired", 409);
}
async function notify(tx: Tx, run: Run, kind: string, payloadBytes = run.payloadBytes) {
  await tx.update(aiRun).set({ version: run.version + 1, updatedAt: new Date(), payloadBytes }).where(eq(aiRun.id, run.id));
  await tx.insert(aiEvent).values({ runId: run.id, organizationId: run.organizationId, ownerId: run.ownerId, sequence: run.version + 1, kind });
}

async function turnFor(tx: Tx, run: Run, history: ProviderTurnInput["history"], requestedOutput?: number) {
  const [config] = await tx.select().from(aiProviderConfig).where(eq(aiProviderConfig.id, run.config.providerConfigId));
  const [provider] = config ? await tx.select().from(aiProvider).where(eq(aiProvider.id, config.providerId)) : [];
  const model = provider?.models.find(m => m.id === config.model);
  if (!config || !model || !model.functionCalls || !model.strictSchemas || !model.usage) throw new AuthError("Approved provider model required", 409);
  const maxOutputTokens = requestedOutput ?? Math.min(4096, model.outputTokens, model.contextTokens - 1);
  const tools = await discoverTools({ identity: run.identity, organizationId: run.organizationId, agentId: "default" });
  // Caller is a trusted context builder, never a REST/MCP/model argument. Redact
  // before transport; the loop still owns live record-level disclosure filtering.
  const safe = boundedPayload(history);
  if (safe.truncated) throw new AuthError("Provider history exceeds limit", 413);
  const turn = createResponsesTurn({ model: { id: model.id, contextTokens: model.contextTokens, outputTokens: model.outputTokens, functionCalls: true, strictSchemas: true, usage: true },
    history: safe.value as ProviderTurnInput["history"], toolNames: tools.tools.map(t => t.name), maxOutputTokens });
  return { turn, timeoutMs: Math.min(config.timeoutMs, provider!.timeoutMs),
    snapshot: { ...run.config, providerId: provider!.id, model: model.id, contextTokens: model.contextTokens, outputTokens: model.outputTokens,
      timeoutMs: Math.min(config.timeoutMs, provider!.timeoutMs), toolNames: tools.tools.map(t => t.name), maxOutputTokens } };
}

async function prepare(runId: string, lease: string, key: string, history: ProviderTurnInput["history"], maxOutputTokens?: number) {
  uuid.parse(lease); uuid.parse(key);
  return db.transaction(async tx => {
    const { run, conversation } = await lockRun(tx, runId);
    activeConversation(conversation);
    const ctx = await authorize(run, lease);
    const [original] = await tx.select().from(aiProviderAttempt).where(eq(aiProviderAttempt.runId, runId)).orderBy(aiProviderAttempt.ordinal).limit(1);
    const originalOutput = original?.snapshot.maxOutputTokens;
    if (original && (typeof originalOutput !== "number" || maxOutputTokens !== undefined && maxOutputTokens > originalOutput)) throw new AuthError("Original output ceiling exceeded", 413);
    const built = await turnFor(tx, run, history, maxOutputTokens ?? (originalOutput as number | undefined));
    const originalAuthority = authorityDigest(ctx);
    const requestDigest = digest(JSON.stringify(built.turn.request));
    const [prior] = await tx.select().from(aiProviderAttempt).where(and(eq(aiProviderAttempt.runId, runId), eq(aiProviderAttempt.attemptKey, key)));
    if (prior) {
      if (prior.requestDigest !== requestDigest) throw new AuthError("Provider attempt key conflicts with original request", 409);
      // A prepared attempt belongs to its original random lease, even when the
      // process restarts under the same identity. No saved request is replayed.
      return { ...built, row: prior, run, owned: false };
    }
    const [pending] = await tx.select({ id: aiProviderAttempt.id }).from(aiProviderAttempt).where(and(eq(aiProviderAttempt.runId, runId), sql`${aiProviderAttempt.state} in ('reserved','dispatched')`)).limit(1);
    const [unfinished] = await tx.select({ id: aiStep.id }).from(aiStep).where(and(eq(aiStep.runId, runId), sql`${aiStep.state} in ('prepared','executing','uncertain')`)).limit(1);
    const [unconsumed] = await tx.select({ id: aiProviderCall.id }).from(aiProviderCall).where(and(eq(aiProviderCall.runId, runId),
      sql`not exists (select 1 from ai_step where run_id = ${runId} and operation_key = ${aiProviderCall.operationKey} and state in ('succeeded','failed','skipped'))`)).limit(1);
    if (pending || unfinished || unconsumed) throw new AuthError("Run has unfinished provider or tool work", 409);
    // Count ALL usage attempts for this run, including unknown/cancelled legacy
    // reservations. A recovery, clarification or changed request key resets none.
    const [{ count }] = await tx.select({ count: sql<number>`count(*)::int` }).from(aiUsageAttempt).where(eq(aiUsageAttempt.runId, runId));
    if (count >= 8) throw new AuthError("Run provider request limit exceeded", 413);
    if (run.payloadBytes + built.turn.requestBytes > 1048576) throw new AuthError("Run payload limit exceeded", 413);
    const [first] = await tx.select({ priceId: aiUsageAttempt.priceId }).from(aiUsageAttempt).where(eq(aiUsageAttempt.runId, runId)).orderBy(aiUsageAttempt.createdAt, aiUsageAttempt.id).limit(1);
    const ceilings = original ? budgetCeilings(original) : undefined;
    const attemptId = randomUUID();
    const usage = await reserveAttempt(ctx, { configId: run.config.providerConfigId, runId, attemptKey: `provider_${attemptId}`, ...(first ? { priceId: first.priceId } : {}), ...built.turn.reservation }, tx, ceilings);
    // The first admission holds the org budget lock until its exact ceilings are
    // saved. Later policy increases cannot enlarge this run's original envelope;
    // stricter live budgets remain additional restrictions in the usage service.
    const initialBudgets = ceilings ?? (await tx.select().from(aiBudget).where(and(eq(aiBudget.organizationId, run.organizationId), eq(aiBudget.currency, usage.currency), sql`${aiBudget.subject} in ('organization', ${`user:${run.ownerId}`})`)))
      .map(b => ({ id: b.id, version: b.version, organizationId: b.organizationId, userId: b.userId, currency: b.currency, monthlyTokens: b.monthlyTokens, monthlyCost: b.monthlyCost,
        runTokens: b.runTokens, runCost: b.runCost, requestsPerMinute: b.requestsPerMinute, concurrency: b.concurrency }));
    const [row] = await tx.insert(aiProviderAttempt).values({ id: attemptId, runId, organizationId: run.organizationId, ownerId: run.ownerId,
      attemptKey: key, ordinal: count + 1, usageAttemptId: usage.id, dispatchLease: lease, snapshot: { ...built.snapshot, authorityDigest: originalAuthority, budgetCeilings: initialBudgets }, requestBytes: built.turn.requestBytes, requestDigest }).returning();
    await notify(tx, run, "provider_reserved", run.payloadBytes + built.turn.requestBytes);
    await authorize(run, lease, originalAuthority); activeConversation(conversation); // includes waits in usage/event FKs
    return { ...built, row, run, owned: true };
  });
}

async function dispatch(row: Attempt, lease: string) {
  return db.transaction(async tx => {
    const { run, conversation } = await lockRun(tx, row.runId);
    activeConversation(conversation);
    const ctx = await authorize(run, lease, row.snapshot.authorityDigest);
    const [current] = await tx.select().from(aiProviderAttempt).where(eq(aiProviderAttempt.id, row.id)).for("update");
    if (!current || current.dispatchLease !== lease || current.state !== "reserved") throw new AuthError("Provider attempt already dispatched or closed", 409);
    const [unfinished] = await tx.select({ id: aiStep.id }).from(aiStep).where(and(eq(aiStep.runId, run.id), sql`${aiStep.state} in ('prepared','executing','uncertain')`)).limit(1);
    if (unfinished) throw new AuthError("Run has unfinished tool work", 409);
    await tx.insert(auditLog).values({ organizationId: run.organizationId, userId: run.ownerId, action: "ai.provider.dispatch", entityType: "ai-provider-attempt", entityId: row.id, changes: null });
    await markAttemptDispatched(ctx, row.usageAttemptId, tx, budgetCeilings(row));
    await tx.update(aiProviderAttempt).set({ state: "dispatched", updatedAt: new Date() }).where(eq(aiProviderAttempt.id, row.id));
    await notify(tx, run, "provider_dispatched");
    await authorize(run, lease, row.snapshot.authorityDigest); activeConversation(conversation);
    return run;
  });
}

async function abandonReservation(row: Attempt) {
  // Safe compensation after a failed pre-dispatch guard, even if identity was
  // revoked. Never zero a dispatched/unknown attempt. Same lock order as runtime.
  await db.transaction(async tx => {
    await lockRun(tx, row.runId);
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${row.organizationId}, 5))`);
    const [current] = await tx.select().from(aiProviderAttempt).where(eq(aiProviderAttempt.id, row.id)).for("update");
    if (current?.state !== "reserved") return;
    await tx.update(aiUsageAttempt).set({ state: "cancelled", chargedTokens: "0", chargedCost: "0", updatedAt: new Date() }).where(and(eq(aiUsageAttempt.id, row.usageAttemptId), eq(aiUsageAttempt.state, "reserved")));
    await tx.update(aiProviderAttempt).set({ state: "cancelled", code: "DISPATCH_DENIED", updatedAt: new Date() }).where(eq(aiProviderAttempt.id, row.id));
  });
}

/** Internal single-turn executor. The injected transport is trusted server code,
 * not a model/client callback. It must return bounded raw UTF-8 JSON and honor
 * abort. No network adapter or public invocation/settlement surface is added.
 * AI-038 owns disclosure-aware context, retries, tool dispatch and final outcomes. */
export async function executeProviderAttempt(runId: string, lease: string, key: string, history: ProviderTurnInput["history"],
  transport: ProviderTransport, options: { maxOutputTokens?: number; signal?: AbortSignal; validateHistory?: () => Promise<void> } = {}): Promise<ProviderAttemptOutcome> {
  if (options.signal?.aborted) throw new AuthError("Provider execution stopped", 409);
  const prepared = await prepare(runId, lease, key, history, options.maxOutputTokens);
  const { row, turn } = prepared;
  if (!prepared.owned) return { ...receipt(row), status: "recorded" };
  let run: Run;
  try { run = await dispatch(row, lease); }
  catch (error) { await abandonReservation(row); throw error; }
  const controller = new AbortController();
  const ms = Math.max(1, Math.min(prepared.timeoutMs, run.deadlineAt!.getTime() - Date.now(), run.leaseExpiresAt!.getTime() - Date.now()));
  let code = "PROVIDER_TIMEOUT", retryable = true, raw: string | undefined, received = false;
  const stop = () => { code = "PROVIDER_ABORTED"; retryable = false; controller.abort(); };
  options.signal?.addEventListener("abort", stop, { once: true });
  const timer = setTimeout(() => controller.abort(), ms);
  const abort = () => { throw new Error("Provider request stopped"); };
  try {
    if (options.signal?.aborted) stop();
    raw = await new Promise<string>((resolve, reject) => {
      if (controller.signal.aborted) { reject(new Error("Provider request stopped")); return; }
      const stopped = () => reject(new Error("Provider request stopped"));
      controller.signal.addEventListener("abort", stopped, { once: true });
      // Attach both handlers so an ignored abort/late rejection cannot become an
      // unhandled rejection or supply execution authority after timeout.
      Promise.resolve().then(async () => {
        // The loop revalidates live record disclosure after all dispatch waits.
        // A failed check transmits nothing; conservative unknown usage remains.
        await options.validateHistory?.();
        if (controller.signal.aborted) abort();
        return transport(turn.request, controller.signal, options.validateHistory);
      })
        .then(resolve, reject).finally(() => controller.signal.removeEventListener("abort", stopped));
    });
    received = true;
  } catch (error) {
    if (!controller.signal.aborted) {
      const known = error instanceof ProviderTransportError && ["RATE_LIMIT", "NETWORK", "UNAVAILABLE", "AUTH", "CONTEXT_LIMIT", "INVALID_SCHEMA"].includes(error.code);
      code = known ? `PROVIDER_${error.code}` : "PROVIDER_FAILURE";
      retryable = known && ["RATE_LIMIT", "NETWORK", "UNAVAILABLE"].includes(error.code);
    }
  } finally { clearTimeout(timer); options.signal?.removeEventListener("abort", stop); controller.abort(); }
  const seen = await db.select({ callId: aiProviderCall.callId }).from(aiProviderCall).where(eq(aiProviderCall.runId, runId));
  const decoded = typeof raw === "string" ? turn.decode(raw, seen.map(c => c.callId)) : null;
  if (received && typeof raw !== "string") { code = "PROVIDER_INVALID_RESPONSE"; retryable = false; }
  // Settlement is independent of response validity, lease, identity or runtime.
  // It is trusted observed usage, not a public callback or model claim of effects.
  await settleAttempt(row.organizationId, row.ownerId, row.usageAttemptId, decoded?.usage ?? unknownUsage());
  if (decoded) { code = decoded.status === "invalid" ? decoded.code : decoded.finish === "tool_calls" ? "PROVIDER_CALL_READY" : decoded.clarification ? "PROVIDER_INPUT_READY" : "PROVIDER_COMPLETED"; retryable = false; }
  return db.transaction(async tx => {
    const { run, conversation } = await lockRun(tx, runId);
    const [current] = await tx.select().from(aiProviderAttempt).where(eq(aiProviderAttempt.id, row.id)).for("update");
    if (!current || current.state !== "dispatched" || current.dispatchLease !== lease) return { ...receipt(current ?? row), status: "stale" };
    try { activeConversation(conversation); await authorize(run, lease, row.snapshot.authorityDigest); }
    catch {
      const [abandoned] = await tx.update(aiProviderAttempt).set({ state: "abandoned", code: "AUTHORITY_LOST", updatedAt: new Date() }).where(eq(aiProviderAttempt.id, row.id)).returning();
      return { ...receipt(abandoned), status: "stale" };
    }
    const calls: (ProviderCall & { operationKey: string })[] = [];
    if (decoded?.status === "valid") for (const call of decoded.calls) {
      const operationKey = randomUUID();
      await tx.insert(aiProviderCall).values({ runId, organizationId: row.organizationId, ownerId: row.ownerId, providerAttemptId: row.id, callId: call.callId,
        operationKey, toolName: call.name, catalogVersion: call.catalogVersion, argumentDigest: toolArgumentDigest(call.name, call.arguments) });
      calls.push({ ...call, operationKey });
    }
    const [updated] = await tx.update(aiProviderAttempt).set({ state: "completed", code,
      responseDigest: typeof raw === "string" && Buffer.byteLength(raw) <= 65536 ? digest(raw) : null, updatedAt: new Date() }).where(eq(aiProviderAttempt.id, row.id)).returning();
    await notify(tx, run, "provider_completed");
    // Late callbacks cannot publish a call across an authorization/lease change
    // while waiting on call/event foreign keys. Roll back all associations.
    activeConversation(conversation); await authorize(run, lease, row.snapshot.authorityDigest);
    if (!decoded || decoded.status === "invalid") return { ...receipt(updated), status: "rejected", retryable };
    return { ...receipt(updated), status: "accepted", finish: decoded.finish, calls,
      ...(decoded.finish === "completed" && decoded.clarification ? { clarification: decoded.clarification } : {}) };
  });
}
