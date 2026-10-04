import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AuthContext } from "@/lib/api/auth-context";
import { wrapTool } from "@/lib/mcp/errors";
import { scheduledPaymentIdField, scheduledPaymentListFields, scheduledPaymentCreateFields, scheduledPaymentUpdateFields } from "@/lib/api/scheduled-payment-wire";
import { listScheduledPayments, getScheduledPayment, createScheduledPayment, updateScheduledPayment, deleteScheduledPayment, processScheduledPayments } from "@/lib/api/scheduled-payments";

export function registerScheduledPaymentTools(server: McpServer, ctx: AuthContext) {
  server.registerTool("list_scheduled_payments", {
    description: "List live organization scheduled payments, optionally filtered by status. Returns {data,pagination} with numeric integer minor-unit amount (USD cents), matching amountMinor strings, bill money *Minor and contact creditLimitMinor. Validates saved money and scoped references before disclosure.",
    inputSchema: z.object(scheduledPaymentListFields).strict(),
  }, params => wrapTool(ctx, () => listScheduledPayments(ctx, params)));
  server.registerTool("get_scheduled_payment", {
    description: "Get a live organization scheduled payment with bill and contact. Returns {scheduledPayment}, safe numeric minor-unit amount (USD cents), amountMinor and nested bill/contact exact aliases. Unsupported money or foreign relations fail explicitly.",
    inputSchema: z.object({ scheduledPaymentId: scheduledPaymentIdField }).strict(),
  }, params => wrapTool(ctx, () => getScheduledPayment(ctx, params.scheduledPaymentId)));
  server.registerTool("create_scheduled_payment", {
    description: "Schedule a recognized outstanding supplier bill with manage:payments. amount is positive integer minor units (USD cents); amountMinor is a matching canonical integer string. Currency defaults to USD and must match the bill. Checks ownership, date locks and overpayment. Schedule and audit commit atomically; no cash is posted. Returns {scheduledPayment} with exact aliases. Amounts must fit 1..9007199254740991.",
    inputSchema: z.object(scheduledPaymentCreateFields).strict(),
  }, params => wrapTool(ctx, () => createScheduledPayment(ctx, params)));
  server.registerTool("update_scheduled_payment", {
    description: "Edit a pending organization schedule or cancel it with manage:payments. Optional amount is integer minor units (USD cents), amountMinor its matching string; scheduledDate is Gregorian YYYY-MM-DD. Old/new dates must be open; no settlement/reversal occurs. Schedule and audit commit atomically. Returns {scheduledPayment} with numeric money and exact aliases.",
    inputSchema: z.object({ scheduledPaymentId: scheduledPaymentIdField, ...scheduledPaymentUpdateFields }).strict(),
  }, params => wrapTool(ctx, () => {
      const { scheduledPaymentId, ...input } = params; return updateScheduledPayment(ctx, scheduledPaymentId, input);
    }));
  server.registerTool("delete_scheduled_payment", {
    description: "Soft-delete a pending, cancelled or legacy failed organization schedule with manage:payments and an open posting date. Processing/completed schedules reject; reverse actual payments separately. Deletion/audit are atomic. Returns {success:true}; never changes bill balance or ledger.",
    inputSchema: z.object({ scheduledPaymentId: scheduledPaymentIdField }).strict(),
  }, params => wrapTool(ctx, () => deleteScheduledPayment(ctx, params.scheduledPaymentId)));
  server.registerTool("process_scheduled_payments", {
    description: "Process all live pending organization schedules due through today in UTC with manage:payments. Each posts one bank_transfer settlement via GL 1100 on its saved scheduledDate, retaining currency, exact carrying/FX and period locks. Payment/allocation/GL/bill/numbering/schedule completion/audits are atomic per item. Concurrent/repeated execution cannot duplicate cash. Failures remain pending for retry; legacy failed/processing rows are not retried. Returns {processed,total,skipped,failed,failures:[{scheduledPaymentId,status,error,code?}]} with counts only; successful other items remain committed.",
    inputSchema: z.object({}).strict(),
  }, () => wrapTool(ctx, () => processScheduledPayments(ctx)));
}
