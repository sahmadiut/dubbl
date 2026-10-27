import { createHash } from "node:crypto";
import { and, desc, eq, gt, isNull, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { aiConversation, aiRun, aiMessage, aiStep, aiApproval, aiEvent, aiUsageAttempt, auditLog, type AiPayload, type AiRunState } from "@/lib/db/schema";
import { AuthError, type AuthContext } from "@/lib/api/auth-context";
import { authorizeExecution, executionIdentity, type ExecutionIdentity } from "@/lib/api/execution-identity";
import { ALL_PERMISSIONS, hasPermission } from "@/lib/plans";

const DAY = 86400000;
const terminal = new Set<AiRunState>(["succeeded", "failed", "cancelled", "expired"]);
const transitions: Record<AiRunState, AiRunState[]> = {
  queued: ["running", "cancelled", "expired"],
  running: ["awaiting_approval", "awaiting_input", "queued", "succeeded", "failed", "cancelled", "expired", "reconciliation_required"],
  awaiting_approval: ["queued", "cancelled", "expired", "failed"], awaiting_input: ["queued", "cancelled", "expired"],
  reconciliation_required: ["queued", "failed", "cancelled"], succeeded: [], failed: [], cancelled: [], expired: [],
};
const configSchema = z.object({ providerConfigId: z.string().uuid(), configVersion: z.number().int().positive(), credentialRef: z.string().uuid(), policyVersion: z.number().int().positive() }).strict();
const identitySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("session"), userId: z.string().uuid(), organizationId: z.string().uuid(), issuedAt: z.number().finite(), expiresAt: z.number().finite() }).strict(),
  z.object({ kind: z.enum(["api-key", "mcp"]), userId: z.string().uuid(), organizationId: z.string().uuid(), credentialId: z.string().uuid() }).strict(),
]);

