import { getAuthContext } from "@/lib/api/auth-context";
import { jsonResponse } from "@/lib/api/json-response";
import { handleError } from "@/lib/api/response";
import { listBudgets, configureBudget } from "@/lib/ai/usage";
export async function GET(request: Request) {
  try { return jsonResponse({ budgets: await listBudgets(await getAuthContext(request)) }); } catch (err) { return handleError(err); }
}
export async function PUT(request: Request) {
  try { const ctx = await getAuthContext(request); return jsonResponse(await configureBudget(ctx, await request.json())); } catch (err) { return handleError(err); }
}
