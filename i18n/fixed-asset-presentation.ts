import type { useTranslations } from "next-intl";
import { assetLoanJson } from "@/lib/money/asset-loan-ui";

type Translate = ReturnType<typeof useTranslations<"FixedAssets">>;
const statuses = { active: "active", fully_depreciated: "fullyDepreciated", disposed: "disposed", in_progress: "inProgress" } as const;
const methods = { straight_line: "straightLine", declining_balance: "decliningBalance" } as const;

export function fixedAssetStatusLabel(t: Translate, value: string) {
  return Object.hasOwn(statuses, value) ? t(statuses[value as keyof typeof statuses]) : value;
}
export function fixedAssetMethodLabel(t: Translate, value: string) {
  return Object.hasOwn(methods, value) ? t(methods[value as keyof typeof methods]) : value;
}

const inputKeys = {
  "Enter a nonnegative amount with at most two decimal places": "amountInvalid",
  "Enter a nonnegative amount with at most two decimal places within the supported range": "amountRange",
  "Enter a whole useful life in months from 1 to 2147483647": "lifeInvalid",
} as const;

export class FixedAssetRequestError extends Error {}

/** Keep successful DTOs behind the existing exact-money validator. */
export async function fixedAssetJson(response: Response, t: Translate, fallback: string, expected?: "data" | "asset" | "detail" | "costs" | "accounts") {
  if (!response.ok) {
    let code: unknown;
    try { code = (await response.json())?.code; } catch { /* Status or operation fallback. */ }
    const message = response.status === 401 ? t("unauthenticated")
      : response.status === 403 ? t("forbidden")
      : code === "LEGACY_NUMERIC_RANGE" ? t("invalidMoney")
      : response.status === 400 || response.status === 422 ? t("invalidInput")
      : fallback;
    throw new FixedAssetRequestError(message);
  }
  const body = await assetLoanJson(response);
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Invalid asset response");
  if (expected === "asset" || expected === "detail") {
    if (!body.asset || ["id", "name", "assetNumber", "purchaseDate"].some(key => typeof body.asset[key] !== "string")) throw new Error("Invalid asset response");
    if (expected === "detail" && !Array.isArray(body.asset.depreciationEntries)) throw new Error("Invalid asset history");
  } else if (expected) {
    if (!Array.isArray(body[expected])) throw new Error("Invalid asset collection");
    for (const row of body[expected]) {
      if (!row || typeof row.id !== "string") throw new Error("Invalid asset row");
      if (expected === "data" && ["name", "assetNumber", "purchaseDate", "status", "depreciationMethod"].some(key => typeof row[key] !== "string")) throw new Error("Invalid asset row");
      if (expected === "costs" && (typeof row.date !== "string" || typeof row.amount !== "number")) throw new Error("Invalid construction cost");
      if (expected === "accounts" && ["name", "code", "type"].some(key => typeof row[key] !== "string")) throw new Error("Invalid account row");
    }
  }
  return body;
}

/** Only trusted request messages and known local validation prose reach the UI. */
export function fixedAssetFailureMessage(error: unknown, t: Translate, fallback: string) {
  if (error instanceof FixedAssetRequestError) return error.message;
  if (error instanceof RangeError && Object.hasOwn(inputKeys, error.message)) return t(inputKeys[error.message as keyof typeof inputKeys]);
  return fallback;
}
