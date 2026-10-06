import assert from "node:assert/strict";
import { test } from "node:test";
import { reportInput, outputQuery, taxDataDto, deductionPayload, payrollCentsText, payrollCsvCell, selfProfileSchema } from "../lib/api/payroll-output-wire";
import { payrollSum, payrollRatio } from "../lib/payroll/exact";
import { payrollMoneyDisplay } from "../lib/money/payroll-display";

test("Payroll report dates and filters reject malformed/reversed values", () => {
  assert.deepEqual(reportInput({ startDate: "2024-02-29", endDate: "2024-03-01" }), { startDate: "2024-02-29", endDate: "2024-03-01" });
  for (const p of [{ startDate: "2024-02-30" }, { startDate: "0000-01-01" }, { startDate: "2024-03-01", endDate: "2024-02-29" }, { amount: 1 }]) assert.throws(() => reportInput(p));
  for (const q of ["taxYear=2024x", "page=0", "limit=101", "formType=nope"]) assert.throws(() => outputQuery(new URL("http://test?" + q), true));
});
test("Tax-form known money aliases preserve cents and enforce safe output", () => {
  const data = taxDataDto({ box1_wages: 1250, box1_wagesMinor: "1250", box13_retirement_plan: false, employee_email: null }, "w2");
  assert.equal(data.box1_wagesMinor, "1250"); assert.equal(data.currency, "USD");
  assert.equal(taxDataDto({ box1_nonemployee_compensationMinor: "9007199254740991" }, "1099_nec").box1_nonemployee_compensation, Number.MAX_SAFE_INTEGER);
  for (const d of [{ box1_wages: Number.MAX_SAFE_INTEGER + 1 }, { box1_wages: 1.5 }, { box1_wages: 1, box1_wagesMinor: "2" }, { box1_wagesMinor: "9007199254740992" }, { box1_wagesMinor: "01" }, { box1_wages: 1, currency: "EUR" }, { box1_wages: 1, mystery: 100 }, { box13_retirement_plan: 1 }]) assert.throws(() => taxDataDto(d, "w2"));
  assert.throws(() => taxDataDto({}, "1099_misc")); assert.throws(() => taxDataDto(null, "w2"));
});
test("Opaque payslip deductions validate amounts and agreement", () => {
  assert.equal(deductionPayload(null), null);
  assert.deepEqual(deductionPayload([{ name: "Benefit", amount: 29, category: "pre_tax" }]), [{ name: "Benefit", amount: 29, amountMinor: "29", category: "pre_tax" }]);
  for (const value of [{}, [null], [{ name: "Benefit", amount: Number.MAX_SAFE_INTEGER + 1, category: "pre_tax" }], [{ name: "Benefit", amount: 1, amountMinor: "2", category: "post_tax" }]]) assert.throws(() => deductionPayload(value));
});
test("Exact export decimals and quoted spreadsheet-safe text preserve full cents", () => {
  assert.equal(payrollCentsText(Number.MAX_SAFE_INTEGER), "90071992547409.91");
  assert.equal(payrollCentsText(-29), "-0.29"); assert.equal(payrollCentsText(1250), "12.50");
  assert.equal(payrollCsvCell('Doe, "Sam"\nTwo'), '"Doe, ""Sam""\nTwo"');
  assert.equal(payrollCsvCell("=SUM(A1)"), '"\'=SUM(A1)"');
  assert.equal(payrollCsvCell("@cmd"), '"\'@cmd"');
  assert.throws(() => payrollCentsText(Number.MAX_SAFE_INTEGER + 1));
  assert.equal(payrollMoneyDisplay(Number.MAX_SAFE_INTEGER, "USD"), "$90,071,992,547,409.91");
  assert.equal(payrollMoneyDisplay(-29, "USD"), "-$0.29");
  assert.ok(payrollMoneyDisplay(1250, "IRR").includes("12.50"));
});
test("Report aggregate checks include overflow and signed correction rounding", () => {
  assert.equal(payrollSum([Number.MAX_SAFE_INTEGER, -Number.MAX_SAFE_INTEGER, 29]), 29);
  assert.throws(() => payrollSum([Number.MAX_SAFE_INTEGER, 1]));
  assert.equal(payrollRatio(-1, 1n, 2n), -1);
});
test("Self profile cannot accept salary, employee ID or currency", () => {
  assert.deepEqual(selfProfileSchema.parse({ email: "staff@example.test" }), { email: "staff@example.test" });
  for (const body of [{ salaryMinor: "1" }, { employeeId: "other" }, { currency: "USD" }, { email: "bad" }]) assert.equal(selfProfileSchema.safeParse(body).success, false);
});
