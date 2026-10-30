import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import * as s from "@/lib/db/schema";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
/** Serialize absent policy/credential rows and all rendered invoice inputs.
 * Acquired before run locks so Stop can win while resources are blocked.
 * Held through the single external call; no retry on timeout or deadlock. */
export async function lockEmailEffect(tx: Tx) {
  await tx.execute(sql`set local lock_timeout = '5s'`);
  await tx.execute(sql`set local statement_timeout = '10s'`);
  await tx.execute(sql`lock table ${s.documentEmailLog} in share row exclusive mode`);
  await tx.execute(sql`lock table ${s.invoice}, ${s.invoiceLine}, ${s.contact}, ${s.documentTemplate}, ${s.emailConfig},
    ${s.users}, ${s.organization}, ${s.member}, ${s.customRole}, ${s.advisorAccess},
    ${s.apiKey}, ${s.mcpAccessToken}, ${s.subscription}, ${s.aiProvider}, ${s.aiProviderConfig}, ${s.aiToolPolicy},
    ${s.approvalWorkflow}, ${s.approvalWorkflowStep}, ${s.approvalRequest}, ${s.approvalAction} in share mode`);
}
