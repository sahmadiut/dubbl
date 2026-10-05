import assert from "node:assert/strict";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { test } from "node:test";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { journalLine } from "../../lib/db/schema/bookkeeping";
import { WireCompatibilityError } from "../../lib/money/wire";
import { withDatabase, historicalSchema, applyCurrent, runMigration } from "./fixtures";

type Column = { table: string; column: string; before: string; after: string };
const coverage = JSON.parse(await readFile(".agentic/registries/MONEY_BIGINT_MIGRATION.json", "utf8")) as {
  checkpoint: string; columns: Column[];
};
const money = coverage.columns.filter(c => c.before !== c.after);
const tables = [...new Set(money.map(c => c.table))];
const payrollSnapshotColumns: Record<string, string[]> = {
  contractor_payment: ["base_amount", "base_currency", "rate_exact", "payment_date"],
  payroll_run: ["base_currency", "termination_employee_id", "termination_pto_hours"],
  payroll_item_deduction: ["employee_deduction_id", "liability_account_code"],
};
const quote = (name: string) => {
  assert.match(name, /^[a-z_]+$/);
  return `"${name}"`;
};

async function metadata(pool: pg.Pool) {
  const { rows } = await pool.query(`SELECT table_name, column_name, udt_name, is_nullable, column_default
    FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, ordinal_position`);
  return rows;
}

async function assertTypes(pool: pg.Pool, upgraded: boolean) {
  const actual = await metadata(pool);
  for (const column of coverage.columns) {
    const match = actual.find(c => c.table_name === column.table && c.column_name === column.column);
    assert.ok(match, `${column.table}.${column.column}`);
    const type = upgraded ? column.after : column.before;
    assert.equal(match.udt_name, ({ integer: "int4", bigint: "int8", real: "float4" } as Record<string, string>)[type] ?? type);
  }
  if (upgraded) for (const [table, columns] of Object.entries(payrollSnapshotColumns)) {
    for (const column of columns) {
      const match = actual.find(c => c.table_name === table && c.column_name === column);
      assert.ok(match, `${table}.${column}`);
      assert.equal(match.is_nullable, "YES");
      assert.equal(match.column_default, null);
    }
    const { rows: [row] } = await pool.query(`SELECT count(*)::int AS populated FROM ${quote(table)}
      WHERE ${columns.map(column => `${quote(column)} IS NOT NULL`).join(" OR ")}`);
    assert.equal(row.populated, 0, `${table} historical snapshot fields must remain null`);
  }
}

/** Synthetic rows in the real previous schema, including required parent FKs.
 * This tests physical preservation, not business-valid payroll/documents.
 */
async function seedEveryMoneyTable(pool: pg.Pool) {
  const columns = await metadata(pool);
  const { rows: foreignKeys } = await pool.query(`SELECT c.relname AS table_name, a.attname AS column_name,
      f.relname AS parent_table, b.attname AS parent_column
    FROM pg_constraint k JOIN pg_class c ON c.oid = k.conrelid JOIN pg_class f ON f.oid = k.confrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    CROSS JOIN LATERAL unnest(k.conkey, k.confkey) AS keys(child, parent)
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = keys.child
    JOIN pg_attribute b ON b.attrelid = f.oid AND b.attnum = keys.parent
    WHERE k.contype = 'f' AND n.nspname = 'public'`);
  const cache = new Map<string, Record<string, unknown>>();
  const visiting = new Set<string>();
  async function seed(table: string): Promise<Record<string, unknown>> {
    const cached = cache.get(table);
    if (cached) return cached;
    assert.ok(!visiting.has(table), `Required FK cycle: ${table}`);
    visiting.add(table);
    const fields: string[] = [];
    const values: unknown[] = [];
    for (const column of columns.filter(c => c.table_name === table)) {
      const monetary = money.some(c => c.table === table && c.column === column.column_name);
      if (!monetary && (column.column_default !== null || column.is_nullable === "YES")) continue;
      let value: unknown;
      const fk = foreignKeys.find(k => k.table_name === table && k.column_name === column.column_name);
      if (fk) value = (await seed(fk.parent_table))[fk.parent_column];
      else if (monetary) value = 1250;
      else if (column.udt_name === "uuid") value = crypto.randomUUID();
      else if (["int4", "int8", "numeric", "float4", "float8"].includes(column.udt_name)) value = 1;
      else if (column.udt_name === "bool") value = false;
      else if (["date", "timestamp", "timestamptz"].includes(column.udt_name)) value = "2025-12-01";
      else if (column.udt_name === "jsonb") value = "{}";
      else {
        const { rows } = await pool.query(`SELECT enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
          WHERE t.typname = $1 ORDER BY enumsortorder LIMIT 1`, [column.udt_name]);
        value = rows[0]?.enumlabel ?? (column.column_name.includes("currency") ? "USD" : `fixture_${table}_${column.column_name}`);
      }
      fields.push(quote(column.column_name)); values.push(value);
    }
    const result = await pool.query(`INSERT INTO ${quote(table)} (${fields.join(",")})
      VALUES (${values.map((_, i) => `$${i + 1}`).join(",")}) RETURNING *`, values);
    cache.set(table, result.rows[0]); visiting.delete(table);
    return result.rows[0];
  }
  for (const table of tables) await seed(table);
}

