import { db } from "@/lib/db";
import { bill, invoice, invoiceLine, contact, inventoryItem, organization } from "@/lib/db/schema";
import { and, eq, gte, lte, isNull, notInArray, sql, asc } from "drizzle-orm";
import { AuthError, type AuthContext } from "@/lib/api/auth-context";
import { requireRole } from "@/lib/api/require-role";
import { WireCompatibilityError } from "@/lib/money/wire";
import { reportDateSchema, reportMinor } from "./statement-wire";
import { analyticsCurrency, analyticsMoney, analyticsPercentage, analyticsRound, analyticsStoredMinor, documentAnalyticsDates } from "./document-analytics-wire";
import type { Statement } from "./statement-export";

export type DocumentAnalyticsKind = "vendor-spend" | "sales-by-customer" | "sales-by-item";

function selectedCurrency(values: string[], filter: string | undefined, fallback: string) {
  const currencies = new Set(values.map(analyticsCurrency));
  if (currencies.size > 1) throw new WireCompatibilityError("Mixed analytics currencies require a currencyCode filter");
  return filter ?? [...currencies][0] ?? analyticsCurrency(fallback);
}

function savedDate(value: string) {
  if (!reportDateSchema.safeParse(value).success) throw new WireCompatibilityError("Unsupported saved analytics date");
}

