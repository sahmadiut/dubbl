import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AuthContext } from "@/lib/api/auth-context";
import { wrapTool } from "@/lib/mcp/errors";
import { batchIdField, batchListFields, batchCreateFields, batchUpdateFields } from "@/lib/api/payment-batch-wire";
import { listPaymentBatches, getPaymentBatch, createPaymentBatch, updatePaymentBatch, submitPaymentBatch } from "@/lib/api/payment-batches";

export function registerPaymentBatchTools(server: McpServer, ctx: AuthContext) {
  server.tool("list_payment_batches",
    "List live organization payment batches with pagination. Returns {data,pagination}; totalAmount and item amount are safe integer currency minor units (USD cents), with totalAmountMinor/amountMinor strings. Items and references are validated before disclosure.",
    batchListFields, params => wrapTool(ctx, () => listPaymentBatches(ctx, params)));
  server.tool("get_payment_batch",
    "Get one live organization batch with item bills and contacts. Returns {batch}, retaining numeric minor amounts and adding totalAmountMinor, amountMinor, bill money *Minor and creditLimitMinor. Foreign references and unsupported ranges fail explicitly.",
    { batchId: batchIdField }, params => wrapTool(ctx, () => getPaymentBatch(ctx, params.batchId)));
  server.tool("create_payment_batch",
    "Create a draft supplier payment batch with 1-1000 distinct recognized outstanding bills in one currency. Item amount is integer minor units (USD cents), amountMinor a positive matching string. Defaults batch/item currency to USD. Checks manage:payments, ownership, contact/currency, overpayment and safe total. Header/items/audit commit atomically. Returns {batch}; no cash is posted until submission.",
    batchCreateFields, params => wrapTool(ctx, () => createPaymentBatch(ctx, params)));
  server.tool("update_payment_batch",
    "Atomically edit a draft organization batch name and add/remove items with manage:payments. Item amount is integer minor units (USD cents), amountMinor the matching string. Removal UUIDs must belong to this batch; final items must remain distinct, nonempty and same currency. Returns {batch} with expanded bills/contacts and *Minor strings; no settlement.",
    { batchId: batchIdField, ...batchUpdateFields }, params => wrapTool(ctx, () => {
      const { batchId, ...input } = params; return updatePaymentBatch(ctx, batchId, input);
    }));
  server.tool("submit_payment_batch",
    "Settle every pending item of a draft batch on today's UTC Gregorian date with manage:payments. Creates one bank_transfer payment per bill using GL 1100, exact saved carrying and payment-date FX. Payment/GL/balance/status/audit/batch completion commit in one transaction; any failure leaves the draft unchanged. Returns {batch,processed,total} with numeric minor money and *Minor strings. Concurrent/repeated submissions cannot duplicate cash; completed batches reject with 400.",
    { batchId: batchIdField }, params => wrapTool(ctx, () => submitPaymentBatch(ctx, params.batchId)));
}
