import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { withDatabase, applyCurrent } from "./fixtures";

test("MON-139 saved bill UI agrees with authenticated REST, registered MCP and SQL", async () => {
  await withDatabase(async (_pool, url) => {
    applyCurrent(url);
    const result = spawnSync(process.execPath, ["--import", "tsx", "tests/integration/bill-ui-money-worker.ts"], {
      env: { ...process.env, DATABASE_URL: url, STRIPE_SECRET_KEY: "", RESEND_API_KEY: "" }, encoding: "utf8", timeout: 90000,
    });
    assert.equal(result.status, 0, `Bill UI worker failed: ${result.stdout} ${result.stderr}`);
    assert.match(result.stdout, /Saved bill UI SQL verified/);
  });
});
