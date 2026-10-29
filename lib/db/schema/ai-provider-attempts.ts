import { sql } from "drizzle-orm";
import { pgTable, uuid, text, integer, jsonb, timestamp, unique, foreignKey, check } from "drizzle-orm/pg-core";
import { aiRun } from "./ai";
import { aiUsageAttempt } from "./ai-usage";

const scope = () => ({ runId: uuid("run_id").notNull(), organizationId: uuid("organization_id").notNull(), ownerId: uuid("owner_id").notNull() });
const time = (name: string) => timestamp(name, { withTimezone: true }).notNull().defaultNow();
// No prompts, responses, credentials, diagnostics or executable arguments.
export const aiProviderAttempt = pgTable("ai_provider_attempt", {
  id: uuid("id").primaryKey().defaultRandom(), ...scope(), attemptKey: uuid("attempt_key").notNull(),
  ordinal: integer("ordinal").notNull(), usageAttemptId: uuid("usage_attempt_id").notNull(), dispatchLease: uuid("dispatch_lease").notNull(),
  state: text("state").$type<"reserved" | "dispatched" | "completed" | "abandoned" | "cancelled">().notNull().default("reserved"),
  snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull(), requestDigest: text("request_digest").notNull(),
  requestBytes: integer("request_bytes").notNull(), responseDigest: text("response_digest"), code: text("code"),
  createdAt: time("created_at"), updatedAt: time("updated_at"),
}, t => [unique("ai_provider_attempt_key").on(t.runId, t.attemptKey), unique("ai_provider_attempt_ordinal").on(t.runId, t.ordinal),
  unique("ai_provider_attempt_usage").on(t.usageAttemptId), unique("ai_provider_attempt_scope").on(t.id, t.runId, t.organizationId, t.ownerId),
  foreignKey({ columns: [t.runId, t.organizationId, t.ownerId], foreignColumns: [aiRun.id, aiRun.organizationId, aiRun.ownerId], name: "ai_provider_attempt_run_scope" }).onDelete("cascade"),
  foreignKey({ columns: [t.usageAttemptId, t.runId, t.organizationId, t.ownerId], foreignColumns: [aiUsageAttempt.id, aiUsageAttempt.runId, aiUsageAttempt.organizationId, aiUsageAttempt.ownerId], name: "ai_provider_attempt_usage_scope" }),
  check("ai_provider_attempt_state", sql`${t.state} in ('reserved','dispatched','completed','abandoned','cancelled')`),
  check("ai_provider_attempt_bounds", sql`${t.ordinal} between 1 and 8 and ${t.requestBytes} between 1 and 65536 and octet_length(${t.snapshot}::text) <= 16384`),
  check("ai_provider_attempt_digests", sql`${t.requestDigest} ~ '^[a-f0-9]{64}$' and (${t.responseDigest} is null or ${t.responseDigest} ~ '^[a-f0-9]{64}$')`),
]);

export const aiProviderCall = pgTable("ai_provider_call", {
  id: uuid("id").primaryKey().defaultRandom(), ...scope(), providerAttemptId: uuid("provider_attempt_id").notNull(),
  callId: text("call_id").notNull(), operationKey: uuid("operation_key").notNull(),
  toolName: text("tool_name").notNull(), catalogVersion: integer("catalog_version").notNull(), argumentDigest: text("argument_digest").notNull(),
  createdAt: time("created_at"),
}, t => [unique("ai_provider_call_id").on(t.runId, t.callId), unique("ai_provider_call_operation").on(t.runId, t.operationKey),
  // Protocol v1 permits one serial call per response.
  unique("ai_provider_call_attempt").on(t.providerAttemptId),
  foreignKey({ columns: [t.providerAttemptId, t.runId, t.organizationId, t.ownerId], foreignColumns: [aiProviderAttempt.id, aiProviderAttempt.runId, aiProviderAttempt.organizationId, aiProviderAttempt.ownerId], name: "ai_provider_call_attempt_scope" }).onDelete("cascade"),
  check("ai_provider_call_bound", sql`${t.callId} ~ '^[A-Za-z0-9_-]{1,128}$' and length(${t.toolName}) between 1 and 128 and ${t.catalogVersion} > 0 and ${t.argumentDigest} ~ '^[a-f0-9]{64}$'`),
]);
