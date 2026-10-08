import { and, asc, eq, gte, isNull, lte, ne, notInArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { bankAccount, bankTransaction, invoice, bill, contact, recurringTemplate, recurringTemplateLine, budget, budgetLine, budgetPeriod, organization } from "@/lib/db/schema";
import { AuthError, type AuthContext } from "@/lib/api/auth-context";
import { requireRole } from "@/lib/api/require-role";
import { advanceRecurringInvoiceDate } from "@/lib/api/recurring-invoice-wire";
import { WireCompatibilityError } from "@/lib/money/wire";
import { analyticsCurrency, analyticsMoney, analyticsRound, analyticsStoredMinor } from "./document-analytics-wire";
import { forecastSavedDate } from "./forecast-fx-wire";
import { reportMinor } from "./statement-wire";
import { recurringReportSchema, calendarReportParams, duplicateReportSchema, normalizeRecurringDescription, recurringFrequency } from "./operational-wire";

const snapshot = { isolationLevel: "repeatable read", accessMode: "read only" } as const;

export async function getRecurringReport(ctx: AuthContext, input: unknown = {}) {
  requireRole(ctx, "view:data");
  const params = recurringReportSchema.parse(input);
  return db.transaction(async tx => {
    if (params.bankAccountId) {
      const [owned] = await tx.select({ id: bankAccount.id }).from(bankAccount).where(and(eq(bankAccount.id, params.bankAccountId),
        eq(bankAccount.organizationId, ctx.organizationId), isNull(bankAccount.deletedAt)));
      if (!owned) throw new AuthError("Bank account not found", 404);
    }
    const rows = await tx.select({ id: bankTransaction.id, date: bankTransaction.date, description: bankTransaction.description,
      amount: sql<string>`${bankTransaction.amount}::text`, currency: bankAccount.currencyCode, transactionCurrency: bankTransaction.currencyCode })
      .from(bankTransaction).innerJoin(bankAccount, and(eq(bankAccount.id, bankTransaction.bankAccountId), eq(bankAccount.organizationId, ctx.organizationId), isNull(bankAccount.deletedAt)))
      .where(and(ne(bankTransaction.status, "excluded"), params.bankAccountId ? eq(bankTransaction.bankAccountId, params.bankAccountId) : undefined))
      .orderBy(asc(bankTransaction.date), asc(bankTransaction.id));
    type Movement = { id: string; date: string; amount: bigint };
    const groups = new Map<string, { description: string; normalizedKey: string; currencyCode: string; transactions: Movement[] }>();
    for (const row of rows) {
      const currencyCode = analyticsCurrency(row.currency);
      if (row.transactionCurrency !== null && row.transactionCurrency !== currencyCode)
        throw new WireCompatibilityError("Transaction currency differs from bank currency");
      const amount = analyticsStoredMinor(row.amount), date = forecastSavedDate(row.date), normalizedKey = normalizeRecurringDescription(row.description);
      if (!normalizedKey) continue;
      const key = JSON.stringify([normalizedKey, currencyCode]);
      let group = groups.get(key);
      if (!group) { group = { description: row.description, normalizedKey, currencyCode, transactions: [] }; groups.set(key, group); }
      group.transactions.push({ id: row.id, date, amount });
    }
    const patterns = [];
    for (const group of groups.values()) {
      const txns = group.transactions;
      if (txns.length < params.minOccurrences) continue;
      let sum = 0n, min = txns[0].amount, max = min;
      for (const txn of txns) { sum += txn.amount; if (txn.amount < min) min = txn.amount; if (txn.amount > max) max = txn.amount; }
      const avgAmount = analyticsRound(sum, BigInt(txns.length));
      const avgIntervalDays = Math.round((Date.parse(`${txns.at(-1)!.date}T00:00:00Z`) - Date.parse(`${txns[0].date}T00:00:00Z`)) / 86400000 / (txns.length - 1));
      patterns.push({ description: group.description, normalizedKey: group.normalizedKey, currencyCode: group.currencyCode, count: txns.length,
        ...analyticsMoney("avgAmount", avgAmount), ...analyticsMoney("minAmount", min), ...analyticsMoney("maxAmount", max),
        avgIntervalDays, frequency: recurringFrequency(avgIntervalDays),
        direction: txns.every(t => t.amount < 0n) ? "outflow" : txns.every(t => t.amount > 0n) ? "inflow" : "mixed",
        lastDate: txns.at(-1)!.date, transactions: txns.slice(-5).map(t => ({ id: t.id, date: t.date, ...analyticsMoney("amount", t.amount) })) });
    }
    patterns.sort((a, b) => b.count - a.count || a.normalizedKey.localeCompare(b.normalizedKey) || a.currencyCode.localeCompare(b.currencyCode));
    return { patterns: patterns.slice(0, 50) };
  }, snapshot);
}

type CalendarEvent = { date: string; type: "invoice_due" | "bill_due" | "recurring_generation" | "budget_period_start"; title: string;
  currencyCode: string; amount: number; amountMinor: string; id?: string; status?: string };

export async function getFinancialCalendar(ctx: AuthContext, input: unknown = {}) {
  requireRole(ctx, "view:data");
  const { startDate, endDate, currencyCode: filter } = calendarReportParams(input);
  return db.transaction(async tx => {
    const events: CalendarEvent[] = [];
    for (const table of [invoice, bill] as const) {
      const receivable = table === invoice;
      const rows = await tx.select({ id: table.id, date: table.dueDate, status: table.status, currency: table.currencyCode,
        amount: sql<string>`${table.amountDue}::text`, number: receivable ? invoice.invoiceNumber : bill.billNumber, name: contact.name })
        .from(table).leftJoin(contact, and(eq(contact.id, table.contactId), eq(contact.organizationId, ctx.organizationId), isNull(contact.deletedAt)))
        .where(and(eq(table.organizationId, ctx.organizationId), isNull(table.deletedAt), notInArray(table.status, ["draft", "void", "paid"]),
          gte(table.dueDate, startDate), lte(table.dueDate, endDate), filter ? eq(table.currencyCode, filter) : undefined)).orderBy(asc(table.id));
      for (const row of rows) events.push({ date: forecastSavedDate(row.date), type: receivable ? "invoice_due" : "bill_due",
        title: `${row.name ?? (receivable ? "Customer" : "Supplier")} - ${row.number}`, id: row.id, status: row.status,
        currencyCode: analyticsCurrency(row.currency), ...analyticsMoney("amount", analyticsStoredMinor(row.amount)) });
    }
    const templates = await tx.select({ id: recurringTemplate.id, name: recurringTemplate.name, next: recurringTemplate.nextRunDate,
      end: recurringTemplate.endDate, frequency: recurringTemplate.frequency, generated: recurringTemplate.occurrencesGenerated,
      max: recurringTemplate.maxOccurrences, currency: recurringTemplate.currencyCode, nameContact: contact.name })
      .from(recurringTemplate).leftJoin(contact, and(eq(contact.id, recurringTemplate.contactId), eq(contact.organizationId, ctx.organizationId), isNull(contact.deletedAt)))
      .where(and(eq(recurringTemplate.organizationId, ctx.organizationId), eq(recurringTemplate.status, "active"), isNull(recurringTemplate.deletedAt),
        lte(recurringTemplate.nextRunDate, endDate), filter ? eq(recurringTemplate.currencyCode, filter) : undefined)).orderBy(asc(recurringTemplate.id));
    for (const t of templates) {
      let next = forecastSavedDate(t.next), occurrence = t.generated;
      if (t.end) forecastSavedDate(t.end);
      if (!Number.isSafeInteger(occurrence) || occurrence < 0 || (t.max !== null && (!Number.isSafeInteger(t.max) || t.max < 1)))
        throw new WireCompatibilityError("Unsupported saved recurring occurrence count");
      const dates: string[] = [];
      let steps = 0;
      while (next <= endDate && (!t.end || next <= t.end) && (t.max === null || occurrence < t.max)) {
        if (++steps > 10000) throw new WireCompatibilityError("Calendar recurring backlog exceeds 10000 occurrences");
        if (next >= startDate) dates.push(next);
        occurrence++;
        if (next === endDate || next === t.end || occurrence === t.max) break;
        try { next = advanceRecurringInvoiceDate(next, t.frequency); }
        catch { throw new WireCompatibilityError("Unsupported saved calendar schedule"); }
      }
      if (!dates.length) continue;
      const lines = await tx.select({ quantity: recurringTemplateLine.quantity, price: sql<string>`${recurringTemplateLine.unitPrice}::text` })
        .from(recurringTemplateLine).where(eq(recurringTemplateLine.templateId, t.id)).orderBy(asc(recurringTemplateLine.id));
      let subtotal = 0n;
      for (const line of lines) {
        if (!Number.isSafeInteger(line.quantity)) throw new WireCompatibilityError("Unsupported saved calendar quantity");
        const amount = analyticsRound(BigInt(line.quantity) * analyticsStoredMinor(line.price), 100n);
        reportMinor(amount); subtotal += amount;
      }
      const money = analyticsMoney("amount", subtotal), currencyCode = analyticsCurrency(t.currency);
      for (const date of dates) events.push({ date, type: "recurring_generation", title: `${t.name} - ${t.nameContact ?? ""}`, id: t.id, currencyCode, ...money });
    }
    const [org] = await tx.select({ currency: organization.defaultCurrency }).from(organization).where(eq(organization.id, ctx.organizationId));
    if (!org) throw new AuthError("Organization not found", 404);
    const budgetCurrency = analyticsCurrency(org.currency ?? "USD");
    if (!filter || filter === budgetCurrency) {
      const periods = await tx.select({ date: budgetPeriod.startDate, label: budgetPeriod.label, name: budget.name, amount: sql<string>`${budgetPeriod.amount}::text` })
        .from(budgetPeriod).innerJoin(budgetLine, eq(budgetLine.id, budgetPeriod.budgetLineId)).innerJoin(budget, eq(budget.id, budgetLine.budgetId))
        .where(and(eq(budget.organizationId, ctx.organizationId), eq(budget.isActive, true), isNull(budget.deletedAt),
          gte(budgetPeriod.startDate, startDate), lte(budgetPeriod.startDate, endDate))).orderBy(asc(budgetPeriod.id));
      for (const row of periods) events.push({ date: forecastSavedDate(row.date), type: "budget_period_start", title: `${row.name} - ${row.label}`,
        currencyCode: budgetCurrency, ...analyticsMoney("amount", analyticsStoredMinor(row.amount)) });
    }
    events.sort((a, b) => a.date.localeCompare(b.date) || a.type.localeCompare(b.type) || (a.id ?? a.title).localeCompare(b.id ?? b.title));
    return { startDate, endDate, events };
  }, snapshot);
}

export async function getDuplicateReport(ctx: AuthContext, input: unknown = {}) {
  requireRole(ctx, "view:data");
  duplicateReportSchema.parse(input);
  return db.transaction(async tx => {
    const duplicateGroups = [];
    for (const table of [invoice, bill] as const) {
      const receivable = table === invoice;
      const rows = await tx.select({ contactName: contact.name, currency: table.currencyCode, amount: sql<string>`${table.total}::text`,
        items: sql<{ id: string; number: string; date: string; status: string }[]>`json_agg(json_build_object('id', ${table.id}, 'number', ${receivable ? invoice.invoiceNumber : bill.billNumber}, 'date', ${table.issueDate}, 'status', ${table.status}) order by ${table.issueDate}, ${table.id})` })
        .from(table).innerJoin(contact, and(eq(contact.id, table.contactId), eq(contact.organizationId, ctx.organizationId), isNull(contact.deletedAt)))
        .where(and(eq(table.organizationId, ctx.organizationId), isNull(table.deletedAt), ne(table.status, "void")))
        .groupBy(table.contactId, contact.name, table.currencyCode, table.total)
        .having(and(sql`count(*) > 1`, sql`max(${table.issueDate}::date) - min(${table.issueDate}::date) <= 7`))
        .orderBy(asc(table.contactId), asc(table.currencyCode), asc(table.total));
      for (const row of rows) duplicateGroups.push({ type: receivable ? "invoice" : "bill", contactName: row.contactName,
        currencyCode: analyticsCurrency(row.currency), ...analyticsMoney("amount", analyticsStoredMinor(row.amount)),
        items: row.items.map(item => ({ ...item, date: forecastSavedDate(item.date) })) });
    }
    return { duplicateGroups, totalGroups: duplicateGroups.length };
  }, snapshot);
}
