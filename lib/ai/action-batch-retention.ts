import { and, eq, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { aiActionBatch } from "@/lib/db/schema";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
/** Called inside existing run/conversation lifecycle transactions. */
export async function eraseActionBatches(tx: Tx, runId: string, state: "cancelled" | "expired") {
  await tx.update(aiActionBatch).set({ state: sql`case when ${aiActionBatch.state} = 'pending' then ${state} else ${aiActionBatch.state} end`, authority: null, display: null }).where(eq(aiActionBatch.runId, runId));
}
export async function expireActionBatchContent(tx: Tx, now: Date) {
  const rows = await tx.select({ id: aiActionBatch.id }).from(aiActionBatch)
    .where(and(lte(aiActionBatch.expiresAt, now), sql`${aiActionBatch.authority} is not null or ${aiActionBatch.display} is not null`)).limit(100).for("update", { skipLocked: true });
  if (!rows.length) return;
  await tx.update(aiActionBatch).set({ state: sql`case when ${aiActionBatch.state} = 'pending' then 'expired' else ${aiActionBatch.state} end`, authority: null, display: null })
    .where(inArray(aiActionBatch.id, rows.map(r => r.id)));
}
