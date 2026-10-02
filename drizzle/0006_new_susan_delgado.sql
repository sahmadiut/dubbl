SET LOCAL lock_timeout = '5s';
--> statement-breakpoint
SET LOCAL statement_timeout = '15min';
--> statement-breakpoint
ALTER TABLE "exchange_rate" ADD COLUMN "rate_exact" numeric;--> statement-breakpoint
ALTER TABLE "exchange_rate" ADD COLUMN "rate_format_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "exchange_rate" ADD COLUMN "rate_direction" text DEFAULT 'quote_per_base' NOT NULL;--> statement-breakpoint
ALTER TABLE "exchange_rate" ADD COLUMN "rate_provenance" text;--> statement-breakpoint
ALTER TABLE "exchange_rate" ADD COLUMN "rate_migration_status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "journal_line" ADD COLUMN "rate_exact" numeric;--> statement-breakpoint
ALTER TABLE "journal_line" ADD COLUMN "rate_format_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "journal_line" ADD COLUMN "rate_direction" text DEFAULT 'quote_per_base' NOT NULL;--> statement-breakpoint
ALTER TABLE "journal_line" ADD COLUMN "rate_provenance" text;--> statement-breakpoint
ALTER TABLE "journal_line" ADD COLUMN "rate_migration_status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "payroll_item" ADD COLUMN "rate_exact" numeric;--> statement-breakpoint
ALTER TABLE "payroll_item" ADD COLUMN "rate_format_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "payroll_item" ADD COLUMN "rate_direction" text DEFAULT 'quote_per_base' NOT NULL;--> statement-breakpoint
ALTER TABLE "payroll_item" ADD COLUMN "rate_provenance" text;--> statement-breakpoint
ALTER TABLE "payroll_item" ADD COLUMN "rate_migration_status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "consolidation_rate" ADD COLUMN "rate_exact" numeric;--> statement-breakpoint
ALTER TABLE "consolidation_rate" ADD COLUMN "rate_format_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "consolidation_rate" ADD COLUMN "rate_direction" text DEFAULT 'quote_per_base' NOT NULL;--> statement-breakpoint
ALTER TABLE "consolidation_rate" ADD COLUMN "rate_provenance" text;--> statement-breakpoint
ALTER TABLE "consolidation_rate" ADD COLUMN "rate_migration_status" text DEFAULT 'pending' NOT NULL;
--> statement-breakpoint
ALTER TABLE "exchange_rate" ADD CONSTRAINT "exchange_rate_rate_exact_check" CHECK ("exchange_rate"."rate_exact" IS NULL OR ("exchange_rate"."rate_exact" > 0 AND "exchange_rate"."rate_exact" < 100000000000000000000 AND "exchange_rate"."rate_exact" = trunc("exchange_rate"."rate_exact", 18)));--> statement-breakpoint
ALTER TABLE "journal_line" ADD CONSTRAINT "journal_line_rate_exact_check" CHECK ("journal_line"."rate_exact" IS NULL OR ("journal_line"."rate_exact" > 0 AND "journal_line"."rate_exact" < 100000000000000000000 AND "journal_line"."rate_exact" = trunc("journal_line"."rate_exact", 18)));--> statement-breakpoint
ALTER TABLE "payroll_item" ADD CONSTRAINT "payroll_item_rate_exact_check" CHECK ("payroll_item"."rate_exact" IS NULL OR ("payroll_item"."rate_exact" > 0 AND "payroll_item"."rate_exact" < 100000000000000000000 AND "payroll_item"."rate_exact" = trunc("payroll_item"."rate_exact", 18)));--> statement-breakpoint
ALTER TABLE "consolidation_rate" ADD CONSTRAINT "consolidation_rate_rate_exact_check" CHECK ("consolidation_rate"."rate_exact" IS NULL OR ("consolidation_rate"."rate_exact" > 0 AND "consolidation_rate"."rate_exact" < 100000000000000000000 AND "consolidation_rate"."rate_exact" = trunc("consolidation_rate"."rate_exact", 18)));

