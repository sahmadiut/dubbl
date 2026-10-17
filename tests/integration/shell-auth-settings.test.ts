import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { applyCurrent, withDatabase } from "./fixtures";

test("LOC-006 locale, team UI requests and notifications compose through authenticated REST/MCP and SQL", async () => {
  await withDatabase(async (_pool, url) => {
    applyCurrent(url);
    const result = spawnSync(process.execPath, ["--import", "tsx", "tests/integration/shell-auth-settings-worker.ts"], {
      env: { ...process.env, DATABASE_URL: url, STRIPE_SECRET_KEY: "", RESEND_API_KEY: "", IRR_PRODUCTION_ENABLED: "false" },
      encoding: "utf8", timeout: 120000,
    });
    assert.equal(result.status, 0, `LOC-006 fixture failed: ${result.stdout} ${result.stderr}`);
    assert.match(result.stdout, /Shell auth settings REST\/MCP\/SQL verified/);
  });
});
