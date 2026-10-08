import { and, asc, desc, eq, gte, isNull, lte, ne, notInArray, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { bill, contact, exchangeRate, invoice, organization, recurringTemplate, recurringTemplateLine } from "@/lib/db/schema";
import { AuthError, type AuthContext } from "@/lib/api/auth-context";
import { requireRole } from "@/lib/api/require-role";
import { advanceRecurringInvoiceDate } from "@/lib/api/recurring-invoice-wire";
import { WireCompatibilityError } from "@/lib/money/wire";
import { analyticsCurrency, analyticsMoney, analyticsRound, analyticsStoredMinor } from "./document-analytics-wire";
import { reportMinor } from "./statement-wire";
import { cashForecastSchema, unrealizedFxSchema, forecastSavedDate, forecastAddDays, forecastWeekOf, forecastFxRate, forecastFxConvert, forecastFxInverse } from "./forecast-fx-wire";

type ForecastEntry = { date: string; type: "receivable" | "payable" | "recurring_invoice" | "recurring_bill"; description: string; amount: bigint };

export async function getCashForecast(ctx: AuthContext, input: unknown = {}) {
  requireRole(ctx, "view:data");
  const { weeks: horizon, currencyCode: filter } = cashForecastSchema.parse(input);
  const today = new Date().toISOString().slice(0, 10), end = forecastAddDays(today, horizon * 7);
  return db.transaction(async tx => {
    const org = await tx.query.organization.findFirst({ where: eq(organization.id, ctx.organizationId), columns: { defaultCurrency: true } });
    if (!org) throw new AuthError("Organization not found", 404);
    const entries: ForecastEntry[] = [], currencies = new Set<string>();
    for (const table of [invoice, bill] as const) {
      const receivable = table === invoice;
      const rows = await tx.select({ date: table.dueDate, amount: sql<string>`${table.amountDue}::text`, currency: table.currencyCode,
        number: receivable ? invoice.invoiceNumber : bill.billNumber, name: contact.name })
        .from(table).leftJoin(contact, and(eq(contact.id, table.contactId), eq(contact.organizationId, ctx.organizationId), isNull(contact.deletedAt)))
        .where(and(eq(table.organizationId, ctx.organizationId), isNull(table.deletedAt), notInArray(table.status, ["draft", "void", "paid"]),
          gte(table.dueDate, today), lte(table.dueDate, end), filter ? eq(table.currencyCode, filter) : undefined)).orderBy(asc(table.id));
      for (const row of rows) {
        currencies.add(analyticsCurrency(row.currency));
        const amount = analyticsStoredMinor(row.amount);
        entries.push({ date: forecastSavedDate(row.date), type: receivable ? "receivable" : "payable",
          description: `${row.name ?? (receivable ? "Customer" : "Supplier")} - ${row.number}`, amount: receivable ? amount : -amount });
      }
    }
    const templates = await tx.select({ id: recurringTemplate.id, name: recurringTemplate.name, type: recurringTemplate.type,
      currency: recurringTemplate.currencyCode, next: recurringTemplate.nextRunDate, frequency: recurringTemplate.frequency,
      end: recurringTemplate.endDate, generated: recurringTemplate.occurrencesGenerated, max: recurringTemplate.maxOccurrences, contact: contact.name })
      .from(recurringTemplate).leftJoin(contact, and(eq(contact.id, recurringTemplate.contactId), eq(contact.organizationId, ctx.organizationId), isNull(contact.deletedAt)))
      .where(and(eq(recurringTemplate.organizationId, ctx.organizationId), isNull(recurringTemplate.deletedAt), eq(recurringTemplate.status, "active"),
        inArray(recurringTemplate.type, ["invoice", "bill", "expense"]), lte(recurringTemplate.nextRunDate, end),
        filter ? eq(recurringTemplate.currencyCode, filter) : undefined)).orderBy(asc(recurringTemplate.id));
    for (const template of templates) {
      let next = forecastSavedDate(template.next), occurrence = template.generated;
      if (template.end) forecastSavedDate(template.end);
      if (!Number.isSafeInteger(occurrence) || occurrence < 0 ||
          (template.max !== null && (!Number.isSafeInteger(template.max) || template.max < 1))) {
        throw new WireCompatibilityError("Unsupported saved recurring occurrence count");
      }
      const dates: string[] = [];
      let steps = 0;
      while (next <= end && (!template.end || next <= template.end) && (template.max === null || occurrence < template.max)) {
        if (++steps > 10000) throw new WireCompatibilityError("Recurring forecast backlog exceeds 10000 occurrences");
        if (next >= today) dates.push(next);
        occurrence++;
        // No need to advance outside the requested horizon or after the terminal occurrence.
        if (next === end || next === template.end || occurrence === template.max) break;
        try { next = advanceRecurringInvoiceDate(next, template.frequency); }
        catch { throw new WireCompatibilityError("Unsupported saved recurring forecast schedule"); }
      }
      if (!dates.length) continue;
      currencies.add(analyticsCurrency(template.currency));
      const lines = await tx.select({ quantity: recurringTemplateLine.quantity, price: sql<string>`${recurringTemplateLine.unitPrice}::text` })
        .from(recurringTemplateLine).where(eq(recurringTemplateLine.templateId, template.id)).orderBy(asc(recurringTemplateLine.id));
      let subtotal = 0n;
      for (const line of lines) {
        if (!Number.isSafeInteger(line.quantity)) throw new WireCompatibilityError("Unsupported saved forecast quantity");
        const amount = analyticsRound(BigInt(line.quantity) * analyticsStoredMinor(line.price), 100n);
        reportMinor(amount); subtotal += amount;
      }
      reportMinor(subtotal);
      for (const date of dates) entries.push({ date, type: template.type === "invoice" ? "recurring_invoice" : "recurring_bill",
        description: `${template.name} - ${template.contact ?? ""}`, amount: template.type === "invoice" ? subtotal : -subtotal });
    }
    if (currencies.size > 1) throw new WireCompatibilityError("Mixed forecast currencies require a currencyCode filter");
    const currencyCode = filter ?? [...currencies][0] ?? analyticsCurrency(org.defaultCurrency ?? "USD");
    entries.sort((a, b) => a.date.localeCompare(b.date));
    const buckets = new Map<string, { inflows: bigint; outflows: bigint; count: number }>();
    for (let date = forecastWeekOf(today); date <= end; date = forecastAddDays(date, 7)) buckets.set(date, { inflows: 0n, outflows: 0n, count: 0 });
    let inflows = 0n, outflows = 0n, cumulative = 0n;
    for (const entry of entries) {
      const bucket = buckets.get(forecastWeekOf(entry.date))!;
      if (entry.amount > 0n) { bucket.inflows += entry.amount; inflows += entry.amount; }
      else { bucket.outflows -= entry.amount; outflows -= entry.amount; }
      bucket.count++;
    }
    const weeks = [...buckets].map(([weekOf, bucket]) => {
      const net = bucket.inflows - bucket.outflows; cumulative += net;
      return { weekOf, ...analyticsMoney("inflows", bucket.inflows), ...analyticsMoney("outflows", bucket.outflows),
        ...analyticsMoney("net", net), ...analyticsMoney("cumulativeNet", cumulative), entryCount: bucket.count };
    });
    return { currencyCode, forecastPeriod: { start: today, end, weeks: horizon },
      projectionBasis: "line_subtotal_before_tax_and_discount", ...analyticsMoney("totalInflows", inflows),
      ...analyticsMoney("totalOutflows", outflows), ...analyticsMoney("netForecast", inflows - outflows), weeks,
      entries: entries.map(({ amount, ...entry }) => ({ ...entry, ...analyticsMoney("amount", amount) })) };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}

export async function getUnrealizedFx(ctx: AuthContext, input: unknown = {}) {
  requireRole(ctx, "view:data"); unrealizedFxSchema.parse(input);
  const today = new Date().toISOString().slice(0, 10);
  return db.transaction(async tx => {
    const org = await tx.query.organization.findFirst({ where: eq(organization.id, ctx.organizationId), columns: { defaultCurrency: true } });
    if (!org) throw new AuthError("Organization not found", 404);
    const defaultCurrency = analyticsCurrency(org.defaultCurrency ?? "USD");
    // Local to this authorized repeatable-read snapshot. No provider calls or global tenant cache.
    const rates = new Map<string, { rateExact: string; rate: number } | null>();
    const resolve = async (currency: string, date: string) => {
      const key = JSON.stringify([currency, date]);
      if (rates.has(key)) return rates.get(key)!;
      const lookup = async (base: string, quote: string) => (await tx.select({ exact: sql<string | null>`${exchangeRate.rateExact}::text`,
        version: exchangeRate.rateFormatVersion, direction: exchangeRate.rateDirection, status: exchangeRate.rateMigrationStatus })
        .from(exchangeRate).where(and(eq(exchangeRate.organizationId, ctx.organizationId), eq(exchangeRate.baseCurrency, base),
          eq(exchangeRate.targetCurrency, quote), lte(exchangeRate.date, date))).orderBy(desc(exchangeRate.date)).limit(1))[0];
      let row = await lookup(currency, defaultCurrency), inverse = false;
      if (!row) { row = await lookup(defaultCurrency, currency); inverse = true; }
      let result: { rateExact: string; rate: number } | null = null;
      if (row && row.status === "exact" && row.exact !== null && row.version === 1 && row.direction === "quote_per_base") {
        let quote = row.exact;
        if (inverse) quote = forecastFxInverse(quote);
        result = forecastFxRate(quote);
      }
      rates.set(key, result); return result;
    };
    const items = []; let gain = 0n, loss = 0n, missingRateItems = 0;
    for (const table of [invoice, bill] as const) {
      const receivable = table === invoice;
      const rows = await tx.select({ id: table.id, number: receivable ? invoice.invoiceNumber : bill.billNumber,
        currency: table.currencyCode, amount: sql<string>`${table.amountDue}::text`, date: table.issueDate })
        .from(table).where(and(eq(table.organizationId, ctx.organizationId), isNull(table.deletedAt),
          notInArray(table.status, ["draft", "void", "paid"]), ne(table.currencyCode, defaultCurrency))).orderBy(asc(table.id));
      for (const row of rows) {
        const currencyCode = analyticsCurrency(row.currency), issueDate = forecastSavedDate(row.date), amount = analyticsStoredMinor(row.amount);
        const original = await resolve(currencyCode, issueDate), current = await resolve(currencyCode, today);
        let originalBase: bigint | null = null, currentBase: bigint | null = null, change: bigint | null = null;
        if (original && current) {
          originalBase = forecastFxConvert(amount, original.rateExact); currentBase = forecastFxConvert(amount, current.rateExact);
          change = receivable ? currentBase - originalBase : originalBase - currentBase;
          if (change > 0n) gain += change; else loss += change;
        } else missingRateItems++;
        const nullableMoney = (key: string, value: bigint | null) => value === null ? { [key]: null, [`${key}Minor`]: null } : analyticsMoney(key, value);
        items.push({ type: receivable ? "invoice" : "bill", id: row.id, number: row.number, currencyCode,
          ...analyticsMoney("amountDue", amount), issueDate, originalRate: original?.rate ?? null, originalRateExact: original?.rateExact ?? null,
          currentRate: current?.rate ?? null, currentRateExact: current?.rateExact ?? null,
          ...nullableMoney("originalAmountBase", originalBase), ...nullableMoney("currentAmountBase", currentBase), ...nullableMoney("unrealizedGainLoss", change) });
      }
    }
    return { defaultCurrency, asOf: today, rateDirection: "quote_per_base", items, summary: { totalItems: items.length, missingRateItems,
      ...analyticsMoney("totalUnrealizedGain", gain), ...analyticsMoney("totalUnrealizedLoss", loss), ...analyticsMoney("netUnrealizedGainLoss", gain + loss) } };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
