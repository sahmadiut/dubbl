import { randomBytes } from "node:crypto";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { contact, emailConfig, invoice, invoiceSignature, organization } from "@/lib/db/schema";
import { sendEmail } from "@/lib/email/smtp-client";
import { stringifyWire, WireCompatibilityError } from "@/lib/money/wire";
import { statementMoneyText } from "@/lib/reports/statement-money";
import { AuthError, type AuthContext } from "./auth-context";
import { requireRole } from "./require-role";
import { publicMoneyDto } from "./public-money-wire";
import { invoiceSnapshotDto, parseInvoiceSnapshotJson } from "./invoice-snapshot-wire";
import { signatureInvoiceId, signatureRequestSchema, signatureSubmitSchema, signingToken } from "./invoice-signature-wire";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
const columns = { id: invoice.id, organizationId: invoice.organizationId, contactId: invoice.contactId,
  invoiceNumber: invoice.invoiceNumber, issueDate: invoice.issueDate, dueDate: invoice.dueDate,
  currencyCode: invoice.currencyCode, subtotal: invoice.subtotal, taxTotal: invoice.taxTotal,
  total: invoice.total, amountPaid: invoice.amountPaid, amountDue: invoice.amountDue,
  senderSnapshot: sql<string | null>`${invoice.senderSnapshot}::text`,
  recipientSnapshot: sql<string | null>`${invoice.recipientSnapshot}::text` };

async function signingInvoice(tx: Tx, organizationId: string, id: string, lock: boolean) {
  const orgQuery = tx.select({ id: organization.id }).from(organization)
    .where(and(eq(organization.id, organizationId), isNull(organization.deletedAt)));
  const [org] = await (lock ? orgQuery.for("update") : orgQuery);
  if (!org) throw new AuthError("Invoice not found", 404);
  const query = tx.select(columns).from(invoice).where(and(eq(invoice.id, id),
    eq(invoice.organizationId, organizationId), isNull(invoice.deletedAt)));
  const [row] = await (lock ? query.for("update") : query);
  if (!row) throw new AuthError("Invoice not found", 404);
  const snapshots = invoiceSnapshotDto({ senderSnapshot: parseInvoiceSnapshotJson(row.senderSnapshot),
    recipientSnapshot: parseInvoiceSnapshotJson(row.recipientSnapshot) });
  // A historical contact can be deleted/inactive, but never belong to another tenant.
  const [party] = row.contactId ? await tx.select({ name: contact.name })
    .from(contact).where(and(eq(contact.id, row.contactId), eq(contact.organizationId, organizationId))) : [];
  if (row.contactId && !party) {
    throw new WireCompatibilityError("Invoice contains a contact outside this organization");
  }
  const summary = { id: row.id, invoiceNumber: row.invoiceNumber, issueDate: row.issueDate, dueDate: row.dueDate,
    currencyCode: row.currencyCode, subtotal: row.subtotal, taxTotal: row.taxTotal, total: row.total,
    amountPaid: row.amountPaid, amountDue: row.amountDue };
  const result = { ...publicMoneyDto(summary, ["subtotal", "taxTotal", "total", "amountPaid", "amountDue"]),
    contact: party ? { name: typeof snapshots.recipient?.name === "string" ? snapshots.recipient.name : party.name } : null,
    totalFormatted: statementMoneyText(row.total, row.currencyCode) };
  stringifyWire(result); // Guard the complete result before any signature write/email.
  return result;
}

