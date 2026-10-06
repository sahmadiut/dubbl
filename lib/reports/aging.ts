import { db } from "@/lib/db";
import { invoice, bill, contact, organization, payment, paymentAllocation } from "@/lib/db/schema";
import { eq, and, isNull, ne, inArray, lte, asc } from "drizzle-orm";
import { AuthError, type AuthContext } from "@/lib/api/auth-context";
import { requireRole } from "@/lib/api/require-role";
import { WireCompatibilityError } from "@/lib/money/wire";
import { reportStoredMinor } from "./statement-wire";
import { agingSchema, agingMoney, agingDays, agingBucket, agingCurrency, agingDate } from "./aging-wire";
import type { Statement } from "./statement-export";

type AgingKind = "receivables" | "payables";
type AgingItem = { id: string; invoiceNumber?: string; billNumber?: string; contactName: string;
  dueDate: string; amountDue: number; amountDueMinor: string; currencyCode: string; daysOverdue: number };

/** Direct-Drizzle REST/MCP read service. Amounts are document cents, never base-converted. */
export async function getAgingReport(ctx: AuthContext, kind: AgingKind, input: unknown) {
  requireRole(ctx, "view:data");
  const params = agingSchema.parse(input);
  const historical = params.asAt !== undefined;
  const asAt = params.asAt ?? new Date().toISOString().slice(0, 10);
  return db.transaction(async tx => {
    const org = await tx.query.organization.findFirst({ where: eq(organization.id, ctx.organizationId), columns: { defaultCurrency: true } });
    if (!org) throw new AuthError("Organization not found", 404);
    // Select only amounts actually consumed here: unrelated fields may have separate contracts.
    const documents = kind === "receivables"
      ? await tx.select({ id: invoice.id, number: invoice.invoiceNumber, contactId: invoice.contactId,
        contactName: contact.name, issueDate: invoice.issueDate, dueDate: invoice.dueDate,
        total: invoice.total, amountDue: invoice.amountDue, currencyCode: invoice.currencyCode })
        .from(invoice).leftJoin(contact, and(eq(contact.id, invoice.contactId), eq(contact.organizationId, ctx.organizationId), isNull(contact.deletedAt)))
        .where(and(eq(invoice.organizationId, ctx.organizationId), isNull(invoice.deletedAt), ne(invoice.status, "void"), ne(invoice.status, "draft"),
          historical ? lte(invoice.issueDate, asAt) : ne(invoice.status, "paid"), params.currencyCode ? eq(invoice.currencyCode, params.currencyCode) : undefined))
        .orderBy(asc(invoice.issueDate), asc(invoice.id))
      : await tx.select({ id: bill.id, number: bill.billNumber, contactId: bill.contactId,
        contactName: contact.name, issueDate: bill.issueDate, dueDate: bill.dueDate,
        total: bill.total, amountDue: bill.amountDue, currencyCode: bill.currencyCode })
        .from(bill).leftJoin(contact, and(eq(contact.id, bill.contactId), eq(contact.organizationId, ctx.organizationId), isNull(contact.deletedAt)))
        .where(and(eq(bill.organizationId, ctx.organizationId), isNull(bill.deletedAt), ne(bill.status, "void"), ne(bill.status, "draft"),
          historical ? lte(bill.issueDate, asAt) : ne(bill.status, "paid"), params.currencyCode ? eq(bill.currencyCode, params.currencyCode) : undefined))
        .orderBy(asc(bill.issueDate), asc(bill.id));
    const byId = new Map(documents.map(document => [document.id, document]));
    const allocated = new Map<string, bigint>();
    if (historical && documents.length) {
      const allocations = await tx.select({ documentId: paymentAllocation.documentId, amount: paymentAllocation.amount,
        contactId: payment.contactId, currencyCode: payment.currencyCode, type: payment.type, date: payment.date })
        .from(paymentAllocation).innerJoin(payment, eq(paymentAllocation.paymentId, payment.id))
        .where(and(eq(paymentAllocation.documentType, kind === "receivables" ? "invoice" : "bill"),
          inArray(paymentAllocation.documentId, documents.map(document => document.id)),
          eq(payment.organizationId, ctx.organizationId), isNull(payment.deletedAt), lte(payment.date, asAt)));
      for (const allocation of allocations) {
        const document = byId.get(allocation.documentId)!;
        const amount = reportStoredMinor(allocation.amount);
        agingDate(allocation.date);
        if (amount <= 0n || allocation.contactId !== document.contactId || allocation.currencyCode !== document.currencyCode ||
          allocation.type !== (kind === "receivables" ? "received" : "made")) {
          throw new WireCompatibilityError("Inconsistent saved aging allocation");
        }
        allocated.set(document.id, (allocated.get(document.id) ?? 0n) + amount);
      }
    }
    const buckets = ["Current", "1-30 days", "31-60 days", "61-90 days", "90+ days"]
      .map(label => ({ label, total: 0n, items: [] as AgingItem[] }));
    const currencies = new Set<string>();
    for (const document of documents) {
      agingDate(document.issueDate);
      const days = agingDays(asAt, document.dueDate);
      const currency = agingCurrency(document.currencyCode);
      const amount = historical ? reportStoredMinor(document.total) - (allocated.get(document.id) ?? 0n) : reportStoredMinor(document.amountDue);
      if (historical && amount <= 0n) continue;
      currencies.add(currency);
      const bucket = buckets[agingBucket(days)];
      bucket.items.push({ id: document.id, ...(kind === "receivables" ? { invoiceNumber: document.number } : { billNumber: document.number }),
        contactName: document.contactName || "Unknown", dueDate: document.dueDate, currencyCode: currency,
        ...agingMoney("amountDue", amount), daysOverdue: Math.max(0, days) });
      bucket.total += amount;
    }
    if (currencies.size > 1) throw new WireCompatibilityError("Mixed aging currencies require a currencyCode filter");
    const currency = params.currencyCode ?? [...currencies][0] ?? agingCurrency(org.defaultCurrency ?? "USD");
    const grandTotal = buckets.reduce((sum, bucket) => sum + bucket.total, 0n);
    const data = { asAt, currencyCode: currency,
      buckets: buckets.map(bucket => ({ label: bucket.label, ...agingMoney("total", bucket.total), count: bucket.items.length,
        ...(kind === "receivables" ? { invoices: bucket.items } : { bills: bucket.items }) })), ...agingMoney("grandTotal", grandTotal) };
    const statement: Statement = { title: kind === "receivables" ? "Aged Receivables" : "Aged Payables",
      periodLabel: `As at ${asAt}`, currency,
      sections: buckets.map((bucket, index) => ({ label: bucket.label, subtotal: data.buckets[index].total,
        rows: bucket.items.map(item => ({ code: item.invoiceNumber ?? item.billNumber!, name: item.contactName, amount: item.amountDue, depth: 1 })) })),
      grandTotal: data.grandTotal };
    return { data, statement };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
