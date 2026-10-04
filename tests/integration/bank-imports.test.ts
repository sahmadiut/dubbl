import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { withDatabase, applyCurrent } from "./fixtures";

test("MON-064 bank import REST/MCP contracts on migrated PostgreSQL", async () => {
  await withDatabase(async (_pool, url) => {
    applyCurrent(url);
    const result = spawnSync(process.execPath, ["--import", "tsx", "tests/integration/bank-imports-worker.ts"], {
      env: { ...process.env, DATABASE_URL: url, STRIPE_SECRET_KEY: "", RESEND_API_KEY: "" }, encoding: "utf8", timeout: 120000,
    });
    assert.equal(result.status, 0, `Bank import worker failed: ${result.stdout} ${result.stderr}`);
    assert.match(result.stdout, /REST and MCP bank imports verified/);
  });
});
