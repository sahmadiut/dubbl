import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { jsonResponse } from "@/lib/api/json-response";
import { matchBankDocument, getBankInvoiceMatches } from "@/lib/api/bank-document-matches";
import { bankInvoiceMatchSchema } from "@/lib/api/bank-document-match-wire";
import { requireRole } from "@/lib/api/require-role";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const ctx = await getAuthContext(request); return jsonResponse(await getBankInvoiceMatches(ctx, (await params).id)); }
  catch (err) { return handleError(err); }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const ctx = await getAuthContext(request); requireRole(ctx, "manage:banking"); return jsonResponse(await matchBankDocument(ctx, (await params).id, bankInvoiceMatchSchema.parse(await request.json()), request)); }
  catch (err) { return handleError(err); }
}
