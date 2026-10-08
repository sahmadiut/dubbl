import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AuthContext } from "@/lib/api/auth-context";
import { wrapTool } from "@/lib/mcp/errors";
import { importInvoices, previewInvoiceImport, bulkSendInvoices, bulkMarkInvoicesPaid, bulkSendReminders } from "@/lib/api/invoice-bulk";
import { mcpInvoiceImportFields, invoiceImportSchema, invoiceBulkIdsFields, invoiceReminderFields } from "@/lib/api/invoice-bulk-wire";

export function registerInvoiceBulkTools(server: McpServer, ctx: AuthContext) {
  server.registerTool("import_invoices", {
    description: "Import draft invoice documents (nested lines) or flat mapped CSV lines grouped by invoiceNumber, otherwise contact/date/reference. Numeric unitPrice/lineUnitPrice is decimal major units (12.50 USD); exact unitPriceExact/lineUnitPriceExact is decimal text; unitPriceMinor/lineUnitPriceMinor is integer currency minor text (1250 USD). Aliases must agree and all monetary values/products/sums must fit safe integers. Currency defaults USD; explicit currency controls its minor-unit scale. Requires manage:invoices. Invalid wire money fails before job creation; tenant/reference/period errors are per-document job errors. Each document and number is atomic; retries create new documents. Returns {job} with document counts and errors.",
    inputSchema: z.strictObject({ ...mcpInvoiceImportFields, fileName: invoiceImportSchema.shape.fileName }),
  }, params => wrapTool(ctx, () => importInvoices(ctx, params)));
  server.registerTool("preview_invoice_import", {
    description: "Preview the same grouped/nested invoice import without writes. Uses decimal major numeric prices and exact major/minor aliases, defaults USD, checks owned references and exact totals. Returns preview rows, validCount and totalCount; valid rows include safe numeric subtotal/taxTotal/total and canonical Minor aliases. Import rechecks permissions, period locks and plan limits. Flat CSV prices must be canonical decimal text.",
    inputSchema: z.strictObject(mcpInvoiceImportFields),
  }, params => wrapTool(ctx, () => previewInvoiceImport(ctx, params)));
  server.registerTool("bulk_mark_invoices_sent", {
    description: "Recognize selected draft invoices with revenue/tax/COGS journals, frozen snapshots and saved exact FX in one atomic batch. Requires approve:invoices. Foreign, deleted and non-draft IDs are ignored; any invalid eligible document rolls back the whole batch. Sends no email. Repeating after success updates zero drafts. Returns {updated, ids}. All saved amounts must be safe integer currency minor units.",
    inputSchema: z.strictObject(invoiceBulkIdsFields),
  }, params => wrapTool(ctx, () => bulkSendInvoices(ctx, params.ids)));
  server.registerTool("bulk_mark_invoices_paid", {
    description: "Compatibility status annotation for invoices already settled outside Dubbl: sets paid/amountPaid=total/amountDue=0. This records NO payment, allocation or settlement journal; use payment tools for accounting settlement. Requires manage:invoices. Only sent/partial/overdue owned non-deleted documents qualify; other IDs/statuses are ignored. Validates safe minor-unit balances and issue-date period locks, updates atomically and is repeat-safe. Returns {updated}.",
    inputSchema: z.strictObject(invoiceBulkIdsFields),
  }, params => wrapTool(ctx, () => bulkMarkInvoicesPaid(ctx, params.ids)));
  server.registerTool("bulk_send_invoice_reminders", {
    description: "Send one reminder per owned invoice with an outstanding safe integer minor-unit balance. Requires manage:recurring and verified organization email. Preflights all saved money/references before delivery; skips foreign/deleted/non-owed/no-email invoices. Delivery failures are per-item; successful delivery logs and increments dunning. Repeating may send another reminder (no delivery idempotency key). Returns action, per-invoice sent/skipped/failed results and counts.",
    inputSchema: z.strictObject(invoiceReminderFields),
  }, params => wrapTool(ctx, () => bulkSendReminders(ctx, params.invoiceIds)));
}
