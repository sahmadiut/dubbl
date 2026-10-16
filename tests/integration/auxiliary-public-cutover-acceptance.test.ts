import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { applyCurrent, withDatabase } from "./fixtures";

test("MON-008 background, reports, public UI, rendering and export reconcile saved money", async () => {
  await withDatabase(async (_pool, url) => {
    applyCurrent(url);
    const result = spawnSync(process.execPath, ["--import", "tsx", "tests/integration/auxiliary-public-cutover-acceptance-worker.ts"], {
      env: { ...process.env, DATABASE_URL: url, IRR_PRODUCTION_ENABLED: "false", STRIPE_SECRET_KEY: "", RESEND_API_KEY: "" },
      encoding: "utf8", timeout: 240000,
    });
    assert.equal(result.status, 0, `Auxiliary/public acceptance failed: ${result.stdout} ${result.stderr}`);
    assert.match(result.stdout, /Auxiliary public parent REST MCP UI SQL acceptance verified/);
  });
});
