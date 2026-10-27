CREATE TABLE "ai_tool_policy" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"subject" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"allowed_tools" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_tool_policy_scope" UNIQUE("organization_id","subject"),
	CONSTRAINT "ai_tool_policy_version" CHECK ("ai_tool_policy"."version" > 0),
	CONSTRAINT "ai_tool_policy_subject" CHECK ("ai_tool_policy"."subject" = 'organization' or "ai_tool_policy"."subject" ~ '^agent:[a-zA-Z0-9_-]{1,64}$'),
	CONSTRAINT "ai_tool_policy_bound" CHECK (jsonb_typeof("ai_tool_policy"."allowed_tools") = 'array' and octet_length("ai_tool_policy"."allowed_tools"::text) <= 16384)
);
--> statement-breakpoint
ALTER TABLE "ai_tool_policy" ADD CONSTRAINT "ai_tool_policy_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;