import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { invoice, quote, creditNote, purchaseOrder, debitNote, organization, documentTemplate } from "@/lib/db/schema";
import { AuthError, type AuthContext } from "@/lib/api/auth-context";
import { requireRole } from "@/lib/api/require-role";
import { invoiceSnapshotDto, parseInvoiceSnapshotJson } from "@/lib/api/invoice-snapshot-wire";
import { getPortalAccess } from "@/lib/api/public-portal";
import { WireCompatibilityError } from "@/lib/money/wire";
import { generateDocumentHtml, generateInvoiceHtml, type DocumentData, type DocumentKind } from "./pdf-generator";
import { renderInvoicePdf } from "./pdf-renderer";
import { formatContactAddress } from "./snapshots";
import { documentRenderDto, renderFormat, renderId } from "./render-wire";

const labels = {
  invoice: undefined,
  quote: { title: "Quote", numberLabel: "Quote number", partyLabel: "Quote for", amountLabel: "Total", dateLabel: "Valid until", summaryNoun: "valid until" },
  credit_note: { title: "Credit Note", numberLabel: "Credit note number", partyLabel: "Credit to", amountLabel: "Credit total", dateLabel: null, summaryNoun: null },
  purchase_order: { title: "Purchase Order", numberLabel: "PO number", partyLabel: "Supplier", amountLabel: "Order total", dateLabel: "Delivery date", summaryNoun: null },
  debit_note: { title: "Debit Note", numberLabel: "Debit note number", partyLabel: "Supplier", amountLabel: "Debit total", dateLabel: null, summaryNoun: null },
};
function partyText(snapshot: Record<string, unknown> | null, key: string, fallback: string | null) {
  if (!snapshot || !(key in snapshot)) return fallback;
  const value = snapshot[key];
  if (value !== null && typeof value !== "string") throw new WireCompatibilityError("Unsupported saved document party text");
  return value;
}
function orgInfo(org: typeof organization.$inferSelect) {
  return { name: org.name, address: [org.addressStreet, org.addressCity, org.addressState, org.addressPostalCode, org.addressCountry].filter(Boolean).join(", ") || null,
    taxId: org.taxId, registrationNumber: org.businessRegistrationNumber, phone: org.contactPhone, email: org.contactEmail, countryCode: org.countryCode };
}
async function output(kind: DocumentKind, data: DocumentData, org: ReturnType<typeof orgInfo>, template: typeof documentTemplate.$inferSelect | object, format: "html" | "pdf") {
  const document = documentRenderDto(data);
  const filename = `${kind.replaceAll("_", "-")}-${data.documentNumber.replace(/[^\w.-]/g, "_")}.${format}`;
  if (format === "html") return { format, filename, contentType: "text/html; charset=utf-8", document,
    content: kind === "invoice" ? generateInvoiceHtml({ ...document, invoiceNumber: data.documentNumber, dueDate: data.secondDate || data.issueDate, status: "" }, org, template)
      : generateDocumentHtml(kind, document, org, template) };
  const pdf = await renderInvoicePdf({ ...document, invoiceNumber: data.documentNumber, dueDate: data.secondDate || data.issueDate }, org,
    { name: data.contactName, email: data.contactEmail, address: data.contactAddress, taxNumber: data.contactTaxNumber }, template,
    labels[kind] ? { ...labels[kind], dateLabel: data.secondDate ? labels[kind]!.dateLabel : null,
      summaryNoun: data.secondDate ? labels[kind]!.summaryNoun : null } : undefined);
  return { format, filename, contentType: "application/pdf", document, content: Buffer.from(pdf).toString("base64") };
}

