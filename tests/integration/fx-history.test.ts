import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "../../lib/db/schema";
import { processExchangeRateSync } from "../../lib/currency/rate-sync";
import { createHistoricalRateResolver } from "../../lib/currency/historical-rate";
import type { RateFeed, RateProvider } from "../../lib/currency/rate-provider";
import { withDatabase, applyCurrent, historicalSchema } from "./fixtures";

const now = new Date("2026-10-02T12:00:00Z");
const feed = (rates: Record<string, string> = { EUR: "0.9", GBP: "0.8" }): RateFeed => ({
  provider: "exchangerate-api", base: "USD", date: "2026-10-02", rates,
  observedAt: "2026-10-02T00:00:00.000Z", importedAt: now.toISOString(),
});
const provider = (value: RateFeed): RateProvider => ({ name: value.provider, fetchRates: async () => value });

test("MON-005 upgrade preserves old quotes; sync rejects per-tenant extremes and retains manual overrides", async () => {
  await withDatabase(async (pool, url) => {
    await historicalSchema(pool, "0006_new_susan_delgado");
    const { rows: [a] } = await pool.query("INSERT INTO organization (name, slug) VALUES ('FX A', 'fx-a') RETURNING id");
    const { rows: [b] } = await pool.query("INSERT INTO organization (name, slug) VALUES ('FX B', 'fx-b') RETURNING id");
    await pool.query(`INSERT INTO exchange_rate (organization_id, base_currency, target_currency, rate, date, source) VALUES
      ($1, 'USD', 'EUR', 900000, '2026-10-01', 'api'), ($2, 'USD', 'EUR', 400000, '2026-10-01', 'api'),
      ($1, 'USD', 'GBP', 770000, '2026-10-02', 'manual')`, [a.id, b.id]);
    const old = (await pool.query("SELECT to_jsonb(t)::text AS value FROM exchange_rate t ORDER BY id")).rows;
    applyCurrent(url);
    const fields = ['provider','provider_base','provider_quote','provider_observed_at','imported_at','provider_rounding'];
    assert.deepEqual((await pool.query("SELECT (to_jsonb(t) - $1::text[])::text AS value FROM exchange_rate t ORDER BY id", [fields])).rows, old);
    const database = drizzle(pool, { schema });
    const result = await processExchangeRateSync({ database, provider: provider(feed({ EUR: "0.95", GBP: "0.8", IRR: "1500000" })), now });
    assert.equal(result.rejectedExtreme, 1);
    assert.equal(result.rejectedCompatibility, 2);
    assert.equal(result.upserts, 2);
    assert.equal(result.skipped, 1);
    const lookupA = createHistoricalRateResolver(a.id, database), lookupB = createHistoricalRateResolver(b.id, database);
    assert.equal((await lookupA("USD", "EUR", "2026-10-02"))?.rateExact, "0.95");
    assert.equal((await lookupB("USD", "EUR", "2026-10-02"))?.rateExact, "0.4");
    assert.equal((await lookupA("USD", "GBP", "2026-10-02"))?.source, "manual");
    const { rows: [saved] } = await pool.query("SELECT * FROM exchange_rate WHERE organization_id=$1 AND target_currency='EUR' AND date='2026-10-02'", [a.id]);
    assert.equal(saved.provider, "exchangerate-api");
    assert.equal(saved.provider_quote, "0.95");
    assert.equal(saved.provider_observed_at.toISOString(), "2026-10-02T00:00:00.000Z");
    assert.equal(saved.imported_at.toISOString(), now.toISOString());
    // Repeated invocation counts actual writes, not attempted manual conflicts.
    assert.equal((await processExchangeRateSync({ database, provider: provider(feed({ EUR: "0.95", GBP: "0.8", IRR: "1500000" })), now })).upserts, 2);
  });
});

test("MON-005 unavailable/poisoned/stale providers preserve all stored rows and manual history", async () => {
  await withDatabase(async (pool, url) => {
    await historicalSchema(pool, "0005_clear_senator_kelly");
    const { rows: [org] } = await pool.query("INSERT INTO organization (name, slug) VALUES ('FX', 'fx') RETURNING id");
    await pool.query(`INSERT INTO exchange_rate (organization_id, base_currency, target_currency, rate, date)
      VALUES ($1, 'USD', 'EUR', 900000, '2026-10-01'), ($1, 'USD', 'JPY', 0, '2026-10-01')`, [org.id]);
    applyCurrent(url);
    const before = (await pool.query("SELECT * FROM exchange_rate")).rows;
    const database = drizzle(pool, { schema });
    assert.equal(await createHistoricalRateResolver(org.id, database)("USD", "JPY", "2026-10-02"), null);
    for (const source of [
      { name: "exchangerate-api", fetchRates: async () => { throw new Error("synthetic provider outage"); } },
      provider({ ...feed(), rates: { EUR: "0" } }), provider({ ...feed(), date: "2026-09-01" }),
      provider({ ...feed(), rates: { EUR: "1e1000" } }),
    ]) {
      const result = await processExchangeRateSync({ database, provider: source, now });
      assert.equal(result.failedBases, 1); assert.equal(result.upserts, 0);
      assert.deepEqual((await pool.query("SELECT * FROM exchange_rate")).rows, before);
    }
  });
});

