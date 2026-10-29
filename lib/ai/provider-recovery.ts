import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { aiProviderAttempt, aiUsageAttempt } from "@/lib/db/schema";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
/** Caller holds the run lock. Used by stop, erasure and recovery; never dispatches
 * or erases known usage. Unknown work keeps its reservation/concurrency charge. */
export async function closeProviderAttempts(tx: Tx, run: { id: string; organizationId: string }) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${run.organizationId}, 5))`);
  const now = new Date();
  await tx.update(aiUsageAttempt).set({ state: "unknown", updatedAt: now }).where(and(eq(aiUsageAttempt.runId, run.id), eq(aiUsageAttempt.state, "in_flight")));
  await tx.update(aiUsageAttempt).set({ state: "cancelled", chargedTokens: "0", chargedCost: "0", updatedAt: now }).where(and(eq(aiUsageAttempt.runId, run.id), eq(aiUsageAttempt.state, "reserved")));
  await tx.update(aiProviderAttempt).set({ state: "abandoned", code: "AUTHORITY_LOST", updatedAt: now }).where(and(eq(aiProviderAttempt.runId, run.id), eq(aiProviderAttempt.state, "dispatched")));
  await tx.update(aiProviderAttempt).set({ state: "cancelled", code: "DISPATCH_DENIED", updatedAt: now }).where(and(eq(aiProviderAttempt.runId, run.id), eq(aiProviderAttempt.state, "reserved")));
}
