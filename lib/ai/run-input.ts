import { createHash } from "node:crypto";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { aiConversation, aiRun, aiRunInput, aiStep, aiUsageAttempt, aiEvent, auditLog, contact, journalEntry, expenseClaim, type AiInputCandidate } from "@/lib/db/schema";
import { AuthError, type AuthContext } from "@/lib/api/auth-context";
import { authorizeExecution, executionIdentity } from "@/lib/api/execution-identity";
import { ALL_PERMISSIONS, hasPermission } from "@/lib/plans";
import { boundedPayload } from "./persistence";
import { assertRunLease, assertRuntimeEnabled, validateRunSnapshot } from "./run-lifecycle";

const id = z.string().uuid().describe("Opaque UUID scoped to the authenticated owner and organization.");
const version = z.number().int().positive().max(2147483647);
const candidate = z.object({
  type: z.enum(["contact", "journal_entry", "expense_claim"]).describe("Reviewed record type; not a tool name or approval action."),
  id: id.describe("Existing record UUID in this organization, revalidated under current domain permissions."),
}).strict();
export const getRunInputSchema = z.object({ runId: id }).strict();
export const answerRunInputSchema = z.object({
  runId: id, inputId: id.describe("Pending question UUID from get_ai_run_input."),
  inputVersion: version.describe("Exact pending input version returned by the server."),
  expectedRunVersion: version.describe("Exact run version observed with this question; stale answers conflict."),
  requestKey: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/).describe("Answer idempotency key; retry the same key, versions and answer after a lost response."),
  answer: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("choice").describe("Select one server-offered candidate; never authorizes execution or approval."), candidate: candidate.describe("An exact type/UUID pair from the pending choices.") }).strict(),
    z.object({ kind: z.literal("text").describe("Untrusted clarification text, not approval or policy."), text: z.string().trim().min(1).max(4000).describe("Required missing information, up to 4000 characters. No credentials or secrets.") }).strict(),
  ]).describe("One answer matching the pending question kind. Clarification cannot consume an approval."),
}).strict();
const questionSchema = z.object({
  kind: z.enum(["choice", "text"]), question: z.string().trim().min(1).max(2000),
  candidates: z.array(candidate).max(10), requiredPermissions: z.array(z.string()).min(1).max(64),
}).strict().refine(v => v.kind === "choice" ? v.candidates.length > 0 : v.candidates.length === 0, "Question kind/candidates mismatch");
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Input = typeof aiRunInput.$inferSelect;
type Run = typeof aiRun.$inferSelect;
const permitted = (ctx: AuthContext, p: string) => hasPermission(ctx.permissions ?? ctx.role, p);
const visible = (ctx: AuthContext, required: string[]) => required.length > 0 && required.every(p => ALL_PERMISSIONS.includes(p) && permitted(ctx, p));

// Reload records under live domain permissions. Persist only type/UUID pairs,
// never model-supplied labels, links, amounts or authority. Labels are plain text.
async function resolveCandidate(tx: Tx, ctx: AuthContext, ref: AiInputCandidate) {
  if (!permitted(ctx, "view:data")) return null;
  if (ref.type === "contact") {
    const [r] = await tx.select({ id: contact.id, name: contact.name }).from(contact).where(and(eq(contact.id, ref.id), eq(contact.organizationId, ctx.organizationId), isNull(contact.deletedAt))).for("share");
    if (r) return { ...ref, label: boundedPayload(r.name.slice(0, 200)).value as string, href: `/contacts/${r.id}` };
  } else if (ref.type === "journal_entry") {
    const [r] = await tx.select({ id: journalEntry.id, number: journalEntry.entryNumber, status: journalEntry.status }).from(journalEntry).where(and(eq(journalEntry.id, ref.id), eq(journalEntry.organizationId, ctx.organizationId), isNull(journalEntry.deletedAt))).for("share");
    if (r) return { ...ref, label: String(r.number), status: r.status, href: `/accounting/${r.id}` };
  } else if (ref.type === "expense_claim" && permitted(ctx, "manage:expenses")) {
    const [r] = await tx.select({ id: expenseClaim.id, title: expenseClaim.title, status: expenseClaim.status }).from(expenseClaim).where(and(eq(expenseClaim.id, ref.id), eq(expenseClaim.organizationId, ctx.organizationId), isNull(expenseClaim.deletedAt))).for("share");
    if (r) return { ...ref, label: boundedPayload(r.title.slice(0, 200)).value as string, status: r.status, href: `/purchases/expenses/${r.id}` };
  }
  return null;
}

