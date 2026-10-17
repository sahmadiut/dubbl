ALTER TABLE "organization" ADD COLUMN "default_language" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "language" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "time_zone" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "numerals" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "calendar" text;