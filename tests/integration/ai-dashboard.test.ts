import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { applyCurrent, withDatabase } from "./fixtures";

test("AI-059 browser controller uses scoped REST reports, exports, quota and confirmed operations", async () => {
  await withDatabase(async (_pool, url) => {
    applyCurrent(url);
    const result = spawnSync(process.execPath, ["--experimental-test-module-mocks", "--import", "tsx", "tests/integration/ai-dashboard-worker.ts"], { env: { ...process.env, DATABASE_URL: url, AI_PROVIDER_CALLS_ENABLED: "false", STRIPE_SECRET_KEY: "" }, encoding: "utf8", timeout: 120000 });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /AI dashboard controller REST\/SQL verified/);
  });
});