async function lockedRun(tx: Tx, ctx: AuthContext, runId: string, write: boolean) {
  const scope = and(eq(aiRun.id, runId), eq(aiRun.organizationId, ctx.organizationId), eq(aiRun.ownerId, ctx.userId));
  const [found] = await tx.select({ conversationId: aiRun.conversationId }).from(aiRun).where(scope);
  if (!found) throw new AuthError("Run not found or expired", 404);
  const [c] = await tx.select().from(aiConversation).where(and(eq(aiConversation.id, found.conversationId), eq(aiConversation.organizationId, ctx.organizationId), eq(aiConversation.ownerId, ctx.userId))).for("share");
  if (!c || c.deletedAt || c.contentExpiresAt.getTime() <= Date.now()) throw new AuthError("Run not found or expired", 404);
  const [run] = await tx.select().from(aiRun).where(scope).for(write ? "update" : "share");
  if (!run) throw new AuthError("Run not found or expired", 404);
  return { run, conversation: c };
}
async function notify(tx: Tx, run: Run, state: Run["state"], kind: string) {
  await tx.update(aiRun).set({ state, version: run.version + 1, leaseOwner: null, leaseExpiresAt: null, updatedAt: new Date() }).where(eq(aiRun.id, run.id));
  await tx.insert(aiEvent).values({ runId: run.id, organizationId: run.organizationId, ownerId: run.ownerId, sequence: run.version + 1, kind });
}
const receipt = (row: Input) => ({ runId: row.runId, inputId: row.id, inputVersion: row.inputVersion, acceptedRunVersion: row.acceptedRunVersion!, code: "ANSWER_ACCEPTED" as const });

/** Internal trusted-worker primitive. A live fenced lease and expected run version
 * are mandatory. This is never registered as a client/model-callable operation. */
export async function requestRunInput(runId: string, leaseToken: string, expectedRunVersion: number, input: unknown) {
  const value = questionSchema.parse(input);
  version.parse(expectedRunVersion);
  if (value.requiredPermissions.some(p => !ALL_PERMISSIONS.includes(p))) throw new AuthError("Invalid question permissions", 400);
  const lease = await assertRunLease(runId, leaseToken);
  return db.transaction(async tx => {
    const { run, conversation } = await lockedRun(tx, lease.ctx, runId, true);
    // Recheck after lock waits. Never suspend in-flight/uncertain operations or
    // leave a prepared action/approval that an answer could accidentally replay.
    if (run.state !== "running" || run.version !== expectedRunVersion || run.leaseOwner !== leaseToken || !run.leaseExpiresAt || run.leaseExpiresAt.getTime() <= Date.now() || !run.deadlineAt || run.deadlineAt.getTime() <= Date.now() || run.cancelRequestedAt) throw new AuthError("Run input state conflict", 409);
    assertRuntimeEnabled();
    const actor = await validateRunSnapshot(run);
    if (!visible(actor, value.requiredPermissions)) throw new AuthError("Question access denied", 403);
    const unfinished = await tx.select({ id: aiStep.id }).from(aiStep).where(and(eq(aiStep.runId, run.id), sql`${aiStep.state} in ('prepared','executing','uncertain')`)).limit(1);
    const unsettled = await tx.select({ id: aiUsageAttempt.id }).from(aiUsageAttempt).where(and(eq(aiUsageAttempt.runId, run.id), sql`${aiUsageAttempt.state} in ('reserved','in_flight','unknown')`)).limit(1);
    if (unfinished.length || unsettled.length) throw new AuthError("Run requires effect or usage reconciliation", 409);
    const [previous] = await tx.select({ version: aiRunInput.inputVersion }).from(aiRunInput).where(eq(aiRunInput.runId, run.id)).orderBy(desc(aiRunInput.inputVersion)).limit(1);
    const inputVersion = (previous?.version ?? 0) + 1;
    if (inputVersion > 20) throw new AuthError("Run question limit exceeded", 413);
    if (new Set(value.candidates.map(c => `${c.type}:${c.id}`)).size !== value.candidates.length) throw new AuthError("Duplicate input candidates", 400);
    // Fixed order avoids opposite-order share lock acquisition in future resolvers.
    for (const ref of [...value.candidates].sort((a, b) => a.id.localeCompare(b.id))) if (!await resolveCandidate(tx, actor, ref)) throw new AuthError("Candidate not accessible", 409);
    const fresh = await validateRunSnapshot(run);
    if (!visible(fresh, value.requiredPermissions) || value.candidates.some(c => !permitted(fresh, "view:data") || c.type === "expense_claim" && !permitted(fresh, "manage:expenses"))) throw new AuthError("Question access denied", 403);
    assertRuntimeEnabled();
    if (run.leaseExpiresAt.getTime() <= Date.now() || run.deadlineAt.getTime() <= Date.now()) throw new AuthError("Run lease expired", 409);
    const question = boundedPayload(value.question), bytes = Buffer.byteLength(JSON.stringify({ question, candidates: value.candidates }));
    if (run.payloadBytes + bytes > 1048576) throw new AuthError("Run payload limit exceeded", 413);
    const [row] = await tx.insert(aiRunInput).values({ runId, organizationId: run.organizationId, ownerId: run.ownerId, inputVersion, kind: value.kind, question, candidates: value.candidates,
      requiredPermissions: value.requiredPermissions, expiresAt: new Date(Math.min(Date.now() + 86400000, conversation.contentExpiresAt.getTime(), run.deadlineAt.getTime())) }).returning();
    await tx.update(aiRun).set({ payloadBytes: run.payloadBytes + bytes }).where(eq(aiRun.id, run.id));
    await notify(tx, run, "awaiting_input", "awaiting_input");
    return { inputId: row.id, inputVersion, runVersion: run.version + 1 };
  });
}

