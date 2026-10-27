import { sql } from "drizzle-orm";
import { pgTable, uuid, text, integer, boolean, jsonb, timestamp, unique, check } from "drizzle-orm/pg-core";
import { organization } from "./auth";

export const aiToolPolicy = pgTable("ai_tool_policy", {
  id: uuid("id").primaryKey().defaultRandom(), organizationId: uuid("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
  subject: text("subject").notNull(), enabled: boolean("enabled").notNull().default(false),
  allowedTools: jsonb("allowed_tools").$type<string[]>().notNull().default([]),
  version: integer("version").notNull().default(1), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [unique("ai_tool_policy_scope").on(t.organizationId, t.subject), check("ai_tool_policy_version", sql`${t.version} > 0`),
  check("ai_tool_policy_subject", sql`${t.subject} = 'organization' or ${t.subject} ~ '^agent:[a-zA-Z0-9_-]{1,64}$'`),
  check("ai_tool_policy_bound", sql`jsonb_typeof(${t.allowedTools}) = 'array' and octet_length(${t.allowedTools}::text) <= 16384`)]);
