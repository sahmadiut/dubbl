import { getAuthContext } from "@/lib/api/auth-context";
import { handleError, ok, created } from "@/lib/api/response";
import { parsePagination } from "@/lib/api/pagination";
import { listExpenseClaims, createExpenseClaim } from "@/lib/api/expense-crud";
import { readExpenseJson } from "@/lib/api/expense-wire";

export async function GET(request: Request) {
  try {
    const ctx = await getAuthContext(request), url = new URL(request.url);
    const { page, limit } = parsePagination(url);
    return ok(await listExpenseClaims(ctx, { page, limit, status: url.searchParams.get("status") || undefined }));
  } catch (err) { return handleError(err); }
}
export async function POST(request: Request) {
  try { return created(await createExpenseClaim(await getAuthContext(request), await readExpenseJson(request), "rest", request)); }
  catch (err) { return handleError(err); }
}
