import type { useTranslations } from "next-intl";

export type InvoiceTranslate = ReturnType<typeof useTranslations<"SalesInvoices">>;
const statuses = {
  draft: "draft", sent: "sent", partial: "partial", paid: "paid", overdue: "overdueStatus",
  void: "void", pending_approval: "pendingApproval", rejected: "rejectedStatus",
} as const;
const methods = { bank_transfer: "bankTransfer", cash: "cash", check: "check", card: "card", other: "other" } as const;
const credits = { prepayment: "prepayment", overpayment: "overpayment", credit_note: "creditNote" } as const;
// Presentation-only mapping of reviewed service messages; wire rules stay unchanged.
const compliance = {
  "Organization name is required": "compliance1",
  "Invoice number is required": "compliance2",
  "Issue date is required": "compliance3",
  "At least one line item is required": "compliance4",
  "Each line item should have a description, quantity, and unit price": "compliance5",
  "Full organization address is required for EU invoices": "compliance6",
  "Organization city is recommended for EU invoices": "compliance7",
  "Organization postal code is recommended for EU invoices": "compliance8",
  "Organization country is recommended for EU invoices": "compliance9",
  "VAT number is required for EU invoices": "compliance10",
  "Due date is required for EU invoices": "compliance11",
  "Customer name is required for EU invoices": "compliance12",
  "Currency code is required for EU invoices": "compliance13",
  "Customer VAT number is required for B2B cross-border EU invoices": "compliance14",
  "Reverse charge notice is required for B2B cross-border EU invoices": "compliance15",
  "Customer address is recommended for B2B EU invoices": "compliance16",
  "Full organization address is required for UK invoices": "compliance17",
  "VAT number is required for UK invoices": "compliance18",
  "Due date is required for UK invoices": "compliance19",
  "Customer name is required for UK invoices": "compliance20",
  "Currency code is required for UK invoices": "compliance21",
  "Customer address is recommended for B2B UK invoices": "compliance22",
  "Steuernummer or USt-IdNr is required for German invoices": "compliance23",
  "SIREN/SIRET number is required for French invoices": "compliance24",
  "VAT exemption notice is required on French invoices when applicable": "compliance25",
  "GSTIN is required for Indian invoices": "compliance26",
  "Organization address is required for Indian invoices": "compliance27",
  "Customer address is required for Indian invoices": "compliance28",
  "GST registration number is recommended for Singaporean invoices": "compliance29",
  "VAT registration number is required for Saudi invoices": "compliance30",
  "Organization address is required for Saudi invoices": "compliance31",
  "Registration number is required for qualified Japanese invoices": "compliance32",
  "Organization address is recommended for Japanese invoices": "compliance33",
  "CNPJ is required for Brazilian invoices": "compliance34",
  "Organization address is required for Brazilian invoices": "compliance35",
  "ABN is recommended for Australian invoices": "compliance36",
  "Organization address is recommended for Australian invoices": "compliance37",
  "GST number is recommended for New Zealand invoices": "compliance38",
  "GST/HST number is recommended for Canadian invoices": "compliance39",
  "Organization address is recommended": "compliance40",
  "Tax ID is recommended": "compliance41",
} as const;

export function invoiceStatusLabel(t: InvoiceTranslate, code: string) {
  return Object.hasOwn(statuses, code) ? t(statuses[code as keyof typeof statuses]) : code;
}
export function invoiceMethodLabel(t: InvoiceTranslate, code: string) {
  return Object.hasOwn(methods, code) ? t(methods[code as keyof typeof methods]) : code;
}
export function invoiceCreditLabel(t: InvoiceTranslate, code: string) {
  return Object.hasOwn(credits, code) ? t(credits[code as keyof typeof credits]) : code;
}
export function invoiceComplianceLabel(t: InvoiceTranslate, message: string) {
  return Object.hasOwn(compliance, message) ? t(compliance[message as keyof typeof compliance]) : t("complianceUnknown");
}
