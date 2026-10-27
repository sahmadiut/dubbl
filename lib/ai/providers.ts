import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { aiProvider, aiProviderConfig, auditLog, organization, users } from "@/lib/db/schema";
import { AuthError, type AuthContext } from "@/lib/api/auth-context";
import { executionIdentity, resolveExecutionIdentity } from "@/lib/api/execution-identity";
import { requireRole } from "@/lib/api/require-role";
import { approvedEndpoint, endpointAddress, openCredential, providerPost, sealCredential } from "./provider-security";
import { reserveAttempt, markAttemptDispatched, settleAttempt, cancelReservation } from "./usage";

export const providerIdSchema = z.string().uuid().describe("Opaque provider or organization configuration UUID; always scoped by authenticated server identity.");
export const versionSchema = z.number().int().positive().describe("Expected current configuration version; stale writes are rejected.");
const modelId = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,119}$/).describe("Exact approved provider model ID; no automatic alias or provider fallback.");
const modelSchema = z.object({ id: modelId,
  contextTokens: z.number().int().min(1).max(2000000).describe("Verified model context-token ceiling."),
  outputTokens: z.number().int().min(16).max(100000).describe("Verified model maximum output tokens."),
  functionCalls: z.boolean().describe("Model supports application-owned function calls."),
  strictSchemas: z.boolean().describe("Model supports strict function schemas."), streaming: z.boolean().describe("Model supports streaming."),
  usage: z.boolean().describe("Model returns token usage."), evidenceDate: z.iso.date().describe("Gregorian date capabilities were verified; no availability claim is inferred."),
}).strict();
export const providerSchema = z.object({
  name: z.string().regex(/^[A-Za-z0-9 ._-]{1,80}$/).describe("Administrative provider label; never include credential values."),
  adapter: z.literal("responses").describe("Conditional Responses protocol adapter; no hosted tools or automatic fallback."),
  endpoint: z.string().max(300).describe("Exact deployment-approved HTTPS POST endpoint from external AI_APPROVED_PROVIDER_ENDPOINTS policy."),
  enabled: z.boolean().describe("Catalog availability; does not enable global AI rollout or qualify this provider."),
  models: z.array(modelSchema).min(1).max(30).describe("Explicit approved models and dated capabilities; actual entitlement remains a separate qualification."),
  defaultModel: modelId, timeoutMs: z.number().int().min(100).max(120000).describe("Maximum request wall time in milliseconds, including DNS."),
  delegatedOrganizations: z.array(providerIdSchema).max(200).describe("Only these organizations may configure this provider; empty denies all delegation."),
}).strict().superRefine((value, ctx) => {
  if (new Set(value.models.map(m => m.id)).size !== value.models.length || !value.models.some(m => m.id === value.defaultModel)) ctx.addIssue({ code: "custom", message: "Models must be unique and include the default model" });
});
export const configSchema = z.object({
  model: modelId.optional().describe("Approved model ID, or provider default on initial creation."),
  timeoutMs: z.number().int().min(100).max(120000).optional().describe("Request wall timeout, no greater than platform provider ceiling."),
  enabled: z.boolean().describe("Enable this organization configuration; a current encrypted credential is still required for calls."),
  isDefault: z.boolean().describe("Make this organization's selected default; switching never silently retries existing runs."),
}).strict();
export const credentialSchema = z.string().min(8).max(4096).regex(/^[\x21-\x7e]+$/).describe("New secret sent only to server-side encryption; never read back, logged, persisted as plaintext or included in model input.");

