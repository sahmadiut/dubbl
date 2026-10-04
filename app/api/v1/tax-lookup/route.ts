import { getAuthContext } from "@/lib/api/auth-context";
import { handleError, ok, created } from "@/lib/api/response";
import { lookupTaxRate, saveTaxJurisdiction, deleteTaxJurisdiction } from "@/lib/tax/lookup";
import { readTaxJson } from "@/lib/api/tax-rate-wire";
export async function GET(request: Request) {
  try {
    const ctx = await getAuthContext(request), query = new URL(request.url).searchParams;
    const result = await lookupTaxRate(ctx, { country: query.get("country"), state: query.get("state"), postalCode: query.get("postalCode") });
    return ok({ found: result !== null, rate: result });
  } catch (err) { return handleError(err); }
}
export async function POST(request: Request) {
  try { const ctx = await getAuthContext(request); return created({ jurisdiction: await saveTaxJurisdiction(ctx, await readTaxJson(request), request) }); }
  catch (err) { return handleError(err); }
}
export async function DELETE(request: Request) {
  try { return ok(await deleteTaxJurisdiction(await getAuthContext(request), new URL(request.url).searchParams.get("id") ?? "", request)); }
  catch (err) { return handleError(err); }
}
