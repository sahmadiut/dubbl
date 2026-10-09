import { and, asc, eq, gte, isNull, lte } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { bankAccount, bankTransaction, bill, chartAccount, contact, inventoryItem, invoice, journalEntry, organization } from "@/lib/db/schema";
import { AuthError, type AuthContext } from "@/lib/api/auth-context";
import { requireRole } from "@/lib/api/require-role";
import { currencyMetadata } from "@/lib/money/exact";
import { centsToDecimal, generateCSV } from "./csv-utils";
import { exportFiltersSchema, genericEntity } from "./generic-wire";

const columns = {
  accounts: ["code", "name", "type", "subType", "description", "isActive"],
  contacts: ["name", "email", "phone", "type", "taxNumber", "billingLine1", "billingCity", "billingState", "billingPostalCode", "billingCountry"],
  products: ["name", "sku", "description", "unitPrice", "costPrice", "quantityOnHand", "unitPriceMinor", "costPriceMinor", "currencyCode"],
  invoices: ["invoiceNumber", "contactName", "date", "dueDate", "status", "lineDescription", "lineQty", "lineUnitPrice", "lineAmount", "lineAccountCode", "lineUnitPriceMinor", "lineAmountMinor", "currencyCode"],
  bills: ["billNumber", "contactName", "date", "dueDate", "status", "lineDescription", "lineQty", "lineUnitPrice", "lineAmount", "lineAccountCode", "lineUnitPriceMinor", "lineAmountMinor", "currencyCode"],
  entries: ["entryNumber", "date", "description", "reference", "lineAccountCode", "debit", "credit", "accountCode", "debitAmountMinor", "creditAmountMinor", "currencyCode"],
  "bank-transactions": ["date", "description", "amount", "reference", "bankAccountName", "reconciled", "amountMinor", "currencyCode"],
} as const;
const transactional = new Set(["invoices", "bills", "entries", "bank-transactions"]);
const currency = (code: string) => {
  try { return currencyMetadata(code).code; }
  catch { throw new AuthError("Unsupported saved export currency", 422); }
};
const moneyFields = (name: string, amount: number) => ({ [name]: centsToDecimal(amount), [`${name}Minor`]: String(amount) });

