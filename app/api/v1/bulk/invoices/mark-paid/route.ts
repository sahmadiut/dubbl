import { getAuthContext } from "@/lib/api/auth-context";
import { ok, handleError } from "@/lib/api/response";
import { bulkMarkInvoicesPaid } from "@/lib/api/invoice-bulk";
import { invoiceBulkJson, invoiceBulkIdsFields } from "@/lib/api/invoice-bulk-wire";
import { z } from "zod";

export async function POST(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    return ok(await bulkMarkInvoicesPaid(ctx, z.object(invoiceBulkIdsFields).parse(await invoiceBulkJson(request)).ids, request));
  } catch (err) { return handleError(err); }
}
