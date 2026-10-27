import assert from "node:assert/strict";
import { mock } from "node:test";
import { eq, and, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { users, organization, member, customRole, aiProvider, aiProviderConfig, aiPrice, aiUsageAttempt, aiBudget, aiConversation, aiRun, auditLog } from "../../lib/db/schema";

let session: { user: { id: string }; iat: number; expires: string } | null = null;
mock.module(new URL("../../lib/auth.ts", import.meta.url).href, { namedExports: { auth: async () => session } });

async function main() {
  const meter = await import("../../lib/ai/usage");
  const store = await import("../../lib/ai/persistence");
  const { getAuthContext } = await import("../../lib/api/auth-context");
  const priceRoute = await import("../../app/api/v1/ai/prices/route");
  const budgetRoute = await import("../../app/api/v1/ai/budgets/route");
  const reportRoute = await import("../../app/api/v1/ai/usage/route");
  const { registerAiUsageTools } = await import("../../lib/mcp/tools/ai-usage");
  const [owner, worker, admin, foreign] = await db.insert(users).values(["owner", "worker", "admin", "foreign"].map(name => ({ name, email: `ai005-${name}@test.invalid` }))).returning();
  const [org, other] = await db.insert(organization).values([{ name: "Usage", slug: "ai005-a" }, { name: "Foreign", slug: "ai005-b" }]).returning();
  await db.insert(member).values([{ organizationId: org.id, userId: owner.id, role: "owner" }, { organizationId: org.id, userId: worker.id, role: "member" }, { organizationId: org.id, userId: admin.id, role: "admin" }, { organizationId: other.id, userId: foreign.id, role: "owner" }]);
  const login = (userId: string) => { session = { user: { id: userId }, iat: Math.floor(Date.now() / 1000), expires: new Date(Date.now() + 3600000).toISOString() }; };
  const req = (method = "GET", body?: object, orgId = org.id, search = "") => new Request(`http://test.invalid/api/v1/ai/usage${search}`, { method, headers: { "x-organization-id": orgId, "content-type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
  async function data(response: Response, status = 200) { assert.equal(response.status, status, await response.clone().text()); return response.json(); }
  login(owner.id); const ctx = await getAuthContext(req());
  const [provider] = await db.insert(aiProvider).values({ name: "Synthetic fixture", adapter: "responses", endpoint: "https://fixture.invalid/v1/responses", enabled: true, models: [{ id: "fixture", contextTokens: 10000, outputTokens: 1000, usage: true, functionCalls: true, strictSchemas: true, streaming: false, evidenceDate: "2026-10-27" }], defaultModel: "fixture", delegatedOrganizations: [org.id], timeoutMs: 1000 }).returning();
  const [config] = await db.insert(aiProviderConfig).values({ organizationId: org.id, providerId: provider.id, model: "fixture", enabled: true, timeoutMs: 1000 }).returning();
  const priceInput = { providerId: provider.id, model: "fixture", currency: "USD", inputPerMillion: "1.000001", outputPerMillion: "2.000003", cachedPerMillion: "0.100001", reasoningPerMillion: "3.000001", evidenceDate: "2026-10-27", source: "synthetic-test-fixture-not-live-pricing" };
  const price = await data(await priceRoute.POST(req("POST", priceInput)));
  assert.equal(price.inputRate, "1000001"); assert.equal(price.invoice, false);
  await data(await priceRoute.POST(req("POST", { ...priceInput, inputPerMillion: 1.000001 })), 400);
  await data(await priceRoute.POST(req("POST", { ...priceInput, inputPerMillion: "0.0000001" })), 400);
  const baseBudget = { currency: "USD", monthlyTokens: "1000000", monthlyCost: "1000", runTokens: "10000", runCost: "10", requestsPerMinute: 1000, concurrency: 100 };
  let orgBudget = await data(await budgetRoute.PUT(req("PUT", { ...baseBudget, userId: null })));
  let userBudget = await data(await budgetRoute.PUT(req("PUT", { ...baseBudget, userId: owner.id })));
  await data(await budgetRoute.PUT(req("PUT", { ...baseBudget, userId: worker.id })));
  await data(await budgetRoute.PUT(req("PUT", { ...baseBudget, userId: foreign.id })), 404);
  await data(await budgetRoute.PUT(req("PUT", { ...baseBudget, userId: null })), 409);
  const conversation = await store.createConversation(ctx);
  const run = await store.enqueueRun(ctx, conversation.id, "usage-run", { providerConfigId: config.id, configVersion: config.version, credentialRef: config.credentialRef, policyVersion: 1 });
  const reserveInput = { configId: config.id, priceId: price.id, runId: run.id, attemptKey: "same-key", inputCeiling: "100", outputCeiling: "40" };
  const same = await Promise.all([meter.reserveAttempt(ctx, reserveInput), meter.reserveAttempt(ctx, reserveInput)]);
  assert.equal(same[0].id, same[1].id); assert.equal(same[0].reservedCost, "0.000220000140");
  assert.equal((await db.select().from(aiUsageAttempt)).length, 1);
  await assert.rejects(meter.reserveAttempt(ctx, { ...reserveInput, inputCeiling: "99", outputCeiling: "41" }), /conflict/);
  // Price edits create a new immutable version and do not reinterpret old attempts.
  const newPrice = await meter.createPrice(ctx, { ...priceInput, inputPerMillion: "9" }); assert.notEqual(newPrice.id, price.id);
  await meter.markAttemptDispatched(ctx, same[0].id);
  await assert.rejects(meter.markAttemptDispatched(ctx, same[0].id), /already dispatched/);
  const usage = { inputTokens: "100", outputTokens: "40", cachedTokens: "20", reasoningTokens: "10" };
  const settled = await meter.settleAttempt(org.id, owner.id, same[0].id, usage);
  assert.equal(settled.chargedCost, "0.000172000200");
  assert.deepEqual(await meter.settleAttempt(org.id, owner.id, same[0].id, usage), settled);
  await assert.rejects(meter.settleAttempt(org.id, owner.id, same[0].id, { ...usage, inputTokens: "101" }), /changed/);
  await assert.rejects(meter.settleAttempt(other.id, owner.id, same[0].id, usage), /not found/);
  assert.equal((await db.select().from(aiPrice).where(eq(aiPrice.id, price.id)))[0].inputRate, "1000001");
  const unknown = await meter.reserveAttempt(ctx, { ...reserveInput, attemptKey: "network-retry-1" });
  await meter.markAttemptDispatched(ctx, unknown.id);
  const noUsage = { inputTokens: null, outputTokens: null, cachedTokens: null, reasoningTokens: null };
  const pending = await meter.settleAttempt(org.id, owner.id, unknown.id, noUsage);
  assert.equal(pending.state, "unknown"); assert.equal(pending.inputTokens, null); assert.equal(pending.chargedCost, unknown.reservedCost);
  await meter.settleAttempt(org.id, owner.id, unknown.id, { ...noUsage, inputTokens: "10" });
  // Completion survives actor removal, uses server-owned callback scope, preserves observations.
  await db.delete(member).where(and(eq(member.organizationId, org.id), eq(member.userId, owner.id)));
  const late = await meter.settleAttempt(org.id, owner.id, unknown.id, { ...noUsage, outputTokens: "3" });
  assert.equal(late.inputTokens, "10"); assert.equal(late.state, "settled"); assert.equal(late.cachedTokens, null);
  const detailed = await meter.settleAttempt(org.id, owner.id, unknown.id, { inputTokens: "10", outputTokens: "3", cachedTokens: "2", reasoningTokens: "1" });
  assert.ok(BigInt(detailed.chargedCost.replace(".", "")) < BigInt(late.chargedCost.replace(".", "")));
  await assert.rejects(meter.reserveAttempt(ctx, { ...reserveInput, attemptKey: "removed-member" }), /member/);
  await db.insert(member).values({ organizationId: org.id, userId: owner.id, role: "owner" });

  async function orgPolicy(overrides: Partial<typeof baseBudget>) { login(owner.id); orgBudget = await data(await budgetRoute.PUT(req("PUT", { ...baseBudget, ...overrides, userId: null, expectedVersion: orgBudget.version }))); }
  async function userPolicy(overrides: Partial<typeof baseBudget>) { login(owner.id); userBudget = await data(await budgetRoute.PUT(req("PUT", { ...baseBudget, ...overrides, userId: owner.id, expectedVersion: userBudget.version }))); }
  await orgPolicy({ concurrency: 1 }); await userPolicy({ concurrency: 1 });
  const raced = await Promise.allSettled(["race1", "race2", "race3"].map(attemptKey => meter.reserveAttempt(ctx, { ...reserveInput, attemptKey })));
  assert.equal(raced.filter(r => r.status === "fulfilled").length, 1);
  assert.ok(raced.filter(r => r.status === "rejected").every(r => r.reason.status === 429));
  const admitted = raced.find(r => r.status === "fulfilled")!; assert.equal(admitted.status, "fulfilled");
  if (admitted.status !== "fulfilled") throw new Error("admission expected");
  const cancelled = await meter.cancelReservation(ctx, admitted.value.id); assert.equal(cancelled.state, "cancelled"); assert.equal(cancelled.chargedTokens, "0");
  const next = await meter.reserveAttempt(ctx, { ...reserveInput, attemptKey: "after-cancel" }); await meter.markAttemptDispatched(ctx, next.id);
  assert.equal((await meter.cancelReservation(ctx, next.id)).state, "unknown");
  await assert.rejects(meter.reserveAttempt(ctx, { ...reserveInput, attemptKey: "unknown-still-held" }), /exhausted/);
  await meter.settleAttempt(org.id, owner.id, next.id, { inputTokens: "1", outputTokens: "1", cachedTokens: "0", reasoningTokens: "0" });
  const partial = await meter.reserveAttempt(ctx, { ...reserveInput, attemptKey: "partial-overage" }); await meter.markAttemptDispatched(ctx, partial.id);
  const partialObserved = await meter.settleAttempt(org.id, owner.id, partial.id, { ...noUsage, cachedTokens: "200" });
  assert.equal(partialObserved.state, "unknown"); assert.equal(partialObserved.chargedTokens, "200");
  await meter.settleAttempt(org.id, owner.id, partial.id, { inputTokens: "200", outputTokens: "0", cachedTokens: "200", reasoningTokens: "0" });
  const strict = await meter.reserveAttempt(ctx, { ...reserveInput, attemptKey: "stricter-policy" });
  await userPolicy({ monthlyTokens: "0" }); await assert.rejects(meter.markAttemptDispatched(ctx, strict.id), /exhausted/); await meter.cancelReservation(ctx, strict.id);
  await userPolicy({}); await orgPolicy({ monthlyCost: "0" }); await assert.rejects(meter.reserveAttempt(ctx, { ...reserveInput, attemptKey: "cost-exhausted" }), /exhausted/);
  await orgPolicy({}); await userPolicy({ requestsPerMinute: 1 }); await assert.rejects(meter.reserveAttempt(ctx, { ...reserveInput, attemptKey: "rate-exhausted" }), /exhausted/);
  await userPolicy({ runTokens: "1" }); await assert.rejects(meter.reserveAttempt(ctx, { ...reserveInput, attemptKey: "run-exhausted" }), /exhausted/); await userPolicy({});
  // Delayed overage is recorded truthfully and consumes budget, never clamped.
  const over = await meter.reserveAttempt(ctx, { ...reserveInput, attemptKey: "provider-overage", inputCeiling: "1", outputCeiling: "1" }); await meter.markAttemptDispatched(ctx, over.id);
  assert.equal((await meter.settleAttempt(org.id, owner.id, over.id, { inputTokens: "200", outputTokens: "40", cachedTokens: null, reasoningTokens: null })).chargedTokens, "240");
  // No implicit currency summation or run currency switch.
  const eurPrice = await meter.createPrice(ctx, { ...priceInput, currency: "EUR" });
  await meter.configureBudget(ctx, { ...baseBudget, currency: "EUR", userId: null }); await meter.configureBudget(ctx, { ...baseBudget, currency: "EUR", userId: owner.id });
  await assert.rejects(meter.reserveAttempt(ctx, { ...reserveInput, priceId: eurPrice.id, attemptKey: "run-currency-switch" }), /switch billing currency/);
  const euro = await meter.reserveAttempt(ctx, { ...reserveInput, priceId: eurPrice.id, runId: null, attemptKey: "admin-euro" }); await meter.markAttemptDispatched(ctx, euro.id); await meter.settleAttempt(org.id, owner.id, euro.id, { inputTokens: "2", outputTokens: "1", cachedTokens: "0", reasoningTokens: "0" });
  login(worker.id); const workerCtx = await getAuthContext(req());
  await assert.rejects(meter.reserveAttempt(workerCtx, { ...reserveInput, attemptKey: "foreign-owner" }), /Run not found/);
  const workerConversation = await store.createConversation(workerCtx), workerRun = await store.enqueueRun(workerCtx, workerConversation.id, "worker-run", { providerConfigId: config.id, configVersion: config.version, credentialRef: config.credentialRef, policyVersion: 1 });
  const workerAttempt = await meter.reserveAttempt(workerCtx, { ...reserveInput, runId: workerRun.id, attemptKey: "worker-attempt" }); await meter.markAttemptDispatched(workerCtx, workerAttempt.id); await meter.settleAttempt(org.id, worker.id, workerAttempt.id, { inputTokens: "7", outputTokens: "1", cachedTokens: null, reasoningTokens: null });
  const query = { scope: "own", from: new Date(Date.now() - 3600000).toISOString(), to: new Date(Date.now() + 3600000).toISOString() };
  const own = await data(await reportRoute.GET(req("GET", undefined, org.id, `?${new URLSearchParams(query)}`))); assert.ok(own.groups.every((g: { ownerId: string }) => g.ownerId === worker.id));
  await data(await reportRoute.GET(req("GET", undefined, org.id, `?${new URLSearchParams({ ...query, scope: "organization" })}`)), 403);
  await data(await budgetRoute.GET(req()), 403); await data(await priceRoute.POST(req("POST", priceInput)), 403);
  login(admin.id); const aggregate = await data(await reportRoute.GET(req("GET", undefined, org.id, `?${new URLSearchParams({ ...query, scope: "organization" })}`)));
  assert.deepEqual(new Set(aggregate.groups.map((g: { currency: string }) => g.currency)), new Set(["USD", "EUR"]));
  assert.ok(!JSON.stringify(aggregate).includes("priceSnapshot")); assert.ok(!JSON.stringify(aggregate).includes("credentialRef"));
  login(owner.id); const server = new McpServer({ name: "AI usage", version: "1" }); registerAiUsageTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1" }), [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
  const call = async (name: string, args: Record<string, unknown>, error = false) => { const r = await client.callTool({ name, arguments: args }); assert.equal(!!r.isError, error, JSON.stringify(r)); return JSON.parse((r.content as { text: string }[])[0].text); };
  try {
    assert.deepEqual(await call("list_ai_budgets", {}), (await data(await budgetRoute.GET(req()))).budgets);
    assert.deepEqual(await call("get_ai_usage", { ...query, scope: "organization" }), await meter.usageReport(ctx, { ...query, scope: "organization" }));
    assert.equal((await client.listTools()).tools.length, 5); assert.equal(meter.AI_USAGE_ADMIN_TOOLS.size, 4);
    // Existing server closure must honor current custom role changes.
    const [role] = await db.insert(customRole).values({ organizationId: org.id, name: "No AI reporting", permissions: ["view:data"] }).returning();
    await db.update(member).set({ customRoleId: role.id }).where(and(eq(member.organizationId, org.id), eq(member.userId, owner.id)));
    assert.equal((await call("get_ai_usage", query, true)).status, 403); assert.equal((await call("configure_ai_budget", { ...baseBudget, userId: null, expectedVersion: orgBudget.version }, true)).status, 403);
    await db.update(member).set({ customRoleId: null }).where(and(eq(member.organizationId, org.id), eq(member.userId, owner.id)));
  } finally { await client.close(); await server.close(); }
  login(foreign.id); await data(await priceRoute.POST(req("POST", priceInput, other.id)), 403); await data(await budgetRoute.PUT(req("PUT", { ...baseBudget, userId: owner.id }, other.id)), 404);
  const foreignReport = await data(await reportRoute.GET(req("GET", undefined, other.id, `?${new URLSearchParams({ ...query, scope: "organization" })}`))); assert.equal(foreignReport.groups.length, 0);
  login(owner.id); await data(await reportRoute.GET(req("GET", undefined, org.id, `?${new URLSearchParams({ ...query, ownerId: foreign.id })}`)), 400);
  await assert.rejects(db.insert(aiBudget).values({ organizationId: org.id, subject: "forged", currency: "GBP", monthlyTokens: "0", monthlyCost: "0", runTokens: "0", runCost: "0", requestsPerMinute: 0, concurrency: 0 }));
  // Unknown metering must survive metadata purge of an otherwise terminal run.
  const pendingAttempt = await meter.reserveAttempt(ctx, { ...reserveInput, attemptKey: "retention-unknown" }); await meter.markAttemptDispatched(ctx, pendingAttempt.id); await meter.settleAttempt(org.id, owner.id, pendingAttempt.id, noUsage);
  await db.update(aiRun).set({ state: "cancelled", finishedAt: new Date() }).where(eq(aiRun.id, run.id));
  await db.update(aiConversation).set({ contentExpiresAt: new Date(0), metadataExpiresAt: new Date(0) }).where(eq(aiConversation.id, conversation.id));
  await store.purgeExpiredContent(); assert.equal((await db.select().from(aiUsageAttempt).where(eq(aiUsageAttempt.id, pendingAttempt.id))).length, 1);
  await meter.settleAttempt(org.id, owner.id, pendingAttempt.id, { inputTokens: "0", outputTokens: "0", cachedTokens: null, reasoningTokens: null }); await store.purgeExpiredContent(); assert.equal((await db.select().from(aiConversation).where(eq(aiConversation.id, conversation.id))).length, 0);
  const [logs] = await db.select({ count: sql<number>`count(*)::int` }).from(auditLog); assert.ok(logs.count > 10);
  console.log("AI usage exact budgets REST/MCP/SQL verified");
}
main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