function scrub(text: string): string {
  return text.replace(/\bBearer\s+\S+/gi, "Bearer [REDACTED]")
    .replace(/\b(?:sk[-_]|dk_|mcp_at_|mcp_rt_)[A-Za-z0-9_\-]+/g, "[REDACTED]")
    .replace(/\b(password|secret|api[_-]?key|access[_-]?token|refresh[_-]?token)\s*[:=]\s*["']?[^\s,"'}]+/gi, "$1=[REDACTED]")
    .replace(/(https?:\/\/)[^\s/@:]+:[^\s/@]+@/gi, "$1[REDACTED]@");
}

/** Bounded, redacted display data only. Truncated payloads are never execution authority. */
export function boundedPayload(value: unknown): AiPayload {
  let nodes = 0, stringBytes = 0;
  const walk = (v: unknown, depth: number): unknown => {
    if (++nodes > 10000 || depth > 20) throw new AuthError("Payload structure exceeds limits", 400);
    if (v === null || typeof v === "boolean" || typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
      stringBytes += Buffer.byteLength(v);
      if (stringBytes > 1048576) throw new AuthError("Payload exceeds input limit", 413);
      return scrub(v);
    }
    if (Array.isArray(v)) return v.map(x => walk(x, depth + 1));
    if (typeof v === "object" && Object.getPrototypeOf(v) === Object.prototype) {
      return Object.fromEntries(Object.entries(v).map(([k, x]) => [scrub(k), /password|secret|authorization|cookie|token|api.?key|private.?key|reasoning|chain.?of.?thought/i.test(k) ? "[REDACTED]" : walk(x, depth + 1)]));
    }
    throw new AuthError("Payload must be finite JSON data", 400);
  };
  const safe = walk(value, 0), text = JSON.stringify(safe), bytes = Buffer.byteLength(text);
  return { value: bytes > 60000 ? "[TRUNCATED: display payload omitted]" : safe, bytes, truncated: bytes > 60000, digest: createHash("sha256").update(text).digest("hex") };
}

async function current(ctx: AuthContext, permission: string) {
  return authorizeExecution(executionIdentity(ctx), ctx.organizationId, permission);
}
function scope(ctx: AuthContext) { return { organizationId: ctx.organizationId, ownerId: ctx.userId }; }
function permissions(values: string[]) {
  if (values.length > 64 || values.some(p => !ALL_PERMISSIONS.includes(p))) throw new AuthError("Invalid payload permissions", 400);
  return [...new Set(values)];
}
function visible(ctx: AuthContext, required: string[], generated = true) {
  return (!generated || required.length > 0) && required.every(p => hasPermission(ctx.permissions ?? ctx.role, p));
}

/** Storage primitive for a trusted future runtime; no provider call or UI enablement. */
export async function createConversation(ctx: AuthContext) {
  const actor = await current(ctx, "use:ai"), now = Date.now();
  return (await db.insert(aiConversation).values({ ...scope(actor), contentExpiresAt: new Date(now + 30 * DAY), metadataExpiresAt: new Date(now + 90 * DAY) }).returning())[0];
}

export async function enqueueRun(ctx: AuthContext, conversationId: string, requestKey: string, config: z.infer<typeof configSchema>) {
  const actor = await current(ctx, "use:ai");
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(requestKey)) throw new AuthError("Invalid request key", 400);
  const snapshot = configSchema.parse(config), identity = identitySchema.parse(executionIdentity(ctx));
  return db.transaction(async tx => {
    const [conversation] = await tx.select().from(aiConversation).where(and(eq(aiConversation.id, conversationId), eq(aiConversation.organizationId, actor.organizationId), eq(aiConversation.ownerId, actor.userId), isNull(aiConversation.deletedAt))).for("update");
    if (!conversation || conversation.contentExpiresAt.getTime() <= Date.now()) throw new AuthError("Conversation not found or expired", 404);
    const [old] = await tx.select().from(aiRun).where(and(eq(aiRun.conversationId, conversationId), eq(aiRun.requestKey, requestKey)));
    if (old) return old;
    const [run] = await tx.insert(aiRun).values({ ...scope(actor), conversationId, requestKey, config: snapshot, identity }).returning();
    await tx.update(aiConversation).set({ version: conversation.version + 1, updatedAt: new Date() }).where(eq(aiConversation.id, conversationId));
    await tx.insert(aiEvent).values({ ...scope(actor), runId: run.id, sequence: 1, kind: "queued" });
    return run;
  });
}

/** CAS primitive. Future executor must additionally enforce approvals, policy/budgets and leases. */
export async function transitionRun(identity: ExecutionIdentity, runId: string, expectedVersion: number, state: AiRunState) {
  const actor = await authorizeExecution(identity, identity.organizationId, "use:ai");
  return db.transaction(async tx => {
    const [run] = await tx.select().from(aiRun).where(and(eq(aiRun.id, runId), eq(aiRun.organizationId, actor.organizationId), eq(aiRun.ownerId, actor.userId))).for("update");
    if (!run) throw new AuthError("Run not found", 404);
    const [conversation] = await tx.select().from(aiConversation).where(eq(aiConversation.id, run.conversationId));
    if (run.version !== expectedVersion || !transitions[run.state].includes(state) || !conversation || conversation.deletedAt) throw new AuthError("Run state conflict", 409);
    const steps = await tx.select().from(aiStep).where(eq(aiStep.runId, runId));
    if (state === "succeeded" && steps.some(s => s.state !== "succeeded" && s.state !== "skipped") ||
      state !== "reconciliation_required" && steps.some(s => s.state === "executing" || s.state === "uncertain")) throw new AuthError("Run requires effect reconciliation", 409);
    const [changed] = await tx.update(aiRun).set({ state, version: run.version + 1, updatedAt: new Date(), finishedAt: terminal.has(state) ? new Date() : null, leaseOwner: null, leaseExpiresAt: null }).where(and(eq(aiRun.id, runId), eq(aiRun.version, expectedVersion))).returning();
    await tx.insert(aiEvent).values({ ...scope(actor), runId, sequence: changed.version, kind: state });
    return changed;
  });
}

export async function appendMessage(ctx: AuthContext, conversationId: string, role: "user" | "assistant" | "tool", value: unknown, requiredPermissions: string[]) {
  const actor = await current(ctx, "use:ai"), payload = boundedPayload(value), required = permissions(requiredPermissions);
  return db.transaction(async tx => {
    const [conversation] = await tx.select().from(aiConversation).where(and(eq(aiConversation.id, conversationId), eq(aiConversation.organizationId, actor.organizationId), eq(aiConversation.ownerId, actor.userId))).for("update");
    if (!conversation || conversation.deletedAt || conversation.contentExpiresAt.getTime() <= Date.now()) throw new AuthError("Conversation not found or expired", 404);
    // Conversation-wide bound also prevents unbounded messages without a run.
    const [{ bytes }] = await tx.select({ bytes: sql<number>`coalesce(sum(octet_length(${aiMessage.payload}::text)),0)::integer` }).from(aiMessage).where(eq(aiMessage.conversationId, conversationId));
    if (bytes + Buffer.byteLength(JSON.stringify(payload)) > 1048576) throw new AuthError("Conversation payload limit exceeded", 413);
    await tx.update(aiConversation).set({ version: conversation.version + 1, updatedAt: new Date() }).where(eq(aiConversation.id, conversationId));
    return (await tx.insert(aiMessage).values({ ...scope(actor), conversationId, role, payload, requiredPermissions: required }).returning())[0];
  });
}

export async function prepareStep(ctx: AuthContext, runId: string, toolName: string, value: unknown, requiredPermissions: string[]) {
  const actor = await current(ctx, "use:ai"), input = boundedPayload(value), required = permissions(requiredPermissions);
  if (!/^[a-z][a-z0-9_]{0,127}$/.test(toolName) || !required.length || input.truncated) throw new AuthError("Invalid execution payload", 400);
  return db.transaction(async tx => {
    const [run] = await tx.select().from(aiRun).where(and(eq(aiRun.id, runId), eq(aiRun.organizationId, actor.organizationId), eq(aiRun.ownerId, actor.userId))).for("update");
    if (!run || run.state !== "running") throw new AuthError("Run state conflict", 409);
    const [{ count }] = await tx.select({ count: sql<number>`count(*)::integer` }).from(aiStep).where(eq(aiStep.runId, runId));
    if (count >= 20) throw new AuthError("Run step limit exceeded", 413);
    const [conversation] = await tx.select().from(aiConversation).where(eq(aiConversation.id, run.conversationId));
    if (!conversation || conversation.deletedAt || conversation.contentExpiresAt.getTime() <= Date.now()) throw new AuthError("Conversation expired", 409);
    const bytes = Buffer.byteLength(JSON.stringify(input));
    if (run.payloadBytes + bytes > 1048576) throw new AuthError("Run payload limit exceeded", 413);
    await tx.update(aiRun).set({ payloadBytes: run.payloadBytes + bytes }).where(eq(aiRun.id, runId));
    return (await tx.insert(aiStep).values({ ...scope(actor), runId, toolName, input, requiredPermissions: required }).returning())[0];
  });
}

export async function transitionStep(ctx: AuthContext, stepId: string, version: number, state: typeof aiStep.$inferSelect.state, result?: unknown, recordIds: string[] = []) {
  const actor = await current(ctx, "use:ai"), payload = result === undefined ? null : boundedPayload(result);
  const records = z.array(z.string().uuid()).max(100).parse(recordIds);
  return db.transaction(async tx => {
    // Always lock run before step; deletion/recovery use this same order.
    const [found] = await tx.select().from(aiStep).where(and(eq(aiStep.id, stepId), eq(aiStep.organizationId, actor.organizationId), eq(aiStep.ownerId, actor.userId)));
    if (!found) throw new AuthError("Step not found", 404);
    const [run] = await tx.select().from(aiRun).where(eq(aiRun.id, found.runId)).for("update");
    const [step] = await tx.select().from(aiStep).where(eq(aiStep.id, stepId)).for("update");
    const [conversation] = await tx.select().from(aiConversation).where(eq(aiConversation.id, run.conversationId));
    if (!conversation || conversation.deletedAt || conversation.contentExpiresAt.getTime() <= Date.now()) throw new AuthError("Conversation expired", 409);
    const allowed = step.state === "prepared" ? ["executing", "skipped"] : step.state === "executing" ? ["succeeded", "failed", "uncertain"] : [];
    if (run.state !== "running" || step.version !== version || !allowed.includes(state)) throw new AuthError("Step state conflict", 409);
    const bytes = payload ? Buffer.byteLength(JSON.stringify(payload)) : 0;
    if (run.payloadBytes + bytes > 1048576) throw new AuthError("Run payload limit exceeded", 413);
    await tx.update(aiRun).set({ payloadBytes: run.payloadBytes + bytes }).where(eq(aiRun.id, run.id));
    return (await tx.update(aiStep).set({ state, result: payload, recordIds: [...new Set([...step.recordIds, ...records])].slice(0, 100), version: version + 1, updatedAt: new Date() }).where(eq(aiStep.id, stepId)).returning())[0];
  });
}

export async function listConversations(ctx: AuthContext) {
  const actor = await current(ctx, "view:ai-history");
  return db.select({ id: aiConversation.id, version: aiConversation.version, createdAt: aiConversation.createdAt, updatedAt: aiConversation.updatedAt }).from(aiConversation)
    .where(and(eq(aiConversation.organizationId, actor.organizationId), eq(aiConversation.ownerId, actor.userId), isNull(aiConversation.deletedAt), gt(aiConversation.metadataExpiresAt, new Date()))).orderBy(desc(aiConversation.createdAt)).limit(100);
}

export async function getConversation(ctx: AuthContext, id: string, auditReason?: string) {
  const actor = await current(ctx, auditReason ? "audit:ai-transcripts" : "view:ai-history");
  if (auditReason && (auditReason.trim().length < 8 || auditReason.length > 200)) throw new AuthError("Audit reason must be 8-200 characters", 400);
  return db.transaction(async tx => {
    const [conversation] = await tx.select().from(aiConversation).where(and(eq(aiConversation.id, id), eq(aiConversation.organizationId, actor.organizationId), auditReason ? undefined : eq(aiConversation.ownerId, actor.userId), isNull(aiConversation.deletedAt))).for("share");
    if (!conversation || conversation.metadataExpiresAt.getTime() <= Date.now()) throw new AuthError("Conversation not found", 404);
    if (auditReason) await tx.insert(auditLog).values({ organizationId: actor.organizationId, userId: actor.userId, action: "ai.transcript.read", entityType: "ai_conversation", entityId: id, changes: { reason: scrub(auditReason) } });
    const expired = conversation.contentExpiresAt.getTime() <= Date.now();
    const messages = await tx.select().from(aiMessage).where(eq(aiMessage.conversationId, id)).orderBy(aiMessage.createdAt).limit(100);
    const runs = await tx.select().from(aiRun).where(eq(aiRun.conversationId, id)).limit(100);
    const output = [];
    for (const run of runs) {
      const steps = await tx.select().from(aiStep).where(eq(aiStep.runId, run.id)).limit(20);
      output.push({ id: run.id, state: run.state, version: run.version, createdAt: run.createdAt, finishedAt: run.finishedAt,
        steps: steps.map(s => ({ id: s.id, state: s.state, toolName: s.toolName, version: s.version, recordIds: visible(actor, s.requiredPermissions) ? s.recordIds : [],
          input: !expired && visible(actor, s.requiredPermissions) ? s.input : null, result: !expired && visible(actor, s.requiredPermissions) ? s.result : null })) });
    }
    return { conversation: { id, ownerId: conversation.ownerId, version: conversation.version, createdAt: conversation.createdAt },
      messages: messages.map(m => ({ id: m.id, role: m.role, createdAt: m.createdAt, payload: !expired && visible(actor, m.requiredPermissions, m.role !== "user") ? m.payload : null })), runs: output };
  });
}

/** Own-history erasure stops new writes; uncertain effects remain metadata for reconciliation. */
export async function deleteConversation(ctx: AuthContext, id: string) {
  const actor = await current(ctx, "view:ai-history");
  return db.transaction(async tx => {
    const [conversation] = await tx.select().from(aiConversation).where(and(eq(aiConversation.id, id), eq(aiConversation.organizationId, actor.organizationId), eq(aiConversation.ownerId, actor.userId))).for("update");
    if (!conversation) throw new AuthError("Conversation not found", 404);
    if (conversation.deletedAt) return { deleted: true };
    await tx.update(aiConversation).set({ deletedAt: new Date(), version: conversation.version + 1, updatedAt: new Date() }).where(eq(aiConversation.id, id));
    const runs = await tx.select().from(aiRun).where(eq(aiRun.conversationId, id)).for("update");
    for (const run of runs) {
      const steps = await tx.select().from(aiStep).where(eq(aiStep.runId, run.id));
      if (!terminal.has(run.state)) {
        const uncertain = steps.some(s => s.state === "executing" || s.state === "uncertain");
        const state = uncertain ? "reconciliation_required" : "cancelled";
        await tx.update(aiRun).set({ state, version: run.version + 1, finishedAt: uncertain ? null : new Date(), leaseOwner: null, leaseExpiresAt: null, updatedAt: new Date() }).where(eq(aiRun.id, run.id));
        await tx.insert(aiEvent).values({ organizationId: run.organizationId, ownerId: run.ownerId, runId: run.id, sequence: run.version + 1, kind: state });
      }
      for (const step of steps) {
        await tx.update(aiStep).set({ input: null, result: null, state: step.state === "executing" ? "uncertain" : step.state === "prepared" ? "skipped" : step.state, version: step.version + 1 }).where(eq(aiStep.id, step.id));
        await tx.update(aiApproval).set({ preview: null, state: "expired" }).where(and(eq(aiApproval.stepId, step.id), eq(aiApproval.state, "pending")));
        await tx.update(aiApproval).set({ preview: null }).where(eq(aiApproval.stepId, step.id));
      }
    }
    await tx.update(aiMessage).set({ payload: null }).where(eq(aiMessage.conversationId, id));
    return { deleted: true };
  });
}

/** Trusted maintenance primitive. AI-007 owns scheduling and lease recovery/dispatch. */
export async function purgeExpiredContent(now = new Date()) {
  return db.transaction(async tx => {
    const conversations = await tx.select().from(aiConversation).where(lte(aiConversation.contentExpiresAt, now)).for("update");
    for (const c of conversations) {
      await tx.update(aiMessage).set({ payload: null }).where(eq(aiMessage.conversationId, c.id));
      const runs = await tx.select().from(aiRun).where(eq(aiRun.conversationId, c.id)).for("update");
      for (const r of runs) {
        const steps = await tx.select().from(aiStep).where(eq(aiStep.runId, r.id));
        await tx.update(aiStep).set({ input: null, result: null }).where(eq(aiStep.runId, r.id));
        for (const s of steps) await tx.update(aiApproval).set({ preview: null }).where(eq(aiApproval.stepId, s.id));
      }
      const unsettled = await tx.select({ id: aiUsageAttempt.id }).from(aiUsageAttempt).where(sql`${aiUsageAttempt.runId} in (select id from ai_run where conversation_id = ${c.id}) and ${aiUsageAttempt.state} in ('reserved','in_flight','unknown')`).limit(1);
      if (c.metadataExpiresAt <= now && runs.every(r => terminal.has(r.state)) && !unsettled.length) await tx.delete(aiConversation).where(eq(aiConversation.id, c.id));
    }
    await tx.update(aiApproval).set({ state: "expired", preview: null }).where(and(eq(aiApproval.state, "pending"), lte(aiApproval.expiresAt, now)));
    return { processed: conversations.length };
  });
}

/** Restart recovery classifies dispatched work as uncertain; it never replays a tool. */
export async function recoverExpiredRuns(now = new Date()) {
  return db.transaction(async tx => {
    const runs = await tx.select().from(aiRun).where(and(eq(aiRun.state, "running"), lte(aiRun.leaseExpiresAt, now))).limit(100).for("update", { skipLocked: true });
    for (const run of runs) {
      const steps = await tx.select().from(aiStep).where(eq(aiStep.runId, run.id)).for("update");
      const uncertain = steps.some(s => s.state === "executing" || s.state === "uncertain");
      for (const step of steps.filter(s => s.state === "executing")) await tx.update(aiStep).set({ state: "uncertain", version: step.version + 1, updatedAt: now }).where(eq(aiStep.id, step.id));
      const state = uncertain ? "reconciliation_required" : "queued";
      await tx.update(aiRun).set({ state, version: run.version + 1, leaseOwner: null, leaseExpiresAt: null, updatedAt: now }).where(eq(aiRun.id, run.id));
      await tx.insert(aiEvent).values({ organizationId: run.organizationId, ownerId: run.ownerId, runId: run.id, sequence: run.version + 1, kind: state });
    }
    return { recovered: runs.length };
  });
}
