import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { AuthContext } from "@/lib/api/auth-context";
import { wrapTool } from "@/lib/mcp/errors";
import { readBillingSettings, createBillingPortal } from "@/lib/api/billing-settings";
import { stripeSettingsSchema, updateStripeSettings } from "@/lib/api/stripe-settings";

export function registerProviderSettingsTools(server: McpServer, ctx: AuthContext) {
  server.registerTool("get_billing_settings", {
    description: "Read this organization's billing plan, seat count, storage bytes and monthly email usage; includes selfHosted. No money input; provider plan identities remain unchanged.",
    inputSchema: z.strictObject({}),
  }, () => wrapTool(ctx, () => readBillingSettings(ctx)));
  server.registerTool("create_billing_portal", {
    description: "Create a Stripe billing portal session for this organization's saved customer; requires manage:billing and configured Stripe. Returns url; does not change a plan itself.",
    inputSchema: z.strictObject({}),
  }, () => wrapTool(ctx, () => createBillingPortal(ctx)));
  server.registerTool("update_stripe_settings", {
    description: "Patch a live organization's Stripe integration mappings/lookback; requires manage:integrations. Ledger and bank account UUIDs must be live and belong to the organization. Omitted values remain unchanged. Returns saved mapping fields and IDs, never provider credentials.",
    inputSchema: stripeSettingsSchema.strict(),
  }, p => wrapTool(ctx, () => updateStripeSettings(ctx, p)));
}
