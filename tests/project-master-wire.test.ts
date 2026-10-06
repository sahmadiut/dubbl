import assert from "node:assert/strict";
import { test } from "node:test";
import { projectSchemas, projectAmounts, projectRowDto } from "../lib/api/project-master-wire";
import { projectOperations } from "../lib/api/project-master-operations";
import { projectCentsInput, projectCentsDecimal, projectTimeCents, projectHoursInput, projectHoursDecimal, projectWholeMinutes, projectMoneyDisplay } from "../lib/money/project-display";

test("project money aliases preserve cents, null overrides and safe numeric compatibility", () => {
  const parse = (input: unknown) => projectAmounts(projectSchemas.projectCreate.parse(input), ["budget", "hourlyRate", "fixedPrice"], true);
  assert.deepEqual(parse({ name: "Exact", budgetMinor: "1250", hourlyRateMinor: "9007199254740991", fixedPrice: 2, fixedPriceMinor: "2" }), { name: "Exact", budget: 1250, hourlyRate: Number.MAX_SAFE_INTEGER, fixedPrice: 2 });
  for (const value of ["-0", "01", "1.0", "1e2", " 1", "۱۲", "9007199254740992", "x", "" ]) assert.throws(() => parse({ name: "Bad", budgetMinor: value }));
  for (const value of [-0, -1, 0.1, NaN, Infinity, 9007199254740992]) assert.throws(() => parse({ name: "Bad", budget: value }));
  assert.throws(() => parse({ name: "Bad", budget: 1, budgetMinor: "2" }));
  const nullable = projectSchemas.memberUpdate.parse({ memberId: "00000000-0000-4000-8000-000000000001", hourlyRateMinor: null });
  assert.equal(projectAmounts(nullable, ["hourlyRate"]).hourlyRate, null);
  assert.throws(() => projectAmounts({ hourlyRate: 1, hourlyRateMinor: null }, ["hourlyRate"]));
});
test("project physical minutes, percent, chronology and saved money remain distinct", () => {
  assert.equal(projectSchemas.timeCreate.parse({ date: "2024-02-29", minutes: 2147483647 }).minutes, 2147483647);
  for (const minutes of [0, -1, 0.5, 2147483648, "60"]) assert.throws(() => projectSchemas.timeCreate.parse({ date: "2024-02-29", minutes }));
  assert.throws(() => projectSchemas.timeCreate.parse({ date: "2023-02-29", minutes: 1 }));
  for (const progressPercent of [-1, 101, 1.5, "50"]) assert.throws(() => projectSchemas.milestoneUpdate.parse({ progressPercent }));
  assert.throws(() => projectSchemas.projectCreate.parse({ name: "Bad", estimatedHoursMinor: "60" }));
  assert.equal(projectRowDto("member", { hourlyRate: null, costRate: 0 }).hourlyRateMinor, null);
  assert.equal(projectRowDto("project", { budget: 1250, hourlyRate: 0, fixedPrice: 0, totalBilled: 0, currency: "JPY" }).budgetMinor, "1250");
  assert.throws(() => projectRowDto("time", { minutes: 1, hourlyRate: 9007199254740992 }));
  assert.throws(() => projectRowDto("milestone", { amount: 2, invoicedAmountCents: 3, progressPercent: 0 }));
  assert.throws(() => projectRowDto("task", { startDate: "2024-02-02", dueDate: "2024-01-01" }));
});
test("project editors and time valuations use exact decimal and rational arithmetic", () => {
  assert.equal(projectCentsInput("90071992547409.91"), "9007199254740991");
  assert.equal(projectCentsDecimal(Number.MAX_SAFE_INTEGER), "90071992547409.91");
  assert.equal(projectTimeCents(1, Number.MAX_SAFE_INTEGER), (9007199254740991n + 30n) / 60n);
  assert.equal(projectTimeCents(30, 1), 1n);
  assert.equal(projectTimeCents(2147483647, Number.MAX_SAFE_INTEGER), (2147483647n * 9007199254740991n + 30n) / 60n);
  assert.equal(projectHoursInput("1.025"), 62); assert.equal(projectHoursInput("0.5"), 30);
  for (const minutes of [1, 2, 59, 60, 62, 2147483647]) assert.equal(projectHoursInput(projectHoursDecimal(minutes)), minutes);
  assert.equal(projectWholeMinutes("2147483647"), 2147483647);
  assert.throws(() => projectHoursInput("1e3")); assert.throws(() => projectWholeMinutes("60x"));
  assert.throws(() => projectCentsInput("1.001"));
  assert.match(projectMoneyDisplay(9007199254740991n), /90,071,992,547,409\.91/);
  assert.match(projectMoneyDisplay(1250, "JPY"), /12\.50/);
});
test("all project operations publish strict described schemas and separate tools", () => {
  assert.equal(projectOperations.length, 48);
  assert.equal(new Set(projectOperations.map(o => o.name)).size, 48);
  for (const op of projectOperations) {
    assert.ok(op.description.includes("integer cents"));
    for (const [key, field] of Object.entries(op.schema.shape)) assert.ok(field.description, `${op.name}.${key}`);
  }
});
