import { sql } from "drizzle-orm";
import { pgTable, uuid, text, integer, boolean, jsonb, timestamp, uniqueIndex, check } from "drizzle-orm/pg-core";
import { organization } from "./auth";

export type AiModel = { id: string; contextTokens: number; outputTokens: number; functionCalls: boolean; strictSchemas: boolean; streaming: boolean; usage: boolean; evidenceDate: string };
export const aiProvider = pgTable("ai_provider", {
  id: uuid("id").primaryKey().defaultRandom(), name: text("name").notNull(),
  adapter: text("adapter").$type<"responses">().notNull(), endpoint: text("endpoint").notNull(),
  enabled: boolean("enabled").notNull().default(false), models: jsonb("models").$type<AiModel[]>().notNull(), defaultModel: text("default_model").notNull(),
  timeoutMs: integer("timeout_ms").notNull().default(30000), delegatedOrganizations: jsonb("delegated_organizations").$type<string[]>().notNull().default([]),
  version: integer("version").notNull().default(1), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [check("ai_provider_timeout", sql`${t.timeoutMs} between 100 and 120000`), check("ai_provider_version", sql`${t.version} > 0`)]);

export const aiProviderConfig = pgTable("ai_provider_config", {
  id: uuid("id").primaryKey().defaultRandom(), organizationId: uuid("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
  providerId: uuid("provider_id").notNull().references(() => aiProvider.id), model: text("model").notNull(),
  enabled: boolean("enabled").notNull().default(false), isDefault: boolean("is_default").notNull().default(false), timeoutMs: integer("timeout_ms").notNull(),
  credential: text("credential"), keyVersion: text("key_version"), credentialRef: uuid("credential_ref").notNull().defaultRandom(),
  version: integer("version").notNull().default(1), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [uniqueIndex("ai_provider_config_org_provider").on(t.organizationId, t.providerId),
  uniqueIndex("ai_provider_config_default").on(t.organizationId).where(sql`${t.isDefault}`),
  check("ai_provider_config_timeout", sql`${t.timeoutMs} between 100 and 120000`), check("ai_provider_config_version", sql`${t.version} > 0`),
  check("ai_provider_config_secret", sql`(${t.credential} is null) = (${t.keyVersion} is null)`)]);
