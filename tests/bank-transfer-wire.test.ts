import assert from "node:assert/strict";
import { test } from "node:test";
import { bankTransferSchema, bankTransferMcpSchema, bankMatchTransferSchema, bankTransferAmount } from "../lib/api/bank-transfer-wire";

const fields = { fromBankAccountId: "00000000-0000-4000-8000-000000000001", toBankAccountId: "00000000-0000-4000-8000-000000000002", date: "2026-10-04" };
test("bank transfer amounts preserve REST major and MCP minor units with exact aliases", () => {
  for (const [currency, major] of [["USD", "12.50"], ["JPY", "1250"], ["KWD", "1.250"], ["IRR", "1250"]]) {
    assert.equal(bankTransferAmount(bankTransferSchema.parse({ ...fields, amount: Number(major), amountExact: major, amountMinor: "1250" }), currency), 1250);
    assert.equal(bankTransferAmount(bankTransferMcpSchema.parse({ ...fields, amount: 1250, amountExact: major, amountMinor: "1250" }), currency, "mcp"), 1250);
  }
  assert.equal(bankTransferAmount({ amountExact: "0.005" }, "USD"), 1);
  assert.equal(bankTransferAmount({ amountMinor: "9007199254740991" }, "USD"), Number.MAX_SAFE_INTEGER);
  assert.equal(bankTransferAmount({ amountExact: "90071992547409.91" }, "USD"), Number.MAX_SAFE_INTEGER);
  for (const input of [{}, { amount: 0 }, { amount: 0.004 }, { amountMinor: "-1" }, { amountMinor: "9007199254740992" },
    { amount: 12.50, amountExact: "12.51" }, { amount: 12.50, amountMinor: "1251" }]) assert.throws(() => bankTransferAmount(input, "USD"));
  assert.throws(() => bankTransferAmount({ amount: 1250, amountExact: "12.51" }, "USD", "mcp"));
});
test("bank transfer schemas reject malformed money, IDs, dates and unknown fields", () => {
  for (const value of ["01", "-0", "1e3", " 1250", "۱۲۵۰", "12.50", "9223372036854775808"]) {
    assert.equal(bankTransferSchema.safeParse({ ...fields, amountMinor: value }).success, false);
  }
  for (const extra of [{ date: "2026-02-30" }, { date: "2026-10-04T12:00:00Z" }, { fromBankAccountId: "bad" }, { unknown: 1 },
    { amountExact: "1e3" }, { amount: Infinity }, { amount: -1 }]) assert.equal(bankTransferSchema.safeParse({ ...fields, amount: 12.50, ...extra }).success, false);
  assert.equal(bankTransferMcpSchema.safeParse({ ...fields, amount: 12.50 }).success, false);
  assert.equal(bankMatchTransferSchema.safeParse({ targetBankAccountId: fields.toBankAccountId, amountMinor: "1250" }).success, false);
});
