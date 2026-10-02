import { getAuthContext } from "@/lib/api/auth-context";
import { handleError, ok } from "@/lib/api/response";
import { getInvoiceSummary } from "@/lib/api/invoice-reads";

export async function GET(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    return ok(await getInvoiceSummary(ctx));
  } catch (err) {
    return handleError(err);
  }
}
