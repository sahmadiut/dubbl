import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { withDatabase, applyCurrent } from "./fixtures";

test("MON-022 configuration composes with approval, invoice tax, filing and settlement across REST/MCP", async () => {
  await withDatabase(async (_pool, url) => {
    applyCurrent(url);
    const result = spawnSync(process.execPath, ["--import", "tsx", "tests/integration/configuration-integration-worker.ts"], {
      env: { ...process.env, DATABASE_URL: url, STRIPE_SECRET_KEY: "", RESEND_API_KEY: "", IRR_PRODUCTION_ENABLED: "false" },
      encoding: "utf8", timeout: 90000,
    });
    assert.equal(result.status, 0, `Configuration integration failed: ${result.stdout} ${result.stderr}`);
    assert.match(result.stdout, /Combined configuration contracts verified/);
  });
});
