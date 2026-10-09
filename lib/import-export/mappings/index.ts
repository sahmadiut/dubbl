import type { SourceSystem, ImportEntity, ColumnAlias } from "../types";
import * as qb from "./quickbooks";
import * as xero from "./xero";
import * as fb from "./freshbooks";
import * as wave from "./wave";

type MappingRegistry = Record<string, ColumnAlias[]>;

const registry: MappingRegistry = {
  // QuickBooks
  "quickbooks:accounts": qb.quickbooksAccounts,
  "quickbooks:contacts": qb.quickbooksContacts,
  "quickbooks:invoices": qb.quickbooksInvoices,
  "quickbooks:bills": qb.quickbooksBills,
  "quickbooks:entries": qb.quickbooksEntries,
  "quickbooks:products": qb.quickbooksProducts,
  "quickbooks:bank-transactions": qb.quickbooksBankTransactions,

  // Xero
  "xero:accounts": xero.xeroAccounts,
  "xero:contacts": xero.xeroContacts,
  "xero:invoices": xero.xeroInvoices,
  "xero:bills": xero.xeroBills,
  "xero:entries": xero.xeroEntries,
  "xero:products": xero.xeroProducts,
  "xero:bank-transactions": xero.xeroBankTransactions,

  // FreshBooks
  "freshbooks:accounts": fb.freshbooksAccounts,
  "freshbooks:contacts": fb.freshbooksContacts,
  "freshbooks:invoices": fb.freshbooksInvoices,
  "freshbooks:bills": fb.freshbooksBills,
  "freshbooks:entries": fb.freshbooksEntries,
  "freshbooks:products": fb.freshbooksProducts,
  "freshbooks:bank-transactions": fb.freshbooksBankTransactions,

  // Wave
  "wave:accounts": wave.waveAccounts,
  "wave:contacts": wave.waveContacts,
  "wave:invoices": wave.waveInvoices,
  "wave:bills": wave.waveBills,
  "wave:entries": wave.waveEntries,
  "wave:products": wave.waveProducts,
  "wave:bank-transactions": wave.waveBankTransactions,
};

/**
 * Get column aliases for a source/entity combination.
 * All sources include canonical fields; exact aliases retain domain units.
 */
export function getMapping(source: SourceSystem, entity: ImportEntity): ColumnAlias[] {
  const mapped = registry[`${source}:${entity}`] || [];
  const canonical: Record<ImportEntity, string[]> = {
    accounts: ["code", "name", "type", "subType", "description", "isActive"],
    contacts: ["name", "email", "phone", "type", "taxNumber", "billingLine1", "billingCity", "billingState", "billingPostalCode", "billingCountry"],
    products: ["name", "sku", "description", "unitPrice", "costPrice", "unitPriceMinor", "costPriceMinor", "quantityOnHand", "type", "currencyCode"],
    invoices: ["invoiceNumber", "contactId", "contactName", "issueDate", "dueDate", "reference", "currencyCode", "lineDescription", "lineQuantity", "lineUnitPrice", "lineUnitPriceMinor", "lineAccountId", "lineAccountCode", "lineAmount"],
    bills: ["billNumber", "contactName", "issueDate", "dueDate", "currencyCode", "lineDescription", "lineQuantity", "lineUnitPrice", "lineUnitPriceExact", "lineUnitPriceMinor", "lineAmount", "lineAmountExact", "lineAmountMinor", "lineAccountCode"],
    entries: ["entryNumber", "date", "description", "reference", "lineAccountCode", "debit", "credit", "debitAmountMinor", "creditAmountMinor"],
    "bank-transactions": ["date", "description", "amount", "amountExact", "amountMinor", "reference", "bankAccountCode", "debit", "credit"],
  };
  return [...new Set([...canonical[entity], ...mapped.map(field => field.targetField)])].map(targetField => ({ targetField,
    aliases: [...new Set([targetField, ...(mapped.find(field => field.targetField === targetField)?.aliases ?? [])])] }));
}

/**
 * Convert ColumnAlias[] to a Record<targetField, aliases[]> for
 * passing to the BulkImportWizard component.
 */
export function aliasesToRecord(aliases: ColumnAlias[]): Record<string, string[]> {
  const record: Record<string, string[]> = {};
  for (const a of aliases) {
    record[a.targetField] = a.aliases;
  }
  return record;
}
