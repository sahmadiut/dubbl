import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { is, Table } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import * as schema from "../lib/db/schema/index";
import { decodeMoneyInteger, encodeMoneyInteger } from "../lib/db/money-column";

test("bigint storage bridge preserves legacy values and rejects precision loss", () => {
  for (const value of [0, -2147483648, 2147483647, 1250, 123456789, Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER]) {
    assert.equal(decodeMoneyInteger(encodeMoneyInteger(value)), value);
  }
  for (const value of ["9007199254740992", "-9007199254740992", "9223372036854775807", "-9223372036854775808"]) {
    assert.throws(() => decodeMoneyInteger(value), RangeError);
  }
  for (const value of [NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => encodeMoneyInteger(value), RangeError);
    assert.throws(() => decodeMoneyInteger(value), RangeError);
  }
  for (const value of ["", "1.5", "1e3", " 1250", "0x10"]) {
    assert.throws(() => decodeMoneyInteger(value), TypeError);
  }
});

test("every inventoried column matches the migration disposition and Drizzle type", () => {
  const coverage = JSON.parse(readFileSync(".agentic/registries/MONEY_BIGINT_MIGRATION.json", "utf8")) as {
    columns: { table: string; column: string; before: string; after: string; classification: string }[];
  };
  const columns = new Map<string, ReturnType<typeof getTableConfig>["columns"][number]>();
  for (const table of Object.values(schema)) {
    if (!is(table, Table)) continue;
    const config = getTableConfig(table);
    for (const column of config.columns) columns.set(`${config.name}.${column.name}`, column);
  }
  const widened = coverage.columns.filter(c => c.before !== c.after);
  assert.equal(widened.length, 195);
  assert.equal(coverage.columns.length, 402);
  for (const entry of coverage.columns) {
    assert.equal(columns.get(`${entry.table}.${entry.column}`)?.getSQLType(), entry.after);
    assert.equal(entry.after !== entry.before, ["money", "allocation_basis"].includes(entry.classification));
  }
  for (const entry of widened) {
    const column = columns.get(`${entry.table}.${entry.column}`)!;
    assert.equal(column.mapFromDriverValue("1250"), 1250);
    assert.equal(column.mapToDriverValue(1250), "1250");
    assert.throws(() => column.mapFromDriverValue("9007199254740993"), RangeError);
    assert.throws(() => column.mapToDriverValue(1.5), RangeError);
  }
});

test("committed migration casts exactly the inventoried money columns without rescaling", () => {
  const coverage = JSON.parse(readFileSync(".agentic/registries/MONEY_BIGINT_MIGRATION.json", "utf8")) as {
    columns: { table: string; column: string; before: string; after: string }[];
  };
  const expected = coverage.columns.filter(c => c.before !== c.after).map(c => `${c.table}.${c.column}`).sort();
  const sql = readFileSync("drizzle/0005_clear_senator_kelly.sql", "utf8");
  const actual: string[] = [];
  for (const table of sql.matchAll(/ALTER TABLE "([a-z_]+)"\s+([\s\S]*?);/g)) {
    for (const column of table[2].matchAll(/ALTER COLUMN "([a-z_]+)" TYPE bigint USING "([a-z_]+)"::bigint/g)) {
      assert.equal(column[1], column[2]);
      actual.push(`${table[1]}.${column[1]}`);
    }
  }
  assert.deepEqual(actual.sort(), expected);
  assert.doesNotMatch(sql, /\b(?:UPDATE|DELETE|DROP|TRUNCATE|INSERT)\b/);
  assert.match(sql, /SET LOCAL lock_timeout = '5s'/);
  assert.match(sql, /SET LOCAL statement_timeout = '15min'/);
});
