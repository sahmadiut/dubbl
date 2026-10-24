import assert from "node:assert/strict";
import { test } from "node:test";
import { payrollMoneyDisplay } from "../lib/money/payroll-display";
import { projectMoneyDisplay } from "../lib/money/project-display";
import { budgetMoney } from "../lib/money/budget-ui";
import { payrollGroupedDisplay } from "../lib/money/payroll-ui";
import { payrollCentsInput } from "../lib/money/payroll-input";
import { projectCentsInput } from "../lib/money/project-display";
import type { NumberPresentation } from "../i18n/numbers";

test("payroll/project/budget labels retain signed exact fixed-two units independently of ISO scale", () => {
  for (const locale of ["en-US", "fa-IR"] as const) for (const numerals of ["latn", "arabext"] as const) {
    const presentation: NumberPresentation = { locale, numerals };
    for (const display of [payrollMoneyDisplay, projectMoneyDisplay, budgetMoney]) {
      for (const currency of ["IRR", "JPY", "KWD", "USD"]) {
        const small = display(-1n, currency, presentation);
        const big = display(18014398509481983n, currency, presentation);
        const zero = display(0n, currency, presentation);
        const fraction = numerals === "arabext" ? "٫۰۱" : ".01";
        assert.ok(small.includes(fraction), `${locale}/${numerals}: ${small}`);
        assert.ok(big.includes(numerals === "arabext" ? "٫۸۳" : ".83"), big);
        assert.ok(zero.includes(numerals === "arabext" ? "٫۰۰" : ".00"), zero);
        if (locale === "fa-IR" && currency === "IRR") {
          assert.ok(small.includes("ریال") && big.includes("ریال") && zero.includes("ریال"));
          assert.ok(!small.includes("IRR"));
        }
      }
      assert.equal(display(-1n, "USD"), "-$0.01");
    }
    const grouped = payrollGroupedDisplay([{ amount: 29, currency: "IRR" }, { amount: 31, currency: "KWD" }], 1n, presentation);
    assert.ok(grouped.includes(payrollMoneyDisplay(29, "IRR", presentation)));
    assert.ok(grouped.includes(payrollMoneyDisplay(31, "KWD", presentation)));
    assert.equal(payrollCentsInput("0.29"), "29");
    assert.equal(projectCentsInput("0.29"), "29");
  }
});
