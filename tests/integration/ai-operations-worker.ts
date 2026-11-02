import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mock } from "node:test";
import { and, eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { users, organization, member, customRole, aiProvider, aiProviderConfig, aiPrice, aiBudget, aiUsageAttempt, aiConversation, aiRun, aiStep, aiMessage, auditLog } from "../../lib/db/schema";

let session: { user: { id: string }; iat: number; expires: string } | null = null;
mock.module(new URL("../../lib/auth.ts", import.meta.url).href, { namedExports: { auth: async () => session } });
async function main() {
  const { getAuthContext } = await import("../../lib/api/auth-context");
  const operations = await import("../../lib/ai/operations");
  const quotaRoute = await import("../../app/api/v1/ai/operations/quota/route");
  const runsRoute = await import("../../app/api/v1/ai/operations/runs/route");
  const detailRoute = await import("../../app/api/v1/ai/operations/run/route");
  const stopRoute = await import("../../app/api/v1/ai/operations/stop/route");
  const disableRoute = await import("../../app/api/v1/ai/operations/disable/route");
  const { registerAiOperationTools } = await import("../../lib/mcp/tools/ai-operations");
  const [owner, worker, foreign, auditor] = await db.insert(users).values(["owner", "worker", "foreign", "auditor"].map(name => ({ name, email: `ai058-${name}@test.invalid` }))).returning();
  const [org, other] = await db.insert(organization).values([{ name: "Operations", slug: "ai058-a" }, { name: "Foreign", slug: "ai058-b" }]).returning();
  const [usageRole] = await db.insert(customRole).values({ organizationId: org.id, name: "Usage only", permissions: ["view:ai-usage"] }).returning();
  await db.insert(member).values([{ organizationId: org.id, userId: owner.id, role: "owner" }, { organizationId: org.id, userId: worker.id, role: "member" }, { organizationId: other.id, userId: foreign.id, role: "owner" }, { organizationId: org.id, userId: auditor.id, role: "member", customRoleId: usageRole.id }]);
  const login = (userId: string) => { session = { user: { id: userId }, iat: Math.floor(Date.now() / 1000), expires: new Date(Date.now() + 3600000).toISOString() }; };
  const request = (args: Record<string, unknown> = {}, write = false, organizationId = org.id) => new Request(`http://test.invalid/api/v1/ai/operations?${new URLSearchParams(Object.entries(args).map(([key, value]) => [key, String(value)]))}`, { method: write ? "POST" : "GET", headers: { "x-organization-id": organizationId, "Content-Type": "application/json" }, ...(write ? { body: JSON.stringify(args) } : {}) });
  const data = async (response: Response, status = 200) => { assert.equal(response.status, status, await response.clone().text()); return response.json(); };
  login(owner.id); const ctx = await getAuthContext(request());
  login(worker.id); const workerCtx = await getAuthContext(request());
  login(auditor.id); const auditorCtx = await getAuthContext(request()); login(owner.id);
  const now = new Date(), from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)), to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const window = { from: from.toISOString(), to: to.toISOString() }, query = { ...window, scope: "organization", pageSize: 1 };
  const empty = await data(await runsRoute.GET(request(query))); assert.equal(empty.totalRuns, "0"); assert.deepEqual(empty.outcomes, { requests: [], tools: [] });
  const missing = await data(await quotaRoute.GET(request({ currency: "USD" })));
  assert.deepEqual(missing.constraints.map((c: { status: string }) => c.status), ["BUDGET_MISSING", "BUDGET_MISSING"]);
  const [provider] = await db.insert(aiProvider).values({ name: "Fixture", adapter: "responses", endpoint: "https://private.invalid/responses", enabled: true, models: [], defaultModel: "fixture", delegatedOrganizations: [], timeoutMs: 1000 }).returning();
  const [config, foreignConfig] = await db.insert(aiProviderConfig).values([{ organizationId: org.id, providerId: provider.id, model: "fixture", enabled: true, timeoutMs: 1000, credential: "PRIVATE-CREDENTIAL", keyVersion: "PRIVATE-KEY" }, { organizationId: other.id, providerId: provider.id, model: "fixture", enabled: true, timeoutMs: 1000 }]).returning();
  const [price, euro, foreignPrice] = await db.insert(aiPrice).values([org.id, org.id, other.id].map((organizationId, index) => ({ organizationId, providerId: provider.id, model: "fixture", currency: index === 1 ? "EUR" : "USD", inputRate: "1", outputRate: "1", cachedRate: "1", reasoningRate: "1", evidenceDate: "2026-11-02", source: "synthetic", createdBy: owner.id }))).returning();
  const [conversation, otherOwnerConversation, foreignConversation] = await db.insert(aiConversation).values([{ organizationId: org.id, ownerId: worker.id }, { organizationId: org.id, ownerId: owner.id }, { organizationId: other.id, ownerId: foreign.id }].map(scope => ({ ...scope, contentExpiresAt: new Date(now.getTime() + 86400000), metadataExpiresAt: new Date(now.getTime() + 864000000) }))).returning();
  const runSeed = (index: number, extra: Partial<typeof aiRun.$inferInsert> = {}) => ({ organizationId: org.id, ownerId: worker.id, conversationId: conversation.id, requestKey: `private-${index}`, identity: { kind: "session" as const, userId: worker.id, organizationId: org.id, issuedAt: Date.now(), expiresAt: Date.now() + 3600000 }, config: { providerConfigId: config.id, configVersion: 1, credentialRef: config.credentialRef, policyVersion: 1 }, state: "succeeded" as const, startedAt: new Date(now.getTime() - 2000), deadlineAt: new Date(now.getTime() + 600000), finishedAt: now, createdAt: now, ...extra });
  const runs = await db.insert(aiRun).values(Array.from({ length: 205 }, (_, index) => runSeed(index))).returning();
  const [queued, executing, uncertain, ownRun, foreignRun] = await db.insert(aiRun).values([
    runSeed(300, { state: "queued", finishedAt: null, startedAt: null, deadlineAt: null }),
    runSeed(301, { state: "running", finishedAt: null, leaseOwner: randomUUID(), leaseExpiresAt: new Date(now.getTime() + 30000) }),
    runSeed(302, { state: "reconciliation_required", finishedAt: null }),
    runSeed(303, { conversationId: otherOwnerConversation.id, ownerId: owner.id }),
    runSeed(304, { organizationId: other.id, conversationId: foreignConversation.id, ownerId: foreign.id }),
    runSeed(305, { createdAt: new Date(from.getTime() - 1) }), runSeed(306, { createdAt: to }),
  ]).returning();
  const payload = { value: { secret: "PRIVATE-TRANSCRIPT" }, digest: "private", bytes: 1, truncated: false };
  await db.insert(aiMessage).values({ organizationId: org.id, ownerId: worker.id, conversationId: conversation.id, role: "user", payload, requiredPermissions: [] });
  await db.insert(aiStep).values([{ runId: runs[0].id, state: "succeeded" as const }, { runId: queued.id, state: "prepared" as const }, { runId: executing.id, state: "executing" as const }, { runId: uncertain.id, state: "uncertain" as const }].map(step => ({ organizationId: org.id, ownerId: worker.id, toolName: "PRIVATE-TOOL", input: payload, result: payload, recordIds: [randomUUID()], requiredPermissions: ["manage:expenses"], ...step })));
  const budgetBase = { organizationId: org.id, currency: "USD", monthlyTokens: "9007199254742000", monthlyCost: "900719925474200000000000000000", runTokens: "100000", runCost: "1000000", requestsPerMinute: 1000, concurrency: 100 };
  await db.insert(aiBudget).values([{ ...budgetBase, subject: "organization" }, { ...budgetBase, subject: `user:${worker.id}`, userId: worker.id }, { ...budgetBase, subject: `user:${owner.id}`, userId: owner.id, monthlyTokens: "0" }]);
  const attemptSeed = (extra: Partial<typeof aiUsageAttempt.$inferInsert> = {}) => ({ organizationId: org.id, ownerId: worker.id, providerId: provider.id, model: "fixture", priceId: price.id, currency: "USD", attemptKey: randomUUID(), state: "settled" as const, reservedTokens: "10", reservedCost: "100", chargedTokens: "10", chargedCost: "100", inputTokens: "6", outputTokens: "4", cachedTokens: null, reasoningTokens: null, priceSnapshot: "PRIVATE-SNAPSHOT", budgetVersions: "PRIVATE-BUDGETS", createdAt: now, ...extra });
  const attempts = await db.insert(aiUsageAttempt).values([
    attemptSeed({ chargedTokens: "9007199254740993", inputTokens: "9007199254740993", outputTokens: "0", chargedCost: "900719925474099300000000000001" }),
    attemptSeed({ state: "reserved", runId: queued.id, inputTokens: null, outputTokens: null, chargedCost: "200" }),
    attemptSeed({ state: "in_flight", runId: executing.id, inputTokens: null, outputTokens: null, chargedCost: "300" }),
    attemptSeed({ state: "unknown", runId: uncertain.id, inputTokens: "3", outputTokens: null, chargedCost: "400" }),
    attemptSeed({ priceId: euro.id, currency: "EUR", chargedTokens: "100", chargedCost: "500" }),
    attemptSeed({ ownerId: owner.id, chargedTokens: "7", chargedCost: "50" }),
    attemptSeed({ createdAt: new Date(from.getTime() - 1), state: "unknown", inputTokens: null, outputTokens: null }),
    attemptSeed({ organizationId: other.id, ownerId: foreign.id, priceId: foreignPrice.id, chargedTokens: "999999999999999999" }),
  ]).returning();
  const quota = await data(await quotaRoute.GET(request({ scope: "organization", userId: worker.id, currency: "USD" })));
  assert.equal(quota.from, from.toISOString()); assert.equal(quota.resetAt, to.toISOString()); assert.equal(quota.admissionGuaranteed, false);
  assert.equal(quota.constraints[1].remainingMonthlyTokens, "877"); // All currencies, not just USD.
  assert.equal(quota.constraints[0].remainingMonthlyTokens, "870");
  assert.equal(quota.constraints[1].remainingMonthlyCost, "100699.999999999099");
  assert.equal(quota.constraints[1].remainingConcurrency, "96"); // Prior-month unknown still holds a slot.
  assert.equal(quota.usageByCurrency[1].settledCost, "900719925474099300.000000000001");
  assert.equal(quota.usageByCurrency[1].reservedCost, "0.000000000200"); assert.equal(quota.usageByCurrency[1].unresolvedCost, "0.000000000700");
  assert.equal(quota.usageByCurrency[1].unknownOutputAttempts, "3"); assert.equal(quota.activeRuns.reduce((sum: number, row: { count: string }) => sum + Number(row.count), 0), 3);
  const ownQuota = await data(await quotaRoute.GET(request({ currency: "USD" }))); assert.ok(ownQuota.constraints[1].reasons.includes("ZERO_LIMIT"));
  const missingEur = await data(await quotaRoute.GET(request({ currency: "EUR" }))); assert.ok(missingEur.constraints.every((c: { status: string }) => c.status === "BUDGET_MISSING"));
  const first = await data(await runsRoute.GET(request(query))); assert.equal(first.rows.length, 1); assert.equal(first.totalRuns, "209"); assert.equal(first.hasNextPage, true);
  assert.equal(first.outcomes.requests.find((row: { state: string }) => row.state === "succeeded").count, "206");
  assert.equal(first.outcomes.requests.find((row: { state: string }) => row.state === "succeeded").totalDurationMs, "412000");
  assert.equal(first.outcomes.tools.length, 4);
  const all = [];
  for (let page = 1; page <= 3; page++) { const result = await data(await runsRoute.GET(request({ ...query, pageSize: 100, page }))); assert.deepEqual(result.outcomes, first.outcomes); all.push(...result.rows); }
  assert.equal(new Set(all.map(row => row.id)).size, 209);
  const beyond = await data(await runsRoute.GET(request({ ...query, page: 300 }))); assert.deepEqual(beyond.rows, []); assert.deepEqual(beyond.outcomes, first.outcomes);
  const detail = await data(await detailRoute.GET(request({ scope: "organization", runId: executing.id })));
  assert.equal(detail.run.durationMs, null); assert.equal(detail.reasonCode, "RUN_RUNNING");
  const finished = await data(await detailRoute.GET(request({ scope: "organization", runId: runs[0].id }))); assert.equal(finished.run.durationMs, "2000");
  for (const forbidden of ["PRIVATE-", "credential", "leaseOwner", "conversationId", "recordIds", "identity", "requestKey", "toolName", "priceSnapshot", "budgetVersions"]) assert.ok(!JSON.stringify([quota, first, detail]).includes(forbidden), forbidden);
  await data(await detailRoute.GET(request({ runId: queued.id })), 404); await data(await detailRoute.GET(request({ scope: "organization", runId: foreignRun.id })), 404);
  await data(await stopRoute.POST(request({ scope: "organization", runId: foreignRun.id, expectedVersion: 1 }, true)), 404);
  await data(await disableRoute.POST(request({ configId: foreignConfig.id, expectedVersion: 1 }, true)), 404);
  for (const args of [{ currency: "usd" }, { currency: "USD", userId: foreign.id }, { currency: "USD", scope: "site" }, { currency: "USD", organizationId: other.id }]) await data(await quotaRoute.GET(request(args)), args.userId ? 403 : 400);
  await data(await quotaRoute.GET(request({ scope: "organization", userId: foreign.id, currency: "USD" })), 404);
  for (const args of [{ page: 0 }, { pageSize: 101 }, { state: "unknown" }, { from: to.toISOString() }, { to: new Date(from.getTime() + 94 * 86400000).toISOString() }, { transcript: true }]) await data(await runsRoute.GET(request({ ...query, ...args })), 400);
  await data(await stopRoute.POST(request({ scope: "organization", runId: queued.id }, true)), 400);
  await data(await stopRoute.POST(request({ scope: "organization", runId: queued.id, expectedVersion: 2 }, true)), 409);
  await data(await disableRoute.POST(request({ configId: config.id, expectedVersion: 2 }, true)), 409);
  login(auditor.id);
  assert.equal((await data(await detailRoute.GET(request({ scope: "organization", runId: queued.id })))).run.id, queued.id);
  await data(await detailRoute.GET(request({ runId: queued.id })), 403);
  await data(await stopRoute.POST(request({ scope: "organization", runId: queued.id, expectedVersion: 1 }, true)), 403);
  await data(await disableRoute.POST(request({ configId: config.id, expectedVersion: 1 }, true)), 403);
  login(worker.id);
  assert.equal((await data(await runsRoute.GET(request(window)))).totalRuns, "208");
  await data(await runsRoute.GET(request(query)), 403); await data(await quotaRoute.GET(request({ currency: "USD", userId: owner.id })), 403);
  await data(await detailRoute.GET(request({ runId: ownRun.id })), 404);
  await data(await runsRoute.GET(request(window, false, other.id)), 403);
  session = null; await data(await quotaRoute.GET(request({ currency: "USD" })), 401);

  const server = new McpServer({ name: "AI operations", version: "1" }); registerAiOperationTools(server, ctx);
  const workerServer = new McpServer({ name: "Own operations", version: "1" }); registerAiOperationTools(workerServer, workerCtx);
  const auditorServer = new McpServer({ name: "Usage operations", version: "1" }); registerAiOperationTools(auditorServer, auditorCtx);
  const clients: Client[] = [];
  for (const service of [server, workerServer, auditorServer]) { const client = new Client({ name: "Fixture", version: "1" }); const [ct, st] = InMemoryTransport.createLinkedPair(); await service.connect(st); await client.connect(ct); clients.push(client); }
  const [client, workerClient, auditorClient] = clients;
  const call = async (client: Client, name: string, args: Record<string, unknown>, error = false) => { const result = await client.callTool({ name, arguments: args }); assert.equal(!!result.isError, error, JSON.stringify(result)); return JSON.parse((result.content as { text: string }[])[0].text); };
  try {
    assert.deepEqual(await call(client, "list_ai_operation_runs", query), first);
    assert.deepEqual(await call(client, "get_ai_operation_run", { scope: "organization", runId: executing.id }), detail);
    const linkedQuota = await call(workerClient, "get_ai_quota", { currency: "USD" });
    assert.deepEqual(linkedQuota.constraints, quota.constraints); assert.deepEqual(linkedQuota.usageByCurrency, quota.usageByCurrency);
    assert.equal((await call(workerClient, "get_ai_operation_run", { runId: foreignRun.id }, true)).status, 404);
    assert.equal((await call(workerClient, "stop_ai_operation_run", { scope: "organization", runId: queued.id, expectedVersion: 1 }, true)).status, 403);
    assert.equal((await call(auditorClient, "disable_ai_operation_config", { configId: config.id, expectedVersion: 1 }, true)).status, 403);
    const stopped = await call(client, "stop_ai_operation_run", { scope: "organization", runId: queued.id, expectedVersion: 1 });
    assert.equal(stopped.state, "cancelled"); assert.equal(stopped.version, 2);
    login(owner.id);
    await data(await stopRoute.POST(request({ scope: "organization", runId: queued.id, expectedVersion: 1 }, true)), 409);
    assert.deepEqual(await data(await stopRoute.POST(request({ scope: "organization", runId: queued.id, expectedVersion: 2 }, true))), stopped);
    const stopping = await call(workerClient, "stop_ai_operation_run", { runId: executing.id, expectedVersion: 1 }); assert.equal(stopping.state, "running");
    const reconciled = await data(await stopRoute.POST(request({ scope: "organization", runId: uncertain.id, expectedVersion: 1 }, true))); assert.equal(reconciled.state, "reconciliation_required");
    const finishedStop = await call(client, "stop_ai_operation_run", { scope: "organization", runId: runs[0].id, expectedVersion: 1 }); assert.equal(finishedStop.state, "succeeded"); assert.equal(finishedStop.version, 1);
    const [keptStep] = await db.select().from(aiStep).where(eq(aiStep.runId, runs[0].id)); assert.equal(keptStep.state, "succeeded");
    const states = await db.select().from(aiUsageAttempt).where(sql`${aiUsageAttempt.id} in (${attempts[1].id},${attempts[2].id},${attempts[3].id})`);
    assert.equal(states.find(a => a.id === attempts[1].id)!.state, "cancelled"); assert.equal(states.find(a => a.id === attempts[1].id)!.chargedCost, "0");
    assert.equal(states.find(a => a.id === attempts[2].id)!.state, "unknown"); assert.equal(states.find(a => a.id === attempts[2].id)!.chargedCost, "300");
    const disabled = await data(await disableRoute.POST(request({ configId: config.id, expectedVersion: 1 }, true))); assert.deepEqual(disabled, { id: config.id, enabled: false, version: 2 });
    assert.deepEqual(await call(client, "disable_ai_operation_config", { configId: config.id, expectedVersion: 2 }), disabled);
    assert.equal((await call(client, "disable_ai_operation_config", { configId: config.id, expectedVersion: 1 }, true)).status, 409);
    const [saved] = await db.select().from(aiProviderConfig).where(eq(aiProviderConfig.id, config.id)); assert.equal(saved.credential, "PRIVATE-CREDENTIAL");
    const logs = await db.select().from(auditLog).where(eq(auditLog.action, "ai.provider.disabled")); assert.equal(logs.length, 1);
    // Revoke authority while operations wait on row locks. Neither may commit
    // using the authorization obtained before the wait.
    const waitForLock = async (table: string) => {
      for (let index = 0; index < 100; index++) {
        const result = await db.$client.query("select 1 from pg_stat_activity where datname = current_database() and pid <> pg_backend_pid() and wait_event_type = 'Lock' and query like $1", [`%${table}%`]);
        if (result.rowCount) return;
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      throw new Error("Expected operation lock wait");
    };
    const setOwnerRole = async (customRoleId: string | null) => db.update(member).set({ customRoleId }).where(and(eq(member.organizationId, org.id), eq(member.userId, owner.id)));
    const [raceRun] = await db.insert(aiRun).values(runSeed(400, { state: "queued", finishedAt: null, startedAt: null, deadlineAt: null })).returning();
    const blocker = await db.$client.connect();
    try {
      await blocker.query("begin"); await blocker.query("select id from ai_run where id = $1 for update", [raceRun.id]);
      const pending = operations.stopOperationRun(ctx, { scope: "organization", runId: raceRun.id, expectedVersion: 1 }).then(value => ({ value, error: null }), error => ({ value: null, error }));
      await waitForLock("ai_run"); await setOwnerRole(usageRole.id); await blocker.query("commit");
      assert.equal((await pending).error?.status, 403);
      assert.equal((await db.select().from(aiRun).where(eq(aiRun.id, raceRun.id)))[0].state, "queued");
      await setOwnerRole(null);
      const attempts = await Promise.allSettled([1, 2].map(() => operations.stopOperationRun(ctx, { scope: "organization", runId: raceRun.id, expectedVersion: 1 })));
      assert.equal(attempts.filter(result => result.status === "fulfilled").length, 1);
      assert.equal((attempts.find(result => result.status === "rejected") as PromiseRejectedResult).reason.status, 409);
      await db.update(aiProviderConfig).set({ enabled: true, version: 3 }).where(eq(aiProviderConfig.id, config.id));
      await blocker.query("begin"); await blocker.query("select id from ai_provider_config where id = $1 for update", [config.id]);
      const disabling = operations.disableOperationConfig(ctx, { configId: config.id, expectedVersion: 3 }).then(value => ({ value, error: null }), error => ({ value: null, error }));
      await waitForLock("ai_provider_config"); await setOwnerRole(usageRole.id); await blocker.query("commit");
      assert.equal((await disabling).error?.status, 403);
      assert.equal((await db.select().from(aiProviderConfig).where(eq(aiProviderConfig.id, config.id)))[0].enabled, true);
      await setOwnerRole(null);
      const disables = await Promise.allSettled([1, 2].map(() => operations.disableOperationConfig(ctx, { configId: config.id, expectedVersion: 3 })));
      assert.equal(disables.filter(result => result.status === "fulfilled").length, 1);
      assert.equal((disables.find(result => result.status === "rejected") as PromiseRejectedResult).reason.status, 409);
    } finally { await blocker.query("rollback"); blocker.release(); await setOwnerRole(null); }
    // Existing closures must re-resolve permissions; no transcript grant substitutes for usage authority.
    await db.update(member).set({ customRoleId: usageRole.id }).where(and(eq(member.organizationId, org.id), eq(member.userId, owner.id)));
    assert.equal((await call(client, "get_ai_quota", { currency: "USD" }, true)).status, 403);
    assert.equal((await call(client, "stop_ai_operation_run", { scope: "organization", runId: ownRun.id, expectedVersion: 1 }, true)).status, 403);
    assert.equal((await call(client, "disable_ai_operation_config", { configId: config.id, expectedVersion: 2 }, true)).status, 403);
    await db.update(customRole).set({ permissions: [] }).where(eq(customRole.id, usageRole.id));
    assert.equal((await call(auditorClient, "get_ai_operation_run", { scope: "organization", runId: queued.id }, true)).status, 403);
    await data(await runsRoute.GET(request(query)), 403);
    await db.delete(member).where(and(eq(member.organizationId, org.id), eq(member.userId, worker.id)));
    assert.equal((await call(workerClient, "get_ai_quota", { currency: "USD" }, true)).status, 403);
    assert.equal((await call(workerClient, "stop_ai_operation_run", { runId: ownRun.id, expectedVersion: 1 }, true)).status, 403);
  } finally { for (const client of clients) await client.close(); for (const service of [server, workerServer, auditorServer]) await service.close(); }
  console.log("AI quota and run operations REST/MCP/SQL verified");
}
main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
