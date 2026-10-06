import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, customRole, priceList, priceListItem, inventoryItem } from "../../lib/db/schema";
import type { AuthContext } from "../../lib/api/auth-context";
import { GET as list, POST as create } from "../../app/api/v1/price-lists/route";
import { GET as get, PATCH as patch, DELETE as remove } from "../../app/api/v1/price-lists/[id]/route";
import { GET as items, POST as add } from "../../app/api/v1/price-lists/[id]/items/route";
import { PATCH as edit, DELETE as drop } from "../../app/api/v1/price-lists/[id]/items/[itemId]/route";
import { GET as resolve } from "../../app/api/v1/price-lists/[id]/resolve/route";
import { registerAllTools } from "../../lib/mcp/tools";

async function connect(ctx: AuthContext) {
  const server = new McpServer({ name: "Pricing fixture", version: "1" }); registerAllTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1" }), [ct, st] = InMemoryTransport.createLinkedPair();
  await server.connect(st); await client.connect(ct);
  const tools = (await client.listTools()).tools;
  assert.equal(new Set(tools.map(t => t.name)).size, tools.length);
  for (const name of ["list_price_lists", "get_price_list", "create_price_list", "update_price_list", "delete_price_list", "list_price_list_items", "add_price_list_item", "update_price_list_item", "delete_price_list_item", "resolve_price"]) {
    const t = tools.find(t => t.name === name); assert.ok(t); assert.equal(t.inputSchema.additionalProperties, false);
    for (const f of Object.values(t.inputSchema.properties ?? {})) assert.ok((f as { description?: string }).description);
  }
  return { async call(name: string, args: Record<string, unknown>) {
    const r = await client.callTool({ name, arguments: args }), text = (r.content as { text: string }[])[0].text;
    return { isError: r.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
  }, async close() { await client.close(); await server.close(); } };
}
async function run() {
  const [a, b] = await db.insert(organization).values([{ name: "Pricing A", slug: "pricing-a" }, { name: "Pricing B", slug: "pricing-b" }]).returning();
  const [owner, viewer] = await db.insert(users).values([{ email: "pricing-owner@example.test" }, { email: "pricing-viewer@example.test" }]).returning();
  const [none] = await db.insert(customRole).values({ organizationId: a.id, name: "None", permissions: [] }).returning();
  await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner" }, { organizationId: b.id, userId: owner.id, role: "owner" },
    { organizationId: a.id, userId: viewer.id, role: "member", customRoleId: none.id }]);
  const keys = { a: "dk_pricing_a", b: "dk_pricing_b", viewer: "dk_pricing_viewer", expired: "dk_pricing_expired" };
  for (const [name, key] of Object.entries(keys)) await db.insert(apiKey).values({ organizationId: name === "b" ? b.id : a.id,
    createdBy: name === "viewer" ? viewer.id : owner.id, name, keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_pricing",
    expiresAt: name === "expired" ? new Date("2020-01-01") : null });
  const [item, foreign, inactive, deleted] = await db.insert(inventoryItem).values([
    { organizationId: a.id, code: "ITEM", name: "Item" }, { organizationId: b.id, code: "FOREIGN", name: "Foreign" },
    { organizationId: a.id, code: "INACTIVE", name: "Inactive", isActive: false }, { organizationId: a.id, code: "DELETED", name: "Deleted", deletedAt: new Date() },
  ]).returning();
  const ctx: AuthContext = { organizationId: a.id, userId: owner.id, role: "owner" };
  const ma = await connect(ctx), mb = await connect({ ...ctx, organizationId: b.id });
  const ro = await connect({ ...ctx, userId: viewer.id, role: "member", permissions: [] });
  const managed = await connect({ ...ctx, role: "member", permissions: ["manage:inventory"] });
  const req = (body: unknown = {}, key: string = keys.a, query = "") => new Request("http://fixture.test/pricing" + query,
    { method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-organization-id": b.id }, body: JSON.stringify(body) });
  const p = (id: string, itemId?: string) => ({ params: Promise.resolve({ id, itemId: itemId! }) });
  const data = async (r: Response, status = 200) => { const body = await r.json(); assert.equal(r.status, status, JSON.stringify(body)); return body; };
  async function snapshot() {
    const r = await db.execute(sql.raw("select jsonb_build_object('lists',(select jsonb_agg(to_jsonb(t) order by id) from price_list t),'items',(select jsonb_agg(to_jsonb(t) order by id) from price_list_item t),'inventory',(select jsonb_agg(to_jsonb(t) order by id) from inventory_item t),'audit',(select jsonb_agg(to_jsonb(t) order by id) from audit_log t)) as state"));
    return JSON.stringify(r.rows[0].state);
  }
  async function denied(fn: () => Promise<Response>, status: number) { const before = await snapshot(); await data(await fn(), status); assert.equal(await snapshot(), before); }
  async function mdenied(name: string, args: Record<string, unknown>, client = ma, status?: number) {
    const before = await snapshot(), r = await client.call(name, args); assert.equal(r.isError, true, JSON.stringify(r));
    if (status) assert.equal(r.body.status, status); assert.equal(await snapshot(), before);
  }
  const lookup = (id: string, qty = 1, date = "2024-01-01", itemId = item.id) => resolve(req({}, keys.a, `?inventoryItemId=${itemId}&quantity=${qty}&asOf=${date}`), p(id));
  try {
    const l = (await data(await create(req({ name: "Retail", effectiveFrom: "2024-01-01", effectiveTo: "2024-12-31" })), 201)).priceList;
    assert.equal(l.organizationId, a.id); assert.equal(l.currencyCode, "USD");
    const m = await managed.call("create_price_list", { name: "Wholesale", currencyCode: " eur " }); assert.equal(m.isError, false); assert.equal(m.body.priceList.currencyCode, "EUR");
    const ml = m.body.priceList.id;
    const tier1 = (await data(await add(req({ inventoryItemId: item.id, unitPrice: 1250 }), p(l.id)), 201)).priceListItem;
    assert.equal(tier1.unitPriceMinor, "1250"); assert.equal(tier1.minQuantity, 1);
    const tier10 = (await ma.call("add_price_list_item", { priceListId: l.id, inventoryItemId: item.id, unitPriceMinor: "1000", minQuantity: 10 })).body.priceListItem;
    assert.equal(tier10.unitPrice, 1000);
    const maximal = (await ma.call("add_price_list_item", { priceListId: ml, inventoryItemId: item.id, unitPriceMinor: "9007199254740991", minQuantity: 2147483647 })).body.priceListItem;
    assert.equal(maximal.unitPrice, Number.MAX_SAFE_INTEGER);
    assert.equal((await data(await lookup(ml, 2147483647))).resolved.unitPriceMinor, "9007199254740991");
    assert.deepEqual((await data(await list(req()))).data, (await ma.call("list_price_lists", {})).body.priceLists);
    assert.deepEqual((await data(await items(req(), p(l.id)))).data, (await ma.call("list_price_list_items", { priceListId: l.id })).body.priceListItems);
    const detail = (await data(await get(req(), p(l.id)))).priceList, md = (await ma.call("get_price_list", { priceListId: l.id })).body.priceList;
    assert.equal(detail.items[0].inventoryItem.organizationId, a.id); assert.equal(md.items[0].itemCode, item.code); assert.equal(md.items[0].unitPriceMinor, "1250");
    for (const [qty, expected] of [[1, "1250"], [9, "1250"], [10, "1000"], [11, "1000"]]) {
      const rest = await data(await lookup(l.id, Number(qty))); assert.equal(rest.resolved.unitPriceMinor, expected);
      assert.deepEqual((await ma.call("resolve_price", { priceListId: l.id, inventoryItemId: item.id, quantity: qty, asOf: "2024-01-01" })).body, rest);
    }
    assert.equal((await data(await lookup(l.id, 10, "2024-12-31"))).resolved.unitPriceMinor, "1000");
    for (const date of ["2023-12-31", "2025-01-01"]) assert.equal((await data(await lookup(l.id, 10, date))).resolved, null);
    assert.equal((await data(await lookup(ml))).resolved, null);
    assert.equal((await mb.call("resolve_price", { priceListId: l.id, inventoryItemId: item.id })).body.resolved, null);
    assert.equal((await data(await lookup(l.id, 1, "2024-01-01", foreign.id))).resolved, null);
    const changed = (await data(await edit(req({ unitPrice: 0, unitPriceMinor: "0" }), p(l.id, tier1.id)))).priceListItem; assert.equal(changed.unitPriceMinor, "0");
    assert.equal((await ma.call("update_price_list_item", { priceListId: l.id, priceListItemId: tier1.id, unitPriceMinor: "1250" })).body.priceListItem.unitPrice, 1250);
    await data(await patch(req({ currencyCode: "JPY" }), p(l.id))); assert.equal((await data(await lookup(l.id))).resolved.unitPriceMinor, "1250");
    assert.equal((await data(await lookup(l.id))).resolved.currencyCode, "JPY");
    await ma.call("update_price_list", { priceListId: l.id, currencyCode: "USD", isActive: false }); assert.equal((await data(await lookup(l.id))).resolved, null);
    await data(await patch(req({ isActive: true }), p(l.id)));
    // Readers retain authenticated read access; custom roles gate every mutation.
    assert.equal((await data(await get(req({}, keys.viewer), p(l.id)))).priceList.id, l.id);
    assert.equal((await ro.call("get_price_list", { priceListId: l.id })).isError, false);
    for (const key of [keys.expired, "dk_bad"]) await denied(() => create(req({ name: "No" }, key)), 401);
    await denied(() => get(req({}, keys.b), p(l.id)), 404); await mdenied("get_price_list", { priceListId: l.id }, mb, 404);
    for (const fn of [() => create(req({ name: "No" }, keys.viewer)), () => patch(req({ name: "No" }, keys.viewer), p(l.id)), () => remove(req({}, keys.viewer), p(l.id)),
      () => add(req({ inventoryItemId: item.id, unitPrice: 1 }, keys.viewer), p(l.id)), () => edit(req({ unitPrice: 1 }, keys.viewer), p(l.id, tier1.id)), () => drop(req({}, keys.viewer), p(l.id, tier1.id))]) await denied(fn, 403);
    for (const [name, args] of [["create_price_list", { name: "No" }], ["update_price_list", { priceListId: l.id, name: "No" }], ["delete_price_list", { priceListId: l.id }],
      ["add_price_list_item", { priceListId: l.id, inventoryItemId: item.id, unitPrice: 1 }], ["update_price_list_item", { priceListId: l.id, priceListItemId: tier1.id, unitPrice: 1 }], ["delete_price_list_item", { priceListId: l.id, priceListItemId: tier1.id }]] as const) await mdenied(name, args, ro, 403);
    for (const other of [foreign, inactive, deleted]) {
      await denied(() => add(req({ inventoryItemId: other.id, unitPrice: 1 }), p(l.id)), 404);
      await mdenied("add_price_list_item", { priceListId: l.id, inventoryItemId: other.id, unitPrice: 1 }, ma, 404);
    }
    await denied(() => edit(req({ unitPrice: 1 }), p(l.id, maximal.id)), 404); await denied(() => drop(req(), p(l.id, maximal.id)), 404);
    await mdenied("update_price_list_item", { priceListId: l.id, priceListItemId: maximal.id, unitPrice: 1 }, ma, 404);
    for (const bad of [{ unitPrice: 1.1 }, { unitPrice: "1" }, { unitPrice: -1 }, { unitPriceMinor: "01" }, { unitPrice: 1, unitPriceMinor: "2" }, { unitPriceMinor: "9223372036854775808" }, { unitPrice: 1, minQuantity: 2147483648 }, { unitPrice: 1, unknown: true }, {}]) {
      await denied(() => add(req({ inventoryItemId: item.id, ...bad }), p(l.id)), 400);
      await mdenied("add_price_list_item", { priceListId: l.id, inventoryItemId: item.id, ...bad });
    }
    await denied(() => edit(req({ unitPriceMinor: "9007199254740992" }), p(l.id, tier1.id)), 422);
    await mdenied("update_price_list_item", { priceListId: l.id, priceListItemId: tier1.id, unitPriceMinor: "9007199254740992" }, ma, 422);
    for (const bad of [{ effectiveFrom: "2024-02-30" }, { effectiveFrom: "2025-01-01" }, { currencyCode: "XYZ" }, { isActive: "true" }, { name: "" }, { unknown: true }]) {
      await denied(() => patch(req(bad), p(l.id)), 400); await mdenied("update_price_list", { priceListId: l.id, ...bad });
    }
    await denied(() => add(new Request("http://fixture.test", { method: "POST", headers: { authorization: `Bearer ${keys.a}` }, body: "{" }), p(l.id)), 400);
    for (const quantity of ["1.5", "1e2", "01", "0", "2147483648", "1&quantity=2"]) await denied(() => resolve(req({}, keys.a, `?inventoryItemId=${item.id}&quantity=${quantity}`), p(l.id)), 400);
    await denied(() => resolve(req({}, keys.a, `?inventoryItemId=${item.id}&asOf=2024-02-30`), p(l.id)), 400);
    await denied(() => get(req(), p("bad")), 400);
    await denied(() => edit(req({ minQuantity: 10 }), p(l.id, tier1.id)), 409);
    await mdenied("update_price_list_item", { priceListId: l.id, priceListItemId: tier1.id, minQuantity: 10 }, ma, 409);
    await denied(() => create(req({ name: "Retail" })), 409);
    const race = await Promise.all([add(req({ inventoryItemId: item.id, unitPrice: 800, minQuantity: 20 }), p(l.id)), ma.call("add_price_list_item", { priceListId: l.id, inventoryItemId: item.id, unitPriceMinor: "800", minQuantity: 20 })]);
    assert.equal(Number(race[0].status === 201) + Number(!race[1].isError), 1); assert.ok(race[0].status === 409 || race[1].body.status === 409);
    const nameRace = await Promise.all([create(req({ name: "Race" })), ma.call("create_price_list", { name: "Race" })]);
    assert.equal(Number(nameRace[0].status === 201) + Number(!nameRace[1].isError), 1);
    // Corrupt historical joins fail closed, never revealing another tenant's item.
    const [corrupt] = await db.insert(priceListItem).values({ priceListId: l.id, inventoryItemId: foreign.id, unitPrice: 1234 }).returning();
    await denied(() => get(req(), p(l.id)), 404); await mdenied("get_price_list", { priceListId: l.id }, ma, 404);
    assert.equal((await data(await lookup(l.id, 1, "2024-01-01", foreign.id))).resolved, null);
    await db.delete(priceListItem).where(eq(priceListItem.id, corrupt.id));
    await db.update(inventoryItem).set({ deletedAt: new Date() }).where(eq(inventoryItem.id, item.id));
    assert.equal((await data(await lookup(l.id))).resolved, null); assert.equal((await data(await get(req(), p(l.id)))).priceList.items.length, 3);
    await denied(() => edit(req({ unitPrice: 1 }), p(l.id, tier1.id)), 404);
    await db.update(inventoryItem).set({ deletedAt: null }).where(eq(inventoryItem.id, item.id));
    await db.execute(sql.raw(`update price_list_item set unit_price=9007199254740992 where id='${tier1.id}'`));
    await denied(() => get(req(), p(l.id)), 422); await mdenied("get_price_list", { priceListId: l.id }, ma, 422);
    await denied(() => lookup(l.id), 422); await mdenied("resolve_price", { priceListId: l.id, inventoryItemId: item.id, asOf: "2024-01-01" }, ma, 422);
    await db.execute(sql.raw(`update price_list_item set unit_price=1250 where id='${tier1.id}'`));
    await db.update(priceList).set({ currencyCode: "XYZ" }).where(eq(priceList.id, l.id));
    await denied(() => list(req()), 422); await mdenied("list_price_lists", {}, ma, 422);
    await denied(() => patch(req({ name: "No partial mutation" }), p(l.id)), 422);
    await db.update(priceList).set({ currencyCode: "USD" }).where(eq(priceList.id, l.id));
    await data(await patch(req({ effectiveFrom: null, effectiveTo: null }), p(l.id)));
    assert.equal((await data(await lookup(l.id, 10, "2023-12-31"))).resolved.unitPriceMinor, "1000");
    // Inject actual audit/output failures; all six mutation types must roll back.
    await db.execute(sql.raw("create function pricing_audit_fault() returns trigger language plpgsql as $$ begin raise exception 'fixture audit fault'; end $$"));
    await db.execute(sql.raw("create trigger pricing_audit_fault before insert on audit_log for each row execute function pricing_audit_fault()"));
    for (const fn of [() => create(req({ name: "Rollback" })), () => patch(req({ name: "Rollback" }), p(l.id)), () => remove(req(), p(l.id)),
      () => add(req({ inventoryItemId: item.id, unitPrice: 1, minQuantity: 30 }), p(l.id)), () => edit(req({ unitPrice: 1 }), p(l.id, tier1.id)), () => drop(req(), p(l.id, tier1.id))]) await denied(fn, 500);
    for (const [name, args] of [["create_price_list", { name: "Rollback" }], ["update_price_list", { priceListId: l.id, name: "Rollback" }], ["delete_price_list", { priceListId: l.id }],
      ["add_price_list_item", { priceListId: l.id, inventoryItemId: item.id, unitPrice: 1, minQuantity: 30 }], ["update_price_list_item", { priceListId: l.id, priceListItemId: tier1.id, unitPrice: 1 }], ["delete_price_list_item", { priceListId: l.id, priceListItemId: tier1.id }]] as const) await mdenied(name, args);
    await db.execute(sql.raw("drop trigger pricing_audit_fault on audit_log; drop function pricing_audit_fault()"));
    await db.execute(sql.raw("create function pricing_output_fault() returns trigger language plpgsql as $$ begin NEW.unit_price=9007199254740992; return NEW; end $$"));
    await db.execute(sql.raw("create trigger pricing_output_fault before insert or update on price_list_item for each row execute function pricing_output_fault()"));
    await denied(() => add(req({ inventoryItemId: item.id, unitPrice: 1, minQuantity: 30 }), p(l.id)), 422);
    await denied(() => edit(req({ unitPrice: 1 }), p(l.id, tier1.id)), 422);
    await mdenied("add_price_list_item", { priceListId: l.id, inventoryItemId: item.id, unitPrice: 1, minQuantity: 30 }, ma, 422);
    await mdenied("update_price_list_item", { priceListId: l.id, priceListItemId: tier1.id, unitPrice: 1 }, ma, 422);
    await db.execute(sql.raw("drop trigger pricing_output_fault on price_list_item; drop function pricing_output_fault()"));
    await data(await drop(req(), p(l.id, tier10.id)));
    assert.equal((await ma.call("delete_price_list_item", { priceListId: l.id, priceListItemId: tier1.id })).body.deletedPriceListItemId, tier1.id);
    const deletion = await Promise.all([remove(req(), p(l.id)), ma.call("delete_price_list", { priceListId: l.id })]);
    assert.equal(Number(deletion[0].status === 200) + Number(!deletion[1].isError), 1);
    assert.equal((await data(await lookup(l.id))).resolved, null); await denied(() => get(req(), p(l.id)), 404);
    assert.equal((await db.select().from(priceListItem).where(eq(priceListItem.priceListId, l.id))).length, 1);
    await denied(() => create(req({ name: "Retail" })), 409);
    assert.equal((await ma.call("delete_price_list", { priceListId: ml })).body.deletedPriceListId, ml);
    const raceList = (await data(await create(req({ name: "Delete/add race" })), 201)).priceList;
    const addDelete = await Promise.all([remove(req(), p(raceList.id)), ma.call("add_price_list_item", { priceListId: raceList.id, inventoryItemId: item.id, unitPriceMinor: "123" })]);
    assert.equal(addDelete[0].status, 200);
    if (addDelete[1].isError) assert.equal(addDelete[1].body.status, 404);
    assert.equal((await data(await lookup(raceList.id))).resolved, null);
    assert.equal((await data(await lookup(randomUUID()))).resolved, null);
    console.log("Pricing contracts verified: ten operation pairs, cents/tier/window/auth/scope, safe maxima, concurrency and atomic rollback");
  } finally { await ma.close(); await mb.close(); await ro.close(); await managed.close(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => process.exit(process.exitCode ?? 0));
