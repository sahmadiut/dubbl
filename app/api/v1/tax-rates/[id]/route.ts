import { getAuthContext } from "@/lib/api/auth-context";
import { handleError, ok } from "@/lib/api/response";
import { getTaxRate, updateTaxRate, deleteTaxRate } from "@/lib/api/tax-rates";
import { readTaxJson } from "@/lib/api/tax-rate-wire";
type Params = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Params) {
  try { return ok({ taxRate: await getTaxRate(await getAuthContext(request), (await params).id) }); }
  catch (err) { return handleError(err); }
}
export async function PATCH(request: Request, { params }: Params) {
  try { const ctx = await getAuthContext(request); return ok({ taxRate: await updateTaxRate(ctx, (await params).id, await readTaxJson(request), request) }); }
  catch (err) { return handleError(err); }
}
export async function DELETE(request: Request, { params }: Params) {
  try { return ok(await deleteTaxRate(await getAuthContext(request), (await params).id, request)); }
  catch (err) { return handleError(err); }
}
