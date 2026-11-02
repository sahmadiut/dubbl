import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { aiUsageAttempt as attempt } from "@/lib/db/schema";
import { AuthError, type AuthContext } from "@/lib/api/auth-context";
import { authorizeExecution, executionIdentity } from "@/lib/api/execution-identity";
import { costDecimal, reportSchema } from "./usage";

const scopedId = z.string().uuid().transform(value => value.toLowerCase());
export const usageFilterSchema = reportSchema.extend({
  userId: scopedId.optional().describe("Optional user UUID within the current organization. Own scope accepts only the authenticated user."),
  providerId: scopedId.optional().describe("Optional exact provider UUID; never expands organization access."),
  model: z.string().min(1).max(120).optional().describe("Optional exact model ID, without fuzzy matching."),
  currency: z.string().regex(/^[A-Z]{3}$/).optional().describe("Optional explicit billing currency. Costs are never converted or combined across currencies."),
  priceId: scopedId.optional().describe("Optional immutable price-version UUID associated with the attempt."),
  state: z.enum(["reserved", "in_flight", "unknown", "settled", "cancelled"]).optional().describe("Optional metering-attempt state, distinct from run success or failure."),
}).strict();
export const usagePageSchema = usageFilterSchema.extend({
  page: z.coerce.number().int().min(1).max(1000000).default(1).describe("One-based group page. Totals cover all matching groups, independently of this page."),
  pageSize: z.coerce.number().int().min(1).max(100).default(50).describe("Groups per page, from 1 to 100. Group order is deterministic within the report snapshot."),
}).strict();

export const USAGE_EXPORT_GROUP_LIMIT = 10000;
const keys = { userId: attempt.ownerId, providerId: attempt.providerId, model: attempt.model, currency: attempt.currency, priceId: attempt.priceId };
const groupColumns = Object.values(keys);
// Count strings and numeric sums stay exact even above the JS safe integer range.
const countState = (state: string) => sql<string>`count(*) filter(where ${attempt.state} = ${state})::text`;
const observed = (column: typeof attempt.inputTokens) => sql<string | null>`sum(${column})::text`;
const missing = (column: typeof attempt.inputTokens) => sql<string>`count(*) filter(where ${column} is null and ${attempt.state} <> 'cancelled')::text`;
const stateCost = (states: string[]) => sql<string>`coalesce(sum(${attempt.chargedCost}) filter(where ${attempt.state} in (${sql.join(states.map(state => sql`${state}`), sql`, `)})),0)::text`;
const metrics = {
  attempts: sql<string>`count(*)::text`, reservedAttempts: countState("reserved"), inFlightAttempts: countState("in_flight"), unknownAttempts: countState("unknown"), settledAttempts: countState("settled"), cancelledAttempts: countState("cancelled"),
  inputTokens: observed(attempt.inputTokens), outputTokens: observed(attempt.outputTokens), cachedTokens: observed(attempt.cachedTokens), reasoningTokens: observed(attempt.reasoningTokens),
  unknownInputAttempts: missing(attempt.inputTokens), unknownOutputAttempts: missing(attempt.outputTokens), unknownCachedAttempts: missing(attempt.cachedTokens), unknownReasoningAttempts: missing(attempt.reasoningTokens),
  chargedTokens: sql<string>`coalesce(sum(${attempt.chargedTokens}),0)::text`,
  chargedCost: sql<string>`coalesce(sum(${attempt.chargedCost}),0)::text`,
  settledCost: stateCost(["settled"]), reservedCost: stateCost(["reserved"]), unresolvedCost: stateCost(["in_flight", "unknown"]),
};

function displayCosts<T extends { chargedCost: string; settledCost: string; reservedCost: string; unresolvedCost: string }>(row: T) {
  return { ...row, chargedCost: costDecimal(row.chargedCost), settledCost: costDecimal(row.settledCost), reservedCost: costDecimal(row.reservedCost), unresolvedCost: costDecimal(row.unresolvedCost) };
}

export const siteUsageFilterSchema = usageFilterSchema.omit({ scope: true }).extend({
  organizationId: scopedId.optional().describe("Optional exact organization UUID. Only a verified site administrator session can read across organizations."),
  userId: scopedId.optional().describe("Optional exact usage-owner UUID across site organizations; does not grant transcript access."),
  providerId: scopedId.optional().describe("Optional exact platform provider UUID across site organizations."),
}).strict();
export const siteUsagePageSchema = siteUsageFilterSchema.extend(usagePageSchema.pick({ page: true, pageSize: true }).shape).strict();

