import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { withDatabase, applyCurrent } from "./fixtures";

test("account REST/MCP currency defaults and optional localized identities", async () => {
  await withDatabase(async (_pool, url) => {
    applyCurrent(url);
    const result = spawnSync(process.execPath, ["--import", "tsx", "tests/integration/account-currency-defaults-worker.ts"], {
      env: { ...process.env, DATABASE_URL: url, NODE_ENV: "test", IRR_TESTING_ENABLED: "true", STRIPE_SECRET_KEY: "", RESEND_API_KEY: "" },
      encoding: "utf8", timeout: 120000,
    });
    assert.equal(result.status, 0, `Account worker failed: ${result.stdout} ${result.stderr}`);
    assert.match(result.stdout, /Account defaults and localized identities verified/);
  });
});
