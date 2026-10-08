import { jsonResponse } from "@/lib/api/json-response";
import { contactCreditFields, contactCreditInput, contactDto } from "@/lib/api/contact-wire";
import { db } from "@/lib/db";
import { contact, contactPerson } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getAuthContext } from "@/lib/api/auth-context";
import { requireRole } from "@/lib/api/require-role";
import { handleError, notFound } from "@/lib/api/response";
import { logAudit, diffChanges } from "@/lib/api/audit";
import { notDeleted, softDelete } from "@/lib/db/soft-delete";
import { z } from "zod";
import { currencyCodeSchema } from "@/lib/currency/zod";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  taxNumber: z.string().nullable().optional(),
  type: z.enum(["customer", "supplier", "both"]).optional(),
  paymentTermsDays: z.number().int().min(0).optional(),
  addresses: z.any().optional(),
  notes: z.string().nullable().optional(),
  currencyCode: currencyCodeSchema.optional(),
  ...contactCreditFields,
  isTaxExempt: z.boolean().optional(),
  is1099Vendor: z.boolean().optional(),
  defaultRevenueAccountId: z.string().uuid().nullable().optional(),
  defaultExpenseAccountId: z.string().uuid().nullable().optional(),
  defaultTaxRateId: z.string().uuid().nullable().optional(),
}).strict();

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ctx = await getAuthContext(request);

    const found = await db.query.contact.findFirst({
      where: and(
        eq(contact.id, id),
        eq(contact.organizationId, ctx.organizationId),
        notDeleted(contact.deletedAt)
      ),
      with: {
        defaultRevenueAccount: true,
        defaultExpenseAccount: true,
        defaultTaxRate: true,
        people: {
          where: notDeleted(contactPerson.deletedAt),
          orderBy: desc(contactPerson.createdAt),
        },
      },
    });

    if (!found) return notFound("Contact");
    return jsonResponse({ contact: contactDto(found) });
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ctx = await getAuthContext(request);
    requireRole(ctx, "manage:contacts");

    const body = await request.json();
    const details = updateSchema.parse(body);
    const credit = contactCreditInput(details);
    const { creditLimitMinor, ...parsed } = { ...details, ...credit };
    void creditLimitMinor;

    const existing = await db.query.contact.findFirst({
      where: and(
        eq(contact.id, id),
        eq(contact.organizationId, ctx.organizationId),
        notDeleted(contact.deletedAt)
      ),
    });

    if (!existing) return notFound("Contact");

    const [updated] = await db
      .update(contact)
      .set({ ...parsed, updatedAt: new Date() })
      .where(and(eq(contact.id, id), eq(contact.organizationId, ctx.organizationId), notDeleted(contact.deletedAt)))
      .returning();

    await logAudit({ ctx, action: "update", entityType: "contact", entityId: id, changes: diffChanges(existing as Record<string, unknown>, updated as Record<string, unknown>), request });

    return jsonResponse({ contact: contactDto(updated) });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ctx = await getAuthContext(request);
    requireRole(ctx, "manage:contacts");

    const existing = await db.query.contact.findFirst({
      where: and(
        eq(contact.id, id),
        eq(contact.organizationId, ctx.organizationId),
        notDeleted(contact.deletedAt)
      ),
    });

    if (!existing) return notFound("Contact");

    await db
      .update(contact)
      .set(softDelete())
      .where(and(eq(contact.id, id), eq(contact.organizationId, ctx.organizationId), notDeleted(contact.deletedAt)));

    await logAudit({
      ctx,
      action: "delete",
      entityType: "contact",
      entityId: id,
      changes: existing as Record<string, unknown>,
      request,
    });

    return jsonResponse({ success: true });
  } catch (err) {
    return handleError(err);
  }
}
