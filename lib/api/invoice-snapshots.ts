import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditLog, invoice, invoiceSignature, organization } from "@/lib/db/schema";
import { AuthError, type AuthContext } from "./auth-context";
import { requireRole } from "./require-role";
import { invoiceSnapshotDto, invoiceSnapshotId, invoiceSnapshotSchema, parseInvoiceSnapshotJson } from "./invoice-snapshot-wire";

const scope = (ctx: AuthContext, id: string) => and(eq(invoice.id, id),
  eq(invoice.organizationId, ctx.organizationId), isNull(invoice.deletedAt));
// Do not decode unrelated legacy money: this operation exposes only saved party JSON.
const columns = { status: invoice.status, senderSnapshot: sql<string | null>`${invoice.senderSnapshot}::text`,
  recipientSnapshot: sql<string | null>`${invoice.recipientSnapshot}::text` };
const savedDto = (row: { senderSnapshot: string | null; recipientSnapshot: string | null }) => invoiceSnapshotDto({
  senderSnapshot: parseInvoiceSnapshotJson(row.senderSnapshot), recipientSnapshot: parseInvoiceSnapshotJson(row.recipientSnapshot),
});

export async function getInvoiceSnapshot(ctx: AuthContext, id: string) {
  requireRole(ctx, "view:data");
  invoiceSnapshotId.parse(id);
  const [row] = await db.select(columns).from(invoice).where(scope(ctx, id));
  if (!row) throw new AuthError("Invoice not found", 404);
  return savedDto(row);
}

export async function updateInvoiceSnapshot(ctx: AuthContext, id: string, input: unknown, request?: Request) {
  requireRole(ctx, "manage:invoices");
  invoiceSnapshotId.parse(id);
  const parsed = invoiceSnapshotSchema.parse(input);
  return db.transaction(async tx => {
    // Match invoice lifecycle writers: organization before invoice, including the
    // parent FK lock needed by the audit insert, to avoid cross-writer deadlocks.
    const [org] = await tx.select({ id: organization.id }).from(organization)
      .where(and(eq(organization.id, ctx.organizationId), isNull(organization.deletedAt))).for("update");
    if (!org) throw new AuthError("Organization not found", 404);
    const [row] = await tx.select(columns).from(invoice).where(scope(ctx, id)).for("update");
    if (!row) throw new AuthError("Invoice not found", 404);
    if (row.status === "draft") throw new AuthError("Draft invoices don't have snapshots yet, edit the invoice directly", 400);
    // Locks conflict with the existing public signer UPDATE, so a completed signing
    // cannot race this check. The invoice lock also serializes concurrent merges.
    const signatures = await tx.select({ status: invoiceSignature.status }).from(invoiceSignature)
      .where(eq(invoiceSignature.invoiceId, id)).orderBy(invoiceSignature.id).for("update");
    if (signatures.some(signature => signature.status === "signed")) {
      throw new AuthError("Signed invoice snapshots cannot be corrected", 409);
    }
    const before = savedDto(row);
    const result = invoiceSnapshotDto({
      senderSnapshot: parsed.sender ? { ...before.sender, ...parsed.sender } : before.sender,
      recipientSnapshot: parsed.recipient ? { ...before.recipient, ...parsed.recipient } : before.recipient,
    });
    await tx.update(invoice).set({ senderSnapshot: result.sender, recipientSnapshot: result.recipient, updatedAt: new Date() })
      .where(scope(ctx, id));
    await tx.insert(auditLog).values({ organizationId: ctx.organizationId, userId: ctx.userId,
      action: "update_snapshot", entityType: "invoice", entityId: id, changes: { before, after: result },
      ipAddress: request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request?.headers.get("x-real-ip") || null,
      userAgent: request?.headers.get("user-agent") || null });
    return result;
  });
}