function pendingSignature(sig: typeof invoiceSignature.$inferSelect, now = new Date()) {
  if (sig.status === "signed") throw new AuthError("This invoice has already been signed", 400);
  if (sig.status === "declined") throw new AuthError("This signature request was declined", 400);
  if (sig.status === "expired" || (sig.expiresAt && sig.expiresAt <= now)) throw new AuthError("This signing link has expired", 400);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
async function deliver(tx: Tx, organizationId: string, sig: typeof invoiceSignature.$inferSelect,
  invoiceNumber: string, baseUrl: string | undefined, reminder: boolean) {
  const [cfg] = await tx.select().from(emailConfig).where(eq(emailConfig.organizationId, organizationId));
  if (!cfg) {
    if (reminder) throw new AuthError("Email is not configured for this organization", 400);
    return false;
  }
  const link = new URL(`/sign/${sig.token}`, baseUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").href;
  await sendEmail(cfg, { to: sig.signerEmail,
    subject: `${reminder ? "Reminder: " : ""}Signature requested - Invoice ${invoiceNumber}`,
    html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto"><h2>Signature ${reminder ? "Reminder" : "Request"}</h2>
      <p>Hello ${escapeHtml(sig.signerName)},</p><p>You have been asked to sign invoice <strong>${escapeHtml(invoiceNumber)}</strong>.</p>
      <p><a href="${escapeHtml(link)}">Review &amp; Sign</a></p>
      ${sig.expiresAt ? `<p>This link expires at ${escapeHtml(sig.expiresAt.toISOString())}.</p>` : ""}
      <p>If you did not expect this request, you can safely ignore this email.</p></div>` });
  return true;
}

export async function requestInvoiceSignature(ctx: AuthContext, id: string, input: unknown, baseUrl?: string) {
  requireRole(ctx, "manage:invoices"); signatureInvoiceId.parse(id);
  const parsed = signatureRequestSchema.parse(input);
  return db.transaction(async tx => {
    const inv = await signingInvoice(tx, ctx.organizationId, id, true);
    const expiresAt = parsed.expiresAt ? new Date(parsed.expiresAt) : null;
    if (expiresAt && expiresAt <= new Date()) throw new AuthError("Expiry must be in the future", 400);
    const [signature] = await tx.insert(invoiceSignature).values({ invoiceId: id, token: randomBytes(32).toString("base64url"),
      signerName: parsed.signerName, signerEmail: parsed.signerEmail, expiresAt }).returning();
    stringifyWire(signature);
    const emailSent = await deliver(tx, ctx.organizationId, signature, inv.invoiceNumber, baseUrl, false);
    return { signature, emailSent };
  });
}

export async function getInvoiceSignatures(ctx: AuthContext, id: string) {
  requireRole(ctx, "view:data"); signatureInvoiceId.parse(id);
  return db.transaction(async tx => {
    await signingInvoice(tx, ctx.organizationId, id, false);
    const signatures = await tx.select().from(invoiceSignature).where(eq(invoiceSignature.invoiceId, id))
      .orderBy(desc(invoiceSignature.requestedAt), desc(invoiceSignature.id));
    stringifyWire(signatures);
    return { signatures };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}

export async function resendInvoiceSignature(ctx: AuthContext, id: string, baseUrl?: string) {
  requireRole(ctx, "manage:invoices"); signatureInvoiceId.parse(id);
  return db.transaction(async tx => {
    const inv = await signingInvoice(tx, ctx.organizationId, id, true);
    const signatures = await tx.select().from(invoiceSignature).where(eq(invoiceSignature.invoiceId, id))
      .orderBy(desc(invoiceSignature.requestedAt), desc(invoiceSignature.id)).for("update");
    const signature = signatures.find(s => s.status === "pending" && (!s.expiresAt || s.expiresAt > new Date()));
    if (!signature) throw new AuthError("No active pending signature request found for this invoice", 404);
    stringifyWire(signature);
    await deliver(tx, ctx.organizationId, signature, inv.invoiceNumber, baseUrl, true);
    return { success: true, resentTo: signature.signerEmail };
  });
}

async function tokenOwner(tx: Tx, token: string) {
  const [owner] = await tx.select({ invoiceId: invoiceSignature.invoiceId, organizationId: invoice.organizationId })
    .from(invoiceSignature).innerJoin(invoice, eq(invoice.id, invoiceSignature.invoiceId))
    .where(and(eq(invoiceSignature.token, token), isNull(invoice.deletedAt)));
  if (!owner) throw new AuthError("Signature request not found", 404);
  return owner;
}

/** Public capability read exposes only the summary needed by the signing page. */
export async function getPublicInvoiceSignature(token: string) {
  signingToken.parse(token);
  return db.transaction(async tx => {
    const owner = await tokenOwner(tx, token);
    const inv = await signingInvoice(tx, owner.organizationId, owner.invoiceId, false);
    const [signature] = await tx.select().from(invoiceSignature).where(and(eq(invoiceSignature.token, token), eq(invoiceSignature.invoiceId, inv.id)));
    if (!signature) throw new AuthError("Signature request not found", 404);
    stringifyWire(signature);
    return { signature, invoice: inv, isExpired: signature.status === "expired" || !!(signature.expiresAt && signature.expiresAt <= new Date()) };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}

export async function signPublicInvoice(token: string, input: unknown, request?: Request) {
  signingToken.parse(token); const parsed = signatureSubmitSchema.parse(input);
  return db.transaction(async tx => {
    const owner = await tokenOwner(tx, token);
    // Same organization -> invoice -> signature order as corrections/lifecycle.
    await signingInvoice(tx, owner.organizationId, owner.invoiceId, true);
    const [sig] = await tx.select().from(invoiceSignature).where(and(eq(invoiceSignature.token, token), eq(invoiceSignature.invoiceId, owner.invoiceId))).for("update");
    if (!sig) throw new AuthError("Signature request not found", 404);
    pendingSignature(sig); // Recheck status/expiry after every lock wait.
    const next = { ...sig, ...parsed, status: "signed" as const, signedAt: new Date(),
      ipAddress: request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request?.headers.get("x-real-ip") || null,
      userAgent: request?.headers.get("user-agent") || null };
    stringifyWire(next);
    const [signature] = await tx.update(invoiceSignature).set({ signatureDataUrl: next.signatureDataUrl,
      status: next.status, signedAt: next.signedAt, ipAddress: next.ipAddress, userAgent: next.userAgent })
      .where(and(eq(invoiceSignature.id, sig.id), eq(invoiceSignature.status, "pending"))).returning();
    stringifyWire(signature);
    return { signature };
  });
}
