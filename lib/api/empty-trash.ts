import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import type { AuthContext } from "./auth-context";
import { requireRole } from "./require-role";
import { logAudit } from "./audit";
import { TRASHABLE_ENTITIES } from "./trash-entities";

export async function emptyTrash(ctx: AuthContext, request?: Request) {
  requireRole(ctx, "delete:organization");
  await db.transaction(async tx => {
    for (const entity of TRASHABLE_ENTITIES) {
      // The registry contains heterogeneous tables with these shared columns.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const table = entity.table as any;
      await tx.delete(table).where(and(eq(table.organizationId, ctx.organizationId), isNotNull(table.deletedAt)));
    }
  });
  await logAudit({ ctx, action: "purge", entityType: "organization", entityId: ctx.organizationId, request });
  return { success: true };
}
