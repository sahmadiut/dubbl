import type { useTranslations } from "next-intl";

type Translate = ReturnType<typeof useTranslations<"WorkspaceErrors">>;
type Key = Parameters<Translate>[0];
const keys: Partial<Record<string, Key>> = {
  "Not authenticated": "unauthenticated",
  "Insufficient permissions": "forbidden",
  "Site admin access required": "siteAdminRequired",
  "Organization not found": "organizationMissing",
  "Team not found": "teamMissing",
  "Member not found": "memberMissing",
  "Team member not found": "teamMemberMissing",
  "Member is already in this team": "duplicateMember",
};

export function workspaceErrorMessage(t: Translate, message: unknown, fallback: string, status?: number) {
  if (typeof message === "string" && Object.hasOwn(keys, message)) {
    const key = keys[message];
    if (key) return t(key);
  }
  if (status === 401) return t("unauthenticated");
  if (status === 403) return t("forbidden");
  return status === 400 || status === 422 ? t("invalidInput") : fallback;
}
