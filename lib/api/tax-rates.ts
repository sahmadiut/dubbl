import { and, eq, isNull, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { taxRate, taxComponent, chartAccount } from "@/lib/db/schema";
import { AuthError, type AuthContext } from "./auth-context";
import { requireRole } from "./require-role";
import { taxCreateSchema, taxUpdateSchema, taxId, taxRateDto } from "./tax-rate-wire";
import { lockTaxOrganization, auditTax, type TaxTx } from "./tax-config-transaction";
import { ensureTaxRatesSeeded } from "./tax-profiles";
const scope = (ctx: AuthContext, id?: string) => and(eq(taxRate.organizationId, ctx.organizationId), isNull(taxRate.deletedAt), id ? eq(taxRate.id, id) : undefined);
async function components(tx: TaxTx, id: string) {
  return tx.select().from(taxComponent).where(eq(taxComponent.taxRateId, id)).orderBy(taxComponent.id);
}
async function references(tx: TaxTx, ctx: AuthContext, list: { accountId?: string | null }[]) {
  for (const id of [...new Set(list.map(c => c.accountId).filter((v): v is string => !!v))]) {
    const [row] = await tx.select({ id: chartAccount.id }).from(chartAccount)
      .where(and(eq(chartAccount.id, id), eq(chartAccount.organizationId, ctx.organizationId), isNull(chartAccount.deletedAt), eq(chartAccount.isActive, true)))
      .for("share");
    if (!row) throw new AuthError("Component account must be live, active and organization-owned", 404);
  }
}
export async function listTaxRates(ctx: AuthContext) {
  const query = () => db.transaction(async tx => {
    const rows = await tx.select().from(taxRate).where(scope(ctx)).orderBy(taxRate.id);
    const result = []; for (const row of rows) result.push(taxRateDto({ ...row, components: await components(tx, row.id) }));
    return result;
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
  let rows = await query();
  if (!rows.length) {
    // Preserve best-effort lazy seeding for existing read-only clients.
    try { await ensureTaxRatesSeeded(ctx.organizationId, undefined, ctx); } catch { /* seed is optional */ }
    rows = await query();
  }
  return rows;
}
export async function getTaxRate(ctx: AuthContext, id: string) {
  taxId.parse(id);
  return db.transaction(async tx => {
    const [row] = await tx.select().from(taxRate).where(scope(ctx, id));
    if (!row) throw new AuthError("Tax rate not found", 404);
    return taxRateDto({ ...row, components: await components(tx, id) });
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
export async function createTaxRate(ctx: AuthContext, input: unknown, request?: Request) {
  requireRole(ctx, "manage:tax-rates"); const { components: list, ...values } = taxCreateSchema.parse(input);
  return db.transaction(async tx => {
    await lockTaxOrganization(tx, ctx.organizationId); await references(tx, ctx, list ?? []);
    if (values.isDefault) await tx.update(taxRate).set({ isDefault: false }).where(scope(ctx));
    const [row] = await tx.insert(taxRate).values({ ...values, organizationId: ctx.organizationId }).returning();
    if (list?.length) await tx.insert(taxComponent).values(list.map(c => ({ ...c, accountId: c.accountId ?? null, taxRateId: row.id })));
    const result = taxRateDto(row); await auditTax(tx, ctx.organizationId, "tax_rate", row.id, "create", { ...result, components: list ?? [] }, ctx, request);
    return result;
  });
}
export async function updateTaxRate(ctx: AuthContext, id: string, input: unknown, request?: Request) {
  requireRole(ctx, "manage:tax-rates"); taxId.parse(id); const { components: list, ...values } = taxUpdateSchema.parse(input);
  return db.transaction(async tx => {
    await lockTaxOrganization(tx, ctx.organizationId);
    const [existing] = await tx.select().from(taxRate).where(scope(ctx, id)).for("update");
    if (!existing) throw new AuthError("Tax rate not found", 404);
    const before = taxRateDto({ ...existing, components: await components(tx, id) });
    await references(tx, ctx, list ?? before.components);
    if (values.isDefault) await tx.update(taxRate).set({ isDefault: false }).where(and(scope(ctx), ne(taxRate.id, id)));
    let row = existing;
    if (Object.values(values).some(v => v !== undefined)) [row] = await tx.update(taxRate).set(values).where(scope(ctx, id)).returning();
    if (list !== undefined) {
      await tx.delete(taxComponent).where(eq(taxComponent.taxRateId, id));
      if (list.length) await tx.insert(taxComponent).values(list.map(c => ({ ...c, accountId: c.accountId ?? null, taxRateId: id })));
    }
    const result = taxRateDto(row);
    await auditTax(tx, ctx.organizationId, "tax_rate", id, "update", { before, after: { ...result, components: await components(tx, id) } }, ctx, request); return result;
  });
}
export async function deleteTaxRate(ctx: AuthContext, id: string, request?: Request) {
  requireRole(ctx, "manage:tax-rates"); taxId.parse(id);
  return db.transaction(async tx => {
    await lockTaxOrganization(tx, ctx.organizationId);
    const [existing] = await tx.select().from(taxRate).where(scope(ctx, id)).for("update");
    if (!existing) throw new AuthError("Tax rate not found", 404);
    await tx.update(taxRate).set({ deletedAt: new Date(), isDefault: false }).where(scope(ctx, id));
    await auditTax(tx, ctx.organizationId, "tax_rate", id, "delete", { id }, ctx, request); return { success: true };
  });
}
