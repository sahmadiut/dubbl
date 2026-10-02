import { z } from "zod";
import { invoiceStatusEnum } from "@/lib/db/schema/invoicing";
import { rateDateSchema } from "@/lib/currency/rate-policy";
import { currencyMetadata, roundRatio } from "@/lib/money/exact";
import { legacyMinor, WireCompatibilityError } from "@/lib/money/wire";
import { fromLegacyRate, FX_DIRECTION } from "@/lib/currency/exact-rate";
import { contactDto } from "./contact-wire";
import { publicMoneyDto, publicLineDto } from "./public-money-wire";
import type { RateStatus } from "@/lib/currency/rate-status";

export const invoiceListFields = {
  status: z.enum(invoiceStatusEnum.enumValues).optional().describe("Optional invoice status, including approval states"),
  contactId: z.string().uuid().optional().describe("Optional customer contact UUID in this organization"),
  startDate: rateDateSchema.optional().describe("Optional inclusive Gregorian issue date from, YYYY-MM-DD"),
  endDate: rateDateSchema.optional().describe("Optional inclusive Gregorian issue date to, YYYY-MM-DD"),
  limit: z.number().int().min(1).max(100).default(50).describe("Invoices per page, 1 through 100; defaults to 50"),
  page: z.number().int().min(1).max(21474836).default(1).describe("Page number, starting at 1; bounded to a safe SQL offset"),
  sortBy: z.enum(["date", "due", "total", "amountDue", "number", "created"]).default("created").describe("Sort column; defaults to creation time"),
  sortOrder: z.enum(["asc", "desc"]).default("desc").describe("Sort direction; defaults to descending"),
};
export const invoiceListSchema = z.object(invoiceListFields).superRefine((value, ctx) => {
  if (value.startDate && value.endDate && value.startDate > value.endDate) {
    ctx.addIssue({ code: "custom", path: ["endDate"], message: "Issue date range is reversed" });
  }
});

type Header = { subtotal: number; taxTotal: number; total: number; amountPaid: number; amountDue: number };
type Contact = { organizationId: string; creditLimit: number | null };
type Line = { unitPrice: number; amount: number; taxAmount: number;
  account?: { organizationId: string } | null; taxRate?: { organizationId: string } | null };

/** Intermediates/SQL sums may exceed int64 too; classify the safe-number limit first. */
function safeMinor(value: bigint) {
  const limit = BigInt(Number.MAX_SAFE_INTEGER);
  if (value < -limit || value > limit) throw new WireCompatibilityError();
  return legacyMinor(value);
}

/** Historical references may be inactive/deleted, but must never expose another tenant's data. */
export function invoiceReadDto<T extends Header & { contact: Contact | null; lines?: Line[] }>(value: T, orgId: string) {
  if ((value.contact && value.contact.organizationId !== orgId) || value.lines?.some(line =>
    (line.account && line.account.organizationId !== orgId) || (line.taxRate && line.taxRate.organizationId !== orgId))) {
    throw new WireCompatibilityError("Invoice contains a reference outside this organization");
  }
  return { ...publicMoneyDto(value, ["subtotal", "taxTotal", "total", "amountPaid", "amountDue"]),
    contact: value.contact ? contactDto(value.contact) : null,
    ...(value.lines ? { lines: value.lines.map(publicLineDto) } : {}) };
}

/** This is a display lookup at the issue date, not an invoice's persisted posting FX. */
export function invoiceBaseDto(currencyCode: string, baseCurrency: string, amounts: Header, status: RateStatus) {
  const rate = status.rate;
  const converted: Record<string, number | string | null> = {};
  if (rate !== null && (!Number.isSafeInteger(rate) || rate <= 0 || rate > 2147483647)) {
    throw new WireCompatibilityError("Invoice display rate is outside positive int32 millionths");
  }
  if (rate !== null && currencyMetadata(currencyCode).minorUnits !== currencyMetadata(baseCurrency).minorUnits) {
    throw new WireCompatibilityError("Legacy invoice base display requires matching currency scales");
  }
  for (const [key, amount] of Object.entries(amounts)) {
    if (!Number.isSafeInteger(amount)) throw new WireCompatibilityError();
    if (rate === null) { converted[key] = null; converted[`${key}Minor`] = null; continue; }
    const product = BigInt(amount) * BigInt(rate);
    // Retain the declared legacy product range; identity does not multiply a Number.
    if (rate !== 1000000) safeMinor(product);
    // Matches Math.round's tie toward +infinity, using exact integer arithmetic.
    const result = rate === 1000000 ? BigInt(amount) : roundRatio(2n * product + 1000000n, 2000000n, "floor");
    converted[key] = safeMinor(result); converted[`${key}Minor`] = result.toString();
  }
  return { baseCurrency, rate, rateExact: rate === null ? null : fromLegacyRate(rate),
    rateDirection: FX_DIRECTION, rateBasis: "historical_lookup_millionths", amounts: converted, status };
}

type SummaryRow = { status: string; dueDate: string; amountDue: string; currencyCode: string };
/** Text SQL amounts and bigint totals avoid int32 casts and Number aggregation. */
export function invoiceSummaryDto(rows: SummaryRow[], totalCount: number, now = new Date()) {
  const aging = {
    current: { count: 0, amount: 0n }, "1-30": { count: 0, amount: 0n },
    "31-60": { count: 0, amount: 0n }, "60+": { count: 0, amount: 0n },
  };
  const currencies = new Set(rows.map(row => row.currencyCode));
  if (currencies.size > 1) throw new WireCompatibilityError("Invoice summary cannot combine different currencies");
  let outstanding = 0n, overdue = 0n, overdueCount = 0;
  for (const row of rows) {
    const amount = BigInt(row.amountDue);
    // Guard individual history as well as final sums, including offsetting signed values.
    safeMinor(amount);
    outstanding += amount;
    if (row.status === "overdue") { overdue += amount; overdueCount++; }
    if (amount <= 0n) continue;
    const days = Math.floor((now.getTime() - Date.parse(`${row.dueDate}T00:00:00Z`)) / 86400000);
    const bucket = days <= 0 ? "current" : days <= 30 ? "1-30" : days <= 60 ? "31-60" : "60+";
    aging[bucket].count++; aging[bucket].amount += amount;
  }
  return { totalCount, currencyCode: rows[0]?.currencyCode ?? null,
    outstanding: safeMinor(outstanding), outstandingMinor: outstanding.toString(), outstandingCount: rows.length,
    overdue: safeMinor(overdue), overdueMinor: overdue.toString(), overdueCount,
    aging: Object.fromEntries(Object.entries(aging).map(([key, bucket]) => [key,
      { count: bucket.count, amount: safeMinor(bucket.amount), amountMinor: bucket.amount.toString() }])) };
}
