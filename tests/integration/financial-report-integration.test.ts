import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { withDatabase, applyCurrent } from "./fixtures";

test("MON-101 posted legacy/exact journals reconcile across REST/MCP financial reports", async () => {
  await withDatabase(async (_pool, url) => {
    applyCurrent(url);
    const result = spawnSync(process.execPath, ["--import", "tsx", "tests/integration/financial-report-integration-worker.ts"], {
      env: { ...process.env, DATABASE_URL: url, STRIPE_SECRET_KEY: "", RESEND_API_KEY: "" },
      encoding: "utf8", timeout: 90000,
    });
    assert.equal(result.status, 0, `Financial report integration failed: ${result.stdout} ${result.stderr}`);
    assert.match(result.stdout, /Combined financial report contracts verified/);
  });
});
