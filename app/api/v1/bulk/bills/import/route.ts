import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { jsonResponse } from "@/lib/api/json-response";
import { invoiceBulkJson } from "@/lib/api/invoice-bulk-wire";
import { importBills } from "@/lib/api/bill-bulk";

export async function POST(request: Request) {
  try { return jsonResponse(await importBills(await getAuthContext(request), await invoiceBulkJson(request), request), { status: 201 }); }
  catch (err) { return handleError(err); }
}
