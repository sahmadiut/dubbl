import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { withDatabase, applyCurrent } from "./fixtures";

test("MON-122 actual schedule REST/MCP and recorded delivery on migrated PostgreSQL", async () => {
  await withDatabase(async (_pool, url) => {
    applyCurrent(url);
    const result = spawnSync(process.execPath, ["--import", "tsx", "tests/integration/report-schedules-worker.ts"], {
      env: { ...process.env, DATABASE_URL: url, STRIPE_SECRET_KEY: "", RESEND_API_KEY: "", EMAIL_ENCRYPTION_KEY: "11".repeat(32) }, encoding: "utf8", timeout: 120000,
    });
    assert.equal(result.status, 0, `Schedule worker failed: ${result.stdout} ${result.stderr}`);
    assert.match(result.stdout, /REST and MCP report schedule contracts verified/);
  });
});
