import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { wrapTool } from "@/lib/mcp/errors";
import type { AuthContext } from "@/lib/api/auth-context";
import { listSalesReceipts, getSalesReceipt, createSalesReceipt, updateSalesReceipt, deleteSalesReceipt,
  postSalesReceipt, voidSalesReceipt } from "@/lib/api/sales-receipts";
import { salesReceiptCreateFields, salesReceiptUpdateFields, salesReceiptCashFields, salesReceiptListFields } from "@/lib/api/sales-receipt-wire";

/** Shared org-scoped Drizzle services; no HTTP self-calls. Numeric input prices retain major units. */
export function registerSalesReceiptTools(server: McpServer, ctx: AuthContext) {
  const id = { salesReceiptId: z.string().uuid().describe("UUID of a nondeleted sales receipt in this organization") };
  server.registerTool("list_sales_receipts", {
    description: "List cash-sale receipts by status/customer/date with pagination. Returns salesReceipts and total count. Money is integer currency minor units (USD cents), with *Minor strings; quantities are hundredths. Each receipt declares currencyCode.",
    inputSchema: z.strictObject(salesReceiptListFields),
  }, params => wrapTool(ctx, async () => listSalesReceipts(ctx, params)));
  server.registerTool("get_sales_receipt", {
    description: "Get a receipt with lines, contact, bank/deposit account and journal header. Returns {salesReceipt}; header/line/bank/contact money includes numeric minor-unit values and exact *Minor strings. Stored quantities are hundredths.",
    inputSchema: z.strictObject(id),
  }, params => wrapTool(ctx, async () => getSalesReceipt(ctx, params.salesReceiptId)));
  server.registerTool("create_sales_receipt", {
    description: "Create a draft cash sale. Numeric unitPrice and unitPriceExact string are decimal major units (USD 12.50); unitPriceMinor is an integer minor-unit string. Aliases must agree. Quantities are decimal physical units; discountPercent is basis points (1000 = 10%). Tax-exclusive totals use exact extended-price rounding. Omitted prices default to zero. Returns {salesReceipt} with numeric minor-unit amounts and *Minor strings; safe-integer range only. Currency defaults contact/org/USD. Bank takes precedence over deposit; neither uses Undeposited Funds at post time.",
    inputSchema: z.strictObject(salesReceiptCreateFields),
  }, params => wrapTool(ctx, async () => createSalesReceipt(ctx, params)));
  server.registerTool("update_sales_receipt", {
    description: "Edit only an unposted draft receipt. Optional complete replacement lines use numeric/exact major prices or unitPriceMinor strings, decimal quantities and basis-point discounts. Currency label edits never rescale retained amounts. Null clears optional fields. Returns {salesReceipt} with numeric minor-unit amounts and *Minor strings; safe-integer range only.",
    inputSchema: z.strictObject({ ...id, ...salesReceiptUpdateFields }),
  }, ({ salesReceiptId, ...input }) => wrapTool(ctx, async () => updateSalesReceipt(ctx, salesReceiptId, input)));
  server.registerTool("delete_sales_receipt", {
    description: "Soft-delete an unposted draft receipt in an unlocked period. Posted/void receipts cannot be deleted. Returns {success:true}.",
    inputSchema: z.strictObject(id),
  }, params => wrapTool(ctx, async () => deleteSalesReceipt(ctx, params.salesReceiptId)));
  server.registerTool("post_sales_receipt", {
    description: "Post an unposted draft receipt atomically: debit bank/deposit/Undeposited Funds, credit all revenue and tax, plus inventory/COGS. Skips Accounts Receivable. Optional cash overrides; bank currency must match the receipt. Uses historical FX that fits legacy millionths and safe-integer totals. Returns {salesReceipt}, status paid, numeric minor-unit money and *Minor strings. Repeated posting fails without effects.",
    inputSchema: z.strictObject({ ...id, ...salesReceiptCashFields }),
  }, ({ salesReceiptId, ...input }) => wrapTool(ctx, async () => postSalesReceipt(ctx, salesReceiptId, input)));
  server.registerTool("void_sales_receipt", {
    description: "Void a draft or paid receipt in an unlocked period. Paid receipts reverse saved ledger amounts/FX and linked inventory costs atomically, with reversal links; unqualified historical FX/unlinked inventory fails before commit. Returns {salesReceipt} with numeric minor-unit money and *Minor strings. Repeated void fails without effects.",
    inputSchema: z.strictObject(id),
  }, params => wrapTool(ctx, async () => voidSalesReceipt(ctx, params.salesReceiptId)));
}
