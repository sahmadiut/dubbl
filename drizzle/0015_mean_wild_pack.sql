CREATE TABLE "ai_approval" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"step_id" uuid NOT NULL,
	"argument_hash" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"state" text DEFAULT 'pending' NOT NULL,
	"preview" jsonb,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_approval_state" CHECK ("ai_approval"."state" in ('pending','consumed','rejected','expired')),
	CONSTRAINT "ai_approval_version" CHECK ("ai_approval"."version" > 0),
	CONSTRAINT "ai_approval_consumed" CHECK (("ai_approval"."state" = 'consumed') = ("ai_approval"."consumed_at" is not null)),
	CONSTRAINT "ai_approval_preview_bound" CHECK (octet_length("ai_approval"."preview"::text) <= 65536)
);
--> statement-breakpoint
CREATE TABLE "ai_conversation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"content_expires_at" timestamp with time zone NOT NULL,
	"metadata_expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "ai_conversation_scope" UNIQUE("id","organization_id","owner_id"),
	CONSTRAINT "ai_conversation_version" CHECK ("ai_conversation"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "ai_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"kind" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_event_sequence" UNIQUE("run_id","sequence")
);
--> statement-breakpoint
CREATE TABLE "ai_message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" text NOT NULL,
	"payload" jsonb,
	"required_permissions" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_message_role" CHECK ("ai_message"."role" in ('user','assistant','tool')),
	CONSTRAINT "ai_message_bound" CHECK (octet_length("ai_message"."payload"::text) <= 65536)
);
--> statement-breakpoint
CREATE TABLE "ai_run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"request_key" text NOT NULL,
	"state" text DEFAULT 'queued' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"identity" jsonb NOT NULL,
	"config" jsonb NOT NULL,
	"payload_bytes" integer DEFAULT 0 NOT NULL,
	"lease_owner" uuid,
	"lease_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	CONSTRAINT "ai_run_scope" UNIQUE("id","organization_id","owner_id"),
	CONSTRAINT "ai_run_request" UNIQUE("conversation_id","request_key"),
	CONSTRAINT "ai_run_version" CHECK ("ai_run"."version" > 0),
	CONSTRAINT "ai_run_payload_bound" CHECK ("ai_run"."payload_bytes" between 0 and 1048576),
	CONSTRAINT "ai_run_state" CHECK ("ai_run"."state" in ('queued','running','awaiting_approval','awaiting_input','reconciliation_required','succeeded','failed','cancelled','expired')),
	CONSTRAINT "ai_run_terminal" CHECK (("ai_run"."state" in ('succeeded','failed','cancelled','expired')) = ("ai_run"."finished_at" is not null)),
	CONSTRAINT "ai_run_lease" CHECK (("ai_run"."lease_owner" is null) = ("ai_run"."lease_expires_at" is null) and ("ai_run"."state" = 'running' or "ai_run"."lease_owner" is null))
);
--> statement-breakpoint
CREATE TABLE "ai_step" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"operation_key" uuid DEFAULT gen_random_uuid() NOT NULL,
	"tool_name" text NOT NULL,
	"state" text DEFAULT 'prepared' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"input" jsonb,
	"result" jsonb,
	"required_permissions" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_step_operation" UNIQUE("run_id","operation_key"),
	CONSTRAINT "ai_step_scope" UNIQUE("id","organization_id","owner_id"),
	CONSTRAINT "ai_step_state" CHECK ("ai_step"."state" in ('prepared','executing','succeeded','failed','uncertain','skipped')),
	CONSTRAINT "ai_step_version" CHECK ("ai_step"."version" > 0),
	CONSTRAINT "ai_step_input_bound" CHECK (octet_length("ai_step"."input"::text) <= 65536),
	CONSTRAINT "ai_step_result_bound" CHECK (octet_length("ai_step"."result"::text) <= 65536)
);
--> statement-breakpoint
ALTER TABLE "ai_approval" ADD CONSTRAINT "ai_approval_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_approval" ADD CONSTRAINT "ai_approval_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_approval" ADD CONSTRAINT "ai_approval_step_scope" FOREIGN KEY ("step_id","organization_id","owner_id") REFERENCES "public"."ai_step"("id","organization_id","owner_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_conversation" ADD CONSTRAINT "ai_conversation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_conversation" ADD CONSTRAINT "ai_conversation_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_event" ADD CONSTRAINT "ai_event_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_event" ADD CONSTRAINT "ai_event_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_event" ADD CONSTRAINT "ai_event_run_scope" FOREIGN KEY ("run_id","organization_id","owner_id") REFERENCES "public"."ai_run"("id","organization_id","owner_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_message" ADD CONSTRAINT "ai_message_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_message" ADD CONSTRAINT "ai_message_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_message" ADD CONSTRAINT "ai_message_scope" FOREIGN KEY ("conversation_id","organization_id","owner_id") REFERENCES "public"."ai_conversation"("id","organization_id","owner_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_run" ADD CONSTRAINT "ai_run_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_run" ADD CONSTRAINT "ai_run_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_run" ADD CONSTRAINT "ai_run_conversation_scope" FOREIGN KEY ("conversation_id","organization_id","owner_id") REFERENCES "public"."ai_conversation"("id","organization_id","owner_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_step" ADD CONSTRAINT "ai_step_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_step" ADD CONSTRAINT "ai_step_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_step" ADD CONSTRAINT "ai_step_run_scope" FOREIGN KEY ("run_id","organization_id","owner_id") REFERENCES "public"."ai_run"("id","organization_id","owner_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_conversation_owner" ON "ai_conversation" USING btree ("organization_id","owner_id");--> statement-breakpoint
CREATE INDEX "ai_message_conversation" ON "ai_message" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "ai_run_queue" ON "ai_run" USING btree ("state","lease_expires_at");