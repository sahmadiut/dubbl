import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { exchangeRate } from "../../lib/db/schema/bookkeeping";
import { withDatabase, historicalSchema, applyCurrent, runMigration } from "./fixtures";

const checkpoint = "0005_clear_senator_kelly";
const tables = ["exchange_rate", "journal_line", "consolidation_rate", "payroll_item"] as const;
const newFields = ["rate_exact", "rate_format_version", "rate_direction", "rate_provenance", "rate_migration_status"];

async function seed(pool: pg.Pool, historical = true) {
  const orgIds: string[] = [];
  for (const slug of ["fx-a", "fx-b"]) {
    const { rows: [org] } = await pool.query("INSERT INTO organization (name, slug) VALUES ('Synthetic FX', $1) RETURNING id", [slug]);
    orgIds.push(org.id);
    const { rows: [account] } = await pool.query(`INSERT INTO chart_account (organization_id, code, name, type)
      VALUES ($1, '1100', 'Synthetic FX asset', 'asset') RETURNING id`, [org.id]);
    const { rows: [entry] } = await pool.query(`INSERT INTO journal_entry (organization_id, entry_number, date, description, status)
      VALUES ($1, 1, '2025-12-01', 'Synthetic FX entry', 'posted') RETURNING id`, [org.id]);
    const { rows: [group] } = await pool.query(`INSERT INTO consolidation_group (parent_org_id, name)
      VALUES ($1, 'Synthetic FX group') RETURNING id`, [org.id]);
    const { rows: [employee] } = await pool.query(`INSERT INTO payroll_employee (organization_id, name, employee_number, salary, start_date)
      VALUES ($1, 'Synthetic employee', 'FX-1', 1250, '2025-01-01') RETURNING id`, [org.id]);
    const { rows: [run] } = await pool.query(`INSERT INTO payroll_run (organization_id, pay_period_start, pay_period_end)
      VALUES ($1, '2025-12-01', '2025-12-31') RETURNING id`, [org.id]);
    for (const [index, rate] of (historical ? [1, 1234567, 2147483647, 0, -1] : [1, 1234567, 2147483647]).entries()) {
      const date = `2025-12-0${index + 1}`;
      await pool.query(`INSERT INTO exchange_rate (organization_id, base_currency, target_currency, rate, date, source)
        VALUES ($1, 'USD', 'EUR', $2, $3, $4)`, [org.id, rate, date, index % 2 ? "api" : "manual"]);
      await pool.query(`INSERT INTO journal_line (journal_entry_id, account_id, debit_amount, credit_amount, currency_code, exchange_rate)
        VALUES ($1, $2, 1250, 0, 'EUR', $3)`, [entry.id, account.id, rate]);
      await pool.query(`INSERT INTO consolidation_rate (group_id, currency_code, rate_type, rate, period_end_date, source)
        VALUES ($1, 'EUR', 'closing', $2, $3, $4)`, [group.id, rate, date, index % 2 ? "derived" : "manual"]);
    }
    const floatRates = historical ? ["1", "1.25", "1.1", "0", "-1", "NaN", "Infinity", null] : ["1", "1.25", "1.1"];
    for (const rate of floatRates) {
      await pool.query(`INSERT INTO payroll_item (payroll_run_id, employee_id, gross_amount, tax_amount, net_amount, currency, fx_rate)
        VALUES ($1, $2, 1250, 0, 1250, 'EUR', $3)`, [run.id, employee.id, rate]);
    }
  }
  return orgIds;
}

async function legacySnapshot(pool: pg.Pool) {
  const snapshots: Record<string, unknown> = {};
  for (const table of tables) {
    snapshots[table] = (await pool.query(`SELECT (to_jsonb(t) - $1::text[])::text AS row FROM public.${table} t ORDER BY id`, [newFields])).rows;
  }
  // Binary checksum is independent of text/GUC rendering of legacy payroll floats.
  snapshots.payrollBits = (await pool.query("SELECT id, encode(float4send(fx_rate), 'hex') AS bits FROM payroll_item ORDER BY id")).rows;
  return snapshots;
}

