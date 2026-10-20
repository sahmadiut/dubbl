import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { payrollUiPayload, payrollJson, payrollSum, payrollShare, payrollGroupedDisplay } from "../lib/money/payroll-ui";
import { payrollCentsInput, payrollCentsDecimal, payrollCentsPreview, payrollPeriodPreview } from "../lib/money/payroll-input";
import { payrollMoneyDisplay } from "../lib/money/payroll-display";

test("payroll UI preserves low digits and two-decimal cents across ISO scales", () => {
  for (const currency of ["USD", "JPY", "KWD", "IRR"]) {
    for (const salary of [0, 29, 1250, Number.MAX_SAFE_INTEGER]) {
      const row = payrollUiPayload({ salary, salaryMinor: String(salary), currency });
      assert.equal(payrollCentsInput(payrollCentsDecimal(row.salary)), row.salaryMinor);
      assert.equal(payrollCentsPreview(payrollCentsDecimal(row.salary)), BigInt(salary));
      assert.match(payrollMoneyDisplay(row.salary, currency), /\.\d{2}/);
    }
    assert.match(payrollMoneyDisplay(-1n, currency), /-.*0\.01/);
  }
  assert.equal(payrollPeriodPreview(9007199254740991n, "monthly"), 750599937895083n);
  assert.equal(payrollCentsInput("0.29"), "29");
  for (const value of ["1.001", "1e2", "-0", "-1", "90071992547409.92"]) assert.throws(() => payrollCentsInput(value));
});

test("payroll UI rejects malformed, missing, unsafe and conflicting nested saved aliases", () => {
  for (const row of [
    { salary: 29 }, { salary: 29, salaryMinor: "28" }, { salary: 29, salaryMinor: "029" },
    { salary: 0.29, salaryMinor: "29" }, { salary: -0, salaryMinor: "0" },
    { salary: Number.MAX_SAFE_INTEGER + 1, salaryMinor: "9007199254740992" },
    { salary: -1, salaryMinor: "-1" }, { salaryMinor: "29" }, { salary: null, salaryMinor: null },
    { hourlyRate: null, hourlyRateMinor: "0" }, { currency: "usd" },
  ]) assert.throws(() => payrollUiPayload({ employee: row }));
  assert.throws(() => payrollUiPayload({ deductionsBreakdown: [{ name: "Pension", amount: 29 }] }));
  assert.throws(() => payrollUiPayload({ minSalary: 10, minSalaryMinor: "10", midSalary: 9, midSalaryMinor: "9", maxSalary: 20, maxSalaryMinor: "20" }));
  assert.doesNotThrow(() => payrollUiPayload({ hourlyRate: null, hourlyRateMinor: null, totalBudget: null, totalBudgetMinor: null,
    grossAmount: -29, grossAmountMinor: "-29", hours: 1.25, taxRate: 2029, fxRate: 1.2 }));
});

test("payroll UI validates reports, forecast, tax boxes and mutation DTOs before adoption", async () => {
  const payload = { currency: "KWD", current: { monthlyGross: 29, monthlyGrossMinor: "29" },
    difference: { monthlyGross: -1, monthlyGrossMinor: "-1" },
    formData: { box1_wages: 1250, box1_wagesMinor: "1250", box13_retirement_plan: true } };
  assert.deepEqual(await payrollJson(Response.json(payload)), payload);
  await assert.rejects(payrollJson(Response.json({ employee: { salary: 29 } })));
  const error = { error: "Period is locked" };
  assert.deepEqual(await payrollJson(Response.json(error, { status: 409 })), error);
});

test("payroll derived money stays bigint and overview never sums unlike currencies", () => {
  assert.equal(payrollSum([Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, 1]), 18014398509481983n);
  assert.equal(payrollSum([-29, 28]), -1n);
  assert.throws(() => payrollSum([0.29]));
  assert.equal(payrollShare(1n, 3n), "33.3");
  assert.equal(payrollShare(1n, 16n), "6.3");
  assert.equal(payrollShare(-1n, 10n), "0.0");
  assert.equal(payrollShare(20n, 10n), "100.0");
  assert.equal(payrollShare(0n, 0n), "0.0");
  const display = payrollGroupedDisplay([{ amount: 1250, currency: "USD" }, { amount: 29, currency: "JPY" }, { amount: 1, currency: "USD" }]);
  assert.equal(display, [payrollMoneyDisplay(29n, "JPY"), payrollMoneyDisplay(1251n, "USD")].join(" · "));
  assert.equal(payrollGroupedDisplay([{ amount: 6, currency: "USD" }], 12n), "$0.01");
});

