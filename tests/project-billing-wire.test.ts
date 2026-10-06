import assert from "node:assert/strict";
import { test } from "node:test";
import { billingSchemas, billingItemSchema, billingCost, billingMarkup, billingTime, billingPercent, billingRatio, billingDto } from "../lib/api/project-billing-wire";
import { WireCompatibilityError } from "../lib/money/wire";
import { projectBillingFixedCents, projectBillingPercent } from "../lib/money/project-billing-display";
const id = "11111111-1111-4111-8111-111111111111";
test("project billing cents aliases agree and reject unsupported/ambiguous values", () => {
  for (const n of [0, 1250, Number.MAX_SAFE_INTEGER]) {
    const parsed = billingItemSchema.parse({ sourceLineId: id, costAmount: n, costAmountMinor: String(n) });
    assert.equal(billingCost(parsed).costAmount, n);
  }
  assert.throws(() => billingCost(billingItemSchema.parse({ sourceLineId: id, costAmount: 1, costAmountMinor: "2" })));
  assert.throws(() => billingCost(billingItemSchema.parse({ sourceLineId: id, costAmountMinor: "9007199254740992" })), WireCompatibilityError);
  for (const costAmountMinor of ["01", "-0", "1.0", "1e3", " 1", "۱۲۵۰", "-1", "9223372036854775808"]) assert.equal(billingItemSchema.safeParse({ sourceLineId: id, costAmountMinor }).success, false);
  for (const costAmount of [-0, -1, 1.5, Infinity, Number.MAX_SAFE_INTEGER + 1]) assert.equal(billingItemSchema.safeParse({ sourceLineId: id, costAmount }).success, false);
});
test("project billing products/sums/percent use exact rational rounding", () => {
  assert.equal(billingMarkup(5, 1000), 6); assert.equal(billingMarkup(Number.MAX_SAFE_INTEGER, 0), Number.MAX_SAFE_INTEGER);
  assert.equal(billingTime(1, 30), 1); assert.equal(billingTime(1, Number.MAX_SAFE_INTEGER), 150119987579017);
  assert.equal(billingPercent(Number.MAX_SAFE_INTEGER, 0.1), 9007199254741);
  assert.equal(billingRatio(-1n, 32n), -3.12);
  assert.throws(() => billingMarkup(Number.MAX_SAFE_INTEGER, 1), WireCompatibilityError);
  assert.throws(() => billingTime(61, Number.MAX_SAFE_INTEGER), WireCompatibilityError);
  assert.throws(() => billingDto({ amount: Number.MAX_SAFE_INTEGER + 1 }, ["amount"]), WireCompatibilityError);
});
test("project billing strict UUID/date/selection/physical schemas", () => {
  const p = { projectId: id };
  for (const input of [{ ...p, issueDate: "2024-02-30" }, { ...p, timeEntryIds: [id, id] }, { ...p, milestoneIds: [] }, { ...p, percentageToInvoice: 101 }, { ...p, defaultExpenseMarkupBasisPoints: 2147483648 }, { ...p, currency: "USD" }]) assert.equal(billingSchemas.progress.safeParse(input).success, false);
  assert.equal(billingSchemas.progress.safeParse({ ...p, percentageToInvoice: 0.1, issueDate: "2024-02-29" }).success, true);
  assert.equal(billingSchemas.profitability.safeParse({ currency: "IRR" }).success, true);
  assert.equal(billingSchemas.invoice.parse(p).includeBillableExpenses, true);
  assert.equal(billingSchemas.progress.parse(p).includeBillableExpenses, false);
});
test("progress invoice display uses the server's exact percentage arithmetic", () => {
  assert.equal(projectBillingFixedCents(Number.MAX_SAFE_INTEGER, "0.1"), 9007199254741n);
  assert.equal(projectBillingFixedCents(5, "10"), 1n);
  for (const s of ["1abc", "1e2", "-1", "101", "۱۲", " 1", "00", "1.1234567890"]) assert.throws(() => projectBillingPercent(s));
});
