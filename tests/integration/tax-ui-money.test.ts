import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { withDatabase, applyCurrent } from "./fixtures";

test("MON-151 tax UI adapters agree with actual REST MCP and SQL across currency scales", async () => {
  await withDatabase(async (_pool, url) => {
    applyCurrent(url);
    const result = spawnSync(process.execPath, ["--import", "tsx", "tests/integration/tax-ui-money-worker.ts"], {
      env: { ...process.env, DATABASE_URL: url, STRIPE_SECRET_KEY: "", RESEND_API_KEY: "", IRR_PRODUCTION_ENABLED: "false" },
      encoding: "utf8", timeout: 90000,
    });
    assert.equal(result.status, 0, `Tax UI worker failed: ${result.stdout} ${result.stderr}`);
    assert.match(result.stdout, /Tax UI REST MCP SQL verified/);
  });
});
