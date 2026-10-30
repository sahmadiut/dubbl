import { createHash, randomUUID } from "node:crypto";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { aiActionBatch, aiConversation, aiRun, aiStep, aiUsageAttempt, aiRunInput, aiEvent } from "@/lib/db/schema";
import { AuthError, type AuthContext } from "@/lib/api/auth-context";
import { authorizeExecution, executionIdentity } from "@/lib/api/execution-identity";
import { requireRole } from "@/lib/api/require-role";
import { assertRunLease, assertRuntimeEnabled, validateRunSnapshot } from "./run-lifecycle";
import { actionItemSchema, adapterVersion, observeAction, actionResource, actionPermissions, type ActionItem } from "./action-adapters";

const id = z.string().uuid().describe("Opaque own-run, proposal, item or organization-owned journal UUID.");
const version = z.number().int().positive().max(2147483647);
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const key = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/).describe("Unique proposal/revision idempotency key; replay identical input after a lost response.");
const item = actionItemSchema;
const specFields = {
  requestKey: key,
  items: z.array(item).min(1).max(10).describe("Complete proposed effect set, at most ten distinct existing resources from the finite journal/settlement/invoice-email adapters; never hidden or truncated."),
  selectedItemIds: z.array(id).max(10).describe("Explicit selection; use [] for an initially unselected proposal. Selected dependencies must also be selected. Selection is not approval."),
};
export const actionBatchSpecSchema = z.object(specFields).strict();
export const getActionBatchSchema = z.object({ runId: id }).strict();
export const reviseActionBatchSchema = z.object({ runId: id, batchId: id.describe("Exact pending batch UUID from get_ai_action_batch."),
  expectedVersion: version.describe("Exact pending batch version; every revision replaces it."),
  expectedRunVersion: version.describe("Exact observed run version; stale revisions conflict."), ...specFields }).strict();
type Spec = z.infer<typeof actionBatchSpecSchema>;
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Run = typeof aiRun.$inferSelect;
type Batch = typeof aiActionBatch.$inferSelect;
const authorityFields = { stepId: id, stepVersion: z.literal(1), adapterVersion: z.union([z.literal(1), z.literal(2)]), resourceVersion: digest, policyVersion: digest.optional() };
const authorityItem = z.discriminatedUnion("action", [item.options[0].extend(authorityFields), item.options[1].extend(authorityFields), item.options[2].extend(authorityFields), item.options[3].extend(authorityFields)]);
const authoritySchema = z.object({ items: z.array(authorityItem).min(1).max(10), selectedItemIds: z.array(id).max(10) }).strict();

