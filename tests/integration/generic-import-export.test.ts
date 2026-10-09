import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { applyCurrent, withDatabase } from "./fixtures";

test("MON-033 generic REST/MCP imports and exports preserve exact units and tenant boundaries", async () => {
  await withDatabase(async (_pool, url) => {
    applyCurrent(url);
    const result = spawnSync(process.execPath, ["--import", "tsx", "tests/integration/generic-import-export-worker.ts"], {
      env: { ...process.env, DATABASE_URL: url, STRIPE_SECRET_KEY: "", RESEND_API_KEY: "", IRR_PRODUCTION_ENABLED: "false" },
      encoding: "utf8", timeout: 180000,
    });
    assert.equal(result.status, 0, `Generic import/export fixture failed: ${result.stdout} ${result.stderr}`);
    assert.match(result.stdout, /Generic import\/export contracts verified/);
  });
});
