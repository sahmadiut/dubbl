CREATE TABLE "ai_provider" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"adapter" text NOT NULL,
	"endpoint" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"models" jsonb NOT NULL,
	"default_model" text NOT NULL,
	"timeout_ms" integer DEFAULT 30000 NOT NULL,
	"delegated_organizations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_provider_timeout" CHECK ("ai_provider"."timeout_ms" between 100 and 120000),
	CONSTRAINT "ai_provider_version" CHECK ("ai_provider"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "ai_provider_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"provider_id" uuid NOT NULL,
	"model" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"timeout_ms" integer NOT NULL,
	"credential" text,
	"key_version" text,
	"credential_ref" uuid DEFAULT gen_random_uuid() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_provider_config_timeout" CHECK ("ai_provider_config"."timeout_ms" between 100 and 120000),
	CONSTRAINT "ai_provider_config_version" CHECK ("ai_provider_config"."version" > 0),
	CONSTRAINT "ai_provider_config_secret" CHECK (("ai_provider_config"."credential" is null) = ("ai_provider_config"."key_version" is null))
);
--> statement-breakpoint
ALTER TABLE "ai_provider_config" ADD CONSTRAINT "ai_provider_config_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_provider_config" ADD CONSTRAINT "ai_provider_config_provider_id_ai_provider_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."ai_provider"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ai_provider_config_org_provider" ON "ai_provider_config" USING btree ("organization_id","provider_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_provider_config_default" ON "ai_provider_config" USING btree ("organization_id") WHERE "ai_provider_config"."is_default";