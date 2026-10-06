import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { applyCurrent, withDatabase } from "./fixtures";

test("MON-027 combined project, billing, CRM and pricing REST/MCP contracts", async () => {
  await withDatabase(async (_pool, url) => {
    applyCurrent(url);
    const result = spawnSync(process.execPath, ["--import", "tsx", "tests/integration/project-crm-pricing-worker.ts"], {
      env: { ...process.env, DATABASE_URL: url, STRIPE_SECRET_KEY: "", RESEND_API_KEY: "" },
      encoding: "utf8", timeout: 180000,
    });
    assert.equal(result.status, 0, `Combined worker failed: ${result.stdout} ${result.stderr}`);
    assert.match(result.stdout, /Combined project CRM pricing contracts verified/);
  });
});
