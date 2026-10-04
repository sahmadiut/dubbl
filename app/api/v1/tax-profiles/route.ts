import { getAuthContext } from "@/lib/api/auth-context";
import { handleError, ok, created } from "@/lib/api/response";
import { readTaxProfiles, seedTaxProfile } from "@/lib/api/tax-profile-contracts";
import { readTaxJson } from "@/lib/api/tax-rate-wire";
export async function GET(request: Request) {
  try {
    const ctx = await getAuthContext(request), country = new URL(request.url).searchParams.get("country");
    return ok(await readTaxProfiles(ctx, country === null ? {} : { country }));
  } catch (err) { return handleError(err); }
}
export async function POST(request: Request) {
  try { const ctx = await getAuthContext(request); return created(await seedTaxProfile(ctx, await readTaxJson(request), request)); }
  catch (err) { return handleError(err); }
}
