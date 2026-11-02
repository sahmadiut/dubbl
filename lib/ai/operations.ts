import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { aiBudget, aiProviderConfig, aiRun, aiStep, aiUsageAttempt as attempt, AI_RUN_STATES, auditLog, member } from "@/lib/db/schema";
import { AuthError, type AuthContext } from "@/lib/api/auth-context";
import { authorizeExecution, executionIdentity } from "@/lib/api/execution-identity";
import { costDecimal, reportSchema } from "./usage";
import { stopRun } from "./run-lifecycle";
import { hasPermission } from "@/lib/plans";

const id = z.string().uuid().transform(value => value.toLowerCase()).describe("Opaque UUID, checked within the authenticated organization.");
const scope = reportSchema.shape.scope;
const userId = id.optional().describe("Own scope accepts only self. Organization scope may select a current member; omission selects all members.");
const version = z.number().int().positive().describe("Exact current version reviewed by the caller; stale operations fail with 409.");
export const quotaSchema = z.object({ scope, userId, currency: z.string().regex(/^[A-Z]{3}$/).describe("Billing currency for cost limits. Monthly token, rate and concurrency limits include every currency.") }).strict();
export const runOperationsSchema = reportSchema.extend({
  userId,
  state: z.enum(AI_RUN_STATES).optional().describe("Optional exact persisted run state, distinct from metering-attempt state."),
  page: z.coerce.number().int().min(1).max(1000000).default(1).describe("One-based run page; summary counts cover the entire filtered scope."),
  pageSize: z.coerce.number().int().min(1).max(100).default(25).describe("Maximum 100 sanitized run rows per page."),
}).strict();
export const runDetailSchema = z.object({ scope, runId: id }).strict();
export const stopOperationSchema = runDetailSchema.extend({ expectedVersion: version }).strict();
export const disableConfigSchema = z.object({ configId: id, expectedVersion: version }).strict();
const actor = (ctx: AuthContext, permission: string) => authorizeExecution(executionIdentity(ctx), ctx.organizationId, permission);
const readPermission = (scope: string) => scope === "own" ? "view:ai-history" : "view:ai-usage";
async function selectedUser(ctx: AuthContext, scope: string, selected?: string) {
  if (scope === "own") {
    if (selected && selected !== ctx.userId) throw new AuthError("Own operations cannot select another user", 403);
    return ctx.userId;
  }
  if (selected) {
    const [found] = await db.select({ id: member.id }).from(member).where(and(eq(member.organizationId, ctx.organizationId), eq(member.userId, selected)));
    if (!found) throw new AuthError("Organization member not found", 404);
  }
  return selected;
}
const remaining = (limit: string, used: string) => (BigInt(limit) > BigInt(used) ? BigInt(limit) - BigInt(used) : 0n).toString();

