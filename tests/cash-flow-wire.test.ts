import assert from "node:assert/strict";
import { test } from "node:test";
import { cashFlowDual, cashFlowParameters, cashFlowQuery, cashFlowExportSchema } from "../lib/reports/cash-flow-wire";

test("cash-flow controls validate Gregorian periods, methods, basis and query cardinality", () => {
  assert.deepEqual(cashFlowParameters({ startDate: "2024-02-29", endDate: "2024-02-29" }), {
    startDate: "2024-02-29", endDate: "2024-02-29", method: "indirect", basis: "accrual",
  });
  for (const input of [{ startDate: "2023-02-29" }, { startDate: "2024-02-30" }, { startDate: "0000-01-01" },
    { startDate: "2024-02-01", endDate: "2024-01-01" }, { method: "bad" }, { basis: "bad" }, { currencyCode: "USD" }]) {
    assert.throws(() => cashFlowParameters(input));
  }
  for (const query of ["method=bad", "method=direct&method=indirect", "startDate=", "format=csv", "amountMinor=1"]) {
    assert.throws(() => cashFlowQuery(new Request(`http://fixture.test/?${query}`)));
  }
  assert.equal(cashFlowQuery(new Request("http://fixture.test/?format=XLSX")).format, "xlsx");
  assert.throws(() => cashFlowExportSchema.parse({ format: "csv" }));
  const params = cashFlowParameters({}); const today = new Date().toISOString().slice(0, 10);
  assert.equal(params.startDate, `${today.slice(0, 4)}-01-01`); assert.equal(params.endDate, today);
});

test("cash-flow nested dual projection retains exact signs and rejects any unsafe final amount", () => {
  const limit = BigInt(Number.MAX_SAFE_INTEGER);
  const value = cashFlowDual({ amount: limit, nested: { amount: -limit, balanced: true, zero: 0n }, items: [{ amount: -1n }] });
  assert.equal(value.amount, Number.MAX_SAFE_INTEGER); assert.equal(value.amountMinor, limit.toString());
  assert.equal(value.nested.amountMinor, (-limit).toString()); assert.equal(value.nested.zeroMinor, "0");
  assert.deepEqual(value.items, [{ amount: -1, amountMinor: "-1" }]); assert.doesNotThrow(() => JSON.stringify(value));
  for (const amount of [limit + 1n, -limit - 1n]) assert.throws(() => cashFlowDual({ nested: [{ amount }] }), /Unsupported financial report amount/);
});