/** Observation works while runtime is off; all text and choices require live access. */
export async function getRunInput(ctx: AuthContext, input: unknown) {
  const value = getRunInputSchema.parse(input), identity = executionIdentity(ctx);
  const current = await authorizeExecution(identity, ctx.organizationId, "view:ai-history");
  return db.transaction(async tx => {
    const { run } = await lockedRun(tx, current, value.runId, false);
    const actor = await authorizeExecution(identity, current.organizationId, "view:ai-history");
    const base = { runId: run.id, runVersion: run.version, state: run.state };
    if (run.state !== "awaiting_input" || run.cancelRequestedAt) return { ...base, code: "NO_PENDING_INPUT", input: null };
    const [row] = await tx.select().from(aiRunInput).where(and(eq(aiRunInput.runId, run.id), eq(aiRunInput.state, "pending")));
    if (!row || !row.question || row.expiresAt.getTime() <= Date.now() || !run.deadlineAt || run.deadlineAt.getTime() <= Date.now()) return { ...base, code: "INPUT_EXPIRED", input: null };
    if (!visible(actor, row.requiredPermissions)) return { ...base, code: "INPUT_RESTRICTED", input: null };
    const candidates = [];
    for (const ref of row.candidates ?? []) { const resolved = await resolveCandidate(tx, actor, ref); if (resolved) candidates.push(resolved); }
    const fresh = await authorizeExecution(identity, current.organizationId, "view:ai-history");
    if (!visible(fresh, row.requiredPermissions) || (row.candidates ?? []).some(c => !permitted(fresh, "view:data") || c.type === "expense_claim" && !permitted(fresh, "manage:expenses"))) return { ...base, code: "INPUT_RESTRICTED", input: null };
    if (row.expiresAt.getTime() <= Date.now() || run.deadlineAt.getTime() <= Date.now()) return { ...base, code: "INPUT_EXPIRED", input: null };
    // A partially restricted candidate set could mislead the user; fail closed.
    if (row.kind === "choice" && (!candidates.length || candidates.length !== row.candidates?.length)) return { ...base, code: "INPUT_RESTRICTED", input: null };
    return { ...base, code: "INPUT_REQUIRED", input: { id: row.id, inputVersion: row.inputVersion, kind: row.kind, question: row.question.value, candidates, expiresAt: row.expiresAt, authority: "clarification_only" } };
  });
}

/** Atomically record one answer and enqueue the same run. Does not execute tools,
 * consume approvals, reset counters/deadlines, or turn a transcript into authority. */