type Authority = z.infer<typeof authoritySchema>;
type Preview = NonNullable<Awaited<ReturnType<typeof observeAction>>["preview"]>;
type Display = { items: { itemId: string; stepId: string; selected: boolean; dependsOn: string[]; preview: Preview }[]; totals: { currencyCode: string; debitAmountMinor: string; creditAmountMinor: string }[] };
type Code = "BATCH_DENIED" | "BATCH_NOT_FOUND" | "BATCH_STALE" | "BATCH_EXPIRED" | "BATCH_CONFLICT" | "BATCH_INVALID" | "BATCH_LIMIT" | "BATCH_DISABLED" | "BATCH_CONFIGURATION_CHANGED" | "BATCH_UNAVAILABLE";
class Failure extends Error { constructor(readonly code: Code) { super(code); } }
function fail(code: Code): never { throw new Failure(code); }
function unavailable(code: Code) { return { code, batch: null, recovery: code === "BATCH_DENIED" ? ["contact_administrator"] : code === "BATCH_STALE" || code === "BATCH_CONFLICT" ? ["refresh_preview"] : ["inspect_run", "cancel_run"] }; }
async function safe<T>(fn: () => Promise<T>) {
  try { return await fn(); } catch (err) {
    if (err instanceof Failure) return unavailable(err.code);
    if (err instanceof AuthError) return unavailable("BATCH_DENIED");
    throw err;
  }
}
// Canonical JSON survives JSONB property reordering. Never hash redacted display
// as a substitute for the original validated arguments.
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b, "en")).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  return JSON.stringify(value);
}
const hash = (value: unknown) => createHash("sha256").update(canonical(value)).digest("hex");
const argumentHash = (i: z.infer<typeof item>) => hash({ name: i.action, version: 1, arguments: i.arguments });
function normalized(spec: Spec): Spec {
  const items = spec.items.map(i => ({ ...i, dependsOn: [...i.dependsOn].sort() })).sort((a, b) => a.itemId.localeCompare(b.itemId));
  const selectedItemIds = [...spec.selectedItemIds].sort(), ids = new Set(items.map(i => i.itemId));
  if (ids.size !== items.length || new Set(items.map(actionResource)).size !== items.length || new Set(selectedItemIds).size !== selectedItemIds.length || selectedItemIds.some(i => !ids.has(i))) fail("BATCH_INVALID");
  const visiting = new Set<string>(), visited = new Set<string>();
  function visit(i: typeof items[number]) {
    if (visiting.has(i.itemId)) fail("BATCH_INVALID");
    if (visited.has(i.itemId)) return;
    visiting.add(i.itemId);
    if (new Set(i.dependsOn).size !== i.dependsOn.length) fail("BATCH_INVALID");
    for (const dep of i.dependsOn) {
      const prerequisite = items.find(x => x.itemId === dep);
      if (!prerequisite || selectedItemIds.includes(i.itemId) && !selectedItemIds.includes(dep)) fail("BATCH_INVALID");
      visit(prerequisite);
    }
    visiting.delete(i.itemId); visited.add(i.itemId);
  }
  items.forEach(visit);
  return { requestKey: spec.requestKey, items, selectedItemIds };
}
async function actor(ctx: AuthContext, write: boolean, items: Pick<ActionItem, "action">[] = []) {
  const current = await authorizeExecution(executionIdentity(ctx), ctx.organizationId, "view:ai-history");
  requireRole(current, "use:ai"); requireRole(current, "view:data");
  for (const item of items) for (const permission of actionPermissions(item.action)) requireRole(current, permission);
  if (write) { try { assertRuntimeEnabled(); } catch { fail("BATCH_DISABLED"); } }
  return current;
}
async function locked(tx: Tx, ctx: AuthContext, runId: string, write: boolean) {
  const scope = and(eq(aiRun.id, runId), eq(aiRun.organizationId, ctx.organizationId), eq(aiRun.ownerId, ctx.userId));
  const [found] = await tx.select({ conversationId: aiRun.conversationId }).from(aiRun).where(scope);
  if (!found) fail("BATCH_NOT_FOUND");
  const [conversation] = await tx.select().from(aiConversation).where(and(eq(aiConversation.id, found.conversationId), eq(aiConversation.organizationId, ctx.organizationId), eq(aiConversation.ownerId, ctx.userId))).for("share");
  if (!conversation || conversation.deletedAt || conversation.contentExpiresAt.getTime() <= Date.now()) fail("BATCH_NOT_FOUND");
  const [run] = await tx.select().from(aiRun).where(scope).for(write ? "update" : "share");
  if (!run) fail("BATCH_NOT_FOUND");
  return { run, conversation };
}
async function writable(run: Run, ctx: AuthContext, items: Pick<ActionItem, "action">[] = []) {
  await actor(ctx, true, items);
  try { await validateRunSnapshot(run); } catch { fail("BATCH_CONFIGURATION_CHANGED"); }
  if (!run.deadlineAt || run.deadlineAt.getTime() <= Date.now()) fail("BATCH_EXPIRED");
  if (run.cancelRequestedAt) fail("BATCH_UNAVAILABLE");
}
function binding(row: Pick<Batch, "id" | "runId" | "ownerId" | "organizationId" | "version" | "expiresAt" | "authority" | "display">) {
  return hash({ id: row.id, runId: row.runId, ownerId: row.ownerId, organizationId: row.organizationId, version: row.version, expiresAt: row.expiresAt.toISOString(), authority: row.authority, display: row.display });
}
const receipt = (r: Batch) => ({ code: "BATCH_PREVIEW_RECORDED" as const, runId: r.runId, batchId: r.id, version: r.version, acceptedRunVersion: r.acceptedRunVersion, authority: "preview_only" as const });
async function snapshot(ctx: AuthContext, spec: Spec) {
  const items: Authority["items"] = [], display: Display = { items: [], totals: [] }, totals = new Map<string, { debit: bigint; credit: bigint }>();
  for (const item of spec.items) {
    const observed = await observeAction(ctx, item);
    if (!observed.preview) fail(observed.code === "PREVIEW_DENIED" ? "BATCH_DENIED" : "BATCH_STALE");
    const preview = observed.preview, stepId = randomUUID(), selected = spec.selectedItemIds.includes(item.itemId);
    items.push({ ...item, stepId, stepVersion: 1, adapterVersion: adapterVersion(item.action), resourceVersion: preview.resourceVersion, policyVersion: preview.businessApproval.policyVersion });
    display.items.push({ itemId: item.itemId, stepId, selected, dependsOn: item.dependsOn, preview });
    if (selected && item.action !== "delete_draft_journal") for (const amount of preview.amounts) {
      const t = totals.get(amount.currencyCode) ?? { debit: 0n, credit: 0n };
      t.debit += BigInt(amount.debitAmountMinor); t.credit += BigInt(amount.creditAmountMinor); totals.set(amount.currencyCode, t);
    }
  }
  display.totals = [...totals].sort(([a], [b]) => a.localeCompare(b)).map(([currencyCode, t]) => ({ currencyCode, debitAmountMinor: String(t.debit), creditAmountMinor: String(t.credit) }));
  const authority: Authority = { items, selectedItemIds: spec.selectedItemIds };
  // Allow JSONB's additional whitespace within the corresponding DB limits.
  if (Buffer.byteLength(JSON.stringify(authority)) > 24000 || Buffer.byteLength(JSON.stringify(display)) > 48000) fail("BATCH_LIMIT");
  return { authority, display };
}
async function persist(tx: Tx, run: Run, ctx: AuthContext, spec: Spec, expiresAt: Date, nextVersion: number, requestDigest: string) {
  const oldSteps = await tx.select({ id: aiStep.id, state: aiStep.state }).from(aiStep).where(eq(aiStep.runId, run.id));
  const [unsettled] = await tx.select({ id: aiUsageAttempt.id }).from(aiUsageAttempt).where(and(eq(aiUsageAttempt.runId, run.id), sql`${aiUsageAttempt.state} in ('reserved','in_flight','unknown')`)).limit(1);
  const [input] = await tx.select({ id: aiRunInput.id }).from(aiRunInput).where(and(eq(aiRunInput.runId, run.id), eq(aiRunInput.state, "pending"))).limit(1);
  if (oldSteps.some(s => s.state === "executing" || s.state === "uncertain") || unsettled || input) fail("BATCH_UNAVAILABLE");
  if (oldSteps.length + spec.items.length > 20 || nextVersion > 20) fail("BATCH_LIMIT");
  const data = await snapshot(ctx, spec);
  for (const item of data.display.items) item.preview.expiresAt = expiresAt.toISOString();
  const bytes = Buffer.byteLength(JSON.stringify(data));
  if (run.payloadBytes + bytes > 1048576) fail("BATCH_LIMIT");
  await writable(run, ctx, spec.items);
  if (expiresAt.getTime() <= Date.now()) fail("BATCH_EXPIRED");
  const row = { id: randomUUID(), runId: run.id, ownerId: run.ownerId, organizationId: run.organizationId, version: nextVersion, acceptedRunVersion: run.version + 1, expiresAt, ...data };
  const [batch] = await tx.insert(aiActionBatch).values({ ...row, requestKey: spec.requestKey, requestDigest, bindingDigest: binding(row) }).returning();
  for (const i of data.authority.items) await tx.insert(aiStep).values({ id: i.stepId, operationKey: i.stepId, runId: run.id, ownerId: run.ownerId, organizationId: run.organizationId,
    toolName: i.action, argumentDigest: argumentHash(i), input: null, requiredPermissions: actionPermissions(i.action) });
  await tx.update(aiRun).set({ state: "awaiting_approval", version: run.version + 1, payloadBytes: run.payloadBytes + bytes, leaseOwner: null, leaseExpiresAt: null, updatedAt: new Date() }).where(eq(aiRun.id, run.id));
  await tx.insert(aiEvent).values({ runId: run.id, ownerId: run.ownerId, organizationId: run.organizationId, sequence: run.version + 1, kind: "awaiting_approval" });
  // Inserts/unique constraints can wait too. Revocation or expiry during that
  // wait must roll the complete proposal transaction back before acknowledgement.
  await writable(run, ctx, spec.items);
  if (expiresAt.getTime() <= Date.now()) fail("BATCH_EXPIRED");
  return receipt(batch);
}

