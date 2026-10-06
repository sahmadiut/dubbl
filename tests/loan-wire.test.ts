import assert from "node:assert/strict";
import { test } from "node:test";
import { calculatePMT, generateAmortizationSchedule, loanPaymentDate } from "../lib/api/amortization";
import { loanPrincipal, loanScheduleDto, loanPaymentSchema, loanQuery } from "../lib/api/loan-wire";
import { assetCentsInput, assetMoneyDisplay } from "../lib/money/asset-display";
const input = { name: "Loan", interestRate: 500, termMonths: 12, startDate: "2024-01-01",
  principalAccountId: "00000000-0000-4000-8000-000000000001", interestAccountId: "00000000-0000-4000-8000-000000000002" };
test("loan REST major and MCP minor aliases preserve units and exact maximal-safe cents", () => {
  assert.equal(loanPrincipal({ ...input, principalAmount: 12.5 }, "rest").principalAmount, 1250);
  assert.equal(loanPrincipal({ ...input, principalAmountExact: "12.505", principalAmountMinor: "1251" }, "rest").principalAmount, 1251);
  assert.equal(loanPrincipal({ ...input, principalAmount: 1250, principalAmountMinor: "1250" }, "mcp").principalAmount, 1250);
  assert.equal(loanPrincipal({ ...input, principalAmountExact: "90071992547409.91", principalAmountMinor: "9007199254740991" }, "rest").principalAmount, Number.MAX_SAFE_INTEGER);
  assert.equal(assetCentsInput("90071992547409.91"), "9007199254740991");
  assert.equal(assetMoneyDisplay(9007199254740991n), "$90,071,992,547,409.91");
});
test("loan input rejects alias conflicts, malformed dates/rates/counts and unsupported money", () => {
  for (const bad of [{}, { principalAmountMinor: "0" }, { principalAmountMinor: "-1" }, { principalAmountMinor: "01" },
    { principalAmountMinor: "9007199254740992" }, { principalAmountMinor: "1251", principalAmount: 1250 },
    { principalAmount: 1.1 }, { principalAmount: Number.MAX_SAFE_INTEGER + 1 }, { principalAmount: 100, startDate: "2024-02-30" },
    { principalAmount: 100, interestRate: 1.5 }, { principalAmount: 100, interestRate: 100001 },
    { principalAmount: 100, termMonths: 1201 }, { principalAmount: 100, termMonths: 0 }, { principalAmount: 100, rateExact: "1" }])
    assert.throws(() => loanPrincipal({ ...input, ...bad }, "mcp"));
  for (const principalAmountExact of ["1e2", " 12.50", "12,50", "-1", "NaN", "9".repeat(257)])
    assert.throws(() => loanPrincipal({ ...input, principalAmountExact }, "rest"));
  assert.throws(() => loanPrincipal({ ...input, principalAmount: 1e-7 }, "rest"));
  assert.throws(() => loanPaymentSchema.parse({ amountMinor: "1" }));
  assert.throws(() => loanQuery(new URL("http://fixture/?page=1.5")));
});
test("rational PMT and per-period interest match independently specified cents", () => {
  assert.equal(calculatePMT(1000000, 500, 12), 85607);
  const schedule = generateAmortizationSchedule(1000000, 500, 12, "2024-01-01");
  assert.deepEqual(schedule[0], { periodNumber: 1, date: "2024-02-01", principalAmount: 81440, interestAmount: 4167, totalPayment: 85607, remainingBalance: 918560 });
  assert.equal(schedule.reduce((s, r) => s + BigInt(r.principalAmount), 0n), 1000000n);
  assert.equal(schedule.at(-1)!.remainingBalance, 0);
  assert.equal(schedule.at(-1)!.totalPayment, 85612);
  assert.ok(schedule.every(r => BigInt(r.principalAmount) + BigInt(r.interestAmount) === BigInt(r.totalPayment)));
  assert.equal(generateAmortizationSchedule(1250, 0, 3, "2024-01-01").at(-1)!.principalAmount, 416);
});
test("full safe precision and aggregate overflow are guarded without floating math", () => {
  const schedule = generateAmortizationSchedule(Number.MAX_SAFE_INTEGER, 0, 1, "2024-01-01");
  assert.equal(loanScheduleDto(schedule[0]).totalPaymentMinor, "9007199254740991");
  assert.throws(() => generateAmortizationSchedule(Number.MAX_SAFE_INTEGER, 1, 1, "2024-01-01"));
  assert.throws(() => generateAmortizationSchedule(1, 0, 3, "2024-01-01"));
  assert.throws(() => generateAmortizationSchedule(1, 0, 2, "2024-01-01"));
  assert.throws(() => loanScheduleDto({ ...schedule[0], totalPayment: Number.MAX_SAFE_INTEGER + 1 }));
  const bounded = generateAmortizationSchedule(100000000, 1, 1200, "2024-01-01");
  assert.equal(bounded.length, 1200); assert.equal(bounded.at(-1)!.remainingBalance, 0);
});
test("month overflow is UTC stable and canonical date range is enforced", () => {
  const before = process.env.TZ;
  try {
    for (const tz of ["UTC", "America/Los_Angeles", "Asia/Tehran"]) {
      process.env.TZ = tz;
      assert.equal(loanPaymentDate("2024-01-31", 1), "2024-03-02");
      assert.equal(loanPaymentDate("2024-02-29", 12), "2025-03-01");
    }
    assert.throws(() => loanPaymentDate("2024-02-30", 1));
    assert.throws(() => loanPaymentDate("0000-01-01", 1));
    assert.throws(() => loanPaymentDate("9999-12-31", 1));
  } finally { if (before === undefined) delete process.env.TZ; else process.env.TZ = before; }
});
