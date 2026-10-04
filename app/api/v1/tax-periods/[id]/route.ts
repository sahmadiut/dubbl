import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { jsonResponse } from "@/lib/api/json-response";
import { readTaxJson } from "@/lib/api/tax-rate-wire";
import { getTaxPeriod, updateTaxPeriod, deleteTaxPeriod } from "@/lib/api/tax-periods";
type Params = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Params) {
  try { return jsonResponse({ taxPeriod: await getTaxPeriod(await getAuthContext(request), (await params).id) }); }
  catch (error) { return handleError(error); }
}
export async function PUT(request: Request, { params }: Params) {
  try { return jsonResponse({ taxPeriod: await updateTaxPeriod(await getAuthContext(request), (await params).id, await readTaxJson(request), request) }); }
  catch (error) { return handleError(error); }
}
export async function DELETE(request: Request, { params }: Params) {
  try { return jsonResponse(await deleteTaxPeriod(await getAuthContext(request), (await params).id, request)); }
  catch (error) { return handleError(error); }
}
