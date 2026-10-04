import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { jsonResponse } from "@/lib/api/json-response";
import { listBankTransactionReads } from "@/lib/api/bank-transaction-reads";
import { bankReadQuery } from "@/lib/api/bank-transaction-read-wire";
import { paginatedResponse } from "@/lib/api/pagination";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(request); const { id } = await params;
    const result = await listBankTransactionReads(ctx, bankReadQuery(new URL(request.url), id));
    return jsonResponse(paginatedResponse(result.transactions, result.total, result.page, result.limit));
  } catch (err) { return handleError(err); }
}
