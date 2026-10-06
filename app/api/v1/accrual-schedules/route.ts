import { AuthError, getAuthContext } from "@/lib/api/auth-context";
import { handleError, created, ok } from "@/lib/api/response";
import { paginatedResponse } from "@/lib/api/pagination";
import { listAccrualSchedules, createAccrualSchedule } from "@/lib/api/accrual-schedules";
export async function GET(request: Request) {
  try {
    const ctx = await getAuthContext(request), query = new URL(request.url).searchParams;
    const result = await listAccrualSchedules(ctx, { status: query.get("status") ?? undefined,
      page: query.has("page") ? Number(query.get("page")) : undefined, limit: query.has("limit") ? Number(query.get("limit")) : undefined });
    return ok(paginatedResponse(result.schedules, result.total, result.page, result.limit));
  } catch (err) { return handleError(err); }
}
export async function POST(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    return created({ schedule: await createAccrualSchedule(ctx, await request.json(), "rest", request) });
  } catch (err) { return handleError(err instanceof SyntaxError ? new AuthError("Invalid JSON", 400) : err); }
}
