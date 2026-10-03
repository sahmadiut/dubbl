import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { withDatabase, applyCurrent } from "./fixtures";

test("MON-056 actual payment settlement REST/MCP on migrated PostgreSQL", async () => {
  await withDatabase(async (_pool, url) => {
    applyCurrent(url);
    const result = spawnSync(process.execPath, ["--import", "tsx", "tests/integration/payment-settlements-worker.ts"], {
      env: { ...process.env, DATABASE_URL: url, STRIPE_SECRET_KEY: "" }, encoding: "utf8", timeout: 120000,
    });
    assert.equal(result.status, 0, `Settlement worker failed: ${result.stdout} ${result.stderr}`);
    assert.match(result.stdout, /REST and MCP payment settlements verified/);
  });
});
