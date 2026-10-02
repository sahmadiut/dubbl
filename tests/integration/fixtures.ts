import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, mkdir, readFile, copyFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

// Explicit opt-in only. Never migrate, seed, reset or drop the connection target.
// Each case creates and drops its own randomly named database on this server.
const target = new URL(process.env.TEST_DATABASE_URL ?? "missing://configuration");
assert.ok(
  ["postgres:", "postgresql:"].includes(target.protocol) &&
    ["localhost", "127.0.0.1", "[::1]"].includes(target.hostname),
  "Set TEST_DATABASE_URL explicitly to a local PostgreSQL test server (CREATEDB required).",
);

const migrationsDir = path.resolve("drizzle");
export const journal = JSON.parse(await readFile(path.join(migrationsDir, "meta/_journal.json"), "utf8")) as {
  entries: { tag: string; when: number }[];
};
// Pinned historical schema checkpoint, not a claim of a tagged product release.
export const previousCheckpoint = "0003_same_frog_thor";
assert.ok(journal.entries.some(({ tag }) => tag === previousCheckpoint));

export async function withDatabase(run: (pool: pg.Pool, url: string) => Promise<void>) {
  const name = `dubbl_ci_${randomUUID().replaceAll("-", "")}`;
  assert.match(name, /^dubbl_ci_[a-f0-9]{32}$/);
  const admin = new pg.Pool({ connectionString: target.href, max: 1 });
  let pool: pg.Pool | undefined;
  let created = false;
  try {
    await admin.query(`CREATE DATABASE "${name}" TEMPLATE template0`);
    created = true;
    const url = new URL(target.href);
    url.pathname = `/${name}`;
    pool = new pg.Pool({ connectionString: url.href, max: 1 });
    await run(pool, url.href);
  } finally {
    try {
      await pool?.end();
      if (created) await admin.query(`DROP DATABASE "${name}"`);
    } finally {
      await admin.end();
    }
  }
}

export async function historicalSchema(pool: pg.Pool, checkpoint: string, untracked = false) {
  const last = journal.entries.findIndex(({ tag }) => tag === checkpoint);
  assert.ok(last >= 0, "Historical checkpoint must exist in committed journal");
  const folder = await mkdtemp(path.join(tmpdir(), "dubbl-ci-migrations-"));
  try {
    await mkdir(path.join(folder, "meta"));
    await writeFile(path.join(folder, "meta/_journal.json"), JSON.stringify({
      ...journal, entries: journal.entries.slice(0, last + 1),
    }));
    for (const { tag } of journal.entries.slice(0, last + 1)) {
      await copyFile(path.join(migrationsDir, `${tag}.sql`), path.join(folder, `${tag}.sql`));
    }
    await migrate(drizzle(pool), { migrationsFolder: folder });
    if (untracked) await pool.query('DROP SCHEMA "drizzle" CASCADE');
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
}

export function runMigration(url: string) {
  return spawnSync(process.execPath, ["--import", "tsx", "scripts/db-migrate.ts"], {
    env: { ...process.env, DATABASE_URL: url },
    encoding: "utf8",
    timeout: 120_000,
  });
}

export function applyCurrent(url: string) {
  const result = runMigration(url);
  // Do not echo environment variables or credential-bearing process errors.
  assert.equal(result.status, 0, `Migration CLI failed (exit ${result.status}); inspect migrations locally.`);
  assert.match(result.stdout, /Migrations applied\./);
  return result.stdout;
}

