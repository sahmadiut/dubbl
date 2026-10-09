import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { applyCurrent, withDatabase } from "./fixtures";

test("MON-015 auxiliary domains share exact contracts, scope and report consumers", async () => {
  await withDatabase(async (_pool, url) => {
    applyCurrent(url);
    const result = spawnSync(process.execPath, ["--import", "tsx", "tests/integration/auxiliary-report-integration-worker.ts"], {
      env: { ...process.env, DATABASE_URL: url, STRIPE_SECRET_KEY: "", RESEND_API_KEY: "", IRR_PRODUCTION_ENABLED: "false" },
      encoding: "utf8", timeout: 180000,
    });
    assert.equal(result.status, 0, `Auxiliary/report integration failed: ${result.stdout} ${result.stderr}`);
    assert.match(result.stdout, /Combined auxiliary report contracts verified/);
  });
});
