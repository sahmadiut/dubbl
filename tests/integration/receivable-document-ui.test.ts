import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { applyCurrent, withDatabase } from "./fixtures";

test("MON-131 all receivable invoice origins compose with saved UI and settlement via REST/MCP/SQL", async () => {
  await withDatabase(async (_pool, url) => {
    applyCurrent(url);
    const result = spawnSync(process.execPath, ["--import", "tsx", "tests/integration/receivable-document-ui-worker.ts"], {
      env: { ...process.env, DATABASE_URL: url, STRIPE_SECRET_KEY: "", RESEND_API_KEY: "", EMAIL_ENCRYPTION_KEY: "" },
      encoding: "utf8", timeout: 120000,
    });
    assert.equal(result.status, 0, `Receivable document UI integration failed: ${result.stdout} ${result.stderr}`);
    assert.match(result.stdout, /Receivable document UI REST MCP SQL verified: 24 workflows/);
  });
});
