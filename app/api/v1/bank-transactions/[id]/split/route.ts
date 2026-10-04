import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { jsonResponse } from "@/lib/api/json-response";
import { splitBankDocuments } from "@/lib/api/bank-document-matches";


export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const ctx = await getAuthContext(request); return jsonResponse(await splitBankDocuments(ctx, (await params).id, await request.json(), request)); }
  catch (err) { return handleError(err); }
}
