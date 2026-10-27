import { sql } from "drizzle-orm";
import { pgTable, uuid, text, integer, numeric, timestamp, unique, foreignKey, check, index } from "drizzle-orm/pg-core";
import { organization, users } from "./auth";
import { aiProvider } from "./ai-providers";
import { aiRun } from "./ai";

// Cost atoms are 10^-12 major billing-currency units, NOT accounting cents.
// Prices are integer micro-major-units per million tokens: one price atom per
// token equals one cost atom. No binary floating point or FX conversion.
const atoms = (name: string) => numeric(name, { precision: 38, scale: 0 });
const time = (name: string) => timestamp(name, { withTimezone: true }).notNull().defaultNow();
export const aiPrice = pgTable("ai_price", {
  id: uuid("id").primaryKey().defaultRandom(), organizationId: uuid("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
  providerId: uuid("provider_id").notNull().references(() => aiProvider.id), model: text("model").notNull(), currency: text("currency").notNull(),
  inputRate: atoms("input_rate").notNull(), outputRate: atoms("output_rate").notNull(), cachedRate: atoms("cached_rate").notNull(), reasoningRate: atoms("reasoning_rate").notNull(),
  evidenceDate: text("evidence_date").notNull(), source: text("source").notNull(), createdBy: uuid("created_by").notNull().references(() => users.id), createdAt: time("created_at"),
}, t => [unique("ai_price_scope").on(t.id, t.organizationId), check("ai_price_rates", sql`${t.inputRate} >= 0 and ${t.outputRate} >= 0 and ${t.cachedRate} >= 0 and ${t.reasoningRate} >= 0`), check("ai_price_currency", sql`${t.currency} ~ '^[A-Z]{3}$'`)]);

export const aiBudget = pgTable("ai_budget", {
  id: uuid("id").primaryKey().defaultRandom(), organizationId: uuid("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
  subject: text("subject").notNull(), userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }), currency: text("currency").notNull(),
  monthlyTokens: atoms("monthly_tokens").notNull(), monthlyCost: atoms("monthly_cost").notNull(), runTokens: atoms("run_tokens").notNull(), runCost: atoms("run_cost").notNull(),
  requestsPerMinute: integer("requests_per_minute").notNull(), concurrency: integer("concurrency").notNull(), version: integer("version").notNull().default(1), updatedAt: time("updated_at"),
}, t => [unique("ai_budget_subject").on(t.organizationId, t.subject, t.currency), check("ai_budget_subject_scope", sql`(${t.subject} = 'organization' and ${t.userId} is null) or (${t.userId} is not null and ${t.subject} = 'user:' || ${t.userId}::text)`),
  check("ai_budget_limits", sql`${t.monthlyTokens} >= 0 and ${t.monthlyCost} >= 0 and ${t.runTokens} >= 0 and ${t.runCost} >= 0 and ${t.requestsPerMinute} between 0 and 10000 and ${t.concurrency} between 0 and 1000 and ${t.version} > 0`), check("ai_budget_currency", sql`${t.currency} ~ '^[A-Z]{3}$'`)]);

export const aiUsageAttempt = pgTable("ai_usage_attempt", {
  id: uuid("id").primaryKey().defaultRandom(), organizationId: uuid("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }), ownerId: uuid("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  // Null only for bounded administrative connection tests, never ordinary runs.
  runId: uuid("run_id"), attemptKey: text("attempt_key").notNull(), priceId: uuid("price_id").notNull(), providerId: uuid("provider_id").notNull().references(() => aiProvider.id), model: text("model").notNull(), currency: text("currency").notNull(),
  state: text("state").$type<"reserved" | "in_flight" | "unknown" | "settled" | "cancelled">().notNull().default("reserved"),
  reservedTokens: atoms("reserved_tokens").notNull(), reservedCost: atoms("reserved_cost").notNull(), chargedTokens: atoms("charged_tokens").notNull(), chargedCost: atoms("charged_cost").notNull(),
  inputTokens: atoms("input_tokens"), outputTokens: atoms("output_tokens"), cachedTokens: atoms("cached_tokens"), reasoningTokens: atoms("reasoning_tokens"),
  // Copy is immutable under service API even if a provider/model is reconfigured.
  priceSnapshot: text("price_snapshot").notNull(), budgetVersions: text("budget_versions").notNull(), settlement: text("settlement"), createdAt: time("created_at"), updatedAt: time("updated_at"),
}, t => [unique("ai_usage_attempt_key").on(t.organizationId, t.ownerId, t.attemptKey),
  foreignKey({ columns: [t.runId, t.organizationId, t.ownerId], foreignColumns: [aiRun.id, aiRun.organizationId, aiRun.ownerId], name: "ai_usage_run_scope" }).onDelete("cascade"),
  foreignKey({ columns: [t.priceId, t.organizationId], foreignColumns: [aiPrice.id, aiPrice.organizationId], name: "ai_usage_price_scope" }),
  index("ai_usage_scope_time").on(t.organizationId, t.createdAt),
  check("ai_usage_state", sql`${t.state} in ('reserved','in_flight','unknown','settled','cancelled')`),
  check("ai_usage_nonnegative", sql`${t.reservedTokens} >= 0 and ${t.reservedCost} >= 0 and ${t.chargedTokens} >= 0 and ${t.chargedCost} >= 0 and coalesce(${t.inputTokens},0) >= 0 and coalesce(${t.outputTokens},0) >= 0 and coalesce(${t.cachedTokens},0) >= 0 and coalesce(${t.reasoningTokens},0) >= 0`),
  check("ai_usage_token_subsets", sql`(${t.cachedTokens} is null or ${t.inputTokens} is null or ${t.cachedTokens} <= ${t.inputTokens}) and (${t.reasoningTokens} is null or ${t.outputTokens} is null or ${t.reasoningTokens} <= ${t.outputTokens})`),
  check("ai_usage_settled", sql`${t.state} <> 'settled' or (${t.inputTokens} is not null and ${t.outputTokens} is not null)`),
]);