async function authorized(ctx: AuthContext, platform = false) {
  const identity = executionIdentity(ctx), current = await resolveExecutionIdentity(identity);
  if (platform) {
    const [user] = await db.select({ siteAdmin: users.isSiteAdmin }).from(users).where(eq(users.id, current.userId));
    if (identity.kind !== "session" || !user?.siteAdmin) throw new AuthError("Current site administrator session required", 403);
  } else requireRole(current, "manage:ai-providers");
  return current;
}
async function catalog(id: string) {
  const [row] = await db.select().from(aiProvider).where(eq(aiProvider.id, providerIdSchema.parse(id)));
  if (!row) throw new AuthError("Provider not found", 404); return row;
}
function delegated(row: typeof aiProvider.$inferSelect, ctx: AuthContext) {
  if (!row.delegatedOrganizations.includes(ctx.organizationId)) throw new AuthError("Provider is not delegated to this organization", 403);
}
function publicConfig(row: typeof aiProviderConfig.$inferSelect) {
  return { id: row.id, providerId: row.providerId, model: row.model, enabled: row.enabled, isDefault: row.isDefault,
    timeoutMs: row.timeoutMs, version: row.version, updatedAt: row.updatedAt, credentialConfigured: !!row.credential, credential: row.credential ? "********" : null, keyVersion: row.keyVersion };
}
async function ownConfig(ctx: AuthContext, id: string) {
  const [row] = await db.select().from(aiProviderConfig).where(and(eq(aiProviderConfig.id, providerIdSchema.parse(id)), eq(aiProviderConfig.organizationId, ctx.organizationId)));
  if (!row) throw new AuthError("Provider configuration not found", 404); return row;
}
export async function listProviderCatalog(ctx: AuthContext, platform = false) {
  const current = await authorized(ctx, platform), rows = await db.select().from(aiProvider);
  return platform ? rows : rows.filter(row => row.delegatedOrganizations.includes(current.organizationId)).map(row => ({ id: row.id, name: row.name, adapter: row.adapter, endpoint: row.endpoint, enabled: row.enabled, models: row.models, defaultModel: row.defaultModel, timeoutMs: row.timeoutMs, version: row.version, updatedAt: row.updatedAt }));
}
export async function saveProvider(ctx: AuthContext, input: unknown, id?: string, expectedVersion?: number) {
  const current = await authorized(ctx, true), value = providerSchema.parse(input);
  approvedEndpoint(value.endpoint); await endpointAddress(value.endpoint);
  for (const org of value.delegatedOrganizations) {
    const [found] = await db.select({ id: organization.id }).from(organization).where(and(eq(organization.id, org), sql`${organization.deletedAt} is null`));
    if (!found) throw new AuthError("Delegated organization not found", 422);
  }
  if (id) { providerIdSchema.parse(id); versionSchema.parse(expectedVersion); }
  return db.transaction(async tx => {
    const [row] = id ? await tx.update(aiProvider).set({ ...value, version: sql`${aiProvider.version} + 1`, updatedAt: new Date() })
      .where(and(eq(aiProvider.id, id), eq(aiProvider.version, expectedVersion!))).returning() : await tx.insert(aiProvider).values(value).returning();
    if (!row) throw new AuthError("Provider version conflict", 409);
    await tx.insert(auditLog).values({ organizationId: current.organizationId, userId: current.userId, action: id ? "ai.provider.updated" : "ai.provider.created", entityType: "ai-provider", entityId: row.id, changes: { version: row.version } });
    return row;
  });
}
export async function listProviderConfigs(ctx: AuthContext) {
  const current = await authorized(ctx);
  return (await db.select().from(aiProviderConfig).where(eq(aiProviderConfig.organizationId, current.organizationId))).map(publicConfig);
}
export async function saveProviderConfig(ctx: AuthContext, providerId: string, input: unknown, expectedVersion?: number) {
  const current = await authorized(ctx), provider = await catalog(providerId), inputValue = configSchema.parse(input);
  delegated(provider, current);
  if (inputValue.enabled && !provider.enabled) throw new AuthError("Provider is disabled", 409);
  if (expectedVersion !== undefined) versionSchema.parse(expectedVersion);
  return db.transaction(async tx => {
    // Serialize default switches and configuration creation within one org.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${current.organizationId}, 4))`);
    const [prior] = await tx.select().from(aiProviderConfig).where(and(eq(aiProviderConfig.providerId, provider.id), eq(aiProviderConfig.organizationId, current.organizationId)));
    if ((prior && prior.version !== expectedVersion) || (!prior && expectedVersion !== undefined)) throw new AuthError("Provider configuration version conflict", 409);
    const value = { ...inputValue, model: inputValue.model ?? prior?.model ?? provider.defaultModel, timeoutMs: inputValue.timeoutMs ?? prior?.timeoutMs ?? provider.timeoutMs };
    if (!provider.models.some(m => m.id === value.model) || value.timeoutMs > provider.timeoutMs) throw new AuthError("Model or timeout is not approved", 422);
    if (value.isDefault) await tx.update(aiProviderConfig).set({ isDefault: false, version: sql`${aiProviderConfig.version} + 1`, updatedAt: new Date() })
      .where(and(eq(aiProviderConfig.organizationId, current.organizationId), eq(aiProviderConfig.isDefault, true), sql`${aiProviderConfig.id} <> ${prior?.id ?? randomUUID()}`));
    const [row] = prior ? await tx.update(aiProviderConfig).set({ ...value, version: prior.version + 1, updatedAt: new Date() }).where(eq(aiProviderConfig.id, prior.id)).returning()
      : await tx.insert(aiProviderConfig).values({ ...value, providerId: provider.id, organizationId: current.organizationId }).returning();
    await tx.insert(auditLog).values({ organizationId: current.organizationId, userId: current.userId, action: "ai.provider.configured", entityType: "ai-provider-config", entityId: row.id, changes: { version: row.version } });
    return publicConfig(row);
  });
}
async function changeCredential(ctx: AuthContext, id: string, expectedVersion: number, secret?: string) {
  const current = await authorized(ctx), row = await ownConfig(current, id); versionSchema.parse(expectedVersion);
  // Revocation remains available after platform delegation is withdrawn.
  if (secret !== undefined) { const provider = await catalog(row.providerId); delegated(provider, current); }
  const sealed = secret === undefined ? { credential: null, keyVersion: null } : sealCredential(credentialSchema.parse(secret), `${current.organizationId}:${row.id}`);
  try {
    return await db.transaction(async tx => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${current.organizationId}, 4))`);
      const [updated] = await tx.update(aiProviderConfig).set({ ...sealed, credentialRef: randomUUID(), ...(secret === undefined ? { enabled: false } : {}), version: sql`${aiProviderConfig.version} + 1`, updatedAt: new Date() })
        .where(and(eq(aiProviderConfig.id, row.id), eq(aiProviderConfig.organizationId, current.organizationId), eq(aiProviderConfig.version, expectedVersion))).returning();
      if (!updated) throw new AuthError("Provider configuration version conflict", 409);
      await tx.insert(auditLog).values({ organizationId: current.organizationId, userId: current.userId, action: secret === undefined ? "ai.provider.credential_revoked" : "ai.provider.credential_rotated", entityType: "ai-provider-config", entityId: row.id, changes: { version: updated.version } });
      return publicConfig(updated);
    });
  } catch (err) { if (err instanceof AuthError) throw err; throw new AuthError("Credential update unavailable", 503); }
}
export const rotateProviderCredential = (ctx: AuthContext, id: string, expectedVersion: number, secret: string) => changeCredential(ctx, id, expectedVersion, secret);
export const revokeProviderCredential = (ctx: AuthContext, id: string, expectedVersion: number) => changeCredential(ctx, id, expectedVersion);

/** Internal adapter boundary. Later dispatch must additionally enforce AI policy,
 * immutable run snapshots, budgets and rollout qualification before calling it. */
export async function testProviderConnection(ctx: AuthContext, id: string) {
  const current = await authorized(ctx), config = await ownConfig(current, id), provider = await catalog(config.providerId);
  delegated(provider, current);
  if (!provider.enabled || !config.enabled) throw new AuthError("Provider configuration is disabled", 409);
  if (process.env.AI_PROVIDER_CALLS_ENABLED !== "true") throw new AuthError("Live provider requests are not qualified or enabled", 403);
  if (!config.credential || !config.keyVersion) throw new AuthError("Provider credential required", 409);
  const model = provider.models.find(m => m.id === config.model);
  if (!model || !model.usage || config.timeoutMs > provider.timeoutMs) throw new AuthError("Current model configuration is not approved", 409);
  const secret = openCredential(config.credential, config.keyVersion, `${current.organizationId}:${config.id}`);
  const started = Date.now();
  // No tokenizer/account has been qualified. Conservatively reserve the entire
  // approved context ceiling rather than assume a vendor's encoding is free.
  const attempt = await reserveAttempt(ctx, { configId: config.id, runId: null, attemptKey: `connection_${randomUUID()}`, inputCeiling: String(model.contextTokens - 16), outputCeiling: "16" });
  let dispatched = false;
  try {
    await markAttemptDispatched(ctx, attempt.id); dispatched = true;
    const response = await providerPost(provider.endpoint, secret, { model: model.id, input: "Reply OK.", max_output_tokens: 16, store: false, stream: false, parallel_tool_calls: false, tools: [] }, config.timeoutMs);
    const count = z.number().int().nonnegative();
    const parsed = z.object({ status: z.literal("completed"), model: z.string(), usage: z.object({ input_tokens: count, output_tokens: count,
      input_tokens_details: z.object({ cached_tokens: count.optional() }).optional(), output_tokens_details: z.object({ reasoning_tokens: count.optional() }).optional(),
    }) }).safeParse(response);
    if (!parsed.success || parsed.data.model !== model.id) throw new AuthError("Invalid provider response or missing usage", 502);
    const usage = parsed.data.usage;
    await settleAttempt(current.organizationId, current.userId, attempt.id, { inputTokens: String(usage.input_tokens), outputTokens: String(usage.output_tokens), cachedTokens: usage.input_tokens_details?.cached_tokens === undefined ? null : String(usage.input_tokens_details.cached_tokens), reasoningTokens: usage.output_tokens_details?.reasoning_tokens === undefined ? null : String(usage.output_tokens_details.reasoning_tokens) });
    // No provider text, IDs, raw headers or model-returned diagnostics disclosed.
    return { connected: true, configId: config.id, configVersion: config.version, providerVersion: provider.version, model: model.id, latencyMs: Date.now() - started, usage, usageAttemptId: attempt.id };
  } catch (err) {
    if (dispatched) await settleAttempt(current.organizationId, current.userId, attempt.id, { inputTokens: null, outputTokens: null, cachedTokens: null, reasoningTokens: null });
    else await cancelReservation(ctx, attempt.id).catch(() => {});
    throw err;
  }
}

/** Explicit deny marker consumed by the ordinary-chat registry in AI-006. */
export const PROVIDER_ADMIN_CHAT_ALLOWED = false;