--> statement-breakpoint
-- Reconstruct the persisted IEEE binary32 value exactly, not its rounded display text.
-- Returning NULL for nonfinite values does not pretend to repair historical data.
CREATE FUNCTION public.fx_float4_exact(value real) RETURNS numeric
LANGUAGE plpgsql IMMUTABLE STRICT AS $$
DECLARE
  bytes bytea := pg_catalog.float4send(value);
  bits bigint;
  exponent integer;
  mantissa bigint;
  result numeric;
BEGIN
  bits := get_byte(bytes, 0)::bigint * 16777216 + get_byte(bytes, 1)::bigint * 65536
        + get_byte(bytes, 2)::bigint * 256 + get_byte(bytes, 3);
  exponent := ((bits >> 23) & 255)::integer;
  IF exponent = 255 THEN RETURN NULL; END IF;
  mantissa := bits & 8388607;
  IF exponent = 0 THEN exponent := -149;
  ELSE mantissa := mantissa + 8388608; exponent := exponent - 150; END IF;
  result := mantissa;
  WHILE exponent > 0 LOOP result := result * 2; exponent := exponent - 1; END LOOP;
  WHILE exponent < 0 LOOP result := result * 0.5; exponent := exponent + 1; END LOOP;
  IF (bits >> 31) = 1 THEN result := -result; END IF;
  RETURN result;
END;
$$;
--> statement-breakpoint
-- Runs for all writes, including jobs/MCP/raw SQL, within the writer's transaction.
-- No cross-org query, SECURITY DEFINER or live-rate lookup. Legacy values are never changed.
CREATE FUNCTION public.sync_exact_fx() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  payload jsonb := to_jsonb(NEW);
  prior jsonb;
  expected numeric;
  valid_legacy boolean;
  legacy_changed boolean;
  exact_changed boolean;
  state text;
  provenance text;
BEGIN
  IF TG_OP = 'UPDATE' THEN prior := to_jsonb(OLD); END IF;
  legacy_changed := TG_OP = 'INSERT' OR (payload -> TG_ARGV[0]) IS DISTINCT FROM (prior -> TG_ARGV[0]);
  exact_changed := TG_OP = 'INSERT' AND NEW.rate_exact IS NOT NULL
    OR TG_OP = 'UPDATE' AND NEW.rate_exact IS DISTINCT FROM OLD.rate_exact
    OR TG_NARGS = 3;
  IF NEW.rate_format_version IS DISTINCT FROM 1 OR NEW.rate_direction IS DISTINCT FROM 'quote_per_base' THEN
    RAISE EXCEPTION 'Unsupported FX format or direction' USING ERRCODE = '23514';
  END IF;
  IF TG_ARGV[1] = 'binary32' THEN
    expected := public.fx_float4_exact(NEW.fx_rate);
    valid_legacy := expected IS NOT NULL AND expected > 0;
    provenance := 'legacy_binary32_exact';
    IF valid_legacy AND (expected >= 100000000000000000000 OR expected <> trunc(expected, 18)) THEN
      expected := NULL;
      state := 'legacy_float_requires_review';
      provenance := 'legacy_binary32_outside_policy';
    END IF;
  ELSE
    expected := (payload ->> TG_ARGV[0])::numeric / 1000000::numeric;
    valid_legacy := expected IS NOT NULL AND expected > 0;
    provenance := 'legacy_scaled_1e6:' || coalesce(payload ->> 'source', 'transaction');
  END IF;
  IF NOT valid_legacy THEN
    IF legacy_changed THEN
      RAISE EXCEPTION 'Legacy FX writes require a positive finite rate' USING ERRCODE = '23514';
    END IF;
    expected := NULL; state := 'invalid_legacy'; provenance := 'legacy_invalid';
  END IF;
  IF exact_changed AND NEW.rate_exact IS DISTINCT FROM expected THEN
    RAISE EXCEPTION 'Exact FX cannot be represented losslessly by the legacy field; consumer cutover required'
      USING ERRCODE = '23514';
  END IF;
  NEW.rate_exact := expected;
  NEW.rate_migration_status := coalesce(state, 'exact');
  NEW.rate_provenance := provenance;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER exchange_rate_exact_sync BEFORE INSERT OR UPDATE ON public.exchange_rate
