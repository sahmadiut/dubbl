import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { jsonResponse } from "@/lib/api/json-response";
import { listBankDuplicates } from "@/lib/api/bank-transaction-reads";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(request); const { id } = await params;
    return jsonResponse(await listBankDuplicates(ctx, id));
  } catch (err) { return handleError(err); }
}
