import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { readFile } from "node:fs/promises";
import { BudgetProgressBar } from "../components/dashboard/budget-progress-bar";
import { budgetInput, budgetDecimal, budgetDistribute, budgetPercent, budgetUiPayload, budgetMoney, budgetChartPoint, budgetLinesInput, accrualUiInput, accrualUiPeriods, budgetJson, budgetDraftInvalid, budgetRemoveDraftLine } from "../lib/money/budget-ui";
import { projectCrmUiPayload, projectCrmJson } from "../lib/money/project-crm-ui";
import { projectCentsInput, projectHoursInput, projectTimeCents } from "../lib/money/project-display";

test("budget decimal text and signed distribution preserve cents, low digits and cancellation", () => {
  for (const n of [1n, -1n, 3000000001n, 9007199254740991n, -9007199254740991n]) {
    assert.equal(budgetInput(budgetDecimal(n)), n);
    const amounts = budgetDistribute(n, 3);
    assert.equal(amounts.reduce((sum, p) => sum + p, 0n), n);
  }
  assert.deepEqual(budgetDistribute(-1n, 3), [0n, 0n, -1n]);
  assert.deepEqual(budgetDistribute(1n, 3), [1n, 0n, 0n]);
  assert.equal(budgetPercent(-1n, 200n), 0);
  assert.equal(budgetPercent(1n, 200n), 1);
  assert.equal(budgetPercent(-1n, -200n), 1);
  for (const input of ["1.005", "1e3", "junk", "NaN", "90071992547409.92"]) assert.throws(() => budgetInput(input));
  const periods = budgetDistribute(3000000001n, 3).map((amount, sortOrder) => ({ amount, sortOrder, label: String(sortOrder), startDate: "2026-01-01", endDate: "2026-01-31" }));
  const wire = budgetLinesInput([{ accountId: "id", total: 3000000001n, periods }]);
  assert.equal(wire[0].totalMinor, "3000000001"); assert.equal(wire[0].periods[0].amountMinor, "1000000001");
  assert.doesNotThrow(() => JSON.stringify(wire));
});
test("budget saved pairs fail closed and counts retain their nonmonetary units", () => {
  const payload = { total: 4, lines: [{ accountId: "id", total: -1, totalMinor: "-1", periods: [{ amount: -1, amountMinor: "-1", sortOrder: 0, startDate: "2026-01-01" }] }] };
  const result = budgetUiPayload(payload);
  assert.equal(result.lines[0].total, -1n); assert.equal(result.lines[0].periods[0].amount, -1n);
  assert.equal(result.total, 4); assert.equal(payload.lines[0].total, -1);
  for (const row of [{ amount: 1 }, { amount: 1, amountMinor: "2" }, { amount: 1, amountMinor: "01" }, { amountMinor: "1" }, { amount: Number.MAX_SAFE_INTEGER + 1, amountMinor: "9007199254740992" }, { amount: -0, amountMinor: "0" }]) assert.throws(() => budgetUiPayload(row));
  assert.throws(() => budgetUiPayload({ comparisons: [], currencyCode: "USD" }));
});
test("fixed cents currency labels and rendered budget progress preserve final digits", () => {
  for (const currency of ["USD", "JPY", "KWD"]) {
    assert.match(budgetMoney(9007199254740991n, currency), /91$/);
    assert.match(budgetMoney(-1n, currency), /0\.01/);
    const markup = renderToStaticMarkup(createElement(BudgetProgressBar, { budgeted: 3000000001n, actual: -1n, label: "Signed", currencyCode: currency }));
    assert.match(markup, /30,000,000\.01/); assert.match(markup, /0\.01/); assert.match(markup, /width:0%/);
  }
  const point = budgetChartPoint("Geometry", 18014398509481983n, -1n);
  assert.equal(point.budgetedExact, 18014398509481983n); assert.equal(point.actualExact, -1n);
});
test("project, CRM and pricing read adapters validate nested aliases, nullable rates and counts", () => {
  const row = { project: { name: "Project", billingType: "hourly", currency: "JPY", budget: 3000000001, budgetMinor: "3000000001", hourlyRate: 1250, hourlyRateMinor: "1250", fixedPrice: 0, fixedPriceMinor: "0", totalBilled: 1, totalBilledMinor: "1", members: [{ hourlyRate: null, hourlyRateMinor: null }] }, total: 2,
    stageDistribution: { active: { count: 1, value: 3000000001, valueMinor: "3000000001" } }, resolved: { unitPrice: 1, unitPriceMinor: "1" } };
  assert.equal(projectCrmUiPayload(row), row); assert.equal(row.total, 2);
  for (const value of [{ valueCents: 1 }, { valueCents: 1, valueCentsMinor: "2" }, { unitPrice: 1, unitPriceMinor: "01" }, { costRate: null, costRateMinor: "0" }, { amount: -1, amountMinor: "-1" }, { valueCents: -0, valueCentsMinor: "0" }]) assert.throws(() => projectCrmUiPayload(value));
  assert.throws(() => projectCrmUiPayload({ billingType: "fixed", currency: "USD", fixedPrice: 1, fixedPriceMinor: "1" }));
  assert.throws(() => projectCrmUiPayload({ invoiceNumber: 1, total: 1, totalMinor: "1" }));
  assert.equal(projectCentsInput("30000000.01"), "3000000001"); assert.equal(projectHoursInput("0.5"), 30); assert.equal(projectTimeCents(30, 1251), 626n);
});
test("accrual decimal-major input preserves half-up rounding and rejects permissive syntax", () => {
  assert.deepEqual(accrualUiInput("1.005"), { exact: "1.005", minor: "101" });
  assert.equal(accrualUiInput("30000000.01").minor, "3000000001");
  assert.equal(accrualUiPeriods("1200"), 1200);
  for (const value of ["0", "0.004", "-1", "NaN", "1e3", "1x"]) assert.throws(() => accrualUiInput(value));
  for (const value of ["1.5", "2x", "1201", "0"]) assert.throws(() => accrualUiPeriods(value));
});
test("successful fetches validate exact DTOs and failed responses never become amounts", async () => {
  const response = () => Response.json({ amount: 1, amountMinor: "2" });
  await assert.rejects(() => budgetJson(response())); await assert.rejects(() => projectCrmJson(response()));
  await assert.rejects(() => budgetJson(Response.json({ error: "Scope rejected" }, { status: 404 })), /Scope rejected/);
  await assert.rejects(() => projectCrmJson(Response.json({ error: "Scope rejected" }, { status: 404 })), /Scope rejected/);
});
test("invalid editor drafts stay associated with their line after deletion and block submission", () => {
  const drafts = { "0:0": "1.00", "1:0": "-", "2:1": "90071992547409.92" };
  const shifted = budgetRemoveDraftLine(drafts, 0);
  assert.deepEqual(shifted, { "0:0": "-", "1:1": "90071992547409.92" });
  assert.ok(Object.values(shifted).every(budgetDraftInvalid));
  assert.deepEqual(budgetRemoveDraftLine({ "0": "-1.00", "1": "bad", "2": "0.01" }, 1), { "0": "-1.00", "1": "0.01" });
  assert.equal(budgetDraftInvalid(""), false); assert.equal(budgetDraftInvalid("-0.01"), false);
});
test("scoped UI static guards prevent legacy budget math and require saved-money adapters", async () => {
  for (const file of ["app/(dashboard)/accounting/budgets/page.tsx", "app/(dashboard)/accounting/budgets/[id]/layout.tsx", "app/(dashboard)/accounting/budgets/[id]/page.tsx", "app/(dashboard)/accounting/budgets/[id]/settings/page.tsx", "components/dashboard/budget-progress-bar.tsx", "app/(dashboard)/reports/budget-vs-actual/page.tsx"]) {
    const source = await readFile(file, "utf8");
    assert.doesNotMatch(source, /from ["']@\/lib\/money["']|parseFloat\(|(?:actual|budgeted|amount|total)\s*\/\s*100\b/);
    assert.doesNotMatch(source, /(?:totalActual|totalBurnRate|totalBudgeted|grandTotal|\bactual|\bburnRate|line\.total) > 0\b/);
    assert.match(source, /lib\/money\/budget-ui/);
  }
  for (const file of ["app/(dashboard)/projects/page.tsx", "app/(dashboard)/projects/[id]/project-context.tsx", "app/(dashboard)/projects/[id]/layout.tsx", "app/(dashboard)/projects/[id]/milestones/page.tsx", "app/(dashboard)/crm/page.tsx", "app/(dashboard)/crm/analytics/page.tsx", "app/(dashboard)/crm/deals/[id]/layout.tsx"]) {
    const source = await readFile(file, "utf8");
    if (file === "app/(dashboard)/projects/page.tsx") {
      assert.match(source, /projectListJson\(await fetch/);
      const reader = await readFile("i18n/project-presentation.ts", "utf8");
      assert.match(reader, /projectCrmJson\(response\)/);
    } else if (file.endsWith("/project-context.tsx") || file === "app/(dashboard)/projects/[id]/layout.tsx") {
      assert.match(source, /projectDetailJson|projectInvoiceJson/);
      const reader = await readFile("i18n/project-presentation.ts", "utf8");
      assert.match(reader, /projectCrmJson\(response\)/);
    } else assert.match(source, /projectCrmJson/);
    assert.doesNotMatch(source, /from ["']@\/lib\/money["']/);
  }
  const drawer = await readFile("components/dashboard/create-drawer.tsx", "utf8");
  const budget = drawer.slice(drawer.indexOf("function BudgetDrawer"), drawer.indexOf("// Employee Drawer"));
  const accrual = drawer.slice(drawer.indexOf("function AccrualScheduleDrawer"), drawer.indexOf("function RevenueScheduleDrawer"));
  assert.doesNotMatch(budget, /parseFloat|Math\.round|total: l\.total/);
  assert.match(budget, /budgetLinesInput\(validLines\)/); assert.match(budget, /Object\.values\(periodDrafts\)/);
  assert.doesNotMatch(accrual, /parseFloat|parseInt/); assert.match(accrual, /accrualUiInput/);
});
