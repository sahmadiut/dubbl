import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { applyCurrent, withDatabase } from "./fixtures";

test("AI-039 polling worker REST/MCP/SQL, fair claims, heartbeats, shutdown and process recovery", async () => {
  await withDatabase(async (_pool, url) => {
    applyCurrent(url);
    const result = spawnSync(process.execPath, ["--experimental-test-module-mocks", "--import", "tsx", "tests/integration/ai-worker-fixture.ts"], {
      env: { ...process.env, DATABASE_URL: url, AI_RUNTIME_ENABLED: "true", AI_PROVIDER_CALLS_ENABLED: "false" },
      encoding: "utf8", timeout: 180000, windowsHide: true,
    });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /AI-039 polling REST\/MCP\/SQL and process lifecycle verified/);
  });
});
