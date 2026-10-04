import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { jsonResponse } from "@/lib/api/json-response";
import { listBankReconciliations, createBankReconciliation } from "@/lib/api/bank-reconciliations";
import { paginatedResponse } from "@/lib/api/pagination";
import { bankReadQuery } from "@/lib/api/bank-transaction-read-wire";
import { readBankTransferJson } from "@/lib/api/bank-transfer-wire";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params, ctx = await getAuthContext(request);
    const { reconciliations, total, page, limit } = await listBankReconciliations(ctx, bankReadQuery(new URL(request.url), id));
    return jsonResponse(paginatedResponse(reconciliations, total, page, limit));
  } catch (error) { return handleError(error); }
}
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params, ctx = await getAuthContext(request);
    return jsonResponse(await createBankReconciliation(ctx, id, await readBankTransferJson(request), request), { status: 201 });
  } catch (error) { return handleError(error); }
}
