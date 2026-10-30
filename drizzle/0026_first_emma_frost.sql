CREATE TABLE "ai_action_consumption" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"decision_id" uuid NOT NULL,
	"batch_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"step_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"dispatch_lease" uuid NOT NULL,
	"argument_digest" text NOT NULL,
	"resource_version" text NOT NULL,
	"policy_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_action_consumption_step" UNIQUE("step_id"),
	CONSTRAINT "ai_action_consumption_item" UNIQUE("decision_id","item_id"),
	CONSTRAINT "ai_action_consumption_digests" CHECK ("ai_action_consumption"."argument_digest" ~ '^[a-f0-9]{64}$' and "ai_action_consumption"."resource_version" ~ '^[a-f0-9]{64}$' and "ai_action_consumption"."policy_version" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
ALTER TABLE "ai_step" ADD CONSTRAINT "ai_step_execution_scope" UNIQUE("id","run_id","organization_id","owner_id");--> statement-breakpoint
ALTER TABLE "ai_action_decision" ADD CONSTRAINT "ai_action_decision_execution_scope" UNIQUE("id","batch_id","run_id","organization_id","owner_id");--> statement-breakpoint
ALTER TABLE "ai_action_consumption" ADD CONSTRAINT "ai_action_consumption_decision_scope" FOREIGN KEY ("decision_id","batch_id","run_id","organization_id","owner_id") REFERENCES "public"."ai_action_decision"("id","batch_id","run_id","organization_id","owner_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_action_consumption" ADD CONSTRAINT "ai_action_consumption_step_scope" FOREIGN KEY ("step_id","run_id","organization_id","owner_id") REFERENCES "public"."ai_step"("id","run_id","organization_id","owner_id") ON DELETE cascade ON UPDATE no action;
