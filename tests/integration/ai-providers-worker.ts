import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { mock } from "node:test";
import type { RequestOptions } from "node:https";
import { eq } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { users, organization, member, aiProviderConfig, aiProvider, aiUsageAttempt, apiKey, auditLog } from "../../lib/db/schema";
import { createHash } from "node:crypto";

let session: { user: { id: string }; iat: number; expires: string } | null = null;
let dns = [{ address: "8.8.8.8", family: 4 }];
let status = 200, mode = "valid", requests = 0;
const endpoint = "https://provider.fixture.invalid/v1/responses";
mock.module(new URL("../../lib/auth.ts", import.meta.url).href, { namedExports: { auth: async () => session } });
mock.module("node:dns/promises", { namedExports: { lookup: async () => dns } });
mock.module("node:https", { namedExports: { request: (url: URL, options: RequestOptions, callback: (response: PassThrough & { statusCode: number }) => void) => {
  requests++; assert.equal(url.href, endpoint); assert.equal(options.agent, false); assert.equal(options.family, 4);
  assert.equal(options.headers && (options.headers as Record<string, string>).authorization, "Bearer fixture-secret-one");
  options.lookup!(url.hostname, {}, (err, ip, family) => { assert.equal(err, null); assert.equal(ip, "8.8.8.8"); assert.equal(family, 4); });
  const req = new EventEmitter() as EventEmitter & { end: (body: string) => void };
  options.signal?.addEventListener("abort", () => req.emit("error", new Error("must sanitize credential raw failure")), { once: true });
  req.end = body => {
    const parsed = JSON.parse(body); assert.equal(parsed.store, false); assert.equal(parsed.parallel_tool_calls, false); assert.deepEqual(parsed.tools, []); assert.equal(parsed.input, "Reply OK.");
    if (mode === "timeout") return;
    queueMicrotask(() => {
      const response = Object.assign(new PassThrough(), { statusCode: status }); callback(response);
      response.end(mode === "invalid" ? "not-json fixture-secret-one" : mode === "oversize" ? "x".repeat(70000) : JSON.stringify({ status: "completed", model: mode === "wrong-model" ? "unexpected-model" : parsed.model, usage: { input_tokens: 3, output_tokens: 1 }, output: [{ secret: "fixture-secret-one", text: "PRIVATE_PROVIDER_DIAGNOSTIC" }] }));
    });
  };
  return req;
} } });

