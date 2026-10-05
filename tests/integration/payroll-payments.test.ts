import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { withDatabase, applyCurrent, historicalSchema } from "./fixtures";

test("MON-083 contractor/tax payment REST/MCP on migrated PostgreSQL", async () => {
  await withDatabase(async (_pool, url) => {
    applyCurrent(url);
    const result = spawnSync(process.execPath, ["--import", "tsx", "tests/integration/payroll-payments-worker.ts"], {
      env: { ...process.env, DATABASE_URL: url, STRIPE_SECRET_KEY: "", RESEND_API_KEY: "" }, encoding: "utf8", timeout: 240000,
    });
    assert.equal(result.status, 0, `Payroll payment worker failed: ${result.stdout} ${result.stderr}`);
    assert.match(result.stdout, /Payroll payment contracts verified/);
  });
});
test("MON-083 expansion preserves all legacy contractor/tax payment fields", async () => {
  await withDatabase(async (pool, url) => {
    await historicalSchema(pool, "0009_melodic_bullseye");
    const { rows: [org] } = await pool.query("insert into organization(name,slug) values('Legacy payments','legacy-payments') returning id");
    const { rows: [c] } = await pool.query("insert into contractor(organization_id,name,currency) values($1,'Legacy contractor','EUR') returning id", [org.id]);
    await pool.query("insert into contractor_payment(contractor_id,amount,currency,status,paid_at) values($1,1250,'EUR','paid','2024-01-31'),($1,3000000000,'IRR','pending',null)", [c.id]);
    await pool.query("insert into payroll_tax_payment(organization_id,period_start,period_end,amount,currency,status) values($1,'2024-01-01','2024-01-31',1250,'USD','paid')", [org.id]);
    const before = (await pool.query("select to_jsonb(t) as row from contractor_payment t order by id")).rows;
    const taxes = (await pool.query("select to_jsonb(t) as row from payroll_tax_payment t order by id")).rows;
    applyCurrent(url);
    assert.deepEqual((await pool.query("select to_jsonb(t) - 'base_amount' - 'base_currency' - 'rate_exact' - 'payment_date' as row from contractor_payment t order by id")).rows, before);
    assert.deepEqual((await pool.query("select to_jsonb(t) as row from payroll_tax_payment t order by id")).rows, taxes);
    assert.equal((await pool.query("select count(*)::int as n from contractor_payment where base_amount is null and base_currency is null and rate_exact is null and payment_date is null")).rows[0].n, 2);
    await assert.rejects(pool.query("update contractor_payment set rate_exact=0"));
    await assert.rejects(pool.query("update contractor_payment set rate_exact=0.0000000000000000001"));
    applyCurrent(url);
    assert.deepEqual((await pool.query("select to_jsonb(t) - 'base_amount' - 'base_currency' - 'rate_exact' - 'payment_date' as row from contractor_payment t order by id")).rows, before);
  });
});
