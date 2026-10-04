import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { jsonResponse } from "@/lib/api/json-response";
import { validateBankBalance } from "@/lib/api/bank-accounts";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const ctx = await getAuthContext(request); const { id } = await params; return jsonResponse(await validateBankBalance(ctx, id)); }
  catch (err) { return handleError(err); }
}
