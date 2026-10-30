CREATE TABLE "ai_action_delivery" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consumption_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"email_log_id" uuid NOT NULL,
	"envelope_digest" text NOT NULL,
	"state" text DEFAULT 'uncertain' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_action_delivery_consumption" UNIQUE("consumption_id"),
	CONSTRAINT "ai_action_delivery_log" UNIQUE("email_log_id"),
	CONSTRAINT "ai_action_delivery_state" CHECK ("ai_action_delivery"."state" in ('confirmed','failed','uncertain')),
	CONSTRAINT "ai_action_delivery_digest" CHECK ("ai_action_delivery"."envelope_digest" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
ALTER TABLE "document_email_log" ADD COLUMN "ai_attempt" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "document_email_log" ADD CONSTRAINT "document_email_log_scope" UNIQUE("id","organization_id");--> statement-breakpoint
ALTER TABLE "ai_action_consumption" ADD CONSTRAINT "ai_action_consumption_scope" UNIQUE("id","organization_id","owner_id");--> statement-breakpoint
ALTER TABLE "ai_action_delivery" ADD CONSTRAINT "ai_action_delivery_consumption_scope" FOREIGN KEY ("consumption_id","organization_id","owner_id") REFERENCES "public"."ai_action_consumption"("id","organization_id","owner_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_action_delivery" ADD CONSTRAINT "ai_action_delivery_log_scope" FOREIGN KEY ("email_log_id","organization_id") REFERENCES "public"."document_email_log"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
