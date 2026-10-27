import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { aiBudget, aiPrice, aiUsageAttempt, aiProvider, aiProviderConfig, aiRun, member, auditLog } from "@/lib/db/schema";
import { AuthError, type AuthContext } from "@/lib/api/auth-context";
import { authorizeExecution, executionIdentity, resolveExecutionIdentity } from "@/lib/api/execution-identity";

const id = z.string().uuid().describe("Opaque UUID, always checked against authenticated organization scope.");
const currency = z.string().regex(/^[A-Z]{3}$/).describe("Explicit three-letter billing currency; costs in different currencies are never added or converted.");
const decimal = (digits: number) => z.string().regex(new RegExp(`^(0|[1-9][0-9]{0,11})(\\.[0-9]{1,${digits}})?$`)).describe(`Exact nonnegative major billing-currency decimal string, at most 12 whole and ${digits} fractional digits; not accounting cents.`);
const tokens = z.string().regex(/^(0|[1-9][0-9]{0,17})$/).describe("Nonnegative exact token-count integer string.");
const version = z.number().int().positive().describe("Current optimistic version; omit only when creating a policy.");
export const priceSchema = z.object({ providerId: id, model: z.string().min(1).max(120).describe("Exact currently approved provider model ID."), currency,
  inputPerMillion: decimal(6), outputPerMillion: decimal(6), cachedPerMillion: decimal(6), reasoningPerMillion: decimal(6),
  evidenceDate: z.iso.date().describe("Gregorian date administrator verified these prices; no rates are automatically invented or fetched."),
  source: z.string().regex(/^[A-Za-z0-9 ._:/-]{1,240}$/).describe("Content-free public pricing evidence reference; never credentials, prompts or invoice data."),
}).strict();
export const budgetSchema = z.object({ userId: id.nullable().describe("Null configures organization budget; a current member UUID configures that user's additional restriction."), currency,
  monthlyTokens: tokens, monthlyCost: decimal(12), runTokens: tokens, runCost: decimal(12),
  requestsPerMinute: z.number().int().min(0).max(10000).describe("Rolling 60-second attempt limit, counting retries and pre-dispatch cancellations."),
  concurrency: z.number().int().min(0).max(1000).describe("Maximum reserved, in-flight or unknown attempts; unknown usage retains its slot until reconciled."),
  expectedVersion: version.optional(),
}).strict();
export const reportSchema = z.object({ scope: z.enum(["own", "organization"]).default("own").describe("Own usage requires view:ai-history; organization aggregate requires view:ai-usage, never transcript access."),
  from: z.iso.datetime().describe("Inclusive UTC creation-time boundary, maximum 93-day report window."), to: z.iso.datetime().describe("Exclusive UTC creation-time boundary, maximum 93-day report window."),
}).strict();
export const AI_USAGE_ADMIN_TOOLS = new Set(["create_ai_price", "list_ai_prices", "configure_ai_budget", "list_ai_budgets"]);

