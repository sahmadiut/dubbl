import { outputTranslator } from "@/i18n/output";
import { documentMoneyText as formatMoney, documentRenderDto, documentHundredths } from "./render-wire";

interface TemplateSettings {
  locale?: import("@/i18n/locale").AppLocale;
  logoUrl?: string | null;
  accentColor?: string | null;
  headerHtml?: string | null;
  footerHtml?: string | null;
  showTaxBreakdown?: boolean;
  showPaymentTerms?: boolean;
  notes?: string | null;
  bankDetails?: string | null;
  paymentInstructions?: string | null;
}

interface OrgInfo {
  name: string;
  address?: string | null;
  taxId?: string | null;
  registrationNumber?: string | null;
  phone?: string | null;
  email?: string | null;
  countryCode?: string | null;
}

interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  taxAmount: number;
  amount: number;
}

interface InvoiceData {
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  status: string;
  contactName: string;
  contactEmail?: string | null;
  contactAddress?: string | null;
  contactTaxNumber?: string | null;
  lines: LineItem[];
  subtotal: number;
  taxTotal: number;
  total: number;
  amountPaid?: number;
  amountDue?: number;
  currencyCode: string;
  reference?: string | null;
  notes?: string | null;
}

function getTaxIdLabel(t: ReturnType<typeof outputTranslator>, countryCode?: string | null): string {
  if (!countryCode) return t("taxId");
  const cc = countryCode.toUpperCase();
  const EU = [
    "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR",
    "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL",
    "PL", "PT", "RO", "SK", "SI", "ES", "SE",
  ];
  if (EU.includes(cc) || cc === "GB") return "VAT";
  if (cc === "AU") return "ABN";
  if (cc === "NZ") return "GST";
  if (cc === "CA") return "GST/HST";
  return t("taxId");
}

function getInvoiceTitle(t: ReturnType<typeof outputTranslator>, countryCode?: string | null, hasTaxId?: boolean): string {
  const cc = countryCode?.toUpperCase();
  if ((cc === "AU" || cc === "NZ") && hasTaxId) return t("taxInvoice");
  return t("invoice");
}

// Per-document-type presentation config so we can reuse the invoice template
// for quotes, credit notes, purchase orders and debit notes. PO + debit notes
// are supplier-facing (we are the buyer), so the party blocks swap.
interface DocTypeConfig {
  // Heading shown at the top of the document.
  title: string;
  // Label for the document's identifying number (e.g. "Quote number").
  numberLabel: string;
  // Label for the second date row; null hides it.
  secondDateLabel: string | null;
  // Heading above the counterparty (recipient) block.
  partyLabel: string;
  // When true, the org is the buyer and the counterparty is the supplier,
  // so we render the counterparty as "from" rather than "bill to".
  supplierFacing: boolean;
  // Whether to show the running "amount due / total" headline + totals "amount due" row.
  showAmountDue: boolean;
}

const documentConfigs = (t: ReturnType<typeof outputTranslator>): Record<DocumentKind, DocTypeConfig> => ({
  invoice: {
    title: t("invoice"),
    numberLabel: t("invoiceNumber"),
    secondDateLabel: t("dateDue"),
    partyLabel: t("billTo"),
    supplierFacing: false,
    showAmountDue: true,
  },
  quote: {
    title: t("quote"),
    numberLabel: t("quoteNumber"),
    secondDateLabel: t("validUntil"),
    partyLabel: t("preparedFor"),
    supplierFacing: false,
    showAmountDue: false,
  },
  credit_note: {
    title: t("creditNote"),
    numberLabel: t("creditNoteNumber"),
    secondDateLabel: null,
    partyLabel: t("creditTo"),
    supplierFacing: false,
    showAmountDue: false,
  },
  purchase_order: {
    title: t("purchaseOrder"),
    numberLabel: t("orderNumber"),
    secondDateLabel: t("deliveryDate"),
    partyLabel: t("supplier"),
    supplierFacing: true,
    showAmountDue: false,
  },
  debit_note: {
    title: t("debitNote"),
    numberLabel: t("debitNoteNumber"),
    secondDateLabel: null,
    partyLabel: t("supplier"),
    supplierFacing: true,
    showAmountDue: false,
  },
});

