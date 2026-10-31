import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { applyCurrent, withDatabase } from "./fixtures";

test("AI-051 explicit REST/MCP resume runs exact approved worker batches without replay", async () => {
  await withDatabase(async (_pool, url) => {
    applyCurrent(url);
    const result = spawnSync(process.execPath, ["--experimental-test-module-mocks", "--import", "tsx", "tests/integration/ai-approved-worker-fixture.ts"], {
      env: { ...process.env, DATABASE_URL: url, STRIPE_SECRET_KEY: "", AI_RUNTIME_ENABLED: "true", AI_PROVIDER_CALLS_ENABLED: "false" },
      encoding: "utf8", timeout: 180000, windowsHide: true,
    });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /Approved resume REST\/MCP\/worker\/SQL\/restart verified/);
  });
});
