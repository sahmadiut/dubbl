import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, subscription, dashboardLayout } from "../../lib/db/schema";
import { GET as list, POST as create } from "../../app/api/v1/dashboard/layouts/route";
import { GET as get, PATCH as update, DELETE as remove } from "../../app/api/v1/dashboard/layouts/[id]/route";
import { registerAllTools } from "../../lib/mcp/tools";
import { registerDashboardLayoutTools } from "../../lib/mcp/tools/dashboard-layouts";
import type { AuthContext } from "../../lib/api/auth-context";

const names = ["list_dashboard_layouts", "get_dashboard_layout", "create_dashboard_layout", "update_dashboard_layout", "delete_dashboard_layout"];
async function mcp(ctx: AuthContext, all = false) {
  const server = new McpServer({ name: "Layout fixture", version: "1" });
  if (all) registerAllTools(server, ctx); else registerDashboardLayoutTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1" });
  const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
  const tools = (await client.listTools()).tools;
  for (const name of names) {
    const tool = tools.find(item => item.name === name)!; assert.ok(tool); assert.match(tool.description!, /opaque JSON/);
    for (const field of Object.values(tool.inputSchema.properties ?? {})) assert.ok((field as { description?: string }).description);
  }
  return { async call(name: string, args: Record<string, unknown> = {}) {
    const result = await client.callTool({ name, arguments: args });
    const text = (result.content as { text: string }[])[0].text;
    // SDK schema errors are text; wrapped domain errors have structured JSON.
    let body; try { body = JSON.parse(text); } catch { body = { error: text }; }
    return { isError: result.isError === true, body };
  }, async close() { await client.close(); await server.close(); } };
}