export async function answerRunInput(ctx: AuthContext, input: unknown) {
  const value = answerRunInputSchema.parse(input), identity = executionIdentity(ctx);
  const current = await authorizeExecution(identity, ctx.organizationId, "use:ai");
  const digest = createHash("sha256").update(JSON.stringify(value.answer)).digest("hex");
  return db.transaction(async tx => {
    const { run } = await lockedRun(tx, current, value.runId, true);
    const actor = await authorizeExecution(identity, current.organizationId, "use:ai");
    await authorizeExecution(identity, current.organizationId, "view:ai-history");
    const [row] = await tx.select().from(aiRunInput).where(and(eq(aiRunInput.id, value.inputId), eq(aiRunInput.runId, run.id))).for("update");
    if (!row || row.inputVersion !== value.inputVersion) throw new AuthError("Input version conflict", 409);
    if (row.state === "answered") {
      if (row.answerKey !== value.requestKey || row.answerDigest !== digest || row.acceptedRunVersion !== value.expectedRunVersion + 1) throw new AuthError("Answer key or version conflict", 409);
      return receipt(row); // Historical receipt only: never enqueue again.
    }
    if (run.state !== "awaiting_input" || run.version !== value.expectedRunVersion || run.cancelRequestedAt || row.state !== "pending" || row.expiresAt.getTime() <= Date.now() || !run.deadlineAt || run.deadlineAt.getTime() <= Date.now()) throw new AuthError("Input no longer answerable", 409);
    assertRuntimeEnabled();
    await validateRunSnapshot(run); // Recheck original identity and immutable snapshots.
    if (!visible(actor, row.requiredPermissions)) throw new AuthError("Question access denied", 403);
    if (row.kind !== value.answer.kind || !row.question || !row.candidates) throw new AuthError("Answer does not match pending input", 400);
    if (value.answer.kind === "choice") {
      const chosen = value.answer.candidate;
      if (!row.candidates.some(c => c.type === chosen.type && c.id === chosen.id) || !await resolveCandidate(tx, actor, chosen)) throw new AuthError("Candidate not accessible or not offered", 409);
    }
    // Fail closed even if an internal storage-only caller left an unsafe state.
    const unsafe = await tx.select({ id: aiStep.id }).from(aiStep).where(and(eq(aiStep.runId, run.id), sql`${aiStep.state} in ('prepared','executing','uncertain')`)).limit(1);
    const unsettled = await tx.select({ id: aiUsageAttempt.id }).from(aiUsageAttempt).where(and(eq(aiUsageAttempt.runId, run.id), sql`${aiUsageAttempt.state} in ('reserved','in_flight','unknown')`)).limit(1);
    if (unsafe.length || unsettled.length) throw new AuthError("Run requires reconciliation", 409);
    const fresh = await authorizeExecution(identity, current.organizationId, "use:ai");
    await authorizeExecution(identity, current.organizationId, "view:ai-history");
    await validateRunSnapshot(run);
    if (!visible(fresh, row.requiredPermissions) || value.answer.kind === "choice" && (!permitted(fresh, "view:data") || value.answer.candidate.type === "expense_claim" && !permitted(fresh, "manage:expenses"))) throw new AuthError("Question access denied", 403);
    assertRuntimeEnabled();
    if (row.expiresAt.getTime() <= Date.now() || run.deadlineAt.getTime() <= Date.now()) throw new AuthError("Input expired", 409);
    const answer = boundedPayload(value.answer), bytes = Buffer.byteLength(JSON.stringify(answer));
    if (run.payloadBytes + bytes > 1048576) throw new AuthError("Run payload limit exceeded", 413);
    const [accepted] = await tx.update(aiRunInput).set({ state: "answered", answer, answerKey: value.requestKey, answerDigest: digest, acceptedRunVersion: run.version + 1, answeredAt: new Date() }).where(eq(aiRunInput.id, row.id)).returning();
    await tx.update(aiRun).set({ payloadBytes: run.payloadBytes + bytes }).where(eq(aiRun.id, run.id));
    await notify(tx, run, "queued", "input_answered");
    await tx.insert(auditLog).values({ organizationId: actor.organizationId, userId: actor.userId, action: "ai.run.input_answered", entityType: "ai-run", entityId: run.id, changes: null });
    return receipt(accepted);
  });
}
