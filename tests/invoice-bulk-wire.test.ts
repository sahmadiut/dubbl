import assert from "node:assert/strict";
import { test } from "node:test";
import { invoiceImportGroups, invoiceImportRowSchema, invoiceImportTotals, invoiceImportPreviewTotals, formatInvoiceReminderAmount } from "../lib/api/invoice-bulk-wire";
import { WireCompatibilityError } from "../lib/money/wire";

const contactId = "00000000-0000-4000-8000-000000000001";
const header = { contactId, issueDate: "2026-01-01", dueDate: "2026-02-01" };
const row = (line: Record<string, unknown>, currencyCode = "USD") => invoiceImportRowSchema.parse({ ...header, currencyCode, lines: [{ description: "Item", ...line }] });

test("bulk invoice import decimal, minor, signed and currency contracts", () => {
  for (const [currency, expected] of [["USD", 1250], ["JPY", 13], ["IRR", 13], ["KWD", 12500]] as const) {
    assert.equal(invoiceImportTotals(row({ unitPrice: 12.5 }, currency)).total, expected);
    assert.equal(invoiceImportTotals(row({ unitPriceExact: "12.50" }, currency)).total, expected);
    assert.equal(invoiceImportTotals(row({ unitPriceMinor: "1250" }, currency)).total, 1250);
  }
  assert.equal(invoiceImportTotals(row({ unitPriceExact: "0.005", quantity: 3 })).total, 2);
  assert.equal(invoiceImportTotals(row({ unitPriceExact: "-0.015" })).total, -1);
  assert.equal(invoiceImportTotals(row({ unitPrice: 0.29 })).total, 29);
  assert.equal(invoiceImportTotals(row({ unitPrice: 12.5, unitPriceExact: "12.50", unitPriceMinor: "1250" })).total, 1250);
  assert.equal(invoiceImportTotals(row({})).total, 0);
  const dto = invoiceImportPreviewTotals(row({ unitPriceMinor: String(Number.MAX_SAFE_INTEGER) }), new Map());
  assert.equal(dto.total, Number.MAX_SAFE_INTEGER); assert.equal(dto.totalMinor, "9007199254740991");
});

test("bulk invoice import rejects malformed and unsupported values and sums", () => {
  for (const line of [{ unitPriceExact: "1e3" }, { unitPriceMinor: "01" }, { unitPriceMinor: "-0" }, { unitPriceMinor: "9223372036854775808" },
    { unitPrice: Infinity }, { quantity: 21474836.48 }, { unitPriceExact: "1", rateExact: "1" }]) assert.throws(() => row(line));
  for (const line of [{ unitPrice: 12.5, unitPriceExact: "12.51" }, { unitPriceExact: "12.50", unitPriceMinor: "12" }])
    assert.throws(() => invoiceImportTotals(row(line)), /disagree/);
  for (const line of [{ unitPriceMinor: "9007199254740992" }, { unitPriceMinor: "9007199254740991", quantity: 2, discountPercent: 10000 }])
    assert.throws(() => invoiceImportTotals(row(line)), WireCompatibilityError);
  const summed = invoiceImportRowSchema.parse({ ...header, lines: [{ description: "Max", unitPriceMinor: "9007199254740991" }, { description: "One", unitPriceMinor: "1" }] });
  assert.throws(() => invoiceImportTotals(summed), WireCompatibilityError);
  assert.throws(() => invoiceImportRowSchema.parse({ ...header, lines: [], status: "paid" }));
  assert.throws(() => row({}, "BTC"));
});

test("flat invoice groups preserve exact CSV strings and reject header/alias conflicts", () => {
  const flat = { ...header, invoiceNumber: "External-1", lineDescription: "Item", lineQuantity: "1.50", lineUnitPrice: "12.50" };
  const groups = invoiceImportGroups([flat, { ...flat, lineUnitPrice: undefined, lineUnitPriceMinor: "1250" }], "custom");
  assert.equal(groups.length, 1);
  assert.equal(invoiceImportTotals(invoiceImportRowSchema.parse(groups[0])).total, 3750);
  assert.equal(invoiceImportGroups([{ ...flat, invoiceNumber: "" }, { ...flat, invoiceNumber: undefined }], "custom").length, 1);
  assert.equal(invoiceImportGroups([{ ...flat, invoiceNumber: JSON.stringify([contactId, header.issueDate, header.dueDate, null]) },
    { ...flat, invoiceNumber: undefined }], "custom").length, 2);
  assert.equal(invoiceImportGroups([{ ...flat, lineUnitPrice: "12.5", lineUnitPriceExact: "12.50" }], "custom").length, 1);
  assert.equal(invoiceImportGroups([{ ...flat, issueDate: "1/1/2026", dueDate: "1 Feb 2026" }], "quickbooks")[0].issueDate, "2026-01-01");
  for (const values of [{ currencyCode: "JPY" }, { contactId: "00000000-0000-4000-8000-000000000002" }, { dueDate: "2026-03-01" }])
    assert.throws(() => invoiceImportGroups([flat, { ...flat, ...values }], "custom"), /headers/);
  for (const values of [{ lineUnitPrice: "12USD" }, { lineUnitPrice: "1e3" }, { lineQuantity: "1.001" }, { lineUnitPrice: "12.5", lineUnitPriceExact: "12.51" }])
    assert.throws(() => invoiceImportGroups([{ ...flat, ...values }], "custom"));
  assert.equal(invoiceImportGroups([{ ...header, lines: [{ description: "Nested" }] }, flat], "custom").length, 2);
});

test("reminder display preserves every minor unit at the safe range boundary", () => {
  assert.equal(formatInvoiceReminderAmount(1250, "USD"), "$12.50");
  assert.equal(formatInvoiceReminderAmount(Number.MAX_SAFE_INTEGER, "USD"), "$90,071,992,547,409.91");
  assert.equal(formatInvoiceReminderAmount(1250, "JPY"), "¥1,250");
  assert.ok(formatInvoiceReminderAmount(1250, "KWD").includes("1.250"));
  assert.throws(() => formatInvoiceReminderAmount(9007199254740992, "USD"));
});
