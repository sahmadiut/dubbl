import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { aiConversation, aiEvent, aiRun, aiStep, aiProviderAttempt, aiProviderCall, auditLog, type AiPayload } from "@/lib/db/schema";
import { AuthError } from "@/lib/api/auth-context";
import { requireRole } from "@/lib/api/require-role";
import { boundedPayload } from "./persistence";
import { assertRuntimeEnabled, validateRunSnapshot } from "./run-lifecycle";
import { catalogEntry } from "./tool-catalog";
import { discoverTools, dispatchAgentTool, type ToolDispatchOutcome } from "./tool-registry";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Run = typeof aiRun.$inferSelect;
type Step = typeof aiStep.$inferSelect;
const uuid = z.string().uuid();
// Room for the bounded result envelope as well as the reviewed result limit.
const RESULT_RESERVE = 40000;

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") return `{${Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b, "en")).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  return JSON.stringify(value);
}
function argumentsFor(name: string, input: unknown) {
  const entry = catalogEntry(name);
  if (!entry) throw new AuthError("Tool not allowed", 403);
  const value = entry.schema.parse(input), text = canonical(value);
  if (Buffer.byteLength(text) > 65536) throw new AuthError("Tool input exceeds limit", 413);
  const display = boundedPayload(value);
  if (display.truncated) throw new AuthError("Tool input exceeds display limit", 413);
  // Bind the ORIGINAL validated arguments, not their redacted display form.
  const digest = createHash("sha256").update(canonical({ name, version: entry.version, arguments: value })).digest("hex");
  return { entry, value, display, digest };
}
/** Shared binding for durable provider-call associations; no dispatch authority. */
export const toolArgumentDigest = (name: string, input: unknown) => argumentsFor(name, input).digest;
async function lockRun(tx: Tx, runId: string) {
  const [found] = await tx.select({ conversationId: aiRun.conversationId }).from(aiRun).where(eq(aiRun.id, uuid.parse(runId)));
  if (!found) throw new AuthError("Run not found", 404);
  // Same order as deletion, clarification and progress; never hold a transaction
  // while the domain tool is executing on its own connection.
  const [conversation] = await tx.select().from(aiConversation).where(eq(aiConversation.id, found.conversationId)).for("share");
  const [run] = await tx.select().from(aiRun).where(eq(aiRun.id, runId)).for("update");
  if (!run || !conversation) throw new AuthError("Run not found", 404);
  return { run, conversation };
}
function executable(run: Run, lease: string) {
  assertRuntimeEnabled();
  if (run.state !== "running" || run.leaseOwner !== lease || !run.leaseExpiresAt || run.leaseExpiresAt.getTime() <= Date.now() ||
    !run.deadlineAt || run.deadlineAt.getTime() <= Date.now() || run.cancelRequestedAt) throw new AuthError("Run lease no longer executable", 409);
}
async function authorize(run: Run, lease: string, name: string) {
  executable(run, lease);
  const ctx = await validateRunSnapshot(run), entry = catalogEntry(name);
  const tools = await discoverTools({ identity: run.identity, organizationId: run.organizationId, agentId: "default" });
  if (!entry || !tools.tools.some(t => t.name === name)) throw new AuthError("Tool denied by current policy", 403);
  requireRole(ctx, entry.permission);
  executable(run, lease); // Identity/configuration reads may have waited.
  return ctx;
}
async function notify(tx: Tx, run: Run, kind: "step_prepared" | "step_updated", extra: Partial<typeof aiRun.$inferInsert> = {}) {
  await tx.update(aiRun).set({ ...extra, version: run.version + 1, updatedAt: new Date() }).where(eq(aiRun.id, run.id));
  await tx.insert(aiEvent).values({ runId: run.id, organizationId: run.organizationId, ownerId: run.ownerId, sequence: run.version + 1, kind });
}
function binding(step: Step, name: string, digest: string) {
  if (step.toolName !== name || step.argumentDigest !== digest) throw new AuthError("Operation key conflicts with original arguments", 409);
}
const receipt = (step: Step) => ({ stepId: step.id, state: step.state, version: step.version, recordIds: step.recordIds });

/** Trusted worker only. Keys come from the durable executor, never a public/model
 * identity field. Saved redacted input is display data, never replay authority. */
