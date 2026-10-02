import assert from "node:assert/strict";
import { test } from "node:test";
import { publicMoneyDto, publicLineDto, publicStatementDto } from "../lib/api/public-money-wire";
import { WireCompatibilityError } from "../lib/money/wire";

test("public money aliases preserve minor units, quantities and signed safe integer edges", () => {
  for (const currencyCode of ["USD", "IRR", "JPY", "KWD"]) {
    const line = publicLineDto({ unitPrice: 1250, amount: -1250, taxAmount: 0, quantity: 150, discountPercent: 1000, currencyCode });
    assert.deepEqual(line, { unitPrice: 1250, unitPriceMinor: "1250", amount: -1250, amountMinor: "-1250",
      taxAmount: 0, taxAmountMinor: "0", quantity: 150, discountPercent: 1000, currencyCode });
  }
  assert.equal(publicMoneyDto({ total: Number.MAX_SAFE_INTEGER }, ["total"]).totalMinor, "9007199254740991");
  assert.equal(publicMoneyDto({ total: Number.MIN_SAFE_INTEGER }, ["total"]).totalMinor, "-9007199254740991");
  for (const total of [Number.MAX_SAFE_INTEGER + 1, NaN, Infinity, 1.5]) {
    assert.throws(() => publicMoneyDto({ total }, ["total"]), WireCompatibilityError);
  }
});

test("portal statement uses exact signed sums and rejects unsafe totals and mixed currencies", () => {
  const row = { issueDate: "2000-01-01", invoiceNumber: "Synthetic", status: "sent", currencyCode: "USD", total: 1250, amountPaid: 250, amountDue: 1000 };
  const statement = publicStatementDto([row, { ...row, amountDue: -250 }], "USD");
  assert.equal(statement.totalOutstandingMinor, "750");
  assert.equal(statement.lines[1].runningBalance, 750);
  assert.equal(statement.lines[0].amountMinor, "1250");
  assert.equal(publicStatementDto([], "IRR").totalOutstandingMinor, "0");
  assert.throws(() => publicStatementDto([{ ...row, amountDue: Number.MAX_SAFE_INTEGER }, row], "USD"), WireCompatibilityError);
  assert.throws(() => publicStatementDto([row, { ...row, currencyCode: "EUR" }], "USD"), WireCompatibilityError);
});
