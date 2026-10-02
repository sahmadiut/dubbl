ALTER TABLE "exchange_rate" ADD COLUMN "provider" text;--> statement-breakpoint
ALTER TABLE "exchange_rate" ADD COLUMN "provider_base" text;--> statement-breakpoint
ALTER TABLE "exchange_rate" ADD COLUMN "provider_quote" text;--> statement-breakpoint
ALTER TABLE "exchange_rate" ADD COLUMN "provider_observed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "exchange_rate" ADD COLUMN "imported_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "exchange_rate" ADD COLUMN "provider_rounding" text;