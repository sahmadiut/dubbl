import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { withDatabase, applyCurrent } from "./fixtures";

test("MON-144 credit UI preview, saved reads, summary and apply/void via real REST/MCP/SQL", async () => {
  await withDatabase(async (_pool, url) => {
    applyCurrent(url);
    const result = spawnSync(process.execPath, ["--import", "tsx", "tests/integration/credit-note-ui-money-worker.ts"], {
      env: { ...process.env, DATABASE_URL: url, STRIPE_SECRET_KEY: "" }, encoding: "utf8", timeout: 90000,
    });
    assert.equal(result.status, 0, `Credit UI worker failed: ${result.stdout} ${result.stderr}`);
    assert.match(result.stdout, /Credit UI REST MCP SQL verified/);
  });
});
