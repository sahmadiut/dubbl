import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { organization, journalEntry, payrollRun, auditLog, fixedAsset, assetCategory, loan } from "@/lib/db/schema";
import { AuthError, type AuthContext } from "./auth-context";
import { requireRole } from "./require-role";
import { diffChanges } from "./audit";
import { organizationDto, organizationUpdateSchema, parseMileageRate, mileageRateDto, validateOrganizationBusinessType } from "./organization-wire";
import { seedDefaultAccounts } from "@/lib/db/default-accounts";
import { ensureTaxRatesSeeded } from "./tax-profiles";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
const scope = (ctx: AuthContext) => and(eq(organization.id, ctx.organizationId), isNull(organization.deletedAt));
async function load(tx: Tx, ctx: AuthContext, lock = false) {
  const query = tx.select().from(organization).where(scope(ctx));
  const [row] = await (lock ? query.for("update") : query);
  if (!row) throw new AuthError("Organization not found", 404);
  return row;
}
async function audit(tx: Tx, ctx: AuthContext, before: typeof organization.$inferSelect, after: typeof organization.$inferSelect, request?: Request) {
  await tx.insert(auditLog).values({ organizationId: ctx.organizationId, userId: ctx.userId, action: "update",
    entityType: "organization", entityId: ctx.organizationId, changes: diffChanges(before, after) ?? null,
    ipAddress: request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request?.headers.get("x-real-ip") || null,
    userAgent: request?.headers.get("user-agent") || null });
}
export async function getOrganization(ctx: AuthContext) {
  return db.transaction(async tx => ({ organization: organizationDto(await load(tx, ctx)) }));
}
export async function getOrganizationMileageRate(ctx: AuthContext) {
  return db.transaction(async tx => mileageRateDto(await load(tx, ctx)));
}
export async function updateOrganizationMileageRate(ctx: AuthContext, input: unknown, request?: Request) {
  requireRole(ctx, "manage:tax-config");
  const mileageRate = parseMileageRate(input);
  return db.transaction(async tx => {
    const existing = await load(tx, ctx, true);
    mileageRateDto({ ...existing, mileageRate });
    const [saved] = await tx.update(organization).set({ mileageRate, updatedAt: new Date() }).where(scope(ctx)).returning();
    const result = mileageRateDto(saved);
    await audit(tx, ctx, existing, saved, request); return result;
  });
}
export async function updateOrganizationSettings(ctx: AuthContext, input: unknown, request?: Request) {
  const parsed = organizationUpdateSchema.parse(input);
  const onlyOnboarding = Object.keys(parsed).length === 1 && parsed.onboardingCompleted !== undefined;
  requireRole(ctx, onlyOnboarding ? "view:data" : "manage:billing");
  const result = await db.transaction(async tx => {
    const existing = await load(tx, ctx, true);
    if (parsed.defaultCurrency && parsed.defaultCurrency !== existing.defaultCurrency) {
      const [activity] = await tx.select({ id: journalEntry.id }).from(journalEntry)
        .where(eq(journalEntry.organizationId, ctx.organizationId)).limit(1);
      if (activity) throw new AuthError("Base currency can't be changed once transactions exist", 409);
      const [payroll] = await tx.select({ id: payrollRun.id }).from(payrollRun).where(eq(payrollRun.organizationId, ctx.organizationId)).limit(1);
      if (payroll) throw new AuthError("Base currency can't be changed with payroll-run history", 409);
      // These records retain implicit base-currency amounts, including before any
      // GL posting and after soft deletion. Their writers share this org lock.
      const [asset] = await tx.select({ id: fixedAsset.id }).from(fixedAsset).where(eq(fixedAsset.organizationId, ctx.organizationId)).limit(1);
      const [category] = await tx.select({ id: assetCategory.id }).from(assetCategory).where(eq(assetCategory.organizationId, ctx.organizationId)).limit(1);
      const [savedLoan] = await tx.select({ id: loan.id }).from(loan).where(eq(loan.organizationId, ctx.organizationId)).limit(1);
      if (asset || category || savedLoan) throw new AuthError("Base currency can't be changed with asset, category or loan history", 409);
    }
    const { onboardingCompleted, ...fields } = parsed;
    const patch = { ...fields, ...(onboardingCompleted === undefined ? {} : { onboardingCompletedAt: onboardingCompleted ? new Date() : null }), updatedAt: new Date() };
    const candidate = { ...existing, ...patch };
    if (parsed.country !== undefined || parsed.countryCode !== undefined || parsed.businessType !== undefined)
      validateOrganizationBusinessType(candidate);
    organizationDto(candidate);
    const [saved] = await tx.update(organization).set(patch).where(scope(ctx)).returning();
    const dto = organizationDto(saved);
    await audit(tx, ctx, existing, saved, request);
    return { organization: dto, seedCountry: existing.country === null && saved.country !== null };
  });
  if (result.seedCountry) {
    // Preserve lazy onboarding seeding; these existing idempotent services run
    // after the settings transaction. Account lists also self-heal templates.
    await seedDefaultAccounts(ctx.organizationId, result.organization.defaultCurrency, result.organization.countryCode || undefined);
    try { await ensureTaxRatesSeeded(ctx.organizationId, result.organization.countryCode || result.organization.country || undefined, ctx); } catch { /* existing best-effort tax seeding */ }
  }
  return { organization: result.organization };
}
