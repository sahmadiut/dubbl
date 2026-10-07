import { db } from "@/lib/db";
import { contact, invoice, bill, creditNote, debitNote, payment, paymentAllocation, organization } from "@/lib/db/schema";
import { eq, and, lte, notInArray, inArray, isNull } from "drizzle-orm";
import { AuthError, type AuthContext } from "./auth-context";
import { requireRole } from "./require-role";
import { statementPeriod, contactIdSchema } from "./contact-statement-wire";
import { agingMoney, agingCurrency, agingDate } from "@/lib/reports/aging-wire";
import { reportStoredMinor } from "@/lib/reports/statement-wire";
import { WireCompatibilityError } from "@/lib/money/wire";

type Entry = { id: string; date: string; type: "invoice" | "bill" | "credit_note" | "debit_note" | "payment";
  documentNumber: string; description: string; debit: bigint; credit: bigint; currencyCode: string };

/** Read-only document-currency statement, shared by JSON, print, email and MCP. */
export async function getContactStatement(ctx: AuthContext, contactId: string, input: unknown, supplier = false) {
  requireRole(ctx, "view:data");
  contactIdSchema.parse(contactId);
  const { startDate, endDate, currencyCode: filter } = statementPeriod(input);
  return db.transaction(async tx => {
    const c = await tx.query.contact.findFirst({ where: and(eq(contact.id, contactId), eq(contact.organizationId, ctx.organizationId), isNull(contact.deletedAt)),
      columns: { id: true, name: true, email: true, type: true, currencyCode: true } });
    if (!c) throw new AuthError("Contact not found", 404);
    if (supplier && c.type === "customer") throw new AuthError("Contact is not a supplier", 400);
    const org = await tx.query.organization.findFirst({ where: eq(organization.id, ctx.organizationId), columns: { name: true, defaultCurrency: true } });
    if (!org) throw new AuthError("Organization not found", 404);
    const entries: Entry[] = [];
    // Totals, rather than today's amountDue, prevent historical payments being deducted twice.
    const sources = [
      { table: invoice, number: invoice.invoiceNumber, type: "invoice" as const, enabled: !supplier && c.type !== "supplier", debit: true, label: "Invoice" },
      { table: creditNote, number: creditNote.creditNoteNumber, type: "credit_note" as const, enabled: !supplier && c.type !== "supplier", debit: false, label: "Credit Note" },
      { table: bill, number: bill.billNumber, type: "bill" as const, enabled: c.type !== "customer", debit: false, label: "Bill" },
      { table: debitNote, number: debitNote.debitNoteNumber, type: "debit_note" as const, enabled: c.type !== "customer", debit: true, label: "Debit Note" },
    ];
    for (const source of sources) {
      if (!source.enabled) continue;
      const t = source.table;
      const rows = await tx.select({ id: t.id, date: t.issueDate, number: source.number, reference: t.reference, total: t.total, currencyCode: t.currencyCode }).from(t)
        .where(and(eq(t.organizationId, ctx.organizationId), eq(t.contactId, contactId), isNull(t.deletedAt), notInArray(t.status, ["draft", "void"]),
          lte(t.issueDate, endDate), filter ? eq(t.currencyCode, filter) : undefined));
      for (const r of rows) {
        const amount = reportStoredMinor(r.total);
        entries.push({ id: r.id, date: agingDate(r.date), type: source.type, documentNumber: r.number,
          description: r.reference || `${source.label} ${r.number}`, debit: source.debit ? amount : 0n, credit: source.debit ? 0n : amount,
          currencyCode: agingCurrency(r.currencyCode) });
      }
    }
    const carriers = await tx.selectDistinct({ id: paymentAllocation.paymentId }).from(paymentAllocation)
      .innerJoin(payment, eq(payment.id, paymentAllocation.paymentId)).where(and(eq(payment.organizationId, ctx.organizationId),
        eq(payment.contactId, contactId), inArray(paymentAllocation.documentType, ["credit_note", "debit_note"])));
    const rows = await tx.select({ id: payment.id, date: payment.date, number: payment.paymentNumber, reference: payment.reference,
      amount: payment.amount, type: payment.type, currencyCode: payment.currencyCode }).from(payment)
      .where(and(eq(payment.organizationId, ctx.organizationId), eq(payment.contactId, contactId), isNull(payment.deletedAt), lte(payment.date, endDate),
        supplier || c.type === "supplier" ? eq(payment.type, "made") : c.type === "customer" ? eq(payment.type, "received") : undefined,
        carriers.length ? notInArray(payment.id, carriers.map(r => r.id)) : undefined, filter ? eq(payment.currencyCode, filter) : undefined));
    for (const r of rows) {
      const amount = reportStoredMinor(r.amount);
      entries.push({ id: r.id, date: agingDate(r.date), type: "payment", documentNumber: r.number, description: r.reference || `Payment ${r.number}`,
        debit: r.type === "made" ? amount : 0n, credit: r.type === "received" ? amount : 0n, currencyCode: agingCurrency(r.currencyCode) });
    }
    const currencies = new Set(entries.map(r => r.currencyCode));
    if (currencies.size > 1) throw new WireCompatibilityError("Mixed statement currencies require a currencyCode filter");
    const currencyCode = filter ?? [...currencies][0] ?? agingCurrency(c.currencyCode ?? org.defaultCurrency ?? "USD");
    const priority = { invoice: 0, bill: 0, credit_note: 1, debit_note: 1, payment: 2 };
    entries.sort((a, b) => a.date.localeCompare(b.date) || priority[a.type] - priority[b.type] || a.id.localeCompare(b.id));
    const movement = (r: Entry) => supplier ? r.credit - r.debit : r.debit - r.credit;
    const opening = entries.filter(r => r.date < startDate).reduce((sum, r) => sum + movement(r), 0n);
    let running = opening, debited = 0n, credited = 0n;
    const transactions = entries.filter(r => r.date >= startDate).map(r => {
      running += movement(r); debited += r.debit; credited += r.credit;
      return { date: r.date, type: r.type, documentNumber: r.documentNumber, description: r.description, currencyCode,
        ...agingMoney("debit", r.debit), ...agingMoney("credit", r.credit), ...agingMoney("balance", running) };
    });
    return { organizationName: org.name, data: { contact: { id: c.id, name: c.name, email: c.email, type: c.type },
      startDate, endDate, currencyCode, ...agingMoney("openingBalance", opening), transactions,
      ...agingMoney("totalDebit", debited), ...agingMoney("totalCredit", credited),
      ...(supplier ? { ...agingMoney("totalBilled", credited), ...agingMoney("totalPaidOrCredited", debited) } : {}),
      ...agingMoney("closingBalance", running) } };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
