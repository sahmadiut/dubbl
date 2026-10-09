import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { withDatabase, applyCurrent } from "./fixtures";

test("MON-026 combined asset/loan REST/MCP lifecycles, currency history and writer coordination", async () => {
  await withDatabase(async (_pool, url) => {
    applyCurrent(url);
    const result = spawnSync(process.execPath, ["--import", "tsx", "tests/integration/asset-loan-integration-worker.ts"], {
      env: { ...process.env, DATABASE_URL: url, STRIPE_SECRET_KEY: "", RESEND_API_KEY: "", IRR_PRODUCTION_ENABLED: "false" }, encoding: "utf8", timeout: 180000,
    });
    assert.equal(result.status, 0, `Asset/loan integration worker failed: ${result.stdout} ${result.stderr}`);
    assert.match(result.stdout, /Asset\/loan integration verified/);
  });
});
