CREATE TABLE "ai_action_batch" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"accepted_run_version" integer NOT NULL,
	"state" text DEFAULT 'pending' NOT NULL,
	"request_key" text NOT NULL,
	"request_digest" text NOT NULL,
	"binding_digest" text NOT NULL,
	"authority" jsonb,
	"display" jsonb,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_action_batch_revision" UNIQUE("run_id","version"),
	CONSTRAINT "ai_action_batch_request" UNIQUE("run_id","request_key"),
	CONSTRAINT "ai_action_batch_version" CHECK ("ai_action_batch"."version" between 1 and 20 and "ai_action_batch"."accepted_run_version" > 0),
	CONSTRAINT "ai_action_batch_state" CHECK ("ai_action_batch"."state" in ('pending','superseded','expired','cancelled')),
	CONSTRAINT "ai_action_batch_digests" CHECK ("ai_action_batch"."request_digest" ~ '^[a-f0-9]{64}$' and "ai_action_batch"."binding_digest" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "ai_action_batch_authority_bound" CHECK (octet_length("ai_action_batch"."authority"::text) <= 32768),
	CONSTRAINT "ai_action_batch_display_bound" CHECK (octet_length("ai_action_batch"."display"::text) <= 60000)
);
--> statement-breakpoint
ALTER TABLE "ai_action_batch" ADD CONSTRAINT "ai_action_batch_run_scope" FOREIGN KEY ("run_id","organization_id","owner_id") REFERENCES "public"."ai_run"("id","organization_id","owner_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ai_action_batch_one_pending" ON "ai_action_batch" USING btree ("run_id") WHERE "ai_action_batch"."state" = 'pending';--> statement-breakpoint
CREATE INDEX "ai_action_batch_expiry" ON "ai_action_batch" USING btree ("expires_at");