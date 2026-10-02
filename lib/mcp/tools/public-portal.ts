import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { AuthContext } from "@/lib/api/auth-context";
import { requireRole } from "@/lib/api/require-role";
import { getPaymentLink, getPortalAccess, portalIdentity, getPortalInvoices, getPortalPayments,
  getPortalQuotes, getPortalStatement, acceptPortalQuote } from "@/lib/api/public-portal";
import { wrapTool } from "@/lib/mcp/errors";

const token = z.string().min(1).describe("Existing bearer link token; must belong to the authenticated organization; portal tokens must be active and unexpired");
const tokenInput = z.object({ token }).strict();
const amounts = "Amounts retain integer cents/minor-unit numeric fields and additive canonical *Minor strings; only safe integer amounts are supported. No input amount or FX overrides are accepted.";

export function registerPublicPortalTools(server: McpServer, ctx: AuthContext) {
  function read<T>(run: () => Promise<T>) {
    return wrapTool(ctx, async () => { requireRole(ctx, "view:data"); return run(); });
  }
  server.registerTool("get_payment_link", { description: `Read the invoice summary and lines for an existing payment-link token. Returns the public paid/pending envelope. ${amounts}`,
    inputSchema: tokenInput }, params => read(() => getPaymentLink(params.token, ctx.organizationId)));
  server.registerTool("get_portal_identity", { description: "Read the contact and organization names for an existing customer-portal token. Returns contact {id,name,email} and organization {name}.",
    inputSchema: tokenInput }, params => read(async () => portalIdentity(await getPortalAccess(params.token, ctx.organizationId))));
  server.registerTool("list_portal_invoices", { description: `List invoices for the contact granted by a portal token. Returns {data}, with totals and amounts due; records view activity after monetary preflight. ${amounts}`,
    inputSchema: tokenInput }, params => read(async () => getPortalInvoices(await getPortalAccess(params.token, ctx.organizationId))));
  server.registerTool("list_portal_payments", { description: `List paid invoice summaries for the contact granted by a portal token. Returns {data}, with amountPaid and total. ${amounts}`,
    inputSchema: tokenInput }, params => read(async () => getPortalPayments(await getPortalAccess(params.token, ctx.organizationId))));
  server.registerTool("list_portal_quotes", { description: `List quotes and lines for the contact granted by a portal token. Returns {data}, with subtotal, taxTotal, total, billedTotal and line money aliases. Quantities remain hundredths and discounts basis points. ${amounts}`,
    inputSchema: tokenInput }, params => read(async () => getPortalQuotes(await getPortalAccess(params.token, ctx.organizationId))));
  server.registerTool("get_portal_statement", { description: `Read the legacy invoice statement for a portal-token contact, preserving its invoice selection/order. Returns contact, organization, lines, currencyCode and totalOutstanding; sums are exact and mixed currencies are rejected. ${amounts}`,
    inputSchema: tokenInput }, params => read(async () => getPortalStatement(await getPortalAccess(params.token, ctx.organizationId))));
  server.registerTool("accept_portal_quote", { description: `Accept a sent, unexpired, undeleted quote for a portal-token contact. Requires manage:invoices permission and matching authenticated organization. Returns the updated quote with exact monetary aliases and records portal activity transactionally. ${amounts}`,
    inputSchema: z.object({ token, quoteId: z.string().uuid().describe("UUID of the sent quote belonging to the token's contact and organization") }).strict() },
    params => wrapTool(ctx, async () => {
      requireRole(ctx, "manage:invoices");
      return acceptPortalQuote(await getPortalAccess(params.token, ctx.organizationId), params.quoteId);
    }));
}
