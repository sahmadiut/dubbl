// Runs only in procurement-settings.test.ts's disposable migrated database.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, customRole, apiKey, procurementSettings, auditLog } from "../../lib/db/schema";
import { GET, PUT, PATCH } from "../../app/api/v1/procurement-settings/route";
import { registerProcurementSettingsTools } from "../../lib/mcp/tools/procurement-settings";
import { registerAllTools } from "../../lib/mcp/tools";
import { getProcurementSettings, threeWayMatch, DEFAULT_PROCUREMENT_SETTINGS } from "../../lib/api/procurement";
import { updateProcurementSettings } from "../../lib/api/procurement-settings";
import type { AuthContext } from "../../lib/api/auth-context";

async function mcp(ctx: AuthContext, all = false) {
  const server = new McpServer({ name: "Procurement settings fixture", version: "1" });
  if (all) registerAllTools(server, ctx); else registerProcurementSettingsTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1" });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  await server.connect(st); await client.connect(ct);
  const tools = (await client.listTools()).tools;
  assert.equal(tools.filter(tool => ["get_procurement_settings", "update_procurement_settings"].includes(tool.name)).length, 2);
  const schema = tools.find(tool => tool.name === "update_procurement_settings")!.inputSchema;
  assert.ok(JSON.stringify(schema).includes("basis points"));
  assert.ok(!JSON.stringify(schema).includes("Minor"));
  return { async call(name: string, args: Record<string, unknown> = {}) {
    const result = await client.callTool({ name, arguments: args });
    const text = (result.content as { text: string }[])[0].text;
    return { isError: result.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
  }, async close() { await client.close(); await server.close(); } };
}

async function run() {
  const [a, b, c] = await db.insert(organization).values([
    { name: "Settings A", slug: "psa", defaultCurrency: "USD" },
    { name: "Settings B", slug: "psb", defaultCurrency: "IRR" },
    { name: "Settings C", slug: "psc", defaultCurrency: "KWD" },
  ]).returning();
  const [owner, viewer, editor] = await db.insert(users).values([
    { email: "ps-owner@example.test" }, { email: "ps-viewer@example.test" }, { email: "ps-editor@example.test" },
  ]).returning();
  const [readOnly, canManage] = await db.insert(customRole).values([
    { organizationId: a.id, name: "Read only", permissions: [] },
    { organizationId: a.id, name: "Bill manager", permissions: ["manage:bills"] },
  ]).returning();
  await db.insert(member).values([
    ...[a, b, c].map(org => ({ organizationId: org.id, userId: owner.id, role: "owner" as const })),
    { organizationId: a.id, userId: viewer.id, role: "owner", customRoleId: readOnly.id },
    { organizationId: a.id, userId: editor.id, role: "member", customRoleId: canManage.id },
  ]);
  const keys = { a: "dk_ps_a", b: "dk_ps_b", c: "dk_ps_c", viewer: "dk_ps_viewer", editor: "dk_ps_editor", expired: "dk_ps_expired" };
  for (const [label, key] of Object.entries(keys)) await db.insert(apiKey).values({
    organizationId: label === "b" ? b.id : label === "c" ? c.id : a.id,
    createdBy: label === "viewer" ? viewer.id : label === "editor" ? editor.id : owner.id,
    name: label, keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_ps",
    expiresAt: label === "expired" ? new Date("2020-01-01T00:00:00Z") : null,
  });
  const ctx: AuthContext = { organizationId: a.id, userId: owner.id, role: "owner" };
  const ma = await mcp(ctx, true), mb = await mcp({ ...ctx, organizationId: b.id }), mc = await mcp({ ...ctx, organizationId: c.id });
  const ro = await mcp({ ...ctx, userId: viewer.id, permissions: [] });
  const manager = await mcp({ ...ctx, userId: editor.id, role: "member", permissions: ["manage:bills"] });
  const req = (body?: unknown, key = keys.a, method = body === undefined ? "GET" : "PATCH") => new Request("http://fixture.test/api/v1/procurement-settings", {
    method, headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-organization-id": b.id,
      "x-forwarded-for": "192.0.2.1, 192.0.2.2", "user-agent": "Procurement fixture" },
    ...(method !== "GET" && { body: JSON.stringify(body) }),
  });
  const snapshot = async () => Promise.all(["procurement_settings", "audit_log"].map(async table =>
    (await db.execute(sql.raw(`select coalesce(jsonb_agg(to_jsonb(t)::text order by t.id),'[]'::jsonb) as rows from ${table} t`))).rows));
  const unchanged = async (op: () => Promise<unknown>) => { const before = await snapshot(); await op(); assert.deepEqual(await snapshot(), before); };
  const saved = async (org = a.id) => (await db.select().from(procurementSettings).where(eq(procurementSettings.organizationId, org)))[0];
  const restWrite = async (body: unknown, put = false, key = keys.a) => {
    const response = await (put ? PUT : PATCH)(req(body, key, put ? "PUT" : "PATCH"));
    assert.equal(response.status, 200); return (await response.json()).procurementSettings;
  };
  try {
    await unchanged(async () => {
      for (const key of [keys.a, keys.viewer]) {
        const response = await GET(req(undefined, key)); assert.equal(response.status, 200);
        assert.deepEqual((await response.json()).procurementSettings, { organizationId: a.id, ...DEFAULT_PROCUREMENT_SETTINGS });
      }
      assert.deepEqual((await ma.call("get_procurement_settings")).body.procurementSettings, { organizationId: a.id, ...DEFAULT_PROCUREMENT_SETTINGS });
      assert.deepEqual(await getProcurementSettings(a.id), DEFAULT_PROCUREMENT_SETTINGS);
    });
    assert.equal((await restWrite({ priceTolerancePercent: 500 }, true)).priceTolerancePercent, 500);
    let row = await saved(); const id = row.id, createdAt = row.createdAt;
    assert.equal(row.qtyTolerancePercent, 0); assert.equal(row.blockOverBill, false);
    let audit = (await db.select().from(auditLog))[0];
    assert.equal(audit.entityId, id); assert.equal(audit.userId, owner.id); assert.equal(audit.organizationId, a.id);
    assert.equal(audit.ipAddress, "192.0.2.1"); assert.equal(audit.userAgent, "Procurement fixture");
    assert.deepEqual(audit.changes, { priceTolerancePercent: 500 });
    assert.equal((await ma.call("update_procurement_settings", { qtyTolerancePercent: 100000, blockOverBill: true })).isError, false);
    row = await saved(); assert.equal(row.priceTolerancePercent, 500); assert.equal(row.qtyTolerancePercent, 100000);
    assert.equal(row.id, id); assert.deepEqual(row.createdAt, createdAt);
    await restWrite({ requireGrnBeforeBill: true });
    await ma.call("update_procurement_settings", { blockOverBill: false });
    assert.equal((await saved()).requireGrnBeforeBill, true); assert.equal((await saved()).blockOverBill, false);
    const read = (await (await GET(req())).json()).procurementSettings;
    assert.deepEqual((await ma.call("get_procurement_settings")).body.procurementSettings, read);
    assert.equal(typeof read.priceTolerancePercent, "number"); assert.equal(read.createdAt, createdAt.toISOString());
    assert.ok(!("priceTolerancePercentMinor" in read));
    for (const value of [0, 1, 500, 10000, 100000]) {
      await restWrite({ priceTolerancePercent: value });
      assert.equal((await ma.call("update_procurement_settings", { qtyTolerancePercent: value })).body.procurementSettings.qtyTolerancePercent, value);
    }
    // Defaults on MCP insert, and independent currencies do not rescale controls.
    assert.equal((await mb.call("update_procurement_settings", { priceTolerancePercent: 500 })).body.procurementSettings.priceTolerancePercent, 500);
    assert.equal((await saved(b.id)).qtyTolerancePercent, 0);
    // Concurrent initial partial writes across REST and MCP preserve both fields.
    const race = await Promise.all([restWrite({ priceTolerancePercent: 500 }, false, keys.c), mc.call("update_procurement_settings", { qtyTolerancePercent: 750 })]);
    assert.equal(race[1].isError, false);
    assert.equal((await saved(c.id)).priceTolerancePercent, 500); assert.equal((await saved(c.id)).qtyTolerancePercent, 750);
    await Promise.all([restWrite({ priceTolerancePercent: 600 }), ma.call("update_procurement_settings", { qtyTolerancePercent: 700 })]);
    assert.equal((await saved()).priceTolerancePercent, 600); assert.equal((await saved()).qtyTolerancePercent, 700);
    // Body/header cannot override the API key's or MCP context's organization.
    await restWrite({ organizationId: b.id, priceTolerancePercent: 1234 });
    await ma.call("update_procurement_settings", { organizationId: b.id, qtyTolerancePercent: 4321 });
    assert.equal((await saved()).priceTolerancePercent, 1234); assert.equal((await saved(b.id)).priceTolerancePercent, 500);
    assert.equal((await (await GET(req(undefined, keys.b))).json()).procurementSettings.organizationId, b.id);
    for (const key of ["priceTolerancePercent", "qtyTolerancePercent"])
      for (const value of [-1, 0.5, 100001, 9007199254740992, "500", "5%", "۵۰۰", null, true])
        await unchanged(async () => {
          assert.equal((await PATCH(req({ [key]: value }))).status, 400);
          assert.equal((await PUT(req({ [key]: value }, keys.a, "PUT"))).status, 400);
          assert.equal((await ma.call("update_procurement_settings", { [key]: value })).isError, true);
        });
    for (const key of ["requireGrnBeforeBill", "blockOverBill"])
      for (const value of [null, 0, 1, "true", "false"])
        await unchanged(async () => {
          assert.equal((await PATCH(req({ [key]: value }))).status, 400);
          assert.equal((await ma.call("update_procurement_settings", { [key]: value })).isError, true);
        });
    await unchanged(async () => {
      for (const body of [null, [], "500"]) assert.equal((await PATCH(req(body))).status, 400);
      assert.equal((await PATCH(new Request("http://fixture.test", { method: "PATCH", headers: { authorization: `Bearer ${keys.a}` }, body: "{" }))).status, 400);
      for (const key of ["dk_invalid", keys.expired]) {
        assert.equal((await GET(req(undefined, key))).status, 401);
        assert.equal((await PATCH(req({ priceTolerancePercent: 1 }, key))).status, 401);
      }
      assert.equal((await PATCH(req({ priceTolerancePercent: 1 }, keys.viewer))).status, 403);
      assert.equal((await ro.call("update_procurement_settings", { priceTolerancePercent: 1 })).body.status, 403);
      assert.equal((await ro.call("get_procurement_settings")).isError, false);
      await assert.rejects(updateProcurementSettings(ctx, { priceTolerancePercent: Infinity }));
    });
    await restWrite({ priceTolerancePercent: 555 }, false, keys.editor);
    assert.equal((await manager.call("update_procurement_settings", { qtyTolerancePercent: 777 })).isError, false);
    audit = (await db.select().from(auditLog).orderBy(sql`${auditLog.createdAt} desc`))[0];
    assert.equal(audit.userId, editor.id); assert.deepEqual(audit.changes, { qtyTolerancePercent: 777 });
    // Repeat updates retain row identity and controls; each successful request is audited.
    const beforeRepeat = (await db.select().from(auditLog)).length;
    await restWrite({}); await ma.call("update_procurement_settings", {});
    await restWrite({ priceTolerancePercent: 555 }); await restWrite({ priceTolerancePercent: 555 });
    assert.equal((await saved()).id, id); assert.equal((await saved()).qtyTolerancePercent, 777);
    assert.equal((await db.select().from(auditLog)).length, beforeRepeat + 4);
    // Historical invalid controls fail visibly in both transports and match readers.
    await db.update(procurementSettings).set({ qtyTolerancePercent: -1 }).where(eq(procurementSettings.organizationId, a.id));
    await unchanged(async () => {
      const response = await GET(req()); assert.equal(response.status, 422); assert.equal((await response.json()).code, "LEGACY_NUMERIC_RANGE");
      assert.equal((await ma.call("get_procurement_settings")).body.status, 422);
      assert.equal((await PATCH(req({ priceTolerancePercent: 1 }))).status, 422);
      assert.equal((await ma.call("update_procurement_settings", { priceTolerancePercent: 1 })).body.status, 422);
      await assert.rejects(getProcurementSettings(a.id));
      assert.throws(() => threeWayMatch([], { ...DEFAULT_PROCUREMENT_SETTINGS, qtyTolerancePercent: -1 }));
    });
    await restWrite({ qtyTolerancePercent: 500, priceTolerancePercent: 500, blockOverBill: true, requireGrnBeforeBill: false });
    const controls = await getProcurementSettings(a.id);
    const line = { purchaseOrderLineId: "fixture", quantityOrdered: 10000, quantityReceived: 20000,
      quantityBilled: 0, quantityToBill: 10500, unitPriceOrdered: 10000, unitPriceBilled: 10500 };
    assert.equal(threeWayMatch([line], controls).status, "matched");
    assert.equal(threeWayMatch([{ ...line, quantityToBill: 10501 }], controls).status, "blocked");
    assert.equal(threeWayMatch([{ ...line, unitPriceBilled: 10501 }], controls).status, "warning");
    await ma.call("update_procurement_settings", { requireGrnBeforeBill: true, blockOverBill: false });
    assert.equal(threeWayMatch([{ ...line, quantityReceived: 10499 }], await getProcurementSettings(a.id)).status, "blocked");
    // Force audit failure: neither an existing update nor a first insert commits.
    await db.delete(procurementSettings).where(eq(procurementSettings.organizationId, c.id));
    await db.execute(sql`alter table audit_log add constraint ps_fault check (false) not valid`);
    try {
      await unchanged(async () => {
        assert.equal((await PATCH(req({ priceTolerancePercent: 9 }))).status, 500);
        assert.equal((await mc.call("update_procurement_settings", { priceTolerancePercent: 9 })).isError, true);
      });
    } finally { await db.execute(sql`alter table audit_log drop constraint ps_fault`); }
    assert.equal((await db.select().from(procurementSettings)).length, 2);
    console.log("REST and MCP procurement settings verified");
  } finally { await ma.close(); await mb.close(); await mc.close(); await ro.close(); await manager.close(); }
}
try { await run(); } finally { await (db.$client as unknown as { end: () => Promise<void> }).end(); }
