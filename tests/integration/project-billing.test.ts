import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { withDatabase, applyCurrent } from "./fixtures";
test("MON-094 actual project billing REST/MCP exact, scope, retry and rollback contracts", async () => {
  await withDatabase(async (_pool, url) => {
    applyCurrent(url);
    const r = spawnSync(process.execPath, ["--import", "tsx", "tests/integration/project-billing-worker.ts"], {
      env: { ...process.env, DATABASE_URL: url, STRIPE_SECRET_KEY: "", RESEND_API_KEY: "" }, encoding: "utf8", timeout: 180000,
    });
    assert.equal(r.status, 0, `Billing worker failed: ${r.stdout} ${r.stderr}`);
    assert.match(r.stdout, /Project billing contracts verified/);
  });
});
