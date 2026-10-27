CREATE TABLE "ai_budget" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"subject" text NOT NULL,
	"user_id" uuid,
	"currency" text NOT NULL,
	"monthly_tokens" numeric(38, 0) NOT NULL,
	"monthly_cost" numeric(38, 0) NOT NULL,
	"run_tokens" numeric(38, 0) NOT NULL,
	"run_cost" numeric(38, 0) NOT NULL,
	"requests_per_minute" integer NOT NULL,
	"concurrency" integer NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_budget_subject" UNIQUE("organization_id","subject","currency"),
	CONSTRAINT "ai_budget_subject_scope" CHECK (("ai_budget"."subject" = 'organization' and "ai_budget"."user_id" is null) or ("ai_budget"."user_id" is not null and "ai_budget"."subject" = 'user:' || "ai_budget"."user_id"::text)),
	CONSTRAINT "ai_budget_limits" CHECK ("ai_budget"."monthly_tokens" >= 0 and "ai_budget"."monthly_cost" >= 0 and "ai_budget"."run_tokens" >= 0 and "ai_budget"."run_cost" >= 0 and "ai_budget"."requests_per_minute" between 0 and 10000 and "ai_budget"."concurrency" between 0 and 1000 and "ai_budget"."version" > 0),
	CONSTRAINT "ai_budget_currency" CHECK ("ai_budget"."currency" ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
CREATE TABLE "ai_price" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"provider_id" uuid NOT NULL,
	"model" text NOT NULL,
	"currency" text NOT NULL,
	"input_rate" numeric(38, 0) NOT NULL,
	"output_rate" numeric(38, 0) NOT NULL,
	"cached_rate" numeric(38, 0) NOT NULL,
	"reasoning_rate" numeric(38, 0) NOT NULL,
	"evidence_date" text NOT NULL,
	"source" text NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_price_scope" UNIQUE("id","organization_id"),
	CONSTRAINT "ai_price_rates" CHECK ("ai_price"."input_rate" >= 0 and "ai_price"."output_rate" >= 0 and "ai_price"."cached_rate" >= 0 and "ai_price"."reasoning_rate" >= 0),
	CONSTRAINT "ai_price_currency" CHECK ("ai_price"."currency" ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
CREATE TABLE "ai_usage_attempt" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"run_id" uuid,
	"attempt_key" text NOT NULL,
	"price_id" uuid NOT NULL,
	"provider_id" uuid NOT NULL,
	"model" text NOT NULL,
	"currency" text NOT NULL,
	"state" text DEFAULT 'reserved' NOT NULL,
	"reserved_tokens" numeric(38, 0) NOT NULL,
	"reserved_cost" numeric(38, 0) NOT NULL,
	"charged_tokens" numeric(38, 0) NOT NULL,
	"charged_cost" numeric(38, 0) NOT NULL,
	"input_tokens" numeric(38, 0),
	"output_tokens" numeric(38, 0),
	"cached_tokens" numeric(38, 0),
	"reasoning_tokens" numeric(38, 0),
	"price_snapshot" text NOT NULL,
	"budget_versions" text NOT NULL,
	"settlement" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_usage_attempt_key" UNIQUE("organization_id","owner_id","attempt_key"),
	CONSTRAINT "ai_usage_state" CHECK ("ai_usage_attempt"."state" in ('reserved','in_flight','unknown','settled','cancelled')),
	CONSTRAINT "ai_usage_nonnegative" CHECK ("ai_usage_attempt"."reserved_tokens" >= 0 and "ai_usage_attempt"."reserved_cost" >= 0 and "ai_usage_attempt"."charged_tokens" >= 0 and "ai_usage_attempt"."charged_cost" >= 0 and coalesce("ai_usage_attempt"."input_tokens",0) >= 0 and coalesce("ai_usage_attempt"."output_tokens",0) >= 0 and coalesce("ai_usage_attempt"."cached_tokens",0) >= 0 and coalesce("ai_usage_attempt"."reasoning_tokens",0) >= 0),
	CONSTRAINT "ai_usage_token_subsets" CHECK (("ai_usage_attempt"."cached_tokens" is null or "ai_usage_attempt"."input_tokens" is null or "ai_usage_attempt"."cached_tokens" <= "ai_usage_attempt"."input_tokens") and ("ai_usage_attempt"."reasoning_tokens" is null or "ai_usage_attempt"."output_tokens" is null or "ai_usage_attempt"."reasoning_tokens" <= "ai_usage_attempt"."output_tokens")),
	CONSTRAINT "ai_usage_settled" CHECK ("ai_usage_attempt"."state" <> 'settled' or ("ai_usage_attempt"."input_tokens" is not null and "ai_usage_attempt"."output_tokens" is not null))
);
--> statement-breakpoint
ALTER TABLE "ai_budget" ADD CONSTRAINT "ai_budget_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_budget" ADD CONSTRAINT "ai_budget_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_price" ADD CONSTRAINT "ai_price_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_price" ADD CONSTRAINT "ai_price_provider_id_ai_provider_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."ai_provider"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_price" ADD CONSTRAINT "ai_price_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage_attempt" ADD CONSTRAINT "ai_usage_attempt_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage_attempt" ADD CONSTRAINT "ai_usage_attempt_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage_attempt" ADD CONSTRAINT "ai_usage_attempt_provider_id_ai_provider_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."ai_provider"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage_attempt" ADD CONSTRAINT "ai_usage_run_scope" FOREIGN KEY ("run_id","organization_id","owner_id") REFERENCES "public"."ai_run"("id","organization_id","owner_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage_attempt" ADD CONSTRAINT "ai_usage_price_scope" FOREIGN KEY ("price_id","organization_id") REFERENCES "public"."ai_price"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_usage_scope_time" ON "ai_usage_attempt" USING btree ("organization_id","created_at");