import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { dealCreateSchema, dealUpdateSchema, dealAmounts, crmTotals, crmQuery, pipelineCreateSchema, activityCreateSchema, dealDto } from "../lib/api/crm-wire";
import { WireCompatibilityError } from "../lib/money/wire";
import { payrollMoneyDisplay } from "../lib/money/payroll-display";
const base = { pipelineId: randomUUID(), stageId: "lead", title: "Deal" };
test("CRM cents aliases remain fixed, canonical and safe", () => {
  for (const currency of ["USD", "IRR", "JPY", "KWD"]) {
    assert.equal(dealAmounts(dealCreateSchema.parse({ ...base, currency, valueCents: 1250, valueCentsMinor: "1250" })).valueCents, 1250);
  }
  assert.equal(dealAmounts(dealCreateSchema.parse({ ...base, valueCentsMinor: "9007199254740991" })).valueCents, Number.MAX_SAFE_INTEGER);
  assert.throws(() => dealAmounts(dealCreateSchema.parse({ ...base, valueCentsMinor: "9007199254740992" })), WireCompatibilityError);
  assert.throws(() => dealAmounts(dealCreateSchema.parse({ ...base, valueCents: 1, valueCentsMinor: "2" })));
  for (const input of [{ valueCents: -0 }, { valueCents: 1.1 }, { valueCents: "1" }, { valueCents: Number.MAX_SAFE_INTEGER + 1 }, { valueCentsMinor: "01" }, { valueCentsMinor: "-1" }, { valueCentsMinor: "1e3" }, { valueCentsMinor: "9223372036854775808" }, { unknown: true }]) assert.equal(dealCreateSchema.safeParse({ ...base, ...input }).success, false);
  assert.deepEqual(dealAmounts(dealUpdateSchema.parse({})), {});
});
test("CRM analytics use exact rounded sums and currency isolation", () => {
  const row = { valueCents: 1, currency: "USD", stageId: "__proto__", wonAt: new Date(), lostAt: null };
  const a = crmTotals([row, { ...row, valueCents: 2 }]);
  assert.equal(a.analytics.avgDealValue, 2); assert.equal(a.analytics.avgDealValueMinor, "2"); assert.equal(a.analytics.conversionRate, 100);
  assert.equal(a.analytics.stageDistribution.__proto__.valueMinor, "3");
  assert.equal(crmTotals([], "JPY").summary.currency, "JPY");
  assert.equal(crmTotals([{ ...row, valueCents: Number.MAX_SAFE_INTEGER }]).analytics.wonValue, Number.MAX_SAFE_INTEGER);
  assert.throws(() => crmTotals([{ ...row, valueCents: Number.MAX_SAFE_INTEGER }, row]), WireCompatibilityError);
  assert.throws(() => crmTotals([row, { ...row, currency: "EUR" }]), WireCompatibilityError);
  assert.equal(crmTotals([row, { ...row, wonAt: null, lostAt: new Date() }, { ...row, wonAt: null, lostAt: new Date() }]).analytics.conversionRate, 33);
});
test("CRM metadata, dates, physical probabilities and query spelling reject invalid inputs", () => {
  const stages = [{ id: "lead", name: "Lead", color: "#abcdef" }];
  assert.equal(pipelineCreateSchema.safeParse({ name: "P", stages }).success, true);
  for (const value of [[], [...stages, ...stages], [{ ...stages[0], color: "url(x)" }]]) assert.equal(pipelineCreateSchema.safeParse({ name: "P", stages: value }).success, false);
  for (const value of [101, -1, 0.5, "10"]) assert.equal(dealCreateSchema.safeParse({ ...base, probability: value }).success, false);
  assert.equal(dealCreateSchema.safeParse({ ...base, probability: null, expectedCloseDate: "2024-02-29" }).success, true);
  assert.equal(dealCreateSchema.safeParse({ ...base, expectedCloseDate: "2024-02-30" }).success, false);
  assert.equal(activityCreateSchema.safeParse({ type: "call", scheduledAt: "2024-01-01T10:00:00+03:30" }).success, true);
  for (const value of ["2024-01-01", "not-a-date", "2024-02-30T10:00:00Z"]) assert.equal(activityCreateSchema.safeParse({ type: "call", scheduledAt: value }).success, false);
  for (const q of ["page=01", "limit=1e2", "page=1&page=2", "page=-1"]) assert.throws(() => crmQuery(new Request(`http://fixture.test/?${q}`)));
});
test("CRM historical DTOs and display cannot guess unsafe values or rescale cents", () => {
  const row = { valueCents: 1250, currency: "JPY", probability: 0, expectedCloseDate: null, wonAt: null, lostAt: null };
  assert.equal(dealDto(row).valueCentsMinor, "1250");
  for (const bad of [{ valueCents: 1.5 }, { currency: "XYZ" }, { probability: 200 }, { wonAt: new Date(), lostAt: new Date() }]) assert.throws(() => dealDto({ ...row, ...bad }), WireCompatibilityError);
  assert.match(payrollMoneyDisplay("9007199254740991", "USD"), /90,071,992,547,409\.91/);
  assert.match(payrollMoneyDisplay(1250, "JPY"), /12\.50/);
});
