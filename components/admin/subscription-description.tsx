"use client";

import { useTranslations } from "next-intl";

export function SubscriptionDescription({ name, switching = false, hasStripe = false }: {
  name: string; switching?: boolean; hasStripe?: boolean;
}) {
  const t = useTranslations("Admin");
  return <>{switching ? t("switchDescription", { name }) : t("cancelDescription", { name })}
    {switching && hasStripe && t("switchStripeWarning")}</>;
}
