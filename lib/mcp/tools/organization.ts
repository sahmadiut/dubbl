import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { wrapTool } from "@/lib/mcp/errors";
import type { AuthContext } from "@/lib/api/auth-context";
import { getOrganization, updateOrganizationSettings, getOrganizationMileageRate, updateOrganizationMileageRate } from "@/lib/api/organization-settings";
import { organizationUpdateFields, mileageRateSchema } from "@/lib/api/organization-wire";

export function registerOrganizationTools(server: McpServer, ctx: AuthContext) {
  server.registerTool("get_organization", { description:
    "Get the current live organization's details and settings. Returns {organization}; mileageRate is minor units per mile and billApprovalThreshold is currency minor units (USD cents), with matching *Minor strings or null. Percentages remain numeric basis points; no rescaling.",
    inputSchema: z.object({}).strict() }, () => wrapTool(ctx, () => getOrganization(ctx)));
  server.registerTool("set_organization_currency", { description:
    "Set the current organization's ISO functional currency. Requires manage:billing, rejected after journal, payroll, asset, category, loan or accrual schedule history (including unposted, cancelled and soft-deleted records); IRR remains gated. Returns {organization} with safe numeric money and exact *Minor aliases. Does not convert or rescale stored amounts.",
    inputSchema: z.object({ currencyCode: z.string().describe("ISO functional currency code, e.g. USD; IRR remains gated") }).strict() },
    ({ currencyCode }) => wrapTool(ctx, () => updateOrganizationSettings(ctx, { defaultCurrency: currencyCode })));
  server.registerTool("update_organization", { description:
    "Update supplied current organization settings, matching REST PATCH. Requires manage:billing, or view:data for onboardingCompleted alone. Returns {organization} with safe numeric money and exact *Minor aliases; mileage is updated separately. Functional currency cannot change after journal, payroll, asset, category, loan or accrual schedule history, including unposted, cancelled and soft-deleted records; IRR remains gated.",
    inputSchema: z.object({ ...organizationUpdateFields, defaultCurrency: z.string().optional().describe("ISO functional currency; changes rejected with journal, payroll, asset, category, loan or accrual schedule history; IRR gated") }).strict() }, params => wrapTool(ctx, () => updateOrganizationSettings(ctx, params)));
  server.registerTool("get_organization_mileage_rate", { description:
    "Get the current organization's mileage reimbursement setting. Returns mileageRate (safe integer currency minor units per mile, USD cents), mileageRateMinor (matching canonical string), and currencyCode. A saved null retains the legacy fallback of 67 minor units per mile.",
    inputSchema: z.object({}).strict() }, () => wrapTool(ctx, () => getOrganizationMileageRate(ctx)));
  server.registerTool("update_organization_mileage_rate", { description:
    "Update the current organization's mileage setting; requires manage:tax-config. Provide numeric mileageRate or exact mileageRateMinor, or both agreeing. Nonnegative currency minor units per mile (USD 67 = $0.67/mile), maximum 9007199254740991. Returns mileageRate, mileageRateMinor and currencyCode; no rescaling.",
    inputSchema: mileageRateSchema }, params => wrapTool(ctx, () => updateOrganizationMileageRate(ctx, params)));
}
