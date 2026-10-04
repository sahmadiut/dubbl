import { getAuthContext } from "@/lib/api/auth-context";
import { handleError, ok, created } from "@/lib/api/response";
import { listTaxRates, createTaxRate } from "@/lib/api/tax-rates";
import { readTaxJson } from "@/lib/api/tax-rate-wire";
export async function GET(request: Request) {
  try { return ok({ taxRates: await listTaxRates(await getAuthContext(request)) }); }
  catch (err) { return handleError(err); }
}
export async function POST(request: Request) {
  try { const ctx = await getAuthContext(request); return created({ taxRate: await createTaxRate(ctx, await readTaxJson(request), request) }); }
  catch (err) { return handleError(err); }
}
