import { getAuthContext } from "@/lib/api/auth-context";
import { ok, created, handleError } from "@/lib/api/response";
import { parsePagination, paginatedResponse } from "@/lib/api/pagination";
import { createQuote, listQuotes } from "@/lib/api/quotes";

export async function GET(request: Request) {
  try {
    const ctx = await getAuthContext(request), url = new URL(request.url);
    const { page, limit } = parsePagination(url);
    const result = await listQuotes(ctx, { page, limit, status: url.searchParams.get("status") ?? undefined });
    return ok(paginatedResponse(result.quotes, result.total, page, limit));
  } catch (err) { return handleError(err); }
}
export async function POST(request: Request) {
  try { return created(await createQuote(await getAuthContext(request), await request.json(), "rest", request)); }
  catch (err) { return handleError(err); }
}
