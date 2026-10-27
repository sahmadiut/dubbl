ALTER TABLE "ai_run" ADD COLUMN "request_digest" text;--> statement-breakpoint
ALTER TABLE "ai_run" ADD COLUMN "started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ai_run" ADD COLUMN "deadline_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ai_run" ADD COLUMN "cancel_requested_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ai_run" ADD CONSTRAINT "ai_run_deadline" CHECK (("ai_run"."started_at" is null) = ("ai_run"."deadline_at" is null) and ("ai_run"."deadline_at" is null or "ai_run"."deadline_at" > "ai_run"."started_at"));