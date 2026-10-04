// Runs only against organization-settings.test.ts's disposable migrated DB.
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, customRole, apiKey, auditLog, journalEntry, subscription, chartAccount, taxRate } from "../../lib/db/schema";
import { GET, POST, PATCH } from "../../app/api/v1/organization/route";
import { GET as mileageGet, PUT as mileagePut } from "../../app/api/v1/organization/mileage-rate/route";
import { registerOrganizationTools } from "../../lib/mcp/tools/organization";
import { registerAllTools } from "../../lib/mcp/tools";
import { updateOrganizationMileageRate } from "../../lib/api/organization-settings";
import type { AuthContext } from "../../lib/api/auth-context";

async function mcp(ctx: AuthContext, all = false) {
  const server = new McpServer({ name: "Organization fixture", version: "1" });
  if (all) registerAllTools(server, ctx); else registerOrganizationTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1" });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  await server.connect(st); await client.connect(ct);
  const tools = (await client.listTools()).tools;
  const names = ["get_organization", "set_organization_currency", "update_organization", "get_organization_mileage_rate", "update_organization_mileage_rate"];
  assert.equal(tools.filter(tool => names.includes(tool.name)).length, 5);
  for (const tool of tools.filter(tool => names.includes(tool.name)))
    for (const field of Object.values(tool.inputSchema.properties ?? {}))
      assert.ok((field as { description?: string }).description, `${tool.name} field lacks description`);
  return { async call(name: string, args: Record<string, unknown> = {}) {
    const result = await client.callTool({ name, arguments: args });
    const text = (result.content as { text: string }[])[0].text;
    return { isError: result.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
  }, async close() { await client.close(); await server.close(); } };
}
async function run() {
  const orgs = await db.insert(organization).values(["USD", "JPY", "KWD", "IRR"].map((defaultCurrency, i) => ({
    name: `Settings ${i}`, slug: `org-settings-${i}`, defaultCurrency, billApprovalThreshold: 1250,
  }))).returning();
  const [a, b] = orgs;
  const [owner, viewer, editor, newOwner] = await db.insert(users).values([
    { email: "org-owner@example.test" }, { email: "org-viewer@example.test" },
    { email: "org-editor@example.test" }, { email: "org-new-owner@example.test" },
  ]).returning();
  const [readOnly, taxManager] = await db.insert(customRole).values([
    { organizationId: a.id, name: "Read only", permissions: ["view:data"] },
    { organizationId: a.id, name: "Tax manager", permissions: ["manage:tax-config"] },
  ]).returning();
  await db.insert(member).values([
    ...orgs.map(org => ({ organizationId: org.id, userId: owner.id, role: "owner" as const })),
    { organizationId: a.id, userId: viewer.id, role: "owner", customRoleId: readOnly.id },
    { organizationId: a.id, userId: editor.id, role: "member", customRoleId: taxManager.id },
  ]);
  const keys = [...orgs.map((_, i) => `dk_org_${i}`), "dk_org_viewer", "dk_org_editor", "dk_org_expired"];
  for (const [i, key] of keys.entries()) await db.insert(apiKey).values({
    organizationId: orgs[i]?.id ?? a.id, createdBy: i === 4 ? viewer.id : i === 5 ? editor.id : owner.id,
    name: `key ${i}`, keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_org",
    expiresAt: i === 6 ? new Date("2020-01-01T00:00:00Z") : null,
  });
  const ctx: AuthContext = { organizationId: a.id, userId: owner.id, role: "owner" };
  const ma = await mcp(ctx, true), mb = await mcp({ ...ctx, organizationId: b.id });
  const ro = await mcp({ ...ctx, userId: viewer.id, permissions: ["view:data"] });
  const manager = await mcp({ ...ctx, userId: editor.id, role: "member", permissions: ["manage:tax-config"] });
  const missing = await mcp({ ...ctx, organizationId: randomUUID() });
  const req = (body?: unknown, key = keys[0], method = body === undefined ? "GET" : "PATCH", header = b.id) => new Request("http://fixture.test/api/v1/organization", {
    method, headers: { authorization: `Bearer ${key}`, "content-type": "application/json", ...(header ? { "x-organization-id": header } : {}),
      "x-forwarded-for": "192.0.2.1, 192.0.2.2", "user-agent": "Organization fixture" },
    ...(method !== "GET" && { body: JSON.stringify(body) }),
  });
  const sessionGlobal = globalThis as typeof globalThis & { __organizationFixtureSession?: { user: { id: string } } | null };
  const sessionReq = (body?: unknown) => new Request("http://fixture.test/api/v1/organization", {
    method: body === undefined ? "GET" : "POST", headers: { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const snapshot = async () => Promise.all(["organization", "member", "subscription", "audit_log", "chart_account", "tax_rate"].map(async table =>
    (await db.execute(sql.raw(`select coalesce(jsonb_agg(to_jsonb(t)::text order by t.id),'[]'::jsonb) as rows from ${table} t`))).rows));
  const unchanged = async (op: () => Promise<unknown>) => { const before = await snapshot(); await op(); assert.deepEqual(await snapshot(), before); };
  const saved = async (id = a.id) => (await db.select().from(organization).where(eq(organization.id, id)))[0];
  const data = async (response: Response, status = 200) => { const body = await response.json(); assert.equal(response.status, status, JSON.stringify(body)); return body; };
  try {
    for (const [i, org] of orgs.entries()) {
      assert.deepEqual(await data(await mileageGet(req(undefined, keys[i]))), { mileageRate: 67, mileageRateMinor: "67", currencyCode: org.defaultCurrency });
      const row = (await data(await GET(req(undefined, keys[i])))).organization;
      assert.equal(row.id, org.id); assert.equal(row.billApprovalThreshold, 1250); assert.equal(row.billApprovalThresholdMinor, "1250");
      const write = await data(await mileagePut(req({ mileageRateMinor: "1250" }, keys[i], "PUT")));
      assert.equal(write.mileageRate, 1250); assert.equal(write.mileageRateMinor, "1250"); assert.equal(write.currencyCode, org.defaultCurrency);
      assert.equal((await saved(org.id)).mileageRate, 1250);
    }
    assert.deepEqual((await ma.call("get_organization")).body, await data(await GET(req())));
    assert.deepEqual((await ma.call("get_organization_mileage_rate")).body, await data(await mileageGet(req())));
    assert.equal((await data(await GET(req(undefined, keys[0], "GET", "")))).organization.id, a.id);
    for (const value of [0, 67, 3000000000, Number.MAX_SAFE_INTEGER]) {
      const body = await data(await mileagePut(req({ mileageRate: value }, keys[0], "PUT")));
      assert.equal(body.mileageRateMinor, String(value));
      const result = await ma.call("update_organization_mileage_rate", { mileageRateMinor: String(value), mileageRate: value });
      assert.equal(result.isError, false); assert.equal(result.body.mileageRate, value);
    }
    let audit = (await db.select().from(auditLog).orderBy(sql`${auditLog.createdAt} desc`))[0];
    assert.equal(audit.organizationId, a.id); assert.equal(audit.userId, owner.id); assert.equal(audit.entityId, a.id);
    await data(await mileagePut(req({ mileageRate: 99 }, keys[0], "PUT")));
    audit = (await db.select().from(auditLog).orderBy(sql`${auditLog.createdAt} desc`))[0];
    assert.equal(audit.ipAddress, "192.0.2.1"); assert.equal(audit.userAgent, "Organization fixture");
    assert.deepEqual(audit.changes, { diff: { mileageRate: { from: Number.MAX_SAFE_INTEGER, to: 99 } } });
    for (const [field, values] of Object.entries({
      mileageRate: [-1, 0.5, 9007199254740992, "67", null, true],
      mileageRateMinor: ["-1", "-0", "01", " 67", "1e3", "0.67", "۶۷", "9223372036854775808", 67, null],
    })) for (const value of values) await unchanged(async () => {
      await data(await mileagePut(req({ [field]: value }, keys[0], "PUT")), 400);
      assert.equal((await ma.call("update_organization_mileage_rate", { [field]: value })).isError, true);
    });
    for (const body of [{}, [], null, { mileageRate: 67, mileageRateMinor: "68" }, { mileageRate: 67, organizationId: b.id }])
      await unchanged(async () => {
        await data(await mileagePut(req(body, keys[0], "PUT")), 400);
        if (body && !Array.isArray(body)) assert.equal((await ma.call("update_organization_mileage_rate", body)).isError, true);
      });
    await unchanged(async () => {
      await data(await mileagePut(req({ mileageRateMinor: "9007199254740992" }, keys[0], "PUT")), 422);
      assert.equal((await ma.call("update_organization_mileage_rate", { mileageRateMinor: "9007199254740992" })).body.status, 422);
      await assert.rejects(updateOrganizationMileageRate(ctx, { mileageRate: Infinity }));
      for (const handler of [PATCH, mileagePut])
        await data(await handler(new Request("http://fixture.test", { method: "PATCH", headers: { authorization: `Bearer ${keys[0]}` }, body: "{" })), 400);
      for (const key of ["dk_invalid", keys[6]]) {
        await data(await GET(req(undefined, key)), 401);
        await data(await mileagePut(req({ mileageRate: 1 }, key, "PUT")), 401);
      }
      await data(await mileagePut(req({ mileageRate: 1 }, keys[4], "PUT")), 403);
      assert.equal((await ro.call("update_organization_mileage_rate", { mileageRate: 1 })).body.status, 403);
      await data(await PATCH(req({ name: "Denied" }, keys[5])), 403);
      assert.equal((await manager.call("set_organization_currency", { currencyCode: "EUR" })).body.status, 403);
      assert.equal((await missing.call("get_organization")).body.status, 404);
      assert.equal((await missing.call("update_organization_mileage_rate", { mileageRate: 1 })).body.status, 404);
    });
    await data(await mileagePut(req({ mileageRate: 42 }, keys[5], "PUT")));
    assert.equal((await manager.call("update_organization_mileage_rate", { mileageRateMinor: "43" })).isError, false);
    assert.equal((await saved()).mileageRate, 43); assert.equal((await saved(b.id)).mileageRate, 1250);
    await data(await PATCH(req({ onboardingCompleted: true }, keys[4])));
    assert.ok((await saved()).onboardingCompletedAt);
    assert.equal((await ro.call("update_organization", { onboardingCompleted: false })).isError, false);
    assert.equal((await saved()).onboardingCompletedAt, null);
    await unchanged(async () => {
      await data(await PATCH(req({ name: "Denied", onboardingCompleted: true }, keys[4])), 403);
      for (const body of [{ fiscalYearStartMonth: 1.5 }, { mileageRateMinor: "67" }, { organizationId: b.id }, { defaultCurrency: "INVALID" }])
        await data(await PATCH(req(body)), 400);
      await data(await PATCH(req({ defaultCurrency: "IRR" })), 403);
      assert.equal((await ma.call("set_organization_currency", { currencyCode: "IRR" })).body.status, 403);
    });
    await data(await PATCH(req({ name: "Renamed", country: "US", countryCode: "US", businessType: "LLC", taxId: "fixture", peppolId: "fixture-id", peppolScheme: "0088" })));
    assert.equal((await saved()).peppolId, "fixture-id"); assert.equal((await saved()).peppolScheme, "0088");
    assert.equal((await ma.call("update_organization", { peppolId: null })).isError, false);
    assert.equal((await saved()).peppolId, null); assert.equal((await saved()).peppolScheme, "0088");
    assert.ok((await db.select().from(chartAccount).where(eq(chartAccount.organizationId, a.id))).length > 0);
    assert.ok((await db.select().from(taxRate).where(eq(taxRate.organizationId, a.id))).length > 0);
    await unchanged(async () => {
      await data(await PATCH(req({ businessType: "INVALID" })), 400);
      assert.equal((await ma.call("update_organization", { country: "GB", countryCode: "GB" })).isError, true);
    });
    const race = await Promise.all([PATCH(req({ addressCity: "Fixture City" })), ma.call("update_organization", { contactPhone: "555" })]);
    assert.equal(race[0].status, 200); assert.equal(race[1].isError, false);
    assert.equal((await saved()).addressCity, "Fixture City"); assert.equal((await saved()).contactPhone, "555"); assert.equal((await saved()).taxId, "fixture");
    const changed = await ma.call("set_organization_currency", { currencyCode: "eur" });
    assert.equal(changed.isError, false); assert.equal(changed.body.organization.defaultCurrency, "EUR");
    assert.equal(changed.body.organization.mileageRateMinor, "43"); assert.equal(changed.body.organization.billApprovalThresholdMinor, "1250");
    await db.insert(journalEntry).values({ organizationId: a.id, entryNumber: 1, date: "2026-10-04", description: "Activity fixture", createdBy: owner.id });
    await unchanged(async () => {
      await data(await PATCH(req({ defaultCurrency: "USD" })), 409);
      assert.equal((await ma.call("set_organization_currency", { currencyCode: "USD" })).body.status, 409);
    });
    assert.equal((await ma.call("set_organization_currency", { currencyCode: "EUR" })).isError, false);
    assert.equal((await ma.call("update_organization", { defaultCurrency: "IRR" })).body.status, 403);
    await db.update(organization).set({ mileageRate: null, billApprovalThreshold: null }).where(eq(organization.id, b.id));
    const nullOrg = (await mb.call("get_organization")).body.organization;
    assert.equal(nullOrg.mileageRateMinor, null); assert.equal(nullOrg.billApprovalThresholdMinor, null);
    assert.equal((await mb.call("get_organization_mileage_rate")).body.mileageRateMinor, "67");
    for (const field of ["mileage_rate", "bill_approval_threshold"]) {
      await db.execute(sql.raw(`update organization set ${field}=9007199254740992 where id='${b.id}'`));
      await unchanged(async () => {
        await data(await GET(req(undefined, keys[1])), 422);
        assert.equal((await mb.call("get_organization")).body.status, 422);
        await data(await PATCH(req({ name: "Must not save" }, keys[1])), 422);
      });
      await db.execute(sql.raw(`update organization set ${field}=null where id='${b.id}'`));
    }
    await db.update(organization).set({ mileageRate: -1 }).where(eq(organization.id, b.id));
    await unchanged(async () => { await data(await mileageGet(req(undefined, keys[1])), 422); assert.equal((await mb.call("get_organization_mileage_rate")).body.status, 422); });
    assert.equal((await mb.call("update_organization_mileage_rate", { mileageRate: 67 })).isError, false);
    await db.update(organization).set({ deletedAt: new Date() }).where(eq(organization.id, b.id));
    await unchanged(async () => { await data(await GET(req(undefined, keys[1])), 404); assert.equal((await mb.call("update_organization", { name: "Deleted" })).body.status, 404); });
    sessionGlobal.__organizationFixtureSession = { user: { id: owner.id } };
    assert.equal((await data(await GET(sessionReq()))).organizations.length, 3);
    sessionGlobal.__organizationFixtureSession = null;
    await db.update(organization).set({ deletedAt: null }).where(eq(organization.id, b.id));
    // Session identity is a fixture boundary. Actual list/create handlers and
    // provisioning/membership/plan/slug/audit logic run on the migrated database.
    sessionGlobal.__organizationFixtureSession = { user: { id: owner.id } };
    const listed = await data(await GET(sessionReq()));
    assert.equal(listed.organizations.length, 4); assert.ok(listed.organizations.every((o: { role: string; memberCount: number; mileageRateMinor: string }) => o.role === "owner" && o.memberCount >= 1 && typeof o.mileageRateMinor === "string"));
    sessionGlobal.__organizationFixtureSession = { user: { id: newOwner.id } };
    const provisioned = (await data(await POST(sessionReq({ name: "New org", slug: "new-org" })), 201)).organization;
    assert.equal(provisioned.mileageRateMinor, "67"); assert.equal(provisioned.billApprovalThresholdMinor, null);
    assert.equal((await db.select().from(member).where(eq(member.organizationId, provisioned.id)))[0].userId, newOwner.id);
    assert.equal((await db.select().from(subscription).where(eq(subscription.organizationId, provisioned.id))).length, 1);
    await unchanged(async () => { await data(await POST(sessionReq({ name: "Unsupported", slug: "unsupported", mileageRateMinor: "67" })), 400); });
    await unchanged(async () => { await data(await POST(sessionReq({ name: "Duplicate", slug: "new-org" })), 409); });
    sessionGlobal.__organizationFixtureSession = null;
    await unchanged(async () => { await data(await GET(sessionReq()), 401); await data(await POST(sessionReq({ name: "No auth", slug: "no-auth" })), 401); });
    // Inject a genuine audit failure: settings and provisioning all roll back.
    await db.execute(sql`alter table audit_log add constraint org_fixture_fault check (false) not valid`);
    try {
      await unchanged(async () => {
        await data(await mileagePut(req({ mileageRate: 9 }, keys[0], "PUT")), 500);
        assert.equal((await ma.call("update_organization", { name: "Rollback" })).isError, true);
        sessionGlobal.__organizationFixtureSession = { user: { id: owner.id } };
        await data(await POST(sessionReq({ name: "Rollback", slug: "rollback" })), 500);
      });
    } finally { sessionGlobal.__organizationFixtureSession = null; await db.execute(sql`alter table audit_log drop constraint org_fixture_fault`); }
    console.log("REST and MCP organization settings verified");
  } finally { delete sessionGlobal.__organizationFixtureSession; await Promise.all([ma.close(), mb.close(), ro.close(), manager.close(), missing.close()]); }
}
try { await run(); } finally { await (db.$client as unknown as { end: () => Promise<void> }).end(); }
