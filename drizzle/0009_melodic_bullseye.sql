ALTER TABLE "payroll_item_deduction" ADD COLUMN "employee_deduction_id" uuid;--> statement-breakpoint
ALTER TABLE "payroll_item_deduction" ADD COLUMN "liability_account_code" text;--> statement-breakpoint
ALTER TABLE "payroll_run" ADD COLUMN "base_currency" text;--> statement-breakpoint
ALTER TABLE "payroll_run" ADD COLUMN "termination_employee_id" uuid;--> statement-breakpoint
ALTER TABLE "payroll_run" ADD COLUMN "termination_pto_hours" real;--> statement-breakpoint
ALTER TABLE "payroll_item_deduction" ADD CONSTRAINT "payroll_item_deduction_employee_deduction_id_employee_deduction_id_fk" FOREIGN KEY ("employee_deduction_id") REFERENCES "public"."employee_deduction"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
-- Bounded consumer cutover: new payroll snapshots use authoritative numeric FX.
-- Retain real for old readers; its rounded binary32 multiplier is explicitly approximate.
-- No existing row, monetary amount, rate or migration status is rewritten.
CREATE FUNCTION public.sync_payroll_snapshot_fx() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  adopted boolean := false;
  exact_decimal numeric;
  legacy_changed boolean;
  exact_changed boolean;
  legacy_state text;
  legacy_provenance text;
BEGIN
  IF NEW.rate_provenance IS NOT NULL AND left(NEW.rate_provenance, 1) = '{' THEN
    BEGIN
      adopted := (NEW.rate_provenance::jsonb ->> 'format') = 'payroll_exact_v1';
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'Invalid payroll FX provenance' USING ERRCODE = '23514';
    END;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.rate_provenance IS NOT NULL AND left(OLD.rate_provenance, 1) = '{'
    AND OLD.rate_provenance::jsonb ->> 'format' = 'payroll_exact_v1' AND NOT coalesce(adopted, false) THEN
    RAISE EXCEPTION 'Payroll FX snapshot provenance cannot be removed' USING ERRCODE = '23514';
  END IF;
  IF NOT coalesce(adopted, false) THEN
    -- Keep the unadopted legacy writer/backfill contract from sync_exact_fx.
    legacy_changed := TG_OP = 'INSERT';
    exact_changed := TG_OP = 'INSERT' AND NEW.rate_exact IS NOT NULL;
    IF TG_OP = 'UPDATE' THEN
      legacy_changed := NEW.fx_rate IS DISTINCT FROM OLD.fx_rate;
      exact_changed := NEW.rate_exact IS DISTINCT FROM OLD.rate_exact;
    END IF;
    IF NEW.rate_format_version IS DISTINCT FROM 1 OR NEW.rate_direction IS DISTINCT FROM 'quote_per_base' THEN
      RAISE EXCEPTION 'Unsupported FX format or direction' USING ERRCODE = '23514';
    END IF;
    exact_decimal := public.fx_float4_exact(NEW.fx_rate);
    legacy_provenance := 'legacy_binary32_exact';
    IF exact_decimal IS NULL OR exact_decimal <= 0 THEN
      IF legacy_changed THEN RAISE EXCEPTION 'Legacy payroll FX must be positive and finite' USING ERRCODE = '23514'; END IF;
      exact_decimal := NULL; legacy_state := 'invalid_legacy'; legacy_provenance := 'legacy_invalid';
    ELSIF exact_decimal >= 100000000000000000000 OR exact_decimal <> trunc(exact_decimal, 18) THEN
      exact_decimal := NULL; legacy_state := 'legacy_float_requires_review'; legacy_provenance := 'legacy_binary32_outside_policy';
    END IF;
    IF exact_changed AND NEW.rate_exact IS DISTINCT FROM exact_decimal THEN
      RAISE EXCEPTION 'Legacy payroll FX aliases disagree; consumer cutover required' USING ERRCODE = '23514';
    END IF;
    NEW.rate_exact := exact_decimal;
    NEW.rate_migration_status := coalesce(legacy_state, 'exact');
    NEW.rate_provenance := legacy_provenance;
    RETURN NEW;
  END IF;
  IF NEW.rate_format_version IS DISTINCT FROM 1 OR NEW.rate_direction IS DISTINCT FROM 'quote_per_base'
    OR NEW.rate_migration_status IS DISTINCT FROM 'exact' OR NEW.rate_exact IS NULL
    OR NEW.rate_exact <= 0 OR NEW.rate_exact >= 100000000000000000000 OR NEW.rate_exact <> trunc(NEW.rate_exact, 18)
    OR NEW.fx_rate IS DISTINCT FROM NEW.rate_exact::real THEN
    RAISE EXCEPTION 'Unsupported payroll decimal FX snapshot or legacy approximation' USING ERRCODE = '23514';
  END IF;
  IF NEW.currency IS DISTINCT FROM (NEW.rate_provenance::jsonb ->> 'baseCurrency')
    OR (NEW.rate_provenance::jsonb ->> 'quoteCurrency') IS DISTINCT FROM
      (SELECT base_currency FROM public.payroll_run WHERE id = NEW.payroll_run_id) THEN
    RAISE EXCEPTION 'Payroll FX snapshot currencies disagree' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' AND (NEW.rate_exact IS DISTINCT FROM OLD.rate_exact OR NEW.fx_rate IS DISTINCT FROM OLD.fx_rate
    OR NEW.rate_provenance IS DISTINCT FROM OLD.rate_provenance OR NEW.rate_direction IS DISTINCT FROM OLD.rate_direction) THEN
    RAISE EXCEPTION 'Payroll FX snapshots are immutable; recreate draft or correct posted run' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
DROP TRIGGER payroll_item_exact_sync ON public.payroll_item;
--> statement-breakpoint
DROP TRIGGER payroll_item_exact_input_guard ON public.payroll_item;
--> statement-breakpoint
CREATE TRIGGER payroll_item_exact_sync BEFORE INSERT OR UPDATE ON public.payroll_item
FOR EACH ROW EXECUTE FUNCTION public.sync_payroll_snapshot_fx();
