import { getAuthContext } from "@/lib/api/auth-context";
import { checkBudgetAlerts } from "@/lib/api/budget-alerts";
import { jsonResponse } from "@/lib/api/json-response";
import { handleError } from "@/lib/api/response";

export async function POST(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    return jsonResponse(await checkBudgetAlerts(ctx, await request.json()));
  } catch (err) { return handleError(err); }
}
