import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { invoice, portalAccessToken, portalActivityLog, quote } from "@/lib/db/schema";
import { AuthError } from "./auth-context";
import { publicLineDto, publicMoneyDto, publicStatementDto } from "./public-money-wire";
import { legacyMinor, stringifyWire } from "@/lib/money/wire";

/** Tokens grant a single contact in one organization; MCP adds its authenticated organization predicate. */
export async function getPortalAccess(token: string, organizationId?: string, invalidStatus = 401) {
  const access = await db.query.portalAccessToken.findFirst({
    where: and(eq(portalAccessToken.token, token), isNull(portalAccessToken.revokedAt),
      organizationId ? eq(portalAccessToken.organizationId, organizationId) : undefined),
    with: {
      contact: { columns: { id: true, name: true, email: true, currencyCode: true, organizationId: true, deletedAt: true } },
      organization: { columns: { name: true, defaultCurrency: true, deletedAt: true } },
    },
  });
  if (!access || access.contact.organizationId !== access.organizationId || access.contact.deletedAt || access.organization.deletedAt) {
    throw new AuthError("Invalid or expired token", invalidStatus);
  }
  if (access.expiresAt && access.expiresAt <= new Date()) {
    throw new AuthError("Portal link has expired", invalidStatus === 404 ? 410 : invalidStatus);
  }
  return access;
}
export type PortalAccess = Awaited<ReturnType<typeof getPortalAccess>>;

export function portalIdentity(access: PortalAccess) {
  return { contact: { id: access.contact.id, name: access.contact.name, email: access.contact.email }, organization: { name: access.organization.name } };
}

export async function getPaymentLink(token: string, organizationId?: string) {
  const inv = await db.query.invoice.findFirst({
    where: and(eq(invoice.paymentLinkToken, token), isNull(invoice.deletedAt),
      organizationId ? eq(invoice.organizationId, organizationId) : undefined),
    with: {
      organization: { columns: { name: true } },
      contact: { columns: { name: true, organizationId: true, deletedAt: true } }, lines: true,
    },
  });
  if (!inv || inv.contact.organizationId !== inv.organizationId || inv.contact.deletedAt) {
    throw new AuthError("Invalid payment link", 404);
  }
  if (inv.status === "paid") return { status: "paid", invoice: { invoiceNumber: inv.invoiceNumber } };
  if (inv.status === "void" || inv.status === "draft") throw new AuthError("Invoice is not payable", 400);
  return {
    status: "pending",
    invoice: {
      ...publicMoneyDto({ id: inv.id, invoiceNumber: inv.invoiceNumber, issueDate: inv.issueDate,
        dueDate: inv.dueDate, total: inv.total, amountDue: inv.amountDue, currencyCode: inv.currencyCode }, ["total", "amountDue"]),
      lines: inv.lines.map(l => {
        const line = publicLineDto({ description: l.description, quantity: l.quantity,
          unitPrice: l.unitPrice, amount: l.amount, taxAmount: l.taxAmount });
        // The public payment page displays amount + tax; reject an unsupported
        // derived display before returning a successful summary.
        legacyMinor(BigInt(line.amountMinor) + BigInt(line.taxAmountMinor));
        return line;
      }),
    },
    organization: { name: inv.organization.name }, contact: { name: inv.contact.name },
  };
}

export async function getPortalInvoices(access: PortalAccess, ipAddress: string | null = null) {
  const invoices = await db.query.invoice.findMany({
    where: and(eq(invoice.organizationId, access.organizationId), eq(invoice.contactId, access.contactId), isNull(invoice.deletedAt)),
    orderBy: desc(invoice.createdAt),
  });
  const result = { data: invoices.map(inv => publicMoneyDto({ id: inv.id, invoiceNumber: inv.invoiceNumber,
    issueDate: inv.issueDate, dueDate: inv.dueDate, status: inv.status, total: inv.total, amountDue: inv.amountDue,
    currencyCode: inv.currencyCode, paymentLinkToken: inv.paymentLinkToken }, ["total", "amountDue"])) };
  // Monetary/serialization preflight precedes the activity mutation.
  stringifyWire(result);
  await db.insert(portalActivityLog).values({ tokenId: access.id, action: "view_invoices", ipAddress });
  return result;
}

export async function getPortalPayments(access: PortalAccess) {
  const invoices = await db.query.invoice.findMany({
    where: and(eq(invoice.organizationId, access.organizationId), eq(invoice.contactId, access.contactId),
      gt(invoice.amountPaid, 0), isNull(invoice.deletedAt)), orderBy: desc(invoice.paidAt),
  });
  return { data: invoices.map(inv => publicMoneyDto({ invoiceNumber: inv.invoiceNumber, invoiceId: inv.id,
    amountPaid: inv.amountPaid, total: inv.total, paidAt: inv.paidAt, status: inv.status,
    currencyCode: inv.currencyCode }, ["amountPaid", "total"])) };
}

export async function getPortalQuotes(access: PortalAccess) {
  const quotes = await db.query.quote.findMany({
    where: and(eq(quote.organizationId, access.organizationId), eq(quote.contactId, access.contactId), isNull(quote.deletedAt)),
    orderBy: desc(quote.issueDate), with: { lines: true },
  });
  return { data: quotes.map(q => ({ ...publicMoneyDto(q, ["subtotal", "taxTotal", "total", "billedTotal"]), lines: q.lines.map(publicLineDto) })) };
}

export async function getPortalStatement(access: PortalAccess) {
  const invoices = await db.query.invoice.findMany({
    where: and(eq(invoice.organizationId, access.organizationId), eq(invoice.contactId, access.contactId), isNull(invoice.deletedAt)),
    orderBy: desc(invoice.issueDate),
  });
  return { contact: { id: access.contactId, name: access.contact.name }, organization: { name: access.organization.name },
    ...publicStatementDto(invoices, invoices[0]?.currencyCode ?? access.contact.currencyCode ?? access.organization.defaultCurrency) };
}

export async function acceptPortalQuote(access: PortalAccess, id: string, ipAddress: string | null = null) {
  return db.transaction(async tx => {
    const scope = and(eq(quote.id, id), eq(quote.organizationId, access.organizationId),
      eq(quote.contactId, access.contactId), eq(quote.status, "sent"), isNull(quote.deletedAt));
    const [existing] = await tx.select().from(quote).where(scope).for("update");
    if (!existing) throw new AuthError("Quote not found or not in sent status", 404);
    if (existing.expiryDate < new Date().toISOString().slice(0, 10)) throw new AuthError("This quote has expired", 400);
    // Validate the complete returned monetary row before the status/activity writes.
    stringifyWire(publicMoneyDto(existing, ["subtotal", "taxTotal", "total", "billedTotal"]));
    const [updated] = await tx.update(quote).set({ status: "accepted", updatedAt: new Date() }).where(scope).returning();
    const result = publicMoneyDto(updated, ["subtotal", "taxTotal", "total", "billedTotal"]);
    stringifyWire(result);
    await tx.insert(portalActivityLog).values({ tokenId: access.id, action: "approve_quote", entityType: "quote", entityId: id, ipAddress });
    return result;
  });
}
