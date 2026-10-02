// Source-only cross-check using Drizzle's actual exported table metadata.
// Run: node --import tsx .agentic/scripts/verify_money_inventory.mjs
import * as schema from "../../lib/db/schema/index.ts";
import { is, Table } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const root = fileURLToPath(new URL("../../", import.meta.url));
const inventory = JSON.parse(readFileSync(resolve(root, ".agentic/registries/MONEY_BOUNDARIES.json"), "utf8"));
const actual = [];
for (const table of Object.values(schema)) {
  if (!is(table, Table)) continue;
  const config = getTableConfig(table);
  for (const column of config.columns) {
    if (["integer", "bigint", "numeric", "real", "double precision", "jsonb"].includes(column.getSQLType())) {
      actual.push(`${config.name}.${column.name}`);
    }
  }
}
const listed = inventory.schema_columns.map((c) => `${c.table}.${c.column}`);
const errors = [];
for (const key of actual) if (!listed.includes(key)) errors.push(`Missing column: ${key}`);
for (const key of listed) if (!actual.includes(key)) errors.push(`Extra column: ${key}`);
if (new Set(listed).size !== listed.length) errors.push("Duplicate column");
for (const c of inventory.schema_columns) {
  const line = readFileSync(resolve(root, c.path), "utf8").split(/\r?\n/)[c.line - 1];
  if (!line?.includes(`${c.key.split(".")[1]}:`)) errors.push(`Invalid column line: ${c.key}`);
  for (const key of ["units", "storage_range", "currency_source", "migration_owner", "classification"]) {
    if (!c[key]) errors.push(`Missing ${key}: ${c.key}`);
  }
}
const patterns = Object.fromEntries(Object.entries(inventory.patterns).map(([k, v]) => [k, new RegExp(v)]));
for (const consumer of inventory.consumers) {
  const source = readFileSync(resolve(root, consumer.path), "utf8").replaceAll("\r\n", "\n");
  if (createHash("sha256").update(source).digest("hex") !== consumer.sha256) errors.push(`Source drift: ${consumer.path}`);
  const lines = source.split("\n");
  for (const occurrence of consumer.occurrences) {
    const line = lines[occurrence.line - 1];
    if (line === undefined) errors.push(`Invalid consumer line: ${consumer.path}:${occurrence.line}`);
    for (const tag of occurrence.patterns) {
      if (tag !== "column_name" && !patterns[tag]?.test(line)) errors.push(`Pattern mismatch: ${consumer.path}:${occurrence.line} (${tag})`);
    }
  }
}
if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Verified ${listed.length} columns against Drizzle, ${inventory.consumers.length} consumer hashes and all occurrence/source lines.`);
}
