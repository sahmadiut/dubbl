import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { withDatabase, applyCurrent } from "./fixtures";

test("MON-152 account and journal presentation agrees across REST, registered MCP and SQL", async () => {
  await withDatabase(async (_pool, url) => {
    applyCurrent(url);
    const result = spawnSync(process.execPath, ["--import", "tsx", "tests/integration/core-presentation-money-worker.ts"], {
      env: { ...process.env, DATABASE_URL: url, STRIPE_SECRET_KEY: "", RESEND_API_KEY: "" }, encoding: "utf8", timeout: 120000,
    });
    assert.equal(result.status, 0, `Core presentation fixture: ${result.stdout} ${result.stderr}`);
    assert.match(result.stdout, /Core presentation currencies, aliases, reversals and SQL verified/);
  });
});
