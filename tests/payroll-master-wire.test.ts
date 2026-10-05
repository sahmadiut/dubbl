import assert from "node:assert/strict";
import { test } from "node:test";
import { employeeCreateSchema, employeeUpdateSchema, contractorCreateSchema, payrollMasterAmounts, payrollMasterDto,
  payrollPaymentReadDto, payrollMasterQuery } from "../lib/api/payroll-master-wire";
import { WireCompatibilityError } from "../lib/money/wire";
import { payrollCentsInput, payrollCentsDecimal, payrollBasisPointsInput, payrollCentsPreview, payrollPeriodPreview } from "../lib/money/payroll-input";
import { bankMoneyDisplay } from "../lib/money/bank-display";

const base = { name: "Employee", employeeNumber: "E1", startDate: "2024-02-29" };
test("payroll master aliases retain cents, safe boundaries, nullable clearing and omission", () => {
  for (const currency of ["USD", "IRR", "KWD", "JPY"]) {
    const result = payrollMasterAmounts(employeeCreateSchema.parse({ ...base, currency, salaryMinor: "1250", hourlyRateMinor: "0" }), true);
    assert.equal(result.salary, 1250); assert.equal(result.hourlyRate, 0); assert.equal(result.currency, currency);
    assert.equal("salaryMinor" in result, false);
  }
  assert.equal(payrollMasterAmounts(employeeCreateSchema.parse({ ...base, salary: 3000000000, salaryMinor: "3000000000" }), true).salary, 3000000000);
  assert.equal(payrollMasterAmounts(employeeCreateSchema.parse({ ...base, salaryMinor: "9007199254740991" }), true).salary, Number.MAX_SAFE_INTEGER);
  assert.deepEqual(payrollMasterAmounts(employeeUpdateSchema.parse({ hourlyRateMinor: null })), { hourlyRate: null });
  assert.deepEqual(payrollMasterAmounts(employeeUpdateSchema.parse({})), {});
  assert.equal(payrollMasterAmounts(contractorCreateSchema.parse({ name: "Contractor", hourlyRate: 29, hourlyRateMinor: "29" })).hourlyRate, 29);
});
test("invalid, conflicting or unsupported payroll master money is rejected", () => {
  for (const input of [{}, { salary: -1 }, { salary: 0.5 }, { salary: -0 }, { salaryMinor: "01" }, { salaryMinor: "-0" },
    { salaryMinor: "-1" }, { salaryMinor: "1e3" }, { salaryMinor: " 1" }, { salaryMinor: "۱" }, { salary: 1, salaryMinor: "2" },
    { salary: 0, hourlyRate: null, hourlyRateMinor: "0" }, { salary: 0, hourlyRate: 0, hourlyRateMinor: null }, { salaryMinor: "9223372036854775808" }]) {
    assert.throws(() => payrollMasterAmounts(employeeCreateSchema.parse({ ...base, ...input }), true));
  }
  for (const salaryMinor of ["9007199254740992", "9223372036854775807"]) assert.throws(() => payrollMasterAmounts(employeeCreateSchema.parse({ ...base, salaryMinor }), true), WireCompatibilityError);
});
test("payroll master dates, tax units, currencies and strict fields are validated", () => {
  for (const extra of [{ startDate: "2023-02-29" }, { endDate: "2024-04-31" }, { startDate: "2024-2-29" },
    { taxRate: 10001 }, { taxRate: 1.5 }, { currency: "UNKNOWN" }, { memberId: "invalid" }, { unexpected: true }])
    assert.throws(() => employeeCreateSchema.parse({ ...base, salary: 0, ...extra }));
  assert.equal(employeeCreateSchema.parse({ ...base, salary: 0, currency: " usd " }).currency, "USD");
});
test("saved payroll DTOs add only money aliases and classify malformed history", () => {
  const row = { currency: "KWD", salary: Number.MAX_SAFE_INTEGER, hourlyRate: null, taxRate: 2000, ptoBalanceHours: 0.5 };
  assert.deepEqual(payrollMasterDto(row), { ...row, salaryMinor: "9007199254740991", hourlyRateMinor: null });
  assert.equal(payrollMasterDto({ ...row, currency: null, hourlyRate: 0 }).hourlyRateMinor, "0");
  for (const extra of [{ salary: -1 }, { hourlyRate: 1.5 }, { currency: "usd" }, { taxRate: 10001 }, { ptoBalanceHours: Infinity }])
    assert.throws(() => payrollMasterDto({ ...row, ...extra }), WireCompatibilityError);
  assert.equal(payrollPaymentReadDto({ amount: -29, currency: "USD" }).amountMinor, "-29");
  assert.throws(() => payrollPaymentReadDto({ amount: Number.MAX_SAFE_INTEGER + 1, currency: "USD" }), WireCompatibilityError);
});
test("payroll list query strictly parses pagination and legacy active filter names", () => {
  assert.deepEqual(payrollMasterQuery(new URL("http://fixture/?isActive=false&page=2&limit=100"), true), { active: false, page: 2, limit: 100 });
  for (const query of ["page=0", "page=1.5", "page=2oops", "page=1000001", "limit=101", "active=yes", "limit=NaN"])
    assert.throws(() => payrollMasterQuery(new URL("http://fixture/?" + query)));
});
test("payroll cents editors round-trip maximum safe cents without floating-point math", () => {
  assert.equal(payrollCentsInput("0.29"), "29");
  assert.equal(payrollCentsInput(payrollCentsDecimal(Number.MAX_SAFE_INTEGER)), "9007199254740991");
  assert.equal(payrollCentsDecimal(0), "0.00"); assert.equal(payrollBasisPointsInput("20.29"), 2029);
  assert.equal(payrollCentsPreview("unfinished"), 0); assert.equal(payrollPeriodPreview(6, "monthly"), 1);
  assert.equal(payrollPeriodPreview(Number.MAX_SAFE_INTEGER, "monthly"), Number((BigInt(Number.MAX_SAFE_INTEGER) * 2n + 12n) / 24n));
  assert.equal(bankMoneyDisplay(Number.MAX_SAFE_INTEGER, "USD"), "$90,071,992,547,409.91");
  for (const input of ["", "0.291", "-1", "1e3", "90071992547409.92"]) assert.throws(() => payrollCentsInput(input));
  assert.throws(() => payrollBasisPointsInput("100.01"));
});
