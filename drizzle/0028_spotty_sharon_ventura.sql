CREATE TABLE "ai_action_resume" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"decision_id" uuid NOT NULL,
	"batch_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"request_key" text NOT NULL,
	"request_digest" text NOT NULL,
	"accepted_run_version" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_action_resume_batch" UNIQUE("batch_id"),
	CONSTRAINT "ai_action_resume_request" UNIQUE("run_id","request_key"),
	CONSTRAINT "ai_action_resume_digest" CHECK ("ai_action_resume"."request_digest" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "ai_action_resume_key" CHECK ("ai_action_resume"."request_key" ~ '^[A-Za-z0-9_-]{1,128}$'),
	CONSTRAINT "ai_action_resume_version" CHECK ("ai_action_resume"."accepted_run_version" > 0)
);
--> statement-breakpoint
ALTER TABLE "ai_action_resume" ADD CONSTRAINT "ai_action_resume_decision_scope" FOREIGN KEY ("decision_id","batch_id","run_id","organization_id","owner_id") REFERENCES "public"."ai_action_decision"("id","batch_id","run_id","organization_id","owner_id") ON DELETE cascade ON UPDATE no action;