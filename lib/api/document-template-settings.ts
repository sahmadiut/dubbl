import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { documentTemplate, organization } from "@/lib/db/schema";
import { notDeleted, softDelete } from "@/lib/db/soft-delete";
import { AuthError, type AuthContext } from "./auth-context";
import { requireRole } from "./require-role";
import { logAudit, diffChanges } from "./audit";

const fields = {
  name: z.string().min(1).describe("Template display name"),
  headerHtml: z.string().nullable().optional().describe("Saved header HTML or null"),
  footerHtml: z.string().nullable().optional().describe("Saved footer HTML or null"),
  logoUrl: z.string().nullable().optional().describe("Logo URL or null"),
  accentColor: z.string().optional().describe("Accent color, e.g. #10b981"),
  showTaxBreakdown: z.boolean().optional().describe("Show tax breakdown"),
  showPaymentTerms: z.boolean().optional().describe("Show payment terms"),
  notes: z.string().nullable().optional().describe("Saved notes or null"),
  bankDetails: z.string().nullable().optional().describe("Saved bank details or null"),
  paymentInstructions: z.string().nullable().optional().describe("Saved payment instructions or null"),
  isDefault: z.boolean().optional().describe("Use as the default for this document type"),
};
export const templateCreateSchema = z.object({ ...fields,
  type: z.enum(["invoice", "quote", "receipt", "payslip", "purchase_order"]).describe("Immutable document type"),
});
export const templateUpdateSchema = z.object(fields).partial();
export const templateIdSchema = z.string().uuid().describe("Organization-owned document template UUID");
const owned = (ctx: AuthContext, id?: string) => and(
  eq(documentTemplate.organizationId, ctx.organizationId), notDeleted(documentTemplate.deletedAt),
  id ? eq(documentTemplate.id, id) : undefined,
);

export async function listDocumentTemplates(ctx: AuthContext) {
  return { templates: await db.query.documentTemplate.findMany({ where: owned(ctx), orderBy: documentTemplate.createdAt }) };
}
export async function getDocumentTemplate(ctx: AuthContext, input: string) {
  const template = await db.query.documentTemplate.findFirst({ where: owned(ctx, templateIdSchema.parse(input)) });
  if (!template) throw new AuthError("Template not found", 404);
  return { template };
}
export async function createDocumentTemplate(ctx: AuthContext, input: unknown, request?: Request) {
  requireRole(ctx, "manage:invoices");
  const parsed = templateCreateSchema.parse(input);
  const template = await db.transaction(async tx => {
    // Serialize default changes for this organization, including the first template.
    await tx.select({ id: organization.id }).from(organization).where(eq(organization.id, ctx.organizationId)).for("update");
    if (parsed.isDefault) await tx.update(documentTemplate).set({ isDefault: false }).where(and(owned(ctx), eq(documentTemplate.type, parsed.type)));
    const [saved] = await tx.insert(documentTemplate).values({ organizationId: ctx.organizationId, ...parsed }).returning();
    return saved;
  });
  await logAudit({ ctx, action: "create", entityType: "document_template", entityId: template.id, request });
  return { template };
}
export async function updateDocumentTemplate(ctx: AuthContext, inputId: string, input: unknown, request?: Request) {
  requireRole(ctx, "manage:invoices");
  const id = templateIdSchema.parse(inputId), parsed = templateUpdateSchema.parse(input);
  const { existing, template } = await db.transaction(async tx => {
    await tx.select({ id: organization.id }).from(organization).where(eq(organization.id, ctx.organizationId)).for("update");
    const existing = await tx.query.documentTemplate.findFirst({ where: owned(ctx, id) });
    if (!existing) throw new AuthError("Template not found", 404);
    if (parsed.isDefault) await tx.update(documentTemplate).set({ isDefault: false }).where(and(owned(ctx), eq(documentTemplate.type, existing.type)));
    const [template] = await tx.update(documentTemplate).set({ ...parsed, updatedAt: new Date() }).where(owned(ctx, id)).returning();
    if (!template) throw new AuthError("Template not found", 404);
    return { existing, template };
  });
  await logAudit({ ctx, action: "update", entityType: "document_template", entityId: id, changes: diffChanges(existing, template), request });
  return { template };
}
export async function deleteDocumentTemplate(ctx: AuthContext, input: string, request?: Request) {
  requireRole(ctx, "manage:invoices");
  const id = templateIdSchema.parse(input);
  const [deleted] = await db.update(documentTemplate).set(softDelete()).where(owned(ctx, id)).returning();
  if (!deleted) throw new AuthError("Template not found", 404);
  await logAudit({ ctx, action: "delete", entityType: "document_template", entityId: id, changes: deleted, request });
  return { success: true };
}
