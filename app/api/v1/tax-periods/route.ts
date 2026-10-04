import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { jsonResponse } from "@/lib/api/json-response";
import { readTaxJson } from "@/lib/api/tax-rate-wire";
import { listTaxPeriods, createTaxPeriod } from "@/lib/api/tax-periods";
export async function GET(request: Request) {
  try { return jsonResponse({ taxPeriods: await listTaxPeriods(await getAuthContext(request)) }); }
  catch (error) { return handleError(error); }
}
export async function POST(request: Request) {
  try { return jsonResponse({ taxPeriod: await createTaxPeriod(await getAuthContext(request), await readTaxJson(request), request) }, { status: 201 }); }
  catch (error) { return handleError(error); }
}
