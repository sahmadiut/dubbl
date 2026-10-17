import type { useTranslations } from "next-intl";

type Translate = ReturnType<typeof useTranslations<"Invitation">>;
export function invitationRole(t: Translate, role: string) {
  // Custom role names are organization data and must retain their spelling.
  switch (role) {
    case "owner": case "admin": case "member": return t(role);
    default: return role;
  }
}
