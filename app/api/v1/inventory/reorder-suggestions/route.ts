import { getAuthContext } from "@/lib/api/auth-context";
import { handleError, ok } from "@/lib/api/response";
import { reorderInventorySuggestions } from "@/lib/api/inventory-master";
export async function GET(request: Request) {
  try { return ok({ data: await reorderInventorySuggestions(await getAuthContext(request)) }); }
  catch (error) { return handleError(error); }
}
