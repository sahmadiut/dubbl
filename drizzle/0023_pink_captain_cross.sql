CREATE TABLE "ai_provider_attempt" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"attempt_key" uuid NOT NULL,
	"ordinal" integer NOT NULL,
	"usage_attempt_id" uuid NOT NULL,
	"dispatch_lease" uuid NOT NULL,
	"state" text DEFAULT 'reserved' NOT NULL,
	"snapshot" jsonb NOT NULL,
	"request_digest" text NOT NULL,
	"request_bytes" integer NOT NULL,
	"response_digest" text,
	"code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_provider_attempt_key" UNIQUE("run_id","attempt_key"),
	CONSTRAINT "ai_provider_attempt_ordinal" UNIQUE("run_id","ordinal"),
	CONSTRAINT "ai_provider_attempt_usage" UNIQUE("usage_attempt_id"),
	CONSTRAINT "ai_provider_attempt_scope" UNIQUE("id","run_id","organization_id","owner_id"),
	CONSTRAINT "ai_provider_attempt_state" CHECK ("ai_provider_attempt"."state" in ('reserved','dispatched','completed','abandoned','cancelled')),
	CONSTRAINT "ai_provider_attempt_bounds" CHECK ("ai_provider_attempt"."ordinal" between 1 and 8 and "ai_provider_attempt"."request_bytes" between 1 and 65536 and octet_length("ai_provider_attempt"."snapshot"::text) <= 16384),
	CONSTRAINT "ai_provider_attempt_digests" CHECK ("ai_provider_attempt"."request_digest" ~ '^[a-f0-9]{64}$' and ("ai_provider_attempt"."response_digest" is null or "ai_provider_attempt"."response_digest" ~ '^[a-f0-9]{64}$'))
);
--> statement-breakpoint
CREATE TABLE "ai_provider_call" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"provider_attempt_id" uuid NOT NULL,
	"call_id" text NOT NULL,
	"operation_key" uuid NOT NULL,
	"tool_name" text NOT NULL,
	"catalog_version" integer NOT NULL,
	"argument_digest" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_provider_call_id" UNIQUE("run_id","call_id"),
	CONSTRAINT "ai_provider_call_operation" UNIQUE("run_id","operation_key"),
	CONSTRAINT "ai_provider_call_attempt" UNIQUE("provider_attempt_id"),
	CONSTRAINT "ai_provider_call_bound" CHECK ("ai_provider_call"."call_id" ~ '^[A-Za-z0-9_-]{1,128}$' and length("ai_provider_call"."tool_name") between 1 and 128 and "ai_provider_call"."catalog_version" > 0 and "ai_provider_call"."argument_digest" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
ALTER TABLE "ai_provider_attempt" ADD CONSTRAINT "ai_provider_attempt_run_scope" FOREIGN KEY ("run_id","organization_id","owner_id") REFERENCES "public"."ai_run"("id","organization_id","owner_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage_attempt" ADD CONSTRAINT "ai_usage_attempt_run_scope" UNIQUE("id","run_id","organization_id","owner_id");--> statement-breakpoint
ALTER TABLE "ai_provider_attempt" ADD CONSTRAINT "ai_provider_attempt_usage_scope" FOREIGN KEY ("usage_attempt_id","run_id","organization_id","owner_id") REFERENCES "public"."ai_usage_attempt"("id","run_id","organization_id","owner_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_provider_call" ADD CONSTRAINT "ai_provider_call_attempt_scope" FOREIGN KEY ("provider_attempt_id","run_id","organization_id","owner_id") REFERENCES "public"."ai_provider_attempt"("id","run_id","organization_id","owner_id") ON DELETE cascade ON UPDATE no action;
