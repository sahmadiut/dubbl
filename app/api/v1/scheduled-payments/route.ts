import { getAuthContext } from "@/lib/api/auth-context";
import { handleError, ok, created } from "@/lib/api/response";
import { parsePagination } from "@/lib/api/pagination";
import { listScheduledPayments, createScheduledPayment } from "@/lib/api/scheduled-payments";

export async function GET(request: Request) {
  try {
    const ctx = await getAuthContext(request), url = new URL(request.url);
    const { page, limit } = parsePagination(url);
    return ok(await listScheduledPayments(ctx, { page, limit, status: url.searchParams.get("status") ?? undefined }));
  } catch (err) { return handleError(err); }
}
export async function POST(request: Request) {
  try { return created(await createScheduledPayment(await getAuthContext(request), await request.json(), request)); }
  catch (err) { return handleError(err); }
}
