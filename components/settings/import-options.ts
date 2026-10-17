import type { useTranslations } from "next-intl";
import type { SourceSystem, ImportEntity } from "@/lib/import-export/types";
import { FileSpreadsheet, Users, Receipt, ClipboardList, BookOpen, Package, Landmark } from "lucide-react";

export function importOptions(t: ReturnType<typeof useTranslations<"SettingsImportExport">>) {
  const SOURCES: { key: SourceSystem; label: string }[] = [
    { key: "quickbooks", label: "QuickBooks" },
    { key: "xero", label: "Xero" },
    { key: "freshbooks", label: "FreshBooks" },
    { key: "wave", label: "Wave" },
    { key: "custom", label: t("customCSV") },
  ];

  const ENTITIES: {
    key: ImportEntity;
    label: string;
    icon: typeof FileSpreadsheet;
    note: string;
    previewEndpoint: string;
    importEndpoint: string;
    targetFields: { key: string; label: string; matchLabel?: string; required?: boolean }[];
  }[] = [
    {
      key: "accounts",
      label: t("chartOfAccounts"),
      icon: BookOpen,
      note: t("noDependencies"),
      previewEndpoint: "/api/v1/bulk/accounts/preview",
      importEndpoint: "/api/v1/bulk/accounts/import",
      targetFields: [
        { key: "code", label: t("code"), matchLabel: "Code", required: true },
        { key: "name", label: t("name"), matchLabel: "Name", required: true },
        { key: "type", label: t("type"), matchLabel: "Type", required: true },
        { key: "subType", label: t("subType"), matchLabel: "Sub Type" },
        { key: "description", label: t("description"), matchLabel: "Description" },
        { key: "isActive", label: t("activeTrueFalse"), matchLabel: "Active (true/false)" },
      ],
    },
    {
      key: "contacts",
      label: t("contacts"),
      icon: Users,
      note: t("noDependencies"),
      previewEndpoint: "/api/v1/bulk/contacts/preview",
      importEndpoint: "/api/v1/bulk/contacts/import",
      targetFields: [
        { key: "name", label: t("name"), matchLabel: "Name", required: true },
        { key: "email", label: t("email"), matchLabel: "Email" },
        { key: "phone", label: t("phone"), matchLabel: "Phone" },
        { key: "type", label: t("type"), matchLabel: "Type" },
        { key: "taxNumber", label: t("taxNumber"), matchLabel: "Tax Number" },
        { key: "billingLine1", label: t("billingAddress"), matchLabel: "Billing Address" },
        { key: "billingCity", label: t("billingCity"), matchLabel: "Billing City" },
        { key: "billingState", label: t("billingState"), matchLabel: "Billing State" },
        { key: "billingPostalCode", label: t("billingPostalCode"), matchLabel: "Billing Postal Code" },
        { key: "billingCountry", label: t("billingCountry"), matchLabel: "Billing Country" },
      ],
    },
    {
      key: "products",
      label: t("products"),
      icon: Package,
      note: t("importAccountsFirst"),
      previewEndpoint: "/api/v1/bulk/products/preview",
      importEndpoint: "/api/v1/bulk/products/import",
      targetFields: [
        { key: "name", label: t("name"), matchLabel: "Name", required: true },
        { key: "sku", label: t("sKU"), matchLabel: "SKU" },
        { key: "description", label: t("description"), matchLabel: "Description" },
        { key: "unitPrice", label: t("unitPriceDecimal"), matchLabel: "Unit Price (decimal)" },
        { key: "costPrice", label: t("costPriceDecimal"), matchLabel: "Cost Price (decimal)" },
        { key: "unitPriceMinor", label: t("unitPriceMinorUnits"), matchLabel: "Unit Price (minor units)" },
        { key: "costPriceMinor", label: t("costPriceMinorUnits"), matchLabel: "Cost Price (minor units)" },
        { key: "currencyCode", label: t("currencyMustMatchOrganization"), matchLabel: "Currency (must match organization)" },
        { key: "quantityOnHand", label: t("quantityOnHand"), matchLabel: "Quantity On Hand" },
      ],
    },
    {
      key: "invoices",
      label: t("invoices"),
      icon: Receipt,
      note: t("importContactsAccountsFirst"),
      previewEndpoint: "/api/v1/bulk/invoices/preview",
      importEndpoint: "/api/v1/bulk/invoices/import",
      targetFields: [
        { key: "contactId", label: t("contactID"), matchLabel: "Contact ID", required: true },
        { key: "issueDate", label: t("issueDate"), matchLabel: "Issue Date", required: true },
        { key: "dueDate", label: t("dueDate"), matchLabel: "Due Date", required: true },
        { key: "reference", label: t("reference"), matchLabel: "Reference" },
        { key: "invoiceNumber", label: t("invoiceGroup"), matchLabel: "Invoice Group" },
        { key: "currencyCode", label: t("currencyDefaultUSD"), matchLabel: "Currency (default USD)" },
        { key: "lineDescription", label: t("lineDescription"), matchLabel: "Line Description", required: true },
        { key: "lineQuantity", label: t("lineQuantity"), matchLabel: "Line Quantity" },
        { key: "lineUnitPrice", label: t("unitPriceDecimal"), matchLabel: "Unit Price (decimal)" },
        { key: "lineUnitPriceMinor", label: t("unitPriceMinorUnits"), matchLabel: "Unit Price (minor units)" },
        { key: "lineAccountId", label: t("revenueAccountID"), matchLabel: "Revenue Account ID" },
      ],
    },
    {
      key: "bills",
      label: t("bills"),
      icon: ClipboardList,
      note: t("importContactsAccountsFirst"),
      previewEndpoint: "/api/v1/bulk/bills/preview",
      importEndpoint: "/api/v1/bulk/bills/import",
      targetFields: [
        { key: "billNumber", label: t("billGroup"), matchLabel: "Bill Group" },
        { key: "contactName", label: t("contactName"), matchLabel: "Contact Name", required: true },
        { key: "issueDate", label: t("issueDate"), matchLabel: "Issue Date", required: true },
        { key: "dueDate", label: t("dueDate"), matchLabel: "Due Date", required: true },
        { key: "lineDescription", label: t("lineDescription"), matchLabel: "Line Description", required: true },
        { key: "lineQuantity", label: t("lineQuantity"), matchLabel: "Line Quantity" },
        { key: "currencyCode", label: t("currencyDefaultUSD"), matchLabel: "Currency (default USD)" },
        { key: "lineUnitPrice", label: t("unitPriceDecimal"), matchLabel: "Unit Price (decimal)" },
        { key: "lineUnitPriceExact", label: t("exactUnitPriceDecimal"), matchLabel: "Exact Unit Price (decimal)" },
        { key: "lineUnitPriceMinor", label: t("unitPriceMinorUnits"), matchLabel: "Unit Price (minor units)" },
        { key: "lineAmount", label: t("lineAmountDecimal"), matchLabel: "Line Amount (decimal)" },
        { key: "lineAmountExact", label: t("exactLineAmountDecimal"), matchLabel: "Exact Line Amount (decimal)" },
        { key: "lineAmountMinor", label: t("lineAmountMinorUnits"), matchLabel: "Line Amount (minor units)" },
        { key: "lineAccountCode", label: t("lineAccountCode"), matchLabel: "Line Account Code" },
      ],
    },
    {
      key: "entries",
      label: t("journalEntries"),
      icon: FileSpreadsheet,
      note: t("importAccountsFirst"),
      previewEndpoint: "/api/v1/bulk/entries/preview",
      importEndpoint: "/api/v1/bulk/entries/import",
      targetFields: [
        { key: "entryNumber", label: t("entryNumber"), matchLabel: "Entry Number" },
        { key: "date", label: t("date"), matchLabel: "Date", required: true },
        { key: "description", label: t("description"), matchLabel: "Description", required: true },
        { key: "reference", label: t("reference"), matchLabel: "Reference" },
        { key: "lineAccountCode", label: t("accountCode"), matchLabel: "Account Code", required: true },
        { key: "debit", label: t("debit"), matchLabel: "Debit" },
        { key: "credit", label: t("credit"), matchLabel: "Credit" },
        { key: "debitAmountMinor", label: t("debitMinorUnits"), matchLabel: "Debit (minor units)" },
        { key: "creditAmountMinor", label: t("creditMinorUnits"), matchLabel: "Credit (minor units)" },
      ],
    },
    {
      key: "bank-transactions",
      label: t("bankTransactions"),
      icon: Landmark,
      note: t("importAccountsFirst"),
      previewEndpoint: "/api/v1/bulk/bank-transactions/preview",
      importEndpoint: "/api/v1/bulk/bank-transactions/import",
      targetFields: [
        { key: "date", label: t("date"), matchLabel: "Date", required: true },
        { key: "description", label: t("description"), matchLabel: "Description", required: true },
        { key: "amount", label: t("amount"), matchLabel: "Amount", required: true },
        { key: "reference", label: t("reference"), matchLabel: "Reference" },
        { key: "bankAccountCode", label: t("bankAccount"), matchLabel: "Bank Account", required: true },
        { key: "debit", label: t("debit"), matchLabel: "Debit" },
        { key: "credit", label: t("credit"), matchLabel: "Credit" },
      ],
    },
  ];

  const EXPORT_ENTITIES = [
    { key: "accounts", label: t("chartOfAccounts"), transactional: false },
    { key: "contacts", label: t("contacts"), transactional: false },
    { key: "invoices", label: t("invoices"), transactional: true },
    { key: "bills", label: t("bills"), transactional: true },
    { key: "entries", label: t("journalEntries"), transactional: true },
    { key: "products", label: t("products"), transactional: false },
    { key: "bank-transactions", label: t("bankTransactions"), transactional: true },
  ];

  return { SOURCES, ENTITIES, EXPORT_ENTITIES };
}
