import { sql } from "drizzle-orm";
import { pgTable, uuid, text, timestamp, unique, foreignKey, check } from "drizzle-orm/pg-core";
import { aiActionConsumption } from "./ai-action-batches";
import { documentEmailLog } from "./email";

// One immutable attempt identity/envelope digest per consumed operation.
// The ordinary domain log owns content; AI metadata never copies it or provider
// responses. Uncertain is durable BEFORE dispatch and never authorizes resend.
export const aiActionDelivery = pgTable("ai_action_delivery", {
  id: uuid("id").primaryKey().defaultRandom(),
  consumptionId: uuid("consumption_id").notNull(),
  organizationId: uuid("organization_id").notNull(), ownerId: uuid("owner_id").notNull(),
  emailLogId: uuid("email_log_id").notNull(), envelopeDigest: text("envelope_digest").notNull(),
  state: text("state").$type<"confirmed" | "failed" | "uncertain">().notNull().default("uncertain"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  unique("ai_action_delivery_consumption").on(t.consumptionId), unique("ai_action_delivery_log").on(t.emailLogId),
  foreignKey({ columns: [t.consumptionId, t.organizationId, t.ownerId], foreignColumns: [aiActionConsumption.id, aiActionConsumption.organizationId, aiActionConsumption.ownerId], name: "ai_action_delivery_consumption_scope" }).onDelete("cascade"),
  foreignKey({ columns: [t.emailLogId, t.organizationId], foreignColumns: [documentEmailLog.id, documentEmailLog.organizationId], name: "ai_action_delivery_log_scope" }),
  check("ai_action_delivery_state", sql`${t.state} in ('confirmed','failed','uncertain')`),
  check("ai_action_delivery_digest", sql`${t.envelopeDigest} ~ '^[a-f0-9]{64}$'`),
]);
