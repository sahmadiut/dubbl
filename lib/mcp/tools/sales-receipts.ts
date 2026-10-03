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
  server.tool("list_sales_receipts", "List cash-sale receipts by status/customer/date with pagination. Returns salesReceipts and total count. Money is integer currency minor units (USD cents), with *Minor strings; quantities are hundredths. Each receipt declares currencyCode.",
    salesReceiptListFields, params => wrapTool(ctx, async () => listSalesReceipts(ctx, params)));
  server.tool("get_sales_receipt", "Get a receipt with lines, contact, bank/deposit account and journal header. Returns {salesReceipt}; header/line/bank/contact money includes numeric minor-unit values and exact *Minor strings. Stored quantities are hundredths.",
    id, params => wrapTool(ctx, async () => getSalesReceipt(ctx, params.salesReceiptId)));
  server.tool("create_sales_receipt", "Create a draft cash sale. Numeric unitPrice and unitPriceExact string are decimal major units (USD 12.50); unitPriceMinor is an integer minor-unit string. Aliases must agree. Quantities are decimal physical units; discountPercent is basis points (1000 = 10%). Tax-exclusive totals use exact extended-price rounding. Omitted prices default to zero. Returns {salesReceipt} with numeric minor-unit amounts and *Minor strings; safe-integer range only. Currency defaults contact/org/USD. Bank takes precedence over deposit; neither uses Undeposited Funds at post time.",
    salesReceiptCreateFields, params => wrapTool(ctx, async () => createSalesReceipt(ctx, params)));
  server.tool("update_sales_receipt", "Edit only an unposted draft receipt. Optional complete replacement lines use numeric/exact major prices or unitPriceMinor strings, decimal quantities and basis-point discounts. Currency label edits never rescale retained amounts. Null clears optional fields. Returns {salesReceipt} with numeric minor-unit amounts and *Minor strings; safe-integer range only.",
    { ...id, ...salesReceiptUpdateFields }, ({ salesReceiptId, ...input }) => wrapTool(ctx, async () => updateSalesReceipt(ctx, salesReceiptId, input)));
  server.tool("delete_sales_receipt", "Soft-delete an unposted draft receipt in an unlocked period. Posted/void receipts cannot be deleted. Returns {success:true}.",
    id, params => wrapTool(ctx, async () => deleteSalesReceipt(ctx, params.salesReceiptId)));
  server.tool("post_sales_receipt", "Post an unposted draft receipt atomically: debit bank/deposit/Undeposited Funds, credit all revenue and tax, plus inventory/COGS. Skips Accounts Receivable. Optional cash overrides; bank currency must match the receipt. Uses historical FX that fits legacy millionths and safe-integer totals. Returns {salesReceipt}, status paid, numeric minor-unit money and *Minor strings. Repeated posting fails without effects.",
    { ...id, ...salesReceiptCashFields }, ({ salesReceiptId, ...input }) => wrapTool(ctx, async () => postSalesReceipt(ctx, salesReceiptId, input)));
  server.tool("void_sales_receipt", "Void a draft or paid receipt in an unlocked period. Paid receipts reverse saved ledger amounts/FX and linked inventory costs atomically, with reversal links; unqualified historical FX/unlinked inventory fails before commit. Returns {salesReceipt} with numeric minor-unit money and *Minor strings. Repeated void fails without effects.",
    id, params => wrapTool(ctx, async () => voidSalesReceipt(ctx, params.salesReceiptId)));
}