test("MON-005 public feed reuse and concurrent refreshes do not mix tenant overrides or duplicate rows", async () => {
  await withDatabase(async (pool, url) => {
    applyCurrent(url);
    const { rows: orgs } = await pool.query(`INSERT INTO organization (name, slug, default_currency) VALUES
      ('FX A', 'fx-a', 'USD'), ('FX B', 'fx-b', 'USD'), ('FX C', 'fx-c', 'EUR') RETURNING id, slug`);
    const orgA = orgs.find(row => row.slug === "fx-a")!.id;
    await pool.query(`INSERT INTO exchange_rate (organization_id, base_currency, target_currency, rate, date)
      VALUES ($1, 'USD', 'EUR', 700000, '2026-10-02')`, [orgA]);
    const concurrent = new pg.Pool({ connectionString: url, max: 3 });
    try {
      const database = drizzle(concurrent, { schema });
      let fetches = 0;
      const source = { name: "exchangerate-api", fetchRates: async () => { fetches++; return feed(); } };
      const results = await Promise.all([
        processExchangeRateSync({ database, provider: source, now }),
        processExchangeRateSync({ database, provider: source, now }),
      ]);
      assert.equal(fetches, 2, "Each invocation reuses its public USD feed for EUR base");
      assert.ok(results.every(result => result.upserts === 5 && result.skipped === 1));
      assert.equal((await pool.query("SELECT count(*)::int AS count FROM exchange_rate")).rows[0].count, 6);
      assert.equal((await createHistoricalRateResolver(orgA, database)("USD", "EUR", "2026-10-02"))?.rateExact, "0.7");
      // Older source observations cannot overwrite a newer observation for the same day.
      const newer = { ...feed(), observedAt: "2026-10-02T02:00:00.000Z" };
      await processExchangeRateSync({ database, provider: provider(newer), now });
      assert.equal((await processExchangeRateSync({ database, provider: provider(feed()), now })).upserts, 0);
    } finally { await concurrent.end(); }
  });
});

test("MON-005 lookup caches isolate tenant/pair/as-of/effective dates and never look into future", async () => {
  await withDatabase(async (pool, url) => {
    applyCurrent(url);
    const { rows: [a] } = await pool.query("INSERT INTO organization (name, slug) VALUES ('FX A', 'fx-a') RETURNING id");
    const { rows: [b] } = await pool.query("INSERT INTO organization (name, slug) VALUES ('FX B', 'fx-b') RETURNING id");
    await pool.query(`INSERT INTO exchange_rate (organization_id, base_currency, target_currency, rate, date) VALUES
      ($1, 'USD', 'EUR', 900000, '2026-10-01'), ($1, 'USD', 'EUR', 950000, '2026-10-02'),
      ($1, 'USD', 'GBP', 800000, '2026-10-01'), ($2, 'USD', 'EUR', 400000, '2026-10-01')`, [a.id, b.id]);
    const database = drizzle(pool, { schema });
    const aRates = createHistoricalRateResolver(a.id, database), bRates = createHistoricalRateResolver(b.id, database);
    const old = await aRates("USD", "EUR", "2026-10-01");
    assert.equal(old?.rateExact, "0.9");
    assert.strictEqual(await aRates("USD", "EUR", "2026-10-01"), old);
    assert.equal((await aRates("USD", "EUR", "2026-10-02"))?.rateExact, "0.95");
    assert.equal((await bRates("USD", "EUR", "2026-10-02"))?.rateExact, "0.4");
    assert.equal((await aRates("USD", "GBP", "2026-10-01"))?.rateExact, "0.8");
    assert.equal((await aRates("EUR", "USD", "2026-10-01"))?.rateExact, "1.111111111111111111");
    assert.equal((await aRates("EUR", "USD", "2026-10-01"))?.rate, 1111111);
    assert.equal(await aRates("USD", "EUR", "2026-09-30"), null);
    assert.equal(await bRates("USD", "GBP", "2026-10-01"), null);
    await pool.query("UPDATE exchange_rate SET rate=1000000 WHERE organization_id=$1 AND date='2026-10-01' AND target_currency='EUR'", [a.id]);
    assert.strictEqual(await aRates("USD", "EUR", "2026-10-01"), old);
    assert.equal((await createHistoricalRateResolver(a.id, database)("USD", "EUR", "2026-10-01"))?.rateExact, "1");
    assert.throws(() => aRates("USD", "EUR", "2026-02-29"));
  });
});

test("MON-005 actual invoice posting keeps its saved rates/amounts through refresh and manual override", async () => {
  await withDatabase(async (_pool, url) => {
    applyCurrent(url);
    const result = spawnSync(process.execPath, ["--import", "tsx", "tests/integration/fx-history-worker.ts"], {
      env: { ...process.env, DATABASE_URL: url }, encoding: "utf8", timeout: 30000,
    });
    assert.equal(result.status, 0, `Posting worker failed: ${result.stdout} ${result.stderr}`);
    assert.match(result.stdout, /Invoice history preserved/);
  });
});
