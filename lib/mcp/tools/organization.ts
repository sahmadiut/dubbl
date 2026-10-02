import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { db } from "@/lib/db";
import { organization, journalEntry } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { wrapTool } from "@/lib/mcp/errors";
import { AuthError, type AuthContext } from "@/lib/api/auth-context";
import { requireRole } from "@/lib/api/require-role";
import { logAudit, diffChanges } from "@/lib/api/audit";
import { functionalCurrencySchema } from "@/lib/currency/functional-currency";
import { z } from "zod";

export function registerOrganizationTools(server: McpServer, ctx: AuthContext) {
  server.tool(
    "set_organization_currency",
    "Set the current organization's functional currency using an ISO 4217 code. Requires manage:billing permission; changes are rejected once journal activity exists. IRR is disabled pending financial qualification. Returns the updated organization; does not convert or rescale amounts.",
    { currencyCode: z.string().describe("ISO 4217 functional currency code, e.g. USD; IRR remains gated") },
    ({ currencyCode }) => wrapTool(ctx, async () => {
      requireRole(ctx, "manage:billing");
      const code = functionalCurrencySchema.parse(currencyCode);
      const existing = await db.query.organization.findFirst({
        where: eq(organization.id, ctx.organizationId),
      });
      if (!existing) throw new AuthError("Organization not found", 404);
      if (code !== existing.defaultCurrency) {
        const [activity] = await db.select({ count: sql<number>`count(*)::int` })
          .from(journalEntry).where(eq(journalEntry.organizationId, ctx.organizationId));
        if ((activity?.count ?? 0) > 0) {
          throw new AuthError("Base currency can't be changed once transactions exist", 409);
        }
      }
      const [updated] = await db.update(organization)
        .set({ defaultCurrency: code, updatedAt: new Date() })
        .where(eq(organization.id, ctx.organizationId)).returning();
      logAudit({ ctx, action: "update", entityType: "organization", entityId: ctx.organizationId,
        changes: diffChanges(existing as Record<string, unknown>, updated as Record<string, unknown>) });
      return { organization: updated };
    })
  );
  server.tool(
    "get_organization",
    "Get the current organization's details including name, currency, country, and settings",
    {},
    () =>
      wrapTool(ctx, async () => {
        const org = await db.query.organization.findFirst({
          where: eq(organization.id, ctx.organizationId),
        });
        if (!org) throw new Error("Organization not found");
        return { organization: org };
      })
  );
}
