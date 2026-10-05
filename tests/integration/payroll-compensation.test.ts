import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { withDatabase, applyCurrent, historicalSchema } from "./fixtures";

test("MON-084 compensation and forecasting REST/MCP on PostgreSQL", async () => {
  await withDatabase(async (_pool, url) => {
    applyCurrent(url);
    const result = spawnSync(process.execPath, ["--import", "tsx", "tests/integration/payroll-compensation-worker.ts"], {
      env: { ...process.env, DATABASE_URL: url, STRIPE_SECRET_KEY: "", RESEND_API_KEY: "" }, encoding: "utf8", timeout: 240000,
    });
    assert.equal(result.status, 0, `Compensation worker failed: ${result.stdout} ${result.stderr}`);
    assert.match(result.stdout, /Compensation and forecasting contracts verified/);
  });
});
test("MON-084 review currency expansion preserves every legacy field", async () => {
  await withDatabase(async (pool, url) => {
    await historicalSchema(pool, "0010_slippery_skreet");
    const { rows: [org] } = await pool.query("insert into organization(name,slug) values('Legacy compensation','legacy-compensation') returning id");
    await pool.query("insert into compensation_review(organization_id,name,effective_date,total_budget) values($1,'Legacy','2024-01-31',3000000000)", [org.id]);
    const before = (await pool.query("select to_jsonb(t) as row from compensation_review t")).rows;
    applyCurrent(url);
    assert.deepEqual((await pool.query("select to_jsonb(t) - 'currency' as row from compensation_review t")).rows, before);
    assert.equal((await pool.query("select count(*)::int as n from compensation_review where currency is null")).rows[0].n, 1);
    applyCurrent(url);
    assert.deepEqual((await pool.query("select to_jsonb(t) - 'currency' as row from compensation_review t")).rows, before);
  });
});
