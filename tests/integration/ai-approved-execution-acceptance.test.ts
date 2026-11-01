import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { applyCurrent, withDatabase } from "./fixtures";

test("AI-044 combined approved execution fences, prerequisite integrity and late authority loss", async () => {
  await withDatabase(async (_pool, url) => {
    applyCurrent(url);
    // Reuse the real transport/domain fixture setup; execute separate parent
    // acceptance scenarios rather than treating child completion as acceptance.
    const result = spawnSync(process.execPath, ["--experimental-test-module-mocks", "--import", "tsx", "tests/integration/ai-approved-worker-fixture.ts"], {
      env: { ...process.env, DATABASE_URL: url, STRIPE_SECRET_KEY: "", AI_RUNTIME_ENABLED: "true", AI_PROVIDER_CALLS_ENABLED: "false", AI044_ACCEPTANCE: "true" },
      encoding: "utf8", timeout: 180000, windowsHide: true,
    });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /AI-044 combined execution acceptance verified/);
  });
});
