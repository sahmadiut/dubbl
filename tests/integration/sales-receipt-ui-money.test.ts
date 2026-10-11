import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { withDatabase, applyCurrent } from "./fixtures";

test("MON-145 receipt UI preview, saved reads and post/void via real REST/MCP/SQL", async () => {
  await withDatabase(async (_pool, url) => {
    applyCurrent(url);
    const result = spawnSync(process.execPath, ["--import", "tsx", "tests/integration/sales-receipt-ui-money-worker.ts"], {
      env: { ...process.env, DATABASE_URL: url, STRIPE_SECRET_KEY: "" }, encoding: "utf8", timeout: 90000,
    });
    assert.equal(result.status, 0, `Receipt UI worker failed: ${result.stdout} ${result.stderr}`);
    assert.match(result.stdout, /Receipt UI REST MCP SQL verified/);
  });
});
