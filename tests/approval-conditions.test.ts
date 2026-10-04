import assert from "node:assert/strict";
import { test } from "node:test";
import { conditionDto, evaluateConditions, parseConditions } from "../lib/approvals/conditions";
import { workflowCreate, approvalQuery } from "../lib/approvals/wire";
import { WireCompatibilityError } from "../lib/money/wire";

test("approval monetary conditions compare all six operators exactly, including int64 edges", () => {
  const match = (operator: string, value: string, total: unknown) => evaluateConditions("invoice", [{ field: "total", operator, value }], { total });
  for (const value of ["-9223372036854775808", "-9007199254740993", "0", "2147483648", "9007199254740993", "9223372036854775807"]) {
    const n = BigInt(value);
    assert.equal(match("eq", value, n), true); assert.equal(match("neq", value, n), false);
    assert.equal(match("gte", value, value), true); assert.equal(match("lte", value, value), true);
    assert.equal(match("gt", value, value), false); assert.equal(match("lt", value, value), false);
  }
  assert.equal(match("gt", "9007199254740992", "9007199254740993"), true);
  assert.equal(match("lt", "-9007199254740992", "-9007199254740993"), true);
  assert.equal(match("eq", "1250", 1250), true);
  for (const currencyCode of ["USD", "IRR", "JPY", "KWD"]) assert.equal(evaluateConditions("invoice", [{ field: "total", operator: "eq", valueMinor: "1250" }], { total: 1250, currencyCode }), true);
  assert.deepEqual(conditionDto("invoice", [{ field: "total", operator: "gte", valueMinor: "1250" }]), [{ field: "total", operator: "gte", value: "1250", valueMinor: "1250" }]);
  assert.deepEqual(parseConditions("invoice", [{ field: "total", operator: "eq", value: "1250", valueMinor: "1250" }]), [{ field: "total", operator: "eq", value: "1250" }]);
});

test("approval schemas reject partial, ambiguous, unsupported and unsafe inputs", () => {
  const make = (conditions: unknown) => ({ name: "Review", entityType: "invoice", conditions, steps: [{ approverId: "ccf079a9-91d6-4814-bf86-79d548f2ca81" }] });
  for (const value of ["", " ", "01", "-0", "+1", "1.0", "1e3", "0xff", "1250USD", "۱۲۵۰", "9223372036854775808", "-9223372036854775809", 1250, null])
    assert.equal(workflowCreate.safeParse(make([{ field: "total", operator: "gt", value }])).success, false, String(value));
  for (const c of [{ field: "total", operator: "eq" }, { field: "total", operator: "gt", value: "1", valueMinor: "2" },
    { field: "status", operator: "eq", valueMinor: "1" }, { field: "status", operator: "gt", value: "draft" },
    { field: "__proto__", operator: "eq", value: "x" }, { field: "amount", operator: "eq", value: "1" },
    { field: "totalMinor", operator: "eq", value: "1" }, { field: "total", operator: "contains", value: "1" },
    { field: "total", operator: "eq", value: "1", unknown: true }]) assert.equal(workflowCreate.safeParse(make([c])).success, false);
  for (const total of [NaN, Infinity, 1.5, 9007199254740992, -0, "01", {}, "1e3", "9223372036854775808"])
    assert.throws(() => evaluateConditions("invoice", [{ field: "total", operator: "eq", value: "1" }], { total }), WireCompatibilityError);
  assert.throws(() => evaluateConditions("invoice", [{ field: "status", operator: "eq", value: "mismatch" }, { field: "total", operator: "eq", value: "1" }], { status: "draft", total: NaN }), WireCompatibilityError);
  assert.throws(() => conditionDto("invoice", [{ field: "total", operator: "gt", value: "1e3" }]), WireCompatibilityError);
  for (const query of ["?page=1x", "?limit=1.5", "?page=0", "?limit=101", "?entityType=unknown", "?page=999999999"])
    assert.throws(() => approvalQuery(new URL(`http://fixture.test/${query}`)));
});

test("approval decisions retain AND, empty-match, literal text and integer-header behavior", () => {
  assert.equal(evaluateConditions("invoice", [], {}), true);
  assert.equal(evaluateConditions("invoice", [{ field: "status", operator: "eq", value: "draft" }, { field: "total", operator: "gte", value: "100" }], { status: "draft", total: 100 }), true);
  assert.equal(evaluateConditions("invoice", [{ field: "total", operator: "gte", value: "100" }], { total: 99 }), false);
  assert.equal(evaluateConditions("invoice", [{ field: "status", operator: "neq", value: "draft" }], { status: "sent" }), true);
  assert.equal(evaluateConditions("invoice", [{ field: "reference", operator: "eq", value: "" }], {}), false);
  assert.equal(evaluateConditions("journal_entry", [{ field: "entryNumber", operator: "gt", value: "100" }], { entryNumber: 101 }), true);
  assert.equal(evaluateConditions("expense", [{ field: "totalAmount", operator: "eq", valueMinor: "500" }], { totalAmount: 500 }), true);
});
