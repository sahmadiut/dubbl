import { recordPaymentBatch } from "@/lib/api/payment-batches";
import { immediateBatchFields } from "@/lib/api/payment-batch-wire";
import { deletePayment } from "@/lib/api/payment-reversals";
import { paymentDeleteFields } from "@/lib/api/payment-reversal-wire";
import { createSettlementPayment } from "@/lib/api/payment-settlements";
import { paymentCreateFields } from "@/lib/api/payment-settlement-wire";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { wrapTool } from "@/lib/mcp/errors";
import { listPayments, getPayment } from "@/lib/api/payment-reads";
import { paymentListFields } from "@/lib/api/payment-read-wire";
import { AuthError } from "@/lib/api/auth-context";
import type { AuthContext } from "@/lib/api/auth-context";

/**
 * MCP tools for standalone payment records â€” a single cash
 * movement (money received from a customer or paid to a supplier) that settles
 * one or more invoices (type "received", AR) or bills (type "made", AP) via
 * allocations. These are the same records as the /api/v1/payments REST routes.
 *
 * pay_invoice / pay_bill use the same settlement service for one document.
 * Bank transfers use record_bank_transfer. Settlement creates the payment,
 * its allocations, the document balance/status updates, AND the GL journal
 * entry (DR Bank / CR AR for received; DR AP / CR Bank for made), all in one
 * atomic transaction, exactly like the REST routes.
 *
 * Settlement money uses integer document-currency minor units (USD cents),
 * with additive amountMinor strings. The legacy exception is record_payment_batch,
 * whose allocation `amount` is a DECIMAL number of currency units (e.g. 12.50),
 * mirroring the batch REST route which uses the document currency scale. Direct DB
 * access via Drizzle (no HTTP self-calls); org-scoped via the AuthContext.
 */
export function registerPaymentTools(server: McpServer, ctx: AuthContext) {
  server.registerTool("list_payments", {
    description: "List organization-scoped payments with optional direction/contact filters and pagination. Returns payments, total count, page and limit. Payment/allocation amount is an integer in existing currency minor units (USD cents); amountMinor is the exact string alias. Includes contact creditLimitMinor. Signed safe-integer history and noncash credit/debit-note carriers retain their units. Unsupported ranges or tenant references fail explicitly.",
    inputSchema: z.object(paymentListFields).strict(),
  }, params => wrapTool(ctx, async () => listPayments(ctx, params))
  );

  server.registerTool("get_payment", {
    description: "Get one organization-scoped payment by UUID with contact, bank account and allocations. Returns {payment}; numeric minor-unit money (USD cents) keeps its type and adds amountMinor, creditLimitMinor, balanceMinor and nullable lowBalanceThresholdMinor. Includes noncash paired allocations without summing or converting them. Missing/deleted payments return 404; unsupported ranges or tenant references fail explicitly.",
    inputSchema: z.object({ paymentId: z.string().uuid().describe("UUID of the payment in the authenticated organization") }).strict(),
  }, params => wrapTool(ctx, async () => {
      const result = await getPayment(ctx, params.paymentId);
      if (!result) throw new AuthError("Payment not found", 404);
      return result;
    })
  );

  server.registerTool("create_payment", {
    description: "Create one cash payment with fully covering, distinct invoice (received) or bill (made) allocations for one contact/currency. amount is a positive safe integer in document minor units (USD cents); amountMinor is a canonical matching string, also supported on allocations. Checks manage:payments, recognition/carrying FX, bank ownership/currency, period locks and outstanding balances. Atomically posts cash/control/realised FX, updates documents and audits; optional idempotencyKey replays the original result. Returns {payment} with numeric money and amountMinor aliases. Unapplied cash and unqualified historical carrying values fail before commit.",
    inputSchema: z.object(paymentCreateFields).strict(),
  }, params => wrapTool(ctx, () => createSettlementPayment(ctx, params))
  );

  server.registerTool("record_payment_batch", {
    description: "Record ONE cash payment settling 1-1000 distinct documents for one contact/currency. Allocation amount is legacy DECIMAL MAJOR units (USD 12.50), amountExact an exact decimal-major string, amountMinor a positive integer minor string; aliases must agree after currency-scale rounding. Total is the safe bigint sum of rounded allocations. Checks manage:payments, recognition/carrying FX, active bank/currency, period locks and overpayment. Payment/allocations/balances/GL/audit commit together. Optional idempotencyKey replays the original result. Returns {payment} with safe numeric minor amounts and amountMinor strings.",
    inputSchema: z.object(immediateBatchFields).strict(),
  }, params => wrapTool(ctx, () => recordPaymentBatch(ctx, params))
  );

  server.registerTool("delete_payment", {
    description: "Reverse one live organization payment by UUID with manage:payments. Restores invoice/bill and paired credit/debit-note/prepayment balances in original currency minor units (USD cents), reverses saved cash/application GL and exact FX verbatim, then soft-deletes and audits atomically. Returns {success:true}; no money input. Safe numeric history adds exact aliases in audit. Locked dates, inconsistent/foreign history and unsupported ranges fail without writes. Bank-matched/provider-backed payments require unmatch/refund first. Repeating deletion returns 404.",
    inputSchema: z.object(paymentDeleteFields).strict(),
  }, params => wrapTool(ctx, () => deletePayment(ctx, params.paymentId))
  );
}
