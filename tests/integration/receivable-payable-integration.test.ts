import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { withDatabase, applyCurrent } from "./fixtures";

test("MON-102 cash history reconciles aging, statements and performance through REST/MCP", async () => {
  await withDatabase(async (_pool, url) => {
    applyCurrent(url);
    const result = spawnSync(process.execPath, ["--import", "tsx", "tests/integration/receivable-payable-integration-worker.ts"], {
      env: { ...process.env, DATABASE_URL: url, STRIPE_SECRET_KEY: "", RESEND_API_KEY: "",
        EMAIL_ENCRYPTION_KEY: "11".repeat(32) },
      encoding: "utf8", timeout: 90000,
    });
    assert.equal(result.status, 0, `Receivable/payable integration failed: ${result.stdout} ${result.stderr}`);
    assert.match(result.stdout, /Combined receivable\/payable contracts verified/);
  });
});
