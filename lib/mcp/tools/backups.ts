import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { db } from "@/lib/db";
import { dataBackup } from "@/lib/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireRole } from "@/lib/api/require-role";
import { wrapTool } from "@/lib/mcp/errors";
import { restoreFromSnapshot, checkSnapshotRateLimit, createManualBackup, buildDownloadSnapshot, uploadOrgSnapshot, getOrgBackup, downloadOrgBackup } from "@/lib/api/backup-snapshot";
import { notDeleted } from "@/lib/db/soft-delete";
import { softDelete } from "@/lib/db/soft-delete";
import { AuthError } from "@/lib/api/auth-context";
import { logAudit } from "@/lib/api/audit";
import type { AuthContext } from "@/lib/api/auth-context";

export function registerBackupTools(server: McpServer, ctx: AuthContext) {
  server.tool(
    "list_backups",
    "List organization data backups. Returns backup metadata including type, status, size, and entity counts.",
    {
      limit: z
        .number()
        .int()
        .min(1)
        .max(50)
        .optional()
        .default(20)
        .describe("Number of backups to return (max 50)"),
      offset: z
        .number()
        .int()
        .min(0)
        .optional()
        .default(0)
        .describe("Number of items to skip for pagination"),
    },
    (params) =>
      wrapTool(ctx, async () => {
        requireRole(ctx, "view:audit-log");
        const condition = and(
          eq(dataBackup.organizationId, ctx.organizationId),
          notDeleted(dataBackup.deletedAt),
        );

        const backups = await db
          .select()
          .from(dataBackup)
          .where(condition)
          .orderBy(desc(dataBackup.createdAt))
          .limit(params.limit)
          .offset(params.offset);

        const [countResult] = await db
          .select({ count: sql<number>`count(*)`.mapWith(Number) })
          .from(dataBackup)
          .where(condition);

        return {
          backups,
          total: Number(countResult?.count ?? 0),
        };
      })
  );

  server.tool(
    "create_backup",
    "Create a version 2 backup of the documented organization snapshot entities. Stored integer monetary fields retain their units (integer cents for cents-based fields) and add canonical *Minor strings. FX decimals and opaque JSON are preserved. Returns backup metadata and entity counts.",
    {},
    () =>
      wrapTool(ctx, async () => {
        requireRole(ctx, "view:audit-log");

        const backup = await createManualBackup(ctx);

        return { backup };
      })
  );

  server.tool("get_backup", "Get organization backup metadata by UUID. Returns type, status, byte count, entity counts and timestamps; byte counts are not monetary values.", {
    backupId: z.string().uuid().describe("UUID of the backup in this organization"),
  }, params => wrapTool(ctx, async () => ({ backup: await getOrgBackup(ctx, params.backupId) })));
  server.tool("download_backup", "Download an existing organization backup as its original immutable JSON text. Version 1 legacy numbers and version 2 integer money/*Minor strings retain original units (integer cents for cents-based fields). Returns snapshotJson without rewriting the stored file.", {
    backupId: z.string().uuid().describe("UUID of a completed backup in this organization"),
  }, params => wrapTool(ctx, async () => ({ snapshotJson: await downloadOrgBackup(ctx, params.backupId) })));

  server.tool("download_backup_snapshot", "Download the current version 2 organization snapshot as JSON. Stored integer money retains its units (integer cents for cents-based fields), with matching *Minor strings. FX remains exact decimals. Returns snapshot JSON; guarded legacy safe-number range applies.", {},
    () => wrapTool(ctx, async () => {
      requireRole(ctx, "view:audit-log");
      const limit = await checkSnapshotRateLimit(ctx.organizationId);
      if (!limit.allowed) throw new AuthError(`Snapshot rate limit reached. Try again in ${limit.retryAfter} seconds.`, 429);
      return { snapshot: JSON.parse(await buildDownloadSnapshot(ctx.organizationId)) };
    }));
  server.tool("upload_backup", "Upload immutable JSON text for a version 1 legacy or version 2 exact-alias organization backup, max 20 MiB. Stored integer money retains its units (integer cents for cents-based fields); *Minor strings must match numbers and fit the guarded safe-number bridge. Organization and references are validated before storage. Returns backup metadata.", {
    snapshotJson: z.string().max(20 * 1024 * 1024).describe("Original version 1 or 2 snapshot JSON text for this organization; uploaded bytes are preserved"),
  }, params => wrapTool(ctx, async () => ({ backup: await uploadOrgSnapshot(ctx, params.snapshotJson) })));

  server.tool(
    "restore_backup",
    "Restore the documented snapshot entities and document lines atomically from a version 1 or 2 backup belonging to this organization. Requires confirm=true and delete:organization. Validates safe integer money and *Minor aliases without rescaling integer cents, references and ownership before a safety snapshot. Locked periods and unsupported references reject; failed restoration rolls back data. Returns restoredCounts, including document line counts.",
    {
      backupId: z.string().uuid().describe("UUID of the backup to restore"),
      confirm: z
        .boolean()
        .describe("Must be true to confirm the restore operation"),
    },
    (params) =>
      wrapTool(ctx, async () => {
        requireRole(ctx, "delete:organization");

        if (params.confirm !== true) {
          throw new AuthError("You must set confirm to true to proceed with restore", 400);
        }

        const result = await restoreFromSnapshot(
          ctx.organizationId,
          params.backupId,
          ctx,
        );

        return result;
      })
  );

  server.tool(
    "delete_backup",
    "Delete a backup. Moves to trash for 30 days before permanent removal.",
    {
      backupId: z.string().uuid().describe("UUID of the backup to delete"),
    },
    (params) =>
      wrapTool(ctx, async () => {
        requireRole(ctx, "delete:organization");

        const backup = await db.query.dataBackup.findFirst({
          where: and(
            eq(dataBackup.id, params.backupId),
            eq(dataBackup.organizationId, ctx.organizationId),
            notDeleted(dataBackup.deletedAt),
          ),
        });

        if (!backup) throw new AuthError("Backup not found", 404);

        await db
          .update(dataBackup)
          .set(softDelete())
          .where(eq(dataBackup.id, params.backupId));

        await logAudit({ ctx, action: "delete", entityType: "data_backup", entityId: backup.id });
        return { success: true };
      })
  );
}