/** All transports share these row projections and strict inclusive date filters. */
export async function genericExport(ctx: AuthContext, entityInput: unknown, filterInput: unknown = {}) {
  requireRole(ctx, "view:data");
  const entity = genericEntity.parse(entityInput), filters = exportFiltersSchema.parse(filterInput);
  if (!transactional.has(entity) && (filters.startDate || filters.endDate)) throw new AuthError("Date filters apply only to transactional entities", 400);
  // Repeatable read gives ZIP's seven files one consistent read-only snapshot.
  return db.transaction(tx => projectExport(tx, ctx, entity, filters), { isolationLevel: "repeatable read", accessMode: "read only" });
}
type Reader = Parameters<Parameters<typeof db.transaction>[0]>[0];
async function projectExport(tx: Reader, ctx: AuthContext, entity: z.infer<typeof genericEntity>, filters: z.infer<typeof exportFiltersSchema>) {
  const rows: Record<string, unknown>[] = [];
  if (entity === "accounts") {
    const data = await tx.query.chartAccount.findMany({ where: and(eq(chartAccount.organizationId, ctx.organizationId), isNull(chartAccount.deletedAt)), orderBy: [asc(chartAccount.code), asc(chartAccount.id)] });
    rows.push(...data.map(a => ({ code: a.code, name: a.name, type: a.type, subType: a.subType || "", description: a.description || "", isActive: String(a.isActive) })));
  } else if (entity === "contacts") {
    const data = await tx.query.contact.findMany({ where: and(eq(contact.organizationId, ctx.organizationId), isNull(contact.deletedAt)), orderBy: asc(contact.id) });
    rows.push(...data.map(c => ({ name: c.name, email: c.email || "", phone: c.phone || "", type: c.type, taxNumber: c.taxNumber || "",
      billingLine1: c.addresses?.billing?.line1 || "", billingCity: c.addresses?.billing?.city || "", billingState: c.addresses?.billing?.state || "",
      billingPostalCode: c.addresses?.billing?.postalCode || "", billingCountry: c.addresses?.billing?.country || "" })));
  } else if (entity === "products") {
    const org = await tx.query.organization.findFirst({ where: eq(organization.id, ctx.organizationId), columns: { defaultCurrency: true } });
    if (!org) throw new AuthError("Organization not found", 404);
    const currencyCode = currency(org.defaultCurrency);
    const data = await tx.query.inventoryItem.findMany({ where: and(eq(inventoryItem.organizationId, ctx.organizationId), isNull(inventoryItem.deletedAt)), orderBy: asc(inventoryItem.id) });
    rows.push(...data.map(p => ({ name: p.name, sku: p.sku || "", description: p.description || "", ...moneyFields("unitPrice", p.salePrice),
      ...moneyFields("costPrice", p.purchasePrice), quantityOnHand: p.quantityOnHand, currencyCode })));
  } else if (entity === "invoices" || entity === "bills") {
    const table = entity === "invoices" ? invoice : bill;
    const where = and(eq(table.organizationId, ctx.organizationId), isNull(table.deletedAt),
      filters.startDate ? gte(table.issueDate, filters.startDate) : undefined, filters.endDate ? lte(table.issueDate, filters.endDate) : undefined);
    const data = entity === "invoices" ? await tx.query.invoice.findMany({ where, with: { contact: true, lines: true }, orderBy: [asc(invoice.issueDate), asc(invoice.id)] })
      : await tx.query.bill.findMany({ where, with: { contact: true, lines: true }, orderBy: [asc(bill.issueDate), asc(bill.id)] });
    const accounts = await tx.query.chartAccount.findMany({ where: eq(chartAccount.organizationId, ctx.organizationId), columns: { id: true } });
    const owned = new Set(accounts.map(a => a.id));
    for (const doc of data) {
      if (doc.contact && doc.contact.organizationId !== ctx.organizationId) throw new AuthError("Document contact is outside the organization", 422);
      const header = { [entity === "invoices" ? "invoiceNumber" : "billNumber"]: "invoiceNumber" in doc ? doc.invoiceNumber : doc.billNumber,
        contactName: doc.contact?.name || "", date: doc.issueDate, dueDate: doc.dueDate, status: doc.status, currencyCode: currency(doc.currencyCode) };
      if (!doc.lines.length) rows.push({ ...header, lineDescription: "", lineQty: "", lineUnitPrice: "", lineUnitPriceMinor: "", ...moneyFields("lineAmount", doc.total), lineAccountCode: "" });
      for (const line of [...doc.lines].sort((a, b) => a.id.localeCompare(b.id))) {
        if (line.accountId && !owned.has(line.accountId)) throw new AuthError("Document line account is outside the organization", 422);
        rows.push({ ...header, lineDescription: line.description, lineQty: centsToDecimal(line.quantity), ...moneyFields("lineUnitPrice", line.unitPrice),
          ...moneyFields("lineAmount", line.amount), lineAccountCode: line.accountId || "" });
      }
    }
  } else if (entity === "entries") {
    const data = await tx.query.journalEntry.findMany({ where: and(eq(journalEntry.organizationId, ctx.organizationId), isNull(journalEntry.deletedAt),
      filters.startDate ? gte(journalEntry.date, filters.startDate) : undefined, filters.endDate ? lte(journalEntry.date, filters.endDate) : undefined),
      // PostgreSQL relational JSON would decode unused numeric FX as Number.
      // This CSV projection does not carry FX; do not pass it through that codec.
      with: { lines: { columns: { rateExact: false }, with: { account: true } } }, orderBy: [asc(journalEntry.date), asc(journalEntry.id)] });
    for (const entry of data) for (const line of [...entry.lines].sort((a, b) => a.id.localeCompare(b.id))) {
      if (line.account && line.account.organizationId !== ctx.organizationId) throw new AuthError("Journal line account is outside the organization", 422);
      const debit = centsToDecimal(line.debitAmount), credit = centsToDecimal(line.creditAmount);
      rows.push({ entryNumber: entry.entryNumber, date: entry.date, description: entry.description, reference: entry.reference || "",
        lineAccountCode: line.account?.code || "", accountCode: line.account?.code || "", debit: line.debitAmount === 0 ? "" : debit,
        credit: line.creditAmount === 0 ? "" : credit, debitAmountMinor: String(line.debitAmount), creditAmountMinor: String(line.creditAmount), currencyCode: currency(line.currencyCode) });
    }
  } else {
    const accounts = await tx.query.bankAccount.findMany({ where: and(eq(bankAccount.organizationId, ctx.organizationId), isNull(bankAccount.deletedAt)), orderBy: asc(bankAccount.id) });
    for (const account of accounts) {
      const data = await tx.query.bankTransaction.findMany({ where: and(eq(bankTransaction.bankAccountId, account.id),
        filters.startDate ? gte(bankTransaction.date, filters.startDate) : undefined, filters.endDate ? lte(bankTransaction.date, filters.endDate) : undefined),
        orderBy: [asc(bankTransaction.date), asc(bankTransaction.id)] });
      for (const t of data) rows.push({ date: t.date, description: t.description, ...moneyFields("amount", t.amount), reference: t.reference || "",
        bankAccountName: account.accountName, reconciled: String(t.status === "reconciled"), currencyCode: currency(t.currencyCode || account.currencyCode) });
    }
  }
  return { entityType: entity, csv: generateCSV(rows, [...columns[entity]]), rowCount: rows.length };
}
export async function genericExportAll(ctx: AuthContext, filterInput: unknown = {}) {
  requireRole(ctx, "view:data");
  const filters = exportFiltersSchema.parse(filterInput);
  return db.transaction(async tx => {
    const files: { name: string; data: Uint8Array }[] = [];
    for (const entity of genericEntity.options) {
      const result = await projectExport(tx, ctx, entity, transactional.has(entity) ? filters : {});
      files.push({ name: `${entity}.csv`, data: new TextEncoder().encode(result.csv) });
    }
    return files;
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
