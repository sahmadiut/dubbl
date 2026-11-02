import assert from "node:assert/strict";
import { mock } from "node:test";
import { and, eq } from "drizzle-orm";
import { db } from "../../lib/db";
import { users, organization, member, customRole, aiProvider, aiProviderConfig, aiPrice, aiUsageAttempt, aiConversation, aiRun, aiStep } from "../../lib/db/schema";
import { DashboardController, defaultFilters, type Report } from "../../lib/ai/dashboard-client";

let session: { user: { id: string }; iat: number; expires: string } | null = null;
mock.module(new URL("../../lib/auth.ts", import.meta.url).href, { namedExports: { auth: async () => session } });
async function main() {
  const report = await import("../../app/api/v1/ai/usage/report/route"), exporting = await import("../../app/api/v1/ai/usage/export/route");
  const quota = await import("../../app/api/v1/ai/operations/quota/route"), runs = await import("../../app/api/v1/ai/operations/runs/route"), detail = await import("../../app/api/v1/ai/operations/run/route");
  const stop = await import("../../app/api/v1/ai/operations/stop/route"), disable = await import("../../app/api/v1/ai/operations/disable/route"), configs = await import("../../app/api/v1/ai/provider-configs/route");
  const siteReport = await import("../../app/api/v1/admin/ai/usage/route"), siteExport = await import("../../app/api/v1/admin/ai/usage/export/route");
  const [owner, worker, auditor, siteUser, foreign] = await db.insert(users).values(["owner", "worker", "auditor", "site", "foreign"].map(name => ({ name, email: `ai059-${name}@test.invalid`, isSiteAdmin: name === "site" }))).returning();
  const [org, other] = await db.insert(organization).values([{ name: "Dashboard", slug: "ai059-a" }, { name: "Other", slug: "ai059-b" }]).returning();
  const [role] = await db.insert(customRole).values({ organizationId: org.id, name: "Usage auditor", permissions: ["view:ai-usage"] }).returning();
  await db.insert(member).values([{ organizationId: org.id, userId: owner.id, role: "owner" }, { organizationId: org.id, userId: worker.id, role: "member" }, { organizationId: org.id, userId: auditor.id, role: "member", customRoleId: role.id }, { organizationId: other.id, userId: foreign.id, role: "owner" }]);
  const login = (id: string) => { session = { user: { id }, iat: Math.floor(Date.now() / 1000), expires: new Date(Date.now() + 600000).toISOString() }; };
  const [provider] = await db.insert(aiProvider).values({ name: "Synthetic", adapter: "responses", endpoint: "https://fixture.invalid/responses", enabled: true, models: [], defaultModel: "fixture", delegatedOrganizations: [] }).returning();
  const [config] = await db.insert(aiProviderConfig).values({ organizationId: org.id, providerId: provider.id, model: "fixture", enabled: true, timeoutMs: 1000, credential: "PRIVATE-CREDENTIAL", keyVersion: "PRIVATE-KEY" }).returning();
  const [price, euro, foreignPrice] = await db.insert(aiPrice).values([org.id, org.id, other.id].map((organizationId, index) => ({ organizationId, providerId: provider.id, model: "fixture", currency: index === 1 ? "EUR" : "USD", inputRate: "1", outputRate: "1", cachedRate: "1", reasoningRate: "1", evidenceDate: "2026-11-02", source: "synthetic", createdBy: owner.id }))).returning();
  await db.insert(aiUsageAttempt).values(Array.from({ length: 28 }, (_, i) => ({ organizationId: org.id, ownerId: worker.id, providerId: provider.id, model: `fixture-${String(i).padStart(2, "0")}`, priceId: i === 27 ? euro.id : price.id, currency: i === 27 ? "EUR" : "USD", attemptKey: `attempt-${i}`, state: "unknown" as const, reservedTokens: "9007199254740993", reservedCost: "900719925474099300000000000001", chargedTokens: "9007199254740993", chargedCost: "900719925474099300000000000001", priceSnapshot: "PRIVATE-SNAPSHOT", budgetVersions: "PRIVATE-BUDGET", inputTokens: null, outputTokens: null })));
  await db.insert(aiUsageAttempt).values({ organizationId: other.id, ownerId: foreign.id, providerId: provider.id, model: "foreign", priceId: foreignPrice.id, currency: "USD", attemptKey: "foreign", state: "unknown", reservedTokens: "1", reservedCost: "1", chargedTokens: "1", chargedCost: "1", priceSnapshot: "PRIVATE-FOREIGN", budgetVersions: "[]" });
  const [conversation] = await db.insert(aiConversation).values({ organizationId: org.id, ownerId: worker.id, contentExpiresAt: new Date(Date.now() + 86400000), metadataExpiresAt: new Date(Date.now() + 864000000) }).returning();
  const [queued] = await db.insert(aiRun).values({ organizationId: org.id, ownerId: worker.id, conversationId: conversation.id, requestKey: "private", state: "queued", identity: { kind: "session", userId: worker.id, organizationId: org.id, issuedAt: Date.now(), expiresAt: Date.now() + 600000 }, config: { providerConfigId: config.id, configVersion: 1, credentialRef: config.credentialRef, policyVersion: 1 } }).returning();
  await db.insert(aiStep).values({ organizationId: org.id, ownerId: worker.id, runId: queued.id, toolName: "PRIVATE-TOOL", state: "succeeded", requiredPermissions: [], recordIds: [] });
  const usageBefore = await db.select().from(aiUsageAttempt), providerBefore = await db.select().from(aiProvider);
  const routes: Record<string, (r: Request) => Promise<Response>> = {
    "/api/v1/ai/usage/report": report.GET, "/api/v1/ai/usage/export": exporting.GET,
    "/api/v1/ai/operations/quota": quota.GET, "/api/v1/ai/operations/runs": runs.GET, "/api/v1/ai/operations/run": detail.GET,
    "/api/v1/ai/operations/stop": stop.POST, "/api/v1/ai/operations/disable": disable.POST, "/api/v1/ai/provider-configs": configs.GET,
    "/api/v1/admin/ai/usage": siteReport.GET, "/api/v1/admin/ai/usage/export": siteExport.GET,
  };
  const originalFetch = globalThis.fetch; let orgId = org.id;
  const calls: { path: string; org: string | null }[] = [];
  globalThis.fetch = async (url, init) => {
    const req = new Request(`http://fixture.invalid${String(url)}`, init), path = new URL(req.url).pathname;
    calls.push({ path, org: req.headers.get("x-organization-id") }); assert.ok(routes[path], path); return routes[path](req);
  };
  const ready = (c: DashboardController) => new Promise<void>(resolve => {
    const check = () => { if (![c.state.report, c.state.runs, c.state.quota, c.state.configs].some(v => v.loading)) { unsub(); resolve(); } }; const unsub = c.subscribe(check); check();
  });
  const controller = new DashboardController(false, () => orgId);
  try {
    login(worker.id); controller.start(); await ready(controller);
    assert.equal(controller.state.report.data!.totalGroups, "28"); assert.equal(controller.state.report.data!.groups.length, 25); assert.equal(controller.state.report.data!.hasNextPage, true);
    const totals = controller.state.report.data!.totalsByCurrency; assert.equal(totals.length, 2); assert.equal(totals.find(v => v.currency === "EUR")!.chargedCost, "900719925474099300.000000000001"); assert.equal(totals.find(v => v.currency === "USD")!.chargedCost, "24319437987800681100.000000000027");
    assert.equal(controller.state.quota.data!.constraints[0].status, "BUDGET_MISSING"); assert.equal(controller.state.configs.error, "denied");
    await controller.page(2); assert.equal(controller.state.report.data!.groups.length, 3); assert.deepEqual(controller.state.report.data!.totalsByCurrency, totals);
    let downloaded: Report | undefined; await controller.export(v => { downloaded = v; }); assert.equal(downloaded!.groups.length, 28); assert.equal(downloaded!.complete, true); assert.deepEqual(downloaded!.totalsByCurrency, totals); assert.ok(!JSON.stringify(downloaded).includes("PRIVATE"));
    await controller.inspect(queued.id); assert.equal(controller.state.detail.data!.canStop, true);
    controller.select("organization"); await ready(controller); assert.equal(controller.state.report.error, "denied"); assert.equal(controller.state.report.data, undefined);
    login(auditor.id); await controller.load(); assert.equal(controller.state.report.data!.totalGroups, "28"); await controller.inspect(queued.id); assert.equal(controller.state.detail.data!.canStop, false);
    const before = calls.length; await controller.stop(queued.id, 1); assert.equal(calls.length, before);
    controller.select("own"); await ready(controller); assert.equal(controller.state.report.error, "denied");
    login(owner.id); controller.select("organization"); await ready(controller); assert.equal(controller.state.configs.data!.length, 1);
    await controller.inspect(queued.id); assert.equal(controller.state.detail.data!.canStop, true);
    // A concurrent reviewed-version change must never be overwritten or retried.
    await db.update(aiRun).set({ version: 2 }).where(eq(aiRun.id, queued.id)); await controller.stop(queued.id, 1); assert.equal(controller.state.notice, "conflict"); assert.equal(controller.state.detail.data, undefined);
    await controller.inspect(queued.id); await controller.stop(queued.id, 2); assert.equal(controller.state.notice, "stopped");
    const [stopped] = await db.select().from(aiRun).where(eq(aiRun.id, queued.id)); assert.equal(stopped.state, "cancelled"); assert.equal((await db.select().from(aiStep).where(eq(aiStep.runId, queued.id)))[0].state, "succeeded");
    await controller.disable(config.id, 1); assert.equal(controller.state.notice, "disabled"); const [disabled] = await db.select().from(aiProviderConfig).where(eq(aiProviderConfig.id, config.id)); assert.equal(disabled.enabled, false); assert.equal(disabled.credential, "PRIVATE-CREDENTIAL");
    await controller.apply({ ...defaultFilters(), currency: "EUR" }); assert.equal(controller.state.report.data!.totalGroups, "1"); downloaded = undefined; await controller.export(v => { downloaded = v; }); assert.equal(downloaded!.groups.length, 1); assert.equal(downloaded!.groups[0].currency, "EUR");
    await db.update(member).set({ customRoleId: role.id }).where(and(eq(member.organizationId, org.id), eq(member.userId, owner.id))); await controller.load(); assert.equal(controller.state.configs.error, "denied"); await controller.inspect(queued.id); assert.equal(controller.state.detail.data!.canStop, false);
    orgId = other.id; controller.sync(); await ready(controller); assert.equal(controller.state.report.data, undefined); assert.equal(controller.state.report.error, "denied");
    login(siteUser.id); const site = new DashboardController(true, () => ""); const start = calls.length; site.start(); await ready(site);
    assert.equal(site.state.report.data!.totalGroups, "29"); assert.ok(calls.slice(start).every(c => c.org === null && c.path.startsWith("/api/v1/admin/ai/")));
    await site.apply({ ...defaultFilters(), organizationId: other.id }); assert.equal(site.state.report.data!.totalGroups, "1"); downloaded = undefined; await site.export(v => { downloaded = v; }); assert.equal(downloaded!.groups[0].organizationId, other.id);
    await db.update(users).set({ isSiteAdmin: false }).where(eq(users.id, siteUser.id)); await site.load(); assert.equal(site.state.report.error, "denied"); assert.equal(site.state.report.data, undefined); site.dispose();
    assert.deepEqual(await db.select().from(aiUsageAttempt), usageBefore); assert.deepEqual(await db.select().from(aiProvider), providerBefore);
  } finally { controller.dispose(); globalThis.fetch = originalFetch; }
  console.log("AI dashboard controller REST/SQL verified");
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
