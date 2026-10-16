CREATE TABLE "currency_regime" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"regime_key" text NOT NULL,
	"iso_code" text NOT NULL,
	"name" text NOT NULL,
	"effective_from" date,
	"effective_to" date,
	"display_minor_units" integer NOT NULL,
	"previous_regime_id" uuid,
	"scale_to_previous" numeric,
	"official" boolean DEFAULT false NOT NULL,
	"source_url" text NOT NULL,
	"verified_on" date NOT NULL,
	CONSTRAINT "currency_regime_org_id_idx" UNIQUE("organization_id","id"),
	CONSTRAINT "currency_regime_code_check" CHECK ("currency_regime"."iso_code" ~ '^[A-Z]{3}$'),
	CONSTRAINT "currency_regime_units_check" CHECK ("currency_regime"."display_minor_units" BETWEEN 0 AND 4),
	CONSTRAINT "currency_regime_dates_check" CHECK ("currency_regime"."effective_from" IS NULL OR "currency_regime"."effective_to" IS NULL OR "currency_regime"."effective_from" <= "currency_regime"."effective_to"),
	CONSTRAINT "currency_regime_scale_check" CHECK (("currency_regime"."previous_regime_id" IS NULL AND "currency_regime"."scale_to_previous" IS NULL) OR
    ("currency_regime"."previous_regime_id" IS NOT NULL AND "currency_regime"."previous_regime_id" <> "currency_regime"."id" AND "currency_regime"."scale_to_previous" IS NOT NULL AND
      "currency_regime"."scale_to_previous" > 0 AND "currency_regime"."scale_to_previous" < 100000000000000000000 AND
      "currency_regime"."scale_to_previous" = trunc("currency_regime"."scale_to_previous", 18)))
);
--> statement-breakpoint
ALTER TABLE "currency_regime" ADD CONSTRAINT "currency_regime_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "currency_regime" ADD CONSTRAINT "currency_regime_previous_org_fk" FOREIGN KEY ("organization_id","previous_regime_id") REFERENCES "public"."currency_regime"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "currency_regime_org_key_idx" ON "currency_regime" USING btree ("organization_id","regime_key");
--> statement-breakpoint
-- Metadata expansion only. No financial table is updated or rescaled.
-- official=false: CLDR establishes display policy, not an operational cutover.
INSERT INTO "currency_regime" ("organization_id", "regime_key", "iso_code", "name", "display_minor_units", "source_url", "verified_on")
SELECT "id", 'irr-current-v1', 'IRR', 'Iranian Rial', 0,
  'https://raw.githubusercontent.com/unicode-org/cldr/release-48/common/supplemental/supplementalData.xml', '2026-10-16'
FROM "organization";
--> statement-breakpoint
CREATE FUNCTION seed_organization_currency_regime() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO "currency_regime" ("organization_id", "regime_key", "iso_code", "name", "display_minor_units", "source_url", "verified_on")
  VALUES (NEW.id, 'irr-current-v1', 'IRR', 'Iranian Rial', 0,
    'https://raw.githubusercontent.com/unicode-org/cldr/release-48/common/supplemental/supplementalData.xml', '2026-10-16');
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER organization_currency_regime_seed AFTER INSERT ON "organization"
FOR EACH ROW EXECUTE FUNCTION seed_organization_currency_regime();
--> statement-breakpoint
CREATE FUNCTION protect_currency_regime() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Organization deletion must retain its established cascading cleanup contract.
  IF TG_OP = 'DELETE' AND NOT EXISTS (SELECT 1 FROM "organization" WHERE id = OLD.organization_id) THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Currency regime metadata is immutable; append a new version' USING ERRCODE = '23514';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER currency_regime_immutable BEFORE UPDATE OR DELETE ON "currency_regime"
FOR EACH ROW EXECUTE FUNCTION protect_currency_regime();