/** Trusted-worker primitive only: no REST/MCP/model creation capability.
 * This child stores observations; AI-043/044 own decisions and dispatch.
 */
export async function requestActionBatch(runId: string, leaseToken: string, expectedRunVersion: number, input: unknown) {
  const spec = normalized(actionBatchSpecSchema.parse(input)); version.parse(expectedRunVersion);
  if (spec.selectedItemIds.length) fail("BATCH_INVALID"); // A worker/model must never preselect sensitive effects.
  const lease = await assertRunLease(runId, leaseToken), current = await actor(lease.ctx, true);
  return db.transaction(async tx => {
    const { run, conversation } = await locked(tx, current, runId, true);
    if (run.state !== "running" || run.version !== expectedRunVersion || run.leaseOwner !== leaseToken || !run.leaseExpiresAt || run.leaseExpiresAt.getTime() <= Date.now()) fail("BATCH_CONFLICT");
    const [unfinished] = await tx.select({ id: aiStep.id }).from(aiStep).where(and(eq(aiStep.runId, run.id), eq(aiStep.state, "prepared"))).limit(1);
    const [existing] = await tx.select({ id: aiActionBatch.id }).from(aiActionBatch).where(eq(aiActionBatch.runId, run.id)).limit(1);
    if (unfinished || existing) fail("BATCH_CONFLICT");
    await writable(run, current);
    const expiry = new Date(Math.min(Date.now() + 300000, conversation.contentExpiresAt.getTime(), run.deadlineAt!.getTime()));
    const result = await persist(tx, run, current, spec, expiry, 1, hash(spec));
    if (run.leaseExpiresAt.getTime() <= Date.now()) fail("BATCH_CONFLICT");
    return result;
  });
}

