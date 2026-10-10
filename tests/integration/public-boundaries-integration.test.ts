import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { applyCurrent, withDatabase } from "./fixtures";

test("MON-016 import, restore, public tokens, signing, rendering and signed payment preserve one contract", async () => {
  await withDatabase(async (_pool, url) => {
    applyCurrent(url);
    const result = spawnSync(process.execPath, ["--import", "tsx", "tests/integration/public-boundaries-integration-worker.ts"], {
      env: { ...process.env, DATABASE_URL: url, STRIPE_SECRET_KEY: "sk_test_fixture", STRIPE_WEBHOOK_SECRET: "whsec_fixture",
        NEXT_PUBLIC_APP_URL: "https://fixture.test", RESEND_API_KEY: "", TRIGGER_SECRET_KEY: "",
        S3_ACCESS_KEY_ID: "synthetic", S3_SECRET_ACCESS_KEY: "synthetic", IRR_PRODUCTION_ENABLED: "false" },
      encoding: "utf8", timeout: 180000,
    });
    assert.equal(result.status, 0, `Public boundary integration failed: ${result.stdout} ${result.stderr}`);
    assert.match(result.stdout, /Combined public boundary contracts verified/);
  });
});
