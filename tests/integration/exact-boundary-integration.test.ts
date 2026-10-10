import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { applyCurrent, withDatabase } from "./fixtures";

test("MON-012 FX, core, reporting and public contracts preserve one economic event", async () => {
  await withDatabase(async (_pool, url) => {
    applyCurrent(url);
    const result = spawnSync(process.execPath, ["--import", "tsx", "tests/integration/exact-boundary-integration-worker.ts"], {
      env: { ...process.env, DATABASE_URL: url, STRIPE_SECRET_KEY: "", RESEND_API_KEY: "", TRIGGER_SECRET_KEY: "",
        IRR_PRODUCTION_ENABLED: "false", NEXT_PUBLIC_APP_URL: "https://fixture.test" },
      encoding: "utf8", timeout: 180000,
    });
    assert.equal(result.status, 0, `Exact boundary integration failed: ${result.stdout} ${result.stderr}`);
    assert.match(result.stdout, /Combined exact boundary contracts verified/);
  });
});
