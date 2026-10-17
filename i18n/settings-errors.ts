import type { useTranslations } from "next-intl";

type Translate = ReturnType<typeof useTranslations<"SettingsErrors">>;
type ErrorKey = Parameters<Translate>[0];

// Exact existing server contracts. Never translate REST/MCP output or treat
// arbitrary server/network prose as approved product copy.
const keys: Partial<Record<string, ErrorKey>> = {
  "Organization not found": "organizationMissing",
  "Tag not found": "tagMissing",
  "Insufficient permissions": "forbidden",
  "Not authenticated": "unauthenticated",
  "Base currency can't be changed once transactions exist": "currencyTransactions",
  "Base currency can't be changed with payroll-run history": "currencyPayroll",
  "Base currency can't be changed with asset, category or loan history": "currencyAssets",
  "Base currency can't be changed with accrual schedule history": "currencyAccruals",
};

export function settingsErrorMessage(t: Translate, message: unknown, fallback: string, status?: number): string {
  if (typeof message === "string" && Object.hasOwn(keys, message)) {
    const key = keys[message];
    if (key) return t(key);
  }
  if (status === 401) return t("unauthenticated");
  if (status === 403) return t("forbidden");
  return status === 400 || status === 422 ? t("invalidInput") : fallback;
}
