import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { journalEntry } from "@/lib/db/schema";
import { AuthError, type AuthContext } from "./auth-context";
import { assertNotLocked } from "./period-lock";
import { requireRole } from "./require-role";
import { logAudit } from "./audit";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Shared deletion guard; callers may supply their read-only snapshot. */
export async function assertDraftJournalDeletion(ctx: AuthContext, entry: typeof journalEntry.$inferSelect, exec: typeof db | Tx = db) {
  requireRole(ctx, "edit:entries");
  if (entry.organizationId !== ctx.organizationId) throw new AuthError("Entry not found", 404);
  if (entry.status !== "draft") throw new AuthError("Only draft entries can be deleted", 400);
  await assertNotLocked(ctx.organizationId, entry.date, undefined, exec);
}

export async function deleteDraftJournalInTransaction(ctx: AuthContext, id: string, tx: Tx) {
  requireRole(ctx, "edit:entries");
  const [entry] = await tx.select().from(journalEntry).where(and(eq(journalEntry.id, id), eq(journalEntry.organizationId, ctx.organizationId))).for("update");
  if (!entry) throw new AuthError("Entry not found", 404);
  await assertDraftJournalDeletion(ctx, entry, tx);
  // FK cascade removes the legs only if the tenant-owned draft is still deletable.
  const deleted = await tx.delete(journalEntry).where(and(eq(journalEntry.id, id), eq(journalEntry.organizationId, ctx.organizationId), eq(journalEntry.status, "draft"))).returning({ id: journalEntry.id });
  if (!deleted.length) throw new AuthError("Entry changed before deletion", 409);
  return { success: true };
}

export async function deleteDraftJournal(ctx: AuthContext, id: string, request?: Request) {
  requireRole(ctx, "edit:entries");
  const result = await db.transaction(tx => deleteDraftJournalInTransaction(ctx, id, tx));
  await logAudit({ ctx, action: "delete", entityType: "journal_entry", entityId: id, request });
  return result;
}
