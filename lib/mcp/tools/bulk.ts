import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  contact,
  auditLog,
} from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { softDelete } from "@/lib/db/soft-delete";
import { requireRole } from "@/lib/api/require-role";
import { wrapTool } from "@/lib/mcp/errors";
import type { AuthContext } from "@/lib/api/auth-context";

/**
 * MCP tools for high-value BULK operations — the batch equivalents of
 * single-record actions an AI agent will reach for when cleaning up or
 * processing many records at once.
 *
 * Mirrors these REST routes exactly:
 *   - POST /api/v1/bulk/contacts/tag                  (sets customer/supplier/both)
 *   - POST /api/v1/bulk/contacts/delete
 *
 * Every query and every id passed in is org-scoped to ctx.organizationId and
 * verified to belong to this org BEFORE any mutation — critical for bulk, where
 * a single un-scoped id could mutate another org's data. Direct Drizzle access
 * (no HTTP self-calls). All monetary amounts are integer cents ($12.50 = 1250).
 *
 * Audit rows are inserted directly via Drizzle (matching the MCP convention in
 * bank-transactions.ts) because MCP tools have no HTTP Request to derive
 * IP/user-agent from.
 */
export function registerBulkTools(server: McpServer, ctx: AuthContext) {
  // -------------------------------------------------------------------------
  // bulk_set_contacts_type — set customer/supplier/both on many contacts.
  // Mirrors POST /api/v1/bulk/contacts/tag (the route's "tag" is really the
  // contact TYPE — customer / supplier / both — not a free-form label).
  // -------------------------------------------------------------------------
  server.tool(
    "bulk_set_contacts_type",
    "Set the TYPE (customer, supplier, or both) on many contacts in one call. This is the bulk equivalent of the 'tag' action — it classifies contacts, it does not attach free-form tags. Only contacts in THIS org are updated; other-org ids are ignored. Returns the number updated.",
    {
      ids: z
        .array(z.string().uuid())
        .min(1)
        .max(100)
        .describe("UUIDs of the contacts to update (max 100)"),
      type: z
        .enum(["customer", "supplier", "both"])
        .describe("The classification to apply to every listed contact"),
    },
    (params) =>
      wrapTool(ctx, async () => {
        requireRole(ctx, "manage:contacts");

        const { ids, type } = params;

        const updated = await db
          .update(contact)
          .set({ type, updatedAt: new Date() })
          .where(and(inArray(contact.id, ids), eq(contact.organizationId, ctx.organizationId)))
          .returning({ id: contact.id });

        return { updated: updated.length };
      })
  );

  // -------------------------------------------------------------------------
  // bulk_delete_contacts — soft-delete many contacts.
  // Mirrors POST /api/v1/bulk/contacts/delete.
  // -------------------------------------------------------------------------
  server.tool(
    "bulk_delete_contacts",
    "Soft-delete many contacts in one call (they move to trash and can be restored). Only contacts in THIS org are deleted; other-org ids are ignored. Each deletion is audited. Returns the number deleted.",
    {
      ids: z
        .array(z.string().uuid())
        .min(1)
        .max(100)
        .describe("UUIDs of the contacts to delete (max 100)"),
    },
    (params) =>
      wrapTool(ctx, async () => {
        requireRole(ctx, "manage:contacts");

        const ids = params.ids;

        const updated = await db
          .update(contact)
          .set(softDelete())
          .where(and(inArray(contact.id, ids), eq(contact.organizationId, ctx.organizationId)))
          .returning({ id: contact.id });

        for (const row of updated) {
          await db.insert(auditLog).values({
            organizationId: ctx.organizationId,
            userId: ctx.userId,
            action: "delete",
            entityType: "contact",
            entityId: row.id,
            changes: { id: row.id, bulk: true },
          });
        }

        return { deleted: updated.length };
      })
  );
}
