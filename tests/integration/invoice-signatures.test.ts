import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { applyCurrent, withDatabase } from "./fixtures";

test("MON-126 actual signing REST/SSR/MCP contracts preserve money, scope and signed history", async () => {
  await withDatabase(async (_pool, url) => {
    applyCurrent(url);
    const result = spawnSync(process.execPath, ["--experimental-test-module-mocks", "--import", "tsx", "tests/integration/invoice-signatures-worker.ts"], {
      env: { ...process.env, DATABASE_URL: url, STRIPE_SECRET_KEY: "", RESEND_API_KEY: "", IRR_PRODUCTION_ENABLED: "false" },
      encoding: "utf8", timeout: 120000,
    });
    assert.equal(result.status, 0, `Invoice signing fixture failed: ${result.stdout} ${result.stderr}`);
    assert.match(result.stdout, /Invoice signing contracts verified/);
  });
});
