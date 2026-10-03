import { getAuthContext } from "@/lib/api/auth-context";
import { ok, handleError } from "@/lib/api/response";
import { bulkSendInvoices, bulkSendReminders, invoiceBulkSummary } from "@/lib/api/invoice-bulk";
import { invoiceBulkActionSchema, invoiceBulkJson } from "@/lib/api/invoice-bulk-wire";

export async function POST(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    const { action, invoiceIds } = invoiceBulkActionSchema.parse(await invoiceBulkJson(request));
    if (action === "send-reminder") return ok(await bulkSendReminders(ctx, invoiceIds, request));
    const sent = await bulkSendInvoices(ctx, invoiceIds, request, 200);
    const results = [...new Set(invoiceIds)].map(invoiceId => ({ invoiceId,
      status: sent.ids.includes(invoiceId) ? "sent" as const : "skipped" as const,
      ...(sent.ids.includes(invoiceId) ? {} : { message: "Not found or not draft" }) }));
    return ok({ action, results, summary: invoiceBulkSummary(results) });
  } catch (err) { return handleError(err); }
}