export type DocumentKind = "invoice" | "quote" | "credit_note" | "purchase_order" | "debit_note";

// Generic document shape covering every doc type. The invoice-specific
// generateInvoiceHtml keeps its own field names and delegates here.
export interface DocumentData {
  documentNumber: string;
  issueDate: string;
  // Second date (due / expiry / delivery). Optional for types without one.
  secondDate?: string | null;
  contactName: string;
  contactEmail?: string | null;
  contactAddress?: string | null;
  contactTaxNumber?: string | null;
  lines: LineItem[];
  subtotal: number;
  taxTotal: number;
  total: number;
  amountPaid?: number;
  amountDue?: number;
  currencyCode: string;
  reference?: string | null;
  notes?: string | null;
}

export function generateDocumentHtml(
  kind: DocumentKind,
  doc: DocumentData,
  org: OrgInfo,
  template: TemplateSettings
): string {
  const t = outputTranslator(template.locale);
  doc = documentRenderDto(doc);
  const cfg = documentConfigs(t)[kind];
  const accent = template.accentColor || "#10b981";
  const taxIdLabel = getTaxIdLabel(t, org.countryCode);
  // Only invoices localize the heading ("Tax Invoice"); others use the fixed title.
  const docTitle = kind === "invoice" ? getInvoiceTitle(t, org.countryCode, !!org.taxId) : cfg.title;
  const amountPaid = doc.amountPaid ?? 0;
  const amountDue = doc.amountDue ?? doc.total;

  const templateVars: Record<string, string> = {
    orgName: org.name,
    orgAddress: org.address || "",
    orgTaxId: org.taxId || "",
    orgPhone: org.phone || "",
    orgEmail: org.email || "",
    orgRegistrationNumber: org.registrationNumber || "",
    invoiceNumber: doc.documentNumber,
    documentNumber: doc.documentNumber,
    issueDate: doc.issueDate,
    dueDate: doc.secondDate || "",
    contactName: doc.contactName,
    contactEmail: doc.contactEmail || "",
    contactAddress: doc.contactAddress || "",
    contactTaxNumber: doc.contactTaxNumber || "",
    reference: doc.reference || "",
    subtotal: formatMoney(doc.subtotal, doc.currencyCode),
    taxTotal: formatMoney(doc.taxTotal, doc.currencyCode),
    total: formatMoney(doc.total, doc.currencyCode),
    currency: doc.currencyCode,
  };

  const headerHtml = template.headerHtml
    ? replaceTemplatePlaceholders(template.headerHtml, templateVars)
    : "";
  const footerHtml = template.footerHtml
    ? replaceTemplatePlaceholders(template.footerHtml, templateVars)
    : "";

  const linesHtml = doc.lines
    .map(
      (line) => `
    <tr>
      <td style="padding:6px 0;font-size:13px;overflow-wrap:anywhere;">${htmlValue(line.description)}</td>
      <td style="padding:6px 0;text-align:end;font-size:13px;">${htmlValue(documentHundredths(line.quantity), "ltr")}</td>
      <td style="padding:6px 0;text-align:end;font-size:13px;">${htmlValue(formatMoney(line.unitPrice, doc.currencyCode), "ltr")}</td>
      <td style="padding:6px 0;text-align:end;font-size:13px;">${htmlValue(formatMoney(line.amount, doc.currencyCode), "ltr")}</td>
    </tr>`
    )
    .join("");

  const taxRow =
    template.showTaxBreakdown !== false && doc.taxTotal > 0
      ? `<tr>
          <td colspan="3" style="text-align:end;padding:3px 0;padding-inline-end:6px;color:#6b7280;font-size:12px;border-top:0.5px solid #e5e7eb;">${t("tax")}</td>
          <td style="text-align:end;padding:3px 0;font-size:12px;border-top:0.5px solid #e5e7eb;">${htmlValue(formatMoney(doc.taxTotal, doc.currencyCode), "ltr")}</td>
        </tr>`
      : "";

  const paidRow = cfg.showAmountDue && amountPaid > 0
    ? `<tr>
        <td colspan="3" style="text-align:end;padding:3px 0;padding-inline-end:6px;color:#6b7280;font-size:12px;border-top:0.5px solid #e5e7eb;">${t("amountPaid")}</td>
        <td style="text-align:end;padding:3px 0;font-size:12px;border-top:0.5px solid #e5e7eb;">${htmlValue(formatMoney(amountPaid, doc.currencyCode), "ltr")}</td>
      </tr>`
    : "";

  const amountDueRow = cfg.showAmountDue
    ? `<tr>
        <td colspan="3" style="text-align:end;padding:3px 0;padding-inline-end:6px;font-weight:600;font-size:12px;border-top:0.5px solid #e5e7eb;">${t("amountDue")}</td>
        <td style="text-align:end;padding:3px 0;font-weight:600;font-size:12px;border-top:0.5px solid #e5e7eb;">${htmlValue(formatMoney(amountDue, doc.currencyCode), "ltr")}</td>
      </tr>`
    : "";

  const bankDetailsText = template.bankDetails
    ? replaceTemplatePlaceholders(template.bankDetails, templateVars)
    : "";
  const bankDetailsSection = bankDetailsText
    ? `<div style="margin-top:24px;">
        <p style="font-size:12px;font-weight:600;color:#111827;margin:0 0 4px;">${t("bankDetails")}</p>
        <p style="font-size:12px;color:#6b7280;margin:0;white-space:pre-wrap;">${htmlValue(bankDetailsText)}</p>
      </div>`
    : "";

  const paymentInstructionsText = template.paymentInstructions
    ? replaceTemplatePlaceholders(template.paymentInstructions, templateVars)
    : "";
  const paymentInstructionsSection = paymentInstructionsText
    ? `<div style="margin-top:16px;">
        <p style="font-size:12px;font-weight:600;color:#111827;margin:0 0 4px;">${t("paymentInstructions")}</p>
        <p style="font-size:12px;color:#6b7280;margin:0;white-space:pre-wrap;">${htmlValue(paymentInstructionsText)}</p>
      </div>`
    : "";

  const notesText = template.notes || doc.notes
    ? replaceTemplatePlaceholders(template.notes || doc.notes || "", templateVars)
    : "";
  const notesSection = notesText
    ? `<div style="margin-top:16px;font-size:12px;color:#6b7280;">${htmlValue(notesText)}</div>`
    : "";

  const secondDateRow = cfg.secondDateLabel && doc.secondDate
    ? `<tr>
      <td style="padding:2px 0;padding-inline-end:12px;color:#6b7280;">${cfg.secondDateLabel}</td>
      <td style="padding:2px 0;">${htmlValue(doc.secondDate, "ltr")}</td>
    </tr>`
    : "";

  const dueSummary = cfg.showAmountDue
    ? `<p style="font-size:18px;font-weight:600;margin:0 0 24px;">${htmlValue(formatMoney(amountDue, doc.currencyCode), "ltr")} ${t("due")} ${htmlValue(doc.secondDate || doc.issueDate, "ltr")}</p>`
    : `<p style="font-size:18px;font-weight:600;margin:0 0 24px;">${htmlValue(formatMoney(doc.total, doc.currencyCode), "ltr")}</p>`;

  const footerSummary = cfg.showAmountDue
    ? `${htmlValue(doc.documentNumber, "ltr")} · ${htmlValue(formatMoney(amountDue, doc.currencyCode), "ltr")} ${t("due")} ${htmlValue(doc.secondDate || doc.issueDate, "ltr")}`
    : `${htmlValue(doc.documentNumber, "ltr")} · ${htmlValue(formatMoney(doc.total, doc.currencyCode), "ltr")}`;

  return `<!DOCTYPE html>
<html lang="${template.locale ?? "en-US"}" dir="${template.locale === "fa-IR" ? "rtl" : "ltr"}">
<head><meta charset="utf-8"><title>${docTitle} ${escapeHtml(doc.documentNumber)}</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Inter',sans-serif;margin:0;padding:0;color:#111827;max-width:800px;overflow-wrap:anywhere;text-align:start;">
  <!-- Accent bar -->
  <div style="height:4px;background:${accent};"></div>

  <div style="padding:32px 40px 40px;">
  ${headerHtml}

  <!-- Title -->
  <h1 style="margin:0 0 24px;font-size:22px;font-weight:600;letter-spacing:-0.3px;">${docTitle}</h1>

  <!-- Metadata -->
  <table style="font-size:12px;border-collapse:collapse;margin-bottom:24px;">
    <tr>
      <td style="padding:2px 0;padding-inline-end:12px;font-weight:600;">${cfg.numberLabel}</td>
      <td style="padding:2px 0;font-weight:600;">${htmlValue(doc.documentNumber, "ltr")}</td>
    </tr>
    <tr>
      <td style="padding:2px 0;padding-inline-end:12px;color:#6b7280;">${t("dateIssue")}</td>
      <td style="padding:2px 0;">${htmlValue(doc.issueDate, "ltr")}</td>
    </tr>
    ${secondDateRow}
    ${doc.reference ? `<tr>
      <td style="padding:2px 0;padding-inline-end:12px;color:#6b7280;">${t("reference")}</td>
      <td style="padding:2px 0;">${htmlValue(doc.reference)}</td>
    </tr>` : ""}
  </table>

  <!-- Parties -->
  <div style="display:flex;flex-wrap:wrap;gap:24px 40px;margin-bottom:24px;">
    <div style="width:200px;max-width:100%;min-width:0;">
      <p style="font-size:13px;font-weight:600;margin:0 0 3px;">${htmlValue(org.name)}</p>
      ${org.address ? `<p style="font-size:12px;color:#6b7280;margin:0 0 1px;">${htmlValue(org.address)}</p>` : ""}
      ${org.email ? `<p style="font-size:12px;color:#6b7280;margin:0 0 1px;">${htmlValue(org.email, "ltr")}</p>` : ""}
      ${org.phone ? `<p style="font-size:12px;color:#6b7280;margin:0 0 1px;">${htmlValue(org.phone, "ltr")}</p>` : ""}
      ${org.taxId ? `<p style="font-size:12px;color:#6b7280;margin:0 0 1px;">${taxIdLabel}: ${htmlValue(org.taxId, "ltr")}</p>` : ""}
      ${org.registrationNumber ? `<p style="font-size:12px;color:#6b7280;margin:0;">${t("reg")}: ${htmlValue(org.registrationNumber, "ltr")}</p>` : ""}
    </div>
    <div style="width:200px;max-width:100%;min-width:0;">
      <p style="font-size:13px;font-weight:600;margin:0 0 3px;">${cfg.partyLabel}</p>
      <p style="font-size:12px;color:#6b7280;margin:0 0 1px;">${htmlValue(doc.contactName)}</p>
      ${doc.contactAddress ? `<p style="font-size:12px;color:#6b7280;margin:0 0 1px;">${htmlValue(doc.contactAddress)}</p>` : ""}
      ${doc.contactEmail ? `<p style="font-size:12px;color:#6b7280;margin:0 0 1px;">${htmlValue(doc.contactEmail, "ltr")}</p>` : ""}
      ${doc.contactTaxNumber ? `<p style="font-size:12px;color:#6b7280;margin:0;">${taxIdLabel}: ${htmlValue(doc.contactTaxNumber, "ltr")}</p>` : ""}
    </div>
  </div>

  <!-- Summary headline -->
  ${dueSummary}

  <!-- Line Items -->
  <table style="width:100%;border-collapse:collapse;">
    <thead>
      <tr>
        <th style="padding:6px 0;text-align:start;border-bottom:1px solid #111827;font-size:11px;font-weight:400;color:#6b7280;">${t("description")}</th>
        <th style="padding:6px 0;text-align:end;border-bottom:1px solid #111827;font-size:11px;font-weight:400;color:#6b7280;">${t("qty")}</th>
        <th style="padding:6px 0;text-align:end;border-bottom:1px solid #111827;font-size:11px;font-weight:400;color:#6b7280;">${t("unitPrice")}</th>
        <th style="padding:6px 0;text-align:end;border-bottom:1px solid #111827;font-size:11px;font-weight:400;color:#6b7280;">${t("amount")}</th>
      </tr>
    </thead>
    <tbody>${linesHtml}</tbody>
    <tfoot>
      <tr>
        <td colspan="3" style="text-align:end;padding:3px 0;padding-inline-end:6px;color:#6b7280;font-size:12px;border-top:0.5px solid #e5e7eb;">${t("subtotal")}</td>
        <td style="text-align:end;padding:3px 0;font-size:12px;border-top:0.5px solid #e5e7eb;">${htmlValue(formatMoney(doc.subtotal, doc.currencyCode), "ltr")}</td>
      </tr>
      ${taxRow}
      <tr>
        <td colspan="3" style="text-align:end;padding:3px 0;padding-inline-end:6px;color:#6b7280;font-size:12px;border-top:0.5px solid #e5e7eb;">${t("total")}</td>
        <td style="text-align:end;padding:3px 0;font-size:12px;border-top:0.5px solid #e5e7eb;">${htmlValue(formatMoney(doc.total, doc.currencyCode), "ltr")}</td>
      </tr>
      ${paidRow}
      ${amountDueRow}
    </tfoot>
  </table>

  ${bankDetailsSection}
  ${paymentInstructionsSection}
  ${notesSection}
  ${footerHtml}

  <!-- Footer -->
  <div style="margin-top:40px;padding-top:8px;border-top:0.5px solid #e5e7eb;display:flex;flex-wrap:wrap;gap:8px;justify-content:space-between;align-items:center;">
    <span style="font-size:10px;color:#6b7280;">${footerSummary}</span>
    <a href="https://dubbl.dev" style="text-decoration:none;display:inline-flex;align-items:center;gap:4px;">
      <svg viewBox="0 0 40 32" fill="none" xmlns="http://www.w3.org/2000/svg" width="12" height="9">
        <path d="M18 4h8a10 10 0 0 1 10 10v4a10 10 0 0 1-10 10h-8V4z" fill="#d1d5db"/>
        <path d="M4 4h8a10 10 0 0 1 10 10v4a10 10 0 0 1-10 10H4V4z" fill="#9ca3af"/>
      </svg>
      <span style="font-size:9px;color:#d1d5db;letter-spacing:0.5px;">dubbl</span>
    </a>
  </div>
  </div>
</body>
</html>`;
}