/** Internal read primitive; callers must establish and recheck their own authority.
 * Site grouping includes organization even when two tenants share user/provider/model.
 */
export async function readUsageGroups(value: z.output<typeof siteUsagePageSchema>, exporting: boolean, site = false) {
  if (!site && !value.organizationId) throw new AuthError("Organization scope required", 403);
  const reportKeys = site ? { organizationId: attempt.organizationId, ...keys } : keys;
  const columns = site ? [attempt.organizationId, ...groupColumns] : groupColumns;
  const from = new Date(value.from), to = new Date(value.to);
  if (to <= from || to.getTime() - from.getTime() > 93 * 86400000) throw new AuthError("Report window must be positive and at most 93 days", 400);
  const where = and(
    value.organizationId ? eq(attempt.organizationId, value.organizationId) : undefined,
    sql`${attempt.createdAt} >= ${from} and ${attempt.createdAt} < ${to}`,
    value.userId ? eq(attempt.ownerId, value.userId) : undefined,
    value.providerId ? eq(attempt.providerId, value.providerId) : undefined,
    value.model ? eq(attempt.model, value.model) : undefined,
    value.currency ? eq(attempt.currency, value.currency) : undefined,
    value.priceId ? eq(attempt.priceId, value.priceId) : undefined,
    value.state ? eq(attempt.state, value.state) : undefined,
  );
  // A single MVCC snapshot keeps group count, full totals and page/export coherent
  // while provider callbacks settle usage concurrently. No locks on execution.
  return db.transaction(async tx => {
    const grouped = tx.select(reportKeys).from(attempt).where(where).groupBy(...columns).as("usage_groups");
    const [count] = await tx.select({ total: sql<string>`count(*)::text` }).from(grouped);
    if (exporting && BigInt(count.total) > BigInt(USAGE_EXPORT_GROUP_LIMIT)) throw new AuthError("Usage export exceeds 10000 groups; narrow the report filters", 413);
    const totals = await tx.select({ currency: attempt.currency, ...metrics }).from(attempt).where(where).groupBy(attempt.currency).orderBy(asc(attempt.currency));
    const groups = await tx.select({ ...reportKeys, ...metrics }).from(attempt).where(where).groupBy(...columns).orderBy(...columns.map(column => asc(column)))
      .limit(value.pageSize).offset((value.page - 1) * value.pageSize);
    return { groups: groups.map(displayCosts), totalsByCurrency: totals.map(displayCosts), totalGroups: count.total };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}

async function report(ctx: AuthContext, input: unknown, exporting: boolean) {
  const value = exporting ? { ...usageFilterSchema.parse(input), page: 1, pageSize: USAGE_EXPORT_GROUP_LIMIT } : usagePageSchema.parse(input);
  const permission = value.scope === "own" ? "view:ai-history" : "view:ai-usage";
  const identity = executionIdentity(ctx);
  const current = await authorizeExecution(identity, ctx.organizationId, permission);
  if (value.scope === "own" && value.userId && value.userId !== current.userId) throw new AuthError("Own usage cannot select another user", 403);
  const result = await readUsageGroups({ ...value, organizationId: current.organizationId, userId: value.scope === "own" ? current.userId : value.userId }, exporting);
  // An existing MCP closure or long export must not retain revoked access.
  await authorizeExecution(identity, current.organizationId, permission);
  const { page, pageSize, ...filters } = value;
  return {
    scope: value.scope, organizationId: current.organizationId, filters,
    costsAreEstimates: true, costUnit: "major-billing-currency-decimal", tokensAreObservedPartialSums: true,
    ...result,
    ...(exporting ? { format: "json", exportGroupLimit: USAGE_EXPORT_GROUP_LIMIT, complete: true } : {
      page, pageSize, hasNextPage: BigInt(page) * BigInt(pageSize) < BigInt(result.totalGroups),
    }),
  };
}

export const usageReportPage = (ctx: AuthContext, input: unknown) => report(ctx, input, false);
export const exportUsageReport = (ctx: AuthContext, input: unknown) => report(ctx, input, true);
