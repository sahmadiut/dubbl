import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { jsonResponse } from "@/lib/api/json-response";
import { excludeBankTransaction } from "@/lib/api/bank-reconciliations";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params, ctx = await getAuthContext(request);
    const { transaction } = await excludeBankTransaction(ctx, id, request);
    return jsonResponse({ transaction });
  } catch (error) { return handleError(error); }
}
