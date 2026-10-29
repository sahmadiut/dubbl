import { createHash, randomUUID } from "node:crypto";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { aiConversation, aiRun, aiRunInput, aiMessage, aiEvent, aiStep, aiProvider, aiProviderConfig, auditLog } from "@/lib/db/schema";
import { AuthError, type AuthContext } from "@/lib/api/auth-context";
import { authorizeExecution, executionIdentity } from "@/lib/api/execution-identity";
import { boundedPayload, getConversation, purgeExpiredContent } from "./persistence";
import { discoverTools } from "./tool-registry";
import { closeProviderAttempts } from "./provider-recovery";

const RUN_MS = 600000, QUEUE_MS = 86400000, LEASE_MS = 30000;
type Run = typeof aiRun.$inferSelect;
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
const terminal = new Set(["succeeded", "failed", "cancelled", "expired"]);
const publicEventKinds = new Set(["queued", "running", "awaiting_approval", "awaiting_input", "input_answered", "reconciliation_required", "succeeded", "failed", "cancelled", "expired", "claimed", "stop_requested", "authorization_or_configuration_changed", "recovered", "step_prepared", "step_updated"]);
const id = z.string().uuid().describe("Opaque run/conversation UUID scoped to the authenticated owner and organization.");
export const submitRunSchema = z.object({ conversationId: id,
  requestKey: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/).describe("Client idempotency key within this conversation; reuse requires identical input."),
  message: z.string().trim().min(1).max(16000).describe("Untrusted user request; never identity, policy, approval or execution authority."),
}).strict();
export const runIdSchema = z.object({ runId: id }).strict();
export const eventsSchema = z.object({ runId: id, after: z.number().int().min(0).max(2147483646).default(0).describe("Last observed event sequence; reconnect after this cursor without re-executing actions.") }).strict();

export function assertRuntimeEnabled() {
  if (process.env.AI_RUNTIME_ENABLED !== "true" || process.env.AI_RUNTIME_KILL_SWITCH === "true") throw new AuthError("AI runtime is disabled", 403);
}
const actor = (ctx: AuthContext, permission: string) => authorizeExecution(executionIdentity(ctx), ctx.organizationId, permission);
const own = (ctx: AuthContext, runId: string) => and(eq(aiRun.id, runId), eq(aiRun.organizationId, ctx.organizationId), eq(aiRun.ownerId, ctx.userId));
const publicRun = (r: Run) => ({ id: r.id, conversationId: r.conversationId, state: r.state, version: r.version, createdAt: r.createdAt, startedAt: r.startedAt, deadlineAt: r.deadlineAt, cancelRequestedAt: r.cancelRequestedAt, finishedAt: r.finishedAt });
async function activeConversation(tx: Tx, run: Run) {
  const [c] = await tx.select().from(aiConversation).where(and(eq(aiConversation.id, run.conversationId), eq(aiConversation.organizationId, run.organizationId), eq(aiConversation.ownerId, run.ownerId)));
  return !!c && !c.deletedAt && c.contentExpiresAt.getTime() > Date.now();
}
async function event(tx: Tx, run: Run, state: Run["state"], kind: string = state, extra: Partial<typeof aiRun.$inferInsert> = {}) {
  const [updated] = await tx.update(aiRun).set({ ...extra, state, version: run.version + 1, updatedAt: new Date(), finishedAt: terminal.has(state) ? new Date() : null,
    ...(state !== "running" ? { leaseOwner: null, leaseExpiresAt: null } : {}) }).where(eq(aiRun.id, run.id)).returning();
  await tx.insert(aiEvent).values({ runId: run.id, organizationId: run.organizationId, ownerId: run.ownerId, sequence: updated.version, kind });
  return updated;
}
async function audit(tx: Tx, ctx: AuthContext, runId: string, action: string) {
  await tx.insert(auditLog).values({ organizationId: ctx.organizationId, userId: ctx.userId, action, entityType: "ai-run", entityId: runId, changes: null });
}

/** Re-evaluate the server-chosen snapshot. No model/client field can select a policy,
 * credential, principal or organization. Secrets never leave the provider adapter. */
