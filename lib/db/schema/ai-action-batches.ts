import { sql } from "drizzle-orm";
import { pgTable, uuid, text, integer, timestamp, jsonb, unique, uniqueIndex, foreignKey, check, index } from "drizzle-orm/pg-core";
import { aiRun } from "./ai";

// Proposals only. These rows do not constitute an approval or dispatch lease.
// Original validated arguments and the complete bounded display are separate.
export const aiActionBatch = pgTable("ai_action_batch", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id").notNull(), organizationId: uuid("organization_id").notNull(), ownerId: uuid("owner_id").notNull(),
  version: integer("version").notNull(), acceptedRunVersion: integer("accepted_run_version").notNull(),
  state: text("state").$type<"pending" | "superseded" | "expired" | "cancelled">().notNull().default("pending"),
  requestKey: text("request_key").notNull(), requestDigest: text("request_digest").notNull(), bindingDigest: text("binding_digest").notNull(),
  authority: jsonb("authority").$type<unknown>(), display: jsonb("display").$type<unknown>(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  foreignKey({ columns: [t.runId, t.organizationId, t.ownerId], foreignColumns: [aiRun.id, aiRun.organizationId, aiRun.ownerId], name: "ai_action_batch_run_scope" }).onDelete("cascade"),
  unique("ai_action_batch_revision").on(t.runId, t.version), unique("ai_action_batch_request").on(t.runId, t.requestKey),
  unique("ai_action_batch_scope").on(t.id, t.runId, t.organizationId, t.ownerId),
  uniqueIndex("ai_action_batch_one_pending").on(t.runId).where(sql`${t.state} = 'pending'`), index("ai_action_batch_expiry").on(t.expiresAt),
  check("ai_action_batch_version", sql`${t.version} between 1 and 20 and ${t.acceptedRunVersion} > 0`),
  check("ai_action_batch_state", sql`${t.state} in ('pending','superseded','expired','cancelled')`),
  check("ai_action_batch_digests", sql`${t.requestDigest} ~ '^[a-f0-9]{64}$' and ${t.bindingDigest} ~ '^[a-f0-9]{64}$'`),
  check("ai_action_batch_authority_bound", sql`octet_length(${t.authority}::text) <= 32768`),
  check("ai_action_batch_display_bound", sql`octet_length(${t.display}::text) <= 60000`),
]);

// Immutable content-free decision receipts. Authority remains in the exact batch
// revision; a receipt alone never queues or authorizes execution.
export const aiActionDecision = pgTable("ai_action_decision", {
  id: uuid("id").primaryKey().defaultRandom(),
  batchId: uuid("batch_id").notNull(), runId: uuid("run_id").notNull(),
  organizationId: uuid("organization_id").notNull(), ownerId: uuid("owner_id").notNull(),
  decision: text("decision").$type<"approve" | "reject">().notNull(),
  batchVersion: integer("batch_version").notNull(),
  acceptedRunVersion: integer("accepted_run_version").notNull(),
  bindingDigest: text("binding_digest").notNull(), selectionDigest: text("selection_digest").notNull(),
  requestKey: text("request_key").notNull(), requestDigest: text("request_digest").notNull(),
  requiredPermissions: jsonb("required_permissions").$type<string[]>().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  foreignKey({ columns: [t.batchId, t.runId, t.organizationId, t.ownerId], foreignColumns: [aiActionBatch.id, aiActionBatch.runId, aiActionBatch.organizationId, aiActionBatch.ownerId], name: "ai_action_decision_batch_scope" }).onDelete("cascade"),
  unique("ai_action_decision_batch").on(t.batchId), unique("ai_action_decision_request").on(t.runId, t.requestKey),
  check("ai_action_decision_kind", sql`${t.decision} in ('approve','reject')`),
  check("ai_action_decision_version", sql`${t.batchVersion} between 1 and 20 and ${t.acceptedRunVersion} > 0`),
  check("ai_action_decision_digests", sql`${t.bindingDigest} ~ '^[a-f0-9]{64}$' and ${t.selectionDigest} ~ '^[a-f0-9]{64}$' and ${t.requestDigest} ~ '^[a-f0-9]{64}$'`),
  check("ai_action_decision_key", sql`${t.requestKey} ~ '^[A-Za-z0-9_-]{1,128}$'`),
  check("ai_action_decision_permissions", sql`jsonb_typeof(${t.requiredPermissions}) = 'array' and octet_length(${t.requiredPermissions}::text) <= 1024`),
]);
