import assert from "node:assert/strict";
import { test } from "node:test";
import { billReadDto, billListSchema, billCountsDto } from "../lib/api/bill-read-wire";
import { documentBaseDto } from "../lib/api/document-base-wire";
import { classifyRate } from "../lib/currency/rate-status";
import { stringifyWire, WireCompatibilityError } from "../lib/money/wire";

const header = { subtotal: 1250, taxTotal: 0, total: 1250, amountPaid: 0, amountDue: 1250 };
const line = { unitPrice: 1250, amount: 1250, taxAmount: 0, quantity: 150, discountPercent: 1000 };
const status = (rate: number | null) => ({ ...classifyRate(rate ?? 1000000, "manual", "2026-10-03", "2026-10-03", false), rate, missing: rate === null });
const row = { status: "draft", count: 2, amount: "2147483649", minAmount: "1", maxAmount: "2147483648", currencyCount: 1, currencyCode: "USD" };

test("Bill read aliases preserve money, quantities, discounts and nullable limits", () => {
  for (const currencyCode of ["USD", "IRR", "JPY", "KWD"]) {
    const dto = billReadDto({ ...header, currencyCode, contact: { organizationId: "a", creditLimit: null }, lines: [line] }, "a");
    assert.equal(dto.total, 1250); assert.equal(dto.totalMinor, "1250");
    assert.equal(dto.contact?.creditLimitMinor, null);
    assert.equal(dto.lines?.[0].unitPriceMinor, "1250"); assert.equal(dto.lines?.[0].quantity, 150);
    assert.equal(dto.lines?.[0].discountPercent, 1000);
    assert.doesNotThrow(() => stringifyWire(dto));
  }
  const dto = billReadDto({ ...header, total: Number.MAX_SAFE_INTEGER, contact: { organizationId: "a", creditLimit: 3000 } }, "a");
  assert.equal(dto.totalMinor, "9007199254740991"); assert.equal(dto.contact?.creditLimitMinor, "3000");
  assert.equal(billReadDto({ ...header, contact: null }, "a").contact, null);
  for (const field of Object.keys(header)) {
    assert.throws(() => billReadDto({ ...header, [field]: Number.MAX_SAFE_INTEGER + 1, contact: null }, "a"), WireCompatibilityError);
  }
  for (const field of ["unitPrice", "amount", "taxAmount"]) {
    assert.throws(() => billReadDto({ ...header, contact: null, lines: [{ ...line, [field]: 1.5 }] }, "a"), WireCompatibilityError);
  }
});

test("Bill read references reject foreign contacts/accounts/taxes before disclosure", () => {
  assert.throws(() => billReadDto({ ...header, contact: { organizationId: "b", creditLimit: 0 } }, "a"), WireCompatibilityError);
  for (const field of ["account", "taxRate"]) {
    assert.throws(() => billReadDto({ ...header, contact: null, lines: [{ ...line, [field]: { organizationId: "b" } }] }, "a"), WireCompatibilityError);
  }
  assert.throws(() => billReadDto({ ...header, contact: { organizationId: "a", creditLimit: Infinity } }, "a"), WireCompatibilityError);
  assert.doesNotThrow(() => billReadDto({ ...header, contact: null, lines: [{ ...line, account: null, taxRate: null }] }, "a"));
});

test("Bill status totals use exact text, per-status currency and unsafe individual guards", () => {
  assert.deepEqual(billCountsDto([]), { counts: {}, total: 0 });
  const dto = billCountsDto([row, { ...row, status: "received", currencyCode: "EUR", count: 1, amount: "-1", minAmount: "-1", maxAmount: "-1" }]);
  assert.deepEqual(dto.counts.draft, { count: 2, amount: 2147483649, amountMinor: "2147483649", currencyCode: "USD" });
  assert.equal(dto.total, 3); assert.equal(dto.counts.received.amountMinor, "-1");
  for (const patch of [{ currencyCount: 2 }, { amount: "9007199254740992" }, { amount: "0", minAmount: "-9007199254740992", maxAmount: "9007199254740992" }, { amount: "0", minAmount: "-9223372036854775808" }]) {
    assert.throws(() => billCountsDto([{ ...row, ...patch }]), WireCompatibilityError);
  }
  assert.equal(billCountsDto([{ ...row, amount: "9007199254740991", maxAmount: "9007199254740991" }]).counts.draft.amount, Number.MAX_SAFE_INTEGER);
});

test("Bill filters and display FX retain units, signed ties, missing-rate nulls and range guards", () => {
  assert.deepEqual(billListSchema.parse({}), { limit: 50, page: 1 });
  assert.equal(billListSchema.parse({ status: "pending_approval" }).status, "pending_approval");
  for (const patch of [{ page: 21474837 }, { page: NaN }, { status: "sent" }, { limit: 101 }]) assert.equal(billListSchema.safeParse(patch).success, false);
  assert.equal(documentBaseDto("USD", "USD", { ...header, total: Number.MAX_SAFE_INTEGER }, status(1000000)).amounts.totalMinor, "9007199254740991");
  const missing = documentBaseDto("IRR", "USD", header, status(null));
  assert.equal(missing.amounts.total, null); assert.equal(missing.amounts.totalMinor, null); assert.equal(missing.rateExact, null);
  assert.equal(documentBaseDto("EUR", "USD", { ...header, total: 1 }, status(500000)).amounts.totalMinor, "1");
  assert.equal(documentBaseDto("EUR", "USD", { ...header, total: -1 }, status(500000)).amounts.totalMinor, "0");
  for (const rate of [0, -1, 2147483648, 1.5]) assert.throws(() => documentBaseDto("USD", "USD", header, status(rate)), WireCompatibilityError);
  assert.throws(() => documentBaseDto("JPY", "USD", header, status(1000000)), WireCompatibilityError);
  assert.throws(() => documentBaseDto("EUR", "USD", { ...header, total: Number.MAX_SAFE_INTEGER }, status(2000000)), WireCompatibilityError);
});
