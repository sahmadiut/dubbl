import { db } from "@/lib/db";
import { contact, invoice, quote, creditNote } from "@/lib/db/schema";
import { payment } from "@/lib/db/schema";
import { bill } from "@/lib/db/schema";
import { eq, and, gte, lte, lt, isNull } from "drizzle-orm";
import { AuthError, type AuthContext } from "@/lib/api/auth-context";
import { notDeleted } from "@/lib/db/soft-delete";

import { requireRole } from "./require-role";
import { activitySchema, contactIdSchema } from "./contact-statement-wire";
import { agingMoney, agingCurrency, agingDate } from "@/lib/reports/aging-wire";
import { reportStoredMinor } from "@/lib/reports/statement-wire";
type ActivityItem = {
  id: string;
  type: "invoice" | "quote" | "credit_note" | "payment" | "bill";
  number: string;
  status: string;
  amount: number;
  currencyCode: string;
  date: string;
  createdAt: string;
};


export async function getContactActivity(ctx: AuthContext, id: string, input: unknown) {
  requireRole(ctx, "view:data");
  contactIdSchema.parse(id);
  const params = activitySchema.parse(input);
  const limit = params.limit ?? 30;
  const { cursor, startDate, endDate } = params;
  const types = params.type?.split(",") ?? ["invoice", "quote", "credit_note", "payment", "bill"];
  return db.transaction(async tx => {
    const owned = await tx.query.contact.findFirst({ where: and(eq(contact.id, id), eq(contact.organizationId, ctx.organizationId), isNull(contact.deletedAt)), columns: { id: true } });
    if (!owned) throw new AuthError("Contact not found", 404);
    // Fetch limit+1 from each type (for cursor detection), then merge and slice
    const fetchLimit = limit + 1;
    const cursorDate = cursor ? new Date(cursor) : null;

    const results = await Promise.all([
      types.includes("invoice")
        ? tx.query.invoice.findMany({
            where: and(
              eq(invoice.contactId, id),
              eq(invoice.organizationId, ctx.organizationId),
              notDeleted(invoice.deletedAt),
              ...(startDate ? [gte(invoice.issueDate, startDate)] : []),
              ...(endDate ? [lte(invoice.issueDate, endDate)] : []),
              ...(cursorDate ? [lt(invoice.createdAt, cursorDate)] : []),
            ),
            orderBy: (t, { desc }) => [desc(t.createdAt)],
            limit: fetchLimit,
            columns: { id: true, invoiceNumber: true, status: true, total: true, currencyCode: true, issueDate: true, createdAt: true },
          }).then((rows) => rows.map((r): ActivityItem => ({
            id: r.id, type: "invoice", number: r.invoiceNumber, status: r.status,
            amount: r.total, currencyCode: r.currencyCode, date: agingDate(r.issueDate),
            createdAt: r.createdAt.toISOString(),
          })))
        : [],

      types.includes("quote")
        ? tx.query.quote.findMany({
            where: and(
              eq(quote.contactId, id),
              eq(quote.organizationId, ctx.organizationId),
              notDeleted(quote.deletedAt),
              ...(startDate ? [gte(quote.issueDate, startDate)] : []),
              ...(endDate ? [lte(quote.issueDate, endDate)] : []),
              ...(cursorDate ? [lt(quote.createdAt, cursorDate)] : []),
            ),
            orderBy: (t, { desc }) => [desc(t.createdAt)],
            limit: fetchLimit,
            columns: { id: true, quoteNumber: true, status: true, total: true, currencyCode: true, issueDate: true, createdAt: true },
          }).then((rows) => rows.map((r): ActivityItem => ({
            id: r.id, type: "quote", number: r.quoteNumber, status: r.status,
            amount: r.total, currencyCode: r.currencyCode, date: agingDate(r.issueDate),
            createdAt: r.createdAt.toISOString(),
          })))
        : [],

      types.includes("credit_note")
        ? tx.query.creditNote.findMany({
            where: and(
              eq(creditNote.contactId, id),
              eq(creditNote.organizationId, ctx.organizationId),
              notDeleted(creditNote.deletedAt),
              ...(startDate ? [gte(creditNote.issueDate, startDate)] : []),
              ...(endDate ? [lte(creditNote.issueDate, endDate)] : []),
              ...(cursorDate ? [lt(creditNote.createdAt, cursorDate)] : []),
            ),
            orderBy: (t, { desc }) => [desc(t.createdAt)],
            limit: fetchLimit,
            columns: { id: true, creditNoteNumber: true, status: true, total: true, currencyCode: true, issueDate: true, createdAt: true },
          }).then((rows) => rows.map((r): ActivityItem => ({
            id: r.id, type: "credit_note", number: r.creditNoteNumber, status: r.status,
            amount: r.total, currencyCode: r.currencyCode, date: agingDate(r.issueDate),
            createdAt: r.createdAt.toISOString(),
          })))
        : [],

      types.includes("payment")
        ? tx.query.payment.findMany({
            where: and(
              eq(payment.contactId, id),
              eq(payment.organizationId, ctx.organizationId),
              notDeleted(payment.deletedAt),
              ...(startDate ? [gte(payment.date, startDate)] : []),
              ...(endDate ? [lte(payment.date, endDate)] : []),
              ...(cursorDate ? [lt(payment.createdAt, cursorDate)] : []),
            ),
            orderBy: (t, { desc }) => [desc(t.createdAt)],
            limit: fetchLimit,
            columns: { id: true, paymentNumber: true, type: true, amount: true, currencyCode: true, date: true, createdAt: true },
          }).then((rows) => rows.map((r): ActivityItem => ({
            id: r.id, type: "payment", number: r.paymentNumber, status: r.type,
            amount: r.amount, currencyCode: r.currencyCode, date: agingDate(r.date),
            createdAt: r.createdAt.toISOString(),
          })))
        : [],

      types.includes("bill")
        ? tx.query.bill.findMany({
            where: and(
              eq(bill.contactId, id),
              eq(bill.organizationId, ctx.organizationId),
              notDeleted(bill.deletedAt),
              ...(startDate ? [gte(bill.issueDate, startDate)] : []),
              ...(endDate ? [lte(bill.issueDate, endDate)] : []),
              ...(cursorDate ? [lt(bill.createdAt, cursorDate)] : []),
            ),
            orderBy: (t, { desc }) => [desc(t.createdAt)],
            limit: fetchLimit,
            columns: { id: true, billNumber: true, status: true, total: true, currencyCode: true, issueDate: true, createdAt: true },
          }).then((rows) => rows.map((r): ActivityItem => ({
            id: r.id, type: "bill", number: r.billNumber, status: r.status,
            amount: r.total, currencyCode: r.currencyCode, date: agingDate(r.issueDate),
            createdAt: r.createdAt.toISOString(),
          })))
        : [],
    ]);

    // Merge all, sort by createdAt desc, take limit+1
    const merged = results.flat().sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const hasMore = merged.length > limit;
    const items = merged.slice(0, limit).map(item => ({ ...item, currencyCode: agingCurrency(item.currencyCode), ...agingMoney("amount", reportStoredMinor(item.amount)) }));
    const nextCursor = hasMore && items.length > 0
      ? items[items.length - 1].createdAt
      : null;


    return { activity: items, nextCursor, hasMore };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
