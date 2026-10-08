import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { withDatabase, applyCurrent } from "./fixtures";

test("MON-104 combined operational reports agree across actual REST/MCP clients", async () => {
  await withDatabase(async (_pool, url) => {
    applyCurrent(url);
    const result = spawnSync(process.execPath, ["--import", "tsx", "tests/integration/operational-report-integration-worker.ts"], {
      env: { ...process.env, DATABASE_URL: url, STRIPE_SECRET_KEY: "", RESEND_API_KEY: "" },
      encoding: "utf8", timeout: 120000,
    });
    assert.equal(result.status, 0, `Operational integration failed: ${result.stdout} ${result.stderr}`);
    assert.match(result.stdout, /Combined operational report contracts verified/);
  });
});