async function checksums(pool: pg.Pool) {
  const result: Record<string, unknown> = {};
  // Hash historical row values, including non-money columns, dates and org IDs.
  for (const table of tables) {
    // MON-077/082/083 add nullable fields; compare every original column and separately
    // assert the new payroll snapshots stay null in assertTypes after upgrading.
    const addedColumns = table === "inventory_cost_layer" ? ["remaining_value"]
      : table === "inventory_layer_consumption" ? ["value"] : payrollSnapshotColumns[table] ?? [];
    result[table] = (await pool.query(`SELECT count(*)::text AS count,
      md5(string_agg(row_data::text, ',' ORDER BY row_data::text)) AS checksum
      FROM (SELECT to_jsonb(t) - ARRAY['rate_exact','rate_format_version','rate_direction','rate_provenance','rate_migration_status',
        'provider','provider_base','provider_quote','provider_observed_at','imported_at','provider_rounding'] - $1::text[] AS row_data
        FROM ${quote(table)} t) historical_rows`, [addedColumns])).rows[0];
    for (const column of money.filter(c => c.table === table)) {
      result[`${table}.${column.column}`] = (await pool.query(`SELECT
        count(${quote(column.column)})::text AS nonnull,
        sum(${quote(column.column)})::text AS total FROM ${quote(table)}`)).rows[0];
    }
  }
  return result;
}

test("MON-003 widens all 195 columns, preserving every table checksum, nullability and legacy values", async () => {
  await withDatabase(async (pool, url) => {
    await historicalSchema(pool, coverage.checkpoint);
    await assertTypes(pool, false);
    await seedEveryMoneyTable(pool);
    // Exercise both int32 bounds, negative refunds and nulls in every column.
    for (const column of money) {
      for (const value of ["-2147483648", "2147483647", "-1250", "0", "123456789"]) {
        await pool.query(`UPDATE ${quote(column.table)} SET ${quote(column.column)} = $1`, [value]);
      }
    }
    // Final differing values survive in each table; nullable columns retain null.
    const beforeMeta = await metadata(pool);
    for (const [i, column] of money.entries()) {
      const nullable = beforeMeta.find(c => c.table_name === column.table && c.column_name === column.column)!.is_nullable === "YES";
      const value = nullable && i % 2 === 0 ? null : ["-2147483648", "2147483647", "-1250", "0", "1250", "123456789"][i % 6];
      await pool.query(`UPDATE ${quote(column.table)} SET ${quote(column.column)} = $1`, [value]);
    }
    const before = await checksums(pool);
    const beforeSize = (await pool.query("SELECT pg_database_size(current_database())::text AS bytes")).rows[0].bytes;
    const started = performance.now();
    applyCurrent(url);
    const elapsedMs = Math.round(performance.now() - started);
    await assertTypes(pool, true);
    assert.deepEqual(await checksums(pool), before);
    assert.deepEqual((await metadata(pool)).filter(c => beforeMeta.some(b => b.table_name === c.table_name && b.column_name === c.column_name))
      .map(c => [c.table_name, c.column_name, c.is_nullable, c.column_default]),
      beforeMeta.map(c => [c.table_name, c.column_name, c.is_nullable, c.column_default]));
    applyCurrent(url);
    assert.deepEqual(await checksums(pool), before);
    const afterSize = (await pool.query("SELECT pg_database_size(current_database())::text AS bytes")).rows[0].bytes;
    console.log(JSON.stringify({ task: "MON-003", columns: money.length, tables: tables.length, elapsedMs, beforeSize, afterSize }));
    // SQL storage supports exact int64, while the transitional ORM fails closed.
    const db = drizzle(pool);
    for (const value of ["2147483648", "9007199254740991", "9223372036854775807", "-9223372036854775808"]) {
      await pool.query("UPDATE journal_line SET debit_amount = $1", [value]);
      assert.equal((await pool.query("SELECT debit_amount::text AS value FROM journal_line")).rows[0].value, value);
      if (BigInt(value) > BigInt(Number.MAX_SAFE_INTEGER) || BigInt(value) < BigInt(Number.MIN_SAFE_INTEGER)) {
        await assert.rejects(db.select({ amount: journalLine.debitAmount }).from(journalLine), (error: unknown) =>
          error instanceof WireCompatibilityError && error.code === "LEGACY_NUMERIC_RANGE" && error.status === 422);
      } else {
        assert.equal((await db.select({ amount: journalLine.debitAmount }).from(journalLine))[0].amount, Number(value));
      }
    }
    await assert.rejects(pool.query("UPDATE journal_line SET debit_amount = '9223372036854775808'"), { code: "22003" });
    await assert.rejects(pool.query("UPDATE journal_line SET debit_amount = '-9223372036854775809'"), { code: "22003" });
  });
});

