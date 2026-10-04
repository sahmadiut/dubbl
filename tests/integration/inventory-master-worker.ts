import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, customRole, inventoryItem, inventoryCategory, inventoryItemSupplier, inventoryCostLayer, contact, chartAccount, periodLock } from "../../lib/db/schema";
import type { AuthContext } from "../../lib/api/auth-context";
import { GET as list, POST as create } from "../../app/api/v1/inventory/route";
import { GET as get, PATCH as patch, DELETE as remove } from "../../app/api/v1/inventory/[id]/route";
import { GET as cats, POST as catCreate } from "../../app/api/v1/inventory/categories/route";
import { PATCH as catPatch, DELETE as catDelete } from "../../app/api/v1/inventory/categories/[id]/route";
import { POST as bulk } from "../../app/api/v1/inventory/bulk/route";
import { POST as csvImport } from "../../app/api/v1/inventory/import/route";
import { GET as reorder } from "../../app/api/v1/inventory/reorder-suggestions/route";
import { registerAllTools } from "../../lib/mcp/tools";
import { registerInventoryMasterTools } from "../../lib/mcp/tools/inventory-master";
import { createInventoryItem, updateInventoryItem, deleteInventoryItem, writeInventoryCategory, deleteInventoryCategory, bulkInventoryItems, importInventoryCsv } from "../../lib/api/inventory-master";

