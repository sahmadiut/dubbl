import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { withDatabase, applyCurrent } from "./fixtures";

test("MON-038 actual invoice REST/MCP read contracts on migrated PostgreSQL", async () => {
  await withDatabase(async (_pool, url) => {
    applyCurrent(url);
    const result = spawnSync(process.execPath, ["--import", "tsx", "tests/integration/invoice-reads-worker.ts"], {
      env: { ...process.env, DATABASE_URL: url, STRIPE_SECRET_KEY: "" }, encoding: "utf8", timeout: 90000,
    });
    assert.equal(result.status, 0, `Invoice read worker failed: ${result.stdout} ${result.stderr}`);
    assert.match(result.stdout, /REST and MCP invoice reads verified/);
  });
});
