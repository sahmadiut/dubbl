import assert from "node:assert/strict";
import { test } from "node:test";
import { z } from "zod";
import { debitNoteCreateFields, debitNoteMcpCreateFields, debitNoteUpdateFields, debitNoteTotals,
  debitNoteDto, debitNoteApplyFields, debitNoteBalances } from "../lib/api/debit-note-wire";
import { creditAmount } from "../lib/api/credit-wire";

const supplier = "00000000-0000-4000-8000-000000000001", tax = "00000000-0000-4000-8000-000000000002";
const parse = (line: object, mcp = false, currencyCode = "USD") => z.object(mcp ? debitNoteMcpCreateFields : debitNoteCreateFields).strict()
  .parse({ contactId: supplier, issueDate: "2026-10-03", currencyCode, lines: [{ description: "Return", ...line }] });
test("debit-note REST major/MCP minor aliases retain exact tax/discount and currency units", () => {
  for (const price of [{ unitPrice: 12.5 }, { unitPriceExact: "12.50" }, { unitPriceMinor: "1250" }, { unitPrice: 12.5, unitPriceExact: "12.50", unitPriceMinor: "1250" }]) {
    const p = parse({ ...price, quantity: 1.5, discountPercent: 1000, taxRateId: tax });
    const totals = debitNoteTotals(p.lines, "rest", "USD", new Map([[tax, 1000]]));
    assert.equal(totals.total, 1856); assert.equal(totals.processedLines[0].quantity, 150);
  }
  const p = parse({ unitPrice: 1250, unitPriceExact: "12.50", unitPriceMinor: "1250" }, true);
  assert.equal(debitNoteTotals(p.lines, "mcp", "USD", new Map()).total, 1250);
  for (const [currency, major] of [["USD", "12.50"], ["JPY", "1250"], ["IRR", "1250"], ["KWD", "1.250"]])
    assert.equal(debitNoteTotals(parse({ unitPriceExact: major }, false, currency).lines, "rest", currency, new Map()).total, 1250);
  assert.equal(debitNoteTotals(parse({ unitPriceExact: "0.005", quantity: 3 }).lines, "rest", "USD", new Map()).total, 2);
});
test("debit-note schemas and calculations reject unsafe inputs before writers", () => {
  for (const line of [{ unitPriceMinor: "01" }, { unitPriceMinor: "9007199254740992" }, { unitPrice: 1, unitPriceExact: "2" },
    { unitPriceMinor: "9007199254740991", quantity: 2 }, { unitPriceMinor: "9007199254740991", taxRateId: tax }])
    assert.throws(() => debitNoteTotals(parse(line).lines, "rest", "USD", new Map([[tax, 10000]])));
  for (const input of [{ organizationId: supplier }, { status: "sent" }, { total: 1 }, { invoiceId: supplier }, { issueDate: "2026-02-30" }])
    assert.throws(() => z.object(debitNoteUpdateFields).strict().parse(input));
  for (const input of [{ amount: 0 }, { amountMinor: "-1" }, { amount: 2, amountMinor: "1" }, { amountMinor: "9007199254740992" }, {}])
    assert.throws(() => creditAmount(z.object(debitNoteApplyFields).strict().parse({ billId: supplier, ...input })));
  assert.equal(creditAmount(z.object(debitNoteApplyFields).parse({ billId: supplier, amount: 1250, amountMinor: "1250" })), 1250);
});
test("debit-note DTOs preserve numeric compatibility, exact aliases and saved totals", () => {
  const header = { subtotal: 1250, taxTotal: 0, total: 1250, amountApplied: 0, amountRemaining: 0 };
  assert.equal(debitNoteDto(header).total, 1250); assert.equal(debitNoteDto(header).totalMinor, "1250");
  debitNoteBalances(header, [{ unitPrice: 1250, amount: 1250, taxAmount: 0 }]);
  assert.throws(() => debitNoteBalances({ ...header, total: 1 }, [{ unitPrice: 1250, amount: 1250, taxAmount: 0 }]));
  assert.throws(() => debitNoteDto({ ...header, total: Number.MAX_SAFE_INTEGER + 1 }));
});