export async function prepareToolOperation(runId: string, lease: string, operationKey: string, name: string, input: unknown) {
  uuid.parse(lease); uuid.parse(operationKey);
  const args = argumentsFor(name, input);
  return db.transaction(async tx => {
    const { run, conversation } = await lockRun(tx, runId);
    if (conversation.deletedAt || conversation.contentExpiresAt.getTime() <= Date.now()) throw new AuthError("Conversation expired", 409);
    await authorize(run, lease, name);
    const [activeProvider] = await tx.select({ id: aiProviderAttempt.id }).from(aiProviderAttempt).where(and(eq(aiProviderAttempt.runId, runId), sql`${aiProviderAttempt.state} in ('reserved','dispatched')`)).limit(1);
    if (activeProvider) throw new AuthError("Provider attempt is unfinished", 409);
    const [call] = await tx.select().from(aiProviderCall).where(and(eq(aiProviderCall.runId, runId), eq(aiProviderCall.operationKey, operationKey)));
    if (call && (call.toolName !== name || call.catalogVersion !== args.entry.version || call.argumentDigest !== args.digest)) throw new AuthError("Provider call binding changed", 409);
    const [prior] = await tx.select().from(aiStep).where(and(eq(aiStep.runId, runId), eq(aiStep.operationKey, operationKey)));
    if (prior) { binding(prior, name, args.digest); return prior; }
    const [unfinished] = await tx.select({ id: aiStep.id }).from(aiStep).where(and(eq(aiStep.runId, runId), sql`${aiStep.state} in ('executing','uncertain')`)).limit(1);
    if (unfinished) throw new AuthError("Run requires operation reconciliation", 409);
    const [{ count }] = await tx.select({ count: sql<number>`count(*)::int` }).from(aiStep).where(eq(aiStep.runId, runId));
    if (count >= 20) throw new AuthError("Run step limit exceeded", 413);
    const bytes = Buffer.byteLength(JSON.stringify(args.display));
    if (run.payloadBytes + bytes + RESULT_RESERVE > 1048576) throw new AuthError("Run payload limit exceeded", 413);
    executable(run, lease);
    const [step] = await tx.insert(aiStep).values({ runId, organizationId: run.organizationId, ownerId: run.ownerId, operationKey, toolName: name,
      argumentDigest: args.digest, input: args.display, requiredPermissions: [args.entry.permission] }).returning();
    await notify(tx, run, "step_prepared", { payloadBytes: run.payloadBytes + bytes });
    return step;
  });
}

/** Only known envelope fields returned by the real registered tool may establish
 * provenance. Model arguments, narrative URLs and nested arbitrary IDs cannot. */
function recordIds(name: string, outcome: ToolDispatchOutcome): string[] {
  if (outcome.status !== "succeeded" || !outcome.data || typeof outcome.data !== "object") return [];
  const data = outcome.data as Record<string, unknown>;
  const field = name.includes("contact") ? name === "list_contacts" ? "contacts" : "contact"
    : name.includes("entry") || name === "list_entries" ? name === "list_entries" ? "entries" : "entry"
      : name === "list_expense_claims" ? "expenseClaims" : "expenseClaim";
  const rows = Array.isArray(data[field]) ? data[field] : [data[field]];
  const ids = rows.flatMap(row => row && typeof row === "object" && "id" in row && uuid.safeParse(row.id).success ? [String(row.id)] : []);
  // The registry's oversized-result envelope is itself produced by trusted code.
  if (data.outputOmitted === true && Array.isArray(data.recordIds)) ids.push(...data.recordIds.filter(v => uuid.safeParse(v).success) as string[]);
  return [...new Set(ids)].slice(0, 100);
}

