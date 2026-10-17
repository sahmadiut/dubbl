import type { useTranslations } from "next-intl";
type ImportTranslate = ReturnType<typeof useTranslations<"SettingsImportExport">>;
type TrashTranslate = ReturnType<typeof useTranslations<"SettingsTrash">>;
type BackupTranslate = ReturnType<typeof useTranslations<"SettingsBackups">>;
type EntityTranslate = ReturnType<typeof useTranslations<"SettingsDataEntities">>;
export function trashEntityOptions(t: TrashTranslate) {
  return [
    { value: "contact", label: t("contact") },
    { value: "invoice", label: t("invoice") },
    { value: "bill", label: t("bill") },
    { value: "account", label: t("account") },
    { value: "journal_entry", label: t("journalEntry") },
    { value: "product", label: t("product") },
    { value: "expense", label: t("expense") },
    { value: "quote", label: t("quote") },
    { value: "credit_note", label: t("creditNote") },
    { value: "debit_note", label: t("debitNote") },
    { value: "purchase_order", label: t("purchaseOrder") },
    { value: "bank_account", label: t("bankAccount") },
    { value: "payment", label: t("payment") },
    { value: "recurring_template", label: t("recurringTemplate") },
    { value: "project", label: t("project") },
    { value: "fixed_asset", label: t("fixedAsset") },
    { value: "budget", label: t("budget") },
    { value: "loan", label: t("loan") },
    { value: "document", label: t("document") },
    { value: "document_template", label: t("template") },
  ];

}

export function trashEntityLabel(t: TrashTranslate, entityType: string): string {
  // Backup is returned by the API, but the existing filter does not offer it.
  if (entityType === "data_backup") return t("backup");
  return trashEntityOptions(t).find(e => e.value === entityType)?.label || entityType;
}

export function trashRelativeTime(t: TrashTranslate, dateStr: string, now = Date.now()): string {
  const date = new Date(dateStr);
  const minutes = Math.floor((now - date.getTime()) / 60000);
  if (minutes < 1) return t("justNow");
  if (minutes < 60) return t("minutesAgo", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("hoursAgo", { count: hours });
  const days = Math.floor(hours / 24);
  if (days < 7) return t("daysAgo", { count: days });
  return date.toLocaleDateString();
}

export function importEntityLabel(t: ImportTranslate, value: string): string {
  switch (value) {
    case "accounts": return t("chartOfAccounts");
    case "contacts": return t("contacts");
    case "products": return t("products");
    case "invoices": return t("invoices");
    case "bills": return t("bills");
    case "entries": return t("journalEntries");
    case "bank-transactions": return t("bankTransactions");
    default: return value;
  }
}

export function importStatusLabel(t: ImportTranslate, value: string): string {
  switch (value) {
    case "completed": return t("completed");
    case "failed": return t("failed");
    case "processing": return t("processing");
    case "pending": return t("pending");
    default: return value;
  }
}

export function backupTypeLabel(t: BackupTranslate, value: string): string {
  switch (value) {
    case "scheduled": return t("scheduled");
    case "manual": return t("manual");
    case "uploaded": return t("uploaded");
    default: return value;
  }
}

export function formatBackupSize(bytes: number | null): string {
  if (!bytes) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const snapshotEntities = ["accounts", "contacts", "invoices", "bills", "journalEntries", "products", "bankAccounts", "expenses", "payments", "quotes", "creditNotes", "debitNotes", "purchaseOrders", "recurringTemplates", "projects", "budgets", "fixedAssets", "loans", "taxRates", "costCenters", "documents"] as const;
export function formatEntitySummary(t: EntityTranslate, counts: Record<string, number> | null): string {
  if (!counts) return "-";
  const entries = Object.entries(counts).filter(([, v]) => v > 0).slice(0, 3);
  if (!entries.length) return "-";
  return entries.map(([key, count]) => {
    const known = snapshotEntities.find(value => value === key);
    return `${count} ${known ? t(known) : key}`;
  }).join(", ");
}
