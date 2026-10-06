import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { jsonResponse } from "@/lib/api/json-response";
import { postLoanPayment } from "@/lib/api/loans";
import { readLoanJson } from "@/lib/api/loan-wire";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { return jsonResponse(await postLoanPayment(await getAuthContext(request), (await params).id, await readLoanJson(request, true), request)); }
  catch (err) { return handleError(err); }
}
