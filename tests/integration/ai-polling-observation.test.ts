import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { applyCurrent, withDatabase } from "./fixtures";

test("AI-036 combined polling, clarification, process recovery and observation REST/MCP/SQL", async () => {
  await withDatabase(async (_pool, url) => {
    applyCurrent(url);
    const result = spawnSync(process.execPath, ["--experimental-test-module-mocks", "--import", "tsx", "tests/integration/ai-polling-observation-worker.ts"], {
      env: { ...process.env, DATABASE_URL: url, AI_RUNTIME_ENABLED: "true", AI_PROVIDER_CALLS_ENABLED: "false" },
      encoding: "utf8", timeout: 120000, windowsHide: true,
    });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /AI-036 combined polling and observation acceptance verified/);
  });
});
