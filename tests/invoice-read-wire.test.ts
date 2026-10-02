import assert from "node:assert/strict";
import { test } from "node:test";
import { invoiceReadDto, invoiceBaseDto, invoiceListSchema, invoiceSummaryDto } from "../lib/api/invoice-read-wire";
import { WireCompatibilityError, stringifyWire } from "../lib/money/wire";
import { classifyRate } from "../lib/currency/rate-status";

const header = { subtotal: 1250, taxTotal: 0, total: 1250, amountPaid: 0, amountDue: 1250 };
const status = classifyRate(1000000, "manual", "2026-10-03", "2026-10-03", false);

test("Invoice read aliases preserve stored units, nested money and physical quantities", () => {
  for (const currencyCode of ["USD", "IRR", "JPY", "KWD"]) {
    const dto = invoiceReadDto({ ...header, currencyCode, contact: { organizationId: "a", creditLimit: 3000 },
      lines: [{ unitPrice: 1250, amount: 1250, taxAmount: 0, quantity: 100, discountPercent: 1000 }] }, "a");
    assert.equal(dto.total, 1250); assert.equal(dto.totalMinor, "1250");
    assert.equal(dto.contact?.creditLimitMinor, "3000");
    assert.equal(dto.lines?.[0].unitPriceMinor, "1250"); assert.equal(dto.lines?.[0].amountMinor, "1250");
    assert.equal(JSON.parse(stringifyWire(dto)).lines[0].quantity, 100);
    assert.equal(JSON.parse(stringifyWire(dto)).lines[0].discountPercent, 1000);
  }
  assert.equal(invoiceReadDto({ ...header, contact: { organizationId: "a", creditLimit: null } }, "a").contact?.creditLimitMinor, null);
  const large = invoiceReadDto({ ...header, total: Number.MAX_SAFE_INTEGER, contact: null }, "a");
  assert.equal(large.totalMinor, "9007199254740991");
  for (const value of [Number.MAX_SAFE_INTEGER + 1, 1.25, NaN, Infinity]) {
    assert.throws(() => invoiceReadDto({ ...header, total: value, contact: null }, "a"), WireCompatibilityError);
    assert.throws(() => invoiceReadDto({ ...header, contact: null, lines: [{ unitPrice: value, amount: 1, taxAmount: 0 }] }, "a"), WireCompatibilityError);
  }
  assert.throws(() => invoiceReadDto({ ...header, contact: { organizationId: "b", creditLimit: null } }, "a"), WireCompatibilityError);
  for (const field of ["account", "taxRate"]) {
    assert.throws(() => invoiceReadDto({ ...header, contact: null,
      lines: [{ unitPrice: 1, amount: 1, taxAmount: 0, [field]: { organizationId: "b" } }] }, "a"), WireCompatibilityError);
  }
});

test("Invoice base display declares lookup rate, exact rounding and supported ranges", () => {
  const identity = invoiceBaseDto("USD", "USD", { ...header, total: Number.MAX_SAFE_INTEGER }, status);
  assert.equal(identity.amounts.totalMinor, "9007199254740991"); assert.equal(identity.rateExact, "1");
  assert.equal(identity.rateBasis, "historical_lookup_millionths");
  const half = { ...status, rate: 500000 };
  assert.equal(invoiceBaseDto("EUR", "USD", { ...header, total: 1 }, half).amounts.totalMinor, "1");
  assert.equal(invoiceBaseDto("EUR", "USD", { ...header, total: -1 }, half).amounts.totalMinor, "0");
  assert.equal(invoiceBaseDto("EUR", "USD", { ...header, total: -3 }, half).amounts.totalMinor, "-1");
  assert.throws(() => invoiceBaseDto("EUR", "USD", { ...header, total: Number.MAX_SAFE_INTEGER }, { ...status, rate: 2000000 }), WireCompatibilityError);
  assert.throws(() => invoiceBaseDto("JPY", "USD", header, status), WireCompatibilityError);
  const missing = invoiceBaseDto("JPY", "USD", header, { ...status, rate: null, missing: true });
  assert.equal(missing.rateExact, null); assert.equal(missing.amounts.totalMinor, null);
  assert.equal(missing.amounts.total, null);
  assert.throws(() => invoiceBaseDto("EUR", "USD", header, { ...status, rate: 0 }), WireCompatibilityError);
});

test("Invoice summary conserves large exact sums and independent aging buckets", () => {
  const now = new Date("2026-10-03T12:00:00Z");
  const row = (amountDue: string, dueDate = "2026-10-03", status = "sent") => ({ amountDue, dueDate, status, currencyCode: "USD" });
  const dto = invoiceSummaryDto([row("2147483648"), row("10", "2026-09-03", "overdue"),
    row("20", "2026-08-04"), row("30", "2026-08-03"), row("-1")], 8, now);
  assert.equal(dto.totalCount, 8); assert.equal(dto.outstanding, 2147483707); assert.equal(dto.outstandingMinor, "2147483707");
  assert.equal(dto.outstandingCount, 5); assert.equal(dto.overdueMinor, "10");
  assert.deepEqual(dto.aging["1-30"], { count: 1, amount: 10, amountMinor: "10" });
  assert.equal(dto.aging["31-60"].amountMinor, "20"); assert.equal(dto.aging["60+"].amountMinor, "30");
  assert.equal(dto.aging.current.amountMinor, "2147483648");
  assert.equal(invoiceSummaryDto([], 2, now).currencyCode, null);
  assert.equal(invoiceSummaryDto([], 2, now).outstandingMinor, "0");
  assert.throws(() => invoiceSummaryDto([row("9007199254740991"), row("1")], 2, now), WireCompatibilityError);
  assert.throws(() => invoiceSummaryDto([row("9223372036854775807"), row("9223372036854775807")], 2, now), WireCompatibilityError);
  // Signed totals may be safe while a positive aging bucket exceeds compatibility.
  assert.throws(() => invoiceSummaryDto([row("9007199254740991"), row("1"), row("-1")], 3, now), WireCompatibilityError);
  assert.throws(() => invoiceSummaryDto([row("1"), { ...row("1"), currencyCode: "EUR" }], 2, now), WireCompatibilityError);
});

test("Invoice read filters reject malformed dates, IDs, pagination and reversed ranges", () => {
  assert.equal(invoiceListSchema.parse({}).page, 1);
  assert.equal(invoiceListSchema.parse({ status: "pending_approval" }).status, "pending_approval");
  for (const input of [{ startDate: "2026-02-30" }, { endDate: "invalid" }, { contactId: "not-a-uuid" },
    { startDate: "2026-10-03", endDate: "2026-10-02" }, { page: NaN }, { page: 21474837 }, { limit: 101 }]) {
    assert.equal(invoiceListSchema.safeParse(input).success, false);
  }
});