async function settle(runId: string, lease: string, stepId: string, outcome: ToolDispatchOutcome) {
  return db.transaction(async tx => {
    const { run, conversation } = await lockRun(tx, runId);
    const [step] = await tx.select().from(aiStep).where(and(eq(aiStep.id, stepId), eq(aiStep.runId, runId))).for("update");
    if (!step) throw new AuthError("Operation not found", 404);
    // A late callback cannot overwrite recovery or restore a lost lease. A known
    // result can still settle while cancellation/revocation/deadline is in flight,
    // provided no recovery/successor has taken ownership. This starts no action.
    if (run.state !== "running" || run.leaseOwner !== lease || step.dispatchLease !== lease || step.state !== "executing" || conversation.deletedAt || conversation.contentExpiresAt.getTime() <= Date.now()) return receipt(step);
    let result: AiPayload | null = boundedPayload({ code: outcome.code ?? (outcome.status === "succeeded" ? "TOOL_COMPLETED" : "TOOL_FAILED"), untrusted: true, data: outcome.data ?? null });
    if (result.truncated || Buffer.byteLength(JSON.stringify(result)) > RESULT_RESERVE) result = boundedPayload({ code: "OUTPUT_OMITTED", untrusted: true });
    let bytes = Buffer.byteLength(JSON.stringify(result));
    if (run.payloadBytes + bytes > 1048576) { result = null; bytes = 0; }
    const [updated] = await tx.update(aiStep).set({ state: outcome.status, result, recordIds: recordIds(step.toolName, outcome), version: step.version + 1, updatedAt: new Date() }).where(eq(aiStep.id, step.id)).returning();
    const uncertain = outcome.status === "uncertain";
    const cancelled = !!run.cancelRequestedAt && !uncertain;
    await notify(tx, run, "step_updated", { payloadBytes: run.payloadBytes + bytes,
      ...(uncertain || cancelled ? { state: uncertain ? "reconciliation_required" : "cancelled", leaseOwner: null, leaseExpiresAt: null, finishedAt: cancelled ? new Date() : null } : {}) });
    return receipt(updated);
  });
}

/** Execute at most once per operation key through the actual registered MCP
 * tool. The caller supplies complete original arguments again, never saved text.
 * No public REST/MCP tool can invoke this function or forge a settlement. */
export async function executeToolOperation(runId: string, lease: string, operationKey: string, name: string, input: unknown) {
  const args = argumentsFor(name, input), step = await prepareToolOperation(runId, lease, operationKey, name, args.value);
  if (step.state !== "prepared") return receipt(step);
  let dispatched = false;
  const [run] = await db.select().from(aiRun).where(eq(aiRun.id, runId));
  const outcome = await dispatchAgentTool({ identity: run.identity, organizationId: run.organizationId, agentId: "default" }, name, args.value, async () => {
    await db.transaction(async tx => {
      const { run, conversation } = await lockRun(tx, runId);
      if (conversation.deletedAt || conversation.contentExpiresAt.getTime() <= Date.now()) throw new AuthError("Conversation expired", 409);
      await authorize(run, lease, name);
      const [current] = await tx.select().from(aiStep).where(and(eq(aiStep.id, step.id), eq(aiStep.runId, runId))).for("update");
      binding(current, name, args.digest);
      if (current.state !== "prepared") throw new AuthError("Operation already dispatched or closed", 409);
      const [unfinished] = await tx.select({ id: aiStep.id }).from(aiStep).where(and(eq(aiStep.runId, runId), sql`${aiStep.state} in ('executing','uncertain')`)).limit(1);
      if (unfinished) throw new AuthError("Run requires operation reconciliation", 409);
      if (run.payloadBytes + RESULT_RESERVE > 1048576) throw new AuthError("Run payload limit exceeded", 413);
      executable(run, lease);
      await tx.update(aiStep).set({ state: "executing", dispatchLease: lease, version: current.version + 1, updatedAt: new Date() }).where(eq(aiStep.id, step.id));
      await notify(tx, run, "step_updated");
      await tx.insert(auditLog).values({ organizationId: run.organizationId, userId: run.ownerId, action: "ai.tool.dispatch", entityType: `ai-tool:${name}`, entityId: step.id, changes: null });
      // Event/audit foreign-key locks can wait behind a domain transaction.
      // Validate again after every such wait before committing dispatch authority.
      await authorize(run, lease, name);
      if (conversation.contentExpiresAt.getTime() <= Date.now()) throw new AuthError("Conversation expired", 409);
    });
    dispatched = true;
  });
  if (!dispatched) {
    // A competing executor or failed last-moment guard cannot settle the winner.
    const [current] = await db.select().from(aiStep).where(eq(aiStep.id, step.id));
    return receipt(current);
  }
  return settle(runId, lease, step.id, outcome);
}