async function assertBackfill(pool: pg.Pool) {
  for (const table of tables) {
    assert.equal((await pool.query(`SELECT count(*)::int AS count FROM public.${table} WHERE rate_migration_status = 'pending'`)).rows[0].count, 0);
    assert.equal((await pool.query(`SELECT count(*)::int AS count FROM public.${table}
      WHERE rate_format_version <> 1 OR rate_direction <> 'quote_per_base' OR rate_provenance IS NULL`)).rows[0].count, 0);
    if (table !== "payroll_item") {
      const legacy = table === "journal_line" ? "exchange_rate" : "rate";
      assert.equal((await pool.query(`SELECT count(*)::int AS count FROM public.${table}
        WHERE (${legacy} > 0 AND (rate_exact IS DISTINCT FROM ${legacy}::numeric / 1000000::numeric OR rate_migration_status <> 'exact'))
           OR (${legacy} <= 0 AND (rate_exact IS NOT NULL OR rate_migration_status <> 'invalid_legacy'))`)).rows[0].count, 0);
    }
  }
  const rows = (await pool.query(`SELECT fx_rate::text AS legacy, rate_exact::text AS exact, rate_migration_status AS status FROM payroll_item`)).rows;
  for (const row of rows) {
    if (["1", "1.25"].includes(row.legacy)) {
      assert.equal(row.status, "exact"); assert.equal(Number(row.exact), Number(row.legacy));
    } else if (row.legacy === "1.1") {
      assert.equal(row.status, "legacy_float_requires_review"); assert.equal(row.exact, null);
    } else { assert.equal(row.status, "invalid_legacy"); assert.equal(row.exact, null); }
  }
  const { rows: [binary] } = await pool.query("SELECT fx_float4_exact('1.1'::real)::text AS value");
  assert.equal(binary.value.replace(/0+$/, ""), "1.10000002384185791015625");
}

test("MON-004 backfills all four fields exactly and preserves historical rows including invalid/float rates", async () => {
  await withDatabase(async (pool, url) => {
    await historicalSchema(pool, checkpoint);
    await seed(pool);
    const before = await legacySnapshot(pool);
    applyCurrent(url);
    assert.deepEqual(await legacySnapshot(pool), before);
    await assertBackfill(pool);
    // Independent exact binary32 edge fixtures, including normal/subnormal exponents.
    const canonical = (value: string) => value.includes(".") ? value.replace(/0+$/, "").replace(/\.$/, "") : value;
    for (const [input, expected] of [
      ["0", "0"], ["-0", "0"], ["-1.1", "-1.10000002384185791015625"],
      ["1.40129846e-45", `0.${(BigInt(5) ** BigInt(149)).toString().padStart(149, "0")}`],
      ["1.17549435e-38", `0.${(BigInt(5) ** BigInt(126)).toString().padStart(126, "0")}`],
      ["3.40282347e38", "340282346638528859811704183484516925440"],
    ]) {
      const { rows: [result] } = await pool.query("SELECT fx_float4_exact($1::real)::text AS value", [input]);
      assert.equal(canonical(result.value), canonical(expected));
    }
    const after = (await pool.query("SELECT * FROM exchange_rate ORDER BY id")).rows;
    applyCurrent(url);
    assert.deepEqual((await pool.query("SELECT * FROM exchange_rate ORDER BY id")).rows, after);
    for (const table of tables) assert.equal((await pool.query("SELECT backfill_exact_fx($1, 2) AS count", [table])).rows[0].count, 0);
    assert.deepEqual(await legacySnapshot(pool), before);
  });
});

