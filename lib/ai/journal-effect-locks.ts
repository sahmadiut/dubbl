import { is, sql } from "drizzle-orm";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Protect absent rows as well as existing rows from ordinary REST/MCP writers.
 * These conservative table locks are intentionally limited to the trusted journal
 * adapter. They trade throughput for correctness until finer writer-wide locking
 * is qualified. No network or provider work may run while holding them.
 */
export async function lockJournalEffect(tx: Tx, deletion: boolean) {
  await tx.execute(sql`set local lock_timeout = '5s'`);
  await tx.execute(sql`set local statement_timeout = '10s'`);
  // Take write-compatible journal locks first, avoiding shared-to-write upgrades
  // between concurrent journal adapters and phantom line/reversal insertions.
  await tx.execute(sql`lock table ${schema.journalEntry}, ${schema.journalLine} in share row exclusive mode`);
  const tables = new Set<PgTable>([
    schema.users, schema.organization, schema.member, schema.customRole, schema.advisorAccess,
    schema.apiKey, schema.mcpAccessToken, schema.subscription,
    schema.aiProvider, schema.aiProviderConfig, schema.aiToolPolicy,
    schema.chartAccount, schema.costCenter, schema.project, schema.fiscalYear, schema.periodLock,
    schema.approvalWorkflow, schema.approvalWorkflowStep, schema.approvalRequest, schema.approvalAction,
  ]);
  if (deletion) for (const table of Object.values(schema)) {
    if (!is(table, PgTable) || table === schema.journalEntry || table === schema.journalLine) continue;
    // The preview rejects every link. Prevent links inserted after that check,
    // including tables added to the schema in a later migration.
    if (getTableConfig(table).foreignKeys.some(key => key.reference().foreignTable === schema.journalEntry)) tables.add(table);
  }
  const ordered = [...tables].sort((a, b) => getTableConfig(a).name.localeCompare(getTableConfig(b).name));
  await tx.execute(sql`lock table ${sql.join(ordered, sql`, `)} in share mode`);
}
