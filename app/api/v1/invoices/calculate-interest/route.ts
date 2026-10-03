import { getAuthContext } from "@/lib/api/auth-context";
import { ok, handleError } from "@/lib/api/response";
import { calculateInvoiceInterest } from "@/lib/api/invoice-lifecycle";

export async function POST(request: Request) {
  try { return ok(await calculateInvoiceInterest(await getAuthContext(request))); }
  catch (err) { return handleError(err); }
}
