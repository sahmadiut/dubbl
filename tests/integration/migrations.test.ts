import assert from "node:assert/strict";
import { test } from "node:test";
import pg from "pg";
import { withDatabase, historicalSchema, applyCurrent, runMigration, journal, previousCheckpoint } from "./fixtures";

async function seedLedger(pool: pg.Pool) {
  // Synthetic SQL only: no production dump, authentication or external providers.
  // Equal account codes in two orgs exercise preservation of tenant boundaries.
  for (const [slug, amount, currency] of [
    ["ci-usd", 1250, "USD"], ["ci-irr", 123456789, "IRR"],
    ["ci-boundary", 2147483647, "USD"],
  ] as const) {
    const { rows: [org] } = await pool.query(
      `INSERT INTO organization (name, slug, default_currency)
       VALUES ('CI Synthetic Organization', $1, $2) RETURNING id`, [slug, currency],
    );
    const { rows: [asset] } = await pool.query(
      `INSERT INTO chart_account (organization_id, code, name, type, currency_code)
       VALUES ($1, '1100', 'CI Synthetic Asset', 'asset', $2) RETURNING id`, [org.id, currency],
    );
    const { rows: [equity] } = await pool.query(
      `INSERT INTO chart_account (organization_id, code, name, type, currency_code)
       VALUES ($1, '3000', 'CI Synthetic Equity', 'equity', $2) RETURNING id`, [org.id, currency],
    );
    const { rows: [entry] } = await pool.query(
      `INSERT INTO journal_entry (organization_id, entry_number, date, description, status)
       VALUES ($1, 1, '2025-12-01', 'CI Synthetic Opening', 'posted') RETURNING id`, [org.id],
    );
    await pool.query(
      `INSERT INTO journal_line (journal_entry_id, account_id, debit_amount, credit_amount, currency_code, exchange_rate)
       VALUES ($1, $2, $4, 0, $5, 1000000), ($1, $3, 0, $4, $5, 1000000)`,
      [entry.id, asset.id, equity.id, amount, currency],
    );
    await pool.query(
      `INSERT INTO period_lock (organization_id, lock_date, reason)
       VALUES ($1, '2025-12-31', 'CI Synthetic Lock')`, [org.id],
    );
  }
}

async function snapshot(pool: pg.Pool) {
  const tables = ["organization", "chart_account", "journal_entry", "journal_line", "period_lock"];
  const records: Record<string, unknown[]> = {};
  for (const table of tables) {
    // Only legacy columns for tables intentionally expanded by later migrations.
    const columns = table === "organization"
      ? "id, name, slug, default_currency, created_at, updated_at"
      : table === "chart_account"
        ? "id, organization_id, code, name, type, currency_code, created_at"
        : table === "journal_entry"
          ? "id, organization_id, entry_number, date, description, status, created_at, updated_at"
          : table === "journal_line"
            ? "id, journal_entry_id, account_id, description, debit_amount::text, credit_amount::text, currency_code, exchange_rate, cost_center_id"
            : "id, organization_id, lock_date, locked_by, reason, created_at";
    records[table] = (await pool.query(`SELECT ${columns} FROM "${table}" ORDER BY id`)).rows;
  }
  records.balances = (await pool.query(
    `SELECT o.slug, a.code, l.currency_code,
       sum(l.debit_amount)::text AS debit, sum(l.credit_amount)::text AS credit
     FROM journal_line l JOIN journal_entry e ON e.id = l.journal_entry_id
     JOIN chart_account a ON a.id = l.account_id JOIN organization o ON o.id = e.organization_id
     GROUP BY o.slug, a.code, l.currency_code ORDER BY o.slug, a.code, l.currency_code`,
  )).rows;
  assert.deepEqual(records.balances, [
    { slug: "ci-boundary", code: "1100", currency_code: "USD", debit: "2147483647", credit: "0" },
    { slug: "ci-boundary", code: "3000", currency_code: "USD", debit: "0", credit: "2147483647" },
    { slug: "ci-irr", code: "1100", currency_code: "IRR", debit: "123456789", credit: "0" },
    { slug: "ci-irr", code: "3000", currency_code: "IRR", debit: "0", credit: "123456789" },
    { slug: "ci-usd", code: "1100", currency_code: "USD", debit: "1250", credit: "0" },
    { slug: "ci-usd", code: "3000", currency_code: "USD", debit: "0", credit: "1250" },
  ]);
  assert.equal((await pool.query(
    `SELECT count(*)::int AS count FROM journal_line l
     JOIN journal_entry e ON e.id = l.journal_entry_id JOIN chart_account a ON a.id = l.account_id
     WHERE e.organization_id <> a.organization_id`,
  )).rows[0].count, 0);
  return records;
}

