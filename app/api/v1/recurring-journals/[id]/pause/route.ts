import { getAuthContext } from "@/lib/api/auth-context";
import { handleError, ok } from "@/lib/api/response";
import { pauseRecurringJournal } from "@/lib/api/recurring-journal";

/** Toggle without moving nextRunDate; resumed schedules catch up. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(request);
    return ok(await pauseRecurringJournal(ctx, (await params).id, request));
  } catch (err) { return handleError(err); }
}
