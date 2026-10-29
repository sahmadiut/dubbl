import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { applyCurrent, historicalSchema, withDatabase } from "./fixtures";

test("AI-037 migration upgrades the preceding schema and is idempotent", async () => {
  await withDatabase(async (pool, url) => {
    await historicalSchema(pool, "0022_outstanding_prima");
    applyCurrent(url); applyCurrent(url);
    const { rows } = await pool.query("select conname from pg_constraint where conname in ('ai_provider_attempt_usage_scope','ai_provider_call_attempt_scope','ai_usage_attempt_run_scope') order by conname");
    assert.deepEqual(rows.map(row => row.conname), ["ai_provider_attempt_usage_scope", "ai_provider_call_attempt_scope", "ai_usage_attempt_run_scope"]);
  });
});

test("AI-037 metered fenced provider attempts, REST/MCP, races and process recovery", async () => {
  await withDatabase(async (_pool, url) => {
    applyCurrent(url);
    const result = spawnSync(process.execPath, ["--experimental-test-module-mocks", "--import", "tsx", "tests/integration/ai-provider-attempts-worker.ts"], {
      env: { ...process.env, DATABASE_URL: url, AI_RUNTIME_ENABLED: "true", AI_PROVIDER_CALLS_ENABLED: "false" },
      encoding: "utf8", timeout: 180000, windowsHide: true,
    });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /Fenced provider attempts REST\/MCP\/SQL verified/);
  });
});
