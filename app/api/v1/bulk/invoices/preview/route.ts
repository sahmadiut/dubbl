import { getAuthContext } from "@/lib/api/auth-context";
import { ok, handleError } from "@/lib/api/response";
import { previewInvoiceImport } from "@/lib/api/invoice-bulk";
import { invoiceBulkJson } from "@/lib/api/invoice-bulk-wire";

export async function POST(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    return ok(await previewInvoiceImport(ctx, await invoiceBulkJson(request)));
  } catch (err) { return handleError(err); }
}