async function currentSnapshot(ctx: AuthContext) {
  const tools = await discoverTools({ identity: executionIdentity(ctx), organizationId: ctx.organizationId, agentId: "default" });
  if (!tools.tools.length) throw new AuthError("No authorized AI tools", 403);
  const [config] = await db.select().from(aiProviderConfig).where(and(eq(aiProviderConfig.organizationId, ctx.organizationId), eq(aiProviderConfig.isDefault, true)));
  const [provider] = config ? await db.select().from(aiProvider).where(eq(aiProvider.id, config.providerId)) : [];
  const model = provider?.models.find(m => m.id === config.model);
  if (!config?.enabled || !config.credential || !config.keyVersion || !provider?.enabled || !provider.delegatedOrganizations.includes(ctx.organizationId) ||
    !model?.usage || !model.functionCalls || !model.strictSchemas || config.timeoutMs > provider.timeoutMs) throw new AuthError("Approved AI provider configuration required", 409);
  return { providerConfigId: config.id, configVersion: config.version, credentialRef: config.credentialRef, providerVersion: provider.version,
    policyVersion: tools.policyVersions.organization, agentPolicyVersion: tools.policyVersions.agent, agentId: "default" as const };
}
export async function validateRunSnapshot(run: Run) {
  const ctx = await authorizeExecution(run.identity, run.organizationId, "use:ai"), snapshot = await currentSnapshot(ctx);
  if (Object.entries(snapshot).some(([k, value]) => run.config[k as keyof Run["config"]] !== value)) throw new AuthError("Run configuration changed; submit a new request", 409);
  return ctx;
}

export async function submitRun(ctx: AuthContext, input: unknown) {
  const value = submitRunSchema.parse(input), current = await actor(ctx, "use:ai"); assertRuntimeEnabled();
  const digest = createHash("sha256").update(value.message).digest("hex");
  return db.transaction(async tx => {
    const [c] = await tx.select().from(aiConversation).where(and(eq(aiConversation.id, value.conversationId), eq(aiConversation.organizationId, current.organizationId), eq(aiConversation.ownerId, current.userId))).for("update");
    if (!c || c.deletedAt || c.contentExpiresAt.getTime() <= Date.now()) throw new AuthError("Conversation not found or expired", 404);
    const [prior] = await tx.select().from(aiRun).where(and(eq(aiRun.conversationId, c.id), eq(aiRun.requestKey, value.requestKey)));
    if (prior) { if (prior.requestDigest !== digest) throw new AuthError("Request key conflicts with original input", 409); return publicRun(prior); }
    const config = await currentSnapshot(current);
    const [{ count }] = await tx.select({ count: sql<number>`count(*)::int` }).from(aiRun).where(eq(aiRun.conversationId, c.id));
    const [{ bytes }] = await tx.select({ bytes: sql<number>`coalesce(sum(octet_length(${aiMessage.payload}::text)),0)::int` }).from(aiMessage).where(eq(aiMessage.conversationId, c.id));
    if (count >= 100 || bytes + Buffer.byteLength(value.message) + 512 > 1048576) throw new AuthError("Conversation capacity exceeded", 413);
    const [run] = await tx.insert(aiRun).values({ organizationId: current.organizationId, ownerId: current.userId, conversationId: c.id, requestKey: value.requestKey, requestDigest: digest, identity: executionIdentity(current), config }).returning();
    await tx.insert(aiMessage).values({ organizationId: current.organizationId, ownerId: current.userId, conversationId: c.id, role: "user", payload: boundedPayload({ runId: run.id, text: value.message }), requiredPermissions: [] });
    await tx.insert(aiEvent).values({ organizationId: current.organizationId, ownerId: current.userId, runId: run.id, sequence: 1, kind: "queued" });
    await tx.update(aiConversation).set({ version: c.version + 1, updatedAt: new Date() }).where(eq(aiConversation.id, c.id));
    await audit(tx, current, run.id, "ai.run.submitted");
    return publicRun(run);
  });
}
export async function getRun(ctx: AuthContext, input: unknown) {
  const { runId } = runIdSchema.parse(input), current = await actor(ctx, "view:ai-history");
  const [run] = await db.select().from(aiRun).where(own(current, runId));
  if (!run) throw new AuthError("Run not found", 404);
  const history = await getConversation(current, run.conversationId);
  return { ...publicRun(run), steps: history.runs.find(r => r.id === runId)?.steps ?? [] };
}
export async function getRunEvents(ctx: AuthContext, input: unknown) {
  const value = eventsSchema.parse(input), current = await actor(ctx, "view:ai-history");
  return db.transaction(async tx => {
    const [run] = await tx.select().from(aiRun).where(own(current, value.runId)).for("share");
    if (!run || !await activeConversation(tx, run)) throw new AuthError("Run not found or expired", 404);
    const cursorReset = value.after > run.version, after = cursorReset ? 0 : value.after;
    const rows = await tx.select({ sequence: aiEvent.sequence, kind: aiEvent.kind, createdAt: aiEvent.createdAt }).from(aiEvent)
      .where(and(eq(aiEvent.runId, run.id), gt(aiEvent.sequence, after))).orderBy(aiEvent.sequence).limit(101);
    const events = rows.slice(0, 100).map(e => ({ ...e, kind: publicEventKinds.has(e.kind) ? e.kind : "changed" }));
    return { run: publicRun(run), events, next: events.at(-1)?.sequence ?? after, hasMore: rows.length > 100, cursorReset };
  });
}