export function generateQuoteHtml(doc: DocumentData, org: OrgInfo, template: TemplateSettings): string {
  return generateDocumentHtml("quote", doc, org, template);
}

export function generateCreditNoteHtml(doc: DocumentData, org: OrgInfo, template: TemplateSettings): string {
  return generateDocumentHtml("credit_note", doc, org, template);
}

export function generatePurchaseOrderHtml(doc: DocumentData, org: OrgInfo, template: TemplateSettings): string {
  return generateDocumentHtml("purchase_order", doc, org, template);
}

export function generateDebitNoteHtml(doc: DocumentData, org: OrgInfo, template: TemplateSettings): string {
  return generateDocumentHtml("debit_note", doc, org, template);
}

function htmlValue(value: string, dir: "auto" | "ltr" = "auto"): string {
  return `<bdi dir="${dir}" style="unicode-bidi:isolate;overflow-wrap:anywhere;">${escapeHtml(value)}</bdi>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function replaceTemplatePlaceholders(
  text: string,
  vars: Record<string, string>
): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => vars[key] ?? match);
}

export function generateInvoiceHtml(
  invoice: InvoiceData,
  org: OrgInfo,
  template: TemplateSettings
): string {
  const t = outputTranslator(template.locale);
  invoice = documentRenderDto(invoice);
  const accent = template.accentColor || "#10b981";
  const taxIdLabel = getTaxIdLabel(t, org.countryCode);
  const invoiceTitle = getInvoiceTitle(t, org.countryCode, !!org.taxId);
  const amountPaid = invoice.amountPaid ?? 0;
  const amountDue = invoice.amountDue ?? invoice.total;

  const templateVars: Record<string, string> = {
    orgName: org.name,
    orgAddress: org.address || "",
    orgTaxId: org.taxId || "",
    orgPhone: org.phone || "",
    orgEmail: org.email || "",
    orgRegistrationNumber: org.registrationNumber || "",
    invoiceNumber: invoice.invoiceNumber,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    contactName: invoice.contactName,
    contactEmail: invoice.contactEmail || "",
    contactAddress: invoice.contactAddress || "",
    contactTaxNumber: invoice.contactTaxNumber || "",
    reference: invoice.reference || "",
    subtotal: formatMoney(invoice.subtotal, invoice.currencyCode),
    taxTotal: formatMoney(invoice.taxTotal, invoice.currencyCode),
    total: formatMoney(invoice.total, invoice.currencyCode),
    currency: invoice.currencyCode,
  };

  const headerHtml = template.headerHtml
    ? replaceTemplatePlaceholders(template.headerHtml, templateVars)
    : "";
  const footerHtml = template.footerHtml
    ? replaceTemplatePlaceholders(template.footerHtml, templateVars)
    : "";

  const linesHtml = invoice.lines
    .map(
      (line) => `
    <tr>
      <td style="padding:6px 0;font-size:13px;overflow-wrap:anywhere;">${htmlValue(line.description)}</td>
      <td style="padding:6px 0;text-align:end;font-size:13px;">${htmlValue(documentHundredths(line.quantity), "ltr")}</td>
      <td style="padding:6px 0;text-align:end;font-size:13px;">${htmlValue(formatMoney(line.unitPrice, invoice.currencyCode), "ltr")}</td>
      <td style="padding:6px 0;text-align:end;font-size:13px;">${htmlValue(formatMoney(line.amount, invoice.currencyCode), "ltr")}</td>
    </tr>`
    )
    .join("");

  const taxRow =
    template.showTaxBreakdown !== false && invoice.taxTotal > 0
      ? `<tr>
          <td colspan="3" style="text-align:end;padding:3px 0;padding-inline-end:6px;color:#6b7280;font-size:12px;border-top:0.5px solid #e5e7eb;">${t("tax")}</td>
          <td style="text-align:end;padding:3px 0;font-size:12px;border-top:0.5px solid #e5e7eb;">${htmlValue(formatMoney(invoice.taxTotal, invoice.currencyCode), "ltr")}</td>
        </tr>`
      : "";

  const paidRow = amountPaid > 0
    ? `<tr>
        <td colspan="3" style="text-align:end;padding:3px 0;padding-inline-end:6px;color:#6b7280;font-size:12px;border-top:0.5px solid #e5e7eb;">${t("amountPaid")}</td>
        <td style="text-align:end;padding:3px 0;font-size:12px;border-top:0.5px solid #e5e7eb;">${htmlValue(formatMoney(amountPaid, invoice.currencyCode), "ltr")}</td>
      </tr>`
    : "";

  const bankDetailsText = template.bankDetails
    ? replaceTemplatePlaceholders(template.bankDetails, templateVars)
    : "";
  const bankDetailsSection = bankDetailsText
    ? `<div style="margin-top:24px;">
        <p style="font-size:12px;font-weight:600;color:#111827;margin:0 0 4px;">${t("bankDetails")}</p>
        <p style="font-size:12px;color:#6b7280;margin:0;white-space:pre-wrap;">${htmlValue(bankDetailsText)}</p>
      </div>`
    : "";

  const paymentInstructionsText = template.paymentInstructions
    ? replaceTemplatePlaceholders(template.paymentInstructions, templateVars)
    : "";
  const paymentInstructionsSection = paymentInstructionsText
    ? `<div style="margin-top:16px;">
        <p style="font-size:12px;font-weight:600;color:#111827;margin:0 0 4px;">${t("paymentInstructions")}</p>
        <p style="font-size:12px;color:#6b7280;margin:0;white-space:pre-wrap;">${htmlValue(paymentInstructionsText)}</p>
      </div>`
    : "";

  const notesText = template.notes || invoice.notes
    ? replaceTemplatePlaceholders(template.notes || invoice.notes || "", templateVars)
    : "";
  const notesSection = notesText
    ? `<div style="margin-top:16px;font-size:12px;color:#6b7280;">${htmlValue(notesText)}</div>`
    : "";

  return `<!DOCTYPE html>
<html lang="${template.locale ?? "en-US"}" dir="${template.locale === "fa-IR" ? "rtl" : "ltr"}">
<head><meta charset="utf-8"><title>${t("invoice")} ${escapeHtml(invoice.invoiceNumber)}</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Inter',sans-serif;margin:0;padding:0;color:#111827;max-width:800px;overflow-wrap:anywhere;text-align:start;">
  <!-- Accent bar -->
  <div style="height:4px;background:${accent};"></div>

  <div style="padding:32px 40px 40px;">
  ${headerHtml}

  <!-- Title -->
  <h1 style="margin:0 0 24px;font-size:22px;font-weight:600;letter-spacing:-0.3px;">${invoiceTitle}</h1>

  <!-- Metadata -->
  <table style="font-size:12px;border-collapse:collapse;margin-bottom:24px;">
    <tr>
      <td style="padding:2px 0;padding-inline-end:12px;font-weight:600;">${t("invoiceNumber")}</td>
      <td style="padding:2px 0;font-weight:600;">${htmlValue(invoice.invoiceNumber, "ltr")}</td>
    </tr>
    <tr>
      <td style="padding:2px 0;padding-inline-end:12px;color:#6b7280;">${t("dateIssue")}</td>
      <td style="padding:2px 0;">${htmlValue(invoice.issueDate, "ltr")}</td>
    </tr>
    <tr>
      <td style="padding:2px 0;padding-inline-end:12px;color:#6b7280;">${t("dateDue")}</td>
      <td style="padding:2px 0;">${htmlValue(invoice.dueDate, "ltr")}</td>
    </tr>
    ${invoice.reference ? `<tr>
      <td style="padding:2px 0;padding-inline-end:12px;color:#6b7280;">${t("reference")}</td>
      <td style="padding:2px 0;">${htmlValue(invoice.reference)}</td>
    </tr>` : ""}
  </table>

  <!-- Seller / Buyer -->
  <div style="display:flex;flex-wrap:wrap;gap:24px 40px;margin-bottom:24px;">
    <div style="width:200px;max-width:100%;min-width:0;">
      <p style="font-size:13px;font-weight:600;margin:0 0 3px;">${htmlValue(org.name)}</p>
      ${org.address ? `<p style="font-size:12px;color:#6b7280;margin:0 0 1px;">${htmlValue(org.address)}</p>` : ""}
      ${org.email ? `<p style="font-size:12px;color:#6b7280;margin:0 0 1px;">${htmlValue(org.email, "ltr")}</p>` : ""}
      ${org.phone ? `<p style="font-size:12px;color:#6b7280;margin:0 0 1px;">${htmlValue(org.phone, "ltr")}</p>` : ""}
      ${org.taxId ? `<p style="font-size:12px;color:#6b7280;margin:0 0 1px;">${taxIdLabel}: ${htmlValue(org.taxId, "ltr")}</p>` : ""}
      ${org.registrationNumber ? `<p style="font-size:12px;color:#6b7280;margin:0;">${t("reg")}: ${htmlValue(org.registrationNumber, "ltr")}</p>` : ""}
    </div>
    <div style="width:200px;max-width:100%;min-width:0;">
      <p style="font-size:13px;font-weight:600;margin:0 0 3px;">${t("billTo")}</p>
      <p style="font-size:12px;color:#6b7280;margin:0 0 1px;">${htmlValue(invoice.contactName)}</p>
      ${invoice.contactAddress ? `<p style="font-size:12px;color:#6b7280;margin:0 0 1px;">${htmlValue(invoice.contactAddress)}</p>` : ""}
      ${invoice.contactEmail ? `<p style="font-size:12px;color:#6b7280;margin:0 0 1px;">${htmlValue(invoice.contactEmail, "ltr")}</p>` : ""}
      ${invoice.contactTaxNumber ? `<p style="font-size:12px;color:#6b7280;margin:0;">${taxIdLabel}: ${htmlValue(invoice.contactTaxNumber, "ltr")}</p>` : ""}
    </div>
  </div>

  <!-- Due amount summary -->
  <p style="font-size:18px;font-weight:600;margin:0 0 24px;">${htmlValue(formatMoney(amountDue, invoice.currencyCode), "ltr")} ${t("due")} ${htmlValue(invoice.dueDate, "ltr")}</p>

  <!-- Line Items -->
  <table style="width:100%;border-collapse:collapse;">
    <thead>
      <tr>
        <th style="padding:6px 0;text-align:start;border-bottom:1px solid #111827;font-size:11px;font-weight:400;color:#6b7280;">${t("description")}</th>
        <th style="padding:6px 0;text-align:end;border-bottom:1px solid #111827;font-size:11px;font-weight:400;color:#6b7280;">${t("qty")}</th>
        <th style="padding:6px 0;text-align:end;border-bottom:1px solid #111827;font-size:11px;font-weight:400;color:#6b7280;">${t("unitPrice")}</th>
        <th style="padding:6px 0;text-align:end;border-bottom:1px solid #111827;font-size:11px;font-weight:400;color:#6b7280;">${t("amount")}</th>
      </tr>
    </thead>
    <tbody>${linesHtml}</tbody>
    <tfoot>
      <tr>
        <td colspan="3" style="text-align:end;padding:3px 0;padding-inline-end:6px;color:#6b7280;font-size:12px;border-top:0.5px solid #e5e7eb;">${t("subtotal")}</td>
        <td style="text-align:end;padding:3px 0;font-size:12px;border-top:0.5px solid #e5e7eb;">${htmlValue(formatMoney(invoice.subtotal, invoice.currencyCode), "ltr")}</td>
      </tr>
      ${taxRow}
      <tr>
        <td colspan="3" style="text-align:end;padding:3px 0;padding-inline-end:6px;color:#6b7280;font-size:12px;border-top:0.5px solid #e5e7eb;">${t("total")}</td>
        <td style="text-align:end;padding:3px 0;font-size:12px;border-top:0.5px solid #e5e7eb;">${htmlValue(formatMoney(invoice.total, invoice.currencyCode), "ltr")}</td>
      </tr>
      ${paidRow}
      <tr>
        <td colspan="3" style="text-align:end;padding:3px 0;padding-inline-end:6px;font-weight:600;font-size:12px;border-top:0.5px solid #e5e7eb;">${t("amountDue")}</td>
        <td style="text-align:end;padding:3px 0;font-weight:600;font-size:12px;border-top:0.5px solid #e5e7eb;">${htmlValue(formatMoney(amountDue, invoice.currencyCode), "ltr")}</td>
      </tr>
    </tfoot>
  </table>

  ${bankDetailsSection}
  ${paymentInstructionsSection}
  ${notesSection}
  ${footerHtml}

  <!-- Footer -->
  <div style="margin-top:40px;padding-top:8px;border-top:0.5px solid #e5e7eb;display:flex;flex-wrap:wrap;gap:8px;justify-content:space-between;align-items:center;">
    <span style="font-size:10px;color:#6b7280;">${htmlValue(invoice.invoiceNumber, "ltr")} · ${htmlValue(formatMoney(amountDue, invoice.currencyCode), "ltr")} ${t("due")} ${htmlValue(invoice.dueDate, "ltr")}</span>
    <a href="https://dubbl.dev" style="text-decoration:none;display:inline-flex;align-items:center;gap:4px;">
      <svg viewBox="0 0 40 32" fill="none" xmlns="http://www.w3.org/2000/svg" width="12" height="9">
        <path d="M18 4h8a10 10 0 0 1 10 10v4a10 10 0 0 1-10 10h-8V4z" fill="#d1d5db"/>
        <path d="M4 4h8a10 10 0 0 1 10 10v4a10 10 0 0 1-10 10H4V4z" fill="#9ca3af"/>
      </svg>
      <span style="font-size:9px;color:#d1d5db;letter-spacing:0.5px;">dubbl</span>
    </a>
  </div>
  </div>
</body>
</html>`;
}