test("all payroll JSON consumers adopt the shared adapter and no monetary float input remains", () => {
  function inspect(folder: string) {
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      const path = join(folder, entry.name);
      if (entry.isDirectory()) { inspect(path); continue; }
      if (!entry.name.endsWith(".tsx")) continue;
      const source = readFileSync(path, "utf8");
      assert.doesNotMatch(source, /from "@\/lib\/money(?:\/bank-display)?"|parseMajor\(|Math\.round\(parseFloat|\.json\(\)/, path);
      if (source.includes("fetch(")) {
        if (path.replaceAll("\\", "/") === "app/(dashboard)/payroll/employees/page.tsx") {
          assert.match(source, /import \{ payrollOverviewJson,.*from "@\/i18n\/payroll-overview-presentation"/);
          assert.match(source, /await payrollOverviewJson\(await fetch\(/);
          assert.match(readFileSync("i18n/payroll-overview-presentation.ts", "utf8"), /await payrollJson\(response\)/);
        } else if (path.replaceAll("\\", "/") === "app/(dashboard)/payroll/employees/[id]/page.tsx") {
          assert.match(source, /payrollEmployeeDetailJson/);
          assert.match(readFileSync("i18n/payroll-employee-detail-presentation.ts", "utf8"), /await payrollJson\(response\)/);
        } else if (path.replaceAll("\\", "/").includes("/payroll/contractors/")) {
          assert.match(source, /payrollContractorJson/);
          assert.match(readFileSync("i18n/payroll-contractor-presentation.ts", "utf8"), /await payrollJson\(response\)/);
        } else if (path.replaceAll("\\", "/") === "app/(dashboard)/payroll/runs/[id]/page.tsx") {
          assert.match(source, /payrollRunDetailJson/);
          assert.match(readFileSync("i18n/payroll-run-detail-presentation.ts", "utf8"), /await payrollJson\(response\)/);
        } else if (path.replaceAll("\\", "/").includes("/tax-forms/") || path.replaceAll("\\", "/").endsWith("/payslips/page.tsx") && path.replaceAll("\\", "/").includes("/runs/")) {
          assert.match(source, /payrollOutputJson/);
          assert.match(readFileSync("i18n/payroll-output-presentation.ts", "utf8"), /await payrollJson\(response\)/);
        } else if (["app/(dashboard)/payroll/runs/page.tsx", "app/(dashboard)/payroll/runs/off-cycle-dialog.tsx"].includes(path.replaceAll("\\", "/"))) {
          assert.match(source, /payrollRunJson/);
          assert.match(readFileSync("i18n/payroll-run-presentation.ts", "utf8"), /await payrollJson\(response\)/);
          assert.match(readFileSync("i18n/payroll-overview-presentation.ts", "utf8"), /await payrollJson\(response\)/);
        } else if (path.replaceAll("\\", "/") === "app/(dashboard)/payroll/time-leave/page.tsx") {
          assert.match(source, /payrollTimeJson/);
          assert.match(readFileSync("i18n/payroll-time-presentation.ts", "utf8"), /await payrollJson\(response\)/);
        } else assert.match(source, /payrollJson/, path);
      }
    }
  }
  inspect("app/(dashboard)/payroll");
  const drawer = readFileSync("components/dashboard/create-drawer.tsx", "utf8");
  assert.match(drawer, /payrollEmployeeCreatedJson\(res\);\s+toast.success\(t\("added"\)\)/);
  assert.match(readFileSync("i18n/payroll-employee-presentation.ts", "utf8"), /await payrollJson\(response\)/);
  assert.match(drawer, /payrollContractorJson\(res, "created"\);\s+toast.success\(t\("added"\)\)/);
});
