ALTER TABLE "contractor_payment" ADD COLUMN "base_amount" bigint;--> statement-breakpoint
ALTER TABLE "contractor_payment" ADD COLUMN "base_currency" text;--> statement-breakpoint
ALTER TABLE "contractor_payment" ADD COLUMN "rate_exact" numeric;--> statement-breakpoint
ALTER TABLE "contractor_payment" ADD COLUMN "payment_date" date;--> statement-breakpoint
ALTER TABLE "contractor_payment" ADD CONSTRAINT "contractor_payment_rate_exact_check" CHECK ("contractor_payment"."rate_exact" IS NULL OR ("contractor_payment"."rate_exact" > 0 AND "contractor_payment"."rate_exact" < 100000000000000000000 AND "contractor_payment"."rate_exact" = trunc("contractor_payment"."rate_exact", 18)));