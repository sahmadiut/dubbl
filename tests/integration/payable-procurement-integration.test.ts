import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { withDatabase, applyCurrent } from "./fixtures";

test("MON-020 combined payable/procurement REST/MCP contracts", async () => {
  await withDatabase(async (_pool, url) => {
    applyCurrent(url);
    const result = spawnSync(process.execPath, ["--import", "tsx", "tests/integration/payable-procurement-integration-worker.ts"], {
      env: { ...process.env, DATABASE_URL: url, STRIPE_SECRET_KEY: "", RESEND_API_KEY: "" },
      encoding: "utf8", timeout: 90000,
    });
    assert.equal(result.status, 0, `Combined procurement worker failed: ${result.stdout} ${result.stderr}`);
    assert.match(result.stdout, /Combined payable\/procurement contracts verified/);
  });
});
