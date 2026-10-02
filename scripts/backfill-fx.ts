/** Explicit maintenance operation. Each batch commits independently; reruns skip completed rows.
 * DATABASE_URL must identify the authorized target; never load .env implicitly.
 */
import pg from "pg";

const tables = ["exchange_rate", "journal_line", "consolidation_rate", "payroll_item"] as const;
const size = Number(process.env.FX_BACKFILL_BATCH_SIZE ?? 500);
if (!Number.isInteger(size) || size < 1 || size > 10000) throw new RangeError("FX_BACKFILL_BATCH_SIZE must be 1..10000");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
try {
  await pool.query("SET lock_timeout = '5s'");
  await pool.query("SET statement_timeout = '60s'");
  for (const table of tables) {
    let count = 0;
    let batch;
    do {
      const result = await pool.query("SELECT public.backfill_exact_fx($1, $2) AS count", [table, size]);
      batch = result.rows[0].count as number;
      count += batch;
    } while (batch > 0);
    // SKIP LOCKED may leave pending rows held by another worker; explicitly report them.
    const { rows: [remaining] } = await pool.query(`SELECT count(*)::text AS count FROM public.${table} WHERE rate_migration_status = 'pending'`);
    console.log(JSON.stringify({ table, processed: count, pending: remaining.count }));
    if (remaining.count !== "0") process.exitCode = 2;
  }
} catch {
  console.error("FX backfill failed; completed batches are retained. Inspect the authorized target locally and rerun.");
  process.exitCode = 1;
} finally {
  await pool.end();
}
