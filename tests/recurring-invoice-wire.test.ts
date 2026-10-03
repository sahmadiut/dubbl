import assert from "node:assert/strict";
import { test } from "node:test";
import { recurringInvoiceStoredLines, recurringInvoiceTotals, recurringInvoiceCreateSchema, recurringInvoiceUpdateSchema,
  recurringInvoiceDates, advanceRecurringInvoiceDate, recurringInvoiceDto } from "../lib/api/recurring-invoice-wire";
import { WireCompatibilityError } from "../lib/money/wire";

const line = { description: "Subscription", quantity: 1.5, discountPercent: 1000, taxRateId: null, accountId: null };
test("recurring price aliases preserve currency scales and agree before storage", () => {
  for (const [currency, price] of [["USD", 1250], ["JPY", 13], ["IRR", 13], ["KWD", 12500]] as const) {
    for (const input of [{ unitPrice: 12.5 }, { unitPriceExact: "12.50" }, { unitPriceMinor: String(price) }, { unitPrice: 12.5, unitPriceExact: "12.50", unitPriceMinor: String(price) }]) {
      const stored = recurringInvoiceStoredLines([{ ...line, ...input }], currency);
      assert.equal(stored[0].unitPrice, price); assert.equal(stored[0].quantity, 150);
    }
  }
  assert.throws(() => recurringInvoiceStoredLines([{ ...line, unitPrice: 12.5, unitPriceMinor: "1249" }], "USD"));
  assert.throws(() => recurringInvoiceStoredLines([{ ...line, unitPriceExact: "12.51", unitPrice: 12.5 }], "USD"));
  for (const unitPriceMinor of ["01", "-0", "1e3", " 1", "۱۲۵۰", "1.5", "9223372036854775808"]) assert.throws(() => recurringInvoiceStoredLines([{ ...line, unitPriceMinor }], "USD"));
  assert.throws(() => recurringInvoiceStoredLines([{ ...line, unitPriceMinor: "9007199254740992" }], "USD"), WireCompatibilityError);
  assert.equal(recurringInvoiceStoredLines([{ description: "Omitted" }], "USD")[0].unitPrice, 0);
});
test("stored recurring totals use price-first, quantity-hundredths and exact signed rounding", () => {
  const stored = recurringInvoiceStoredLines([{ ...line, unitPriceExact: "12.505", taxRateId: "00000000-0000-4000-8000-000000000001" }], "USD");
  const totals = recurringInvoiceTotals(stored, new Map([[stored[0].taxRateId!, 1000]]));
  assert.equal(stored[0].unitPrice, 1251); assert.equal(totals.subtotal, 1689); assert.equal(totals.taxTotal, 169); assert.equal(totals.total, 1858);
  const negative = recurringInvoiceStoredLines([{ description: "Credit", unitPriceMinor: "-1", quantity: .5 }], "USD");
  assert.equal(recurringInvoiceTotals(negative, new Map()).total, 0);
  assert.equal(recurringInvoiceTotals([{ ...negative[0], quantity: 150 }], new Map()).total, -1);
});
test("recurring products, component totals and saved responses reject unsupported ranges", () => {
  const max = recurringInvoiceStoredLines([{ description: "Max", unitPriceMinor: "9007199254740991" }], "USD")[0];
  assert.equal(recurringInvoiceTotals([max], new Map()).total, Number.MAX_SAFE_INTEGER);
  assert.throws(() => recurringInvoiceTotals([{ ...max, quantity: 200, discountPercent: 10000 }], new Map()), WireCompatibilityError);
  assert.throws(() => recurringInvoiceTotals([max, max], new Map()), WireCompatibilityError);
  assert.throws(() => recurringInvoiceTotals([{ ...max, taxRateId: "tax" }], new Map([["tax", 10000]])), WireCompatibilityError);
  assert.throws(() => recurringInvoiceDto({ organizationId: "a", currencyCode: "USD", lines: [{ ...max, unitPrice: 9007199254740992 }] }), WireCompatibilityError);
  assert.throws(() => recurringInvoiceDto({ organizationId: "a", currencyCode: "USD", contact: { organizationId: "b", creditLimit: 0 } }), WireCompatibilityError);
});
test("recurring schedules validate canonical dates, cap and unsupported FX/header fields", () => {
  const basic = { name: "Monthly", contactId: "00000000-0000-4000-8000-000000000001", frequency: "monthly", startDate: "2026-01-01", lines: [{ description: "Subscription" }] };
  assert.equal(recurringInvoiceCreateSchema.parse(basic).currencyCode, "USD");
  for (const input of [{ startDate: "2026-02-30" }, { maxOccurrences: 2147483648 }, { rateExact: "1.2" }, { currencyCode: "unknown" }]) assert.throws(() => recurringInvoiceCreateSchema.parse({ ...basic, ...input }));
  assert.throws(() => recurringInvoiceUpdateSchema.parse({ lines: [] }));
  assert.throws(() => recurringInvoiceDates("2026-10-03", "2026-10-02"));
  assert.equal(advanceRecurringInvoiceDate("2026-01-31", "monthly"), "2026-03-03");
  assert.equal(advanceRecurringInvoiceDate("2024-02-29", "annual"), "2025-03-01");
  assert.throws(() => advanceRecurringInvoiceDate("9999-12-31", "annual"));
});