async function assertCurrent(pool: pg.Pool) {
  const history = (await pool.query(
    'SELECT hash, created_at::text FROM drizzle.__drizzle_migrations ORDER BY created_at',
  )).rows;
  assert.equal(history.length, journal.entries.length);
  assert.deepEqual(history.map(({ created_at }) => created_at), journal.entries.map(({ when }) => String(when)));
  assert.equal((await pool.query("SELECT to_regclass('public.workflow') AS reg")).rows[0].reg, null);
  assert.ok((await pool.query(
    "SELECT column_name FROM information_schema.columns WHERE table_name = 'invoice' AND column_name = 'invoice_type'",
  )).rowCount);
  return history;
}

test("clean database migrates, preserves synthetic ledger and reruns idempotently", async () => {
  await withDatabase(async (pool, url) => {
    applyCurrent(url);
    const history = await assertCurrent(pool);
    await seedLedger(pool);
    const before = await snapshot(pool);
    applyCurrent(url);
    assert.deepEqual(await assertCurrent(pool), history);
    assert.deepEqual(await snapshot(pool), before);
  });
});

test("previous schema checkpoint upgrades without rescaling amounts, FX, dates or tenant records", async () => {
  await withDatabase(async (pool, url) => {
    await historicalSchema(pool, previousCheckpoint);
    await seedLedger(pool);
    const before = await snapshot(pool);
    applyCurrent(url);
    const history = await assertCurrent(pool);
    assert.deepEqual(await snapshot(pool), before);
    applyCurrent(url);
    assert.deepEqual(await assertCurrent(pool), history);
    assert.deepEqual(await snapshot(pool), before);
  });
});

test("untracked 0000 schema adopts baseline and upgrades without changing ledger", async () => {
  await withDatabase(async (pool, url) => {
    await historicalSchema(pool, "0000_baseline", true);
    await seedLedger(pool);
    const before = await snapshot(pool);
    assert.match(applyCurrent(url), /Adopted existing schema/);
    const history = await assertCurrent(pool);
    assert.deepEqual(await snapshot(pool), before);
    applyCurrent(url);
    assert.deepEqual(await assertCurrent(pool), history);
    assert.deepEqual(await snapshot(pool), before);
  });
});

test("failed pending migration rolls back schema and history while preserving ledger", async () => {
  await withDatabase(async (pool, url) => {
    await historicalSchema(pool, "0000_baseline");
    await seedLedger(pool);
    const before = await snapshot(pool);
    // Force a real SQL failure in 0002, after 0001 has executed in the transaction.
    await pool.query("ALTER TABLE expense_item ADD COLUMN tax_rate_id uuid");
    assert.equal(runMigration(url).status, 1);
    assert.equal((await pool.query("SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations")).rows[0].count, 1);
    assert.equal((await pool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'journal_line' AND column_name = 'project_id'",
    )).rowCount, 0);
    assert.deepEqual(await snapshot(pool), before);
    await pool.query("ALTER TABLE expense_item DROP COLUMN tax_rate_id");
    applyCurrent(url);
    await assertCurrent(pool);
    assert.deepEqual(await snapshot(pool), before);
  });
});
