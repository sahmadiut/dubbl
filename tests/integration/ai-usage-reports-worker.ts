import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mock } from "node:test";
import { and, eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { users, organization, member, customRole, aiProvider, aiPrice, aiUsageAttempt } from "../../lib/db/schema";

let session: { user: { id: string }; iat: number; expires: string } | null = null;
mock.module(new URL("../../lib/auth.ts", import.meta.url).href, { namedExports: { auth: async () => session } });

async function main() {
  const { getAuthContext } = await import("../../lib/api/auth-context");
  const reports = await import("../../lib/ai/usage-reports");
  const pageRoute = await import("../../app/api/v1/ai/usage/report/route");
  const exportRoute = await import("../../app/api/v1/ai/usage/export/route");
  const { registerAiUsageTools } = await import("../../lib/mcp/tools/ai-usage");
  const [owner, worker, foreign] = await db.insert(users).values(["owner", "worker", "foreign"].map(name => ({ name, email: `ai055-${name}@test.invalid` }))).returning();
  const [org, other] = await db.insert(organization).values([{ name: "Usage reports", slug: "ai055-a" }, { name: "Foreign", slug: "ai055-b" }]).returning();
  await db.insert(member).values([{ organizationId: org.id, userId: owner.id, role: "owner" }, { organizationId: org.id, userId: worker.id, role: "member" }, { organizationId: other.id, userId: foreign.id, role: "owner" }]);
  const [provider] = await db.insert(aiProvider).values({ name: "Synthetic reports", adapter: "responses", endpoint: "https://fixture.invalid/v1/responses", enabled: true, models: [{ id: "fixture", contextTokens: 10000, outputTokens: 1000, usage: true, functionCalls: true, strictSchemas: true, streaming: false, evidenceDate: "2026-11-01" }], defaultModel: "fixture", delegatedOrganizations: [org.id, other.id], timeoutMs: 1000 }).returning();
  const priceData = { providerId: provider.id, model: "fixture", currency: "USD", inputRate: "1", outputRate: "1", cachedRate: "1", reasoningRate: "1", evidenceDate: "2026-11-01", source: "synthetic-not-live-pricing", createdBy: owner.id };
  const [price, revised, eur, foreignPrice] = await db.insert(aiPrice).values([
    { ...priceData, organizationId: org.id }, { ...priceData, organizationId: org.id, inputRate: "2" },
    { ...priceData, organizationId: org.id, currency: "EUR" }, { ...priceData, organizationId: other.id, createdBy: foreign.id },
  ]).returning();
  const login = (userId: string) => { session = { user: { id: userId }, iat: Math.floor(Date.now() / 1000), expires: new Date(Date.now() + 3600000).toISOString() }; };
  const query = { from: "2026-10-01T00:00:00Z", to: "2026-11-01T00:00:00Z" };
  const req = (input: Record<string, unknown> = {}, organizationId = org.id) => new Request(`http://test.invalid/api/v1/ai/usage/report?${new URLSearchParams(Object.entries({ ...query, ...input }).map(([key, value]) => [key, String(value)]))}`, { headers: { "x-organization-id": organizationId } });
  const data = async (response: Response, status = 200) => { assert.equal(response.status, status, await response.clone().text()); return response.json(); };
  login(owner.id);
  const ctx = await getAuthContext(req());
  const empty = await data(await pageRoute.GET(req({ scope: "organization" })));
  assert.deepEqual(empty.groups, []); assert.deepEqual(empty.totalsByCurrency, []); assert.equal(empty.totalGroups, "0"); assert.equal(empty.hasNextPage, false);
  const bigTokens = "9007199254740993", bigCost = "900719925474099300000000000001";
  const seed = (overrides: Partial<typeof aiUsageAttempt.$inferInsert> = {}) => ({
    organizationId: org.id, ownerId: owner.id, providerId: provider.id, model: "fixture", priceId: price.id, currency: "USD", attemptKey: randomUUID(),
    state: "settled" as const, reservedTokens: "10", reservedCost: "100", chargedTokens: "10", chargedCost: "100",
    inputTokens: "6", outputTokens: "4", cachedTokens: "0", reasoningTokens: "1", priceSnapshot: "PRIVATE-SNAPSHOT-SENTINEL", budgetVersions: "PRIVATE-BUDGET-SENTINEL",
    settlement: "PRIVATE-SETTLEMENT-SENTINEL", createdAt: new Date(query.from), ...overrides,
  });
  await db.insert(aiUsageAttempt).values([
    seed({ inputTokens: bigTokens, chargedTokens: "9007199254740997", chargedCost: bigCost }),
    seed({ inputTokens: "3", chargedTokens: "7", chargedCost: "99" }),
    seed({ priceId: revised.id, state: "reserved", inputTokens: null, outputTokens: null, cachedTokens: null, reasoningTokens: null, chargedCost: "200" }),
    seed({ ownerId: worker.id, state: "unknown", inputTokens: "7", outputTokens: null, cachedTokens: null, reasoningTokens: null, chargedTokens: "100", chargedCost: "500" }),
    seed({ priceId: eur.id, currency: "EUR", state: "in_flight", inputTokens: null, outputTokens: null, cachedTokens: null, reasoningTokens: null, chargedCost: "700" }),
    seed({ ownerId: worker.id, priceId: eur.id, currency: "EUR", state: "cancelled", inputTokens: null, outputTokens: null, cachedTokens: null, reasoningTokens: null, chargedTokens: "0", chargedCost: "0" }),
    seed({ createdAt: new Date(Date.parse(query.from) - 1), model: "outside-before" }),
    seed({ createdAt: new Date(query.to), model: "outside-after" }),
    seed({ organizationId: other.id, ownerId: foreign.id, priceId: foreignPrice.id, model: "FOREIGN-SENTINEL" }),
  ]);
  const input = { ...query, scope: "organization" as const, pageSize: 1 };
  const first = await data(await pageRoute.GET(req(input)));
  assert.equal(first.groups.length, 1); assert.equal(first.totalGroups, "5"); assert.equal(first.hasNextPage, true);
  const usd = first.totalsByCurrency.find((row: { currency: string }) => row.currency === "USD");
  const euro = first.totalsByCurrency.find((row: { currency: string }) => row.currency === "EUR");
  assert.equal(usd.attempts, "4"); assert.equal(usd.inputTokens, "9007199254741003"); assert.equal(usd.outputTokens, "8");
  assert.equal(usd.chargedTokens, "9007199254741114"); assert.equal(usd.chargedCost, "900719925474099300.000000000800");
  assert.equal(usd.settledCost, "900719925474099300.000000000100"); assert.equal(usd.reservedCost, "0.000000000200"); assert.equal(usd.unresolvedCost, "0.000000000500");
  assert.equal(usd.unknownInputAttempts, "1"); assert.equal(usd.unknownOutputAttempts, "2");
  assert.equal(euro.inputTokens, null); assert.equal(euro.unknownInputAttempts, "1"); assert.equal(euro.cancelledAttempts, "1"); assert.equal(euro.inFlightAttempts, "1");
  assert.equal(euro.chargedCost, "0.000000000700");
  const allGroups = [];
  for (let page = 1; page <= 5; page++) {
    const result = await data(await pageRoute.GET(req({ ...input, page })));
    assert.deepEqual(result.totalsByCurrency, first.totalsByCurrency); assert.equal(result.hasNextPage, page < 5);
    allGroups.push(...result.groups);
  }
  assert.equal(new Set(allGroups.map(group => JSON.stringify([group.userId, group.providerId, group.model, group.currency, group.priceId]))).size, 5);
  const beyond = await data(await pageRoute.GET(req({ ...input, page: 6 })));
  assert.deepEqual(beyond.groups, []); assert.equal(beyond.totalGroups, "5"); assert.deepEqual(beyond.totalsByCurrency, first.totalsByCurrency);
  const download = await exportRoute.GET(req({ scope: "organization" }));
  assert.match(download.headers.get("content-disposition")!, /attachment/); assert.equal(download.headers.get("cache-control"), "private, no-store");
  const exported = await data(download);
  assert.equal(exported.complete, true); assert.deepEqual(exported.groups, allGroups); assert.deepEqual(exported.totalsByCurrency, first.totalsByCurrency);
  for (const forbidden of ["PRIVATE-", "FOREIGN-SENTINEL", "outside-before", "outside-after", "priceSnapshot", "credentialRef", "attemptKey", "settlement", "budgetVersions"]) assert.ok(!JSON.stringify(exported).includes(forbidden), forbidden);
  const filtered = { scope: "organization", userId: worker.id, providerId: provider.id.toUpperCase(), model: "fixture", currency: "USD", priceId: price.id, state: "unknown" };
  const selected = await data(await pageRoute.GET(req(filtered)));
  assert.equal(selected.totalGroups, "1"); assert.equal(selected.groups[0].userId, worker.id); assert.equal(selected.groups[0].inputTokens, "7"); assert.equal(selected.groups[0].outputTokens, null);
  assert.equal((await data(await pageRoute.GET(req({ scope: "organization", userId: foreign.id })))).totalGroups, "0");
  assert.equal((await data(await pageRoute.GET(req({ providerId: randomUUID() })))).totalGroups, "0");
  for (const invalid of [{ page: 0 }, { pageSize: 101 }, { page: 1.5 }, { page: "NaN" }, { state: "succeeded" }, { scope: "site" }, { organizationId: other.id }, { userId: "x" }, { model: "" }, { currency: "usd" }, { from: query.to, to: query.from }, { to: "2027-02-01T00:00:00Z" }]) await data(await pageRoute.GET(req(invalid)), 400);
  await data(await exportRoute.GET(req({ page: 1 })), 400);
  await data(await pageRoute.GET(req({ userId: worker.id })), 403);
  await data(await exportRoute.GET(req({ userId: worker.id })), 403);
  login(worker.id);
  const workerCtx = await getAuthContext(req());
  const own = await data(await pageRoute.GET(req())); assert.equal(own.scope, "own"); assert.equal(own.totalGroups, "2"); assert.ok(own.groups.every((group: { userId: string }) => group.userId === worker.id));
  await data(await pageRoute.GET(req({ scope: "organization" })), 403); await data(await exportRoute.GET(req({ scope: "organization" })), 403);
  await data(await pageRoute.GET(req({}, other.id)), 403); await data(await exportRoute.GET(req({}, other.id)), 403);
  login(foreign.id);
  const foreignOwn = await data(await pageRoute.GET(req({}, other.id))); assert.equal(foreignOwn.totalGroups, "1"); assert.equal(foreignOwn.groups[0].model, "FOREIGN-SENTINEL");
  session = null; await data(await pageRoute.GET(req()), 401); await data(await exportRoute.GET(req()), 401);

  const server = new McpServer({ name: "AI usage reports", version: "1" }); registerAiUsageTools(server, ctx);
  const workerServer = new McpServer({ name: "Own usage reports", version: "1" }); registerAiUsageTools(workerServer, workerCtx);
  const client = new Client({ name: "Fixture", version: "1" }), workerClient = new Client({ name: "Member fixture", version: "1" });
  const [ct, st] = InMemoryTransport.createLinkedPair(), [wct, wst] = InMemoryTransport.createLinkedPair();
  await server.connect(st); await client.connect(ct); await workerServer.connect(wst); await workerClient.connect(wct);
  const call = async (client: Client, name: string, args: Record<string, unknown>, error = false) => { const result = await client.callTool({ name, arguments: args }); assert.equal(!!result.isError, error, JSON.stringify(result)); return JSON.parse((result.content as { text: string }[])[0].text); };
  try {
    assert.deepEqual(await call(client, "get_ai_usage_page", input), first);
    assert.deepEqual(await call(client, "export_ai_usage", { ...query, scope: "organization" }), exported);
    assert.equal((await call(workerClient, "get_ai_usage_page", query)).totalGroups, "2");
    assert.equal((await call(workerClient, "export_ai_usage", { ...query, scope: "organization" }, true)).status, 403);
    assert.equal((await call(workerClient, "get_ai_usage_page", { ...query, userId: owner.id }, true)).status, 403);
    assert.equal((await call(workerClient, "export_ai_usage", { ...query, userId: owner.id }, true)).status, 403);
    const [role] = await db.insert(customRole).values({ organizationId: org.id, name: "No usage", permissions: ["view:data"] }).returning();
    await db.update(member).set({ customRoleId: role.id }).where(and(eq(member.organizationId, org.id), eq(member.userId, owner.id)));
    assert.equal((await call(client, "get_ai_usage_page", input, true)).status, 403); assert.equal((await call(client, "export_ai_usage", { ...query, scope: "organization" }, true)).status, 403);
    login(owner.id); await data(await pageRoute.GET(req({ scope: "organization" })), 403); await data(await exportRoute.GET(req({ scope: "organization" })), 403);
    await db.update(member).set({ customRoleId: null }).where(and(eq(member.organizationId, org.id), eq(member.userId, owner.id)));
    await db.delete(member).where(and(eq(member.organizationId, org.id), eq(member.userId, worker.id)));
    assert.equal((await call(workerClient, "export_ai_usage", query, true)).status, 403);

    // One extra group above the documented bound: neither transport can return
    // a truncated export, but reports can still page through the full set.
    await db.execute(sql`insert into ai_usage_attempt (organization_id, owner_id, provider_id, model, price_id, currency, attempt_key, state, reserved_tokens, reserved_cost, charged_tokens, charged_cost, price_snapshot, budget_versions, created_at)
      select ${org.id}::uuid, ${owner.id}::uuid, ${provider.id}::uuid, 'bulk-' || n, ${price.id}::uuid, 'USD', 'bulk-' || n, 'reserved', 1, 1, 1, 1, '{}', '[]', ${new Date(query.from)} from generate_series(1, 10001) n`);
    const bounded = await data(await pageRoute.GET(req({ scope: "organization", pageSize: 100 })));
    assert.equal(bounded.groups.length, 100); assert.equal(bounded.totalGroups, "10006");
    const overflow = await exportRoute.GET(req({ scope: "organization" })); await data(overflow, 413); assert.ok(!overflow.headers.has("content-disposition"));
    assert.equal((await call(client, "export_ai_usage", { ...query, scope: "organization" }, true)).status, 413);
    assert.equal((await data(await exportRoute.GET(req({ scope: "organization", model: "bulk-1" })))).totalGroups, "1");
    // Exact export boundary is accepted, not only the over-limit failure.
    await db.delete(aiUsageAttempt).where(and(eq(aiUsageAttempt.organizationId, org.id), eq(aiUsageAttempt.attemptKey, "bulk-10001")));
    const atBound = await reports.exportUsageReport(ctx, { ...query, scope: "organization", state: "reserved", priceId: price.id });
    assert.equal(atBound.totalGroups, "10000"); assert.equal(atBound.groups.length, 10000); assert.ok("complete" in atBound); assert.equal(atBound.complete, true);
  } finally { await client.close(); await server.close(); await workerClient.close(); await workerServer.close(); }
  console.log("AI filtered usage pages and exports REST/MCP/SQL verified");
}
main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
