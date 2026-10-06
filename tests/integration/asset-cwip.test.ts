import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { withDatabase, applyCurrent } from "./fixtures";

test("MON-089 CWIP actual REST/MCP, exact accumulation/capitalization, scope, locks, replay and atomic failures", async () => {
  await withDatabase(async (_pool, url) => {
    applyCurrent(url);
    const result = spawnSync(process.execPath, ["--import", "tsx", "tests/integration/asset-cwip-worker.ts"], {
      env: { ...process.env, DATABASE_URL: url, STRIPE_SECRET_KEY: "", RESEND_API_KEY: "" }, encoding: "utf8", timeout: 180000,
    });
    assert.equal(result.status, 0, `CWIP worker failed: ${result.stdout} ${result.stderr}`);
    assert.match(result.stdout, /Asset CWIP contracts verified/);
  });
});
