import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { bankSplitSchema, bankAllocationAmount, bankExpenseSchema, bankExpenseMcpSchema, bankExpenseAmount } from "../lib/api/bank-categorization-wire";
import { WireCompatibilityError } from "../lib/money/wire";

test("bank category allocation aliases preserve safe integer minor units", () => {
  const accountId = randomUUID();
  for (const minor of ["1", "1250", "3000000000", "9007199254740991"]) {
    const input = bankSplitSchema.parse({ allocations: [{ accountId, amountMinor: minor }] });
    assert.equal(bankAllocationAmount(input.allocations[0]), Number(minor));
  }
  for (const minor of ["01", "-0", "1.0", "1e3", " 1", "۱۲۵۰", "9223372036854775808"])
    assert.equal(bankSplitSchema.safeParse({ allocations: [{ accountId, amountMinor: minor }] }).success, false);
  for (const input of [{}, { amountMinor: "0" }, { amountMinor: "-1" }, { amount: 1, amountMinor: "2" }]) assert.throws(() => bankAllocationAmount(input));
  assert.throws(() => bankAllocationAmount({ amountMinor: "9007199254740992" }), WireCompatibilityError);
  for (const input of [{ amount: 1.5 }, { amount: Number.MAX_SAFE_INTEGER + 1 }, { accountId, amount: 1, unknown: 1 }])
    assert.equal(bankSplitSchema.safeParse({ allocations: [{ accountId, ...input }] }).success, false);
});
test("bank expense numeric major and exact aliases follow currency scale", () => {
  for (const [currency, major] of [["USD", "12.50"], ["JPY", "1250"], ["IRR", "1250"], ["KWD", "1.250"]]) {
    const { items } = bankExpenseSchema.parse({ title: "Paid expense", currencyCode: currency,
      items: [{ date: "2026-10-04", description: "Item", amount: Number(major), amountExact: major, amountMinor: "1250" }] });
    assert.equal(bankExpenseAmount(items[0], currency), 1250);
    const mcp = bankExpenseMcpSchema.parse({ title: "Paid expense", currencyCode: currency,
      items: [{ date: "2026-10-04", description: "Item", amount: 1250, amountExact: major, amountMinor: "1250" }] });
    assert.equal(bankExpenseAmount(mcp.items[0], currency, "mcp"), 1250);
  }
  assert.equal(bankExpenseAmount({ amountExact: "1.005" }, "USD"), 101);
  assert.throws(() => bankExpenseAmount({ amount: 1, amountExact: "1.01" }, "USD"));
  assert.throws(() => bankExpenseAmount({ amountMinor: "-1" }, "USD"));
  assert.throws(() => bankExpenseAmount({ amountMinor: "9007199254740992" }, "USD"), WireCompatibilityError);
  assert.equal(bankExpenseSchema.safeParse({ title: "Bad", items: [{ date: "2026-02-30", description: "Bad", amount: 1 }] }).success, false);
});
