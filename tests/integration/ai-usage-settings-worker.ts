import assert from "node:assert/strict";
import { mock } from "node:test";
import { and, eq } from "drizzle-orm";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { users, organization, member, customRole, aiProvider, aiPrice, aiUsageAttempt } from "../../lib/db/schema";

let session: { user: { id: string }; iat: number; expires: string } | null = null;
mock.module(new URL("../../lib/auth.ts", import.meta.url).href, { namedExports: { auth: async () => session } });

async function main() {
  const prices = await import("../../app/api/v1/ai/prices/route"), budgets = await import("../../app/api/v1/ai/budgets/route");
  const catalog = await import("../../app/api/v1/ai/provider-catalog/route"), members = await import("../../app/api/v1/members/route");
  const { getAuthContext } = await import("../../lib/api/auth-context");
  const { UsageSettingsController, usageNumber } = await import("../../lib/ai/usage-settings-client");
  const { registerAiUsageTools } = await import("../../lib/mcp/tools/ai-usage");
  const [owner, priceManager, budgetManager, ordinary, foreign] = await db.insert(users).values(["owner", "price", "budget", "chat", "foreign"].map(name => ({ name, email: `ai057-${name}@test.invalid` }))).returning();
  const [org, other] = await db.insert(organization).values([{ name: "Price forms", slug: "ai057-a" }, { name: "Other", slug: "ai057-b" }]).returning();
  const [priceRole, budgetRole, noRole] = await db.insert(customRole).values([
    { organizationId: org.id, name: "Prices", permissions: ["manage:ai-providers"] },
    { organizationId: org.id, name: "Budgets", permissions: ["manage:ai-policy"] },
    { organizationId: org.id, name: "No settings", permissions: ["use:ai", "view:ai-history"] },
  ]).returning();
  await db.insert(member).values([
    { organizationId: org.id, userId: owner.id, role: "owner" },
    { organizationId: org.id, userId: priceManager.id, role: "member", customRoleId: priceRole.id },
    { organizationId: org.id, userId: budgetManager.id, role: "member", customRoleId: budgetRole.id },
    { organizationId: org.id, userId: ordinary.id, role: "member", customRoleId: noRole.id },
    { organizationId: other.id, userId: foreign.id, role: "owner" },
  ]);
  const login = (id = owner.id) => { session = { user: { id }, iat: Math.floor(Date.now() / 1000), expires: new Date(Date.now() + 600000).toISOString() }; };
  const req = (method = "GET", body?: unknown, orgId = org.id) => new Request("http://fixture.invalid/api/v1/ai/prices", { method, headers: { "x-organization-id": orgId, "content-type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const responseData = async (r: Response, status = 200) => { assert.equal(r.status, status, await r.clone().text()); return r.json(); };
  login(); const ctx = await getAuthContext(req());
  const [provider] = await db.insert(aiProvider).values({ name: "Synthetic", adapter: "responses", endpoint: "https://fixture.invalid/responses", enabled: false, models: [{ id: "fixture", contextTokens: 1000, outputTokens: 100, functionCalls: true, strictSchemas: true, usage: true, streaming: false, evidenceDate: "2026-11-02" }], defaultModel: "fixture", delegatedOrganizations: [org.id] }).returning();
  const priceInput = { providerId: provider.id, model: "fixture", currency: "USD", inputPerMillion: "1", outputPerMillion: "1", cachedPerMillion: "0", reasoningPerMillion: "0", evidenceDate: "2026-11-02", source: "synthetic-not-live-pricing" };
  const oldPrice = await responseData(await prices.POST(req("POST", priceInput)));
  await db.insert(aiUsageAttempt).values({ organizationId: org.id, ownerId: owner.id, providerId: provider.id, model: "fixture", priceId: oldPrice.id, currency: "USD", attemptKey: "ai057-preserved-unknown", state: "unknown", reservedTokens: "5", reservedCost: "10", chargedTokens: "5", chargedCost: "10", priceSnapshot: "synthetic-original-price", budgetVersions: "[]" });
  const usageBefore = await db.select().from(aiUsageAttempt), providerBefore = await db.select().from(aiProvider);
  const originalFetch = globalThis.fetch; const calls: string[] = [];
  globalThis.fetch = async (url, init) => {
    const path = String(url), method = init?.method ?? "GET"; calls.push(`${method} ${path}`);
    const request = new Request(`http://fixture.invalid${path}`, { ...init, headers: init?.headers });
    if (path === "/api/v1/ai/prices") return method === "GET" ? prices.GET(request) : prices.POST(request);
    if (path === "/api/v1/ai/budgets") return method === "GET" ? budgets.GET(request) : budgets.PUT(request);
    if (path === "/api/v1/ai/provider-catalog") return catalog.GET(request);
    if (path === "/api/v1/members") return members.GET(request);
    throw new Error("Unexpected request");
  };
  const ready = (c: InstanceType<typeof UsageSettingsController>) => new Promise<void>(resolve => {
    const check = () => { if (!c.state.prices.loading && !c.state.budgets.loading) { unsub(); resolve(); } }; const unsub = c.subscribe(check); check();
  });
  const controller = new UsageSettingsController(() => org.id);
  const server = new McpServer({ name: "Usage settings fixture", version: "1" }); registerAiUsageTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1" }); const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
  const tool = async (name: string, args: Record<string, unknown> = {}, error = false) => { const result = await client.callTool({ name, arguments: args }); assert.equal(!!result.isError, error, JSON.stringify(result)); return JSON.parse((result.content as { text: string }[])[0].text); };
  try {
    controller.start(); await ready(controller); assert.equal(controller.state.prices.data!.prices.length, 1); assert.equal(controller.state.budgets.data!.members.length, 4);
    const newPrice = await controller.createPrice({ ...priceInput, inputPerMillion: usageNumber("۹۹۹۹۹۹۹۹۹۹۹۹٫۹۹۹۹۹۹") });
    assert.equal(newPrice.inputRate, "999999999999999999"); assert.notEqual(newPrice.id, oldPrice.id);
    assert.equal((await db.select().from(aiPrice).where(eq(aiPrice.id, oldPrice.id)))[0].inputRate, "1000000");
    assert.equal((await tool("list_ai_prices")).length, 2);
    const mcpPrice = await tool("create_ai_price", { ...priceInput, outputPerMillion: "999999999999.999999" }); assert.equal(mcpPrice.outputRate, "999999999999999999");
    const base = { userId: null, currency: "USD", monthlyTokens: usageNumber("۹۹۹۹۹۹۹۹۹۹۹۹۹۹۹۹۹۹"), monthlyCost: usageNumber("۹۹۹۹۹۹۹۹۹۹۹۹٫۹۹۹۹۹۹۹۹۹۹۹۹"), runTokens: "9007199254740993", runCost: "0.000000000001", requestsPerMinute: 10000, concurrency: 1000 };
    const orgBudget = await controller.saveBudget(base), memberBudget = await controller.saveBudget({ ...base, userId: ordinary.id });
    assert.equal(orgBudget.monthlyTokens, "999999999999999999"); assert.equal(orgBudget.monthlyCost, "999999999999.999999999999"); assert.equal(memberBudget.userId, ordinary.id);
    assert.equal((await tool("list_ai_budgets")).length, 2);
    const updated = await controller.saveBudget({ ...base, expectedVersion: 1, monthlyCost: "0", monthlyTokens: "0" }); assert.equal(updated.version, 2); assert.equal(updated.monthlyCost, "0.000000000000");
    await assert.rejects(controller.saveBudget({ ...base, expectedVersion: 1 }), { key: "conflict" });
    assert.equal((await tool("configure_ai_budget", { ...base, expectedVersion: 1 }, true)).status, 409);
    const mcpUpdated = await tool("configure_ai_budget", { ...base, expectedVersion: 2 }); assert.equal(mcpUpdated.version, 3);
    await controller.refresh("budgets"); assert.equal(controller.state.budgets.data!.budgets.find(b => b.userId === null)!.version, 3);
    await responseData(await budgets.PUT(req("PUT", { ...base, userId: foreign.id })), 404);
    await responseData(await prices.POST(req("POST", { ...priceInput, inputPerMillion: "0.0000001" })), 400);
    await responseData(await prices.POST(req("POST", priceInput, other.id)), 403);
    for (const [person, allowed] of [[priceManager, "prices"], [budgetManager, "budgets"], [ordinary, "none"]] as const) {
      login(person.id); const scoped = new UsageSettingsController(() => org.id); scoped.start(); await ready(scoped);
      assert.equal(!!scoped.state.prices.data, allowed === "prices"); assert.equal(!!scoped.state.budgets.data, allowed === "budgets"); scoped.dispose();
    }
    login();
    await db.update(member).set({ customRoleId: noRole.id }).where(and(eq(member.organizationId, org.id), eq(member.userId, owner.id)));
    await assert.rejects(controller.saveBudget({ ...base, expectedVersion: 3 }), { key: "denied" }); assert.equal(controller.state.budgets.data, undefined);
    assert.equal((await tool("configure_ai_budget", { ...base, expectedVersion: 3 }, true)).status, 403);
    assert.equal((await tool("create_ai_price", priceInput, true)).status, 403);
    assert.deepEqual(await db.select().from(aiUsageAttempt), usageBefore); assert.deepEqual(await db.select().from(aiProvider), providerBefore);
    assert.ok(calls.every(path => !path.includes("/test") && !path.includes("credential") && !path.includes("/usage")));
  } finally { controller.dispose(); globalThis.fetch = originalFetch; await client.close(); await server.close(); }
  console.log("AI price and budget settings REST/MCP/SQL verified");
}
main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
