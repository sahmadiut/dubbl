import { customType } from "drizzle-orm/pg-core";
import { WireCompatibilityError } from "../money/wire";

/** Temporary legacy bridge: bigint storage, exact safe-number application values.
 * MON-006/007/008 replace number consumers; never silently round an int64 read.
 */
export function decodeMoneyInteger(value: string | number): number {
  if (typeof value !== "string" && typeof value !== "number") {
    throw new TypeError("Expected integer minor units from PostgreSQL");
  }
  if (typeof value === "string" && !/^-?\d+$/.test(value)) {
    throw new TypeError("Expected integer minor units from PostgreSQL");
  }
  const result = Number(value);
  if (!Number.isSafeInteger(result)) {
    throw new WireCompatibilityError();
  }
  return result;
}

export function encodeMoneyInteger(value: number): string {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw new WireCompatibilityError();
  }
  return String(value);
}

export const moneyInteger = customType<{ data: number; driverData: string }>({
  dataType: () => "bigint",
  fromDriver: decodeMoneyInteger,
  toDriver: encodeMoneyInteger,
});
