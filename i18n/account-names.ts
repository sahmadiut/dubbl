import type { useTranslations } from "next-intl";
import { GENERIC_ACCOUNTS } from "@/lib/db/chart-templates/generic";

type Translate = ReturnType<typeof useTranslations<"AccountNames">>;
type AccountIdentity = { name: string; type: string; subType?: string | null; isSystem?: boolean };
type NameKey = Parameters<Translate>[0];
const defaults = new Map(GENERIC_ACCOUNTS.map(account => [account.name, account]));

/** Translate only unchanged code-owned names; saved names and posting identities stay canonical. */
export function accountDisplayName(t: Translate, account: AccountIdentity): string {
  if (!account.isSystem) return account.name;
  const template = defaults.get(account.name);
  if (!template || template.type !== account.type || template.subType !== account.subType) return account.name;
  return t(`account${template.code}` as NameKey);
}