async function mcp(ctx: AuthContext, full = false) {
  const server = new McpServer({ name: "Master fixture", version: "1" });
  if (full) registerAllTools(server, ctx); else registerInventoryMasterTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1" }), [ct, st] = InMemoryTransport.createLinkedPair();
  await server.connect(st); await client.connect(ct);
  const tools = (await client.listTools()).tools, names = tools.map(t => t.name);
  assert.equal(new Set(names).size, names.length);
  if (!full) {
    assert.equal(tools.length, 16);
    for (const tool of tools) {
      assert.equal(tool.inputSchema.additionalProperties, false);
      for (const field of Object.values(tool.inputSchema.properties ?? {})) assert.ok((field as { description?: string }).description, tool.name);
    }
  }
  return { async call(name: string, args: Record<string, unknown> = {}) {
    const r = await client.callTool({ name, arguments: args }), text = (r.content as { text: string }[])[0].text;
    return { isError: r.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
  }, async close() { await client.close(); await server.close(); } };
}
async function run() {
  const [a, b] = await db.insert(organization).values([{ name: "Master A", slug: "master-a", defaultCurrency: "KWD" }, { name: "Master B", slug: "master-b" }]).returning();
  const [owner, viewer, manager] = await db.insert(users).values([{ email: "master-owner@example.test" }, { email: "master-viewer@example.test" }, { email: "master-manager@example.test" }]).returning();
  const [viewRole, manageRole] = await db.insert(customRole).values([{ organizationId: a.id, name: "Read", permissions: [] }, { organizationId: a.id, name: "Inventory", permissions: ["manage:inventory"] }]).returning();
  await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner" }, { organizationId: b.id, userId: owner.id, role: "owner" },
    { organizationId: a.id, userId: viewer.id, customRoleId: viewRole.id }, { organizationId: a.id, userId: manager.id, customRoleId: manageRole.id }]);
  const keys = { a: "dk_master_a", b: "dk_master_b", viewer: "dk_master_viewer", manager: "dk_master_manager", expired: "dk_master_expired" };
  for (const [label, key] of Object.entries(keys)) await db.insert(apiKey).values({ organizationId: label === "b" ? b.id : a.id,
    createdBy: label === "viewer" ? viewer.id : label === "manager" ? manager.id : owner.id, name: label,
    keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_master", expiresAt: label === "expired" ? new Date("2020-01-01") : null });
  const ctx: AuthContext = { organizationId: a.id, userId: owner.id, role: "owner" };
  const ma = await mcp(ctx, true), mb = await mcp({ ...ctx, organizationId: b.id }), ro = await mcp({ ...ctx, userId: viewer.id, role: "member", permissions: [] });
  const req = (body: unknown = {}, key = keys.a, query = "") => new Request(`http://fixture.test/api/v1/inventory${query}`, { method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-organization-id": b.id }, body: JSON.stringify(body) });
  const cp = (id: string) => ({ params: Promise.resolve({ id }) });
  const data = async (r: Response, status = 200) => { const body = await r.json(); assert.equal(r.status, status, JSON.stringify(body)); return body; };
  const snapshot = async () => Promise.all(["inventory_item", "inventory_category", "inventory_movement", "warehouse_stock", "inventory_cost_layer", "journal_entry", "journal_line", "chart_account", "audit_log"].map(t =>
    db.execute(sql.raw(`select coalesce(jsonb_agg(to_jsonb(t)::text order by t.id),'[]'::jsonb) as rows from ${t} t`)).then(r => r.rows)));
  const denied = async (fn: () => Promise<Response>, status: number) => { const before = await snapshot(); await data(await fn(), status); assert.deepEqual(await snapshot(), before); };
  const mdenied = async (name: string, args: Record<string, unknown>, client = ma, status?: number) => {
    const before = await snapshot(), result = await client.call(name, args); assert.equal(result.isError, true, name);
    if (status) assert.equal(result.body.status, status); assert.deepEqual(await snapshot(), before);
  };
  const csvReq = (csv: string, key = keys.a) => {
    const form = new FormData(); form.append("file", new File([csv], "inventory.csv"));
    return new Request("http://fixture.test/import", { method: "POST", headers: { authorization: `Bearer ${key}` }, body: form });
  };
  try {
    const category = (await data(await catCreate(req({ name: "Root" })), 201)).category;
    const child = (await ma.call("create_inventory_category", { name: "Child", parentId: category.id })).body.category;
    assert.deepEqual((await ma.call("list_inventory_categories")).body, await data(await cats(req())));
    await denied(() => catPatch(req({ parentId: child.id }), cp(category.id)), 400);
    assert.equal((await ma.call("update_inventory_category", { categoryId: child.id, color: "red" })).body.category.color, "red");
    const [foreignCat] = await db.insert(inventoryCategory).values({ organizationId: b.id, name: "Foreign" }).returning();
    const [foreignAcct] = await db.insert(chartAccount).values({ organizationId: b.id, code: "B", name: "Foreign", type: "asset" }).returning();
    await denied(() => catCreate(req({ name: "Foreign parent", parentId: foreignCat.id })), 404);
    await mdenied("update_inventory_category", { categoryId: child.id, parentId: foreignCat.id }, ma, 404);
    const item = (await data(await create(req({ code: "OPEN", name: "Opening", purchasePrice: 29, purchasePriceMinor: "29", salePrice: 50, quantityOnHand: 3, categoryId: child.id })), 201)).inventoryItem;
    assert.equal(item.organizationId, a.id); assert.equal(item.totalValueMinor, "87"); assert.equal(item.averageCostMinor, "29");
    const je = await db.execute(sql`select e.id, sum(l.debit_amount)::text as debit, sum(l.credit_amount)::text as credit from journal_entry e join journal_line l on l.journal_entry_id=e.id where e.source_id=${item.id} group by e.id`);
    assert.equal(je.rows[0].debit, "87"); assert.equal(je.rows[0].credit, "87");
    const move = await db.execute(sql`select value::text, journal_entry_id from inventory_movement where inventory_item_id=${item.id}`);
    assert.equal(move.rows[0].value, "87"); assert.equal(move.rows[0].journal_entry_id, je.rows[0].id);
    const currencies = await db.execute(sql`select distinct l.currency_code from journal_line l join journal_entry e on e.id=l.journal_entry_id where e.source_id=${item.id}`);
    assert.equal(currencies.rows[0].currency_code, "KWD");
    const exact = (await ma.call("create_inventory_item", { code: "EXACT", name: "Exact", purchasePriceMinor: "3000000000", salePriceMinor: "9007199254740991" })).body.inventoryItem;
    assert.equal(exact.salePrice, Number.MAX_SAFE_INTEGER); assert.equal(exact.quantityOnHand, 0);
    const noCost = (await ma.call("create_inventory_item", { code: "NOCOST", name: "No cost", quantityOnHand: 5 })).body.inventoryItem;
    assert.equal(noCost.quantityOnHand, 0); assert.equal(noCost.totalValueMinor, "0");
    assert.equal((await ma.call("delete_inventory_item", { inventoryItemId: noCost.id })).body.success, true);
    assert.equal((await data(await patch(req({ salePriceMinor: "0" }), cp(exact.id)))).inventoryItem.purchasePriceMinor, "3000000000");
    assert.equal((await ma.call("update_inventory_item", { inventoryItemId: exact.id, name: "Renamed" })).body.inventoryItem.salePriceMinor, "0");
    assert.deepEqual((await ma.call("get_inventory_item", { inventoryItemId: item.id })).body, await data(await get(req(), cp(item.id))));
    const listed = await data(await list(req({}, keys.viewer)));
    assert.equal(listed.summary.totalValueMinor, "87"); assert.equal(listed.pagination.total, 2);
    assert.deepEqual((await ma.call("list_inventory_items", { activeOnly: false })).body.items, listed.data);
    for (const bad of [{ purchasePrice: -1 }, { purchasePrice: 0.1 }, { salePriceMinor: "01" }, { purchasePrice: 1, purchasePriceMinor: "2" }, { quantityOnHand: 1.5 }, { quantityOnHand: 2147483648 }, { quantityOnHand: -0 }, { unknown: true }].filter(x => !Object.is(x.quantityOnHand, -0))) {
      await denied(() => create(req({ code: "BAD", name: "Bad", ...bad })), 400); await mdenied("create_inventory_item", { code: "BAD", name: "Bad", ...bad });
    }
    for (const bad of [{ purchasePriceMinor: "9007199254740992" }, { purchasePriceMinor: "9007199254740991", quantityOnHand: 2 }]) {
      await denied(() => create(req({ code: "RANGE", name: "Range", ...bad })), 422); await mdenied("create_inventory_item", { code: "RANGE", name: "Range", ...bad }, ma, 422);
    }
    await denied(() => patch(req({ quantityOnHand: 4 }), cp(item.id)), 400);
    await denied(() => patch(req({ purchasePriceMinor: "9007199254740991" }), cp(item.id)), 422);
    for (const body of [{ categoryId: foreignCat.id }, { inventoryAccountId: foreignAcct.id }]) {
      await denied(() => create(req({ code: "REF", name: "Ref", ...body })), 404); await mdenied("update_inventory_item", { inventoryItemId: item.id, ...body }, ma, 404);
    }
    await denied(() => create(req({ code: "OPEN", name: "Duplicate" })), 409);
    const [wrongType, wrongCurrency, deletedAccount] = await db.insert(chartAccount).values([
      { organizationId: a.id, code: "WRONG", name: "Wrong type", type: "expense", currencyCode: "KWD" },
      { organizationId: a.id, code: "USDINV", name: "Wrong currency", type: "asset", currencyCode: "USD" },
      { organizationId: a.id, code: "DELETED", name: "Deleted", type: "asset", deletedAt: new Date(), currencyCode: "KWD" },
    ]).returning();
    await denied(() => create(req({ code: "TYPE", name: "Wrong", inventoryAccountId: wrongType.id })), 404);
    await denied(() => create(req({ code: "DELETED", name: "Deleted", inventoryAccountId: deletedAccount.id })), 404);
    await denied(() => create(req({ code: "CURRENCY", name: "Wrong currency", inventoryAccountId: wrongCurrency.id, purchasePrice: 29, quantityOnHand: 1 })), 422);
    const [foreign] = await db.insert(inventoryItem).values({ organizationId: b.id, code: "FOREIGN", name: "Foreign" }).returning();
    for (const id of [foreign.id, "00000000-0000-4000-8000-000000000001"]) {
      await denied(() => get(req(), cp(id)), 404); await denied(() => patch(req({ name: "Bad" }), cp(id)), 404); await denied(() => remove(req(), cp(id)), 404);
      await mdenied("get_inventory_item", { inventoryItemId: id }, ma, 404); await mdenied("delete_inventory_item", { inventoryItemId: id }, ma, 404);
    }
    await mdenied("update_inventory_item", { inventoryItemId: item.id, name: "Bad" }, mb, 404);
    for (const key of ["dk_invalid", keys.expired]) { await denied(() => list(req({}, key)), 401); await denied(() => create(req({ code: "BAD", name: "Bad" }, key)), 401); }
    await denied(() => get(req(), cp("invalid")), 400);
    await denied(() => list(req({}, keys.a, "?page=1junk")), 400);
    await denied(() => create(new Request("http://fixture.test", { method: "POST", headers: { authorization: `Bearer ${keys.a}` }, body: "{" })), 400);
    for (const fn of [() => create(req({ code: "DENY", name: "Denied" }, keys.viewer)), () => patch(req({ name: "Bad" }, keys.viewer), cp(item.id)), () => remove(req({}, keys.viewer), cp(item.id)),
      () => catCreate(req({ name: "Denied" }, keys.viewer)), () => catPatch(req({ name: "Denied" }, keys.viewer), cp(child.id)), () => catDelete(req({}, keys.viewer), cp(child.id)),
      () => bulk(req({ action: "set_inactive", ids: [item.id] }, keys.viewer)), () => csvImport(csvReq("code,name\nDENY,Denied", keys.viewer))]) await denied(fn, 403);
    for (const [name, args] of [["create_inventory_item", { code: "DENY", name: "Denied" }], ["update_inventory_item", { inventoryItemId: item.id }], ["delete_inventory_item", { inventoryItemId: item.id }],
      ["create_inventory_category", { name: "Denied" }], ["update_inventory_category", { categoryId: child.id }], ["delete_inventory_category", { categoryId: child.id }],
      ["deactivate_inventory_items", { ids: [item.id] }], ["import_inventory_csv", { csv: "code,name\nDENY,Denied" }]] as const) await mdenied(name, args, ro, 403);
    const managed = (await data(await create(req({ code: "MANAGED", name: "Managed" }, keys.manager)), 201)).inventoryItem;
    await data(await remove(req({}, keys.manager), cp(managed.id)));
    // Partial import semantics; legacy major prices remain two-decimal, exact columns cents.
    const imported = await data(await csvImport(csvReq('code,name,purchasePrice,salePrice,quantityOnHand\nCSV,"CSV, Item",0.29,1.25,4\nBAD,Invalid,1.234,2,1')));
    assert.equal(imported.created, 1); assert.equal(imported.errors.length, 1);
    const csvItem = (await db.query.inventoryItem.findFirst({ where: eq(inventoryItem.code, "CSV") }))!;
    assert.equal(csvItem.totalValue, 116); assert.equal(csvItem.averageCost, 29);
    const repeat = await ma.call("import_inventory_csv", { csv: "code,name,purchasePriceMinor,quantityOnHand\nCSV,Updated,40,999\nCSVEX,Exact,3000000000,1" });
    assert.equal(repeat.body.updated, 1); assert.equal(repeat.body.created, 1);
    const dualCsv = await ma.call("import_inventory_csv", { csv: "code,name,purchasePrice,purchasePriceMinor,quantityOnHand\nDUALCSV,Dual,0.29,29,2\nCONFLICTCSV,Conflict,0.29,30,2" });
    assert.equal(dualCsv.body.created, 1); assert.equal(dualCsv.body.errors.length, 1);
    assert.equal((await getInventoryItemForTest(csvItem.id)).quantityOnHand, 4); assert.equal((await getInventoryItemForTest(csvItem.id)).totalValue, 116);
    await denied(() => bulk(req({ action: "adjust_stock", ids: [item.id, foreign.id], adjustment: 1 })), 404);
    await denied(() => bulk(req({ action: "adjust_stock", ids: [item.id, csvItem.id], adjustment: -4 })), 400);
    await denied(() => bulk(req({ action: "set_active", ids: [item.id, item.id] })), 400);
    await data(await bulk(req({ action: "adjust_stock", ids: [item.id], adjustment: 2 })));
    assert.equal((await getInventoryItemForTest(item.id)).totalValue, 145);
    assert.equal((await ma.call("adjust_inventory_items_stock", { ids: [item.id], adjustment: -1 })).isError, false);
    assert.equal((await getInventoryItemForTest(item.id)).quantityOnHand, 4);
    const fifo = (await data(await create(req({ code: "FIFO", name: "FIFO" })), 201)).inventoryItem;
    await db.update(inventoryItem).set({ costMethod: "fifo", quantityOnHand: 3, averageCost: 33, totalValue: 100 }).where(eq(inventoryItem.id, fifo.id));
    await db.insert(inventoryCostLayer).values([
      { organizationId: a.id, inventoryItemId: fifo.id, originalQuantity: 1, remainingQuantity: 1, unitCost: 20, receivedAt: new Date("2020-01-01") },
      { organizationId: a.id, inventoryItemId: fifo.id, originalQuantity: 2, remainingQuantity: 2, unitCost: 40, receivedAt: new Date("2020-01-02") },
    ]);
    await data(await bulk(req({ action: "adjust_stock", ids: [fifo.id], adjustment: -2 })));
    assert.equal((await getInventoryItemForTest(fifo.id)).totalValue, 40);
    assert.equal((await getInventoryItemForTest(fifo.id)).quantityOnHand, 1);
    const fifoMove = await db.execute(sql`select value::text, unit_cost::text from inventory_movement where inventory_item_id=${fifo.id}`);
    assert.equal(fifoMove.rows[0].value, "-60"); assert.equal(fifoMove.rows[0].unit_cost, "30");
    const [overQty] = await db.insert(inventoryItem).values({ organizationId: a.id, code: "QMAX", name: "Max qty", quantityOnHand: 2147483647 }).returning();
    await denied(() => bulk(req({ action: "adjust_stock", ids: [overQty.id], adjustment: 1 })), 400);
    const [overMoney] = await db.insert(inventoryItem).values({ organizationId: a.id, code: "MONEYMAX", name: "Max money", averageCost: Number.MAX_SAFE_INTEGER }).returning();
    await mdenied("adjust_inventory_items_stock", { ids: [overMoney.id], adjustment: 2 }, ma, 422);
    for (const [name, args] of [["deactivate_inventory_items", { ids: [exact.id] }], ["activate_inventory_items", { ids: [exact.id] }], ["set_inventory_items_category", { ids: [exact.id], category: "Bulk" }]] as const) assert.equal((await ma.call(name, args)).isError, false);
    await db.insert(periodLock).values({ organizationId: a.id, lockDate: "2999-12-31" });
    await denied(() => create(req({ code: "LOCK", name: "Lock", purchasePrice: 29, quantityOnHand: 1 })), 422);
    await mdenied("adjust_inventory_items_stock", { ids: [item.id], adjustment: 1 }, ma, 422);
    const lockedCsv = await ma.call("import_inventory_csv", { csv: "code,name,purchasePrice,quantityOnHand\nLOCKCSV,Lock,1,1" }); assert.equal(lockedCsv.body.created, 0); assert.equal(lockedCsv.body.errors.length, 1);
    await db.delete(periodLock).where(eq(periodLock.organizationId, a.id));
    const [secret] = await db.insert(contact).values({ organizationId: b.id, name: "SECRET FOREIGN", type: "supplier" }).returning();
    await db.insert(inventoryItemSupplier).values({ organizationId: a.id, inventoryItemId: exact.id, contactId: secret.id });
    const suggestions = await data(await reorder(req())); assert.equal(JSON.stringify(suggestions).includes("SECRET FOREIGN"), false);
    assert.deepEqual((await ma.call("list_inventory_reorder_suggestions")).body, suggestions);
    // Saved bigint range failure cannot be hidden by a master patch/bulk/import.
    await db.execute(sql`update inventory_item set average_cost=9007199254740992 where id=${exact.id}`);
    await denied(() => get(req(), cp(exact.id)), 422); await denied(() => patch(req({ name: "Mask" }), cp(exact.id)), 422);
    await denied(() => bulk(req({ action: "set_active", ids: [exact.id] })), 422); await mdenied("get_inventory_item", { inventoryItemId: exact.id }, ma, 422);
    await denied(() => list(req()), 422); await mdenied("list_inventory_reorder_suggestions", {}, ma, 422);
    await db.update(inventoryItem).set({ averageCost: 0 }).where(eq(inventoryItem.id, exact.id));
    // Each row is safe; an unfiltered aggregate above Number precision must fail visibly.
    await db.update(inventoryItem).set({ purchasePrice: Number.MAX_SAFE_INTEGER, quantityOnHand: 1 }).where(eq(inventoryItem.id, exact.id));
    await db.update(inventoryItem).set({ purchasePrice: Number.MAX_SAFE_INTEGER, quantityOnHand: 1 }).where(eq(inventoryItem.id, overMoney.id));
    await denied(() => list(req({}, keys.a, "?limit=1")), 422); await mdenied("list_inventory_items", { limit: 1 }, ma, 422);
    await db.update(inventoryItem).set({ purchasePrice: 3000000000, quantityOnHand: 0 }).where(eq(inventoryItem.id, exact.id));
    await db.update(inventoryItem).set({ purchasePrice: 0, quantityOnHand: 0 }).where(eq(inventoryItem.id, overMoney.id));
    // Concurrent duplicate codes: exactly one REST/MCP create and audit.
    const racing = await Promise.all([create(req({ code: "RACE", name: "Race" })), ma.call("create_inventory_item", { code: "RACE", name: "Race" })]);
    assert.equal((racing[0].status === 201 ? 1 : 0) + (!racing[1].isError ? 1 : 0), 1);
    assert.ok(racing[0].status === 409 || racing[1].body.status === 409);
    // Every write path rolls back when audit insertion fails, including full opening GL and CSV row.
    await db.execute(sql`create function fail_master_audit() returns trigger language plpgsql as $$ begin raise exception 'Synthetic master audit failure'; end $$`);
    await db.execute(sql`create trigger fail_master_audit before insert on audit_log for each row execute function fail_master_audit()`);
    for (const fn of [() => createInventoryItem(ctx, { code: "ROLLBACK", name: "Rollback", purchasePrice: 29, quantityOnHand: 2 }),
      () => updateInventoryItem(ctx, item.id, { name: "Rollback" }), () => deleteInventoryItem(ctx, item.id),
      () => writeInventoryCategory(ctx, { name: "Rollback" }), () => writeInventoryCategory(ctx, { color: "blue" }, child.id), () => deleteInventoryCategory(ctx, child.id),
      () => bulkInventoryItems(ctx, { action: "adjust_stock", ids: [item.id, csvItem.id], adjustment: 1 }), () => bulkInventoryItems(ctx, { action: "set_inactive", ids: [item.id] }),
      () => importInventoryCsv(ctx, "code,name,purchasePrice,quantityOnHand\nROLLCSV,Rollback,0.29,3")]) {
      const before = await snapshot(); await assert.rejects(fn, (error: unknown) => { assert.match(String((error as { cause?: unknown }).cause), /Synthetic master audit failure/); return true; });
      assert.deepEqual(await snapshot(), before);
    }
    await db.execute(sql`drop trigger fail_master_audit on audit_log`); await db.execute(sql`drop function fail_master_audit()`);
    await data(await catDelete(req(), cp(child.id))); assert.equal((await getInventoryItemForTest(item.id)).categoryId, null);
    await denied(() => catPatch(req({ name: "Deleted" }), cp(child.id)), 404);
    await denied(() => create(req({ code: "DELCAT", name: "Deleted category", categoryId: child.id })), 404);
    assert.equal((await ma.call("delete_inventory_category", { categoryId: category.id })).body.success, true);
    assert.equal((await ma.call("delete_inventory_items", { ids: [exact.id] })).body.affected, 1);
    await denied(() => patch(req({ name: "Deleted" }), cp(exact.id)), 404);
    const balances = await db.execute(sql`select e.id from journal_entry e join journal_line l on l.journal_entry_id=e.id group by e.id having sum(l.debit_amount) <> sum(l.credit_amount)`);
    assert.equal(balances.rows.length, 0);
    console.log("Inventory master contracts verified");
  } finally { await Promise.all([ma.close(), mb.close(), ro.close()]); }
}
async function getInventoryItemForTest(id: string) { return (await db.query.inventoryItem.findFirst({ where: eq(inventoryItem.id, id) }))!; }
run().then(() => process.exit(0), error => { console.error(error); process.exit(1); });
