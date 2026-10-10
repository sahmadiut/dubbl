import { money, toMajorDecimal } from "@/lib/money/exact";
import { WireCompatibilityError } from "@/lib/money/wire";

interface UblParty {
  name: string;
  taxId?: string | null;
  peppolId?: string | null;
  peppolScheme?: string | null;
  street?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
  email?: string | null;
  phone?: string | null;
}

interface UblLine {
  id: number;
  description: string;
  quantity: number; // already divided by 100
  unitPrice: number; // currency minor units
  lineAmount: number; // currency minor units
  taxAmount: number; // currency minor units
  taxPercent: number; // e.g. 10.00
  taxName?: string;
}

export interface UblInvoiceData {
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  currencyCode: string;
  supplier: UblParty;
  customer: UblParty;
  lines: UblLine[];
  subtotal: number; // currency minor units
  taxTotal: number; // currency minor units
  total: number; // currency minor units
  notes?: string | null;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function decimal(amount: number, currency: string): string {
  if (!Number.isSafeInteger(amount)) throw new WireCompatibilityError();
  return toMajorDecimal(money(BigInt(amount), currency));
}

function partyXml(tag: string, party: UblParty): string {
  const endpointId = party.peppolId
    ? `    <cbc:EndpointID schemeID="${escapeXml(party.peppolScheme || "0088")}">${escapeXml(party.peppolId)}</cbc:EndpointID>\n`
    : "";

  return `  <cac:${tag}>
    <cac:Party>
${endpointId}      <cac:PartyName>
        <cbc:Name>${escapeXml(party.name)}</cbc:Name>
      </cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>${escapeXml(party.street || "")}</cbc:StreetName>
        <cbc:CityName>${escapeXml(party.city || "")}</cbc:CityName>
        <cbc:PostalZone>${escapeXml(party.postalCode || "")}</cbc:PostalZone>
        <cbc:CountrySubentity>${escapeXml(party.state || "")}</cbc:CountrySubentity>
        <cac:Country>
          <cbc:IdentificationCode>${escapeXml(party.country || "")}</cbc:IdentificationCode>
        </cac:Country>
      </cac:PostalAddress>${
        party.taxId
          ? `
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${escapeXml(party.taxId)}</cbc:CompanyID>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:PartyTaxScheme>`
          : ""
      }
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${escapeXml(party.name)}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
${party.email ? `      <cac:Contact>\n        <cbc:ElectronicMail>${escapeXml(party.email)}</cbc:ElectronicMail>\n      </cac:Contact>\n` : ""}    </cac:Party>
  </cac:${tag}>`;
}

export function generateUblXml(data: UblInvoiceData): string {
  const minor = (amount: number) => decimal(amount, data.currencyCode);
  // Validate all named money before formatting; never recover a rounded Number.
  [data.subtotal, data.taxTotal, data.total, ...data.lines.flatMap(line => [line.unitPrice, line.lineAmount, line.taxAmount])].forEach(minor);
  const percent = data.taxTotal > 0 && data.subtotal > 0
    ? (BigInt(data.taxTotal) * 10000n * 2n + BigInt(data.subtotal)) / (BigInt(data.subtotal) * 2n) : 0n;
  const taxPercent = `${percent / 100n}.${String(percent % 100n).padStart(2, "0")}`;
  const linesXml = data.lines
    .map(
      (line) => `  <cac:InvoiceLine>
    <cbc:ID>${line.id}</cbc:ID>
    <cbc:InvoicedQuantity unitCode="EA">${line.quantity.toFixed(2)}</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="${data.currencyCode}">${minor(line.lineAmount)}</cbc:LineExtensionAmount>
    <cac:Item>
      <cbc:Description>${escapeXml(line.description)}</cbc:Description>
      <cac:ClassifiedTaxCategory>
        <cbc:ID>S</cbc:ID>
        <cbc:Percent>${line.taxPercent.toFixed(2)}</cbc:Percent>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:ClassifiedTaxCategory>
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="${data.currencyCode}">${minor(line.unitPrice)}</cbc:PriceAmount>
    </cac:Price>
  </cac:InvoiceLine>`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0</cbc:CustomizationID>
  <cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>
  <cbc:ID>${escapeXml(data.invoiceNumber)}</cbc:ID>
  <cbc:IssueDate>${data.issueDate}</cbc:IssueDate>
  <cbc:DueDate>${data.dueDate}</cbc:DueDate>
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
${data.notes ? `  <cbc:Note>${escapeXml(data.notes)}</cbc:Note>\n` : ""}  <cbc:DocumentCurrencyCode>${data.currencyCode}</cbc:DocumentCurrencyCode>
${partyXml("AccountingSupplierParty", data.supplier)}
${partyXml("AccountingCustomerParty", data.customer)}
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="${data.currencyCode}">${minor(data.taxTotal)}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="${data.currencyCode}">${minor(data.subtotal)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="${data.currencyCode}">${minor(data.taxTotal)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>S</cbc:ID>
        <cbc:Percent>${taxPercent}</cbc:Percent>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="${data.currencyCode}">${minor(data.subtotal)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="${data.currencyCode}">${minor(data.subtotal)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="${data.currencyCode}">${minor(data.total)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="${data.currencyCode}">${minor(data.total)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
${linesXml}
</Invoice>`;
}

export interface UblValidationError {
  field: string;
  message: string;
}

export function validateUblData(data: UblInvoiceData): UblValidationError[] {
  const errors: UblValidationError[] = [];

  if (!data.supplier.name) errors.push({ field: "supplier.name", message: "Supplier name is required" });
  if (!data.supplier.country) errors.push({ field: "supplier.country", message: "Supplier country is required" });
  if (!data.customer.name) errors.push({ field: "customer.name", message: "Customer name is required" });
  if (!data.customer.country) errors.push({ field: "customer.country", message: "Customer country is required" });
  if (data.lines.length === 0) errors.push({ field: "lines", message: "At least one line item is required" });

  return errors;
}