/** Read-only snapshot shared by actual REST and MCP; every consumed stored amount is checked. */
export async function getDocumentAnalytics(ctx: AuthContext, kind: DocumentAnalyticsKind, input: unknown) {
  requireRole(ctx, "view:data");
  const { startDate, endDate, currencyCode: filter } = documentAnalyticsDates(input);
  return db.transaction(async tx => {
    const org = await tx.query.organization.findFirst({ where: eq(organization.id, ctx.organizationId), columns: { defaultCurrency: true } });
    if (!org) throw new AuthError("Organization not found", 404);
    if (kind === "vendor-spend") {
      const rows = await tx.select({ contactId: bill.contactId, contactName: contact.name, date: bill.issueDate,
        total: sql<string>`${bill.total}::text`, currency: bill.currencyCode })
        .from(bill).leftJoin(contact, and(eq(contact.id, bill.contactId), eq(contact.organizationId, ctx.organizationId), isNull(contact.deletedAt)))
        .where(and(eq(bill.organizationId, ctx.organizationId), isNull(bill.deletedAt), notInArray(bill.status, ["draft", "void"]),
          gte(bill.issueDate, startDate), lte(bill.issueDate, endDate), filter ? eq(bill.currencyCode, filter) : undefined))
        .orderBy(asc(bill.id));
      const currencyCode = selectedCurrency(rows.map(row => row.currency), filter, org.defaultCurrency ?? "USD");
      const groups = new Map<string, { contactId: string; contactName: string; total: bigint; count: bigint; lastBillDate: string; months: Map<string, bigint> }>();
      for (const row of rows) {
        savedDate(row.date);
        const amount = analyticsStoredMinor(row.total);
        const group = groups.get(row.contactId) ?? { contactId: row.contactId, contactName: row.contactName ?? "Unknown", total: 0n,
          count: 0n, lastBillDate: row.date, months: new Map<string, bigint>() };
        group.total += amount; group.count++;
        if (row.date > group.lastBillDate) group.lastBillDate = row.date;
        const month = row.date.slice(0, 7); group.months.set(month, (group.months.get(month) ?? 0n) + amount);
        groups.set(row.contactId, group);
      }
      const sorted = [...groups.values()].sort((a, b) => a.total === b.total ? a.contactId.localeCompare(b.contactId) : a.total > b.total ? -1 : 1);
      const totalSpend = sorted.reduce((sum, group) => sum + group.total, 0n);
      const vendors = sorted.map(group => ({ contactId: group.contactId, contactName: group.contactName,
        ...analyticsMoney("totalSpend", group.total), billCount: reportMinor(group.count),
        ...analyticsMoney("avgBillAmount", analyticsRound(group.total, group.count)), lastBillDate: group.lastBillDate,
        percentage: analyticsPercentage(group.total, totalSpend) }));
      const monthlyTrend = sorted.slice(0, 5).flatMap(group => [...group.months].map(([month, total]) => ({
        contactId: group.contactId, month, ...analyticsMoney("total", total) })))
        .sort((a, b) => a.month.localeCompare(b.month) || a.contactId.localeCompare(b.contactId));
      return { data: { startDate, endDate, currencyCode, ...analyticsMoney("totalSpend", totalSpend), vendorCount: vendors.length, vendors, monthlyTrend }, statement: null };
    }
    const rows = await tx.select({ invoiceId: invoice.id, contactId: invoice.contactId, contactName: contact.name,
      itemId: invoiceLine.inventoryItemId, itemName: inventoryItem.name, itemCode: inventoryItem.code,
      date: invoice.issueDate, currency: invoice.currencyCode, quantity: invoiceLine.quantity,
      net: sql<string>`${invoiceLine.amount}::text`, tax: sql<string>`${invoiceLine.taxAmount}::text` })
      .from(invoiceLine).innerJoin(invoice, eq(invoice.id, invoiceLine.invoiceId))
      .leftJoin(contact, and(eq(contact.id, invoice.contactId), eq(contact.organizationId, ctx.organizationId), isNull(contact.deletedAt)))
      .leftJoin(inventoryItem, and(eq(inventoryItem.id, invoiceLine.inventoryItemId), eq(inventoryItem.organizationId, ctx.organizationId), isNull(inventoryItem.deletedAt)))
      .where(and(eq(invoice.organizationId, ctx.organizationId), isNull(invoice.deletedAt), notInArray(invoice.status, ["draft", "void"]),
        gte(invoice.issueDate, startDate), lte(invoice.issueDate, endDate), filter ? eq(invoice.currencyCode, filter) : undefined))
      .orderBy(asc(invoiceLine.id));
    const currencyCode = selectedCurrency(rows.map(row => row.currency), filter, org.defaultCurrency ?? "USD");
    const byItem = kind === "sales-by-item";
    const groups = new Map<string | null, { id: string | null; name: string; code: string | null; net: bigint; tax: bigint;
      quantity: bigint; lineCount: bigint; invoices: Set<string> }>();
    for (const row of rows) {
      savedDate(row.date);
      if (!Number.isSafeInteger(row.quantity)) throw new WireCompatibilityError("Unsupported saved sales quantity");
      const id = byItem ? row.itemId : row.contactId;
      const group = groups.get(id) ?? { id, name: byItem ? (row.itemId ? row.itemName ?? "Unknown item" : "Uncategorized") : row.contactName ?? "Unknown",
        code: byItem ? row.itemCode : null, net: 0n, tax: 0n, quantity: 0n, lineCount: 0n, invoices: new Set<string>() };
      group.net += analyticsStoredMinor(row.net); group.tax += analyticsStoredMinor(row.tax);
      group.quantity += BigInt(row.quantity); group.lineCount++; group.invoices.add(row.invoiceId);
      groups.set(id, group);
    }
    const sorted = [...groups.values()].sort((a, b) => a.net === b.net ? (a.id ?? "").localeCompare(b.id ?? "") : a.net > b.net ? -1 : 1);
    const entries = sorted.map(group => ({
      ...(byItem ? { itemId: group.id, itemCode: group.code, itemName: group.name, quantity: reportMinor(group.quantity), lineCount: reportMinor(group.lineCount) }
        : { contactId: group.id, contactName: group.name, invoiceCount: group.invoices.size }),
      ...analyticsMoney("net", group.net), ...analyticsMoney("tax", group.tax), ...analyticsMoney("gross", group.net + group.tax) }));
    const net = sorted.reduce((sum, group) => sum + group.net, 0n), tax = sorted.reduce((sum, group) => sum + group.tax, 0n);
    const totals = { ...analyticsMoney("net", net), ...analyticsMoney("tax", tax), ...analyticsMoney("gross", net + tax),
      ...(byItem ? { quantity: reportMinor(sorted.reduce((sum, group) => sum + group.quantity, 0n)),
        lineCount: reportMinor(sorted.reduce((sum, group) => sum + group.lineCount, 0n)) }
        : { invoiceCount: reportMinor(sorted.reduce((sum, group) => sum + BigInt(group.invoices.size), 0n)) }) };
    const statement: Statement = { title: byItem ? "Sales by Item" : "Sales by Customer", periodLabel: `${startDate} to ${endDate}`,
      currency: currencyCode, columns: ["Net", "Tax", "Gross"], sections: [{ label: byItem ? "Items" : "Customers",
        rows: sorted.map((group, i) => ({ code: group.code ?? undefined, name: group.name,
          amounts: [entries[i].net, entries[i].tax, entries[i].gross], depth: 1 })), subtotals: [totals.net, totals.tax, totals.gross] }],
      grandTotals: [totals.net, totals.tax, totals.gross] };
    return { data: { startDate, endDate, currencyCode, ...(byItem ? { items: entries } : { customers: entries }), totals }, statement };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
