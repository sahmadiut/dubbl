import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { withDatabase, applyCurrent } from "./fixtures";

test("MON-025 integrated payroll REST/MCP writers, posting and historical outputs", async () => {
  await withDatabase(async (_pool, url) => {
    applyCurrent(url);
    const result = spawnSync(process.execPath, ["--import", "tsx", "tests/integration/payroll-integration-worker.ts"], {
      env: { ...process.env, DATABASE_URL: url, STRIPE_SECRET_KEY: "", RESEND_API_KEY: "", EMAIL_ENCRYPTION_KEY: "11".repeat(32) },
      encoding: "utf8", timeout: 180000,
    });
    assert.equal(result.status, 0, `Integrated payroll worker failed: ${result.stdout} ${result.stderr}`);
    assert.match(result.stdout, /Integrated payroll contracts verified/);
  });
});