/** Returns only one complete bounded stored display after live resource checks.
 * It never refreshes expiry, writes, approves, queues, dispatches or replays.
 */
export async function getActionBatch(ctx: AuthContext, input: unknown) {
  const value = getActionBatchSchema.parse(input);
  return safe(async () => {
    const current = await actor(ctx, false);
    return db.transaction(async tx => {
      const { run } = await locked(tx, current, value.runId, false);
      const [row] = await tx.select().from(aiActionBatch).where(eq(aiActionBatch.runId, run.id)).orderBy(desc(aiActionBatch.version)).limit(1);
      if (!row) fail("BATCH_NOT_FOUND");
      if (row.state === "expired" || row.expiresAt.getTime() <= Date.now() || !run.deadlineAt || run.deadlineAt.getTime() <= Date.now()) fail("BATCH_EXPIRED");
      if (row.state !== "pending" || run.state !== "awaiting_approval" || run.cancelRequestedAt) fail("BATCH_UNAVAILABLE");
      if (!row.authority || !row.display || binding(row) !== row.bindingDigest) fail("BATCH_UNAVAILABLE");
      const parsed = authoritySchema.safeParse(row.authority);
      if (!parsed.success) fail("BATCH_UNAVAILABLE");
      const authority = parsed.data;
      normalized({ ...authority, requestKey: row.requestKey });
      for (const i of authority.items) {
        if (i.adapterVersion !== adapterVersion(i.action) || !i.policyVersion) fail("BATCH_STALE");
        const [step] = await tx.select().from(aiStep).where(and(eq(aiStep.id, i.stepId), eq(aiStep.runId, run.id), eq(aiStep.organizationId, current.organizationId), eq(aiStep.ownerId, current.userId)));
        if (!step || step.state !== "prepared" || step.version !== i.stepVersion || step.toolName !== i.action || step.operationKey !== i.stepId || step.dispatchLease !== null || step.argumentDigest !== argumentHash(i)) fail("BATCH_UNAVAILABLE");
        const observed = await observeAction(current, i, i.resourceVersion);
        if (!observed.preview) fail(observed.code === "PREVIEW_DENIED" ? "BATCH_DENIED" : "BATCH_STALE");
        if (observed.preview.businessApproval.policyVersion !== i.policyVersion) fail("BATCH_STALE");
      }
      await actor(ctx, false, authority.items);
      if (row.expiresAt.getTime() <= Date.now() || run.deadlineAt.getTime() <= Date.now()) fail("BATCH_EXPIRED");
      return { code: "BATCH_PREVIEW_ONLY", runId: run.id, runVersion: run.version, batch: { id: row.id, version: row.version, expiresAt: row.expiresAt,
        bindingDigest: row.bindingDigest, display: row.display, authority: "preview_only", canApprove: false }, recovery: ["revise_preview", "cancel_run"] };
    });
  });
}

