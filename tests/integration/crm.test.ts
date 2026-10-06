import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { withDatabase, applyCurrent } from "./fixtures";
test("MON-092 actual CRM REST/MCP exact values, currency groups, auth, scope and rollback", async () => {
  await withDatabase(async (_pool, url) => {
    applyCurrent(url);
    const r = spawnSync(process.execPath, ["--import", "tsx", "tests/integration/crm-worker.ts"], {
      env: { ...process.env, DATABASE_URL: url, STRIPE_SECRET_KEY: "", RESEND_API_KEY: "" }, encoding: "utf8", timeout: 180000,
    });
    assert.equal(r.status, 0, `CRM worker failed: ${r.stdout} ${r.stderr}`);
    assert.match(r.stdout, /CRM contracts verified/);
  });
});