type Capability = { type: "portal"; token: string } | { type: "pay"; token: string };
/** One read-only snapshot for ownership, references, saved parties, money and rendering. */
export async function renderDocument(ctx: AuthContext | null, kind: DocumentKind, id: string, format: "html" | "pdf", capability?: Capability) {
  renderFormat.parse(format);
  if (ctx) requireRole(ctx, "view:data");
  else if (!capability) throw new AuthError("Not authenticated", 401);
  if (!capability || capability.type === "portal") renderId.parse(id);
  if (capability && kind !== "invoice") throw new AuthError("Invalid rendering capability", 403);
  const access = capability?.type === "portal" ? await getPortalAccess(capability.token, ctx?.organizationId, 404) : null;
  return db.transaction(async tx => {
    const orgId = access?.organizationId ?? ctx?.organizationId;
    const invoiceScope = and(isNull(invoice.deletedAt), orgId ? eq(invoice.organizationId, orgId) : undefined,
      capability?.type === "pay" ? eq(invoice.paymentLinkToken, capability.token) : eq(invoice.id, id),
      access ? eq(invoice.contactId, access.contactId) : undefined);
    const found = kind === "invoice" ? await tx.query.invoice.findFirst({ where: invoiceScope, with: { lines: true, contact: true } })
      : kind === "quote" ? await tx.query.quote.findFirst({ where: and(eq(quote.id, id), eq(quote.organizationId, orgId!), isNull(quote.deletedAt)), with: { lines: true, contact: true } })
      : kind === "credit_note" ? await tx.query.creditNote.findFirst({ where: and(eq(creditNote.id, id), eq(creditNote.organizationId, orgId!), isNull(creditNote.deletedAt)), with: { lines: true, contact: true } })
      : kind === "purchase_order" ? await tx.query.purchaseOrder.findFirst({ where: and(eq(purchaseOrder.id, id), eq(purchaseOrder.organizationId, orgId!), isNull(purchaseOrder.deletedAt)), with: { lines: true, contact: true } })
      : await tx.query.debitNote.findFirst({ where: and(eq(debitNote.id, id), eq(debitNote.organizationId, orgId!), isNull(debitNote.deletedAt)), with: { lines: true, contact: true } });
    if (!found || !found.contact || found.contact.organizationId !== found.organizationId || found.contact.deletedAt) throw new AuthError("Document not found", 404);
    if (capability?.type === "pay" && ["draft", "void"].includes(found.status)) throw new AuthError("Invoice is not payable", 400);
    const org = await tx.query.organization.findFirst({ where: and(eq(organization.id, found.organizationId), isNull(organization.deletedAt)) });
    if (!org) throw new AuthError("Organization not found", 404);
    const templateType = kind === "quote" ? "quote" : ["purchase_order", "debit_note"].includes(kind) ? "purchase_order" : "invoice";
    const template = await tx.query.documentTemplate.findFirst({ where: and(eq(documentTemplate.organizationId, found.organizationId),
      eq(documentTemplate.type, templateType), eq(documentTemplate.isDefault, true), isNull(documentTemplate.deletedAt)) });
    const [raw] = kind === "invoice" ? await tx.select({ sender: sql<string | null>`${invoice.senderSnapshot}::text`,
      recipient: sql<string | null>`${invoice.recipientSnapshot}::text` }).from(invoice).where(and(eq(invoice.id, found.id), eq(invoice.organizationId, found.organizationId))) : [];
    const saved = raw ? invoiceSnapshotDto({ senderSnapshot: parseInvoiceSnapshotJson(raw.sender), recipientSnapshot: parseInvoiceSnapshotJson(raw.recipient) }) : { sender: null, recipient: null };
    const liveOrg = orgInfo(org);
    const sender = { ...liveOrg };
    for (const key of Object.keys(sender) as (keyof typeof sender)[]) sender[key] = partyText(saved.sender, key, sender[key])!;
    sender.name = sender.name ?? "Company";
    const documentNumber = "invoiceNumber" in found ? found.invoiceNumber : "quoteNumber" in found ? found.quoteNumber
      : "creditNoteNumber" in found ? found.creditNoteNumber : "poNumber" in found ? found.poNumber : found.debitNoteNumber;
    const secondDate = "dueDate" in found ? found.dueDate : "expiryDate" in found ? found.expiryDate : "deliveryDate" in found ? found.deliveryDate : null;
    const data: DocumentData = { documentNumber, issueDate: found.issueDate, secondDate,
      contactName: partyText(saved.recipient, "name", found.contact.name) ?? "Unknown",
      contactEmail: partyText(saved.recipient, "email", found.contact.email),
      contactAddress: partyText(saved.recipient, "address", formatContactAddress(found.contact.addresses as Parameters<typeof formatContactAddress>[0])),
      contactTaxNumber: partyText(saved.recipient, "taxNumber", found.contact.taxNumber),
      lines: found.lines.map(line => ({ description: line.description, quantity: line.quantity, unitPrice: line.unitPrice, taxAmount: line.taxAmount, amount: line.amount })),
      subtotal: found.subtotal, taxTotal: found.taxTotal, total: found.total, currencyCode: found.currencyCode,
      ...("amountPaid" in found ? { amountPaid: found.amountPaid, amountDue: found.amountDue } : {}), reference: found.reference, notes: found.notes };
    return output(kind, data, sender, template ?? {}, format);
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}

export async function previewDocumentTemplate(ctx: AuthContext, id: string, format: "html" | "pdf") {
  requireRole(ctx, "manage:invoices"); renderId.parse(id); renderFormat.parse(format);
  return db.transaction(async tx => {
    const template = await tx.query.documentTemplate.findFirst({ where: and(eq(documentTemplate.id, id), eq(documentTemplate.organizationId, ctx.organizationId), isNull(documentTemplate.deletedAt)) });
    const org = await tx.query.organization.findFirst({ where: and(eq(organization.id, ctx.organizationId), isNull(organization.deletedAt)) });
    if (!template || !org) throw new AuthError("Template not found", 404);
    return output(template.type === "quote" ? "quote" : template.type === "purchase_order" ? "purchase_order" : "invoice", {
      documentNumber: "INV-0001", issueDate: "2026-03-10", secondDate: "2026-04-09", contactName: "Sample Customer",
      contactEmail: "customer@example.com", contactAddress: "123 Main St", contactTaxNumber: "US123456789",
      lines: [{ description: "Web Development Services", quantity: 100, unitPrice: 15000, taxAmount: 1500, amount: 15000 },
        { description: "UI/UX Design", quantity: 200, unitPrice: 7500, taxAmount: 1500, amount: 15000 }],
      subtotal: 30000, taxTotal: 3000, total: 33000, amountPaid: 0, amountDue: 33000, currencyCode: org.defaultCurrency,
      reference: "PO-123", notes: null }, orgInfo(org), template, format);
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}

export function renderResponse(result: Awaited<ReturnType<typeof renderDocument>>) {
  return new Response(result.format === "pdf" ? new Uint8Array(Buffer.from(result.content, "base64")) : result.content,
    { headers: { "Content-Type": result.contentType, ...(result.format === "pdf" ? { "Content-Disposition": `attachment; filename="${result.filename}"` } : {}) } });
}
