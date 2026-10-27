import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { applyCurrent, withDatabase } from "./fixtures";

test("AI-002 live credential identity and REST/MCP authorization", async () => {
  await withDatabase(async (_pool, url) => {
    applyCurrent(url);
    const r = spawnSync(process.execPath, ["--experimental-test-module-mocks", "--import", "tsx", "tests/integration/execution-identity-worker.ts"], {
      env: { ...process.env, DATABASE_URL: url, STRIPE_SECRET_KEY: "", IRR_PRODUCTION_ENABLED: "false" },
      encoding: "utf8", timeout: 120000,
    });
    assert.equal(r.status, 0, `Execution identity fixture failed: ${r.stdout} ${r.stderr}`);
    assert.match(r.stdout, /Live identity REST\/MCP\/SQL verified/);
  });
});
