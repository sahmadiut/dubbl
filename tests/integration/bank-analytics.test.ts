import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { withDatabase, applyCurrent } from "./fixtures";

test("MON-117 actual bank analytics REST/MCP on migrated PostgreSQL", async () => {
  await withDatabase(async (_pool, url) => {
    applyCurrent(url);
    const result = spawnSync(process.execPath, ["--import", "tsx", "tests/integration/bank-analytics-worker.ts"], {
      env: { ...process.env, DATABASE_URL: url, STRIPE_SECRET_KEY: "", RESEND_API_KEY: "", TZ: "Asia/Tehran" }, encoding: "utf8", timeout: 90000,
    });
    assert.equal(result.status, 0, `Bank analytics worker failed: ${result.stdout} ${result.stderr}`);
    assert.match(result.stdout, /REST and MCP bank analytics verified/);
  });
});
