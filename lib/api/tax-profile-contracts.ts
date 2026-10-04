import { AuthError, type AuthContext } from "./auth-context";
import { requireRole } from "./require-role";
import { taxProfileSchema, taxRateDto } from "./tax-rate-wire";
import { listTaxProfiles, getTaxProfileByCountry, resolveProfileForOrg, applyTaxProfile } from "./tax-profiles";
export async function readTaxProfiles(ctx: AuthContext, input: unknown) {
  const { country } = taxProfileSchema.parse(input);
  if (country) {
    const profile = getTaxProfileByCountry(country);
    if (!profile) throw new AuthError(`No tax profile for country "${country}"`, 404);
    profile.rates.forEach(taxRateDto); return { profile };
  }
  const profiles = listTaxProfiles(); profiles.forEach(p => p.rates.forEach(taxRateDto));
  const recommended = await resolveProfileForOrg(ctx.organizationId);
  return { profiles, recommendedCountry: recommended?.country ?? null };
}
export async function seedTaxProfile(ctx: AuthContext, input: unknown, request?: Request) {
  requireRole(ctx, "manage:tax-rates"); const { country } = taxProfileSchema.parse(input);
  const profile = country ? getTaxProfileByCountry(country) : await resolveProfileForOrg(ctx.organizationId);
  if (!profile) throw new AuthError(country ? `No tax profile for country "${country}"` : "Could not determine a tax profile for this organization; pass a country code", 400);
  return applyTaxProfile(ctx.organizationId, profile, ctx, request);
}