/** Quota is an explanation of current constraints, never admission authority. */
export async function getQuota(ctx: AuthContext, input: unknown) {
  const value = quotaSchema.parse(input), permission = readPermission(value.scope), current = await actor(ctx, permission);
  const selected = await selectedUser(current, value.scope, value.userId);
  const result = await db.transaction(async tx => {
    const instant = (value: string) => new Date(value);
    const [{ asOf, from, to }] = await tx.select({ asOf: sql<string>`now()`.mapWith(instant), from: sql<string>`date_trunc('month', now() at time zone 'UTC') at time zone 'UTC'`.mapWith(instant), to: sql<string>`(date_trunc('month', now() at time zone 'UTC') + interval '1 month') at time zone 'UTC'`.mapWith(instant) }).from(sql`(select 1) as clock`);
    const budgets = await tx.select().from(aiBudget).where(and(eq(aiBudget.organizationId, current.organizationId), eq(aiBudget.currency, value.currency), sql`${aiBudget.subject} in ('organization', ${selected ? `user:${selected}` : "organization"})`));
    const constraints = [];
    for (const subject of selected ? ["organization", `user:${selected}`] : ["organization"]) {
      const budget = budgets.find(b => b.subject === subject);
      if (!budget) { constraints.push({ subject: subject === "organization" ? "organization" : "member", status: "BUDGET_MISSING" as const }); continue; }
      const [used] = await tx.select({
        tokens: sql<string>`coalesce(sum(${attempt.chargedTokens}) filter(where ${attempt.createdAt} >= ${from} and ${attempt.createdAt} < ${to}),0)::text`,
        cost: sql<string>`coalesce(sum(${attempt.chargedCost}) filter(where ${attempt.currency} = ${value.currency} and ${attempt.createdAt} >= ${from} and ${attempt.createdAt} < ${to}),0)::text`,
        concurrent: sql<string>`count(*) filter(where ${attempt.state} in ('reserved','in_flight','unknown'))::text`,
        rate: sql<string>`count(*) filter(where ${attempt.createdAt} > ${asOf}::timestamptz - interval '60 seconds')::text`,
      }).from(attempt).where(and(eq(attempt.organizationId, current.organizationId), budget.userId ? eq(attempt.ownerId, budget.userId) : undefined));
      const reasons: string[] = [];
      if ([budget.monthlyTokens, budget.monthlyCost, budget.runTokens, budget.runCost, String(budget.requestsPerMinute), String(budget.concurrency)].some(v => BigInt(v) === 0n)) reasons.push("ZERO_LIMIT");
      if (BigInt(used.tokens) >= BigInt(budget.monthlyTokens)) reasons.push("MONTHLY_TOKENS_EXHAUSTED");
      if (BigInt(used.cost) >= BigInt(budget.monthlyCost)) reasons.push("MONTHLY_COST_EXHAUSTED");
      if (BigInt(used.concurrent) >= BigInt(budget.concurrency)) reasons.push("CONCURRENCY_EXHAUSTED");
      if (BigInt(used.rate) >= BigInt(budget.requestsPerMinute)) reasons.push("RATE_EXHAUSTED");
      constraints.push({ subject: subject === "organization" ? "organization" : "member", status: reasons.length ? "LIMITED" as const : "WITHIN_LIMITS" as const,
        version: budget.version, reasons, monthlyTokensLimit: budget.monthlyTokens, remainingMonthlyTokens: remaining(budget.monthlyTokens, used.tokens),
        monthlyCostLimit: costDecimal(budget.monthlyCost), remainingMonthlyCost: costDecimal(remaining(budget.monthlyCost, used.cost)),
        runTokensLimit: budget.runTokens, runCostLimit: costDecimal(budget.runCost),
        concurrencyLimit: budget.concurrency, remainingConcurrency: remaining(String(budget.concurrency), used.concurrent),
        requestsPerMinuteLimit: budget.requestsPerMinute, remainingRequestsPerMinute: remaining(String(budget.requestsPerMinute), used.rate),
      });
    }
    // Full monthly data for the selected scope, not a bounded group/page sum.
    const usage = await tx.select({ currency: attempt.currency,
      attempts: sql<string>`count(*)::text`,
      observedInputTokens: sql<string | null>`sum(${attempt.inputTokens})::text`, observedOutputTokens: sql<string | null>`sum(${attempt.outputTokens})::text`,
      unknownInputAttempts: sql<string>`count(*) filter(where ${attempt.inputTokens} is null and ${attempt.state} <> 'cancelled')::text`,
      unknownOutputAttempts: sql<string>`count(*) filter(where ${attempt.outputTokens} is null and ${attempt.state} <> 'cancelled')::text`,
      chargedTokens: sql<string>`coalesce(sum(${attempt.chargedTokens}),0)::text`,
      settledCost: sql<string>`coalesce(sum(${attempt.chargedCost}) filter(where ${attempt.state} = 'settled'),0)::text`,
      reservedCost: sql<string>`coalesce(sum(${attempt.chargedCost}) filter(where ${attempt.state} = 'reserved'),0)::text`,
      unresolvedCost: sql<string>`coalesce(sum(${attempt.chargedCost}) filter(where ${attempt.state} in ('in_flight','unknown')),0)::text`,
    }).from(attempt).where(and(eq(attempt.organizationId, current.organizationId), selected ? eq(attempt.ownerId, selected) : undefined, sql`${attempt.createdAt} >= ${from} and ${attempt.createdAt} < ${to}`)).groupBy(attempt.currency).orderBy(attempt.currency);
    const activeRuns = await tx.select({ state: aiRun.state, count: sql<string>`count(*)::text` }).from(aiRun).where(and(eq(aiRun.organizationId, current.organizationId), selected ? eq(aiRun.ownerId, selected) : undefined, sql`${aiRun.state} not in ('succeeded','failed','cancelled','expired')`)).groupBy(aiRun.state).orderBy(aiRun.state);
    return { asOf, from, resetAt: to, constraints, activeRuns, usageByCurrency: usage.map(row => ({ ...row, settledCost: costDecimal(row.settledCost), reservedCost: costDecimal(row.reservedCost), unresolvedCost: costDecimal(row.unresolvedCost) })) };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
  await actor(ctx, permission);
  return { scope: value.scope, organizationId: current.organizationId, userId: selected ?? null, currency: value.currency, period: "UTC calendar month", costsAreEstimates: true, admissionGuaranteed: false, ...result };
}

const runColumns = { id: aiRun.id, ownerId: aiRun.ownerId, state: aiRun.state, version: aiRun.version, createdAt: aiRun.createdAt, startedAt: aiRun.startedAt, finishedAt: aiRun.finishedAt, cancelRequestedAt: aiRun.cancelRequestedAt,
  durationMs: sql<string | null>`(extract(epoch from (${aiRun.finishedAt} - ${aiRun.startedAt})) * 1000)::numeric(30,0)::text`,
};
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
async function outcomes(tx: Tx, where: ReturnType<typeof and>) {
  const requests = await tx.select({ state: aiRun.state, count: sql<string>`count(*)::text`, durationSamples: sql<string>`count(*) filter(where ${aiRun.finishedAt} is not null and ${aiRun.startedAt} is not null)::text`,
    totalDurationMs: sql<string | null>`sum(extract(epoch from (${aiRun.finishedAt} - ${aiRun.startedAt})) * 1000)::numeric(30,0)::text`,
  }).from(aiRun).where(where).groupBy(aiRun.state).orderBy(aiRun.state);
  const tools = await tx.select({ state: aiStep.state, count: sql<string>`count(*)::text` }).from(aiStep).innerJoin(aiRun, and(eq(aiStep.runId, aiRun.id), eq(aiStep.organizationId, aiRun.organizationId), eq(aiStep.ownerId, aiRun.ownerId))).where(where).groupBy(aiStep.state).orderBy(aiStep.state);
  return { requests, tools };
}
export async function listOperationRuns(ctx: AuthContext, input: unknown) {
  const value = runOperationsSchema.parse(input), permission = readPermission(value.scope), current = await actor(ctx, permission);
  const selected = await selectedUser(current, value.scope, value.userId), from = new Date(value.from), to = new Date(value.to);
  if (to <= from || to.getTime() - from.getTime() > 93 * 86400000) throw new AuthError("Report window must be positive and at most 93 days", 400);
  const where = and(eq(aiRun.organizationId, current.organizationId), selected ? eq(aiRun.ownerId, selected) : undefined, value.state ? eq(aiRun.state, value.state) : undefined, sql`${aiRun.createdAt} >= ${from} and ${aiRun.createdAt} < ${to}`);
  const result = await db.transaction(async tx => {
    const [count] = await tx.select({ total: sql<string>`count(*)::text` }).from(aiRun).where(where);
    const rows = await tx.select(runColumns).from(aiRun).where(where).orderBy(desc(aiRun.createdAt), desc(aiRun.id)).limit(value.pageSize).offset((value.page - 1) * value.pageSize);
    return { rows, totalRuns: count.total, outcomes: await outcomes(tx, where) };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
  await actor(ctx, permission);
  return { scope: value.scope, organizationId: current.organizationId, filters: value, ...result, page: value.page, pageSize: value.pageSize, hasNextPage: BigInt(value.page) * BigInt(value.pageSize) < BigInt(result.totalRuns), latencyUnit: "milliseconds", latencyMeaning: "finished minus started, includes waits; null without both timestamps" };
}
export async function getOperationRun(ctx: AuthContext, input: unknown) {
  const value = runDetailSchema.parse(input), permission = readPermission(value.scope), current = await actor(ctx, permission);
  const where = and(eq(aiRun.organizationId, current.organizationId), eq(aiRun.id, value.runId), value.scope === "own" ? eq(aiRun.ownerId, current.userId) : undefined);
  const result = await db.transaction(async tx => {
    const [run] = await tx.select(runColumns).from(aiRun).where(where);
    if (!run) throw new AuthError("Run not found", 404);
    return { run, outcomes: await outcomes(tx, where) };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
  const finalActor = await actor(ctx, permission);
  return { ...result, reasonCode: result.run.cancelRequestedAt ? "STOP_REQUESTED" : `RUN_${result.run.state.toUpperCase()}`,
    canStop: hasPermission(finalActor.permissions ?? finalActor.role, value.scope === "own" ? "view:ai-history" : "manage:ai-policy") && !result.run.cancelRequestedAt && !["succeeded", "failed", "cancelled", "expired"].includes(result.run.state) };
}
export async function stopOperationRun(ctx: AuthContext, input: unknown) {
  const value = stopOperationSchema.parse(input), current = await actor(ctx, value.scope === "own" ? "view:ai-history" : "manage:ai-policy");
  const run = await stopRun(current, value.runId, value.expectedVersion, value.scope === "organization");
  return { id: run.id, state: run.state, version: run.version, cancelRequestedAt: run.cancelRequestedAt, effects: "Completed effects remain; in-flight outcomes may require reconciliation" };
}
export async function disableOperationConfig(ctx: AuthContext, input: unknown) {
  const value = disableConfigSchema.parse(input), current = await actor(ctx, "manage:ai-providers");
  return db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${current.organizationId}, 4))`);
    const [row] = await tx.select({ id: aiProviderConfig.id, version: aiProviderConfig.version, enabled: aiProviderConfig.enabled }).from(aiProviderConfig).where(and(eq(aiProviderConfig.id, value.configId), eq(aiProviderConfig.organizationId, current.organizationId))).for("update");
    await actor(ctx, "manage:ai-providers");
    if (!row) throw new AuthError("Provider configuration not found", 404);
    if (row.version !== value.expectedVersion) throw new AuthError("Provider configuration version conflict", 409);
    if (!row.enabled) return row;
    const [changed] = await tx.update(aiProviderConfig).set({ enabled: false, version: row.version + 1, updatedAt: new Date() }).where(eq(aiProviderConfig.id, row.id)).returning({ id: aiProviderConfig.id, version: aiProviderConfig.version, enabled: aiProviderConfig.enabled });
    await tx.insert(auditLog).values({ organizationId: current.organizationId, userId: current.userId, action: "ai.provider.disabled", entityType: "ai-provider-config", entityId: row.id, changes: { version: changed.version } });
    return changed;
  });
}
