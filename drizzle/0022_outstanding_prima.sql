ALTER TABLE "ai_step" ADD COLUMN "argument_digest" text;--> statement-breakpoint
ALTER TABLE "ai_step" ADD COLUMN "dispatch_lease" uuid;--> statement-breakpoint
ALTER TABLE "ai_step" ADD CONSTRAINT "ai_step_argument_digest" CHECK ("ai_step"."argument_digest" is null or "ai_step"."argument_digest" ~ '^[a-f0-9]{64}$');--> statement-breakpoint
ALTER TABLE "ai_step" ADD CONSTRAINT "ai_step_dispatch_binding" CHECK ("ai_step"."dispatch_lease" is null or "ai_step"."argument_digest" is not null);