import { getAuthContext } from "@/lib/api/auth-context";
import { ok, handleError } from "@/lib/api/response";
import { queryInput } from "@/lib/api/inventory-movement-wire";
import { movementChart } from "@/lib/api/inventory-movements";

export async function GET(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    return ok(await movementChart(ctx, queryInput(request)));
  } catch (error) { return handleError(error); }
}