async function main() {
  process.env.AI_APPROVED_PROVIDER_ENDPOINTS = JSON.stringify([endpoint]);
  process.env.AI_CREDENTIAL_KEYS = JSON.stringify({ v1: Buffer.alloc(32, 1).toString("base64"), v2: Buffer.alloc(32, 2).toString("base64") });
  process.env.AI_CREDENTIAL_ACTIVE_KEY = "v1";
  const service = await import("../../lib/ai/providers");
  const security = await import("../../lib/ai/provider-security");
  const { getAuthContext } = await import("../../lib/api/auth-context");
  const catalogRoute = await import("../../app/api/v1/ai/provider-catalog/route");
  const platformRoute = await import("../../app/api/v1/ai/provider-catalog/platform/route");
  const updateRoute = await import("../../app/api/v1/ai/provider-catalog/[id]/route");
  const configRoute = await import("../../app/api/v1/ai/provider-configs/route");
  const credentialRoute = await import("../../app/api/v1/ai/provider-configs/[id]/credential/route");
  const testRoute = await import("../../app/api/v1/ai/provider-configs/[id]/test/route");
  const { registerAiProviderTools, AI_PROVIDER_ADMIN_TOOLS } = await import("../../lib/mcp/tools/ai-providers");
  const [site, owner, viewer, foreign] = await db.insert(users).values(["site", "owner", "viewer", "foreign"].map(name => ({ name, email: `ai004-${name}@test.invalid`, isSiteAdmin: name === "site" }))).returning();
  const [a, b] = await db.insert(organization).values([{ name: "AI provider", slug: "ai004-a" }, { name: "Foreign", slug: "ai004-b" }]).returning();
  await db.insert(member).values([{ organizationId: a.id, userId: site.id, role: "owner" }, { organizationId: a.id, userId: owner.id, role: "owner" }, { organizationId: a.id, userId: viewer.id, role: "member" }, { organizationId: b.id, userId: foreign.id, role: "owner" }]);
  function login(id: string) { session = { user: { id }, iat: Math.floor(Date.now() / 1000), expires: new Date(Date.now() + 3600000).toISOString() }; }
  const req = (method = "GET", body?: object, org = a.id, bearer?: string) => new Request("http://test.invalid/ai", { method, headers: { "x-organization-id": org, "content-type": "application/json", ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const params = (id: string) => ({ params: Promise.resolve({ id }) });
  const data = async (response: Response, expected = 200) => { assert.equal(response.status, expected, await response.clone().text()); return response.json(); };
  const model = { id: "fixture-model", contextTokens: 8192, outputTokens: 4096, functionCalls: true, strictSchemas: true, streaming: false, usage: true, evidenceDate: "2026-10-27" };
  const definition = { name: "Fixture", adapter: "responses", endpoint, enabled: true, models: [model], defaultModel: model.id, timeoutMs: 100, delegatedOrganizations: [a.id] };
  login(owner.id); await data(await catalogRoute.POST(req("POST", definition)), 403);
  await data(await platformRoute.GET(req()), 403);
  login(site.id); const provider = await data(await catalogRoute.POST(req("POST", definition)), 201);
  assert.deepEqual((await data(await platformRoute.GET(req()))).providers[0].delegatedOrganizations, [a.id]);
  const secretKey = "dk_ai004_site_fixture";
  await db.insert(apiKey).values({ organizationId: a.id, name: "fixture", keyHash: createHash("sha256").update(secretKey).digest("hex"), keyPrefix: "dk_fixture", createdBy: site.id });
  await data(await catalogRoute.POST(req("POST", definition, a.id, secretKey)), 403);
  await data(await platformRoute.GET(req("GET", undefined, a.id, secretKey)), 403);
  await data(await catalogRoute.POST(req("POST", { ...definition, endpoint: "https://localhost/v1/responses" })), 422);
  await data(await catalogRoute.POST(req("POST", { ...definition, organizationId: b.id })), 400);
  login(viewer.id); await data(await configRoute.GET(req()), 403);
  login(foreign.id); assert.deepEqual((await data(await catalogRoute.GET(req("GET", undefined, b.id)))).providers, []);
  await data(await configRoute.POST(req("POST", { providerId: provider.id, configuration: { enabled: true, isDefault: true } }, b.id)), 403);
  login(owner.id); const ctx = await getAuthContext(req());
  let config = await data(await configRoute.POST(req("POST", { providerId: provider.id, configuration: { enabled: true, isDefault: true } })));
  const malformed = new Request("http://test.invalid/ai", { method: "PUT", headers: { "x-organization-id": a.id, "content-type": "application/json" }, body: '{"secret":"fixture-secret-one",broken' });
  const invalidJson = await data(await credentialRoute.PUT(malformed, params(config.id)), 400);
  assert.ok(!JSON.stringify(invalidJson).includes("fixture-secret-one"));
  await data(await configRoute.POST(req("POST", { providerId: provider.id, configuration: { enabled: true, isDefault: true } })), 409);
  await data(await credentialRoute.PUT(req("PUT", { expectedVersion: config.version, secret: "fixture-secret-one" }), params(config.id)));
  config = (await data(await configRoute.GET(req()))).configurations[0]; assert.equal(config.credential, "********");
  let [stored] = await db.select().from(aiProviderConfig).where(eq(aiProviderConfig.id, config.id));
  assert.ok(stored.credential && !stored.credential.includes("fixture-secret-one")); assert.equal(stored.keyVersion, "v1");
  assert.equal(security.openCredential(stored.credential!, stored.keyVersion!, `${a.id}:${config.id}`), "fixture-secret-one");
  assert.throws(() => security.openCredential(stored.credential!, stored.keyVersion!, `${b.id}:${config.id}`), /unavailable/);
  delete process.env.AI_CREDENTIAL_KEYS;
  await data(await credentialRoute.PUT(req("PUT", { expectedVersion: config.version, secret: "fixture-secret-one" }), params(config.id)), 503);
  process.env.AI_CREDENTIAL_KEYS = JSON.stringify({ v1: Buffer.alloc(32, 1).toString("base64"), v2: Buffer.alloc(32, 2).toString("base64") });
  process.env.AI_CREDENTIAL_ACTIVE_KEY = "v2";
  config = await data(await credentialRoute.PUT(req("PUT", { expectedVersion: config.version, secret: "fixture-secret-one" }), params(config.id)));
  const priorRef = stored.credentialRef;
  [stored] = await db.select().from(aiProviderConfig).where(eq(aiProviderConfig.id, config.id)); assert.equal(stored.keyVersion, "v2"); assert.notEqual(stored.credentialRef, priorRef);
  // Synthetic fixture prices and explicit quotas; no live pricing qualification.
  const meter = await import("../../lib/ai/usage");
  await meter.createPrice(ctx, { providerId: provider.id, model: model.id, currency: "USD", inputPerMillion: "1", outputPerMillion: "2", cachedPerMillion: "1", reasoningPerMillion: "2", evidenceDate: "2026-10-27", source: "synthetic-test-fixture" });
  const budget = { currency: "USD", monthlyTokens: "1000000", monthlyCost: "100", runTokens: "100000", runCost: "10", requestsPerMinute: 1000, concurrency: 100 };
  await meter.configureBudget(ctx, { ...budget, userId: null }); await meter.configureBudget(ctx, { ...budget, userId: owner.id });
  const server = new McpServer({ name: "AI provider", version: "1" }); registerAiProviderTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1" }), [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
  const call = async (name: string, args: Record<string, unknown>, error = false) => { const r = await client.callTool({ name, arguments: args }); assert.equal(!!r.isError, error, JSON.stringify(r)); return JSON.parse((r.content as { text: string }[])[0].text); };
  try {
    const names = (await client.listTools()).tools.map(t => t.name); assert.ok(names.every(n => AI_PROVIDER_ADMIN_TOOLS.has(n))); assert.equal(service.PROVIDER_ADMIN_CHAT_ALLOWED, false);
    assert.deepEqual(await call("list_ai_provider_configs", {}), (await data(await configRoute.GET(req()))).configurations);
    assert.equal((await call("create_ai_provider", definition, true)).status, 403);
    assert.equal((await call("list_ai_platform_providers", {}, true)).status, 403);
    assert.equal((await call("test_ai_provider_connection", { configId: config.id }, true)).status, 403); assert.equal(requests, 0);
    process.env.AI_PROVIDER_CALLS_ENABLED = "true";
    const test = await data(await testRoute.POST(req("POST"), params(config.id))); assert.equal(test.connected, true); assert.equal(test.usage.input_tokens, 3); assert.ok(!JSON.stringify(test).includes("PRIVATE_PROVIDER_DIAGNOSTIC"));
    assert.equal((await call("test_ai_provider_connection", { configId: config.id })).connected, true);
    for (const [newStatus, newMode, expected] of [[302, "valid", 502], [401, "valid", 502], [429, "valid", 502], [200, "invalid", 502], [200, "wrong-model", 502], [200, "oversize", 502], [200, "timeout", 504]] as const) {
      status = newStatus; mode = newMode; const result = await data(await testRoute.POST(req("POST"), params(config.id)), expected); assert.ok(!JSON.stringify(result).includes("fixture-secret-one"));
    }
    mode = "valid"; status = 200;
    const before = requests;
    dns = [{ address: "127.0.0.1", family: 4 }]; await data(await testRoute.POST(req("POST"), params(config.id)), 422); assert.equal(requests, before);
    dns = [{ address: "8.8.8.8", family: 4 }, { address: "169.254.169.254", family: 4 }]; await data(await testRoute.POST(req("POST"), params(config.id)), 422); assert.equal(requests, before);
    dns = [{ address: "8.8.8.8", family: 4 }];
    for (const ip of ["0.0.0.0", "127.1.1.1", "10.0.0.1", "100.64.0.1", "172.16.0.1", "192.168.0.1", "169.254.169.254", "::1", "::ffff:8.8.8.8", "fe80::1", "fc00::1", "2001:db8::1", "2001:0db8:0000:0000:0000:0000:0000:0001", "2002:0808:0808::1", "224.0.0.1"]) assert.equal(security.publicAddress(ip), false, ip);
    assert.equal(security.publicAddress("8.8.8.8"), true); assert.equal(security.publicAddress("2606:4700:4700::1111"), true);
    for (const url of ["http://provider.fixture.invalid/v1/responses", "https://user:secret@provider.fixture.invalid/v1/responses", `${endpoint}?secret=value`, "https://127.0.0.1/v1/responses", "https://provider.fixture.invalid:444/v1/responses"]) assert.throws(() => security.approvedEndpoint(url));
    login(site.id); const second = await service.saveProvider(await getAuthContext(req()), { ...definition, name: "Second" });
    login(owner.id); const switched = await call("configure_ai_provider", { providerId: second.id, configuration: { enabled: true, isDefault: true } });
    const all = await call("list_ai_provider_configs", {}); assert.equal(all.filter((r: { isDefault: boolean }) => r.isDefault).length, 1); assert.equal(all.find((r: { isDefault: boolean }) => r.isDefault).id, switched.id);
    config = all.find((r: { id: string }) => r.id === config.id);
    config = await call("revoke_ai_provider_credential", { configId: config.id, expectedVersion: config.version }); assert.equal(config.credential, null); assert.equal(config.enabled, false);
    await data(await testRoute.POST(req("POST"), params(config.id)), 409);
    login(foreign.id); await data(await credentialRoute.DELETE(req("DELETE", { expectedVersion: config.version }, b.id), params(config.id)), 404);
    login(site.id); const updated = await data(await updateRoute.PATCH(req("PATCH", { expectedVersion: provider.version, configuration: { ...definition, enabled: false } }), params(provider.id)));
    await data(await updateRoute.PATCH(req("PATCH", { expectedVersion: provider.version, configuration: definition }), params(provider.id)), 409);
    login(owner.id); assert.equal((await call("configure_ai_provider", { providerId: provider.id, expectedVersion: config.version, configuration: { enabled: true, isDefault: false } }, true)).status, 409);
    login(site.id); await service.saveProvider(await getAuthContext(req()), { ...definition, enabled: false, delegatedOrganizations: [] }, provider.id, updated.version);
    login(owner.id); assert.equal((await call("configure_ai_provider", { providerId: provider.id, expectedVersion: config.version, configuration: { enabled: false, isDefault: false } }, true)).status, 403);
    config = await call("revoke_ai_provider_credential", { configId: config.id, expectedVersion: config.version });
    await db.update(member).set({ role: "member" }).where(eq(member.userId, owner.id)); assert.equal((await call("list_ai_provider_configs", {}, true)).status, 403);
    const audits = await db.select().from(auditLog); assert.ok(audits.length > 5); assert.ok(!JSON.stringify(audits).includes("fixture-secret-one"));
    const rows = await db.select().from(aiProviderConfig); assert.ok(rows.every(r => !r.credential));
    const attempts = await db.select().from(aiUsageAttempt);
    assert.equal(attempts.length, requests + 2); // Two DNS failures conservatively retained too.
    assert.equal(attempts.filter(r => r.state === "settled").length, 2);
    assert.ok(attempts.filter(r => r.state === "unknown").every(r => r.inputTokens === null && BigInt(r.chargedTokens) > 0n));
    assert.equal((await db.select().from(aiProvider)).length, 2);
    console.log("AI providers REST/MCP/SQL and transport guards verified");
  } finally { await client.close(); await server.close(); }
}
main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
