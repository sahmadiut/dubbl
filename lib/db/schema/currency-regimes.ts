import { sql } from "drizzle-orm";
import { pgTable, uuid, text, integer, date, boolean, numeric, unique, uniqueIndex, foreignKey, check } from "drizzle-orm/pg-core";
import { organization } from "./auth";

/** Append-only policy catalogue. No automatic date-based ledger conversion.
 * Dates are inclusive; null means unspecified, never a guessed cutover date.
 */
export const currencyRegime = pgTable("currency_regime", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
  regimeKey: text("regime_key").notNull(),
  isoCode: text("iso_code").notNull(),
  name: text("name").notNull(),
  effectiveFrom: date("effective_from"),
  effectiveTo: date("effective_to"),
  displayMinorUnits: integer("display_minor_units").notNull(),
  previousRegimeId: uuid("previous_regime_id"),
  // Previous major units per ONE major unit of this regime. Never binary float.
  // Unconstrained numeric plus CHECK rejects excess precision instead of rounding.
  scaleToPrevious: numeric("scale_to_previous"),
  official: boolean("official").notNull().default(false),
  sourceUrl: text("source_url").notNull(),
  verifiedOn: date("verified_on").notNull(),
}, table => [
  uniqueIndex("currency_regime_org_key_idx").on(table.organizationId, table.regimeKey),
  unique("currency_regime_org_id_idx").on(table.organizationId, table.id),
  foreignKey({ name: "currency_regime_previous_org_fk", columns: [table.organizationId, table.previousRegimeId],
    foreignColumns: [table.organizationId, table.id] }),
  check("currency_regime_code_check", sql`${table.isoCode} ~ '^[A-Z]{3}$'`),
  check("currency_regime_units_check", sql`${table.displayMinorUnits} BETWEEN 0 AND 4`),
  check("currency_regime_dates_check", sql`${table.effectiveFrom} IS NULL OR ${table.effectiveTo} IS NULL OR ${table.effectiveFrom} <= ${table.effectiveTo}`),
  check("currency_regime_scale_check", sql`(${table.previousRegimeId} IS NULL AND ${table.scaleToPrevious} IS NULL) OR
    (${table.previousRegimeId} IS NOT NULL AND ${table.previousRegimeId} <> ${table.id} AND ${table.scaleToPrevious} IS NOT NULL AND
      ${table.scaleToPrevious} > 0 AND ${table.scaleToPrevious} < 100000000000000000000 AND
      ${table.scaleToPrevious} = trunc(${table.scaleToPrevious}, 18))`),
]);