/** Stop is available even while runtime is disabled. An in-flight effect is not rolled back. */
export async function cancelRun(ctx: AuthContext, input: unknown) {
  const { runId } = runIdSchema.parse(input), current = await actor(ctx, "view:ai-history");
  return db.transaction(async tx => {
    const [run] = await tx.select().from(aiRun).where(own(current, runId)).for("update");
    if (!run || !await activeConversation(tx, run)) throw new AuthError("Run not found or expired", 404);
    if (terminal.has(run.state) || run.cancelRequestedAt) return publicRun(run);
    const steps = await tx.select().from(aiStep).where(eq(aiStep.runId, runId));
    const uncertain = steps.some(s => s.state === "uncertain"), executing = steps.some(s => s.state === "executing");
    await tx.update(aiStep).set({ state: "skipped", version: sql`${aiStep.version} + 1`, updatedAt: new Date() }).where(and(eq(aiStep.runId, runId), eq(aiStep.state, "prepared")));
    const state = executing && run.state === "running" ? "running" : uncertain || executing ? "reconciliation_required" : "cancelled";
    const changed = await event(tx, run, state, "stop_requested", { cancelRequestedAt: new Date() });
    await tx.update(aiRunInput).set({ state: "cancelled", question: null, candidates: null }).where(and(eq(aiRunInput.runId, run.id), eq(aiRunInput.state, "pending")));
    await closeProviderAttempts(tx, run);
    await audit(tx, current, run.id, "ai.run.stop_requested");
    return publicRun(changed);
  });
}

/** Internal worker primitive. A new random lease token fences every claim, including
 * claims by the same process after restart. Never exposed through REST or MCP. */
export async function claimNextRun(): Promise<Run | null> {
  assertRuntimeEnabled();
  return db.transaction(async tx => {
    // Serialize capacity decisions across workers; SKIP LOCKED avoids user actions.
    await tx.execute(sql`select pg_advisory_xact_lock(170022)`);
    const queued = await tx.select().from(aiRun).where(eq(aiRun.state, "queued")).orderBy(aiRun.createdAt, aiRun.id).limit(100).for("update", { skipLocked: true });
    for (const run of queued) {
      const now = new Date();
      if (!await activeConversation(tx, run) || run.createdAt.getTime() + QUEUE_MS <= now.getTime() || run.deadlineAt && run.deadlineAt <= now || run.cancelRequestedAt) {
        await event(tx, run, run.cancelRequestedAt ? "cancelled" : "expired"); continue;
      }
      try { await validateRunSnapshot(run); } catch { await event(tx, run, "failed", "authorization_or_configuration_changed"); continue; }
      const active = await tx.select({ ownerId: aiRun.ownerId }).from(aiRun).where(and(eq(aiRun.organizationId, run.organizationId), eq(aiRun.state, "running")));
      if (active.length >= 2 || active.some(r => r.ownerId === run.ownerId)) continue;
      assertRuntimeEnabled();
      return event(tx, run, "running", "claimed", { leaseOwner: randomUUID(), leaseExpiresAt: new Date(now.getTime() + LEASE_MS), startedAt: run.startedAt ?? now, deadlineAt: run.deadlineAt ?? new Date(now.getTime() + RUN_MS) });
    }
    return null;
  });
}

