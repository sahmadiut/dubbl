import { getAuthContext } from "@/lib/api/auth-context";
import { created, handleError } from "@/lib/api/response";
import { importInvoices } from "@/lib/api/invoice-bulk";
import { invoiceBulkJson } from "@/lib/api/invoice-bulk-wire";

export async function POST(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    return created(await importInvoices(ctx, await invoiceBulkJson(request), request));
  } catch (err) { return handleError(err); }
}
