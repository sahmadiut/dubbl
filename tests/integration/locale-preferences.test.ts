import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { withDatabase, applyCurrent, historicalSchema } from "./fixtures";

test("LOC-001 additive migration and authenticated REST/MCP/request locale resolution", async () => {
  await withDatabase(async (pool, url) => {
    await historicalSchema(pool, "0012_currency_regimes");
    await pool.query("insert into users(id,email) values ('00000000-0000-4000-8000-000000000001','legacy@example.test')");
    await pool.query("insert into organization(id,name,slug,default_currency,mileage_rate) values ('00000000-0000-4000-8000-000000000002','Legacy','locale-legacy','USD',1250)");
    applyCurrent(url);
    assert.deepEqual((await pool.query("select language,time_zone,numerals,calendar,font_family from users where email='legacy@example.test'")).rows[0],
      { language: null, time_zone: null, numerals: null, calendar: null, font_family: null });
    assert.deepEqual((await pool.query("select default_language,default_currency,mileage_rate::text from organization where slug='locale-legacy'")).rows[0],
      { default_language: null, default_currency: "USD", mileage_rate: "1250" });
    const result = spawnSync(process.execPath, ["--experimental-test-module-mocks", "--import", "tsx", "tests/integration/locale-preferences-worker.ts"], {
      env: { ...process.env, DATABASE_URL: url, STRIPE_SECRET_KEY: "", RESEND_API_KEY: "", IRR_PRODUCTION_ENABLED: "false" },
      encoding: "utf8", timeout: 120000,
    });
    assert.equal(result.status, 0, `Locale preference fixture failed: ${result.stdout} ${result.stderr}`);
    assert.match(result.stdout, /Locale REST, MCP, request resolution and SQL verified/);
  });
});