async function run() {
  const [a, b] = await db.insert(organization).values([{ name: "Layouts A", slug: "la" }, { name: "Layouts B", slug: "lb" }]).returning();
  const [owner, other] = await db.insert(users).values([{ email: "layout-owner@example.test" }, { email: "layout-other@example.test" }]).returning();
  await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner" }, { organizationId: b.id, userId: owner.id, role: "owner" },
    { organizationId: a.id, userId: other.id, role: "member" }]);
  await db.insert(subscription).values([{ organizationId: a.id, plan: "pro" }, { organizationId: b.id, plan: "pro" }]);
  const keys = { owner: "dk_layout_owner", foreign: "dk_layout_foreign", other: "dk_layout_other" };
  for (const [label, key] of Object.entries(keys)) await db.insert(apiKey).values({ organizationId: label === "foreign" ? b.id : a.id,
    createdBy: label === "other" ? other.id : owner.id, name: label, keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_layout" });
  const ctx: AuthContext = { userId: owner.id, organizationId: a.id, role: "owner" };
  const ma = await mcp(ctx, true), mb = await mcp({ ...ctx, organizationId: b.id }), mo = await mcp({ ...ctx, userId: other.id, role: "member", permissions: [] });
  const params = (id: string) => ({ params: Promise.resolve({ id }) });
  const req = (method = "GET", body?: unknown, key = keys.owner) => new Request("http://fixture.test/api/v1/dashboard/layouts", {
    method, headers: { authorization: `Bearer ${key}`, "x-organization-id": b.id, "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const snapshot = async () => (await db.execute(sql`select row_to_json(t) as row from dashboard_layout t order by id`)).rows;
  const data = { name: "Personal", layout: [{ widgetType: "custom", x: 0.5, y: -1, w: 4, h: 2,
    config: { ...JSON.parse('{"__proto__":{"amountMinor":"1250"},"constructor":1,"prototype":2}'), amount: 1250, amountMinor: "9223372036854775807", rateExact: "0.000000000000000001", currencyCode: "IRR", nested: [null, true, { label: "۱۲۵۰", number: Number.MAX_SAFE_INTEGER }] } }] };
  const parity = async (id: string) => {
    const res = await get(req(), params(id)); assert.equal(res.status, 200);
    const result = await ma.call("get_dashboard_layout", { id }); assert.equal(result.isError, false); assert.deepEqual(result.body, await res.json());
  };
  try {
    assert.deepEqual(await (await list(req())).json(), { layouts: [] });
    assert.deepEqual((await ma.call("list_dashboard_layouts")).body, { layouts: [] });
    const res = await create(req("POST", data)); assert.equal(res.status, 201, await res.clone().text());
    const saved = (await res.json()).layout; assert.deepEqual(saved.layout, data.layout); assert.equal(saved.isDefault, false);
    assert.equal(saved.organizationId, a.id); assert.equal(saved.userId, owner.id); await parity(saved.id);
    const made = await ma.call("create_dashboard_layout", { ...data, name: "MCP", isDefault: true }); assert.equal(made.isError, false);
    const mid = made.body.layout.id; await parity(mid);
    assert.deepEqual(made.body.layout.layout, data.layout);
    assert.equal((await update(req("PATCH", { name: "Renamed", isDefault: true }), params(saved.id))).status, 200);
    await parity(saved.id);
    assert.equal((await ma.call("update_dashboard_layout", { id: mid, layout: [], isDefault: false })).isError, false);
    await parity(mid);
    assert.equal((await (await get(req(), params(saved.id))).json()).layout.isDefault, true);
    assert.equal((await (await get(req(), params(mid))).json()).layout.isDefault, false);
    assert.deepEqual((await ma.call("list_dashboard_layouts")).body, await (await list(req())).json());

    // Same user in another org and another user in the same org cannot read/change/delete.
    for (const [key, client] of [[keys.foreign, mb], [keys.other, mo]] as const) {
      const before = await snapshot();
      assert.deepEqual(await (await list(req("GET", undefined, key))).json(), { layouts: [] });
      assert.deepEqual((await client.call("list_dashboard_layouts")).body, { layouts: [] });
      for (const id of [saved.id, randomUUID()]) {
        for (const [handler, method, body, tool, args] of [
          [get, "GET", undefined, "get_dashboard_layout", { id }],
          [update, "PATCH", { name: "Spoof" }, "update_dashboard_layout", { id, name: "Spoof" }],
          [remove, "DELETE", undefined, "delete_dashboard_layout", { id }],
        ] as const) {
          assert.equal((await handler(req(method, body, key), params(id))).status, 404);
          assert.equal((await client.call(tool, args)).body.status, 404);
        }
      }
      assert.deepEqual(await snapshot(), before);
    }
    // Personal configuration retains member access without granting financial-data permissions.
    const personal = await mo.call("create_dashboard_layout", { name: "Member personal", layout: [] }); assert.equal(personal.isError, false);
    assert.equal(personal.body.layout.userId, other.id);
    assert.equal((await mo.call("delete_dashboard_layout", { id: personal.body.layout.id })).isError, false);
    const before = await snapshot();
    for (const [handler, method, body, id] of [[list, "GET", undefined, saved.id], [get, "GET", undefined, saved.id],
      [create, "POST", data, saved.id], [update, "PATCH", { name: "Bad" }, saved.id], [remove, "DELETE", undefined, saved.id]] as const)
      assert.equal((await handler(req(method, body, "dk_layout_invalid"), params(id))).status, 401);
    for (const bad of [{ name: "", layout: [] }, { ...data, organizationId: b.id }, { ...data, userId: other.id },
      { ...data, layout: [{ widgetType: "bad", x: "1", y: 0, w: 1, h: 1 }] }, { ...data, layout: [{ ...data.layout[0], config: [] }] }]) {
      assert.equal((await create(req("POST", bad))).status, 400);
      assert.equal((await ma.call("create_dashboard_layout", bad)).isError, true);
    }
    for (const bad of [{}, { name: "" }, { organizationId: b.id }, { layout: null }]) {
      assert.equal((await update(req("PATCH", bad), params(saved.id))).status, 400);
      assert.equal((await ma.call("update_dashboard_layout", { id: saved.id, ...bad })).isError, true);
    }
    for (const handler of [get, update, remove]) assert.equal((await handler(req(handler === update ? "PATCH" : handler === remove ? "DELETE" : "GET", handler === update ? { name: "Bad" } : undefined), params("bad-uuid"))).status, 400);
    for (const [handler, method] of [[create, "POST"], [update, "PATCH"]] as const) {
      const malformed = new Request("http://fixture.test/api/v1/dashboard/layouts", { method, headers: { authorization: `Bearer ${keys.owner}` }, body: "{" });
      assert.equal((await handler(malformed, params(saved.id))).status, 400);
    }
    for (const tool of ["get_dashboard_layout", "update_dashboard_layout", "delete_dashboard_layout"])
      assert.equal((await ma.call(tool, { id: "bad-uuid", ...(tool === "update_dashboard_layout" ? { name: "Bad" } : {}) })).isError, true);
    for (const unsafe of [Number.MAX_SAFE_INTEGER + 1, Number.MIN_SAFE_INTEGER - 1]) {
      const bad = { ...data, layout: [{ ...data.layout[0], config: { nested: [{ unsafe }] } }] };
      for (const [handler, method, tool, args] of [[create, "POST", "create_dashboard_layout", bad], [update, "PATCH", "update_dashboard_layout", { id: saved.id, ...bad }]] as const) {
        const response = await handler(req(method, bad), params(saved.id)); assert.equal(response.status, 422);
        assert.equal((await response.json()).code, "LEGACY_NUMERIC_RANGE");
        assert.equal((await ma.call(tool, args)).body.code, "LEGACY_NUMERIC_RANGE");
      }
    }
    let deep: unknown = null; for (let i = 0; i < 34; i++) deep = [deep];
    for (const value of [deep, Array.from({ length: 10000 }, () => null), "x".repeat(262144)]) {
      const bad = { ...data, layout: [{ ...data.layout[0], config: { value } }] };
      assert.equal((await create(req("POST", bad))).status, 400);
      assert.equal((await ma.call("create_dashboard_layout", bad)).isError, true);
      assert.equal((await update(req("PATCH", bad), params(saved.id))).status, 400);
      assert.equal((await ma.call("update_dashboard_layout", { id: saved.id, ...bad })).isError, true);
    }
    assert.deepEqual(await snapshot(), before);
    // A valid patch can combine with stored fields to exceed the total limit: output preflight rolls back.
    const large = await ma.call("create_dashboard_layout", { name: "Large", layout: [{ ...data.layout[0], config: { text: "x".repeat(100000) } }] });
    assert.equal(large.isError, false); const largeId = large.body.layout.id;
    const beforeCombined = await snapshot(); const patch = { name: "y".repeat(200000) };
    assert.equal((await update(req("PATCH", patch), params(largeId))).status, 422);
    assert.equal((await ma.call("update_dashboard_layout", { id: largeId, ...patch })).body.status, 422);
    assert.deepEqual(await snapshot(), beforeCombined);
    assert.equal((await ma.call("delete_dashboard_layout", { id: largeId })).isError, false);
    // Legacy JSONB corruption is blocked on reads and before patch/delete, without rewriting history.
    for (const corrupt of [[{ ...data.layout[0], config: { amount: 9007199254740992 } }], [{ widgetType: "broken" }]]) {
      await db.execute(sql`update dashboard_layout set layout = ${JSON.stringify(corrupt)}::jsonb where id = ${saved.id}`);
      const corruptBefore = await snapshot();
      for (const [handler, method, body, tool, args] of [
        [list, "GET", undefined, "list_dashboard_layouts", {}], [get, "GET", undefined, "get_dashboard_layout", { id: saved.id }],
        [update, "PATCH", { name: "Overwrite" }, "update_dashboard_layout", { id: saved.id, name: "Overwrite" }],
        [remove, "DELETE", undefined, "delete_dashboard_layout", { id: saved.id }],
      ] as const) {
        assert.equal((await handler(req(method, body), params(saved.id))).status, 422);
        assert.equal((await ma.call(tool, args)).body.status, 422);
      }
      assert.deepEqual(await snapshot(), corruptBefore);
      // Foreign clients do not observe an owner's malformed stored config.
      assert.deepEqual((await mb.call("list_dashboard_layouts")).body, { layouts: [] });
    }
    await db.update(dashboardLayout).set({ layout: data.layout }).where(eq(dashboardLayout.id, saved.id));
    await db.execute(sql`update dashboard_layout set updated_at = 'infinity'::timestamp where id = ${saved.id}`);
    const invalidDateBefore = await snapshot();
    assert.equal((await get(req(), params(saved.id))).status, 422);
    assert.equal((await ma.call("get_dashboard_layout", { id: saved.id })).body.status, 422);
    assert.equal((await update(req("PATCH", { name: "Date repair" }), params(saved.id))).status, 422);
    assert.deepEqual(await snapshot(), invalidDateBefore);
    await db.update(dashboardLayout).set({ updatedAt: new Date() }).where(eq(dashboardLayout.id, saved.id));
    assert.equal((await remove(req("DELETE"), params(saved.id))).status, 200);
    assert.deepEqual((await ma.call("delete_dashboard_layout", { id: mid })).body, { success: true });
    assert.deepEqual(await (await list(req())).json(), { layouts: [] });
    assert.equal((await remove(req("DELETE"), params(mid))).status, 404);
    console.log("REST and MCP dashboard layout contracts verified");
  } finally { await Promise.all([ma.close(), mb.close(), mo.close()]); }
}
run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
