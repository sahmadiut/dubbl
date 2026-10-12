import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { applyCurrent, withDatabase } from "./fixtures";

test("MON-129 core editors compose receivable/payable cash and manual GL via REST/MCP/SQL", async () => {
  await withDatabase(async (_pool, url) => {
    applyCurrent(url);
    const result = spawnSync(process.execPath, ["--import", "tsx", "tests/integration/core-editor-integration-worker.ts"], {
      env: { ...process.env, DATABASE_URL: url, IRR_PRODUCTION_ENABLED: "false", STRIPE_SECRET_KEY: "", RESEND_API_KEY: "", EMAIL_ENCRYPTION_KEY: "" },
      encoding: "utf8", timeout: 120000,
    });
    assert.equal(result.status, 0, `Core editor integration failed: ${result.stdout} ${result.stderr}`);
    assert.match(result.stdout, /Combined core editors REST MCP SQL verified: 8 workflows/);
  });
});
