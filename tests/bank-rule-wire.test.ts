import assert from "node:assert/strict";
import { test } from "node:test";
import { ruleConditionSchema, ruleSplitSchema, ruleCreateSchema, ruleUpdateSchema, normalizeRule, ruleDto, resolveSplitAmounts, ruleApplySchema, ruleAutoSchema } from "../lib/api/bank-rule-wire";
import { applyBankRulesToTransaction } from "../lib/banking/rule-engine";
import { WireCompatibilityError } from "../lib/money/wire";
const accountId = "00000000-0000-4000-8000-000000000001";
const base = { name: "Fixture", matchType: "contains", matchValue: "fixture", accountId };
test("MON-069 strict canonical conditions and partial update semantics", () => {
  assert.deepEqual(ruleUpdateSchema.parse({ name: "Renamed" }), { name: "Renamed" });
  for (const value of ["1250x", "01", "+1", "-0", "1.2", " 1", "1e3", "۱۲۵۰", "9223372036854775808"])
    assert.equal(ruleConditionSchema.safeParse({ field: "amount", op: "gt", value }).success, false);
  for (const [op, value] of [["between", "2,1"], ["between", "1,2,3"], ["between", "1, 2"], ["contains", "1"]])
    assert.equal(ruleConditionSchema.safeParse({ field: "amount", op, value }).success, false);
  assert.equal(ruleConditionSchema.safeParse({ field: "description", op: "gt", value: "1" }).success, false);
  assert.throws(() => ruleConditionSchema.parse({ field: "amount", op: "equals", value: "9007199254740992" }), WireCompatibilityError);
  assert.equal(ruleCreateSchema.safeParse({ ...base, unknown: 1 }).success, false);
  assert.equal(ruleCreateSchema.safeParse({ name: "Empty" }).success, false);
  assert.equal(ruleCreateSchema.safeParse({ ...base, priority: 2147483648 }).success, false);
  assert.equal(ruleApplySchema.safeParse({ unexpected: 1 }).success, false);
  assert.equal(ruleAutoSchema.safeParse({ confidenceThreshold: 69 }).success, false);
});
test("MON-069 exact fixed aliases and opaque saved configuration reject unsafe money", () => {
  const input = { ...base, splitAllocations: [{ accountId, amount: 1250, amountMinor: "1250" }, { accountId }] };
  const saved = normalizeRule(input); assert.equal(saved.splitAllocations![0].amount, 1250);
  assert.equal(ruleDto(saved).splitAllocations![0].amountMinor, "1250");
  for (const a of [{ amount: 1, amountMinor: "2" }, { amount: 1.2, amountMinor: "1" }, { amountMinor: "bad" }, { amountMinor: "-1" }, { amount: -0 }, { percent: 100.1 }, { percent: 0.0000001 }])
    assert.equal(ruleSplitSchema.safeParse({ accountId, ...a }).success, false);
  assert.throws(() => normalizeRule({ ...base, splitAllocations: [{ accountId, amountMinor: "9007199254740992" }] }), WireCompatibilityError);
  for (const splitAllocations of [[{ accountId, amount: 9007199254740992 }], [{ accountId, amount: "1250" }], [{ accountId, amount: 1250, amountMinor: "1" }], { amount: 1 }])
    assert.throws(() => ruleDto({ ...saved, splitAllocations }), WireCompatibilityError);
});
test("MON-069 exact signed matching covers amount equality, ranges, AND/OR and priority", () => {
  const amount = normalizeRule({ ...base, conditions: [{ field: "amount", op: "equals", value: "9007199254740991" }] });
  assert.ok(applyBankRulesToTransaction([amount], { description: "", amount: Number.MAX_SAFE_INTEGER }));
  assert.equal(applyBankRulesToTransaction([amount], { description: "", amount: Number.MAX_SAFE_INTEGER - 1 }), null);
  const range = normalizeRule({ ...base, conditions: [{ field: "amount", op: "between", value: "-1250,-1" }, { field: "payee", op: "equals", value: "PARTY" }] });
  assert.ok(applyBankRulesToTransaction([range], { description: "", amount: -1250, payee: "party" }));
  assert.equal(applyBankRulesToTransaction([range], { description: "", amount: 1250, payee: "party" }), null);
  assert.ok(applyBankRulesToTransaction([{ ...range, matchAll: false }], { description: "", amount: 1, payee: "party" }));
  assert.equal(applyBankRulesToTransaction([normalizeRule(base), range], { description: "Fixture", amount: -1, payee: "party" })!.ruleName, "Fixture");
});
test("MON-069 bigint split rounding preserves sequential caps, fixed precedence and exact signed totals", () => {
  for (const total of [1, 1250, -1250, 3000000000, Number.MAX_SAFE_INTEGER, -Number.MAX_SAFE_INTEGER]) {
    const parts = resolveSplitAmounts([{ accountId, percent: 33.333333 }, { accountId, amountMinor: "250", percent: 100 }, { accountId }], total);
    assert.equal(parts.reduce((s,p) => s + BigInt(p.amount), 0n), BigInt(total));
    assert.ok(parts.every(p => Math.sign(p.amount) === Math.sign(total)));
  }
  assert.deepEqual(resolveSplitAmounts([{ accountId, percent: 50 }, { accountId }], 3).map(p => p.amount), [2,1]);
  assert.deepEqual(resolveSplitAmounts([{ accountId, amount: 100 }, { accountId }], 3).map(p => p.amount), [3]);
  assert.deepEqual(resolveSplitAmounts([{ accountId, amount: 1, percent: 100 }, { accountId }], 3).map(p => p.amount), [1,2]);
  assert.deepEqual(resolveSplitAmounts([{ accountId }], 0), []);
});
