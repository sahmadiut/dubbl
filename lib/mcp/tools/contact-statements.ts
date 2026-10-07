import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AuthContext } from "@/lib/api/auth-context";
import { wrapTool } from "@/lib/mcp/errors";
import { getContactStatement } from "@/lib/api/contact-statements";
import { getContactActivity } from "@/lib/api/contact-activity";
import { renderContactStatement, sendContactStatement } from "@/lib/api/contact-statement-delivery";
import { contactIdSchema, statementFields, activityFields } from "@/lib/api/contact-statement-wire";

export function registerContactStatementTools(server: McpServer, ctx: AuthContext) {
  const units = "Requires view:data. Gregorian inclusive dates default to one UTC year ago through today; optional single currencyCode filters documents without FX. Numeric integer currency minor units (USD cents) with matching *Minor strings; safe +/-9007199254740991. Mixed currencies and unsupported stored/output values reject.";
  server.registerTool("get_contact_statement", { description: "Read an owned live contact statement; positive balance means the customer owes us, supplier debt is negative. Returns contact, dates, currencyCode, openingBalance, transactions, totalDebit/totalCredit and closingBalance. " + units,
    inputSchema: { contactId: contactIdSchema, ...statementFields } }, params => wrapTool(ctx, () => {
      const { contactId, ...input } = params;
      return getContactStatement(ctx, contactId, input).then(r => r.data);
    }));
  server.registerTool("get_purchasing_supplier_statement", { description: "Read the supplier side only; positive balance means we owe the supplier. Bills increase credit/balance, payments and debit notes reduce it; carrier payments excluded. Returns {statement} with contact, dates, balances, transactions, totalBilled and totalPaidOrCredited. " + units,
    inputSchema: { contactId: contactIdSchema, ...statementFields } }, params => wrapTool(ctx, () => {
      const { contactId, ...input } = params;
      return getContactStatement(ctx, contactId, input, true).then(r => ({ statement: r.data }));
    }));
  server.registerTool("get_contact_activity", { description: "Read scoped invoice, quote, credit_note, payment and bill activity, including drafts. Returns {activity,nextCursor,hasMore}; amount integer currency minor units (USD cents), amountMinor exact string and per-item currencyCode, no aggregate/FX. Requires view:data; limit 1-100 default 30, exclusive createdAt cursor; timestamp ties retain legacy pagination semantics.",
    inputSchema: { contactId: contactIdSchema, ...activityFields } }, params => wrapTool(ctx, () => {
      const { contactId, ...input } = params;
      return getContactActivity(ctx, contactId, input);
    }));
  server.registerTool("export_contact_statement", { description: "Return {html,mimeType} for the existing printable statement HTML, usable with Print / Save PDF. All contact/reference text is escaped; display uses currency scale and exact money formatting. " + units,
    inputSchema: { contactId: contactIdSchema, ...statementFields } }, params => wrapTool(ctx, async () => {
      const { contactId, ...input } = params;
      return { html: renderContactStatement(await getContactStatement(ctx, contactId, input)), mimeType: "text/html; charset=utf-8" };
    }));
  server.registerTool("email_contact_statement", { description: "Email the shared contact statement to its saved email using organization SMTP. Requires manage:contacts and view:data. Dates/currency/money and escaped HTML preflight before delivery. Returns {success:true}; repeats resend, provider failure may be ambiguous. " + units,
    inputSchema: { contactId: contactIdSchema, ...statementFields } }, params => wrapTool(ctx, () => {
      const { contactId, ...input } = params;
      return sendContactStatement(ctx, contactId, input);
    }));
}
