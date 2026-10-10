import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { test } from "node:test";
import { applyCurrent, withDatabase } from "./fixtures";

test("MON-034 every persisted JSON declaration has a boundary owner", async () => {
  const registry = await readFile(".agentic/registries/OPAQUE_PUBLIC_INTEGRATION_CONTRACTS.md", "utf8");
  const ownership = JSON.parse(registry.match(/<!-- JSON ownership -->\s*```json\s*([\s\S]*?)```/)![1]) as Record<string, string[]>;
  const actual: Record<string, string[]> = {};
  for (const file of (await readdir("lib/db/schema")).filter(name => name.endsWith(".ts")).sort()) {
    const source = await readFile(`lib/db/schema/${file}`, "utf8");
    const fields = [...source.matchAll(/\b(\w+):\s*jsonb\(/g)].map(match => match[1]).sort();
    if (fields.length) actual[file] = fields;
  }
  assert.deepEqual(actual, Object.fromEntries(Object.entries(ownership).map(([file, fields]) => [file, [...fields].sort()])));
  for (const match of registry.matchAll(/\]\(([^)]+\.md)\)/g)) {
    await readFile(new URL(`../../.agentic/registries/${match[1]}`, import.meta.url));
  }
});

test("MON-034 snapshots, audit, signing and public rendering compose without unit loss", async () => {
  await withDatabase(async (_pool, url) => {
    applyCurrent(url);
    const result = spawnSync(process.execPath, ["--import", "tsx", "tests/integration/opaque-public-integration-worker.ts"], {
      env: { ...process.env, DATABASE_URL: url, STRIPE_SECRET_KEY: "", RESEND_API_KEY: "", IRR_PRODUCTION_ENABLED: "false" },
      encoding: "utf8", timeout: 180000,
    });
    assert.equal(result.status, 0, `Opaque/public integration failed: ${result.stdout} ${result.stderr}`);
    assert.match(result.stdout, /Combined opaque public contracts verified/);
  });
});
