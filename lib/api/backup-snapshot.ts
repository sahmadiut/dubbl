import { db } from "@/lib/db";
import { dataBackup, member, periodLock, fiscalYear, auditLog } from "@/lib/db/schema";
import { eq, and, count, sql, getTableColumns, getTableName, is } from "drizzle-orm";
import { uploadBackup, downloadBackup } from "./backup-storage";
import { logAudit } from "./audit";
import { requireRole } from "./require-role";
import { AuthError } from "./auth-context";
import { backupEntities, backupLines, backupSoftReferences, backupSourceReferences, orderedSnapshotRows, backupRowDto, parseBackupSnapshot, snapshotRows, invalidBackup, getTableConfig, type BackupSnapshot, type BackupRow } from "./backup-wire";
import { stringifyWire } from "@/lib/money/wire";
import { PgTable, type AnyPgTable } from "drizzle-orm/pg-core";
import * as schema from "@/lib/db/schema";
import { notDeleted } from "@/lib/db/soft-delete";
import type { AuthContext } from "./auth-context";
import { z } from "zod";

async function buildOrgSnapshot(orgId: string) {
  return db.transaction(async tx => {
    const entities: Record<string, Record<string, unknown>[]> = {};
    for (const [key, table] of Object.entries(backupEntities)) {
      const columns = getTableColumns(table as AnyPgTable);
      const rows = await tx.select().from(table).where(and(eq(columns.organizationId, orgId), notDeleted(columns.deletedAt)));
      entities[key] = [];
      const spec = backupLines[key as keyof typeof backupLines];
      for (const input of rows) {
        const row = backupRowDto(table, input as Record<string, unknown>);
        if (spec) {
          const parentColumn = getTableColumns(spec.table as AnyPgTable)[spec.parent];
          const lines = await tx.select().from(spec.table).where(eq(parentColumn, row.id));
          row.lines = lines.map(line => backupRowDto(spec.table, line));
        }
        entities[key].push(row);
      }
    }
    const snapshot = { version: 2, createdAt: new Date().toISOString(), organizationId: orgId, entities };
    parseBackupSnapshot(stringifyWire(snapshot), orgId);
    return snapshot;
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}

export async function checkSnapshotRateLimit(orgId: string): Promise<{ allowed: boolean; retryAfter?: number }> {
  const windowMs = 60 * 60 * 1000; // 1 hour
  const maxPerWindow = 5;
  const windowStart = new Date(Date.now() - windowMs);

  const [{ total }] = await db
    .select({ total: count() })
    .from(dataBackup)
    .where(
      and(
        eq(dataBackup.organizationId, orgId),
        sql`${dataBackup.createdAt} >= ${windowStart.toISOString()}`,
      ),
    );

  if (total >= maxPerWindow) {
    const oldest = await db.query.dataBackup.findFirst({
      where: and(
        eq(dataBackup.organizationId, orgId),
        sql`${dataBackup.createdAt} >= ${windowStart.toISOString()}`,
      ),
      orderBy: dataBackup.createdAt,
    });
    const retryAfter = oldest?.createdAt
      ? Math.ceil((oldest.createdAt.getTime() + windowMs - Date.now()) / 1000)
      : 3600;
    return { allowed: false, retryAfter };
  }

  return { allowed: true };
}

export async function buildDownloadSnapshot(orgId: string): Promise<string> {
  const snapshot = await buildOrgSnapshot(orgId);
  return stringifyWire(snapshot);
}

export async function createOrgSnapshot(
  orgId: string,
  userId: string | null,
  type: "scheduled" | "manual" | "uploaded",
) {
  const [backup] = await db
    .insert(dataBackup)
    .values({
      organizationId: orgId,
      type,
      status: "pending",
      createdBy: userId,
      expiresAt: type === "manual" ? new Date(Date.now() + 30 * 86400000) : null,
    })
    .returning();

  try {
    const snapshot = await buildOrgSnapshot(orgId);

    // Upload to S3
    const fileKey = `backups/${orgId}/${backup.id}.json`;
    const jsonStr = stringifyWire(snapshot);
    const sizeBytes = await uploadBackup(fileKey, jsonStr);

    // Build entity counts
    const entityCounts: Record<string, number> = {};
    for (const [key, value] of Object.entries(snapshot.entities)) {
      entityCounts[key] = (value as unknown[]).length;
    }

    // Update backup row
    const [updated] = await db
      .update(dataBackup)
      .set({ status: "completed", sizeBytes, entityCounts, fileKey })
      .where(eq(dataBackup.id, backup.id))
      .returning();

    return updated;
  } catch (err) {
    await db
      .update(dataBackup)
      .set({ status: "failed" })
      .where(eq(dataBackup.id, backup.id));
    throw err;
  }
}

type BackupExecutor = Pick<typeof db, "execute">;

// The historical format omits many dependent ledgers (allocations, FIFO layers,
// asset/loan schedules, etc.). Refuse destructive restoration for such cohorts
// rather than presenting a header-only restore as complete recovery.
function omittedDependencies(snapshot: BackupSnapshot) {
  const entries = snapshotRows(snapshot);
  const included = new Map(entries.map(entry => [getTableName(entry.table), entry.table]));
  return (Object.values(schema) as unknown[]).filter((value): value is AnyPgTable => is(value, PgTable))
    .filter(table => !included.has(getTableName(table)))
    .flatMap(table => getTableConfig(table).foreignKeys.flatMap(fk => {
      const ref = fk.reference(), target = included.get(getTableName(ref.foreignTable));
      return target ? [{ table, ref, target }] : [];
    }));
}

async function validateRestoreCoverage(exec: BackupExecutor, snapshot: BackupSnapshot) {
  for (const { table, ref, target } of omittedDependencies(snapshot)) {
    const columns = getTableColumns(target);
    if (columns.organizationId) {
      const found = await exec.execute(sql`select 1 from ${table} join ${target} on ${ref.columns[0]} = ${ref.foreignColumns[0]} where ${columns.organizationId} = ${snapshot.organizationId} limit 1`);
      if (found.rows.length) invalidBackup(`restore requires omitted ${getTableName(table)} data; complete recovery remains a separate qualification`);
    } else {
      const spec = Object.entries(backupLines).find(([, spec]) => getTableName(spec.table) === getTableName(target));
      if (!spec) invalidBackup("unsupported dependent ownership");
      const parent = backupEntities[spec[0] as keyof typeof backupEntities];
      const parentColumns = getTableColumns(parent as AnyPgTable);
      const parentId = columns[spec[1].parent];
      const found = await exec.execute(sql`select 1 from ${table} join ${target} on ${ref.columns[0]} = ${ref.foreignColumns[0]} join ${parent} on ${parentId} = ${parentColumns.id} where ${parentColumns.organizationId} = ${snapshot.organizationId} limit 1`);
      if (found.rows.length) invalidBackup(`restore requires omitted ${getTableName(table)} data; complete recovery remains a separate qualification`);
    }
  }
}

// All exported table names and column identifiers originate in the static catalog.
async function validateOwnership(exec: BackupExecutor, snapshot: BackupSnapshot) {
  const entries = snapshotRows(snapshot);
  const byTable = new Map(entries.map(entry => [getTableName(entry.table), entry]));
  orderedSnapshotRows(snapshot);
  async function validateReference(targetTable: AnyPgTable, id: unknown, prop: string) {
    const target = byTable.get(getTableName(targetTable));
    if (target?.rows.some(candidate => candidate.id === id)) return;
    const targetColumns = getTableColumns(targetTable);
    const found = await exec.execute(sql`select * from ${targetTable} where id = ${id}`);
    const record = found.rows[0] as Record<string, unknown> | undefined;
    if (!record || !targetColumns.organizationId || record.organization_id !== snapshot.organizationId || record.deleted_at) invalidBackup(`missing or foreign ${prop} reference`);
    if (target) invalidBackup(`omitted ${prop} reference`);
  }
  for (const { table, rows } of entries) {
    const columns = getTableColumns(table);
    for (const row of rows) {
      const existing = await exec.execute(sql`select * from ${table} where id = ${row.id}`);
      const saved = existing.rows[0] as Record<string, unknown> | undefined;
      if (saved) {
        if (columns.organizationId && saved.organization_id !== snapshot.organizationId) invalidBackup("record ID belongs to another organization");
        // Lines are scoped through their parent and cannot be moved between documents.
        if (!columns.organizationId) {
          const parentFk = getTableConfig(table).foreignKeys.find(fk => byTable.has(getTableName(fk.reference().foreignTable)));
          if (!parentFk) invalidBackup("unsupported child ownership");
          const ref = parentFk.reference(), key = ref.columns[0].name;
          const prop = Object.entries(columns).find(([, column]) => column.name === key)![0];
          if (saved[key] !== row[prop]) invalidBackup("line ID belongs to another parent");
        }
      }
      for (const fk of getTableConfig(table).foreignKeys) {
        const ref = fk.reference(), column = ref.columns[0];
        const prop = Object.entries(columns).find(([, candidate]) => candidate.name === column.name)![0];
        const id = row[prop]; if (id == null) continue;
        const targetName = getTableName(ref.foreignTable);
        if (targetName === "organization") {
          if (id !== snapshot.organizationId) invalidBackup("foreign organization reference");
          continue;
        }
        if (targetName === "users") {
          const membership = await exec.execute(sql`select id from ${member} where organization_id = ${snapshot.organizationId} and user_id = ${id}`);
          if (!membership.rows.length) invalidBackup("user reference is not a member of this organization");
          continue;
        }
        await validateReference(ref.foreignTable, id, prop);
      }
      // These hierarchy references intentionally have no physical FK.
      if (row.parentId != null && ["chart_account", "cost_center"].includes(getTableName(table)) && !rows.some(candidate => candidate.id === row.parentId)) invalidBackup("missing hierarchy parent");
      for (const [prop, target] of Object.entries(backupSoftReferences)) if (row[prop] != null) await validateReference(target, row[prop], prop);
      for (const [idProp, typeProp] of [["sourceId", "sourceType"], ["entityId", "entityType"]]) {
        if (row[idProp] == null) continue;
        const target = backupSourceReferences[String(row[typeProp])];
        if (!target) invalidBackup("unsupported polymorphic reference type");
        await validateReference(target, row[idProp], idProp);
      }
    }
  }
}

async function loadRestore(orgId: string, backupId: string, ctx: AuthContext) {
  requireRole(ctx, "delete:organization");
  if (ctx.organizationId !== orgId) throw new AuthError("Organization mismatch", 403);
  z.string().uuid().parse(backupId);
  const backup = await db.query.dataBackup.findFirst({ where: and(eq(dataBackup.id, backupId), eq(dataBackup.organizationId, orgId), notDeleted(dataBackup.deletedAt)) });
  if (!backup || backup.status !== "completed" || !backup.fileKey) throw new AuthError("Backup not found or not completed", 404);
  if (backup.fileKey !== `backups/${orgId}/${backup.id}.json`) invalidBackup("storage key does not match organization and backup");
  const snapshot = parseBackupSnapshot(await downloadBackup(backup.fileKey), orgId);
  await validateOwnership(db, snapshot);
  await validateRestoreCoverage(db, snapshot);
  return { backup, snapshot };
}

export async function restoreFromSnapshot(orgId: string, backupId: string, ctx: AuthContext): Promise<{ restoredCounts: Record<string, number> }> {
  // Validate before even writing the safety backup. Revalidate under locks before destructive writes.
  const { snapshot } = await loadRestore(orgId, backupId, ctx);
  const entries = snapshotRows(snapshot);
  const locked = await db.select().from(periodLock).where(eq(periodLock.organizationId, orgId));
  const closed = await db.select().from(fiscalYear).where(and(eq(fiscalYear.organizationId, orgId), eq(fiscalYear.isClosed, true)));
  if (locked.some(row => row.lockDate || row.advisorLockDate) || closed.length) invalidBackup("locked or closed accounting periods cannot be restored");
  await createOrgSnapshot(orgId, ctx.userId, "manual");
  const restoredCounts: Record<string, number> = {};
  await db.transaction(async tx => {
    // Serialize against concurrent writers, including cross-org ID collisions and reference deletion.
    const tables = [...new Set([...entries.flatMap(({ table }) => [table, ...getTableConfig(table).foreignKeys.map(fk => fk.reference().foreignTable)]),
      ...omittedDependencies(snapshot).map(dep => dep.table), periodLock, fiscalYear, member])];
    tables.sort((a, b) => getTableName(a).localeCompare(getTableName(b)));
    for (const table of tables) await tx.execute(sql`lock table ${table} in share row exclusive mode`);
    await validateOwnership(tx, snapshot);
    await validateRestoreCoverage(tx, snapshot);
    const periods = await tx.select().from(periodLock).where(eq(periodLock.organizationId, orgId));
    const closedYears = await tx.select().from(fiscalYear).where(and(eq(fiscalYear.organizationId, orgId), eq(fiscalYear.isClosed, true)));
    if (periods.some(row => row.lockDate || row.advisorLockDate) || closedYears.length) invalidBackup("locked or closed accounting periods cannot be restored");
    for (const { table } of entries) {
      const columns = getTableColumns(table);
      if (columns.organizationId && columns.deletedAt) await tx.execute(sql`update ${table} set deleted_at = now() where organization_id = ${orgId} and deleted_at is null`);
    }
    for (const { table, row } of orderedSnapshotRows(snapshot)) await restoreRow(tx, table, row);
    // Replace lines only for included parents; absent parents remain soft-deleted with their history.
    for (const [key, spec] of Object.entries(backupLines)) {
      for (const parent of snapshot.entities[key]) {
        const lineIds = (parent.lines as BackupRow[]).map(row => row.id);
        const parentColumn = getTableColumns(spec.table as AnyPgTable)[spec.parent];
        await tx.execute(sql`delete from ${spec.table} where ${parentColumn} = ${parent.id} ${lineIds.length ? sql`and id not in (${sql.join(lineIds.map(id => sql`${id}`), sql`, `)})` : sql``}`);
      }
    }
    for (const { key, rows } of entries) restoredCounts[key] = rows.length;
    await tx.insert(auditLog).values({ organizationId: orgId, userId: ctx.userId, action: "restore_backup", entityType: "organization", entityId: orgId, changes: { backupId, version: snapshot.version, restoredCounts } });
  });
  return { restoredCounts };
}

async function restoreRow(exec: BackupExecutor, table: AnyPgTable, row: BackupRow) {
  const columns = getTableColumns(table);
  const values = Object.entries({ ...row, ...(columns.deletedAt ? { deletedAt: null } : {}) }).filter(([key]) => Object.hasOwn(columns, key)).map(([key, value]) => ({ column: columns[key], value: key === "deletedAt" ? null : value }));
  const names = sql.join(values.map(({ column }) => sql.identifier(column.name)), sql`, `);
  const params = sql.join(values.map(({ column, value }) => sql`${value == null ? null : column.mapToDriverValue(value)}`), sql`, `);
  const updates = sql.join(values.filter(({ column }) => column.name !== "id").map(({ column }) => sql`${sql.identifier(column.name)} = excluded.${sql.identifier(column.name)}`), sql`, `);
  await exec.execute(sql`insert into ${table} (${names}) values (${params}) on conflict (id) do update set ${updates}`);
}

export async function uploadOrgSnapshot(ctx: AuthContext, json: string) {
  requireRole(ctx, "delete:organization");
  const snapshot = parseBackupSnapshot(json, ctx.organizationId);
  await validateOwnership(db, snapshot);
  const [backup] = await db.insert(dataBackup).values({ organizationId: ctx.organizationId, type: "uploaded", status: "pending", createdBy: ctx.userId }).returning();
  try {
    const fileKey = `backups/${ctx.organizationId}/${backup.id}.json`;
    // Preserve uploaded bytes, including legacy files; no in-place format conversion.
    const sizeBytes = await uploadBackup(fileKey, json);
    const entityCounts = Object.fromEntries(Object.entries(snapshot.entities).map(([key, rows]) => [key, rows.length]));
    const [updated] = await db.update(dataBackup).set({ status: "completed", fileKey, sizeBytes, entityCounts }).where(eq(dataBackup.id, backup.id)).returning();
    await logAudit({ ctx, action: "create", entityType: "data_backup", entityId: backup.id });
    return updated;
  } catch (error) {
    await db.update(dataBackup).set({ status: "failed" }).where(eq(dataBackup.id, backup.id));
    throw error;
  }
}

export async function createManualBackup(ctx: AuthContext) {
  requireRole(ctx, "view:audit-log");
  const { allowed, retryAfter } = await checkSnapshotRateLimit(ctx.organizationId);
  if (!allowed) throw new AuthError(`Snapshot rate limit reached. Try again in ${retryAfter} seconds.`, 429);
  const [{ total }] = await db.select({ total: count() }).from(dataBackup).where(and(eq(dataBackup.organizationId, ctx.organizationId), eq(dataBackup.type, "manual"), notDeleted(dataBackup.deletedAt)));
  if (total >= 10) throw new AuthError("Manual backup limit reached (10)", 403);
  const backup = await createOrgSnapshot(ctx.organizationId, ctx.userId, "manual");
  const [updated] = await db.update(dataBackup).set({ expiresAt: new Date(Date.now() + 30 * 86400000) }).where(eq(dataBackup.id, backup.id)).returning();
  await logAudit({ ctx, action: "create", entityType: "data_backup", entityId: backup.id });
  return updated;
}

export async function getOrgBackup(ctx: AuthContext, id: string) {
  requireRole(ctx, "view:audit-log");
  z.string().uuid().parse(id);
  const backup = await db.query.dataBackup.findFirst({ where: and(eq(dataBackup.id, id), eq(dataBackup.organizationId, ctx.organizationId), notDeleted(dataBackup.deletedAt)) });
  if (!backup) throw new AuthError("Backup not found", 404);
  return backup;
}

export async function downloadOrgBackup(ctx: AuthContext, id: string) {
  const backup = await getOrgBackup(ctx, id);
  if (backup.status !== "completed" || !backup.fileKey) throw new AuthError("Backup is not available for download", 400);
  if (backup.fileKey !== `backups/${ctx.organizationId}/${backup.id}.json`) invalidBackup("storage key does not match organization and backup");
  return downloadBackup(backup.fileKey);
}
