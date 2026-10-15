import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { applyCurrent, withDatabase } from "./fixtures";

test("MON-159 background services compose on one tenant without repricing or duplicate history", async () => {
  await withDatabase(async (_pool, url) => {
    applyCurrent(url);
    const result = spawnSync(process.execPath, ["--import", "tsx", "tests/integration/background-cutover-acceptance-worker.ts"], {
      env: { ...process.env, DATABASE_URL: url, IRR_PRODUCTION_ENABLED: "false", STRIPE_SECRET_KEY: "", RESEND_API_KEY: "" },
      encoding: "utf8", timeout: 120000,
    });
    assert.equal(result.status, 0, `Background acceptance failed: ${result.stdout} ${result.stderr}`);
    assert.match(result.stdout, /Background parent REST MCP SQL acceptance verified/);
  });
});
