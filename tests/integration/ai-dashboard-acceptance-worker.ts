import assert from "node:assert/strict";
import { mock } from "node:test";
import { and, eq } from "drizzle-orm";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { users, organization, member, customRole, aiProvider, aiProviderConfig, aiPrice, aiUsageAttempt, aiConversation, aiRun, aiStep } from "../../lib/db/schema";
import { DashboardController, defaultFilters, filterQuery, type Report } from "../../lib/ai/dashboard-client";
import { UsageSettingsController, usageNumber, priceDto } from "../../lib/ai/usage-settings-client";

// Only session acquisition and browser fetch dispatch are substituted. Routes,
// permission rechecks, linked MCP, migrations, controllers and SQL are real.
let session: { user: { id: string }; iat: number; expires: string } | null = null;
mock.module(new URL("../../lib/auth.ts", import.meta.url).href, { namedExports: { auth: async () => session } });

async function main() {
  const prices = await import("../../app/api/v1/ai/prices/route"), budgets = await import("../../app/api/v1/ai/budgets/route");
  const catalog = await import("../../app/api/v1/ai/provider-catalog/route"), members = await import("../../app/api/v1/members/route");
  const report = await import("../../app/api/v1/ai/usage/report/route"), exporting = await import("../../app/api/v1/ai/usage/export/route");
  const quota = await import("../../app/api/v1/ai/operations/quota/route"), runs = await import("../../app/api/v1/ai/operations/runs/route");
  const detail = await import("../../app/api/v1/ai/operations/run/route"), stop = await import("../../app/api/v1/ai/operations/stop/route");
  const disable = await import("../../app/api/v1/ai/operations/disable/route"), configs = await import("../../app/api/v1/ai/provider-configs/route");
  const siteReport = await import("../../app/api/v1/admin/ai/usage/route"), siteExport = await import("../../app/api/v1/admin/ai/usage/export/route");
  const history = await import("../../app/api/v1/ai/conversations/[id]/route"), transcriptAudit = await import("../../app/api/v1/ai/conversations/[id]/audit/route");
  const { getAuthContext } = await import("../../lib/api/auth-context");
  const { getSiteSessionContext } = await import("../../lib/api/require-site-admin");
  const { registerAiUsageTools } = await import("../../lib/mcp/tools/ai-usage");
  const { registerAiOperationTools } = await import("../../lib/mcp/tools/ai-operations");
  const { registerAiSiteUsageTools } = await import("../../lib/mcp/tools/ai-site-usage");
  const [owner, worker, auditor, siteUser, foreign] = await db.insert(users).values(["owner", "worker", "auditor", "site", "foreign"].map(name => ({ name, email: `ai011-${name}@test.invalid`, isSiteAdmin: name === "site" }))).returning();
  const [org, other] = await db.insert(organization).values([{ name: "Assembled", slug: "ai011-a" }, { name: "Other", slug: "ai011-b" }]).returning();
  const [role] = await db.insert(customRole).values({ organizationId: org.id, name: "Usage only", permissions: ["view:ai-usage"] }).returning();
  await db.insert(member).values([{ organizationId: org.id, userId: owner.id, role: "owner" }, { organizationId: org.id, userId: worker.id, role: "member" }, { organizationId: org.id, userId: auditor.id, role: "member", customRoleId: role.id }, { organizationId: other.id, userId: foreign.id, role: "owner" }]);
  const login = (id: string) => { session = { user: { id }, iat: Math.floor(Date.now() / 1000), expires: new Date(Date.now() + 600000).toISOString() }; };
  const [provider] = await db.insert(aiProvider).values({ name: "Synthetic", adapter: "responses", endpoint: "https://fixture.invalid/responses", enabled: false, models: [{ id: "fixture", contextTokens: 1000, outputTokens: 100, functionCalls: true, strictSchemas: true, usage: true, streaming: false, evidenceDate: "2026-11-04" }], defaultModel: "fixture", delegatedOrganizations: [org.id] }).returning();
  const [config] = await db.insert(aiProviderConfig).values({ organizationId: org.id, providerId: provider.id, model: "fixture", enabled: true, timeoutMs: 1000, credential: "PRIVATE-CREDENTIAL", keyVersion: "PRIVATE-KEY" }).returning();
  const providerBefore = await db.select().from(aiProvider);
  const routes: Record<string, Record<string, (r: Request) => Promise<Response>>> = {
    "/api/v1/ai/prices": { GET: prices.GET, POST: prices.POST }, "/api/v1/ai/budgets": { GET: budgets.GET, PUT: budgets.PUT },
    "/api/v1/ai/provider-catalog": { GET: catalog.GET }, "/api/v1/members": { GET: members.GET },
    "/api/v1/ai/usage/report": { GET: report.GET }, "/api/v1/ai/usage/export": { GET: exporting.GET },
    "/api/v1/ai/operations/quota": { GET: quota.GET }, "/api/v1/ai/operations/runs": { GET: runs.GET }, "/api/v1/ai/operations/run": { GET: detail.GET },
    "/api/v1/ai/operations/stop": { POST: stop.POST }, "/api/v1/ai/operations/disable": { POST: disable.POST }, "/api/v1/ai/provider-configs": { GET: configs.GET },
    "/api/v1/admin/ai/usage": { GET: siteReport.GET }, "/api/v1/admin/ai/usage/export": { GET: siteExport.GET },
  };
  const originalFetch = globalThis.fetch;
  const calls: { path: string; org: string | null }[] = [];
  globalThis.fetch = async (url, init) => {
    const req = new Request(`http://fixture.invalid${String(url)}`, init), path = new URL(req.url).pathname;
    calls.push({ path, org: req.headers.get("x-organization-id") });
    assert.ok(routes[path]?.[req.method], `Unexpected network request ${req.method} ${path}`);
    return routes[path][req.method](req);
  };
  const ready = async (controller: DashboardController | UsageSettingsController) => {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => { unsubscribe(); reject(new Error("Controller did not finish loading")); }, 10000);
      const check = () => { if (!Object.values(controller.state).some(value => value && typeof value === "object" && "loading" in value && value.loading)) { clearTimeout(timer); unsubscribe(); resolve(); } };
      const unsubscribe = controller.subscribe(check); check();
    });
  };
  const clients: Client[] = [], servers: McpServer[] = [];
  const connect = async (server: McpServer) => {
    servers.push(server); const client = new Client({ name: "Assembled acceptance", version: "1" }); clients.push(client);
    const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct); return client;
  };
  const tool = async (client: Client, name: string, args: Record<string, unknown> = {}, error = false) => {
    const result = await client.callTool({ name, arguments: args }); assert.equal(!!result.isError, error, JSON.stringify(result));
    return JSON.parse((result.content as { text: string }[])[0].text);
  };
  let selected = org.id;
  const settings = new UsageSettingsController(() => selected), dashboard = new DashboardController(false, () => selected), site = new DashboardController(true, () => "");
  try {
    login(owner.id);
    const ctx = await getAuthContext(new Request("http://fixture.invalid", { headers: { "x-organization-id": org.id } }));
    const server = new McpServer({ name: "Organization acceptance", version: "1" }); registerAiUsageTools(server, ctx); registerAiOperationTools(server, ctx);
    const client = await connect(server);
    settings.start(); dashboard.start(); await Promise.all([ready(settings), ready(dashboard)]);
    assert.equal(dashboard.state.report.data!.totalGroups, "0"); assert.equal(dashboard.state.runs.data!.totalRuns, "0");
    assert.deepEqual(dashboard.state.quota.data!.constraints.map(c => c.status), ["BUDGET_MISSING", "BUDGET_MISSING"]);
    const priceInput = { providerId: provider.id, model: "fixture", currency: "USD", inputPerMillion: usageNumber("۹۹۹۹۹۹۹۹۹۹۹۹٫۹۹۹۹۹۹"), outputPerMillion: "1", cachedPerMillion: "0", reasoningPerMillion: "0", evidenceDate: "2026-11-04", source: "synthetic-not-live-pricing" };
    const oldPrice = await settings.createPrice(priceInput); assert.equal(oldPrice.inputRate, "999999999999999999");
    assert.deepEqual((await tool(client, "list_ai_prices")).map((row: unknown) => priceDto.parse(row)), settings.state.prices.data!.prices);
    const base = { currency: "USD", monthlyTokens: "9007199254741000", monthlyCost: "100", runTokens: "1000", runCost: "10", requestsPerMinute: 100, concurrency: 10 };
    const orgBudget = await settings.saveBudget({ ...base, userId: null });
    await dashboard.load(); assert.deepEqual(dashboard.state.quota.data!.constraints.map(c => c.status), ["WITHIN_LIMITS", "BUDGET_MISSING"]);
    const userBudget = await settings.saveBudget({ ...base, userId: worker.id });
    assert.equal((await tool(client, "list_ai_budgets")).length, 2);
    const [conversation] = await db.insert(aiConversation).values({ organizationId: org.id, ownerId: worker.id, contentExpiresAt: new Date(Date.now() + 86400000), metadataExpiresAt: new Date(Date.now() + 864000000) }).returning();
    const [queued] = await db.insert(aiRun).values({ organizationId: org.id, ownerId: worker.id, conversationId: conversation.id, requestKey: "PRIVATE-REQUEST", state: "queued", identity: { kind: "session", userId: worker.id, organizationId: org.id, issuedAt: Date.now(), expiresAt: Date.now() + 600000 }, config: { providerConfigId: config.id, configVersion: 1, credentialRef: config.credentialRef, policyVersion: 1 } }).returning();
    await db.insert(aiStep).values({ organizationId: org.id, ownerId: worker.id, runId: queued.id, toolName: "PRIVATE-TOOL", state: "succeeded", requiredPermissions: [], recordIds: [] });
    // Historical usage is deliberately independent of new form edits. No model
    // or browser input is allowed to create a trusted settlement callback.
    await db.insert(aiUsageAttempt).values({ organizationId: org.id, ownerId: worker.id, providerId: provider.id, model: "fixture", priceId: oldPrice.id, currency: "USD", attemptKey: "historical", state: "unknown", reservedTokens: "9007199254740993", reservedCost: "1000000000001", chargedTokens: "9007199254740993", chargedCost: "1000000000001", inputTokens: "9007199254740993", outputTokens: null, priceSnapshot: "PRIVATE-SNAPSHOT", budgetVersions: "PRIVATE-BUDGETS" });
    const usageBefore = await db.select().from(aiUsageAttempt);
    dashboard.select("organization"); await ready(dashboard);
    const filters = { ...defaultFilters(), userId: worker.id, providerId: provider.id, model: "fixture", currency: "USD", priceId: oldPrice.id, state: "unknown" };
    await dashboard.apply(filters);
    const first = dashboard.state.report.data!;
    assert.equal(first.groups[0].inputTokens, "9007199254740993"); assert.equal(first.groups[0].outputTokens, null);
    assert.equal(first.totalsByCurrency[0].chargedCost, "1.000000000001"); assert.equal(first.totalsByCurrency[0].unknownOutputAttempts, "1");
    assert.equal(dashboard.state.quota.data!.constraints[1].remainingMonthlyTokens, "7");
    assert.deepEqual(await tool(client, "get_ai_usage_page", { ...filterQuery(filters, "organization"), page: 1, pageSize: 25 }), first);
    let exported: Report | undefined; await dashboard.export(value => { exported = value; });
    assert.deepEqual(await tool(client, "export_ai_usage", filterQuery(filters, "organization")), exported);
    const quotaMcp = await tool(client, "get_ai_quota", { scope: "organization", userId: worker.id, currency: "USD" });
    assert.deepEqual(quotaMcp.constraints, dashboard.state.quota.data!.constraints);
    assert.equal(quotaMcp.usageByCurrency[0].chargedTokens, first.totalsByCurrency[0].chargedTokens);
    assert.equal(quotaMcp.usageByCurrency[0].unresolvedCost, first.totalsByCurrency[0].unresolvedCost);
    const newPrice = await settings.createPrice({ ...priceInput, inputPerMillion: "2" }); assert.notEqual(newPrice.id, oldPrice.id);
    await settings.saveBudget({ ...base, userId: worker.id, monthlyTokens: "0", expectedVersion: userBudget.version });
    await dashboard.load(); assert.equal(dashboard.state.quota.data!.constraints[1].status, "LIMITED");
    assert.ok(dashboard.state.quota.data!.constraints[1].reasons!.includes("ZERO_LIMIT"));
    assert.deepEqual(dashboard.state.report.data!.totalsByCurrency, first.totalsByCurrency);
    assert.equal((await tool(client, "configure_ai_budget", { ...base, userId: worker.id, expectedVersion: userBudget.version }, true)).status, 409);
    await tool(client, "configure_ai_budget", { ...base, userId: worker.id, monthlyTokens: "9007199254740994", expectedVersion: userBudget.version + 1 });
    await settings.refresh("budgets"); await dashboard.load();
    assert.equal(settings.state.budgets.data!.budgets.find(b => b.userId === worker.id)!.version, 3);
    assert.equal(dashboard.state.quota.data!.constraints[1].remainingMonthlyTokens, "1");
    assert.equal(settings.state.budgets.data!.budgets.find(b => b.id === orgBudget.id)!.version, 1);
    assert.equal((await db.select().from(aiPrice).where(eq(aiPrice.id, oldPrice.id)))[0].inputRate, oldPrice.inputRate);
    await dashboard.inspect(queued.id); assert.equal(dashboard.state.detail.data!.canStop, true);
    await tool(client, "stop_ai_operation_run", { scope: "organization", runId: queued.id, expectedVersion: 1 });
    await dashboard.stop(queued.id, 1); assert.equal(dashboard.state.notice, "conflict"); assert.equal(dashboard.state.detail.data, undefined);
    await dashboard.inspect(queued.id); assert.equal(dashboard.state.detail.data!.run.state, "cancelled"); assert.equal(dashboard.state.detail.data!.canStop, false);
    assert.equal((await db.select().from(aiStep).where(eq(aiStep.runId, queued.id)))[0].state, "succeeded");
    await dashboard.disable(config.id, 1); assert.equal(dashboard.state.notice, "disabled");
    assert.equal((await tool(client, "disable_ai_operation_config", { configId: config.id, expectedVersion: 1 }, true)).status, 409);
    assert.equal((await db.select().from(aiProviderConfig).where(eq(aiProviderConfig.id, config.id)))[0].credential, "PRIVATE-CREDENTIAL");
    login(worker.id); dashboard.select("own"); await ready(dashboard); assert.equal(dashboard.state.report.data!.totalGroups, "1");
    dashboard.select("organization"); await ready(dashboard); assert.equal(dashboard.state.report.error, "denied");
    login(auditor.id); await dashboard.load(); assert.equal(dashboard.state.report.data!.totalGroups, "1"); await dashboard.inspect(queued.id); assert.equal(dashboard.state.detail.data!.canStop, false);
    const historyRequest = new Request("http://fixture.invalid", { headers: { "x-organization-id": org.id } });
    assert.equal((await history.GET(historyRequest, { params: Promise.resolve({ id: conversation.id }) })).status, 403);
    assert.equal((await transcriptAudit.POST(new Request(historyRequest, { method: "POST", body: JSON.stringify({ reason: "Assembled audit permission check" }) }), { params: Promise.resolve({ id: conversation.id }) })).status, 403);
    await Promise.all([settings.refresh("prices"), settings.refresh("budgets")]); assert.equal(settings.state.prices.error, "denied"); assert.equal(settings.state.budgets.error, "denied");
    // Revocation affects the already registered owner MCP closure as well.
    await db.update(member).set({ customRoleId: role.id }).where(and(eq(member.organizationId, org.id), eq(member.userId, owner.id)));
    assert.equal((await tool(client, "configure_ai_budget", { ...base, userId: null, expectedVersion: 1 }, true)).status, 403);
    selected = other.id; dashboard.sync(); settings.sync(); await Promise.all([ready(dashboard), ready(settings)]);
    assert.equal(dashboard.state.report.data, undefined); assert.equal(settings.state.prices.data, undefined);
    let deniedDownload = false; await dashboard.export(() => { deniedDownload = true; }); assert.equal(deniedDownload, false);
    login(siteUser.id); site.start(); await ready(site); const siteStart = calls.length;
    await site.apply({ ...filters, userId: worker.id, organizationId: org.id });
    assert.equal(site.state.report.data!.totalGroups, "1"); assert.ok(calls.slice(siteStart).every(c => c.org === null && c.path.startsWith("/api/v1/admin/ai/")));
    const siteServer = new McpServer({ name: "Site acceptance", version: "1" }); registerAiSiteUsageTools(siteServer, await getSiteSessionContext()); const siteClient = await connect(siteServer);
    assert.deepEqual(await tool(siteClient, "get_ai_site_usage_page", { ...filterQuery(site.state.filters, "site"), page: 1, pageSize: 25 }), site.state.report.data);
    exported = undefined; await site.export(value => { exported = value; });
    assert.deepEqual(await tool(siteClient, "export_ai_site_usage", filterQuery(site.state.filters, "site")), exported);
    assert.ok(!JSON.stringify(exported).includes("PRIVATE"));
    await db.update(users).set({ isSiteAdmin: false }).where(eq(users.id, siteUser.id));
    await site.load(); assert.equal(site.state.report.error, "denied"); assert.equal(site.state.report.data, undefined);
    assert.equal((await tool(siteClient, "export_ai_site_usage", filterQuery(site.state.filters, "site"), true)).status, 403);
    assert.deepEqual(await db.select().from(aiUsageAttempt), usageBefore); assert.deepEqual(await db.select().from(aiProvider), providerBefore);
  } finally {
    settings.dispose(); dashboard.dispose(); site.dispose(); globalThis.fetch = originalFetch;
    await Promise.all(clients.map(client => client.close())); await Promise.all(servers.map(server => server.close()));
  }
  console.log("AI-011 assembled REST/MCP/SQL acceptance verified");
}
main().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
