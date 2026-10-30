import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { applyCurrent, withDatabase } from "./fixtures";

test("AI-007/023/033/031 raw-adapter dependent journey, clarification, metering and recovery", async () => {
  await withDatabase(async (_pool, url) => {
    applyCurrent(url);
    const result = spawnSync(process.execPath, ["--experimental-test-module-mocks", "--import", "tsx", "tests/integration/ai-runtime-acceptance-worker.ts"], {
      env: { ...process.env, DATABASE_URL: url, AI_RUNTIME_ENABLED: "true", AI_PROVIDER_CALLS_ENABLED: "false" },
      encoding: "utf8", timeout: 120000, windowsHide: true,
    });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /AI-033 raw-adapter polling acceptance verified/);
    assert.match(result.stdout, /AI-031 delayed-response stop and stricter-budget acceptance verified/);
    assert.match(result.stdout, /AI-023 cross-transport clarification acknowledgement and read-only reconnect verified/);
    assert.match(result.stdout, /AI-007 discovery, clarification, dependent draft and grounded reconnect acceptance verified/);
  });
});
