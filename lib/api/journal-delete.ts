import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { journalEntry } from "@/lib/db/schema";
import { AuthError, type AuthContext } from "./auth-context";
import { assertNotLocked } from "./period-lock";
import { requireRole } from "./require-role";
import { logAudit } from "./audit";

export async function deleteDraftJournal(ctx: AuthContext, id: string, request?: Request) {
  requireRole(ctx, "edit:entries");
  const entry = await db.query.journalEntry.findFirst({ where: and(eq(journalEntry.id, id), eq(journalEntry.organizationId, ctx.organizationId)) });
  if (!entry) throw new AuthError("Entry not found", 404);
  if (entry.status !== "draft") throw new AuthError("Only draft entries can be deleted", 400);
  await assertNotLocked(ctx.organizationId, entry.date);
  // FK cascade removes the legs only if the tenant-owned draft is still deletable.
  const deleted = await db.delete(journalEntry).where(and(eq(journalEntry.id, id), eq(journalEntry.organizationId, ctx.organizationId), eq(journalEntry.status, "draft"))).returning({ id: journalEntry.id });
  if (!deleted.length) throw new AuthError("Entry changed before deletion", 409);
  await logAudit({ ctx, action: "delete", entityType: "journal_entry", entityId: id, request });
  return { success: true };
}
