import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { withDatabase, applyCurrent } from "./fixtures";

test("MON-070 organization REST/MCP contracts on migrated PostgreSQL", async () => {
  await withDatabase(async (_pool, url) => {
    applyCurrent(url);
    const result = spawnSync(process.execPath, ["--import", "tsx", "--import", "./tests/integration/organization-session-hook.mjs", "tests/integration/organization-settings-worker.ts"], {
      env: { ...process.env, DATABASE_URL: url, STRIPE_SECRET_KEY: "", RESEND_API_KEY: "", IRR_PRODUCTION_ENABLED: "false" },
      encoding: "utf8", timeout: 90000,
    });
    assert.equal(result.status, 0, `Organization worker failed: ${result.stdout} ${result.stderr}`);
    assert.match(result.stdout, /REST and MCP organization settings verified/);
  });
});
