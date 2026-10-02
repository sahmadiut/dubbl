import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { z } from "zod";
import { prepareBudgetLines, distributeBudgetAmount, budgetDto } from "../lib/api/budget-wire";
import { WireCompatibilityError } from "../lib/money/wire";
import { generatePeriods, type PeriodType } from "../lib/budget-periods";

const accountId = "11111111-1111-4111-8111-111111111111";
const period = { label: "Synthetic", startDate: "2026-01-01", endDate: "2026-01-31" };
const prepare = (lines: unknown) => prepareBudgetLines(lines, "monthly", "2026-01-01", "2026-03-31");

test("budget aliases preserve signed cents, defaults, exact sums and explicit-total precedence", () => {
  for (const total of [0, 1250, -1250, 2147483648, Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER]) {
    for (const aliases of [{ total }, { totalMinor: String(total) }, { total, totalMinor: String(total) }]) {
      const line = prepare([{ accountId, ...aliases }])[0];
      assert.equal(line.total, total);
      assert.equal(line.periods.reduce((sum, p) => sum + BigInt(p.amount), 0n), BigInt(total));
    }
  }
  assert.equal(prepare([{ accountId }])[0].total, 0);
  assert.equal(prepare([{ accountId, periods: [{ ...period }] }])[0].periods[0].amount, 0);
  assert.equal(prepare([{ accountId, periods: [{ ...period, amountMinor: "-1250" }] }])[0].total, -1250);
  assert.equal(prepare([{ accountId, totalMinor: "12", periods: [{ ...period, amountMinor: "10" }] }])[0].total, 12);
  const amounts = [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, -Number.MAX_SAFE_INTEGER];
  assert.equal(prepare([{ accountId, periods: amounts.map(amount => ({ ...period, amount })) }])[0].total, Number.MAX_SAFE_INTEGER);
});

test("budget allocation exactly conserves signed safe-range totals with existing floor/remainder ties", () => {
  assert.deepEqual(distributeBudgetAmount(-1, 3), [0, 0, -1]);
  assert.deepEqual(distributeBudgetAmount(1, 3), [1, 0, 0]);
  for (const total of [Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER]) {
    for (const count of [1, 3, 7, 10000]) {
      const parts = distributeBudgetAmount(total, count);
      assert.equal(parts.reduce((sum, value) => sum + BigInt(value), 0n), BigInt(total));
      assert.ok(parts.every(Number.isSafeInteger));
    }
  }
});

test("budget malformed/conflicting aliases and unsupported ranges reject before preparation", () => {
  for (const aliases of [{ total: 1, totalMinor: "2" }, { totalMinor: "01" }, { totalMinor: "-0" },
    { totalMinor: "1e3" }, { totalMinor: "۱" }, { totalMinor: "9223372036854775808" },
    { total: Number.MAX_SAFE_INTEGER + 1 }, { total: 0.5 }, { totalMinor: null }]) {
    assert.throws(() => prepare([{ accountId, ...aliases }]), z.ZodError);
  }
  assert.throws(() => prepare([{ accountId, periods: [{ ...period, amount: 1, amountMinor: "2" }] }]), z.ZodError);
  for (const totalMinor of ["9007199254740992", "-9223372036854775808"]) {
    assert.throws(() => prepare([{ accountId, totalMinor }]), WireCompatibilityError);
  }
  assert.throws(() => prepare([{ accountId, periods: [Number.MAX_SAFE_INTEGER, 1].map(amount => ({ ...period, amount })) }]), WireCompatibilityError);
  assert.throws(() => prepare([{ accountId, total: 0, periods: Array.from({ length: 2000 }, () => ({ ...period, amount: Number.MAX_SAFE_INTEGER })) }]), WireCompatibilityError);
  assert.throws(() => prepareBudgetLines([{ accountId }], "daily", "0001-01-01", "9999-12-31"), WireCompatibilityError);
  assert.throws(() => prepareBudgetLines([{ accountId }], "monthly", "2026-02-29", "2026-03-31"), z.ZodError);
  assert.throws(() => prepareBudgetLines([{ accountId }], "monthly", "2026-04-01", "2026-03-31"), z.ZodError);
  assert.throws(() => prepareBudgetLines([{ accountId }], "invalid" as PeriodType, "2026-01-01", "2026-03-31"), WireCompatibilityError);
});

test("budget DTO aliases retain safe numeric values and never repair an unsafe Number", () => {
  const result = budgetDto({ name: "Unchanged", lines: [{ total: -1250, periods: [{ amount: 1250 }] }] });
  assert.equal(result.lines[0].total, -1250); assert.equal(result.lines[0].totalMinor, "-1250");
  assert.equal(result.lines[0].periods[0].amountMinor, "1250");
  assert.throws(() => budgetDto({ lines: [{ total: Number.MAX_SAFE_INTEGER + 1, periods: [] }] }), WireCompatibilityError);
});

test("budget periods use canonical UTC days across Tehran/New York DST and early Gregorian years", () => {
  const source = `import {generatePeriods} from './lib/budget-periods.ts'; console.log(JSON.stringify(['daily','weekly','monthly','quarterly','yearly','custom'].map(type=>generatePeriods(type,'2026-03-01','2026-04-30'))));`;
  const outputs = ["UTC", "Asia/Tehran", "America/New_York"].map(TZ => {
    const result = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", source], { env: { ...process.env, TZ }, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout;
  });
  assert.equal(outputs[0], outputs[1]); assert.equal(outputs[0], outputs[2]);
  assert.equal(generatePeriods("monthly", "0001-01-01", "0001-02-28")[0].startDate, "0001-01-01");
  assert.equal(generatePeriods("yearly", "2024-01-01", "2024-12-31")[0].endDate, "2024-12-31");
});
