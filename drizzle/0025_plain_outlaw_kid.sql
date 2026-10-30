CREATE TABLE "ai_action_decision" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"decision" text NOT NULL,
	"batch_version" integer NOT NULL,
	"accepted_run_version" integer NOT NULL,
	"binding_digest" text NOT NULL,
	"selection_digest" text NOT NULL,
	"request_key" text NOT NULL,
	"request_digest" text NOT NULL,
	"required_permissions" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_action_decision_batch" UNIQUE("batch_id"),
	CONSTRAINT "ai_action_decision_request" UNIQUE("run_id","request_key"),
	CONSTRAINT "ai_action_decision_kind" CHECK ("ai_action_decision"."decision" in ('approve','reject')),
	CONSTRAINT "ai_action_decision_version" CHECK ("ai_action_decision"."batch_version" between 1 and 20 and "ai_action_decision"."accepted_run_version" > 0),
	CONSTRAINT "ai_action_decision_digests" CHECK ("ai_action_decision"."binding_digest" ~ '^[a-f0-9]{64}$' and "ai_action_decision"."selection_digest" ~ '^[a-f0-9]{64}$' and "ai_action_decision"."request_digest" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "ai_action_decision_key" CHECK ("ai_action_decision"."request_key" ~ '^[A-Za-z0-9_-]{1,128}$'),
	CONSTRAINT "ai_action_decision_permissions" CHECK (jsonb_typeof("ai_action_decision"."required_permissions") = 'array' and octet_length("ai_action_decision"."required_permissions"::text) <= 1024)
);
--> statement-breakpoint
ALTER TABLE "ai_action_batch" ADD CONSTRAINT "ai_action_batch_scope" UNIQUE("id","run_id","organization_id","owner_id");
--> statement-breakpoint
ALTER TABLE "ai_action_decision" ADD CONSTRAINT "ai_action_decision_batch_scope" FOREIGN KEY ("batch_id","run_id","organization_id","owner_id") REFERENCES "public"."ai_action_batch"("id","run_id","organization_id","owner_id") ON DELETE cascade ON UPDATE no action;
