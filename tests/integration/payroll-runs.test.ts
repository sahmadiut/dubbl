import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { withDatabase, applyCurrent, historicalSchema } from "./fixtures";

test("MON-082 payroll run and lifecycle REST/MCP on migrated PostgreSQL", async () => {
  await withDatabase(async (_pool, url) => {
    applyCurrent(url);
    const result = spawnSync(process.execPath, ["--import", "tsx", "tests/integration/payroll-runs-worker.ts"], {
      env: { ...process.env, DATABASE_URL: url, STRIPE_SECRET_KEY: "", RESEND_API_KEY: "" }, encoding: "utf8", timeout: 240000,
    });
    assert.equal(result.status, 0, `Payroll run worker failed: ${result.stdout} ${result.stderr}`);
    assert.match(result.stdout, /Payroll run contracts verified/);
  });
});

test("MON-082 migration preserves prior payroll cents, FX and posted history", async () => {
  await withDatabase(async (pool, url) => {
    await historicalSchema(pool, "0008_perpetual_scarlet_spider");
    const { rows: [org] } = await pool.query("insert into organization(name,slug) values('Historical payroll','payroll-history') returning id");
    const { rows: [emp] } = await pool.query("insert into payroll_employee(organization_id,name,employee_number,salary,start_date) values($1,'History','History',1250,'2024-01-01') returning id", [org.id]);
    const { rows: [run] } = await pool.query("insert into payroll_run(organization_id,pay_period_start,pay_period_end,status,total_gross,total_deductions,total_net) values($1,'2024-01-01','2024-01-07','completed',1250,29,1221) returning id", [org.id]);
    await pool.query("insert into payroll_item(payroll_run_id,employee_id,type,gross_amount,tax_amount,deductions,net_amount,currency,fx_rate) values($1,$2,'regular_salary',1250,29,29,1221,'USD',1.25),($1,$2,'project_bonus',1250,29,29,1221,'USD',1.2)", [run.id, emp.id]);
    const beforeRuns = (await pool.query("select to_jsonb(t) as row from payroll_run t order by id")).rows;
    const beforeItems = (await pool.query("select to_jsonb(t) as row from payroll_item t order by id")).rows;
    applyCurrent(url);
    assert.deepEqual((await pool.query("select to_jsonb(t) - 'base_currency' - 'termination_employee_id' - 'termination_pto_hours' as row from payroll_run t order by id")).rows, beforeRuns);
    assert.deepEqual((await pool.query("select to_jsonb(t) as row from payroll_item t order by id")).rows, beforeItems);
    assert.deepEqual((await pool.query("select base_currency,termination_employee_id,termination_pto_hours from payroll_run")).rows, [{ base_currency: null, termination_employee_id: null, termination_pto_hours: null }]);
    assert.equal(beforeItems.some(i => i.row.rate_migration_status === "legacy_float_requires_review"), true);
    await pool.query("update payroll_item set description='Legacy description edit' where fx_rate=1.25");
    assert.equal((await pool.query("select rate_exact = 1.25 as preserved from payroll_item where fx_rate=1.25")).rows[0].preserved, true);
    applyCurrent(url); // Idempotent migration runner does not touch historical rows.
  });
});