test("MON-004 clean install synchronizes ORM/raw/upsert writes and rejects unsafe exact coexistence", async () => {
  await withDatabase(async (pool, url) => {
    applyCurrent(url);
    const [orgA, orgB] = await seed(pool, false);
    const db = drizzle(pool);
    const [row] = await db.insert(exchangeRate).values({ organizationId: orgA, baseCurrency: "GBP", targetCurrency: "EUR", rate: 1080000, date: "2025-12-01" }).returning();
    assert.equal(row.rateExact, "1.08");
    await db.update(exchangeRate).set({ rate: 1250000 }).where(eq(exchangeRate.id, row.id));
    assert.equal((await db.select().from(exchangeRate).where(eq(exchangeRate.id, row.id)))[0].rateExact, "1.25");
    await assert.rejects(pool.query("UPDATE exchange_rate SET rate = 1350000, rate_exact = rate_exact WHERE id = $1", [row.id]), { code: "23514" });
    for (const value of ["1.1", "1500000", "0.000000666666666667", "0.0000000000000000001", "NaN", "Infinity", "0", "-1"]) {
      await assert.rejects(pool.query("UPDATE exchange_rate SET rate_exact = $1 WHERE id = $2", [value, row.id]), { code: "23514" });
    }
    for (const rate of [0, -1]) await assert.rejects(pool.query("UPDATE exchange_rate SET rate = $1 WHERE id = $2", [rate, row.id]), { code: "23514" });
    for (const [field, value] of [["rate_format_version", "2"], ["rate_direction", "base_per_quote"]]) {
      await assert.rejects(pool.query(`UPDATE exchange_rate SET ${field} = $1 WHERE id = $2`, [value, row.id]), { code: "23514" });
    }
    await pool.query(`INSERT INTO exchange_rate (organization_id, base_currency, target_currency, rate, date, source)
      VALUES ($1, 'GBP', 'EUR', 1350000, '2025-12-01', 'api') ON CONFLICT (organization_id, base_currency, target_currency, date)
      DO UPDATE SET rate = excluded.rate, source = excluded.source`, [orgA]);
    const { rows: [updated] } = await pool.query("SELECT rate_exact::text AS exact, rate_provenance AS provenance FROM exchange_rate WHERE id = $1", [row.id]);
    assert.equal(Number(updated.exact), 1.35); assert.equal(updated.provenance, "legacy_scaled_1e6:api");
    assert.equal((await pool.query("SELECT count(*)::int AS count FROM exchange_rate WHERE organization_id = $1 AND base_currency = 'GBP'", [orgB])).rows[0].count, 0);
    // Snapshot never follows today's exchange table update.
    assert.equal((await pool.query("SELECT rate_exact = exchange_rate::numeric / 1000000 AS preserved FROM journal_line LIMIT 1")).rows[0].preserved, true);
    for (const table of tables) {
      const legacy = table === "journal_line" ? "exchange_rate" : table === "payroll_item" ? "fx_rate" : "rate";
      await assert.rejects(pool.query(`UPDATE ${table} SET ${legacy} = 0`), { code: "23514" });
      await assert.rejects(pool.query(`UPDATE ${table} SET rate_exact = 0.000000666666666667`), { code: "23514" });
    }
    await assertBackfill(pool);
  });
});

test("MON-004 exact column storage admits 20/18 extremes and rejects excess scale without rounding", async () => {
  await withDatabase(async (pool, url) => {
    applyCurrent(url); await seed(pool, false);
    // Physical storage qualification only: consumer guard is separately tested above.
    // Disable on this synthetic fixture to isolate CHECK precision from legacy coexistence.
    for (const table of tables) {
      await pool.query(`ALTER TABLE ${table} DISABLE TRIGGER ${table}_exact_sync`);
      await pool.query(`ALTER TABLE ${table} DISABLE TRIGGER ${table}_exact_input_guard`);
      for (const value of ["1500000", "0.000000666666666667", "0.000000000000000001", "99999999999999999999.999999999999999999"]) {
        await pool.query(`UPDATE ${table} SET rate_exact = $1`, [value]);
        assert.equal((await pool.query(`SELECT rate_exact::text AS value FROM ${table} LIMIT 1`)).rows[0].value, value);
      }
      for (const value of ["0.0000000000000000001", "100000000000000000000", "NaN", "Infinity", "0", "-1"]) {
        await assert.rejects(pool.query(`UPDATE ${table} SET rate_exact = $1`, [value]), { code: "23514" });
      }
    }
  });
});