/** Recheck before each new side effect; does not itself dispatch or renew a lease. */
export async function assertRunLease(runId: string, leaseToken: string) {
  assertRuntimeEnabled(); z.string().uuid().parse(leaseToken);
  const [run] = await db.select().from(aiRun).where(eq(aiRun.id, z.string().uuid().parse(runId)));
  if (!run || run.state !== "running" || run.leaseOwner !== leaseToken || !run.leaseExpiresAt || run.leaseExpiresAt.getTime() <= Date.now() ||
    !run.deadlineAt || run.deadlineAt.getTime() <= Date.now() || run.cancelRequestedAt) throw new AuthError("Run lease no longer executable", 409);
  const [c] = await db.select().from(aiConversation).where(and(eq(aiConversation.id, run.conversationId), isNull(aiConversation.deletedAt), gt(aiConversation.contentExpiresAt, new Date())));
  if (!c) throw new AuthError("Conversation expired", 409);
  return { run, ctx: await validateRunSnapshot(run) };
}
export async function heartbeatRun(runId: string, leaseToken: string) {
  await assertRunLease(runId, leaseToken);
  const now = new Date();
  const [run] = await db.update(aiRun).set({ leaseExpiresAt: new Date(now.getTime() + LEASE_MS), updatedAt: now })
    .where(and(eq(aiRun.id, runId), eq(aiRun.leaseOwner, leaseToken), eq(aiRun.state, "running"), isNull(aiRun.cancelRequestedAt), gt(aiRun.leaseExpiresAt, now), gt(aiRun.deadlineAt, now))).returning();
  if (!run) throw new AuthError("Run lease changed", 409);
  return { runId: run.id, leaseExpiresAt: run.leaseExpiresAt };
}

/** Bounded scheduling primitive for AI-023. An executing tool is always uncertain;
 * no automatic write replay. Provider reservations survive unknown outcomes. */
export async function maintainRuns() {
  const result = await db.transaction(async tx => {
    const now = new Date();
    const runs = await tx.select().from(aiRun).where(sql`(${aiRun.state} = 'running' and (${aiRun.leaseExpiresAt} <= ${now} or ${aiRun.deadlineAt} <= ${now})) or (${aiRun.state} = 'queued' and ${aiRun.createdAt} <= ${new Date(now.getTime() - QUEUE_MS)}) or (${aiRun.state} = 'awaiting_input' and (${aiRun.deadlineAt} <= ${now} or exists (select 1 from ai_run_input where run_id = ${aiRun.id} and (state = 'expired' or (state = 'pending' and expires_at <= ${now}))) or exists (select 1 from ai_conversation where id = ${aiRun.conversationId} and (deleted_at is not null or content_expires_at <= ${now}))))`).limit(100).for("update", { skipLocked: true });
    for (const run of runs) {
      const steps = await tx.select().from(aiStep).where(eq(aiStep.runId, run.id)).for("update");
      const uncertain = steps.some(s => s.state === "executing" || s.state === "uncertain");
      await tx.update(aiStep).set({ state: "uncertain", version: sql`${aiStep.version} + 1`, updatedAt: now }).where(and(eq(aiStep.runId, run.id), eq(aiStep.state, "executing")));
      // Runtime always locks a run before its step/attempt. Stale callbacks may
      // settle usage but cannot restore an executable lease or replay effects.
      await closeProviderAttempts(tx, run);
      const expired = run.state === "awaiting_input" || run.createdAt.getTime() + QUEUE_MS <= now.getTime() || run.deadlineAt && run.deadlineAt <= now;
      const state = uncertain ? "reconciliation_required" : run.cancelRequestedAt ? "cancelled" : expired ? "expired" : "queued";
      await event(tx, run, state, "recovered");
      await tx.update(aiRunInput).set({ state: "expired", question: null, candidates: null }).where(and(eq(aiRunInput.runId, run.id), eq(aiRunInput.state, "pending")));
    }
    return { recovered: runs.length };
  });
  // Retention does not discard unresolved attempts/effect metadata.
  return { ...result, retention: await purgeExpiredContent() };
}