test("MON-003 clean install has all manifest types and can store values beyond int32", async () => {
  await withDatabase(async (pool, url) => {
    applyCurrent(url);
    await assertTypes(pool, true);
    await seedEveryMoneyTable(pool);
    for (const column of money) {
      await pool.query(`UPDATE ${quote(column.table)} SET ${quote(column.column)} = '2147483648'`);
      assert.equal((await pool.query(`SELECT ${quote(column.column)}::text AS value FROM ${quote(column.table)}`)).rows[0].value, "2147483648");
    }
  });
});

test("MON-003 lock timeout rolls back earlier table rewrites and migration history", async () => {
  await withDatabase(async (pool, url) => {
    await historicalSchema(pool, coverage.checkpoint);
    await seedEveryMoneyTable(pool);
    const before = await checksums(pool);
    const blocker = new pg.Client({ connectionString: url });
    await blocker.connect();
    try {
      await blocker.query("BEGIN");
      // The first table (organization) is widened before this later lock fails.
      await blocker.query("LOCK TABLE journal_line IN ACCESS SHARE MODE");
      const result = runMigration(url);
      assert.equal(result.status, 1);
      assert.match(result.stderr, /lock timeout/);
    } finally {
      await blocker.query("ROLLBACK"); await blocker.end();
    }
    await assertTypes(pool, false);
    assert.deepEqual(await checksums(pool), before);
    assert.equal((await pool.query("SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations")).rows[0].count, 5);
    applyCurrent(url);
    await assertTypes(pool, true);
    assert.deepEqual(await checksums(pool), before);
  });
});

test("MON-003 pre-expansion backup restores exact rows and can upgrade independently", async () => {
  const folder = await mkdtemp(path.join(tmpdir(), "dubbl-mon003-backup-"));
  const backup = path.join(folder, "before.dump");
  const executable = (name: string) => process.env.PG_BIN
    ? path.join(process.env.PG_BIN, process.platform === "win32" ? `${name}.exe` : name) : name;
  try {
    await withDatabase(async (source, sourceUrl) => {
      await historicalSchema(source, coverage.checkpoint);
      await seedEveryMoneyTable(source);
      const before = await checksums(source);
      const dump = spawnSync(executable("pg_dump"), ["--format=custom", "--no-owner", "--no-privileges", "--file", backup, sourceUrl],
        { encoding: "utf8", timeout: 120_000 });
      assert.equal(dump.status, 0, "Synthetic fixture pg_dump failed; configure a matching PostgreSQL client via PG_BIN.");
      applyCurrent(sourceUrl);
      assert.deepEqual(await checksums(source), before);
      await withDatabase(async (restored, restoredUrl) => {
        const restore = spawnSync(executable("pg_restore"), ["--exit-on-error", "--no-owner", "--no-privileges", "--dbname", restoredUrl, backup],
          { encoding: "utf8", timeout: 120_000 });
        assert.equal(restore.status, 0, "Synthetic fixture pg_restore failed.");
        await assertTypes(restored, false);
        assert.deepEqual(await checksums(restored), before);
        applyCurrent(restoredUrl);
        await assertTypes(restored, true);
        assert.deepEqual(await checksums(restored), before);
      });
    });
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});
