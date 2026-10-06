import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { withDatabase, applyCurrent } from "./fixtures";

test("MON-085 payroll reports/payslips/tax/self-service actual REST/MCP on PostgreSQL", async () => {
  await withDatabase(async (_pool, url) => {
    applyCurrent(url);
    const result = spawnSync(process.execPath, ["--import", "tsx", "tests/integration/payroll-outputs-worker.ts"], {
      env: { ...process.env, DATABASE_URL: url, STRIPE_SECRET_KEY: "", RESEND_API_KEY: "" }, encoding: "utf8", timeout: 240000,
    });
    assert.equal(result.status, 0, `Payroll output worker failed: ${result.stdout} ${result.stderr}`);
    assert.match(result.stdout, /Payroll output contracts verified/);
  });
});