/** CAS revision with stable historical receipts for identical request-key retry.
 * Supersedes old proposals/steps, preserves the original expiry/deadline/budget,
 * and leaves the run waiting. Selection and edits grant no approval authority.
 */
export async function reviseActionBatch(ctx: AuthContext, input: unknown) {
  const value = reviseActionBatchSchema.parse(input);
  return safe(async () => {
    const spec = normalized(actionBatchSpecSchema.parse({ requestKey: value.requestKey, items: value.items, selectedItemIds: value.selectedItemIds }));
    const requestDigest = hash({ ...spec, batchId: value.batchId, expectedVersion: value.expectedVersion, expectedRunVersion: value.expectedRunVersion });
    const current = await actor(ctx, false);
    return db.transaction(async tx => {
      const { run } = await locked(tx, current, value.runId, true);
      const [previous] = await tx.select().from(aiActionBatch).where(and(eq(aiActionBatch.runId, run.id), eq(aiActionBatch.requestKey, spec.requestKey)));
      if (previous) {
        if (previous.requestDigest !== requestDigest) fail("BATCH_CONFLICT");
        await actor(ctx, false); return receipt(previous); // Metadata receipt only; never resume or write again.
      }
      const [row] = await tx.select().from(aiActionBatch).where(and(eq(aiActionBatch.id, value.batchId), eq(aiActionBatch.runId, run.id)));
      if (!row || row.version !== value.expectedVersion || run.version !== value.expectedRunVersion) fail("BATCH_CONFLICT");
      if (row.expiresAt.getTime() <= Date.now() || row.state === "expired") fail("BATCH_EXPIRED");
      if (row.state !== "pending" || run.state !== "awaiting_approval" || run.cancelRequestedAt || !row.authority || !row.display || binding(row) !== row.bindingDigest) fail("BATCH_UNAVAILABLE");
      const old = authoritySchema.safeParse(row.authority); if (!old.success) fail("BATCH_UNAVAILABLE");
      const prepared = await tx.select({ id: aiStep.id }).from(aiStep).where(and(eq(aiStep.runId, run.id), eq(aiStep.state, "prepared"))).orderBy(asc(aiStep.id));
      if (prepared.length !== old.data.items.length || prepared.some(s => !old.data.items.some(i => i.stepId === s.id))) fail("BATCH_UNAVAILABLE");
      await tx.update(aiActionBatch).set({ state: "superseded" }).where(eq(aiActionBatch.id, row.id));
      await tx.update(aiStep).set({ state: "skipped", version: sql`${aiStep.version} + 1`, updatedAt: new Date() }).where(and(eq(aiStep.runId, run.id), eq(aiStep.state, "prepared")));
      return persist(tx, run, current, spec, row.expiresAt, row.version + 1, requestDigest);
    });
  });
}
