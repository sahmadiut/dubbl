import { and, eq, isNull, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { taxJurisdiction } from "@/lib/db/schema";
import { AuthError, type AuthContext } from "@/lib/api/auth-context";
import { requireRole } from "@/lib/api/require-role";
import { taxLookupSchema, taxJurisdictionSchema, taxJurisdictionDto, taxId } from "@/lib/api/tax-rate-wire";
import { lockTaxOrganization, auditTax } from "@/lib/api/tax-config-transaction";
export interface TaxLookupResult {
  combinedRate: number; stateRate: number; countyRate: number; cityRate: number; specialRate: number;
  source: "cached" | "manual"; country: string; state: string | null; postalCode: string | null;
}
export async function lookupTaxRate(ctx: AuthContext, input: unknown): Promise<TaxLookupResult | null> {
  const args = taxLookupSchema.parse(input);
  const [row] = await db.select().from(taxJurisdiction).where(and(
    eq(taxJurisdiction.organizationId, ctx.organizationId), eq(taxJurisdiction.country, args.country),
    args.state ? eq(taxJurisdiction.state, args.state) : undefined,
    args.postalCode ? eq(taxJurisdiction.postalCode, args.postalCode) : undefined,
  )).orderBy(desc(taxJurisdiction.updatedAt), taxJurisdiction.id).limit(1);
  if (!row) return null;
  const result = taxJurisdictionDto(row);
  return { combinedRate: result.combinedRate, stateRate: result.stateRate, countyRate: result.countyRate,
    cityRate: result.cityRate, specialRate: result.specialRate, source: "cached", country: result.country,
    state: result.state, postalCode: result.postalCode };
}
export async function saveTaxJurisdiction(ctx: AuthContext, input: unknown, request?: Request) {
  requireRole(ctx, "manage:tax-rates"); const args = taxJurisdictionSchema.parse(input);
  const values = { country: args.country, state: args.state || null, postalCode: args.postalCode || null,
    county: args.county || null, city: args.city || null, combinedRate: args.combinedRate,
    stateRate: args.stateRate ?? 0, countyRate: args.countyRate ?? 0, cityRate: args.cityRate ?? 0,
    specialRate: args.specialRate ?? 0, source: "manual" as const, lastSyncedAt: new Date(), updatedAt: new Date() };
  return db.transaction(async tx => {
    await lockTaxOrganization(tx, ctx.organizationId);
    // PostgreSQL ordinary unique indexes treat NULL keys as distinct. The org
    // lock plus explicit NULL matching makes these keys idempotent too.
    const [existing] = await tx.select().from(taxJurisdiction).where(and(eq(taxJurisdiction.organizationId, ctx.organizationId),
      eq(taxJurisdiction.country, values.country), values.state === null ? isNull(taxJurisdiction.state) : eq(taxJurisdiction.state, values.state),
      values.postalCode === null ? isNull(taxJurisdiction.postalCode) : eq(taxJurisdiction.postalCode, values.postalCode)))
      .orderBy(desc(taxJurisdiction.updatedAt), taxJurisdiction.id).limit(1).for("update");
    const [row] = existing
      ? await tx.update(taxJurisdiction).set(values).where(and(eq(taxJurisdiction.id, existing.id), eq(taxJurisdiction.organizationId, ctx.organizationId))).returning()
      : await tx.insert(taxJurisdiction).values({ ...values, organizationId: ctx.organizationId }).returning();
    const result = taxJurisdictionDto(row);
    await auditTax(tx, ctx.organizationId, "tax_jurisdiction", row.id, existing ? "update" : "create", { before: existing ?? null, after: result }, ctx, request);
    return result;
  });
}
export async function deleteTaxJurisdiction(ctx: AuthContext, id: string, request?: Request) {
  requireRole(ctx, "manage:tax-rates"); taxId.parse(id);
  return db.transaction(async tx => {
    await lockTaxOrganization(tx, ctx.organizationId);
    const [row] = await tx.delete(taxJurisdiction).where(and(eq(taxJurisdiction.id, id), eq(taxJurisdiction.organizationId, ctx.organizationId))).returning();
    if (!row) throw new AuthError("Tax jurisdiction not found", 404);
    await auditTax(tx, ctx.organizationId, "tax_jurisdiction", id, "delete", { id }, ctx, request);
    return { success: true };
  });
}
