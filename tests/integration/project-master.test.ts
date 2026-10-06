import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { withDatabase, applyCurrent } from "./fixtures";
test("MON-093 actual project REST/MCP money, time, metadata, scope and atomic rollback", async () => {
  await withDatabase(async (_pool, url) => {
    applyCurrent(url);
    const r = spawnSync(process.execPath, ["--import", "tsx", "tests/integration/project-master-worker.ts"], {
      env: { ...process.env, DATABASE_URL: url, STRIPE_SECRET_KEY: "", RESEND_API_KEY: "" }, encoding: "utf8", timeout: 180000,
    });
    assert.equal(r.status, 0, `Project worker failed: ${r.stdout} ${r.stderr}`);
    assert.match(r.stdout, /Project master contracts verified/);
  });
});
