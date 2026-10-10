import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { invoice, organization } from "@/lib/db/schema";
import { AuthError, type AuthContext } from "./auth-context";
import { requireRole } from "./require-role";
import { documentRenderDto } from "@/lib/documents/render-wire";
import { generateUblXml, validateUblData } from "@/lib/ubl/generate-ubl";

export const invoiceUblSchema = z.strictObject({
  invoiceId: z.string().uuid().describe("Organization-owned live invoice UUID to export as UBL XML"),
});
export class InvoiceUblValidationError extends AuthError {
  constructor(readonly details: ReturnType<typeof validateUblData>) {
    super("Missing required fields for UBL generation", 422);
  }
}

/** Existing UBL envelope, read-only and currency-aware; no new statutory rules. */
export async function invoiceUbl(ctx: AuthContext, id: string) {
  requireRole(ctx, "view:data"); invoiceUblSchema.parse({ invoiceId: id });
  return db.transaction(async tx => {
    const inv = await tx.query.invoice.findFirst({
      where: and(eq(invoice.id, id), eq(invoice.organizationId, ctx.organizationId), isNull(invoice.deletedAt)),
      with: { lines: { with: { taxRate: true } }, contact: true },
    });
    if (!inv) throw new AuthError("Invoice not found", 404);
    if (inv.contact.organizationId !== ctx.organizationId) throw new AuthError("Invoice contact belongs to another organization", 422);
    if (inv.lines.some(line => line.taxRate && line.taxRate.organizationId !== ctx.organizationId))
      throw new AuthError("Invoice tax rate belongs to another organization", 422);
    documentRenderDto(inv);
    const org = await tx.query.organization.findFirst({ where: eq(organization.id, ctx.organizationId) });
    if (!org) throw new AuthError("Organization not found", 404);
    const data = {
      invoiceNumber: inv.invoiceNumber, issueDate: inv.issueDate, dueDate: inv.dueDate, currencyCode: inv.currencyCode,
      supplier: { name: org.name, taxId: org.taxId, peppolId: org.peppolId, peppolScheme: org.peppolScheme,
        street: org.addressStreet, city: org.addressCity, state: org.addressState, postalCode: org.addressPostalCode,
        country: org.addressCountry || org.countryCode, email: org.contactEmail, phone: org.contactPhone },
      customer: { name: inv.contact.name, taxId: inv.contact.taxNumber, peppolId: inv.contact.peppolId, peppolScheme: inv.contact.peppolScheme,
        street: inv.contact.addresses?.billing?.line1, city: inv.contact.addresses?.billing?.city, state: inv.contact.addresses?.billing?.state,
        postalCode: inv.contact.addresses?.billing?.postalCode, country: inv.contact.addresses?.billing?.country,
        email: inv.contact.email, phone: inv.contact.phone },
      lines: inv.lines.map((line, i) => ({ id: i + 1, description: line.description, quantity: line.quantity / 100,
        unitPrice: line.unitPrice, lineAmount: line.amount, taxAmount: line.taxAmount,
        taxPercent: line.taxRate ? line.taxRate.rate / 100 : 0, taxName: line.taxRate?.name })),
      subtotal: inv.subtotal, taxTotal: inv.taxTotal, total: inv.total, notes: inv.notes,
    };
    const errors = validateUblData(data);
    if (errors.length) throw new InvoiceUblValidationError(errors);
    return { xml: generateUblXml(data), filename: `invoice-${inv.invoiceNumber}.xml`, currencyCode: inv.currencyCode, totalMinor: String(inv.total) };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
