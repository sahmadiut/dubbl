import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey } from "../../lib/db/schema";
import { POST as create } from "../../app/api/v1/inventory/route";
import { GET as read } from "../../app/api/v1/inventory/[id]/route";
import { POST as adjust } from "../../app/api/v1/inventory/[id]/adjust/route";
import { registerInventoryMasterTools } from "../../lib/mcp/tools/inventory-master";
import { registerInventoryMovementTools } from "../../lib/mcp/tools/inventory-movements";
import { inventoryDetailMoney, inventoryWriteDown } from "../../lib/money/inventory-detail-ui";
import { inventoryItemRow } from "../../i18n/inventory-item-presentation";

async function run() {
  const [owner] = await db.insert(users).values({ email: "inventory-ui@example.test" }).returning();
  let workflows = 0;
  for (const currency of ["USD", "JPY", "KWD"]) for (const transport of ["rest", "mcp"]) {
    const [org] = await db.insert(organization).values({ name: `Inventory UI ${currency} ${transport}`, slug: `inventory-ui-${currency}-${transport}`, defaultCurrency: currency }).returning();
    await db.insert(member).values({ organizationId: org.id, userId: owner.id, role: "owner" });
    const key = `dk_inventory_ui_${currency}_${transport}`;
    await db.insert(apiKey).values({ organizationId: org.id, createdBy: owner.id, name: "Fixture", keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_inventory_ui" });
    const server = new McpServer({ name: "Inventory UI", version: "1" });
    const ctx = { organizationId: org.id, userId: owner.id, role: "owner" as const };
    registerInventoryMasterTools(server, ctx); registerInventoryMovementTools(server, ctx);
    const client = new Client({ name: "Fixture", version: "1" });
    const [ct, st] = InMemoryTransport.createLinkedPair();
    await server.connect(st); await client.connect(ct);
    const req = (body?: unknown) => new Request("http://fixture.test/api/v1/inventory", {
      method: body === undefined ? "GET" : "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const params = (id: string) => ({ params: Promise.resolve({ id }) });
    const data = async (response: Response, status = 200) => {
      const value = await response.json(); assert.equal(response.status, status, JSON.stringify(value));
      if (status < 300 && value.inventoryItem) inventoryItemRow(value.inventoryItem);
      return value;
    };
    const call = async (name: string, args: Record<string, unknown>) => {
      const result = await client.callTool({ name, arguments: args });
      const value = JSON.parse((result.content as { text: string }[])[0].text);
      assert.ok(!result.isError, JSON.stringify(value));
      if (value.inventoryItem) inventoryItemRow(value.inventoryItem);
      return value;
    };
    try {
      const payload = { code: "LOW", name: "Low digits", quantityOnHand: 3, purchasePriceMinor: "3000000001", salePriceMinor: "3000000002" };
      const created = transport === "rest" ? await data(await create(req(payload)), 201) : await call("create_inventory_item", payload);
      const id = created.inventoryItem.id;
      assert.equal(inventoryDetailMoney(created.inventoryItem).carrying, 9000000003n);
      const preview = inventoryWriteDown("30000000.01", inventoryDetailMoney(created.inventoryItem).carrying);
      const result = transport === "rest"
        ? await data(await adjust(req({ adjustmentType: "write_down", valueDeltaMinor: preview.valueDeltaMinor, reason: "Damage" }), params(id)))
        : await call("adjust_inventory_stock", { inventoryItemId: id, kind: "write_down", amountMinor: preview.valueDeltaMinor, reason: "Damage" });
      assert.equal(result.valueDeltaMinor, "-3000000001");
      assert.equal(inventoryDetailMoney(result.inventoryItem).carrying, preview.remaining);
      assert.equal(inventoryDetailMoney(result.inventoryItem).priceValue, 9000000003n);
      const rest = await data(await read(req(), params(id)));
      const mcp = await call("get_inventory_item", { inventoryItemId: id });
      assert.deepEqual(inventoryDetailMoney(rest.inventoryItem), inventoryDetailMoney(mcp.inventoryItem));
      assert.equal(rest.inventoryItem.quantityOnHand, 3);
      const rows = await db.execute(sql`select total_value::text as value, purchase_price::text as price, average_cost::text as average from inventory_item where id=${id}`);
      assert.deepEqual(rows.rows, [{ value: "6000000002", price: "3000000001", average: "2000000001" }]);
      const legs = await db.execute(sql`select debit_amount::text as debit, credit_amount::text as credit, currency_code as currency from journal_line where journal_entry_id=${result.journalEntryId} order by debit_amount desc`);
      assert.deepEqual(legs.rows, [{ debit: "3000000001", credit: "0", currency }, { debit: "0", credit: "3000000001", currency }]);
      const tables = ["inventory_item", "inventory_movement", "inventory_cost_layer", "inventory_layer_consumption", "chart_account", "journal_entry", "journal_line", "audit_log"];
      const snapshot = async () => Promise.all(tables.map(table => db.execute(sql.raw(`select coalesce(jsonb_agg(to_jsonb(t)::text order by t.id),'[]'::jsonb) as rows from ${table} t`)).then(r => r.rows)));
      const before = await snapshot();
      await data(await adjust(req({ adjustmentType: "write_down", valueDeltaMinor: "6000000003", reason: "Excessive" }), params(id)), 400);
      await data(await adjust(req({ adjustmentType: "write_down", valueDeltaMinor: "1", valueDelta: 2, reason: "Conflict" }), params(id)), 400);
      assert.deepEqual(await snapshot(), before);
      // Consume the final carrying value through the opposite transport: same
      // cents input despite organization ledger scale; price value stays distinct.
      const final = inventoryWriteDown("60000000.02", preview.remaining);
      const zero = transport === "rest"
        ? await call("adjust_inventory_stock", { inventoryItemId: id, kind: "write_down", amountMinor: final.valueDeltaMinor, reason: "Final" })
        : await data(await adjust(req({ adjustmentType: "write_down", valueDeltaMinor: final.valueDeltaMinor, reason: "Final" }), params(id)));
      assert.equal(inventoryDetailMoney(zero.inventoryItem).carrying, 0n);
      assert.equal(inventoryDetailMoney(zero.inventoryItem).priceValue, 9000000003n);
      const unbalanced = await db.execute(sql`select e.id from journal_entry e join journal_line l on l.journal_entry_id=e.id where e.organization_id=${org.id} group by e.id having sum(l.debit_amount)<>sum(l.credit_amount)`);
      assert.equal(unbalanced.rows.length, 0);
      workflows++;
    } finally { await client.close(); await server.close(); }
  }
  console.log(`Inventory detail UI REST MCP SQL verified: ${workflows} workflows`);
}
run().then(() => process.exit(0), error => { console.error(error); process.exit(1); });