test("MON-004 batched backfill resumes after a committed batch and skips locks without losing pending work", async () => {
  await withDatabase(async (pool, url) => {
    await historicalSchema(pool, checkpoint); await seed(pool); applyCurrent(url);
    const before = await legacySnapshot(pool);
    // Simulate interrupted expansion data on a disposable fixture, preserving all legacy fields.
    for (const table of tables) {
      await pool.query(`ALTER TABLE ${table} DISABLE TRIGGER ${table}_exact_sync`);
      await pool.query(`ALTER TABLE ${table} DISABLE TRIGGER ${table}_exact_input_guard`);
      await pool.query(`UPDATE ${table} SET rate_exact = NULL, rate_migration_status = 'pending', rate_provenance = NULL`);
      await pool.query(`ALTER TABLE ${table} ENABLE TRIGGER ${table}_exact_sync`);
      await pool.query(`ALTER TABLE ${table} ENABLE TRIGGER ${table}_exact_input_guard`);
    }
    const blocker = new pg.Client({ connectionString: url }); await blocker.connect();
    try {
      await blocker.query("BEGIN"); await blocker.query("SELECT id FROM exchange_rate ORDER BY id LIMIT 1 FOR UPDATE");
      assert.equal((await pool.query("SELECT backfill_exact_fx('exchange_rate', 2) AS count")).rows[0].count, 2);
      const run = () => spawnSync(process.execPath, ["--import", "tsx", "scripts/backfill-fx.ts"], {
        env: { ...process.env, DATABASE_URL: url, FX_BACKFILL_BATCH_SIZE: "2" }, encoding: "utf8", timeout: 30000,
      });
      assert.equal(run().status, 2, "Locked row must remain pending and report incomplete work");
      await blocker.query("ROLLBACK");
      assert.equal(run().status, 0);
      assert.equal(run().status, 0);
    } finally { await blocker.query("ROLLBACK"); await blocker.end(); }
    await assertBackfill(pool); assert.deepEqual(await legacySnapshot(pool), before);
    await assert.rejects(pool.query("SELECT backfill_exact_fx('organization', 2)"), { code: "22023" });
    await assert.rejects(pool.query("SELECT backfill_exact_fx('exchange_rate', 0)"), { code: "22023" });
  });
});

test("MON-004 lock failure rolls back expansion/history and retry preserves legacy data", async () => {
  await withDatabase(async (pool, url) => {
    await historicalSchema(pool, checkpoint); await seed(pool);
    const before = await legacySnapshot(pool);
    const blocker = new pg.Client({ connectionString: url }); await blocker.connect();
    try {
      await blocker.query("BEGIN"); await blocker.query("LOCK TABLE payroll_item IN ACCESS SHARE MODE");
      const failure = runMigration(url); assert.equal(failure.status, 1); assert.match(failure.stderr, /lock timeout/);
    } finally { await blocker.query("ROLLBACK"); await blocker.end(); }
    assert.equal((await pool.query("SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations")).rows[0].count, 6);
    assert.equal((await pool.query("SELECT count(*)::int AS count FROM information_schema.columns WHERE column_name = 'rate_exact'")).rows[0].count, 0);
    assert.deepEqual(await legacySnapshot(pool), before);
    applyCurrent(url); await assertBackfill(pool); assert.deepEqual(await legacySnapshot(pool), before);
  });
});
