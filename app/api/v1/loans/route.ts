import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { jsonResponse } from "@/lib/api/json-response";
import { paginatedResponse } from "@/lib/api/pagination";
import { listLoans, createLoan } from "@/lib/api/loans";
import { loanQuery, readLoanJson } from "@/lib/api/loan-wire";

export async function GET(request: Request) {
  try {
    const ctx = await getAuthContext(request), p = loanQuery(new URL(request.url));
    const result = await listLoans(ctx, p);
    return jsonResponse(paginatedResponse(result.loans, result.total, p.page, p.limit));
  } catch (err) { return handleError(err); }
}
export async function POST(request: Request) {
  try { return jsonResponse(await createLoan(await getAuthContext(request), await readLoanJson(request), "rest", request), { status: 201 }); }
  catch (err) { return handleError(err); }
}
