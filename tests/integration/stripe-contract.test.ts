import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { withDatabase, applyCurrent } from "./fixtures";

test("MON-031 provider checkout, signed events, REST/MCP imports and outgoing delivery contracts", async () => {
  await withDatabase(async (_pool, url) => {
    applyCurrent(url);
    const result = spawnSync(process.execPath, ["--import", "tsx", "tests/integration/stripe-contract-worker.ts"], {
      env: { ...process.env, DATABASE_URL: url, STRIPE_SECRET_KEY: "sk_test_fixture", STRIPE_WEBHOOK_SECRET: "whsec_fixture",
        STRIPE_CONNECT_WEBHOOK_SECRET: "whsec_connect_fixture", STRIPE_PRO_PRICE_ID: "price_pro_fixture", NEXT_PUBLIC_APP_URL: "https://fixture.test", RESEND_API_KEY: "", TRIGGER_SECRET_KEY: "" },
      encoding: "utf8", timeout: 120000,
    });
    assert.equal(result.status, 0, `Stripe contract worker failed: ${result.stdout} ${result.stderr}`);
    assert.match(result.stdout, /Stripe REST, MCP and signed delivery contracts verified/);
  });
});
