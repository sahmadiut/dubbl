import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AuthContext } from "@/lib/api/auth-context";
import { adminOrganizationForContext, adminSubscriptionSchema, updateAdminOrganization } from "@/lib/api/admin-organization";
import { wrapTool } from "../errors";

export function registerAdminOrganizationTools(server: McpServer, ctx: AuthContext) {
  server.registerTool("get_admin_organization", {
    description: "Site administrators only: read the current AuthContext organization, subscription, members and limits. Never reads another tenant. Existing money is integer cents with billApprovalThresholdMinor/mileageRateMinor strings; max absolute 9007199254740991. Limits are counts or megabytes, null means unlimited. No billing price/provider call.",
    inputSchema: z.strictObject({}),
  }, () => wrapTool(ctx, () => adminOrganizationForContext(ctx)));
  server.registerTool("update_admin_organization", {
    description: "Site administrators only: atomically edit current AuthContext organization's subscription controls. Counts/megabytes are int32, not money; null or empty overrides reset defaults. Returns {success:true}. Rejects unknown fields or unsupported values before writes; no Stripe call. Serializes concurrent updates and preserves other fields.",
    inputSchema: adminSubscriptionSchema,
  }, input => wrapTool(ctx, () => updateAdminOrganization(ctx.userId, ctx.organizationId, input, ctx.organizationId)));
}
