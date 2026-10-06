import { getAuthContext } from "@/lib/api/auth-context";
import { handleError, ok } from "@/lib/api/response";
import { getRevenueSchedule, cancelRevenueSchedule } from "@/lib/api/revenue-schedules";
type Params = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Params) {
  try { const ctx = await getAuthContext(request), { id } = await params;
    return ok({ schedule: await getRevenueSchedule(ctx, id) });
  } catch (err) { return handleError(err); }
}
export async function DELETE(request: Request, { params }: Params) {
  try { const ctx = await getAuthContext(request), { id } = await params;
    await cancelRevenueSchedule(ctx, id, request); return ok({ success: true });
  } catch (err) { return handleError(err); }
}
