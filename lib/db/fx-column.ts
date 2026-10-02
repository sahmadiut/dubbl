import { check, customType } from "drizzle-orm/pg-core";
import { sql, type SQLWrapper } from "drizzle-orm";
import { exactRate } from "../currency/exact-rate";

/** Unconstrained numeric avoids PostgreSQL typmod rounding before validation.
 * The migration enforces the same positive 20/18-digit policy in SQL.
 */
export const exactFxNumeric = customType<{ data: string; driverData: string }>({
  dataType: () => "numeric",
  fromDriver: exactRate,
  toDriver: exactRate,
});

/** SQL CHECK also protects raw SQL; unlike numeric(38,18), it never rounds. */
export function fxRateCheck(name: string, column: SQLWrapper) {
  return check(name, sql`${column} IS NULL OR (${column} > 0 AND ${column} < 100000000000000000000 AND ${column} = trunc(${column}, 18))`);
}
