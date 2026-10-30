import { sql } from "drizzle-orm";
import { pgTable, uuid, text, integer, timestamp, jsonb, unique, uniqueIndex, index, foreignKey, check } from "drizzle-orm/pg-core";
import { organization, users } from "./auth";
import type { ExecutionIdentity } from "@/lib/api/execution-identity";

export const AI_RUN_STATES = ["queued", "running", "awaiting_approval", "awaiting_input", "reconciliation_required", "succeeded", "failed", "cancelled", "expired"] as const;
export type AiRunState = typeof AI_RUN_STATES[number];
export type AiPayload = { value: unknown; digest: string; bytes: number; truncated: boolean };
const time = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const scope = () => ({
  organizationId: uuid("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
  ownerId: uuid("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
});

export const aiConversation = pgTable("ai_conversation", {
  id: uuid("id").primaryKey().defaultRandom(), ...scope(),
  version: integer("version").notNull().default(1),
  createdAt: time("created_at").notNull().defaultNow(), updatedAt: time("updated_at").notNull().defaultNow(),
  deletedAt: time("deleted_at"), contentExpiresAt: time("content_expires_at").notNull(), metadataExpiresAt: time("metadata_expires_at").notNull(),
}, t => [unique("ai_conversation_scope").on(t.id, t.organizationId, t.ownerId), index("ai_conversation_owner").on(t.organizationId, t.ownerId), check("ai_conversation_version", sql`${t.version} > 0`)]);

export const aiRun = pgTable("ai_run", {
  id: uuid("id").primaryKey().defaultRandom(), ...scope(), conversationId: uuid("conversation_id").notNull(),
  requestKey: text("request_key").notNull(), state: text("state").$type<AiRunState>().notNull().default("queued"), version: integer("version").notNull().default(1),
  identity: jsonb("identity").$type<ExecutionIdentity>().notNull(),
  config: jsonb("config").$type<{ providerConfigId: string; configVersion: number; credentialRef: string; policyVersion: number; providerVersion?: number; agentPolicyVersion?: number; agentId?: "default" }>().notNull(),
  requestDigest: text("request_digest"),
  startedAt: time("started_at"), deadlineAt: time("deadline_at"), cancelRequestedAt: time("cancel_requested_at"),
  payloadBytes: integer("payload_bytes").notNull().default(0),
  leaseOwner: uuid("lease_owner"), leaseExpiresAt: time("lease_expires_at"),
  createdAt: time("created_at").notNull().defaultNow(), updatedAt: time("updated_at").notNull().defaultNow(), finishedAt: time("finished_at"),
}, t => [unique("ai_run_scope").on(t.id, t.organizationId, t.ownerId), unique("ai_run_request").on(t.conversationId, t.requestKey),
  foreignKey({ columns: [t.conversationId, t.organizationId, t.ownerId], foreignColumns: [aiConversation.id, aiConversation.organizationId, aiConversation.ownerId], name: "ai_run_conversation_scope" }).onDelete("cascade"),
  index("ai_run_queue").on(t.state, t.leaseExpiresAt), check("ai_run_version", sql`${t.version} > 0`),
  check("ai_run_payload_bound", sql`${t.payloadBytes} between 0 and 1048576`),
  check("ai_run_deadline", sql`(${t.startedAt} is null) = (${t.deadlineAt} is null) and (${t.deadlineAt} is null or ${t.deadlineAt} > ${t.startedAt})`),
  check("ai_run_state", sql`${t.state} in ('queued','running','awaiting_approval','awaiting_input','reconciliation_required','succeeded','failed','cancelled','expired')`),
  check("ai_run_terminal", sql`(${t.state} in ('succeeded','failed','cancelled','expired')) = (${t.finishedAt} is not null)`),
  check("ai_run_lease", sql`(${t.leaseOwner} is null) = (${t.leaseExpiresAt} is null) and (${t.state} = 'running' or ${t.leaseOwner} is null)`),
]);

export const aiMessage = pgTable("ai_message", {
  id: uuid("id").primaryKey().defaultRandom(), ...scope(), conversationId: uuid("conversation_id").notNull(),
  role: text("role").$type<"user" | "assistant" | "tool">().notNull(), payload: jsonb("payload").$type<AiPayload>(),
  requiredPermissions: jsonb("required_permissions").$type<string[]>().notNull(), createdAt: time("created_at").notNull().defaultNow(),
}, t => [foreignKey({ columns: [t.conversationId, t.organizationId, t.ownerId], foreignColumns: [aiConversation.id, aiConversation.organizationId, aiConversation.ownerId], name: "ai_message_scope" }).onDelete("cascade"),
  check("ai_message_role", sql`${t.role} in ('user','assistant','tool')`), check("ai_message_bound", sql`octet_length(${t.payload}::text) <= 65536`), index("ai_message_conversation").on(t.conversationId, t.createdAt)]);

export const aiStep = pgTable("ai_step", {
  id: uuid("id").primaryKey().defaultRandom(), ...scope(), runId: uuid("run_id").notNull(), operationKey: uuid("operation_key").notNull().defaultRandom(),
  toolName: text("tool_name").notNull(), state: text("state").$type<"prepared" | "executing" | "succeeded" | "failed" | "uncertain" | "skipped">().notNull().default("prepared"),
  argumentDigest: text("argument_digest"), dispatchLease: uuid("dispatch_lease"),
  version: integer("version").notNull().default(1), input: jsonb("input").$type<AiPayload>(), result: jsonb("result").$type<AiPayload>(),
  recordIds: jsonb("record_ids").$type<string[]>().notNull().default([]),
  requiredPermissions: jsonb("required_permissions").$type<string[]>().notNull(),
  createdAt: time("created_at").notNull().defaultNow(), updatedAt: time("updated_at").notNull().defaultNow(),
}, t => [unique("ai_step_operation").on(t.runId, t.operationKey), unique("ai_step_scope").on(t.id, t.organizationId, t.ownerId),
  unique("ai_step_execution_scope").on(t.id, t.runId, t.organizationId, t.ownerId),
  foreignKey({ columns: [t.runId, t.organizationId, t.ownerId], foreignColumns: [aiRun.id, aiRun.organizationId, aiRun.ownerId], name: "ai_step_run_scope" }).onDelete("cascade"),
  check("ai_step_state", sql`${t.state} in ('prepared','executing','succeeded','failed','uncertain','skipped')`), check("ai_step_version", sql`${t.version} > 0`),
  check("ai_step_argument_digest", sql`${t.argumentDigest} is null or ${t.argumentDigest} ~ '^[a-f0-9]{64}$'`),
  check("ai_step_dispatch_binding", sql`${t.dispatchLease} is null or ${t.argumentDigest} is not null`),
  check("ai_step_input_bound", sql`octet_length(${t.input}::text) <= 65536`), check("ai_step_result_bound", sql`octet_length(${t.result}::text) <= 65536`), check("ai_step_record_ids_bound", sql`octet_length(${t.recordIds}::text) <= 4096`)]);

export const aiApproval = pgTable("ai_approval", {
  id: uuid("id").primaryKey().defaultRandom(), ...scope(), stepId: uuid("step_id").notNull(),
  argumentHash: text("argument_hash").notNull(), version: integer("version").notNull().default(1),
  state: text("state").$type<"pending" | "consumed" | "rejected" | "expired">().notNull().default("pending"),
  preview: jsonb("preview").$type<AiPayload>(), expiresAt: time("expires_at").notNull(), consumedAt: time("consumed_at"),
  createdAt: time("created_at").notNull().defaultNow(),
}, t => [foreignKey({ columns: [t.stepId, t.organizationId, t.ownerId], foreignColumns: [aiStep.id, aiStep.organizationId, aiStep.ownerId], name: "ai_approval_step_scope" }).onDelete("cascade"),
  check("ai_approval_state", sql`${t.state} in ('pending','consumed','rejected','expired')`), check("ai_approval_version", sql`${t.version} > 0`),
  check("ai_approval_consumed", sql`(${t.state} = 'consumed') = (${t.consumedAt} is not null)`), check("ai_approval_preview_bound", sql`octet_length(${t.preview}::text) <= 65536`)]);

// Content-free durable events: payloads live only in the bounded tables above.
export const aiEvent = pgTable("ai_event", {
  id: uuid("id").primaryKey().defaultRandom(), ...scope(), runId: uuid("run_id").notNull(), sequence: integer("sequence").notNull(),
  kind: text("kind").notNull(), createdAt: time("created_at").notNull().defaultNow(),
}, t => [unique("ai_event_sequence").on(t.runId, t.sequence), foreignKey({ columns: [t.runId, t.organizationId, t.ownerId], foreignColumns: [aiRun.id, aiRun.organizationId, aiRun.ownerId], name: "ai_event_run_scope" }).onDelete("cascade")]);

export type AiInputCandidate = { type: "contact" | "journal_entry" | "expense_claim"; id: string };
// Clarification is untrusted input, never an approval or an executable tool payload.
export const aiRunInput = pgTable("ai_run_input", {
  id: uuid("id").primaryKey().defaultRandom(), ...scope(), runId: uuid("run_id").notNull(),
  inputVersion: integer("input_version").notNull(),
  kind: text("kind").$type<"choice" | "text">().notNull(),
  state: text("state").$type<"pending" | "answered" | "expired" | "cancelled">().notNull().default("pending"),
  question: jsonb("question").$type<AiPayload>(), candidates: jsonb("candidates").$type<AiInputCandidate[]>(),
  requiredPermissions: jsonb("required_permissions").$type<string[]>().notNull(),
  answer: jsonb("answer").$type<AiPayload>(), answerKey: text("answer_key"), answerDigest: text("answer_digest"),
  acceptedRunVersion: integer("accepted_run_version"), answeredAt: time("answered_at"),
  expiresAt: time("expires_at").notNull(), createdAt: time("created_at").notNull().defaultNow(),
}, t => [unique("ai_run_input_version").on(t.runId, t.inputVersion),
  foreignKey({ columns: [t.runId, t.organizationId, t.ownerId], foreignColumns: [aiRun.id, aiRun.organizationId, aiRun.ownerId], name: "ai_run_input_scope" }).onDelete("cascade"),
  index("ai_run_input_pending").on(t.state, t.expiresAt),
  uniqueIndex("ai_run_input_one_pending").on(t.runId).where(sql`${t.state} = 'pending'`),
  check("ai_run_input_version_positive", sql`${t.inputVersion} between 1 and 20`),
  check("ai_run_input_kind", sql`${t.kind} in ('choice','text')`),
  check("ai_run_input_state", sql`${t.state} in ('pending','answered','expired','cancelled')`),
  check("ai_run_input_answered", sql`(${t.state} = 'answered') = (${t.answeredAt} is not null and ${t.answerKey} is not null and ${t.answerDigest} is not null and ${t.acceptedRunVersion} is not null)`),
  check("ai_run_input_question_bound", sql`octet_length(${t.question}::text) <= 16384`),
  check("ai_run_input_answer_bound", sql`octet_length(${t.answer}::text) <= 32768`),
  check("ai_run_input_candidates_bound", sql`${t.candidates} is null or (jsonb_typeof(${t.candidates}) = 'array' and jsonb_array_length(${t.candidates}) <= 10 and octet_length(${t.candidates}::text) <= 4096)`),
]);
