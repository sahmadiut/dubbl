import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { applyCurrent, withDatabase } from "./fixtures";

test("MON-125 opaque audit and administrative REST/MCP forwarding", async () => {
  await withDatabase(async (_pool, url) => {
    applyCurrent(url);
    const r = spawnSync(process.execPath, ["--import", "tsx", "tests/integration/opaque-admin-worker.ts"], {
      env: { ...process.env, DATABASE_URL: url, STRIPE_SECRET_KEY: "", IRR_PRODUCTION_ENABLED: "false" },
      encoding: "utf8", timeout: 120000,
    });
    assert.equal(r.status, 0, `Opaque/admin fixture failed: ${r.stdout} ${r.stderr}`);
    assert.match(r.stdout, /Opaque admin contracts verified/);
    const session = spawnSync(process.execPath, ["--experimental-test-module-mocks", "--import", "tsx", "tests/integration/admin-session-worker.ts"], {
      env: { ...process.env, DATABASE_URL: url, STRIPE_SECRET_KEY: "", IRR_PRODUCTION_ENABLED: "false" },
      encoding: "utf8", timeout: 120000,
    });
    assert.equal(session.status, 0, `Session forwarding fixture failed: ${session.stdout} ${session.stderr}`);
    assert.match(session.stdout, /Admin session forwarding verified/);
  });
});
