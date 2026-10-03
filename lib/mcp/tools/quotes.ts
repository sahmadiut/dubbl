import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { wrapTool } from "@/lib/mcp/errors";
import type { AuthContext } from "@/lib/api/auth-context";
import { listQuotes, getQuote, createQuote, updateQuote, deleteQuote, sendQuote, acceptQuote, declineQuote, convertQuote } from "@/lib/api/quotes";
import { quoteListFields, quoteMcpCreateFields, quoteMcpUpdateFields, quoteConvertFields } from "@/lib/api/quote-wire";

const quoteId = z.string().uuid().describe("UUID of the quote owned by this organization");
const money = "Returns safe integer currency minor-unit amounts (USD cents) with matching *Minor strings; unsupported safe-number ranges fail with 422.";
export function registerQuoteTools(server: McpServer, ctx: AuthContext) {
  server.tool("list_quotes", `List organization quotes with contact and total count. ${money}`, quoteListFields,
    params => wrapTool(ctx, () => listQuotes(ctx, params)));
  server.tool("get_quote", `Get an organization quote with contact, accounts, tax rates and lines. Line quantity is integer hundredths, discount is basis points. ${money}`,
    { quoteId }, params => wrapTool(ctx, () => getQuote(ctx, params.quoteId)));
  server.tool("create_quote", `Create a draft quote. Numeric unitPrice is integer currency minor units; unitPriceExact is decimal major units and unitPriceMinor is an integer minor-unit string. Quantity is physical units; discount is basis points. Omitted item prices resolve from a price list or item default; item IDs are used for lookup only. Tax is exclusive. ${money}`,
    quoteMcpCreateFields, params => wrapTool(ctx, () => createQuote(ctx, params, "mcp")));
  server.tool("update_quote", `Update permitted draft quote headers or replace lines. Retained monetary amounts are not rescaled by currency edits. Replacement lines use create price units; missing prices are zero. ${money}`,
    { quoteId, ...quoteMcpUpdateFields }, ({ quoteId, ...fields }) => wrapTool(ctx, () => updateQuote(ctx, quoteId, fields, "mcp")));
  server.tool("delete_quote", "Soft-delete an organization draft quote and remove its lines atomically. Returns success: true.",
    { quoteId }, params => wrapTool(ctx, () => deleteQuote(ctx, params.quoteId)));
  server.tool("send_quote", `Mark a draft quote as sent and stamp sentAt. Records the send without sending email. ${money}`,
    { quoteId }, params => wrapTool(ctx, () => sendQuote(ctx, params.quoteId)));
  server.tool("accept_quote", `Accept a sent quote whose Gregorian expiry date is today or later (UTC). ${money}`,
    { quoteId }, params => wrapTool(ctx, () => acceptQuote(ctx, params.quoteId)));
  server.tool("decline_quote", `Decline a sent organization quote. ${money}`,
    { quoteId }, params => wrapTool(ctx, () => declineQuote(ctx, params.quoteId)));
  server.tool("convert_quote_to_invoice", `Convert an accepted quote to a draft invoice. Nonempty milestone lines take precedence over percentage. Percentage bills a share of original total; omission bills the exact remaining balance. Overbilling is rejected. Returns quote, invoice and billing {invoiced, billedTotal, remaining, fullyBilled}, with numeric minor amounts and matching *Minor strings. ${money}`,
    { quoteId, ...quoteConvertFields }, ({ quoteId, ...fields }) => wrapTool(ctx, () => convertQuote(ctx, quoteId, fields)));
}
