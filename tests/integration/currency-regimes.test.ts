import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { withDatabase, historicalSchema, applyCurrent } from "./fixtures";

test("MON-009 regime expansion preserves posted history and exposes scoped REST/MCP metadata", async () => {
  await withDatabase(async (pool, url) => {
    await historicalSchema(pool, "0011_hesitant_roxanne_simpson");
    const { rows: [org] } = await pool.query("INSERT INTO organization (name, slug) VALUES ('Historic', 'regime-historic') RETURNING id");
    const { rows: [account] } = await pool.query(`INSERT INTO chart_account (organization_id, code, name, type, currency_code)
      VALUES ($1, '1000', 'Cash', 'asset', 'IRR') RETURNING id`, [org.id]);
    const { rows: [entry] } = await pool.query(`INSERT INTO journal_entry (organization_id, entry_number, date, description, status)
      VALUES ($1, 1, '2026-01-01', 'Historic posted IRR', 'posted') RETURNING id`, [org.id]);
    await pool.query(`INSERT INTO journal_line (journal_entry_id, account_id, debit_amount, credit_amount, currency_code)
      VALUES ($1, $2, 4000000003, 0, 'IRR'), ($1, $2, 0, 4000000003, 'IRR')`, [entry.id, account.id]);
    const snapshot = async () => (await pool.query(`SELECT 'entry' AS kind, row_to_json(e)::text AS row FROM journal_entry e
      UNION ALL SELECT 'line', row_to_json(l)::text FROM journal_line l ORDER BY kind, row`)).rows;
    const before = await snapshot();
    applyCurrent(url);
    assert.deepEqual(await snapshot(), before);
    const { rows: [baseline] } = await pool.query("SELECT * FROM currency_regime WHERE organization_id=$1", [org.id]);
    assert.equal(baseline.regime_key, "irr-current-v1");
    assert.equal(baseline.display_minor_units, 0);
    assert.equal(baseline.effective_from, null); assert.equal(baseline.effective_to, null);
    assert.equal(baseline.scale_to_previous, null); assert.equal(baseline.official, false);
    applyCurrent(url); // Migration replay cannot duplicate metadata or alter ledger history.
    assert.deepEqual(await snapshot(), before);
    assert.equal((await pool.query("SELECT count(*)::text AS n FROM currency_regime")).rows[0].n, "1");
    const result = spawnSync(process.execPath, ["--import", "tsx", "tests/integration/currency-regimes-worker.ts"], {
      env: { ...process.env, DATABASE_URL: url }, encoding: "utf8", timeout: 120000,
    });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /Regime REST\/MCP\/SQL contracts verified/);
    assert.deepEqual(await snapshot(), before);
    const { rows: [totals] } = await pool.query("SELECT sum(debit_amount)::text AS debit, sum(credit_amount)::text AS credit FROM journal_line");
    assert.deepEqual(totals, { debit: "4000000003", credit: "4000000003" });
  });
});
