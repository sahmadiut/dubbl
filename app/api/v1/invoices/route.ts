import { listInvoices } from "@/lib/api/invoice-reads";
import { createInvoice, InvoiceCreditLimitError } from "@/lib/api/invoice-writes";
import { jsonResponse } from "@/lib/api/json-response";
import { getAuthContext } from "@/lib/api/auth-context";
import { requireRole } from "@/lib/api/require-role";
import { handleError } from "@/lib/api/response";
import { parsePagination, paginatedResponse } from "@/lib/api/pagination";

export async function GET(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    const url = new URL(request.url);
    const { page, limit } = parsePagination(url);
    const result = await listInvoices(ctx, {
      page, limit, status: url.searchParams.get("status") || undefined,
      contactId: url.searchParams.get("contactId") || undefined,
      startDate: url.searchParams.get("from") || undefined,
      endDate: url.searchParams.get("to") || undefined,
      sortBy: url.searchParams.get("sortBy") || undefined,
      sortOrder: url.searchParams.get("sortOrder") || undefined,
    });
    return jsonResponse(paginatedResponse(result.invoices, result.total, result.page, result.limit));
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    requireRole(ctx, "manage:invoices");
    return jsonResponse(await createInvoice(ctx, await request.json(), "rest", request), { status: 201 });
  } catch (err) {
    if (err instanceof InvoiceCreditLimitError) return jsonResponse({ error: err.message, creditLimitWarning: err.creditLimitWarning }, { status: 403 });
    return handleError(err);
  }
}
