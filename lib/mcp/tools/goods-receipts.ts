import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AuthContext } from "@/lib/api/auth-context";
import { wrapTool } from "@/lib/mcp/errors";
import { goodsReceiptCreateFields, goodsReceiptListFields, goodsReceiptIdFields } from "@/lib/api/goods-receipt-wire";
import { receiveGoodsReceipt, listGoodsReceipts, getGoodsReceipt, createBillFromGoodsReceipt } from "@/lib/api/goods-receipts";

export function registerGoodsReceiptTools(server: McpServer, ctx: AuthContext) {
  server.tool("receive_goods_receipt",
    "Receive goods against an organization-owned purchase order atomically. Input quantity/quantityExact is physical units; stock requires whole units. Saved PO costs are integer currency minor units (USD cents). Returns receipt with unitCostMinor and quantityReceivedExact aliases, posted GRNI journal ID (null for zero value), and PO status. Stock valuation uses saved receipt-date FX; unsupported ranges or FIFO rounding reject without writes.",
    goodsReceiptCreateFields, params => wrapTool(ctx, () => receiveGoodsReceipt(ctx, params)));
  server.tool("list_purchase_goods_receipts",
    "List organization-owned receipts with supplier and lines, filtered by PO/status. Returns goodsReceipts, total, page, limit. Numeric quantities remain hundredths (500 = 5 units); quantityReceivedExact is physical units; unitCost/unitCostMinor are PO currency minor units.",
    goodsReceiptListFields, params => wrapTool(ctx, () => listGoodsReceipts(ctx, params)));
  server.tool("get_goods_receipt",
    "Get an organization-owned receipt with supplier, PO, stock/warehouse/PO-line relations. Returns goodsReceipt with numeric minor-unit costs and exact Minor string aliases; quantities remain hundredths with physical quantityReceivedExact aliases.",
    goodsReceiptIdFields, params => wrapTool(ctx, () => getGoodsReceipt(ctx, params.goodsReceiptId)));
  server.tool("create_bill_from_goods_receipt",
    "Create a draft bill atomically from a received organization-owned receipt. Copies saved received quantities and PO-currency minor-unit costs; line amounts round quantity times cost to minor units with no tax. Dates default today UTC. Returns bill with numeric balances and Minor aliases. Active linked bills prevent repeat conversion; void the prior bill first. Posting/GRNI clearing is a separate operation.",
    goodsReceiptIdFields, params => wrapTool(ctx, () => createBillFromGoodsReceipt(ctx, params.goodsReceiptId)));
}
