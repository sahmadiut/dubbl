import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { AuthContext } from "@/lib/api/auth-context";
import { wrapTool } from "@/lib/mcp/errors";
import { sendInvoice, voidInvoice, invoiceBadDebt, chargeInvoiceInterest, calculateInvoiceInterest, submitInvoiceApproval, actInvoiceApproval } from "@/lib/api/invoice-lifecycle";
import { interestFields, recoveryFields, writeOffFields, approveFields, rejectFields } from "@/lib/api/invoice-lifecycle-wire";

export function registerInvoiceLifecycleTools(server: McpServer, ctx: AuthContext) {
  const invoiceId = z.string().uuid().describe("Organization-owned invoice UUID; deleted or foreign invoices return 404");
  server.registerTool("send_invoice", {
    description: "Send an unposted draft invoice: atomically recognize AR/revenue/tax, issue stock and post COGS, freeze sender/recipient and mark sent. Requires approve:invoices, unlocked date, complete active accounts and safe numeric money/FX. Returns invoice with numeric minor amounts plus *Minor strings. Email delivery is a separate operation.",
    inputSchema: z.strictObject({ invoiceId }),
  }, params => wrapTool(ctx, () => sendInvoice(ctx, params.invoiceId)));
  server.registerTool("void_invoice", {
    description: "Void an unsettled invoice. Requires approve:invoices and unlocked issue date. Posted invoices reverse saved ledger amounts/FX and restock atomically; drafts do not restock. Cancels pending approval. Returns invoice with numeric minor amounts plus *Minor strings.",
    inputSchema: z.strictObject({ invoiceId }),
  }, params => wrapTool(ctx, () => voidInvoice(ctx, params.invoiceId)));
  server.registerTool("write_off_invoice", {
    description: "Write off the outstanding balance of a sent/partial/overdue invoice using direct or allowance method. Requires approve:invoices and unlocked date; atomically posts converted balanced loss/AR and marks written off/void. Returns invoice, amountWrittenOff in numeric invoice minor units, amountWrittenOffMinor string and method.",
    inputSchema: z.strictObject({ invoiceId, ...writeOffFields }),
  }, params => wrapTool(ctx, () => invoiceBadDebt(ctx, params.invoiceId, { ...params, action: "write-off" })));
  server.registerTool("recover_written_off_invoice", {
    description: "Post recovered cash on a written-off invoice as bank debit and recovery income credit. Numeric amount is integer invoice minor units (USD cents), amountMinor is its exact alias; omitted defaults to invoice total. Requires approve:invoices and unlocked date. Returns unchanged invoice and recovered/recoveredMinor. Each call records another recovery.",
    inputSchema: z.strictObject({ invoiceId, ...recoveryFields }),
  }, params => wrapTool(ctx, () => invoiceBadDebt(ctx, params.invoiceId, { ...params, action: "recover" })));
  server.registerTool("calculate_invoice_interest", {
    description: "Preview configured simple or daily compound annual basis-point interest for this organization's overdue sent/partial invoices, after grace days. Exact arithmetic rounds once. Returns data rows with invoiceId/number/currency, daysOverdue, amountDue/interestAmount in numeric minor units and *Minor strings; safe range and at most 36500 days.",
    inputSchema: z.strictObject({}),
  }, () => wrapTool(ctx, () => calculateInvoiceInterest(ctx)));
  server.registerTool("charge_invoice_interest", {
    description: "Create and post a new interest invoice atomically for an overdue sent/partial invoice. Requires manage:invoices, configured annual basis-point rate, grace expiry, unlocked original/today dates, AR 1200 and interest 4100. amount/amountExact are major units; amountMinor is integer minor units. Returns invoice, journalEntry, originalInvoiceId, daysOverdue and interestAmount/interestAmountMinor. Each call creates another charge.",
    inputSchema: z.strictObject({ invoiceId, ...interestFields }),
  }, params => wrapTool(ctx, () => chargeInvoiceInterest(ctx, params.invoiceId, params)));
  server.registerTool("submit_invoice_for_approval", {
    description: "Submit an organization draft invoice to a matching active workflow. Requires manage:invoices and unlocked date; request and pending_approval status commit atomically. Returns invoice with numeric minor amounts and *Minor strings.",
    inputSchema: z.strictObject({ invoiceId }),
  }, params => wrapTool(ctx, () => submitInvoiceApproval(ctx, params.invoiceId)));
  server.registerTool("approve_invoice", {
    description: "Approve the assigned current workflow step of a pending invoice. Requires approve:invoices and unlocked date. Final approval returns invoice to draft; earlier steps retain pending_approval. Action/request/invoice changes commit atomically. Returns invoice with *Minor aliases and request.",
    inputSchema: z.strictObject({ invoiceId, ...approveFields }),
  }, params => wrapTool(ctx, () => actInvoiceApproval(ctx, params.invoiceId, "approve", params)));
  server.registerTool("reject_invoice", {
    description: "Reject the assigned current workflow step of a pending invoice. Requires approve:invoices and unlocked date; atomically records rejection and marks request/invoice rejected. Returns invoice with numeric minor amounts, *Minor strings and request.",
    inputSchema: z.strictObject({ invoiceId, ...rejectFields }),
  }, params => wrapTool(ctx, () => actInvoiceApproval(ctx, params.invoiceId, "reject", params)));
}
