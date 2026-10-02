import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { withDatabase, applyCurrent } from "./fixtures";

test("MON-035 actual REST and registered MCP journal CRUD on migrated PostgreSQL", async () => {
  await withDatabase(async (_pool, url) => {
    applyCurrent(url);
    const result = spawnSync(process.execPath, ["--import", "tsx", "tests/integration/journal-wire-worker.ts"], {
      env: { ...process.env, DATABASE_URL: url, STRIPE_SECRET_KEY: "" }, encoding: "utf8", timeout: 60000,
    });
    assert.equal(result.status, 0, `Journal worker failed: ${result.stdout} ${result.stderr}`);
    assert.match(result.stdout, /REST and MCP journal CRUD verified/);
  });
});
