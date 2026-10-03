import { readCreditJson } from "@/lib/api/credit-wire";
import { getAuthContext } from "@/lib/api/auth-context";
import { ok, created, handleError } from "@/lib/api/response";
import { listCredits, createCreditNote } from "@/lib/api/credits";
import { creditListQuery } from "@/lib/api/credit-wire";
import { paginatedResponse } from "@/lib/api/pagination";

export async function GET(request: Request) {
  try {
    const ctx = await getAuthContext(request), query = creditListQuery(new URL(request.url));
    const result = await listCredits(ctx, query, false);
    return ok(paginatedResponse<unknown>(result.rows, result.total, query.page, query.limit));
  } catch (err) { return handleError(err); }
}

export async function POST(request: Request) {
  try { const ctx = await getAuthContext(request); return created(await createCreditNote(ctx, await readCreditJson(request), "rest", request)); }
  catch (err) { return handleError(err); }
}