FOR EACH ROW EXECUTE FUNCTION public.sync_exact_fx('rate', 'scaled');
--> statement-breakpoint
CREATE TRIGGER journal_line_exact_sync BEFORE INSERT OR UPDATE ON public.journal_line
FOR EACH ROW EXECUTE FUNCTION public.sync_exact_fx('exchange_rate', 'scaled');
--> statement-breakpoint
CREATE TRIGGER consolidation_rate_exact_sync BEFORE INSERT OR UPDATE ON public.consolidation_rate
FOR EACH ROW EXECUTE FUNCTION public.sync_exact_fx('rate', 'scaled');
--> statement-breakpoint
CREATE TRIGGER payroll_item_exact_sync BEFORE INSERT OR UPDATE ON public.payroll_item
FOR EACH ROW EXECUTE FUNCTION public.sync_exact_fx('fx_rate', 'binary32');
--> statement-breakpoint
CREATE TRIGGER exchange_rate_exact_input_guard BEFORE UPDATE OF rate_exact ON public.exchange_rate
FOR EACH ROW EXECUTE FUNCTION public.sync_exact_fx('rate', 'scaled', 'explicit');
--> statement-breakpoint
CREATE TRIGGER journal_line_exact_input_guard BEFORE UPDATE OF rate_exact ON public.journal_line
FOR EACH ROW EXECUTE FUNCTION public.sync_exact_fx('exchange_rate', 'scaled', 'explicit');
--> statement-breakpoint
CREATE TRIGGER consolidation_rate_exact_input_guard BEFORE UPDATE OF rate_exact ON public.consolidation_rate
FOR EACH ROW EXECUTE FUNCTION public.sync_exact_fx('rate', 'scaled', 'explicit');
--> statement-breakpoint
CREATE TRIGGER payroll_item_exact_input_guard BEFORE UPDATE OF rate_exact ON public.payroll_item
FOR EACH ROW EXECUTE FUNCTION public.sync_exact_fx('fx_rate', 'binary32', 'explicit');
--> statement-breakpoint
-- Maintenance only, invoker privileges; restricted table names and quoted identifiers.
-- No-op UPDATE invokes the same policy used for live writes. Old IDs/amounts/dates survive.
CREATE FUNCTION public.backfill_exact_fx(target_table text, batch_size integer DEFAULT 500) RETURNS integer
LANGUAGE plpgsql AS $$
DECLARE processed integer;
BEGIN
  IF target_table NOT IN ('exchange_rate', 'journal_line', 'consolidation_rate', 'payroll_item')
    OR target_table IS NULL OR batch_size IS NULL OR batch_size < 1 OR batch_size > 10000 THEN
    RAISE EXCEPTION 'Invalid FX backfill table or batch size' USING ERRCODE = '22023';
  END IF;
  EXECUTE format('WITH batch AS (SELECT id FROM public.%I WHERE rate_migration_status = ''pending''
    ORDER BY id LIMIT $1 FOR UPDATE SKIP LOCKED)
    UPDATE public.%I t SET rate_migration_status = t.rate_migration_status FROM batch WHERE t.id = batch.id',
    target_table, target_table) USING batch_size;
  GET DIAGNOSTICS processed = ROW_COUNT;
  RETURN processed;
END;
$$;
--> statement-breakpoint
-- Atomic initial backfill. Standalone calls can commit each batch and resume later.
DO $$
DECLARE target_table text;
BEGIN
  FOREACH target_table IN ARRAY ARRAY['exchange_rate', 'journal_line', 'consolidation_rate', 'payroll_item'] LOOP
    WHILE public.backfill_exact_fx(target_table, 500) > 0 LOOP END LOOP;
  END LOOP;
END;
$$;
