import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { jsonResponse } from "@/lib/api/json-response";
import { matchBankDocument } from "@/lib/api/bank-document-matches";
import { getBankMatchSuggestions } from "@/lib/api/bank-match-reads";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const ctx = await getAuthContext(request); return jsonResponse(await getBankMatchSuggestions(ctx, (await params).id)); }
  catch (err) { return handleError(err); }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const ctx = await getAuthContext(request); return jsonResponse(await matchBankDocument(ctx, (await params).id, await request.json(), request)); }
  catch (err) { return handleError(err); }
}
