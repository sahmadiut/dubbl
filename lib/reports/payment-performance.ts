import { and, asc, eq, gte, isNotNull, isNull, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { bill, contact, invoice, organization } from "@/lib/db/schema";
import { AuthError, type AuthContext } from "@/lib/api/auth-context";
import { requireRole } from "@/lib/api/require-role";
import { WireCompatibilityError } from "@/lib/money/wire";
import { reportDateSchema, reportMinor } from "./statement-wire";
import { analyticsCurrency, analyticsMoney, analyticsRound, analyticsStoredMinor, documentAnalyticsDates } from "./document-analytics-wire";

type TimingRow = {
  contactId: string; contactName: string | null; currency: string; total: string;
  issueDate: string; dueDate: string; paidDate: string;
  days: string; termDays: string;
};

function timingGroups(rows: TimingRow[]) {
  const groups = new Map<string, { contactId: string; contactName: string; total: bigint;
    days: bigint; termDays: bigint; count: bigint; lateCount: bigint }>();
  for (const row of rows) {
    for (const date of [row.issueDate, row.dueDate, row.paidDate]) {
      if (!reportDateSchema.safeParse(date).success) throw new WireCompatibilityError("Unsupported saved payment timing date");
    }
    const group = groups.get(row.contactId) ?? { contactId: row.contactId, contactName: row.contactName ?? "Unknown",
      total: 0n, days: 0n, termDays: 0n, count: 0n, lateCount: 0n };
    group.total += analyticsStoredMinor(row.total);
    group.days += BigInt(row.days); group.termDays += BigInt(row.termDays); group.count++;
    if (row.paidDate > row.dueDate) group.lateCount++;
    groups.set(row.contactId, group);
  }
  // Compare unrounded rational averages; ties have deterministic contact ordering.
  return [...groups.values()].sort((a, b) => {
    const difference = a.days * b.count - b.days * a.count;
    return difference === 0n ? a.contactId.localeCompare(b.contactId) : difference > 0n ? -1 : 1;
  });
}

function timingFields(group: ReturnType<typeof timingGroups>[number]) {
  return { contactId: group.contactId, contactName: group.contactName,
    avgDays: reportMinor(analyticsRound(group.days, group.count)),
    avgTermDays: reportMinor(analyticsRound(group.termDays, group.count)),
    lateCount: reportMinor(group.lateCount),
    onTimeRate: reportMinor(analyticsRound((group.count - group.lateCount) * 100n, group.count)) };
}

function weightedDays(groups: ReturnType<typeof timingGroups>) {
  const count = groups.reduce((sum, group) => sum + group.count, 0n);
  // Preserve the existing summary: weight each rounded contact mean by document count.
  return count === 0n ? 0 : reportMinor(analyticsRound(groups.reduce((sum, group) =>
    sum + analyticsRound(group.days, group.count) * group.count, 0n), count));
}

/** One exact, org-scoped read-only snapshot for REST and registered MCP clients. */
export async function getPaymentPerformance(ctx: AuthContext, input: unknown) {
  requireRole(ctx, "view:data");
  const { startDate, endDate, currencyCode: filter } = documentAnalyticsDates(input);
  return db.transaction(async tx => {
    const org = await tx.query.organization.findFirst({ where: eq(organization.id, ctx.organizationId), columns: { defaultCurrency: true } });
    if (!org) throw new AuthError("Organization not found", 404);
    const invoiceRows = await tx.select({ contactId: invoice.contactId, contactName: contact.name,
      currency: invoice.currencyCode, total: sql<string>`${invoice.total}::text`,
      issueDate: invoice.issueDate, dueDate: invoice.dueDate, paidDate: sql<string>`${invoice.paidAt}::date::text`,
      days: sql<string>`(CASE WHEN ${invoice.paidAt}::date BETWEEN '0001-01-01'::date AND '9999-12-31'::date
        THEN ${invoice.paidAt}::date - ${invoice.issueDate} ELSE 0 END)::text`,
      termDays: sql<string>`(CASE WHEN ${invoice.dueDate} BETWEEN '0001-01-01'::date AND '9999-12-31'::date
        THEN ${invoice.dueDate} - ${invoice.issueDate} ELSE 0 END)::text` })
      .from(invoice).leftJoin(contact, and(eq(contact.id, invoice.contactId), eq(contact.organizationId, ctx.organizationId), isNull(contact.deletedAt)))
      .where(and(eq(invoice.organizationId, ctx.organizationId), eq(invoice.status, "paid"), isNotNull(invoice.paidAt),
        isNull(invoice.deletedAt), gte(invoice.issueDate, startDate), lte(invoice.issueDate, endDate), filter ? eq(invoice.currencyCode, filter) : undefined))
      .orderBy(asc(invoice.id));
    const billRows = await tx.select({ contactId: bill.contactId, contactName: contact.name,
      currency: bill.currencyCode, total: sql<string>`${bill.total}::text`,
      issueDate: bill.issueDate, dueDate: bill.dueDate, paidDate: sql<string>`${bill.paidAt}::date::text`,
      days: sql<string>`(CASE WHEN ${bill.paidAt}::date BETWEEN '0001-01-01'::date AND '9999-12-31'::date
        THEN ${bill.paidAt}::date - ${bill.issueDate} ELSE 0 END)::text`,
      termDays: sql<string>`(CASE WHEN ${bill.dueDate} BETWEEN '0001-01-01'::date AND '9999-12-31'::date
        THEN ${bill.dueDate} - ${bill.issueDate} ELSE 0 END)::text` })
      .from(bill).leftJoin(contact, and(eq(contact.id, bill.contactId), eq(contact.organizationId, ctx.organizationId), isNull(contact.deletedAt)))
      .where(and(eq(bill.organizationId, ctx.organizationId), eq(bill.status, "paid"), isNotNull(bill.paidAt),
        isNull(bill.deletedAt), gte(bill.issueDate, startDate), lte(bill.issueDate, endDate), filter ? eq(bill.currencyCode, filter) : undefined))
      .orderBy(asc(bill.id));
    const currencies = new Set([...invoiceRows, ...billRows].map(row => analyticsCurrency(row.currency)));
    if (currencies.size > 1) throw new WireCompatibilityError("Mixed payment-performance currencies require a currencyCode filter");
    const currencyCode = filter ?? [...currencies][0] ?? analyticsCurrency(org.defaultCurrency ?? "USD");
    const receivableGroups = timingGroups(invoiceRows), payableGroups = timingGroups(billRows);
    const receivables = receivableGroups.map(group => ({ ...timingFields(group), invoiceCount: reportMinor(group.count),
      ...analyticsMoney("totalCollected", group.total) }));
    const payables = payableGroups.map(group => ({ ...timingFields(group), billCount: reportMinor(group.count),
      ...analyticsMoney("totalPaid", group.total) }));
    return { startDate, endDate, currencyCode, avgDaysToCollect: weightedDays(receivableGroups),
      avgDaysToPay: weightedDays(payableGroups), receivables, payables };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
