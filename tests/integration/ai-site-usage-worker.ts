import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { mock } from "node:test";
import { eq, sql } from "drizzle-orm";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { users, organization, member, aiProvider, aiPrice, aiUsageAttempt, apiKey, mcpAccessToken, mcpOAuthClient, subscription } from "../../lib/db/schema";

let session: { user: { id: string }; iat: number; expires: string } | null = null;
// Only session acquisition is stubbed. Current session revocation, site flag,
// organization credentials, HTTP handlers, MCP transport and SQL are real.
mock.module(new URL("../../lib/auth.ts", import.meta.url).href, { namedExports: { auth: async () => session } });

async function main() {
  const pageRoute = await import("../../app/api/v1/admin/ai/usage/route");
  const exportRoute = await import("../../app/api/v1/admin/ai/usage/export/route");
  const mcpRoute = await import("../../app/api/v1/admin/ai/mcp/route");
  const orgRoute = await import("../../app/api/v1/ai/usage/report/route");
  const { getSiteSessionContext } = await import("../../lib/api/require-site-admin");
  const { getAuthContext } = await import("../../lib/api/auth-context");
  const { resolveToken } = await import("../../lib/mcp/auth");
  const { createSiteMcpServer, createMcpServer } = await import("../../lib/mcp/server");
  const { siteUsageReportPage } = await import("../../lib/ai/site-usage");
  const [admin, owner] = await db.insert(users).values([{ email: "ai056-admin@test.invalid", isSiteAdmin: true }, { email: "ai056-owner@test.invalid" }]).returning();
  const [org, other] = await db.insert(organization).values([{ name: "First", slug: "ai056-first" }, { name: "Second", slug: "ai056-second" }]).returning();
  // The site admin has no membership; global reads must not invent a tenant.
  await db.insert(member).values({ organizationId: org.id, userId: owner.id, role: "owner" });
  const login = (id = admin.id) => { session = { user: { id }, iat: Math.floor(Date.now() / 1000), expires: new Date(Date.now() + 3600000).toISOString() }; };
  const query = { from: "2026-10-01T00:00:00Z", to: "2026-11-01T00:00:00Z" };
  const req = (input: Record<string, unknown> = {}, headers: Record<string, string> = {}) => new Request(`http://fixture.invalid/api/v1/admin/ai/usage?${new URLSearchParams(Object.entries({ ...query, ...input }).map(([k, v]) => [k, String(v)]))}`, { headers });
  const data = async (r: Response, status = 200) => { assert.equal(r.status, status, await r.clone().text()); return r.json(); };
  const httpMcp = (name: string, args: Record<string, unknown> = query, headers: Record<string, string> = {}) => mcpRoute.POST(new Request("http://fixture.invalid/api/v1/admin/ai/mcp", {
    method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream", ...headers },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }),
  }));
  const rpcData = async (r: Response, error = false) => { const body = await data(r); assert.equal(!!body.result.isError, error, JSON.stringify(body)); return JSON.parse(body.result.content[0].text); };
  login();
  const empty = await data(await pageRoute.GET(req()));
  assert.equal(empty.scope, "site"); assert.deepEqual(empty.groups, []); assert.deepEqual(empty.totalsByCurrency, []);
  assert.equal(empty.totalGroups, "0"); assert.ok(!("organizationId" in empty));
  const [provider] = await db.insert(aiProvider).values({ name: "Synthetic site usage", adapter: "responses", endpoint: "https://fixture.invalid/v1/responses", defaultModel: "fixture", models: [], delegatedOrganizations: [], enabled: false }).returning();
  const priceBase = { providerId: provider.id, model: "fixture", currency: "USD", inputRate: "1", outputRate: "1", cachedRate: "1", reasoningRate: "1", evidenceDate: "2026-11-02", source: "synthetic", createdBy: owner.id };
  const [price, foreignPrice, eur] = await db.insert(aiPrice).values([{ ...priceBase, organizationId: org.id }, { ...priceBase, organizationId: other.id }, { ...priceBase, organizationId: other.id, currency: "EUR" }]).returning();
  const seed = (overrides: Partial<typeof aiUsageAttempt.$inferInsert> = {}) => ({
    organizationId: org.id, ownerId: owner.id, providerId: provider.id, model: "fixture", priceId: price.id, currency: "USD", attemptKey: randomUUID(),
    state: "settled" as const, reservedTokens: "10", reservedCost: "100", chargedTokens: "10", chargedCost: "100",
    inputTokens: "6", outputTokens: "4", cachedTokens: "0", reasoningTokens: "1", priceSnapshot: "PRIVATE-SNAPSHOT-SENTINEL", budgetVersions: "PRIVATE-BUDGET-SENTINEL", settlement: "PRIVATE-SETTLEMENT-SENTINEL", createdAt: new Date(query.from), ...overrides,
  });
  await db.insert(aiUsageAttempt).values([
    seed({ inputTokens: "9007199254740993", chargedTokens: "9007199254740997", chargedCost: "900719925474099300000000000001" }),
    seed({ organizationId: other.id, priceId: foreignPrice.id }),
    seed({ state: "unknown", model: "uncertain", inputTokens: "7", outputTokens: null, cachedTokens: null, reasoningTokens: null, chargedCost: "500" }),
    seed({ organizationId: other.id, priceId: eur.id, currency: "EUR", state: "reserved", inputTokens: null, outputTokens: null, cachedTokens: null, reasoningTokens: null, chargedCost: "700" }),
    seed({ createdAt: new Date(Date.parse(query.from) - 1), model: "BEFORE-SENTINEL" }),
    seed({ createdAt: new Date(query.to), model: "AFTER-SENTINEL" }),
  ]);
  const firstResponse = await pageRoute.GET(req({ pageSize: 1 }, { "x-organization-id": org.id }));
  assert.equal(firstResponse.headers.get("cache-control"), "private, no-store");
  const first = await data(firstResponse);
  assert.equal(first.groups.length, 1); assert.equal(first.totalGroups, "4"); assert.equal(first.hasNextPage, true);
  const usd = first.totalsByCurrency.find((v: { currency: string }) => v.currency === "USD");
  const euro = first.totalsByCurrency.find((v: { currency: string }) => v.currency === "EUR");
  assert.equal(usd.attempts, "3"); assert.equal(usd.inputTokens, "9007199254741006"); assert.equal(usd.chargedCost, "900719925474099300.000000000601");
  assert.equal(usd.unknownOutputAttempts, "1"); assert.equal(usd.unresolvedCost, "0.000000000500");
  assert.equal(euro.inputTokens, null); assert.equal(euro.unknownInputAttempts, "1"); assert.equal(euro.reservedCost, "0.000000000700");
  const groups = [];
  for (let page = 1; page <= 4; page++) {
    const result = await data(await pageRoute.GET(req({ page, pageSize: 1 })));
    groups.push(...result.groups); assert.deepEqual(result.totalsByCurrency, first.totalsByCurrency); assert.equal(result.hasNextPage, page < 4);
  }
  assert.equal(new Set(groups.map(v => JSON.stringify(v))).size, 4);
  assert.deepEqual(new Set(groups.map(v => v.organizationId)), new Set([org.id, other.id]));
  const beyond = await data(await pageRoute.GET(req({ page: 5, pageSize: 1 })));
  assert.deepEqual(beyond.groups, []); assert.deepEqual(beyond.totalsByCurrency, first.totalsByCurrency);
  const exportResponse = await exportRoute.GET(req()); const exported = await data(exportResponse);
  assert.equal(exportResponse.headers.get("content-disposition"), 'attachment; filename="ai-site-usage.json"');
  assert.equal(exportResponse.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(exported.groups, groups); assert.equal(exported.complete, true); assert.deepEqual(exported.totalsByCurrency, first.totalsByCurrency);
  assert.ok(!JSON.stringify(exported).includes("SENTINEL"));
  const filters = { organizationId: other.id.toUpperCase(), userId: owner.id.toUpperCase(), providerId: provider.id, model: "fixture", currency: "USD", priceId: foreignPrice.id, state: "settled" };
  const filtered = await data(await pageRoute.GET(req(filters))); assert.equal(filtered.totalGroups, "1"); assert.equal(filtered.groups[0].organizationId, other.id);
  assert.equal((await data(await pageRoute.GET(req({ organizationId: randomUUID() })))).totalGroups, "0");
  for (const invalid of [{ scope: "site" }, { pageSize: 101 }, { currency: "usd" }, { organizationId: "invalid" }, { to: query.from }, { to: "2027-01-04T00:00:00Z" }, { userId: "invalid" }]) await data(await pageRoute.GET(req(invalid)), 400);
  await data(await exportRoute.GET(req({ page: 1 })), 400);
  assert.equal((await httpMcp("get_ai_site_usage_page", query, { origin: "https://foreign.invalid" })).status, 403);
  assert.deepEqual(await rpcData(await httpMcp("get_ai_site_usage_page", { ...query, pageSize: 1 })), first);
  assert.deepEqual(await rpcData(await httpMcp("export_ai_site_usage")), exported);
  assert.equal((await rpcData(await httpMcp("get_ai_site_usage_page", { ...query, ...filters }))).totalGroups, "1");

  const ctx = await getSiteSessionContext(req());
  const server = createSiteMcpServer(ctx), client = new Client({ name: "Site fixture", version: "1" });
  const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
  const call = async (name: string, args: Record<string, unknown> = query, error = false) => { const r = await client.callTool({ name, arguments: args }); assert.equal(!!r.isError, error, JSON.stringify(r)); return JSON.parse((r.content as { text: string }[])[0].text); };
  try {
    assert.deepEqual((await client.listTools()).tools.map(t => t.name).sort(), ["export_ai_site_usage", "get_ai_site_usage_page"]);
    assert.deepEqual(await call("get_ai_site_usage_page", { ...query, pageSize: 1 }), first);
    assert.deepEqual(await call("export_ai_site_usage"), exported);
    await assert.rejects(siteUsageReportPage({ kind: "site-session", userId: admin.id }, query), /Verified site administrator/);

    // Both operations reject unauthenticated/non-admin sessions and every bearer
    // type, even when the cookie belongs to a real site administrator.
    session = null;
    for (const handler of [pageRoute.GET, exportRoute.GET]) await data(await handler(req()), 401);
    await data(await httpMcp("get_ai_site_usage_page"), 401); await data(await httpMcp("export_ai_site_usage"), 401);
    login(owner.id);
    for (const handler of [pageRoute.GET, exportRoute.GET]) await data(await handler(req()), 403);
    await data(await httpMcp("get_ai_site_usage_page"), 403); await data(await httpMcp("export_ai_site_usage"), 403);
    login();
    for (const authorization of ["Bearer dk_fixture", "Bearer mcp_at_fixture", "Bearer anything"]) {
      for (const handler of [pageRoute.GET, exportRoute.GET]) await data(await handler(req({}, { authorization })), 403);
      await data(await httpMcp("get_ai_site_usage_page", query, { authorization }), 403);
      await data(await httpMcp("export_ai_site_usage", query, { authorization }), 403);
    }
    // Prove valid org credentials for a site admin retain only tenant authority.
    await db.insert(member).values({ organizationId: org.id, userId: admin.id, role: "owner" });
    await db.insert(subscription).values({ organizationId: org.id, plan: "pro", status: "active" });
    const key = "dk_site_admin_fixture", token = "mcp_at_site_admin_fixture";
    const [keyRow] = await db.insert(apiKey).values({ organizationId: org.id, createdBy: admin.id, name: "Site fixture", keyPrefix: "dk_site", keyHash: createHash("sha256").update(key).digest("hex") }).returning();
    const [oauth] = await db.insert(mcpOAuthClient).values({ clientId: randomUUID(), clientName: "Site fixture", redirectUris: ["http://fixture.invalid/callback"] }).returning();
    await db.insert(mcpAccessToken).values({ tokenHash: createHash("sha256").update(token).digest("hex"), clientId: oauth.clientId, userId: admin.id, organizationId: org.id, expiresAt: new Date(Date.now() + 60000) });
    const orgCtx = await getAuthContext(req({}, { authorization: `Bearer ${key}` }));
    const tokenCtx = await resolveToken(token);
    assert.equal(orgCtx.organizationId, org.id); assert.equal(tokenCtx.organizationId, org.id); assert.ok(keyRow.id);
    await assert.rejects(siteUsageReportPage(orgCtx as never, query), /Verified site administrator/);
    await assert.rejects(siteUsageReportPage(tokenCtx as never, query), /Verified site administrator/);
    for (const credential of [key, token]) {
      for (const handler of [pageRoute.GET, exportRoute.GET]) await data(await handler(req({}, { authorization: `Bearer ${credential}` })), 403);
      await data(await httpMcp("get_ai_site_usage_page", query, { authorization: `Bearer ${credential}` }), 403);
      await data(await httpMcp("export_ai_site_usage", query, { authorization: `Bearer ${credential}` }), 403);
    }
    const orgServer = createMcpServer(tokenCtx), orgClient = new Client({ name: "Org fixture", version: "1" });
    const [oct, ost] = InMemoryTransport.createLinkedPair(); await orgServer.connect(ost); await orgClient.connect(oct);
    try {
      assert.ok(!(await orgClient.listTools()).tools.some(t => t.name.includes("ai_site_usage")));
      assert.equal((await orgClient.callTool({ name: "export_ai_site_usage", arguments: query })).isError, true);
    } finally { await orgClient.close(); await orgServer.close(); }
    await data(await orgRoute.GET(req({ scope: "site" }, { "x-organization-id": org.id })), 400);
    await data(await orgRoute.GET(req({ scope: "organization", organizationId: other.id }, { "x-organization-id": org.id })), 400);

    await db.update(users).set({ isSiteAdmin: false }).where(eq(users.id, admin.id));
    for (const name of ["get_ai_site_usage_page", "export_ai_site_usage"]) assert.equal((await call(name, query, true)).status, 403);
    await data(await pageRoute.GET(req()), 403); await data(await exportRoute.GET(req()), 403);
    await db.update(users).set({ isSiteAdmin: true, sessionRevokedAt: new Date() }).where(eq(users.id, admin.id));
    for (const name of ["get_ai_site_usage_page", "export_ai_site_usage"]) assert.equal((await call(name, query, true)).status, 401);
    await data(await pageRoute.GET(req()), 401); await data(await httpMcp("export_ai_site_usage"), 401);
    await db.update(users).set({ sessionRevokedAt: null }).where(eq(users.id, admin.id));
    login(); session!.expires = new Date(Date.now() - 1).toISOString();
    await data(await pageRoute.GET(req()), 401); await data(await httpMcp("export_ai_site_usage"), 401);
    login();
    // Revoke after actual SQL aggregation, before disclosure. The post-query
    // check must suppress the completed report on both REST and linked MCP.
    const transaction = db.transaction.bind(db);
    const hook = mock.method(db, "transaction", async (fn: Parameters<typeof db.transaction>[0], config: Parameters<typeof db.transaction>[1]) => {
      const result = await transaction(fn, config);
      await db.update(users).set({ isSiteAdmin: false }).where(eq(users.id, admin.id));
      return result;
    });
    try {
      for (const handler of [pageRoute.GET, exportRoute.GET]) {
        await data(await handler(req()), 403);
        await db.update(users).set({ isSiteAdmin: true }).where(eq(users.id, admin.id));
      }
      for (const name of ["get_ai_site_usage_page", "export_ai_site_usage"]) {
        assert.equal((await call(name, query, true)).status, 403);
        await db.update(users).set({ isSiteAdmin: true }).where(eq(users.id, admin.id));
        assert.equal((await rpcData(await httpMcp(name), true)).status, 403);
        await db.update(users).set({ isSiteAdmin: true }).where(eq(users.id, admin.id));
      }
    } finally { hook.mock.restore(); await db.update(users).set({ isSiteAdmin: true }).where(eq(users.id, admin.id)); }

    await db.execute(sql`insert into ai_usage_attempt (organization_id, owner_id, provider_id, model, price_id, currency, attempt_key, state, reserved_tokens, reserved_cost, charged_tokens, charged_cost, price_snapshot, budget_versions, created_at)
      select ${other.id}::uuid, ${owner.id}::uuid, ${provider.id}::uuid, 'bulk-' || n, ${foreignPrice.id}::uuid, 'USD', 'bulk-' || n, 'reserved', 1, 1, 1, 1, '{}', '[]', ${new Date(query.from)} from generate_series(1, 10001) n`);
    const bounded = await data(await pageRoute.GET(req({ pageSize: 100 }))); assert.equal(bounded.groups.length, 100); assert.equal(bounded.totalGroups, "10005");
    const overflow = await exportRoute.GET(req()); await data(overflow, 413); assert.ok(!overflow.headers.has("content-disposition"));
    assert.equal((await call("export_ai_site_usage", query, true)).status, 413);
    assert.equal((await rpcData(await httpMcp("export_ai_site_usage"), true)).status, 413);
    assert.equal((await data(await exportRoute.GET(req({ organizationId: org.id })))).totalGroups, "2");
    await db.delete(aiUsageAttempt).where(eq(aiUsageAttempt.attemptKey, "bulk-10001"));
    const exact = await data(await exportRoute.GET(req({ organizationId: other.id, state: "reserved", currency: "USD" })));
    assert.equal(exact.totalGroups, "10000"); assert.equal(exact.groups.length, 10000); assert.equal(exact.complete, true);
    assert.deepEqual(await call("export_ai_site_usage", { ...query, organizationId: other.id, state: "reserved", currency: "USD" }), exact);
  } finally { await client.close(); await server.close(); }
  console.log("AI site-session usage REST/MCP/SQL verified");
}
main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
