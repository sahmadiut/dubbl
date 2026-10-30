import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { applyCurrent, withDatabase } from "./fixtures";

test("AI-049 exact approval consumption: real decisions, SQL fences, receipts and restart", async () => {
  await withDatabase(async (_pool, url) => {
    applyCurrent(url);
    const result = spawnSync(process.execPath, ["--experimental-test-module-mocks", "--import", "tsx", "tests/integration/ai-action-consumption-worker.ts"], {
      env: { ...process.env, DATABASE_URL: url, STRIPE_SECRET_KEY: "", AI_RUNTIME_ENABLED: "true", AI_PROVIDER_CALLS_ENABLED: "false" },
      encoding: "utf8", timeout: 120000,
    });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /AI consumption decisions\/SQL\/restart verified/);
  });
});
