import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { jsonResponse } from "@/lib/api/json-response";
import { getBankReconciliationProof, completeBankReconciliation, postBankReconciliationAdjustment } from "@/lib/api/bank-reconciliations";
import { reconciliationPostSchema } from "@/lib/api/bank-reconciliation-wire";
import { readBankTransferJson } from "@/lib/api/bank-transfer-wire";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params, ctx = await getAuthContext(request);
    const recId = new URL(request.url).searchParams.get("reconciliationId") ?? undefined;
    return jsonResponse(await getBankReconciliationProof(ctx, id, recId));
  } catch (error) { return handleError(error); }
}
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params, ctx = await getAuthContext(request);
    const { action, ...input } = reconciliationPostSchema.parse(await readBankTransferJson(request));
    if (action === "complete") return jsonResponse(await completeBankReconciliation(ctx, id, input, request));
    return jsonResponse(await postBankReconciliationAdjustment(ctx, id, input, request), { status: 201 });
  } catch (error) { return handleError(error); }
}
