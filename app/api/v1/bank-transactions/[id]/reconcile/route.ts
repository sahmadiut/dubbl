import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { jsonResponse } from "@/lib/api/json-response";
import { reconcileBankTransaction } from "@/lib/api/bank-reconciliations";
import { readBankTransferJson } from "@/lib/api/bank-transfer-wire";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params, ctx = await getAuthContext(request);
    const { transaction } = await reconcileBankTransaction(ctx, id, await readBankTransferJson(request), request);
    return jsonResponse({ transaction });
  } catch (error) { return handleError(error); }
}
