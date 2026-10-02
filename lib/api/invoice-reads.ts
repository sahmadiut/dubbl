import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { invoice, organization, paymentAllocation } from "@/lib/db/schema";
import { notDeleted } from "@/lib/db/soft-delete";
import { getRateStatus } from "@/lib/currency/rate-status";
import { WireCompatibilityError } from "@/lib/money/wire";
import type { AuthContext } from "./auth-context";
import { invoiceBaseDto, invoiceListSchema, invoiceReadDto, invoiceSummaryDto } from "./invoice-read-wire";
import { publicMoneyDto } from "./public-money-wire";

const sortColumns = { date: invoice.issueDate, due: invoice.dueDate, total: invoice.total,
  amountDue: invoice.amountDue, number: invoice.invoiceNumber, created: invoice.createdAt };

export async function listInvoices(ctx: AuthContext, input: unknown) {
  const parsed = invoiceListSchema.parse(input);
  const conditions = [eq(invoice.organizationId, ctx.organizationId), notDeleted(invoice.deletedAt)];
  if (parsed.status) conditions.push(eq(invoice.status, parsed.status));
  if (parsed.contactId) conditions.push(eq(invoice.contactId, parsed.contactId));
  if (parsed.startDate) conditions.push(gte(invoice.issueDate, parsed.startDate));
  if (parsed.endDate) conditions.push(lte(invoice.issueDate, parsed.endDate));
  const result = await db.query.invoice.findMany({ where: and(...conditions),
    orderBy: (parsed.sortOrder === "asc" ? asc : desc)(sortColumns[parsed.sortBy]),
    limit: parsed.limit, offset: (parsed.page - 1) * parsed.limit, with: { contact: true } });
  const [count] = await db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(invoice).where(and(...conditions));
  return { invoices: result.map(row => invoiceReadDto(row, ctx.organizationId)), total: count.count,
    page: parsed.page, limit: parsed.limit };
}

/** MCP retains its {invoice} envelope; REST additionally requests payments and base display. */
export async function getInvoice(ctx: AuthContext, id: string, rest = false) {
  z.string().uuid().parse(id);
  const found = await db.query.invoice.findFirst({ where: and(eq(invoice.id, id),
    eq(invoice.organizationId, ctx.organizationId), notDeleted(invoice.deletedAt)),
    with: { contact: true, lines: { with: { account: true, taxRate: true } } } });
  if (!found) return null;
  const dto = invoiceReadDto(found, ctx.organizationId);
  if (!rest) return { invoice: dto };

  const allocations = await db.query.paymentAllocation.findMany({ where: and(
    eq(paymentAllocation.documentType, "invoice"), eq(paymentAllocation.documentId, id)), with: { payment: true } });
  const payments = allocations.map(allocation => {
    if (!allocation.payment || allocation.payment.organizationId !== ctx.organizationId) {
      throw new WireCompatibilityError("Invoice payment belongs outside this organization");
    }
    // Allocation amounts are in the document currency; payment currency may differ at settlement.
    return publicMoneyDto({ id: allocation.payment.id, paymentNumber: allocation.payment.paymentNumber,
      date: allocation.payment.date, amount: allocation.amount, method: allocation.payment.method }, ["amount"]);
  });
  const org = await db.query.organization.findFirst({ where: eq(organization.id, ctx.organizationId),
    columns: { defaultCurrency: true } });
  const baseCurrency = org?.defaultCurrency ?? "USD";
  const status = await getRateStatus(ctx.organizationId, found.currencyCode, baseCurrency, found.issueDate);
  const base = invoiceBaseDto(found.currencyCode, baseCurrency, { subtotal: found.subtotal, taxTotal: found.taxTotal,
    total: found.total, amountDue: found.amountDue, amountPaid: found.amountPaid }, status);
  return { invoice: dto, payments, base };
}

export async function getInvoiceSummary(ctx: AuthContext) {
  return db.transaction(async tx => {
    const scope = and(eq(invoice.organizationId, ctx.organizationId), notDeleted(invoice.deletedAt));
    const [count] = await tx.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(invoice).where(scope);
    const rows = await tx.select({ status: invoice.status, dueDate: invoice.dueDate,
      amountDue: sql<string>`${invoice.amountDue}::text`, currencyCode: invoice.currencyCode })
      .from(invoice).where(and(scope, inArray(invoice.status, ["sent", "partial", "overdue"])));
    return invoiceSummaryDto(rows, count.count);
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
