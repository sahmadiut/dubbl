import assert from "node:assert/strict";
import { test } from "node:test";
import { invoiceUiDocument, invoiceUiSummary, invoiceUiBase, invoiceUiMinor, invoiceUiAmount, invoiceUiCreditAmount,
  invoiceUiCopyLines, invoiceUiMoney, invoiceUiPercent, invoiceUiDecimal } from "../lib/money/invoice-ui";
import { publicMoneyDto } from "../lib/api/public-money-wire";
import { invoiceSummaryDto } from "../lib/api/invoice-read-wire";
import { paymentPaySchema } from "../lib/api/payment-settlement-wire";
import { creditAmount } from "../lib/api/credit-wire";
import { interestSchema, interestOverride } from "../lib/api/invoice-lifecycle-wire";
import { documentEditorPreview } from "../lib/money/document-editor";
import { invoiceWriteTotals, invoiceCreateSchema } from "../lib/api/invoice-write-wire";
import { invoiceBaseDto } from "../lib/api/invoice-read-wire";

test("invoice UI adopts raw-unit aliases with exact currency scales and low digits", () => {
  for (const [currency, input, units] of [["USD", "12.50", "1250"], ["JPY", "1250", "1250"],
    ["IRR", "1250", "1250"], ["KWD", "1.250", "1250"], ["USD", "90071992547409.91", "9007199254740991"]]) {
    const parsed = invoiceUiAmount(input, currency);
    assert.equal(parsed.amountMinor, units);
    assert.equal(creditAmount(parsed), Number(units));
    assert.equal(interestOverride(interestSchema.parse(parsed), currency), Number(units));
    assert.equal(creditAmount(paymentPaySchema.parse({ ...parsed, date: "2026-10-11" })), Number(units));
    assert.equal(invoiceUiDecimal(BigInt(units), currency), input);
  }
  assert.equal(invoiceUiMoney(9007199254740991n, "USD"), "$90,071,992,547,409.91");
  assert.equal(invoiceUiMoney(-1n, "USD"), "-$0.01");
  assert.equal(invoiceUiMoney(1250n, "KWD"), "KWD 1.250");
  const row = publicMoneyDto({ currencyCode: "KWD", subtotal: 1250, taxTotal: 1, total: 1251, amountPaid: 1, amountDue: 1250 },
    ["subtotal", "taxTotal", "total", "amountPaid", "amountDue"]);
  assert.equal(invoiceUiDocument(row).total, 1251n);
  assert.equal(invoiceUiMinor({ amount: 1250 }, "amount"), 1250n); // Validated legacy fallback.
});

test("malformed, conflicting, fractional-minor and unsupported invoice inputs fail closed", () => {
  for (const input of ["", "-1", "0", "1x", "1e2", "1.", " 1", "1,000", "NaN", "١٢", "0.001", "90071992547409.92"]) {
    assert.throws(() => invoiceUiAmount(input, "USD"), input);
  }
  assert.throws(() => invoiceUiAmount("1.1", "JPY"));
  assert.throws(() => invoiceUiAmount("1", "ZZZ"));
  for (const row of [{ amount: 1, amountMinor: "2" }, { amount: 1, amountMinor: "01" }, { amount: 1, amountMinor: "-0" },
    { amount: 1, amountMinor: null }, { amount: 1.1 }, { amount: Number.MAX_SAFE_INTEGER + 1 }, { amount: 1, amountMinor: "9223372036854775807" }]) {
    assert.throws(() => invoiceUiMinor(row, "amount"));
  }
  assert.throws(() => invoiceUiCreditAmount({ currencyCode: "KWD", amountRemaining: 1250n }, { currencyCode: "USD", amountDue: 1250n }));
  assert.throws(() => invoiceUiCreditAmount({ currencyCode: "USD", amountRemaining: 0n }, { currencyCode: "USD", amountDue: 1250n }));
  assert.deepEqual(invoiceUiCreditAmount({ currencyCode: "USD", amountRemaining: 9007199254740991n },
    { currencyCode: "USD", amountDue: 4000000000000003n }), { amountMinor: "4000000000000003" });
});

