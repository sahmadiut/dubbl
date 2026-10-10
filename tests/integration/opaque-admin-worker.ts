import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { apiKey, auditLog, customRole, member, organization, subscription, users } from "../../lib/db/schema";
import type { AuthContext } from "../../lib/api/auth-context";
import { registerAllTools } from "../../lib/mcp/tools";
import { GET as auditGET } from "../../app/api/v1/audit-log/route";
import { GET as adminGET, PATCH as adminPATCH } from "../../app/api/v1/admin/organizations/[id]/route";
import { logAudit } from "../../lib/api/audit";

async function connect(ctx: AuthContext) {
  const server = new McpServer({ name: "Opaque admin fixture", version: "1" }); registerAllTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1" });
  const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
  return { async call(name: string, input: object = {}) {
    const r = await client.callTool({ name, arguments: { ...input } });
    const text = (r.content as { text: string }[])[0].text;
    let body; try { body = JSON.parse(text); } catch { body = { error: text }; }
    return { error: !!r.isError, body };
  }, async close() { await client.close(); await server.close(); } };
}

async function run() {
  const [admin, denied] = await db.insert(users).values([
    { email: "opaque-admin@test.invalid", name: "Admin", isSiteAdmin: true },
    { email: "opaque-denied@test.invalid", name: "Denied" },
  ]).returning();
  const [a, b, missingSub, deleted] = await db.insert(organization).values([
    { name: "A", slug: "opaque-a", defaultCurrency: "IRR", billApprovalThreshold: 1250, mileageRate: 67 },
    { name: "FOREIGN_SECRET", slug: "opaque-b" }, { name: "No subscription", slug: "opaque-empty" },
    { name: "Deleted", slug: "opaque-deleted", deletedAt: new Date() },
  ]).returning();
  await db.insert(subscription).values({ organizationId: a.id, plan: "pro", adminNotes: "Saved notes", overrideContacts: 12 });
  const [role] = await db.insert(customRole).values({ organizationId: a.id, name: "No audit", permissions: [] }).returning();
  await db.insert(member).values([{ organizationId: a.id, userId: admin.id, role: "owner" }, { organizationId: b.id, userId: admin.id, role: "owner" },
    { organizationId: a.id, userId: denied.id, role: "owner", customRoleId: role.id }]);
  const keys = { a: "dk_opaque_a", b: "dk_opaque_b", denied: "dk_opaque_denied" };
  for (const [label, key] of Object.entries(keys)) await db.insert(apiKey).values({ organizationId: label === "b" ? b.id : a.id,
    createdBy: label === "denied" ? denied.id : admin.id, name: label, keyPrefix: "dk_opaque", keyHash: createHash("sha256").update(key).digest("hex") });
  const ctx: AuthContext = { organizationId: a.id, userId: admin.id, role: "owner" };
  const ma = await connect(ctx), mb = await connect({ ...ctx, organizationId: b.id }), no = await connect({ ...ctx, userId: denied.id, permissions: [] });
  const payload = { amount: 1250, amountMinor: "9223372036854775807", refund: -1250,
    nested: { amount: "001250", fx: "0.000000000000000001", count: 0.5, max: Number.MAX_SAFE_INTEGER,
      min: -Number.MAX_SAFE_INTEGER, escaped: '"12345678901234567890"' } };
  const [own] = await db.insert(auditLog).values({ organizationId: a.id, userId: admin.id, action: "saved", entityType: "invoice", entityId: randomUUID(), changes: payload }).returning();
  await db.insert(auditLog).values({ organizationId: b.id, userId: admin.id, action: "saved", entityType: "invoice", entityId: randomUUID(), changes: { secret: "FOREIGN_SECRET" } });
  const request = (id: string, input?: unknown, key = keys.a) => new Request(`http://fixture.test/api/v1/admin/organizations/${id}`, {
    method: input === undefined ? "GET" : "PATCH", headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-organization-id": b.id },
    ...(input === undefined ? {} : { body: JSON.stringify(input) }),
  });
  const params = (id: string) => ({ params: Promise.resolve({ id }) });
  const auditRequest = (query = "", key = keys.a) => new Request(`http://fixture.test/api/v1/audit-log${query}`, { headers: { authorization: `Bearer ${key}`, "x-organization-id": b.id } });
  const body = async (r: Response, status = 200) => { const value = await r.json(); assert.equal(r.status, status, JSON.stringify(value)); return value; };
  const good = async (name: string, input: object = {}) => { const r = await ma.call(name, input); assert.equal(r.error, false, JSON.stringify(r)); return r.body; };
  const snapshot = async () => (await db.execute(sql.raw(["organization", "subscription", "audit_log"].map(n =>
    `select '${n}' as name, coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text), '[]'::jsonb)::text as rows from "${n}" t`).join(" union all ")))).rows;
  const unchanged = async (check: () => Promise<void>) => { const before = await snapshot(); await check(); assert.deepEqual(await snapshot(), before); };
  try {
    await unchanged(async () => {
      const result = await body(await auditGET(auditRequest())); assert.deepEqual(result, await good("list_audit_log"));
      assert.equal(result.pagination.total, 1); assert.deepEqual(result.data[0].changes, payload);
      assert.equal((await mb.call("list_audit_log")).body.data[0].changes.secret, "FOREIGN_SECRET");
      assert.deepEqual((await good("list_audit_log", { entityId: own.entityId })).data[0].changes, payload);
      assert.equal((await body(await auditGET(auditRequest(`?entityId=${randomUUID()}`)))).pagination.total, 0);
      assert.equal((await body(await auditGET(auditRequest("?startDate=2100-01-01")))).pagination.total, 0);
      assert.equal((await body(await auditGET(auditRequest("?endDate=2000-01-01T00:00:00Z")))).pagination.total, 0);
      const adminDto = await body(await adminGET(request(a.id), params(a.id))); assert.deepEqual(adminDto, await good("get_admin_organization"));
      assert.equal(adminDto.organization.billApprovalThresholdMinor, "1250"); assert.equal(adminDto.organization.mileageRateMinor, "67");
      assert.equal(adminDto.effectiveLimits.members, null); assert.equal(adminDto.planDefaults.members, null);
      assert.equal(adminDto.subscription.overrideContacts, 12);
      await body(await adminGET(request(b.id), params(b.id)), 404);
      assert.equal((await ma.call("get_admin_organization", { organizationId: b.id })).error, true);
      await body(await adminGET(request(a.id, undefined, keys.denied), params(a.id)), 403);
      assert.equal((await no.call("get_admin_organization")).body.status, 403);
      await body(await auditGET(auditRequest("", keys.denied)), 403); assert.equal((await no.call("list_audit_log")).body.status, 403);
      await body(await auditGET(auditRequest("", "dk_invalid")), 401);
    });
    for (const input of [{}, { seatCount: 0 }, { seatCount: 1.5 }, { seatCount: "2" }, { overrideContacts: true }, { overrideContacts: "1e2" },
      { overrideContacts: " 2" }, { overrideContacts: "01" }, { overrideContacts: 2147483648 }, { overrideContacts: -1 }, { overrideContacts: {} },
      { overrideMultiCurrency: "false" }, { status: "invalid" }, { plan: "business" }, { amount: 1250 }, { overrideMembers: "9223372036854775807" }]) {
      await unchanged(async () => { await body(await adminPATCH(request(a.id, input), params(a.id)), 400); assert.equal((await ma.call("update_admin_organization", input)).error, true); });
    }
    await unchanged(async () => {
      await body(await adminPATCH(request(b.id, { seatCount: 2 }), params(b.id)), 404);
      await body(await adminPATCH(request(deleted.id, { seatCount: 2 }), params(deleted.id)), 404);
      await body(await adminPATCH(request(a.id, { seatCount: 2 }, keys.denied), params(a.id)), 403);
      assert.equal((await no.call("update_admin_organization", { seatCount: 2 })).body.status, 403);
      const malformed = new Request(request(a.id).url, { method: "PATCH", headers: { authorization: `Bearer ${keys.a}` }, body: "{" });
      await body(await adminPATCH(malformed, params(a.id)), 400);
      for (const source of ['{"overrideContacts":1.0000000000000000001}', '{"seatCount":9007199254740993}']) {
        const raw = new Request(request(a.id).url, { method: "PATCH", headers: { authorization: `Bearer ${keys.a}` }, body: source });
        assert.equal((await body(await adminPATCH(raw, params(a.id)), 422)).code, "LEGACY_NUMERIC_RANGE");
      }
      for (const query of ["?page=NaN", "?page=1.000000000000001", "?limit=101", "?startDate=invalid", "?startDate=2026-01-02&endDate=2026-01-01", "?organizationId=" + b.id]) await body(await auditGET(auditRequest(query)), 400);
      assert.equal((await ma.call("list_audit_log", { organizationId: b.id })).error, true);
    });
    await body(await adminPATCH(request(a.id, { seatCount: 3, overrideMembers: "21", overrideMultiCurrency: false, overrideStorageMb: 2147483647 }), params(a.id)));
    await good("update_admin_organization", { overrideContacts: "", adminNotes: "", customPlanName: "Manual" });
    let sub = await db.query.subscription.findFirst({ where: eq(subscription.organizationId, a.id) });
    assert.equal(sub!.overrideMembers, 21); assert.equal(sub!.overrideContacts, null); assert.equal(sub!.overrideMultiCurrency, false);
    assert.equal(sub!.adminNotes, null); assert.equal(sub!.overrideStorageMb, 2147483647);
    await Promise.all([adminPATCH(request(a.id, { seatCount: 4 }), params(a.id)).then(r => body(r)), good("update_admin_organization", { adminNotes: "Concurrent notes" })]);
    sub = await db.query.subscription.findFirst({ where: eq(subscription.organizationId, a.id) });
    assert.equal(sub!.seatCount, 4); assert.equal(sub!.adminNotes, "Concurrent notes");
    // Internal session-admin primitive may address a tenant; public API key paths remain scoped.
    const { updateAdminOrganization, readAdminOrganization } = await import("../../lib/api/admin-organization");
    await updateAdminOrganization(admin.id, missingSub.id, { seatCount: 2 });
    assert.equal((await readAdminOrganization(admin.id, missingSub.id)).subscription.seatCount, 2);
    await Promise.all([updateAdminOrganization(admin.id, b.id, { seatCount: 2 }), updateAdminOrganization(admin.id, b.id, { adminNotes: "New row race" })]);
    assert.equal((await db.select().from(subscription).where(eq(subscription.organizationId, b.id))).length, 1);
    for (const source of ['{"amount":9007199254740993}', '{"amount":0.1234567890123456789}', '{"amount":1e-400}', '{"amount":-9007199254740992}']) {
      await db.execute(sql`update ${auditLog} set changes=${source}::jsonb where id=${own.id}`);
      await unchanged(async () => {
        const r = await body(await auditGET(auditRequest()), 422); assert.equal(r.code, "LEGACY_NUMERIC_RANGE");
        const m = await ma.call("list_audit_log"); assert.equal(m.error, true); assert.equal(m.body.status, 422);
        assert.equal((await mb.call("list_audit_log")).error, false);
      });
    }
    await db.update(auditLog).set({ changes: payload }).where(eq(auditLog.id, own.id));
    for (const value of [Number.MAX_SAFE_INTEGER + 1, 9007199254740992n, Infinity, NaN]) {
      await unchanged(async () => { assert.throws(() => logAudit({ ctx, action: "invalid", entityType: "invoice", entityId: own.entityId, changes: { nested: { amount: value } } }), /numeric|JSON|range/i); });
    }
    await logAudit({ ctx, action: "guarded", entityType: "invoice", entityId: own.entityId, changes: { amount: 1250n, amountMinor: "9223372036854775807" } });
    assert.deepEqual((await good("list_audit_log", { action: "guarded" })).data[0].changes, { amount: 1250, amountMinor: "9223372036854775807" });
    await db.insert(auditLog).values({ organizationId: a.id, userId: admin.id, action: "old", entityType: "invoice", entityId: own.entityId, changes: null, createdAt: new Date("2000-01-01T00:00:00Z") });
    assert.equal((await good("list_audit_log", { action: "old" })).data[0].changes, null);
    const stripeBefore = process.env.STRIPE_SECRET_KEY;
    try {
      process.env.STRIPE_SECRET_KEY = "sk_test_fixture_no_network";
      await unchanged(async () => {
        assert.equal((await body(await auditGET(auditRequest("?action=old&startDate=1999-01-01")))).pagination.total, 0);
        assert.equal((await good("list_audit_log", { action: "old", startDate: "1999-01-01" })).pagination.total, 0);
        const limits = await good("get_admin_organization"); assert.equal(limits.effectiveLimits.overrideContacts, undefined);
        assert.equal(limits.effectiveLimits.members, 21);
      });
    } finally { process.env.STRIPE_SECRET_KEY = stripeBefore; }
    await db.execute(sql`update ${organization} set bill_approval_threshold=9007199254740992 where id=${a.id}`);
    await unchanged(async () => { assert.equal((await body(await adminGET(request(a.id), params(a.id)), 422)).code, "LEGACY_NUMERIC_RANGE"); assert.equal((await ma.call("get_admin_organization")).body.status, 422); });
    console.log("Opaque admin contracts verified: REST/full SDK MCP, exact history, scope/roles, preflight, int32 controls, races and immutable history");
  } finally { await ma.close(); await mb.close(); await no.close(); }
}
run().then(() => process.exit(0), error => { console.error(error); process.exit(1); });
