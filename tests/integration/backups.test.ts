import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { withDatabase, applyCurrent } from "./fixtures";

test("MON-032 actual backup REST/MCP, immutable storage and atomic restore on PostgreSQL", async () => {
  for (const timezone of ["UTC", "Asia/Tehran"]) await withDatabase(async (_pool, url) => {
    applyCurrent(url);
    const result = spawnSync(process.execPath, ["--import", "tsx", "--import", "./tests/integration/organization-session-hook.mjs", "tests/integration/backups-worker.ts"], {
      env: { ...process.env, TZ: timezone, DATABASE_URL: url, STRIPE_SECRET_KEY: "", RESEND_API_KEY: "", S3_ACCESS_KEY_ID: "synthetic", S3_SECRET_ACCESS_KEY: "synthetic" },
      encoding: "utf8", timeout: 120000,
    });
    assert.equal(result.status, 0, `Backup worker failed: ${result.stdout} ${result.stderr}`);
    assert.match(result.stdout, /REST and MCP backup contracts verified/);
  });
});
