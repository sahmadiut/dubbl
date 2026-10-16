import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { applyCurrent, withDatabase } from "./fixtures";

test("MON-158 statements, auxiliary reports and contact/dashboard consumers reconcile one saved history", async () => {
  await withDatabase(async (_pool, url) => {
    applyCurrent(url);
    const result = spawnSync(process.execPath, ["--import", "tsx", "tests/integration/report-contact-cutover-acceptance-worker.ts"], {
      env: { ...process.env, DATABASE_URL: url, IRR_PRODUCTION_ENABLED: "false", STRIPE_SECRET_KEY: "", RESEND_API_KEY: "" },
      encoding: "utf8", timeout: 180000,
    });
    assert.equal(result.status, 0, `Report/contact acceptance failed: ${result.stdout} ${result.stderr}`);
    assert.match(result.stdout, /Report contact dashboard parent REST MCP SQL acceptance verified/);
  });
});
