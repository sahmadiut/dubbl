import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, customRole, inventoryItem, inventoryVariant, inventoryItemSupplier, contact } from "../../lib/db/schema";
import type { AuthContext } from "../../lib/api/auth-context";
import { GET as variants, POST as createVariant } from "../../app/api/v1/inventory/[id]/variants/route";
import { PATCH as patchVariant, DELETE as removeVariant } from "../../app/api/v1/inventory/[id]/variants/[variantId]/route";
import { GET as suppliers, POST as createSupplier } from "../../app/api/v1/inventory/[id]/suppliers/route";
import { PATCH as patchSupplier, DELETE as removeSupplier } from "../../app/api/v1/inventory/[id]/suppliers/[supplierId]/route";
import { registerInventoryCatalogTools } from "../../lib/mcp/tools/inventory-catalog";
import { registerAllTools } from "../../lib/mcp/tools";
import { createInventoryVariant, updateInventoryVariant, deleteInventoryVariant, createInventorySupplier, updateInventorySupplier, deleteInventorySupplier } from "../../lib/api/inventory-catalog";

async function mcp(ctx: AuthContext, full = false) {
  const server = new McpServer({ name: "Catalog fixture", version: "1" });
  if (full) registerAllTools(server, ctx); else registerInventoryCatalogTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1" }), [ct, st] = InMemoryTransport.createLinkedPair();
  await server.connect(st); await client.connect(ct);
  const tools = (await client.listTools()).tools, names = tools.map(t => t.name);
  assert.equal(new Set(names).size, names.length);
  for (const tool of tools.filter(t => /inventory_(variant|supplier)/.test(t.name))) {
    assert.equal(tool.inputSchema.additionalProperties, false);
    for (const field of Object.values(tool.inputSchema.properties ?? {})) assert.ok((field as { description?: string }).description, tool.name);
  }
  if (!full) assert.equal(tools.length, 8);
  for (const name of ["list_inventory_variants", "create_inventory_variant", "update_inventory_variant", "delete_inventory_variant", "list_inventory_suppliers", "create_inventory_supplier", "update_inventory_supplier", "delete_inventory_supplier"]) assert.ok(names.includes(name), name);
  return { async call(name: string, args: Record<string, unknown>) {
    const r = await client.callTool({ name, arguments: args }), text = (r.content as { text: string }[])[0].text;
    return { isError: r.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
  }, async close() { await client.close(); await server.close(); } };
}
async function run() {
  const [a, b] = await db.insert(organization).values([{ name: "Catalog A", slug: "catalog-a", defaultCurrency: "KWD" }, { name: "Catalog B", slug: "catalog-b" }]).returning();
  const [owner, viewer, manager] = await db.insert(users).values([{ email: "catalog-owner@example.test" }, { email: "catalog-viewer@example.test" }, { email: "catalog-manager@example.test" }]).returning();
  const [viewRole, manageRole] = await db.insert(customRole).values([{ organizationId: a.id, name: "Read", permissions: [] }, { organizationId: a.id, name: "Inventory", permissions: ["manage:inventory"] }]).returning();
  await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner" }, { organizationId: b.id, userId: owner.id, role: "owner" },
    { organizationId: a.id, userId: viewer.id, customRoleId: viewRole.id }, { organizationId: a.id, userId: manager.id, customRoleId: manageRole.id }]);
  const keys = { a: "dk_catalog_a", b: "dk_catalog_b", viewer: "dk_catalog_viewer", manager: "dk_catalog_manager", expired: "dk_catalog_expired" };
  for (const [label, key] of Object.entries(keys)) await db.insert(apiKey).values({ organizationId: label === "b" ? b.id : a.id,
    createdBy: label === "viewer" ? viewer.id : label === "manager" ? manager.id : owner.id, name: label,
    keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_catalog", expiresAt: label === "expired" ? new Date("2020-01-01") : null });
  const [own, otherItem, foreign, deleted] = await db.insert(inventoryItem).values([{ organizationId: a.id, code: "A", name: "Item A" },
    { organizationId: a.id, code: "A2", name: "Item A2" }, { organizationId: b.id, code: "B", name: "Item B" },
    { organizationId: a.id, code: "DEL", name: "Deleted", deletedAt: new Date() }]).returning();
  const [supplier, both, customer, foreignContact, deletedContact] = await db.insert(contact).values([
    { organizationId: a.id, name: "Supplier", type: "supplier" }, { organizationId: a.id, name: "Both", type: "both" },
    { organizationId: a.id, name: "Customer", type: "customer" }, { organizationId: b.id, name: "SECRET FOREIGN", email: "secret@example.test", type: "supplier" },
    { organizationId: a.id, name: "Deleted supplier", type: "supplier", deletedAt: new Date() },
  ]).returning();
  const ctx: AuthContext = { organizationId: a.id, userId: owner.id, role: "owner" };
  const ma = await mcp(ctx, true), mb = await mcp({ ...ctx, organizationId: b.id }), ro = await mcp({ ...ctx, userId: viewer.id, role: "member", permissions: [] });
  const req = (body: unknown = {}, key = keys.a) => new Request("http://fixture.test/api/v1/inventory", { method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-organization-id": b.id }, body: JSON.stringify(body) });
  const p = (id = own.id) => ({ params: Promise.resolve({ id }) });
  const vp = (variantId: string, id = own.id) => ({ params: Promise.resolve({ id, variantId }) });
  const sp = (supplierId: string, id = own.id) => ({ params: Promise.resolve({ id, supplierId }) });
  const data = async (r: Response, status = 200) => { const body = await r.json(); assert.equal(r.status, status, JSON.stringify(body)); return body; };
  const snapshot = async () => Promise.all(["inventory_item", "inventory_variant", "inventory_item_supplier", "inventory_movement", "warehouse_stock", "inventory_cost_layer", "journal_entry", "journal_line", "audit_log"].map(t =>
    db.execute(sql.raw(`select coalesce(jsonb_agg(to_jsonb(t)::text order by t.id),'[]'::jsonb) as rows from ${t} t`)).then(r => r.rows)));
  const denied = async (fn: () => Promise<Response>, status: number) => { const before = await snapshot(); await data(await fn(), status); assert.deepEqual(await snapshot(), before); };
  const mdenied = async (name: string, args: Record<string, unknown>, client = ma, status?: number) => {
    const before = await snapshot(), result = await client.call(name, args); assert.equal(result.isError, true, name);
    if (status) assert.equal(result.body.status, status); assert.deepEqual(await snapshot(), before);
  };
  try {
    const v = (await data(await createVariant(req({ name: "Legacy", purchasePrice: 1250, salePrice: 2000, quantityOnHand: -3, options: { Color: "Red" } }), p()), 201)).inventoryVariant;
    assert.equal(v.organizationId, a.id); assert.equal(v.purchasePriceMinor, "1250"); assert.equal(v.salePriceMinor, "2000"); assert.equal(v.quantityOnHand, -3);
    const exact = (await ma.call("create_inventory_variant", { inventoryItemId: own.id, name: "Exact", purchasePriceMinor: "3000000000", salePriceMinor: "9007199254740991" })).body.inventoryVariant;
    assert.equal(exact.purchasePrice, 3000000000); assert.equal(exact.salePrice, Number.MAX_SAFE_INTEGER); assert.deepEqual(exact.options, {});
    const dual = await ma.call("create_inventory_variant", { inventoryItemId: own.id, name: "Dual", purchasePrice: 29, purchasePriceMinor: "29" }); assert.equal(dual.isError, false);
    const restExact = (await data(await createVariant(req({ name: "REST exact", salePriceMinor: "3000000000" }), p()), 201)).inventoryVariant;
    await data(await patchVariant(req({ purchasePrice: 5, purchasePriceMinor: "5", sku: null }), vp(v.id)));
    assert.equal((await ma.call("update_inventory_variant", { inventoryItemId: own.id, variantId: exact.id, salePriceMinor: "0", isActive: false })).body.inventoryVariant.salePrice, 0);
    const unchanged = (await data(await patchVariant(req({ name: "Renamed" }), vp(exact.id)))).inventoryVariant;
    assert.equal(unchanged.purchasePriceMinor, "3000000000"); assert.equal(unchanged.salePriceMinor, "0");
    assert.equal((await data(await patchVariant(req({ quantityOnHand: 2147483647 }), vp(exact.id)))).inventoryVariant.quantityOnHand, 2147483647);
    assert.deepEqual((await ma.call("list_inventory_variants", { inventoryItemId: own.id })).body.data, (await data(await variants(req({}, keys.viewer), p()))).data);
    const link = (await data(await createSupplier(req({ contactId: supplier.id, purchasePrice: 1250, purchasePriceMinor: "1250", leadTimeDays: 5 }), p()), 201)).inventoryItemSupplier;
    const mlink = (await ma.call("create_inventory_supplier", { inventoryItemId: own.id, contactId: both.id, purchasePriceMinor: "9007199254740991" })).body.inventoryItemSupplier;
    assert.equal(mlink.purchasePriceMinor, "9007199254740991");
    const patched = (await data(await patchSupplier(req({ purchasePriceMinor: "3000000000", supplierCode: "SKU", isPreferred: true }), sp(link.id)))).inventoryItemSupplier;
    assert.equal(patched.purchasePrice, 3000000000); assert.equal(patched.leadTimeDays, 5);
    assert.equal((await ma.call("update_inventory_supplier", { inventoryItemId: own.id, supplierId: mlink.id, purchasePrice: 29, purchasePriceMinor: "29", leadTimeDays: 2147483647, isPreferred: true })).isError, false);
    assert.deepEqual((await ma.call("list_inventory_suppliers", { inventoryItemId: own.id })).body.data, (await data(await suppliers(req({}, keys.viewer), p()))).data);
    await denied(() => createSupplier(req({ contactId: supplier.id }), p()), 409);
    await mdenied("create_inventory_supplier", { inventoryItemId: own.id, contactId: supplier.id }, ma, 409);
    // Invalid inputs and authorization fail before any adopted write or audit.
    for (const bad of [{ purchasePrice: -1 }, { purchasePriceMinor: "01" }, { purchasePrice: 1, purchasePriceMinor: "2" }, { salePrice: 0.5 }, { quantityOnHand: 1.5 }, { quantityOnHand: 2147483648 }, { unexpected: true }]) {
      await denied(() => createVariant(req({ name: "Invalid", ...bad }), p()), 400);
      await mdenied("create_inventory_variant", { inventoryItemId: own.id, name: "Invalid", ...bad });
      await denied(() => patchVariant(req(bad), vp(v.id)), 400);
    }
    for (const bad of [{ purchasePriceMinor: "9007199254740992" }, { purchasePriceMinor: "9223372036854775807" }]) {
      await denied(() => createVariant(req({ name: "Too large", ...bad }), p()), 422);
      await mdenied("create_inventory_variant", { inventoryItemId: own.id, name: "Too large", ...bad }, ma, 422);
      await denied(() => patchSupplier(req(bad), sp(link.id)), 422);
      await denied(() => createSupplier(req({ contactId: deletedContact.id, ...bad }), p()), 422);
      await mdenied("create_inventory_supplier", { inventoryItemId: own.id, contactId: deletedContact.id, ...bad }, ma, 422);
    }
    for (const bad of [{ leadTimeDays: -1 }, { leadTimeDays: 1.5 }, { purchasePrice: 1, purchasePriceMinor: "2" }, { contactId: supplier.id }]) {
      await denied(() => patchSupplier(req(bad), sp(link.id)), 400);
      await mdenied("update_inventory_supplier", { inventoryItemId: own.id, supplierId: link.id, ...bad });
    }
    const malformed = () => new Request("http://fixture.test", { method: "POST", headers: { authorization: `Bearer ${keys.a}` }, body: "{" });
    await denied(() => createVariant(malformed(), p()), 400); await denied(() => createSupplier(malformed(), p()), 400);
    for (const id of [foreign.id, deleted.id]) {
      await denied(() => variants(req(), p(id)), 404); await denied(() => suppliers(req(), p(id)), 404);
      await denied(() => createVariant(req({ name: "Bad" }), p(id)), 404); await denied(() => createSupplier(req({ contactId: supplier.id }), p(id)), 404);
      await mdenied("list_inventory_variants", { inventoryItemId: id }, ma, 404); await mdenied("list_inventory_suppliers", { inventoryItemId: id }, ma, 404);
    }
    await denied(() => variants(req(), p("invalid")), 400); await denied(() => patchVariant(req({ name: "Bad" }), vp("invalid")), 400);
    for (const contactId of [foreignContact.id, deletedContact.id, customer.id]) {
      await denied(() => createSupplier(req({ contactId }), p()), 404);
      await mdenied("create_inventory_supplier", { inventoryItemId: own.id, contactId }, ma, 404);
    }
    for (const key of ["dk_invalid", keys.expired]) { await denied(() => variants(req({}, key), p()), 401); await denied(() => createSupplier(req({ contactId: supplier.id }, key), p()), 401); }
    for (const fn of [() => createVariant(req({ name: "Denied" }, keys.viewer), p()), () => patchVariant(req({ name: "Denied" }, keys.viewer), vp(v.id)),
      () => removeVariant(req({}, keys.viewer), vp(v.id)), () => createSupplier(req({ contactId: supplier.id }, keys.viewer), p()),
      () => patchSupplier(req({ isPreferred: true }, keys.viewer), sp(link.id)), () => removeSupplier(req({}, keys.viewer), sp(link.id))]) await denied(fn, 403);
    for (const [name, args] of [["create_inventory_variant", { name: "Denied" }], ["update_inventory_variant", { variantId: v.id }], ["delete_inventory_variant", { variantId: v.id }],
      ["create_inventory_supplier", { contactId: supplier.id }], ["update_inventory_supplier", { supplierId: link.id }], ["delete_inventory_supplier", { supplierId: link.id }]] as const)
      await mdenied(name, { inventoryItemId: own.id, ...args }, ro, 403);
    for (const itemId of [otherItem.id, foreign.id]) {
      await denied(() => patchVariant(req({ name: "Bad" }), vp(v.id, itemId)), 404); await denied(() => removeVariant(req(), vp(v.id, itemId)), 404);
      await denied(() => patchSupplier(req({ purchasePrice: 1 }), sp(link.id, itemId)), 404); await denied(() => removeSupplier(req(), sp(link.id, itemId)), 404);
    }
    await mdenied("update_inventory_variant", { inventoryItemId: own.id, variantId: v.id }, mb, 404);
    await mdenied("delete_inventory_supplier", { inventoryItemId: own.id, supplierId: link.id }, mb, 404);
    const managed = (await data(await createVariant(req({ name: "Manager" }, keys.manager), p()), 201)).inventoryVariant;
    await data(await removeVariant(req({}, keys.manager), vp(managed.id)));
    // Historical nullable prices remain null; unsafe bigint history is classified and cannot be masked by an unrelated patch.
    await db.update(inventoryVariant).set({ purchasePrice: null, salePrice: null, quantityOnHand: null }).where(eq(inventoryVariant.id, restExact.id));
    assert.equal((await data(await variants(req(), p()))).data.find((r: { id: string }) => r.id === restExact.id).purchasePriceMinor, null);
    await db.execute(sql`update inventory_variant set purchase_price=9007199254740992 where id=${v.id}`);
    await denied(() => variants(req(), p()), 422); await mdenied("list_inventory_variants", { inventoryItemId: own.id }, ma, 422);
    await denied(() => patchVariant(req({ name: "Mask" }), vp(v.id)), 422);
    await db.update(inventoryVariant).set({ purchasePrice: 5 }).where(eq(inventoryVariant.id, v.id));
    await db.execute(sql`update inventory_item_supplier set purchase_price=9007199254740992 where id=${link.id}`);
    await denied(() => suppliers(req(), p()), 422); await mdenied("list_inventory_suppliers", { inventoryItemId: own.id }, ma, 422);
    await denied(() => patchSupplier(req({ supplierCode: "Mask" }), sp(link.id)), 422);
    await db.update(inventoryItemSupplier).set({ purchasePrice: 3000000000 }).where(eq(inventoryItemSupplier.id, link.id));
    // Legacy bad links must not disclose another tenant's contact; unlink remains possible.
    const [badLink] = await db.insert(inventoryItemSupplier).values({ organizationId: a.id, inventoryItemId: own.id, contactId: foreignContact.id }).returning();
    const list = await data(await suppliers(req(), p())); assert.equal(JSON.stringify(list).includes("SECRET FOREIGN"), false); assert.equal(JSON.stringify(list).includes("secret@example.test"), false);
    assert.deepEqual((await ma.call("list_inventory_suppliers", { inventoryItemId: own.id })).body.data, list.data);
    await denied(() => patchSupplier(req({ supplierCode: "Bad" }), sp(badLink.id)), 404);
    await data(await removeSupplier(req(), sp(badLink.id)));
    // Soft-deleted owned supplier history is readable, but new writes need a live supplier.
    await db.update(contact).set({ deletedAt: new Date() }).where(eq(contact.id, both.id));
    assert.ok((await data(await suppliers(req(), p()))).data.some((r: { id: string }) => r.id === mlink.id));
    await denied(() => patchSupplier(req({ purchasePrice: 1 }), sp(mlink.id)), 404);
    await db.update(contact).set({ deletedAt: null }).where(eq(contact.id, both.id));
    // Race: parent lock + duplicate barrier permits one REST/MCP winner and one audit.
    const racing = await Promise.all([createSupplier(req({ contactId: supplier.id }), p(otherItem.id)), ma.call("create_inventory_supplier", { inventoryItemId: otherItem.id, contactId: supplier.id })]);
    assert.equal((racing[0].status === 201 ? 1 : 0) + (!racing[1].isError ? 1 : 0), 1);
    assert.ok(racing[0].status === 409 || racing[1].body.status === 409);
    const raceAudit = await db.execute(sql`select count(*)::int as n from audit_log where entity_type='inventory_item_supplier' and changes->>'inventoryItemId'=${otherItem.id}`);
    assert.equal(raceAudit.rows[0].n, 1);
    // All six writes roll back their catalog changes when transactional audit insertion fails.
    await db.update(contact).set({ deletedAt: null }).where(eq(contact.id, deletedContact.id));
    await db.execute(sql`create function fail_catalog_audit() returns trigger language plpgsql as $$ begin raise exception 'Synthetic catalog audit failure'; end $$`);
    await db.execute(sql`create trigger fail_catalog_audit before insert on audit_log for each row execute function fail_catalog_audit()`);
    for (const fn of [() => createInventoryVariant(ctx, own.id, { name: "Rollback" }), () => updateInventoryVariant(ctx, own.id, v.id, { name: "Rollback" }),
      () => deleteInventoryVariant(ctx, own.id, v.id), () => createInventorySupplier(ctx, own.id, { contactId: deletedContact.id }),
      () => updateInventorySupplier(ctx, own.id, link.id, { purchasePriceMinor: "0" }), () => deleteInventorySupplier(ctx, own.id, link.id)]) {
      const before = await snapshot();
      await assert.rejects(fn, (error: unknown) => {
        assert.match(String((error as { cause?: unknown }).cause), /Synthetic catalog audit failure/); return true;
      });
      assert.deepEqual(await snapshot(), before);
    }
    await db.execute(sql`drop trigger fail_catalog_audit on audit_log`); await db.execute(sql`drop function fail_catalog_audit()`);
    assert.equal((await ma.call("delete_inventory_variant", { inventoryItemId: own.id, variantId: exact.id })).body.success, true);
    await data(await removeVariant(req(), vp(v.id))); await denied(() => patchVariant(req({ name: "Deleted" }), vp(v.id)), 404);
    assert.equal((await ma.call("delete_inventory_supplier", { inventoryItemId: own.id, supplierId: mlink.id })).body.success, true);
    await data(await removeSupplier(req(), sp(link.id))); await denied(() => removeSupplier(req(), sp(link.id)), 404);
    assert.equal((await db.query.inventoryItem.findFirst({ where: eq(inventoryItem.id, own.id) }))!.quantityOnHand, 0);
    for (const table of ["journal_entry", "inventory_movement", "warehouse_stock", "inventory_cost_layer"]) {
      const result = await db.execute(sql.raw(`select count(*)::int as n from ${table}`)); assert.equal(result.rows[0].n, 0, table);
    }
    console.log("REST and MCP inventory catalog contracts verified");
  } finally { await Promise.all([ma.close(), mb.close(), ro.close()]); }
}
run().then(() => process.exit(0), error => { console.error(error); process.exit(1); });