const actor = (ctx: AuthContext, permission: string) => authorizeExecution(executionIdentity(ctx), ctx.organizationId, permission);
const scaled = (value: string, digits: number) => { const [whole, fraction = ""] = value.split("."); return BigInt(whole + fraction.padEnd(digits, "0")); };
export function costDecimal(atoms: string | bigint) { const raw = BigInt(atoms).toString().padStart(13, "0"); return `${raw.slice(0, -12)}.${raw.slice(-12)}`; }
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
async function lock(tx: Tx, organizationId: string) { await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${organizationId}, 5))`); }
async function audit(tx: Tx, ctx: AuthContext, action: string, entityId: string) { await tx.insert(auditLog).values({ organizationId: ctx.organizationId, userId: ctx.userId, action, entityType: "ai-usage", entityId, changes: null }); }

export async function createPrice(ctx: AuthContext, input: unknown) {
  const current = await actor(ctx, "manage:ai-providers"), value = priceSchema.parse(input);
  const [provider] = await db.select().from(aiProvider).where(eq(aiProvider.id, value.providerId));
  if (!provider?.delegatedOrganizations.includes(current.organizationId) || !provider.models.some(m => m.id === value.model)) throw new AuthError("Approved delegated provider/model required", 403);
  return db.transaction(async tx => {
    const [row] = await tx.insert(aiPrice).values({ organizationId: current.organizationId, providerId: value.providerId, model: value.model, currency: value.currency,
      inputRate: scaled(value.inputPerMillion, 6).toString(), outputRate: scaled(value.outputPerMillion, 6).toString(), cachedRate: scaled(value.cachedPerMillion, 6).toString(), reasoningRate: scaled(value.reasoningPerMillion, 6).toString(),
      source: value.source, evidenceDate: value.evidenceDate, createdBy: current.userId }).returning();
    await audit(tx, current, "ai.price.created", row.id); return publicPrice(row);
  });
}
function publicPrice(row: typeof aiPrice.$inferSelect) { return { ...row, unit: "micro-major-per-million-tokens", invoice: false }; }
export async function listPrices(ctx: AuthContext) { const current = await actor(ctx, "manage:ai-providers"); return (await db.select().from(aiPrice).where(eq(aiPrice.organizationId, current.organizationId)).orderBy(desc(aiPrice.createdAt)).limit(200)).map(publicPrice); }
function publicBudget(row: typeof aiBudget.$inferSelect) { return { ...row, monthlyCost: costDecimal(row.monthlyCost), runCost: costDecimal(row.runCost), period: "UTC calendar month", costIsEstimate: true }; }
export async function configureBudget(ctx: AuthContext, input: unknown) {
  const current = await actor(ctx, "manage:ai-policy"), value = budgetSchema.parse(input);
  if (value.userId) { const [found] = await db.select().from(member).where(and(eq(member.organizationId, current.organizationId), eq(member.userId, value.userId))); if (!found) throw new AuthError("Organization member not found", 404); }
  return db.transaction(async tx => {
    await lock(tx, current.organizationId);
    const subject = value.userId ? `user:${value.userId}` : "organization";
    const [old] = await tx.select().from(aiBudget).where(and(eq(aiBudget.organizationId, current.organizationId), eq(aiBudget.subject, subject), eq(aiBudget.currency, value.currency)));
    if (old ? old.version !== value.expectedVersion : value.expectedVersion !== undefined) throw new AuthError("Budget version conflict", 409);
    const data = { organizationId: current.organizationId, subject, userId: value.userId, currency: value.currency, monthlyTokens: value.monthlyTokens, monthlyCost: scaled(value.monthlyCost, 12).toString(), runTokens: value.runTokens, runCost: scaled(value.runCost, 12).toString(), requestsPerMinute: value.requestsPerMinute, concurrency: value.concurrency };
    const [row] = old ? await tx.update(aiBudget).set({ ...data, version: old.version + 1, updatedAt: new Date() }).where(eq(aiBudget.id, old.id)).returning() : await tx.insert(aiBudget).values(data).returning();
    await audit(tx, current, "ai.budget.configured", row.id); return publicBudget(row);
  });
}
export async function listBudgets(ctx: AuthContext) { const current = await actor(ctx, "manage:ai-policy"); return (await db.select().from(aiBudget).where(eq(aiBudget.organizationId, current.organizationId))).map(publicBudget); }

type Attempt = typeof aiUsageAttempt.$inferSelect;
type Price = typeof aiPrice.$inferSelect;
const max = (...values: bigint[]) => values.reduce((a, b) => a > b ? a : b);
const active = sql`${aiUsageAttempt.state} in ('reserved','in_flight','unknown')`;
async function checkBudgets(tx: Tx, current: AuthContext, billingCurrency: string, runId: string | null, addTokens: bigint, addCost: bigint, admission = true) {
  const budgets = await tx.select().from(aiBudget).where(and(eq(aiBudget.organizationId, current.organizationId), eq(aiBudget.currency, billingCurrency), sql`${aiBudget.subject} in ('organization', ${`user:${current.userId}`})`));
  if (budgets.length !== 2) throw new AuthError("Explicit organization and user budgets required for billing currency", 409);
  for (const budget of budgets) {
    const [totals] = await tx.select({
      monthlyTokens: sql<string>`coalesce(sum(${aiUsageAttempt.chargedTokens}) filter(where ${aiUsageAttempt.createdAt} >= date_trunc('month', now() at time zone 'UTC') at time zone 'UTC'),0)::text`,
      monthlyCost: sql<string>`coalesce(sum(${aiUsageAttempt.chargedCost}) filter(where ${aiUsageAttempt.currency} = ${billingCurrency} and ${aiUsageAttempt.createdAt} >= date_trunc('month', now() at time zone 'UTC') at time zone 'UTC'),0)::text`,
      concurrent: sql<number>`count(*) filter(where ${active})::int`, rate: sql<number>`count(*) filter(where ${aiUsageAttempt.createdAt} > now() - interval '60 seconds')::int`,
    }).from(aiUsageAttempt).where(and(eq(aiUsageAttempt.organizationId, current.organizationId), ...(budget.userId ? [eq(aiUsageAttempt.ownerId, budget.userId)] : [])));
    let runTokens = addTokens, runCost = addCost;
    if (runId) {
      const [total] = await tx.select({ tokens: sql<string>`coalesce(sum(${aiUsageAttempt.chargedTokens}),0)::text`, cost: sql<string>`coalesce(sum(${aiUsageAttempt.chargedCost}),0)::text`, currencies: sql<number>`count(distinct ${aiUsageAttempt.currency}) filter(where ${aiUsageAttempt.currency} <> ${billingCurrency})::int` }).from(aiUsageAttempt).where(and(eq(aiUsageAttempt.organizationId, current.organizationId), eq(aiUsageAttempt.runId, runId)));
      if (total.currencies) throw new AuthError("A run cannot switch billing currency", 409);
      runTokens += BigInt(total.tokens); runCost += BigInt(total.cost);
    }
    if (BigInt(totals.monthlyTokens) + addTokens > BigInt(budget.monthlyTokens) || BigInt(totals.monthlyCost) + addCost > BigInt(budget.monthlyCost) || runTokens > BigInt(budget.runTokens) || runCost > BigInt(budget.runCost) || totals.concurrent + Number(admission) > budget.concurrency || totals.rate + Number(admission) > budget.requestsPerMinute) throw new AuthError("AI budget, rate or concurrency limit exhausted", 429);
  }
  return budgets.map(b => ({ id: b.id, version: b.version }));
}

const reservationSchema = z.object({ configId: id, priceId: id.optional(), runId: id.nullable(), attemptKey: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/), inputCeiling: tokens, outputCeiling: tokens }).strict();
/** TRUSTED executor primitive, not a user/model tool. Ceilings must bound the actual
 * encoded request and provider maximum output including reasoning. Retry = new key.
 * Connection tests use null runId; ordinary runtime must supply its persisted run. */
export async function reserveAttempt(ctx: AuthContext, input: z.infer<typeof reservationSchema>) {
  const current = await actor(ctx, input.runId ? "use:ai" : "manage:ai-providers"), value = reservationSchema.parse(input);
  return db.transaction(async tx => {
    await lock(tx, current.organizationId);
    const [config] = await tx.select().from(aiProviderConfig).where(and(eq(aiProviderConfig.id, value.configId), eq(aiProviderConfig.organizationId, current.organizationId)));
    const [provider] = config ? await tx.select().from(aiProvider).where(eq(aiProvider.id, config.providerId)) : [];
    if (!config || !config.enabled || !provider?.enabled || !provider.delegatedOrganizations.includes(current.organizationId)) throw new AuthError("Enabled delegated provider configuration required", 409);
    const model = provider.models.find(m => m.id === config.model);
    if (!model || BigInt(value.inputCeiling) + BigInt(value.outputCeiling) > BigInt(model.contextTokens) || BigInt(value.outputCeiling) > BigInt(model.outputTokens)) throw new AuthError("Model token ceiling exceeded", 422);
    if (value.runId) {
      const [run] = await tx.select().from(aiRun).where(and(eq(aiRun.id, value.runId), eq(aiRun.organizationId, current.organizationId), eq(aiRun.ownerId, current.userId)));
      if (!run) throw new AuthError("Run not found", 404);
      if (!["queued", "running"].includes(run.state) || run.config.providerConfigId !== config.id || run.config.configVersion !== config.version || run.config.credentialRef !== config.credentialRef) throw new AuthError("Run provider snapshot is stale or run is not executable", 409);
    }
    const [old] = await tx.select().from(aiUsageAttempt).where(and(eq(aiUsageAttempt.organizationId, current.organizationId), eq(aiUsageAttempt.ownerId, current.userId), eq(aiUsageAttempt.attemptKey, value.attemptKey)));
    const reservedTokens = BigInt(value.inputCeiling) + BigInt(value.outputCeiling);
    if (old) {
      const snapshot = JSON.parse(old.priceSnapshot) as { configId: string; inputCeiling: string; outputCeiling: string };
      if (old.runId !== value.runId || old.providerId !== provider.id || old.model !== model.id || snapshot.configId !== config.id || snapshot.inputCeiling !== value.inputCeiling || snapshot.outputCeiling !== value.outputCeiling || value.priceId && value.priceId !== old.priceId) throw new AuthError("Attempt key conflicts with original request", 409);
      return publicAttempt(old);
    }
    const [price] = await tx.select().from(aiPrice).where(and(eq(aiPrice.organizationId, current.organizationId), eq(aiPrice.providerId, provider.id), eq(aiPrice.model, model.id), ...(value.priceId ? [eq(aiPrice.id, value.priceId)] : []))).orderBy(desc(aiPrice.createdAt), desc(aiPrice.id)).limit(1);
    if (!price) throw new AuthError("Explicit verified price snapshot required", 409);
    const reservedCost = BigInt(value.inputCeiling) * max(BigInt(price.inputRate), BigInt(price.cachedRate)) + BigInt(value.outputCeiling) * max(BigInt(price.outputRate), BigInt(price.reasoningRate));
    const versions = await checkBudgets(tx, current, price.currency, value.runId, reservedTokens, reservedCost);
    const [attempt] = await tx.insert(aiUsageAttempt).values({ organizationId: current.organizationId, ownerId: current.userId, runId: value.runId, attemptKey: value.attemptKey, priceId: price.id, providerId: provider.id, model: model.id, currency: price.currency,
      reservedTokens: reservedTokens.toString(), reservedCost: reservedCost.toString(), chargedTokens: reservedTokens.toString(), chargedCost: reservedCost.toString(),
      priceSnapshot: JSON.stringify({ ...price, configId: config.id, configVersion: config.version, credentialRef: config.credentialRef, inputCeiling: value.inputCeiling, outputCeiling: value.outputCeiling }), budgetVersions: JSON.stringify(versions) }).returning();
    return publicAttempt(attempt);
  });
}
function publicAttempt(row: Attempt) { return { id: row.id, runId: row.runId, providerId: row.providerId, model: row.model, priceId: row.priceId, currency: row.currency, state: row.state, inputTokens: row.inputTokens, outputTokens: row.outputTokens, cachedTokens: row.cachedTokens, reasoningTokens: row.reasoningTokens, reservedTokens: row.reservedTokens, reservedCost: costDecimal(row.reservedCost), chargedTokens: row.chargedTokens, chargedCost: costDecimal(row.chargedCost), costIsEstimate: true, usageUnknown: row.state !== "cancelled" && [row.inputTokens, row.outputTokens, row.cachedTokens, row.reasoningTokens].some(v => v === null) }; }

export async function markAttemptDispatched(ctx: AuthContext, attemptId: string) {
  id.parse(attemptId); const identity = executionIdentity(ctx), current = await resolveExecutionIdentity(identity);
  return db.transaction(async tx => {
    await lock(tx, current.organizationId);
    const [row] = await tx.select().from(aiUsageAttempt).where(and(eq(aiUsageAttempt.id, attemptId), eq(aiUsageAttempt.organizationId, current.organizationId), eq(aiUsageAttempt.ownerId, current.userId)));
    if (!row) throw new AuthError("Attempt not found", 404);
    if (row.state !== "reserved") throw new AuthError("Attempt already dispatched or closed; reconcile instead of retrying", 409);
    await authorizeExecution(identity, current.organizationId, row.runId ? "use:ai" : "manage:ai-providers");
    const snapshot = JSON.parse(row.priceSnapshot) as { configId: string; configVersion: number; credentialRef: string };
    const [config] = await tx.select().from(aiProviderConfig).where(and(eq(aiProviderConfig.id, snapshot.configId), eq(aiProviderConfig.organizationId, current.organizationId)));
    const [provider] = config ? await tx.select().from(aiProvider).where(eq(aiProvider.id, config.providerId)) : [];
    if (!config?.enabled || config.version !== snapshot.configVersion || config.credentialRef !== snapshot.credentialRef || !provider?.enabled || !provider.delegatedOrganizations.includes(current.organizationId) || !provider.models.some(m => m.id === row.model)) throw new AuthError("Provider configuration changed before dispatch", 409);
    if (row.runId) { const [run] = await tx.select().from(aiRun).where(and(eq(aiRun.id, row.runId), eq(aiRun.organizationId, current.organizationId), eq(aiRun.ownerId, current.userId))); if (!run || !["queued", "running"].includes(run.state)) throw new AuthError("Run is no longer executable", 409); }
    await checkBudgets(tx, current, row.currency, row.runId, 0n, 0n, false);
    return publicAttempt((await tx.update(aiUsageAttempt).set({ state: "in_flight", updatedAt: new Date() }).where(eq(aiUsageAttempt.id, row.id)).returning())[0]);
  });
}

export const usageSchema = z.object({ inputTokens: tokens.nullable(), outputTokens: tokens.nullable(), cachedTokens: tokens.nullable(), reasoningTokens: tokens.nullable() }).strict();
type Usage = z.infer<typeof usageSchema>;
/** Trusted provider-adapter/worker callback ONLY. Not exposed as REST/MCP input.
 * Settlement must survive actor revocation; caller supplies its server-owned
 * attempt ID + scope. Missing usage is never converted to free/zero usage. */
export async function settleAttempt(organizationId: string, ownerId: string, attemptId: string, input: Usage) {
  id.parse(organizationId); id.parse(ownerId); id.parse(attemptId); const usage = usageSchema.parse(input);
  if (usage.cachedTokens !== null && usage.inputTokens !== null && BigInt(usage.cachedTokens) > BigInt(usage.inputTokens) || usage.reasoningTokens !== null && usage.outputTokens !== null && BigInt(usage.reasoningTokens) > BigInt(usage.outputTokens)) throw new AuthError("Usage subset exceeds total", 422);
  return db.transaction(async tx => {
    await lock(tx, organizationId);
    const [row] = await tx.select().from(aiUsageAttempt).where(and(eq(aiUsageAttempt.id, attemptId), eq(aiUsageAttempt.organizationId, organizationId), eq(aiUsageAttempt.ownerId, ownerId)));
    if (!row) throw new AuthError("Attempt not found", 404);
    if (!["in_flight", "unknown", "settled"].includes(row.state)) throw new AuthError("Only dispatched attempts may settle", 409);
    // Late partial callbacks cannot erase already observed token categories.
    const merged = Object.fromEntries(Object.entries(usage).map(([key, value]) => [key, value ?? row[key as keyof Usage]])) as Usage;
    for (const key of Object.keys(merged) as (keyof Usage)[]) { if (row[key] !== null && merged[key] !== row[key]) throw new AuthError("Usage changed after observation", 409); }
    const price = JSON.parse(row.priceSnapshot) as Price;
    let state: Attempt["state"] = "unknown", chargedTokens = BigInt(row.reservedTokens), chargedCost = BigInt(row.reservedCost);
    if (merged.inputTokens !== null && merged.outputTokens !== null) {
      const inputCount = BigInt(merged.inputTokens), outputCount = BigInt(merged.outputTokens), cached = BigInt(merged.cachedTokens ?? "0"), reasoning = BigInt(merged.reasoningTokens ?? "0");
      if (cached > inputCount || reasoning > outputCount) throw new AuthError("Usage subset exceeds total", 422);
      const inputRate = merged.cachedTokens === null ? max(BigInt(price.inputRate), BigInt(price.cachedRate)) : BigInt(price.inputRate);
      const outputRate = merged.reasoningTokens === null ? max(BigInt(price.outputRate), BigInt(price.reasoningRate)) : BigInt(price.outputRate);
      chargedTokens = inputCount + outputCount;
      chargedCost = (inputCount - cached) * inputRate + cached * BigInt(price.cachedRate) + (outputCount - reasoning) * outputRate + reasoning * BigInt(price.reasoningRate);
      state = "settled";
    } else {
      // If a partial response already exceeds the reservation, charge the larger
      // observed lower bound while retaining unknown state/concurrency.
      const inputLowerBound = max(BigInt(merged.inputTokens ?? "0"), BigInt(merged.cachedTokens ?? "0")), outputLowerBound = max(BigInt(merged.outputTokens ?? "0"), BigInt(merged.reasoningTokens ?? "0"));
      chargedTokens = max(chargedTokens, inputLowerBound + outputLowerBound);
      chargedCost = max(chargedCost, inputLowerBound * max(BigInt(price.inputRate), BigInt(price.cachedRate)) + outputLowerBound * max(BigInt(price.outputRate), BigInt(price.reasoningRate)));
    }
    const [updated] = await tx.update(aiUsageAttempt).set({ ...merged, state, chargedTokens: chargedTokens.toString(), chargedCost: chargedCost.toString(), settlement: JSON.stringify(merged), updatedAt: new Date() }).where(eq(aiUsageAttempt.id, row.id)).returning();
    return publicAttempt(updated);
  });
}

export async function cancelReservation(ctx: AuthContext, attemptId: string) {
  const current = await resolveExecutionIdentity(executionIdentity(ctx)); id.parse(attemptId);
  return db.transaction(async tx => {
    await lock(tx, current.organizationId);
    const [row] = await tx.select().from(aiUsageAttempt).where(and(eq(aiUsageAttempt.id, attemptId), eq(aiUsageAttempt.organizationId, current.organizationId), eq(aiUsageAttempt.ownerId, current.userId)));
    if (!row) throw new AuthError("Attempt not found", 404);
    await authorizeExecution(executionIdentity(ctx), current.organizationId, row.runId ? "use:ai" : "manage:ai-providers");
    if (["settled", "cancelled"].includes(row.state)) return publicAttempt(row);
    const preDispatch = row.state === "reserved";
    return publicAttempt((await tx.update(aiUsageAttempt).set({ state: preDispatch ? "cancelled" : "unknown", ...(preDispatch ? { chargedTokens: "0", chargedCost: "0" } : {}), updatedAt: new Date() }).where(eq(aiUsageAttempt.id, row.id)).returning())[0]);
  });
}

export async function usageReport(ctx: AuthContext, input: unknown) {
  const value = reportSchema.parse(input), current = await actor(ctx, value.scope === "own" ? "view:ai-history" : "view:ai-usage");
  const from = new Date(value.from), to = new Date(value.to);
  if (to <= from || to.getTime() - from.getTime() > 93 * 86400000) throw new AuthError("Report window must be positive and at most 93 days", 400);
  const rows = await db.select({ ownerId: aiUsageAttempt.ownerId, providerId: aiUsageAttempt.providerId, model: aiUsageAttempt.model, currency: aiUsageAttempt.currency,
    attempts: sql<number>`count(*)::int`, unknownAttempts: sql<number>`count(*) filter(where ${aiUsageAttempt.state} not in ('settled','cancelled'))::int`,
    unknownInputAttempts: sql<number>`count(*) filter(where ${aiUsageAttempt.inputTokens} is null and ${aiUsageAttempt.state} <> 'cancelled')::int`, unknownOutputAttempts: sql<number>`count(*) filter(where ${aiUsageAttempt.outputTokens} is null and ${aiUsageAttempt.state} <> 'cancelled')::int`,
    unknownCachedAttempts: sql<number>`count(*) filter(where ${aiUsageAttempt.cachedTokens} is null and ${aiUsageAttempt.state} <> 'cancelled')::int`, unknownReasoningAttempts: sql<number>`count(*) filter(where ${aiUsageAttempt.reasoningTokens} is null and ${aiUsageAttempt.state} <> 'cancelled')::int`,
    inputTokens: sql<string | null>`sum(${aiUsageAttempt.inputTokens})::text`, outputTokens: sql<string | null>`sum(${aiUsageAttempt.outputTokens})::text`, cachedTokens: sql<string | null>`sum(${aiUsageAttempt.cachedTokens})::text`, reasoningTokens: sql<string | null>`sum(${aiUsageAttempt.reasoningTokens})::text`,
    chargedTokens: sql<string>`sum(${aiUsageAttempt.chargedTokens})::text`, chargedCost: sql<string>`sum(${aiUsageAttempt.chargedCost})::text`,
  }).from(aiUsageAttempt).where(and(eq(aiUsageAttempt.organizationId, current.organizationId), sql`${aiUsageAttempt.createdAt} >= ${from} and ${aiUsageAttempt.createdAt} < ${to}`, ...(value.scope === "own" ? [eq(aiUsageAttempt.ownerId, current.userId)] : [])))
    .groupBy(aiUsageAttempt.ownerId, aiUsageAttempt.providerId, aiUsageAttempt.model, aiUsageAttempt.currency);
  return { scope: value.scope, from: value.from, to: value.to, costsAreEstimates: true, tokensAreObservedPartialSums: true, groups: rows.map(row => ({ ...row, chargedCost: costDecimal(row.chargedCost) })) };
}