test("invoice aging and paid percentages divide bigint before presentation conversion", () => {
  const summary = invoiceUiSummary(invoiceSummaryDto([
    { currencyCode: "KWD", amountDue: "4000000000000001", status: "sent", dueDate: "2026-10-12" },
    { currencyCode: "KWD", amountDue: "2", status: "overdue", dueDate: "2026-09-12" },
  ], 2, new Date("2026-10-11T12:00:00Z")));
  assert.equal(summary.outstanding, 4000000000000003n);
  assert.equal(summary.aging.current.amount + summary.aging["1-30"].amount, summary.outstanding);
  assert.equal(summary.currencyCode, "KWD");
  assert.equal(invoiceUiPercent(1n, 3n), 33);
  assert.equal(invoiceUiPercent(1n, 3n, 2), 33.33);
  assert.equal(invoiceUiPercent(9007199254740991n, 9007199254740991n), 100);
  assert.equal(invoiceUiPercent(-1n, 2n), 0);
  assert.equal(invoiceUiPercent(3n, 2n), 100);
  assert.throws(() => invoiceUiSummary({ ...invoiceSummaryDto([], 0), outstanding: 1, outstandingMinor: "1" }));
  const base = invoiceUiBase(invoiceBaseDto("USD", "EUR", { subtotal: 1250, taxTotal: 0, total: 1250, amountPaid: 250, amountDue: 1000 },
    { rate: 1000000 } as Parameters<typeof invoiceBaseDto>[3]));
  assert.equal(base.amounts.total, 1250n); assert.equal(base.baseCurrency, "EUR");
  assert.equal(invoiceUiBase({ baseCurrency: "USD", amounts: Object.fromEntries(["subtotal", "taxTotal", "total", "amountPaid", "amountDue"].map(key => [key, null])) }).amounts.total, null);
  assert.throws(() => invoiceUiBase({ baseCurrency: "USD", amounts: { total: null, totalMinor: "1" } }));
});

test("saved invoice copy preserves scale, tax and dimensions and matches REST preview", () => {
  const accountId = "00000000-0000-4000-8000-000000000001", taxRateId = "00000000-0000-4000-8000-000000000002";
  for (const currency of ["USD", "JPY", "IRR", "KWD"]) {
    const lines = invoiceUiCopyLines([{ description: "Saved", quantity: 125, unitPrice: 1250n,
      account: { id: accountId }, taxRate: { id: taxRateId }, costCenterId: accountId, projectId: accountId,
      inventoryItemId: accountId, warehouseId: accountId, priceListId: accountId, discountPercent: 1000 }], currency);
    const saved = invoiceCreateSchema.parse({ contactId: accountId, issueDate: "2026-10-11", currencyCode: currency, lines });
    const totals = invoiceWriteTotals(saved.lines, currency, true, new Map([[taxRateId, 1000]]));
    const preview = documentEditorPreview(lines.map(line => ({ ...line, accountId: line.accountId || "", taxRateId: line.taxRateId || "", unitPrice: line.unitPriceExact, quantity: String(line.quantity) })), currency, [{ id: taxRateId, rate: 1000 }], true);
    // Shared editor has no discount control; copied payload retains saved discount.
    assert.equal(totals.processedLines[0].unitPrice, 1250);
    assert.equal(saved.lines[0].discountPercent, 1000);
    assert.equal(saved.lines[0].costCenterId, accountId); assert.equal(saved.lines[0].projectId, accountId);
    assert.equal(saved.lines[0].taxRateId, taxRateId); assert.equal(saved.currencyCode, currency);
    assert.equal(preview.error, null);
    const undiscounted = invoiceWriteTotals(saved.lines.map(line => ({ ...line, discountPercent: 0 })), currency, true, new Map([[taxRateId, 1000]]));
    assert.equal(preview.total, BigInt(undiscounted.total));
  }
});
