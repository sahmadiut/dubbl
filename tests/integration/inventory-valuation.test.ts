import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { withDatabase, applyCurrent, historicalSchema } from "./fixtures";
test("MON-077 additive migration preserves historical FIFO quantities and costs without a backfill", async () => {
  await withDatabase(async (pool, url) => {
    await historicalSchema(pool, "0007_steady_scarlet_witch");
    const org = (await pool.query("insert into organization(name,slug) values('Historical','historical') returning id")).rows[0].id;
    const item = (await pool.query("insert into inventory_item(organization_id,code,name,cost_method,quantity_on_hand,total_value,average_cost) values($1,'H','Historical','fifo',3,87,29) returning id", [org])).rows[0].id;
    const layer = (await pool.query("insert into inventory_cost_layer(organization_id,inventory_item_id,original_quantity,remaining_quantity,unit_cost) values($1,$2,3,3,29) returning *", [org, item])).rows[0];
    applyCurrent(url);
    const saved = (await pool.query("select * from inventory_cost_layer where id=$1", [layer.id])).rows[0];
    assert.equal(saved.remaining_value, null);
    delete saved.remaining_value;
    assert.deepEqual(saved, layer);
  });
});
test("MON-077 landed cost REST/MCP, exact FIFO and valuation on migrated PostgreSQL", async () => {
  await withDatabase(async (_pool, url) => {
    applyCurrent(url);
    const result = spawnSync(process.execPath, ["--import", "tsx", "tests/integration/inventory-valuation-worker.ts"], {
      env: { ...process.env, DATABASE_URL: url, STRIPE_SECRET_KEY: "", RESEND_API_KEY: "" }, encoding: "utf8", timeout: 180000,
    });
    assert.equal(result.status, 0, `Valuation worker failed: ${result.stdout} ${result.stderr}`);
    assert.match(result.stdout, /Inventory valuation contracts verified/);
  });
});
