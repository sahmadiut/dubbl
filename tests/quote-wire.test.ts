import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { quoteInputLines, quoteTotals, parseQuoteCreate, parseQuoteUpdate, quoteBilling, quoteConvertSchema, quoteReadDto } from "../lib/api/quote-wire";

const base = { contactId: randomUUID(), issueDate: "2026-10-01", expiryDate: "2026-11-01" };
const totals = (line: object, transport: "rest" | "mcp" = "rest", currency = "USD") => {
  const parsed = parseQuoteCreate({ ...base, currencyCode: currency, lines: [{ description: "Line", ...line }] }, transport);
  return quoteTotals(quoteInputLines(parsed.lines, transport), currency, new Map());
};
test("quote transport units, alias agreement, signed rounding and range guards", () => {
  assert.equal(totals({ unitPrice: 12.5, unitPriceExact: "12.50", unitPriceMinor: "1250", quantity: 1.5 }).total, 1875);
  assert.equal(totals({ unitPrice: 1250, unitPriceExact: "12.50", unitPriceMinor: "1250", quantity: 1.5 }, "mcp").total, 1875);
  assert.equal(totals({ unitPriceExact: "0.005", quantity: 3 }).total, 3);
  assert.equal(totals({ unitPriceExact: "-0.005" }).total, 0);
  for (const currency of ["USD", "IRR", "JPY", "KWD"]) assert.equal(totals({ unitPriceMinor: "1250" }, "rest", currency).total, 1250);
  for (const line of [{ unitPriceMinor: "01" }, { unitPriceExact: "1e3" }, { unitPrice: 12.5, unitPriceMinor: "12" },
    { unitPrice: 12.5, unitPriceExact: "12.5001" }, { unitPriceMinor: "9007199254740992" },
    { unitPriceMinor: "9007199254740991", quantity: 2 }, { quantity: 21474836.48 }]) assert.throws(() => totals(line));
  assert.throws(() => totals({ unitPrice: 1, unitPriceMinor: "2" }, "mcp"));
  assert.throws(() => parseQuoteUpdate({ organizationId: randomUUID() }, "rest"));
  assert.throws(() => parseQuoteCreate({ ...base, issueDate: "2026-02-30", lines: [{ description: "Bad" }] }, "rest"));
});
test("quote progress preserves exact residuals, discount, tax and original percentage policy", () => {
  const lines = [1, 1, 1].map((amount, sortOrder) => ({ id: randomUUID(), description: "Line", quantity: 100,
    unitPrice: amount, amount, taxAmount: 0, discountPercent: 0, accountId: null, taxRateId: null, costCenterId: null, sortOrder }));
  const header = { subtotal: 3, taxTotal: 0, total: 3, billedTotal: 1 };
  const residual = quoteBilling(header, lines, {});
  assert.equal(residual.total, 2); assert.equal(residual.billing.remainingMinor, "0"); assert.equal(residual.billing.fullyBilled, true);
  const partial = quoteBilling({ ...header, billedTotal: 0 }, lines, { percentage: 50 });
  assert.equal(partial.total, 3); // Each original half rounds up, as before.
  const line = { ...lines[0], unitPrice: 1250, amount: 1125, taxAmount: 113, discountPercent: 1000 };
  const milestone = quoteBilling({ subtotal: 1125, taxTotal: 113, total: 1238, billedTotal: 0 }, [line], { percentage: 100, lines: [{ quoteLineId: line.id, quantity: 0.5 }] });
  assert.equal(milestone.total, 618);
  assert.throws(() => quoteBilling(header, lines, { lines: [{ quoteLineId: lines[0].id, quantity: 0.001 }] }));
  assert.throws(() => quoteBilling(header, lines, { lines: [{ quoteLineId: lines[0].id, quantity: 1 }, { quoteLineId: lines[0].id, quantity: 1 }] }));
  assert.throws(() => quoteBilling(header, lines, { lines: [{ quoteLineId: randomUUID(), quantity: 1 }] }));
  assert.throws(() => quoteBilling(header, lines, { percentage: 100 }));
  assert.throws(() => quoteBilling({ ...header, total: 4 }, lines, {}));
  assert.throws(() => quoteConvertSchema.parse({ percentage: 101 }));
});
test("quote reads expose explicit money aliases and reject foreign or unsafe relations", () => {
  const org = randomUUID(), row = { subtotal: 1250, taxTotal: 0, total: 1250, billedTotal: 0, contact: { organizationId: org, creditLimit: 1000 } };
  const dto = quoteReadDto(row, org); assert.equal(dto.totalMinor, "1250"); assert.equal(dto.contact?.creditLimitMinor, "1000");
  assert.throws(() => quoteReadDto(row, randomUUID()));
  assert.throws(() => quoteReadDto({ ...row, total: 9007199254740992 }, org));
});
