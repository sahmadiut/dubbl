CREATE TABLE "ai_run_input" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"input_version" integer NOT NULL,
	"kind" text NOT NULL,
	"state" text DEFAULT 'pending' NOT NULL,
	"question" jsonb,
	"candidates" jsonb,
	"required_permissions" jsonb NOT NULL,
	"answer" jsonb,
	"answer_key" text,
	"answer_digest" text,
	"accepted_run_version" integer,
	"answered_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_run_input_version" UNIQUE("run_id","input_version"),
	CONSTRAINT "ai_run_input_version_positive" CHECK ("ai_run_input"."input_version" between 1 and 20),
	CONSTRAINT "ai_run_input_kind" CHECK ("ai_run_input"."kind" in ('choice','text')),
	CONSTRAINT "ai_run_input_state" CHECK ("ai_run_input"."state" in ('pending','answered','expired','cancelled')),
	CONSTRAINT "ai_run_input_answered" CHECK (("ai_run_input"."state" = 'answered') = ("ai_run_input"."answered_at" is not null and "ai_run_input"."answer_key" is not null and "ai_run_input"."answer_digest" is not null and "ai_run_input"."accepted_run_version" is not null)),
	CONSTRAINT "ai_run_input_question_bound" CHECK (octet_length("ai_run_input"."question"::text) <= 16384),
	CONSTRAINT "ai_run_input_answer_bound" CHECK (octet_length("ai_run_input"."answer"::text) <= 32768),
	CONSTRAINT "ai_run_input_candidates_bound" CHECK ("ai_run_input"."candidates" is null or (jsonb_typeof("ai_run_input"."candidates") = 'array' and jsonb_array_length("ai_run_input"."candidates") <= 10 and octet_length("ai_run_input"."candidates"::text) <= 4096))
);
--> statement-breakpoint
ALTER TABLE "ai_run_input" ADD CONSTRAINT "ai_run_input_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_run_input" ADD CONSTRAINT "ai_run_input_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_run_input" ADD CONSTRAINT "ai_run_input_scope" FOREIGN KEY ("run_id","organization_id","owner_id") REFERENCES "public"."ai_run"("id","organization_id","owner_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_run_input_pending" ON "ai_run_input" USING btree ("state","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_run_input_one_pending" ON "ai_run_input" USING btree ("run_id") WHERE "ai_run_input"."state" = 'pending';